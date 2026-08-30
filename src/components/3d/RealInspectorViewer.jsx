import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CheckCircle2, AlertCircle, Play, Pause, Box, Layers, Film } from 'lucide-react';

/**
 * RealInspectorViewer
 * 
 * Standalone WebGL viewer for the actual rigged PackMetrix Inspector GLB model.
 * Loads `/packmetrix-inspector.glb`, configures soft studio lighting, subtle floor grid,
 * contact shadow, and exposes real-time skeletal & animation metadata.
 */
export default function RealInspectorViewer({ className = '' }) {
  const mountRef = useRef(null);

  // Inspection Metadata State
  const [loadStatus, setLoadStatus] = useState('LOADING'); // 'LOADING' | 'LOADED' | 'ERROR'
  const [errorMessage, setErrorMessage] = useState('');
  const [modelInfo, setModelInfo] = useState({
    dimensions: null,
    hasSkeleton: false,
    boneCount: 0,
    boneNames: [],
    clipCount: 0,
    clipNames: [],
    hasHumanoidRig: false,
    activeClip: 'Idle',
  });

  const [activeClipName, setActiveClipName] = useState('Idle');
  const [isPlaying, setIsPlaying] = useState(true);

  // References for render loop & mixer
  const mixerRef = useRef(null);
  const actionsRef = useRef({});
  const controlsRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 600;

    // 1. Three.js Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xF8F9FA);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(0, 1.3, 3.2);

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
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // 4. Orbit Controls (Subtle, no auto-spin)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't dip below floor
    controls.minDistance = 1.2;
    controls.maxDistance = 6.0;
    controls.target.set(0, 0.95, 0); // Focus at inspector chest height
    controls.autoRotate = false; // Do NOT spin automatically
    controlsRef.current = controls;

    // 5. Professional Soft Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.75);
    scene.add(ambientLight);

    // Key Light (Soft Warm Studio Directional)
    const keyLight = new THREE.DirectionalLight(0xFFFBF5, 1.4);
    keyLight.position.set(2.5, 4.0, 3.0);
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
    const fillLight = new THREE.DirectionalLight(0xBAE6FD, 0.5);
    fillLight.position.set(-3.0, 2.5, 2.0);
    scene.add(fillLight);

    // Rim Light (Clean Silhouette Accent)
    const rimLight = new THREE.DirectionalLight(0x38BDF8, 0.9);
    rimLight.position.set(0, 3.0, -3.0);
    scene.add(rimLight);

    // 6. Inspection Environment Floor / Subtle Technical Grid
    const createFloorGrid = () => {
      const floorGroup = new THREE.Group();

      // Shadow Catcher Plane
      const shadowPlaneGeo = new THREE.PlaneGeometry(6, 6);
      const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.18 });
      const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = 0.001;
      shadowPlane.receiveShadow = true;
      floorGroup.add(shadowPlane);

      // Subtle Grid Floor
      const gridHelper = new THREE.GridHelper(6, 24, 0xCBD5E1, 0xE2E8F0);
      gridHelper.position.y = 0;
      floorGroup.add(gridHelper);

      // Subtle Stage Target Circle
      const circleGeo = new THREE.RingGeometry(0.7, 0.704, 64);
      const circleMat = new THREE.MeshBasicMaterial({ color: 0x0284C7, opacity: 0.4, transparent: true, side: THREE.DoubleSide });
      const circleMesh = new THREE.Mesh(circleGeo, circleMat);
      circleMesh.rotation.x = -Math.PI / 2;
      circleMesh.position.y = 0.002;
      floorGroup.add(circleMesh);

      return floorGroup;
    };
    scene.add(createFloorGrid());

    // 7. Load the GLB from the public folder
    const loader = new GLTFLoader();
    const glbUrl = '/packmetrix-inspector.glb';

    loader.load(
      glbUrl,
      (gltf) => {
        const model = gltf.scene;

        // Compute Bounding Box & Dimensions
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Place model naturally on the floor (Y = 0)
        model.position.x = -center.x;
        model.position.y = -box.min.y; // Align feet with ground plane Y = 0
        model.position.z = -center.z;

        // Preserve Original Materials & Enable Shadows
        const bonesList = [];
        let hasSkinnedMesh = false;

        model.traverse((child) => {
          if (child.isMesh || child.isSkinnedMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // Preserve original material properties
            if (child.material) {
              child.material.side = THREE.DoubleSide;
              if (child.material.map) {
                child.material.map.colorSpace = THREE.SRGBColorSpace;
              }
            }
          }

          if (child.isBone) {
            bonesList.push(child.name || 'unnamed_bone');
          }

          if (child.isSkinnedMesh) {
            hasSkinnedMesh = true;
            if (child.skeleton && child.skeleton.bones) {
              child.skeleton.bones.forEach((b) => {
                if (b.name && !bonesList.includes(b.name)) {
                  bonesList.push(b.name);
                }
              });
            }
          }
        });

        scene.add(model);

        // Animation Mixer Setup
        let clipsList = [];
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          mixerRef.current = mixer;

          gltf.animations.forEach((clip) => {
            clipsList.push(clip.name);
            const action = mixer.clipAction(clip);
            actionsRef.current[clip.name] = action;
          });

          // Play default Idle animation smoothly if present
          const defaultClip = gltf.animations.find((c) => c.name.toLowerCase() === 'idle') || gltf.animations[0];
          if (defaultClip) {
            const action = actionsRef.current[defaultClip.name];
            if (action) {
              action.play();
              setActiveClipName(defaultClip.name);
            }
          }
        }

        const isHumanoid = bonesList.some((b) => /head|neck|spine|hips|shoulder|arm|leg|foot/i.test(b));

        // Update Component State
        setModelInfo({
          dimensions: {
            width: Number(size.x.toFixed(3)),
            height: Number(size.y.toFixed(3)),
            depth: Number(size.z.toFixed(3)),
          },
          hasSkeleton: hasSkinnedMesh || bonesList.length > 0,
          boneCount: bonesList.length,
          boneNames: bonesList,
          clipCount: gltf.animations ? gltf.animations.length : 0,
          clipNames: clipsList,
          hasHumanoidRig: isHumanoid,
          activeClip: gltf.animations && gltf.animations.length > 0 ? 'Idle' : 'None',
        });

        setLoadStatus('LOADED');
      },
      undefined,
      (err) => {
        console.error('Error loading /packmetrix-inspector.glb:', err);
        setLoadStatus('ERROR');
        setErrorMessage(err.message || 'Failed to load GLB file from public folder.');
      }
    );

    // 8. Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight || 600;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    // 9. Animation Frame Loop
    const clock = new THREE.Clock();
    let animationFrameId;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (mixerRef.current && isPlaying) {
        mixerRef.current.update(delta);
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isPlaying]);

  // Animation Clip Switcher
  const switchAnimation = (clipName) => {
    if (!mixerRef.current || !actionsRef.current[clipName]) return;

    // Fade out current action
    if (actionsRef.current[activeClipName]) {
      actionsRef.current[activeClipName].fadeOut(0.3);
    }

    // Fade in new action
    const nextAction = actionsRef.current[clipName];
    nextAction.reset().fadeIn(0.3).play();
    setActiveClipName(clipName);
    setIsPlaying(true);
  };

  const togglePlayback = () => {
    setIsPlaying((prev) => !prev);
  };

  return (
    <div className={`w-full flex flex-col lg:flex-row gap-6 ${className}`}>
      
      {/* 3D WebGL Canvas Container */}
      <div className="relative flex-1 h-[540px] sm:h-[620px] bg-[#F8F9FA] rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Three.js Canvas */}
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Top Overlay Badge */}
        <div className="absolute top-4 left-4 z-20 pointer-events-none flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${loadStatus === 'LOADED' ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${loadStatus === 'LOADED' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </span>
          <span className="text-[11px] font-mono font-bold tracking-tight text-slate-800 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
            {loadStatus === 'LOADED' ? 'REAL GLB INSPECTOR MODEL' : 'LOADING GLB ASSET...'}
          </span>
        </div>

        {/* Bottom Orbit Guide Hint */}
        <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-mono">
            <span>Click and drag to inspect 3D character • Scroll to zoom</span>
          </div>
        </div>
      </div>

      {/* Development Status Panel */}
      <aside className="w-full lg:w-96 flex-shrink-0 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
        
        {/* Status Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
              3D Inspector Status Panel
            </h2>
            <p className="text-[11px] font-mono text-slate-500">
              GLB File Inspection & Rig Diagnostics
            </p>
          </div>

          <div className="px-2.5 py-1 rounded-md bg-slate-100 font-mono text-[11px] font-bold text-slate-700">
            {loadStatus}
          </div>
        </div>

        {/* Live Diagnostics Card */}
        <div className="space-y-3 font-mono text-xs">
          
          {/* File Path */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Source GLB Asset</div>
            <div className="text-slate-800 font-bold text-xs truncate">/packmetrix-inspector.glb</div>
            <div className="text-[10px] text-slate-500">Public Root • 4.80 MB</div>
          </div>

          {/* Model Status */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-slate-600 font-medium">Model Status:</span>
            {loadStatus === 'LOADED' ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> LOADED
              </span>
            ) : loadStatus === 'ERROR' ? (
              <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                <AlertCircle className="w-3.5 h-3.5" /> ERROR
              </span>
            ) : (
              <span className="text-amber-600 font-bold animate-pulse">LOADING...</span>
            )}
          </div>

          {/* Dimensions */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Model Dimensions:</span>
              <Box className="w-3.5 h-3.5 text-slate-400" />
            </div>
            {modelInfo.dimensions ? (
              <div className="text-slate-900 font-bold text-xs">
                W: {modelInfo.dimensions.width}m × H: {modelInfo.dimensions.height}m × D: {modelInfo.dimensions.depth}m
              </div>
            ) : (
              <div className="text-slate-400">Calculating bounding box...</div>
            )}
          </div>

          {/* Rig & Skeleton */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Skeletal Rig:</span>
              <Layers className="w-3.5 h-3.5 text-slate-400" />
            </div>
            {loadStatus === 'LOADED' ? (
              modelInfo.hasSkeleton ? (
                <div className="space-y-1">
                  <div className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Humanoid Skeleton Detected ({modelInfo.boneCount} Bones)
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    Joints: {modelInfo.boneNames.slice(0, 6).join(', ')}...
                  </div>
                </div>
              ) : (
                <div className="text-amber-600 font-bold text-xs">No skeleton detected</div>
              )
            ) : (
              <div className="text-slate-400">Detecting...</div>
            )}
          </div>

          {/* Animation Clips */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Animation Clips ({modelInfo.clipCount}):</span>
              <Film className="w-3.5 h-3.5 text-slate-400" />
            </div>

            {modelInfo.clipCount > 0 ? (
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {modelInfo.clipNames.map((clip) => {
                    const isSelected = activeClipName === clip;
                    return (
                      <button
                        key={clip}
                        type="button"
                        onClick={() => switchAnimation(clip)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {clip}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-500">Active: <span className="font-bold text-slate-800">{activeClipName}</span></span>
                  <button
                    type="button"
                    onClick={togglePlayback}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>
                </div>
              </div>
            ) : loadStatus === 'LOADED' ? (
              <div className="text-slate-500 text-xs">
                Rig detected, animation clips not present.
              </div>
            ) : (
              <div className="text-slate-400">Detecting animations...</div>
            )}
          </div>
        </div>

        {/* Error Notification if any */}
        {loadStatus === 'ERROR' && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-mono space-y-1">
            <div className="font-bold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Error Loading Model
            </div>
            <p className="text-[11px] text-rose-700">{errorMessage}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
