import React, { useEffect, useState } from 'react';
import { Camera, Check, FileCheck, FileSearch, ShieldCheck } from 'lucide-react';

export default function InspectionPipeline() {
  const [activeStep, setActiveStep] = useState(0);

  // 5-second automatic inspection workflow demonstration cycle (1.25s per node)
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 1250);
    return () => clearInterval(timer);
  }, []);

  const steps = [
    {
      id: 0,
      number: '1',
      title: 'CAPTURE',
      desc: 'Package Intake',
      icon: Camera,
    },
    {
      id: 1,
      number: '2',
      title: 'EXTRACT',
      desc: 'OCR Declarations',
      icon: FileSearch,
    },
    {
      id: 2,
      number: '3',
      title: 'VERIFY',
      desc: 'Legal Metrology Rules',
      icon: ShieldCheck,
    },
    {
      id: 3,
      number: '4',
      title: 'COMPLIANCE',
      desc: 'Statutory Report',
      icon: FileCheck,
    },
  ];

  return (
    <div className="animate-entrance-pipeline mb-7 rounded-3xl bg-white border border-[#E8E2D5] p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(30,25,15,0.04)] relative overflow-hidden">
      {/* Subtle Background Dot Grid Texture matching Login */}
      <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />

      {/* Technical Corner Alignment Crosshairs */}
      <div className="absolute top-2 left-2 text-[10px] font-mono text-[#8C8275]/40 select-none pointer-events-none">+</div>
      <div className="absolute top-2 right-2 text-[10px] font-mono text-[#8C8275]/40 select-none pointer-events-none">+</div>
      <div className="absolute bottom-2 left-2 text-[10px] font-mono text-[#8C8275]/40 select-none pointer-events-none">+</div>
      <div className="absolute bottom-2 right-2 text-[10px] font-mono text-[#8C8275]/40 select-none pointer-events-none">+</div>

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-5 border-b border-[#E8E2D5] relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-[#0284C7] animate-pulse" />
          <h2 className="text-xs sm:text-sm font-bold tracking-[0.14em] uppercase text-slate-800">
            Inspection Intelligence Pipeline
          </h2>
          <span className="text-[#8C8275] hidden sm:inline">•</span>
          <span className="text-xs text-[#8C8275] font-medium hidden sm:inline">
            Statutory Evidence Verification Chain
          </span>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] font-mono text-[#8C8275] bg-[#F4EFE6] border border-[#E8E2D5] px-2.5 py-0.5 rounded-md">
            SCAN → VERIFY → COMPLY
          </span>
          <span className="text-[10px] font-mono text-slate-400 hidden md:inline">
            [LM-2011 // PIPELINE]
          </span>
        </div>
      </div>

      {/* Interactive 4-Node Pipeline Workflow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 relative z-10">
        {steps.map((step, idx) => {
          const isActive = activeStep === step.id;
          const isPassed = activeStep > step.id;
          const isCompliance = step.id === 3;
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={`group/node relative p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer ${
                isActive
                  ? isCompliance
                    ? 'bg-emerald-50/80 border-emerald-300 shadow-xs ring-2 ring-emerald-400/20'
                    : 'bg-sky-50/80 border-sky-300 shadow-xs ring-2 ring-sky-400/20'
                  : 'bg-[#FAF8F5] border-[#E8E2D5] hover:bg-[#F4EFE6] hover:border-[#D6CEBE]'
              }`}
            >
              {/* Connector Arrow for Desktop */}
              {idx < 3 && (
                <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
                  <span
                    className={`text-xs font-bold transition-colors duration-300 ${
                      isPassed || isActive ? 'text-[#0284C7]' : 'text-[#8C8275]/40'
                    }`}
                  >
                    →
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3">
                {/* Node Status Badge */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-all duration-300 ${
                    isActive
                      ? isCompliance
                        ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)] scale-105'
                        : 'bg-[#0284C7] text-white shadow-[0_0_12px_rgba(2,132,199,0.4)] scale-105'
                      : isPassed
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-white border border-[#E8E2D5] text-slate-500'
                  }`}
                >
                  {isCompliance && (isActive || isPassed) ? (
                    <Check className="w-4 h-4 stroke-[3]" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>

                {/* Node Title & Description */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        isActive
                          ? isCompliance
                            ? 'text-emerald-700'
                            : 'text-[#0284C7]'
                          : 'text-[#8C8275]'
                      }`}
                    >
                      {step.number}.
                    </span>
                    <span
                      className={`text-xs font-bold tracking-wide transition-colors ${
                        isActive
                          ? 'text-slate-900'
                          : 'text-slate-800 group-hover/node:text-slate-950'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8C8275] truncate mt-0.5">
                    {step.desc}
                  </p>
                </div>
              </div>

              {/* Active Traveling Signal Line (Bottom Indicator) */}
              <div className="mt-2.5 h-1 rounded-full bg-[#E8E2D5]/70 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isActive
                      ? isCompliance
                        ? 'bg-emerald-500 w-full'
                        : 'bg-[#0284C7] w-full'
                      : isPassed
                      ? 'bg-sky-300 w-full'
                      : 'w-0'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


