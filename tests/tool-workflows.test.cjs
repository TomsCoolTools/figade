const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');

function setup(page='index.html', script='app.js', scenario={}) {
  const dom=new JSDOM(fs.readFileSync(path.join('_site',page),'utf8'),{runScripts:'outside-only',url:'http://localhost:8080/'});
  const w=dom.window;
  const state={disposed:0, revoked:[],executions:0,conversions:[],closedBitmaps:0,draws:[],events:[]};
  w.matchMedia=()=>({matches:true});
  w.HTMLElement.prototype.scrollIntoView=function(){};
  w.HTMLMediaElement.prototype.pause=function(){};
  w.HTMLMediaElement.prototype.load=function(){};
  let urls=0;
  w.URL.createObjectURL=()=>`blob:test-${++urls}`;
  w.URL.revokeObjectURL=url=>state.revoked.push(url);
  w.VideoEncoder=function(){};
  w.goatcounter={count:event=>state.events.push(event)};
  class Input {
    constructor({source}){this.source=source;}
    async getPrimaryVideoTrack(){
      if(this.source.file.name==='broken.mp4')throw new Error('Unreadable test video');
      return {type:'video',codec:scenario.codec||'avc',displayWidth:640,displayHeight:360,
        canDecode:async()=>true,computePacketStats:async()=>({averagePacketRate:30})};
    }
    async getPrimaryAudioTrack(){return scenario.noAudio?null:{type:'audio',codec:scenario.audioCodec||'aac'};}
    async computeDuration(){return 12;}
    dispose(){state.disposed++;}
  }
  class Output {constructor({target}){this.target=target;}}
  w.Mediabunny={Input,Output,BlobSource:class {constructor(file){this.file=file;}},ALL_FORMATS:[],
    Mp4OutputFormat:class {},BufferTarget:class {},Conversion:{
      async init(options) {
        const {output}=options;
        const dropAudio=scenario.lostAudio || (scenario.fallback && state.conversions.length===0);
        const conv={options,isValid:true,discardedTracks:dropAudio?[{track:{type:'audio',codec:'aac'},reason:scenario.fallback?'no_encodable_target_codec':'undecodable_source_codec'}]:[],
          utilizedTracks:[{type:'video'},...(dropAudio||scenario.noAudio?[]:[{type:'audio'}])],
          async execute(){
            state.executions++; conv.onProgress?.(0.4);
            if(scenario.gate)await new Promise((resolve,reject)=>{conv.finish=resolve;conv.reject=reject;});
            output.target.buffer=new ArrayBuffer(scenario.outputSize||900000);conv.onProgress?.(1);
          },
          async cancel(){if(conv.reject){const e=new Error('Cancelled');e.name='ConversionCanceledError';conv.reject(e);}}
        };
        state.conversions.push(conv);return conv;
      }
    }};
  w.createImageBitmap=async()=>({width:800,height:600,close:()=>state.closedBitmaps++});
  w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},drawImage(...args){state.draws.push(args.slice(1))}});
  w.HTMLCanvasElement.prototype.toBlob=function(callback,type){setTimeout(()=>callback(new w.Blob([new Uint8Array(scenario.imageSize||80000)],{type})),scenario.imageDelay||0)};
  w.eval(fs.readFileSync('static/js/file-options.js','utf8'));
  w.eval(fs.readFileSync('static/js/tool-ui.js','utf8'));
  w.eval(fs.readFileSync(`static/js/${script}`,'utf8'));
  const $=id=>w.document.getElementById(id);
  const choose=async(name='clip.mp4',type='video/mp4')=>{
    const file=new w.File([new Uint8Array(2000000)],name,{type});
    Object.defineProperty($('file'),'files',{value:[file],configurable:true});
    await $('file').onchange();return file;
  };
  return {w,$,state,choose,close:()=>dom.window.close()};
}
async function until(predicate){for(let n=0;n<100;n++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,5));}throw new Error('Timed out waiting for workflow');}

test('destination presets and manual sizes stay synchronized with accessible chips',()=>{
  const t=setup();
  t.$('destination').value='discord';t.$('destination').onchange();
  assert.equal(t.$('mb').value,'20');
  assert.equal(t.w.document.querySelector('[data-mb="20"]').getAttribute('aria-pressed'),'true');
  t.$('destination').value='whatsapp';t.$('destination').onchange();assert.equal(t.$('mb').value,'16');
  t.$('mb').value='25';t.$('mb').oninput();
  assert.equal(t.$('destination').value,'');assert.equal(t.w.document.querySelector('[data-mb="25"]').getAttribute('aria-pressed'),'true');t.close();
});
test('video compression renders a fitting result and prominent audio-loss warning',async()=>{
  const t=setup('index.html','app.js',{lostAudio:true});await t.choose();t.$('mb').value='1';await t.$('go').onclick();
  assert.match(t.$('st').textContent,/no sound/);assert.match(t.$('out').querySelector('.notice').textContent,/Sound was removed/);
  assert.match(t.$('out').textContent,/Removed/);assert.match(t.$('out').textContent,/55.0%/);
  assert.equal(t.$('out').querySelector('a').download,'clip-1mb.mp4');assert.equal(t.$('file').disabled,false);assert.equal(t.$('bar').hidden,true);
  assert.ok(t.state.disposed>=2);t.close();
});
test('active video job locks settings, ignores replacement files, and can be cancelled',async()=>{
  const t=setup('index.html','app.js',{gate:true});await t.choose();const pending=t.$('go').onclick();
  await until(()=>t.state.executions===1);
  assert.equal(t.$('file').disabled,true);assert.equal(t.$('mb').disabled,true);assert.equal(t.$('destination').disabled,true);
  assert.equal(t.$('bar').getAttribute('aria-valuenow'),'40');assert.equal(t.$('cancel').hidden,false);
  await t.choose('other.mp4');assert.match(t.$('file-summary').textContent,/clip.mp4/);
  await t.$('cancel').onclick();await pending;
  assert.match(t.$('st').textContent,/Cancelled/);assert.equal(t.$('file').disabled,false);assert.equal(t.$('out').childElementCount,0);assert.equal(t.$('cancel').hidden,true);t.close();
});
test('cancellation during preparation also prevents an output',async()=>{
  const t=setup();await t.choose();const pending=t.$('go').onclick();await t.$('cancel').onclick();await pending;
  assert.equal(t.state.executions,0);assert.match(t.$('st').textContent,/Cancelled/);t.close();
});
test('invalid sizes and unreadable replacement files cannot use the previous result',async()=>{
  const t=setup();await t.choose();t.$('mb').value='0';await t.$('go').onclick();assert.match(t.$('st').textContent,/at least 1 MB/);assert.equal(t.state.executions,0);
  t.$('mb').value='1';await t.$('go').onclick();assert.ok(t.$('out').childElementCount);
  await t.choose('broken.mp4');assert.equal(t.$('out').childElementCount,0);assert.match(t.$('st').textContent,/Unreadable/);assert.equal(t.state.revoked.length,1);t.close();
});
test('result names are inserted as attributes rather than interpreted as HTML',async()=>{
  const t=setup();await t.choose('a"<&.mp4');await t.$('go').onclick();
  assert.equal(t.$('out').querySelector('a').download,'a"<&-10mb.mp4');assert.equal(t.$('out').querySelectorAll('script').length,0);t.close();
});
test('converter exposes audio loss and recovers controls after cancellation',async()=>{
  const t=setup('convert-video-to-mp4.html','convert.js',{lostAudio:true});await t.choose();await t.$('go').onclick();
  assert.match(t.$('out').textContent,/Sound was removed/);assert.match(t.$('st').textContent,/no sound/);t.close();
  const c=setup('convert-video-to-mp4.html','convert.js',{gate:true});await c.choose();const pending=c.$('go').onclick();
  await until(()=>c.state.executions===1);await c.$('cancel').onclick();await pending;assert.match(c.$('st').textContent,/Cancelled/);assert.equal(c.$('file').disabled,false);c.close();
});
test('converter audio fallback preserves the result and disposes both inputs',async()=>{
  const t=setup('convert-video-to-mp4.html','convert.js',{fallback:true});await t.choose();await t.$('go').onclick();
  assert.equal(t.state.conversions.length,2);assert.match(t.$('out').textContent,/Included/);assert.equal(t.$('out').querySelector('.notice'),null);assert.ok(t.state.disposed>=3);t.close();
});
test('image workflow produces JPG under target, locks controls, and releases resources on reset',async()=>{
  const t=setup('compress-image.html','image.js',{imageDelay:20});await t.choose('photo.png','image/png');
  const pending=t.$('go').onclick();assert.equal(t.$('file').disabled,true);assert.equal(t.$('kb').disabled,true);
  await pending;assert.match(t.$('st').textContent,/under 100 KB/);assert.equal(t.$('out').querySelector('a').download,'photo-100kb.jpg');assert.match(t.$('out').textContent,/metadata/);
  t.$('reset').onclick();assert.equal(t.state.closedBitmaps,1);assert.equal(t.state.revoked.length,1);assert.equal(t.$('out').childElementCount,0);t.close();
});
test('rapid image reselection releases the previous bitmap',async()=>{
  const t=setup('compress-image.html','image.js');await t.choose('first.png','image/png');await t.choose('second.png','image/png');assert.equal(t.state.closedBitmaps,1);assert.match(t.$('file-summary').textContent,/second.png/);t.close();
});
test('every generated page has a main landmark, valid local links, and loaded shared UI where needed',()=>{
  const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);
  const pages=walk('_site').filter(p=>p.endsWith('.html'));
  assert.ok(pages.length > 0);
  for(const file of pages){
    const dom=new JSDOM(fs.readFileSync(file,'utf8'));const d=dom.window.document;
    assert.ok(d.querySelector('main#main'),file);
    for(const link of d.querySelectorAll('a[href^="/"],script[src^="/"],link[href^="/"]')){
      const href=(link.getAttribute('href')||link.getAttribute('src')).split(/[?#]/)[0];
      const resolved=path.join('_site',href);
      assert.ok([resolved,resolved+'.html',path.join(resolved,'index.html')].some(p=>fs.existsSync(p)),`${file}: ${href}`);
    }
    if(d.querySelector('.tool')){
      assert.ok(d.querySelector('script[src^="/js/tool-ui.js"]'),file);
      assert.ok(d.querySelector('label[for="file"]'),file);
      for(const chip of d.querySelectorAll('.chip'))assert.ok(['true','false'].includes(chip.getAttribute('aria-pressed')));
    }
    dom.window.close();
  }
});


test('trimmed duration controls the bitrate budget and is applied on every attempt',async()=>{
  const t=setup();await t.choose();t.$('mb').value='1';t.$('trim-start').value='0:02';t.$('trim-end').value='0:06';
  t.$('trim-end').oninput();assert.match(t.$('trim-preview').textContent,/4.00s kept/);
  await t.$('go').onclick();
  const options=t.state.conversions[0].options;
  assert.equal(options.trim.start,2);assert.equal(options.trim.end,6);
  assert.equal(options.video.bitrate,1816000); // 94% of 1 MB over 4 seconds, minus 64 kbps audio.
  assert.equal(Object.keys(options.tags).length,0);
  assert.equal(t.$('out').querySelector('a').download,'clip-trimmed-1mb.mp4');
  assert.match(t.$('out').textContent,/Kept section/);assert.match(t.$('out').textContent,/Fits under 1 MB/);t.close();
});
test('invalid trim range focuses the field and never starts encoding',async()=>{
  const t=setup();await t.choose();t.$('trim-start').value='7';t.$('trim-end').value='4';await t.$('go').onclick();
  assert.equal(t.state.executions,0);assert.match(t.$('st').textContent,/after start/);assert.equal(t.$('trim-options').open,true);
  assert.equal(t.w.document.activeElement.id,'trim-end');t.close();
});
test('exact image dimensions keep the requested box and letterbox without stretching',async()=>{
  const t=setup('compress-image.html','image.js');await t.choose('photo.png','image/png');
  t.$('image-width').value='300';t.$('image-height').value='300';t.$('image-height').oninput();assert.equal(t.$('image-fit').disabled,false);
  await t.$('go').onclick();const image=t.$('out').querySelector('img');assert.equal(image.width,300);assert.equal(image.height,300);
  assert.deepEqual(t.state.draws[0],[0,37.5,300,225]);assert.match(t.$('out').textContent,/Fits under 100 KB/);t.close();
});
test('crop-to-fill uses centered geometry without changing exact output dimensions',async()=>{
  const t=setup('compress-image.html','image.js');await t.choose('photo.png','image/png');
  t.$('image-width').value='300';t.$('image-height').value='300';t.$('image-fit').value='cover';await t.$('go').onclick();
  assert.deepEqual(t.state.draws[0],[-50,0,400,300]);assert.match(t.$('out').textContent,/Edges are cropped/);t.close();
});
test('one image dimension preserves proportions; an impossible size refuses silent downscaling',async()=>{
  const t=setup('compress-image.html','image.js');await t.choose('photo.png','image/png');
  t.$('image-width').value='400';t.$('image-width').oninput();await t.$('go').onclick();assert.equal(t.$('out').querySelector('img').height,300);assert.equal(t.$('image-fit').disabled,true);t.close();
  const f=setup('compress-image.html','image.js',{imageSize:200000});await f.choose('photo.png','image/png');
  f.$('image-width').value='400';f.$('image-height').value='300';await f.$('go').onclick();
  assert.equal(f.$('out').childElementCount,0);assert.match(f.$('st').textContent,/Increase the KB limit/);
  assert.equal(f.$('image-width').value,'400');assert.equal(f.$('file').disabled,false);f.close();
});
test('analytics outcomes contain no file names, bytes or processing settings',async()=>{
  const t=setup();await t.choose('private-trip.mp4');t.$('trim-end').value='5';await t.$('go').onclick();
  assert.ok(t.state.events.length>0);
  for(const event of t.state.events){assert.deepEqual(Object.keys(event).sort(),['event','path','title']);assert.equal(event.path,event.title);assert.ok(!JSON.stringify(event).includes('private-trip'));}
  t.close();
});
test('verification hashes match every script in the generated build',()=>{
  const crypto=require('node:crypto');const manifest=JSON.parse(fs.readFileSync('_site/file-verification.json','utf8'));
  assert.equal(manifest.algorithm,'SHA-256');assert.equal(manifest.files.length,6);
  for(const file of manifest.files){const data=fs.readFileSync(path.join('_site',file.url));assert.equal(crypto.createHash('sha256').update(data).digest('hex'),file.sha256);}
});

// Exercise the real generated template and default controls on every tool URL.
for (const entry of fs.readdirSync('_site').filter(name=>name.endsWith('.html'))) {
  const document = new JSDOM(fs.readFileSync(path.join('_site',entry),'utf8')).window.document;
  const kind=document.querySelector('.tool')?.dataset.tool;
  if (!kind) continue;
  test(`complete and reset the ${kind} workflow on /${entry}`,async()=>{
    const t=setup(entry,kind==='image'?'image.js':kind==='convert'?'convert.js':'app.js',kind==='image'?{imageSize:10000}:{});
    try {
      await t.choose(kind==='image'?'sample.png':'sample.mp4',kind==='image'?'image/png':'video/mp4');
      assert.ok(t.w.document.querySelector('.tool-controls').contains(t.$('go')));
      assert.ok(t.w.document.querySelector('.result-pane').contains(t.$('out')));
      await t.$('go').onclick();
      const result=t.$('out').querySelector('.result');assert.ok(result,'Result produced');
      assert.ok(t.w.document.querySelector('.tool.has-result'));
      assert.ok(result.querySelector('a[download]'));assert.equal(result.querySelector('.result-details').open,false);
      assert.equal(t.$('reset').hidden,false);
      t.$('reset').onclick();assert.equal(t.$('out').childElementCount,0);
      assert.equal(t.$('reset').hidden,true);assert.ok(!t.w.document.querySelector('.tool.has-result'));
      assert.ok(!t.w.document.querySelector('.tool.has-file'));assert.equal(t.$('file').disabled,false);
    } finally {t.close();}
  });
}
