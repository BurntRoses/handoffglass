import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=dirname(fileURLToPath(import.meta.url));
const server=http.createServer(async(req,res)=>{
 if(req.url!=='/'&&req.url!=='/index.html'){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'self'; style-src 'unsafe-inline' 'self'; script-src 'unsafe-inline' 'self'"});
 res.end(await readFile(join(dir,'index.html')));
});
server.listen(4173,'127.0.0.1',()=>console.log('Local product demo: http://127.0.0.1:4173'));
