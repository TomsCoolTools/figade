const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {JSDOM}=require('jsdom');const {spawn}=require('node:child_process');
const pages=fs.readdirSync('_site',{recursive:true}).filter(p=>p.endsWith('.html'));
const read=p=>new JSDOM(fs.readFileSync(path.join('_site',p),'utf8')).window.document;
function asset(url){const u=new URL(url,'https://figade.com');return path.join('_site',u.pathname);}
test('all pages have unique IDs, named navigation, titles, labels, and valid structured data',()=>{
 for(const page of pages){const d=read(page);const ids=[...d.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length,page);
  assert.equal(d.querySelectorAll('main').length,1,page);assert.equal(d.querySelectorAll('h1').length,1,page);
  assert.ok(d.title.trim(),page);assert.ok(d.querySelector('meta[name=description]').content.trim(),page);
  assert.equal(d.querySelector('nav').getAttribute('aria-label'),'Main navigation',page);
  for(const n of d.querySelectorAll('input,select')) assert.ok(d.querySelector(`label[for="${n.id}"]`),`${page}: ${n.id}`);
  for(const n of d.querySelectorAll('[aria-describedby]')) for(const id of n.getAttribute('aria-describedby').split(/\s+/))assert.ok(d.getElementById(id),`${page}: ${id}`);
  for(const s of d.querySelectorAll('script[type="application/ld+json"]'))assert.doesNotThrow(()=>JSON.parse(s.textContent),page);
  for(const img of d.querySelectorAll('img'))assert.ok(img.hasAttribute('alt'),page);
 }
});
test('all page assets exist and cache version strings match served bytes',()=>{
 for(const page of pages){const d=read(page);
  for(const n of d.querySelectorAll('script[src],link[href],img[src]')){
   const url=n.getAttribute('src')||n.getAttribute('href');if(!url.startsWith('/'))continue;
   const filename=asset(url);assert.ok(fs.existsSync(filename),`${page}: ${url}`);
   const v=new URL(url,'https://figade.com').searchParams.get('v');
   if(v)assert.equal(v,crypto.createHash('md5').update(fs.readFileSync(filename)).digest('hex').slice(0,8),`${page}: ${url}`);
  }
 }
});
test('wide reference pages and reading pages use the shared site shell',()=>{
 const css=fs.readFileSync('static/css/style.css','utf8');assert.match(css,/--width: 74rem/);assert.doesNotMatch(css,/--width: 44rem/);
 for(const page of pages){const d=read(page);if(d.querySelector('.tool')){
  assert.ok(d.querySelector('.workspace-page'),page);assert.ok(d.querySelector('.supporting'),page);assert.equal(d.querySelector('.supporting').open,false,page);
 }else assert.ok(d.querySelector('.reading-content,.reference-content'),page);}
 const guide=read('video-size-guide.html');assert.ok(guide.querySelector('.reference-content .tw[tabindex="0"]'));
 assert.equal(guide.querySelectorAll('tbody tr').length,7);assert.equal(guide.querySelectorAll('tbody td').length,28);
 assert.ok(read('guides/index.html').querySelector('.reference-content .guide-index'));
});
test('size guide matches the sizing filter and linked tool pages',()=>{
 const filters={};require('../eleventy.config.js')({addGlobalData(){},addFilter(k,f){filters[k]=f;},addPassthroughCopy(){},addCollection(){}});
 const d=read('video-size-guide.html');
 for(const row of d.querySelectorAll('tbody tr')){
  const mb=Number(row.querySelector('th').textContent.replace('MB',''));
  assert.deepEqual([...row.querySelectorAll('td')].map(n=>n.textContent),filters.fits(mb).map(f=>f.time));
  const target=read(path.basename(row.querySelector('a').getAttribute('href'))+'.html');assert.equal(Number(target.querySelector('#mb').value),mb);
 }
});
test('local server serves every page route and asset with correct types and handles missing routes',async()=>{
 const server=spawn(process.execPath,['scripts/serve-built.cjs'],{env:{...process.env,PORT:'8097'},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error(`server exited ${code}`)));});
  for(const page of pages){const route=page==='index.html'?'/':page.endsWith('/index.html')?'/'+page.slice(0,-10):'/'+page.replace(/\.html$/,'');
   const response=await fetch('http://127.0.0.1:8097'+route);assert.equal(response.status,200,route);
   assert.match(response.headers.get('content-type'),/^text\/html/);assert.equal(await response.text(),fs.readFileSync(path.join('_site',page),'utf8'));
  }
  const urls=new Set(pages.flatMap(page=>[...read(page).querySelectorAll('script[src],link[href],img[src]')].map(n=>n.getAttribute('src')||n.getAttribute('href')).filter(u=>u.startsWith('/'))));
  for(const url of urls){const r=await fetch('http://127.0.0.1:8097'+url);assert.equal(r.status,200,url);assert.deepEqual(Buffer.from(await r.arrayBuffer()),fs.readFileSync(asset(url)),url);}
  const r=await fetch('http://127.0.0.1:8097/no-such-page');assert.equal(r.status,404);assert.match(await r.text(),/Page not found|not found|404/i);
 }finally {server.kill();}
});
