const KEY = 'music-player-state';

export type PersistState = {
  index: number;
  volume: number;
  userTracks: { title: string; artist: string; src: string }[];
};

export function loadState(): PersistState | null {
  try {
    const s = localStorage.getItem(KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function saveState(state: PersistState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}
