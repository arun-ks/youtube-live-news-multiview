let apiReadyPromise;
function apiReady(){if(window.YT?.Player)return Promise.resolve();if(!apiReadyPromise){apiReadyPromise=new Promise(resolve=>{const previous=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{previous?.();resolve()}})}return apiReadyPromise}
export class PlayerManager{
  constructor(){this.players=new Map();this.activeId=null}
  async create(feedId,target,videoId,onEnded){await apiReady();this.destroy(feedId);const player=new YT.Player(target,{videoId,playerVars:{autoplay:0,mute:1,playsinline:1,rel:0,modestbranding:1},events:{onReady:e=>e.target.mute(),onStateChange:e=>{if(e.data===YT.PlayerState.ENDED)onEnded?.()}}});this.players.set(feedId,player);return player}
  async playAll(){for(const player of this.players.values()){try{player.mute();player.playVideo()}catch{}}}
  selectAudio(feedId){this.activeId=feedId;for(const[id,player]of this.players){try{if(id===feedId){player.unMute();player.playVideo()}else player.mute()}catch{}}}
  muteAll(){this.activeId=null;for(const player of this.players.values()){try{player.mute()}catch{}}}
  destroy(feedId){const old=this.players.get(feedId);if(old){try{old.destroy()}catch{}this.players.delete(feedId)}}
  destroyAll(){for(const id of [...this.players.keys()])this.destroy(id)}
}
