'use strict';
const net = require('node:net');
const { XMLParser } = require('fast-xml-parser');

function publicUrl(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.port || net.isIP(u.hostname)
    || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname) || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/i.test(u.hostname)) throw Error('Only public HTTPS pages can be opened.');
  return u.href;
}
async function readPublic(url, signal, { fetchImpl = fetch, maxBytes = 2500000 } = {}) {
  const allowed = new Set(['www.youtube.com', 'store.steampowered.com', 'news.google.com', 'www.bing.com']);
  const deadline = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(20000)]);
  let current = publicUrl(url);
  for (let redirects=0; redirects<4; redirects++) {
    if (!allowed.has(new URL(current).hostname)) throw Error('Unexpected data provider.');
    const res = await fetchImpl(current, { redirect:'manual', signal:deadline,
      headers:{ 'user-agent':'Mozilla/5.0 CapriGPT/0.4 LocalAssistant', 'accept-language':'en-US,en;q=0.8' } });
    if ([301,302,303,307,308].includes(res.status)) {
      const location = res.headers.get('location'); await res.body?.cancel();
      if (!location) throw Error('Provider returned an empty redirect.');
      current = publicUrl(new URL(location,current).href); continue;
    }
    if (!res.ok) { await res.body?.cancel(); throw Error(`Public source returned ${res.status}.`); }
    if (Number(res.headers.get('content-length')) > maxBytes) { await res.body?.cancel(); throw Error('Provider response too large.'); }
    const chunks = []; let size=0;
    for await (const chunk of res.body) {
      size += chunk.length; if (size>maxBytes) { deadline.throwIfAborted(); throw Error('Provider response too large.'); }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  throw Error('Too many provider redirects.');
}
function rssItems(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw Error('Unsupported feed declarations.');
  const data = new XMLParser({ ignoreAttributes:false, processEntities:true, parseTagValue:false }).parse(xml);
  const rows = data.rss?.channel?.item;
  return (Array.isArray(rows) ? rows : rows ? [rows] : []).slice(0,100).flatMap(row => {
    try {
      const link = typeof row.link==='string' ? row.link.replace(/^http:/,'https:') : '';
      return [{ title:String(row.title || '').replace(/<[^>]*>/g,'').slice(0,250), url:publicUrl(link),
        published: typeof row.pubDate==='string' && Number.isFinite(Date.parse(row.pubDate)) ? new Date(row.pubDate).toISOString() : null,
        source: typeof row.source==='object' ? String(row.source['#text'] || '').slice(0,100) : '' }];
    } catch { return []; }
  });
}
function initialData(html) {
  const marker = /(?:var\s+ytInitialData\s*=|window\["ytInitialData"\]\s*=)\s*/g.exec(html);
  if (!marker) throw Error('YouTube did not supply channel data. Consent or verification may be required.');
  const start = marker.index+marker[0].length;
  let depth=0, quoted=false, escaped=false;
  for (let i=start;i<html.length;i++) {
    const ch=html[i];
    if (quoted) { if(escaped) escaped=false; else if(ch==='\\') escaped=true; else if(ch==='"') quoted=false; }
    else if(ch==='"') quoted=true;
    else if(ch==='{') depth++;
    else if(ch==='}' && --depth===0) return JSON.parse(html.slice(start,i+1));
  }
  throw Error('Incomplete YouTube channel data.');
}
function latestFromChannel(html, handle) {
  const data=initialData(html), metadata=data.metadata?.channelMetadataRenderer;
  if (!metadata?.externalId || !/^UC[\w-]{22}$/.test(metadata.externalId)) throw Error('Could not verify the YouTube channel.');
  const owner = (metadata.ownerUrls || []).map(u => new URL(u).pathname.toLowerCase());
  if (!owner.includes('/@'+handle.toLowerCase())) throw Error('YouTube channel identity did not match the requested handle.');
  const tab = data.contents?.twoColumnBrowseResultsRenderer?.tabs?.find(t=>t.tabRenderer?.selected)?.tabRenderer;
  const grid=tab?.content?.richGridRenderer;
  const chips=grid?.header?.chipBarViewModel?.chips || [];
  // Only accept a verified newest-first listing, never a Popular or Oldest tab.
  const selected=chips.findIndex(c=>c.chipViewModel?.selected);
  const legacyChips=grid?.header?.feedFilterChipBarRenderer?.contents || [];
  const legacySelected=legacyChips.findIndex(c=>c.chipCloudChipRenderer?.isSelected);
  if (selected!==0 && legacySelected!==0) throw Error('Could not verify newest-first sorting on YouTube.');
  for (const row of grid?.contents || []) {
    const content=row.richItemRenderer?.content;
    const video=content?.videoRenderer;
    const lockup=content?.lockupViewModel;
    const id=video?.videoId || (lockup?.contentType==='LOCKUP_CONTENT_TYPE_VIDEO' && lockup.contentId);
    if (!id || !/^[\w-]{11}$/.test(id)) continue;
    const info=lockup?.metadata?.lockupMetadataViewModel;
    const title=info?.title?.content || video?.title?.runs?.map(r=>r.text).join('');
    if (!title) continue;
    return { title:String(title).slice(0,250), channel:String(metadata.title).slice(0,100), channelId:metadata.externalId,
      url:`https://www.youtube.com/watch?v=${id}`, videoId:id, newestFirst:true,
      publishedLabel:video?.publishedTimeText?.simpleText || info?.metadata?.contentMetadataViewModel?.metadataRows?.flatMap(r=>r.metadataParts || []).map(p=>p.text?.content).filter(Boolean).join(' · ').slice(0,150) || '' };
  }
  throw Error('No public video was found on that channel.');
}
const CHANNELS = { rubius:'elrubius', elrubius:'elrubius', 'rubius z':'elrubius', 'rubius omg':'elrubiusOMG', elrubiusomg:'elrubiusOMG' };
class WebTools {
  constructor({ read = readPublic, now = () => new Date() } = {}) { this.read=read; this.now=now; }
  async search(query, { news=false, signal } = {}) {
    if (typeof query!=='string' || !query.trim() || query.length>300) throw Error('Use a short search query.');
    const url = news ? new URL('https://news.google.com/rss/search') : new URL('https://www.bing.com/search');
    url.searchParams.set('q',query+(news ? ' when:7d' : ''));
    if (news) { url.searchParams.set('hl','en-US');url.searchParams.set('gl','US');url.searchParams.set('ceid','US:en'); }
    else url.searchParams.set('format','rss');
    let items=rssItems(await this.read(url.href,signal));
    if (news) items=items.filter(i=>i.published && Date.parse(i.published)>=this.now().getTime()-7*86400000 && Date.parse(i.published)<=this.now().getTime()+3600000).sort((a,b)=>Date.parse(b.published)-Date.parse(a.published));
    return { type:news?'news':'search', fetchedAt:this.now().toISOString(), query,
      scope:news?'Headlines from the last seven days, sorted newest first. Headlines are not independently verified article content.':'Public web search results, not independently verified claims.',
      items:items.slice(0,6), browseUrl:news ? `https://news.google.com/search?q=${encodeURIComponent(query+' when:7d')}&hl=en-US&gl=US&ceid=US%3Aen` : `https://www.bing.com/search?q=${encodeURIComponent(query)}` };
  }
  async steam(signal) {
    const data=JSON.parse(await this.read('https://store.steampowered.com/api/featuredcategories/?cc=gt&l=english',signal));
    const items=(data.specials?.items || []).filter(i=>Number.isSafeInteger(i.id) && i.id>0 && i.discounted && Number.isFinite(i.discount_percent) && i.discount_percent>0 && i.discount_percent<=100 && Number.isSafeInteger(i.final_price) && i.final_price>=0)
      .sort((a,b)=>b.discount_percent-a.discount_percent).slice(0,6).map(i=>({ title:String(i.name).slice(0,200), url:`https://store.steampowered.com/app/${i.id}/`,
        discount:i.discount_percent, price:i.final_price/100, originalPrice:Number.isFinite(i.original_price)?i.original_price/100:null,
        currency:String(i.currency).slice(0,5), expires:Number.isFinite(i.discount_expiration)?new Date(i.discount_expiration*1000).toISOString():null }));
    if (!items.length) throw Error('Steam returned no featured discounts.');
    return { type:'steam',fetchedAt:this.now().toISOString(),region:'GT',scope:'Highest percentage discounts among Steam’s current featured specials, not every game on Steam. Prices depend on store region.',items,browseUrl:'https://store.steampowered.com/search/?specials=1' };
  }
  async youtube(creator,signal) {
    const raw=String(creator).trim(), key=raw.toLowerCase().replace(/^@/,'');
    const handle=CHANNELS[key] || (raw.startsWith('@') && /^[\w.-]{3,50}$/.test(key) ? key : null);
    if (!handle) throw Error('Tell me the creator’s YouTube @handle so I can verify the correct channel. Rubius and Rubius OMG are already known.');
    const url=`https://www.youtube.com/@${encodeURIComponent(handle)}/videos`;
    const latest=latestFromChannel(await this.read(url,signal),handle);
    return { type:'youtube',fetchedAt:this.now().toISOString(),scope:'First public video on the verified channel’s newest-first Videos tab; Shorts and live tabs are separate.',items:[latest],browseUrl:url };
  }
}
module.exports={WebTools,publicUrl,readPublic,rssItems,initialData,latestFromChannel};
