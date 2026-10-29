'use strict';
// Real Qwen and installed-app discovery; launch effects are deliberately stubbed.
const assert=require('node:assert/strict');
const {ActionAgent}=require('../src/main/action-agent');
const {DesktopTools}=require('../src/main/desktop-tools');
const ollama=require('../src/main/ollama');
(async()=>{
  const runtime=await require('../src/main/ollama-runtime').start();assert.equal(runtime.ok,true,runtime.error);
  const opened=[];let calls=0;
  const desktop=new DesktopTools({openPath:async file=>{opened.push(file);return '';},native:{desktopApps:()=>[{name:'chrome'}]}});
  assert.equal(desktop.matchName('Chrome'),'Google Chrome');
  const runner=new ActionAgent({settings:()=>({agentEnabled:true,desktopActions:true}),desktop,models:ollama.models,
    infer:(request,signal)=>{calls++;return ollama.chat(request,()=>{},signal);},web:{},browser:{stop(){}}});
  assert.match((await runner.route('open Chrome')).text,/Google Chrome/);
  const followup=await runner.route('open it again');
  assert.match(followup.text,/Google Chrome has a visible/);
  assert.equal(calls,1);assert.equal(opened.length,2);assert.equal(opened[0],opened[1]);
  console.log('PASS: real Qwen resolves "open it again" from the previous Chrome task; real discovery, launch effects stubbed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
