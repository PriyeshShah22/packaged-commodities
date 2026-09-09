import React, { useMemo } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck,
  FileClock, ShieldCheck, UserCheck, Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { getReports } from '../lib/reportStore';

const statusTone = {
  COMPLIANT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  NON_COMPLIANT: 'bg-rose-50 text-rose-700 border-rose-200',
  REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
};

function Metric({ label, value, detail, icon: Icon, tone }) {
  return (
    <div className="rounded-3xl border border-[#E8E2D5] bg-white p-5 shadow-[0_4px_24px_-4px_rgba(30,25,15,.05)]">
      <div className={`h-10 w-10 rounded-xl border grid place-items-center ${tone}`}><Icon className="h-5 w-5" /></div>
      <p className="mt-4 text-3xl font-black text-[#0B1224]">{value}</p>
      <p className="mt-1 text-sm font-bold text-slate-800">{label}</p>
      <p className="mt-0.5 text-xs text-[#8C8275]">{detail}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const reports = useMemo(() => getReports(), []);
  const active = reports.filter((report) => !report.archived);
  const inspectors = useMemo(() => {
    const grouped = new Map();
    active.forEach((report) => {
      const name = report.inspectorName || 'Unassigned inspector';
      const current = grouped.get(name) || { name, total: 0, open: 0, violations: 0, resolved: 0, latest: null };
      current.total += 1;
      current.open += report.workflowStatus === 'RESOLVED' ? 0 : 1;
      current.resolved += report.workflowStatus === 'RESOLVED' ? 1 : 0;
      current.violations += report.status === 'NON_COMPLIANT' ? 1 : 0;
      current.latest ||= report;
      grouped.set(name, current);
    });
    return [...grouped.values()].sort((a, b) => b.total - a.total);
  }, [active]);

  const changes = useMemo(() => reports.flatMap((report) => {
    const product = report.details?.productName || report.id;
    const actor = report.reviewedBy?.name || report.productNameCorrectedBy?.name || report.inspectorName || 'System';
    return [
      { when: report.date, actor: report.inspectorName || 'Unassigned', action: 'Created inspection', product, report },
      report.productNameCorrectedAt && { when: report.productNameCorrectedAt, actor, action: 'Corrected product identity', product, report },
      report.reviewedAt && { when: report.reviewedAt, actor, action: 'Completed officer review', product, report },
      report.archivedAt && { when: report.archivedAt, actor, action: 'Archived report', product, report },
    ].filter(Boolean);
  }).slice(0, 12), [reports]);

  const openReviews = active.filter((report) => report.status === 'REVIEW' && report.workflowStatus !== 'RESOLVED').length;
  const violations = active.filter((report) => report.status === 'NON_COMPLIANT').length;
  const resolved = active.filter((report) => report.workflowStatus === 'RESOLVED').length;

  return (
    <AppShell title="Administration & Oversight" eyebrow="ADMIN CONTROL">
      <section className="rounded-3xl bg-[#0B1224] text-white p-6 sm:p-8 overflow-hidden relative">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-[.2em] text-sky-300">WORKSPACE COMMAND CENTRE</span>
            <h1 className="mt-2 text-2xl sm:text-4xl font-black">Inspector operations at a glance</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">Track who inspected each product, pending officer work, final decisions, corrections and archived records.</p>
          </div>
          <button onClick={() => navigate('/reports')} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#0B1224] cursor-pointer">Open audit register <ArrowRight className="w-4 h-4" /></button>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
        <Metric label="Active inspectors" value={inspectors.length} detail="With reports in this workspace" icon={Users} tone="bg-sky-50 text-sky-700 border-sky-200" />
        <Metric label="Pending review" value={openReviews} detail="Awaiting officer decision" icon={FileClock} tone="bg-amber-50 text-amber-700 border-amber-200" />
        <Metric label="Potential violations" value={violations} detail="Require administrative attention" icon={AlertTriangle} tone="bg-rose-50 text-rose-700 border-rose-200" />
        <Metric label="Resolved records" value={resolved} detail="Officer-reviewed inspections" icon={CheckCircle2} tone="bg-emerald-50 text-emerald-700 border-emerald-200" />
      </section>

      <section className="grid xl:grid-cols-12 gap-5 mt-5">
        <div className="xl:col-span-7 rounded-3xl border border-[#E8E2D5] bg-white overflow-hidden">
          <div className="p-5 border-b border-[#E8E2D5] flex items-center justify-between">
            <div><h2 className="font-extrabold text-[#0B1224] flex items-center gap-2"><UserCheck className="w-5 h-5 text-sky-600" /> Inspector workload</h2><p className="text-xs text-[#8C8275] mt-1">Ownership, workload and unresolved findings</p></div>
            <span className="text-xs font-mono text-slate-500">{active.length} active reports</span>
          </div>
          {inspectors.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="bg-[#FAF8F5] text-[10px] uppercase font-mono text-[#8C8275]"><tr><th className="p-4">Inspector</th><th className="p-4">Inspections</th><th className="p-4">Open</th><th className="p-4">Issues</th><th className="p-4">Latest product</th></tr></thead>
            <tbody className="divide-y divide-[#E8E2D5]">{inspectors.map((item) => <tr key={item.name} className="hover:bg-sky-50/30">
              <td className="p-4 font-bold text-[#0B1224]">{item.name}</td><td className="p-4 font-mono">{item.total}</td><td className="p-4"><span className="font-bold text-amber-700">{item.open}</span></td><td className="p-4"><span className="font-bold text-rose-700">{item.violations}</span></td><td className="p-4 text-slate-600">{item.latest?.details?.productName || 'Unnamed product'}</td>
            </tr>)}</tbody>
          </table></div> : <p className="p-10 text-center text-sm text-slate-500">Inspector activity will appear after the first inspection.</p>}
        </div>

        <div className="xl:col-span-5 rounded-3xl border border-[#E8E2D5] bg-white overflow-hidden">
          <div className="p-5 border-b border-[#E8E2D5]"><h2 className="font-extrabold text-[#0B1224] flex items-center gap-2"><Activity className="w-5 h-5 text-purple-600" /> Change activity</h2><p className="text-xs text-[#8C8275] mt-1">Recent report and officer actions</p></div>
          <div className="max-h-[430px] overflow-y-auto divide-y divide-[#E8E2D5]">{changes.length ? changes.map((entry, index) => <button key={`${entry.report.id}-${entry.action}-${index}`} onClick={() => navigate(`/reports/${entry.report.id}`)} className="w-full p-4 text-left hover:bg-[#FAF8F5] cursor-pointer">
            <div className="flex items-start gap-3"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-sky-500 ring-4 ring-sky-50" /><div className="min-w-0"><p className="text-sm font-bold text-slate-800">{entry.action}</p><p className="text-xs text-slate-600 truncate">{entry.product}</p><p className="mt-1 text-[10px] font-mono text-[#8C8275]">{entry.actor} · {entry.when || 'Time unavailable'}</p></div></div>
          </button>) : <p className="p-10 text-center text-sm text-slate-500">No changes recorded yet.</p>}</div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-[#E8E2D5] bg-white p-5">
        <div className="flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-emerald-600" /><h2 className="font-extrabold text-[#0B1224]">Latest inspection decisions</h2></div>
        <div className="grid md:grid-cols-3 gap-3 mt-4">{active.slice(0, 6).map((report) => <button key={report.id} onClick={() => navigate(`/reports/${report.id}`)} className="rounded-2xl border border-[#E8E2D5] p-4 text-left hover:border-sky-300 cursor-pointer">
          <div className="flex justify-between gap-2"><p className="font-bold text-sm text-[#0B1224] truncate">{report.details?.productName || 'Unnamed product'}</p><span className={`text-[9px] font-bold border rounded-full px-2 py-1 ${statusTone[report.status] || statusTone.REVIEW}`}>{String(report.status || 'REVIEW').replace('_', ' ')}</span></div>
          <p className="mt-2 text-xs text-slate-600">{report.inspectorName || 'Unassigned inspector'}</p><p className="mt-1 text-[10px] font-mono text-[#8C8275]">{report.id}</p>
        </button>)}</div>
        {!active.length && <div className="py-8 text-center text-sm text-slate-500"><ShieldCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />No inspection decisions yet.</div>}
      </section>
    </AppShell>
  );
}
