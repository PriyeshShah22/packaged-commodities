# Live OCR recovery and staged extraction

The camera still uses RapidOCR and the existing declaration mapper. No UI redesign or synthetic OCR output is introduced.

- Capture locking prevents duplicate requests. Selected frames are encoded directly as JPEG at the same quality; this avoids Chromium's deferred `toBlob` callback timing out while video is rendering. Unselected samples are never JPEG-encoded.
- Live scanning and precision refinement omit barcode/QR detection and catalogue calls. Normal uploads retain that functionality.
- Whole-frame OCR is returned first. Detailed recognition of retained frames runs when Live OCR is paused, so it does not queue ahead of new camera sides. The 12-frame refinement limit pauses scanning explicitly instead of silently blocking capture. Turning the camera off/discarding its session cancels pending refinements; already extracted values remain.
- Empty OCR responses are unsuccessful and do not suppress retries as duplicate sides.
- Live requests and refinement have timeout recovery; duplicate live requests receive a retryable 429 while an earlier read is still running. Normal uploaded-image requests retain their existing timeout behavior.
- Raw text does not require a predefined field label. Low-confidence mapped values do not overwrite retained declarations.
- Switching product tabs remounts camera state so duplicate signatures and callbacks do not carry into another product.
- The frame guide is not a crop: package-edge declarations are included in OCR.

## Verification and limits

Backend regressions cover primary-text delivery before precision processing; frontend tests cover empty responses, confidence filtering and stalled encoding recovery. The production build is checked.

Camera startup requests an ideal 1080p stream without a hard minimum resolution, and optional autofocus does not block video startup. A cheap image-detail heuristic rejects near-uniform frames rather than treating ordinary white/black labels as glare. These heuristics cannot certify text sharpness; OCR confidence still controls retained fields.

The OCR executor shares one warmed model thread and ONNX/OpenCV use one CPU thread. This bounds model duplication and contention on the measured 2-core, 8 GB machine. It also serializes OCR jobs, including bulk uploads; this is a resource/throughput tradeoff, not a claim of faster bulk processing. Under heavy load, request queue time remains possible and is reported in image quality timing.

A headless browser replay of two real package photographs exercised the video capture path, real authenticated OCR requests and multi-side field retention, including a deliberately non-responsive barcode detector. This is not a physical webcam test. Repeat runs use the existing image cache and must not be presented as cold OCR benchmarks.

Measured upright-photo processing before staging: 2.69 s primary OCR plus 4.20 s stamped-field recognition, approximately 7.05 s request time. Browser replay timings varied substantially (including a 15.35 s uncached primary OCR call), and the 1–2 s physical capture / few-second extraction target is not certified. Physical camera quality, machine load and full precision accuracy still need testing with an officer presenting packages.

Latest verification (2026-09-10): a fresh, uncached real-photo API read returned 29 lines in 2.93 s (primary OCR 2.87 s). A two-side browser replay passed field accumulation and manufacturer retention with a deliberately hung barcode detector: first values in 3.64 s, encoding 104–185 ms, capture-to-request 8 ms. Both replay responses were cached and are **not** cold OCR speed measurements. Earlier uncached browser runs exceeded 20 s while available memory fell to about 129 MB; the physical webcam speed/accuracy acceptance test remains outstanding. No perfect-extraction or guaranteed seconds-level claim is made.

## Inventory test file

`output/product-listing/PackMetrix-20-FULLY-FILLED-TEST-ONLY.csv` contains 20 fully populated **synthetic** test records, explicitly approved for testing. All names are prefixed TEST ONLY. Barcode/FSSAI/contact values are mock data, not registered identities or real contact details. It includes varied valid price formats and deliberate date-review scenarios. It is never seeded into application data automatically and must not be used as a real compliance record.
