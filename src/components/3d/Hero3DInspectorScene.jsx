import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createScannerMesh } from './ScannerModel';
import { createPackageMesh } from './PackageModel';
import { createInspectionBoardMesh } from './InspectionBoard3D';
import { ScannerBeam3D } from './ScannerBeam3D';
import { 
  Check, 
  AlertTriangle, 
  ShieldCheck, 
  IndianRupee, 
  Scale, 
  Calendar, 
  PhoneCall, 
  Loader2 
} from 'lucide-react';


/**
 * Hero3DInspectorScene
 * 
 * Production 3D Hero Visual for the PackMetrix Authentication Screen.
 * 
 * Features:
 * - Real rigged GLB Inspector model from `/packmetrix-inspector.glb`
 * - Handheld Optical Scanner attached to the GLB's `RightHand` bone
 * - 3D Packaged Commodity Specimen ("PREMIUM ROASTED ALMONDS")
 * - 3D Optical Laser Scanning Beam
 * - Automated natural inspection sequence loop:
 *   IDLE → LOOK AT PACKAGE → RAISE SCANNER → SCAN LABEL → REVEAL DECLARATIONS → RETURN TO IDLE → REPEAT
 * - Synchronized live HUD showing Legal Metrology declaration validations:
 *   MRP (₹249), Net Qty (500g), Date (04/2026), Consumer Care (Review ⚠)
 * - Subtle mouse camera parallax, studio soft shadows, and warm-white inspection stage
 */
export default function Hero3DInspectorScene({ className = '' }) {
  const mountRef = useRef(null);

  // States
  const [loadStatus, setLoadStatus] = useState('LOADING'); // 'LOADING' | 'READY' | 'ERROR'
  const [errorMessage, setErrorMessage] = useState('');
  const [scanStage, setScanStage] = useState('READY'); // 'READY' | 'SCANNING' | 'ANALYZING' | 'VERIFIED'
  const [revealedDeclarations, setRevealedDeclarations] = useState({
    mrp: false,
    net_qty: false,
    dates: false,
    consumer_care: false,
  });


  // Scene references
  const animFrameRef = useRef(null);
  const sceneRefs = useRef({
    scene: null,
    camera: null,
    renderer: null,
    inspectorModel: null,
    rightArmBone: null,
    rightForeArmBone: null,
    rightHandBone: null,
    headBone: null,
    neckBone: null,
    spineBone: null,
    scannerEmitterNode: null,
    laserBeam: null,
    packageMesh: null,
    packagePos: new THREE.Vector3(0.42, 0, 0.35),
    packageDimensions: { width: 0.28, height: 0.38, depth: 0.12 },
    mixer: null,
    idleAction: null,
    mouse: { x: 0, y: 0, targetX: 0, targetY: 0 },
  });

  // Setup Three.js WebGL Scene
  useEffect(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 640;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xF8F9FA);

    // 2. Camera (Product Hero View)
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(0.65, 1.35, 2.75);
    camera.lookAt(0.08, 0.88, 0.15);

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.appendChild(renderer.domElement);

    // 4. Studio Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.75);
    scene.add(ambientLight);

    // Key Light (Warm Key Studio Light with Soft Shadows)
    const keyLight = new THREE.DirectionalLight(0xFFFBF5, 1.4);
    keyLight.position.set(2.5, 4.2, 2.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 12;
    keyLight.shadow.camera.left = -2;
    keyLight.shadow.camera.right = 2;
    keyLight.shadow.camera.top = 2.5;
    keyLight.shadow.camera.bottom = -0.5;
    keyLight.shadow.bias = -0.0003;
    scene.add(keyLight);

    // Fill Light (Soft Cool Blue Fill)
    const fillLight = new THREE.DirectionalLight(0xBAE6FD, 0.55);
    fillLight.position.set(-3.0, 2.2, 1.8);
    scene.add(fillLight);

    // Rim Light (Sharp Silhouette Accent)
    const rimLight = new THREE.DirectionalLight(0x38BDF8, 0.9);
    rimLight.position.set(0.2, 2.8, -2.8);
    scene.add(rimLight);

    // 5. Stage & Floor
    const boardGroup = createInspectionBoardMesh();
    scene.add(boardGroup);

    // 6. 3D Packaged Product ("PREMIUM ROASTED ALMONDS")
    const packageData = createPackageMesh();
    const packagePos = new THREE.Vector3(0.38, 0, 0.32);
    packageData.group.position.copy(packagePos);
    packageData.group.rotation.y = -Math.PI / 10; // Angle towards inspector
    scene.add(packageData.group);

    // 7. 3D Laser Scan Beam
    const laserBeam = new ScannerBeam3D();
    scene.add(laserBeam.group);

    sceneRefs.current.scene = scene;
    sceneRefs.current.camera = camera;
    sceneRefs.current.renderer = renderer;
    sceneRefs.current.packageMesh = packageData.group;
    sceneRefs.current.packagePos = packagePos;
    sceneRefs.current.packageDimensions = packageData.dimensions;
    sceneRefs.current.laserBeam = laserBeam;

    // 8. Load the Real Rigged GLB Model
    const loader = new GLTFLoader();
    loader.load(
      '/packmetrix-inspector.glb',
      (gltf) => {
        const model = gltf.scene;
        sceneRefs.current.inspectorModel = model;

        // Compute Bounding Box & Center
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Position inspector standing naturally on the ground plane
        model.position.set(-0.35, -box.min.y, -0.05);
        model.rotation.y = Math.PI / 12; // Facing slightly towards the package

        // Enable shadows on all meshes
        model.traverse((child) => {
          if (child.isMesh || child.isSkinnedMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.side = THREE.DoubleSide;
              if (child.material.map) {
                child.material.map.colorSpace = THREE.SRGBColorSpace;
              }
            }
          }
        });

        // Find Bone Nodes in the Skeleton Rig
        let rightHandBone = null;
        let rightForeArmBone = null;
        let rightArmBone = null;
        let headBone = null;
        let neckBone = null;
        let spineBone = null;

        model.traverse((child) => {
          if (child.isBone) {
            const name = child.name.toLowerCase();
            if (name === 'righthand' || name.includes('righthand')) rightHandBone = child;
            if (name === 'rightforearm' || name.includes('rightforearm')) rightForeArmBone = child;
            if (name === 'rightarm' || name.includes('rightarm')) rightArmBone = child;
            if (name === 'head' || name.includes('head')) headBone = child;
            if (name === 'neck' || name.includes('neck')) neckBone = child;
            if (name === 'spine2' || name === 'spine1' || name === 'spine') spineBone = child;
          }
        });

        sceneRefs.current.rightHandBone = rightHandBone;
        sceneRefs.current.rightForeArmBone = rightForeArmBone;
        sceneRefs.current.rightArmBone = rightArmBone;
        sceneRefs.current.headBone = headBone;
        sceneRefs.current.neckBone = neckBone;
        sceneRefs.current.spineBone = spineBone;

        // Attach Handheld Scanner directly to the Real RightHand Bone
        if (rightHandBone) {
          const scannerData = createScannerMesh();
          const scannerGroup = scannerData.group;

          // Scale and orient scanner to fit securely in hand
          scannerGroup.scale.set(1.15, 1.15, 1.15);
          scannerGroup.position.set(-0.02, -0.08, 0.04);
          scannerGroup.rotation.set(Math.PI / 3.5, -Math.PI / 8, 0);

          rightHandBone.add(scannerGroup);
          sceneRefs.current.scannerEmitterNode = scannerData.emitterNode;
        }

        // Initialize Animation Mixer & Play Idle Animation
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          sceneRefs.current.mixer = mixer;

          const idleClip = gltf.animations.find((c) => c.name.toLowerCase() === 'idle') || gltf.animations[0];
          if (idleClip) {
            const idleAction = mixer.clipAction(idleClip);
            idleAction.setEffectiveWeight(0.85);
            idleAction.play();
            sceneRefs.current.idleAction = idleAction;
          }
        }

        scene.add(model);
        setLoadStatus('READY');
      },
      undefined,
      (err) => {
        console.error('Error loading /packmetrix-inspector.glb:', err);
        setLoadStatus('ERROR');
        setErrorMessage(err.message || 'Failed to load GLB inspector model.');
      }
    );

    // 9. Mouse Parallax Handler
    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      sceneRefs.current.mouse.targetX = x * 0.12;
      sceneRefs.current.mouse.targetY = y * 0.08;
    };
    container.addEventListener('mousemove', handleMouseMove);

    // 10. Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight || 640;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    // 11. Main Animation & Kinematic Inspection Director Loop
    const clock = new THREE.Clock();
    let sequenceTime = 0;
    const CYCLE_DURATION = 9.5; // Complete 9.5s inspection cycle

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      sequenceTime += delta;
      const cycleProgress = sequenceTime % CYCLE_DURATION;

      // Update Three.js Animation Mixer (for underlying breathing / natural idle motion)
      if (sceneRefs.current.mixer) {
        sceneRefs.current.mixer.update(delta);
      }

      // Smooth Camera Mouse Parallax
      const m = sceneRefs.current.mouse;
      m.x += (m.targetX - m.x) * 0.05;
      m.y += (m.targetY - m.y) * 0.05;
      camera.position.x = 0.65 + m.x;
      camera.position.y = 1.35 + m.y;
      camera.lookAt(0.08, 0.88, 0.15);

      // Procedural Skeletal Inspection Choreography
      // 0.0s - 1.5s: IDLE
      // 1.5s - 2.5s: LOOK AT PACKAGE
      // 2.5s - 4.0s: RAISE SCANNER & AIM
      // 4.0s - 6.8s: SWEEP SCANNER ACROSS LABEL + LASER BEAM
      // 6.8s - 8.0s: RETURN TO IDLE
      // 8.0s - 9.5s: REST & SHOW VERIFIED SUMMARY

      const { rightArmBone, rightForeArmBone, rightHandBone, headBone, laserBeam, scannerEmitterNode, packagePos, packageDimensions } = sceneRefs.current;

      let isLaserFiring = false;
      let sweepRatio = 0;

      if (cycleProgress < 1.5) {
        // State: IDLE / READY
        setScanStage('READY');
        setRevealedDeclarations({ mrp: false, net_qty: false, dates: false, consumer_care: false });
      } else if (cycleProgress < 2.5) {

        // State: LOOK AT PACKAGE
        setScanStage('SCANNING');
        const t = (cycleProgress - 1.5) / 1.0;
        if (headBone) {
          headBone.rotation.y = THREE.MathUtils.lerp(headBone.rotation.y, 0.28, t);
          headBone.rotation.x = THREE.MathUtils.lerp(headBone.rotation.x, 0.14, t);
        }
      } else if (cycleProgress < 4.0) {
        // State: RAISE SCANNER
        setScanStage('SCANNING');
        const t = (cycleProgress - 2.5) / 1.5;
        if (rightArmBone) {
          rightArmBone.rotation.x = THREE.MathUtils.lerp(0.0, 0.65, t);
          rightArmBone.rotation.y = THREE.MathUtils.lerp(0.0, -0.35, t);
          rightArmBone.rotation.z = THREE.MathUtils.lerp(0.0, -0.2, t);
        }
        if (rightForeArmBone) {
          rightForeArmBone.rotation.x = THREE.MathUtils.lerp(0.0, -0.85, t);
        }
        if (rightHandBone) {
          rightHandBone.rotation.x = THREE.MathUtils.lerp(0.0, 0.25, t);
        }
      } else if (cycleProgress < 6.8) {
        // State: ACTIVE SCANNER SWEEP ACROSS LABEL
        setScanStage('ANALYZING');
        isLaserFiring = true;
        const scanT = (cycleProgress - 4.0) / 2.8; // 0 to 1
        sweepRatio = scanT;

        // Sinusoidal sweep across the package: Top to Bottom + Left to Right tracking

        const sweepX = Math.sin(scanT * Math.PI * 3) * 0.08;
        const sweepY = scanT * 0.35;

        if (rightArmBone) {
          rightArmBone.rotation.x = 0.65 - sweepY * 0.4;
          rightArmBone.rotation.y = -0.35 + sweepX;
          rightArmBone.rotation.z = -0.2;
        }
        if (rightForeArmBone) {
          rightForeArmBone.rotation.x = -0.85 + sweepY * 0.3;
        }
        if (rightHandBone) {
          rightHandBone.rotation.x = 0.25 - sweepY * 0.5;
          rightHandBone.rotation.y = sweepX * 0.5;
        }
        if (headBone) {
          headBone.rotation.x = 0.14 + scanT * 0.08;
        }

        // Progressive Declaration Unlocks based on laser position
        setRevealedDeclarations({
          mrp: scanT > 0.22,
          net_qty: scanT > 0.46,
          dates: scanT > 0.68,
          consumer_care: scanT > 0.86,
        });
      } else if (cycleProgress < 8.0) {
        // State: RETURN TO IDLE
        setScanStage('VERIFIED');
        isLaserFiring = false;
        const returnT = (cycleProgress - 6.8) / 1.2;

        if (rightArmBone) {
          rightArmBone.rotation.x = THREE.MathUtils.lerp(0.5, 0.0, returnT);
          rightArmBone.rotation.y = THREE.MathUtils.lerp(-0.35, 0.0, returnT);
          rightArmBone.rotation.z = THREE.MathUtils.lerp(-0.2, 0.0, returnT);
        }
        if (rightForeArmBone) {
          rightForeArmBone.rotation.x = THREE.MathUtils.lerp(-0.6, 0.0, returnT);
        }
        if (rightHandBone) {
          rightHandBone.rotation.x = THREE.MathUtils.lerp(0.1, 0.0, returnT);
        }
        if (headBone) {
          headBone.rotation.y = THREE.MathUtils.lerp(0.28, 0.0, returnT);
          headBone.rotation.x = THREE.MathUtils.lerp(0.14, 0.0, returnT);
        }

        setRevealedDeclarations({ mrp: true, net_qty: true, dates: true, consumer_care: true });
      } else {
        // State: VERIFIED SUMMARY REST (8.0s - 9.5s)
        setScanStage('VERIFIED');
        isLaserFiring = false;
        setRevealedDeclarations({ mrp: true, net_qty: true, dates: true, consumer_care: true });
      }

      // Update 3D Laser Beam Projection
      if (laserBeam && scannerEmitterNode) {
        const emitterWorldPos = new THREE.Vector3();
        scannerEmitterNode.getWorldPosition(emitterWorldPos);

        const packageTargetPos = new THREE.Vector3(
          packagePos.x,
          packagePos.y + packageDimensions.height / 2,
          packagePos.z
        );

        laserBeam.update(
          emitterWorldPos,
          packageTargetPos,
          sweepRatio,
          isLaserFiring,
          packageDimensions.width,
          packageDimensions.height
        );
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      container.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className={`relative w-full h-full min-h-[580px] lg:min-h-[720px] bg-[#F8F9FA] rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between ${className}`}>
      
      {/* 3D WebGL Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Loading Overlay */}
      {loadStatus === 'LOADING' && (
        <div className="absolute inset-0 z-30 bg-[#F8F9FA]/90 backdrop-blur-xs flex flex-col items-center justify-center p-8 text-center space-y-4 animate-fade-in-up">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-md flex items-center justify-center text-sky-600">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase">
              PackMetrix Inspection System
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Initializing 3D Field Inspector...
            </h3>
          </div>
          <div className="w-48 h-1 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-sky-600 animate-pulse rounded-full w-2/3" />
          </div>
        </div>
      )}

      {/* Error Fallback */}
      {loadStatus === 'ERROR' && (
        <div className="absolute inset-0 z-30 bg-rose-50/90 backdrop-blur-xs flex flex-col items-center justify-center p-8 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600" />
          <h3 className="text-base font-bold text-slate-900">Unable to load 3D asset</h3>
          <p className="text-xs font-mono text-rose-700 max-w-sm">{errorMessage}</p>
        </div>
      )}

      {/* Top Header HUD Bar */}
      <div className="relative z-20 p-5 sm:p-7 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-600"></span>
          </span>
          <span className="text-xs font-mono font-bold tracking-tight text-slate-900 bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-200/90 shadow-2xs">
            LEGAL METROLOGY FIELD INSPECTION • 3D WORKSPACE
          </span>
        </div>

        {/* Dynamic Status Pill */}
        <div className="flex items-center gap-2">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border backdrop-blur-xs shadow-2xs transition-all duration-300 ${
            scanStage === 'SCANNING' || scanStage === 'ANALYZING'
              ? 'bg-sky-50/95 text-sky-800 border-sky-300 animate-pulse'
              : scanStage === 'VERIFIED'
              ? 'bg-emerald-50/95 text-emerald-800 border-emerald-300'
              : 'bg-white/90 text-slate-700 border-slate-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              scanStage === 'SCANNING' || scanStage === 'ANALYZING'
                ? 'bg-sky-500'
                : scanStage === 'VERIFIED'
                ? 'bg-emerald-500'
                : 'bg-slate-400'
            }`} />
            <span>STATUS: {scanStage}</span>
          </div>
        </div>
      </div>

      {/* Live Synchronized Declarations HUD Overlay */}
      <div className="relative z-20 p-5 sm:p-7 max-w-xs space-y-2 pointer-events-none mt-auto">
        
        {/* Product Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-xl p-3 border border-slate-200 shadow-sm space-y-1">
          <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
            Target Commodity Specimen
          </div>
          <div className="text-xs font-bold text-slate-900">
            Premium Roasted Almonds (500g)
          </div>
        </div>

        {/* Declaration Validation Cards */}
        <div className="space-y-1.5 font-mono text-xs">
          
          {/* MRP */}
          <div className={`flex items-center justify-between p-2.5 rounded-lg border backdrop-blur-xs transition-all duration-300 ${
            revealedDeclarations.mrp
              ? 'bg-white/95 border-slate-200/90 shadow-2xs translate-x-0 opacity-100'
              : 'bg-white/40 border-slate-200/40 -translate-x-2 opacity-30'
          }`}>
            <div className="flex items-center gap-2">
              <IndianRupee className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-bold text-slate-800 text-[11px]">MRP ₹ 249.00</span>
            </div>
            {revealedDeclarations.mrp && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                <Check className="w-3 h-3 stroke-[2.5]" /> VERIFIED
              </span>
            )}
          </div>

          {/* NET QTY */}
          <div className={`flex items-center justify-between p-2.5 rounded-lg border backdrop-blur-xs transition-all duration-300 ${
            revealedDeclarations.net_qty
              ? 'bg-white/95 border-slate-200/90 shadow-2xs translate-x-0 opacity-100'
              : 'bg-white/40 border-slate-200/40 -translate-x-2 opacity-30'
          }`}>
            <div className="flex items-center gap-2">
              <Scale className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-bold text-slate-800 text-[11px]">NET QTY: 500 g</span>
            </div>
            {revealedDeclarations.net_qty && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                <Check className="w-3 h-3 stroke-[2.5]" /> VERIFIED
              </span>
            )}
          </div>

          {/* DATES */}
          <div className={`flex items-center justify-between p-2.5 rounded-lg border backdrop-blur-xs transition-all duration-300 ${
            revealedDeclarations.dates
              ? 'bg-white/95 border-slate-200/90 shadow-2xs translate-x-0 opacity-100'
              : 'bg-white/40 border-slate-200/40 -translate-x-2 opacity-30'
          }`}>
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-bold text-slate-800 text-[11px]">MFG: 04/2026</span>
            </div>
            {revealedDeclarations.dates && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                <Check className="w-3 h-3 stroke-[2.5]" /> VERIFIED
              </span>
            )}
          </div>

          {/* CONSUMER CARE */}
          <div className={`flex items-center justify-between p-2.5 rounded-lg border backdrop-blur-xs transition-all duration-300 ${
            revealedDeclarations.consumer_care
              ? 'bg-amber-50/95 border-amber-200 shadow-2xs translate-x-0 opacity-100'
              : 'bg-white/40 border-slate-200/40 -translate-x-2 opacity-30'
          }`}>
            <div className="flex items-center gap-2">
              <PhoneCall className="w-3.5 h-3.5 text-amber-700" />
              <span className="font-bold text-amber-900 text-[11px]">CONSUMER CARE</span>
            </div>
            {revealedDeclarations.consumer_care && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                <AlertTriangle className="w-3 h-3 stroke-[2.5] text-amber-600" /> REVIEW
              </span>
            )}
          </div>
        </div>

        {/* Final Audit Summary Badge */}
        {scanStage === 'VERIFIED' && (
          <div className="bg-slate-900 text-white rounded-xl p-3 shadow-lg border border-slate-800 flex items-center justify-between animate-fade-in-up">
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>COMPLIANCE AUDIT</span>
            </div>
            <div className="font-mono text-[11px] font-bold text-emerald-400">
              3 VERIFIED · 1 REVIEW
            </div>
          </div>
        )}
      </div>

      {/* Bottom Scene Footer: Legal Metrology Attribution */}
      <div className="relative z-20 px-5 sm:px-7 pb-4 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-mono text-slate-500 pointer-events-none">
        <span>Legal Metrology (Packaged Commodities) Rules, 2011</span>
        <span className="text-slate-400 hidden sm:inline-block">Govt. of India Standard</span>
      </div>
    </div>
  );
}
