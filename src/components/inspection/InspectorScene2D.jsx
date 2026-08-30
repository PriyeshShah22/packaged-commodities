import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  AlertTriangle, 
  ShieldCheck, 
  IndianRupee, 
  Scale, 
  Calendar, 
  PhoneCall 
} from 'lucide-react';


/**
 * InspectorScene2D
 * 
 * Full-Bleed Warm Inspection Workspace Environment.
 * 
 * Design Features:
 * - Direct full-bleed layout (NO rounded image container, NO card border)
 * - Large, crisp inspector artwork filling 85-95% of the visual space
 * - Precision SVG optical scan laser beam from scanner nozzle to packaged commodity
 * - Real-time declaration bounding box highlights
 * - Clean HUD callouts directly over the inspection desk
 * - Automated 7.5s Legal Metrology screening loop
 * - Subtle multi-depth mouse parallax
 */
export default function InspectorScene2D({ className = '' }) {
  const containerRef = useRef(null);

  // Animation States
  const [phase, setPhase] = useState('READY'); // 'READY' | 'SCANNING' | 'ANALYZING' | 'VERIFIED'
  const [laserProgress, setLaserProgress] = useState(0); // 0 to 1
  const [isLaserActive, setIsLaserActive] = useState(false);
  const [activeDeclaration, setActiveDeclaration] = useState(null);
  const [revealedDeclarations, setRevealedDeclarations] = useState({
    mrp: false,
    net_qty: false,
    dates: false,
    consumer_care: false,
  });

  // Parallax state
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  // Natural 7.5s Automated Inspection Sequence Loop
  useEffect(() => {
    let animFrame;
    let startTime = performance.now();
    const DURATION = 7500; // 7.5s full cycle

    const loop = (now) => {
      const elapsed = (now - startTime) % DURATION;

      if (elapsed < 1200) {
        // Phase 1: Ready / Idle (0.0s - 1.2s)
        setPhase('READY');
        setIsLaserActive(false);
        setLaserProgress(0);
        setActiveDeclaration(null);
        setRevealedDeclarations({ mrp: false, net_qty: false, dates: false, consumer_care: false });
      } else if (elapsed < 2000) {
        // Phase 2: Scanner Activates (1.2s - 2.0s)
        setPhase('SCANNING');
        setIsLaserActive(true);
        setLaserProgress(0.1);
        setActiveDeclaration(null);
      } else if (elapsed < 3200) {
        // Phase 3: Laser sweeps MRP (2.0s - 3.2s)
        setPhase('ANALYZING');
        setIsLaserActive(true);
        const t = (elapsed - 2000) / 1200;
        setLaserProgress(0.1 + t * 0.25);
        setActiveDeclaration('mrp');
        setRevealedDeclarations((prev) => ({ ...prev, mrp: true }));
      } else if (elapsed < 4400) {
        // Phase 4: Laser sweeps Net Quantity (3.2s - 4.4s)
        setPhase('ANALYZING');
        setIsLaserActive(true);
        const t = (elapsed - 3200) / 1200;
        setLaserProgress(0.35 + t * 0.25);
        setActiveDeclaration('net_qty');
        setRevealedDeclarations((prev) => ({ ...prev, net_qty: true }));
      } else if (elapsed < 5600) {
        // Phase 5: Laser sweeps Dates (4.4s - 5.6s)
        setPhase('ANALYZING');
        setIsLaserActive(true);
        const t = (elapsed - 4400) / 1200;
        setLaserProgress(0.6 + t * 0.25);
        setActiveDeclaration('dates');
        setRevealedDeclarations((prev) => ({ ...prev, dates: true }));
      } else if (elapsed < 6600) {
        // Phase 6: Laser sweeps Consumer Care (5.6s - 6.6s)
        setPhase('ANALYZING');
        setIsLaserActive(true);
        const t = (elapsed - 5600) / 1000;
        setLaserProgress(0.85 + t * 0.15);
        setActiveDeclaration('consumer_care');
        setRevealedDeclarations((prev) => ({ ...prev, consumer_care: true }));
      } else {
        // Phase 7: Verified Summary (6.6s - 7.5s)
        setPhase('VERIFIED');
        setIsLaserActive(false);
        setActiveDeclaration(null);
        setRevealedDeclarations({ mrp: true, net_qty: true, dates: true, consumer_care: true });
      }

      animFrame = requestAnimationFrame(loop);
    };

    animFrame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, []);

  // Mouse Parallax Handler
  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 6;
    setParallax({ x, y });
  };

  const handleMouseLeave = () => {
    setParallax({ x: 0, y: 0 });
  };

  // SVG coordinates mapped directly onto the full-bleed inspector artwork
  const laserTargetY = 68.5 + laserProgress * 15.0;
  const laserTargetX = 63.5 + Math.sin(laserProgress * Math.PI * 2) * 1.8;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full h-full flex-1 flex flex-col justify-between select-none overflow-visible ${className}`}
    >
      {/* Background Architectural Dot Matrix */}
      <div 
        aria-hidden="true"
        className="absolute inset-0 bg-dot-grid opacity-30 pointer-events-none transition-transform duration-300"
        style={{ transform: `translate(${parallax.x * 0.2}px, ${parallax.y * 0.2}px)` }}
      />

      {/* Top Floating Status HUD */}
      <div className="relative z-20 px-6 sm:px-8 lg:px-10 py-2 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 text-xs font-mono text-[#8C8275]">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-pulse" />
          <span className="font-bold text-slate-800">FIELD INSPECTION WORKSPACE</span>
        </div>

        {/* Dynamic Status Indicator */}
        <div className="flex items-center gap-2">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold border backdrop-blur-xs shadow-2xs transition-all duration-300 ${
            phase === 'SCANNING' || phase === 'ANALYZING'
              ? 'bg-sky-50 text-sky-800 border-sky-300 animate-pulse'
              : phase === 'VERIFIED'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-white text-slate-700 border-[#E8E2D5]'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              phase === 'SCANNING' || phase === 'ANALYZING'
                ? 'bg-sky-500 animate-ping'
                : phase === 'VERIFIED'
                ? 'bg-emerald-500'
                : 'bg-[#8C8275]'
            }`} />
            <span>● {phase}</span>
          </div>
        </div>
      </div>

      {/* Main Full-Bleed Inspection Environment (Hero Artwork fills the space naturally) */}
      <div className="relative z-10 w-full flex-1 flex items-center justify-center p-2 sm:p-4 my-auto overflow-visible">
        
        {/* Full-bleed responsive image wrapper without card borders or shadows */}
        <div 
          className="relative w-full h-full max-w-2xl max-h-[640px] aspect-square flex items-center justify-center transition-transform duration-300"
          style={{ transform: `translate(${parallax.x * 0.4}px, ${parallax.y * 0.4}px)` }}
        >
          {/* Full-Bleed Artwork Image blending seamlessly into warm ivory canvas */}
          <img
            src="/inspector.jpg"
            alt="PackMetrix Field Inspection Officer examining packaged commodity"
            className="w-full h-full object-contain block select-none pointer-events-none [mask-image:radial-gradient(ellipse_at_50%_52%,black_75%,transparent_100%)]"
            draggable={false}
          />

          {/* SVG Optical Laser Projection Overlay Layer */}
          <svg 
            viewBox="0 0 100 100" 
            className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
          >
            <defs>
              {/* Laser Projection Fan Gradient */}
              <linearGradient id="laserFanGradient" x1="50.5" y1="57.5" x2={laserTargetX} y2={laserTargetY} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0284C7" stopOpacity="0.85" />
                <stop offset="60%" stopColor="#38BDF8" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#0284C7" stopOpacity="0.1" />
              </linearGradient>

              {/* Laser Line Core Gradient */}
              <linearGradient id="laserCoreGradient" x1="50.5" y1="57.5" x2={laserTargetX} y2={laserTargetY} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                <stop offset="40%" stopColor="#38BDF8" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#0284C7" stopOpacity="1" />
              </linearGradient>

              {/* Hotspot Radial Glow */}
              <radialGradient id="hotspotGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                <stop offset="40%" stopColor="#38BDF8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#0284C7" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Active Optical Scan Laser */}
            {isLaserActive && (
              <>
                {/* 1. Luminous Laser Fan Cone */}
                <polygon
                  points={`50.5,57.5 ${laserTargetX - 4.5},${laserTargetY - 1.5} ${laserTargetX + 4.5},${laserTargetY + 1.5}`}
                  fill="url(#laserFanGradient)"
                  className="animate-pulse"
                />

                {/* 2. Focused Laser Beam Line */}
                <line
                  x1="50.5"
                  y1="57.5"
                  x2={laserTargetX}
                  y2={laserTargetY}
                  stroke="url(#laserCoreGradient)"
                  strokeWidth="0.8"
                  strokeLinecap="round"
                />

                {/* 3. Sweeping Cross-Line over Package Label */}
                <line
                  x1={laserTargetX - 6.5}
                  y1={laserTargetY}
                  x2={laserTargetX + 6.5}
                  y2={laserTargetY}
                  stroke="#38BDF8"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  className="shadow-sm"
                />

                {/* 4. Scanner Emitter Tip Hotspot */}
                <circle cx="50.5" cy="57.5" r="1.6" fill="#38BDF8" className="animate-ping" />
                <circle cx="50.5" cy="57.5" r="1.0" fill="#FFFFFF" />

                {/* 5. Package Label Impact Hotspot */}
                <circle cx={laserTargetX} cy={laserTargetY} r="3.2" fill="url(#hotspotGlow)" />
                <circle cx={laserTargetX} cy={laserTargetY} r="1.2" fill="#FFFFFF" />
              </>
            )}

            {/* Package Label Bounding Box Overlay Highlights */}
            {activeDeclaration === 'mrp' && (
              <rect x="59.5" y="69.5" width="14" height="3.2" rx="0.6" fill="#0284C7" fillOpacity="0.2" stroke="#0284C7" strokeWidth="0.5" strokeDasharray="1 0.8" />
            )}
            {activeDeclaration === 'net_qty' && (
              <rect x="59.5" y="73.0" width="14" height="3.2" rx="0.6" fill="#0284C7" fillOpacity="0.2" stroke="#0284C7" strokeWidth="0.5" strokeDasharray="1 0.8" />
            )}
            {activeDeclaration === 'dates' && (
              <rect x="59.5" y="76.5" width="14" height="3.2" rx="0.6" fill="#0284C7" fillOpacity="0.2" stroke="#0284C7" strokeWidth="0.5" strokeDasharray="1 0.8" />
            )}
            {activeDeclaration === 'consumer_care' && (
              <rect x="59.5" y="80.0" width="14" height="3.5" rx="0.6" fill="#D97706" fillOpacity="0.25" stroke="#D97706" strokeWidth="0.6" />
            )}
          </svg>

          {/* Floating Declaration HUD Callout Badges over the Desk Area */}
          <div className="absolute right-2 sm:right-6 top-8 sm:top-12 max-w-[210px] space-y-1.5 font-mono text-[11px] z-30 pointer-events-none">
            
            {/* MRP Callout */}
            <div className={`p-2 rounded-xl border backdrop-blur-md transition-all duration-300 ${
              revealedDeclarations.mrp
                ? 'bg-white/95 border-[#E8E2D5] shadow-sm translate-x-0 opacity-100'
                : 'bg-white/30 border-[#E8E2D5]/30 translate-x-2 opacity-0'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <IndianRupee className="w-3 h-3 text-slate-600" />
                  <span className="font-bold text-slate-900">MRP ₹ 249.00</span>
                </div>
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                  <Check className="w-2.5 h-2.5 stroke-[2.5]" /> PASS
                </span>
              </div>
            </div>

            {/* Net Quantity Callout */}
            <div className={`p-2 rounded-xl border backdrop-blur-md transition-all duration-300 ${
              revealedDeclarations.net_qty
                ? 'bg-white/95 border-[#E8E2D5] shadow-sm translate-x-0 opacity-100'
                : 'bg-white/30 border-[#E8E2D5]/30 translate-x-2 opacity-0'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Scale className="w-3 h-3 text-slate-600" />
                  <span className="font-bold text-slate-900">NET QTY: 1 kg</span>
                </div>
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                  <Check className="w-2.5 h-2.5 stroke-[2.5]" /> PASS
                </span>
              </div>
            </div>

            {/* Dates Callout */}
            <div className={`p-2 rounded-xl border backdrop-blur-md transition-all duration-300 ${
              revealedDeclarations.dates
                ? 'bg-white/95 border-[#E8E2D5] shadow-sm translate-x-0 opacity-100'
                : 'bg-white/30 border-[#E8E2D5]/30 translate-x-2 opacity-0'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-slate-600" />
                  <span className="font-bold text-slate-900">MFG: 04/2026</span>
                </div>
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                  <Check className="w-2.5 h-2.5 stroke-[2.5]" /> PASS
                </span>
              </div>
            </div>

            {/* Consumer Care Callout */}
            <div className={`p-2 rounded-xl border backdrop-blur-md transition-all duration-300 ${
              revealedDeclarations.consumer_care
                ? 'bg-amber-50/95 border-amber-300 shadow-sm translate-x-0 opacity-100'
                : 'bg-white/30 border-[#E8E2D5]/30 translate-x-2 opacity-0'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <PhoneCall className="w-3 h-3 text-amber-700" />
                  <span className="font-bold text-amber-900">CONSUMER CARE</span>
                </div>
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-800 bg-amber-100 px-1 py-0.2 rounded border border-amber-300">
                  <AlertTriangle className="w-2.5 h-2.5 stroke-[2.5] text-amber-600" /> REVIEW
                </span>
              </div>
              <div className="text-[9px] text-amber-800 pt-1 mt-1 border-t border-amber-200/60">
                Font: 1.8mm &lt; 2.0mm min
              </div>
            </div>
          </div>

          {/* Officer ID Overlay Tag */}
          <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md rounded-xl px-3 py-1.5 text-white flex items-center gap-2 text-xs font-mono border border-slate-800 shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold">INSPECTOR ENFORCEMENT</span>
            <span className="text-[10px] text-slate-400">#LM-8492</span>
          </div>
        </div>
      </div>

      {/* Bottom Live Result Panel & Summary (Sits naturally at base of left workspace) */}
      <div className="relative z-20 px-6 sm:px-8 lg:px-10 py-4 border-t border-[#E8E2D5] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-[#8C8275] pointer-events-none bg-[#FAF8F5]/90 backdrop-blur-xs">
        
        {/* Progressive Declaration Summary Indicators */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-700">DECLARATIONS:</span>
          
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
            revealedDeclarations.mrp ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-[#F4EFE6] text-[#8C8275] border-[#E8E2D5]'
          }`}>
            MRP {revealedDeclarations.mrp ? '✓' : '...'}
          </span>

          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
            revealedDeclarations.net_qty ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-[#F4EFE6] text-[#8C8275] border-[#E8E2D5]'
          }`}>
            QTY {revealedDeclarations.net_qty ? '✓' : '...'}
          </span>

          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
            revealedDeclarations.dates ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-[#F4EFE6] text-[#8C8275] border-[#E8E2D5]'
          }`}>
            DATE {revealedDeclarations.dates ? '✓' : '...'}
          </span>

          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
            revealedDeclarations.consumer_care ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-[#F4EFE6] text-[#8C8275] border-[#E8E2D5]'
          }`}>
            CARE {revealedDeclarations.consumer_care ? '⚠' : '...'}
          </span>
        </div>

        {/* Final Audit Summary Badge */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded-xl font-bold transition-all duration-300 ${
          phase === 'VERIFIED'
            ? 'bg-slate-900 text-white shadow-sm'
            : 'bg-[#F4EFE6] text-slate-700 border border-[#E8E2D5]'
        }`}>
          <ShieldCheck className={`w-3.5 h-3.5 ${phase === 'VERIFIED' ? 'text-emerald-400' : 'text-[#8C8275]'}`} />
          <span>{phase === 'VERIFIED' ? '3 VERIFIED · 1 REVIEW' : 'AUDITING SPECIMEN'}</span>
        </div>
      </div>
    </div>
  );
}
