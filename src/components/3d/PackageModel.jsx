import * as THREE from 'three';

/**
 * createPackageTexture
 * 
 * Generates a crisp high-resolution label texture via an offscreen HTML5 Canvas.
 * Accurately depicts a packaged food commodity with Legal Metrology Rule 6(1) declarations.
 */
function createPackageTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1360;
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  // Background: Warm Off-White Matte Package Finish
  ctx.fillStyle = '#FAF9F6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top Header Banner
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, canvas.width, 180);

  // Brand Name
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 54px Inter, sans-serif';
  ctx.fillText('NATURALS PACK', 60, 95);

  ctx.fillStyle = '#38BDF8';
  ctx.font = '500 24px monospace';
  ctx.fillText('PREMIUM PACKAGED COMMODITY', 60, 140);

  // Product Title
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 58px Inter, sans-serif';
  ctx.fillText('Roasted California', 60, 290);
  ctx.fillText('Almonds', 60, 360);

  // Subtitle
  ctx.fillStyle = '#64748B';
  ctx.font = '500 28px Inter, sans-serif';
  ctx.fillText('Lightly Salted • 100% Natural • Grade A', 60, 420);

  // Product Art Accent Box
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 4;
  ctx.strokeRect(60, 460, canvas.width - 120, 240);
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(62, 462, canvas.width - 124, 236);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('500g FAMILY PACK', canvas.width / 2, 590);
  ctx.textAlign = 'left';

  // Legal Metrology Declaration Zone Header
  ctx.fillStyle = '#0284C7';
  ctx.fillRect(60, 740, canvas.width - 120, 48);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('LEGAL METROLOGY (PACKAGED COMMODITIES) RULES, 2011', 80, 772);

  // Declaration Bounding Box 1: MRP
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#0284C7';
  ctx.lineWidth = 3;
  ctx.fillRect(60, 810, canvas.width - 120, 100);
  ctx.strokeRect(60, 810, canvas.width - 120, 100);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 32px monospace';
  ctx.fillText('MRP ₹ 249.00 (Incl. of all taxes)', 90, 868);
  ctx.fillStyle = '#64748B';
  ctx.font = '20px monospace';
  ctx.fillText('Rule 6(1)(e) - Max Retail Price', 680, 868);

  // Declaration Bounding Box 2: Net Quantity
  ctx.fillRect(60, 930, canvas.width - 120, 100);
  ctx.strokeRect(60, 930, canvas.width - 120, 100);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 32px monospace';
  ctx.fillText('NET QUANTITY: 500 g (0.5 kg)', 90, 988);
  ctx.fillStyle = '#64748B';
  ctx.font = '20px monospace';
  ctx.fillText('Rule 6(1)(c) - Unit of Weight', 680, 988);

  // Declaration Bounding Box 3: Dates
  ctx.fillRect(60, 1050, canvas.width - 120, 100);
  ctx.strokeRect(60, 1050, canvas.width - 120, 100);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 32px monospace';
  ctx.fillText('MFG: 04/2026 | BEST BEFORE: 12M', 90, 1108);
  ctx.fillStyle = '#64748B';
  ctx.font = '20px monospace';
  ctx.fillText('Rule 6(1)(d) - Mfg Date', 680, 1108);

  // Declaration Bounding Box 4: Consumer Care
  ctx.fillRect(60, 1170, canvas.width - 120, 100);
  ctx.strokeRect(60, 1170, canvas.width - 120, 100);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('CONSUMER CARE: 1800-11-4000', 90, 1228);
  ctx.fillStyle = '#D97706';
  ctx.font = '20px monospace';
  ctx.fillText('Rule 6(1)(f) - Contact Notice', 680, 1228);

  // Barcode representation
  ctx.fillStyle = '#0F172A';
  for (let i = 0; i < 40; i++) {
    const x = 80 + i * 8;
    const w = (i % 3 === 0 ? 5 : 2);
    ctx.fillRect(x, 1290, w, 45);
  }
  ctx.font = '16px monospace';
  ctx.fillText('8901030918234', 440, 1320);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * createPackageMesh
 * 
 * Generates the 3D packaged commodity standing on the inspection workbench.
 */
export function createPackageMesh() {
  const packageGroup = new THREE.Group();
  packageGroup.name = 'PackagedCommoditySpecimen';

  const width = 0.28;
  const height = 0.38;
  const depth = 0.12;

  const labelTexture = createPackageTexture();

  // Materials for 6 faces of the box
  const sideMaterial = new THREE.MeshStandardMaterial({
    color: 0xE2E8F0,
    roughness: 0.5,
    metalness: 0.1,
  });

  const frontMaterial = new THREE.MeshStandardMaterial({
    map: labelTexture,
    roughness: 0.3,
    metalness: 0.05,
  });

  const materials = [
    sideMaterial, // right
    sideMaterial, // left
    sideMaterial, // top
    sideMaterial, // bottom
    frontMaterial, // front (+Z)
    sideMaterial, // back (-Z)
  ];

  const boxGeo = new THREE.BoxGeometry(width, height, depth, 4, 4, 4);
  const boxMesh = new THREE.Mesh(boxGeo, materials);
  boxMesh.position.set(0, height / 2, 0);
  boxMesh.castShadow = true;
  boxMesh.receiveShadow = true;
  packageGroup.add(boxMesh);

  // Subtle package base stand / acrylic fixture
  const fixtureGeo = new THREE.BoxGeometry(width + 0.04, 0.015, depth + 0.04);
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0xCBD5E1,
    roughness: 0.2,
    metalness: 0.8,
  });
  const fixtureMesh = new THREE.Mesh(fixtureGeo, fixtureMat);
  fixtureMesh.position.set(0, 0.0075, 0);
  fixtureMesh.receiveShadow = true;
  packageGroup.add(fixtureMesh);

  return {
    group: packageGroup,
    dimensions: { width, height, depth },
  };
}
