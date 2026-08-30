import React from 'react';
import PackMetrixLogo from '../brand/PackMetrixLogo';
import InspectorScene2D from '../inspection/InspectorScene2D';

/**
 * AuthBrandPanel
 * 
 * Left-side full-bleed inspection workspace for the PackMetrix Authentication screen.
 * Seamlessly integrates the PackMetrix logo and the full-height 2D inspection environment
 * without nested card boxes or redundant borders.
 */
export default function AuthBrandPanel() {
  return (
    <div className="relative w-full h-full min-h-screen flex flex-col justify-between bg-[#FAF8F5] border-r border-[#E8E2D5] overflow-visible">
      
      {/* Top Header Bar: PackMetrix Brand Wordmark */}
      <div className="relative z-30 pt-6 sm:pt-8 lg:pt-10 px-6 sm:px-8 lg:px-10 overflow-visible">
        <PackMetrixLogo size="lg" />
      </div>

      {/* Full-Bleed 2D Inspection Workspace Environment */}
      <div className="relative z-10 w-full flex-1 flex flex-col justify-between overflow-visible">
        <InspectorScene2D />
      </div>
    </div>
  );
}
