# Product Listing

New Inspection now offers a third mode: Product Listing. This imports actual store-supplied inventory; no catalogue, seeded products or generated product values are used.

1. Download the blank template in Product Listing.
2. Fill it with real inventory data and save as **CSV UTF-8**. Excel `.xlsx` files must first be saved as CSV. Up to 50 rows / 2 MB per batch.
3. Include units with pack size (for example, grams or litres). Dates accept day/month/year, ISO year-month-day, or month-year. Preserve barcode columns as text so leading zeroes survive spreadsheet export.
4. Upload and check the normalized preview. Unrecognized columns and original values are retained as source evidence. Invalid values are flagged; they are not silently replaced.
5. Analyze the listing. Each row gets an independent report through the existing Legal Metrology validator. Open a report for officer review or download the listing summary PDF.
6. Use Back to Product Listing or Reopen saved listing to resume. Completed rows are saved individually, allowing an interrupted analysis to resume.

## Scope and limitations

- Store declarations are not proof of what appears on a physical package. Missing/ambiguous values remain review items. No package coverage is claimed for CSV imports.
- A price alone does not establish the printed tax declaration. No manufacturing dates, expiry dates, manufacturer or GTIN are inferred from product names.
- This uses the existing rule-set and officer-review mechanism, not a new legal scoring system or a market-price database.
- Supplemental inventory-data review items flag invalid formats, future manufacture dates, elapsed best-before/use-by periods, and use-by dates before packing. These are data-quality/evidence review signals, not automatic statutory failures. Month-only dates retain month precision; relative shelf-life text is retained without inventing an absolute expiry.
- Persistence follows the existing application: browser-local storage, not server/cloud storage. It survives same-browser refresh and logout/login, but is not shared across devices and is lost if browser data is cleared. The most recent ten batches across bulk/listing are retained. Download reports for longer retention.
- Product Listing currently accepts CSV only. Row corrections should be made in the source CSV and reimported as a new batch; officer finding resolutions remain available in each report.

## Verification

`backend/tests/test_listing.py` covers parser errors, normalization, evidence preservation, row isolation, permissions, rule evaluation, and individual/summary PDFs. `node --test src/lib/reportStore.test.js` covers retained listing reports, officer decisions, cache eviction, reload and deletion.

`backend/tests/fixtures/listing-package-evidence.csv` is a test-only transcription of two package examples from the user's screenshots, not a shop inventory or a fabricated catalogue. Unknown manufacturer information is left blank. This fixture is never auto-imported or seeded into the application.
