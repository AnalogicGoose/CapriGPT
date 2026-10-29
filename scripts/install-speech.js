'use strict';
const path=require('node:path');
const {ensureRuntime}=require('../src/main/speech-runtime');
const root=path.resolve(__dirname,'..','.caprigpt-local','speech-runtime');
ensureRuntime(root,event=>console.log(`${event.asset}: ${event.percent}%`),{gpu:process.argv.includes('--gpu')})
  .then(runtime=>console.log('READY: '+JSON.stringify(runtime)))
  .catch(error=>{console.error(error.message);process.exitCode=1;});
