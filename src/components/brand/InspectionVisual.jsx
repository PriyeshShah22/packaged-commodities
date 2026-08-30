import React, { useState, useEffect, useCallback } from 'react';
import { 
  Check, 
  AlertTriangle, 
  Scale, 
  Calendar, 
  IndianRupee, 
  PhoneCall, 
  QrCode,
  RotateCw
} from 'lucide-react';

/**
 * InspectionVisual
 * 
 * Scaled-up, high-precision Legal Metrology Package Inspection Composition.
 * 
 * Features:
 * - 40%+ larger visual footprint establishing strong product identity
 * - Realistic packaged commodity label with regulatory declaration zones
 * - Restrained, professional laser scanning line traversing the package
 * - Declarations smoothly highlight and reveal PASS / REVIEW compliance states
 * - Zero fake sci-fi telemetry; 100% focused on Legal Metrology commodity inspection
 */
export default function InspectionVisual() {
  const [scanProgress, setScanProgress] = useState(0); // 0 to 100
  const [isScanning, setIsScanning] = useState(true);

  const triggerScan = useCallback(() => {
    setIsScanning(true);
    setScanProgress(0);

    const startTime = performance.now();
    const duration = 1800; // 1.8s smooth single sweep
    let animationFrameId;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const ease = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      setScanProgress(ease * 100);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setIsScanning(false);
        setScanProgress(100);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      triggerScan();
    }, 100);
    return () => clearTimeout(timer);
  }, [triggerScan]);



  const declarations = [
    {
      id: 'mrp',
      title: 'MAXIMUM RETAIL PRICE (MRP)',
      extractedText: '₹ 249.00 (Incl. of all taxes)',
      status: 'pass',
      rule: 'Rule 6(1)(e)',
      icon: IndianRupee,
      triggerThreshold: 22,
    },
    {
      id: 'net_qty',
      title: 'NET QUANTITY',
      extractedText: '500 g (0.5 kg)',
      status: 'pass',
      rule: 'Rule 6(1)(c)',
      icon: Scale,
      triggerThreshold: 45,
    },
    {
      id: 'dates',
      title: 'MFG & BEST BEFORE DATES',
      extractedText: 'MFG: 04/2026 • BEST BEFORE 12M',
      status: 'pass',
      rule: 'Rule 6(1)(d)',
      icon: Calendar,
      triggerThreshold: 68,
    },
    {
      id: 'consumer_care',
      title: 'CONSUMER CARE / GRIEVANCE',
      extractedText: 'Toll-Free: 1800-11-4000 | care@brand.in',
      status: 'review',
      rule: 'Rule 6(1)(f)',
      icon: PhoneCall,
      warningText: 'Font height 1.8mm (Minimum required: 2.0mm)',
      triggerThreshold: 88,
    },
  ];

  return (
    <div className="relative w-full max-w-xl mx-auto flex flex-col items-center">
      
      {/* Visual Header / Action bar */}
      <div className="w-full flex items-center justify-between pb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-800">
            Package Compliance Audit
          </span>
        </div>

        <button
          type="button"
          onClick={triggerScan}
          disabled={isScanning}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-md px-2.5 py-1 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
        >
          <RotateCw className={`w-3 h-3 text-slate-500 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Scanning...' : 'Re-scan label'}</span>
        </button>
      </div>

      {/* Main Inspection Canvas Card */}
      <div className="relative w-full bg-white rounded-xl border border-slate-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        
        {/* Subtle Inspection Background Grid */}
        <div className="absolute inset-0 bg-inspection-grid opacity-25 pointer-events-none" />

        {/* Precision Crosshair Corner Accents */}
        <div className="absolute top-2.5 left-2.5 w-3 h-3 border-t-2 border-l-2 border-slate-300 pointer-events-none" />
        <div className="absolute top-2.5 right-2.5 w-3 h-3 border-t-2 border-r-2 border-slate-300 pointer-events-none" />
        <div className="absolute bottom-2.5 left-2.5 w-3 h-3 border-b-2 border-l-2 border-slate-300 pointer-events-none" />
        <div className="absolute bottom-2.5 right-2.5 w-3 h-3 border-b-2 border-r-2 border-slate-300 pointer-events-none" />

        {/* Laser Hairline Scan Line traversing vertically across the package */}
        {isScanning && (
          <div
            style={{ top: `${scanProgress}%` }}
            className="absolute inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-sky-500 to-transparent pointer-events-none z-30 transition-all duration-75 shadow-[0_0_10px_rgba(2,132,199,0.8)]"
          >
            <div className="absolute left-1/2 -top-1 w-28 -translate-x-1/2 h-2 bg-sky-400/20 blur-xs rounded-full" />
          </div>
        )}

        {/* Packaged Commodity Label Mockup */}
        <div className="relative p-6 sm:p-7 space-y-4 z-10">
          
          {/* Label Header / Brand Branding */}
          <div className="flex items-start justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="text-[10px] font-mono font-medium uppercase tracking-widest text-slate-400">
                Packaged Commodity Label
              </div>
              <div className="text-base font-bold text-slate-900 tracking-tight">
                Organic Roasted Almonds
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 font-mono text-[10px] font-medium px-2 py-0.5 rounded border border-slate-200">
                Rule 6(1) Declarations
              </span>
            </div>
          </div>

          {/* Declarations Inspection Bounding Boxes */}
          <div className="space-y-2.5">
            {declarations.map((item) => {
              const isRevealed = scanProgress >= item.triggerThreshold;
              const isPass = item.status === 'pass';
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  className={`group relative rounded-lg border transition-all duration-300 p-3 ${
                    !isRevealed
                      ? 'border-slate-200/50 bg-slate-50/40 opacity-40'
                      : isPass
                      ? 'border-slate-200 bg-white hover:border-sky-300 hover:shadow-xs'
                      : 'border-amber-200 bg-amber-50/30 hover:border-amber-300 hover:bg-amber-50/60'
                  }`}
                >

                  <div className="flex items-center justify-between gap-3">
                    {/* Left: Icon & Declaration Title */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-1.5 rounded-md ${
                        isPass ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-800 tracking-tight uppercase">
                            {item.title}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 font-normal">
                            {item.rule}
                          </span>
                        </div>
                        <div className="text-xs font-mono font-medium text-slate-900 mt-0.5 truncate">
                          {item.extractedText}
                        </div>
                      </div>
                    </div>

                    {/* Right: Status Pill Badge */}
                    <div className="flex-shrink-0">
                      {isRevealed ? (
                        isPass ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs animate-fade-in-up">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            PASS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold font-mono bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs animate-fade-in-up">
                            <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5] text-amber-600" />
                            REVIEW
                          </span>
                        )
                      ) : (
                        <span className="inline-block w-14 h-5 rounded bg-slate-100 animate-pulse" />
                      )}
                    </div>
                  </div>

                  {/* Warning Details for Review Item */}
                  {!isPass && isRevealed && (
                    <div className="mt-2 pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-amber-800 font-mono">
                      <span>⚠ {item.warningText}</span>
                      <span className="text-amber-700/75">Mandatory Audit</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Barcode & Package Certification Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <div className="flex items-center gap-2">
              <QrCode className="w-3.5 h-3.5 text-slate-400" />
              <span>EAN-13: 8901030918234</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>3/4 Declarations Verified</span>
            </div>
          </div>
        </div>

        {/* Bottom Workflow Ribbon */}
        <div className="bg-slate-50 px-6 py-2.5 border-t border-slate-200/70 flex items-center justify-between text-xs font-mono text-slate-600">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-400">STAGE:</span>
            <span className="font-semibold text-slate-800">Scan</span>
            <span className="text-slate-300">→</span>
            <span className="font-semibold text-slate-800">Detect</span>
            <span className="text-slate-300">→</span>
            <span className="font-semibold text-sky-700 bg-sky-100/70 px-1.5 py-0.5 rounded">Validate</span>
            <span className="text-slate-300">→</span>
            <span className="text-slate-400">Evidence</span>
            <span className="text-slate-300">→</span>
            <span className="text-slate-400">Report</span>
          </div>

          <span className="text-[11px] text-slate-400 font-mono">
            LM Act (2009)
          </span>
        </div>
      </div>
    </div>
  );
}
