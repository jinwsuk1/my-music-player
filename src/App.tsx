import Player from '@/components/Player';
import { tracks } from '@/data/tracks';
import LoginPanel from '@/auth/LoginPanel';

export default function App() {
  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 flex items-center gap-3">
          <span className="text-violet-400">🎵</span>
          <span>My Music Player</span>
        </h1>

        {/* 로그인 패널 */}
        <LoginPanel />

        <div className="rounded-2xl border border-neutral-800 bg-neutral-850/60 p-5 md:p-6 shadow-2xl backdrop-blur-sm">
          <Player tracks={tracks} />
        </div>

        <p className="mt-4 text-xs text-neutral-400">
          Tip: 샘플 mp3는 <code className="text-neutral-300">public/music</code> 폴더에 넣어주세요.
        </p>
      </div>
    </div>
  );
}

