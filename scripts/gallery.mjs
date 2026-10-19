#!/usr/bin/env node
/** Read-only, loopback-only preview server; deliberately does not expose arbitrary source paths. */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = new Map([
  ['/', ['examples/scene-gallery.html', 'text/html']],
  ['/examples/scene-gallery.css', ['examples/scene-gallery.css', 'text/css']],
  ['/examples/scene-gallery.js', ['examples/scene-gallery.js', 'text/javascript']],
  ['/src/visual/scene.mjs', ['src/visual/scene.mjs', 'text/javascript']],
  ['/src/desktop/overlay-renderer.mjs', ['src/desktop/overlay-renderer.mjs', 'text/javascript']],
  ['/src/desktop/overlay.css', ['src/desktop/overlay.css', 'text/css']]
]);
const srv=http.createServer(async(req,res)=>{
  const item=files.get(req.url);
  if(req.method!=='GET'||!item){res.writeHead(404).end();return;}
  try {const data=await readFile(resolve(root,item[0]));res.writeHead(200,{'Content-Type':item[1]+'; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; frame-ancestors 'none'"}).end(data);}
  catch{res.writeHead(500).end('Preview file unavailable');}
});
srv.listen(0,'127.0.0.1',()=>console.log(`HandoffGlass scene gallery: http://127.0.0.1:${srv.address().port}/`));
