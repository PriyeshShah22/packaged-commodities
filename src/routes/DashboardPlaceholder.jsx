import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PackMetrixLogo from '../components/brand/PackMetrixLogo';
import { CheckCircle2, LogOut, ShieldCheck } from 'lucide-react';


/**
 * DashboardPlaceholder
 * 
 * Minimal placeholder route strictly for testing successful mock authentication.
 * Does not implement actual dashboard features in accordance with prompt guidelines.
 */
export default function DashboardPlaceholder() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-between p-6 sm:p-12">
      {/* Top Navbar */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-200">
        <PackMetrixLogo size="md" />
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg shadow-xs transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out</span>
        </button>
      </header>

      {/* Center Success Notice */}
      <main className="max-w-md w-full mx-auto my-auto bg-white rounded-xl border border-slate-200/90 shadow-sm p-8 text-center space-y-4 animate-fade-in-up">
        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[11px] font-mono font-medium border border-sky-200/80 mb-2">
            <ShieldCheck className="w-3 h-3" />
            <span>SESSION AUTHENTICATED</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Welcome, {user?.name || 'Inspector'}
          </h1>
          <p className="text-xs text-slate-500 font-mono">
            {user?.email || 'officer@legalmetrology.gov.in'}
          </p>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 text-left text-xs font-mono text-slate-600 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">ORGANIZATION:</span>
            <span className="font-medium text-slate-800">{user?.organization || 'Legal Metrology Directorate'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">DESIGNATED ROLE:</span>
            <span className="font-medium text-slate-800">{user?.role || 'Enforcement Officer'}</span>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={handleLogout}
            className="w-full py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors"
          >
            ← Return to Authentication Screen
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto pt-6 text-center text-xs font-mono text-slate-400 border-t border-slate-200">
        PackMetrix Authentication Verified • Screen 01 Completed
      </footer>
    </div>
  );
}
