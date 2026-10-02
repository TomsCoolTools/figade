/* The compressor. It runs in the visitor's browser and uploads nothing.
   You normally do not need to edit this file. The page text lives in the .html files.
   If you change how resolutions are chosen (the 0.07 rule), the sentences like
   "stays at 720p up to about 74 seconds" in the pages and video-size-guide.html need updating too. */
const $=id=>document.getElementById(id),MB=1e6,fmt=b=>(b/MB).toFixed(2)+' MB',even=n=>Math.max(2,Math.round(n/2)*2);
const log=t=>{const l=$('log');l.textContent=(l.dataset.on?l.textContent+'\n':'')+t;l.dataset.on=1};
const status=(m,c)=>{$('st').textContent=m;$('st').className=c||''};
const UI=window.FigadeTool,bar=UI.progress;
const mmss=s=>{s=Math.round(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};

let file=null,info=null,token=0,libP=null,activeConversion=null,cancelled=false;
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
  try {
  let vt;
  try{vt=await inp.getPrimaryVideoTrack()}
  catch(e){if(e&&e.name==='UnsupportedInputFormatError') throw new Error('This file cannot be read. Use a normal video file such as MP4, MOV, WebM or MKV.');throw e}
  if(!vt) throw new Error('No video track found in this file.');
  if(!(await vt.canDecode())){
    const names={avc:'H.264',hevc:'HEVC (H.265)',vp8:'VP8',vp9:'VP9',av1:'AV1'};
    throw new Error(`This browser cannot read ${names[vt.codec]||'this'} video. Try another browser, such as Safari or Edge.`);
  }
  const dur=await inp.computeDuration(),at=await inp.getPrimaryAudioTrack();
  let fps=30;
  try{if(typeof vt.computePacketStats==='function'){const st=await vt.computePacketStats(150);if(st&&st.averagePacketRate>1&&st.averagePacketRate<250) fps=st.averagePacketRate}}catch(e){}
  if(!(dur>0)) throw new Error('Could not read the length of this video.');
  return {f,dur,W:vt.displayWidth,H:vt.displayHeight,fps,hasAudio:!!at};
  } finally { inp.dispose(); }
}

function targetMB(){return Number($('mb').value)}
const trimValues=()=>({start:$('trim-start').value,end:$('trim-end').value});
function trimRange(i,values=trimValues()){return window.FigadeOptions.clipRange(i.dur,values)}
function trimDescription(range){return `${range.start.toFixed(2)}s to ${range.end.toFixed(2)}s (${range.duration.toFixed(2)}s kept)`;}
function trimEstimate(){
  if(!info){$('trim-preview').textContent='Choose a video to check its length.';return null;}
  const range=trimRange(info);
  $('trim-preview').textContent=range.trimmed?trimDescription(range):`Keeping the whole ${mmss(info.dur)} video.`;
  return range;
}
function showEstimate(){
  const e=$('est');
  if(!info||info.f!==file){e.textContent='';return}
  const tMB=targetMB(),target=tMB*MB;
  const head=`${mmss(info.dur)} long, ${info.W}x${info.H}, ${Math.round(info.fps)}fps, ${fmt(info.f.size)}.`;
  if(!Number.isFinite(tMB)||tMB<1){e.textContent=head;e.className='';return}
  let range;
  try{range=trimEstimate()}catch(error){$('trim-preview').textContent=error.message;e.textContent=error.message;e.className='warn';return;}
  const clip={...info,dur:range.duration};
  const vBps=startBps(clip,target);
  if(vBps<80000){e.textContent=`${head} Too long for ${tMB}MB. Try a bigger size or trim it first.`;e.className='warn';return}
  const fps=pickFps(clip,vBps),p=plan(clip.W,clip.H,fps,vBps);
  e.textContent=`${head} ${range.trimmed?'For the selected '+range.duration.toFixed(2)+'s section: ':''}At ${tMB}MB expect about ${p.sc}p${fps<info.fps-1?' at 30fps':''}.`+(file.size<=target?' Your original already fits; re-encoding may change its quality.':'');e.className='';
}

async function setFile(f) {
  if (!f || UI.busy) return;
  file = f; info = null; status(''); UI.selected(f);
  $('trim-start').value='';$('trim-end').value='';$('trim-preview').textContent='';
  const my = ++token;
  $('est').className = '';
  if (f.type && !f.type.startsWith('video/') && !/\.(mp4|mov|webm|mkv|ts|m2ts)$/i.test(f.name)) {
    $('est').textContent = ''; UI.setReading(false);
    return status('That is not a supported video file. Choose an MP4, MOV, WebM or MKV.','err');
  }
  UI.setReading(true); $('est').textContent = 'Reading video…';
  try { const i = await inspect(f); if (my !== token) return; info = i; showEstimate(); }
  catch(e) { if (my !== token) return; $('est').textContent = ''; status(e.message || String(e),'err'); track('read-failed'); }
  finally { if (my === token) UI.setReading(false); }
}

const destinationNotes = {
  discord: 'Uses the target from our Discord guide. Limits can change; check Discord if a file is refused.',
  whatsapp: 'Uses the target from our WhatsApp guide. WhatsApp may still re-compress video; send as a document to preserve the file.',
  email: 'Uses the target from our email guide, leaving room for attachment overhead. Your recipient may have a lower limit.'
};
function destinationHelp() {
  $('destination-help').textContent = destinationNotes[$('destination').value] || 'Presets set the size for you.';
}
function customSize() { $('destination').value = ''; destinationHelp(); UI.chips('mb'); showEstimate(); }
$('file').onchange = () => setFile($('file').files[0]);
document.querySelectorAll('[data-mb]').forEach(button => button.onclick = () => {
  if (UI.busy) return; $('mb').value = button.dataset.mb; customSize();
});
$('mb').oninput = customSize;
$('trim-start').oninput=showEstimate;
$('trim-end').oninput=showEstimate;
$('destination').onchange = () => {
  const preset = $('destination').selectedOptions[0].dataset.target;
  if (preset) $('mb').value = preset;
  destinationHelp(); UI.chips('mb'); showEstimate();
};
destinationHelp();
$('reset').onclick = () => { if (UI.busy) return; ++token; file = null; info = null; $('trim-start').value='';$('trim-end').value='';$('trim-preview').textContent='';UI.reset(); };
$('go').onclick = run;
const warm = () => lib().catch(() => {});
['pointerdown','focusin'].forEach(event => $('file').addEventListener(event,warm,{once:true}));
UI.wireDrop(setFile,warm);
$('cancel').onclick = async () => {
  if (!UI.busy || cancelled) return;
  cancelled = true; $('cancel').disabled = true; $('cancel').textContent = 'Cancelling…'; status('Cancelling…');
  try { if (activeConversion) await activeConversion.cancel(); }
  catch(e) { log('Cancel: ' + (e.message || e)); }
};
function checkCancelled() { if (cancelled) { const error = new Error('Cancelled'); error.name = 'ConversionCanceledError'; throw error; } }

async function run() {
  if (UI.busy) return;
  const tMB = targetMB(), target = tMB * MB, f = file, selectedRange=trimValues();
  if (!f) return status('Choose a video first.','err');
  if (!Number.isFinite(target) || tMB < 1) { $('mb').focus(); return status('Enter a maximum size of at least 1 MB.','err'); }
  if (!('VideoEncoder' in window)) { track('compress-unsupported'); return status('This browser cannot encode video. Use a current version of Chrome, Edge or Safari.','err'); }
  cancelled = false; UI.clearResult(); UI.setBusy(true); const t0 = performance.now(); let errorField=null;
  try {
    status('Loading encoder…'); const M = await lib(); checkCancelled();
    if (!info || info.f !== f) { status('Reading video…'); info = await inspect(f); }
    checkCancelled(); const range=trimRange(info,selectedRange),i={...info,dur:range.duration};
    log(`Input: ${f.name} (${fmt(f.size)}), ${i.W}x${i.H}, ${i.fps.toFixed(1)}fps, ${i.dur.toFixed(1)}s, audio: ${i.hasAudio?'yes':'no'}`);
    if(range.trimmed)log('Trim: '+trimDescription(range));
    const aBps = audioBps(i,target);
    let vBps = startBps(i,target), best = null, last = 0, rateOk = true;
    for (let n=1; n<=4; n++) {
      checkCancelled();
      if (vBps < 80000) throw new Error('That size is too small for a video this long. Try a larger size.');
      const fps = rateOk ? pickFps(i,vBps) : i.fps, {w,h} = plan(i.W,i.H,fps,vBps);
      status(`Attempt ${n} of up to 4: encoding at ${w} × ${h}…`); bar(0);
      const mk = () => ({input:new M.Input({source:new M.BlobSource(f),formats:M.ALL_FORMATS}),output:new M.Output({format:new M.Mp4OutputFormat(),target:new M.BufferTarget()})});
      const video = {width:w,height:h,fit:'fill',codec:'avc',bitrate:Math.round(vBps)};
      const trim=range.trimmed?{start:range.start,end:range.end}:undefined;
      const audio = i.hasAudio ? {codec:'aac',bitrate:aBps} : {discard:true};
      let io = mk(), c;
      try {
        if (fps < i.fps-1) {
          try { c = await M.Conversion.init({...io,video:{...video,frameRate:fps},audio,trim,tags:{}}); }
          catch(e) { io.input.dispose(); checkCancelled(); rateOk=false; log('Frame rate change not supported here, keeping the original rate.'); io=mk(); }
        }
        if (!c) c = await M.Conversion.init({...io,video,audio,trim,tags:{}});
        activeConversion = c;
        if (cancelled) { await c.cancel(); checkCancelled(); }
        if (!c.isValid || c.discardedTracks.some(d=>d.track && d.track.type==='video')) throw new Error('This file cannot be converted in this browser.');
        const lostAudio = i.hasAudio && c.discardedTracks.some(d=>d.track && d.track.type==='audio');
        if (lostAudio) log('Warning: audio could not be encoded here and was dropped.');
        c.onProgress = bar; await c.execute(); checkCancelled();
        const buf = io.output.target.buffer, size = buf.byteLength; last=size;
        log(`Attempt ${n}: ${w}x${h}, video ${Math.round(vBps/1000)} kbps -> ${fmt(size)}`);
        if (size<=target && (!best || size>best.size)) best={size,buf,w,h,lostAudio};
        if (best && best.size>=target*0.85) break;
        const actual = size*8/i.dur-aBps;
        if (!(actual>0)) break;
        vBps = vBps*(target*8*0.94/i.dur-aBps)/actual;
      } finally { activeConversion=null; io.input.dispose(); }
    }
    checkCancelled();
    if (!best) throw new Error(`Could not get under ${fmt(target)} (last try ${fmt(last)}). Try a larger size.`);
    const blob = new Blob([best.buf],{type:'video/mp4'});
    const name = f.name.replace(/\.[^.]+$/,'')+`${range.trimmed?'-trimmed':''}-${tMB}mb.mp4`;
    const warning = best.lostAudio ? 'Sound was removed because this browser could not encode the audio. Try another browser if you need to keep it.' : '';
    status(best.lostAudio ? 'Finished with a warning: this result has no sound.' : `Finished in ${((performance.now()-t0)/1000).toFixed(0)}s. Your file fits under ${tMB} MB.`,best.lostAudio?'warn':'ok');
    UI.renderResult({blob,name,originalSize:f.size,width:best.w,height:best.h,sound:best.lostAudio?'Removed':i.hasAudio?'Included':'No source audio',warning,maxBytes:target,limitLabel:`${tMB} MB`,clipLabel:range.trimmed?trimDescription(range):null});
    track(best.lostAudio?'compress-audio-removed':'compress-ok');
  } catch(e) {
    if (cancelled || e.name==='ConversionCanceledError') { status('Cancelled. Your original file is unchanged.'); track('compress-cancelled'); }
    else { status(e.message || String(e),'err'); if(e.field){$('trim-options').open=true;errorField=e.field;} log('Error: '+(e.stack || e)); track('compress-failed'); }
  } finally { activeConversion=null; UI.setBusy(false); if(cancelled) $('go').focus();else if(errorField)$(errorField).focus(); }
}
