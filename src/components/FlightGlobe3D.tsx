import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as topojson from 'topojson-client';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { Compass } from 'lucide-react';
import worldAtlasData from 'world-atlas/countries-50m.json';
import { Airport } from '../types/flight';
import { generateFlightPathPoints, getAircraftStateAlongPath, latLngToVector3 } from '../utils/geo';

interface FlightGlobe3DProps {
  departure: Airport;
  destination: Airport;
  totalDurationSeconds: number;
  isPaused: boolean;
  cameraMode: 'globe' | 'follow' | 'cockpit';
  airlineColor: string;
  onContinuousProgressUpdate?: (progress: number) => void;
}

export const FlightGlobe3D: React.FC<FlightGlobe3DProps> = ({
  departure,
  destination,
  totalDurationSeconds,
  isPaused,
  cameraMode,
  airlineColor,
  onContinuousProgressUpdate,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const aircraftRef = useRef<THREE.Group | null>(null);
  const pathPointsRef = useRef<THREE.Vector3[]>([]);
  const trailRef = useRef<THREE.Line | null>(null);
  const fullPathLineRef = useRef<THREE.Line | null>(null);

  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const totalDurationRef = useRef(totalDurationSeconds);
  totalDurationRef.current = totalDurationSeconds;

  const flightStartTimeRef = useRef<number>(performance.now());
  const pausedTimeRef = useRef<number>(0);
  const lastPauseStartRef = useRef<number | null>(null);
  const currentProgressRef = useRef<number>(0);

  const [isTrackingPlane, setIsTrackingPlane] = useState(true);
  const isUserTrackingPausedRef = useRef(false);

  useEffect(() => {
    flightStartTimeRef.current = performance.now();
    pausedTimeRef.current = 0;
    lastPauseStartRef.current = null;
    currentProgressRef.current = 0;
    isUserTrackingPausedRef.current = false;
    setIsTrackingPlane(true);
  }, [departure.iata, destination.iata, totalDurationSeconds]);

  useEffect(() => {
    isUserTrackingPausedRef.current = false;
    setIsTrackingPlane(true);
  }, [cameraMode]);

  useEffect(() => {
    if (isPaused) {
      lastPauseStartRef.current = performance.now();
    } else {
      if (lastPauseStartRef.current !== null) {
        pausedTimeRef.current += performance.now() - lastPauseStartRef.current;
        lastPauseStartRef.current = null;
      }
    }
  }, [isPaused]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera setup - The GLOBE is strictly centered in the middle of the screen
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 1.8, 7.8);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Orbit Controls - Target is strictly (0, 0, 0) so the Globe is always the dead center
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3.2;
    controls.maxDistance = 18.0;
    controls.rotateSpeed = 0.7;
    controls.target.set(0, 0, 0); // Center on Globe!
    controlsRef.current = controls;

    // Lighting: Sun Light + Fill + Ambient + Hemisphere
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.6);
    sunLight.position.set(8, 10, 10);
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.5);
    fillLight.position.set(-10, -4, -8);
    scene.add(fillLight);

    const ambientLight = new THREE.AmbientLight(0x384c68, 1.6);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x60a5fa, 0x1e293b, 1.2);
    scene.add(hemiLight);

    // Background Stars
    const starCount = isSoftwareGl ? 500 : 1400;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      const r = 45 + Math.random() * 45;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      starPos[i] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i + 2] = r * Math.cos(phi);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xc7d2fe,
      size: 0.12,
      transparent: true,
      opacity: 0.55,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // ==============================================================
    // 100% REAL GEOGRAPHIC EARTH TEXTURE USING NATURAL EARTH 50M DATA
    // ==============================================================
    const globeRadius = 2.5;

    function createAuthenticEarthTexture(): THREE.CanvasTexture {
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d')!;

      // 1. Pristine ocean gradient
      const oceanGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      oceanGrad.addColorStop(0, '#0c233c');
      oceanGrad.addColorStop(0.3, '#103050');
      oceanGrad.addColorStop(0.5, '#133a62');
      oceanGrad.addColorStop(0.7, '#103050');
      oceanGrad.addColorStop(1, '#0c233c');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Set up clean mathematical projection matching Three.js SphereGeometry UVs
      const projection = geoEquirectangular()
        .scale(canvas.width / (2 * Math.PI))
        .translate([canvas.width / 2, canvas.height / 2]);

      const pathGenerator = geoPath(projection, ctx);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topology = worldAtlasData as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const countries = topojson.feature(topology, topology.objects.countries) as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const borders = topojson.mesh(topology, topology.objects.countries, (a: any, b: any) => a !== b) as any;

      // 3. Draw authentic continents & sovereign landmasses
      ctx.fillStyle = '#1e3e68'; // Clean landmass fill
      ctx.strokeStyle = '#38bdf8'; // Clean coastal outline
      ctx.lineWidth = 1.2;

      ctx.beginPath();
      pathGenerator(countries);
      ctx.fill();
      ctx.stroke();

      // 4. Draw clean sovereign international country borders (no random lines or grid artifacts)
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.7)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      pathGenerator(borders);
      ctx.stroke();

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return texture;
    }

    const earthTexture = createAuthenticEarthTexture();
    const globeGeo = new THREE.SphereGeometry(globeRadius, 64, 64);
    const globeMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.55,
      metalness: 0.1,
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globeMesh);

    // Atmosphere Shell
    const atmosphereGeo = new THREE.SphereGeometry(globeRadius * 1.018, 48, 48);
    const atmosphereMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    scene.add(atmosphereMesh);

    // Airport Markers
    function createAirportMarker(airport: Airport, color: number): THREE.Group {
      const group = new THREE.Group();
      const pos = latLngToVector3(airport.lat, airport.lng, globeRadius + 0.02);
      group.position.copy(pos);
      group.lookAt(0, 0, 0);

      const ringGeo = new THREE.RingGeometry(0.04, 0.07, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      group.add(ring);

      const pinGeo = new THREE.CylinderGeometry(0.012, 0.005, 0.16, 8);
      const pinMat = new THREE.MeshBasicMaterial({ color });
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.z = -0.08;
      pin.rotation.x = Math.PI / 2;
      group.add(pin);

      const beaconLightGeo = new THREE.SphereGeometry(0.025, 12, 12);
      const beaconLightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const beaconLight = new THREE.Mesh(beaconLightGeo, beaconLightMat);
      beaconLight.position.z = -0.16;
      group.add(beaconLight);

      return group;
    }

    const depMarker = createAirportMarker(departure, 0x10b981);
    const destMarker = createAirportMarker(destination, 0xf59e0b);
    scene.add(depMarker);
    scene.add(destMarker);

    // Flight Path Arc
    const points = generateFlightPathPoints(
      departure.lat,
      departure.lng,
      destination.lat,
      destination.lng,
      globeRadius,
      140
    );
    pathPointsRef.current = points;

    const fullPathGeo = new THREE.BufferGeometry().setFromPoints(points);
    const fullPathMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.08,
      gapSize: 0.04,
      transparent: true,
      opacity: 0.5,
    });
    const fullPathLine = new THREE.Line(fullPathGeo, fullPathMat);
    fullPathLine.computeLineDistances();
    scene.add(fullPathLine);
    fullPathLineRef.current = fullPathLine;

    const trailGeo = new THREE.BufferGeometry().setFromPoints([points[0], points[0]]);
    const trailMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 3,
      transparent: true,
      opacity: 0.95,
    });
    const trailLine = new THREE.Line(trailGeo, trailMat);
    scene.add(trailLine);
    trailRef.current = trailLine;

    // Procedural Aircraft
    function createProceduralAircraft(): THREE.Group {
      const plane = new THREE.Group();
      const parsedAirline = parseInt(airlineColor.replace('#', '0x'), 16) || 0x0ea5e9;

      const fuselageMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.25,
        metalness: 0.4,
      });

      const wingMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.3,
        metalness: 0.3,
      });

      const airlineMat = new THREE.MeshStandardMaterial({
        color: parsedAirline,
        roughness: 0.3,
        metalness: 0.5,
      });

      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x0284c7,
        roughness: 0.1,
        metalness: 0.9,
        clearcoat: 1.0,
      });

      const bodyGeo = new THREE.CylinderGeometry(0.045, 0.038, 0.42, 16);
      bodyGeo.rotateX(Math.PI / 2);
      const fuselage = new THREE.Mesh(bodyGeo, fuselageMat);
      plane.add(fuselage);

      const noseGeo = new THREE.ConeGeometry(0.044, 0.12, 16);
      noseGeo.rotateX(Math.PI / 2);
      const nose = new THREE.Mesh(noseGeo, fuselageMat);
      nose.position.z = 0.26;
      plane.add(nose);

      const cockpitGeo = new THREE.SphereGeometry(0.035, 12, 12, 0, Math.PI, 0, Math.PI / 2);
      cockpitGeo.rotateX(Math.PI / 3);
      const cockpit = new THREE.Mesh(cockpitGeo, glassMat);
      cockpit.position.set(0, 0.025, 0.2);
      cockpit.scale.set(0.9, 0.6, 1.2);
      plane.add(cockpit);

      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(0.38, -0.16);
      wingShape.lineTo(0.36, -0.22);
      wingShape.lineTo(0, -0.06);
      wingShape.closePath();

      const wingExtrude = new THREE.ExtrudeGeometry(wingShape, { depth: 0.008, bevelEnabled: false });
      wingExtrude.rotateX(Math.PI / 2);

      const rightWing = new THREE.Mesh(wingExtrude, wingMat);
      rightWing.position.set(0.02, 0.0, 0.05);
      plane.add(rightWing);

      const leftWing = new THREE.Mesh(wingExtrude, wingMat);
      leftWing.scale.set(-1, 1, 1);
      leftWing.position.set(-0.02, 0.0, 0.05);
      plane.add(leftWing);

      const wingletGeo = new THREE.BoxGeometry(0.006, 0.05, 0.04);
      const rightWinglet = new THREE.Mesh(wingletGeo, airlineMat);
      rightWinglet.position.set(0.37, 0.02, -0.12);
      plane.add(rightWinglet);

      const leftWinglet = new THREE.Mesh(wingletGeo, airlineMat);
      leftWinglet.position.set(-0.37, 0.02, -0.12);
      plane.add(leftWinglet);

      const engineGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.12, 12);
      engineGeo.rotateX(Math.PI / 2);
      const engineMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.2 });

      const rightEngine = new THREE.Mesh(engineGeo, engineMat);
      rightEngine.position.set(0.14, -0.035, 0.0);
      plane.add(rightEngine);

      const leftEngine = new THREE.Mesh(engineGeo, engineMat);
      leftEngine.position.set(-0.14, -0.035, 0.0);
      plane.add(leftEngine);

      const finShape = new THREE.Shape();
      finShape.moveTo(0, 0);
      finShape.lineTo(0.16, 0);
      finShape.lineTo(-0.08, 0.14);
      finShape.lineTo(-0.14, 0);
      finShape.closePath();

      const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.008, bevelEnabled: false });
      finGeo.rotateY(Math.PI / 2);
      const fin = new THREE.Mesh(finGeo, airlineMat);
      fin.position.set(0.004, 0.03, -0.12);
      plane.add(fin);

      const elevShape = new THREE.Shape();
      elevShape.moveTo(0, 0);
      elevShape.lineTo(0.14, -0.06);
      elevShape.lineTo(0.13, -0.09);
      elevShape.lineTo(0, -0.04);
      elevShape.closePath();

      const elevGeo = new THREE.ExtrudeGeometry(elevShape, { depth: 0.006, bevelEnabled: false });
      elevGeo.rotateX(Math.PI / 2);

      const rightElev = new THREE.Mesh(elevGeo, wingMat);
      rightElev.position.set(0.01, 0.02, -0.18);
      plane.add(rightElev);

      const leftElev = new THREE.Mesh(elevGeo, wingMat);
      leftElev.scale.set(-1, 1, 1);
      leftElev.position.set(-0.01, 0.02, -0.18);
      plane.add(leftElev);

      const strobeGeo = new THREE.SphereGeometry(0.008, 6, 6);
      const redMesh = new THREE.Mesh(strobeGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      redMesh.position.set(-0.37, 0.045, -0.12);
      plane.add(redMesh);

      const greenMesh = new THREE.Mesh(strobeGeo, new THREE.MeshBasicMaterial({ color: 0x22c55e }));
      greenMesh.position.set(0.37, 0.045, -0.12);
      plane.add(greenMesh);

      plane.scale.set(0.48, 0.48, 0.48);
      return plane;
    }

    const aircraft = createProceduralAircraft();
    scene.add(aircraft);
    aircraftRef.current = aircraft;

    // Start camera directly in front of the Departure Airport facing center of Globe!
    const depPos = latLngToVector3(departure.lat, departure.lng, globeRadius);
    const depDir = depPos.clone().normalize();
    camera.position.copy(depDir.clone().multiplyScalar(7.2).add(new THREE.Vector3(0, 0.4, 0)));
    controls.target.set(0, 0, 0); // Globe is center of screen!
    controls.update();

    // User interaction detection: stop auto-following when user scrolls or drags
    const handleUserInteraction = () => {
      if (!isUserTrackingPausedRef.current) {
        isUserTrackingPausedRef.current = true;
        setIsTrackingPlane(false);
      }
    };

    controls.addEventListener('start', handleUserInteraction);
    const domEl = renderer.domElement;
    domEl.addEventListener('wheel', handleUserInteraction, { passive: true });
    domEl.addEventListener('pointerdown', handleUserInteraction);

    // RENDER LOOP
    let frameId = 0;
    const clock = new THREE.Clock();

    function updateScene() {
      const delta = clock.getDelta();
      const pts = pathPointsRef.current;

      const now = performance.now();
      const totalMs = (totalDurationRef.current || 25 * 60) * 1000;
      let effectiveElapsedMs = now - flightStartTimeRef.current - pausedTimeRef.current;
      if (isPausedRef.current && lastPauseStartRef.current !== null) {
        effectiveElapsedMs -= (now - lastPauseStartRef.current);
      }

      const continuousProgress = Math.max(0, Math.min(1, effectiveElapsedMs / totalMs));
      currentProgressRef.current = continuousProgress;

      if (onContinuousProgressUpdate) {
        onContinuousProgressUpdate(continuousProgress);
      }

      if (aircraftRef.current && pts.length > 1) {
        const state = getAircraftStateAlongPath(pts, continuousProgress);

        aircraftRef.current.position.copy(state.position);

        const targetPos = state.position.clone().add(state.tangent);
        const upVec = state.position.clone().normalize();
        aircraftRef.current.up.copy(upVec);
        aircraftRef.current.lookAt(targetPos);

        if (trailRef.current) {
          const totalPoints = pts.length;
          const floatIndex = continuousProgress * (totalPoints - 1);
          const currentPointIdx = Math.max(1, Math.floor(floatIndex));
          const activePoints = pts.slice(0, currentPointIdx + 1);
          activePoints.push(state.position);
          trailRef.current.geometry.dispose();
          trailRef.current.geometry = new THREE.BufferGeometry().setFromPoints(activePoints);
        }

        const currentMode = cameraModeRef.current;
        if (currentMode === 'globe') {
          controls.target.set(0, 0, 0);
          // If user hasn't scrolled or dragged away, follow the plane around the globe
          if (!isUserTrackingPausedRef.current) {
            const planeDir = state.position.clone().normalize();
            const currentDist = Math.max(4.5, camera.position.length() || 7.2);
            const targetCamPos = planeDir.multiplyScalar(currentDist).add(new THREE.Vector3(0, 0.35, 0));
            camera.position.lerp(targetCamPos, 0.04);
          }
        } else if (currentMode === 'follow') {
          const backwardVec = state.tangent.clone().multiplyScalar(-1.15);
          const chaseCamPos = state.position
            .clone()
            .add(backwardVec)
            .add(upVec.clone().multiplyScalar(0.45));

          camera.position.lerp(chaseCamPos, 0.08);
          controls.target.lerp(state.position, 0.1);
        } else if (currentMode === 'cockpit') {
          const forwardTarget = state.position.clone().add(state.tangent.clone().multiplyScalar(1.2));
          const cockpitPos = state.position.clone().add(upVec.clone().multiplyScalar(0.08));

          camera.position.lerp(cockpitPos, 0.1);
          controls.target.lerp(forwardTarget, 0.1);
        }
      }

      starField.rotation.y += delta * 0.004;

      const pulse = 1 + 0.12 * Math.sin(clock.getElapsedTime() * 3);
      depMarker.scale.set(pulse, pulse, pulse);
      destMarker.scale.set(pulse, pulse, pulse);

      controls.update();
      renderer.render(scene, camera);
    }

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      updateScene();
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    const handleResize = () => {
      if (!container || !rendererRef.current) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', handleUserInteraction);
      domEl.removeEventListener('wheel', handleUserInteraction);
      domEl.removeEventListener('pointerdown', handleUserInteraction);

      if (isSoftwareGl) {
        clearTimeout(frameId);
      } else {
        cancelAnimationFrame(frameId);
      }

      controls.dispose();
      globeGeo.dispose();
      globeMat.dispose();
      earthTexture.dispose();
      atmosphereGeo.dispose();
      atmosphereMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      fullPathGeo.dispose();
      fullPathMat.dispose();
      trailRef.current?.geometry.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [departure, destination, airlineColor]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-slate-950">
      <div ref={mountRef} className="w-full h-full" />

      {/* Floating button to resume following plane when user has scrolled away */}
      {!isTrackingPlane && cameraMode === 'globe' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              isUserTrackingPausedRef.current = false;
              setIsTrackingPlane(true);
            }}
            className="px-4 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-sky-500/40 text-sky-300 hover:text-white text-xs font-mono font-semibold backdrop-blur-md shadow-xl flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span>Resume Following Plane</span>
          </button>
        </div>
      )}
    </div>
  );
};
