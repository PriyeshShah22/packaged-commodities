import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileWarning,
  History,
  Package,
  PackageSearch,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/auth-context';
import { getReports } from '../lib/reportStore';

export default function ProductsRoute() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [open, setOpen] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Group real reports into cataloged commodities
  const products = useMemo(() => {
    const groups = new Map();
    getReports()
      .filter((r) => !r.archived)
      .forEach((report) => {
        const key =
          report.declarations?.barcode ||
          report.details?.productId ||
          report.details?.productName ||
          report.id;
        const group = groups.get(key) || [];
        group.push(report);
        groups.set(key, group);
      });

    return [...groups.entries()].map(([key, history]) => {
      // Sort history chronologically newest first
      const sortedHistory = [...history].sort(
        (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
      );
      return {
        key,
        history: sortedHistory,
        latest: sortedHistory[0],
      };
    });
  }, []);

  // Filter products by search term and status
  const filteredProducts = useMemo(() => {
    return products.filter(({ key, latest }) => {
      const name = (latest.details?.productName || latest.declarations?.commodity_name || '').toLowerCase();
      const id = (latest.declarations?.barcode || latest.details?.productId || key).toLowerCase();
      const mfr = (latest.declarations?.responsible_party_name || '').toLowerCase();
      const q = searchQuery.toLowerCase();

      const matchesSearch = !q || name.includes(q) || id.includes(q) || mfr.includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'COMPLIANT') {
        return latest.status === 'COMPLIANT' || latest.workflowStatus === 'RESOLVED';
      }
      if (statusFilter === 'REVIEW') {
        return latest.status === 'REVIEW' && latest.workflowStatus !== 'RESOLVED';
      }
      if (statusFilter === 'VIOLATION') {
        return latest.status === 'NON_COMPLIANT';
      }
      return true;
    });
  }, [products, searchQuery, statusFilter]);

  // Overall Registry Metrics
  const stats = useMemo(() => {
    const total = products.length;
    const compliant = products.filter(
      (p) => p.latest.status === 'COMPLIANT' || p.latest.workflowStatus === 'RESOLVED'
    ).length;
    const review = products.filter(
      (p) => p.latest.status === 'REVIEW' && p.latest.workflowStatus !== 'RESOLVED'
    ).length;
    const violation = products.filter(
      (p) => p.latest.status === 'NON_COMPLIANT'
    ).length;
    return { total, compliant, review, violation };
  }, [products]);

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
    <AppShell title="Product Register" eyebrow="CATALOG & REGISTRY" actions={actionButton}>
      {/* 1. Header & Summary Section */}
      <section className="pb-6 border-b border-[#E8E2D5] mb-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0284C7] mb-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0284C7] animate-pulse" />
              <span>Cataloged Commodities</span>
              <span className="text-[#8C8275]">•</span>
              <span className="text-slate-700 font-semibold">Statutory Product Registry</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B1224]">
              Product Inspection Registry
            </h1>
            <p className="text-sm text-[#475569] mt-1">
              Centralized record of verified packaged goods, manufacturer disclosures, and historical audits.
            </p>
          </div>

          {/* Quick Metrics Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-medium px-3 py-1 rounded-xl bg-white border border-[#E8E2D5] text-slate-800 shadow-2xs">
              <b>{stats.total}</b> Commodities
            </span>
            <span className="text-xs font-mono font-medium px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-2xs">
              <b>{stats.compliant}</b> Compliant
            </span>
            {stats.review > 0 && (
              <span className="text-xs font-mono font-medium px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 shadow-2xs">
                <b>{stats.review}</b> In Review
              </span>
            )}
            {stats.violation > 0 && (
              <span className="text-xs font-mono font-medium px-3 py-1 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 shadow-2xs">
                <b>{stats.violation}</b> Issues
              </span>
            )}
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#8C8275] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product name, barcode, or manufacturer…"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E8E2D5] rounded-xl text-sm text-slate-900 placeholder-[#8C8275] focus:outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-sky-100 transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 hover:text-slate-700"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-[#F4EFE6] border border-[#E8E2D5] rounded-xl self-start sm:self-auto overflow-x-auto">
            {[
              { id: 'ALL', label: 'All Products' },
              { id: 'COMPLIANT', label: 'Compliant' },
              { id: 'REVIEW', label: 'Needs Review' },
              { id: 'VIOLATION', label: 'Violations' },
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
        </div>
      </section>

      {/* 2. Product Registry List */}
      <section className="space-y-4">
        {filteredProducts.map(({ key, latest, history }) => {
          const isOpen = open === key;
          const productName =
            latest.details?.productName ||
            latest.declarations?.commodity_name ||
            'Unnamed Commodity';
          const barcode =
            latest.declarations?.barcode ||
            latest.details?.productId ||
            'No Barcode Detected';
          const manufacturer =
            latest.declarations?.responsible_party_name ||
            'Manufacturer / Packer Not Disclosed';
          const netQty = latest.declarations?.net_quantity;
          const mrp = latest.declarations?.mrp;
          const score = latest.verificationScore ?? latest.score ?? 0;

          // Status Visual Style
          const isVerified = latest.workflowStatus === 'RESOLVED';
          const isCompliant = latest.status === 'COMPLIANT' || isVerified;
          const isViolation = latest.status === 'NON_COMPLIANT';

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
            <div
              key={key}
              className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-[0_2px_16px_-4px_rgba(30,25,15,0.03)] ${
                isOpen
                  ? 'border-[#0284C7] ring-1 ring-[#0284C7]/20 shadow-md'
                  : 'border-[#E8E2D5] hover:border-[#D6CEBE] hover:shadow-sm'
              }`}
            >
              {/* Product Header Row */}
              <div
                onClick={() => setOpen(isOpen ? '' : key)}
                className="w-full text-left p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 cursor-pointer hover:bg-[#FAF8F5]/60 transition-colors"
              >
                {/* Left: Product Name & Identity */}
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-[#FAF8F5] border border-[#E8E2D5] text-[#0284C7] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    <Package className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="text-base sm:text-lg font-bold text-[#0B1224] tracking-tight truncate">
                        {productName}
                      </h2>
                      {mrp && (
                        <span className="text-xs font-mono font-bold text-slate-800 bg-[#F4EFE6] px-2 py-0.5 rounded border border-[#E8E2D5]">
                          {mrp.startsWith('₹') ? mrp : `₹${mrp}`}
                        </span>
                      )}
                      {netQty && (
                        <span className="text-xs font-mono text-[#8C8275] bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#E8E2D5]">
                          {netQty}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#8C8275]">
                      <span className="font-mono bg-[#F4EFE6] px-2 py-0.5 rounded border border-[#E8E2D5]/80 text-slate-700">
                        {barcode}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5 font-medium text-slate-600 truncate max-w-sm">
                        <Building2 className="w-3.5 h-3.5 text-[#8C8275] shrink-0" />
                        <span className="truncate">{manufacturer}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Status, Score, Date & Expand Trigger */}
                <div className="flex items-center justify-between lg:justify-end gap-5 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-[#E8E2D5]">
                  {/* Score & Progress */}
                  <div className="text-right hidden sm:block">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-[#8C8275] font-medium">Compliance:</span>
                      <span className="font-mono font-bold text-sm text-[#0B1224]">{score}%</span>
                    </div>
                    <div className="w-24 h-1.5 rounded-full bg-[#F4EFE6] overflow-hidden mt-1 ml-auto">
                      <div
                        className={`h-full rounded-full ${
                          score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>{statusBadge}</div>

                  {/* History Counter & Expand Toggle */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-[#8C8275] hidden xl:inline">
                      {history.length} {history.length === 1 ? 'audit' : 'audits'}
                    </span>
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border border-[#E8E2D5] bg-[#FAF8F5] text-slate-500 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 bg-sky-50 text-[#0284C7] border-sky-200' : ''
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Expandable Inspection History Drawer */}
              {isOpen && (
                <div className="border-t border-[#E8E2D5] bg-[#FAF8F5] p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3 mb-3.5">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <History className="w-4 h-4 text-[#0284C7]" />
                      Statutory Audit Trail ({history.length})
                    </h3>
                    <span className="text-xs text-[#8C8275]">
                      Chronological regulatory inspections for this commodity
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {history.map((report, idx) => {
                      const repScore = report.verificationScore ?? report.score ?? 0;
                      return (
                        <div
                          key={report.id}
                          className="bg-white rounded-xl border border-[#E8E2D5] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-sky-300 hover:shadow-2xs transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-lg bg-[#FAF8F5] border border-[#E8E2D5] text-slate-600 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                              #{idx + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold text-[#0B1224]">
                                  {report.id}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500 bg-[#F4EFE6] px-1.5 py-0.5 rounded border border-[#E8E2D5]">
                                  {report.captureMode === 'live' ? 'LIVE OCR' : 'PACKAGE UPLOAD'}
                                </span>
                              </div>
                              <p className="text-xs text-[#8C8275] flex items-center gap-1 mt-1 font-mono">
                                <Clock className="w-3 h-3" />
                                {report.date || 'Today'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                            <div className="text-right">
                              <span className="text-xs font-mono font-bold text-slate-700">
                                Score: {repScore}%
                              </span>
                              <p className="text-[10px] font-mono text-[#8C8275]">
                                {report.status === 'COMPLIANT'
                                  ? 'Verified compliant'
                                  : report.status === 'NON_COMPLIANT'
                                  ? 'Violations recorded'
                                  : 'Under review'}
                              </p>
                            </div>

                            <button
                              onClick={() => navigate(`/reports/${report.id}`)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#0B1224] text-white hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
                            >
                              <span>View Dossier</span>
                              <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Empty State */}
        {!filteredProducts.length && (
          <div className="bg-white border border-[#E8E2D5] rounded-3xl p-12 sm:p-16 text-center max-w-lg mx-auto shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-[#FAF8F5] border border-[#E8E2D5] text-[#8C8275] flex items-center justify-center mx-auto mb-4 shadow-inner">
              <PackageSearch className="w-7 h-7 text-[#0284C7]" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#0B1224]">
              {searchQuery || statusFilter !== 'ALL'
                ? 'No matching catalog commodities'
                : 'No products cataloged yet'}
            </h3>
            <p className="text-xs sm:text-sm text-[#8C8275] mt-1.5 leading-relaxed">
              {searchQuery || statusFilter !== 'ALL'
                ? 'Try adjusting your search terms or filter criteria to find the commodity.'
                : 'Commodities are automatically cataloged when statutory inspections are conducted and package declarations are verified.'}
            </p>
            {searchQuery || statusFilter !== 'ALL' ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                }}
                className="mt-5 px-4 py-2 rounded-xl text-xs font-bold bg-[#F4EFE6] border border-[#E8E2D5] text-slate-800 hover:bg-[#EAE4D7] transition-colors"
              >
                Reset Filters
              </button>
            ) : (
              <button
                onClick={() => navigate('/inspections/new')}
                className="mt-5 inline-flex items-center gap-2 bg-[#0B1224] hover:bg-slate-900 active:scale-[0.98] text-white px-4.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 shadow-xs border border-slate-800"
              >
                <Plus className="w-4 h-4 text-sky-400" />
                <span>Start First Inspection</span>
              </button>
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}

