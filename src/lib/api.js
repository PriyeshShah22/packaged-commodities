const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export async function importProductListing(file, token) {
  const body = new FormData(); body.append('file', file);
  const response = await fetch(`${API_URL}/api/v1/listing/import`, { method: 'POST', headers: authHeaders(token), body });
  return readResponse(response, 'Inventory import failed.');
}

function authHeaders(token, json = false) {
  return { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function readResponse(response, fallback) {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || fallback);
  }
  return response.json();
}

export async function loginAccount(email, password) {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, { method: 'POST', headers: authHeaders(null, true), body: JSON.stringify({ email, password }) });
  return readResponse(response, 'Sign in failed.');
}

export async function signupAccount(payload) {
  const response = await fetch(`${API_URL}/api/v1/auth/signup`, { method: 'POST', headers: authHeaders(null, true), body: JSON.stringify(payload) });
  return readResponse(response, 'Account creation failed.');
}

export async function verifySession(token) {
  const response = await fetch(`${API_URL}/api/v1/auth/me`, { headers: authHeaders(token) });
  return readResponse(response, 'Your session has expired.');
}

export async function evaluateInspection(payload, token) {
  let response;
  try { response = await fetch(`${API_URL}/api/v1/validations/evaluate`, { method: 'POST', headers: authHeaders(token, true), body: JSON.stringify(payload) }); }
  catch { throw new Error('The PackMetrix backend is not reachable. Confirm that port 8000 is running.'); }
  return readResponse(response, 'The compliance analysis could not be completed.');
}

export async function getBackendHealth() {
  try { return (await fetch(`${API_URL}/health`)).ok; } catch { return false; }
}

export async function extractImages(files, token, { live = false, precision = false } = {}) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const controller = new AbortController();
  const timeout = live || precision ? setTimeout(() => controller.abort(), live ? 20000 : 60000) : null;
  const started = performance.now();
  let response;
  try {
    if (live) console.debug('[Live OCR] request sent');
    response = await fetch(`${API_URL}/api/v1/ocr/extract${live ? '?live=true' : ''}`, { method: 'POST', headers: authHeaders(token), body: formData, signal: controller.signal });
    const result = await readResponse(response, 'OCR extraction failed for the uploaded images.');
    if (live) console.debug('[Live OCR] response received', { elapsedMs: Math.round(performance.now() - started), server: result.timing });
    return result;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(live ? 'Live OCR timed out. Keep the declaration panel in the guide and try the next clear frame.' : 'OCR timed out. Retained values are unchanged; try a clearer image.');
    throw error instanceof TypeError ? new Error('The OCR service is not reachable. Confirm that the backend on port 8000 is running.') : error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function groupBulkImages(files, token) {
  const formData = new FormData(); files.forEach((file) => formData.append('files', file));
  let response;
  try { response = await fetch(`${API_URL}/api/v1/ocr/bulk-group`, { method: 'POST', headers: authHeaders(token), body: formData }); }
  catch { throw new Error('The bulk OCR service is not reachable. Confirm that the backend on port 8000 is running.'); }
  return readResponse(response, 'Bulk image grouping failed.');
}

export async function lookupBarcode(code, token) {
  const response = await fetch(`${API_URL}/api/v1/products/barcode/${encodeURIComponent(code)}`, { headers: authHeaders(token) });
  return readResponse(response, 'Barcode product lookup failed.');
}

export async function downloadReportPdf(report, token) {
  const response = await fetch(`${API_URL}/api/v1/reports/pdf`, { method: 'POST', headers: authHeaders(token, true), body: JSON.stringify(report) });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || 'The PDF report could not be generated.');
  }
  return response.blob();
}
