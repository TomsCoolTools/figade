/* The image compressor. It runs in the visitor's browser and uploads nothing.
   It saves a JPG just under the size picked: first by lowering the JPG quality (down to 0.5),
   and only if that is not enough, by making the image smaller in pixels. 1KB = 1000 bytes,
   so the result fits whichever way a site counts KB. */
const $=id=>document.getElementById(id),KB=1000;
const fmt=b=>b<1e6?(b/KB).toFixed(1)+' KB':(b/1e6).toFixed(2)+' MB';
const log=t=>{const l=$('log');l.textContent=(l.dataset.on?l.textContent+'\n':'')+t;l.dataset.on=1};
const status=(m,c)=>{$('st').textContent=m;$('st').className=c||''};
// Counts an event in GoatCounter when it is switched on. Only the event name is sent, never anything about the image.
const track=name=>{try{if(window.goatcounter&&window.goatcounter.count) window.goatcounter.count({path:name,title:name,event:true})}catch(e){}};

// Browsers limit how big a canvas can be (iPhones to about 16 megapixels), so bigger images are scaled to fit first.
const MAX_PIXELS=16e6,QUALITY_TOP=0.92,QUALITY_FLOOR=0.5;
let file=null,img=null,token=0,lastUrl=null;
const canvas=document.createElement('canvas');

const targetKB=()=>parseFloat($('kb').value);
const isHeic=f=>/\.(heic|heif)$/i.test(f.name)||/heic|heif/i.test(f.type);

function showEstimate(){
  const e=$('est');
  if(!img){e.textContent='';return}
  const t=targetKB();
  e.textContent=`${img.width}x${img.height}, ${fmt(file.size)}.`+(t>0&&file.size<=t*KB?` Already under ${t}KB.`:'');
}

async function setFile(f){
  if(!f) return;
  if(!(f.type.startsWith('image/')||isHeic(f))){status('That is not an image file.','err');return}
  file=f;img=null;status('');$('out').innerHTML='';
  const my=++token;
  $('est').textContent=`${f.name}: reading...`;
  try{
    const bmp=await createImageBitmap(f,{imageOrientation:'from-image'});
    if(my!==token){bmp.close();return}
    img=bmp;showEstimate();
  }catch(e){
    if(my!==token) return;
    $('est').textContent='';
    status(isHeic(f)?'This browser cannot open HEIC photos. Safari on a Mac can, or see the questions below.':'This image cannot be opened. Use a JPG, PNG or WebP image.','err');
    log('Could not open '+f.name+': '+(e.message||e));track('image-read-failed');
  }
}

// One JPG at a given size and quality. White background, so transparent areas are not black.
function encode(w,h,q){
  canvas.width=w;canvas.height=h;
  const cx=canvas.getContext('2d');
  cx.fillStyle='#fff';cx.fillRect(0,0,w,h);
  cx.imageSmoothingQuality='high';cx.drawImage(img,0,0,w,h);
  return new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(new Error('This browser could not save the image.')),'image/jpeg',q));
}

// Highest quality that fits at this size, or null if even the lowest quality is too big (with that size, to plan the next step).
async function bestAt(w,h,limit){
  const top=await encode(w,h,QUALITY_TOP);
  if(top.size<=limit) return {blob:top,q:QUALITY_TOP};
  const low=await encode(w,h,QUALITY_FLOOR);
  if(low.size>limit) return {blob:null,lowSize:low.size};
  let a=QUALITY_FLOOR,b=QUALITY_TOP,best={blob:low,q:QUALITY_FLOOR};
  for(let i=0;i<6;i++){
    const m=(a+b)/2,bl=await encode(w,h,m);
    if(bl.size<=limit){a=m;best={blob:bl,q:m}}else b=m;
  }
  return best;
}

async function run(){
  const t=targetKB(),limit=t*KB;
  if(!img) return status('Choose an image first.','err');
  if(!(t>=1)) return status('Enter a target size.','err');
  $('go').disabled=true;$('out').innerHTML='';status('Compressing...');
  if(lastUrl){URL.revokeObjectURL(lastUrl);lastUrl=null}
  const t0=performance.now();
  try{
    let scale=Math.min(1,Math.sqrt(MAX_PIXELS/(img.width*img.height))),res=null,w,h;
    log(`Input: ${file.name} (${fmt(file.size)}), ${img.width}x${img.height}, target ${t}KB`);
    for(let n=1;n<=12&&!res;n++){
      w=Math.max(1,Math.round(img.width*scale));h=Math.max(1,Math.round(img.height*scale));
      if(w<16||h<16) break;
      const r=await bestAt(w,h,limit);
      log(`Try ${n}: ${w}x${h} `+(r.blob?`fits at quality ${r.q.toFixed(2)}: ${fmt(r.blob.size)}`:`too big even at quality ${QUALITY_FLOOR} (${fmt(r.lowSize)})`));
      if(r.blob) res=r;
      else scale*=Math.min(0.9,Math.sqrt(limit/r.lowSize)*0.95);
    }
    if(!res) throw new Error(`Could not get this image under ${t}KB. Try a bigger size.`);
    const name=file.name.replace(/\.[^.]+$/,'')+`-${t}kb.jpg`;
    const out=new File([res.blob],name,{type:'image/jpeg'}),url=lastUrl=URL.createObjectURL(out);
    status(`Done: ${fmt(file.size)} to ${fmt(out.size)} (${w}x${h}).`,'ok');track('image-ok');
    $('out').innerHTML=`<img src="${url}" width="${w}" height="${h}" alt="The compressed image"><div class="acts"><a class="dl" href="${url}" download="${name.replace(/"/g,'')}">Download</a></div>`;
    if(navigator.canShare&&navigator.canShare({files:[out]})){
      const b=document.createElement('button');b.className='share';b.textContent='Share';
      b.onclick=()=>navigator.share({files:[out]}).catch(e=>{if(e.name!=='AbortError')status('Sharing failed. Use Download instead.','err')});
      $('out').querySelector('.acts').appendChild(b);
    }
    log(`Done in ${((performance.now()-t0)/1000).toFixed(1)}s`);
  }catch(e){status(e.message||String(e),'err');log('Error: '+(e.stack||e));track('image-failed')}
  finally{$('go').disabled=false}
}

// ---- Wiring ----
$('file').onchange=()=>setFile($('file').files[0]);
document.querySelectorAll('[data-kb]').forEach(b=>b.onclick=()=>{$('kb').value=b.dataset.kb;document.querySelectorAll('[data-kb]').forEach(x=>x.classList.toggle('on',x===b));showEstimate()});
$('kb').oninput=()=>{document.querySelectorAll('[data-kb]').forEach(x=>x.classList.toggle('on',x.dataset.kb===$('kb').value));showEstimate()};
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
