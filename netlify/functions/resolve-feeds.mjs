const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const memoryCache = globalThis.__LIVE_FEED_CACHE__ || (globalThis.__LIVE_FEED_CACHE__ = new Map());
const CHANNEL_TTL = 24 * 60 * 60 * 1000;
const LIVE_TTL = 5 * 60 * 1000;
const MAX_SOURCES = 12;

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const apiKey = Netlify.env.get("YOUTUBE_API_KEY");
  if (!apiKey) return json(500, { error: "YOUTUBE_API_KEY is not configured on Netlify." });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: "Invalid JSON body" }); }
  const sources = Array.isArray(body.sources) ? body.sources.slice(0, MAX_SOURCES) : [];
  if (!sources.length) return json(400, { error: "Provide 1-12 YouTube sources." });
  const force = Boolean(body.force);
  const results = [];
  for (const source of sources) {
    try { results.push(await resolveSource(source, apiKey, force)); }
    catch (error) { results.push({ id: source.id, url: source.url, error: cleanError(error), liveStatus: "error" }); }
  }
  return json(200, { results, cacheSeconds: LIVE_TTL / 1000 }, { "Cache-Control": "private, max-age=60" });
};

async function resolveSource(source, apiKey, force) {
  const parsed = parseYouTubeUrl(source.url);
  if (parsed.videoId) return resolveVideo(source, parsed.videoId, apiKey, force);
  const channel = await resolveChannel(parsed, apiKey, force);
  const cacheKey = `live:${channel.channelId}`;
  const cached = getCache(cacheKey, force);
  if (cached) return { id: source.id, url: source.url, ...cached };

  // Low-quota strategy: inspect recent uploads (1 unit) and batch-query videos (1 unit)
  // instead of search.list, which is much more quota-expensive.
  const uploads = await youtube("playlistItems", {
    part: "contentDetails", playlistId: channel.uploadsPlaylistId, maxResults: "15"
  }, apiKey);
  const ids = (uploads.items || []).map(i => i.contentDetails?.videoId).filter(Boolean);
  let candidates = [];
  if (ids.length) {
    const details = await youtube("videos", {
      part: "snippet,liveStreamingDetails,status", id: ids.join(",")
    }, apiKey);
    candidates = (details.items || []).filter(v => v.snippet?.liveBroadcastContent === "live" || v.snippet?.liveBroadcastContent === "upcoming");
  }
  candidates.sort((a,b) => rankVideo(b) - rankVideo(a));
  const best = candidates[0];
  const result = best ? normalizeVideo(best, channel) : {
    channelId: channel.channelId, channelTitle: channel.channelTitle,
    channelThumbnail: channel.channelThumbnail, liveStatus: "none", title: null,
    videoId: null, videoUrl: channel.canonicalUrl, checkedAt: new Date().toISOString()
  };
  setCache(cacheKey, result, LIVE_TTL);
  return { id: source.id, url: source.url, ...result };
}

async function resolveVideo(source, videoId, apiKey, force) {
  const key = `video:${videoId}`; const cached = getCache(key, force);
  if (cached) return { id: source.id, url: source.url, ...cached };
  const data = await youtube("videos", { part: "snippet,liveStreamingDetails,status", id: videoId }, apiKey);
  const video = data.items?.[0];
  if (!video) throw new Error("Video not found or unavailable.");
  const result = normalizeVideo(video, { channelId: video.snippet.channelId, channelTitle: video.snippet.channelTitle });
  setCache(key, result, LIVE_TTL);
  return { id: source.id, url: source.url, ...result };
}

async function resolveChannel(parsed, apiKey, force) {
  const identity = parsed.channelId || parsed.handle;
  const key = `channel:${identity}`; const cached = getCache(key, force);
  if (cached) return cached;
  const params = { part: "snippet,contentDetails", maxResults: "1" };
  if (parsed.channelId) params.id = parsed.channelId; else params.forHandle = parsed.handle;
  const data = await youtube("channels", params, apiKey);
  const item = data.items?.[0];
  if (!item) throw new Error("YouTube channel could not be resolved. Use an @handle or /channel/ URL.");
  const result = {
    channelId: item.id,
    channelTitle: item.snippet.title,
    channelThumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
    canonicalUrl: `https://www.youtube.com/channel/${item.id}`
  };
  setCache(key, result, CHANNEL_TTL); return result;
}

function parseYouTubeUrl(value) {
  let url; try { url = new URL(value); } catch { throw new Error("Invalid URL."); }
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return { videoId: validVideoId(url.pathname.slice(1)) };
  if (!["youtube.com", "m.youtube.com"].includes(host)) throw new Error("Only YouTube URLs are supported.");
  const watchId = url.searchParams.get("v"); if (watchId) return { videoId: validVideoId(watchId) };
  const parts = url.pathname.split("/").filter(Boolean);
  if (["live", "shorts", "embed"].includes(parts[0]) && parts[1]) return { videoId: validVideoId(parts[1]) };
  if (parts[0] === "channel" && parts[1]) return { channelId: parts[1] };
  if (parts[0]?.startsWith("@")) return { handle: parts[0].slice(1) };
  throw new Error("Unsupported YouTube URL. Use @handle, /channel/, /watch, /live, or youtu.be format.");
}
function validVideoId(value){if(!/^[A-Za-z0-9_-]{6,20}$/.test(value))throw new Error("Invalid YouTube video ID.");return value}
function rankVideo(v){const live=v.snippet?.liveBroadcastContent==="live"?1_000_000_000:0;const viewers=Number(v.liveStreamingDetails?.concurrentViewers||0);const when=Date.parse(v.liveStreamingDetails?.actualStartTime||v.liveStreamingDetails?.scheduledStartTime||0)||0;return live+viewers+when/1e12}
function normalizeVideo(v,channel){const mode=v.snippet.liveBroadcastContent;return{channelId:v.snippet.channelId||channel.channelId,channelTitle:v.snippet.channelTitle||channel.channelTitle,channelThumbnail:channel.channelThumbnail,title:v.snippet.title,thumbnail:v.snippet.thumbnails?.high?.url||v.snippet.thumbnails?.medium?.url,videoId:v.id,videoUrl:`https://www.youtube.com/watch?v=${v.id}`,liveStatus:mode==="live"?"live":mode==="upcoming"?"upcoming":"offline",concurrentViewers:v.liveStreamingDetails?.concurrentViewers||null,actualStartTime:v.liveStreamingDetails?.actualStartTime||null,scheduledStartTime:v.liveStreamingDetails?.scheduledStartTime||null,embedAllowed:v.status?.embeddable!==false,checkedAt:new Date().toISOString()}}
async function youtube(resource,params,apiKey){const url=new URL(`${YOUTUBE_API_BASE}/${resource}`);for(const[k,v]of Object.entries({...params,key:apiKey}))url.searchParams.set(k,v);const response=await fetch(url);const data=await response.json();if(!response.ok)throw new Error(data.error?.message||`YouTube API error ${response.status}`);return data}
function getCache(key,force){if(force)return null;const item=memoryCache.get(key);if(!item||item.expires<Date.now()){memoryCache.delete(key);return null}return item.value}
function setCache(key,value,ttl){memoryCache.set(key,{value,expires:Date.now()+ttl})}
function cleanError(error){return String(error?.message||error).replace(/AIza[\w-]+/g,"[redacted]").slice(0,240)}
function json(status,body,extra={}){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"same-origin",...extra}})}
