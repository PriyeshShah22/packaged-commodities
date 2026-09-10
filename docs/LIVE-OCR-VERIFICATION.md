# Live OCR recovery and staged extraction

The camera still uses RapidOCR and the existing declaration mapper. No UI redesign or synthetic OCR output is introduced.

- Capture locking happens before asynchronous encoding or barcode work.
- Barcode detection/catalogue lookup cannot delay the OCR request.
- Whole-frame OCR is returned first; the same captured image receives the existing comprehensive recognition pass through a bounded, serial background queue.
- Empty OCR responses are unsuccessful and do not suppress retries as duplicate sides.
- Encoding, live requests and background refinement have failure/timeout recovery. Normal uploaded-image requests retain their existing timeout behavior.
- Raw text does not require a predefined field label. Low-confidence mapped values do not overwrite retained declarations.
- Switching product tabs remounts camera state so duplicate signatures and callbacks do not carry into another product.
- The frame guide is not a crop: package-edge declarations are included in OCR.

## Verification and limits

Backend regressions cover primary-text delivery before precision processing; frontend tests cover empty responses, confidence filtering and stalled encoding recovery. The production build is checked.

A headless browser replay of two real package photographs exercised the video capture path, real authenticated OCR requests and multi-side field retention, including a deliberately non-responsive barcode detector. This is not a physical webcam test. Repeat runs use the existing image cache and must not be presented as cold OCR benchmarks.

Measured upright-photo processing before staging: 2.69 s primary OCR plus 4.20 s stamped-field recognition, approximately 7.05 s request time. Browser replay timings varied substantially (including a 15.35 s uncached primary OCR call), and the 1–2 s physical capture / few-second extraction target is not certified. Physical camera quality, machine load and full precision accuracy still need testing with an officer presenting packages.

## Inventory test file

`output/product-listing/PackMetrix-20-FULLY-FILLED-TEST-ONLY.csv` contains 20 fully populated **synthetic** test records, explicitly approved for testing. All names are prefixed TEST ONLY. Barcode/FSSAI/contact values are mock data, not registered identities or real contact details. It includes varied valid price formats and deliberate date-review scenarios. It is never seeded into application data automatically and must not be used as a real compliance record.
