import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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

    // Camera setup - Calibrated orbit distance of 5.8 units with zero initial offset
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5.8);

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

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3.2;
    controls.maxDistance = 16.0;
    controls.rotateSpeed = 0.7;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Lighting
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
    // CRISP HIGH-RESOLUTION 4K GEOGRAPHIC EARTH MAP (NATURAL EARTH 50M)
    // ==============================================================
    const globeRadius = 2.5;

    function createAuthenticEarthTexture(): THREE.CanvasTexture {
      const canvas = document.createElement('canvas');
      canvas.width = 4096;
      canvas.height = 2048;
      const ctx = canvas.getContext('2d')!;

      // 1. Pristine ocean styling
      const oceanGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      oceanGrad.addColorStop(0, '#091c36');
      oceanGrad.addColorStop(0.25, '#0d284a');
      oceanGrad.addColorStop(0.5, '#12345d');
      oceanGrad.addColorStop(0.75, '#0d284a');
      oceanGrad.addColorStop(1, '#091c36');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Subtle Aeronautical Navigation Graticule Grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      for (let lat = -80; lat <= 80; lat += 20) {
        const y = ((90 - lat) / 180) * canvas.height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      for (let lng = -180; lng <= 180; lng += 30) {
        const x = ((lng + 180) / 360) * canvas.width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Equator & Prime Meridian accents
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // 3. Mathematical equirectangular projection matching Three.js SphereGeometry UVs
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

      // 4. Fill landmasses with crisp high-contrast tone
      ctx.fillStyle = '#1c3e6b';
      ctx.beginPath();
      pathGenerator(countries);
      ctx.fill();

      // 5. Razor-sharp sky-blue coastal outline (2.4px on 4K)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      pathGenerator(countries);
      ctx.stroke();

      // 6. Crisp sovereign international country borders
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.75)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      pathGenerator(borders);
      ctx.stroke();

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.needsUpdate = true;
      return texture;
    }

    const earthTexture = createAuthenticEarthTexture();
    const globeGeo = new THREE.SphereGeometry(globeRadius, 96, 96);
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

    // Flight Path Arc with built-in baseline ground clearance
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

    // ==============================================================
    // AUTHENTIC 3D AIRCRAFT MODEL (BOEING 737 / AIRBUS A380 PROPORTIONS)
    // ==============================================================
    const aircraftGroup = new THREE.Group();
    scene.add(aircraftGroup);
    aircraftRef.current = aircraftGroup;

    // Load authentic Boeing 737 glTF 3D model
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      '/models/B737.glb',
      (gltf) => {
        const model = gltf.scene;

        // Compute original model bounding box and center
        const box = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);

        // Center model geometry locally at (0, 0, 0)
        model.position.x -= center.x;
        model.position.y -= center.y;
        model.position.z -= center.z;

        // Container to handle rotation & scaling
        const modelWrapper = new THREE.Group();
        modelWrapper.add(model);

        // Rotate -90 degrees around Y:
        // In Three.js, Object3D.lookAt() aligns local +Z with the target direction.
        // In B737.glb: Nose is at +X, Tail at -X, Up is +Y, Wings along Z.
        // Rotating by -Math.PI / 2 (-90 deg) maps:
        // - Nose (+X) -> +Z (faces forward along flight tangent toward destination)
        // - Tail (-X) -> -Z (trails aft behind the aircraft)
        // - Left wing (Port) -> -X (with red navigation strobe)
        // - Right wing (Starboard) -> +X (with green navigation strobe)
        // - Up (+Y) -> +Y (space altitude away from Earth surface)
        modelWrapper.rotation.y = -Math.PI / 2;

        // Scale to realistic proportion relative to the Earth globe
        // Wingspan / length target of 0.16 units gives true airliner scale without clipping
        const maxDim = Math.max(size.x, size.z);
        const targetSize = 0.16;
        const scaleFactor = targetSize / maxDim;
        modelWrapper.scale.set(scaleFactor, scaleFactor, scaleFactor);

        // Lift model slightly above trajectory point so wheels/belly/wings sit 100% outside the globe
        modelWrapper.position.y = 0.015;

        // Enhance textures and materials
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (mesh.material) {
              const mat = mesh.material as THREE.MeshStandardMaterial;
              mat.roughness = 0.28;
              mat.metalness = 0.3;
            }
          }
        });

        // Add wingtip & tail navigation strobes in aircraftGroup (+Z forward, -X port, +X starboard)
        const strobeGeo = new THREE.SphereGeometry(0.0035, 8, 8);
        const redStrobe = new THREE.Mesh(strobeGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
        redStrobe.position.set(-targetSize * 0.48, 0.018, -targetSize * 0.1);

        const greenStrobe = new THREE.Mesh(strobeGeo, new THREE.MeshBasicMaterial({ color: 0x22c55e }));
        greenStrobe.position.set(targetSize * 0.48, 0.018, -targetSize * 0.1);

        const tailStrobe = new THREE.Mesh(strobeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
        tailStrobe.position.set(0, 0.045, -targetSize * 0.48);

        // Remove placeholder and mount authentic Boeing 737 with navigation strobes
        while (aircraftGroup.children.length > 0) {
          aircraftGroup.remove(aircraftGroup.children[0]);
        }
        aircraftGroup.add(modelWrapper);
        aircraftGroup.add(redStrobe);
        aircraftGroup.add(greenStrobe);
        aircraftGroup.add(tailStrobe);
      },
      undefined,
      (err) => {
        console.warn('Could not load B737.glb, falling back to procedural airliner:', err);
      }
    );

    // Initial camera position directly in front of Departure Airport
    const depPos = latLngToVector3(departure.lat, departure.lng, globeRadius);
    const depDir = depPos.clone().normalize();
    const initialDistance = 5.8;
    camera.position.copy(depDir.clone().multiplyScalar(initialDistance));
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
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

        // Orient aircraft along flight trajectory
        // Forward target points along +tangent; Three.js Object3D.lookAt aligns local +Z (nose) with tangent
        const forwardTarget = state.position.clone().add(state.tangent);
        const upVec = state.position.clone().normalize();
        aircraftRef.current.up.copy(upVec);
        aircraftRef.current.lookAt(forwardTarget);

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
          // Auto-follow maintains mathematical distance invariance (zero zoom-out drift)
          if (!isUserTrackingPausedRef.current) {
            const currentDist = camera.position.length();
            const planeDir = state.position.clone().normalize();
            const currentDir = camera.position.clone().normalize();
            currentDir.lerp(planeDir, 0.04).normalize();
            camera.position.copy(currentDir.multiplyScalar(currentDist));
          }
        } else if (currentMode === 'follow') {
          const backwardVec = state.tangent.clone().multiplyScalar(-0.65);
          const chaseCamPos = state.position
            .clone()
            .add(backwardVec)
            .add(upVec.clone().multiplyScalar(0.28));

          camera.position.lerp(chaseCamPos, 0.08);
          controls.target.lerp(state.position, 0.1);
        } else if (currentMode === 'cockpit') {
          const cockpitTarget = state.position.clone().add(state.tangent.clone().multiplyScalar(1.0));
          const cockpitPos = state.position
            .clone()
            .add(upVec.clone().multiplyScalar(0.04))
            .add(state.tangent.clone().multiplyScalar(0.05));

          camera.position.lerp(cockpitPos, 0.1);
          controls.target.lerp(cockpitTarget, 0.1);
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
        <div className="absolute top-36 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              isUserTrackingPausedRef.current = false;
              setIsTrackingPlane(true);
            }}
            className="px-4 py-2 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-sky-500/40 text-sky-300 hover:text-white text-xs font-mono font-semibold backdrop-blur-md shadow-2xl flex items-center gap-2 transition-all cursor-pointer hover:scale-105 active:scale-95 ring-1 ring-sky-500/30"
          >
            <Compass className="w-4 h-4 text-sky-400 animate-spin" style={{ animationDuration: '6s' }} />
            <span>Resume Following Aircraft</span>
          </button>
        </div>
      )}
    </div>
  );
};
