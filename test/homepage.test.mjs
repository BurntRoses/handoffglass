import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {translations} from '../site/translations.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
test('every UI translation has English, Chinese and Japanese copy',async()=>{
  const html=await readFile(join(root,'site/index.html'),'utf8');
  const keys=[...html.matchAll(/data-i18n="([a-zA-Z0-9._-]+)"/g)].map(x=>x[1]);
  assert.ok(keys.length>55,'site must have substantial internationalized content');
  const basis=Object.keys(translations.en).sort();
  for(const lang of ['en','zh','ja']){
    assert.deepEqual(Object.keys(translations[lang]).sort(),basis,`${lang} keys differ`);
    for(const key of keys)assert.ok(translations[lang][key]?.trim(),`${lang}: ${key}`);
  }
});
test('all referenced home-page assets and localized READMEs exist',async()=>{
  for(const name of ['README.md','README.zh-CN.md','README.ja.md','assets/brandmark.svg','assets/hero.svg','site/style.css','site/app.mjs','scripts/site-preview.mjs'])await access(join(root,name));
  for(const name of ['README.md','README.zh-CN.md','README.ja.md']){
    const contents=await readFile(join(root,name),'utf8');
    const links=[...contents.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)].map(x=>x[1]);
    for(const link of links)if(!/^https?:\/\//.test(link))await access(join(root,link));
    assert.ok(contents.includes('PolyForm'));
    assert.ok(contents.includes('(LICENSE)'));
    assert.ok(!contents.includes('UNLICENSED'));
  }
});
test('browser preview does not claim to be a desktop screenshot or published open-source package',async()=>{
  const html=await readFile(join(root,'site/index.html'),'utf8');
  const js=await readFile(join(root,'site/app.mjs'),'utf8');
  assert.match(html,/INTERACTIVE CONCEPT PREVIEW/);
  assert.doesNotMatch(html,/real screenshot|production release|fully verified/i);
  assert.doesNotMatch(js,/\beval\s*\(|\binnerHTML\s*=/);
});
test('local preview serves only website assets, never repository files',async()=>{
  const {spawn} = await import('node:child_process');
  const {once} = await import('node:events');
  const child=spawn(process.execPath,[join(root,'scripts/site-preview.mjs')],{
    cwd:root,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']
  });
  try{
    const port=await new Promise((accept,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('site preview startup timeout')),4000);
      child.stdout.on('data',buf=>{const m=buf.toString().match(/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(timeout);accept(Number(m[1]));}});
      child.on('error',reject);
      child.on('exit',code=>reject(new Error(`server exited ${code}`)));
    });
    const base=`http://127.0.0.1:${port}`;
    assert.equal((await fetch(base+'/site/index.html')).status,200);
    assert.equal((await fetch(base+'/assets/brandmark.svg')).status,200);
    assert.equal((await fetch(base+'/.env.example')).status,403);
    assert.equal((await fetch(base+'/package.json')).status,403);
    assert.equal((await fetch(base+'/site/index.html',{method:'POST'})).status,405);
  } finally {child.kill();if(child.exitCode===null)await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,1000))]);}
});
