/**
 * Génère docs/ARCHITECTURE.pdf depuis ARCHITECTURE.md
 * Les 3 diagrammes SVG sont inlinés directement dans le PDF.
 * Usage : node docs/gen_pdf.js
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { marked }   = require('marked');

const ROOT   = path.join(__dirname, '..');
const MD     = path.join(ROOT, 'ARCHITECTURE.md');
const HTML   = path.join(__dirname, '_arch_tmp.html');
const OUTPUT = path.join(__dirname, 'ARCHITECTURE.pdf');

// ── 1. Lire le markdown ─────────────────────────────────────────────────────
let md = fs.readFileSync(MD, 'utf8');

// ── 2. Remplacer les références PNG par les SVG inline ──────────────────────
//    ![text](docs/diagN_name.png)  →  <div class="diagram">…SVG…</div>
md = md.replace(/!\[([^\]]*)\]\(docs\/(diag\d+_\w+)\.png\)/g, (_, alt, name) => {
  const svgPath = path.join(__dirname, name + '.svg');
  if (!fs.existsSync(svgPath)) return `<p><em>[Diagramme manquant : ${name}]</em></p>`;
  const svg = fs.readFileSync(svgPath, 'utf8');
  // Ajouter width=100% au SVG pour qu'il s'adapte à la page
  const svgResponsive = svg.replace(/<svg /, '<svg style="width:100%;height:auto;display:block;margin:12px auto;" ');
  return `<div class="diagram">${svgResponsive}</div>`;
});

// ── 3. Supprimer les blocs <details> SVG source (déjà inlinés) ──────────────
md = md.replace(/<details>[\s\S]*?<\/details>/g, '');

// ── 4. Supprimer les blocs ```svg … ``` résiduels ───────────────────────────
md = md.replace(/```svg[\s\S]*?```/g, '');

// ── 5. Convertir markdown → HTML ────────────────────────────────────────────
const body = marked(md);

// ── 6. Assembler le HTML complet ─────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>WC2026 — Architecture</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11px;
    line-height: 1.55;
    color: #1e293b;
    padding: 20mm 18mm;
    background: white;
  }
  h1 {
    font-size: 22px;
    color: #0c447c;
    border-bottom: 2px solid #378ADD;
    padding-bottom: 6px;
    margin: 0 0 16px 0;
    page-break-before: auto;
  }
  h2 {
    font-size: 15px;
    color: #085041;
    border-left: 4px solid #1D9E75;
    padding-left: 8px;
    margin: 22px 0 10px 0;
    page-break-after: avoid;
  }
  h3 {
    font-size: 12px;
    color: #26215C;
    margin: 14px 0 6px 0;
    page-break-after: avoid;
  }
  h4 {
    font-size: 11px;
    color: #412402;
    margin: 10px 0 4px 0;
  }
  p { margin: 4px 0 8px 0; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 14px 0; }
  code {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 3px;
    padding: 1px 4px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 9.5px;
    color: #0f172a;
  }
  pre {
    background: #0f172a;
    color: #e2e8f0;
    border-radius: 6px;
    padding: 10px 12px;
    overflow: hidden;
    margin: 8px 0 12px 0;
    font-size: 8.5px;
    line-height: 1.5;
    page-break-inside: avoid;
  }
  pre code {
    background: none;
    border: none;
    color: #e2e8f0;
    font-size: 8.5px;
    padding: 0;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 8px 0 12px 0;
    font-size: 10px;
    page-break-inside: avoid;
  }
  th {
    background: #1e40af;
    color: white;
    padding: 5px 8px;
    text-align: left;
    font-weight: 600;
  }
  td {
    padding: 4px 8px;
    border-bottom: 1px solid #e2e8f0;
  }
  tr:nth-child(even) td { background: #f8fafc; }
  ul, ol { margin: 4px 0 8px 16px; }
  li { margin: 2px 0; }
  blockquote {
    border-left: 3px solid #378ADD;
    background: #e6f1fb;
    padding: 6px 10px;
    margin: 8px 0;
    color: #185FA5;
    font-size: 10px;
    border-radius: 0 4px 4px 0;
  }
  .diagram {
    margin: 14px 0;
    text-align: center;
    page-break-inside: avoid;
  }
  .diagram svg { max-width: 100%; }
  strong { color: #0c447c; }
  a { color: #185FA5; text-decoration: none; }

  @media print {
    body { padding: 0; }
    h2 { page-break-before: auto; }
    .diagram { page-break-inside: avoid; }
    pre { page-break-inside: avoid; }
    table { page-break-inside: avoid; }
  }
</style>
</head>
<body>
${body}
</body>
</html>`;

fs.writeFileSync(HTML, html, 'utf8');
console.log('HTML intermédiaire écrit :', HTML);

// ── 7. Chrome headless → PDF ─────────────────────────────────────────────────
const chrome = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find(p => fs.existsSync(p));

if (!chrome) { console.error('Chrome introuvable'); process.exit(1); }

const cmd = [
  `"${chrome}"`,
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--run-all-compositor-stages-before-draw',
  `--print-to-pdf="${OUTPUT}"`,
  '--print-to-pdf-no-header',
  '--no-pdf-header-footer',
  `"file:///${HTML.replace(/\\/g,'/')}"`,
].join(' ');

console.log('Génération PDF via Chrome headless…');
try {
  execSync(cmd, { timeout: 30000, stdio: 'pipe' });
  const size = fs.statSync(OUTPUT).size;
  console.log(`PDF généré : ${OUTPUT} (${Math.round(size/1024)} Ko)`);
} catch (e) {
  console.error('Erreur Chrome:', e.message);
  process.exit(1);
} finally {
  fs.unlinkSync(HTML);
}
