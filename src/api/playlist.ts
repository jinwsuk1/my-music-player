// src/api/playlist.ts
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/firebase';
import type { Track } from '@/data/tracks';

// Firestore 문서 구조:
//   users/{uid}  문서 안에 { playlist: Track[] }
type UserPlaylistDoc = {
  playlist?: Track[];
};

const COLLECTION = 'users';

// 한 번만 읽어오기 (앱 시작 시 사용 가능)
export async function loadUserPlaylist(uid: string): Promise<Track[]> {
  const ref = doc(db, COLLECTION, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return [];
  }
  const data = snap.data() as UserPlaylistDoc;
  return data.playlist ?? [];
}

// 저장 (우리가 변경할 때 호출)
export async function saveUserPlaylist(uid: string, tracks: Track[]): Promise<void> {
  const ref = doc(db, COLLECTION, uid);
  await setDoc(
    ref,
    { playlist: tracks },
    { merge: true }, // 다른 필드가 있어도 그대로 두고 playlist만 갱신
  );
}

/**
 * 실시간 구독
 * - 문서가 생성/변경될 때마다 onChange가 호출됨
 * - 아직 문서가 없으면 onChange(null)을 준다.
 * - 반환값인 함수를 호출하면 구독 해제(unsubscribe).
 */
export function listenUserPlaylist(
  uid: string,
  onChange: (tracks: Track[] | null) => void,
): () => void {
  const ref = doc(db, COLLECTION, uid);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        // 아직 이 유저에 대한 문서가 없는 경우
        onChange(null);
        return;
      }
      const data = snap.data() as UserPlaylistDoc;
      onChange(data.playlist ?? []);
    },
    (error) => {
      console.error('listenUserPlaylist error:', error);
    },
  );
}
