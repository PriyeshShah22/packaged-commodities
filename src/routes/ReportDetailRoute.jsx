import React, { useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileText, Image as ImageIcon, ScanText } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/auth-context';
import { downloadReportPdf } from '../lib/api';
import { getReport } from '../lib/reportStore';

const DETAIL_FIELDS = [
  ['Manufacturer / packer / importer', 'responsible_party_name'], ['Responsible party address', 'responsible_party_address'],
  ['Common / generic commodity', 'commodity_name'], ['Net quantity', 'net_quantity'], ['Maximum retail price', 'mrp'],
  ['FSSAI licence', 'fssai_license'], ['Batch / lot', 'batch_number'], ['Manufacture / pack date', 'manufacture_pack_import_date'],
  ['Use by / best before', 'best_before_or_use_by'], ['Unit sale price', 'unit_sale_price'], ['Country of origin', 'country_of_origin'],
  ['Consumer mobile', 'consumer_phone'], ['Consumer email', 'consumer_email'], ['Barcode / GTIN', 'barcode'],
];

export default function ReportDetailRoute() {
  const { id } = useParams(); const navigate = useNavigate(); const { token } = useAuth(); const report = getReport(id); const [downloading, setDownloading] = useState(false); const [error, setError] = useState('');
  if (!report) return <AppShell title="Report not found"><div className="bg-white rounded-2xl border p-12 text-center"><p className="font-bold">This report is not available in this browser workspace.</p><button onClick={() => navigate('/reports')} className="mt-4 text-sky-700 font-bold">Back to reports</button></div></AppShell>;
  const download = async () => { setDownloading(true); setError(''); try { const blob = await downloadReportPdf(report, token); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `PackMetrix-${report.id}.pdf`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (failure) { setError(failure.message); } finally { setDownloading(false); } };
  const action = <button onClick={download} disabled={downloading} className="flex items-center gap-2 bg-slate-950 text-white rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50"><Download className="w-4 h-4" />{downloading ? 'Generating…' : 'Download PDF'}</button>;
  return <AppShell title={`Report ${report.id}`} eyebrow="AI COMPLIANCE ANALYSIS" actions={action}>
    <button onClick={() => navigate('/reports')} className="flex gap-2 items-center text-sm font-bold text-slate-600 mb-5"><ArrowLeft className="w-4 h-4" />All reports</button>
    {error && <div className="mb-5 bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-800">{error}</div>}
    <section className="grid xl:grid-cols-[.7fr_1.3fr] gap-5">
      <div className="space-y-5"><div className="bg-slate-950 text-white rounded-2xl p-6"><p className="text-xs font-bold text-sky-400 tracking-widest">COMPLIANCE SCORE</p><p className="text-6xl font-black mt-3">{report.score}<span className="text-2xl">%</span></p><p className={`inline-block mt-4 text-xs font-black rounded-full px-3 py-1.5 ${report.status === 'COMPLIANT' ? 'bg-emerald-500/20 text-emerald-300' : report.status === 'NON_COMPLIANT' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'}`}>{report.status}</p><p className="text-xs text-slate-400 leading-5 mt-5">AI-assisted result. REVIEW findings and enforcement decisions require authorized human determination.</p></div><Card title="Submitted evidence" icon={ImageIcon}>{report.thumbnail ? <img src={report.thumbnail} className="w-full rounded-xl max-h-72 object-contain bg-slate-100" alt="Submitted package evidence" /> : <p className="text-sm text-slate-500">Preview not retained.</p>}<p className="mt-4 text-xs text-slate-500">{report.imageCount} panel(s) · {report.ocrStatus}</p></Card></div>
      <div className="space-y-5"><Card title="Product and declaration details" icon={FileText}><Info label="Product ID" value={report.details?.productId || report.id} /><Info label="Product name" value={report.details?.productName} />{DETAIL_FIELDS.map(([label, field]) => <Info key={field} label={label} value={report.declarations?.[field]} />)}</Card><Card title={`Violation & review list (${report.violations?.length || 0})`} icon={AlertTriangle}>{report.violations?.length ? <div className="divide-y divide-slate-100">{report.violations.map((item) => <div key={item.rule_id} className="py-4 flex gap-3"><AlertTriangle className={`w-5 h-5 shrink-0 ${item.outcome === 'FAIL' ? 'text-rose-600' : 'text-amber-600'}`} /><div><p className="text-sm font-bold">{item.rule_reference || item.rule_id} · {item.outcome}</p><p className="text-sm text-slate-600 mt-1 leading-6">{item.reason}</p></div></div>)}</div> : <p className="flex gap-2 text-sm text-emerald-700"><CheckCircle2 className="w-5 h-5" />No failed or review findings.</p>}</Card><Card title={`Refined OCR transcript (${report.ocrLines?.length || 0} lines)`} icon={ScanText}><div className="max-h-80 overflow-auto rounded-xl bg-slate-950 text-slate-200 p-4 font-mono text-xs leading-6">{report.ocrLines?.length ? report.ocrLines.map((line, index) => <div key={`${line.text || line}-${index}`}><span className="text-slate-500 mr-3">{String(index + 1).padStart(2, '0')}</span>{line.text || line}{line.confidence != null && <span className="ml-2 text-emerald-400">{Math.round(line.confidence * 100)}%</span>}</div>) : 'No OCR transcript saved.'}</div></Card></div>
    </section>
  </AppShell>;
}

function Card({ title, icon: Icon, children }) { return <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"><h3 className="font-black flex items-center gap-2"><Icon className="w-4 h-4 text-sky-700" />{title}</h3><div className="mt-4">{children}</div></section>; }
function Info({ label, value }) { return <div className="grid sm:grid-cols-[210px_1fr] gap-1 py-2 border-b border-slate-100 last:border-0"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="text-sm font-semibold break-words">{value || 'Not reliably detected'}</p></div>; }
