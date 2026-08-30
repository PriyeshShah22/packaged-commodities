import * as THREE from 'three';
import { createScannerMesh } from './ScannerModel';

/**
 * createInspectorHumanoid
 * 
 * Generates an articulated 3D human field inspector character with full skeletal
 * hierarchy, professional clothing (inspection vest, shirt, ID badge, trousers, shoes),
 * anatomical proportions, and an attached handheld inspection scanner.
 */
export function createInspectorHumanoid() {
  const inspectorRoot = new THREE.Group();
  inspectorRoot.name = 'HumanFieldInspector';

  // Materials with realistic PBR properties
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0xE2BAA2, // Natural skin tone
    roughness: 0.6,
    metalness: 0.05,
  });

  const hairMaterial = new THREE.MeshStandardMaterial({
    color: 0x1E293B, // Dark brown/slate hair
    roughness: 0.8,
    metalness: 0.1,
  });

  const shirtMaterial = new THREE.MeshStandardMaterial({
    color: 0xF8FAFC, // Crisp white / light grey field shirt
    roughness: 0.7,
    metalness: 0.0,
  });

  const vestMaterial = new THREE.MeshStandardMaterial({
    color: 0x0F172A, // Dark navy / charcoal inspection tactical vest
    roughness: 0.55,
    metalness: 0.15,
  });

  const vestTrimMaterial = new THREE.MeshStandardMaterial({
    color: 0x0284C7, // Subtle PackMetrix accent seam on vest
    roughness: 0.4,
    metalness: 0.4,
  });

  const badgeMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    roughness: 0.2,
    metalness: 0.8,
  });

  const lanyardMaterial = new THREE.MeshStandardMaterial({
    color: 0x0284C7, // Blue lanyard cord
    roughness: 0.8,
  });

  const trousersMaterial = new THREE.MeshStandardMaterial({
    color: 0x334155, // Professional slate trousers
    roughness: 0.7,
    metalness: 0.05,
  });

  const shoeMaterial = new THREE.MeshStandardMaterial({
    color: 0x0F172A, // Polished black inspection shoes
    roughness: 0.3,
    metalness: 0.3,
  });

  // ================= SKELETAL JOINT HIERARCHY =================

  // 1. Root / Hips (Pelvis & Waist)
  const hips = new THREE.Group();
  hips.name = 'BONE_Hips';
  hips.position.set(0, 0.95, 0);
  inspectorRoot.add(hips);

  // Pelvis / Hips Geometry
  const hipsGeo = new THREE.CylinderGeometry(0.14, 0.13, 0.14, 16);
  const hipsMesh = new THREE.Mesh(hipsGeo, trousersMaterial);
  hipsMesh.castShadow = true;
  hips.add(hipsMesh);

  // Belt & Buckle
  const beltGeo = new THREE.CylinderGeometry(0.145, 0.145, 0.035, 16);
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.4 });
  const beltMesh = new THREE.Mesh(beltGeo, beltMat);
  beltMesh.position.set(0, 0.06, 0);
  hips.add(beltMesh);

  const buckleGeo = new THREE.BoxGeometry(0.04, 0.03, 0.015);
  const buckleMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.9, roughness: 0.2 });
  const buckleMesh = new THREE.Mesh(buckleGeo, buckleMat);
  buckleMesh.position.set(0, 0.06, 0.145);
  hips.add(buckleMesh);

  // 2. Spine (Lower Back / Torso)
  const spine = new THREE.Group();
  spine.name = 'BONE_Spine';
  spine.position.set(0, 0.08, 0);
  hips.add(spine);

  const spineGeo = new THREE.CylinderGeometry(0.15, 0.14, 0.16, 16);
  const spineMesh = new THREE.Mesh(spineGeo, shirtMaterial);
  spineMesh.position.set(0, 0.08, 0);
  spineMesh.castShadow = true;
  spine.add(spineMesh);

  // 3. Chest (Upper Torso with Inspection Vest)
  const chest = new THREE.Group();
  chest.name = 'BONE_Chest';
  chest.position.set(0, 0.16, 0);
  spine.add(chest);

  // Upper Torso Mesh (Shirt Base)
  const chestGeo = new THREE.BoxGeometry(0.32, 0.22, 0.19);
  const chestMesh = new THREE.Mesh(chestGeo, shirtMaterial);
  chestMesh.position.set(0, 0.11, 0);
  chestMesh.castShadow = true;
  chest.add(chestMesh);

  // Professional Field Inspection Vest (Outer Layer)
  const vestGeo = new THREE.BoxGeometry(0.335, 0.24, 0.205);
  const vestMesh = new THREE.Mesh(vestGeo, vestMaterial);
  vestMesh.position.set(0, 0.11, 0);
  vestMesh.castShadow = true;
  chest.add(vestMesh);

  // Vest Collar
  const collarGeo = new THREE.CylinderGeometry(0.11, 0.12, 0.05, 16, 1, true, 0, Math.PI);
  collarGeo.rotateY(Math.PI / 2);
  const collarMesh = new THREE.Mesh(collarGeo, vestMaterial);
  collarMesh.position.set(0, 0.23, 0.01);
  chest.add(collarMesh);

  // Vest Accent Stripe
  const vestTrimGeo = new THREE.BoxGeometry(0.34, 0.01, 0.21);
  const vestTrimMesh = new THREE.Mesh(vestTrimGeo, vestTrimMaterial);
  vestTrimMesh.position.set(0, 0.03, 0);
  chest.add(vestTrimMesh);

  // Pockets on Vest
  const pocketGeo = new THREE.BoxGeometry(0.08, 0.08, 0.015);
  const leftPocket = new THREE.Mesh(pocketGeo, vestMaterial);
  leftPocket.position.set(-0.09, 0.08, 0.108);
  chest.add(leftPocket);

  const rightPocket = new THREE.Mesh(pocketGeo, vestMaterial);
  rightPocket.position.set(0.09, 0.08, 0.108);
  chest.add(rightPocket);

  // Official ID Badge & Lanyard
  const lanyardGeo = new THREE.TorusGeometry(0.09, 0.004, 8, 24);
  lanyardGeo.rotateX(Math.PI / 2.8);
  const lanyardMesh = new THREE.Mesh(lanyardGeo, lanyardMaterial);
  lanyardMesh.position.set(0, 0.18, 0.08);
  chest.add(lanyardMesh);

  const badgeGeo = new THREE.BoxGeometry(0.045, 0.065, 0.005);
  const badgeMesh = new THREE.Mesh(badgeGeo, badgeMaterial);
  badgeMesh.position.set(-0.06, 0.12, 0.115);
  badgeMesh.rotation.z = -0.05;
  chest.add(badgeMesh);

  // 4. Neck & Head
  const neck = new THREE.Group();
  neck.name = 'BONE_Neck';
  neck.position.set(0, 0.22, 0);
  chest.add(neck);

  const neckGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.08, 16);
  const neckMesh = new THREE.Mesh(neckGeo, skinMaterial);
  neckMesh.position.set(0, 0.04, 0);
  neck.add(neckMesh);

  const head = new THREE.Group();
  head.name = 'BONE_Head';
  head.position.set(0, 0.08, 0);
  neck.add(head);

  // Head Skull Geometry
  const headGeo = new THREE.SphereGeometry(0.095, 20, 20);
  headGeo.scale(0.9, 1.15, 1.0);
  const headMesh = new THREE.Mesh(headGeo, skinMaterial);
  headMesh.position.set(0, 0.08, 0.01);
  headMesh.castShadow = true;
  head.add(headMesh);

  // Hair Styling
  const hairGeo = new THREE.SphereGeometry(0.102, 16, 16);
  hairGeo.scale(0.92, 1.05, 1.02);
  const hairMesh = new THREE.Mesh(hairGeo, hairMaterial);
  hairMesh.position.set(0, 0.11, -0.01);
  head.add(hairMesh);

  // Nose
  const noseGeo = new THREE.ConeGeometry(0.015, 0.035, 8);
  noseGeo.rotateX(Math.PI / 2);
  const noseMesh = new THREE.Mesh(noseGeo, skinMaterial);
  noseMesh.position.set(0, 0.075, 0.105);
  head.add(noseMesh);

  // Ears
  const earGeo = new THREE.SphereGeometry(0.02, 8, 8);
  earGeo.scale(0.3, 1.2, 0.8);
  const leftEar = new THREE.Mesh(earGeo, skinMaterial);
  leftEar.position.set(-0.09, 0.075, 0);
  head.add(leftEar);
  const rightEar = new THREE.Mesh(earGeo, skinMaterial);
  rightEar.position.set(0.09, 0.075, 0);
  head.add(rightEar);

  // ================= LEFT ARM (RESTING NATURAL POSE) =================
  const leftShoulder = new THREE.Group();
  leftShoulder.name = 'BONE_LeftShoulder';
  leftShoulder.position.set(-0.19, 0.18, 0);
  chest.add(leftShoulder);

  const leftUpperArm = new THREE.Group();
  leftUpperArm.name = 'BONE_LeftUpperArm';
  leftUpperArm.position.set(-0.03, 0, 0);
  leftShoulder.add(leftUpperArm);

  const upperArmGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.26, 16);
  const leftUpperArmMesh = new THREE.Mesh(upperArmGeo, shirtMaterial);
  leftUpperArmMesh.position.set(0, -0.13, 0);
  leftUpperArmMesh.castShadow = true;
  leftUpperArm.add(leftUpperArmMesh);

  const leftForeArm = new THREE.Group();
  leftForeArm.name = 'BONE_LeftForeArm';
  leftForeArm.position.set(0, -0.26, 0);
  leftUpperArm.add(leftForeArm);

  const foreArmGeo = new THREE.CylinderGeometry(0.038, 0.032, 0.24, 16);
  const leftForeArmMesh = new THREE.Mesh(foreArmGeo, skinMaterial);
  leftForeArmMesh.position.set(0, -0.12, 0);
  leftForeArmMesh.castShadow = true;
  leftForeArm.add(leftForeArmMesh);

  const leftHand = new THREE.Group();
  leftHand.name = 'BONE_LeftHand';
  leftHand.position.set(0, -0.24, 0);
  leftForeArm.add(leftHand);

  const handGeo = new THREE.BoxGeometry(0.04, 0.08, 0.025);
  const leftHandMesh = new THREE.Mesh(handGeo, skinMaterial);
  leftHandMesh.position.set(0, -0.04, 0);
  leftHand.add(leftHandMesh);

  // Default resting rotation for left arm
  leftUpperArm.rotation.z = 0.12;
  leftUpperArm.rotation.x = 0.08;
  leftForeArm.rotation.x = -0.15;

  // ================= RIGHT ARM (ACTIVE SCANNER MOUNT ARM) =================
  const rightShoulder = new THREE.Group();
  rightShoulder.name = 'BONE_RightShoulder';
  rightShoulder.position.set(0.19, 0.18, 0);
  chest.add(rightShoulder);

  const rightUpperArm = new THREE.Group();
  rightUpperArm.name = 'BONE_RightUpperArm';
  rightUpperArm.position.set(0.03, 0, 0);
  rightShoulder.add(rightUpperArm);

  const rightUpperArmMesh = new THREE.Mesh(upperArmGeo, shirtMaterial);
  rightUpperArmMesh.position.set(0, -0.13, 0);
  rightUpperArmMesh.castShadow = true;
  rightUpperArm.add(rightUpperArmMesh);

  const rightForeArm = new THREE.Group();
  rightForeArm.name = 'BONE_RightForeArm';
  rightForeArm.position.set(0, -0.26, 0);
  rightUpperArm.add(rightForeArm);

  const rightForeArmMesh = new THREE.Mesh(foreArmGeo, skinMaterial);
  rightForeArmMesh.position.set(0, -0.12, 0);
  rightForeArmMesh.castShadow = true;
  rightForeArm.add(rightForeArmMesh);

  const rightHand = new THREE.Group();
  rightHand.name = 'BONE_RightHand';
  rightHand.position.set(0, -0.24, 0);
  rightForeArm.add(rightHand);

  const rightHandMesh = new THREE.Mesh(handGeo, skinMaterial);
  rightHandMesh.position.set(0, -0.04, 0);
  rightHand.add(rightHandMesh);

  // Mount Scanner into Right Hand
  const scannerMount = new THREE.Group();
  scannerMount.name = 'ScannerMountSocket';
  scannerMount.position.set(0, -0.05, 0.04);
  scannerMount.rotation.x = Math.PI / 4;
  rightHand.add(scannerMount);

  const scannerData = createScannerMesh();
  scannerMount.add(scannerData.group);

  // ================= LEGS & FEET =================
  const legGeo = new THREE.CylinderGeometry(0.065, 0.05, 0.44, 16);
  const shinGeo = new THREE.CylinderGeometry(0.05, 0.042, 0.44, 16);
  const shoeGeo = new THREE.BoxGeometry(0.09, 0.08, 0.22);

  // Left Leg
  const leftThigh = new THREE.Group();
  leftThigh.position.set(-0.09, -0.08, 0);
  hips.add(leftThigh);

  const leftThighMesh = new THREE.Mesh(legGeo, trousersMaterial);
  leftThighMesh.position.set(0, -0.22, 0);
  leftThighMesh.castShadow = true;
  leftThigh.add(leftThighMesh);

  const leftShin = new THREE.Group();
  leftShin.position.set(0, -0.44, 0);
  leftThigh.add(leftShin);

  const leftShinMesh = new THREE.Mesh(shinGeo, trousersMaterial);
  leftShinMesh.position.set(0, -0.22, 0);
  leftShinMesh.castShadow = true;
  leftShin.add(leftShinMesh);

  const leftFoot = new THREE.Mesh(shoeGeo, shoeMaterial);
  leftFoot.position.set(0, -0.44, 0.05);
  leftFoot.castShadow = true;
  leftShin.add(leftFoot);

  // Right Leg
  const rightThigh = new THREE.Group();
  rightThigh.position.set(0.09, -0.08, 0);
  hips.add(rightThigh);

  const rightThighMesh = new THREE.Mesh(legGeo, trousersMaterial);
  rightThighMesh.position.set(0, -0.22, 0);
  rightThighMesh.castShadow = true;
  rightThigh.add(rightThighMesh);

  const rightShin = new THREE.Group();
  rightShin.position.set(0, -0.44, 0);
  rightThigh.add(rightShin);

  const rightShinMesh = new THREE.Mesh(shinGeo, trousersMaterial);
  rightShinMesh.position.set(0, -0.22, 0);
  rightShinMesh.castShadow = true;
  rightShin.add(rightShinMesh);

  const rightFoot = new THREE.Mesh(shoeGeo, shoeMaterial);
  rightFoot.position.set(0, -0.44, 0.05);
  rightFoot.castShadow = true;
  rightShin.add(rightFoot);

  // Scale and position
  inspectorRoot.scale.set(1.0, 1.0, 1.0);

  return {
    root: inspectorRoot,
    bones: {
      hips,
      spine,
      chest,
      neck,
      head,
      leftShoulder,
      leftUpperArm,
      leftForeArm,
      leftHand,
      rightShoulder,
      rightUpperArm,
      rightForeArm,
      rightHand,
      scannerMount,
    },
    scannerEmitterNode: scannerData.emitterNode,
  };
}
