// src/components/PlaylistSidebar.tsx
import React from 'react';

export type SidebarPlaylist = {
  id: string;
  name: string;
  trackCount: number;
};

type Props = {
  playlists: SidebarPlaylist[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete?: (id: string) => void; // ✅ 추가
};

const PlaylistSidebar: React.FC<Props> = ({
  playlists,
  activeId,
  onSelect,
  onCreate,
  onDelete,
}) => {
  return (
    <aside className="hidden md:flex flex-col w-60 bg-neutral-950/95 border-r border-neutral-800 text-sm">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <span className="font-semibold text-neutral-100">재생목록</span>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white transition"
        >
          + 새 재생목록
        </button>
      </div>

      <div className="px-3 pb-3 overflow-y-auto">
        {playlists.length === 0 && (
          <p className="px-1 py-2 text-xs text-neutral-500">
            아직 만든 재생목록이 없어요.
            <br />
            위의 버튼을 눌러 새 재생목록을 만들어 보세요.
          </p>
        )}

        <ul className="space-y-1">
          {playlists.map((pl) => {
            const isActive = pl.id === activeId;

            return (
              <li key={pl.id}>
                <div
                  className={`
                    w-full flex items-center justify-between
                    rounded-lg px-3 py-2
                    transition
                    ${isActive ? 'bg-neutral-800' : 'hover:bg-neutral-850'}
                  `}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(pl.id)}
                    className="flex-1 text-left"
                  >
                    <div className="flex flex-col">
                      <span className={`truncate text-xs ${isActive ? 'text-violet-100' : 'text-neutral-300'}`}>
                        {pl.name}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        트랙 {pl.trackCount}개
                      </span>
                    </div>
                  </button>

                  {isActive && <span className="ml-2 h-2 w-2 rounded-full bg-violet-500" />}

                  {/* ✅ 삭제 버튼 (default는 보호) */}
                  {onDelete && pl.id !== 'default' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(pl.id);
                      }}
                      className="ml-2 px-2 py-1 rounded-md text-[11px] bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 text-neutral-300"
                      title="재생목록 삭제"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
};

export default PlaylistSidebar;
