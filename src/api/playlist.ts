// src/api/playlist.ts
import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/firebase';
import type { Track } from '@/data/tracks';

/**
 * Firestore 경로:
 *   users/{uid}
 * 문서 구조 예:
 *   {
 *     playlist: Track[];
 *   }
 */

export async function loadUserPlaylist(uid: string): Promise<Track[]> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return [];
  }
  const data = snap.data() as { playlist?: Track[] };
  return data.playlist ?? [];
}

export async function saveUserPlaylist(uid: string, tracks: Track[]): Promise<void> {
  const ref = doc(db, 'users', uid);
  await setDoc(
    ref,
    { playlist: tracks },
    { merge: true } // 다른 필드가 있어도 덮어쓰지 않도록
  );
}
