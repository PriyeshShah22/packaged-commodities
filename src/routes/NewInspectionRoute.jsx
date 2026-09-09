import React, { useMemo, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, ChevronDown, Download, FileImage, Loader2, Plus, ScanLine, Upload, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import LiveCameraScanner from '../components/inspection/LiveCameraScanner';
import BulkInspectionPanel from '../components/inspection/BulkInspectionPanel';
import { useAuth } from '../context/auth-context';
import { downloadReportPdf, evaluateInspection, extractImages } from '../lib/api';
import { saveReport } from '../lib/reportStore';

const EMPTY = { brand_name: '', responsible_party_name: '', responsible_party_address: '', commodity_name: '', net_quantity: '', mrp: '', consumer_care: '', consumer_phone: '', consumer_email: '', country_of_origin: '', manufacture_pack_import_date: '', best_before_or_use_by: '', unit_sale_price: '', fssai_license: '', batch_number: '', barcode: '', ingredients: '', nutrition_information: '' };
const LABELS = { brand_name: 'Brand name', responsible_party_name: 'Manufacturer / packer / importer', responsible_party_address: 'Responsible party address', commodity_name: 'Common / generic commodity name', net_quantity: 'Net quantity', mrp: 'Maximum retail price', consumer_phone: 'Consumer-care mobile number', consumer_email: 'Consumer-care email', fssai_license: 'FSSAI licence number', batch_number: 'Batch / lot number', barcode: 'Barcode / GTIN', country_of_origin: 'Country of origin', manufacture_pack_import_date: 'Manufacture / pack / import date', best_before_or_use_by: 'Best before / use by', unit_sale_price: 'Unit sale price', ingredients: 'Ingredients', nutrition_information: 'Nutrition information' };

function newProduct(number) {
  return { key: `${Date.now()}-${number}`, number, details: { productId: '', productName: '' }, context: { category: 'unknown', origin: 'unknown', salesContext: 'retail' }, conditions: { date: false, perishable: false, unitPrice: false }, mode: 'upload', images: [], declarations: { ...EMPTY }, coverageComplete: false, ocrData: null, ocrLoading: false, ocrError: '', results: null, loading: false, error: '', report: null };
}

async function imageRecord(file, index, automatic = false) {
  const url = URL.createObjectURL(file); const image = new Image(); image.src = url; await image.decode().catch(() => {});
  let thumbnail = '';
  if (image.width) { const canvas = document.createElement('canvas'); const scale = Math.min(1, 280 / image.width); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); thumbnail = canvas.toDataURL('image/jpeg', .58); }
  return { id: `IMG-${String(index + 1).padStart(3, '0')}`, file, url, thumbnail, automatic, width: image.width || 0, height: image.height || 0, quality: image.width >= 800 && image.height >= 600 ? 'sufficient' : 'insufficient' };
}

function evidenceStrength(field, evidence) {
  if (!evidence?.value) return -1;
  const value = String(evidence.value); const raw = String(evidence.raw_text || '');
  const digits = (value.match(/\d/g) || []).length; const words = (value.match(/[A-Za-z]{2,}/g) || []).length;
  let score = Number(evidence.confidence || 0);
  if (['mrp', 'unit_sale_price'].includes(field)) score += Math.min(digits, 6) * .025 + (/\d[.,]\d{1,2}\b/.test(raw) ? .05 : 0) + (/(?:₹|\brs\.?\b|\binr\b|\/-)/i.test(raw) ? .03 : 0);
  else if (field === 'net_quantity') score += Math.min(digits, 7) * .03;
  else if (['consumer_phone', 'fssai_license', 'barcode'].includes(field)) score += Math.min(digits, 14) * .012;
  else if (['manufacture_pack_import_date', 'best_before_or_use_by', 'batch_number'].includes(field)) score += Math.min(value.replace(/\s/g, '').length, 14) * .008;
  else if (['brand_name', 'product_name', 'commodity_name', 'responsible_party_name', 'responsible_party_address', 'ingredients', 'nutrition_information'].includes(field)) score += Math.min(words, 7) * .018 + Math.min(value.length, 70) * .001;
  return score;
}

function mergeFieldEvidence(field, previous, incoming) {
  const pool = [previous, ...(previous?.alternatives || []), incoming, ...(incoming?.alternatives || [])].filter((item) => item?.value);
  const unique = new Map();
  pool.forEach((item) => {
    const key = String(item.value).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!key || (unique.has(key) && evidenceStrength(field, unique.get(key)) >= evidenceStrength(field, item))) return;
    unique.set(key, item);
  });
  const ranked = [...unique.values()].sort((left, right) => evidenceStrength(field, right) - evidenceStrength(field, left));
  return ranked.length ? { ...ranked[0], alternatives: ranked.slice(1, 4).map(({ alternatives: _alternatives, ...item }) => item) } : null;
}

function mergedOcr(current, incoming) {
  if (!current) return incoming;
  const fields = { ...(current.fields || {}) };
  Object.entries(incoming.fields || {}).forEach(([field, evidence]) => { fields[field] = mergeFieldEvidence(field, fields[field], evidence) || fields[field]; });
  return { ...incoming, images: [...(current.images || []), ...(incoming.images || [])], total_lines: (current.total_lines || 0) + (incoming.total_lines || 0), fields };
}

function refinedLines(ocrData) {
  const unique = new Map();
  (ocrData?.images || []).flatMap((image) => image.lines || []).forEach((line) => {
    const text = String(line.text || '').replace(/\s+/g, ' ').trim();
    if ((line.confidence || 0) < .6 || text.length < 2 || !/[A-Za-z0-9₹]/.test(text)) return;
    const key = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!key) return;
    if (!unique.has(key) || line.confidence > unique.get(key).confidence) unique.set(key, { ...line, text });
  });
  return [...unique.values()];
}

function contextFromDetectedFields(context, fields) {
  const country = fields?.country_of_origin;
  if (context.origin !== 'unknown' || !country?.value || Number(country.confidence || 0) < .75) return context;
  const value = String(country.value).trim();
  if (!/[A-Za-z]{3,}/.test(value)) return context;
  return { ...context, origin: /\bindia\b/i.test(value) ? 'domestic' : 'imported' };
}

function conditionsFromDetectedFields(conditions, fields) {
  const detected = (field) => Boolean(fields?.[field]?.value) && Number(fields[field].confidence || 0) >= .75;
  return {
    ...conditions,
    date: conditions.date || detected('manufacture_pack_import_date'),
    perishable: conditions.perishable || detected('best_before_or_use_by'),
    unitPrice: conditions.unitPrice || detected('unit_sale_price'),
  };
}

export default function NewInspectionRoute() {
  const { token, user } = useAuth(); const navigate = useNavigate();
  const [inspectionMode, setInspectionMode] = useState(() => new URLSearchParams(window.location.search).get('mode') === 'bulk' ? 'bulk' : 'grouped');
  const [products, setProducts] = useState(() => [newProduct(1)]); const [activeKey, setActiveKey] = useState(() => products[0].key); const [bulkDownloading, setBulkDownloading] = useState(false);
  const active = products.find((product) => product.key === activeKey) || products[0];
  const update = (key, patch) => setProducts((current) => current.map((product) => product.key === key ? { ...product, ...(typeof patch === 'function' ? patch(product) : patch) } : product));
  const addProduct = () => { const product = newProduct(products.length + 1); setProducts((current) => [...current, product]); setActiveKey(product.key); };
  const removeProduct = (key) => { if (products.length === 1) return; products.find((p) => p.key === key)?.images.forEach((image) => URL.revokeObjectURL(image.url)); const next = products.filter((p) => p.key !== key); setProducts(next); if (activeKey === key) setActiveKey(next[0].key); };

  const runOcr = async (key, files, append = false, live = false) => {
    if (!files.length) return false; update(key, { ocrLoading: true, ocrError: '' });
    try {
      const data = await extractImages(files, token, { live }); const tooBlurry = data.images?.some((image) => image.quality?.blur_status === 'high');
      update(key, (product) => {
        const ocrData = append ? mergedOcr(product.ocrData, data) : data;
        if (tooBlurry) return { ocrData, ocrError: 'Frame too blurred to update fields. Hold the package steady, fill the guide, and scan again.' };
        const declarations = { ...product.declarations };
        Object.entries(ocrData.fields || {}).forEach(([field, evidence]) => {
          const previousDetectedValue = product.ocrData?.fields?.[field]?.value || '';
          const manuallyEdited = declarations[field] && declarations[field] !== previousDetectedValue;
          if (field in declarations && evidence?.value && !manuallyEdited) declarations[field] = evidence.value;
        });
        const previousDetectedName = product.ocrData?.fields?.product_name?.value || product.ocrData?.fields?.commodity_name?.value || '';
        const detectedName = ocrData.fields?.product_name?.value || ocrData.fields?.commodity_name?.value || '';
        const productName = !product.details.productName || product.details.productName === previousDetectedName ? detectedName : product.details.productName;
        return { ocrData, declarations, details: { ...product.details, productId: product.details.productId || ocrData.fields?.barcode?.value || '', productName }, context: contextFromDetectedFields(product.context, ocrData.fields), conditions: conditionsFromDetectedFields(product.conditions, ocrData.fields), ocrError: '' };
      });
      requestAnimationFrame(() => console.debug('[Live OCR] UI updated', { fields: Object.keys(data.fields || {}).length }));
      return true;
    } catch (error) { update(key, { ocrError: error.message }); return false; } finally { update(key, { ocrLoading: false }); }
  };

  const addImages = async (event) => { const files = Array.from(event.target.files || []).slice(0, 12 - active.images.length); const records = await Promise.all(files.map((file, index) => imageRecord(file, active.images.length + index))); const next = [...active.images, ...records]; update(active.key, { images: next }); event.target.value = ''; await runOcr(active.key, files, active.images.length > 0); };
  const cameraCapture = async (file, automatic) => {
    // Automatic live frames are transient OCR samples, not evidence photos.
    // Only an explicit Capture Evidence action creates a clickable image card.
    if (automatic) return runOcr(active.key, [file], true, true);
    // Send the frame to OCR immediately. Preview decoding/compression is local
    // bookkeeping and can run in parallel instead of delaying field updates.
    const recordPromise = imageRecord(file, active.images.length, false);
    const ocrPromise = runOcr(active.key, [file], true, false);
    const [record, succeeded] = await Promise.all([recordPromise, ocrPromise]);
    update(active.key, (product) => {
      const next = [...product.images, record].slice(-12).map((item, index) => ({ ...item, id: `IMG-${String(index + 1).padStart(3, '0')}` }));
      return { images: next };
    });
    return succeeded;
  };
  const removeImage = (id) => { const removed = active.images.find((image) => image.id === id); if (removed) URL.revokeObjectURL(removed.url); const images = active.images.filter((image) => image.id !== id).map((image, index) => ({ ...image, id: `IMG-${String(index + 1).padStart(3, '0')}` })); update(active.key, { images }); };
  const clearExtractedText = () => { if (!window.confirm('Clear all retained OCR text and AI-mapped declaration values for this product? Evidence photographs will remain.')) return; update(active.key, { ocrData: null, declarations: { ...EMPTY }, details: { ...active.details, productId: '', productName: '' }, results: null, report: null, ocrError: '' }); };

  const analyze = async () => {
    if (!active.images.length && !active.ocrData?.total_lines) { update(active.key, { error: 'Scan package text or add front, back, or side photographs before analysis.' }); return; }
    update(active.key, { loading: true, error: '' });
    try {
      const resolvedDeclarations = Object.fromEntries(Object.keys(EMPTY).map((field) => [field, active.declarations[field]?.trim() || active.ocrData?.fields?.[field]?.value || '']));
      const evidence = Object.entries(resolvedDeclarations).filter(([, value]) => value.trim()).map(([field, value]) => { const detected = active.ocrData?.fields?.[field]; return { field, value: value.trim(), confidence: detected?.value === value.trim() ? detected.confidence : .95, source_type: detected?.value === value.trim() ? 'ocr' : 'inspector_entered', image_id: detected?.image_id || active.images[0]?.id || 'LIVE-OCR', bbox: detected?.bbox || null }; });
      const liveQuality = (active.ocrData?.images || []).map((image) => ({ image_id: image.image_id, status: image.quality?.resolution_sufficient ? 'sufficient' : 'insufficient' }));
      const response = await evaluateInspection({ context: { inspection_mode: 'physical_package', package_context: active.context.salesContext === 'wholesale' ? 'wholesale' : active.context.salesContext === 'unknown' ? 'unknown' : 'retail_prepackaged', product_category: active.context.category, origin: active.context.origin, sales_context: active.context.salesContext, product_conditions: [active.conditions.date && 'date_declaration_required', active.conditions.perishable && 'may_become_unfit_for_human_consumption', active.conditions.unitPrice && 'unit_sale_price_required'].filter(Boolean), inspection_date: new Date().toISOString().slice(0, 10) }, evidence, field_coverage: Object.keys(active.declarations).reduce((result, field) => ({ ...result, [field]: active.coverageComplete ? 'complete' : 'incomplete' }), {}), image_quality: active.images.length ? active.images.map((image) => ({ image_id: image.id, status: image.quality })) : liveQuality }, token);
      const applicable = response.results.filter((item) => item.outcome !== 'NOT_APPLICABLE'); const pass = applicable.filter((item) => item.outcome === 'PASS').length; const verificationScore = applicable.length ? Math.round(pass / applicable.length * 100) : 0; const status = response.counts.FAIL ? 'NON_COMPLIANT' : response.counts.REVIEW ? 'REVIEW' : 'COMPLIANT'; const id = `PMX-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Date.now().toString().slice(-5)}-P${active.number}`; const ocrLines = refinedLines(active.ocrData);
      const overallReason = response.counts.FAIL ? `${response.counts.FAIL} check(s) failed with sufficient evidence; ${response.counts.REVIEW} additional check(s) need verification.` : response.counts.REVIEW ? `No confirmed failure was found; ${response.counts.REVIEW} check(s) need verification because evidence or applicability is incomplete.` : 'All applicable checks passed with sufficient evidence.';
      const uploadedEvidence = active.mode === 'upload' ? active.images.map((image) => ({ imageId: image.id, fileName: image.file?.name || image.id, thumbnail: image.thumbnail })) : [];
      const report = { id, batchId: `BATCH-${products[0].key.split('-')[0]}`, date: new Date().toLocaleString('en-IN'), inspectorName: user?.name || '', status, overallReason, workflowStatus: 'OPEN', verificationScore, score: verificationScore, captureMode: active.mode === 'camera' ? 'live' : 'upload', evidenceImages: uploadedEvidence, details: { productId: active.details.productId || resolvedDeclarations.barcode || id, productName: active.details.productName || resolvedDeclarations.commodity_name || 'Unnamed package', category: active.context.category, origin: active.context.origin, salesContext: active.context.salesContext }, declarations: resolvedDeclarations, fieldEvidence: active.ocrData?.fields || {}, counts: response.counts, results: response.results, violations: applicable.filter((item) => ['FAIL', 'REVIEW'].includes(item.outcome)), ocrLines, ocrStatus: ocrLines.length ? 'Text evidence detected' : 'No text evidence detected', imageCount: active.images.length || active.ocrData?.images?.length || 0, imageQuality: active.images.length ? active.images.map(({ id: imageId, width, height, quality }) => ({ imageId, width, height, quality })) : liveQuality, thumbnail: uploadedEvidence[0]?.thumbnail || '' };
      report.inspectionId = id;
      report.ruleSetAsOf = response.as_of;
      report.ruleSetVersion = [...new Set(response.results.map((item) => item.rule_version).filter(Boolean))].join(', ');
      const savedReport = saveReport(report); update(active.key, { results: response, report: savedReport }); setTimeout(() => document.getElementById('analysis-results')?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (error) { update(active.key, { error: error.message }); } finally { update(active.key, { loading: false }); }
  };

  const completed = products.map((product) => product.report).filter(Boolean);
  const downloadBulk = async () => { if (!completed.length) return; setBulkDownloading(true); try { const blob = await downloadReportPdf({ id: `BATCH-${products[0].key.split('-')[0]}`, reports: completed }, token); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `PackMetrix-bulk-${Date.now()}.pdf`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } finally { setBulkDownloading(false); } };
  const quality = useMemo(() => active.images.length ? `${active.images.filter((image) => image.quality === 'sufficient').length}/${active.images.length} panels meet the resolution screen` : 'No evidence panels for this product', [active.images]);
  const visible = active.results?.results?.filter((item) => item.outcome !== 'NOT_APPLICABLE') || [];
  const actions = completed.length ? (
    <button
      onClick={downloadBulk}
      disabled={bulkDownloading}
      className="flex items-center gap-2 bg-[#0B1224] hover:bg-[#131F37] text-white px-4.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs hover-lift transition-all disabled:opacity-50 cursor-pointer"
    >
      <Download className="w-4 h-4 text-sky-400" />
      {bulkDownloading ? 'Building Dossier…' : `Bulk Dossier (${completed.length})`}
    </button>
  ) : null;

  return (
    <AppShell
      title="Package Intake & Inspection"
      eyebrow="AI STATUTORY VERIFICATION"
      actions={inspectionMode === 'grouped' ? actions : null}
    >
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Inspection Mode Selector */}
        <section className="bg-white border border-[#E8E2D5] rounded-3xl p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(30,25,15,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-widest text-[#0284C7] bg-sky-50 border border-sky-200/60 px-2.5 py-0.5 rounded-full uppercase">
                  Workflow Architecture
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#0B1224] mt-1.5">
                Select Intake Mode
              </h2>
              <p className="text-xs text-[#8C8275] mt-0.5">
                Single or grouped package inspection with multi-panel OCR, or batch bulk analysis
              </p>
            </div>
            <div className="inline-flex bg-[#F4EFE6] rounded-2xl p-1.5 border border-[#E8E2D5] self-start sm:self-auto shrink-0">
              <button
                onClick={() => setInspectionMode('grouped')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  inspectionMode === 'grouped'
                    ? 'bg-[#0B1224] text-white shadow-sm'
                    : 'text-[#475569] hover:text-[#0B1224]'
                }`}
              >
                Single / Grouped Intake
              </button>
              <button
                onClick={() => setInspectionMode('bulk')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  inspectionMode === 'bulk'
                    ? 'bg-[#0B1224] text-white shadow-sm'
                    : 'text-[#475569] hover:text-[#0B1224]'
                }`}
              >
                Bulk Batch Processing
              </button>
            </div>
          </div>
        </section>

        {inspectionMode === 'bulk' ? (
          <BulkInspectionPanel token={token} user={user} />
        ) : (
          <>
            {/* Product Groups Selector */}
            <section className="bg-white border border-[#E8E2D5] rounded-3xl p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(30,25,15,0.04)]">
              <div className="flex flex-wrap gap-2.5 items-center">
                <span className="text-[10px] font-mono font-bold text-[#8C8275] uppercase tracking-wider mr-2">
                  Active Packages:
                </span>
                {products.map((product) => {
                  const isSelected = product.key === active.key;
                  return (
                    <button
                      key={product.key}
                      onClick={() => setActiveKey(product.key)}
                      className={`group flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#0B1224] text-white border-[#0B1224] shadow-sm'
                          : 'bg-[#FAF8F5] text-slate-700 border-[#E8E2D5] hover:bg-[#F4EFE6] hover:border-[#D6CEBE]'
                      }`}
                    >
                      <span>{product.details.productName || `Product ${product.number}`}</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          product.report
                            ? 'bg-emerald-400'
                            : product.images.length
                            ? 'bg-amber-400'
                            : isSelected
                            ? 'bg-slate-500'
                            : 'bg-slate-300'
                        }`}
                      />
                      {products.length > 1 && (
                        <span
                          onClick={(event) => {
                            event.stopPropagation();
                            removeProduct(product.key);
                          }}
                          className="opacity-40 hover:opacity-100 transition-opacity p-0.5 ml-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
                <button
                  onClick={addProduct}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-dashed border-[#0284C7] text-[#0284C7] hover:bg-sky-50/60 text-xs sm:text-sm font-bold transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Package
                </button>
              </div>
              <p className="text-xs text-[#8C8275] mt-3">
                Keep every product’s front, back, and side panels inside its own tab. Optical OCR text is isolated per product group.
              </p>
            </section>

            {/* Section 1: Identify Product */}
            <Section
              number="1"
              title={`Identify Product ${active.number}`}
              subtitle="Product name and barcode may be auto-detected from uploaded panels or entered manually."
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <Text
                  label="Product ID / Barcode (GTIN)"
                  value={active.details.productId}
                  onChange={(value) =>
                    update(active.key, { details: { ...active.details, productId: value } })
                  }
                  placeholder="Auto-filled from barcode or enter manually"
                />
                <Text
                  label="Product Name"
                  value={active.details.productName}
                  onChange={(value) =>
                    update(active.key, { details: { ...active.details, productName: value } })
                  }
                  placeholder="e.g. Yellow Crisps / Chocolate Truffles"
                />
              </div>

              {/* Advanced Applicability Drawer */}
              <details className="mt-5 group border border-[#E8E2D5] rounded-2xl bg-[#FAF8F5] p-4.5">
                <summary className="cursor-pointer flex items-center justify-between text-xs sm:text-sm font-bold text-slate-700 select-none">
                  <span className="flex items-center gap-2">
                    <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform duration-200 text-[#8C8275]" />
                    Advanced Statutory Applicability & Context
                  </span>
                  <span className="text-[10px] font-mono text-[#8C8275] bg-white border border-[#E8E2D5] px-2 py-0.5 rounded-md">
                    LM RULES 2011
                  </span>
                </summary>

                <p className="text-xs text-amber-900 bg-amber-50/80 border border-amber-200/70 rounded-xl p-3 mt-3">
                  Unknown facts remain marked as <b>REVIEW</b>; an image alone cannot prove sales channel or every statutory exception.
                </p>

                <div className="grid sm:grid-cols-3 gap-4 mt-4">
                  <Select
                    label="Category"
                    value={active.context.category}
                    onChange={(value) =>
                      update(active.key, { context: { ...active.context, category: value } })
                    }
                    options={[
                      ['unknown', 'Auto / Unknown'],
                      ['food', 'Food Commodity'],
                      ['beverage', 'Beverage'],
                      ['personal_care', 'Personal Care / Cosmetics'],
                      ['household', 'Household / Cleaning'],
                      ['other', 'Other Commodity'],
                    ]}
                  />
                  <Select
                    label="Statutory Origin"
                    value={active.context.origin}
                    onChange={(value) =>
                      update(active.key, { context: { ...active.context, origin: value } })
                    }
                    options={[
                      ['unknown', 'Auto / Unknown'],
                      ['domestic', 'Manufactured in India'],
                      ['imported', 'Imported Goods'],
                    ]}
                  />
                  <Select
                    label="Sales Context"
                    value={active.context.salesContext}
                    onChange={(value) =>
                      update(active.key, { context: { ...active.context, salesContext: value } })
                    }
                    options={[
                      ['retail', 'Retail Package'],
                      ['ecommerce', 'E-Commerce Marketplace'],
                      ['wholesale', 'Wholesale / Institutional'],
                      ['unknown', 'Unknown Context'],
                    ]}
                  />
                </div>

                <div className="mt-4 pt-4 border-t border-[#E8E2D5] flex flex-wrap gap-5">
                  {[
                    ['date', 'Date declaration applies (Mfg/Pack/Import)'],
                    ['perishable', 'Perishable commodity (unfit after time)'],
                    ['unitPrice', 'Unit sale price applies (Rule 6(11))'],
                  ].map(([key, label]) => (
                    <label key={key} className="text-xs sm:text-sm flex items-center gap-2.5 text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={active.conditions[key]}
                        onChange={(event) =>
                          update(active.key, {
                            conditions: { ...active.conditions, [key]: event.target.checked },
                          })
                        }
                        className="w-4 h-4 rounded border-[#D8D0C0] text-[#0284C7] focus:ring-[#0284C7]/20"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </details>
            </Section>

            {/* Section 2: Capture Panels */}
            <Section
              number="2"
              title={`Capture Panels for Product ${active.number}`}
              subtitle="Upload or scan high-resolution front, back, side, top, and bottom packaging panels."
            >
              <div className="inline-flex bg-[#F4EFE6] rounded-2xl p-1.5 border border-[#E8E2D5]">
                <button
                  onClick={() => update(active.key, { mode: 'upload' })}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    active.mode === 'upload'
                      ? 'bg-[#0B1224] text-white shadow-sm'
                      : 'text-[#475569] hover:text-[#0B1224]'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Upload Panels
                </button>
                <button
                  onClick={() => update(active.key, { mode: 'camera' })}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    active.mode === 'camera'
                      ? 'bg-[#0B1224] text-white shadow-sm'
                      : 'text-[#475569] hover:text-[#0B1224]'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  Live Optical Scanner
                </button>
              </div>

              {active.mode === 'upload' ? (
                <label
                  className={`mt-4 min-h-36 border-2 border-dashed rounded-3xl grid place-items-center text-center cursor-pointer transition-all duration-200 ${
                    active.ocrLoading
                      ? 'opacity-60 pointer-events-none bg-[#F4EFE6] border-[#D8D0C0]'
                      : 'border-[#D8D0C0] hover:border-[#0284C7] bg-[#FAF8F5] hover:bg-sky-50/20'
                  }`}
                >
                  <div className="p-8">
                    {active.ocrLoading ? (
                      <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#0284C7]" />
                    ) : (
                      <Upload className="w-8 h-8 mx-auto text-[#0284C7]" />
                    )}
                    <p className="font-bold text-sm text-[#0B1224] mt-3">
                      {active.ocrLoading
                        ? 'Extracting and mapping statutory text via OCR…'
                        : 'Drop or browse front, back, and side panel photographs'}
                    </p>
                    <p className="text-xs text-[#8C8275] mt-1 font-mono">
                      Accepts JPG, PNG, WEBP (up to 12 panels for Product {active.number})
                    </p>
                  </div>
                  <input type="file" accept="image/*" multiple onChange={addImages} className="hidden" />
                </label>
              ) : (
                <div className="mt-4">
                  <LiveCameraScanner
                    onCapture={cameraCapture}
                    ocrData={active.ocrData}
                    busy={active.ocrLoading}
                  />
                </div>
              )}

              {/* Uploaded Panel Cards */}
              {active.images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-3.5 mt-5">
                  {active.images.map((image) => (
                    <div
                      key={image.id}
                      className="border border-[#E8E2D5] rounded-2xl overflow-hidden relative group bg-[#FAF8F5] shadow-2xs"
                    >
                      <img src={image.url} alt={image.file.name} className="w-full h-28 object-cover" />
                      <button
                        onClick={() => removeImage(image.id)}
                        className="absolute top-2 right-2 bg-slate-900/80 hover:bg-rose-600 text-white p-1.5 rounded-full transition-colors cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="p-2.5 bg-white border-t border-[#E8E2D5]">
                        <span className="font-mono text-[10px] font-bold text-[#0284C7] bg-sky-50 px-1.5 py-0.5 rounded">
                          {image.id}
                        </span>
                        <p className="truncate text-slate-500 text-[11px] mt-1">{image.file.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between flex-wrap gap-2 text-xs text-[#8C8275]">
                <div className="flex items-center gap-2 font-mono">
                  <FileImage className="w-4 h-4 text-[#0284C7]" />
                  <span>{quality}</span>
                </div>
                {active.images.length > 0 && (
                  <span className="font-mono text-[11px]">
                    {active.images.length} of 12 slots utilized
                  </span>
                )}
              </div>

              {active.ocrError && (
                <p className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3.5">
                  {active.ocrError}
                </p>
              )}
            </Section>

            {/* Section 3: Review Extracted Declarations */}
            <Section
              number="3"
              title="Review Extracted Declarations"
              subtitle="The strongest field-specific values are auto-mapped below; full OCR transcripts remain retained in the audit record."
            >
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-[#E8E2D5]">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#8C8275] font-mono">
                    Mandatory & Optional Declarations under Rule 6
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearExtractedText}
                  disabled={!active.ocrData}
                  className="text-xs font-bold text-rose-700 hover:text-rose-800 border border-rose-200/80 hover:bg-rose-50/50 rounded-xl px-3 py-1.5 disabled:opacity-40 transition-all cursor-pointer"
                >
                  Clear extracted text
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {Object.entries(LABELS).map(([field, label]) => (
                  <Text
                    key={field}
                    label={label}
                    value={active.declarations[field]}
                    evidence={active.ocrData?.fields?.[field]}
                    onChange={(value) =>
                      update(active.key, {
                        declarations: { ...active.declarations, [field]: value },
                      })
                    }
                    placeholder="Not reliably detected in scanned panels"
                  />
                ))}
              </div>

              {/* Full Panel Scanning Assurance Callout */}
              <label className="mt-6 flex items-start gap-3.5 bg-[#FAF8F5] border border-[#E8E2D5] rounded-2xl p-4.5 cursor-pointer shadow-2xs">
                <input
                  type="checkbox"
                  checked={active.coverageComplete}
                  onChange={(event) =>
                    update(active.key, { coverageComplete: event.target.checked })
                  }
                  className="w-4 h-4 mt-0.5 rounded border-[#D8D0C0] text-[#0284C7] focus:ring-[#0284C7]/20"
                />
                <span>
                  <b className="text-sm text-[#0B1224]">
                    I confirm having scanned all relevant package surfaces for Product {active.number}
                  </b>
                  <p className="text-xs text-[#8C8275] mt-1">
                    Until confirmed, undetected mandatory declarations will remain marked as <b>NEEDS REVIEW</b> rather than automatically declared non-compliant.
                  </p>
                </span>
              </label>
            </Section>

            {/* Error Message */}
            {active.error && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4.5 text-sm text-rose-800 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                <span>{active.error}</span>
              </div>
            )}

            {/* Primary Analysis Trigger CTA */}
            <button
              onClick={analyze}
              disabled={active.loading || active.ocrLoading}
              className="w-full bg-[#0B1224] hover:bg-[#131F37] active:scale-[0.99] text-white rounded-2xl py-4.5 px-6 font-bold shadow-[0_4px_20px_rgba(11,18,36,0.25)] flex items-center justify-center gap-3 transition-all cursor-pointer text-base hover-lift disabled:opacity-50"
            >
              {active.loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
                  <span>Evaluating Statutory Rules for Product {active.number}…</span>
                </>
              ) : (
                <>
                  <ScanLine className="w-5 h-5 text-sky-400" />
                  <span>Evaluate Compliance — Product {active.number}</span>
                </>
              )}
            </button>

            {/* Assessment Findings Section */}
            {active.results && (
              <section
                id="analysis-results"
                className="bg-white border border-[#E8E2D5] rounded-3xl p-6 sm:p-8 shadow-[0_4px_24px_-4px_rgba(30,25,15,0.04)]"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E8E2D5]">
                  <div>
                    <span className="text-[10px] font-mono font-bold tracking-widest text-[#0284C7] bg-sky-50 border border-sky-200/60 px-2.5 py-0.5 rounded-full uppercase">
                      Assessment Complete
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-[#0B1224] mt-1.5">
                      Statutory Findings Summary
                    </h2>
                    <p className="text-xs sm:text-sm text-[#8C8275] mt-1">
                      Evaluated under Legal Metrology (Packaged Commodities) Rules, 2011
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/reports/${active.report?.id}`)}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#0284C7] hover:text-[#0369A1] self-start sm:self-auto cursor-pointer"
                  >
                    <span>Open Full Audit Dossier</span>
                    <span>→</span>
                  </button>
                </div>

                {/* Score Summary Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6">
                  {[
                    ['Passed Rules', active.results.counts.PASS, 'text-emerald-700 bg-emerald-50/80 border-emerald-200/60'],
                    ['Potential Violations', active.results.counts.FAIL, 'text-rose-700 bg-rose-50/80 border-rose-200/60'],
                    ['Needs Verification', active.results.counts.REVIEW, 'text-amber-700 bg-amber-50/80 border-amber-200/60'],
                  ].map(([label, value, style]) => (
                    <div key={label} className={`rounded-2xl p-4.5 border ${style}`}>
                      <p className="text-3xl font-black">{value}</p>
                      <p className="text-xs font-bold uppercase tracking-wider mt-1">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Findings Items */}
                <div className="mt-6 divide-y divide-[#E8E2D5]">
                  {visible.map((item) => (
                    <div key={item.rule_id} className="py-4 flex items-start gap-3.5">
                      {item.outcome === 'PASS' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle
                          className={`w-5 h-5 shrink-0 mt-0.5 ${
                            item.outcome === 'FAIL' ? 'text-rose-600' : 'text-amber-600'
                          }`}
                        />
                      )}
                      <div>
                        <p className="font-bold text-sm text-[#0B1224]">
                          {item.requirement} —{' '}
                          <span
                            className={
                              item.outcome === 'PASS'
                                ? 'text-emerald-700'
                                : item.outcome === 'FAIL'
                                ? 'text-rose-700'
                                : 'text-amber-700'
                            }
                          >
                            {item.outcome === 'PASS'
                              ? 'Passed'
                              : item.outcome === 'FAIL'
                              ? 'Potential Issue'
                              : 'Review Required'}
                          </span>
                        </p>
                        <p className="text-xs sm:text-sm text-[#475569] mt-1">{item.reason}</p>
                        <p className="text-[11px] font-mono text-[#8C8275] mt-1">
                          Legal reference: {item.rule_reference}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Section({ number, title, subtitle, children }) {
  return (
    <section className="bg-white border border-[#E8E2D5] rounded-3xl p-6 sm:p-8 shadow-[0_4px_24px_-4px_rgba(30,25,15,0.04)]">
      <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-[#E8E2D5]">
        <span className="w-9 h-9 rounded-xl bg-[#0B1224] text-sky-400 grid place-items-center font-mono font-bold text-sm shrink-0 shadow-xs">
          {number}
        </span>
        <div>
          <h2 className="font-extrabold text-lg text-[#0B1224] tracking-tight">{title}</h2>
          <p className="text-xs sm:text-sm text-[#8C8275] mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Text({ label, value, onChange, placeholder, evidence }) {
  const confidence = evidence?.confidence;
  const uncertain = confidence != null && confidence < 0.8;
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700 mb-1.5">
        <span>{label}</span>
        {confidence != null && (
          <span
            className={`normal-case font-mono rounded-full px-2 py-0.5 text-[10px] font-bold border ${
              uncertain
                ? 'bg-amber-50 text-amber-800 border-amber-200/60'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200/60'
            }`}
          >
            {uncertain ? 'Needs Review' : 'AI mapped'} · {Math.round(confidence * 100)}%
          </span>
        )}
      </span>
      <input
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border px-4 py-3 text-xs sm:text-sm outline-none transition-all ${
          uncertain
            ? 'border-amber-300 bg-amber-50/20 text-slate-900 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/30'
            : 'border-[#E8E2D5] bg-[#FAF8F5] text-slate-900 focus:bg-white focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/15'
        }`}
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700 mb-1.5">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#E8E2D5] bg-[#FAF8F5] focus:bg-white focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/15 px-4 py-3 text-xs sm:text-sm text-slate-900 outline-none transition-all"
      >
        {options.map(([option, labelText]) => (
          <option key={option} value={option}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

