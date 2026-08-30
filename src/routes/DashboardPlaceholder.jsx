import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, ClipboardCheck, FileWarning, Package, Plus, ScanLine, Server, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/auth-context';
import { getBackendHealth } from '../lib/api';
import { computeDashboard, getReports } from '../lib/reportStore';

function Donut({ compliant, nonCompliant, review }) {
  const total = compliant + nonCompliant + review || 1;
  const a = compliant / total * 100, b = nonCompliant / total * 100;
  return <div className="relative w-44 h-44 rounded-full" style={{ background: `conic-gradient(#10b981 0 ${a}%, #ef4444 ${a}% ${a + b}%, #f59e0b ${a + b}% 100%)` }}><div className="absolute inset-7 bg-white rounded-full grid place-items-center text-center"><div><p className="text-3xl font-black">{total === 1 && !compliant && !nonCompliant && !review ? 0 : total}</p><p className="text-[10px] text-slate-500 uppercase font-bold">reports</p></div></div></div>;
}

export default function DashboardPlaceholder() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const reports = useMemo(() => getReports(), []);
  const metrics = computeDashboard(reports);
  const [online, setOnline] = useState(null);
  useEffect(() => { getBackendHealth().then(setOnline); }, []);
  const categories = ['Identity', 'Quantity', 'Price', 'Consumer care'];
  const violationCounts = categories.map((label, index) => ({ label, count: reports.flatMap((r) => r.violations || []).filter((v) => (v.rule_id || '').toLowerCase().includes(['name','quantity','mrp','consumer'][index])).length }));
  const max = Math.max(1, ...violationCounts.map((item) => item.count));
  const action = hasRole('inspector', 'admin') ? <button onClick={() => navigate('/inspections/new')} className="inline-flex items-center gap-2 bg-slate-950 text-white px-4 py-2.5 rounded-xl text-sm font-bold"><Plus className="w-4 h-4" />New inspection</button> : null;
  return <AppShell title="Compliance dashboard" eyebrow="OVERVIEW" actions={action}>
    <section className="mb-7"><h2 className="text-3xl font-black tracking-tight">Good day, {user?.name?.split(' ')[0]}.</h2><p className="text-slate-500 mt-1">Operational view of products scanned in this browser workspace.</p></section>
    {online === false && <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Backend offline — start the API on port 8000 before scanning.</div>}
    <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {[
        ['Total products', metrics.products, Package, 'bg-sky-50 text-sky-700'],
        ['Compliant', metrics.compliant, CheckCircle2, 'bg-emerald-50 text-emerald-700'],
        ['Non-compliant', metrics.nonCompliant, ShieldAlert, 'bg-rose-50 text-rose-700'],
        ['Needs review', metrics.review, FileWarning, 'bg-amber-50 text-amber-700'],
      ].map(([label, value, Icon, color]) => <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"><div className="flex items-center justify-between"><div className={`w-10 h-10 rounded-xl grid place-items-center ${color}`}><Icon className="w-5 h-5" /></div><span className="text-[10px] uppercase font-bold text-slate-400">Live total</span></div><p className="text-3xl font-black mt-5">{value}</p><p className="text-sm text-slate-500">{label}</p></div>)}
    </section>
    <section className="grid xl:grid-cols-[1.1fr_.9fr] gap-5 mt-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="font-extrabold">Assessment distribution</h3><p className="text-xs text-slate-500 mt-1">Evidence-screening outcomes; review is not non-compliance</p></div><div className="text-right"><span className="text-3xl font-black text-sky-700">{metrics.rate}%</span><p className="text-[10px] uppercase font-bold text-slate-400">verification complete</p></div></div><div className="mt-6 flex flex-col sm:flex-row items-center gap-8"><Donut {...metrics} /><div className="space-y-3 flex-1 w-full">{[['Pass',metrics.compliant,'bg-emerald-500'],['Potential issue',metrics.nonCompliant,'bg-rose-500'],['Needs review',metrics.review,'bg-amber-500']].map(([label,value,color]) => <div key={label} className="flex items-center"><span className={`w-2.5 h-2.5 rounded-full ${color}`} /><span className="ml-3 text-sm text-slate-600">{label}</span><span className="ml-auto font-bold">{value}</span></div>)}</div></div></div>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"><h3 className="font-extrabold">Violation signals</h3><p className="text-xs text-slate-500 mt-1">Most frequent failed declaration groups</p><div className="mt-6 space-y-5">{violationCounts.map((item) => <div key={item.label}><div className="flex justify-between text-xs font-semibold"><span>{item.label}</span><span>{item.count}</span></div><div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-sky-600 rounded-full" style={{ width: `${item.count / max * 100}%` }} /></div></div>)}</div></div>
    </section>
    <section className="bg-white border border-slate-200 rounded-2xl mt-5 overflow-hidden shadow-sm"><div className="p-5 border-b border-slate-200 flex justify-between items-center"><div><h3 className="font-extrabold">Recent reports</h3><p className="text-xs text-slate-500 mt-1">Product, score, and current assessment</p></div><button onClick={() => navigate('/reports')} className="text-sm font-bold text-sky-700 flex items-center gap-1">View all <ArrowRight className="w-4 h-4" /></button></div>{!reports.length ? <div className="p-12 text-center"><ClipboardCheck className="w-8 h-8 mx-auto text-slate-400" /><p className="font-bold mt-3">No product reports yet</p><p className="text-sm text-slate-500 mt-1">Run a scan to populate dashboard analytics.</p></div> : <div className="divide-y divide-slate-100">{reports.slice(0, 6).map((r) => <button key={r.id} onClick={() => navigate(`/reports/${r.id}`)} className="w-full px-5 py-4 flex items-center text-left hover:bg-slate-50"><div><p className="font-bold text-sm">{r.details?.productName || 'Unnamed product'}</p><p className="text-xs font-mono text-slate-500 mt-1">{r.id} · {r.date}</p></div><span className="ml-auto text-sm font-black">{r.score}%</span><span className={`ml-4 text-[10px] font-bold px-2 py-1 rounded-full ${r.status === 'COMPLIANT' ? 'bg-emerald-50 text-emerald-700' : r.status === 'NON_COMPLIANT' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{r.status}</span></button>)}</div>}</section>
    <div className="mt-5 flex items-center gap-2 text-xs text-slate-500"><Server className="w-4 h-4" />{online ? 'Rule engine connected' : online === false ? 'Rule engine unavailable' : 'Checking rule engine'}<span>·</span><ScanLine className="w-4 h-4" />13 Legal Metrology checks</div>
  </AppShell>;
}
