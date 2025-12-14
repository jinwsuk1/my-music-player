// src/App.tsx
import { useEffect, useMemo, useState } from 'react';
import Player from '@/components/Player';
import { tracks as initialTracks, type Track } from './data/tracks';

import PlaylistSidebar, { type SidebarPlaylist } from '@/components/PlaylistSidebar';
import PlaylistHome from '@/components/PlaylistHome';

import { useAuth } from '@/auth/AuthContext';

import {
  createEmptyPlaylist,
  listenUserPlaylists,
  saveUserPlaylists,
  type UserPlaylist,
} from '@/api/playlist';

import { storage } from '@/firebase';
import { deleteObject, ref as storageRef } from 'firebase/storage';

type ViewMode = 'home' | 'detail';

function App() {

  const AuthControls = () => {
    if (isLoading) {
      return <span className="text-xs text-neutral-400">Loading...</span>;
    }
    if (user) {
      const label = user.displayName ?? user.email ?? 'User';
      return (
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-neutral-300 truncate max-w-[160px]">
            {label}
          </span>
          <button
            type="button"
            onClick={logout}
            className="px-3 py-1.5 rounded-full text-xs border border-neutral-700 bg-neutral-900/60 hover:bg-neutral-800 transition"
          >
            로그아웃
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={loginWithGoogle}
        className="px-3 py-1.5 rounded-full text-xs border border-neutral-700 bg-neutral-900/60 hover:bg-neutral-800 transition"
      >
        로그인
      </button>
    );
  };
  const { user, isLoading, loginWithGoogle, logout } = useAuth();
const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('home');

  // 🔥 Firestore 실시간 구독 (App이 단일 소유)
  useEffect(() => {
    if (!user) {
      setUserPlaylists([]);
      setActivePlaylistId(null);
      return;
    }

    const unsub = listenUserPlaylists(user.uid, ({ playlists, activePlaylistId }) => {
      setUserPlaylists(playlists);

      const serverActive =
        (activePlaylistId && playlists.some((p) => p.id === activePlaylistId))
          ? activePlaylistId
          : (playlists[0]?.id ?? null);

      setActivePlaylistId(serverActive);
    });

    return () => unsub();
  }, [user]);

  const activePlaylist = useMemo(() => {
    if (!activePlaylistId) return null;
    return userPlaylists.find((p) => p.id === activePlaylistId) ?? null;
  }, [userPlaylists, activePlaylistId]);

  const uiPlaylists: SidebarPlaylist[] = useMemo(
    () =>
      userPlaylists.map((p) => ({
        id: p.id,
        name: p.name,
        trackCount: p.tracks?.length ?? 0,
      })),
    [userPlaylists],
  );

  const handleCreatePlaylist = async () => {
    if (!user) {
      alert('로그인 후 재생목록을 만들 수 있어요.');
      return;
    }

    const baseName = '새 재생목록';
    const sameNameCount = userPlaylists.filter((p) => p.name.startsWith(baseName)).length;
    const suggested = sameNameCount === 0 ? baseName : `${baseName} ${sameNameCount + 1}`;

    const input = window.prompt('새 재생목록 이름을 입력하세요', suggested);
    if (input === null) return; // 취소
    const name = input.trim();
    if (!name) {
      alert('재생목록 이름은 비워둘 수 없어요.');
      return;
    }

    // (선택) 같은 이름이 있으면 중복 방지
    if (userPlaylists.some((p) => p.name === name)) {
      alert('이미 같은 이름의 재생목록이 있어요. 다른 이름을 입력해 주세요.');
      return;
    }

    const newPl = createEmptyPlaylist(name);
    const next = [...userPlaylists, newPl];

    setUserPlaylists(next);
    setActivePlaylistId(newPl.id);
    setViewMode('detail');

    try {
      await saveUserPlaylists(user.uid, next, newPl.id);
    } catch (e) {
      console.error(e);
      alert('재생목록 생성 저장에 실패했어요. 콘솔을 확인해 주세요.');
    }
  };

  const handleRenamePlaylist = async (playlistId: string) => {
    if (!user) {
      alert('로그인한 상태에서만 재생목록 이름을 수정할 수 있습니다.');
      return;
    }

    const target = userPlaylists.find((p) => p.id === playlistId);
    if (!target) return;

    const input = window.prompt('재생목록 이름을 수정하세요', target.name);
    if (input === null) return; // 취소

    const nextName = input.trim();
    if (!nextName) {
      alert('재생목록 이름은 비워둘 수 없어요.');
      return;
    }

    // 같은 이름이 이미 있으면 중복 방지
    if (userPlaylists.some((p) => p.id !== playlistId && p.name === nextName)) {
      alert('이미 같은 이름의 재생목록이 있어요. 다른 이름을 입력해 주세요.');
      return;
    }

    if (nextName === target.name) return;

    const nextPlaylists = userPlaylists.map((pl) =>
      pl.id === playlistId ? { ...pl, name: nextName } : pl,
    );

    setUserPlaylists(nextPlaylists);

    try {
      await saveUserPlaylists(user.uid, nextPlaylists, activePlaylistId);
    } catch (e) {
      console.error(e);
      alert('재생목록 이름 저장에 실패했어요. 콘솔을 확인해 주세요.');
    }
  };


  const handleSelectPlaylist = async (id: string) => {
    setActivePlaylistId(id);
    setViewMode('detail');

    if (!user) return;
    try {
      await saveUserPlaylists(user.uid, userPlaylists, id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenFromHome = (id: string) => {
    void handleSelectPlaylist(id);
  };

  const handleGoHome = () => setViewMode('home');

  // ✅ Player가 트랙 변경(업로드/삭제/정렬)하면 여기서 Firestore에 저장
  const handleRemoteTracksChange = async (nextTracks: Track[]) => {
    if (!user) return;
    if (!activePlaylistId) return;

    const nextPlaylists = userPlaylists.map((pl) =>
      pl.id === activePlaylistId ? { ...pl, tracks: nextTracks } : pl,
    );

    setUserPlaylists(nextPlaylists);

    try {
      await saveUserPlaylists(user.uid, nextPlaylists, activePlaylistId);
    } catch (e) {
      console.error(e);
      alert('트랙 저장(동기화)에 실패했어요. 콘솔을 확인해 주세요.');
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!user) {
      alert('로그인한 상태에서만 재생목록을 삭제할 수 있습니다.');
      return;
    }
    if (playlistId === 'default') {
      alert('기본 재생목록은 삭제할 수 없습니다.');
      return;
    }

    const target = userPlaylists.find((p) => p.id === playlistId);
    if (!target) return;

    const ok = window.confirm(
      `재생목록 "${target.name}" 을(를) 삭제하시겠습니까?\n` +
        '이 목록에서만 사용하는 Firebase Storage 파일도 함께 삭제됩니다.',
    );
    if (!ok) return;

    const others = userPlaylists.filter((p) => p.id !== playlistId);

    // 다른 플리에서 안 쓰는 Storage URL만 골라서 삭제
    const toDelete: string[] = [];
    for (const t of target.tracks ?? []) {
      const url = t.src;
      if (!url?.startsWith('https://firebasestorage.googleapis.com/')) continue;

      const usedElsewhere = others.some((pl) => (pl.tracks ?? []).some((x) => x.src === url));
      if (!usedElsewhere) toDelete.push(url);
    }

    let newActiveId = activePlaylistId;
    if (playlistId === activePlaylistId) {
      newActiveId = others[0]?.id ?? null;
      setActivePlaylistId(newActiveId);
      setViewMode(newActiveId ? 'detail' : 'home');
    }

    setUserPlaylists(others);

    try {
      await saveUserPlaylists(user.uid, others, newActiveId ?? null);
    } catch (e) {
      console.error('플레이리스트 삭제 Firestore 오류:', e);
    }

    // Storage 삭제 (best-effort)
    for (const url of toDelete) {
      try {
        const fileRef = storageRef(storage, url);
        await deleteObject(fileRef);
      } catch (e) {
        console.error('Storage 파일 삭제 실패:', e);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-950 to-black text-neutral-50 flex">
      <PlaylistSidebar
        playlists={uiPlaylists}
        activeId={activePlaylistId}
        onSelect={handleSelectPlaylist}
        onCreate={handleCreatePlaylist}
        onDelete={handleDeletePlaylist}
        onRename={handleRenamePlaylist}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="px-6 pt-6 pb-4 border-b border-neutral-800/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {viewMode === 'detail' && (
              <button
                onClick={handleGoHome}
                className="px-3 py-1.5 rounded-lg bg-neutral-800/70 hover:bg-neutral-700/70 text-sm"
              >
                ← 홈
              </button>
            )}

            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
              <span className="text-3xl md:text-4xl">🎧</span>
              <span>My Music Player</span>
            </h1>
          </div>
          {/* 로그인 / 로그아웃 */}
          <div className="flex items-center justify-end">
            <AuthControls />
          </div>
        </header>
        {viewMode === 'home' ? (
          <PlaylistHome
            playlists={uiPlaylists}
            activeId={activePlaylistId}
            onOpenPlaylist={handleOpenFromHome}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center overflow-auto px-4 pb-6">
            <div className="max-w-xl w-full">
              <Player
                tracks={initialTracks}
                remotePlaylists={user ? userPlaylists : undefined}
                remoteActivePlaylistId={user ? activePlaylistId : null}
                remotePlaylistName={user ? (activePlaylist?.name ?? '플레이리스트') : undefined}
                remoteTracks={user ? (activePlaylist?.tracks ?? []) : undefined}
                onSelectPlaylist={handleSelectPlaylist}
                onCreatePlaylist={handleCreatePlaylist}
                onRemoteTracksChange={handleRemoteTracksChange}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;