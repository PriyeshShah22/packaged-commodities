const KEY = 'packmetrix_reports_v2';
const BULK_KEY = 'packmetrix_bulk_batches_v1';

function withScore(report) {
  const numeric = Number(report.verificationScore ?? report.score ?? 0);
  const score = Number.isFinite(numeric) ? numeric : 0;
  return { workflowStatus: 'OPEN', archived: false, ...report, verificationScore: score, score };
}

export function getReports() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]').map(withScore); } catch { return []; }
}

export function saveReport(report) {
  report = withScore(report);
  const reports = getReports().filter((item) => item.id !== report.id);
  const next = [report, ...reports].slice(0, 60);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Keep the newest preview only if the browser quota is tight. Original
    // evidence belongs in object storage in deployment, never as base64 DB rows.
    localStorage.setItem(KEY, JSON.stringify(next.map((item, index) => index ? { ...item, thumbnail: '' } : item).slice(0, 30)));
  }
  return report;
}

export function getReport(id) { return getReports().find((report) => report.id === id); }

export function updateReport(id, patch) {
  const current = getReport(id);
  if (!current) return null;
  return saveReport({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) });
}

export function archiveReport(id) { return updateReport(id, { archived: true, archivedAt: new Date().toISOString() }); }
export function restoreReport(id) { return updateReport(id, { archived: false, archivedAt: null }); }

export function getBulkBatches() {
  try { return JSON.parse(localStorage.getItem(BULK_KEY) || '[]'); } catch { return []; }
}

export function getBulkBatch(id) { return getBulkBatches().find((batch) => batch.id === id); }

export function saveBulkBatch(batch) {
  const batches = getBulkBatches().filter((item) => item.id !== batch.id);
  const next = [{ ...batch, updatedAt: new Date().toISOString() }, ...batches].slice(0, 10);
  try { localStorage.setItem(BULK_KEY, JSON.stringify(next)); }
  catch { localStorage.setItem(BULK_KEY, JSON.stringify(next.map((item) => ({ ...item, groups: item.groups.map((group) => ({ ...group, images: group.images.map((image) => ({ ...image, thumbnail: '' })) })) })))); }
  return batch;
}

export function computeDashboard(reports = getReports()) {
  reports = reports.filter((item) => !item.archived);
  const compliant = reports.filter((item) => item.status === 'COMPLIANT').length;
  const nonCompliant = reports.filter((item) => item.status === 'NON_COMPLIANT').length;
  const review = reports.filter((item) => item.status === 'REVIEW' && item.workflowStatus !== 'RESOLVED').length;
  const products = new Set(reports.map((item) => item.details?.productId || item.details?.productName || item.id)).size;
  return { total: reports.length, products, compliant, nonCompliant, review, rate: reports.length ? Math.round(reports.reduce((sum, item) => sum + Number(item.verificationScore ?? item.score ?? 0), 0) / reports.length) : 0 };
}
