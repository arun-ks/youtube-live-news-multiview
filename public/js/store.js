const KEY = 'yt-news-multiview-v1';

export function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY));
    if (parsed && Array.isArray(parsed.feeds)) return parsed;
  } catch {}
  return { feeds: [], installedCollections: [], refreshMode: 'economy', columns: 'auto', lastAudioFeedId: null };
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `youtube-live-news-multiview-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
