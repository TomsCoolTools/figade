/* The image compressor. It runs in the visitor's browser and uploads nothing.
   It saves a JPG just under the size picked: first by lowering the JPG quality (down to 0.5),
   and only if that is not enough, by making the image smaller in pixels. 1KB = 1000 bytes,
   so the result fits whichever way a site counts KB. */
const $=id=>document.getElementById(id),KB=1000,UI=window.FigadeTool;
const fmt=b=>b<1e6?(b/KB).toFixed(1)+' KB':(b/1e6).toFixed(2)+' MB';
const log=t=>{const l=$('log');l.textContent=(l.dataset.on?l.textContent+'\n':'')+t;l.dataset.on=1};
const status=(m,c)=>{$('st').textContent=m;$('st').className=c||''};
// Counts an event in GoatCounter when it is switched on. Only the event name is sent, never anything about the image.
const track=name=>{try{if(window.goatcounter&&window.goatcounter.count) window.goatcounter.count({path:name,title:name,event:true})}catch(e){}};

// Browsers limit how big a canvas can be (iPhones to about 16 megapixels), so bigger images are scaled to fit first.
const MAX_PIXELS=16e6,QUALITY_TOP=0.92,QUALITY_FLOOR=0.5;
let file=null,img=null,token=0;
const canvas=document.createElement('canvas');

const targetKB=()=>Number($('kb').value);
const resizeValues=()=>({width:$('image-width').value,height:$('image-height').value,fit:$('image-fit').value});
const resizeBox=()=>window.FigadeOptions.imageBox(img.width,img.height,resizeValues());
const isHeic=f=>/\.(heic|heif)$/i.test(f.name)||/heic|heif/i.test(f.type);

function showEstimate(){
  const e=$('est');
  if(!img){e.textContent='';return}
  const t=targetKB();
  e.textContent=`${img.width}x${img.height}, ${fmt(file.size)}.`+(t>0&&file.size<=t*KB?` Already under ${t}KB.`:'');
  try {
    const box=resizeBox();
    $('resize-preview').textContent=box.exact?`Output: ${box.width} × ${box.height} pixels.${box.upscaled?' Enlarging will not add detail.':''}`:'Dimensions are reduced only if needed to fit your KB limit.';
  } catch(error) { $('resize-preview').textContent=error.message; }

}

async function setFile(f) {
  if (!f || UI.busy) return;
  if (img) img.close();
  img=null; file=f; status(''); UI.selected(f);$('resize-preview').textContent='';
  const my=++token;
  if (!(f.type.startsWith('image/') || isHeic(f) || /\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(f.name))) {
    $('est').textContent=''; UI.setReading(false); return status('That is not an image file.','err');
  }
  UI.setReading(true); $('est').textContent='Reading image…';
  try {
    const bmp=await createImageBitmap(f,{imageOrientation:'from-image'});
    if (my!==token) { bmp.close(); return; }
    img=bmp; showEstimate();
  } catch(e) {
    if (my!==token) return;
    $('est').textContent='';
    status(isHeic(f)?'This browser cannot open HEIC photos. Try a JPG, or see the questions below.':'This image cannot be opened. Use a JPG, PNG or WebP image.','err');
    log('Could not open '+f.name+': '+(e.message||e)); track('image-read-failed');
  } finally { if (my===token) UI.setReading(false); }
}

// One JPG at a given size and quality. White background, so transparent areas are not black.
function encode(w,h,q,fit='contain'){
  canvas.width=w;canvas.height=h;
  const cx=canvas.getContext('2d');
  cx.fillStyle='#fff';cx.fillRect(0,0,w,h);
  cx.imageSmoothingQuality='high';
  const box=window.FigadeOptions.imageDraw(img.width,img.height,w,h,fit);
  cx.drawImage(img,box.x,box.y,box.width,box.height);
  return new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(new Error('This browser could not save the image.')),'image/jpeg',q));
}

// Highest quality that fits at this size, or null if even the lowest quality is too big (with that size, to plan the next step).
async function bestAt(w,h,limit,fit){
  const top=await encode(w,h,QUALITY_TOP,fit);
  if(top.size<=limit) return {blob:top,q:QUALITY_TOP};
  const low=await encode(w,h,QUALITY_FLOOR,fit);
  if(low.size>limit) return {blob:null,lowSize:low.size};
  let a=QUALITY_FLOOR,b=QUALITY_TOP,best={blob:low,q:QUALITY_FLOOR};
  for(let i=0;i<6;i++){
    const m=(a+b)/2,bl=await encode(w,h,m,fit);
    if(bl.size<=limit){a=m;best={blob:bl,q:m}}else b=m;
  }
  return best;
}

async function run(){
  if(UI.busy) return;
  const t=targetKB(),limit=t*KB,f=file;
  if(!img) return status('Choose an image first.','err');
  if(!Number.isFinite(limit)||t<1){$('kb').focus();return status('Enter a maximum size of at least 1 KB.','err')}
  let box;
  try{box=resizeBox()}catch(error){$('resize-options').open=true;$(error.field).focus();return status(error.message,'err')}
  UI.clearResult();UI.setBusy(true);status('Compressing…');
  const t0=performance.now();
  try{
    let scale=Math.min(1,Math.sqrt(MAX_PIXELS/(img.width*img.height))),res=null,w,h;
    log(`Input: ${file.name} (${fmt(file.size)}), ${img.width}x${img.height}, target ${t}KB`);
    for(let n=1;n<=12&&!res;n++){
      w=box.exact?box.width:Math.max(1,Math.round(img.width*scale));h=box.exact?box.height:Math.max(1,Math.round(img.height*scale));
      if(!box.exact&&(w<16||h<16)) break;
      const r=await bestAt(w,h,limit,box.fit);
      log(`Try ${n}: ${w}x${h} `+(r.blob?`fits at quality ${r.q.toFixed(2)}: ${fmt(r.blob.size)}`:`too big even at quality ${QUALITY_FLOOR} (${fmt(r.lowSize)})`));
      if(r.blob) res=r;
      else if(box.exact)throw new Error(`Cannot fit under ${t} KB at ${w} × ${h} pixels without further reducing quality. Increase the KB limit or choose smaller dimensions.`);
      else scale*=Math.min(0.9,Math.sqrt(limit/r.lowSize)*0.95);
    }
    if(!res) throw new Error(`Could not get this image under ${t}KB. Try a bigger size.`);
    const name=f.name.replace(/\.[^.]+$/,'')+`-${t}kb.jpg`;
    status(`Finished. Your JPG fits under ${t} KB.`,'ok'); track('image-ok');
    UI.renderResult({blob:res.blob,name,originalSize:f.size,width:w,height:h,
      note:'Saved as JPG. Transparent areas are white; location and camera metadata are removed.'+(box.exact?(box.fit==='cover'?' Edges are cropped to fit the requested dimensions.':' The whole image is kept; white margins are added if needed.'):'') ,maxBytes:limit,limitLabel:`${t} KB`});
    log(`Done in ${((performance.now()-t0)/1000).toFixed(1)}s`);
  }catch(e){status(e.message||String(e),'err');log('Error: '+(e.stack||e));track('image-failed')}
  finally{canvas.width=0;canvas.height=0;UI.setBusy(false)}
}

// ---- Wiring ----
$('file').onchange=()=>setFile($('file').files[0]);
document.querySelectorAll('[data-kb]').forEach(button=>button.onclick=()=>{
  if(UI.busy) return; $('kb').value=button.dataset.kb; UI.chips('kb'); showEstimate();
});
$('kb').oninput=()=>{UI.chips('kb');showEstimate()};
function resizeChanged(){
  const both=$('image-width').value!==''&&$('image-height').value!=='';
  $('image-fit').dataset.unavailable=String(!both);$('image-fit').disabled=UI.busy||!both;
  showEstimate();
}
$('image-width').oninput=resizeChanged;
$('image-height').oninput=resizeChanged;
resizeChanged();
$('go').onclick=run;
$('reset').onclick=()=>{if(UI.busy) return;++token;if(img)img.close();img=null;file=null;$('image-width').value='';$('image-height').value='';$('resize-preview').textContent='';UI.reset();resizeChanged()};
UI.wireDrop(setFile);
