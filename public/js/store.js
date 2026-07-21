const KEY = "live-news-multiview-v1";
const DEFAULT_STATE = { feeds: [], installedCollections: [], settings: { columns: "auto", refreshMode: "economy", activeAudioFeedId: null } };
export function loadState(){try{return {...structuredClone(DEFAULT_STATE),...JSON.parse(localStorage.getItem(KEY)||"{}")};}catch{return structuredClone(DEFAULT_STATE)}}
export function saveState(state){localStorage.setItem(KEY,JSON.stringify(state))}
export function makeFeed({name,url,enabled=true,collectionId=null}){return{id:crypto.randomUUID(),name:name||url,url,enabled,collectionId,createdAt:new Date().toISOString(),resolved:null}}
export function normalizeUrl(value){const raw=value.trim();const url=new URL(raw.startsWith("http")?raw:`https://${raw}`);if(!["youtube.com","www.youtube.com","m.youtube.com","youtu.be"].includes(url.hostname))throw new Error("Only YouTube URLs are supported.");return url.toString()}
