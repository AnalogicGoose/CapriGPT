'use strict';
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {WhisperEngine}=require('../src/main/whisper-engine');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.caprigpt-local','speech-check');
fs.mkdirSync(dir,{recursive:true});
async function fixture(dataset,config,split,name,textKey){
  const wav=path.join(dir,name+'.wav'),meta=path.join(dir,name+'.json');
  if(!fs.existsSync(wav)||!fs.existsSync(meta)){
    const query=new URLSearchParams({dataset,config,split});
    const result=await fetch('https://datasets-server.huggingface.co/first-rows?'+query,{signal:AbortSignal.timeout(15000)}).then(r=>r.json());
    const row=result.rows[0].row;
    const bytes=Buffer.from(await fetch(row.audio[0].src,{signal:AbortSignal.timeout(15000)}).then(r=>r.arrayBuffer()));
    fs.writeFileSync(wav,bytes);fs.writeFileSync(meta,JSON.stringify({dataset,config,split,row:0,expected:row[textKey],source:'https://huggingface.co/datasets/'+dataset},null,2));
  }
  return fs.readFileSync(wav);
}
function pcm16(wav){
  let rate,channels,bits,format,data;
  for(let pos=12;pos+8<=wav.length;){
    const id=wav.toString('ascii',pos,pos+4),size=wav.readUInt32LE(pos+4),offset=pos+8;
    if(id==='fmt '){format=wav.readUInt16LE(offset);channels=wav.readUInt16LE(offset+2);rate=wav.readUInt32LE(offset+4);bits=wav.readUInt16LE(offset+14);}
    if(id==='data')data=wav.subarray(offset,offset+size);
    pos=offset+size+(size%2);
  }
  assert.ok(data);
  if(format===7){ // The public telephone sample uses G.711 mu-law.
    const decoded=Buffer.alloc(data.length*2);
    for(let i=0;i<data.length;i++){
      const value=(~data[i])&255,exponent=(value>>4)&7,mantissa=value&15;
      const sample=(((mantissa<<3)+132)<<exponent)-132;
      decoded.writeInt16LE(value&128?-sample:sample,i*2);
    }
    data=decoded;format=1;bits=16;
  }
  assert.equal(format,1);assert.equal(bits,16);
  const count=Math.floor(data.length/(channels*2)*16000/rate),pcm=Buffer.alloc(count*2);
  for(let i=0;i<count;i++){
    const source=i*rate/16000,a=Math.floor(source),b=Math.min(a+1,data.length/(channels*2)-1),t=source-a;
    const first=data.readInt16LE(a*channels*2),second=data.readInt16LE(b*channels*2);
    pcm.writeInt16LE(Math.round(first+(second-first)*t),i*2);
  }
  return pcm;
}
(async()=>{
  const engine=new WhisperEngine({runtimeDir:path.join(root,'.caprigpt-local','speech-runtime')});
  try{
    const english=pcm16(await fixture('hf-internal-testing/librispeech_asr_dummy','clean','validation','recorded-english','text'));
    const spanish=pcm16(await fixture('PolyAI/minds14','es-ES','train','recorded-spanish','transcription'));
    const started=Date.now();await engine.start();console.log('Model load ms:',Date.now()-started,'device:',engine.device);
    const noisy=Buffer.from(english);
    for(let i=0;i<noisy.length;i+=2){const noise=Math.sin(i*.723)*280;noisy.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(noisy.readInt16LE(i)*.45+noise))),i);}
    const cases=[['Recorded English',english,['apostle','middle classes','gospel']],
      ['Recorded Spanish',spanish,['problema','aplicación','transferencia','bancaria']],
      ['Quieter English with added interference',noisy,['apostle','middle classes','gospel']],
      ['Silence',Buffer.alloc(16000*2*2),[]]];
    if(fs.existsSync(path.join(dir,'known-speech.wav')))cases.unshift(['Generated English',pcm16(fs.readFileSync(path.join(dir,'known-speech.wav'))),['story','robot']]);
    const results=[];
    for(const [name,pcm,keywords] of cases){
      const time=Date.now(),text=await engine.transcribe(pcm);const ms=Date.now()-time;
      console.log(name+' ('+ms+' ms): '+text);
      if(name==='Silence')assert.equal(text,'','Silence must not invent a transcript');
      else for(const keyword of keywords)assert.ok(text.toLowerCase().includes(keyword),name+' missing '+keyword);
      results.push({name,ms,text});
    }
    fs.writeFileSync(path.join(dir,'whisper-results.json'),JSON.stringify({engine:'Whisper large-v3-turbo q5_0',device:engine.device,results},null,2));
    console.log('PASS: real local Whisper, neural VAD, multilingual recorded speech, quieter/noisy speech and silence. User microphone not recorded.');
  }finally{engine.stop();}
})().catch(error=>{console.error(error);process.exitCode=1;});
