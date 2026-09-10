import assert from 'node:assert/strict';
import test from 'node:test';
import { saveBulkBatch, saveReport, getReport, getReports, updateReport, getBulkBatch, deleteReport } from './reportStore.js';

test('listing reports and officer decisions survive cache eviction and module reload', async () => {
  const data = new Map();
  globalThis.localStorage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const report = { id: 'listing-row-1', batchId: 'batch-test', results: [{ rule_id: 'R1', outcome: 'REVIEW' }], status: 'REVIEW' };
  saveBulkBatch({ id: 'batch-test', mode: 'listing', groups: [{ id: 'row1', images: [], report }] });
  saveReport(report);
  updateReport(report.id, { results: [{ rule_id: 'R1', outcome: 'REVIEW', resolvedOutcome: 'COMPLIANT', reviewedBy: 'Test officer', reviewedAt: '2026-09-09T00:00:00Z', officerRemark: 'Evidence verified' }] });
  for (let i = 0; i < 65; i++) saveReport({ id: `other-${i}`, status: 'REVIEW', results: [] });
  const restored = await import('./reportStore.js?refresh-test');
  assert.equal(restored.getReport(report.id).results[0].officerRemark, 'Evidence verified');
  assert.equal(getReport(report.id).status, 'COMPLIANT');
  assert.equal(getReport(report.id).results[0].outcome, 'REVIEW');
  assert.equal(getBulkBatch('batch-test').groups[0].report.results[0].resolvedOutcome, 'COMPLIANT');
  assert.equal(getReports().filter((item) => item.id === report.id).length, 1);
  deleteReport(report.id);
  assert.equal(getReport(report.id), undefined);
  assert.equal(getBulkBatch('batch-test').groups[0].report, null);
});
