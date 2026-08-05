// Deterministic faux evidence for the demo (Rob 2026-08-05): real field
// photos (Rob's optimized set in public/demo) dealt deterministically to
// events, and shipping-label barcode scans generated as SVG data URIs so
// every label bakes in the order's real numbers. Replaced wholesale by real
// object storage in production.

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = Math.imul(s, 48271) % 2147483647;
    return (s & 2147483647) / 2147483647;
  };
}

const svgUri = (svg: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

// ── Field photos: real optimized shots in public/demo, dealt
//    deterministically so each event keeps the same set forever ──
const FIELD_PHOTOS = Array.from({ length: 10 }, (_, i) => `/demo/field-${String(i + 1).padStart(2, '0')}.jpg`);

export function issuePhotoUri(eventId: string, _issue: string, index: number): string {
  return FIELD_PHOTOS[(hash(eventId) + index * 7) % FIELD_PHOTOS.length];
}

/** Deterministic photo count for a seeded event: most have a few, some none. */
export function seedPhotoCount(eventId: string): number {
  const h = hash(eventId) % 10;
  if (h < 3) return 0;          // 30% arrive photo-less
  return 1 + (h % 4);           // 1-4 photos otherwise
}

// ── Label scan: shipping-label card with Code-128-looking bars and the
//    order's real numbers ──
export function labelScanUri(jobNo: string, configId: string, partNumber: string): string {
  const r = rng(hash(jobNo + partNumber));
  let bars = '';
  let x = 26;
  while (x < 306) {
    const w = 1 + Math.floor(r() * 4);
    if (r() > 0.42) bars += `<rect x="${x}" y="176" width="${w}" height="64" fill="#141414"/>`;
    x += w + 1;
  }
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="332" height="300" viewBox="0 0 332 300">
<rect width="332" height="300" rx="6" fill="#f7f5f0" stroke="#c9c4bb" stroke-width="2"/>
<rect x="18" y="16" width="296" height="34" fill="#141414"/>
<text x="26" y="39" font-family="Arial, sans-serif" font-size="17" font-weight="bold" fill="#FFD20B">iQ QUALITY PARTS</text>
<text x="26" y="82" font-family="Courier New, monospace" font-size="15" font-weight="bold" fill="#141414">SO#: ${jobNo}</text>
<text x="26" y="106" font-family="Courier New, monospace" font-size="13" fill="#33302a">CONFIG: ${configId}</text>
<text x="26" y="130" font-family="Courier New, monospace" font-size="13" fill="#33302a">PART: ${partNumber}</text>
<line x1="18" y1="150" x2="314" y2="150" stroke="#c9c4bb" stroke-width="1.5"/>
${bars}
<text x="166" y="262" text-anchor="middle" font-family="Courier New, monospace" font-size="12" fill="#33302a">${jobNo}</text>
<text x="166" y="284" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="#8a857c">SCANNED AT SUBMISSION · iQ FIELD APP</text>
</svg>`);
}
