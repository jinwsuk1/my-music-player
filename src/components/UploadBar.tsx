// src/components/UploadBar.tsx
import { ChangeEvent, useState } from 'react';
import type { Track } from '../data/tracks';

import { useAuth } from '../auth/AuthContext';   // 경로는 네 프로젝트에 맞게
import { storage } from '../firebase';          // 경로는 네 프로젝트에 맞게
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Props {
  onAdd: (t: Track) => void;
}

export default function UploadBar({ onAdd }: Props) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      alert('파일 업로드는 로그인 후 가능합니다.');
      // 같은 파일 다시 선택 가능하게 input 초기화
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      // 1) Storage 경로: tracks/{uid}/{timestamp-파일이름}
      const path = `tracks/${user.uid}/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, path);

      // 2) 파일 업로드
      const snapshot = await uploadBytes(fileRef, file);

      // 3) 다운로드 URL 가져오기
      const url = await getDownloadURL(snapshot.ref);

      // 4) 이제 src는 blob이 아니라 항상 유효한 HTTPS URL
      onAdd({
        title: file.name,
        artist: user.displayName ?? user.email ?? 'Me',
        src: url,
      });

      // 같은 파일 다시 업로드할 수 있게 input 초기화
      e.target.value = '';
    } catch (err) {
      console.error(err);
      alert('업로드 중 오류가 발생했습니다. 콘솔 로그를 확인해 주세요.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ margin: '12px 0' }}>
      <input
        type="file"
        accept="audio/*"
        onChange={onFile}
        disabled={uploading}
      />
      {uploading && (
        <p style={{ fontSize: '12px', marginTop: '4px' }}>
          업로드 중입니다...
        </p>
      )}
    </div>
  );
}
