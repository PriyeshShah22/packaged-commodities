import React from 'react';
import { Link } from 'react-router-dom';
import PackMetrixLogo from '../components/brand/PackMetrixLogo';
import RealInspectorViewer from '../components/3d/RealInspectorViewer';
import { ArrowLeft } from 'lucide-react';

/**
 * InspectorTestRoute
 * 
 * Standalone test route at /inspector-test.
 * Loads and inspects the real PackMetrix Inspector GLB model from the public folder.
 */
export default function InspectorTestRoute() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 flex flex-col justify-between p-6 sm:p-10 lg:p-12 selection:bg-sky-100 selection:text-sky-900">
      
      {/* Top Header Bar */}
      <header className="max-w-7xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-200/90">
        <div className="flex items-center gap-4">
          <PackMetrixLogo size="md" />
          <span className="hidden sm:inline-block px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono font-bold">
            3D INSPECTOR PROTOTYPE
          </span>
        </div>

        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-xs font-mono font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/90 px-3.5 py-2 rounded-xl shadow-2xs transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Auth Screen</span>
        </Link>
      </header>

      {/* Main 3D Inspector View */}
      <main className="max-w-7xl w-full mx-auto my-6 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            3D Field Inspector Character
          </h1>
          <p className="text-sm text-slate-500 font-mono">
            Direct WebGL rendering of the rigged PackMetrix Inspector GLB asset with skeletal animation playback
          </p>
        </div>

        {/* Real Inspector Viewer with Live Status Panel */}
        <RealInspectorViewer />
      </main>

      {/* Footer */}
      <footer className="max-w-7xl w-full mx-auto pt-6 text-center text-xs font-mono text-slate-400 border-t border-slate-200/60">
        PackMetrix 3D Inspector Prototype • Screen 01 Asset Verification
      </footer>
    </div>
  );
}
