import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const files=new Map([
 ['/', ['demo/index.html','text/html']], ['/index.html',['demo/index.html','text/html']],
 ['/demo.css',['demo/demo.css','text/css']], ['/assets/ui/tokens.css',['assets/ui/tokens.css','text/css']],
 ['/assets/ui/controls.css',['assets/ui/controls.css','text/css']]
]);
export async function startDemo({port=0}={}) {
const server=http.createServer(async(req,res)=>{
 const item=files.get(req.url);
 if(req.method!=='GET'||!item){res.writeHead(404).end();return;}
 try {const data=await readFile(resolve(root,item[0]));res.writeHead(200,{'content-type':item[1]+'; charset=utf-8','content-security-policy':"default-src 'self'; style-src 'self'; script-src 'unsafe-inline' 'self'",'X-Content-Type-Options':'nosniff'}).end(data);}
 catch {res.writeHead(500).end('Preview unavailable');}
});
await new Promise((accept,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',accept);});
return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const server=await startDemo({port:4173});console.log(`Local product demo: http://127.0.0.1:${server.address().port}`);
}
