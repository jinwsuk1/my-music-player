// src/components/PlaylistHome.tsx
import React from 'react';
import type { SidebarPlaylist } from './PlaylistSidebar';

type HomePlaylist = SidebarPlaylist & {
  // 나중에 썸네일 이미지가 생기면 여기 url을 넣으면 됨
  thumbnailUrl?: string;
  // 설명 텍스트 (선택)
  description?: string;
};

type Props = {
  playlists: HomePlaylist[];
  activeId: string | null;
  onOpenPlaylist: (id: string) => void;
};

const colors = [
  'from-violet-500/70 via-fuchsia-500/70 to-rose-500/70',
  'from-emerald-500/70 via-teal-500/70 to-sky-500/70',
  'from-amber-500/70 via-orange-500/70 to-rose-500/70',
  'from-sky-500/70 via-indigo-500/70 to-purple-500/70',
];

const PlaylistHome: React.FC<Props> = ({
  playlists,
  activeId,
  onOpenPlaylist,
}) => {
  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-neutral-50">
            내 재생목록
          </h1>
          <p className="mt-1 text-xs text-neutral-400">
            자주 듣는 곡들을 재생목록으로 만들어 보세요.
          </p>
        </div>
      </div>

      {playlists.length === 0 ? (
        <div className="mt-8 text-sm text-neutral-500">
          아직 만든 재생목록이 없어요.
          <br />
          왼쪽 사이드바에서 새 재생목록을 만들어 주세요.
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((pl, idx) => {
            const isActive = pl.id === activeId;
            const gradient = colors[idx % colors.length];

            return (
              <button
                key={pl.id}
                type="button"
                onClick={() => onOpenPlaylist(pl.id)}
                className={`
                  group
                  flex flex-col items-stretch
                  rounded-xl
                  bg-neutral-900/70
                  border border-neutral-800
                  hover:border-violet-500/80
                  hover:bg-neutral-850
                  overflow-hidden
                  text-left
                  transition
                  focus:outline-none focus:ring-2 focus:ring-violet-500/80
                `}
              >
                {/* 썸네일 영역 */}
                <div
                  className={`
                    aspect-[4/3]
                    w-full
                    bg-gradient-to-br ${gradient}
                    flex items-center justify-center
                  `}
                >
                  <span className="text-4xl">🎵</span>
                </div>

                {/* 텍스트 영역 */}
                <div className="px-4 py-3 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h2 className="flex-1 font-semibold text-sm text-neutral-50 truncate">
                      {pl.name}
                    </h2>
                    {isActive && (
                      <span className="inline-flex items-center rounded-full bg-violet-600/80 px-2 py-0.5 text-[11px] text-white">
                        현재 선택
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    트랙 {pl.trackCount}개
                    {pl.description && ` · ${pl.description}`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlaylistHome;
