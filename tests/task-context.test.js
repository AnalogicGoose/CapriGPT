'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {TaskContext}=require('../src/main/task-context');
const {DesktopTools}=require('../src/main/desktop-tools');
const {ActionAgent}=require('../src/main/action-agent');
const {inject}=require('../src/main/capabilities');
function fixture(extra={}) {
  let at=1000;const opened=[];let inferred=0;
  const desktop=new DesktopTools({now:()=>at,executables:()=>[],shortcuts:()=>[
    {label:'Google Chrome',file:'C:\\Apps\\Chrome.lnk'},{label:'Firefox',file:'C:\\Apps\\Firefox.lnk'},
  ],openPath:async file=>{opened.push(file);return '';},native:{desktopApps:()=>[{name:'chrome'},{name:'firefox'}]}});
  const runner=new ActionAgent({settings:()=>({desktopActions:true,agentEnabled:true}),desktop,now:()=>at,
    models:async()=>['qwen3.5:9b'],infer:async request=>{
      inferred++;const data=JSON.parse(request.messages.at(-1).content);
      assert.equal(data.taskContext.recentTasks.at(-1).outcomes[0].title,'Google Chrome');
      return JSON.stringify({message:'',steps:[{tool:'open_app',query:'Chrome',index:0}]});
    },web:{},browser:{stop(){}},...extra});
  return {runner,desktop,opened,time:ms=>{at+=ms;},inferred:()=>inferred};
}
test('Chrome alias is identical in matching, direct execution and planner-selected open_app calls',async()=>{
  const f=fixture();assert.equal(f.desktop.matchName('Chrome'),'Google Chrome');
  assert.equal(f.desktop.resolve('Chrome').target.label,'Google Chrome');
  assert.match((await f.desktop.open('Chrome')).note,/Google Chrome has a visible/);
  await f.runner.route('open Chrome');
  assert.match((await f.runner.route('open it again')).text,/Google Chrome has a visible/);
  assert.deepEqual(f.opened,['C:\\Apps\\Chrome.lnk','C:\\Apps\\Chrome.lnk','C:\\Apps\\Chrome.lnk']);assert.equal(f.inferred(),1);
});
test('browser choice persists as structured state; number and instead corrections resolve without a model',async()=>{
  const f=fixture();
  assert.match((await f.runner.route('open a browser')).text,/1\. Google Chrome.*2\. Firefox/);
  assert.equal(f.runner.context.snapshot().pending.goal,'open a browser');
  await f.runner.route('the second one');assert.deepEqual(f.opened,['C:\\Apps\\Firefox.lnk']);
  await f.runner.route('Chrome instead');assert.deepEqual(f.opened,['C:\\Apps\\Firefox.lnk','C:\\Apps\\Chrome.lnk']);assert.equal(f.inferred(),0);
});
test('a vague yes with multiple choices asks again, while a single verified typo suggestion can be accepted',async()=>{
  const f=fixture();await f.runner.route('open a browser');
  assert.match((await f.runner.route('yes')).text,/Which browser/);assert.equal(f.opened.length,0);
  const typo=await f.runner.route('open Chorme');
  assert.match(typo.text,/doesn’t prove it isn’t installed/);
  assert.deepEqual(f.runner.context.snapshot().pending.choices,['Google Chrome']);
  await f.runner.route('yes');assert.deepEqual(f.opened,['C:\\Apps\\Chrome.lnk']);
});
test('expired choices, cancellation and unrelated conversation cannot resume an old action',async()=>{
  const f=fixture();await f.runner.route('open a browser');f.time(120001);
  assert.equal(await f.runner.route('the second one'),null);assert.equal(f.opened.length,0);
  await f.runner.route('open a browser');await f.runner.route('/cancel');
  assert.equal(await f.runner.route('the second one'),null);
  await f.runner.route('open Chrome');await f.runner.route('tell me a joke');
  assert.equal(await f.runner.route('Firefox instead'),null);assert.equal(f.opened.length,1);
});
test('missing launch entry, failed discovery and failed launch are separate evidence states, never proof of uninstall',async()=>{
  const f=fixture();await assert.rejects(f.desktop.open('Imaginary App'),error=>error.code==='APP_LOOKUP_NOT-FOUND'&&!/not installed/i.test(error.message));
  assert.equal(f.desktop.evidence().latestLookup.status,'not-found');
  const broken=new DesktopTools({shortcuts:()=>{throw Error('offline');},executables:()=>[],openPath:async()=>'',native:{}});
  assert.equal(broken.resolve('Chrome').status,'unavailable');assert.equal(broken.evidence().available,false);
  const failed=new DesktopTools({shortcuts:()=>[{label:'Google Chrome',file:'C:\\Apps\\Chrome.lnk'}],executables:()=>[],openPath:async()=> 'Windows refused to launch',native:{}});
  await assert.rejects(failed.open('Chrome'),/Windows refused/);assert.equal(failed.evidence().latestLookup.status,'found');
});
test('verified standard executable paths can supply missing shortcuts without turning the catalog into an absence claim',()=>{
  const desktop=new DesktopTools({shortcuts:()=>[],executables:()=>[{label:'Google Chrome',file:'C:\\Chrome\\chrome.exe',source:'verified standard installation'}],openPath:async()=>'',native:{}});
  assert.equal(desktop.matchName('Chrome'),'Google Chrome');assert.equal(desktop.evidence().exhaustive,false);
});
test('task context is bounded, expires, excludes raw outputs and never carries action approval',()=>{
  let at=1000;const context=new TaskContext({now:()=>at});
  for(let i=0;i<10;i++)context.record('open Chrome','completed',[{type:'app',title:'Google Chrome',file:'SECRET_PATH',raw:'SECRET_OUTPUT',approval:true}],'app-launch');
  assert.equal(context.recent.length,6);assert.equal(context.snapshot().recentTasks.length,4);
  assert.doesNotMatch(JSON.stringify(context.snapshot()),/SECRET_PATH|SECRET_OUTPUT|"approval":true/);
  context.record('open Chrome','cancelled',[],'app-launch');assert.equal(context.latestLaunch(),null);
  at+=600001;assert.equal(context.snapshot().recentTasks.length,0);
});
test('ordinary chat receives authoritative task/app evidence with an explicit no-negative-inference rule',()=>{
  const f=fixture();const messages=inject([{role:'system',content:'Persona'},{role:'user',content:'Do I have Chrome?'}],{},f.runner.grounding());
  assert.match(messages[0].content,/Google Chrome/);assert.match(messages[0].content,/not uninstalled/);
  assert.ok(JSON.stringify(f.runner.grounding()).length<=3000);
  assert.equal(f.runner.grounding({includeApps:false}).appEvidence,undefined);
});
