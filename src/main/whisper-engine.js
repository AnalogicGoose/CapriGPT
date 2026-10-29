'use strict';
const path=require('node:path'),fs=require('node:fs'),net=require('node:net'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {ensureRuntime}=require('./speech-runtime');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){return new Promise((resolve,reject)=>{
  const server=net.createServer();server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});
});}
function wave(pcm){
  const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);
  header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(16000,24);
  header.writeUInt32LE(32000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  return Buffer.concat([header,pcm]);
}
class WhisperEngine {
  constructor({runtimeDir,launch=spawn}={}){
    this.runtimeDir=runtimeDir||path.resolve(__dirname,'../../.caprigpt-local/speech-runtime');this.launch=launch;this.epoch=0;
  }
  async start(onProgress=()=>{}){
    if(this.child&&this.url&&this.child.exitCode===null)return;
    const epoch=++this.epoch;
    const gpu=process.platform==='win32'&&fs.existsSync(path.join(process.env.SystemRoot||'C:\\Windows','System32','nvidia-smi.exe'));
    const runtime=await ensureRuntime(this.runtimeDir,onProgress,{gpu});
    if(epoch!==this.epoch)throw Error('speech-cancelled');
    for(const server of [...new Set([runtime.server,runtime.cpuServer])]){
      const port=await freePort(),prefix='/'+crypto.randomBytes(16).toString('hex');
      if(epoch!==this.epoch)throw Error('speech-cancelled');
      const child=this.launch(server,['-m',runtime.model,'--host','127.0.0.1','--port',String(port),'--request-path',prefix,
        '-l','auto','-t','8','--vad','-vm',runtime.vad,'-vspd','150',...(server===runtime.cpuServer?['-ng']:[])],
      {windowsHide:true,cwd:path.dirname(server),stdio:['ignore','ignore','ignore']});
      this.child=child;this.url=`http://127.0.0.1:${port}${prefix}`;
      let failed=false;child.on('error',()=>{failed=true;});
      for(let i=0;i<450;i++){
        if(epoch!==this.epoch){child.kill();throw Error('speech-cancelled');}
        if(failed||child.exitCode!==null)break;
        try{const response=await fetch(this.url+'/health',{signal:AbortSignal.timeout(500)});
          if(response.ok){this.device=server===runtime.cpuServer?'CPU':'GPU';return;}
        }catch{}
        await sleep(100);
      }
      child.kill();
    }
    this.child=null;this.url=null;throw Error('speech-unavailable');
  }
  async transcribe(pcm,signal){
    if(!this.url||!this.child||this.child.exitCode!==null)throw Error('speech-unavailable');
    const form=new FormData();form.append('file',new Blob([wave(pcm)],{type:'audio/wav'}),'utterance.wav');
    form.append('response_format','json');form.append('language','auto');form.append('temperature','0');form.append('translate','false');
    const response=await fetch(this.url+'/inference',{method:'POST',body:form,
      signal:signal?AbortSignal.any([signal,AbortSignal.timeout(90000)]):AbortSignal.timeout(90000)});
    if(!response.ok)throw Error('recognizer-failed');
    const data=await response.json();return typeof data.text==='string'?data.text.replace(/\[_.*?_\]|\[BLANK_AUDIO\]/g,'').trim():'';
  }
  stop(){this.epoch++;const child=this.child;this.child=null;this.url=null;try{child?.kill();}catch{}}
}
module.exports={WhisperEngine,wave};
