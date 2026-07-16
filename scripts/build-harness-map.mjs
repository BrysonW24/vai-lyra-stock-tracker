#!/usr/bin/env node
/**
 * Nervous-system map generator - renders the repo's own rails as a browsable page.
 *
 * Parses SKILL-CHAIN.md (the chains table + the coverage map between the chain-coverage
 * markers) and HARNESS.md (the enforcement layers + the deterministic-gates table + the
 * agent operating contract) into:
 *   - src/lib/generated/harness-map.json  (tracked; programmatic use)
 *   - public/harness-map.html             (served at /harness-map.html; a self-contained,
 *                                          interactive viewer - click a chain to focus the
 *                                          sections it owns, or filter by text)
 *
 * Deterministic: no timestamps, no network, same inputs -> byte-identical outputs, so it
 * rides the content pipeline (predev / prebuild / pretype-check) and can never go stale
 * relative to SKILL-CHAIN.md / HARNESS.md. Mirrors the docs -> generated pattern used by
 * the Setup Companion and the knowledge layer.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const cleanMd = (s) =>
  String(s)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// --- Parse SKILL-CHAIN.md ------------------------------------------------------------
function parseSkillChain(src) {
  // Chains: the table under "## The chains", up to the next "## " heading.
  const chainsBlock = src.split('## The chains')[1]?.split(/\n## /)[0] || '';
  const chains = [];
  for (const line of chainsBlock.split('\n')) {
    const m = line.match(/^\|\s*\[\/([a-z0-9-]+)\]\(([^)]+)\)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/i);
    if (m) chains.push({ id: m[1], file: m[2], runWhen: cleanMd(m[3]), job: cleanMd(m[4]) });
  }

  // Coverage: the table between the chain-coverage markers (same source the gate parses).
  const block = src.split('<!-- chain-coverage:begin -->')[1]?.split('<!-- chain-coverage:end -->')[0] || '';
  const sections = [];
  for (const line of block.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 5 || cells[1] === 'Section' || /^-+$/.test(cells[1].replace(/\s/g, '-'))) continue;
    const paths = [...cells[2].matchAll(/`([^`]+)`/g)].map((x) => x[1]);
    const owners = cells[3].split(',').map((c) => c.trim()).filter(Boolean);
    if (paths.length && owners.length) sections.push({ section: cells[1], paths, chains: owners });
  }
  return { chains, sections };
}

// --- Parse HARNESS.md ----------------------------------------------------------------
function collectBullets(body) {
  const items = [];
  let cur = null;
  for (const raw of body.split('\n')) {
    const t = raw.trim();
    const m = t.match(/^-\s+(.*)$/);
    if (m) {
      if (cur) items.push(cur);
      cur = m[1];
    } else if (t === '' || t.startsWith('|') || t.startsWith('#')) {
      if (cur) items.push(cur);
      cur = null;
    } else if (cur != null) {
      cur += ' ' + t;
    }
  }
  if (cur) items.push(cur);
  return items.map(cleanMd);
}

function parseHarness(src) {
  // Deterministic gates table (Layer 1).
  const gates = [];
  const gatesBlock = src.split('## Layer 1')[1]?.split(/\n## /)[0] || '';
  for (const line of gatesBlock.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 6 || cells[1] === 'Gate' || /^-+$/.test(cells[1].replace(/\s/g, '-'))) continue;
    gates.push({ name: cleanMd(cells[1]), command: cleanMd(cells[2]), enforces: cleanMd(cells[3]), runsIn: cleanMd(cells[4]) });
  }

  // Enforcement layers (heading + bullet items).
  const layers = [];
  const parts = src.split(/\n## /);
  for (const part of parts) {
    if (!/^Layer \d+ - /.test(part)) continue;
    const nl = part.indexOf('\n');
    const title = part.slice(0, nl).trim();
    layers.push({ title, items: collectBullets(part.slice(nl)) });
  }

  // Agent operating contract (numbered list).
  const contractBlock = src.split('## The agent operating contract')[1]?.split(/\n## /)[0] || '';
  const contract = [];
  for (const line of contractBlock.split('\n')) {
    const m = line.match(/^\d+\.\s+(.*)$/);
    if (m) contract.push(cleanMd(m[1]));
  }
  return { gates, layers, contract };
}

// --- Build ---------------------------------------------------------------------------
const skillChainSrc = readFileSync(join(root, 'SKILL-CHAIN.md'), 'utf8');
const harnessSrc = existsSync(join(root, 'HARNESS.md')) ? readFileSync(join(root, 'HARNESS.md'), 'utf8') : '';

const { chains, sections } = parseSkillChain(skillChainSrc);
const { gates, layers, contract } = parseHarness(harnessSrc);

const data = {
  source: ['SKILL-CHAIN.md', 'HARNESS.md'],
  stats: { sections: sections.length, chains: chains.length, gates: gates.length, layers: layers.length },
  chains,
  sections,
  gates,
  layers,
  contract,
};

const outDir = join(root, 'src', 'lib', 'generated');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'harness-map.json'), `${JSON.stringify(data, null, 2)}\n`);

// --- Render the viewer ---------------------------------------------------------------
const chainCards = chains
  .map(
    (c) => `      <button class="chain" data-chain="${escapeHtml(c.id)}" type="button" aria-pressed="false">
        <span class="cid">/${escapeHtml(c.id)}</span>
        <span class="cwhen">${escapeHtml(c.runWhen)}</span>
        <span class="cjob">${escapeHtml(c.job)}</span>
      </button>`,
  )
  .join('\n');

const areaCards = sections
  .map((s) => {
    const text = `${s.section} ${s.paths.join(' ')} ${s.chains.join(' ')}`.toLowerCase();
    const paths = s.paths.map((p) => `<code>${escapeHtml(p)}</code>`).join(' ');
    const owners = s.chains
      .map((c) => `<button class="badge" data-chain="${escapeHtml(c)}" type="button">/${escapeHtml(c)}</button>`)
      .join(' ');
    return `      <div class="area" data-chains="${escapeHtml(s.chains.join(' '))}" data-text="${escapeHtml(text)}">
        <div class="aname">${escapeHtml(s.section)}</div>
        <div class="apaths">${paths}</div>
        <div class="aowners">${owners}</div>
      </div>`;
  })
  .join('\n');

const gateRows = gates
  .map(
    (g) => `        <tr>
          <td class="gname">${escapeHtml(g.name)}</td>
          <td><code>${escapeHtml(g.command)}</code></td>
          <td>${escapeHtml(g.enforces)}</td>
          <td class="gruns">${escapeHtml(g.runsIn)}</td>
        </tr>`,
  )
  .join('\n');

const layerCards = layers
  .map(
    (l) => `      <div class="layer">
        <h3>${escapeHtml(l.title)}</h3>
        <ul>${l.items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
      </div>`,
  )
  .join('\n');

const contractList = contract.map((c) => `        <li>${escapeHtml(c)}</li>`).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lyra - nervous system</title>
<style>
  :root {
    --bg:#F7F6F2; --ink:#0E1E3A; --body:#5A6B82; --faint:#8290a0;
    --blue:#1E63FF; --blue-soft:#eaf1ff; --l1:#3b5bdb; --l2:#43d18b; --l3:#f3a33a;
    --border:rgba(14,30,58,.10); --card:rgba(255,255,255,.72); --green:#189a66; --green-soft:#e7f6ef;
  }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--ink); font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; padding:32px 20px 64px; }
  .mono { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
  .wrap { max-width:1020px; margin:0 auto; }
  header { display:flex; flex-direction:column; gap:4px; margin-bottom:6px; }
  .brand { display:flex; align-items:center; gap:10px; }
  .mark { width:30px; height:30px; border-radius:9px; background:linear-gradient(135deg,var(--l1),var(--l2),var(--l3)); }
  .brand b { font-size:20px; font-weight:700; }
  .brand .by { color:var(--body); font-size:12px; }
  h1 { font-size:28px; font-weight:700; letter-spacing:-.02em; margin-top:14px; }
  h1 .grad { background:linear-gradient(100deg,var(--l1),var(--l2),var(--l3)); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .sub { color:var(--body); max-width:70ch; margin-top:6px; }
  .stats { display:flex; flex-wrap:wrap; gap:8px; margin:18px 0 8px; }
  .stat { border:1px solid var(--border); background:rgba(255,255,255,.7); border-radius:999px; padding:5px 12px; font-size:12px; color:var(--body); }
  .stat b { color:var(--blue); }
  .toolbar { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin:18px 0 6px; position:sticky; top:0; background:var(--bg); padding:8px 0; z-index:5; }
  #filter { flex:1; min-width:200px; border:1px solid var(--border); border-radius:10px; padding:9px 12px; font:inherit; background:#fff; }
  #clear { border:1px solid var(--border); background:#fff; border-radius:10px; padding:9px 14px; cursor:pointer; font:inherit; color:var(--body); }
  .hint { color:var(--faint); font-size:12px; }
  .sec-label { font-size:11px; text-transform:uppercase; letter-spacing:.12em; color:var(--faint); margin:28px 0 12px; font-weight:700; }
  .chains { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:10px; }
  .chain { text-align:left; border:1px solid var(--border); background:var(--card); backdrop-filter:blur(10px); border-radius:12px; padding:12px 14px; cursor:pointer; display:flex; flex-direction:column; gap:4px; transition:border-color .15s, box-shadow .15s, transform .1s; }
  .chain:hover { transform:translateY(-1px); }
  .chain .cid { font-family:ui-monospace,Menlo,monospace; font-weight:700; color:var(--blue); font-size:13px; }
  .chain .cwhen { font-size:11.5px; color:var(--faint); }
  .chain .cjob { font-size:12.5px; color:var(--ink); }
  .chain.on { border-color:rgba(59,91,219,.55); box-shadow:0 0 0 1px rgba(67,209,139,.3), 0 14px 34px rgba(59,91,219,.14); }
  .areas { display:flex; flex-direction:column; gap:9px; }
  .area { border:1px solid var(--border); background:var(--card); backdrop-filter:blur(10px); border-radius:12px; padding:12px 14px; }
  .area.dim { opacity:.28; }
  .area.hide { display:none; }
  .aname { font-weight:650; font-size:14px; }
  .apaths { margin:6px 0; display:flex; flex-wrap:wrap; gap:5px; }
  .apaths code, .layer code, td code { font-family:ui-monospace,Menlo,monospace; font-size:11.5px; background:#fff; border:1px solid var(--border); border-radius:6px; padding:1px 6px; color:var(--body); }
  .aowners { display:flex; flex-wrap:wrap; gap:6px; }
  .badge { font-family:ui-monospace,Menlo,monospace; font-size:11px; font-weight:700; border:1px solid #cdddff; color:var(--blue); background:var(--blue-soft); border-radius:999px; padding:2px 9px; cursor:pointer; }
  .badge.on { background:var(--green-soft); border-color:#c3e8d5; color:var(--green); }
  table { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
  th, td { text-align:left; padding:9px 12px; font-size:12.5px; border-bottom:1px solid var(--border); vertical-align:top; }
  th { background:#fff; font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:var(--faint); }
  tr:last-child td { border-bottom:none; }
  .gname { font-weight:650; } .gruns { color:var(--body); }
  .layers { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:10px; margin-top:12px; }
  .layer { border:1px solid var(--border); background:var(--card); backdrop-filter:blur(10px); border-radius:12px; padding:13px 15px; }
  .layer h3 { font-size:13.5px; margin-bottom:8px; }
  .layer ul, .contract ol { padding-left:18px; }
  .layer li, .contract li { font-size:12.5px; color:var(--body); margin:5px 0; }
  .contract { border-left:3px solid var(--l2); background:var(--green-soft); border-radius:0 10px 10px 0; padding:12px 16px; margin-top:12px; }
  footer { color:var(--faint); font-size:11.5px; margin-top:34px; border-top:1px solid var(--border); padding-top:14px; }
  @media (prefers-reduced-motion: reduce) { .chain { transition:none; } .chain:hover { transform:none; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand"><span class="mark"></span><b>Lyra</b><span class="by">nervous system · by Vivacity.ai</span></div>
  </header>
  <h1>How this repo <span class="grad">keeps itself honest</span>.</h1>
  <p class="sub">Every part of the codebase has an owning maintenance chain, and a set of deterministic gates
  that fail loudly on drift. This map is generated straight from SKILL-CHAIN.md and HARNESS.md - it cannot lie
  about the rails, because it is built from them.</p>

  <div class="stats">
    <span class="stat"><b>${data.stats.sections}</b> mapped sections</span>
    <span class="stat"><b>${data.stats.chains}</b> skill chains</span>
    <span class="stat"><b>${data.stats.gates}</b> deterministic gates</span>
    <span class="stat"><b>${data.stats.layers}</b> enforcement layers</span>
    <span class="stat"><b>0</b> orphans <span class="hint">(CI-enforced)</span></span>
  </div>

  <div class="toolbar">
    <input id="filter" type="search" placeholder="Filter sections by name, path, or chain..." aria-label="Filter sections">
    <button id="clear" type="button">Clear</button>
    <span class="hint" id="focushint">Tip: click a chain to focus the sections it owns.</span>
  </div>

  <p class="sec-label">The chains - staged, gate-checked maintenance playbooks</p>
  <div class="chains">
${chainCards}
  </div>

  <p class="sec-label">Coverage map - every section, its paths, and its owning chain(s)</p>
  <div class="areas" id="areas">
${areaCards}
  </div>

  <p class="sec-label">Layer 1 - deterministic gates (a red gate is a fact)</p>
  <table>
    <thead><tr><th>Gate</th><th>Command</th><th>Enforces</th><th>Runs in</th></tr></thead>
    <tbody>
${gateRows}
    </tbody>
  </table>

  <p class="sec-label">Enforcement layers</p>
  <div class="layers">
${layerCards}
  </div>

  <p class="sec-label">The agent operating contract</p>
  <div class="contract"><ol>
${contractList}
  </ol></div>

  <footer>Generated by scripts/build-harness-map.mjs from SKILL-CHAIN.md + HARNESS.md. Regenerate: <span class="mono">npm run content:build</span>. Lyra is research software, not financial advice.</footer>
</div>

<script>
(function () {
  var areas = Array.prototype.slice.call(document.querySelectorAll('.area'));
  var chains = Array.prototype.slice.call(document.querySelectorAll('.chain'));
  var badges = Array.prototype.slice.call(document.querySelectorAll('.badge'));
  var filter = document.getElementById('filter');
  var clearBtn = document.getElementById('clear');
  var hint = document.getElementById('focushint');
  var active = '';

  function apply() {
    var q = (filter.value || '').trim().toLowerCase();
    areas.forEach(function (a) {
      var owns = !active || (' ' + a.getAttribute('data-chains') + ' ').indexOf(' ' + active + ' ') !== -1;
      var matches = !q || a.getAttribute('data-text').indexOf(q) !== -1;
      a.classList.toggle('hide', !matches);
      a.classList.toggle('dim', matches && active && !owns);
    });
    chains.forEach(function (c) {
      var on = active && c.getAttribute('data-chain') === active;
      c.classList.toggle('on', !!on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    badges.forEach(function (b) { b.classList.toggle('on', active && b.getAttribute('data-chain') === active); });
    hint.textContent = active ? ('Focused: /' + active + ' - click it again to clear.') : 'Tip: click a chain to focus the sections it owns.';
  }
  function focusChain(id) { active = active === id ? '' : id; apply(); }

  chains.forEach(function (c) { c.addEventListener('click', function () { focusChain(c.getAttribute('data-chain')); }); });
  badges.forEach(function (b) { b.addEventListener('click', function () { focusChain(b.getAttribute('data-chain')); }); });
  filter.addEventListener('input', apply);
  clearBtn.addEventListener('click', function () { filter.value = ''; active = ''; apply(); filter.focus(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { filter.value = ''; active = ''; apply(); } });
})();
</script>
</body>
</html>
`;

writeFileSync(join(root, 'public', 'harness-map.html'), html);
console.log(
  `harness-map: ${data.stats.sections} sections, ${data.stats.chains} chains, ${data.stats.gates} gates -> src/lib/generated/harness-map.json + public/harness-map.html`,
);
