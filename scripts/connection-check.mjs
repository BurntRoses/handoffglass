#!/usr/bin/env node
/** Standalone smoke uses isolated runtime, never opens a real overlay. */
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLocalMcp } from '../src/local/mcp-probe.mjs';
const entry=join(dirname(fileURLToPath(import.meta.url)),'..','src','mcp.mjs');
const result=await checkLocalMcp({command:process.execPath,entry});
console.log(JSON.stringify(result,null,2));
if(!result.ok)process.exitCode=1;
