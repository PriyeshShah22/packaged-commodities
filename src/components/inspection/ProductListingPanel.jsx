import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { downloadReportPdf, evaluateInspection, importProductListing } from '../../lib/api';
import { getBulkBatch, getBulkBatches, getReport, saveBulkBatch, saveReport, verificationState } from '../../lib/reportStore';

const TEMPLATE = 'Product Name,Brand,Category,Net Quantity,MRP,Mfg Date,Best Before,Manufacturer,Address,Common Name,Barcode,Batch Number,Consumer Phone,Consumer Email,Country of Origin,FSSAI,Unit Sale Price\r\n';
const card = 'bg-white border border-[#E8E2D5] rounded-3xl p-5 space-y-4';
const button = 'rounded-xl px-4 py-2 bg-[#0B1224] text-white text-sm font-bold disabled:opacity-40';
const label = (status) => ({ COMPLIANT: 'Checks passed', NON_COMPLIANT: 'Potential issue', REVIEW: 'Needs review' }[status] || 'Waiting');

function download(blob, filename) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ProductListingPanel({ token, user }) {
  const navigate = useNavigate(); const [params, setParams] = useSearchParams();
  const [batch, setBatch] = useState(() => { const item = getBulkBatch(params.get('batch')); return item?.mode === 'listing' ? item : null; });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const persist = (next) => { saveBulkBatch(next); if (mounted.current) { setBatch(next); setParams({ mode: 'listing', batch: next.id }, { replace: true }); } };
  const reports = (batch?.groups || []).map((group) => getReport(group.report?.id) || group.report).filter(Boolean);
  const counts = reports.reduce((result, report) => { const status = verificationState(report).status; result[status] = (result[status] || 0) + 1; return result; }, {});

  const upload = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    setBusy(true); setError('');
    try {
      const data = await importProductListing(file, token);
      persist({ id: `LIST-${crypto.randomUUID()}`, mode: 'listing', date: new Date().toISOString(), inspectorName: user?.name || '', fileName: file.name, ignoredColumns: data.ignoredColumns, groups: data.rows.map((row, index) => ({ ...row, id: `ROW-${index + 1}`, images: [], report: null })) });
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  };

  const analyze = async () => {
    setBusy(true); setError(''); let next = batch;
    try {
      // Rule evaluation is inexpensive; save after each row so interrupted runs resume.
      for (const group of batch.groups.filter((item) => !item.report)) {
        if (!mounted.current) break;
        const evidence = Object.values(group.fields);
        const response = await evaluateInspection({ context: { inspection_mode: 'physical_package', package_context: 'retail_prepackaged', product_category: group.category, origin: 'unknown', sales_context: 'retail', product_conditions: [], inspection_date: batch.date.slice(0, 10) }, evidence, field_coverage: Object.fromEntries(evidence.map((item) => [item.field, 'incomplete'])), image_quality: [] }, token);
        response.results.push(...(group.reviewFindings || []));
        response.counts.REVIEW += (group.reviewFindings || []).length;
        const status = response.counts.FAIL ? 'NON_COMPLIANT' : response.counts.REVIEW ? 'REVIEW' : 'COMPLIANT';
        const id = `PMX-${batch.id}-${group.id}`;
        const report = saveReport({ id, inspectionId: id, batchId: batch.id, date: new Date().toLocaleString('en-IN'), inspectorName: user?.name || '', inspectorId: user?.id, captureMode: 'listing', listingSource: { fileName: batch.fileName, rowNumber: group.rowNumber, importedAt: batch.date, raw: group.raw }, overallReason: 'Store-submitted inventory screening. Values have not been confirmed against physical package surfaces. Missing or ambiguous declarations require officer verification.', details: { productId: group.declarations.barcode || id, productName: group.name, category: group.category, origin: 'unknown', salesContext: 'retail' }, declarations: group.declarations, fieldEvidence: group.fields, status, aiStatus: status, workflowStatus: 'OPEN', counts: response.counts, results: response.results, violations: response.results.filter((item) => ['FAIL', 'REVIEW'].includes(item.outcome)), ruleSetAsOf: response.as_of, ruleSetVersion: [...new Set(response.results.map((item) => item.rule_version))].join(', '), imageCount: 0, evidenceImages: [], ocrLines: [], ocrStatus: 'Store inventory import' });
        next = { ...next, groups: next.groups.map((item) => item.id === group.id ? { ...item, report } : item) }; persist(next);
      }
    } catch (failure) { setError(`${failure.message} Completed rows are saved; use Analyze to resume.`); } finally { setBusy(false); }
  };

  const pdf = async () => {
    setBusy(true); setError('');
    try { download(await downloadReportPdf({ type: 'bulk', mode: 'listing', id: batch.id, date: batch.date, inspectorName: batch.inspectorName, reports }, token), `${batch.id}.pdf`); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  };

  return <div className="space-y-5">
    <section className={card}>
      <h2 className="text-lg font-bold">Product Listing — Store Inventory</h2>
      <p className="text-sm text-slate-600">Upload real store inventory as CSV UTF-8, up to 50 products / 2 MB. Include units with pack size. Use DD/MM/YYYY, YYYY-MM-DD or month-year dates. Preserve barcodes as text in Excel.</p>
      <p className="text-sm text-amber-800">This screens supplied information. Missing data does not establish a missing package declaration. Results and officer decisions are saved in this browser.</p>
      <div className="flex flex-wrap gap-3 items-center">
        <button className={button} disabled={busy} onClick={() => download(new Blob(['\ufeff', TEMPLATE], { type: 'text/csv;charset=utf-8' }), 'PackMetrix-inventory-template.csv')}>Download blank template</button>
        <label className="text-sm font-bold text-sky-700">Upload inventory CSV<input aria-label="Upload inventory CSV" className="block mt-1 text-xs" type="file" accept=".csv,text/csv" disabled={busy} onChange={upload} /></label>
      </div>
      <label className="block text-sm">Reopen saved listing<select aria-label="Saved product listings" className="ml-3 border rounded-lg p-2 max-w-full" disabled={busy} value={batch?.id || ''} onChange={(e) => { const saved = getBulkBatch(e.target.value); if (saved) { setBatch(saved); setParams({ mode: 'listing', batch: saved.id }); } }}><option value="">Select a listing</option>{getBulkBatches().filter((item) => item.mode === 'listing').map((item) => <option key={item.id} value={item.id}>{item.fileName} — {new Date(item.date).toLocaleString()}</option>)}</select></label>
    </section>
    {error && <p role="alert" className="p-4 rounded-xl bg-rose-50 text-rose-800">{error}</p>}
    {batch && <section className={card}>
      <h3 className="font-bold break-all">Listing {batch.id}</h3>
      <p className="text-sm">{batch.fileName} · {batch.groups.length} products · {reports.length} analyzed · {counts.COMPLIANT || 0} passed · {counts.NON_COMPLIANT || 0} potential issues · {counts.REVIEW || 0} need review</p>
      {!!batch.ignoredColumns?.length && <p className="text-sm text-amber-800">Unmapped columns retained in original rows: {batch.ignoredColumns.join(', ')}</p>}
      <div className="flex flex-wrap gap-3"><button className={button} disabled={busy || reports.length === batch.groups.length} onClick={analyze}>{busy ? 'Processing…' : 'Analyze Product Listing'}</button><button className={button} disabled={busy || !reports.length} onClick={pdf}>Download {reports.length < batch.groups.length ? 'partial ' : ''}summary PDF</button></div>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>{['Product / source row', 'Pack size / MRP', 'Dates', 'Manufacturer', 'Result / action'].map((heading) => <th className="p-3 border-b" key={heading}>{heading}</th>)}</tr></thead><tbody>{batch.groups.map((group) => {
        const report = getReport(group.report?.id) || group.report; const state = report && verificationState(report);
        return <tr key={group.id} className="align-top"><td className="p-3 border-b"><strong>{group.name}</strong><p>{group.category} · row {group.rowNumber}</p><p>{group.declarations.barcode || 'No barcode supplied'}</p>{group.warnings.map((warning) => <p key={warning} className="text-xs text-amber-800 mt-1">{warning}</p>)}</td><td className="p-3 border-b">{group.declarations.net_quantity || 'Not supplied'}<br />{group.declarations.mrp || 'Not supplied'}</td><td className="p-3 border-b">Packed: {group.declarations.manufacture_pack_import_date || 'Not supplied'}<br />Use by: {group.declarations.best_before_or_use_by || 'Not supplied'}</td><td className="p-3 border-b">{group.declarations.responsible_party_name || 'Not supplied'}</td><td className="p-3 border-b">{label(state?.status)}{report && <><p className="text-xs">Evidence verification: {state.verified}/{state.total} — {state.percentage}%</p><p className="text-xs mt-1">{report.results.find((item) => ['FAIL', 'REVIEW'].includes(item.resolvedOutcome || item.outcome))?.reason || 'Applicable checks passed.'}</p><button className="text-sky-700 font-bold mt-2" onClick={() => navigate(`/reports/${report.id}`)}>View report / officer review →</button></>}</td></tr>;
      })}</tbody></table></div>
    </section>}
  </div>;
}
