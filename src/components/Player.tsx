import { storage } from '@/firebase';
import { useAuth } from '@/auth/AuthContext';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import Spectrum from './Spectrum';
import type { Track } from '../data/tracks';
import { fmt } from '../utils/time';
import { listenUserPlaylist, saveUserPlaylist } from '@/api/playlist';

/* ---------- Small utils & Icons ---------- */
const cx = (...a: Array<string | false | null | undefined>) =>
  a.filter(Boolean).join(' ');

const PlayIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...p}>
    <path d="M8 5v14l11-7-11-7z" fill="currentColor" />
  </svg>
);
const PauseIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...p}>
    <path d="M6 5h5v14H6zM13 5h5v14h-5z" fill="currentColor" />
  </svg>
);
const PrevIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...p}>
    <path d="M6 5h2v14H6zM20 19V5l-11 7 11 7z" fill="currentColor" />
  </svg>
);
const NextIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...p}>
    <path d="M16 5h2v14h-2zM4 19l11-7L4 5v14z" fill="currentColor" />
  </svg>
);
const VolumeIcon = ({ volume }: { volume: number }) => {
  if (volume <= 0.001) {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M5 10v4h4l5 4V6l-5 4H5z" fill="currentColor" />
        <path
          d="M19 9l-1.4 1.4L17 9.8 18.6 8.2 17 6.6 18.4 5.2 20 6.8 21.6 5.2 23 6.6 21.4 8.2 23 9.8 21.6 11.2 20 9.6 18.4 11.2z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (volume < 0.5) {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M5 10v4h4l5 4V6l-5 4H5z" fill="currentColor" />
        <path d="M17 12a3 3 0 0 0-2-2.83v5.66A3 3 0 0 0 17 12z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path d="M5 10v4h4l5 4V6l-5 4H5z" fill="currentColor" />
      <path d="M17 12a3 3 0 0 0-2-2.83v5.66A3 3 0 0 0 17 12z" fill="currentColor" />
      <path d="M19.5 12a5.5 5.5 0 0 0-3.5-5.17v10.34A5.5 5.5 0 0 0 19.5 12z" fill="currentColor" />
    </svg>
  );
};
const ShuffleIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...p}>
    <path
      d="M17 3h4v4h-2V6h-2a4 4 0 0 0-3.2 1.6L9.6 14A6 6 0 0 1 5 16H3v-2h2a4 4 0 0 0 3.2-1.6l4.2-6A6 6 0 0 1 17 3zM15.8 14.4 14.4 16A6 6 0 0 0 17 17h2v-1h2v4h-4v-2h-2a4 4 0 0 1-3.2-1.6l1.4-1.4a2 2 0 0 0 1.8 1zM7 7H3V5h4v2z"
      fill="currentColor"
    />
  </svg>
);
const RepeatIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...p}>
    <path d="M7 7h9V5l4 3.5L16 12v-2H7a3 3 0 0 0-3 3v1H2v-1a5 5 0 0 1 5-5zm10 10H8v2l-4-3.5L8 12v2h9a3 3 0 0 1 3 3v1h2v-1a5 5 0 0 0-5-5z" fill="currentColor" />
  </svg>
);

/* ---------- Persistence ---------- */
type PersistState = {
  index: number;
  volume: number;
  userTracks: Track[];
};
const STORAGE_KEY = 'music-player-state';

function loadState(): PersistState | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}
function saveState(state: PersistState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

type RepeatMode = 'off' | 'one' | 'all';

export default function Player({ tracks }: { tracks: Track[] }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { user } = useAuth();  // ← 추가
  const [uploading, setUploading] = useState(false); // 🔽 업로드 상태
  const [uploadError, setUploadError] = useState<string | null>(null);

  const baseLenRef = useRef<number>(tracks.length);
  const [list, setList] = useState<Track[]>(tracks);
  const [currentIndex, setCurrentIndex] = useState(0);
  const remoteUpdateRef = useRef(false);  // Firestore에서 온 변경인지 표시

  // 게스트(비로그인) 상태에서 추가한 트랙들을 따로 기억해 두는 용도
  const guestTracksRef = useRef<Track[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');

  // volume popover
  const [volOpen, setVolOpen] = useState(false);
  const volTimerRef = useRef<number | null>(null);
  const openVol = () => {
    if (volTimerRef.current) {
      window.clearTimeout(volTimerRef.current);
      volTimerRef.current = null;
    }
    setVolOpen(true);
  };
  const closeVolDelayed = () => {
    if (volTimerRef.current) window.clearTimeout(volTimerRef.current);
    volTimerRef.current = window.setTimeout(() => setVolOpen(false), 180);
  };

  // Drag state (HTML5 DnD)
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const isDragging = dragFrom !== null;

  // 드래그 미리보기 정밀 위치 + 클릭 억제
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const ghostRef = useRef<HTMLElement | null>(null);
  const wasDraggingRef = useRef(false);

  const track = list[currentIndex];
  const isEmpty = list.length === 0;

  /* ---------- Audio events ---------- */
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onLoaded = () => setDuration(el.duration || 0);
    const onTime = () => setCurrent(el.currentTime || 0);
    const onEnded = () => {
      if (repeat === 'one') {
        el.currentTime = 0;
        el.play().catch(() => setIsPlaying(false));
        return;
      }
      next(true);
    };

    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);

    return () => {
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
    };
  }, [track?.src, repeat]);

  // keep play state when index changes
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    setCurrent(0);
    if (isPlaying) el.play().catch(() => setIsPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // ensure element volume follows state (src remount resets to 1.0)
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
  }, [track?.src, volume]);

  /* ---------- Initial restore ---------- */
  useEffect(() => {
    const s = loadState();
    if (!s) return;

    const added = s.userTracks?.length ?? 0;
    if (added) setList((prev) => [...prev, ...s.userTracks!]);

    const maxIndex = Math.max(0, baseLenRef.current + added - 1);
    const safeIndex = Math.min(Math.max(0, s.index ?? 0), maxIndex);
    setCurrentIndex(safeIndex);

    const vol = s.volume ?? 1;
    setVolume(vol);
    if (audioRef.current) audioRef.current.volume = vol;
  }, []);

    
  // 로그인한 사용자의 Firestore 플레이리스트 실시간 동기화
useEffect(() => {
  if (!user) return;

  const uid = user.uid;
  let handledInitial = false; // 이 유저에 대한 "첫 스냅샷"인지 표시

  const unsubscribe = listenUserPlaylist(uid, (remoteTracks) => {
    const isInitial = !handledInitial;
    handledInitial = true;

    // remoteTracks === null 이면 이 유저에 대한 문서가 아직 없는 상태
    const serverTracks = remoteTracks ?? [];

    // 1) 로그인 직후 첫 스냅샷 + 게스트에서 추가한 곡이 있는 경우
    if (isInitial && guestTracksRef.current.length > 0) {
      const guestTracks = [...guestTracksRef.current];
      // 한 번 처리 후에는 다시 쓰지 않도록 비워둔다
      guestTracksRef.current = [];

      const hasRemote = serverTracks.length > 0;

      const msg = hasRemote
        ? '현재 이 브라우저에서 추가한 곡들이 있습니다.\n' +
          '이 곡들을 계정 플레이리스트에 추가할까요?\n\n' +
          '확인: 추가 / 취소: 계정 목록만 사용'
        : '현재 이 브라우저에서 추가한 곡들이 있습니다.\n' +
          '이 곡들을 이 계정의 첫 플레이리스트로 저장할까요?';

      const useLocal = window.confirm(msg);

      (async () => {
        try {
          let finalTracks: Track[] = serverTracks;

          if (useLocal) {
            const imported: Track[] = [];

            for (const t of guestTracks) {
              // 이론상 게스트 트랙은 거의 blob: URL 이지만
              // 혹시 http(s)/gs:// 같은 경우는 그대로 사용
              const isRemoteUrl =
                t.src.startsWith('http://') ||
                t.src.startsWith('https://') ||
                t.src.startsWith('gs://');

              if (isRemoteUrl) {
                imported.push(t);
                continue;
              }

              try {
                // blob URL에서 실제 파일 blob 가져와서 Storage에 업로드
                const res = await fetch(t.src);
                const blob = await res.blob();

                const safeTitle =
                  (t.title ?? 'track').replace(/[^a-zA-Z0-9가-힣_.-]/g, '_') || 'track';
                const fileName = `${Date.now()}-${Math.random()
                  .toString(36)
                  .slice(2, 8)}-${safeTitle}.mp3`;

                const fileRef = ref(storage, `tracks/${uid}/${fileName}`);
                await uploadBytes(fileRef, blob);
                const url = await getDownloadURL(fileRef);

                imported.push({ ...t, src: url });
              } catch (err) {
                console.error('게스트 트랙 업로드 실패:', err);
              }
            }

            // 원래 서버에 있던 곡이 있으면 뒤에 이어붙이고,
            // 없으면 imported 만 사용
            finalTracks = hasRemote ? [...serverTracks, ...imported] : imported;
          } else {
            // "아니오"를 선택한 경우 → 서버 목록만 사용
            finalTracks = serverTracks;
          }

          // Firestore에 최종 플레이리스트 저장
          await saveUserPlaylist(uid, finalTracks);

          // "서버에서 온 변경"이므로 다음 persist 에서 다시 저장하지 않도록 플래그 설정
          remoteUpdateRef.current = true;

          // UI에도 반영
          setList(() => {
            const base = tracks.slice(0, baseLenRef.current);
            return [...base, ...finalTracks];
          });
          setCurrentIndex(0);
        } catch (err) {
          console.error('로그인 시 게스트 트랙 병합 실패:', err);
        }
      })();

      return; // 여기서 끝. 아래 일반 스냅샷 처리는 타지 않는다.
    }

    // 2) 그 외 일반적인 스냅샷 처리 (실시간 동기화)
    if (remoteTracks === null) {
      // 서버에 아직 문서가 없고, 게스트 곡도 없는 경우 → 아무것도 안 함
      return;
    }

    // 서버에서 온 변경 → localStorage/Firestore 재저장 막기용 플래그
    remoteUpdateRef.current = true;

    setList(() => {
      const base = tracks.slice(0, baseLenRef.current);
      return [...base, ...remoteTracks];
    });

    setCurrentIndex(0);
  });

  // 컴포넌트 언마운트 / user 변경 시 구독 해제
  return () => {
    unsubscribe();
  };
}, [user, tracks]);

   // persist (localStorage + Firestore 동기화)
  useEffect(() => {
    const userTracks = list.slice(baseLenRef.current);

    // 1) 항상 localStorage에는 저장 (비로그인/오프라인 대비)
    saveState({ index: currentIndex, volume, userTracks });

    // 2) 로그인 상태라면 Firestore에도 저장
    if (!user) return;

    // 방금 onSnapshot으로부터 받은 변경이면 다시 서버로 쓰지 않는다.
    if (remoteUpdateRef.current) {
      remoteUpdateRef.current = false;
      return;
    }

    saveUserPlaylist(user.uid, userTracks).catch((e) => {
      console.error('플레이리스트 저장 실패:', e);
    });
  }, [currentIndex, volume, list, user]);


  /* ---------- Controls ---------- */
  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) el.pause();
    else el.play();
    setIsPlaying(!isPlaying);
  };

  const seek = (sec: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = sec;
    setCurrent(sec);
  };

  const changeVolume = (v: number) => {
    const el = audioRef.current;
    if (!el) return;
    const nv = Math.max(0, Math.min(1, v));
    el.volume = nv;
    setVolume(nv);
  };

  const randomOther = (i: number) => {
    if (list.length <= 1) return i;
    let j = i;
    while (j === i) j = Math.floor(Math.random() * list.length);
    return j;
  };

  const prev = () => {
    setCurrentIndex((i) => {
      const ni = shuffle ? randomOther(i) : i - 1;
      return list.length ? (ni + list.length) % list.length : 0;
    });
    setIsPlaying(true);
  };

  const next = (fromEnded = false) => {
    setCurrentIndex((i) => {
      if (!list.length) return 0;
      if (!shuffle) {
        const ni = i + 1;
        if (ni >= list.length) {
          if (fromEnded && repeat === 'all') return 0;
          if (fromEnded && repeat === 'off') {
            setIsPlaying(false);
            return i;
          }
          return 0;
        }
        return ni;
      }
      return randomOther(i);
    });
    setIsPlaying(true);
  };

  // playlist select: toggle if same, otherwise switch
  const select = (i: number) => {
    // 드래그 직후 클릭 억제
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }
    const el = audioRef.current;
    if (i < 0 || i >= list.length || !el) return;

    if (i === currentIndex) {
      if (isPlaying) {
        el.pause();
        setIsPlaying(false);
      } else {
        el.play().catch(() => setIsPlaying(false));
        setIsPlaying(true);
      }
    } else {
      setCurrentIndex(i);
      setIsPlaying(true);
    }
  };

    /* ---------- Upload ---------- */
const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  e.currentTarget.value = '';
  if (!file) return;

  setUploadError(null);
  setUploading(true);

  try {
    setUploading(true);

    let src: string;
    let artist = 'Local';

    if (user) {
      // 1) Storage 경로: tracks/{uid}/{timestamp-파일이름}
      const path = `tracks/${user.uid}/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, path);

      // 2) Firebase Storage 업로드
      const snap = await uploadBytes(fileRef, file);

      // 3) 다운로드 URL (항상 같은 값)
      src = await getDownloadURL(snap.ref);

      // 4) Firestore에 보이는 artist 값
      artist = user.displayName ?? user.email ?? 'Me';
    } else {
      // 로그인 안 한 경우에는 예전처럼 blob만 사용
      src = URL.createObjectURL(file);
    }

    const t: Track = { title: file.name, artist, src };

    // 🔹 로그인 안 한 상태에서 추가된 트랙은 따로 저장해 둔다
    if (!user) {
      guestTracksRef.current = [...guestTracksRef.current, t];
    }

    const wasEmpty = list.length === 0;
    setList((prev) => [...prev, t]);

    if (wasEmpty) {
      setCurrentIndex(0);
      setIsPlaying(true);
    }
  } catch (err) {
    console.error('업로드 중 오류:', err);
    setUploadError('업로드 중 오류가 발생했습니다. 콘솔 로그를 확인해 주세요.');
  } finally {
    setUploading(false);
  }
};

  const canDelete = (i: number) => i >= baseLenRef.current;
  const removeAt = (i: number) => {
  setList((prev) => {
    const removed = prev[i];
    const nextList = prev.slice(0, i).concat(prev.slice(i + 1));

    // 현재 곡 인덱스 보정
    setCurrentIndex((ci) => {
      if (i === ci) {
        if (nextList.length === 0) return 0;
        return Math.min(ci, nextList.length - 1);
      }
      return i < ci ? ci - 1 : ci;
    });

    // 지울 곡이 없으면 여기서 끝
    if (!removed) return nextList;

    // 1) 로컬 blob URL 정리
    if (removed.src?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(removed.src);
      } catch {}
    }

    // 2) Firebase Storage에 올라간 곡이면 Storage에서도 삭제
    if (
      user && // 로그인 상태이고
      removed.src?.startsWith('https://firebasestorage.googleapis.com/')
    ) {
      try {
        const fileRef = ref(storage, removed.src);
        deleteObject(fileRef).catch((err) => {
          console.error('Storage 파일 삭제 실패:', err);
        });
      } catch (err) {
        console.error('Storage 삭제 ref 생성 실패:', err);
      }
    }

    return nextList;
  });
};

  /* ---------- Keyboard shortcuts ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        seek(Math.max(0, current - 5));
      } else if (e.key === 'ArrowRight') {
        seek(Math.min(duration, current + 5));
      } else if (e.key === 'ArrowUp') {
        changeVolume(volume + 0.05);
      } else if (e.key === 'ArrowDown') {
        changeVolume(volume - 0.05);
      } else if (e.key.toLowerCase() === 's') {
        setShuffle((v) => !v);
      } else if (e.key.toLowerCase() === 'r') {
        setRepeat((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, duration, volume, isPlaying]);

  const repeatLabel = useMemo(
    () => (repeat === 'off' ? 'Repeat Off' : repeat === 'all' ? 'Repeat All' : 'Repeat One'),
    [repeat]
  );

  /* ---------- Reorder helpers ---------- */
  const reorder = (arr: Track[], from: number, to: number) => {
    const next = arr.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

  const applyReorder = (from: number, to: number) => {
    if (from === to) return;
    setList((prev) => reorder(prev, from, to));
    // currentIndex 재계산
    setCurrentIndex((ci) => {
      if (ci === from) return to;
      if (from < ci && to >= ci) return ci - 1;
      if (from > ci && to <= ci) return ci + 1;
      return ci;
    });
  };

  /* ---------- Native DnD handlers (drag anywhere on tile) ---------- */
  const onDragStart = (i: number, e: React.DragEvent) => {
    setDragFrom(i);
    setDragOver(i);
    wasDraggingRef.current = true;

    const li = itemRefs.current[i];
    if (!li || !e.dataTransfer) return;

    // 드래그 미리보기용 클론 생성
    const rect = li.getBoundingClientRect();
    const clone = li.cloneNode(true) as HTMLElement;
    clone.classList.add('drag-ghost');
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.position = 'absolute';
    clone.style.top = '-10000px';
    clone.style.left = '-10000px';
    clone.style.pointerEvents = 'none';
    document.body.appendChild(clone);
    ghostRef.current = clone;

    // 커서 상대 오프셋 계산
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    try {
      e.dataTransfer.setDragImage(clone, Math.round(offsetX), Math.round(offsetY));
      e.dataTransfer.effectAllowed = 'move';
    } catch {}
  };

  const onDragOverItem = (i: number, e: React.DragEvent) => {
    e.preventDefault(); // drop 허용
    if (dragOver !== i) setDragOver(i);
  };

  const onDropItem = (i: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragFrom !== null) applyReorder(dragFrom, i);
    setDragFrom(null);
    setDragOver(null);
    // 고스트 제거
    if (ghostRef.current) {
      document.body.removeChild(ghostRef.current);
      ghostRef.current = null;
    }
    // 클릭 억제 플래그는 select()에서 한 번 소비
  };

  const onDragEnd = () => {
    setDragFrom(null);
    setDragOver(null);
    if (ghostRef.current) {
      document.body.removeChild(ghostRef.current);
      ghostRef.current = null;
    }
    // 클릭 억제 플래그는 select()에서 처리
  };

    const uploadControls = (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <label
          className={cx(
            'inline-flex items-center justify-center cursor-pointer px-3 py-2 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-750 transition text-sm',
            uploading && 'opacity-60 cursor-not-allowed'
          )}
        >
          <input
            type="file"
            accept="audio/*"
            onChange={onFile}
            className="hidden"
            disabled={uploading}
          />
          {uploading ? '업로드 중...' : 'Add local track'}
        </label>

        <span className="text-xs text-neutral-500">
          {user
            ? '이 계정의 플레이리스트가 Firestore에 저장됩니다.'
            : '(*로그인하지 않으면 이 브라우저에만 저장됩니다)'}
        </span>
      </div>

      {uploadError && (
        <p className="text-xs text-red-400">
          {uploadError}
        </p>
      )}
    </div>
  );


  /* ---------- UI ---------- */
  return (
    <div className="space-y-5">
      {isEmpty ? (
        <div className="space-y-4">
          <p className="text-neutral-300">아직 추가된 트랙이 없어요.</p>
          {uploadControls}
        </div>
      ) : (

        <>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="m-0 text-xl md:text-2xl font-semibold">{track?.title ?? 'No track'}</h2>
              <p className="mt-1 text-sm text-neutral-400">{track?.artist ?? ''}</p>
            </div>
          </div>

          {/* Audio first, then Spectrum */}
          {/* // --- 수정 후 --- */}
          <audio
            key={track?.src || 'empty'}
            ref={audioRef}
            src={track?.src}
            preload="metadata"
            crossOrigin="anonymous"
            onError={(e) => {
              const el = e.currentTarget;
              console.error('Audio error:', el.error, 'src=', el.src);
            }}
          />
          {track?.src ? <Spectrum audioRef={audioRef} src={track.src} /> : null}
{/* 디버그용: 브라우저 기본 컨트롤로 같은 src 재생해보기 */}
{/* {track?.src && (
  <audio controls src={track.src} style={{ width: '100%', marginTop: 8 }} />
)} */}



          {/* Seek bar */}
          <div className="space-y-2">
            <input
              className="w-full accent-violet-500"
              type="range"
              min={0}
              max={duration || 0}
              step="0.1"
              value={current}
              onChange={(e) => seek(Number(e.target.value))}
            />
            <div className="flex justify-between text-xs text-neutral-400">
              <span>{fmt(current)}</span>
              <span>{fmt(duration)}</span>
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-3">
            <button
              onClick={prev}
              className="p-2 rounded-full bg-neutral-800 border border-neutral-700 hover:bg-neutral-750 transition"
              aria-label="Previous"
            >
              <PrevIcon />
            </button>

            <button
              onClick={togglePlay}
              className="p-3 rounded-full bg-violet-600 hover:bg-violet-500 text-white shadow-sm transition"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>

            <button
              onClick={() => next(false)}
              className="p-2 rounded-full bg-neutral-800 border border-neutral-700 hover:bg-neutral-750 transition"
              aria-label="Next"
            >
              <NextIcon />
            </button>

            {/* Right side icons */}
            <div className="ml-auto flex items-center gap-2">
              {/* Volume (popover left, horizontal slider) */}
              <div className="relative" onMouseEnter={openVol} onMouseLeave={closeVolDelayed}>
                <button
                  onClick={() => setVolOpen((v) => !v)}
                  className="p-2 rounded-full border bg-neutral-800 transition border-neutral-700 hover:bg-neutral-750"
                  aria-label="Volume"
                  aria-expanded={volOpen}
                >
                  <VolumeIcon volume={volume} />
                </button>

                {volOpen && (
                  <div
                    className="absolute top-1/2 right-12 -translate-y-1/2 z-20"
                    onMouseEnter={openVol}
                    onMouseLeave={closeVolDelayed}
                  >
                    <div className="rounded-lg border border-neutral-700 bg-neutral-900/90 px-2.5 py-1.5 shadow-xl">
                      <input
                        className="hslider"
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={volume}
                        style={{ ['--p' as any]: `${Math.round(volume * 100)}%` }}
                        onChange={(e) => changeVolume(Number(e.target.value))}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Shuffle */}
              <button
                onClick={() => setShuffle((v) => !v)}
                className={cx(
                  'p-2 rounded-full border transition',
                  shuffle
                    ? 'bg-neutral-800 border-violet-600 text-violet-300'
                    : 'bg-neutral-800 border-neutral-700 hover:bg-neutral-750'
                )}
                aria-pressed={shuffle}
                aria-label="Shuffle"
              >
                <ShuffleIcon />
              </button>

              {/* Repeat (with one-badge) */}
              <button
                onClick={() => setRepeat((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'))}
                className={cx(
                  'relative p-2 rounded-full border transition',
                  repeat !== 'off'
                    ? 'bg-neutral-800 border-violet-600 text-violet-300'
                    : 'bg-neutral-800 border-neutral-700 hover:bg-neutral-750'
                )}
                aria-label={repeatLabel}
                title={repeatLabel}
              >
                <RepeatIcon />
                {repeat === 'one' && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-600 text-[10px] leading-4 text-white grid place-items-center shadow">
                    1
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Upload */}
          {uploadControls}

          {/* Playlist (drag anywhere on tile) */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-300 mb-2">Playlist</h3>
            <ul className="space-y-2">
              {list.map((t, i) => {
                const active = i === currentIndex;
                const draggingThis = isDragging && i === dragFrom;
                const isOver = isDragging && i === dragOver;

                return (
                  <li
                    key={`${t.title}-${i}`}
                    ref={(el) => {itemRefs.current[i] = el}}
                    className={cx(
                      'flex items-center gap-2 rounded-xl border transition select-none',
                      active
                        ? 'bg-neutral-800/80 border-neutral-700'
                        : 'bg-neutral-900/30 border-neutral-800 hover:bg-neutral-800/40 hover:border-neutral-700',
                      draggingThis ? 'opacity-50' : '',
                      isOver ? 'ring-2 ring-violet-500/50' : ''
                    )}
                    draggable
                    onDragStart={(e) => onDragStart(i, e)}
                    onDragOver={(e) => onDragOverItem(i, e)}
                    onDrop={(e) => onDropItem(i, e)}
                    onDragEnd={onDragEnd}
                  >
                    {/* 시각적 핸들(이제 클릭은 필요 없지만 힌트로 유지) */}
                    <div className="px-2 cursor-grab text-neutral-500" title="Drag to reorder">⋮⋮</div>

                    {/* 본문 클릭으로 재생/일시정지 (드래그 직후 클릭 억제) */}
                    <button
                      onClick={() => select(i)}
                      className="flex-1 text-left px-2 py-2 rounded-lg transition"
                    >
                      <div className="font-medium truncate">{t.title}</div>
                      <div className="text-xs text-neutral-400 truncate">{t.artist}</div>
                    </button>

                    {/* 삭제(업로드 항목만) */}
                    {canDelete(i) && (
                      <button
                        onClick={() => removeAt(i)}
                        className="px-2.5 py-2 rounded-lg bg-neutral-800 border border-neutral-700 hover:bg-neutral-750 text-xs transition"
                        title="Remove uploaded track"
                      >
                        삭제
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
