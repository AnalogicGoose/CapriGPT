'use strict';
const { BrowserWindow, session } = require('electron');
const path = require('node:path');
const { publicUrl } = require('./web-tools');
const pause = (ms,signal) => new Promise((resolve,reject)=>{
  signal?.throwIfAborted(); const timer=setTimeout(done,ms);
  function done(){signal?.removeEventListener('abort',abort);resolve();}
  function abort(){clearTimeout(timer);reject(signal.reason);}
  signal?.addEventListener('abort',abort,{once:true});
});
function createAgentBrowser() {
  let window;
  function ensure() {
    if(window && !window.isDestroyed()) return window;
    const browsing=session.fromPartition('capri-public-browser'); // separate, non-persistent public browsing
    browsing.setPermissionRequestHandler((_wc,_permission,answer)=>answer(false));
    browsing.setPermissionCheckHandler(()=>false);
    browsing.on('will-download',event=>event.preventDefault());
    window=new BrowserWindow({ width:1100,height:760,title:'Capri Browser',show:false,
      icon:path.resolve(__dirname,'../../assets/icons/capri.ico'),autoHideMenuBar:true,
      webPreferences:{session:browsing,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,autoplayPolicy:'no-user-gesture-required'} });
    window.setMenu(null);
    const allowed=value=>{try{publicUrl(value);return true;}catch{return false;}};
    window.webContents.on('will-navigate',(event,url)=>{if(!allowed(url))event.preventDefault();});
    window.webContents.on('will-redirect',(event,url)=>{if(!allowed(url))event.preventDefault();});
    window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    window.webContents.on('page-title-updated',(event,title)=>{event.preventDefault();window?.setTitle(`Capri Browser — ${String(title).slice(0,120)}`);});
    window.on('closed',()=>{window=null;});
    return window;
  }
  async function open(url,signal) {
    signal?.throwIfAborted(); const target=publicUrl(url),win=ensure();win.show();
    const abort=()=>{if(!win.isDestroyed())win.webContents.stop();};signal?.addEventListener('abort',abort,{once:true});
    let timer;
    try {
      const navigation=win.loadURL(target).catch(async error=>{
        // YouTube may replace the initial document with a theme/consent
        // navigation. Electron aborts the old load promise even when the new
        // public page succeeds. Wait for that replacement instead of retrying it.
        if(error.errno!==-3&&error.code!=='ERR_ABORTED')throw error;
        for(let i=0;i<100;i++) {
          signal?.throwIfAborted();if(win.isDestroyed())throw Error('The browser window was closed.');
          const current=win.webContents.getURL();
          if(current.startsWith('https:')&&!win.webContents.isLoadingMainFrame()){publicUrl(current);return;}
          await pause(200,signal);
        }
        throw error;
      });
      await Promise.race([navigation,new Promise((_,reject)=>{timer=setTimeout(()=>{abort();reject(Error('The page took too long to load.'));},30000);})]);
      signal?.throwIfAborted();
      const actual=publicUrl(win.webContents.getURL());
      return {opened:true,url:actual,title:win.getTitle(),redirected:new URL(actual).hostname!==new URL(target).hostname};
    } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  return {
    open,
    async play(item,signal) {
      if(!/^[\w-]{11}$/.test(item.videoId))throw Error('Invalid observed video.');
      await open(`https://www.youtube.com/watch?v=${item.videoId}&autoplay=1`,signal);
      const win=window;
      for(let attempt=0;attempt<24;attempt++) {
        signal?.throwIfAborted();if(win.isDestroyed())throw Error('The video window was closed.');
        const result=await win.webContents.executeJavaScript(`(async()=>{
          if(location.hostname!=='www.youtube.com'||new URL(location.href).searchParams.get('v')!==${JSON.stringify(item.videoId)})return {state:'wrong-page'};
          const video=document.querySelector('video');
          if(!video)return {state:'waiting'};
          try{await video.play();}catch{return {state:'needs-user-play'};}
          return {state:video.paused?'waiting':document.querySelector('.ad-showing')?'ad-playing':'playing',time:video.currentTime,ready:video.readyState};
        })()`,true);
        if(result.state==='playing' && result.ready>=2) {
          await pause(1000,signal);
          const advancing=await win.webContents.executeJavaScript(`(()=>{const v=document.querySelector('video');return !!v&&!v.paused&&v.currentTime>${Number(result.time)}&&!document.querySelector('.ad-showing');})()`);
          if(advancing)return {opened:true,playing:true,url:item.url,title:item.title,channel:item.channel};
        }
        if(['wrong-page','needs-user-play'].includes(result.state))break;
        await pause(500,signal);
      }
      return {opened:true,playing:false,url:item.url,title:item.title,channel:item.channel,note:'The requested page is open, but playback was not verified. Check the player for ads, sign-in, consent, or a Play button.'};
    },
    stop(){if(window&&!window.isDestroyed()){window.webContents.stop();window.webContents.executeJavaScript("document.querySelectorAll('video,audio').forEach(v=>v.pause())").catch(()=>{});}},
  };
}
module.exports={createAgentBrowser};
