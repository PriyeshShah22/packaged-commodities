import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  Download,
  FileSearch,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  MapPin,
  Maximize2,
  Phone,
  RotateCcw,
  Save,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
  XCircle
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/auth-context';
import { downloadReportPdf } from '../lib/api';
import { archiveReport, getBulkBatch, getReport, updateReport } from '../lib/reportStore';

const OUTCOMES = [
  ['COMPLIANT', 'Confirm compliant'],
  ['VIOLATION', 'Confirm violation'],
  ['MORE_EVIDENCE', 'Needs more evidence'],
];

export default function ReportDetailRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [report, setReport] = useState(() => getReport(id));
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null);
  const [animatedProgress, setAnimatedProgress] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedProgress(true), 150);
    return () => clearTimeout(timer);
  }, [id]);

  if (!report) {
    return (
      <AppShell title="Report not found" eyebrow="DOSSIER INQUIRY">
        <div className="bg-white rounded-3xl border border-[#E8E2D5] p-12 sm:p-16 text-center max-w-lg mx-auto shadow-sm">
          <FileSearch className="w-12 h-12 text-[#8C8275] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#0B1224]">Report Not Found</h2>
          <p className="text-sm text-[#8C8275] mt-2 leading-relaxed">
            This regulatory dossier is not available in the current inspection workspace or may have been removed.
          </p>
          <button
            onClick={() => navigate('/reports')}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0B1224] text-white hover:bg-slate-900 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Inspection Register</span>
          </button>
        </div>
      </AppShell>
    );
  }

  const save = (patch) => {
    const next = updateReport(report.id, patch);
    setReport(next);
    return next;
  };

  const download = async () => {
    setDownloading(true);
    setError('');
    try {
      const blob = await downloadReportPdf(report, token);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `PackMetrix-${report.id}.pdf`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setDownloading(false);
    }
  };

  const resolveFinding = (ruleId, patch) => {
    save({
      results: (report.results || []).map((item) =>
        item.rule_id === ruleId ? { ...item, ...patch } : item
      ),
      violations: (report.violations || []).map((item) =>
        item.rule_id === ruleId ? { ...item, ...patch } : item
      ),
    });
  };

  const finalise = () => {
    const unresolved = (report.results || []).filter(
      (item) => item.outcome === 'REVIEW' && !item.resolvedOutcome
    ).length;
    save({
      workflowStatus: 'RESOLVED',
      finalDecision: unresolved
        ? 'Resolved with additional evidence required'
        : 'Officer review completed',
      reviewedBy: { id: user?.id, name: user?.name, email: user?.email },
      reviewedAt: new Date().toLocaleString('en-IN'),
    });
  };

  const archive = () => {
    if (!window.confirm(`Archive report ${report.id}? It can be restored from the report register.`)) return;
    archiveReport(report.id);
    navigate('/reports');
  };

  const bulkBatch = report.batchId ? getBulkBatch(report.batchId) : null;
  const failures = (report.results || []).filter((item) => item.outcome === 'FAIL');
  const reviews = (report.results || []).filter((item) => item.outcome === 'REVIEW');
  const score = report.verificationScore ?? report.score ?? 0;

  const isResolved = report.workflowStatus === 'RESOLVED';
  const statusLabel = isResolved
    ? 'OFFICER VERIFIED / RESOLVED'
    : report.status === 'REVIEW'
    ? 'REVIEW REQUIRED'
    : report.status === 'NON_COMPLIANT'
    ? 'NON-COMPLIANT'
    : 'COMPLIANT';

  const evidenceImages =
    report.captureMode === 'live'
      ? []
      : report.evidenceImages?.length
      ? report.evidenceImages
      : report.thumbnail
      ? [{ imageId: 'IMG-001', fileName: 'Submitted package evidence', thumbnail: report.thumbnail }]
      : [];

  const productName = report.details?.productName || report.declarations?.commodity_name || 'Unnamed Package Commodity';
  const productId = report.details?.productId || report.declarations?.barcode || report.id;
  const mrp = report.declarations?.mrp;
  const netQty = report.declarations?.net_quantity;
  const mfgDate = report.declarations?.manufacture_pack_import_date;
  const expDate = report.declarations?.best_before_or_use_by;
  const batchNo = report.declarations?.batch_number;
  const manufacturer = report.declarations?.responsible_party_name;
  const address = report.declarations?.responsible_party_address;
  const fssai = report.declarations?.fssai_license;
  const origin = report.declarations?.country_of_origin;
  const phone = report.declarations?.consumer_phone;
  const email = report.declarations?.consumer_email;
  const barcode = report.declarations?.barcode;
  const unitPrice = report.declarations?.unit_sale_price;

  // Header Actions
  const action = (
    <div className="flex items-center gap-2">
      <button
        onClick={download}
        disabled={downloading}
        className="inline-flex items-center gap-2 bg-[#0B1224] hover:bg-slate-900 active:scale-[0.98] text-white px-4 py-2 rounded-xl text-xs font-bold border border-slate-800 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50"
      >
        <Download className="w-3.5 h-3.5 text-sky-400" />
        <span>{downloading ? 'Generating PDF…' : 'Download Official PDF'}</span>
      </button>
    </div>
  );

  return (
    <AppShell title={`Dossier ${report.id}`} eyebrow="OFFICIAL REGULATORY DOSSIER" actions={action}>
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <button
          onClick={() =>
            navigate(
              bulkBatch
                ? `/inspections/new?mode=bulk&batch=${encodeURIComponent(report.batchId)}`
                : '/reports'
            )
          }
          className="group inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#0284C7] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>{bulkBatch ? 'Back to Bulk Batch' : 'All Inspection Reports'}</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#8C8275] bg-[#F4EFE6] px-2.5 py-1 rounded-lg border border-[#E8E2D5]">
            ID: {report.id}
          </span>
          <span className="text-xs font-mono text-slate-500 bg-white px-2 py-1 rounded-lg border border-[#E8E2D5]">
            {report.date || 'Today'}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-800 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* =========================================================================
          TIER 1: ASSESSMENT HEADER (EXECUTIVE DARK NAVY FEATURE PANEL)
          ========================================================================= */}
      <section className="bg-[#0B1224] text-white rounded-3xl p-6 sm:p-8 border border-slate-800 relative overflow-hidden shadow-xl mb-7">
        {/* Subtle Architectural Dot Grid Pattern */}
        <div className="absolute inset-0 bg-dot-grid opacity-15 pointer-events-none" />

        {/* Technical Corner Brackets */}
        <div className="absolute top-3 left-3 text-[10px] font-mono text-slate-600 select-none pointer-events-none">[ LM-2011 // AUDIT ]</div>
        <div className="absolute top-3 right-3 text-[10px] font-mono text-slate-600 select-none pointer-events-none">CONFIDENTIAL EVIDENCE</div>

        <div className="relative z-10">
          {/* Section Eyebrow */}
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`w-2 h-2 rounded-full ${
                isResolved
                  ? 'bg-sky-400'
                  : report.status === 'COMPLIANT'
                  ? 'bg-emerald-400'
                  : report.status === 'NON_COMPLIANT'
                  ? 'bg-rose-400'
                  : 'bg-amber-400 animate-pulse'
              }`}
            />
            <p className="text-xs font-mono font-bold tracking-[0.2em] text-sky-400 uppercase">
              Inspection Assessment Outcome
            </p>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
            {/* Status Headline & Product Name */}
            <div>
              <div className="flex flex-wrap items-baseline gap-3">
                <h1
                  className={`text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight ${
                    isResolved
                      ? 'text-sky-300'
                      : report.status === 'COMPLIANT'
                      ? 'text-emerald-400'
                      : report.status === 'NON_COMPLIANT'
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  {statusLabel}
                </h1>
                <span className="text-xs font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                  RULE VALIDATION
                </span>
              </div>
              <p className="text-base text-slate-300 font-medium mt-2">
                Commodity:{' '}
                <span className="text-white font-bold">{productName}</span>
              </p>
            </div>

            {/* 3 Metric Score Pills (Passed, Violations, Need Review) */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-center min-w-[95px]">
                <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                  {report.counts?.PASS ?? 0}
                </p>
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300 mt-0.5">
                  Passed
                </p>
              </div>

              <div className="rounded-2xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-center min-w-[95px]">
                <p className="text-2xl sm:text-3xl font-black text-rose-400 font-mono">
                  {report.counts?.FAIL ?? 0}
                </p>
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-300 mt-0.5">
                  Violations
                </p>
              </div>

              <div className="rounded-2xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-center min-w-[95px]">
                <p className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                  {report.counts?.REVIEW ?? 0}
                </p>
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300 mt-0.5">
                  Need Review
                </p>
              </div>
            </div>
          </div>

          {/* Verification Progress Bar & Assessment Summary */}
          <div className="pt-6 grid grid-cols-1 lg:grid-cols-[1.2fr_.8fr] gap-6 items-center">
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-2">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                  Statutory Evidence Verification Progress
                </span>
                <span className="font-bold text-sky-300 text-sm">{score}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-all duration-1000 ease-out"
                  style={{ width: animatedProgress ? `${Math.max(4, Math.min(100, score))}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                {report.overallReason ||
                  (failures.length
                    ? 'Package evidence establishes one or more statutory declaration deficiencies under Legal Metrology Rules.'
                    : reviews.length
                    ? 'Preliminary OCR checks completed; specific declaration angles require authorized officer verification.'
                    : 'All 13 mandatory packaged commodity declarations are fully evidenced and compliant.')}
              </p>
            </div>

            <div className="lg:border-l lg:border-slate-800 lg:pl-6 text-xs text-slate-400 space-y-1.5 font-mono">
              <p className="text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                Legal Metrology Framework
              </p>
              <p>• Standards of Weights and Measures (Packaged Commodities) Rules, 2011</p>
              <p>• Department of Consumer Affairs Regulatory Verification System</p>
              <p className="text-slate-500">
                Mode: {report.captureMode === 'live' ? 'Live Real-Time OCR Scan' : 'High-Resolution Multi-Surface Capture'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          MAIN WORKSPACE LAYOUT (TIER 2 to TIER 5)
          ========================================================================= */}
      <div className="space-y-7">
        {/* =======================================================================
            TIER 2: KEY PRODUCT & STATUTORY DECLARATION DETAILS
            ======================================================================= */}
        <section className="bg-white border border-[#E8E2D5] rounded-3xl p-6 sm:p-8 shadow-[0_4px_24px_-4px_rgba(30,25,15,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#E8E2D5]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-[#0284C7] flex items-center justify-center shrink-0 border border-sky-200/60">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#0B1224] tracking-tight">
                  Product &amp; Declaration Details
                </h2>
                <p className="text-xs text-[#8C8275] mt-0.5">
                  Core statutory disclosures extracted from submitted package surfaces
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#8C8275] bg-[#F4EFE6] px-2.5 py-1 rounded-lg border border-[#E8E2D5]">
                13 Statutory Checks
              </span>
            </div>
          </div>

          {/* Large Hero Product Title Block */}
          <div className="mt-6 p-5 rounded-2xl bg-[#FAF8F5] border border-[#E8E2D5] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono font-bold tracking-wider text-[#8C8275] uppercase">
                COMMODITY BRAND &amp; IDENTITY
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-[#0B1224] tracking-tight mt-1">
                {productName}
              </h3>
              <p className="text-xs font-mono text-slate-500 mt-1">
                Product Identifier: <b className="text-slate-800">{productId}</b>
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-center">
              {barcode && (
                <span className="text-xs font-mono font-bold text-slate-800 bg-white px-3 py-1.5 rounded-xl border border-[#E8E2D5] shadow-2xs">
                  Barcode: {barcode}
                </span>
              )}
              {origin && (
                <span className="text-xs font-mono text-[#8C8275] bg-white px-3 py-1.5 rounded-xl border border-[#E8E2D5]">
                  Origin: <b>{origin}</b>
                </span>
              )}
            </div>
          </div>

          {/* High-Hierarchy Highlight Grid: MRP, Net Qty, Dates, Batch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
            {/* MRP Card */}
            <div className="p-4 rounded-2xl bg-white border border-[#E8E2D5] shadow-2xs hover:border-[#0284C7] transition-all">
              <div className="flex items-center justify-between text-xs text-[#8C8275] mb-2 font-mono">
                <span className="font-bold uppercase tracking-wider">Maximum Retail Price</span>
                <Coins className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#0B1224] tracking-tight">
                {mrp ? (mrp.startsWith('₹') ? mrp : `₹${mrp}`) : 'Not Detected'}
              </p>
              {unitPrice && (
                <p className="text-xs font-mono text-slate-500 mt-1">
                  Unit Sale: {unitPrice}
                </p>
              )}
              <div className="mt-2">
                <ConfidenceBadge field="mrp" evidence={report.fieldEvidence?.mrp} />
              </div>
            </div>

            {/* Net Quantity Card */}
            <div className="p-4 rounded-2xl bg-white border border-[#E8E2D5] shadow-2xs hover:border-[#0284C7] transition-all">
              <div className="flex items-center justify-between text-xs text-[#8C8275] mb-2 font-mono">
                <span className="font-bold uppercase tracking-wider">Net Quantity</span>
                <Scale className="w-3.5 h-3.5 text-sky-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#0B1224] tracking-tight">
                {netQty || 'Not Detected'}
              </p>
              <p className="text-xs font-mono text-slate-500 mt-1">
                Standard Metric Unit
              </p>
              <div className="mt-2">
                <ConfidenceBadge field="net_quantity" evidence={report.fieldEvidence?.net_quantity} />
              </div>
            </div>

            {/* Manufacture Date Card */}
            <div className="p-4 rounded-2xl bg-white border border-[#E8E2D5] shadow-2xs hover:border-[#0284C7] transition-all">
              <div className="flex items-center justify-between text-xs text-[#8C8275] mb-2 font-mono">
                <span className="font-bold uppercase tracking-wider">MFG / Pack Date</span>
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-[#0B1224] tracking-tight">
                {mfgDate || 'Not Detected'}
              </p>
              {expDate && (
                <p className="text-xs font-mono text-slate-600 mt-1">
                  Best Before: {expDate}
                </p>
              )}
              <div className="mt-2">
                <ConfidenceBadge field="manufacture_pack_import_date" evidence={report.fieldEvidence?.manufacture_pack_import_date} />
              </div>
            </div>

            {/* Batch / Lot Card */}
            <div className="p-4 rounded-2xl bg-white border border-[#E8E2D5] shadow-2xs hover:border-[#0284C7] transition-all">
              <div className="flex items-center justify-between text-xs text-[#8C8275] mb-2 font-mono">
                <span className="font-bold uppercase tracking-wider">Batch / Lot Number</span>
                <Layers className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-[#0B1224] tracking-tight font-mono">
                {batchNo || 'Not Detected'}
              </p>
              <p className="text-xs font-mono text-slate-500 mt-1">
                Traceability Code
              </p>
              <div className="mt-2">
                <ConfidenceBadge field="batch_number" evidence={report.fieldEvidence?.batch_number} />
              </div>
            </div>
          </div>

          {/* Structured Secondary Entities: Manufacturer, Consumer Care, Licensing */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
            {/* Manufacturer & Packer Box */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8E2D5]">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-700 mb-1.5">
                <Building2 className="w-4 h-4 text-[#0284C7]" />
                <span>Manufacturer / Packer</span>
              </div>
              <p className="text-sm font-bold text-[#0B1224] leading-snug">
                {manufacturer || 'Not detected on submitted surfaces'}
              </p>
              {address && (
                <p className="text-xs text-[#8C8275] mt-1.5 flex items-start gap-1 leading-relaxed">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{address}</span>
                </p>
              )}
              <div className="mt-2">
                <ConfidenceBadge field="responsible_party_name" evidence={report.fieldEvidence?.responsible_party_name} />
              </div>
            </div>

            {/* Consumer Care Helpline */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8E2D5]">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-700 mb-1.5">
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>Consumer Helpline</span>
              </div>
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-slate-800 font-mono">
                  Phone: {phone || 'Not detected'}
                </p>
                <p className="font-semibold text-slate-800 font-mono truncate">
                  Email: {email || 'Not detected'}
                </p>
              </div>
              <p className="text-[11px] text-[#8C8275] mt-2">
                Mandatory redressal contact under Rule 6(1)(n).
              </p>
            </div>

            {/* Statutory Licensing & Standards */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8E2D5]">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-700 mb-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span>Licensing &amp; Regulatory</span>
              </div>
              <div className="space-y-1 text-xs font-mono">
                <p className="text-slate-800 font-semibold">
                  FSSAI: {fssai || 'Not detected'}
                </p>
                <p className="text-slate-600">
                  Origin: {origin || 'Not detected'}
                </p>
              </div>
              <div className="mt-2">
                <ConfidenceBadge field="fssai_license" evidence={report.fieldEvidence?.fssai_license} />
              </div>
            </div>
          </div>
        </section>

        {/* =======================================================================
            TIER 3: SUBMITTED EVIDENCE (INSPECTION PHOTO VIEWER & LIGHTBOX)
            ======================================================================= */}
        <section className="bg-white border border-[#E8E2D5] rounded-3xl p-6 sm:p-8 shadow-[0_4px_24px_-4px_rgba(30,25,15,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#E8E2D5]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-[#0284C7] flex items-center justify-center shrink-0 border border-sky-200/60">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#0B1224] tracking-tight">
                  Submitted Evidence ({evidenceImages.length})
                </h2>
                <p className="text-xs text-[#8C8275] mt-0.5">
                  Package surface photographs retained as statutory audit chain-of-custody
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-500 bg-[#FAF8F5] px-2.5 py-1 rounded-lg border border-[#E8E2D5]">
              Status: {report.ocrStatus || 'Evaluated'}
            </span>
          </div>

          {evidenceImages.length > 0 ? (
            <div className="mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {evidenceImages.map((image, index) => (
                  <div
                    key={`${image.imageId || image.fileName}-${index}`}
                    onClick={() => setLightboxImage(image)}
                    className="group relative rounded-2xl border border-[#E8E2D5] bg-[#FAF8F5] overflow-hidden shadow-2xs hover:shadow-md hover:border-[#0284C7] transition-all duration-250 cursor-pointer"
                  >
                    {/* Technical Crosshairs */}
                    <div className="absolute top-2 left-2 text-[9px] font-mono text-[#8C8275]/40 select-none z-10 pointer-events-none">+</div>
                    <div className="absolute top-2 right-2 text-[9px] font-mono text-[#8C8275]/40 select-none z-10 pointer-events-none">+</div>

                    {/* Image Preview with Hover Zoom */}
                    <div className="relative h-48 w-full bg-slate-900/5 flex items-center justify-center overflow-hidden p-3">
                      <img
                        src={image.thumbnail}
                        alt={image.fileName || `Package evidence ${index + 1}`}
                        className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 text-xs font-bold text-slate-900 shadow-md">
                          <Maximize2 className="w-3.5 h-3.5 text-[#0284C7]" />
                          Inspect Full Evidence
                        </span>
                      </div>
                    </div>

                    {/* Image Metadata Caption */}
                    <div className="p-3 bg-white border-t border-[#E8E2D5]">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold text-[#0284C7]">
                          {image.imageId || `IMG-${String(index + 1).padStart(3, '0')}`}
                        </span>
                        <span className="text-[10px] font-mono text-[#8C8275] bg-[#F4EFE6] px-1.5 py-0.5 rounded border border-[#E8E2D5]">
                          Surface #{index + 1}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 truncate mt-1">
                        {image.fileName || `Package surface photo ${index + 1}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs font-mono text-[#8C8275]">
                ✓ All {evidenceImages.length} retained package photographs securely indexed into inspection dossier #{report.id}.
              </p>
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-slate-500 font-mono">
              No evidence photographs retained for this inspection mode (real-time stream).
            </div>
          )}
        </section>

        {/* =======================================================================
            TIER 4: EXTRACTED INFORMATION & TECHNICAL PANES
            ======================================================================= */}
        <section className="bg-white border border-[#E8E2D5] rounded-3xl p-6 sm:p-8 shadow-[0_4px_24px_-4px_rgba(30,25,15,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#E8E2D5]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-[#0284C7] flex items-center justify-center shrink-0 border border-sky-200/60">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#0B1224] tracking-tight">
                  Extracted Technical Transcripts &amp; Formulations
                </h2>
                <p className="text-xs text-[#8C8275] mt-0.5">
                  OCR line transcript, ingredient disclosures, and nutrition declarations
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* Complete OCR Transcript */}
            <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E8E2D5] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8E2D5] mb-3">
                <span className="text-xs font-mono font-bold text-slate-800 uppercase flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#0284C7]" />
                  OCR Text ({report.ocrLines?.length || 0} lines)
                </span>
                <span className="text-[10px] font-mono text-[#8C8275]">
                  Confidence %
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1 flex-1">
                {report.ocrLines?.length ? (
                  report.ocrLines.map((line, index) => (
                    <div
                      key={`${line.text}-${index}`}
                      className="grid grid-cols-[28px_1fr_auto] gap-2 text-xs border-b border-[#E8E2D5]/50 pb-1.5"
                    >
                      <span className="font-mono text-slate-400 text-[11px]">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="text-slate-800 break-words leading-relaxed font-sans">
                        {line.text}
                      </span>
                      <span className="font-mono text-emerald-700 font-bold text-[11px]">
                        {Math.round((line.confidence || 0) * 100)}%
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    No transcript retained.
                  </p>
                )}
              </div>
            </div>

            {/* Ingredients Disclosure */}
            <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E8E2D5] flex flex-col">
              <div className="pb-3 border-b border-[#E8E2D5] mb-3">
                <span className="text-xs font-mono font-bold text-slate-800 uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Ingredients Formulation
                </span>
              </div>
              <div className="flex-1 max-h-72 overflow-y-auto">
                <IngredientList value={report.declarations?.ingredients} />
              </div>
            </div>

            {/* Nutrition Information */}
            <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E8E2D5] flex flex-col">
              <div className="pb-3 border-b border-[#E8E2D5] mb-3">
                <span className="text-xs font-mono font-bold text-slate-800 uppercase flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-purple-600" />
                  Nutrition Declaration Table
                </span>
              </div>
              <div className="flex-1 max-h-72 overflow-y-auto">
                <NutritionTable value={report.declarations?.nutrition_information} />
              </div>
            </div>
          </div>
        </section>

        {/* =======================================================================
            TIER 5: OFFICER REVIEW & COMPLIANCE DECISIONS WORKFLOW
            ======================================================================= */}
        <section className="bg-white border border-[#E8E2D5] rounded-3xl p-6 sm:p-8 shadow-[0_4px_24px_-4px_rgba(30,25,15,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#E8E2D5]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#0B1224] tracking-tight">
                  Officer Review &amp; Compliance Workflow
                </h2>
                <p className="text-xs text-[#8C8275] mt-0.5">
                  Record official regulatory findings, examine deficiencies, and issue final determinations
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            {/* Confirmed Violations Section */}
            {failures.length > 0 && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/30 p-5 sm:p-6">
                <div className="flex items-center gap-2.5 pb-4 border-b border-rose-200 text-rose-900">
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm">
                      Confirmed Violations Detected ({failures.length})
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Sufficient package evidence establishes that mandatory declarations are missing, obscured, or invalid.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {failures.map((item) => (
                    <Finding
                      key={item.rule_id}
                      item={item}
                      tone="violation"
                      onChange={(patch) => resolveFinding(item.rule_id, patch)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Needs Officer Review Section */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/20 p-5 sm:p-6">
              <div className="flex items-center gap-2.5 pb-4 border-b border-amber-200 text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm">
                    Items Requiring Officer Evaluation ({reviews.length})
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Declarations where package evidence is incomplete, conflicting, or requires official human assessment.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {reviews.length ? (
                  reviews.map((item) => (
                    <Finding
                      key={item.rule_id}
                      item={item}
                      tone="review"
                      onChange={(patch) => resolveFinding(item.rule_id, patch)}
                    />
                  ))
                ) : (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 py-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>No outstanding review findings remaining.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Final Officer Disposition Card */}
            <div className="rounded-2xl border border-[#E8E2D5] bg-[#FAF8F5] p-5 sm:p-6">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-700 mb-3">
                <Save className="w-4 h-4 text-[#0284C7]" />
                <span>Final Officer Resolution &amp; Summary Remarks</span>
              </div>

              <textarea
                value={report.officerRemarks || ''}
                onChange={(e) => save({ officerRemarks: e.target.value })}
                rows="3"
                className="w-full bg-white border border-[#E8E2D5] rounded-xl p-3.5 text-sm text-slate-900 focus:outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-sky-100 transition-all placeholder-[#8C8275]"
                placeholder="Record the official statutory basis for the final disposition of this packaged commodity…"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-[#E8E2D5]">
                <div className="flex flex-wrap items-center gap-2">
                  {report.workflowStatus !== 'RESOLVED' ? (
                    <button
                      onClick={finalise}
                      className="inline-flex items-center gap-2 bg-[#0284C7] hover:bg-sky-700 text-white rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Mark Resolved &amp; Close Review</span>
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        save({
                          workflowStatus: 'OPEN',
                          finalDecision: 'Reopened for officer review',
                        })
                      }
                      className="inline-flex items-center gap-2 border border-[#E8E2D5] bg-white text-slate-700 hover:bg-[#F4EFE6] rounded-xl px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Reopen for Review</span>
                    </button>
                  )}

                  <button
                    onClick={archive}
                    className="inline-flex items-center gap-2 border border-rose-200 text-rose-700 bg-white hover:bg-rose-50 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Archive className="w-4 h-4" />
                    <span>Archive Dossier</span>
                  </button>
                </div>

                {report.reviewedAt && (
                  <p className="text-xs font-mono text-[#8C8275]">
                    Resolved by <b>{report.reviewedBy?.name || 'Authorized Inspector'}</b> on {report.reviewedAt}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* =========================================================================
          LIGHTBOX MODAL FOR FULL EVIDENCE INSPECTION
          ========================================================================= */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-fadeIn"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header */}
            <div className="p-4 bg-[#0B1224] text-white flex items-center justify-between">
              <div>
                <p className="text-xs font-mono font-bold text-sky-400">
                  {lightboxImage.imageId || 'EVIDENCE PREVIEW'}
                </p>
                <p className="text-sm font-semibold truncate">
                  {lightboxImage.fileName || 'Package surface photograph'}
                </p>
              </div>
              <button
                onClick={() => setLightboxImage(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Full Evidence Image */}
            <div className="p-4 flex-1 overflow-auto bg-slate-950 flex items-center justify-center max-h-[75vh]">
              <img
                src={lightboxImage.thumbnail}
                alt="Package Evidence"
                className="max-h-full max-w-full object-contain rounded-lg shadow-md"
              />
            </div>

            {/* Lightbox Footer */}
            <div className="p-3 bg-[#FAF8F5] border-t border-[#E8E2D5] text-xs font-mono text-[#8C8275] flex items-center justify-between">
              <span>Legal Metrology Statutory Evidence Record</span>
              <span>Dossier #{report.id}</span>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// Single Finding Card Component with Actions & Remarks
function Finding({ item, onChange, tone }) {
  const violation = tone === 'violation';

  return (
    <div
      className={`rounded-2xl border-l-4 p-5 transition-all ${
        violation
          ? 'border border-rose-200 border-l-rose-600 bg-white shadow-2xs'
          : 'border border-amber-200 border-l-amber-500 bg-white shadow-2xs'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {violation ? (
            <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-mono font-black tracking-wide ${
                  item.resolvedOutcome
                    ? 'bg-sky-100 text-sky-800 border border-sky-200'
                    : violation
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                {item.resolvedOutcome ? 'OFFICER VERIFIED' : violation ? 'DEFICIENCY FLAGGED' : 'REQUIRES REVIEW'}
              </span>
              <span className="text-xs font-mono text-[#8C8275]">{item.rule_id}</span>
            </div>
            <h4 className="font-bold text-sm text-[#0B1224] mt-1.5">{item.requirement}</h4>
          </div>
        </div>
      </div>

      {item.evidence?.length > 0 && (
        <div className="rounded-xl bg-[#FAF8F5] border border-[#E8E2D5] px-3.5 py-2.5 text-xs text-slate-800 mt-3 font-mono">
          <b className="text-slate-900">Extracted Evidence:</b> {item.evidence.map((e) => e.value).join('; ')}
        </div>
      )}

      <p className="text-xs text-slate-700 mt-2.5 leading-relaxed">
        <b className="text-[#0B1224]">Reason:</b> {item.reason}
      </p>

      {item.rule_reference && (
        <p className="text-[11px] font-mono text-[#8C8275] mt-1">
          Statutory Citation: {item.rule_reference}
        </p>
      )}

      {/* Decision Outcomes Toggle Buttons */}
      <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-[#E8E2D5]/70">
        {OUTCOMES.map(([value, label]) => (
          <button
            key={value}
            onClick={() => onChange({ resolvedOutcome: value })}
            className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              item.resolvedOutcome === value
                ? 'bg-[#0B1224] border-[#0B1224] text-white shadow-xs'
                : 'bg-white border-[#E8E2D5] text-slate-700 hover:bg-[#FAF8F5]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Officer Remark Input */}
      <div className="mt-3">
        <textarea
          value={item.officerRemark || ''}
          onChange={(e) => onChange({ officerRemark: e.target.value })}
          placeholder="Add official officer audit remarks on this item…"
          rows="2"
          className="w-full rounded-xl border border-[#E8E2D5] p-2.5 text-xs text-slate-900 bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#0284C7] focus:ring-1 focus:ring-sky-100 transition-all"
        />
        <div className="flex items-center justify-between mt-1">
          <button
            onClick={() => onChange({ decisionSavedAt: new Date().toLocaleString('en-IN') })}
            className="text-xs font-bold text-[#0284C7] hover:text-[#0369A1] transition-colors"
          >
            Save Decision
          </button>
          {item.decisionSavedAt && (
            <span className="text-[11px] font-mono text-emerald-700">
              ✓ Saved {item.decisionSavedAt}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// AI Confidence Badge
function ConfidenceBadge({ evidence }) {
  if (!evidence) {
    return (
      <span className="inline-block text-[10px] font-mono text-[#8C8275] bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#E8E2D5]">
        Manual Review Required
      </span>
    );
  }

  const conf = Math.round((evidence.confidence || 0) * 100);
  const isHigh = conf >= 75;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
        isHigh
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : 'bg-amber-50 text-amber-800 border-amber-200'
      }`}
    >
      <span>{isHigh ? 'AI Extracted' : 'Review Needed'}</span>
      <span>{conf}%</span>
    </span>
  );
}

// Structured Ingredient List
function IngredientList({ value }) {
  if (!value) return <p className="text-xs text-slate-500 font-mono py-2">Not detected</p>;
  const items = value.split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, index) => (
        <span
          key={`${item}-${index}`}
          className="rounded-lg border border-[#E8E2D5] bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// Parse Nutrition Information
function parseNutrition(value) {
  if (!value) return [];
  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const percent = entry.match(/\d+(?:[.,]\d+)?\s*%/g)?.join(', ') || '—';
      const withoutPercent = entry.replace(/\d+(?:[.,]\d+)?\s*%/g, '').trim();
      const amountStart = withoutPercent.search(/\d/);
      if (amountStart < 0) return { nutrient: withoutPercent, amount: '—', percent };
      return {
        nutrient: withoutPercent.slice(0, amountStart).trim().replace(/[:.-]+$/, '') || 'Value',
        amount: withoutPercent.slice(amountStart).trim(),
        percent,
      };
    });
}

// Structured Nutrition Facts Table
function NutritionTable({ value }) {
  const rows = parseNutrition(value);
  if (!rows.length) return <p className="text-xs text-slate-500 font-mono py-2">Not detected</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E8E2D5] bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-[#FAF8F5] text-[#8C8275] font-mono text-[10px] uppercase border-b border-[#E8E2D5]">
          <tr>
            <th className="px-3 py-2 font-bold">Nutrient</th>
            <th className="px-3 py-2 font-bold">Declared</th>
            <th className="px-3 py-2 text-right font-bold">% RDA</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E8E2D5]/70">
          {rows.map((row, index) => (
            <tr key={`${row.nutrient}-${index}`} className="hover:bg-[#FAF8F5]">
              <td className="px-3 py-2 font-semibold text-slate-800">{row.nutrient}</td>
              <td className="px-3 py-2 text-slate-600 font-mono">{row.amount}</td>
              <td className="px-3 py-2 text-right font-mono text-slate-700 font-bold">{row.percent}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
