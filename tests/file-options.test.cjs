const {test}=require('node:test');
const assert=require('node:assert/strict');
const {time,clipRange,imageBox,imageDraw}=require('../static/js/file-options.js');
test('trim times support seconds, minutes and hours; malformed or out-of-range values fail',()=>{
 assert.equal(time('90.5',0),90.5);assert.equal(time('1:30.5',0),90.5);assert.equal(time('1:02:03',0),3723);
 for(const value of ['-1','1:60','1:99:01','1::2','NaN','Infinity','1e9','2:'])assert.throws(()=>time(value,0));
 assert.deepEqual(clipRange(12,{start:'',end:''}),{start:0,end:12,duration:12,trimmed:false});
 assert.throws(()=>clipRange(12,{start:'12',end:''}));assert.throws(()=>clipRange(12,{start:'',end:'13'}));
});
test('exact image geometry preserves proportions and enforces browser canvas limits',()=>{
 assert.deepEqual(imageBox(800,600,{width:'400',height:'',fit:'cover'}),{exact:true,width:400,height:300,fit:'contain',upscaled:false});
 assert.deepEqual(imageBox(800,600,{width:'',height:'300',fit:'contain'}),{exact:true,width:400,height:300,fit:'contain',upscaled:false});
 assert.deepEqual(imageBox(800,600,{width:'',height:'',fit:'contain'}),{exact:false});
 for(const values of [{width:'0',height:''},{width:'1.5',height:''},{width:'8193',height:''},{width:'5000',height:'5000'}])assert.throws(()=>imageBox(800,600,values));
 assert.deepEqual(imageDraw(800,600,300,300,'contain'),{x:0,y:37.5,width:300,height:225});
 assert.deepEqual(imageDraw(800,600,300,300,'cover'),{x:-50,y:0,width:400,height:300});
});
