'use strict';
// Isolated renderer check: no main app, model, hooks, profile or desktop interactions.
// node_modules/electron/dist/electron.exe scripts/check-animations.js
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.caprigpt-local', 'animation-check');
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'profile'));
const timeout = setTimeout(() => { console.error('Animation renderer timed out'); app.exit(1); }, 25000);
app.whenReady().then(async () => {
  try {
    const url = name => pathToFileURL(path.join(root, name)).href;
    const html = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;background:#211c2b;color:#eee;font:14px system-ui}
      h1{font-size:20px;margin:20px} main{display:grid;grid-template-columns:repeat(5,220px)}
      section{height:280px;text-align:center;border:1px solid #44374e}canvas{display:block;margin:0 auto}
    </style><h1>Capri · original artwork / held action drawings</h1><main></main>
    <script type="module">
      import { Capri } from '${url('src/renderer/js/capri.js')}';
      import { SpriteRenderer } from '${url('src/renderer/js/sprite.js')}';
      import { Player, NEUTRAL } from '${url('src/renderer/js/acting.js')}';
      try {
        const image = new Image(); image.src = '${url('assets/capri/capri-full.png')}'; await image.decode();
        const animateRAF = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = () => 0;
        const root = document.createElement('div'), canvas = document.createElement('canvas'); root.append(canvas);
        const pet = new Capri({root, canvas, image, fx:{}, voice:{}});
        window.animationPet = pet;
        const check = (condition, message) => {if (!condition) throw Error(message)};
        pet.setMode('work'); pet.reactToTool('Edit'); check(pet.act.player.name === 'type','edit action');
        const first = pet.act; pet.reactToTool('Read'); check(pet.act === first,'burst throttling');
        pet.setMode('alert'); check(pet.act.player.name === 'listen','alert interrupts routine action');
        pet.endAct(false); pet.nextAction=0; pet.reactToTool('Read'); check(!pet.act,'alert priority');
        pet.setMode('idle'); pet.setChatThinking(true); check(pet.base.name === 'focus','chat focus');
        pet.setChatThinking(false); check(pet.base.name === 'stand','chat focus cleanup'); pet.endAct(false);
        pet.nextIdle=0; pet.nextMove=pet.nextGaze=pet.nextTwitch=pet.nextShed=Infinity;
        pet.behave(performance.now()); const idle=pet.act.player.name; check(idle.startsWith('idle'),'idle scheduler');
        pet.endAct(false); pet.nextIdle=0; pet.behave(performance.now()); check(pet.act.player.name!==idle,'idle repeat');
        pet.nextAction=0; pet.reactToTool('Read'); check(pet.act.player.name==='read','real activity interrupts idle');
        pet.endAct(false); pet.setStance('sit',{perch:{id:1,dx:100}}); pet.perform('idleStretch'); pet.drawFrame(performance.now()+500);
        check(pet.p.sit===1 && Math.abs(pet.bob)<=3,'seated gesture stays anchored'); pet.endAct(false);
        pet.setStance('stand'); pet.perform('victory'); pet.setMode('alert'); check(pet.act.player.name==='victory','strong action priority');
        pet.endAct(false); pet.gaming=true; pet.perform('hop'); check(!pet.act,'gaming blocks reactions');
        pet.perform('gameReady'); check(pet.act.player.name==='gameReady','gaming departure');
        pet.drawFrame(performance.now()+1000); check(!pet.act,'gaming departure finishes');
        window.requestAnimationFrame = animateRAF;
        pet.fx = new Proxy({}, {get: () => () => {}}); pet.voice = {play(){}};
        await pet.gamingDeparture();
        check(pet.p.alpha===0 && pet.p.collapse===1 && pet.root.dataset.gamingTeleport==='away','gaming teleports out');
        pet.gaming=false; pet.prepareGamingReturn();
        check(pet.p.alpha===0 && pet.busy,'return stays invisible before overlay shows');
        await pet.gamingArrival();
        check(pet.p.alpha===1 && pet.p.collapse===0 && pet.p.dissolve===0 && !pet.busy,'gaming teleports back');
        pet.fullscreenProgress=.5;pet.drawFrame();
        const spriteGL=pet.sprite.gl, program=spriteGL.getParameter(spriteGL.CURRENT_PROGRAM);
        check(spriteGL.getUniform(program,spriteGL.getUniformLocation(program,'uAlpha'))===.5 && pet.p.alpha===1,
          'fullscreen opacity composes without changing the underlying sprite');
        pet.fullscreenProgress=0;pet.drawFrame();
        for(const name of ['stand','idleSway','idlePreen','idleStretch','listen','think','read','search','type','gameReady','drag','fall','dropLand','dropPlop']) {
          const cell=document.createElement('section'); cell.textContent=name;
          const c=document.createElement('canvas');cell.append(c);document.querySelector('main').append(cell);
          const renderer=new SpriteRenderer(c,image); renderer.resize(.46);
          const player=new Player(name,{at:0,dir:1});
          let frames=0;for(const key of player.act.keys){renderer.draw({...pet.p,...NEUTRAL,...player.resolve(key[1],1),sit:0});frames++}
          const drawing=player.sample(player.total*.45*1000/(player.act.fps||12));
          const pose={...NEUTRAL,...player.resolve(drawing.pose,1)};
          renderer.draw({...pet.p,...pose,sit:0,alpha:1});
          c.style.transform='translateY('+pose.bob+'px) rotate('+pose.tilt+'deg)';
          check(renderer.gl.getError()===renderer.gl.NO_ERROR,name+' WebGL');
        }
        window.result={ok:true,checks:'priority, cooldown, idle rotation, chat cleanup, ledge anchoring, gaming and every new drawing'};
      } catch(error) { window.result={ok:false,error:error.stack}; }
    </script>`;
    const page = path.join(output, 'preview.html'); fs.writeFileSync(page, html);
    const win = new BrowserWindow({ show: false, width: 1130, height: 1140, webPreferences: { backgroundThrottling: false } });
    await win.loadFile(page);
    let result;
    for (let i=0;i<100;i++) {
      result=await win.webContents.executeJavaScript('window.result');
      if(result) break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(result?.ok, result?.error || 'No renderer result');
    const capture=path.join(output, 'poses.png');
    await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    fs.writeFileSync(capture, (await win.webContents.capturePage()).toPNG());
    const dragPoint = await win.webContents.executeJavaScript(`(() => {
      const pet=window.animationPet;
      pet.gaming=false;pet.setMode('idle');pet.setStance('stand');pet.endAct(false);
      pet.pos={x:400,y:500};pet.windows={fg:0,wins:[]};pet.root.style.position='fixed';pet.root.style.top='0';pet.root.style.left='0';pet.root.style.zIndex='20';
      document.body.append(pet.root);pet.drawFrame();
      for(let y=320;y<460;y+=4)for(let x=350;x<450;x+=4)if(pet.hit(x,y))return {x,y};
      throw Error('No draggable point on original sprite');
    })()`);
    const mouse = (type, x, y, extra = {}) => win.webContents.sendInputEvent({ type, x, y, ...extra });
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    mouse('mouseMove', dragPoint.x, dragPoint.y);
    mouse('mouseDown', dragPoint.x, dragPoint.y, {button:'left',clickCount:1});
    await pause(40);
    mouse('mouseMove', dragPoint.x+60, dragPoint.y-100, {modifiers:['leftButtonDown']});
    await pause(50);
    assert.equal(await win.webContents.executeJavaScript(`(() => {
      const pet=window.animationPet;pet.drawFrame(performance.now()+220);
      return pet.dragging && pet.base.name==='drag' && pet.interval()<20 && pet.p.kickL!==pet.p.kickR;
    })()`), true, 'Actual mouse drag starts smooth arm and leg flailing');
    mouse('mouseUp', dragPoint.x+60, dragPoint.y-100, {button:'left',clickCount:1});
    await pause(50);
    assert.equal(await win.webContents.executeJavaScript(`(() => {
      const pet=window.animationPet;
      if(pet.dragging||pet.stance!=='fall')return false;
      pet.drawFrame(performance.now()+180);
      const before=pet.pos.y;pet.updateFall(pet.lastFall+16);
      if(pet.pos.y<=before)return false;
      for(let i=0;i<300&&pet.stance==='fall';i++)pet.updateFall(pet.lastFall+16);
      return pet.pos.y===pet.floor && pet.stance==='stand' && pet.act.player.name==='dropLand';
    })()`), true, 'Release falls under gravity and finishes with a smooth floor landing');
    const secondPoint = await win.webContents.executeJavaScript(`(() => {
      const pet=window.animationPet;pet.endAct(false);pet.pos={x:400,y:500};pet.setStance('stand');pet.drawFrame();
      pet.canvas.addEventListener('pointerdown',e=>{window.testPointerId=e.pointerId;},{once:true});
      for(let y=360;y<460;y+=4)for(let x=370;x<440;x+=4)if(pet.hit(x,y)&&document.elementFromPoint(x,y)===pet.canvas)return {x,y};
      throw Error('No pointer target for cancellation check');
    })()`);
    await pause(60);
    mouse('mouseMove', secondPoint.x, secondPoint.y);
    mouse('mouseDown', secondPoint.x, secondPoint.y, {button:'left',clickCount:1});
    await pause(40);
    await win.webContents.executeJavaScript(`window.dispatchEvent(new PointerEvent('pointermove',{
      pointerId:window.testPointerId,clientX:${secondPoint.x+60},clientY:${secondPoint.y-100},buttons:1
    }))`);
    const blurCheck = await win.webContents.executeJavaScript(`(() => {
      const pet=window.animationPet;if(!pet.dragging)return {error:'Second pickup failed',stance:pet.stance,busy:pet.busy,pos:pet.pos,alpha:pet.p.alpha};
      window.dispatchEvent(new Event('blur'));
      return !pet.dragging && pet.stance==='fall';
    })()`);
    assert.equal(blurCheck, true, 'Losing focus releases the captured pointer and drops her safely: '+JSON.stringify(blurCheck));
    mouse('mouseUp', secondPoint.x+60, secondPoint.y-100, {button:'left',clickCount:1});
    assert.equal(await win.webContents.executeJavaScript(`(() => {
      const pet=window.animationPet;pet.endAct(false);pet.windows={fg:1,wins:[{id:1,x:100,y:350,w:800,h:500}]};
      pet.pos={x:400,y:300};pet.setStance('stand');pet.fall();
      for(let i=0;i<300&&pet.stance==='fall';i++)pet.updateFall(pet.lastFall+16);
      return pet.stance==='sit' && pet.perch.id===1 && pet.act.player.name==='dropPlop';
    })()`), true, 'Falling can also land on a valid window ledge');
    await win.webContents.executeJavaScript('window.animationPet.root.remove();window.animationPet.endAct(false);window.animationPet.setStance("stand")');
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    assert.equal(await win.webContents.executeJavaScript(`
      (async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        const pet=window.animationPet;
        pet.endAct(false); pet.gaming=false; pet.setMode('idle'); pet.nextIdle=0;
        pet.fullscreenProgress=.5;pet.drawFrame();
        const gl=pet.sprite.gl,program=gl.getParameter(gl.CURRENT_PROGRAM);
        if(gl.getUniform(program,gl.getUniformLocation(program,'uCollapse'))!==pet.p.collapse)return false;
        pet.fullscreenProgress=0;
        pet.dragging=true;pet.setStance('stand');pet.drawFrame();
        const held=pet.p.armL;pet.drawFrame(performance.now()+200);
        if(pet.p.armL!==held || pet.interval()<80)return false;
        pet.dragging=false;pet.setStance('stand');
        pet.nextTwitch=pet.nextGaze=pet.nextShed=pet.nextMove=Infinity;
        pet.behave(performance.now());
        if(pet.act) return false;
        pet.gaming=true; await pet.perform('gameReady');
        await pet.gamingDeparture();
        if(pet.p.alpha!==0) return false;
        pet.gaming=false; pet.prepareGamingReturn(); await pet.gamingArrival();
        return !pet.act && pet.p.alpha===1 && matchMedia('(prefers-reduced-motion: reduce)').matches;
      })()
    `), true, 'Reduced motion skips idle and gaming gestures');
    win.webContents.debugger.detach();
    console.log(`PASS: ${result.checks}, actual pointer drag/drop, floor/ledge landing, reduced motion\nPose gallery: ${capture}`);
    clearTimeout(timeout); app.exit(0);
  } catch(error) { console.error(error); clearTimeout(timeout); app.exit(1); }
});
