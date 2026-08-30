import React from 'react';
import { 
  IndianRupee, 
  Scale, 
  Calendar, 
  PhoneCall, 
  QrCode, 
  Check, 
  AlertTriangle,
  PackageCheck
} from 'lucide-react';

/**
 * PackageProductCard
 * 
 * High-fidelity 2D Packaged Commodity Specimen ("PREMIUM ROASTED ALMONDS").
 * Features clear Legal Metrology declaration bounding boxes that flash and
 * illuminate as the optical scanner beam sweeps across.
 */
export default function PackageProductCard({
  activeDeclaration = null, // 'mrp' | 'net_qty' | 'dates' | 'consumer_care' | null
  revealedDeclarations = { mrp: false, net_qty: false, dates: false, consumer_care: false },
  isBeamSweeping = false,
  className = '',
}) {
  return (
    <div className={`relative w-full max-w-[340px] sm:max-w-[360px] bg-white rounded-2xl border border-slate-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden transition-all duration-300 ${
      isBeamSweeping ? 'ring-2 ring-sky-400/40 shadow-lg' : ''
    } ${className}`}>
      
      {/* Top Commodity Header */}
      <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PackageCheck className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider">
            COMMODITY SPECIMEN
          </span>
        </div>
        <span className="text-[10px] font-mono text-sky-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
          LMR 2011
        </span>
      </div>

      {/* Package Body */}
      <div className="p-4 sm:p-5 space-y-3.5 bg-gradient-to-b from-[#FAF9F6] to-white">
        
        {/* Brand & Product Name */}
        <div className="flex items-start justify-between pb-2.5 border-b border-slate-200">
          <div>
            <div className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">
              CONSUMER PACKAGED FOOD
            </div>
            <div className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Premium Roasted Almonds
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              100% California Origin • Grade A
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-800 font-mono text-[11px] font-bold px-2 py-0.5 rounded border border-sky-200 shadow-2xs">
              500 g
            </span>
          </div>
        </div>

        {/* Declaration Bounding Boxes */}
        <div className="space-y-2 font-mono text-xs">
          
          {/* Declaration 1: MRP */}
          <div className={`p-2.5 rounded-xl border transition-all duration-300 ${
            activeDeclaration === 'mrp'
              ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-400/40 shadow-xs scale-[1.02]'
              : revealedDeclarations.mrp
              ? 'bg-white border-slate-200 shadow-2xs'
              : 'bg-slate-50/60 border-slate-200/60 text-slate-400'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IndianRupee className={`w-3.5 h-3.5 ${
                  activeDeclaration === 'mrp' ? 'text-sky-600' : 'text-slate-500'
                }`} />
                <span className="font-bold text-slate-900 text-xs">
                  MRP ₹ 249.00 <span className="text-[10px] font-normal text-slate-500">(Incl. of taxes)</span>
                </span>
              </div>

              {revealedDeclarations.mrp && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 animate-fade-in-up">
                  <Check className="w-3 h-3 stroke-[2.5]" /> PASS
                </span>
              )}
            </div>
          </div>

          {/* Declaration 2: Net Quantity */}
          <div className={`p-2.5 rounded-xl border transition-all duration-300 ${
            activeDeclaration === 'net_qty'
              ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-400/40 shadow-xs scale-[1.02]'
              : revealedDeclarations.net_qty
              ? 'bg-white border-slate-200 shadow-2xs'
              : 'bg-slate-50/60 border-slate-200/60 text-slate-400'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className={`w-3.5 h-3.5 ${
                  activeDeclaration === 'net_qty' ? 'text-sky-600' : 'text-slate-500'
                }`} />
                <span className="font-bold text-slate-900 text-xs">
                  NET QUANTITY: 500 g
                </span>
              </div>

              {revealedDeclarations.net_qty && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 animate-fade-in-up">
                  <Check className="w-3 h-3 stroke-[2.5]" /> PASS
                </span>
              )}
            </div>
          </div>

          {/* Declaration 3: Dates */}
          <div className={`p-2.5 rounded-xl border transition-all duration-300 ${
            activeDeclaration === 'dates'
              ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-400/40 shadow-xs scale-[1.02]'
              : revealedDeclarations.dates
              ? 'bg-white border-slate-200 shadow-2xs'
              : 'bg-slate-50/60 border-slate-200/60 text-slate-400'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className={`w-3.5 h-3.5 ${
                  activeDeclaration === 'dates' ? 'text-sky-600' : 'text-slate-500'
                }`} />
                <span className="font-bold text-slate-900 text-xs">
                  MFG: 04/2026 • EXP: 04/2027
                </span>
              </div>

              {revealedDeclarations.dates && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 animate-fade-in-up">
                  <Check className="w-3 h-3 stroke-[2.5]" /> PASS
                </span>
              )}
            </div>
          </div>

          {/* Declaration 4: Consumer Care */}
          <div className={`p-2.5 rounded-xl border transition-all duration-300 ${
            activeDeclaration === 'consumer_care'
              ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400/40 shadow-xs scale-[1.02]'
              : revealedDeclarations.consumer_care
              ? 'bg-amber-50/80 border-amber-200'
              : 'bg-slate-50/60 border-slate-200/60 text-slate-400'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PhoneCall className={`w-3.5 h-3.5 ${
                  activeDeclaration === 'consumer_care' ? 'text-amber-700' : 'text-slate-500'
                }`} />
                <span className="font-bold text-slate-900 text-xs">
                  CONSUMER CARE: 1800-11-4000
                </span>
              </div>

              {revealedDeclarations.consumer_care && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 animate-fade-in-up">
                  <AlertTriangle className="w-3 h-3 stroke-[2.5] text-amber-600" /> REVIEW
                </span>
              )}
            </div>

            {revealedDeclarations.consumer_care && (
              <div className="mt-1 pt-1 border-t border-amber-200/60 flex items-center justify-between text-[10px] text-amber-800">
                <span>Font height: 1.8mm &lt; 2.0mm min</span>
                <span className="font-bold text-amber-700">Sec. 39 LMA</span>
              </div>
            )}
          </div>
        </div>

        {/* Barcode Footer */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] font-mono text-slate-500">
          <div className="flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5 text-slate-400" />
            <span>EAN-13: 8901030918234</span>
          </div>
          <span className="text-slate-400">LEGAL METROLOGY ACT</span>
        </div>
      </div>
    </div>
  );
}
