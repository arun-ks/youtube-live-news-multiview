let apiReady;
const players = new Map();

function loadApi() {
  if (apiReady) return apiReady;
  apiReady = new Promise((resolve) => {
    if (window.YT?.Player) return resolve();
    window.onYouTubeIframeAPIReady = resolve;
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return apiReady;
}

export async function mountPlayers(items, onSelect) {
  await loadApi();
  destroyPlayers();
  for (const item of items) {
    players.set(item.id, new YT.Player(`player-${item.id}`, {
      videoId: item.videoId,
      playerVars: { autoplay: 1, mute: 1, playsinline: 1, rel: 0 },
      events: { onReady: (event) => event.target.mute() }
    }));
    document.querySelector(`[data-select-audio="${item.id}"]`)?.addEventListener('click', () => onSelect(item.id));
  }
}

export function selectAudio(id) {
  for (const [playerId, player] of players) {
    try {
      if (playerId === id) { player.unMute(); player.playVideo(); }
      else player.mute();
    } catch {}
  }
}

export function muteAll() {
  for (const player of players.values()) { try { player.mute(); } catch {} }
}

export function destroyPlayers() {
  for (const player of players.values()) { try { player.destroy(); } catch {} }
  players.clear();
}
