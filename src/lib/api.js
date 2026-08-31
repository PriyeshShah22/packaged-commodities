const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

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

export async function extractImages(files, token) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  let response;
  try { response = await fetch(`${API_URL}/api/v1/ocr/extract`, { method: 'POST', headers: authHeaders(token), body: formData }); }
  catch { throw new Error('The OCR service is not reachable. Confirm that the backend on port 8000 is running.'); }
  return readResponse(response, 'OCR extraction failed for the uploaded images.');
}

export async function groupBulkImages(files, token) {
  const formData = new FormData(); files.forEach((file) => formData.append('files', file));
  let response;
  try { response = await fetch(`${API_URL}/api/v1/ocr/bulk-group`, { method: 'POST', headers: authHeaders(token), body: formData }); }
  catch { throw new Error('The bulk OCR service is not reachable. Confirm that the backend on port 8000 is running.'); }
  return readResponse(response, 'Bulk image grouping failed.');
}

export async function downloadReportPdf(report, token) {
  const response = await fetch(`${API_URL}/api/v1/reports/pdf`, { method: 'POST', headers: authHeaders(token, true), body: JSON.stringify(report) });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || 'The PDF report could not be generated.');
  }
  return response.blob();
}
