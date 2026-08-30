import React from 'react';
import AuthBrandPanel from './AuthBrandPanel';
import PackMetrixLogo from '../brand/PackMetrixLogo';
import InspectorScene2D from '../inspection/InspectorScene2D';

/**
 * AuthLayout
 * 
 * Cohesive Warm Editorial Split-Screen Layout:
 * - Desktop (1024px+): 60% Left Visual Inspection Workspace (Active Inspector + Laser Scan + Declarations),
 *   40% Right Authentication Panel (Quiet, readable LoginForm / SignupForm on matching warm ivory canvas).
 * - Mobile/Tablet (<1024px): Single-column stack with top brand header, compact inspection visual,
 *   and full-width touch-friendly auth form.
 */
export default function AuthLayout({ children }) {
  return (
    <main className="min-h-screen w-full flex flex-col lg:flex-row bg-[#FAF8F5] text-slate-900 selection:bg-sky-100 selection:text-sky-900">
      {/* Left Panel: Desktop 2D Inspection Workspace (60% of viewport) */}
      <section 
        aria-label="PackMetrix Platform Overview"
        className="hidden lg:flex lg:w-[60%] min-h-screen sticky top-0 overflow-visible"
      >
        <AuthBrandPanel />
      </section>

      {/* Right Panel: Quiet Authentication Panel (40% of viewport, matching warm ivory canvas) */}
      <section 
        aria-label="Authentication"
        className="relative w-full lg:w-[40%] flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-14 overflow-y-auto bg-[#FAF8F5]"
      >
        {/* Subtle Background Architectural Dot Matrix for visual cohesion */}
        <div 
          aria-hidden="true"
          className="absolute inset-0 bg-dot-grid opacity-25 pointer-events-none [mask-image:radial-gradient(ellipse_at_center,white_30%,transparent_85%)]" 
        />

        {/* Mobile Header (Shown ONLY on screens < lg) */}
        <div className="lg:hidden relative z-10 flex flex-col items-center text-center space-y-4 pb-6 border-b border-[#E8E2D5] mb-6 overflow-visible">
          <PackMetrixLogo size="md" />
          
          {/* Mobile 2D Inspection Visual Container */}
          <div className="w-full max-w-md">
            <InspectorScene2D />
          </div>
        </div>

        {/* Center Content: Authentication Form Container */}
        <div className="relative z-10 w-full max-w-[460px] mx-auto my-auto py-2 sm:py-6">
          <div className="bg-white border border-[#E8E2D5] rounded-3xl p-8 sm:p-10 shadow-[0_8px_32px_-8px_rgba(30,25,15,0.05)]">
            {children}
          </div>
        </div>

        {/* Global Security / Legal Metrology Footer */}
        <footer className="relative z-10 w-full max-w-[460px] mx-auto pt-6 text-center text-xs font-mono text-[#8C8275] border-t border-[#E8E2D5] lg:border-t-0">
          <div className="flex items-center justify-center gap-2">
            <span className="font-semibold text-slate-700">PackMetrix</span>
            <span>•</span>
            <span>Legal Metrology Compliance Platform</span>
          </div>
        </footer>
      </section>
    </main>
  );
}
