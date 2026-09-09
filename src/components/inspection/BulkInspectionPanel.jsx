import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Eye, Loader2, Pencil, Save, Upload, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { downloadReportPdf, evaluateInspection, groupBulkImages } from '../../lib/api';
import { getBulkBatch, saveBulkBatch, saveReport, updateReport } from '../../lib/reportStore';

const DECLARATIONS = ['brand_name','responsible_party_name','responsible_party_address','commodity_name','net_quantity','mrp','consumer_care','consumer_phone','consumer_email','country_of_origin','manufacture_pack_import_date','best_before_or_use_by','unit_sale_price','fssai_license','batch_number','barcode','ingredients','nutrition_information'];
const value = (fields, name) => fields?.[name]?.value || '';
const fieldsFor = (images) => images.reduce((result, image) => { Object.entries(image.fields || {}).forEach(([field, evidence]) => { if (!result[field] || evidence.confidence > result[field].confidence) result[field] = evidence; }); return result; }, {});
const regrouped = (group, images) => { const fields = fieldsFor(images); return { ...group, images, fields, name: value(fields, 'product_name') || value(fields, 'commodity_name') || 'Unidentified product', confirmed: false, report: null }; };
const persistableGroups = (groups) => groups.map((group) => ({ ...group, images: group.images.map(({ file: _file, lines: _lines, visual_hash: _visualHash, color_signature: _colorSignature, ...image }) => image) }));
async function thumbnailFor(file) { const url = URL.createObjectURL(file); const image = new Image(); image.src = url; await image.decode().catch(() => {}); const canvas = document.createElement('canvas'); const scale = Math.min(1, 280 / Math.max(1, image.width)); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url); return canvas.toDataURL('image/jpeg', .58); }

function BulkGroupCard({ group, groups, onConfirm, onMove, onCreate, onRename, onView }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.name);
  const saveName = () => {
    const name = draft.trim();
    if (!name) return;
    onRename(group.id, name);
    setEditing(false);
  };
  return (
    <section
      className={`bg-white border rounded-3xl p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(30,25,15,0.04)] transition-all ${
        group.confirmed ? 'border-[#E8E2D5]' : 'border-amber-300 bg-amber-50/10'
      }`}
    >
      <div className="flex justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                aria-label="Correct product name"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && saveName()}
                className="min-w-0 flex-1 border border-[#0284C7] bg-[#FAF8F5] rounded-xl px-3 py-1.5 text-sm font-bold outline-none"
                autoFocus
              />
              <button onClick={saveName} className="text-emerald-700 hover:text-emerald-800 p-1 cursor-pointer" aria-label="Save product name">
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setDraft(group.name);
                  setEditing(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label="Cancel product name edit"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="font-extrabold text-[#0B1224] text-base">{group.name}</h3>
              <button
                onClick={() => setEditing(true)}
                className="text-[11px] font-mono font-bold text-[#0284C7] hover:text-[#0369A1] flex items-center gap-1 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Name
              </button>
            </div>
          )}
          <p className="text-xs text-[#8C8275] mt-1 font-mono">
            {group.images.length} panel(s) · {group.reason}
          </p>
          {group.officerCorrectedName && (
            <p className="text-[11px] text-[#0284C7] font-mono mt-1">
              Officer-corrected from: {group.aiDetectedName}
            </p>
          )}
        </div>
        {group.report && (
          <span
            className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
              group.report.status === 'COMPLIANT'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : group.report.status === 'NON_COMPLIANT'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {group.report.status.replace('_', ' ')}
          </span>
        )}
      </div>

      <div className="flex gap-2.5 overflow-x-auto mt-4 pb-2">
        {group.images.map((image) => (
          <div key={image.image_id} className="w-28 shrink-0 bg-[#FAF8F5] border border-[#E8E2D5] rounded-xl p-1">
            <img src={image.thumbnail} className="w-full h-20 rounded-lg object-cover" alt={image.file_name} />
            <select
              aria-label={`Move ${image.file_name}`}
              className="w-full mt-1.5 text-[10px] font-mono border border-[#E8E2D5] rounded-lg bg-white p-1 text-slate-700 outline-none"
              value=""
              onChange={(event) =>
                event.target.value === 'new'
                  ? onCreate(group.id, image.image_id)
                  : onMove(group.id, image.image_id, event.target.value)
              }
            >
              <option value="">Move panel…</option>
              {groups
                .filter((item) => item.id !== group.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              <option value="new">+ New product group</option>
            </select>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#E8E2D5]">
        {!group.confirmed ? (
          <button
            onClick={() => onConfirm(group.id)}
            className="text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-amber-600" />
            Confirm this grouping
          </button>
        ) : (
          <span className="text-xs font-mono text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
          </span>
        )}
        {group.report && (
          <button
            onClick={() => onView(group.report.id)}
            className="text-xs font-bold text-[#0284C7] hover:text-[#0369A1] flex items-center gap-1 cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            View Dossier →
          </button>
        )}
      </div>
    </section>
  );
}

function reportFor(group, response, user, batchId) {
  const declarations = Object.fromEntries(DECLARATIONS.map((field) => [field, value(group.fields, field)]));
  const applicable = response.results.filter((item) => item.outcome !== 'NOT_APPLICABLE');
  const pass = response.counts.PASS || 0;
  const status = response.counts.FAIL ? 'NON_COMPLIANT' : response.counts.REVIEW ? 'REVIEW' : 'COMPLIANT';
  const id = `PMX-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Date.now().toString().slice(-5)}-${group.id}`;
  const verificationScore = applicable.length ? Math.round((pass / applicable.length) * 100) : 0;
  const failures = applicable.filter((item) => item.outcome === 'FAIL');
  const reviews = applicable.filter((item) => item.outcome === 'REVIEW');
  const overallReason = failures.length
    ? `${failures.length} check(s) failed with sufficient evidence; ${reviews.length} additional check(s) still need verification.`
    : reviews.length
    ? `No confirmed failure was found; ${reviews.length} check(s) need verification because evidence or applicability is incomplete.`
    : 'All applicable checks passed with sufficient evidence.';
  const evidenceImages = group.images.map((image) => ({
    imageId: image.image_id,
    fileName: image.file_name || image.image_id,
    thumbnail: image.thumbnail,
  }));
  const detectedOrigin = declarations.country_of_origin
    ? /\bindia\b/i.test(declarations.country_of_origin)
      ? 'domestic'
      : 'imported'
    : 'unknown';
  return {
    id,
    inspectionId: id,
    batchId,
    date: new Date().toLocaleString('en-IN'),
    inspectorName: user?.name || '',
    ruleSetAsOf: response.as_of,
    ruleSetVersion: [...new Set(response.results.map((item) => item.rule_version).filter(Boolean))].join(', '),
    aiDetectedProductName: group.aiDetectedName || group.name,
    officerCorrectedProductName: group.officerCorrectedName || null,
    productNameCorrectedBy: group.productNameCorrectedBy || null,
    productNameCorrectedAt: group.productNameCorrectedAt || null,
    status,
    overallReason,
    workflowStatus: 'OPEN',
    verificationScore,
    score: verificationScore,
    captureMode: 'bulk_upload',
    evidenceImages,
    details: {
      productId: declarations.barcode || id,
      productName: group.name || declarations.commodity_name || 'Unidentified product',
      category: 'unknown',
      origin: detectedOrigin,
      salesContext: 'retail',
    },
    declarations,
    fieldEvidence: group.fields,
    counts: response.counts,
    results: response.results,
    violations: [...failures, ...reviews],
    ocrLines: [],
    ocrStatus: 'Text evidence detected',
    imageCount: group.images.length,
    imageQuality: group.images.map((image) => ({ imageId: image.image_id, ...image.quality })),
    thumbnail: evidenceImages[0]?.thumbnail || '',
  };
}

export default function BulkInspectionPanel({ token, user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const restored = getBulkBatch(searchParams.get('batch'));
  const [batchId, setBatchId] = useState(restored?.id || '');
  const [groups, setGroups] = useState(restored?.groups || []);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({
    done: restored?.groups?.filter((group) => group.report).length || 0,
    total: 0,
  });
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (batchId && groups.length)
      saveBulkBatch({
        id: batchId,
        date: new Date().toLocaleString('en-IN'),
        inspectorName: user?.name || '',
        groups: persistableGroups(groups),
      });
  }, [batchId, groups, user?.name]);

  const selectFiles = async (event) => {
    const files = Array.from(event.target.files || []).slice(0, 60);
    event.target.value = '';
    if (!files.length) return;
    setLoading(true);
    setError('');
    try {
      const data = await groupBulkImages(files, token);
      const thumbnails = await Promise.all(files.map(thumbnailFor));
      const nextBatchId = `BULK-${Date.now()}`;
      setBatchId(nextBatchId);
      setSearchParams({ mode: 'bulk', batch: nextBatchId }, { replace: true });
      setGroups(
        data.groups.map((group) => ({
          ...group,
          aiDetectedName: group.name,
          confirmed: !group.needs_confirmation,
          report: null,
          images: group.images.map((image) => ({
            ...image,
            file: files[image.index],
            thumbnail: thumbnails[image.index],
          })),
        }))
      );
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  };

  const moveImage = (sourceId, imageId, targetId) =>
    setGroups((current) => {
      const source = current.find((group) => group.id === sourceId);
      const image = source?.images.find((item) => item.image_id === imageId);
      if (!image || sourceId === targetId) return current;
      return current
        .map((group) =>
          group.id === sourceId
            ? regrouped(
                group,
                group.images.filter((item) => item.image_id !== imageId)
              )
            : group.id === targetId
            ? regrouped(group, [...group.images, image])
            : group
        )
        .filter((group) => group.images.length);
    });

  const createGroup = (sourceId, imageId) =>
    setGroups((current) => {
      const source = current.find((group) => group.id === sourceId);
      const image = source?.images.find((item) => item.image_id === imageId);
      if (!image || source.images.length === 1) return current;
      return [
        ...current.map((group) =>
          group.id === sourceId
            ? regrouped(
                group,
                group.images.filter((item) => item.image_id !== imageId)
              )
            : group
        ),
        {
          ...regrouped(source, [image]),
          id: `GROUP-${Date.now()}`,
          confidence: 0.5,
          reason: 'Created by inspector',
        },
      ];
    });

  const renameGroup = (groupId, productName) =>
    setGroups((current) =>
      current.map((group) => {
        if (group.id !== groupId) return group;
        const aiDetectedName = group.aiDetectedName || group.name;
        const report = group.report
          ? updateReport(group.report.id, (stored) => ({
              ...stored,
              aiDetectedProductName: stored.aiDetectedProductName || stored.details?.productName || aiDetectedName,
              officerCorrectedProductName: productName,
              productNameCorrectedBy: { id: user?.id, name: user?.name, email: user?.email },
              productNameCorrectedAt: new Date().toISOString(),
              details: { ...stored.details, productName },
            }))
          : null;
        return {
          ...group,
          name: productName,
          aiDetectedName,
          officerCorrectedName: productName,
          productNameCorrectedBy: { id: user?.id, name: user?.name, email: user?.email },
          productNameCorrectedAt: new Date().toISOString(),
          report: report || group.report,
        };
      })
    );

  const analyzeAll = async () => {
    const pending = groups.filter((group) => group.confirmed && !group.report);
    if (!pending.length || groups.some((group) => !group.confirmed)) return;
    setAnalyzing(true);
    setError('');
    setProgress({ done: 0, total: pending.length });
    try {
      const queue = [...pending];
      const reports = [];
      const worker = async () => {
        while (queue.length) {
          const group = queue.shift();
          const evidence = DECLARATIONS.map((field) => group.fields?.[field])
            .filter((item) => item?.value)
            .map((item) => ({
              field: item.field,
              value: item.value,
              confidence: item.confidence,
              source_type: 'ocr',
              image_id: item.image_id,
              bbox: item.bbox || null,
            }));
          const response = await evaluateInspection(
            {
              context: {
                inspection_mode: 'physical_package',
                package_context: 'retail_prepackaged',
                product_category: 'unknown',
                origin: 'unknown',
                sales_context: 'retail',
                product_conditions: [],
                inspection_date: new Date().toISOString().slice(0, 10),
              },
              evidence,
              field_coverage: Object.fromEntries(DECLARATIONS.map((field) => [field, 'incomplete'])),
              image_quality: group.images.map((image) => ({
                image_id: image.image_id,
                status: image.quality?.resolution_sufficient ? 'sufficient' : 'insufficient',
              })),
            },
            token
          );
          const report = saveReport(reportFor(group, response, user, batchId));
          reports.push([group.id, report]);
          setProgress((current) => ({ ...current, done: current.done + 1 }));
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, pending.length) }, worker));
      setGroups((current) =>
        current.map((group) => ({
          ...group,
          report: reports.find(([id]) => id === group.id)?.[1] || group.report,
        }))
      );
    } catch (caught) {
      setError(caught.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const reports = groups.map((group) => group.report).filter(Boolean);
  const ordered = [...groups].sort(
    (a, b) =>
      ({ NON_COMPLIANT: 0, REVIEW: 1, COMPLIANT: 2 }[a.report?.status] ?? 3) -
      ({ NON_COMPLIANT: 0, REVIEW: 1, COMPLIANT: 2 }[b.report?.status] ?? 3)
  );
  const counts = {
    clear: reports.filter((item) => item.status === 'COMPLIANT').length,
    issue: reports.filter((item) => item.status === 'NON_COMPLIANT').length,
    review: reports.filter((item) => item.status === 'REVIEW').length,
  };

  const download = async () => {
    setDownloading(true);
    try {
      const blob = await downloadReportPdf(
        {
          id: reports[0]?.batchId || `BULK-${Date.now()}`,
          date: new Date().toLocaleString('en-IN'),
          inspectorName: user?.name || '',
          reports,
        },
        token
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `PackMetrix-bulk-summary-${Date.now()}.pdf`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-[#E8E2D5] rounded-3xl p-6 sm:p-8 shadow-[0_4px_24px_-4px_rgba(30,25,15,0.04)]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold tracking-widest text-[#0284C7] bg-sky-50 border border-sky-200/60 px-2.5 py-0.5 rounded-full uppercase">
            Bulk Batch Intake
          </span>
        </div>
        <h2 className="text-xl font-extrabold text-[#0B1224] mt-2">Bulk Package Photographs</h2>
        <p className="text-xs sm:text-sm text-[#8C8275] mt-1">
          Upload up to 60 mixed package views. Strong identity evidence is clustered automatically; ambiguous groups require officer confirmation.
        </p>

        <label
          className={`mt-6 min-h-40 border-2 border-dashed rounded-3xl grid place-items-center text-center transition-all ${
            loading
              ? 'opacity-60 pointer-events-none bg-[#F4EFE6] border-[#D8D0C0]'
              : 'cursor-pointer border-[#D8D0C0] hover:border-[#0284C7] bg-[#FAF8F5] hover:bg-sky-50/20'
          }`}
        >
          <div className="p-8">
            {loading ? (
              <>
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#0284C7]" />
                <b className="text-sm font-bold text-[#0B1224] block mt-3">
                  Optical OCR and automatic package clustering in progress…
                </b>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 mx-auto text-[#0284C7]" />
                <b className="text-sm font-bold text-[#0B1224] block mt-3">
                  Select Multiple Package Images
                </b>
                <p className="text-xs text-[#8C8275] mt-1 font-mono">
                  Front, back, side, and label views from multiple physical commodities
                </p>
              </>
            )}
          </div>
          <input type="file" accept="image/*" multiple className="hidden" onChange={selectFiles} />
        </label>
      </section>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4.5 text-sm text-rose-800 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {groups.length > 0 && (
        <>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white border border-[#E8E2D5] rounded-3xl p-5 sm:p-6 shadow-2xs">
            <div>
              <b className="text-base font-extrabold text-[#0B1224]">
                {groups.length} distinct products detected
              </b>
              <p className="text-xs text-[#8C8275] mt-0.5 font-mono">
                {groups.filter((group) => !group.confirmed).length} awaiting confirmation · {progress.done} evaluated ·{' '}
                {Math.max(0, progress.total - progress.done)} in queue
              </p>
            </div>
            <button
              onClick={analyzeAll}
              disabled={analyzing || groups.some((group) => !group.confirmed)}
              className="bg-[#0B1224] hover:bg-[#131F37] disabled:opacity-40 text-white px-6 py-3 rounded-xl text-xs sm:text-sm font-bold shadow-xs hover-lift transition-all cursor-pointer shrink-0"
            >
              {analyzing ? `${progress.done}/${progress.total} Evaluated…` : 'Analyze All Confirmed Products'}
            </button>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {ordered.map((group) => (
              <BulkGroupCard
                key={group.id}
                group={group}
                groups={groups}
                onMove={moveImage}
                onCreate={createGroup}
                onRename={renameGroup}
                onConfirm={(groupId) =>
                  setGroups((current) =>
                    current.map((item) => (item.id === groupId ? { ...item, confirmed: true } : item))
                  )
                }
                onView={(reportId) => navigate(`/reports/${reportId}`)}
              />
            ))}
          </div>
        </>
      )}

      {reports.length > 0 && (
        <section className="bg-white border border-[#E8E2D5] rounded-3xl p-6 shadow-[0_4px_24px_-4px_rgba(30,25,15,0.04)]">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h2 className="font-extrabold text-lg text-[#0B1224]">Bulk Inspection Summary</h2>
              <p className="text-xs sm:text-sm text-[#8C8275] font-mono mt-0.5">
                {reports.length} packages analyzed · {counts.clear} compliant · {counts.issue} potential violations ·{' '}
                {counts.review} needs review
              </p>
            </div>
            <button
              onClick={download}
              disabled={downloading}
              className="bg-[#0B1224] hover:bg-[#131F37] text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs hover-lift transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-sky-400" />
              {downloading ? 'Building Dossier…' : 'Download Bulk Summary PDF'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

