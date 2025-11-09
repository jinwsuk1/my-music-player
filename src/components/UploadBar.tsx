import { ChangeEvent } from 'react';
import { Track } from '@/data/tracks';

interface Props {
  onAdd: (t: Track) => void;
}

export default function UploadBar({ onAdd }: Props) {
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    onAdd({ title: f.name, artist: 'Local', src: url });
  };
  return (
    <div style={{ margin: '12px 0' }}>
      <input type="file" accept="audio/*" onChange={onFile} />
    </div>
  );
}
