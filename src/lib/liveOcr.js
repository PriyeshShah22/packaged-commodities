// Raw OCR success is independent of whether a declaration label was mapped.
export function hasReadableText(data) {
  return (data?.images || []).some((image) => (image.lines || []).some((line) => String(line.text || '').trim()));
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
