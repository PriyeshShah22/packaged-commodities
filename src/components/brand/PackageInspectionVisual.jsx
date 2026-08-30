import React from 'react';
import { 
  Check, 
  AlertTriangle, 
  Scale, 
  Calendar, 
  IndianRupee, 
  PhoneCall, 
  QrCode,
  Box
} from 'lucide-react';
import ScannerBeam from './ScannerBeam';

/**
 * PackageInspectionVisual
 * 
 * High-fidelity Packaged Commodity Inspection Specimen.
 * Renders a physical consumer package with its regulatory Legal Metrology
 * label, OCR declaration bounding boxes, and compliance audit badges.
 */
export default function PackageInspectionVisual({
  scanProgress = 100,
  isScanning = false,
  className = '',
}) {
  const declarations = [
    {
      id: 'mrp',
      title: 'MAXIMUM RETAIL PRICE (MRP)',
      extractedText: '₹ 249.00 (Incl. of all taxes)',
      status: 'pass',
      rule: 'Rule 6(1)(e)',
      icon: IndianRupee,
      triggerThreshold: 25,
    },
    {
      id: 'net_qty',
      title: 'NET QUANTITY',
      extractedText: '500 g (0.5 kg)',
      status: 'pass',
      rule: 'Rule 6(1)(c)',
      icon: Scale,
      triggerThreshold: 48,
    },
    {
      id: 'dates',
      title: 'MFG & USE BY DATES',
      extractedText: 'MFG: 04/2026 • BEST BEFORE: 12M',
      status: 'pass',
      rule: 'Rule 6(1)(d)',
      icon: Calendar,
      triggerThreshold: 70,
    },
    {
      id: 'consumer_care',
      title: 'CONSUMER CARE / GRIEVANCE',
      extractedText: 'Toll-Free: 1800-11-4000 | support@brand.in',
      status: 'review',
      rule: 'Rule 6(1)(f)',
      icon: PhoneCall,
      warningText: 'Font height 1.8mm (Minimum required: 2.0mm)',
      triggerThreshold: 90,
    },
  ];

  return (
    <div className={`relative w-full bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden transition-all duration-300 ${className}`}>
      
      {/* Laser Scanning Beam Component */}
      <ScannerBeam 
        progress={scanProgress} 
        isActive={isScanning} 
        orientation="horizontal" 
      />

      {/* Package Header Banner */}
      <div className="bg-slate-50/90 px-4 py-2.5 border-b border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className="w-3.5 h-3.5 text-sky-700" />
          <span className="text-xs font-bold font-mono text-slate-800 tracking-tight uppercase">
            SPECIMEN COMMODITY • FOOD PACKAGING
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
          LMR 2011 AUDIT
        </span>
      </div>

      {/* Package Label Body */}
      <div className="p-4 sm:p-5 space-y-3 bg-white">
        
        {/* Product Brand & Net Declaration */}
        <div className="flex items-start justify-between pb-2.5 border-b border-slate-100">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
              CONSUMER COMMODITY
            </div>
            <div className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Premium Roasted Almonds
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-800 text-[11px] font-mono font-semibold px-2 py-0.5 rounded border border-sky-200">
              4 Declarations
            </span>
          </div>
        </div>

        {/* Declarations List with Bounding Boxes */}
        <div className="space-y-2">
          {declarations.map((item) => {
            const isRevealed = scanProgress >= item.triggerThreshold;
            const isPass = item.status === 'pass';
            const Icon = item.icon;

            return (
              <div
                key={item.id}
                className={`relative rounded-lg border transition-all duration-300 p-2.5 ${
                  !isRevealed
                    ? 'border-slate-100 bg-slate-50/50 opacity-40'
                    : isPass
                    ? 'border-slate-200/90 bg-white shadow-2xs hover:border-sky-300'
                    : 'border-amber-200 bg-amber-50/40 hover:border-amber-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1 rounded ${
                      isPass ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-800'
                    }`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-800 uppercase tracking-tight">
                          {item.title}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400">
                          {item.rule}
                        </span>
                      </div>
                      <div className="text-xs font-mono font-medium text-slate-900 truncate">
                        {item.extractedText}
                      </div>
                    </div>
                  </div>

                  {/* Status Tag */}
                  <div className="flex-shrink-0">
                    {isRevealed ? (
                      isPass ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="w-3 h-3 stroke-[2.5]" />
                          PASS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-50 text-amber-800 border border-amber-200">
                          <AlertTriangle className="w-3 h-3 stroke-[2.5] text-amber-600" />
                          REVIEW
                        </span>
                      )
                    ) : (
                      <span className="inline-block w-12 h-4 rounded bg-slate-100 animate-pulse" />
                    )}
                  </div>
                </div>

                {/* Warning note for Consumer care */}
                {!isPass && isRevealed && (
                  <div className="mt-1.5 pt-1.5 border-t border-amber-200/60 flex items-center justify-between text-[10px] text-amber-800 font-mono">
                    <span>⚠ {item.warningText}</span>
                    <span className="text-amber-700 font-semibold">Section 39 LMA</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Barcode & Summary */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5 text-slate-400" />
            <span>EAN-13: 8901030918234</span>
          </div>
          <div className="flex items-center gap-1 text-emerald-700 font-medium text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>3/4 COMPLIANT</span>
          </div>
        </div>
      </div>
    </div>
  );
}
