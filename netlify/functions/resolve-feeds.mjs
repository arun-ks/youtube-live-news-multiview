const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const memoryCache = globalThis.__LIVE_FEED_CACHE__ || (globalThis.__LIVE_FEED_CACHE__ = new Map());
const CHANNEL_TTL = 24 * 60 * 60 * 1000;
const LIVE_TTL = 5 * 60 * 1000;
const MAX_SOURCES = 12;

