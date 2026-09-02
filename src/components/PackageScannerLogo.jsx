import React from 'react';
import { Check, Package } from 'lucide-react';

export default function PackageScannerLogo({ size = 'default', className = '' }) {
  const isLg = size === 'lg';

  return (
    <div
      className={`relative rounded-xl bg-slate-900 border border-sky-500/40 flex items-center justify-center text-sky-400 overflow-hidden shadow-inner group-hover:border-sky-400 group-hover:scale-[1.05] transition-all duration-300 shrink-0 select-none ${
        isLg ? 'w-16 h-16 rounded-2xl' : 'w-11 h-11'
      } ${className}`}
    >
      {/* Soft Blue Ambient Radial Glow Behind Icon */}
      <div className="absolute inset-0 bg-sky-500/15 rounded-xl group-hover:bg-sky-500/25 transition-colors pointer-events-none" />

      {/* Package Graphic Icon */}
      <Package
        className={`${
          isLg ? 'w-8 h-8' : 'w-5 h-5'
        } text-sky-400 relative z-10 transition-transform duration-300`}
      />

      {/* Laser Scanning Cone Sheen (Trailing behind the laser) */}
      <div
        className="pointer-events-none absolute inset-x-0 h-4 bg-gradient-to-b from-sky-400/20 to-transparent z-15 animate-package-laser"
        style={{ filter: 'blur(1px)' }}
      />

      {/* Signature Vertical Scanning Laser Beam (TOP -> BOTTOM in 2.5s Cycle) */}
      <div className="pointer-events-none absolute inset-x-0 h-[2.5px] bg-gradient-to-r from-cyan-400 via-sky-200 to-cyan-400 shadow-[0_0_10px_#00f0ff,0_0_4px_#38bdf8] z-20 animate-package-laser" />

      {/* Verification Checkmark Badge Flash when laser hits bottom */}
      <div
        className={`pointer-events-none absolute ${
          isLg ? 'bottom-2 right-2 w-5 h-5' : 'bottom-1 right-1 w-3.5 h-3.5'
        } rounded-full bg-emerald-500 text-white flex items-center justify-center z-30 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-package-verify`}
      >
        <Check className={`${isLg ? 'w-3 h-3' : 'w-2 h-2'} text-white stroke-[3.5]`} />
      </div>

      {/* Technical Corner Alignment Marks */}
      <div className="absolute top-1 left-1 w-1 h-1 border-t border-l border-sky-400/40 pointer-events-none" />
      <div className="absolute top-1 right-1 w-1 h-1 border-t border-r border-sky-400/40 pointer-events-none" />
      <div className="absolute bottom-1 left-1 w-1 h-1 border-b border-l border-sky-400/40 pointer-events-none" />
      <div className="absolute bottom-1 right-1 w-1 h-1 border-b border-r border-sky-400/40 pointer-events-none" />
    </div>
  );
}
