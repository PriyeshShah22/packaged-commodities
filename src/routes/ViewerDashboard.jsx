import React, { useMemo, useState } from 'react';
import { ArrowRight, BadgeCheck, GitCompareArrows, PackageSearch, Scale, Search, ShieldCheck, Sparkles, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { getReports } from '../lib/reportStore';

function publicStatus(report) {
  if (report.workflowStatus === 'RESOLVED') return { label: 'Officer verified', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  if (report.status === 'COMPLIANT') return { label: 'Checks passed', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  if (report.status === 'NON_COMPLIANT') return { label: 'Potential issue', tone: 'bg-rose-50 text-rose-800 border-rose-200' };
  return { label: 'Review pending', tone: 'bg-amber-50 text-amber-800 border-amber-200' };
}

function ProductCard({ report, selected, onCompare, onOpen }) {
  const status = publicStatus(report);
  return <article className="rounded-3xl border border-[#E8E2D5] bg-white p-5 hover:border-sky-300 hover:shadow-md transition-all">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-mono text-[#8C8275]">{report.details?.productId || report.id}</p><h3 className="mt-1 font-black text-lg text-[#0B1224] truncate">{report.details?.productName || 'Unnamed package'}</h3><p className="text-xs text-slate-500 mt-1">{report.declarations?.brand_name || report.declarations?.responsible_party_name || 'Brand not verified'}</p></div><span className={`shrink-0 text-[9px] font-bold border rounded-full px-2 py-1 ${status.tone}`}>{status.label}</span></div>
    <div className="grid grid-cols-2 gap-2 mt-4 text-xs"><div className="rounded-xl bg-[#FAF8F5] p-3"><span className="text-[#8C8275]">Net quantity</span><b className="block mt-1 text-slate-800">{report.declarations?.net_quantity || '—'}</b></div><div className="rounded-xl bg-[#FAF8F5] p-3"><span className="text-[#8C8275]">MRP</span><b className="block mt-1 text-slate-800">{report.declarations?.mrp || '—'}</b></div></div>
    <div className="flex gap-2 mt-4"><button onClick={onOpen} className="flex-1 rounded-xl bg-[#0B1224] text-white py-2 text-xs font-bold cursor-pointer">View compliance</button><button onClick={onCompare} className={`rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer ${selected ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-[#E8E2D5] text-slate-600'}`}><GitCompareArrows className="w-4 h-4" /></button></div>
  </article>;
}

export default function ViewerDashboard() {
  const navigate = useNavigate();
  const reports = useMemo(() => getReports().filter((report) => !report.archived), []);
  const [query, setQuery] = useState('');
  const [compareIds, setCompareIds] = useState([]);
  const products = useMemo(() => {
    const seen = new Set();
    return reports.filter((report) => {
      const key = report.details?.productId || report.details?.productName || report.id;
      if (seen.has(key)) return false;
      seen.add(key);
      const haystack = `${report.details?.productName} ${report.details?.productId} ${report.declarations?.brand_name} ${report.declarations?.responsible_party_name}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    });
  }, [reports, query]);
  const comparison = compareIds.map((id) => reports.find((report) => report.id === id)).filter(Boolean);
  const verified = reports.filter((report) => report.workflowStatus === 'RESOLVED' || report.status === 'COMPLIANT').length;

  const toggleCompare = (id) => setCompareIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current.slice(-1), id]);

  return <AppShell title="Public Compliance Explorer" eyebrow="VIEWER ACCESS">
    <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#07111F] via-[#0B2942] to-[#075985] p-7 sm:p-10 text-white">
      <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />
      <div className="relative max-w-3xl"><span className="inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-white/10 px-3 py-1 text-[10px] font-bold tracking-[.18em]"><Sparkles className="w-3.5 h-3.5" /> KNOW YOUR PACKAGE</span><h1 className="mt-4 text-3xl sm:text-5xl font-black leading-tight">Understand what your product label really says.</h1><p className="mt-3 text-sm sm:text-base text-sky-100">Search inspected products, view declaration checks and compare key label information before you buy.</p>
        <div className="relative mt-6 max-w-2xl"><Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, brand, manufacturer or barcode" className="w-full rounded-2xl bg-white py-3.5 pl-12 pr-4 text-sm text-slate-900 outline-none ring-4 ring-white/10 focus:ring-cyan-300/30" /></div>
      </div>
    </section>

    <section className="grid sm:grid-cols-3 gap-4 mt-5">
      {[['Products available', products.length, PackageSearch, 'text-sky-700 bg-sky-50'], ['Verified records', verified, BadgeCheck, 'text-emerald-700 bg-emerald-50'], ['Rules checked', 13, ShieldCheck, 'text-purple-700 bg-purple-50']].map(([label, value, Icon, tone]) => <div key={label} className="rounded-3xl border border-[#E8E2D5] bg-white p-5 flex items-center gap-4"><div className={`w-12 h-12 rounded-2xl grid place-items-center ${tone}`}><Icon className="w-6 h-6" /></div><div><p className="text-2xl font-black text-[#0B1224]">{value}</p><p className="text-xs text-[#8C8275]">{label}</p></div></div>)}
    </section>

    {comparison.length > 0 && <section className="mt-5 rounded-3xl border border-sky-200 bg-sky-50/50 p-5"><div className="flex justify-between items-center"><h2 className="font-black text-[#0B1224] flex items-center gap-2"><GitCompareArrows className="w-5 h-5 text-sky-600" /> Product comparison</h2><button onClick={() => setCompareIds([])} className="text-xs font-bold text-sky-700 cursor-pointer">Clear</button></div><div className={`mt-4 grid ${comparison.length === 2 ? 'md:grid-cols-2' : ''} gap-3`}>{comparison.map((report) => <div key={report.id} className="rounded-2xl bg-white border border-sky-100 p-4"><h3 className="font-bold text-[#0B1224]">{report.details?.productName}</h3><dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-[#8C8275]">Brand</dt><dd className="font-bold mt-1">{report.declarations?.brand_name || '—'}</dd></div><div><dt className="text-[#8C8275]">Quantity</dt><dd className="font-bold mt-1">{report.declarations?.net_quantity || '—'}</dd></div><div><dt className="text-[#8C8275]">MRP</dt><dd className="font-bold mt-1">{report.declarations?.mrp || '—'}</dd></div><div><dt className="text-[#8C8275]">Status</dt><dd className="font-bold mt-1">{publicStatus(report).label}</dd></div></dl></div>)}</div>{comparison.length === 1 && <p className="mt-3 text-xs text-sky-800">Select one more product to compare side by side.</p>}</section>}

    <section className="mt-6"><div className="flex items-end justify-between gap-4"><div><h2 className="text-xl font-black text-[#0B1224]">Inspected product register</h2><p className="text-xs text-[#8C8275] mt-1">Independent declaration evidence and current review status</p></div><button onClick={() => navigate('/products')} className="hidden sm:flex items-center gap-1 text-xs font-bold text-sky-700 cursor-pointer">Full register <ArrowRight className="w-4 h-4" /></button></div>
      {products.length ? <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">{products.slice(0, 9).map((report) => <ProductCard key={report.id} report={report} selected={compareIds.includes(report.id)} onCompare={() => toggleCompare(report.id)} onOpen={() => navigate(`/reports/${report.id}`)} />)}</div> : <div className="mt-4 rounded-3xl border-2 border-dashed border-[#E8E2D5] bg-white p-14 text-center"><PackageSearch className="w-10 h-10 mx-auto text-slate-300" /><p className="mt-3 font-bold text-slate-700">No matching product found</p><p className="text-xs text-[#8C8275] mt-1">Try a brand, barcode or manufacturer name.</p></div>}
    </section>

    <section className="grid md:grid-cols-3 gap-4 mt-6">{[[Tag, 'Check the MRP', 'The retail price should clearly state that all taxes are included.'], [Scale, 'Check net quantity', 'Look for a clear metric quantity such as g, kg, ml or L.'], [ShieldCheck, 'Check traceability', 'Manufacturer, consumer-care and licence details help identify accountability.']].map(([Icon, title, copy]) => <div key={title} className="rounded-3xl bg-[#0B1224] p-5 text-white"><Icon className="w-5 h-5 text-sky-300" /><h3 className="mt-3 font-bold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-slate-300">{copy}</p></div>)}</section>
  </AppShell>;
}
