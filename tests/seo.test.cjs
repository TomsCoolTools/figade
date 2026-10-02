const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {JSDOM}=require('jsdom');
const pages=fs.readdirSync('_site',{recursive:true}).filter(p=>p.endsWith('.html')).map(file=>({file,document:new JSDOM(fs.readFileSync('_site/'+file,'utf8')).window.document}));
const indexed=pages.filter(p=>!p.document.querySelector('meta[name=robots]').content.includes('noindex'));
test('production indexable pages have unique titles, descriptions and canonical URLs',()=>{
 for(const selector of ['title','meta[name=description]','link[rel=canonical]']){
  const values=indexed.map(p=>{const n=p.document.querySelector(selector);assert.ok(n,p.file);const v=n.content||n.href||n.textContent;assert.ok(v.trim(),p.file);return v;});assert.equal(new Set(values).size,values.length,selector);
 }
 for(const p of indexed){const c=p.document.querySelector('link[rel=canonical]').href;assert.ok(c.startsWith('https://figade.com/'));assert.ok(!c.endsWith('.html'));assert.ok(!c.includes('?'));}
});
test('sitemap contains every indexable canonical exactly once and excludes the error page',()=>{
 const xml=new JSDOM(fs.readFileSync('_site/sitemap.xml','utf8'),{contentType:'text/xml'}).window.document;
 const urls=[...xml.querySelectorAll('loc')].map(n=>n.textContent);
 assert.deepEqual(urls.slice().sort(),indexed.map(p=>p.document.querySelector('link[rel=canonical]').href).sort());assert.equal(new Set(urls).size,urls.length);
 for(const date of xml.querySelectorAll('lastmod')){assert.match(date.textContent,/^\d{4}-\d{2}-\d{2}$/);assert.ok(new Date(date.textContent)<=new Date());}
 const error=pages.find(p=>p.file==='404.html');assert.ok(!error.document.querySelector('link[rel=canonical]'));assert.ok(!urls.some(u=>u.includes('/404')));
});
test('every indexable page can be reached through ordinary HTML links from home',()=>{
 const map=new Map(indexed.map(p=>[p.document.querySelector('link[rel=canonical]').href,p]));const seen=new Set(),queue=['https://figade.com/'];
 while(queue.length){const u=queue.shift();if(seen.has(u))continue;seen.add(u);const p=map.get(u);assert.ok(p,u);
  for(const link of p.document.querySelectorAll('a[href]')){const target=new URL(link.getAttribute('href'),u);target.hash='';if(map.has(target.href)&&!seen.has(target.href))queue.push(target.href);}
 }
 assert.deepEqual([...seen].sort(),[...map.keys()].sort());
});
test('guides identify their real author in visible text and Article metadata',()=>{
 for(const p of pages.filter(p=>p.file.startsWith('guides/')&&p.file!=='guides/index.html')){
  assert.equal(p.document.querySelector('.guide-byline a').textContent,'Tom');assert.equal(p.document.querySelector('.guide-byline a').getAttribute('href'),'/about');
  const article=[...p.document.querySelectorAll('script[type="application/ld+json"]')].map(n=>JSON.parse(n.textContent)).find(n=>n['@type']==='Article');assert.equal(article.author.url,'https://figade.com/about');
 }
});
