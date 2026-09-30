/* The compressor. It runs in the visitor's browser and uploads nothing.
   You normally do not need to edit this file. The page text lives in the .html files.
   If you change how resolutions are chosen (the 0.07 rule), the sentences like
   "stays at 720p up to about 74 seconds" in the pages and video-size-guide.html need updating too. */
const $=id=>document.getElementById(id),MB=1e6,fmt=b=>(b/MB).toFixed(2)+' MB',even=n=>Math.max(2,Math.round(n/2)*2);
const log=t=>{const l=$('log');l.textContent=(l.dataset.on?l.textContent+'\n':'')+t;l.dataset.on=1};
const status=(m,c)=>{$('st').textContent=m;$('st').className=c||''};
const bar=p=>{$('bar').style.display='block';$('bar').firstElementChild.style.width=Math.round(p*100)+'%'};
const mmss=s=>{s=Math.round(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};

let file=null,info=null,token=0,lastUrl=null,libP=null;
// Counts an event (e.g. a compression that worked) in GoatCounter when it is switched on in site.json.
// Only the event name is sent, never anything about the video.
const track=name=>{try{if(window.goatcounter&&window.goatcounter.count) window.goatcounter.count({path:name,title:name,event:true})}catch(e){}};

// ---- Encoder loading: this site first (js/mediabunny.mjs), then jsDelivr ----
const lib=()=>libP||(libP=loadLib().catch(e=>{libP=null;throw e}));
async function loadLib(){
  if(window.Mediabunny&&window.Mediabunny.Input) return window.Mediabunny;
  const tries=[['esm','/js/mediabunny.mjs'],['esm','https://cdn.jsdelivr.net/npm/mediabunny@1.44.1/+esm'],
    ['script','https://cdn.jsdelivr.net/npm/mediabunny@1.44.1/dist/bundles/mediabunny.min.cjs'],
    ['esm','https://cdn.jsdelivr.net/npm/mediabunny@1.21.1/+esm']],errs=[];
  for(const [k,u] of tries){
    try{
      if(k==='esm') window.Mediabunny=await import(u);
      else await new Promise((ok,no)=>{const s=document.createElement('script');s.src=u;s.onload=ok;s.onerror=()=>no(new Error('could not load'));document.head.appendChild(s)});
      if(window.Mediabunny&&window.Mediabunny.Input){log('Encoder loaded from '+u);return window.Mediabunny}
      errs.push(u+' (no Mediabunny object)');
    }catch(e){errs.push(u+' ('+(e.message||e)+')')}
  }
  throw new Error('The encoder could not be loaded. Check your connection and reload. Tried:\n'+errs.join('\n'));
}

// ---- Picking a resolution: highest one that still gets 0.07 bits per pixel ----
function plan(W,H,fps,vBps){
  const ss=Math.min(W,H),cands=[...new Set([Math.min(ss,1080),720,540,480,360,240].filter(s=>s<=ss))];
  const sc=cands.find(s=>vBps/((W*s/ss)*(H*s/ss)*fps)>=0.07)||cands[cands.length-1];
  return {w:even(W*sc/ss),h:even(H*sc/ss),sc};
}
// 50 or 60fps sources are brought down to 30 when the size is too small to keep 720p (or the source size) at full frame rate.
function pickFps(i,vBps){
  if(i.fps<=32) return i.fps;
  const top=Math.min(Math.min(i.W,i.H),720);
  return plan(i.W,i.H,i.fps,vBps).sc<top?30:i.fps;
}
const audioBps=(i,target)=>i.hasAudio?(target<=12*MB?64000:96000):0;
const startBps=(i,target)=>target*8*0.94/i.dur-audioBps(i,target);

// ---- Reading the file once, so the estimate and the compressor share it ----
async function inspect(f){
  const M=await lib();
  const inp=new M.Input({source:new M.BlobSource(f),formats:M.ALL_FORMATS});
  const vt=await inp.getPrimaryVideoTrack();
  if(!vt) throw new Error('No video track found in this file.');
  if(!(await vt.canDecode())) throw new Error('This browser cannot read this video format.');
  const dur=await inp.computeDuration(),at=await inp.getPrimaryAudioTrack();
  let fps=30;
  try{if(typeof vt.computePacketStats==='function'){const st=await vt.computePacketStats(150);if(st&&st.averagePacketRate>1&&st.averagePacketRate<250) fps=st.averagePacketRate}}catch(e){}
  if(!(dur>0)) throw new Error('Could not read the length of this video.');
  return {f,dur,W:vt.displayWidth,H:vt.displayHeight,fps,hasAudio:!!at};
}

function targetMB(){return parseFloat($('mb').value)}
function showEstimate(){
  const e=$('est');
  if(!info||info.f!==file){e.textContent='';return}
  const tMB=targetMB(),target=tMB*MB;
  const head=`${mmss(info.dur)} long, ${info.W}x${info.H}, ${Math.round(info.fps)}fps, ${fmt(info.f.size)}.`;
  if(!(target>0)){e.textContent=head;e.className='';return}
  const vBps=startBps(info,target);
  if(vBps<80000){e.textContent=`${head} Too long for ${tMB}MB. Try a bigger size or trim it first.`;e.className='warn';return}
  const fps=pickFps(info,vBps),p=plan(info.W,info.H,fps,vBps);
  e.textContent=`${head} At ${tMB}MB expect about ${p.sc}p${fps<info.fps-1?' at 30fps':''}.`;e.className='';
}

async function setFile(f){
  if(!f) return;
  if(f.type&&!f.type.startsWith('video/')){status('That is not a video file.','err');return}
  file=f;info=null;status('');$('out').innerHTML='';
  const my=++token;
  $('est').className='';$('est').textContent=`${f.name}: reading...`;
  try{const i=await inspect(f);if(my!==token) return;info=i;showEstimate()}
  catch(e){if(my!==token) return;$('est').textContent='';status(e.message||String(e),'err');track('read-failed')}
}

// ---- Wiring ----
$('file').onchange=()=>setFile($('file').files[0]);
document.querySelectorAll('[data-mb]').forEach(b=>b.onclick=()=>{$('mb').value=b.dataset.mb;document.querySelectorAll('[data-mb]').forEach(x=>x.classList.toggle('on',x===b));showEstimate()});
$('mb').oninput=()=>{document.querySelectorAll('[data-mb]').forEach(x=>x.classList.toggle('on',x.dataset.mb===$('mb').value));showEstimate()};
$('go').onclick=run;
// Start downloading the encoder as soon as someone reaches for the file picker, not after they pick a file.
const warm=()=>lib().catch(()=>{});
['pointerdown','focusin'].forEach(t=>$('file').addEventListener(t,warm,{once:true}));
addEventListener('dragenter',warm,{once:true});

// Drag and drop anywhere on the page
let depth=0;
const hasFiles=e=>e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
addEventListener('dragenter',e=>{if(!hasFiles(e))return;e.preventDefault();depth++;document.body.classList.add('drag')});
addEventListener('dragleave',e=>{if(!hasFiles(e))return;depth=Math.max(0,depth-1);if(!depth)document.body.classList.remove('drag')});
addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault()});
addEventListener('drop',e=>{
  if(!hasFiles(e))return;e.preventDefault();depth=0;document.body.classList.remove('drag');
  const f=e.dataTransfer.files[0];if(!f)return;
  try{$('file').files=e.dataTransfer.files}catch(err){}
  setFile(f);$('file').scrollIntoView({block:'center',behavior:'smooth'});
});

async function run(){
  const tMB=targetMB(),target=tMB*MB;
  if(!file) return status('Choose a video first.','err');
  if(!(target>0)) return status('Enter a target size.','err');
  if(!('VideoEncoder' in window)){track('compress-unsupported');return status('This browser cannot encode video. Use a current version of Chrome, Edge or Safari.','err')}
  $('go').disabled=true;$('out').innerHTML='';const t0=performance.now();
  if(lastUrl){URL.revokeObjectURL(lastUrl);lastUrl=null}
  try{
    status('Loading encoder...');
    const M=await lib();
    if(!info||info.f!==file){status('Reading video...');info=await inspect(file)}
    const i=info,f=file;
    log(`Input: ${f.name} (${fmt(f.size)}), ${i.W}x${i.H}, ${i.fps.toFixed(1)}fps, ${i.dur.toFixed(1)}s, audio: ${i.hasAudio?'yes':'no'}`);
    if(f.size<=target) log('Note: the file is already under the target. Compressing anyway.');
    const aBps=audioBps(i,target);
    let vBps=startBps(i,target),best=null,last=0,rateOk=true;
    for(let n=1;n<=4;n++){
      if(vBps<80000) throw new Error('That size is too small for a video this long. Try a larger size.');
      const fps=rateOk?pickFps(i,vBps):i.fps,{w,h}=plan(i.W,i.H,fps,vBps);
      status(`Attempt ${n} of up to 4: encoding at ${w}x${h}...`);
      const mk=()=>({input:new M.Input({source:new M.BlobSource(f),formats:M.ALL_FORMATS}),output:new M.Output({format:new M.Mp4OutputFormat(),target:new M.BufferTarget()})});
      const video={width:w,height:h,fit:'fill',codec:'avc',bitrate:Math.round(vBps)};
      const audio=i.hasAudio?{codec:'aac',bitrate:aBps}:{discard:true};
      let io=mk(),c;
      if(fps<i.fps-1){
        try{c=await M.Conversion.init({...io,video:{...video,frameRate:fps},audio})}
        catch(e){rateOk=false;log('Frame rate change not supported here, keeping the original rate.');io=mk()}
      }
      if(!c) c=await M.Conversion.init({...io,video,audio});
      if(!c.isValid) throw new Error('This file cannot be converted in this browser.');
      if(i.hasAudio&&c.discardedTracks&&c.discardedTracks.some(d=>d.track&&d.track.type==='audio')) log('Warning: audio could not be encoded here and was dropped.');
      c.onProgress=p=>bar(p);
      await c.execute();
      const buf=io.output.target.buffer,size=buf.byteLength;last=size;
      log(`Attempt ${n}: ${w}x${h}${fps<i.fps-1&&rateOk?' at '+fps+'fps':''}, video ${Math.round(vBps/1000)} kbps -> ${fmt(size)}`);
      if(size<=target&&(!best||size>best.size)) best={size,buf,w,h};
      if(best&&best.size>=target*0.85) break;
      const actual=size*8/i.dur-aBps;
      if(!(actual>0)) break;
      vBps=vBps*(target*8*0.94/i.dur-aBps)/actual;
    }
    if(!best) throw new Error(`Could not get under ${fmt(target)} (last try ${fmt(last)}). Try a larger size.`);
    const blob=new Blob([best.buf],{type:'video/mp4'}),url=lastUrl=URL.createObjectURL(blob);
    const name=f.name.replace(/\.[^.]+$/,'')+`-${tMB}mb.mp4`;
    status(`Done: ${fmt(f.size)} to ${fmt(best.size)} (${best.w}x${best.h}) in ${((performance.now()-t0)/1000).toFixed(0)}s.`,'ok');track('compress-ok');
    $('out').innerHTML=`<video controls playsinline width="${best.w}" height="${best.h}" src="${url}"></video><div class="acts"><a class="dl" href="${url}" download="${name.replace(/"/g,'')}">Download</a></div>`;
    const out=new File([blob],name,{type:'video/mp4'});
    if(navigator.canShare&&navigator.canShare({files:[out]})){
      const b=document.createElement('button');b.className='share';b.textContent='Share';
      b.onclick=()=>navigator.share({files:[out]}).catch(e=>{if(e.name!=='AbortError')status('Sharing failed. Use Download instead.','err')});
      $('out').querySelector('.acts').appendChild(b);
    }
  }catch(e){status(e.message||String(e),'err');log('Error: '+(e.stack||e));track('compress-failed')}
  finally{$('go').disabled=false;$('bar').style.display='none'}
}
