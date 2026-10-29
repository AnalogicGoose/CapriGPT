'use strict';
// Real local Qwen + temporary SQLite. No real personal data is modified.
const assert=require('node:assert/strict');
const {MemoryStore}=require('../src/main/memory');
const {MemoryAgent}=require('../src/main/memory-agent');
const ollama=require('../src/main/ollama');
(async()=>{
  const started=await require('../src/main/ollama-runtime').start();assert.equal(started.ok,true,started.error);
  const store=new MemoryStore(':memory:');
  try {
    const original=store.remember('Uses English and Spanish. Plays Cyberpunk 2077; interested in useful coding projects and WoW loot tools.','explicit',{profile:true});
    let reviews=0,details='';
    const noReview=process.argv.includes('--no-review');
    const agent=new MemoryAgent({settings:()=>({privacy:{memoryEnabled:true,memoryConfirmChanges:!noReview}}),store:()=>store,models:ollama.models,
      infer:async(request,signal)=>{const raw=await ollama.chat(request,()=>{},signal);if(process.env.CAPRI_DEBUG_MEMORY_PLAN==='1')console.log('TEMPORARY TEST PLAN:',raw);return raw;},confirm:async(title,text)=>{reviews++;details=text;return true;}});
    let result=await agent.route('forget about wow. remember i like games and cool coding stuff');
    console.log('COMPOUND:',result.text);console.log('REVIEW:',details);
    assert.equal(reviews,noReview?0:1);assert.doesNotMatch(store.get(original.id).text,/\bWoW\b/i);assert.match(store.get(original.id).text,/English/);assert.match(store.get(original.id).text,/Cyberpunk/);assert.equal(store.get(original.id).profile,1);
    assert.ok(store.search('games').length);assert.ok(store.search('coding').length);
    result=await agent.route('what do you remember about my interests?');console.log('RECALL:',result.text);assert.match(result.text,/games|coding/i);
    if(noReview){console.log('PASS: real Qwen compound memory correction saved without any confirmation; real user data unchanged.');return;}
    agent.confirm=async()=>false;
    const before=store.export();result=await agent.route('could you remove my Cyberpunk interest from your memory please?');
    console.log('CANCELLED:',result.text);assert.equal(store.export().replace(/"exported_at": "[^"]+"/,'"exported_at":"ignored"'),before.replace(/"exported_at": "[^"]+"/,'"exported_at":"ignored"'));
    assert.equal(result.text,'No changes saved.');
    console.log('PASS: real Qwen understands compound topic correction and preference, preserves other profile facts, recalls interests and respects cancelled review. Real user data unchanged.');
  }finally{store.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
