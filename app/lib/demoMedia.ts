// Deterministic faux evidence for the demo (Rob 2026-08-05): portrait "field
// photos" for events and shipping-label barcode scans for orders, generated
// as SVG data URIs at runtime so the repo carries no image assets and every
// label bakes in the order's real numbers. Replaced wholesale by real object
// storage in production.

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

// ── Field photo: 3:4 portrait, wall + door + damage marks, tinted by issue ──
const ISSUE_TINTS: Record<string, [string, string]> = {
  'Missing Hardware':   ['#8a8378', '#6e675c'],
  'Damaged Product':    ['#7d7268', '#5c5248'],
  'Wrong Product':      ['#75808a', '#57616b'],
  'Quality Issue':      ['#7e8578', '#5f665a'],
};

export function issuePhotoUri(eventId: string, issue: string, index: number): string {
  const r = rng(hash(`${eventId}_${index}`));
  const [wall, floor] = ISSUE_TINTS[issue] ?? ['#7f7f7f', '#5f5f5f'];
  const doorX = 60 + Math.floor(r() * 80);
  const doorW = 150 + Math.floor(r() * 60);
  const doorTint = 30 + Math.floor(r() * 40);
  const marks = Array.from({ length: 2 + Math.floor(r() * 3) }, () => {
    const x = doorX + 10 + r() * (doorW - 30);
    const y = 120 + r() * 280;
    const len = 20 + r() * 60;
    const ang = Math.floor(r() * 360);
    return `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${len.toFixed(0)}" height="3" rx="1.5" fill="#2b2320" opacity="0.55" transform="rotate(${ang} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
  }).join('');
  const glare = `<ellipse cx="${(doorX + doorW * r()).toFixed(0)}" cy="${(90 + r() * 120).toFixed(0)}" rx="70" ry="26" fill="#ffffff" opacity="0.08"/>`;
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480">
<defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${wall}"/><stop offset="1" stop-color="${floor}"/></linearGradient></defs>
<rect width="360" height="480" fill="url(#w)"/>
<rect y="404" width="360" height="76" fill="${floor}"/>
<rect x="${doorX}" y="56" width="${doorW}" height="352" rx="4" fill="rgb(${doorTint + 60},${doorTint + 50},${doorTint + 38})" stroke="#2f2a24" stroke-width="5"/>
<rect x="${doorX + 14}" y="80" width="${doorW - 28}" height="140" fill="rgb(${doorTint + 78},${doorTint + 70},${doorTint + 58})" opacity="0.7"/>
<rect x="${doorX + 14}" y="240" width="${doorW - 28}" height="140" fill="rgb(${doorTint + 78},${doorTint + 70},${doorTint + 58})" opacity="0.7"/>
<circle cx="${doorX + doorW - 26}" cy="238" r="7" fill="#1f1c18"/>
${marks}${glare}
<rect width="360" height="480" fill="#000000" opacity="${(0.04 + r() * 0.08).toFixed(2)}"/>
</svg>`);
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
