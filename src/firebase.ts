// src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyC-9bhbeugzykYzffQ4E2GY03k2phR6NK8',
  authDomain: 'my-music-player-7359d.firebaseapp.com',
  projectId: 'my-music-player-7359d',
  storageBucket: 'my-music-player-7359d.firebasestorage.app',
  messagingSenderId: '...',
  appId: '...',
};

const app = initializeApp(firebaseConfig);

// Firebase Auth (Google 로그인에 사용)
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore (플레이리스트 저장)
export const db = getFirestore(app);

// 🔽 이 줄 추가
export const storage = getStorage(app);