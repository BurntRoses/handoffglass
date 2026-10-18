#!/usr/bin/env node
import { HOST_CAPABILITIES, hostStrategy } from '../src/hosts/capabilities.mjs';
const rows = Object.keys(HOST_CAPABILITIES).map(x=>({...hostStrategy(x), entry:HOST_CAPABILITIES[x].entry||null, nativePlugin:HOST_CAPABILITIES[x].nativePlugin||null}));
console.log(JSON.stringify(rows,null,2));
