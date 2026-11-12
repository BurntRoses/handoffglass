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


if(process.argv.includes('--tools')){
  const {Client}=await import('@modelcontextprotocol/client');
  const {StdioClientTransport}=await import('@modelcontextprotocol/client/stdio');
  const {fileURLToPath}=await import('node:url');
  const catalogs=[];
  for(const profile of ['full','host']){
    const c=new Client({name:'catalog-measure',version:'1'}),started=performance.now();
    try{
      await c.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../src/mcp.mjs',import.meta.url))],env:{...process.env,HANDOFFGLASS_TOOL_PROFILE:profile,HANDOFFGLASS_HEADLESS:'1'},stderr:'pipe'}));
      const tools=await c.listTools();
      catalogs.push({profile,tools:tools.tools.length,catalogBytes:bytes(tools),instructionsBytes:Buffer.byteLength(c.getInstructions()),initAndDiscoveryMs:+(performance.now()-started).toFixed(1)});
    }finally{await c.close();}
  }
  console.log(JSON.stringify({scope:'actual MCP initialize and tools/list, process startup included; no model calls',catalogs,reductionPercent:+((1-catalogs[1].catalogBytes/catalogs[0].catalogBytes)*100).toFixed(1)},null,2));
}
