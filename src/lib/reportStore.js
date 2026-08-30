const KEY = 'packmetrix_reports_v2';

export function getReports() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function saveReport(report) {
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

export function computeDashboard(reports = getReports()) {
  const compliant = reports.filter((item) => item.status === 'COMPLIANT').length;
  const nonCompliant = reports.filter((item) => item.status === 'NON_COMPLIANT').length;
  const review = reports.filter((item) => item.status === 'REVIEW').length;
  const products = new Set(reports.map((item) => item.details?.productId || item.details?.productName || item.id)).size;
  return { total: reports.length, products, compliant, nonCompliant, review, rate: reports.length ? Math.round(reports.reduce((sum, item) => sum + Number(item.score || 0), 0) / reports.length) : 0 };
}
