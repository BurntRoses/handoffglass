#!/usr/bin/env node
/** Tiny deterministic ESM -> classic renderer build, avoids Electron file:// ESM/CORS issues.
 * This source module deliberately exports only one function and has no imports.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const source = fileURLToPath(new URL('../src/desktop/overlay-renderer.mjs', import.meta.url));
const output = fileURLToPath(new URL('../src/desktop/overlay.js', import.meta.url));
let body = (await readFile(source,'utf8')).replace(/\r\n/g,'\n');
if ((body.match(/export function renderOverlay\(/g)||[]).length!==1 || /^\s*import\s/m.test(body)) {
  throw new Error('Unsupported overlay-renderer API; keep renderer self-contained or upgrade build-overlay.mjs');
}
body=body.replace('export function renderOverlay(', 'function renderOverlay(');
const bundled = `/* GENERATED — scripts/build-overlay.mjs; do not edit. */\n'use strict';\n${body}\nwindow.handoffglass?.onRender?.(snapshot => renderOverlay(document.getElementById('canvas'),snapshot));\n`;
if(process.argv.includes('--check')) {
  if((await readFile(output,'utf8')).replace(/\r\n/g,'\n')!==bundled) throw new Error('Desktop overlay bundle out of date: npm run build:overlay');
  console.log('Overlay bundle is current');
} else {
  await writeFile(output,bundled,'utf8');
  console.log('Built desktop overlay (zero third-party bundler dependencies)');
}
