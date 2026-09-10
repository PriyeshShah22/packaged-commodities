// Raw OCR success is independent of whether a declaration label was mapped.
export function hasReadableText(data) {
  return (data?.images || []).some((image) => (image.lines || []).some((line) => String(line.text || '').trim()));
}

// Chromium can defer HTMLCanvasElement.toBlob to idle time while a live video
// and animated page are rendering. Encode only the selected frame immediately;
// keep the same pixels and JPEG quality rather than dropping image detail.
export function encodeCameraFrame(canvas) {
  const encoded = canvas.toDataURL('image/jpeg', .9);
  if (!encoded.startsWith('data:image/jpeg;base64,')) throw new Error('Camera frame is not ready. Try again.');
  const bytes = Uint8Array.from(atob(encoded.split(',')[1]), character => character.charCodeAt(0));
  if (!bytes.length) throw new Error('Camera returned an empty frame. Try again.');
  return new Blob([bytes], { type: 'image/jpeg' });
}

export function withDeadline(operation, milliseconds, message) {
  let timer;
  return Promise.race([
    Promise.resolve().then(operation),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); }),
  ]).finally(() => clearTimeout(timer));
}

// Blur is a whole-image heuristic: use field confidence instead of discarding
// every readable declaration because a plain/background region lowers detail.
export function reliableLiveFields(data) {
  return Object.fromEntries(Object.entries(data?.fields || {}).filter(([, evidence]) =>
    evidence?.value && Number(evidence.confidence || 0) >= .75));
}
