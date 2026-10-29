const host = window.settingsHost;
const content = document.querySelector('#content');
let state, page = 'home', busy = false;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const button = (label, action, cls = '') => `<button class="button ${cls}" data-action="${action}">${label}</button>`;
const row = (title, detail, control = '') => `<div class="row"><div class="row__copy"><strong>${title}</strong><p>${detail}</p></div>${control}</div>`;
const toggle = (key, enabled, label) => `<label class="switch"><input type="checkbox" data-key="${key}" ${enabled ? 'checked' : ''} aria-label="${label}"><span></span></label>`;
const card = (...rows) => `<div class="card">${rows.join('')}</div>`;
const heading = (tag, title, intro) => `<p class="eyebrow">${tag}</p><h1>${title}</h1><p class="intro">${intro}</p>`;
const section = title => `<h2 class="section-label">${title}</h2>`;
const options = (key, selected, values, label) => `<select data-key="${key}" aria-label="${label}">${values.map(([value, text]) => `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select>`;

function render() {
  content.dataset.page = page;
  const c = state.config, p = c.privacy, r = state.runtime;
  document.querySelector('#version').textContent = `CAPRI v${r.version}`;
  document.querySelectorAll('nav button[data-page]').forEach(el => { el.classList.toggle('selected', el.dataset.page === page); el.setAttribute('aria-current', el.dataset.page === page ? 'page' : 'false'); });
  const sw = (key, value, title, detail) => row(title, detail, toggle(key, value, title));
  if (page === 'home') content.innerHTML = heading('YOUR SPACE / YOUR RULES', 'A little more you.', 'Everything Capri needs to feel at home on your desktop.') +
    `<div class="hero"><div class="hero__top"><h2>Capri is ${c.gamingMode ? 'taking a break' : 'right here'}.</h2><span class="badge ${c.gamingMode ? 'paused' : ''}">${c.gamingMode ? 'PAUSED' : 'AGENT ACTIVE'}</span></div><p>Local intelligence. A familiar personality. Your PC, with a digital ghost looking out for you.</p></div>` +
    section('AT A GLANCE') + `<div class="fact-grid"><div class="fact"><span>LOCAL BRAIN</span><strong>Qwen 3.5 · 9B</strong></div><div class="fact"><span>PERSONAL MEMORY</span><strong>${p.memoryEnabled ? 'Enabled · stored locally' : 'Off · yours to enable'}</strong></div></div>` + section('QUICK CONTROLS') +
    card(row('Gaming mode', 'Pause AI and hide Capri. Resume here or from the tray.', `<label class="switch"><input type="checkbox" data-action-switch="gaming" ${c.gamingMode ? 'checked' : ''} aria-label="Gaming mode"><span></span></label>`), row('Desktop presence', 'Ctrl + Alt + C folds Capri into her biochip.', button(c.visible ? 'Put away' : 'Bring back', 'visibility'))) +
    `<p class="fine">Click Capri to talk. Right-click her or the tray icon to come back here. Desktop actions always ask for your confirmation.</p>`;
  if (page === 'appearance') content.innerHTML = heading('MAKE THE DESKTOP HERS', 'Appearance', 'Her presence, her movement, your preferred screen.') + section('PRESENCE') +
    card(row('Character size', 'Find her place in your workspace.', `<div class="segments" role="group" aria-label="Character size">${[[0.45,'Small'],[0.6,'Medium'],[0.8,'Large']].map(([value,label]) => `<button data-scale="${value}" aria-pressed="${Math.abs(c.scale-value)<.01}">${label}</button>`).join('')}</div>`), row('Display', 'Move Capri to another connected screen.', options('displayId', c.displayId ?? '', [['','Primary display'], ...state.displays.map((d,i) => [d.id, `Screen ${i+1} · ${d.width} × ${d.height}`])], 'Display'))) +
    section('A LIFE OF HER OWN') + card(sw('wander',c.wander,'Wander around','Let her find new places when you’re not chatting.'),sw('windowTracking',c.windowTracking,'Sit on windows','Follow window edges and perch above restored windows.'),sw('possess',c.possess,'Window mischief','Her playful window animation, with no app changes.'));
  if (page === 'sound') content.innerHTML = heading('A FAMILIAR FREQUENCY', 'Sound', 'Keep her little blips and glitches just how you like them.') +
    card(sw('muted',c.muted,'Mute character sounds','A quieter digital ghost.'), row('Volume', 'Character effects and chat blips.', `<div class="meter"><input type="range" data-key="volume" min="0" max="100" value="${Math.round(c.volume*100)}" aria-label="Volume"><output>${Math.round(c.volume*100)}%</output></div>`)) + section('CUSTOM CUES') +
    card(row('Your sound collection', 'Add your own sound files to replace character cues.',button('Open folder','sounds-folder'))) + `<p class="fine">Spoken conversation is still being developed. These controls adjust Capri’s existing character sounds.</p>`;
  if (page === 'memory') content.innerHTML = heading('THINGS WORTH KEEPING', 'Memory', 'A little continuity, saved on your own PC. You choose what stays.') +
    card(sw('privacy.memoryEnabled',p.memoryEnabled,'Personal memory','Keep personal facts locally when you ask Capri to remember them.'),sw('privacy.memoryConfirmChanges',p.memoryConfirmChanges,'Review requested changes','Ask before saving, editing or forgetting details. Off: do what you ask directly.'),sw('privacy.memoryCandidates',p.memoryCandidates,'Offer to remember','Let Capri suggest memories during conversation. Each save asks first.'),sw('privacy.memoryRecall',p.memoryRecall,'Recall in conversation','Use relevant saved facts in local replies.')) +
    section('KEEP / REVIEW / CLEAR') + card(row('Keep memories for', 'Retention starts from the last edit.',options('privacy.retentionDays',p.retentionDays,[[30,'30 days'],[90,'90 days'],[365,'1 year'],[0,'Until I delete them']],'Memory retention')),row('Review your memories','List, edit or forget individual facts in the local commands panel.',button('Review','memory-open'))) + `<div class="actions">${button('Export memories','memory-export')}${button('Delete all memories','memory-delete','danger')}</div>`;
  if (page === 'awareness') content.innerHTML = heading('AWARE / ON YOUR TERMS', 'PC awareness', 'Local snapshots when needed or when activity changes. No screen recording or keylogging.') +
    `<div class="hero"><div class="hero__top"><h2>Every app included.</h2><span class="badge">AUTOMATIC</span></div><p>New apps are included automatically. There’s no app list to maintain.</p></div>` +
    card(sw('privacy.contextForeground',p.contextForeground,'Active app','Know which app is in front.'),sw('privacy.contextTitles',p.contextTitles,'Window titles','Include titles, which may contain private details.'),sw('privacy.contextProcesses',p.contextProcesses,'Open apps & processes','Read app names and running background processes.'),sw('privacy.contextEvents',p.contextEvents,'Respond to activity changes','Refresh on resume, power changes and foreground changes.')) +
    section('PC CONTEXT') + card(sw('privacy.contextTime',p.contextTime,'Time & day','Use the local clock when relevant.'),sw('privacy.contextPower',p.contextPower,'Battery & power','Notice charging and battery status.'),sw('privacy.contextPerformance',p.contextPerformance,'System performance','Include memory and CPU usage when relevant.'));
  if (page === 'connections') content.innerHTML = heading('BETTER TOGETHER', 'Connections', 'Keep the useful signals close. Your local brain stays independent.') +
    `<div class="hero"><div class="hero__top"><h2>Codex companion</h2><span class="badge ${state.integration.lastSeen ? '' : 'paused'}">${state.integration.lastSeen ? 'CONNECTED' : 'WAITING'}</span></div><p>${state.integration.lastSeen ? 'Receiving local activity notifications from Codex.' : 'No real Codex activity received in this run yet.'}</p></div>` +
    card(row('Local notifications', 'Work, completion and approval alerts from Codex.'),row('Approval stays with you','Review Codex approvals in Codex. Capri’s desktop actions ask separately.')) + `<p class="fine">Regular ChatGPT conversations are not connected. Manage trusted notification hooks with /hooks in Codex.</p>`;
  if (page === 'updates') content.innerHTML = heading('KEEP HER CURRENT', 'Updates & app', 'One place for versions, restarts and how Capri starts with you.') +
    `<div class="hero"><div class="hero__top"><h2>CapriGPT ${esc(r.version)}</h2><span class="badge ${r.currentSource ? '' : 'paused'}">${r.currentSource ? 'SOURCE LOADED' : 'RESTART READY'}</span></div><p>${r.currentSource ? 'This session is running the current local source.' : 'Your local source has changed. Restart Capri to load the new version.'}</p></div>` +
    `<div class="actions">${button('Check local changes','refresh')}${button('Restart Capri','restart','primary')}</div><p class="fine">Updates are managed in this local project. Restarting loads saved changes; it does not download a new release.</p>` +
    section('YOUR ROUTINE') + card(row('Start with Windows','Launch Capri directly, without a terminal.', `<label class="switch"><input type="checkbox" data-action-switch="startup" ${state.startup ? 'checked' : ''} aria-label="Start with Windows"><span></span></label>`),row('Conversation language','Used when your message doesn’t specify a language.',options('lang',c.langSetting,[['auto','Follow Windows'],['en','English'],['es','Español'],['fr','Français'],['pt','Português'],['ru','Русский']],'Conversation language'))) +
    section('LOCAL BUILD') + `<p class="mono">${esc(r.build)}<br>${esc(r.root)}</p>`;
}
function notice(text, error = false) { document.querySelector('#notice').textContent = text; document.querySelector('.statusbar').classList.toggle('error',error); }
async function perform(task, { redraw = true } = {}) {
  if (busy) return;
  busy = true; document.body.setAttribute('aria-busy','true');
  try { const result = await task(); if (result?.state) state = result.state; else if (result?.config) state = result; if (redraw) render(); notice(result?.message || 'Saved. Looking preem.'); }
  catch (error) { notice(error.message.replace(/^Error invoking remote method .*?: Error: /,''),true); render(); }
  finally { busy = false; document.body.removeAttribute('aria-busy'); }
}
document.addEventListener('click', event => {
  const nav = event.target.closest('nav button[data-page]');
  if (nav) { page = nav.dataset.page; render(); content.scrollTop=0; return; }
  const scale = event.target.closest('[data-scale]');
  if (scale) perform(() => host.patch({scale:Number(scale.dataset.scale)}));
  const action = event.target.closest('[data-action]');
  if (action) perform(() => host.action(action.dataset.action));
});
document.addEventListener('input', event => { if (event.target.dataset.key === 'volume') event.target.nextElementSibling.textContent = `${event.target.value}%`; });
document.addEventListener('change', event => {
  const el = event.target;
  if (el.dataset.actionSwitch) { perform(() => host.action(el.dataset.actionSwitch,el.checked)); return; }
  if (!el.dataset.key) return;
  const key = el.dataset.key;
  let value = el.type === 'checkbox' ? el.checked : el.value;
  if (key === 'volume') value = Number(value)/100;
  if (key === 'displayId') value = value === '' ? null : Number(value);
  if (key === 'privacy.retentionDays') value = Number(value);
  perform(() => host.patch(key.startsWith('privacy.') ? {privacy:{[key.slice(8)]:value}} : {[key]:value}));
});
document.querySelector('#close').addEventListener('click', () => host.action('close'));
document.addEventListener('keydown', event => { if (event.key === 'Escape') host.action('close'); });
host.onUpdate(value => { state = value; if (!busy && !content.contains(document.activeElement)) render(); });
try { state = await host.state(); render(); document.documentElement.dataset.settingsReady='true'; }
catch (error) { notice(error.message,true); }
