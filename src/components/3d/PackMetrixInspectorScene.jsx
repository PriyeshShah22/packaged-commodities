import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { createInspectorHumanoid } from './InspectorModel';
import { createPackageMesh } from './PackageModel';
import { createInspectionBoardMesh } from './InspectionBoard3D';
import { ScannerBeam3D } from './ScannerBeam3D';
import { InspectorAnimationController, ANIMATION_STATES } from './AnimationController';
import InspectionOverlay from './InspectionOverlay';
import InspectorTestControls from './InspectorTestControls';
import { AlertCircle } from 'lucide-react';

/**
 * PackMetrixInspectorScene
 * 
 * Standalone 3D Real Human Inspector WebGL Scene.
 * Integrates:
 * - 3D Articulated Skinned/Bone Human Field Inspector
 * - Handheld Optical Inspection Scanner attached to the right hand socket
 * - 3D Packaged Commodity Specimen on the inspection stage
 * - Real-time dynamic 3D Laser Scanning Beam
 * - Smooth kinematic skeletal animation state machine
 * - Mouse parallax and interactive inspection controls
 */
export default function PackMetrixInspectorScene({
  showControls = true,
  className = '',
}) {
  const mountRef = useRef(null);
  const [webGLSupported] = useState(() => {
    try {
      const canvas = document.createElement('canvas');
      return Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch {
      return false;
    }
  });

  const [currentState, setCurrentState] = useState(ANIMATION_STATES.IDLE);
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSequenceRunning, setIsSequenceRunning] = useState(false);
  const [cameraMode, setCameraMode] = useState('hero'); // 'hero' | 'orbit'
  const animControllerRef = useRef(null);

  const sceneStateRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    inspector: null,
    package: null,
    laserBeam: null,
    mouseParallax: { x: 0, y: 0, targetX: 0, targetY: 0 },
  });

  // Main Three.js Scene Setup & Render Loop
  useEffect(() => {

    if (!webGLSupported || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 580;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xF8F9FA);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 20);
    camera.position.set(0.65, 1.35, 1.85);
    camera.lookAt(0.1, 0.8, 0.15);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    // 4. Studio Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.65);
    scene.add(ambientLight);

    // Key Light (Warm Sun/Studio light casting soft shadows)
    const keyLight = new THREE.DirectionalLight(0xFFFFFF, 1.3);
    keyLight.position.set(2.5, 4.0, 2.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 10;
    keyLight.shadow.camera.left = -2;
    keyLight.shadow.camera.right = 2;
    keyLight.shadow.camera.top = 2;
    keyLight.shadow.camera.bottom = -2;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    // Fill Light (Soft cool blue fill)
    const fillLight = new THREE.DirectionalLight(0xBAE6FD, 0.5);
    fillLight.position.set(-2.5, 2.0, 1.5);
    scene.add(fillLight);

    // Rim Light (Sharp silhouette accent from behind)
    const rimLight = new THREE.DirectionalLight(0x38BDF8, 0.85);
    rimLight.position.set(0.5, 2.5, -2.5);
    scene.add(rimLight);

    // 5. Build 3D Objects
    // A. Inspection Stage / Workbench Floor
    const boardGroup = createInspectionBoardMesh();
    scene.add(boardGroup);

    // B. Packaged Commodity Specimen
    const packageData = createPackageMesh();
    const packagePos = new THREE.Vector3(0.42, 0, 0.35);
    packageData.group.position.copy(packagePos);
    packageData.group.rotation.y = -Math.PI / 8; // Slight pleasing 3/4 angle
    scene.add(packageData.group);

    // C. 3D Articulated Human Field Inspector
    const inspectorData = createInspectorHumanoid();
    inspectorData.root.position.set(-0.32, 0, -0.05);
    inspectorData.root.rotation.y = Math.PI / 10; // Facing slightly towards package
    scene.add(inspectorData.root);

    // D. 3D Laser Scan Beam
    const laserBeam = new ScannerBeam3D();
    scene.add(laserBeam.group);

    // 6. Kinematic Skeletal Animation Controller
    const animController = new InspectorAnimationController(
      inspectorData.bones,
      packagePos
    );
    animControllerRef.current = animController;

    animController.onStateChange = (state) => {
      setCurrentState(state);
      if (state === ANIMATION_STATES.SCAN) {
        setIsScanning(true);
        setIsCompleted(false);
      } else if (state === ANIMATION_STATES.RETURN_TO_IDLE) {
        setIsScanning(false);
        setIsCompleted(true);
      }
    };

    animController.onScanProgress = (progress) => {
      setScanProgress(progress);
    };

    animController.onSequenceComplete = () => {
      setIsSequenceRunning(false);
    };

    // Store references
    sceneStateRef.current = {
      scene,
      camera,
      renderer,
      inspector: inspectorData,
      package: packageData,
      laserBeam,
      packagePos,
      mouseParallax: { x: 0, y: 0, targetX: 0, targetY: 0 },
    };

    // 7. Mouse Parallax Handler
    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      sceneStateRef.current.mouseParallax.targetX = x * 0.12;
      sceneStateRef.current.mouseParallax.targetY = y * 0.08;
    };

    container.addEventListener('mousemove', handleMouseMove);

    // 8. Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight || 580;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    // 9. Animation Frame Loop
    let lastTime = performance.now();
    let animationFrameId;

    const animate = (time) => {
      animationFrameId = requestAnimationFrame(animate);
      const deltaTime = Math.min((time - lastTime) * 0.001, 0.1);
      lastTime = time;

      // Update skeletal kinematic controller
      animController.update(deltaTime);

      // Update Camera Mouse Parallax
      const mp = sceneStateRef.current.mouseParallax;
      mp.x += (mp.targetX - mp.x) * 0.05;
      mp.y += (mp.targetY - mp.y) * 0.05;

      camera.position.x = 0.65 + mp.x;
      camera.position.y = 1.35 + mp.y;
      camera.lookAt(0.1, 0.8, 0.15);

      // Update 3D Laser Beam to connect Handheld Scanner Nozzle with Package Face
      if (inspectorData.scannerEmitterNode) {
        const emitterWorldPos = new THREE.Vector3();
        inspectorData.scannerEmitterNode.getWorldPosition(emitterWorldPos);

        const packageTargetPos = new THREE.Vector3(
          packagePos.x,
          packagePos.y + packageData.dimensions.height / 2,
          packagePos.z
        );

        laserBeam.update(
          emitterWorldPos,
          packageTargetPos,
          animController.scanProgress,
          animController.isLaserActive,
          packageData.dimensions.width,
          packageData.dimensions.height
        );
      }

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [webGLSupported]);

  // Controller Handlers
  const handleTriggerSequence = useCallback(() => {
    if (animControllerRef.current) {
      setIsSequenceRunning(true);
      animControllerRef.current.startSequence();
    }
  }, []);

  const handleSetState = useCallback((state) => {
    if (animControllerRef.current) {
      animControllerRef.current.sequenceRunning = false;
      setIsSequenceRunning(false);
      animControllerRef.current.setState(state);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (animControllerRef.current) {
      animControllerRef.current.resetToIdle();
      setIsSequenceRunning(false);
      setIsCompleted(false);
      setIsScanning(false);
    }
  }, []);

  const handleToggleCameraMode = () => {
    setCameraMode((prev) => (prev === 'hero' ? 'orbit' : 'hero'));
  };

  if (!webGLSupported) {
    return (
      <div className="w-full h-[580px] bg-slate-100 rounded-2xl border border-slate-200 flex flex-col items-center justify-center p-8 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-amber-600" />
        <h3 className="text-base font-bold text-slate-800">WebGL Acceleration Unavailable</h3>
        <p className="text-xs text-slate-500 max-w-sm">
          A WebGL 2.0 compatible graphics context is required to render the 3D real-time human inspector simulation.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative w-full flex flex-col lg:flex-row gap-6 ${className}`}>
      
      {/* 3D WebGL Canvas Container */}
      <div className="relative flex-1 h-[520px] sm:h-[620px] bg-[#F8F9FA] rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden group">
        
        {/* Three.js Canvas Element Mount */}
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Top Floating Badge */}
        <div className="absolute top-4 left-4 z-20 pointer-events-none flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
          </span>
          <span className="text-[11px] font-mono font-bold tracking-tight text-slate-800 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
            3D REAL-TIME SKELETAL RIG • OPENGL/WEBGL
          </span>
        </div>

        {/* Live Synchronized Declarations Overlay */}
        <div className="absolute top-14 right-4 z-20 w-72 pointer-events-none">
          <InspectionOverlay
            scanProgress={scanProgress}
            isScanning={isScanning}
            isCompleted={isCompleted}
          />
        </div>

        {/* Interactive Hover Overlay Hint */}
        <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-mono">
            <span>Mouse moves camera parallax • Click buttons to trigger skeletal gestures</span>
          </div>
        </div>
      </div>

      {/* Development Controls Panel (Only on prototype) */}
      {showControls && (
        <div className="w-full lg:w-80 flex-shrink-0">
          <InspectorTestControls
            currentState={currentState}
            onTriggerSequence={handleTriggerSequence}
            onSetState={handleSetState}
            onReset={handleReset}
            isSequenceRunning={isSequenceRunning}
            cameraMode={cameraMode}
            onToggleCameraMode={handleToggleCameraMode}
          />
        </div>
      )}
    </div>
  );
}
