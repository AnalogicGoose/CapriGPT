'use strict';
const assert=require('node:assert/strict');
const {ActionAgent}=require('../src/main/action-agent');
const {WebTools}=require('../src/main/web-tools');
const ollama=require('../src/main/ollama');
(async()=>{
  const started=await require('../src/main/ollama-runtime').start();assert.equal(started.ok,true,started.error);
  const runner=new ActionAgent({settings:()=>({agentEnabled:true,desktopActions:true}),models:ollama.models,
    infer:(request,signal)=>ollama.chat(request,()=>{},signal),web:new WebTools(),
    desktop:{open:async()=>{throw Error('Desktop launches belong to the Electron live test.');}},
    browser:{play:async item=>({...item,playing:false,note:'Playback deliberately disabled in this data/planner test.'}),stop(){},open:async url=>({opened:true,url})},
    progress:event=>console.log('PROGRESS:',event.text),
  });
  for(const [goal,expected] of [
    ['capri play the newest rubius video in youtube',/Opened .*Rubius Z/],
    ['capri look for the latest news of ai models',/Fresh headlines/],
    ['capri look for the best discounts in steam',/Current featured Steam discounts/],
  ]) {
    const at=Date.now(),result=await runner.route(goal);
    assert.match(result.text,expected,result.text);assert.ok(result.links?.length);
    console.log(`PASS: real Qwen planner + live public data: ${goal}; ${Date.now()-at}ms`);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
