/* The MP4 converter. It runs in the visitor's browser and uploads nothing.
   Target: H.264 video + AAC sound in an MP4, which plays almost everywhere.
   Tracks that are already H.264 / AAC are copied as they are (quick, no quality lost);
   anything else is re-encoded. The picture size and frame rate are kept. */
const $=id=>document.getElementById(id),MB=1e6,fmt=b=>(b/MB).toFixed(2)+' MB';
const log=t=>{const l=$('log');l.textContent=(l.dataset.on?l.textContent+'\n':'')+t;l.dataset.on=1};
const status=(m,c)=>{$('st').textContent=m;$('st').className=c||''};
const UI=window.FigadeTool,bar=UI.progress;
const mmss=s=>{s=Math.round(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
// Counts an event in GoatCounter when it is switched on. Only the event name is sent, never anything about the video.
const track=name=>{try{if(window.goatcounter&&window.goatcounter.count) window.goatcounter.count({path:name,title:name,event:true})}catch(e){}};
const NAMES={avc:'H.264',hevc:'HEVC (H.265)',vp8:'VP8',vp9:'VP9',av1:'AV1',aac:'AAC',opus:'Opus',mp3:'MP3',vorbis:'Vorbis',flac:'FLAC',ac3:'AC-3',eac3:'E-AC-3'};
const nameOf=c=>NAMES[c]||c||'unknown';

let file=null,info=null,token=0,libP=null,activeConversion=null,cancelled=false;

// ---- Loading the video library: this site first (js/mediabunny.mjs), then jsDelivr. Same as js/app.js. ----
const lib=()=>libP||(libP=loadLib().catch(e=>{libP=null;throw e}));
async function loadLib(){
  if(window.Mediabunny&&window.Mediabunny.Input) return window.Mediabunny;
  const tries=['/js/mediabunny.mjs','https://cdn.jsdelivr.net/npm/mediabunny@1.44.1/+esm'],errs=[];
  for(const u of tries){
    try{window.Mediabunny=await import(u);if(window.Mediabunny.Input){log('Video library loaded from '+u);return window.Mediabunny}}
    catch(e){errs.push(u+' ('+(e.message||e)+')')}
  }
  throw new Error('The converter could not be loaded. Check your connection and reload. Tried:\n'+errs.join('\n'));
}
const warm=()=>lib().catch(()=>{});
['pointerdown','focusin'].forEach(t=>$('file').addEventListener(t,warm,{once:true}));


const openInput=(M,f)=>new M.Input({source:new M.BlobSource(f),formats:M.ALL_FORMATS});

// ---- Reading the file once, to show what will happen ----
async function inspect(f){
  const M=await lib(),inp=openInput(M,f);
  try {
  let vt;
  try{vt=await inp.getPrimaryVideoTrack()}
  catch(e){if(e&&e.name==='UnsupportedInputFormatError') throw new Error('This file cannot be read. It works with MOV, MKV, WebM, MP4 and MPEG-TS files.');throw e}
  if(!vt) throw new Error('No video track found in this file.');
  // H.264 is copied without being decoded, so only videos that need re-encoding must be readable by the browser.
  if(vt.codec!=='avc'&&!(await vt.canDecode())) throw new Error(`This browser cannot read ${nameOf(vt.codec)} video. Try another browser, such as Safari or Edge.`);
  const at=await inp.getPrimaryAudioTrack(),dur=await inp.computeDuration();
  const vc=vt.codec,ac=at?at.codec:null;
  return {f,dur,W:vt.displayWidth,H:vt.displayHeight,vc,ac,copyVideo:vc==='avc',copyAudio:!ac||ac==='aac'};
  } finally { inp.dispose(); }
}

function describe(i){
  const head=`${mmss(i.dur)} long, ${i.W}x${i.H}, ${nameOf(i.vc)} video${i.ac?` with ${nameOf(i.ac)} sound`:', no sound'}, ${fmt(i.f.size)}.`;
  if(i.copyVideo&&i.copyAudio) return `${head} It will be copied into an MP4 without re-encoding.`;
  if(i.copyVideo) return `${head} The picture is copied as it is; only the sound is converted to AAC.`;
  return `${head} The video will be converted to H.264. This takes a little longer.`;
}

async function setFile(f) {
  if (!f || UI.busy) return;
  file=f; info=null; status(''); UI.selected(f);
  const my=++token; UI.setReading(true); $('est').textContent='Reading video…';
  try { const i=await inspect(f); if(my!==token)return; info=i; $('est').textContent=describe(i); }
  catch(e) { if(my!==token)return; $('est').textContent=''; status(e.message||String(e),'err'); track('convert-read-failed'); }
  finally { if(my===token)UI.setReading(false); }
}
function checkCancelled() { if(cancelled){const error=new Error('Cancelled');error.name='ConversionCanceledError';throw error;} }

async function run() {
  if(UI.busy)return;
  const f=file;
  if(!f)return status('Choose a video first.','err');
  cancelled=false; UI.clearResult(); UI.setBusy(true); const t0=performance.now();
  let currentInput=null;
  try {
    status('Loading…'); const M=await lib(); checkCancelled();
    if(!info||info.f!==f){status('Reading video…');info=await inspect(f)}
    checkCancelled(); const i=info;
    if(!i.copyVideo&&!('VideoEncoder' in window))throw new Error('This browser cannot encode video. Use a current version of Chrome, Edge or Safari.');
    log(`Input: ${f.name} (${fmt(f.size)}), ${i.W}x${i.H}, ${nameOf(i.vc)} / ${i.ac?nameOf(i.ac):'no sound'}, ${i.dur.toFixed(1)}s`);
    const start=async audio=>{
      currentInput=openInput(M,f);
      const output=new M.Output({format:new M.Mp4OutputFormat({fastStart:'in-memory'}),target:new M.BufferTarget()});
      const conv=await M.Conversion.init({input:currentInput,output,tracks:'primary',video:{codec:'avc'},audio,tags:{}});
      activeConversion=conv;
      if(cancelled){await conv.cancel();checkCancelled()}
      return {conv,output};
    };
    const dropped=(conv,type)=>conv.discardedTracks.find(d=>d.track&&d.track.type===type);
    let {conv,output}=await start({codec:'aac'});
    if(i.ac&&(dropped(conv,'audio')||{}).reason==='no_encodable_target_codec'){
      log('AAC sound is not available in this browser, so another MP4 sound format is used.');
      await conv.cancel();currentInput.dispose();checkCancelled();
      ({conv,output}=await start({}));
    }
    for(const d of conv.discardedTracks)log(`Left out: ${d.track.type} track (${nameOf(d.track.codec)}), reason: ${d.reason}`);
    if(!conv.isValid||dropped(conv,'video'))throw new Error('This browser cannot convert this video to H.264. Use a current version of Chrome, Edge or Safari.');
    const lostAudio=!!(i.ac&&dropped(conv,'audio'));
    const audioTrack=conv.utilizedTracks.find(track=>track.type==='audio');
    status(i.copyVideo?'Copying into an MP4…':'Converting to H.264…');bar(0);
    conv.onProgress=bar;await conv.execute();checkCancelled();
    const buf=output.target.buffer,secs=((performance.now()-t0)/1000).toFixed(0);
    const base=f.name.replace(/\.[^.]+$/,''),name=base+(/\.mp4$/i.test(f.name)?'-converted':'')+'.mp4';
    const blob=new Blob([buf],{type:'video/mp4'});
    log(`Output: ${fmt(blob.size)} in ${secs}s (${i.copyVideo?'video copied':'video re-encoded to H.264'})`);
    const warning=lostAudio?'Sound was removed because this browser could not convert the audio. Try another browser if you need to keep it.':'';
    status(lostAudio?'Finished with a warning: this result has no sound.':`Finished in ${secs}s. Your MP4 is ready.`,lostAudio?'warn':'ok');
    UI.renderResult({blob,name,originalSize:f.size,width:i.W,height:i.H,sound:lostAudio?'Removed':audioTrack?'Included':'No source audio',warning,
      note:i.copyVideo?'Video copied without re-encoding.':'Video converted to H.264.'});
    track(lostAudio?'convert-audio-removed':'convert-ok');
  } catch(e) {
    if(cancelled||e.name==='ConversionCanceledError'){status('Cancelled. Your original file is unchanged.');track('convert-cancelled')}
    else{status(e.message||String(e),'err');log('Error: '+(e.stack||e));track('convert-failed')}
  } finally {activeConversion=null;if(currentInput)currentInput.dispose();UI.setBusy(false);if(cancelled)$('go').focus()}
}

$('file').onchange=()=>setFile($('file').files[0]);
$('go').onclick=run;
$('reset').onclick=()=>{if(UI.busy)return;++token;file=null;info=null;UI.reset()};
UI.wireDrop(setFile,warm);
$('cancel').onclick=async()=>{
  if(!UI.busy||cancelled)return;
  cancelled=true;$('cancel').disabled=true;$('cancel').textContent='Cancelling…';status('Cancelling…');
  try{if(activeConversion)await activeConversion.cancel()}catch(e){log('Cancel: '+(e.message||e))}
};
