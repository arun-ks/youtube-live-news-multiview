import { DEFAULT_COLLECTIONS, collectionFeeds } from './defaults.js';
import { loadState, saveState, exportState } from './store.js';
import { mountPlayers, selectAudio, muteAll } from './players.js';

let state = loadState();
let resolution = new Map();
let refreshTimer = null;
const $ = (id) => document.getElementById(id);

function persist(){ saveState(state); }
function escapeHtml(value=''){ return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function fmtViewers(value){ return value == null ? 'viewers unavailable' : `${new Intl.NumberFormat().format(value)} watching`; }
function setStatus(message){ $('status').textContent=message; }

function showFirstRun(){
  const box=$('first-run');
  if(state.feeds.length){ box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  box.innerHTML=`<strong>Choose starter collections</strong><p>These are copied into this browser and can be edited or removed.</p><div class="collection-buttons">${DEFAULT_COLLECTIONS.map(c=>`<button data-install="${c.id}">${escapeHtml(c.name)}</button>`).join('')}<button data-install="all">Install all</button></div>`;
  box.querySelectorAll('[data-install]').forEach(btn=>btn.onclick=()=>installCollection(btn.dataset.install));
}
function installCollection(id){
  const ids=id==='all'?DEFAULT_COLLECTIONS.map(c=>c.id):[id];
  for(const collectionId of ids){
    if(state.installedCollections.includes(collectionId)) continue;
    state.feeds.push(...collectionFeeds(collectionId).map((f,i)=>({...f,order:state.feeds.length+i})));
    state.installedCollections.push(collectionId);
  }
  persist(); renderFeeds(); showFirstRun();
}
function renderFeeds(){
  const feeds=[...state.feeds].sort((a,b)=>a.order-b.order);
  $('feed-list').innerHTML=feeds.length?feeds.map((feed,index)=>{
    const result=resolution.get(feed.id);
    return `<article class="feed-card ${feed.enabled?'':'off'}">
      <input type="checkbox" data-toggle="${feed.id}" ${feed.enabled?'checked':''} aria-label="Enable ${escapeHtml(feed.name)}">
      <div><h3>${escapeHtml(feed.name||'Unnamed feed')} ${result?`<span class="badge ${result.state}">${result.state}</span>`:''}</h3><p>${escapeHtml(feed.url)}</p>${result?`<p>${escapeHtml(result.title||result.error||'')} · ${fmtViewers(result.viewers)}</p>`:''}</div>
      <div class="feed-actions"><button data-up="${feed.id}" ${index===0?'disabled':''}>↑</button><button data-down="${feed.id}" ${index===feeds.length-1?'disabled':''}>↓</button><button data-edit="${feed.id}">Edit</button><button data-delete="${feed.id}">Delete</button></div>
    </article>`}).join(''):'<div class="empty panel">No feeds configured.</div>';
  document.querySelectorAll('[data-toggle]').forEach(el=>el.onchange=()=>{find(el.dataset.toggle).enabled=el.checked;persist();renderFeeds();});
  document.querySelectorAll('[data-delete]').forEach(el=>el.onclick=()=>{state.feeds=state.feeds.filter(f=>f.id!==el.dataset.delete);persist();renderFeeds();showFirstRun();});
  document.querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>editFeed(el.dataset.edit));
  document.querySelectorAll('[data-up]').forEach(el=>el.onclick=()=>moveFeed(el.dataset.up,-1));
  document.querySelectorAll('[data-down]').forEach(el=>el.onclick=()=>moveFeed(el.dataset.down,1));
}
function find(id){ return state.feeds.find(f=>f.id===id); }
function moveFeed(id,delta){ const sorted=[...state.feeds].sort((a,b)=>a.order-b.order);const i=sorted.findIndex(f=>f.id===id),j=i+delta;if(j<0||j>=sorted.length)return;[sorted[i],sorted[j]]=[sorted[j],sorted[i]];sorted.forEach((f,k)=>f.order=k);state.feeds=sorted;persist();renderFeeds(); }
function editFeed(id){ const feed=find(id);const name=prompt('Display name',feed.name);if(name===null)return;const url=prompt('YouTube URL',feed.url);if(url===null)return;feed.name=name.trim()||feed.name;feed.url=url.trim();resolution.delete(id);persist();renderFeeds(); }
function addFeed(){ const url=$('feed-url').value.trim();if(!url)return setStatus('Enter a YouTube URL.');if(state.feeds.length>=12)return setStatus('Maximum 12 saved feeds in this version.');state.feeds.push({id:crypto.randomUUID(),name:$('feed-name').value.trim()||'New feed',url,enabled:true,order:state.feeds.length});$('feed-name').value='';$('feed-url').value='';persist();renderFeeds(); }

async function refreshFeeds(){
  const feeds=state.feeds.filter(f=>f.enabled).slice(0,12);if(!feeds.length)return setStatus('No enabled feeds.');setStatus(`Checking ${feeds.length} feeds…`);
  try{const response=await fetch('/.netlify/functions/resolve-feeds',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({feeds:feeds.map(({id,url})=>({id,url}))})});const data=await response.json();if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);data.results.forEach(r=>resolution.set(r.id,r));setStatus(`Checked ${data.results.length} feeds at ${new Date(data.checkedAt).toLocaleTimeString()}.`);renderFeeds();renderMonitor();}
  catch(error){setStatus(`Feed check failed: ${error.message}`);}
}
function renderMonitor(){
  const items=state.feeds.filter(f=>f.enabled).sort((a,b)=>a.order-b.order).map(feed=>({feed,result:resolution.get(feed.id)})).filter(x=>x.result?.ok&&x.result.videoId&&x.result.embeddable!==false);
  $('monitor-summary').textContent=`${items.length} playable live/upcoming feeds`;
  $('monitor-grid').innerHTML=items.length?items.map(({feed})=>`<article class="viewport ${state.lastAudioFeedId===feed.id?'audio':''}" data-viewport="${feed.id}"><button class="audio-select" data-select-audio="${feed.id}" title="Use audio from ${escapeHtml(feed.name)}" aria-label="Use audio from ${escapeHtml(feed.name)}">🔊</button><div class="player" id="player-${feed.id}"></div></article>`).join(''):'<div class="empty panel">Check feeds first. Live and upcoming embeddable streams will appear here.</div>';
  if(items.length) mountPlayers(items.map(({feed,result})=>({id:feed.id,videoId:result.videoId})),id=>{state.lastAudioFeedId=id;persist();selectAudio(id);document.querySelectorAll('.viewport').forEach(v=>v.classList.toggle('audio',v.dataset.viewport===id));});
}
function switchTab(name){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));$('feeds-view').classList.toggle('hidden',name!=='feeds');$('monitor-view').classList.toggle('hidden',name!=='monitor');$('monitor-controls').classList.toggle('hidden',name!=='monitor');if(name==='monitor')renderMonitor();}
function configureRefresh(){clearInterval(refreshTimer);if(state.refreshMode==='manual')return;const ms=state.refreshMode==='normal'?2*60_000:5*60_000;refreshTimer=setInterval(()=>{if(!document.hidden)refreshFeeds();},ms);}

$('add-feed').onclick=addFeed;$('refresh-feeds').onclick=refreshFeeds;$('monitor-refresh').onclick=refreshFeeds;$('mute-all').onclick=muteAll;
$('refresh-mode').value=state.refreshMode;$('refresh-mode').onchange=e=>{state.refreshMode=e.target.value;persist();configureRefresh();};
$('export-config').onclick=()=>exportState(state);
$('import-config').onchange=async e=>{try{const imported=JSON.parse(await e.target.files[0].text());if(!Array.isArray(imported.feeds))throw new Error('Missing feeds array.');state={...state,...imported};persist();resolution.clear();renderFeeds();showFirstRun();setStatus('Configuration imported.');}catch(error){setStatus(`Import failed: ${error.message}`);}e.target.value='';};
$('reset-app').onclick=()=>{if(confirm('Delete all locally saved feeds and settings?')){localStorage.clear();location.reload();}};
document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>switchTab(btn.dataset.tab));
showFirstRun();renderFeeds();configureRefresh();
