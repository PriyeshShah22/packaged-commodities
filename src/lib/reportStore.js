const KEY = 'packmetrix_reports_v2';
const BULK_KEY = 'packmetrix_bulk_batches_v1';

export function verificationState(report) {
  const applicable = (report.results || []).filter((item) => item.outcome !== 'NOT_APPLICABLE');
  const resolved = applicable.map((item) => item.resolvedOutcome || item.outcome);
  const counts = {
    PASS: resolved.filter((outcome) => ['PASS', 'COMPLIANT'].includes(outcome)).length,
    FAIL: resolved.filter((outcome) => ['FAIL', 'VIOLATION'].includes(outcome)).length,
    REVIEW: resolved.filter((outcome) => ['REVIEW', 'MORE_EVIDENCE'].includes(outcome)).length,
    NOT_APPLICABLE: Number(report.counts?.NOT_APPLICABLE || 0),
  };
  const total = applicable.length; const verified = counts.PASS + counts.FAIL; const percentage = total ? Math.round(verified / total * 100) : 0;
  const status = counts.FAIL ? 'NON_COMPLIANT' : counts.REVIEW ? 'REVIEW' : 'COMPLIANT';
  return { counts, total, verified, percentage, status };
}

function withScore(report) {
  const verification = verificationState(report); const hasResults = Array.isArray(report.results) && report.results.length > 0;
  const numeric = Number(report.verificationScore ?? report.score ?? 0); const legacyScore = Number.isFinite(numeric) ? numeric : 0;
  return { workflowStatus: 'OPEN', archived: false, ...report, aiStatus: report.aiStatus || report.status, aiCounts: report.aiCounts || report.counts, status: hasResults ? verification.status : report.status, counts: hasResults ? verification.counts : report.counts, verification: hasResults ? verification : report.verification, verificationScore: hasResults ? verification.percentage : legacyScore, score: hasResults ? verification.percentage : legacyScore };
}

export function getReports() {
  try {
    const reports = JSON.parse(localStorage.getItem(KEY) || '[]');
    const ids = new Set(reports.map((report) => report.id));
    // Listing batches retain every row even when the recent-report cache fills.
    for (const batch of getBulkBatches().filter((item) => item.mode === 'listing')) {
      for (const group of batch.groups || []) {
        if (group.report && !ids.has(group.report.id)) { reports.push(group.report); ids.add(group.report.id); }
      }
    }
    return reports.map(withScore);
  } catch { return []; }
}

export function saveReport(report) {
  report = withScore(report);
  const reports = getReports().filter((item) => item.id !== report.id);
  const next = [report, ...reports].slice(0, 60);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Preserve every preview for the newest inspection and discard previews
    // from older browser-local reports first. Production deployments should
    // store originals in object storage and retain only references here.
    const reduced = next.map((item, index) => index ? { ...item, thumbnail: '', evidenceImages: [] } : item).slice(0, 30);
    try { localStorage.setItem(KEY, JSON.stringify(reduced)); }
    catch { localStorage.setItem(KEY, JSON.stringify(reduced.map((item) => ({ ...item, thumbnail: '', evidenceImages: [] })))); }
  }
  return report;
}

export function getReport(id) { return getReports().find((report) => report.id === id); }

export function updateReport(id, patch) {
  const current = getReport(id);
  if (!current) return null;
  const updated = saveReport({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) });
  const batch = getBulkBatch(updated.batchId);
  if (batch?.mode === 'listing') saveBulkBatch({ ...batch, groups: batch.groups.map((group) => group.report?.id === id ? { ...group, report: updated } : group) });
  return updated;
}

export function archiveReport(id) { return updateReport(id, { archived: true, archivedAt: new Date().toISOString() }); }
export function restoreReport(id) { return updateReport(id, { archived: false, archivedAt: null }); }

export function deleteReport(id) {
  const next = getReports().filter((report) => report.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
  const batches = getBulkBatches().map((batch) => ({
    ...batch,
    groups: (batch.groups || []).map((group) =>
      group.report?.id === id ? { ...group, report: null } : group
    ),
  }));
  localStorage.setItem(BULK_KEY, JSON.stringify(batches));
  return true;
}

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

export function deleteBulkBatch(id) {
  localStorage.setItem(BULK_KEY, JSON.stringify(getBulkBatches().filter((batch) => batch.id !== id)));
  return true;
}

export function computeDashboard(reports = getReports()) {
  reports = reports.filter((item) => !item.archived);
  const compliant = reports.filter((item) => item.status === 'COMPLIANT').length;
  const nonCompliant = reports.filter((item) => item.status === 'NON_COMPLIANT').length;
  const review = reports.filter((item) => item.status === 'REVIEW' && item.workflowStatus !== 'RESOLVED').length;
  const products = new Set(reports.map((item) => item.details?.productId || item.details?.productName || item.id)).size;
  return { total: reports.length, products, compliant, nonCompliant, review, rate: reports.length ? Math.round(reports.reduce((sum, item) => sum + Number(item.verificationScore ?? item.score ?? 0), 0) / reports.length) : 0 };
}
