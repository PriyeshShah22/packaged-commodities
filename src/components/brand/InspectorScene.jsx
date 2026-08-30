import React, { useState, useRef, useEffect, useCallback } from 'react';
import InspectionBoard from './InspectionBoard';
import PackageInspectionVisual from './PackageInspectionVisual';
import { Scan, ShieldCheck, ArrowDown } from 'lucide-react';


/**
 * InspectorScene
 * 
 * Hero Visual for PackMetrix Authentication.
 * Communicates the complete visual story:
 * HUMAN INSPECTOR → OPTICAL SCANNER → PACKAGED COMMODITY → LABEL → COMPLIANCE FINDINGS
 * 
 * Hovering or focusing on the inspector / scanner activates a smooth optical laser
 * sweep that travels down the package label, sequentially revealing declarations
 * and their PASS / REVIEW compliance states.
 */
export default function InspectorScene({ className = '' }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(100); // Defaults to revealed, resets and sweeps on hover
  const [hasScanned, setHasScanned] = useState(true);

  const animFrameRef = useRef(null);
  const startTimeRef = useRef(null);

  const startInspectionScan = useCallback(() => {
    setIsHovered(true);
    setIsScanning(true);
    setScanProgress(0);
    setHasScanned(false);

    startTimeRef.current = performance.now();
    const duration = 1400; // 1.4s smooth inspection sweep

    const animate = (currentTime) => {
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth cubic easing
      const ease = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      setScanProgress(ease * 100);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setIsScanning(false);
        setScanProgress(100);
        setHasScanned(true);
      }
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsScanning(false);
    setScanProgress(100); // Return smoothly to clean steady state
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div
      role="region"
      aria-label="Interactive Packaged Commodity Scanner Visual"
      tabIndex={0}
      onMouseEnter={startInspectionScan}
      onMouseLeave={handleMouseLeave}
      onFocus={startInspectionScan}
      onBlur={handleMouseLeave}
      className={`group relative w-full h-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-2xl select-none ${className}`}
    >
      <InspectionBoard>
        {/* Top Scene Bar: Inspector & Instrument Identity */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-md transition-colors duration-300 ${
              isHovered ? 'bg-sky-600 text-white' : 'bg-slate-900 text-white'
            }`}>
              <Scan className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-mono font-bold tracking-tight text-slate-900 uppercase">
                Field Inspection Officer
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Legal Metrology Directorate
              </div>
            </div>
          </div>

          {/* Interactive Cue Badge */}
          <div className="flex items-center gap-1.5">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium transition-all duration-300 border ${
              isScanning
                ? 'bg-sky-50 text-sky-700 border-sky-300 shadow-xs animate-pulse'
                : 'bg-white text-slate-600 border-slate-200 group-hover:border-sky-300 group-hover:text-sky-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isScanning ? 'bg-sky-500 animate-ping' : 'bg-sky-600'}`} />
              <span>{isScanning ? 'Scanning Label...' : 'Hover to Scan'}</span>
            </div>
          </div>
        </div>

        {/* Center Canvas: Inspector Illustration + Handheld Scanner + Laser + Package */}
        <div className="relative my-auto py-4 flex flex-col items-center">
          
          {/* Upper Section: Editorial Vector Inspector with Optical Handheld Scanner */}
          <div className="relative w-full max-w-md flex items-center justify-between px-4 pb-2">
            
            {/* Inspector Vector Figure */}
            <div className="flex items-center gap-3">
              {/* Modern Vector Avatar representing the Professional Field Inspector */}
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 p-0.5 shadow-md flex items-center justify-center">
                <svg viewBox="0 0 64 64" fill="none" className="w-12 h-12 text-slate-200">
                  {/* Head / Face */}
                  <circle cx="32" cy="22" r="12" fill="#E2E8F0" />
                  {/* Hair / Cap */}
                  <path d="M20 20C20 13.37 25.37 8 32 8C38.63 8 44 13.37 44 20C44 21 43.5 22 42 22C38 22 36 19 32 19C28 19 26 22 22 22C20.5 22 20 21 20 20Z" fill="#1E293B" />
                  {/* Torso / Uniform Jacket */}
                  <path d="M12 56C12 43 20 37 32 37C44 37 52 43 52 56H12Z" fill="#0F172A" />
                  {/* Shirt Collar & Tie/Lanyard */}
                  <path d="M28 37L32 45L36 37H28Z" fill="#38BDF8" />
                  {/* Badge */}
                  <rect x="38" y="44" width="6" height="4" rx="1" fill="#F59E0B" />
                </svg>

                {/* Status Dot */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
              </div>

              <div>
                <div className="text-xs font-bold text-slate-800 tracking-tight">
                  Inspector Clearance
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  ID: LM-84920 • ACTIVE
                </div>
              </div>
            </div>

            {/* Handheld Optical Scanner Unit */}
            <div className="flex items-center gap-2">
              <div className={`relative px-3 py-2 rounded-xl border transition-all duration-300 ${
                isScanning
                  ? 'bg-slate-900 text-white border-sky-400 shadow-md ring-2 ring-sky-400/20'
                  : 'bg-white text-slate-800 border-slate-200 shadow-2xs group-hover:border-sky-300'
              }`}>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    {/* Scanner Aperture Lens */}
                    <div className={`w-3 h-3 rounded-full border-2 transition-colors ${
                      isScanning ? 'bg-sky-400 border-sky-200 shadow-[0_0_8px_rgba(56,189,248,0.9)]' : 'bg-slate-300 border-slate-400'
                    }`} />
                  </div>
                  <div className="text-[10px] font-mono font-semibold uppercase">
                    {isScanning ? 'Beam Active' : 'Optical Unit'}
                  </div>
                </div>

                {/* Laser Emitter Indicator */}
                {isScanning && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-2 bg-sky-500 blur-2xs rounded-full pointer-events-none" />
                )}
              </div>
            </div>
          </div>

          {/* Optical Scanner Laser Cone (Vector Projection Down to Package) */}
          <div className="relative w-full max-w-md h-8 pointer-events-none">
            {isScanning ? (
              <svg viewBox="0 0 400 32" fill="none" className="w-full h-full">
                <defs>
                  <linearGradient id="scannerConeGrad" x1="200" y1="0" x2="200" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#0284C7" stopOpacity="0.35" />
                    <stop offset="1" stopColor="#0284C7" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
                {/* Laser Projection Cone */}
                <polygon points="340,0 20,32 380,32" fill="url(#scannerConeGrad)" />
                {/* Focal Beam Hairlines */}
                <line x1="340" y1="0" x2="200" y2="32" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 3" />
              </svg>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                  <ArrowDown className="w-3 h-3 animate-bounce text-sky-600" />
                  <span>Optical inspection path</span>
                </div>
              </div>
            )}
          </div>

          {/* Lower Section: Packaged Commodity Inspection Specimen */}
          <div className="w-full max-w-lg">
            <PackageInspectionVisual
              scanProgress={scanProgress}
              isScanning={isScanning}
            />
          </div>
        </div>

        {/* Bottom Scene Footer: Compliance Audit Outcome */}
        <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-slate-700">Legal Metrology Compliance Standard</span>
          </div>

          <span className="text-slate-400 hidden sm:inline-block">
            {hasScanned ? 'AUDIT VERIFIED' : 'READY TO SCAN'}
          </span>
        </div>
      </InspectionBoard>
    </div>
  );
}
