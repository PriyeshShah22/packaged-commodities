import * as THREE from 'three';

/**
 * ScannerBeam3D
 * 
 * Generates and updates a dynamic 3D optical laser scan beam.
 * Projects from the handheld scanner nozzle to the target package surface.
 */
export class ScannerBeam3D {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'ScannerBeam3D';
    this.visible = false;

    // Materials
    this.beamMaterial = new THREE.MeshBasicMaterial({
      color: 0x38BDF8, // Sky cyan
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.coreLineMaterial = new THREE.LineBasicMaterial({
      color: 0x0284C7,
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });

    this.focalPointMaterial = new THREE.MeshBasicMaterial({
      color: 0xBAE6FD,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });

    // 1. Fan / Cone Geometry (triangular projection from emitter to sweeping line)
    this.fanGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(9); // 3 vertices
    this.fanGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.fanMesh = new THREE.Mesh(this.fanGeo, this.beamMaterial);
    this.group.add(this.fanMesh);

    // 2. Focused Focal Line across target package
    const lineGeo = new THREE.BufferGeometry();
    const linePositions = new Float32Array(6); // 2 vertices
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    this.focalLine = new THREE.Line(lineGeo, this.coreLineMaterial);
    this.group.add(this.focalLine);

    // 3. Focal Hotspot Point
    const hotspotGeo = new THREE.SphereGeometry(0.008, 12, 12);
    this.hotspotMesh = new THREE.Mesh(hotspotGeo, this.focalPointMaterial);
    this.group.add(this.hotspotMesh);

    this.group.visible = false;
  }

  /**
   * update
   * 
   * @param {THREE.Vector3} emitterPos - Global position of scanner nozzle
   * @param {THREE.Vector3} targetCenter - Center of package target
   * @param {number} scanProgress - 0.0 to 1.0 (sweeping Y from top to bottom)
   * @param {boolean} active - whether laser is firing
   * @param {number} packageWidth - width of package
   * @param {number} packageHeight - height of package
   */
  update(emitterPos, targetCenter, scanProgress = 0.5, active = false, packageWidth = 0.28, packageHeight = 0.38) {
    if (!active) {
      this.group.visible = false;
      return;
    }

    this.group.visible = true;

    // Calculate sweeping laser line on front face of package
    // Y ranges from top (targetCenter.y + packageHeight * 0.4) to bottom (targetCenter.y - packageHeight * 0.4)
    const scanY = (targetCenter.y + packageHeight * 0.45) - scanProgress * (packageHeight * 0.85);
    const zOffset = targetCenter.z + 0.062; // Front face + slight epsilon

    const leftX = targetCenter.x - packageWidth * 0.48;
    const rightX = targetCenter.x + packageWidth * 0.48;

    // Update Fan Projection: Emitter -> Left Target -> Right Target
    const fanPositions = this.fanGeo.attributes.position.array;
    // Vertex 0: Emitter
    fanPositions[0] = emitterPos.x;
    fanPositions[1] = emitterPos.y;
    fanPositions[2] = emitterPos.z;
    // Vertex 1: Left sweep point
    fanPositions[3] = leftX;
    fanPositions[4] = scanY;
    fanPositions[5] = zOffset;
    // Vertex 2: Right sweep point
    fanPositions[6] = rightX;
    fanPositions[7] = scanY;
    fanPositions[8] = zOffset;

    this.fanGeo.attributes.position.needsUpdate = true;

    // Update Focal Line: Left sweep point -> Right sweep point
    const linePositions = this.focalLine.geometry.attributes.position.array;
    linePositions[0] = leftX;
    linePositions[1] = scanY;
    linePositions[2] = zOffset;
    linePositions[3] = rightX;
    linePositions[4] = scanY;
    linePositions[5] = zOffset;
    this.focalLine.geometry.attributes.position.needsUpdate = true;

    // Hotspot at center of beam
    this.hotspotMesh.position.set(targetCenter.x, scanY, zOffset);
  }
}
