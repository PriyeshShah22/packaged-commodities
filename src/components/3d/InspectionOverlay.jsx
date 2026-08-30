import React from 'react';
import { Check, AlertTriangle, ShieldCheck, IndianRupee, Scale, Calendar, PhoneCall } from 'lucide-react';

/**
 * InspectionOverlay
 * 
 * Synchronized live detection cards and compliance summary overlay for the 3D Inspector scene.
 */
export default function InspectionOverlay({
  scanProgress = 0,
  isScanning = false,
  isCompleted = false,
  className = '',
}) {
  const detections = [
    {
      id: 'mrp',
      label: 'MRP ₹ 249.00',
      rule: 'Rule 6(1)(e)',
      threshold: 0.22,
      status: 'pass',
      icon: IndianRupee,
    },
    {
      id: 'net_qty',
      label: 'NET QUANTITY 500 g',
      rule: 'Rule 6(1)(c)',
      threshold: 0.45,
      status: 'pass',
      icon: Scale,
    },
    {
      id: 'dates',
      label: 'MFG 04/2026',
      rule: 'Rule 6(1)(d)',
      threshold: 0.68,
      status: 'pass',
      icon: Calendar,
    },
    {
      id: 'consumer_care',
      label: 'CONSUMER CARE 1800-11-4000',
      rule: 'Rule 6(1)(f)',
      threshold: 0.88,
      status: 'review',
      warning: 'Font height 1.8mm < 2.0mm',
      icon: PhoneCall,
    },
  ];

  return (
    <div className={`space-y-3 pointer-events-none ${className}`}>
      {/* Live Detections Feed */}
      <div className="space-y-2">
        {detections.map((item) => {
          const isRevealed = (scanProgress >= item.threshold) || isCompleted;
          const isPass = item.status === 'pass';
          const Icon = item.icon;

          if (!isRevealed && !isScanning) return null;

          return (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl border backdrop-blur-xs transition-all duration-300 ${
                !isRevealed
                  ? 'opacity-20 border-slate-200 bg-white/40'
                  : isPass
                  ? 'bg-white/95 border-slate-200/90 shadow-sm animate-fade-in-up'
                  : 'bg-amber-50/95 border-amber-200/90 shadow-sm animate-fade-in-up'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`p-1 rounded-md ${
                  isPass ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-800'
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-mono font-bold text-slate-800 tracking-tight">
                    {item.label}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {item.rule} {item.warning ? `• ${item.warning}` : ''}
                  </div>
                </div>
              </div>

              <div>
                {isRevealed && (
                  isPass ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                      DETECTED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      <AlertTriangle className="w-3 h-3 stroke-[2.5] text-amber-600" />
                      REVIEW
                    </span>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Final Summary Card */}
      {isCompleted && (
        <div className="bg-slate-900 text-white rounded-xl p-3.5 shadow-lg border border-slate-800 flex items-center justify-between animate-fade-in-up">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-bold tracking-tight">
              INSPECTION AUDIT SUMMARY
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs font-bold">
            <span className="text-emerald-400">3 VERIFIED</span>
            <span className="text-slate-500">•</span>
            <span className="text-amber-400">1 REVIEW</span>
          </div>
        </div>
      )}
    </div>
  );
}
