#!/usr/bin/env node
/**
 * Byte-accurate model-visible RESPONSE footprint comparison; not an LLM tokenizer.
 * Run locally, with no network or model SDK dependency.
 */
import { Buffer } from 'node:buffer';
import { formatToolResult } from '../src/output.mjs';
const session={
  id:'550e8400-e29b-41d4-a716-446655440000', status:'awaiting_user',mode:'handoff',
  title:'Review permissions', message:'Please review requested access in your original application',
  annotations:[{id:'allow-target',x:900,y:450,shape:'ring',label:'Review the access scope',color:'#FFD264'}],
  timeoutAt:1790000000000, createdAt:1789999000000, updatedAt:1789999000000,
  completionSource:null,verified:false, visualStyle:'luminous', motion:'gentle',
  locale:'en-US',density:'normal',sceneRevision:1,
  scene:{version:1,layers:[{id:'focus',zIndex:20,visible:true,opacity:1,
    annotations:[{id:'allow-target',x:900,y:450,shape:'ring',label:'Review access',tone:'warning'}]}]}
};
const example={session,visible:true,coordinateSystem:'global_DIP',instruction:'A user report is not verification; check application state'};
const bytes=x=>Buffer.byteLength(JSON.stringify(x),'utf8');
const full=bytes(formatToolResult(example));
const compact=bytes(formatToolResult(example,{compact:true}));
const value={schemaVersion:1,scope:'synthetic MCP tool result JSON only',
  disclaimer:'Bytes are exact for this fixture, NOT tokenizer-based token counts or end-to-end model usage.',
  fullBytes:full,compactBytes:compact,savedBytes:full-compact,
  reductionPercent:Math.round((full-compact)*10000/full)/100,
  compactPreservesStatus:formatToolResult(example,{compact:true}).session.status === 'awaiting_user',
  compactPreservesVerification:formatToolResult(example,{compact:true}).session.verified === false};
console.log(JSON.stringify(value,null,2));
