import React from 'react';
import { Play, RotateCcw, Eye, Scan, ArrowUpRight, Activity } from 'lucide-react';
import { ANIMATION_STATES } from './AnimationController';

/**
 * InspectorTestControls
 * 
 * Development control panel for manual and sequence testing of the 3D Inspector.
 */
export default function InspectorTestControls({
  currentState,
  onTriggerSequence,
  onSetState,
  onReset,
  isSequenceRunning,
  cameraMode,
  onToggleCameraMode,
  className = '',
}) {

  const states = [
    { key: ANIMATION_STATES.IDLE, label: 'Idle', icon: Activity },
    { key: ANIMATION_STATES.LOOK_AT_PACKAGE, label: 'Look at Package', icon: Eye },
    { key: ANIMATION_STATES.RAISE_SCANNER, label: 'Raise Scanner', icon: ArrowUpRight },
    { key: ANIMATION_STATES.SCAN, label: 'Scan', icon: Scan },
  ];

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4 ${className}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
            3D Inspector Animation Rig
          </h3>
          <p className="text-[11px] text-slate-500 font-mono">
            Kinematic Skeletal Control Panel
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 font-mono text-[11px] font-bold text-slate-700">
          <span className="w-2 h-2 rounded-full bg-sky-600 animate-pulse" />
          <span>STATE: {currentState}</span>
        </div>
      </div>

      {/* Primary Automated Sequence Button */}
      <div>
        <button
          type="button"
          onClick={onTriggerSequence}
          disabled={isSequenceRunning}
          className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-sm font-bold font-mono shadow-sm transition-all disabled:opacity-60 cursor-pointer"
        >
          <Play className={`w-4 h-4 text-sky-400 ${isSequenceRunning ? 'animate-spin' : ''}`} />
          <span>{isSequenceRunning ? 'RUNNING INSPECTION SEQUENCE...' : 'START INSPECTION'}</span>
        </button>
      </div>

      {/* Manual Step-by-Step State Overrides */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-mono font-semibold uppercase text-slate-400">
          Manual Skeletal State Overrides
        </span>
        <div className="grid grid-cols-2 gap-2">
          {states.map(({ key, label, icon: Icon }) => {
            const isActive = currentState === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSetState(key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-medium border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-sky-50 border-sky-300 text-sky-900 font-bold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reset & View Controls */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-mono text-slate-600 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Pose</span>
        </button>

        <button
          type="button"
          onClick={onToggleCameraMode}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors border cursor-pointer ${
            cameraMode === 'orbit'
              ? 'bg-sky-50 border-sky-300 text-sky-800 font-bold'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span>Camera: {cameraMode === 'orbit' ? 'Free Orbit' : 'Fixed Hero'}</span>
        </button>
      </div>

      {/* Optional GLTF/GLB Asset Loader Hook note */}
      <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200/80 text-[10px] font-mono text-slate-500 space-y-1">
        <div className="font-bold text-slate-700 uppercase">3D Human Asset Pipeline</div>
        <p className="text-slate-500 leading-relaxed">
          The scene utilizes a rigged 3D humanoid skeleton with forward kinematics for the inspector arm, head, and scanner nozzle.
        </p>
      </div>
    </div>
  );
}
