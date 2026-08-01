// Pre-render an eval board's SVG charts into the HTML itself, then verify they are visible.
//
// Why this exists: the boards draw every chart with inline vanilla JS. That works in a real
// browser and in the published artifact, but any static viewer (preview snapshots, print,
// some mail clients) shows empty panels. This script executes the board's own chart code in
// a tiny DOM stub and injects the resulting SVG markup directly into each chart div, so the
// graphs are part of the document. The runtime script stays in place: when JS does run it
// re-renders identical markup and adds the hover tooltips.
//
// Usage:   node lyra-evals/boards/prerender-board.mjs <board.html>
// Exit 1 if any chart div ends up without an <svg> - a board must never ship with empty boxes.
import fs from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node prerender-board.mjs <board.html>");
  process.exit(1);
}
let html = fs.readFileSync(path, "utf8");

const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
if (!scriptMatch) {
  console.error("FAIL: no inline <script> block found in " + path);
  process.exit(1);
}

// Minimal DOM stub - just enough for the boards' chart code (getElementById + innerHTML).
const els = {};
globalThis.document = {
  getElementById: (id) => (els[id] = els[id] || { innerHTML: "", querySelectorAll: () => [] }),
};
globalThis.window = { innerWidth: 1200 };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => "" });

// The board script is trusted first-party code from this repo.
(0, eval)(scriptMatch[1]);

const chartIds = Object.keys(els).filter((id) => els[id].innerHTML.includes("<svg"));
if (chartIds.length === 0) {
  console.error("FAIL: the board script rendered no SVG charts at all");
  process.exit(1);
}

let injected = 0;
for (const id of chartIds) {
  const svg = els[id].innerHTML;
  if (svg.includes("NaN") || svg.includes("undefined")) {
    console.error(`FAIL: chart '${id}' contains NaN/undefined coordinates`);
    process.exit(1);
  }
  const divRe = new RegExp(`<div id="${id}">[\\s\\S]*?</div>`);
  if (!divRe.test(html)) {
    console.error(`FAIL: no <div id="${id}"> container found in the HTML body`);
    process.exit(1);
  }
  html = html.replace(divRe, `<div id="${id}">${svg}</div>`);
  injected += 1;
}

fs.writeFileSync(path, html);

// Final gate: re-read and prove every chart container now carries visible SVG.
const final = fs.readFileSync(path, "utf8");
for (const id of chartIds) {
  const m = final.match(new RegExp(`<div id="${id}">([\\s\\S]*?)</div>`));
  if (!m || !m[1].includes("<svg")) {
    console.error(`FAIL: chart '${id}' is still empty after injection`);
    process.exit(1);
  }
}
console.log(`OK: ${injected} charts pre-rendered into ${path}: ${chartIds.join(", ")}`);
