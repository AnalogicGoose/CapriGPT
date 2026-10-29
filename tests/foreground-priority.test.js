'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Agent}=require('../src/main/agent');
const {ForegroundPriority}=require('../src/main/foreground-priority');
test('ordinary foreground question cancels background inference, waits for cleanup and prevents events stealing its reply',async()=>{
  let entered,aborted=false,calls=0;
  const started=new Promise(resolve=>{entered=resolve;});let agent;
  const priority=new ForegroundPriority(()=>agent);
  agent=new Agent({settings:()=>({agentEnabled:true}),world:{refresh:async()=>({})},models:async()=>['qwen3.5:9b'],
    apps:{},close:async()=>{},foregroundBusy:()=>priority.active>0,
    infer:async(request,signal)=>{calls++;entered();await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('cancelled'));},{once:true}));},
  });
  const background=agent.run('','resume');await started;
  const answer=await priority.run(async()=>{
    assert.equal(aborted,true);assert.equal(agent.busy,false);assert.equal(priority.active,1);
    assert.equal(await agent.run('','foreground-change'),'Foreground request has priority');
    return 'Gabriel lives in Nicaragua.';
  });
  assert.equal(answer,'Gabriel lives in Nicaragua.');assert.equal(calls,1);assert.equal(priority.active,0);await background;
});
test('foreground reservation releases after failures and does not cancel an explicit user task',async()=>{
  let cancellations=0;
  const agent={busy:true,reason:'user-request',cancel:()=>{cancellations++;}};
  const priority=new ForegroundPriority(()=>agent);
  await assert.rejects(priority.run(async()=>{throw Error('foreground failed');}),/foreground failed/);
  assert.equal(priority.active,0);assert.equal(cancellations,0);
  agent.busy=false;assert.equal(await priority.run(async()=>42),42);assert.equal(priority.active,0);
});
