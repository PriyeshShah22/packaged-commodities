import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Building2,
  CheckCircle2,
  FileCheck,
  FileSearch,
  FileWarning,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/auth-context';
import { deleteReport, getReports, restoreReport } from '../lib/reportStore';

export default function ReportsRoute() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const reports = getReports();
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [, refresh] = useState(0);

  // Filter reports
  const filtered = useMemo(() => {
    return reports.filter((r) => {
      const matchesArchive = Boolean(r.archived) === showArchived;
      if (!matchesArchive) return false;

      const q = query.toLowerCase();
      const name = (r.details?.productName || r.declarations?.commodity_name || '').toLowerCase();
      const id = (r.id || '').toLowerCase();
      const mfr = (r.declarations?.responsible_party_name || '').toLowerCase();
      const barcode = (r.declarations?.barcode || r.details?.productId || '').toLowerCase();

      const matchesQuery = !q || name.includes(q) || id.includes(q) || mfr.includes(q) || barcode.includes(q);
      if (!matchesQuery) return false;

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'COMPLIANT') return r.status === 'COMPLIANT' || r.workflowStatus === 'RESOLVED';
      if (statusFilter === 'REVIEW') return r.status === 'REVIEW' && r.workflowStatus !== 'RESOLVED';
      if (statusFilter === 'VIOLATION') return r.status === 'NON_COMPLIANT';

      return true;
    });
  }, [reports, showArchived, query, statusFilter]);

  // Overall Statistics for Quick Pills
  const counts = useMemo(() => {
    const activeReports = reports.filter((r) => !r.archived);
    return {
      total: activeReports.length,
      compliant: activeReports.filter((r) => r.status === 'COMPLIANT' || r.workflowStatus === 'RESOLVED').length,
      review: activeReports.filter((r) => r.status === 'REVIEW' && r.workflowStatus !== 'RESOLVED').length,
      violations: activeReports.filter((r) => r.status === 'NON_COMPLIANT').length,
      archived: reports.filter((r) => r.archived).length,
    };
  }, [reports]);

  const actionButton = hasRole('inspector', 'admin') ? (
    <button
      onClick={() => navigate('/inspections/new')}
      className="group inline-flex items-center gap-2 bg-[#0B1224] hover:bg-slate-900 active:scale-[0.98] text-white px-4.5 py-2.5 rounded-xl text-sm font-semibold border border-slate-800 hover:border-sky-500/40 shadow-xs hover:shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 cursor-pointer"
    >
      <Plus className="w-4 h-4 text-sky-400 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-90" />
      <span>New Inspection</span>
    </button>
  ) : null;

  return (
    <AppShell title="Inspection Reports" eyebrow="REGULATORY DOSSIERS" actions={actionButton}>
      {/* 1. Header & Quick Status Strip */}
      <section className="pb-6 border-b border-[#E8E2D5] mb-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0284C7] mb-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0284C7] animate-pulse" />
              <span>Inspection Register</span>
              <span className="text-[#8C8275]">•</span>
              <span className="text-slate-700 font-semibold">Statutory Compliance Audits</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B1224]">
              {showArchived ? 'Archived Regulatory Dossiers' : 'Statutory Inspection Reports'}
            </h1>
            <p className="text-sm text-[#475569] mt-1">
              Official verification logs, declaration evidentiary audit trails, and legal metrology determinations.
            </p>
          </div>

          {/* Quick Metrics Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-medium px-3 py-1 rounded-xl bg-white border border-[#E8E2D5] text-slate-800 shadow-2xs">
              <b>{counts.total}</b> Active Reports
            </span>
            <span className="text-xs font-mono font-medium px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-2xs">
              <b>{counts.compliant}</b> Compliant
            </span>
            {counts.review > 0 && (
              <span className="text-xs font-mono font-medium px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 shadow-2xs">
                <b>{counts.review}</b> In Review
              </span>
            )}
            {counts.violations > 0 && (
              <span className="text-xs font-mono font-medium px-3 py-1 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 shadow-2xs">
                <b>{counts.violations}</b> Non-compliant
              </span>
            )}
          </div>
        </div>

        {/* Search, Status Tabs & Archive Toggle */}
        <div className="mt-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#8C8275] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by product name, report ID, or manufacturer…"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E8E2D5] rounded-xl text-sm text-slate-900 placeholder-[#8C8275] focus:outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-sky-100 transition-all shadow-2xs"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 hover:text-slate-700"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-[#F4EFE6] border border-[#E8E2D5] rounded-xl overflow-x-auto">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'COMPLIANT', label: 'Compliant' },
                { id: 'REVIEW', label: 'In Review' },
                { id: 'VIOLATION', label: 'Issues' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setStatusFilter(id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    statusFilter === id
                      ? 'bg-white text-[#0B1224] shadow-xs font-bold'
                      : 'text-[#8C8275] hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Active / Archive Toggle */}
            {hasRole('inspector', 'admin') && <button
              onClick={() => setShowArchived(!showArchived)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                showArchived
                  ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-xs'
                  : 'bg-white border-[#E8E2D5] text-slate-700 hover:bg-[#F4EFE6]'
              }`}
            >
              {showArchived ? <FileCheck className="w-3.5 h-3.5 text-amber-600" /> : <Archive className="w-3.5 h-3.5 text-slate-500" />}
              <span>{showArchived ? 'View Active Reports' : `Archived (${counts.archived})`}</span>
            </button>}
          </div>
        </div>
      </section>

      {/* 2. Reports Table Container */}
      <section className="bg-white border border-[#E8E2D5] rounded-3xl overflow-hidden shadow-[0_4px_24px_-4px_rgba(30,25,15,0.04)]">
        {!filtered.length ? (
          <div className="p-16 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-[#FAF8F5] border border-[#E8E2D5] text-[#8C8275] flex items-center justify-center mx-auto mb-4 shadow-inner">
              <FileSearch className="w-7 h-7 text-[#0284C7]" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#0B1224]">
              {query || statusFilter !== 'ALL' ? 'No matching reports found' : showArchived ? 'No archived dossiers' : 'No inspection reports on record'}
            </h3>
            <p className="text-xs sm:text-sm text-[#8C8275] mt-1.5 leading-relaxed">
              {query || statusFilter !== 'ALL'
                ? 'Try refining your search keyword or clearing active status filters.'
                : showArchived
                ? 'Reports you archive from the detail view will be preserved safely in this section.'
                : 'Complete an inspection using live camera capture or multi-angle photos to generate your first audit dossier.'}
            </p>
            {query || statusFilter !== 'ALL' ? (
              <button
                onClick={() => {
                  setQuery('');
                  setStatusFilter('ALL');
                }}
                className="mt-5 px-4 py-2 rounded-xl text-xs font-bold bg-[#F4EFE6] border border-[#E8E2D5] text-slate-800 hover:bg-[#EAE4D7] transition-colors"
              >
                Reset Search &amp; Filters
              </button>
            ) : !showArchived ? (
              <button
                onClick={() => navigate('/inspections/new')}
                className="mt-5 inline-flex items-center gap-2 bg-[#0B1224] hover:bg-slate-900 active:scale-[0.98] text-white px-4.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 shadow-xs border border-slate-800"
              >
                <Plus className="w-4 h-4 text-sky-400" />
                <span>Start New Inspection</span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF8F5] text-[11px] font-mono font-bold text-[#8C8275] uppercase tracking-wider border-b border-[#E8E2D5]">
                <tr>
                  <th className="py-3.5 px-6">Product &amp; Report Identifier</th>
                  <th className="py-3.5 px-6">Manufacturer / Disclosed Party</th>
                  <th className="py-3.5 px-6">Audit Date &amp; Mode</th>
                  <th className="py-3.5 px-6">Compliance Score</th>
                  <th className="py-3.5 px-6">Statutory Status</th>
                  <th className="py-3.5 px-6 text-right">Dossier Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E2D5]/70">
                {filtered.map((r) => {
                  const score = r.verificationScore ?? r.score ?? 0;
                  const productName = r.details?.productName || r.declarations?.commodity_name || 'Unnamed Package Product';
                  const manufacturer = r.declarations?.responsible_party_name || 'Manufacturer not detected';

                  const isVerified = r.workflowStatus === 'RESOLVED';
                  const isCompliant = r.status === 'COMPLIANT' || isVerified;
                  const isViolation = r.status === 'NON_COMPLIANT';

                  const statusBadge = isVerified ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-sky-50 text-[#0284C7] border border-sky-200">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      OFFICER VERIFIED
                    </span>
                  ) : isCompliant ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      COMPLIANT
                    </span>
                  ) : isViolation ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      NON-COMPLIANT
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      <FileWarning className="w-3.5 h-3.5" />
                      NEEDS REVIEW
                    </span>
                  );

                  return (
                    <tr
                      key={r.id}
                      onClick={() => !showArchived && navigate(`/reports/${r.id}`)}
                      className={`group hover:bg-[#FAF8F5]/80 transition-all duration-200 border-l-2 border-transparent ${
                        !showArchived ? 'cursor-pointer hover:border-l-[#0284C7]' : ''
                      }`}
                    >
                      {/* Product & Identifier */}
                      <td className="py-4 px-6">
                        <p className="font-bold text-[#0B1224] group-hover:text-[#0284C7] transition-colors leading-snug">
                          {productName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-mono font-medium text-[#8C8275] bg-[#F4EFE6] px-1.5 py-0.5 rounded border border-[#E8E2D5]">
                            {r.id}
                          </span>
                          {r.details?.productId && (
                            <span className="text-[11px] font-mono text-slate-500">
                              {r.details.productId}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Manufacturer */}
                      <td className="py-4 px-6 max-w-xs">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Building2 className="w-3.5 h-3.5 text-[#8C8275] shrink-0" />
                          <span className="text-xs font-medium truncate">{manufacturer}</span>
                        </div>
                        {r.declarations?.country_of_origin && (
                          <p className="text-[10px] font-mono text-[#8C8275] mt-1">
                            Origin: {r.declarations.country_of_origin}
                          </p>
                        )}
                      </td>

                      {/* Date & Mode */}
                      <td className="py-4 px-6">
                        <p className="text-xs font-mono text-slate-700">{r.date || 'Today'}</p>
                        <span className="inline-block mt-1 text-[10px] font-mono text-slate-500 bg-[#FAF8F5] px-1.5 py-0.2 rounded border border-[#E8E2D5]">
                          {r.captureMode === 'live' ? 'LIVE OCR' : 'PACKAGE UPLOAD'}
                        </span>
                      </td>

                      {/* Compliance Score */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-[#0B1224]">{score}%</span>
                          <div className="w-16 h-1.5 rounded-full bg-[#F4EFE6] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        </div>
                        {r.verification?.total > 0 && (
                          <p className="text-[10px] font-mono text-[#8C8275] mt-0.5">
                            {r.verification.verified}/{r.verification.total} items verified
                          </p>
                        )}
                      </td>

                      {/* Assessment */}
                      <td className="py-4 px-6">{statusBadge}</td>

                      {/* Action */}
                      <td className="py-4 px-6 text-right">
                        {showArchived ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                restoreReport(r.id);
                                refresh((x) => x + 1);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#0284C7] bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors cursor-pointer"
                            >
                              <ArchiveRestore className="w-3.5 h-3.5" />
                              <span>Restore</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!window.confirm(`Permanently delete report ${r.id}? This cannot be undone.`)) return;
                                deleteReport(r.id);
                                refresh((x) => x + 1);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0284C7] group-hover:text-[#0369A1] transition-all">
                            <span>Open Dossier</span>
                            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}

