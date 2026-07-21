const API = 'https://www.googleapis.com/youtube/v3';
const MAX_FEEDS = 12;
const CACHE_TTL_MS = 2 * 60 * 1000;
const memoryCache = new Map();

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type'
    },
    body: JSON.stringify(body)
  };
}

function parseSource(raw) {
  const value = String(raw || '').trim();
  if (!value) throw new Error('Feed URL is empty.');

  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return { type: 'video', videoId: value };
  if (/^UC[A-Za-z0-9_-]{22}$/.test(value)) return { type: 'channel', channelId: value };
  if (/^@[A-Za-z0-9._-]+$/.test(value)) return { type: 'handle', handle: value.slice(1) };

  let url;
  try { url = new URL(value); } catch { throw new Error('Use a YouTube video, channel, or @handle URL.'); }
  const host = url.hostname.replace(/^www\./, '');
  if (!['youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) throw new Error('Only YouTube URLs are supported.');

  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    if (id) return { type: 'video', videoId: id };
  }
  const watchId = url.searchParams.get('v');
  if (watchId) return { type: 'video', videoId: watchId };

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'live' && parts[1]) return { type: 'video', videoId: parts[1] };
  if (parts[0] === 'shorts' && parts[1]) return { type: 'video', videoId: parts[1] };
  if (parts[0] === 'channel' && parts[1]) return { type: 'channel', channelId: parts[1] };
  if (parts[0]?.startsWith('@')) return { type: 'handle', handle: parts[0].slice(1) };
  if (parts[0] === 'user' && parts[1]) return { type: 'username', username: parts[1] };

  throw new Error('Unsupported YouTube URL. Prefer a /@handle, /channel/ID, or video URL.');
}

async function yt(path, params, key) {
  const url = new URL(`${API}/${path}`);
  for (const [name, value] of Object.entries({ ...params, key })) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
  }
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || `YouTube API returned ${response.status}`;
    throw new Error(message);
  }
  return data;
}

async function resolveChannel(parsed, key) {
  const params = { part: 'snippet,contentDetails', maxResults: 1 };
  if (parsed.channelId) params.id = parsed.channelId;
  else if (parsed.handle) params.forHandle = parsed.handle;
  else if (parsed.username) params.forUsername = parsed.username;
  const data = await yt('channels', params, key);
  const channel = data.items?.[0];
  if (!channel) throw new Error('YouTube channel was not found.');
  return {
    id: channel.id,
    title: channel.snippet?.title || 'Unknown channel',
    thumbnail: channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url || '',
    uploads: channel.contentDetails?.relatedPlaylists?.uploads
  };
}

function normalizeVideo(video) {
  const live = video.snippet?.liveBroadcastContent || 'none';
  const details = video.liveStreamingDetails || {};
  const embeddable = video.status?.embeddable !== false;
  let state = 'offline';
  if (live === 'live' || details.actualStartTime && !details.actualEndTime) state = 'live';
  else if (live === 'upcoming' || details.scheduledStartTime && !details.actualStartTime) state = 'upcoming';
  else if (details.actualEndTime) state = 'ended';

  return {
    videoId: video.id,
    title: video.snippet?.title || 'Untitled video',
    channelId: video.snippet?.channelId || '',
    channelTitle: video.snippet?.channelTitle || '',
    thumbnail: video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || '',
    state,
    embeddable,
    viewers: details.concurrentViewers ? Number(details.concurrentViewers) : null,
    scheduledStartTime: details.scheduledStartTime || null,
    actualStartTime: details.actualStartTime || null,
    actualEndTime: details.actualEndTime || null,
    publishedAt: video.snippet?.publishedAt || null
  };
}

async function getVideos(ids, key) {
  if (!ids.length) return [];
  const data = await yt('videos', {
    part: 'snippet,status,liveStreamingDetails,statistics',
    id: ids.slice(0, 50).join(','),
    maxResults: 50
  }, key);
  return (data.items || []).map(normalizeVideo);
}

async function resolveOne(source, key) {
  const parsed = parseSource(source.url);
  if (parsed.type === 'video') {
    const videos = await getVideos([parsed.videoId], key);
    if (!videos[0]) throw new Error('YouTube video was not found.');
    return { ...videos[0], sourceType: 'video', candidates: videos };
  }

  const channel = await resolveChannel(parsed, key);
  if (!channel.uploads) throw new Error('The channel uploads playlist is unavailable.');
  const playlist = await yt('playlistItems', {
    part: 'contentDetails',
    playlistId: channel.uploads,
    maxResults: 50
  }, key);
  const ids = (playlist.items || []).map((item) => item.contentDetails?.videoId).filter(Boolean);
  const videos = await getVideos(ids, key);
  const candidates = videos
    .filter((video) => video.state === 'live' || video.state === 'upcoming')
    .sort((a, b) => {
      if (a.state !== b.state) return a.state === 'live' ? -1 : 1;
      return (b.viewers || 0) - (a.viewers || 0);
    });
  const selected = candidates[0] || null;
  return {
    sourceType: parsed.type,
    channelId: channel.id,
    channelTitle: channel.title,
    channelThumbnail: channel.thumbnail,
    state: selected?.state || 'offline',
    videoId: selected?.videoId || null,
    title: selected?.title || 'No current live stream found among the 50 most recent uploads',
    thumbnail: selected?.thumbnail || channel.thumbnail,
    viewers: selected?.viewers ?? null,
    scheduledStartTime: selected?.scheduledStartTime || null,
    actualStartTime: selected?.actualStartTime || null,
    embeddable: selected?.embeddable ?? null,
    candidates
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST.' });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return json(500, { error: 'YOUTUBE_API_KEY is not configured on the server.' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON request.' }); }
  const feeds = Array.isArray(payload.feeds) ? payload.feeds.slice(0, MAX_FEEDS) : [];
  if (!feeds.length) return json(400, { error: 'Provide at least one feed.' });

  const results = await Promise.all(feeds.map(async (feed) => {
    const cacheKey = String(feed.url || '').trim();
    const cached = memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return { id: feed.id, ok: true, cached: true, ...cached.value };
    try {
      const value = await resolveOne(feed, key);
      memoryCache.set(cacheKey, { at: Date.now(), value });
      return { id: feed.id, ok: true, cached: false, ...value };
    } catch (error) {
      return { id: feed.id, ok: false, state: 'error', error: error.message };
    }
  }));

  return json(200, { checkedAt: new Date().toISOString(), results });
}

export { parseSource, normalizeVideo };
