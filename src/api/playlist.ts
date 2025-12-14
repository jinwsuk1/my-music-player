// src/api/playlist.ts
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import type { Track } from '@/data/tracks';

// ─────────────────────────────────────────────
// 1) Firestore에 저장할 타입 정의
// ─────────────────────────────────────────────

// 플레이리스트 하나
export type UserPlaylist = {
  id: string;        // 플레이리스트 고유 id
  name: string;      // 예: "팝송 플리"
  tracks: Track[];   // 이 재생목록에 들어있는 곡들
  createdAt: number; // 만들어진 시각 (정렬용)
};

// Firestore 문서 구조
//   users/{uid} 문서 안에:
//   {
//     playlists: UserPlaylist[],
//     activePlaylistId: string | null,
//     playlist: Track[]    // ← 예전 단일 플레이리스트(레거시, 있을 수도 있고 없을 수도 있음)
//   }
type UserPlaylistsDoc = {
  playlists?: UserPlaylist[];
  activePlaylistId?: string | null;

  // ⬇ 예전 버전 호환용(지금 네 DB에 있는 구조)
  playlist?: Track[];
};

const COLLECTION = 'users';

// 간단한 id 생성기 (crypto.randomUUID 대신)
const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// ─────────────────────────────────────────────
// 2) 레거시 필드(playlist) → 새 구조(playlists[]) 로 정규화
// ─────────────────────────────────────────────

function normalizeDoc(docData: UserPlaylistsDoc | undefined): {
  playlists: UserPlaylist[];
  activePlaylistId: string | null;
} {
  if (!docData) return { playlists: [], activePlaylistId: null };

  // 이미 새 구조(playlists)가 있는 경우
  if (docData.playlists && docData.playlists.length > 0) {
    const active =
      docData.activePlaylistId ?? docData.playlists[0]?.id ?? null;
    return {
      playlists: docData.playlists,
      activePlaylistId: active,
    };
  }

  // 새 구조는 없고, 옛날 형식 playlist: Track[] 만 있는 경우
  if (docData.playlist && docData.playlist.length > 0) {
    const legacy: UserPlaylist = {
      id: 'default',                // 고정 id
      name: '기본 플레이리스트',    // 보여줄 이름
      tracks: docData.playlist,
      createdAt: Date.now(),
    };
    return { playlists: [legacy], activePlaylistId: legacy.id };
  }

  // 아무 것도 없는 경우
  return { playlists: [], activePlaylistId: null };
}

// ─────────────────────────────────────────────
// 3) 여러 플레이리스트용 API
// ─────────────────────────────────────────────

// 전체 플레이리스트 한 번만 읽어오기
export async function loadUserPlaylists(uid: string): Promise<{
  playlists: UserPlaylist[];
  activePlaylistId: string | null;
}> {
  const ref = doc(db, COLLECTION, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { playlists: [], activePlaylistId: null };
  }
  const data = snap.data() as UserPlaylistsDoc;
  return normalizeDoc(data);
}

// 전체 플레이리스트 + activePlaylistId 저장
export async function saveUserPlaylists(
  uid: string,
  playlists: UserPlaylist[],
  activePlaylistId: string | null,
): Promise<void> {
  const ref = doc(db, COLLECTION, uid);
  await setDoc(
    ref,
    {
      playlists,
      activePlaylistId,
      // 필요하면 여기서 옛날 playlist 필드를 제거하는 코드도 넣을 수 있음
      // (지금은 그냥 내버려둔다)
    },
    { merge: true },
  );
}

// 새 플레이리스트 객체를 만들어주는 헬퍼
export function createEmptyPlaylist(name: string): UserPlaylist {
  return {
    id: createId(),
    name,
    tracks: [],
    createdAt: Date.now(),
  };
}

// 실시간으로 전체 플레이리스트 + activePlaylistId 구독
export function listenUserPlaylists(
  uid: string,
  onChange: (payload: {
    playlists: UserPlaylist[];
    activePlaylistId: string | null;
  }) => void,
): () => void {
  const ref = doc(db, COLLECTION, uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onChange({ playlists: [], activePlaylistId: null });
        return;
      }
      const data = snap.data() as UserPlaylistsDoc;
      onChange(normalizeDoc(data));
    },
    (error) => {
      console.error('listenUserPlaylists error:', error);
    },
  );
}

// ─────────────────────────────────────────────
// 4) 기존 단일 재생목록 함수들(호환용 래퍼)
//    - 지금 Player.tsx는 이 함수들을 쓰고 있으니, 이름 유지해 줌
//    - 내부적으로는 "활성 플레이리스트 하나"만 골라서 tracks 만 넘겨주는 구조
// ─────────────────────────────────────────────

// 기존: 한 번만 읽어오는 함수
export async function loadUserPlaylist(uid: string): Promise<Track[]> {
  const { playlists, activePlaylistId } = await loadUserPlaylists(uid);
  if (playlists.length === 0) return [];

  const useId = activePlaylistId ?? playlists[0].id;
  const pl = playlists.find((p) => p.id === useId) ?? playlists[0];
  return pl.tracks;
}

// 기존: tracks 저장 함수
export async function saveUserPlaylist(
  uid: string,
  tracks: Track[],
): Promise<void> {
  // 1) 현재 전체 플레이리스트 불러오기
  const { playlists, activePlaylistId } = await loadUserPlaylists(uid);

  let list = [...playlists];
  let useId = activePlaylistId;

  // 2) 아직 아무 플레이리스트도 없는 경우 → 새 기본 재생목록 생성
  if (!list.length) {
    const pl = createEmptyPlaylist('기본 플레이리스트');
    pl.tracks = tracks;
    list = [pl];
    useId = pl.id;
  } else {
    // 3) 활성 재생목록 찾기
    const targetId = useId ?? list[0].id;
    const idx = list.findIndex((p) => p.id === targetId);

    if (idx === -1) {
      // 없으면 새로 하나 만들어서 추가
      const pl = createEmptyPlaylist('기본 플레이리스트');
      pl.tracks = tracks;
      list.push(pl);
      useId = pl.id;
    } else {
      // 있으면 그 재생목록 tracks만 교체
      list[idx] = { ...list[idx], tracks };
    }
  }

  await saveUserPlaylists(uid, list, useId ?? null);
}

// 기존: 실시간 구독 함수
export function listenUserPlaylist(
  uid: string,
  onChange: (tracks: Track[] | null) => void,
): () => void {
  return listenUserPlaylists(uid, ({ playlists, activePlaylistId }) => {
    if (!playlists.length) {
      onChange(null);
      return;
    }

    const useId = activePlaylistId ?? playlists[0].id;
    const pl = playlists.find((p) => p.id === useId) ?? playlists[0];
    onChange(pl.tracks);
  });
}
