#!/usr/bin/env node
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,extname,relative,sep} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8'};
const port=Number(process.env.PORT||4288);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid PORT');
const server=createServer(async(req,res)=>{
  if(req.method!=='GET' && req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
  try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const decoded=decodeURIComponent(pathname);
    if(decoded.includes('\\')||decoded.includes('\0')){res.writeHead(400).end();return;}
    // The site server is a preview, not a repository file browser.
    if(decoded!=='/' && !/^\/(site|assets)\//.test(decoded)){res.writeHead(403).end();return;}
    const target=resolve(root,decoded==='/'?'site/index.html':'.'+decoded);
    const rel=relative(root,target);
    if(rel==='..'||rel.startsWith('..'+sep)||rel.startsWith(sep)){res.writeHead(403).end();return;}
    const st=await stat(target);
    if(!st.isFile()){res.writeHead(404).end();return;}
    const contents=await readFile(target);
    res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:contents);
  }catch{res.writeHead(404).end('Not found');}
});
server.listen(port,'127.0.0.1',()=>{
  console.log(`HandoffGlass site preview → http://127.0.0.1:${server.address().port}/site/index.html`);
});
