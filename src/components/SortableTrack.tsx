import { HTMLAttributes } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Props = {
  id: string;
  index: number;
  title: string;
  artist: string;
  active: boolean;
  playing: boolean;
  canDelete?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
  /** DragOverlay 전용 렌더링일 때 */
  ghost?: boolean;
} & HTMLAttributes<HTMLLIElement>;

export default function SortableTrack({
  id,
  index,
  title,
  artist,
  active,
  playing,
  canDelete,
  onClick,
  onDelete,
  ghost = false,
  ...rest
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging, // 원본 아이템이 드래깅 중인지
  } = useSortable({ id });

  // 원본 아이템은 투명하게(자리만 차지), DragOverlay가 마우스를 따라감
  const style: React.CSSProperties = ghost
    ? {
        transform: CSS.Translate.toString(transform),
        transition,
        // 오버레이를 더 눈에 띄게
        boxShadow: '0 12px 28px rgba(0,0,0,.45)',
        border: '1px solid rgb(109 40 217 / .8)',
      }
    : {
        transform: CSS.Transform.toString(
          // 원본은 살짝만 오른쪽/아래로 밀려 보이게(유튜브 뮤직 느낌)
          isDragging && transform
            ? { ...transform, x: 8, y: 2, scaleX: 1, scaleY: 1 }
            : transform
        ),
        transition,
        opacity: isDragging ? 0.2 : 1,
      };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={[
        'flex items-center gap-2 rounded-xl border transition select-none',
        active
          ? 'bg-neutral-800/80 border-neutral-700'
          : 'bg-neutral-900/30 border-neutral-800 hover:bg-neutral-800/40 hover:border-neutral-700',
        ghost ? 'pointer-events-none' : '',
      ].join(' ')}
      {...rest}
    >
      {/* drag handle */}
      <button
        className="px-2 cursor-grab text-neutral-500 hover:text-neutral-300"
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        type="button"
      >
        ⋮⋮
      </button>

      <button
        onClick={onClick}
        className="flex-1 text-left px-2 py-2 rounded-lg"
        type="button"
      >
        <div className="font-medium truncate">
          {index + 1}. {title}
        </div>
        <div className="text-xs text-neutral-400 truncate">{artist}</div>
      </button>

      {canDelete && (
        <button
          onClick={onDelete}
          className="px-2.5 py-2 rounded-lg bg-neutral-800 border border-neutral-700 hover:bg-neutral-750 text-xs transition"
          title="Remove uploaded track"
          type="button"
        >
          삭제
        </button>
      )}
    </li>
  );
}
