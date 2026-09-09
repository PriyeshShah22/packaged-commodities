import React, { useState } from 'react';
import {
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  PlusCircle,
  ShieldCheck,
  X
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { parseInspectorName } from '../lib/userFormat';
import PackageScannerLogo from './PackageScannerLogo';

export default function AppShell({ children, title, eyebrow, actions }) {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { to: '/inspections/new', label: 'New Inspection', icon: PlusCircle, show: hasRole('inspector', 'admin') },
    { to: '/reports', label: 'View Reports', icon: FileText, show: true },
    { to: '/products', label: 'Product Register', icon: PackageSearch, show: true },
  ];

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  const inspector = parseInspectorName(user);


  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 lg:flex antialiased font-sans">
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-30 lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}

      {/* Left Sidebar (Executive Dark Navy PackMetrix Inspection Console) */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-72 bg-sidebar-pattern text-slate-100 flex flex-col border-r border-slate-800/80 transition-transform duration-200 ease-out select-none ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Area: Signature Package -> Scan -> Verify Interaction */}
        <div className="h-20 px-5 border-b border-slate-800/80 flex items-center justify-between bg-[#080D17]">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-3 text-left group p-1.5 -m-1.5 rounded-xl hover:bg-slate-800/40 transition-all duration-250 focus:outline-none cursor-pointer"
          >
            {/* Signature Package Inspection Icon with Active Laser Beam & Check Flash */}
            <PackageScannerLogo size="default" />

            {/* PackMetrix Wordmark & Subtitle matching Login Page */}
            <div>
              <div className="flex items-baseline tracking-tight text-xl leading-none">
                <span className="text-slate-100 font-medium">Pack</span>
                <span className="text-white font-black tracking-tight group-hover:text-sky-300 transition-colors duration-250">
                  Metrix
                </span>
                <span className="text-sky-400 font-black">.</span>
              </div>
              <p className="text-[10px] font-mono font-medium text-slate-400 group-hover:text-sky-300 tracking-wider uppercase mt-1 transition-colors duration-250">
                Scan. Verify. Comply.
              </p>
            </div>
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Section with Vertical Scan Track & Refined Interactions */}
        <div className="relative p-4 flex-1 flex flex-col justify-between overflow-y-auto">
          <div>
            {/* Subtle Vertical Scan Track along Navigation Area */}
            <div className="pointer-events-none absolute left-3 top-4 bottom-4 w-[1px] bg-slate-800/40 overflow-hidden">
              <div className="w-full h-12 bg-gradient-to-b from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_#38bdf8] animate-sidebar-scan-track" />
            </div>

            {/* Inspection Office Header with Pulsing Status Dot */}
            <div className="flex items-center justify-between px-3.5 py-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                <p className="text-[11px] font-mono font-bold tracking-[0.18em] text-slate-300 uppercase">
                  Inspection Office
                </p>
              </div>
              <span className="text-[9px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60">
                #LM-2011
              </span>
            </div>

            {/* Navigation Items — Clean, Premium, 15-16px Typography, 20px Icons */}
            <nav className="space-y-2 mt-2">
              {navItems
                .filter((item) => item.show)
                .map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] font-nav transition-all duration-200 ease-out overflow-hidden cursor-pointer ${
                        isActive
                          ? 'bg-slate-800/90 text-white font-semibold shadow-xs border border-slate-700/60'
                          : 'text-slate-400 font-medium hover:text-white hover:bg-slate-800/50'
                      }`
                    }
                  >
                    {({ isActive }) => {
                      // Dedicated Icon Micro-Animation styles (250-350ms)
                      let iconAnimClass = 'group-hover:scale-[1.08]';
                      if (to === '/inspections/new') {
                        iconAnimClass = 'group-hover:rotate-90 group-hover:scale-[1.08]';
                      } else if (to === '/reports') {
                        iconAnimClass = 'group-hover:scale-[1.08] group-hover:-translate-y-0.5';
                      }

                      return (
                        <>
                          {/* Left Indicator: Cyan indicator bar with smooth slide/fade in */}
                          <span
                            className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-all duration-250 ease-out ${
                              isActive
                                ? 'bg-[#0284C7] opacity-100 translate-x-0'
                                : 'bg-[#0284C7]/80 -translate-x-full opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                            }`}
                          />

                          {/* Active Tab Occasional Scan Light Sweep */}
                          {isActive && (
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-sky-400/15 to-transparent animate-active-tab-scan" />
                          )}

                          {/* Inactive Tab Hover Scan Sheen (travels across once) */}
                          {!isActive && (
                            <div className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-300 ease-out bg-gradient-to-r from-transparent via-sky-400/10 to-transparent" />
                          )}

                          {/* 20px Icon with 2px movement and dedicated micro-interaction */}
                          <Icon
                            className={`w-5 h-5 shrink-0 transition-all duration-250 ease-out ${iconAnimClass} ${
                              isActive
                                ? 'text-sky-400'
                                : 'text-slate-400 group-hover:text-sky-300 group-hover:translate-x-0.5'
                            }`}
                          />

                          {/* 15-16px Label Text with 2px horizontal movement on hover */}
                          <span
                            className={`transition-all duration-200 ease-out tracking-normal ${
                              isActive
                                ? 'text-white font-semibold'
                                : 'text-slate-300 group-hover:text-white font-medium group-hover:translate-x-0.5'
                            }`}
                          >
                            {label}
                          </span>
                        </>
                      );
                    }}
                  </NavLink>
                ))}
            </nav>
          </div>

          {/* Clean Negative Space: Dark navy background + subtle grid texture (No graphics, no cards) */}
          <div className="flex-1 min-h-[60px]" aria-hidden="true" />
        </div>






        {/* Inspector Profile Card (Dynamic Authenticated User) */}
        <div className="p-4 border-t border-slate-800/80 bg-[#080D17]">
          <div className="animate-entrance-profile group/profile relative p-3 rounded-2xl bg-slate-900/80 border border-slate-800/90 mb-2.5 flex items-center gap-3 transition-all duration-250 ease-out hover:-translate-y-[2.5px] hover:border-slate-700/90 hover:bg-slate-850 hover:shadow-md cursor-default">
            {/* Dynamic Avatar with Initials and Animated Ring on Card Hover */}
            <div className="relative w-10 h-10 rounded-xl bg-slate-950 border border-sky-500/30 flex items-center justify-center shrink-0 shadow-inner group-hover/profile:border-sky-400 group-hover/profile:scale-105 transition-all duration-300">
              {/* Animated circular ring on card hover */}
              <div className="pointer-events-none absolute -inset-0.5 rounded-xl border-2 border-transparent group-hover/profile:border-sky-400/80 transition-all duration-400" />
              <span className="font-mono font-black text-xs text-sky-400 tracking-wider">
                {inspector.initials}
              </span>
            </div>

            {/* Dynamic Inspector Name, Role, and Short ID */}
            <div className="min-w-0 flex-1">
              {/* Row 1: Real Display Name (Never ID, never truncated into Insp..) */}
              <p
                title={inspector.fullName}
                className="text-sm font-bold text-white truncate group-hover/profile:text-sky-200 transition-colors duration-200 leading-snug"
              >
                {inspector.fullName}
              </p>

              {/* Row 2: Role */}
              <p className="text-[10px] font-mono font-semibold tracking-wider text-slate-400 uppercase truncate mt-0.5">
                {inspector.role}
              </p>

              {/* Row 3: Shortened Secondary Metadata ID (e.g. #LM-f2f05328… or #LM-8492) */}
              <div className="mt-1">
                <span
                  title={`Inspector ID: ${inspector.fullId}`}
                  className="inline-block text-[9px] font-mono text-emerald-400/90 bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.2 rounded shrink-0 max-w-full truncate"
                >
                  {inspector.shortId}
                </span>
              </div>
            </div>
          </div>

          {/* Sign Out Button: Quiet & Professional */}
          <button
            onClick={handleSignOut}
            className="group/out w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-slate-500 group-hover/out:text-rose-400 group-hover/out:translate-x-0.5 transition-all duration-200" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>


      {/* Main Workspace Canvas with Warm Ivory & Architectural Texture */}
      <div className="flex-1 min-w-0 flex flex-col bg-dashboard-canvas">
        {/* Sticky Top Bar matching Auth Header Tone */}
        <header className="h-16 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E8E2D5] sticky top-0 z-20 px-5 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 border border-[#E8E2D5] rounded-lg text-slate-600 hover:bg-[#F4EFE6]"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Path */}
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span className="text-sky-700 flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                {eyebrow || 'OVERVIEW'}
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-medium normal-case text-xs sm:text-sm truncate">
                {title || 'Compliance Dashboard'}
              </span>
            </div>
          </div>

          {/* Right Header Actions & Technical Coordinate Marker */}
          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-mono text-[#8C8275] bg-[#F4EFE6] border border-[#E8E2D5] px-2.5 py-1 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              FIELD INSPECTION // WORKSPACE
            </span>
            {actions}
          </div>
        </header>

        {/* Workspace Body */}
        <main className="p-5 sm:p-8 max-w-[1560px] mx-auto w-full flex-1">
          {children}
        </main>
      </div>

    </div>
  );
}
