import * as THREE from 'three';

/**
 * createInspectionBoardTexture
 * 
 * Generates an inspection workspace surface texture with millimeter tick lines
 * and package placement registration marks.
 */
function createInspectionBoardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  // Background: Warm Off-white / light slate
  ctx.fillStyle = '#F8F9FA';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Micro Grid
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.8)';
  ctx.lineWidth = 1;
  const gridSize = 32;
  for (let x = 0; x <= canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Major Grid Lines
  ctx.strokeStyle = 'rgba(203, 213, 225, 0.9)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= canvas.width; x += gridSize * 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += gridSize * 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Center Package Placement Zone Target
  const targetX = canvas.width / 2;
  const targetY = canvas.height / 2 + 60;
  const targetW = 320;
  const targetH = 260;

  ctx.strokeStyle = '#0284C7';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(targetX - targetW / 2, targetY - targetH / 2, targetW, targetH);
  ctx.setLineDash([]);

  // Corner Registration Crosshairs
  const drawCross = (cx, cy) => {
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy);
    ctx.lineTo(cx + 16, cy);
    ctx.moveTo(cx, cy - 16);
    ctx.lineTo(cx, cy + 16);
    ctx.stroke();
  };

  drawCross(targetX - targetW / 2, targetY - targetH / 2);
  drawCross(targetX + targetW / 2, targetY - targetH / 2);
  drawCross(targetX - targetW / 2, targetY + targetH / 2);
  drawCross(targetX + targetW / 2, targetY + targetH / 2);

  // Label
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LEGAL METROLOGY SPECIMEN STAGE', targetX, targetY + targetH / 2 + 40);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/**
 * createInspectionBoardMesh
 * 
 * Generates the 3D inspection floor and background backdrop.
 */
export function createInspectionBoardMesh() {
  const boardGroup = new THREE.Group();
  boardGroup.name = 'InspectionWorkspaceStage';

  const floorTexture = createInspectionBoardTexture();

  // 1. Table / Stage Top
  const floorGeo = new THREE.PlaneGeometry(3.5, 3.5);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTexture,
    roughness: 0.4,
    metalness: 0.05,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  boardGroup.add(floorMesh);

  // 2. Backdrop Panel (Soft warm neutral studio background)
  const backGeo = new THREE.PlaneGeometry(5.0, 3.5);
  const backMat = new THREE.MeshStandardMaterial({
    color: 0xF1F5F9,
    roughness: 0.8,
    metalness: 0.0,
  });
  const backMesh = new THREE.Mesh(backGeo, backMat);
  backMesh.position.set(0, 1.75, -1.8);
  backMesh.receiveShadow = true;
  boardGroup.add(backMesh);

  return boardGroup;
}
