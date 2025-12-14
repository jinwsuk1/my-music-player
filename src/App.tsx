// src/App.tsx
import { useEffect, useMemo, useState } from 'react';
import Player from '@/components/Player';
import initialTracks from './data/tracks';

import PlaylistSidebar, { SidebarPlaylist } from '@/components/PlaylistSidebar';
import PlaylistHome from '@/components/PlaylistHome';

import { useAuth } from '@/auth/AuthContext';
import {
  createEmptyPlaylist,
  listenUserPlaylists,
  saveUserPlaylists,
  type UserPlaylist,
} from '@/api/playlist';

import { storage } from '@/firebase';
import { ref, deleteObject } from 'firebase/storage';

type ViewMode = 'home' | 'detail';

function App() {
  const { user } = useAuth();

  // ✅ Firestore 실데이터를 App이 소유 (1번 방식)
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('home');

  // 🔴 Firestore 실시간 구독
  useEffect(() => {
    if (!user) {
      setUserPlaylists([]);
      setActivePlaylistId(null);
      return;
    }

    const unsub = listenUserPlaylists(user.uid, ({ playlists, activePlaylistId }) => {
      setUserPlaylists(playlists);

      // 서버 active가 있으면 그걸 우선으로 반영
      const serverActive =
        (activePlaylistId && playlists.some((p) => p.id === activePlaylistId))
          ? activePlaylistId
          : (playlists[0]?.id ?? null);

      setActivePlaylistId(serverActive);
    });

    return () => unsub();
  }, [user]);

  // Sidebar/Home 컴포넌트는 아직 trackCount 기반이니까, 여기서 매핑해서 전달
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
    const name = sameNameCount === 0 ? baseName : `${baseName} ${sameNameCount + 1}`;

    const newPl = createEmptyPlaylist(name);
    const next = [...userPlaylists, newPl];

    // 낙관적 업데이트
    setUserPlaylists(next);
    setActivePlaylistId(newPl.id);
    setViewMode('detail');

    // Firestore 저장
    try {
      await saveUserPlaylists(user.uid, next, newPl.id);
    } catch (e) {
      console.error(e);
      alert('재생목록 생성 저장에 실패했어요. 콘솔을 확인해 주세요.');
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

  const handleGoHome = () => {
    setViewMode('home');
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

    // 1) Storage에서 지울 후보 URL 모으기 (다른 플리에 안 쓰는 것만)
    const toDelete: string[] = [];
    for (const track of target.tracks ?? []) {
      const src = track.src;
      if (!src || !src.startsWith('https://firebasestorage.googleapis.com/')) continue;

      const usedElsewhere = others.some((pl) =>
        (pl.tracks ?? []).some((t) => t.src === src),
      );
      if (!usedElsewhere) toDelete.push(src);
    }

    // 2) active 처리
    let newActiveId = activePlaylistId;
    if (playlistId === activePlaylistId) {
      newActiveId = others[0]?.id ?? null;
      setActivePlaylistId(newActiveId);
      setViewMode(newActiveId ? 'detail' : 'home');
    }

    // 3) UI 먼저 반영
    setUserPlaylists(others);

    // 4) Firestore 업데이트
    try {
      await saveUserPlaylists(user.uid, others, newActiveId ?? null);
    } catch (err) {
      console.error('플레이리스트 삭제 중 Firestore 오류:', err);
    }

    // 5) Storage 실제 삭제(베스트 에포트)
    for (const url of toDelete) {
      try {
        const fileRef = ref(storage, url);
        await deleteObject(fileRef);
      } catch (err) {
        console.error('Storage 파일 삭제 실패:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-950 to-black text-neutral-50 flex">
      {/* 왼쪽: 실제 Firestore 재생목록 */}
      <PlaylistSidebar
        playlists={uiPlaylists}
        activeId={activePlaylistId}
        onSelect={handleSelectPlaylist}
        onCreate={handleCreatePlaylist}
        onDelete={handleDeletePlaylist}
      />

      {/* 오른쪽: 메인 영역 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="px-6 pt-6 pb-4 border-b border-neutral-800/80 flex items-center gap-3">
          {viewMode === 'detail' && (
            <button
              onClick={handleGoHome}
              className="px-3 py-1.5 rounded-lg bg-neutral-800/70 hover:bg-neutral-700/70 text-sm"
              aria-label="홈으로 돌아가기"
            >
              ← 홈
            </button>
          )}

          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <span className="text-3xl md:text-4xl">🎧</span>
            <span>My Music Player</span>
          </h1>
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
              <Player tracks={initialTracks} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
