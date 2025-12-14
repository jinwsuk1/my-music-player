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
  onCreate?: () => void;
  onDelete?: (id: string) => void; // ✅ 삭제
  onRename?: (id: string) => void; // ✅ 이름 수정
};

const PlaylistSidebar: React.FC<Props> = ({
  playlists,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
}) => {
  return (
    <aside className="w-[280px] shrink-0 border-r border-neutral-900 bg-black/30 backdrop-blur-sm">
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-neutral-200">재생목록</h2>
          {onCreate && (
            <button
              type="button"
              onClick={onCreate}
              className="px-3 py-1 rounded-full text-xs bg-violet-600 hover:bg-violet-500 text-white transition"
            >
              + 새 재생목록
            </button>
          )}
        </div>

        <ul className="space-y-2">
          {playlists.map((pl) => {
            const active = pl.id === activeId;
            return (
              <li key={pl.id}>
                <button
                  type="button"
                  onClick={() => onSelect(pl.id)}
                  className={[
                    'w-full text-left p-3 rounded-xl border transition',
                    active
                      ? 'bg-neutral-900/60 border-neutral-700'
                      : 'bg-neutral-950/30 border-neutral-900 hover:bg-neutral-900/40 hover:border-neutral-800',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-neutral-100 truncate">
                        {pl.name}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        트랙 {pl.trackCount}개
                      </div>
                    </div>

                    <div className="flex items-center">
                      {/* ✅ 이름 수정 */}
                      {onRename && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRename(pl.id);
                          }}
                          className="ml-2 px-2 py-1 rounded-md text-xs hover:bg-neutral-900 border border-neutral-800 text-neutral-300"
                          title="재생목록 이름 수정"
                        >
                          수정
                        </button>
                      )}

                      {/* ✅ 삭제 버튼 (default는 보호) */}
                      {onDelete && pl.id !== 'default' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(pl.id);
                          }}
                          className="ml-2 px-2 py-1 rounded-md text-xs hover:bg-neutral-900 border border-neutral-800 text-neutral-300"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>

                  {active && (
                    <div className="mt-2 w-full h-[2px] bg-violet-500/60 rounded-full" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
};

export default PlaylistSidebar;
