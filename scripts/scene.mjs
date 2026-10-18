#!/usr/bin/env node
/** Minimal dependency-free CLI for scene format authoring and validation. */
import { readFile } from 'node:fs/promises';
import { composeTemplate, flattenScene, normalizeScene, TEMPLATE_NAMES } from '../src/visual/scene.mjs';
const [command,...rest]=process.argv.slice(2);
try {
  if (command==='list') {
    for (const t of TEMPLATE_NAMES) process.stdout.write(`${t}\n`);
  } else if (command==='template') {
    const [name,xs,ys,label=''] = rest;
    const x=Number(xs),y=Number(ys);
    if (!xs || !ys || !Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('Usage: scene.mjs template <name> <DIP-x> <DIP-y> [label]');
    process.stdout.write(JSON.stringify(composeTemplate(name,[{x,y,label}]),null,2)+'\n');
  } else if (command==='validate') {
    if (rest.length!==1) throw new TypeError('Usage: scene.mjs validate <file.json>');
    const scene=normalizeScene(JSON.parse(await readFile(rest[0],'utf8')));
    process.stdout.write(`VALID scene v${scene.version} · ${scene.layers.length} layers · ${flattenScene(scene).length} visible marks\n`);
  } else throw new TypeError('Usage: scene.mjs list | template <name> <x> <y> [label] | validate <scene.json>');
} catch (error) { console.error(`Scene error: ${error.message}`); process.exitCode=1; }
