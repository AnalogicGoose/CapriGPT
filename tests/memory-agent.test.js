'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {MemoryStore}=require('../src/main/memory');
const {MemoryAgent,memoryIntent,validate}=require('../src/main/memory-agent');
const {PersonalAssistant}=require('../src/main/personal-assistant');
const plan=(intent,changes=[],message='',selectedIds=[])=>({intent,changes,message,selectedIds});
function fixture(t){
  const store=new MemoryStore(':memory:');t.after(()=>store.close());
  const row=store.remember('Uses English and Spanish. Plays Cyberpunk 2077; interested in useful coding projects and WoW loot tools.','explicit',{profile:true});
  const cfg={privacy:{memoryEnabled:true,memoryRecall:true,memoryConfirmChanges:true}};let accept=true,seen,request;
  let response=plan('change',[{kind:'edit',id:row.id,text:'Uses English and Spanish. Plays Cyberpunk 2077; interested in useful coding projects.'},{kind:'add',id:0,text:'I like games and cool coding stuff.'}]);
  const agent=new MemoryAgent({settings:()=>cfg,store:()=>store,models:async()=>['qwen3.5:9b'],
    infer:async value=>{request=value;return JSON.stringify(response);},confirm:async(title,detail)=>{seen=detail;return accept;}});
  return {agent,store,row,cfg,answer:value=>{response=value;},accept:value=>{accept=value;},review:()=>seen,request:()=>request};
}
test('natural memory requests include polite compounds, corrections and recall without hijacking examples or ordinary chat',()=>{
  for(const text of ['forget about wow. remember i like games and cool coding stuff','could you forget about WoW?','please update my profile: I like games','what do you remember about me?','remember what I told you about my interests','puedes borrar wow de mi memoria'])assert.equal(memoryIntent(text),true,text);
  for(const text of ['open Chrome','forget it','I cannot remember the movie title','how do I forget a memory?','remember I prefer coffee','forget 2','/memory list'])assert.equal(memoryIntent(text),false,text);
  assert.equal(memoryIntent('no, only the WoW part',true),true);assert.equal(memoryIntent('no, only the WoW part'),false);
});
test('compound request reviews one exact diff, edits only the topic and adds the explicit preference atomically',async t=>{
  const f=fixture(t);
  const assistant=new PersonalAssistant({settings:()=>f.cfg,store:()=>f.store,memoryRequests:f.agent,context:{},confirm:async()=>{throw Error('Legacy path must not run.');}});
  const result=await assistant.route('forget about wow. remember i like games and cool coding stuff');
  assert.doesNotMatch(result.text,/Local commands:/);assert.match(result.text,/Remembered: I like games/);
  assert.match(f.review(),/Replace: Uses English/);assert.match(f.review(),/WoW/);assert.match(f.review(),/With: Uses English/);
  assert.doesNotMatch(f.store.get(f.row.id).text,/WoW/);assert.match(f.store.get(f.row.id).text,/Cyberpunk/);assert.equal(f.store.get(f.row.id).profile,1);
  assert.equal(f.store.search('cool coding')[0].text,'I like games and cool coding stuff.');
  assert.equal(f.agent.status().outcome,'completed');assert.equal(f.agent.status().changes,2);
  assert.doesNotMatch(JSON.stringify(f.agent.status()),/WoW|Cyberpunk|coding/);
});
test('cancelled review changes nothing and cannot silently count as approval on a follow-up',async t=>{
  const f=fixture(t);f.accept(false);
  assert.equal((await f.agent.route('forget about wow')).text,'No changes saved.');assert.match(f.store.get(f.row.id).text,/WoW/);assert.equal(f.store.list().length,1);
  assert.equal(f.agent.status().outcome,'cancelled');assert.equal(f.agent.status().changes,0);
  f.answer(plan('clarify',[],'Which detail do you mean?'));
  assert.match((await f.agent.route('yes')).text,/Which detail/);assert.equal(f.store.list().length,1);
});
test('ambiguous correction uses bounded previous memory context and recall only returns existing selected facts',async t=>{
  const f=fixture(t);f.answer(plan('clarify',[],'Do you mean only the WoW detail?'));
  assert.match((await f.agent.route('forget that memory')).text,/only the WoW/);
  await f.agent.route('no, just WoW');
  const data=JSON.parse(f.request().messages.at(-1).content);assert.equal(data.previousMemoryTurn.request,'forget that memory');
  f.answer(plan('recall',[],'', [f.row.id]));
  assert.equal((await f.agent.route('what do you remember about me?')).text,f.row.text);
});
test('validation rejects invented IDs, duplicate changes, secrets and changes attached to a question',()=>{
  const rows=[{id:1}];
  for(const output of [plan('change',[{kind:'forget',id:999,text:''}]),plan('change',[{kind:'forget',id:1,text:''},{kind:'edit',id:1,text:'x'}]),plan('change',[{kind:'add',id:0,text:'my password is secret'}]),plan('recall',[{kind:'forget',id:1,text:''}])])assert.throws(()=>validate(output,rows));
});
test('changed or deleted memory during review causes a full rollback, preserving other additions',async t=>{
  const f=fixture(t);f.agent.confirm=async()=>{f.store.edit(f.row.id,'Updated elsewhere');return true;};
  assert.match((await f.agent.route('forget about wow')).text,/No changes saved/);
  assert.equal(f.store.list().length,1);assert.equal(f.store.get(f.row.id).text,'Updated elsewhere');
  assert.throws(()=>f.store.applyChanges([{kind:'add',id:0,text:'Temporary addition'},{kind:'invalid',id:0,text:''}],[]));assert.equal(f.store.list().length,1);
});
test('cancellation and permission revocation during inference/review never mutate saved memory',async t=>{
  const f=fixture(t);f.agent.confirm=async()=>{f.cfg.privacy.memoryEnabled=false;return true;};
  assert.match((await f.agent.route('forget about wow')).text,/No changes saved/);assert.match(f.store.get(f.row.id).text,/WoW/);
  f.cfg.privacy.memoryEnabled=true;f.agent.confirm=async()=>{f.agent.cancel();return true;};
  assert.match((await f.agent.route('forget about wow')).text,/stopped/);assert.match(f.store.get(f.row.id).text,/WoW/);
});
test('memory-off, paused, offline, expired and unrelated follow-ups remain bounded and truthful',async t=>{
  const f=fixture(t);f.cfg.privacy.memoryEnabled=false;assert.match((await f.agent.route('forget about wow')).text,/off/);assert.equal(f.request(),undefined);
  f.cfg.privacy.memoryEnabled=true;f.agent.models=async()=>[];assert.match((await f.agent.route('forget about wow')).text,/unavailable/);
  f.agent.models=async()=>['qwen3.5:9b'];f.answer(plan('clarify',[],'Which detail?'));await f.agent.route('forget that memory');
  assert.equal(await f.agent.route('tell me a joke'),null);assert.equal(await f.agent.route('no just wow'),null);
  await f.agent.route('forget that memory');f.agent.now=()=>Date.now()+120001;assert.equal(await f.agent.route('no just wow'),null);
  f.cfg.gamingMode=true;assert.match((await f.agent.route('forget about wow')).text,/Resume/);
});

test('requested semantic memory changes commit without dialogs when review is off; ambiguity still asks a question',async t=>{
  const f=fixture(t);f.cfg.privacy.memoryConfirmChanges=false;
  f.agent.confirm=async()=>{throw Error('Unexpected confirmation');};
  assert.match((await f.agent.route('forget about wow. remember i like games and cool coding stuff')).text,/Remembered/);
  assert.doesNotMatch(f.store.get(f.row.id).text,/WoW/);assert.match(f.store.get(f.row.id).text,/Cyberpunk/);
  const count=f.store.list().length;f.answer(plan('clarify',[],'Which detail should I forget?'));
  assert.match((await f.agent.route('forget that memory')).text,/Which detail/);assert.equal(f.store.list().length,count);
});
