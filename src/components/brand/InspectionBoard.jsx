import React from 'react';

/**
 * InspectionBoard
 * 
 * Clean, technical inspection workspace surface background.
 * Features faint measurement tick marks, corner registration crosses,
 * subtle grid lines, and package alignment guides.
 * 
 * Clean, professional, precise without being a blueprint or hacker screen.
 */
export default function InspectionBoard({ children, className = '' }) {
  return (
    <div className={`relative w-full h-full bg-[#FAFAFA] rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between ${className}`}>
      
      {/* Subtle Micro-Grid */}
      <div 
        aria-hidden="true" 
        className="absolute inset-0 bg-inspection-grid opacity-35 pointer-events-none" 
      />

      {/* Perimeter Measurement Rulers (Faint millimeter ticks) */}
      <div aria-hidden="true" className="absolute top-0 inset-x-0 h-4 border-b border-slate-200/60 flex justify-between px-6 text-[9px] font-mono text-slate-400 select-none pointer-events-none">
        <span>0mm</span>
        <span>50mm</span>
        <span>100mm</span>
        <span>150mm</span>
        <span>200mm</span>
        <span>250mm</span>
        <span>300mm</span>
      </div>

      <div aria-hidden="true" className="absolute bottom-0 inset-x-0 h-4 border-t border-slate-200/60 flex justify-between px-6 text-[9px] font-mono text-slate-400 select-none pointer-events-none items-center">
        <span>SPECIMEN BENCH</span>
        <span>LEGAL METROLOGY STANDARDS</span>
        <span>SCALE 1:1</span>
      </div>

      {/* Registration Marks / Corner Crosshairs */}
      <div aria-hidden="true" className="absolute top-6 left-6 w-3 h-3 border-t border-l border-slate-300 pointer-events-none" />
      <div aria-hidden="true" className="absolute top-6 right-6 w-3 h-3 border-t border-r border-slate-300 pointer-events-none" />
      <div aria-hidden="true" className="absolute bottom-6 left-6 w-3 h-3 border-b border-l border-slate-300 pointer-events-none" />
      <div aria-hidden="true" className="absolute bottom-6 right-6 w-3 h-3 border-b border-r border-slate-300 pointer-events-none" />

      {/* Content Container */}
      <div className="relative z-10 w-full h-full flex flex-col justify-between p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}
