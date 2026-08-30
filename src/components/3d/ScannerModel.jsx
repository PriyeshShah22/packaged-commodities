import * as THREE from 'three';

/**
 * createScannerMesh
 * 
 * Generates a high-precision 3D Handheld Inspection Scanner object.
 * Designed as a professional industrial inspection instrument:
 * - Ergonomic grip handle
 * - Matte graphite chassis
 * - Status OLED screen with PackMetrix accent indicator
 * - Optical scanner head with recessed glass lens and laser emitter node
 */
export function createScannerMesh() {
  const scannerGroup = new THREE.Group();
  scannerGroup.name = 'HandheldInspectionScanner';

  // Materials
  const chassisMaterial = new THREE.MeshStandardMaterial({
    color: 0x1E293B, // Dark slate / graphite
    roughness: 0.35,
    metalness: 0.6,
  });

  const gripMaterial = new THREE.MeshStandardMaterial({
    color: 0x0F172A, // Charcoal rubber grip
    roughness: 0.8,
    metalness: 0.1,
  });

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0x0284C7, // PackMetrix sky accent
    roughness: 0.2,
    metalness: 0.8,
    emissive: 0x0284C7,
    emissiveIntensity: 0.4,
  });

  const screenMaterial = new THREE.MeshStandardMaterial({
    color: 0x0F172A,
    roughness: 0.1,
    metalness: 0.9,
    emissive: 0x0369A1,
    emissiveIntensity: 0.3,
  });

  const lensMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x38BDF8,
    transmission: 0.7,
    opacity: 0.9,
    transparent: true,
    roughness: 0.05,
    ior: 1.5,
    emissive: 0x0284C7,
    emissiveIntensity: 0.5,
  });

  // 1. Grip Handle
  const handleGeo = new THREE.CylinderGeometry(0.016, 0.019, 0.12, 16);
  handleGeo.rotateX(Math.PI / 10);
  const handleMesh = new THREE.Mesh(handleGeo, gripMaterial);
  handleMesh.position.set(0, -0.05, -0.02);
  handleMesh.castShadow = true;
  scannerGroup.add(handleMesh);

  // 2. Main Body / Chassis
  const bodyGeo = new THREE.BoxGeometry(0.045, 0.05, 0.11);
  const bodyMesh = new THREE.Mesh(bodyGeo, chassisMaterial);
  bodyMesh.position.set(0, 0.01, 0.02);
  bodyMesh.castShadow = true;
  scannerGroup.add(bodyMesh);

  // 3. Top Angled Housing
  const headGeo = new THREE.BoxGeometry(0.042, 0.04, 0.06);
  headGeo.rotateX(-Math.PI / 16);
  const headMesh = new THREE.Mesh(headGeo, chassisMaterial);
  headMesh.position.set(0, 0.03, 0.065);
  headMesh.castShadow = true;
  scannerGroup.add(headMesh);

  // 4. Optical Emitter Nozzle (Front)
  const nozzleGeo = new THREE.CylinderGeometry(0.014, 0.017, 0.025, 16);
  nozzleGeo.rotateX(Math.PI / 2);
  const nozzleMesh = new THREE.Mesh(nozzleGeo, chassisMaterial);
  nozzleMesh.position.set(0, 0.02, 0.1);
  scannerGroup.add(nozzleMesh);

  // 5. Optical Glass Lens
  const lensGeo = new THREE.CircleGeometry(0.013, 16);
  const lensMesh = new THREE.Mesh(lensGeo, lensMaterial);
  lensMesh.position.set(0, 0.02, 0.113);
  scannerGroup.add(lensMesh);

  // 6. OLED Status Display Screen (Top)
  const screenGeo = new THREE.PlaneGeometry(0.028, 0.038);
  screenGeo.rotateX(-Math.PI / 2);
  const screenMesh = new THREE.Mesh(screenGeo, screenMaterial);
  screenMesh.position.set(0, 0.036, 0.01);
  scannerGroup.add(screenMesh);

  // 7. PackMetrix Accent Trim Strip
  const trimGeo = new THREE.BoxGeometry(0.046, 0.004, 0.04);
  const trimMesh = new THREE.Mesh(trimGeo, accentMaterial);
  trimMesh.position.set(0, 0.028, 0.01);
  scannerGroup.add(trimMesh);

  // 8. Emitter Beam Anchor Point (Child marker object)
  const emitterNode = new THREE.Object3D();
  emitterNode.name = 'ScannerEmitterPoint';
  emitterNode.position.set(0, 0.02, 0.115);
  scannerGroup.add(emitterNode);

  // Scale to human proportion
  scannerGroup.scale.set(1.1, 1.1, 1.1);

  return {
    group: scannerGroup,
    emitterNode,
  };
}
