#!/usr/bin/env node
/** Build a *local-development* WorkBuddy MCP+Skill connector. Never publish local paths. */
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareWorkbuddyBundle } from '../src/workbuddy-bundle.mjs';
const base=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const destination=process.argv[2] ? resolve(process.argv[2]) : join(base,'dist/workbuddy-local');
console.log(JSON.stringify({...await prepareWorkbuddyBundle(destination),mode:'local development only'},null,2));
