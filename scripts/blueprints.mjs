#!/usr/bin/env node
import { BLUEPRINT_NAMES, compileBlueprint } from '../src/local/blueprints.mjs';
const name = process.argv[2];
if (!name || name === 'list') console.log(BLUEPRINT_NAMES.join('\n'));
else {
  try { console.log(JSON.stringify(compileBlueprint(name, {locale: process.argv.includes('--en') ? 'en-US' : 'zh-CN'}), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode=1; }
}
