/* The MP4 converter. It runs in the visitor's browser and uploads nothing.
   Target: H.264 video + AAC sound in an MP4, which plays almost everywhere.
   Tracks that are already H.264 / AAC are copied as they are (quick, no quality lost);
   anything else is re-encoded. The picture size and frame rate are kept. */
const $=id=>document.getElementById(id),MB=1e6,fmt=b=>(b/MB).toFixed(2)+' MB';
const log=t=>{const l=$('log');l.textContent=(l.dataset.on?l.textContent+'\n':'')+t;l.dataset.on=1};
const status=(m,c)=>{$('st').textContent=m;$('st').className=c||''};
const bar=p=>{$('bar').style.display='block';$('bar').firstElementChild.style.width=Math.round(p*100)+'%'};
const mmss=s=>{s=Math.round(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
// Counts an event in GoatCounter when it is switched on. Only the event name is sent, never anything about the video.
const track=name=>{try{if(window.goatcounter&&window.goatcounter.count) window.goatcounter.count({path:name,title:name,event:true})}catch(e){}};
const NAMES={avc:'H.264',hevc:'HEVC (H.265)',vp8:'VP8',vp9:'VP9',av1:'AV1',aac:'AAC',opus:'Opus',mp3:'MP3',vorbis:'Vorbis',flac:'FLAC',ac3:'AC-3',eac3:'E-AC-3'};
const nameOf=c=>NAMES[c]||c||'unknown';

let file=null,info=null,token=0,lastUrl=null,libP=null;

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
addEventListener('dragenter',warm,{once:true});

const openInput=(M,f)=>new M.Input({source:new M.BlobSource(f),formats:M.ALL_FORMATS});

// ---- Reading the file once, to show what will happen ----
async function inspect(f){
  const M=await lib(),inp=openInput(M,f);
  let vt;
  try{vt=await inp.getPrimaryVideoTrack()}
  catch(e){if(e&&e.name==='UnsupportedInputFormatError') throw new Error('This file cannot be read. It works with MOV, MKV, WebM, MP4 and MPEG-TS files.');throw e}
  if(!vt) throw new Error('No video track found in this file.');
  // H.264 is copied without being decoded, so only videos that need re-encoding must be readable by the browser.
  if(vt.codec!=='avc'&&!(await vt.canDecode())) throw new Error(`This browser cannot read ${nameOf(vt.codec)} video. Try another browser, such as Safari or Edge.`);
  const at=await inp.getPrimaryAudioTrack(),dur=await inp.computeDuration();
  const vc=vt.codec,ac=at?at.codec:null;
  return {f,dur,W:vt.displayWidth,H:vt.displayHeight,vc,ac,copyVideo:vc==='avc',copyAudio:!ac||ac==='aac'};
}

function describe(i){
  const head=`${mmss(i.dur)} long, ${i.W}x${i.H}, ${nameOf(i.vc)} video${i.ac?` with ${nameOf(i.ac)} sound`:', no sound'}, ${fmt(i.f.size)}.`;
  if(i.copyVideo&&i.copyAudio) return `${head} It will be copied into an MP4 without re-encoding.`;
  if(i.copyVideo) return `${head} The picture is copied as it is; only the sound is converted to AAC.`;
  return `${head} The video will be converted to H.264. This takes a little longer.`;
}

async function setFile(f){
  if(!f) return;
  file=f;info=null;status('');$('out').innerHTML='';
  const my=++token;
  $('est').textContent=`${f.name}: reading...`;
  try{const i=await inspect(f);if(my!==token) return;info=i;$('est').textContent=describe(i)}
  catch(e){if(my!==token) return;$('est').textContent='';status(e.message||String(e),'err');track('convert-read-failed')}
}

// ---- Converting ----
async function run(){
  if(!file) return status('Choose a video first.','err');
  $('go').disabled=true;$('out').innerHTML='';const t0=performance.now();
  if(lastUrl){URL.revokeObjectURL(lastUrl);lastUrl=null}
  try{
    status('Loading...');
    const M=await lib();
    if(!info||info.f!==file){status('Reading video...');info=await inspect(file)}
    const i=info,f=file;
    if(!i.copyVideo&&!('VideoEncoder' in window)) throw new Error('This browser cannot encode video. Use a current version of Chrome, Edge or Safari.');
    log(`Input: ${f.name} (${fmt(f.size)}), ${i.W}x${i.H}, ${nameOf(i.vc)} / ${i.ac?nameOf(i.ac):'no sound'}, ${i.dur.toFixed(1)}s`);
    const start=async audio=>{
      const output=new M.Output({format:new M.Mp4OutputFormat({fastStart:'in-memory'}),target:new M.BufferTarget()});
      const conv=await M.Conversion.init({input:openInput(M,f),output,tracks:'primary',video:{codec:'avc'},audio});
      return {conv,output};
    };
    const dropped=(conv,type)=>conv.discardedTracks.find(d=>d.track&&d.track.type===type);
    let {conv,output}=await start({codec:'aac'});
    // Some browsers cannot make AAC sound. Rather than lose the sound, let the MP4 use another sound format.
    if(i.ac&&(dropped(conv,'audio')||{}).reason==='no_encodable_target_codec'){
      log('AAC sound is not available in this browser, so another MP4 sound format is used.');
      ({conv,output}=await start({}));
    }
    for(const d of conv.discardedTracks) log(`Left out: ${d.track.type} track (${nameOf(d.track.codec)}), reason: ${d.reason}`);
    const lostVideo=dropped(conv,'video');
    if(!conv.isValid||lostVideo) throw new Error('This browser cannot convert this video to H.264. Use a current version of Chrome, Edge or Safari.');
    const lostAudio=i.ac&&dropped(conv,'audio');
    if(lostAudio) log('Warning: the sound could not be converted here and was left out.');
    status(i.copyVideo?'Copying into an MP4...':'Converting to H.264...');
    conv.onProgress=p=>bar(p);
    await conv.execute();
    const buf=output.target.buffer,secs=((performance.now()-t0)/1000).toFixed(0);
    const base=f.name.replace(/\.[^.]+$/,''),name=base+(/\.mp4$/i.test(f.name)?'-converted':'')+'.mp4';
    const out=new File([buf],name,{type:'video/mp4'}),url=lastUrl=URL.createObjectURL(out);
    log(`Output: ${fmt(out.size)} in ${secs}s (${i.copyVideo?'video copied':'video re-encoded to H.264'})`);
    status(`Done: ${fmt(f.size)} to ${fmt(out.size)} MP4 in ${secs}s.`+(lostAudio?' The sound could not be converted in this browser and was left out.':''),lostAudio?'err':'ok');
    track('convert-ok');
    $('out').innerHTML=`<video controls playsinline width="${i.W}" height="${i.H}" src="${url}"></video><div class="acts"><a class="dl" href="${url}" download="${name.replace(/"/g,'')}">Download</a></div>`;
    if(navigator.canShare&&navigator.canShare({files:[out]})){
      const b=document.createElement('button');b.className='share';b.textContent='Share';
      b.onclick=()=>navigator.share({files:[out]}).catch(e=>{if(e.name!=='AbortError')status('Sharing failed. Use Download instead.','err')});
      $('out').querySelector('.acts').appendChild(b);
    }
  }catch(e){status(e.message||String(e),'err');log('Error: '+(e.stack||e));track('convert-failed')}
  finally{$('go').disabled=false;$('bar').style.display='none'}
}

// ---- Wiring ----
$('file').onchange=()=>setFile($('file').files[0]);
$('go').onclick=run;

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
