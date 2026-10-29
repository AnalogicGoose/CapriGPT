'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function load(){
  const source=fs.readFileSync(path.join(__dirname,'../src/renderer/js/microphone.js'),'utf8')
    .replace("new URL('./microphone-worklet.js',import.meta.url)","'worklet.js'");
  return (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).MicrophoneCapture;
}
function stream(){const track={stopped:0,stop(){this.stopped++;}};return {track,getTracks:()=>[track]};}
function audioGlobals(addModule=async()=>{}){
  global.AudioContext=class {constructor(){this.sampleRate=16000;this.audioWorklet={addModule};this.destination={};}
    createMediaStreamSource(){return {connect(){},disconnect(){}};}async resume(){}async close(){this.closed=true;}};
  global.AudioWorkletNode=class {constructor(){this.port={postMessage:()=>queueMicrotask(()=>this.port.onmessage?.({data:{type:'flushed'}}))};}connect(){}disconnect(){}};
}
test('late permission from an old request releases that device without stopping a new microphone',async()=>{
  const Capture=await load();let resolveOld;const first=stream(),second=stream();let count=0;
  Object.defineProperty(global,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>++count===1?new Promise(resolve=>{resolveOld=resolve;}):Promise.resolve(second)}}});
  audioGlobals();const capture=new Capture();const old=capture.start(()=>{});await capture.cancel();
  await capture.start(()=>{});resolveOld(first);await old;
  assert.equal(first.track.stopped,1);assert.equal(second.track.stopped,0);assert.equal(capture.stream,second);
  await capture.cancel();assert.equal(second.track.stopped,1);
});
test('an old worklet loading late cannot close the replacement capture context',async()=>{
  const Capture=await load();const first=stream(),second=stream();let count=0,resolveModule,moduleCount=0;
  Object.defineProperty(global,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>++count===1?first:second}}});
  audioGlobals(()=>++moduleCount===1?new Promise(resolve=>{resolveModule=resolve;}):Promise.resolve());
  const capture=new Capture();const old=capture.start(()=>{});await tick();await capture.cancel();
  await capture.start(()=>{});const current=capture.context;resolveModule();await old;
  assert.equal(capture.context,current);assert.notEqual(current.closed,true);assert.equal(second.track.stopped,0);
  await capture.stop();assert.ok(second.track.stopped>=1);assert.equal(capture.context,null);
});
