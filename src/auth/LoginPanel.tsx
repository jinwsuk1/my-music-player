// src/auth/LoginPanel.tsx
import { useAuth } from '@/auth/AuthContext';

export default function LoginPanel() {
  const { user, isLoading, loginWithGoogle, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="mb-4 text-xs text-neutral-400">
        로그인 상태 확인 중...
      </div>
    );
  }

  // 로그인된 상태
  if (user) {
    return (
      <div className="mb-4 flex items-center justify-between text-sm">
        <div className="flex flex-col">
          <span className="text-neutral-200">
            👤 <span className="font-semibold">{user.displayName || user.email}</span>
          </span>
          <span className="text-xs text-neutral-500">
            이 계정의 플레이리스트가 Firestore에 저장됩니다.
          </span>
        </div>
        <button
          type="button"
          onClick={logout}
          className="px-3 py-1.5 rounded-md text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
        >
          로그아웃
        </button>
      </div>
    );
  }

  // 로그아웃 상태
  return (
    <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900/70 p-3 text-xs">
      <p className="mb-2 text-neutral-300">
        구글 계정으로 로그인하면<br />
        플레이리스트가 기기와 브라우저를 넘어 동기화됩니다.
      </p>
      <button
        type="button"
        onClick={loginWithGoogle}
        className="w-full flex items-center justify-center gap-2 rounded-md bg-white text-neutral-900 py-1.5 font-semibold hover:bg-neutral-100"
      >
        <span>🔑</span>
        <span>Google 계정으로 로그인</span>
      </button>
    </div>
  );
}
