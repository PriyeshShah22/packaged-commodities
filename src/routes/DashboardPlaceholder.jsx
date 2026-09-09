import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileWarning,
  Package,
  Plus,
  ScanLine,
  Server,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import InspectionPipeline from '../components/InspectionPipeline';
import PackageScannerLogo from '../components/PackageScannerLogo';
import { useAuth } from '../context/auth-context';
import { getBackendHealth } from '../lib/api';
import { computeDashboard, getReports } from '../lib/reportStore';
import { parseInspectorName } from '../lib/userFormat';
import AdminDashboard from './AdminDashboard';
import ViewerDashboard from './ViewerDashboard';

// Lightweight 60fps Ease-Out Count-Up Animation Hook
function useCountUp(target, duration = 650) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!target || target <= 0) return;
    let startTimestamp = null;
    let frameId;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease-out cubic: 1 - (1 - progress)^3
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(ease * target));
      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };
    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [target, duration]);

  return target <= 0 ? 0 : count;
}

// Professional SVG Donut Chart with Interactive Legend Segment Highlighting
function ComplianceDonutChart({ compliant, nonCompliant, review, total }) {
  const animatedTotal = useCountUp(total, 750);
  const [animated, setAnimated] = useState(false);
  const [hoveredSegment, setHoveredSegment] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 60);
    return () => clearTimeout(timer);
  }, []);

  // Circle Geometry: radius = 64, circumference ≈ 402.12
  const r = 64;
  const c = 2 * Math.PI * r;

  const pCompliant = total > 0 ? compliant / total : 0;
  const pNonCompliant = total > 0 ? nonCompliant / total : 0;
  const pReview = total > 0 ? review / total : 0;

  const strokeCompliant = pCompliant * c;
  const strokeNonCompliant = pNonCompliant * c;
  const strokeReview = pReview * c;

  const offsetCompliant = 0;
  const offsetNonCompliant = -(strokeCompliant);
  const offsetReview = -(strokeCompliant + strokeNonCompliant);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-7 w-full">
      {/* SVG Donut Graphic */}
      <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
        <svg
          viewBox="0 0 160 160"
          className="w-full h-full -rotate-90 transform"
          aria-label="Compliance distribution donut chart"
        >
          {total === 0 ? (
            // Neutral subtle dashed ring for 0 reports
            <circle
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="16"
              strokeDasharray="4 4"
            />
          ) : (
            <>
              {/* Background Neutral Track */}
              <circle
                cx="80"
                cy="80"
                r={r}
                fill="none"
                stroke="#F1F5F9"
                strokeWidth="16"
              />

              {/* Compliant Segment (Green) */}
              {compliant > 0 && (
                <circle
                  cx="80"
                  cy="80"
                  r={r}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth={hoveredSegment === 'compliant' ? '20' : '16'}
                  strokeDasharray={`${animated ? strokeCompliant : 0} ${c}`}
                  strokeDashoffset={offsetCompliant}
                  strokeLinecap="round"
                  className={`transition-all duration-700 ease-out ${
                    hoveredSegment && hoveredSegment !== 'compliant' ? 'opacity-35' : 'opacity-100'
                  }`}
                />
              )}

              {/* Non-compliant Segment (Red) */}
              {nonCompliant > 0 && (
                <circle
                  cx="80"
                  cy="80"
                  r={r}
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth={hoveredSegment === 'nonCompliant' ? '20' : '16'}
                  strokeDasharray={`${animated ? strokeNonCompliant : 0} ${c}`}
                  strokeDashoffset={offsetNonCompliant}
                  strokeLinecap="round"
                  className={`transition-all duration-700 ease-out ${
                    hoveredSegment && hoveredSegment !== 'nonCompliant' ? 'opacity-35' : 'opacity-100'
                  }`}
                />
              )}

              {/* Needs Review Segment (Amber) */}
              {review > 0 && (
                <circle
                  cx="80"
                  cy="80"
                  r={r}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth={hoveredSegment === 'review' ? '20' : '16'}
                  strokeDasharray={`${animated ? strokeReview : 0} ${c}`}
                  strokeDashoffset={offsetReview}
                  strokeLinecap="round"
                  className={`transition-all duration-700 ease-out ${
                    hoveredSegment && hoveredSegment !== 'review' ? 'opacity-35' : 'opacity-100'
                  }`}
                />
              )}
            </>
          )}
        </svg>

        {/* Center Indicator */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-3xl font-bold tracking-tight text-slate-900 leading-none">
            {animatedTotal}
          </span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-1">
            Total Reports
          </span>
        </div>
      </div>

      {/* Interactive Legend & Breakdown List */}
      <div className="space-y-3 w-full flex-1 min-w-[200px]">
        {/* Compliant Item */}
        <div
          onMouseEnter={() => setHoveredSegment('compliant')}
          onMouseLeave={() => setHoveredSegment(null)}
          className={`flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 cursor-pointer text-sm ${
            hoveredSegment === 'compliant' ? 'bg-emerald-50/80 shadow-2xs' : 'hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-medium text-slate-700">Compliant</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-900">{compliant}</span>
            <span className="text-xs font-mono text-slate-400 w-10 text-right">
              {total > 0 ? `${Math.round((compliant / total) * 100)}%` : '0%'}
            </span>
          </div>
        </div>

        {/* Non-compliant Item */}
        <div
          onMouseEnter={() => setHoveredSegment('nonCompliant')}
          onMouseLeave={() => setHoveredSegment(null)}
          className={`flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 cursor-pointer text-sm ${
            hoveredSegment === 'nonCompliant' ? 'bg-rose-50/80 shadow-2xs' : 'hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span className="font-medium text-slate-700">Non-compliant</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-900">{nonCompliant}</span>
            <span className="text-xs font-mono text-slate-400 w-10 text-right">
              {total > 0 ? `${Math.round((nonCompliant / total) * 100)}%` : '0%'}
            </span>
          </div>
        </div>

        {/* Needs Review Item */}
        <div
          onMouseEnter={() => setHoveredSegment('review')}
          onMouseLeave={() => setHoveredSegment(null)}
          className={`flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 cursor-pointer text-sm ${
            hoveredSegment === 'review' ? 'bg-amber-50/80 shadow-2xs' : 'hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span className="font-medium text-slate-700">Needs Review</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-900">{review}</span>
            <span className="text-xs font-mono text-slate-400 w-10 text-right">
              {total > 0 ? `${Math.round((review / total) * 100)}%` : '0%'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Single KPI Card Component with Warm Paper Surface, Technical Marks & Laser Sweep on Hover
function KpiCard({ label, value, icon: Icon, colorStyles, badgeText, subtitle, animationClass }) {
  const animatedValue = useCountUp(value, 650);

  return (
    <div
      className={`group relative overflow-hidden bg-white rounded-3xl border border-[#E8E2D5] p-5.5 shadow-[0_4px_24px_-4px_rgba(30,25,15,0.04)] hover-lift transition-all duration-250 ease-out hover:border-[#0284C7]/60 hover:shadow-md cursor-default ${animationClass}`}
    >
      {/* Technical Corner Alignment Crosshair */}
      <div className="absolute top-2 left-2.5 text-[9px] font-mono text-[#8C8275]/35 select-none pointer-events-none">+</div>
      <div className="absolute top-2 right-2.5 text-[9px] font-mono text-[#8C8275]/35 select-none pointer-events-none">+</div>

      {/* Signature Optical Laser Sweep Line across Card on Hover */}
      <div className="kpi-laser-sweep pointer-events-none absolute inset-y-0 w-[2.5px] bg-gradient-to-b from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#38bdf8] opacity-0 z-20" />

      {/* Subtle Light Sheen trailing behind the laser */}
      <div className="hover-sheen pointer-events-none absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-sky-100/25 to-transparent -translate-x-full opacity-0 z-10" />

      <div className="flex items-center justify-between relative z-10">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-250 group-hover:scale-[1.06] ${colorStyles.iconBg} ${colorStyles.iconColor} ${colorStyles.borderColor}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-mono font-bold tracking-wider text-[#8C8275] bg-[#F4EFE6] px-2 py-0.5 rounded-md border border-[#E8E2D5]">
          {badgeText}
        </span>
      </div>

      <div className="mt-4 relative z-10">
        <p className="text-3xl sm:text-4xl font-black tracking-tight text-[#0B1224] transition-colors duration-200 group-hover:text-slate-950">
          {animatedValue}
        </p>
        <p className="text-sm font-bold text-slate-800 mt-1">{label}</p>
        <p className="text-xs text-[#8C8275] mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

export function InspectorDashboard() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const reports = useMemo(() => getReports(), []);
  const metrics = computeDashboard(reports);
  const [online, setOnline] = useState(null);
  const [animatedBars, setAnimatedBars] = useState(false);

  useEffect(() => {
    getBackendHealth().then(setOnline);
    const timer1 = setTimeout(() => setAnimatedBars(true), 120);
    return () => {
      clearTimeout(timer1);
    };
  }, []);

  // 4 Core Statutory Categories under Legal Metrology Rules, 2011
  const categories = [
    { label: 'Identity & Origin', ruleKeys: ['name', 'commodity', 'manufacturer', 'origin'] },
    { label: 'Quantity & Net Measures', ruleKeys: ['quantity', 'metric', 'unit'] },
    { label: 'Retail Pricing (MRP)', ruleKeys: ['mrp', 'price', 'retail'] },
    { label: 'Consumer Care & Helpline', ruleKeys: ['consumer', 'care', 'phone', 'email'] },
  ];

  const violationCounts = categories.map(({ label, ruleKeys }) => ({
    label,
    count: reports
      .flatMap((r) => r.violations || [])
      .filter((v) =>
        ruleKeys.some((k) => (v.rule_id || '').toLowerCase().includes(k))
      ).length,
  }));

  const totalViolations = violationCounts.reduce((acc, curr) => acc + curr.count, 0);
  const maxViolations = Math.max(1, ...violationCounts.map((item) => item.count));

  // Dynamic Inspector Profile from Authenticated Session
  const inspector = parseInspectorName(user);

  // Primary Action Button matching the Login Dark Navy Editorial Accent
  const actionButton = hasRole('inspector', 'admin') ? (
    <button
      onClick={() => navigate('/inspections/new')}
      className="group inline-flex items-center gap-2 bg-[#0B1224] hover:bg-slate-900 active:scale-[0.98] text-white px-4.5 py-2.5 rounded-xl text-sm font-semibold border border-slate-800 hover:border-sky-500/40 shadow-xs hover:shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 cursor-pointer"
    >
      <Plus className="w-4 h-4 text-sky-400 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-90" />
      <span className="transition-colors duration-200 group-hover:text-slate-100">New Inspection</span>
    </button>
  ) : null;

  return (
    <AppShell title="Compliance Dashboard" eyebrow="OVERVIEW" actions={actionButton}>

      {/* 1. Page Header & Greeting Banner (Editorial & Warm with 100ms/200ms/300ms Stagger) */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#E8E2D5] mb-6">
        <div className="min-w-0">
          {/* Stagger 1: Overview badge (100ms) */}
          <div className="animate-header-overview flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0284C7] mb-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0284C7] animate-pulse" />
            <span>Overview</span>
            <span className="text-[#8C8275]">•</span>
            <span className="text-slate-700 font-semibold">Compliance Dashboard</span>
          </div>

          {/* Stagger 2: Dynamic Greeting with Highlighted Name (200ms) */}
          <h1 className="animate-header-greeting text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#0B1224] leading-tight break-words">
            Good day,{' '}
            <span className="font-black text-[#0B1224] underline decoration-sky-400/40 decoration-2 underline-offset-4">
              {inspector.firstName}
            </span>
            .
          </h1>

          {/* Stagger 3: Description (300ms) */}
          <p className="animate-header-desc text-sm text-[#475569] mt-1.5">
            Operational overview of products inspected in this workspace.
          </p>
        </div>

        {/* Backend Status Pill with Breathing Dot (Stagger 100ms) */}
        <div className="animate-header-overview flex items-center gap-2 text-xs text-slate-700 bg-white border border-[#E8E2D5] rounded-xl px-3.5 py-1.5 shadow-2xs self-start sm:self-auto shrink-0">

          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              online === true
                ? 'bg-emerald-500 animate-dot-breathe'
                : online === false
                ? 'bg-rose-500'
                : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span className="font-medium font-mono text-[11px]">
            {online === true
              ? 'Rule Engine Connected'
              : online === false
              ? 'Rule Engine Offline'
              : 'Verifying Rule Engine...'}
          </span>
        </div>
      </section>

      {/* Backend Offline Warning Alert (if applicable) */}
      {online === false && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-800 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <p className="font-semibold">Backend Service Disconnected</p>
            <p className="text-xs text-rose-700 mt-0.5">
              The FastAPI backend on port 8000 is unreachable. Ensure the service is active to perform live OCR and Legal Metrology rule validation.
            </p>
          </div>
        </div>
      )}

      {/* 2. Inspection Intelligence Pipeline Detail (Major Feature) */}
      <InspectionPipeline />

      {/* 3. KPI Cards (Entrance Steps 3, 4, 5, 6 with Stagger & Optical Laser Sweep) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        <KpiCard
          label="Total Products"
          value={metrics.products}
          icon={Package}
          badgeText="CATALOGED"
          subtitle={
            metrics.products === 0
              ? 'No inspections yet'
              : `${metrics.total} total inspection ${metrics.total === 1 ? 'record' : 'records'}`
          }
          colorStyles={{
            iconBg: 'bg-sky-50',
            iconColor: 'text-[#0284C7]',
            borderColor: 'border-sky-200/80',
          }}
          animationClass="animate-entrance-kpi-1"
        />

        <KpiCard
          label="Compliant"
          value={metrics.compliant}
          icon={CheckCircle2}
          badgeText="VERIFIED"
          subtitle={
            metrics.total === 0
              ? '0% pass rate'
              : `${Math.round((metrics.compliant / metrics.total) * 100)}% pass rate`
          }
          colorStyles={{
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-700',
            borderColor: 'border-emerald-200/80',
          }}
          animationClass="animate-entrance-kpi-2"
        />

        <KpiCard
          label="Non-compliant"
          value={metrics.nonCompliant}
          icon={ShieldAlert}
          badgeText="VIOLATIONS"
          subtitle={
            metrics.nonCompliant === 0
              ? 'No violations flagged'
              : `${metrics.nonCompliant} statutory notice${metrics.nonCompliant === 1 ? '' : 's'}`
          }
          colorStyles={{
            iconBg: 'bg-rose-50',
            iconColor: 'text-rose-700',
            borderColor: 'border-rose-200/80',
          }}
          animationClass="animate-entrance-kpi-3"
        />

        <KpiCard
          label="Needs Review"
          value={metrics.review}
          icon={FileWarning}
          badgeText="PENDING"
          subtitle={
            metrics.review === 0
              ? 'All records resolved'
              : 'Requires officer audit'
          }
          colorStyles={{
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-700',
            borderColor: 'border-amber-200/80',
          }}
          animationClass="animate-entrance-kpi-4"
        />
      </section>

      {/* 4. Analytics Grid: Compliance Distribution & Violation Signals */}
      <section className="animate-entrance-analytics grid grid-cols-1 xl:grid-cols-12 gap-5 mt-6">
        {/* Compliance Distribution Donut Card */}
        <div className="xl:col-span-7 bg-white border border-[#E8E2D5] rounded-3xl p-6 sm:p-7 shadow-[0_4px_24px_-4px_rgba(30,25,15,0.04)] relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-[#E8E2D5]">
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-4 rounded-full bg-[#0284C7] shrink-0" />
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#0B1224] tracking-tight">
                  Compliance Distribution
                </h2>
                <p className="text-xs text-[#8C8275] mt-0.5">
                  Statutory verification outcomes across all submitted package evidence
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-[#F4EFE6] text-slate-800 border border-[#E8E2D5]">
                {metrics.rate}% Average Score
              </span>
            </div>
          </div>

          <div className="mt-6">
            <ComplianceDonutChart
              compliant={metrics.compliant}
              nonCompliant={metrics.nonCompliant}
              review={metrics.review}
              total={metrics.total}
            />
          </div>
        </div>

        {/* Violation Signals Card */}
        <div className="xl:col-span-5 bg-white border border-[#E8E2D5] rounded-3xl p-6 sm:p-7 shadow-[0_4px_24px_-4px_rgba(30,25,15,0.04)] flex flex-col relative overflow-hidden">
          <div className="pb-5 border-b border-[#E8E2D5] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-4 rounded-full bg-[#0284C7] shrink-0" />
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#0B1224] tracking-tight">
                  Violation Signals
                </h2>
                <p className="text-xs text-[#8C8275] mt-0.5">
                  Statutory anomaly frequency by rule category
                </p>
              </div>
            </div>
            {totalViolations > 0 && (
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                {totalViolations} Flagged
              </span>
            )}
          </div>

          <div className="mt-6 flex-1 flex flex-col justify-center">
            {totalViolations === 0 ? (
              // Professional Empty State with Verification Icon
              <div className="py-7 px-4 text-center rounded-2xl bg-[#FAF8F5] border border-dashed border-[#E8E2D5] flex flex-col items-center">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-2.5 shadow-2xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-[#0B1224]">
                  ✓ No violation signals detected
                </p>
                <p className="text-xs text-[#8C8275] max-w-xs mt-1">
                  All evaluated commodities meet mandatory Legal Metrology declaration standards with zero non-compliance alerts.
                </p>
              </div>
            ) : (
              // Active Progress Bars with Interactive Hover Highlights
              <div className="space-y-3">
                {violationCounts.map((item) => {
                  const pct = Math.round((item.count / maxViolations) * 100);
                  return (
                    <div
                      key={item.label}
                      className="group/row p-2.5 -mx-2.5 rounded-xl hover:bg-[#FAF8F5] transition-all duration-200 space-y-1.5 cursor-default"
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-800 group-hover/row:text-[#0B1224] transition-colors">
                          {item.label}
                        </span>
                        <span className="font-mono text-xs font-semibold text-[#8C8275] group-hover/row:text-[#0284C7] bg-[#F4EFE6] group-hover/row:bg-sky-50 px-2 py-0.5 rounded-md transition-colors border border-[#E8E2D5]/70">
                          {item.count} {item.count === 1 ? 'anomaly' : 'anomalies'}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#F4EFE6] overflow-hidden">
                        <div
                          className="h-full bg-[#0284C7] rounded-full transition-all duration-700 ease-out group-hover/row:bg-sky-500"
                          style={{ width: animatedBars ? `${pct}%` : '0%' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. Recent Reports Table */}
      <section className="animate-entrance-table bg-white border border-[#E8E2D5] rounded-3xl mt-6 overflow-hidden shadow-[0_4px_24px_-4px_rgba(30,25,15,0.04)]">
        <div className="p-5 sm:p-6 border-b border-[#E8E2D5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-4 rounded-full bg-[#0284C7] shrink-0" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#0B1224] tracking-tight">
                Recent Inspection Reports
              </h2>
              <p className="text-xs text-[#8C8275] mt-0.5">
                Audit trail of scanned commodities, statutory scores, and official assessments
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/reports')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0284C7] hover:text-[#0369A1] transition-colors self-start sm:self-auto"
          >
            <span>View all reports</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {!reports.length ? (
          // Professional Inspection Empty State with Active Package Scanner Logo
          <div className="py-16 px-6 text-center max-w-md mx-auto">
            <PackageScannerLogo size="lg" className="mx-auto mb-4" />
            <h3 className="text-base font-bold text-[#0B1224]">
              No inspection reports yet
            </h3>
            <p className="text-xs text-[#8C8275] mt-1.5 leading-relaxed">
              Start an inspection to capture package declarations, verify statutory rules, and generate regulatory compliance audit reports.
            </p>
            <button
              onClick={() => navigate('/inspections/new')}
              className="mt-5 inline-flex items-center gap-2 bg-[#0B1224] hover:bg-slate-900 active:scale-[0.98] text-white px-4.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 shadow-xs hover:shadow-md border border-slate-800"
            >
              <Plus className="w-4 h-4 text-sky-400" />
              <span>Start New Inspection</span>
            </button>
          </div>
        ) : (
          // Enterprise Table Representation with Interactive Hover Rows
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF8F5] text-[11px] font-mono font-bold text-[#8C8275] uppercase tracking-wider border-b border-[#E8E2D5]">
                <tr>
                  <th className="py-3 px-5">Product &amp; Identifier</th>
                  <th className="py-3 px-5">Inspection Date</th>
                  <th className="py-3 px-5">Compliance Score</th>
                  <th className="py-3 px-5">Status Assessment</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E2D5]/70">
                {reports.slice(0, 6).map((r) => {
                  const statusStyles =
                    r.status === 'COMPLIANT'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : r.status === 'NON_COMPLIANT'
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200';

                  return (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/reports/${r.id}`)}
                      className="group/item hover:bg-[#FAF8F5] transition-all duration-200 cursor-pointer border-l-2 border-transparent hover:border-[#0284C7]"
                    >
                      <td className="py-3.5 px-5">
                        <p className="font-semibold text-[#0B1224] group-hover/item:text-[#0284C7] transition-colors">
                          {r.details?.productName || 'Unnamed Package Product'}
                        </p>
                        <p className="text-xs font-mono text-[#8C8275] mt-0.5">
                          {r.details?.productId || r.id}
                        </p>
                      </td>
                      <td className="py-3.5 px-5 text-xs text-[#8C8275] font-mono">
                        {r.date || 'Today'}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm">
                            {r.score}%
                          </span>
                          <div className="w-16 h-1.5 rounded-full bg-[#F4EFE6] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                r.score >= 80
                                  ? 'bg-emerald-500'
                                  : r.score >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${r.score}%` }}
                            />
                          </div>
                        </div>
                        {r.verification?.total > 0 && (
                          <p className="text-[10px] font-mono text-[#8C8275] mt-0.5">
                            {r.verification.verified}/{r.verification.total} verified
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`text-[10.5px] font-mono font-bold px-2.5 py-1 rounded-full border inline-block ${statusStyles}`}
                        >
                          {r.status === 'NON_COMPLIANT'
                            ? 'POTENTIAL ISSUE'
                            : r.status === 'REVIEW'
                            ? 'NEEDS REVIEW'
                            : r.status === 'COMPLIANT'
                            ? 'PASS'
                            : r.status || 'EVALUATED'}
                        </span>
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0284C7] group-hover/item:text-[#0369A1] transition-all">
                          <span>View Report</span>
                          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/item:translate-x-1" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 6. Technical Operational Footer */}
      <footer className="mt-6 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#8C8275] border-t border-[#E8E2D5]">
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="flex items-center gap-1.5 font-medium text-slate-700">
            <Server className="w-3.5 h-3.5 text-[#8C8275]" />
            {online ? 'Rule Engine Connected' : 'Rule Engine Offline'}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <ScanLine className="w-3.5 h-3.5 text-[#8C8275]" />
            13 Mandatory Legal Metrology Checks
          </span>
        </div>
        <div className="font-mono text-[11px] text-[#8C8275]">
          Legal Metrology (Packaged Commodities) Rules, 2011 · Evidentiary Chain-of-Custody
        </div>
      </footer>
    </AppShell>
  );
}

export default function DashboardPlaceholder() {
  const { hasRole } = useAuth();
  if (hasRole('admin')) return <AdminDashboard />;
  if (hasRole('viewer')) return <ViewerDashboard />;
  return <InspectorDashboard />;
}


