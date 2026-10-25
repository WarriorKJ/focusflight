import * as THREE from 'three';

const EARTH_RADIUS_KM = 6371;

/**
 * Calculates great circle distance between two lat/lng coordinates in kilometers.
 */
export function calculateGreatCircleDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_KM * c);
}

/**
 * Converts Latitude & Longitude to 3D Cartesian coordinates on a sphere of given radius.
 * Note: Three.js standard coordinates: Y is up.
 */
export function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

/**
 * Computes great circle arc points between departure and destination with an altitude curve.
 * Max altitude bump occurs at mid-flight.
 */
export function generateFlightPathPoints(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  globeRadius: number,
  pointCount: number = 80
): THREE.Vector3[] {
  const v1 = latLngToVector3(startLat, startLng, globeRadius);
  const v2 = latLngToVector3(endLat, endLng, globeRadius);

  const points: THREE.Vector3[] = [];
  const startNorm = v1.clone().normalize();
  const endNorm = v2.clone().normalize();

  // Angular distance in radians
  const angle = startNorm.angleTo(endNorm);

  // Flight cruise altitude height relative to globe radius (e.g. 0.08 to 0.18 based on distance)
  const maxAltitudeBump = Math.min(0.24, Math.max(0.06, angle * 0.09));

  for (let i = 0; i <= pointCount; i++) {
    const t = i / pointCount;
    // Spherical linear interpolation between vectors
    const currentNorm = new THREE.Vector3();
    
    // Quaternion slerp for robust rotation
    const q1 = new THREE.Quaternion();
    const q2 = new THREE.Quaternion().setFromUnitVectors(startNorm, endNorm);
    const qCurrent = new THREE.Quaternion().slerpQuaternions(q1, q2, t);
    
    currentNorm.copy(startNorm).applyQuaternion(qCurrent).normalize();

    // Altitude profile: smooth sine curve peaking at mid-flight
    // Smooth takeoff and landing profile
    const altitude = Math.sin(t * Math.PI) * maxAltitudeBump;
    const r = globeRadius + altitude;

    points.push(currentNorm.multiplyScalar(r));
  }

  return points;
}

/**
 * Calculates current aircraft position & forward tangent vector along the flight trajectory.
 */
export function getAircraftStateAlongPath(
  pathPoints: THREE.Vector3[],
  progress: number // 0 to 1
): { position: THREE.Vector3; tangent: THREE.Vector3; altitudeRatio: number } {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const totalSegments = pathPoints.length - 1;
  const floatIndex = clampedProgress * totalSegments;
  const index = Math.floor(floatIndex);
  const nextIndex = Math.min(index + 1, totalSegments);
  const frac = floatIndex - index;

  const currentPoint = pathPoints[index] || pathPoints[0];
  const nextPoint = pathPoints[nextIndex] || currentPoint;

  const position = new THREE.Vector3().lerpVectors(currentPoint, nextPoint, frac);
  
  // Tangent vector
  let tangent = new THREE.Vector3().subVectors(nextPoint, currentPoint);
  if (tangent.lengthSq() < 0.0001 && index > 0) {
    tangent = new THREE.Vector3().subVectors(pathPoints[index], pathPoints[index - 1]);
  }
  tangent.normalize();

  // Altitude factor (normalized 0 to 1)
  const altitudeRatio = Math.sin(clampedProgress * Math.PI);

  return { position, tangent, altitudeRatio };
}

/**
 * Calculates initial flight heading / bearing in degrees.
 */
export function calculateInitialBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}
