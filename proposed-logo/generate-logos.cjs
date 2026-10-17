const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUT_DIR = path.resolve(__dirname);
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

// -------------------------------------------------------------
// 1. SVG TEMPLATES
// -------------------------------------------------------------

// Concept A: The Ledger Droplet
function getSvgLogoA(bgType = 'transparent') {
  const isDark = bgType === 'dark';
  const isWhite = bgType === 'white';

  const bgColor = isDark ? '#0C281E' : isWhite ? '#FFFFFF' : 'none';
  const pillarColor1 = isDark ? '#FFFFFF' : '#1B4332';
  const pillarColor2 = isDark ? '#E8F5E9' : '#0F281E';
  const swooshColor1 = isDark ? '#10B981' : '#1B5E20';
  const swooshColor2 = isDark ? '#34D399' : '#2D6A4F';
  const swooshColor3 = isDark ? '#6EE7B7' : '#34D399';
  const goldPipColor = isDark ? '#FBBF24' : '#F59E0B';
  const glossColor = isDark ? '#FFFFFF' : '#FFFFFF';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="aPillar_${bgType}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${pillarColor1}" />
      <stop offset="100%" stop-color="${pillarColor2}" />
    </linearGradient>

    <linearGradient id="aSwoosh_${bgType}" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${swooshColor1}" />
      <stop offset="50%" stop-color="${swooshColor2}" />
      <stop offset="100%" stop-color="${swooshColor3}" />
    </linearGradient>

    <linearGradient id="aGloss_${bgType}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${glossColor}" stop-opacity="${isDark ? '0.9' : '0.85'}" />
      <stop offset="100%" stop-color="#A7F3D0" stop-opacity="0.2" />
    </linearGradient>

    <filter id="aShadow_${bgType}" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#051810" flood-opacity="${isDark ? '0.4' : '0.2'}" />
    </filter>
  </defs>

  ${bgColor !== 'none' ? `<rect width="512" height="512" rx="96" fill="${bgColor}" />` : ''}

  <!-- Left: The Solid Ledger Pillar (Grounded Stability & Bookkeeping Records) -->
  <path d="M 256,48 C 218,135 116,238 116,338 C 116,420 178,464 252,464 C 218,460 174,424 174,342 C 174,262 226,162 256,48 Z"
        fill="url(#aPillar_${bgType})" filter="url(#aShadow_${bgType})" />

  <!-- Right: The Dynamic Milk Checkmark / Growth Swoosh (Fresh Dairy & Financial Accuracy) -->
  <path d="M 194,366 C 226,408 250,432 268,432 C 326,432 396,386 396,322 C 396,242 328,152 256,48 C 298,156 342,242 342,312 C 342,352 298,382 252,364 C 230,355 210,354 194,366 Z"
        fill="url(#aSwoosh_${bgType})" filter="url(#aShadow_${bgType})" />

  <!-- Accent: The Golden Ledger Pip (Accounting Checkpoint / Cream Quality) -->
  <circle cx="212" cy="386" r="14" fill="${goldPipColor}" opacity="0.95" />

  <!-- Upper-Left Gloss Highlight (Fresh Morning Milk Specular Luster) -->
  <path d="M 182,185 C 160,230 152,275 158,318 C 165,278 178,238 198,198 Z"
        fill="url(#aGloss_${bgType})" />
</svg>`;
}

// Concept B: The Pasture Crest
function getSvgLogoB(bgType = 'transparent') {
  const isDark = bgType === 'dark';
  const isWhite = bgType === 'white';
  const bgColor = isDark ? '#0C281E' : isWhite ? '#FFFFFF' : 'none';
  const primaryColor = isDark ? '#FFFFFF' : '#1B5E20';
  const accentColor = isDark ? '#34D399' : '#2D6A4F';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${bgColor !== 'none' ? `<rect width="512" height="512" rx="96" fill="${bgColor}" />` : ''}

  <!-- Cow Crest Outline -->
  <path d="M 180,120 C 140,80 120,90 110,130 C 100,170 140,200 170,220 C 160,260 170,320 210,350 L 302,350 C 342,320 352,260 342,220 C 372,200 412,170 402,130 C 392,90 372,80 332,120 C 290,100 222,100 180,120 Z"
        fill="${primaryColor}" />

  <!-- Open Ledger Book Base -->
  <path d="M 140,370 C 190,360 240,375 256,390 C 272,375 322,360 372,370 L 380,420 C 330,410 276,425 256,440 C 236,425 182,410 132,420 Z"
        fill="${accentColor}" />

  <!-- Forehead Milk Drop Marking -->
  <path d="M 256,150 C 244,175 236,195 236,210 C 236,222 245,232 256,232 C 267,232 276,222 276,210 C 276,195 268,175 256,150 Z"
        fill="#FFFFFF" />
</svg>`;
}

// Concept C: The Dairy Seal
function getSvgLogoC(bgType = 'transparent') {
  const isDark = bgType === 'dark';
  const isWhite = bgType === 'white';
  const bgColor = isDark ? '#0C281E' : isWhite ? '#FFFFFF' : 'none';
  const sealColor = isDark ? '#FFFFFF' : '#1B4332';
  const canColor = isDark ? '#34D399' : '#2D6A4F';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${bgColor !== 'none' ? `<rect width="512" height="512" rx="96" fill="${bgColor}" />` : ''}

  <!-- Circular Financial Seal Ring -->
  <circle cx="256" cy="256" r="210" fill="none" stroke="${sealColor}" stroke-width="20" />
  <circle cx="256" cy="256" r="185" fill="none" stroke="${sealColor}" stroke-width="4" stroke-dasharray="12,12" />

  <!-- Traditional Milk Canister Profile -->
  <path d="M 220,130 L 292,130 L 292,160 L 326,200 L 326,350 C 326,365 314,375 300,375 L 212,375 C 198,375 186,365 186,350 L 186,200 L 220,160 Z"
        fill="${canColor}" />

  <!-- Balance Equality Bars (Accounting Reconciliation) -->
  <rect x="226" y="260" width="60" height="14" rx="7" fill="#FFFFFF" />
  <rect x="226" y="290" width="60" height="14" rx="7" fill="#FFFFFF" />
</svg>`;
}

// Full Brand Lockup with Text (Logo A + "Dairy Diary" + "Milk Ledger & Billing")
function getSvgFullBrandA() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 240" width="800" height="240">
  <!-- Droplet Mark -->
  <g transform="translate(20, 10) scale(0.42)">
    ${getSvgLogoA('transparent').replace(/<\/?svg[^>]*>/g, '')}
  </g>

  <!-- Typography -->
  <text x="260" y="115" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="58" font-weight="900" fill="#1B4332" letter-spacing="-1">
    Dairy Diary
  </text>
  <text x="262" y="158" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="700" fill="#2D6A4F" letter-spacing="0.5">
    MILK LEDGER &amp; BILLING
  </text>
  <rect x="262" y="180" width="240" height="4" rx="2" fill="#10B981" />
</svg>`;
}

// -------------------------------------------------------------
// 2. GENERATE SVG FILES
// -------------------------------------------------------------
console.log('Generating SVG vector files in proposed-logo/...');

const filesToWrite = {
  // Concept A (Chosen Primary)
  'logo-a-transparent.svg': getSvgLogoA('transparent'),
  'logo-a-white.svg': getSvgLogoA('white'),
  'logo-a-dark-green.svg': getSvgLogoA('dark'),
  'logo-a-full-brand.svg': getSvgFullBrandA(),

  // Concept B (Variation 2)
  'logo-b-transparent.svg': getSvgLogoB('transparent'),
  'logo-b-white.svg': getSvgLogoB('white'),
  'logo-b-dark-green.svg': getSvgLogoB('dark'),

  // Concept C (Variation 3)
  'logo-c-transparent.svg': getSvgLogoC('transparent'),
  'logo-c-white.svg': getSvgLogoC('white'),
  'logo-c-dark-green.svg': getSvgLogoC('dark'),
};

for (const [filename, content] of Object.entries(filesToWrite)) {
  fs.writeFileSync(path.join(OUT_DIR, filename), content.trim(), 'utf-8');
  console.log(`✓ Created: ${filename}`);
}

// -------------------------------------------------------------
// 3. RENDER PNG FILES VIA HEADLESS BROWSER
// -------------------------------------------------------------
console.log('\nRendering PNG raster files at 512x512, 192x192, 48x48...');

const SIZES = [
  { size: 512, suffix: '512x512' },
  { size: 192, suffix: '192x192' },
  { size: 48,  suffix: '48x48' }
];

const VARIANTS = ['transparent', 'white', 'dark-green'];

for (const variant of VARIANTS) {
  const svgFilename = `logo-a-${variant}.svg`;
  const svgPath = path.join(OUT_DIR, svgFilename).replace(/\\/g, '/');

  for (const { size, suffix } of SIZES) {
    const pngFilename = `logo-a-${suffix}-${variant}.png`;
    const pngPath = path.join(OUT_DIR, pngFilename);

    // Create an exact HTML wrapper to ensure pixel-perfect rendering without margin
    const htmlWrapper = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${size}px; height: ${size}px; overflow: hidden; background: ${variant === 'transparent' ? 'transparent' : variant === 'white' ? '#FFFFFF' : '#0C281E'}; }
  img { width: ${size}px; height: ${size}px; display: block; }
</style>
</head>
<body>
  <img src="file:///${svgPath}" />
</body>
</html>`;

    const htmlTempPath = path.join(OUT_DIR, `temp-${size}-${variant}.html`);
    fs.writeFileSync(htmlTempPath, htmlWrapper, 'utf-8');

    try {
      const cmd = `"${EDGE_PATH}" --headless --disable-gpu --default-background-color=00000000 --window-size=${size},${size} --screenshot="${pngPath}" "file:///${htmlTempPath.replace(/\\/g, '/')}"`;
      execSync(cmd, { stdio: 'pipe' });
      console.log(`✓ Rendered: ${pngFilename} (${size}x${size})`);
    } catch (err) {
      console.error(`Error rendering ${pngFilename}:`, err.message);
    } finally {
      if (fs.existsSync(htmlTempPath)) fs.unlinkSync(htmlTempPath);
    }
  }
}

// -------------------------------------------------------------
// 4. GENERATE PREVIEW SHOWCASE HTML
// -------------------------------------------------------------
console.log('\nGenerating visual showcase preview.html...');

const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dairy Diary — Proposed Logo Showcase</title>
<style>
  :root {
    --forest: #1B4332;
    --emerald: #2D6A4F;
    --mint: #E8F5E9;
    --dark: #0C281E;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
  body { background: #081a13; color: #f1f5f9; padding: 32px 16px; min-height: 100vh; }
  .container { max-width: 1080px; margin: 0 auto; }
  header { text-align: center; margin-bottom: 40px; }
  h1 { font-size: 28px; font-weight: 800; color: #FFFFFF; }
  p.subtitle { color: #86efac; font-size: 14px; margin-top: 6px; }

  .badge { display: inline-block; background: rgba(52, 211, 153, 0.15); border: 1px solid rgba(52, 211, 153, 0.3); color: #6ee7b7; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; margin-bottom: 12px; }

  .card { background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 24px; padding: 28px; margin-bottom: 32px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
  .card h2 { font-size: 20px; font-weight: 800; color: #FFFFFF; margin-bottom: 8px; }
  .card p.desc { font-size: 13px; color: #cbd5e1; margin-bottom: 24px; line-height: 1.5; }

  .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
  .preview-box { border-radius: 16px; padding: 24px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.1); }
  .preview-box.white { background: #FFFFFF; color: #0f172a; border-color: #e2e8f0; }
  .preview-box.dark { background: #0C281E; color: #FFFFFF; border-color: rgba(52, 211, 153, 0.2); }
  .preview-box.transparent { background: repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 16px 16px; }

  .box-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; opacity: 0.8; }
  .preview-box.white .box-label { color: #475569; }

  .size-row { display: flex; align-items: center; justify-content: center; gap: 24px; margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); }
  .preview-box.white .size-row { border-top-color: #f1f5f9; }
  .size-item { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .size-label { font-size: 10px; font-weight: 600; opacity: 0.7; }

  .full-brand { text-align: center; padding: 24px; background: #FFFFFF; border-radius: 16px; margin-top: 20px; }
  .full-brand img { max-width: 100%; height: auto; }
</style>
</head>
<body>
<div class="container">
  <header>
    <div class="badge">CHOSEN PRIMARY LOGO CONCEPT</div>
    <h1>Dairy Diary — Brandmark Design Showcase</h1>
    <p class="subtitle">Concept A: "The Ledger Droplet" (Milk Drop + Accounting Verification Checkmark)</p>
  </header>

  <!-- CONCEPT A PRIMARY SHOWCASE -->
  <div class="card">
    <h2>Logo Concept A — "The Ledger Droplet"</h2>
    <p class="desc">
      Combines a pure milk droplet with an upward-ascending financial verification checkmark.
      The left pillar represents balance sheet solidity and daily logging stability (#1B4332), while the right swoosh symbolizes dairy growth and production yield (#2D6A4F to #34D399).
    </p>

    <div class="grid-3">
      <!-- 1. White Background -->
      <div class="preview-box white">
        <div class="box-label">On White (Invoices &amp; Receipts)</div>
        <img src="logo-a-512x512-white.png" width="180" height="180" alt="Logo A White" />
        <div class="size-row">
          <div class="size-item">
            <img src="logo-a-192x192-white.png" width="64" height="64" alt="192px" />
            <span class="size-label">192×192</span>
          </div>
          <div class="size-item">
            <img src="logo-a-48x48-white.png" width="32" height="32" alt="48px" />
            <span class="size-label">48×48 Favicon</span>
          </div>
        </div>
      </div>

      <!-- 2. Dark Green Background -->
      <div class="preview-box dark">
        <div class="box-label">On Dark Green (App Header &amp; Splash)</div>
        <img src="logo-a-512x512-dark-green.png" width="180" height="180" alt="Logo A Dark Green" />
        <div class="size-row">
          <div class="size-item">
            <img src="logo-a-192x192-dark-green.png" width="64" height="64" alt="192px" />
            <span class="size-label">192×192</span>
          </div>
          <div class="size-item">
            <img src="logo-a-48x48-dark-green.png" width="32" height="32" alt="48px" />
            <span class="size-label">48×48 Favicon</span>
          </div>
        </div>
      </div>

      <!-- 3. Transparent Background -->
      <div class="preview-box transparent">
        <div class="box-label">Transparent (Vector SVG &amp; PNG)</div>
        <img src="logo-a-512x512-transparent.png" width="180" height="180" alt="Logo A Transparent" />
        <div class="size-row">
          <div class="size-item">
            <img src="logo-a-192x192-transparent.png" width="64" height="64" alt="192px" />
            <span class="size-label">192×192</span>
          </div>
          <div class="size-item">
            <img src="logo-a-48x48-transparent.png" width="32" height="32" alt="48px" />
            <span class="size-label">48×48 Favicon</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Full Brand Lockup with Text -->
    <div class="full-brand">
      <div class="box-label" style="color: #475569; margin-bottom: 8px;">Horizontal Brand Lockup (Header / PDF Letterhead)</div>
      <img src="logo-a-full-brand.svg" alt="Dairy Diary Full Brand" style="max-height: 120px;" />
    </div>
  </div>

  <!-- OTHER CONCEPTS (FOR REFERENCE) -->
  <div class="card" style="opacity: 0.9;">
    <h2>Additional Proposed Concepts (Reference Variations)</h2>
    <p class="desc">As mandated by Warning 9, here are the vector marks for Concept B and Concept C.</p>
    <div style="display: flex; gap: 24px; flex-wrap: wrap; justify-content: center;">
      <div style="text-align: center; background: rgba(255,255,255,0.05); padding: 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); width: 220px;">
        <img src="logo-b-transparent.svg" width="120" height="120" alt="Logo B" />
        <h4 style="font-size: 13px; font-weight: 700; margin-top: 12px;">Concept B</h4>
        <span style="font-size: 11px; opacity: 0.7;">The Pasture Crest</span>
      </div>

      <div style="text-align: center; background: rgba(255,255,255,0.05); padding: 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); width: 220px;">
        <img src="logo-c-transparent.svg" width="120" height="120" alt="Logo C" />
        <h4 style="font-size: 13px; font-weight: 700; margin-top: 12px;">Concept C</h4>
        <span style="font-size: 11px; opacity: 0.7;">The Dairy Seal</span>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;

fs.writeFileSync(path.join(OUT_DIR, 'preview.html'), previewHtml, 'utf-8');
console.log('✓ Created: preview.html');
console.log('\nAll logo files generated successfully in proposed-logo/!');
