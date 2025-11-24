// src/components/Spectrum.tsx
import { useEffect, useRef, useState } from 'react';

type Props = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  src?: string; // 트랙 변경 신호
};

// <audio> 엘리먼트 -> MediaElementAudioSourceNode 매핑 (재사용용)
const sourceRegistry = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

export default function Spectrum({ audioRef, src }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 오디오 그래프 싱글톤
  const acRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null); // 중간 노드(연결/해제 용이)

  const rafRef = useRef<number | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  // 사용자 제스처 이후 활성화 (오토플레이 정책 회피)
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const onClick = () => setReady(true);
    window.addEventListener('click', onClick, { once: true });
    return () => window.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!ready || !audio || !canvas) return;

    // 1) 오디오 컨텍스트/노드 준비(없으면 생성)
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!acRef.current) acRef.current = new AC();
    const ac = acRef.current!;

    if (!analyserRef.current) {
      const an = ac.createAnalyser();
      an.fftSize = 512;
      an.smoothingTimeConstant = 0.85;
      analyserRef.current = an;
    }
    const analyser = analyserRef.current!;

    if (!gainRef.current) {
      const g = ac.createGain();
      g.gain.value = 1;
      gainRef.current = g;
      // analyser -> destination (고정)
      analyser.connect(ac.destination);
    }

    // 2) 현재 <audio>에 대한 MediaElementSource를 레지스트리에서 재사용
    let src = sourceRegistry.get(audio);
    if (!src) {
      try {
        src = ac.createMediaElementSource(audio);
        sourceRegistry.set(audio, src);
      } catch (e) {
        // 개발 모드 더블 마운트 등으로 이미 만들어졌다면 레지스트리에서 다시 시도
        src = sourceRegistry.get(audio) || null!;
      }
    }

    // 3) 소스 연결: src -> gain -> analyser (중복 연결 방지 위해 일단 해제 후 연결)
    try {
      src.disconnect();
    } catch {}
    try {
      gainRef.current!.disconnect();
    } catch {}

    src.connect(gainRef.current!);
    gainRef.current!.connect(analyser);

    // 4) 재생 시점마다 resume (suspended 보호)
    const onPlay = () => {
      if (ac.state === 'suspended') ac.resume().catch(() => {});
    };
    audio.addEventListener('play', onPlay);

    // 5) 캔버스 리사이즈 & 렌더 루프
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    roRef.current = ro;
    resize();

    const bufLen = analyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);

    const render = () => {
      analyser.getByteFrequencyData(data);
      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);

      const bars = Math.min(64, bufLen);
      const bw = (w / bars) * 0.7;
      const gap = (w / bars) * 0.3;

      ctx2d.fillStyle = '#a78bfa'; // violet-400 근사
      for (let i = 0; i < bars; i++) {
        const v = data[i] / 255;
        const bh = v * h;
        const x = i * (bw + gap);
        ctx2d.fillRect(x, h - bh, bw, bh);
      }
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      audio.removeEventListener('play', onPlay);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      roRef.current?.disconnect();
      roRef.current = null;
      // 컨텍스트/소스는 유지(다음 트랙에서도 재사용). 언마운트 전체 종료 시에만 close를 고려.
    };
  }, [ready, audioRef, src]); // 새로운 <audio>로 교체될 때마다 재연결
  // ↑ Player에서 <audio key={track?.src}> 를 쓰고 있으므로 엘리먼트가 바뀌면 이 이펙트가 다시 실행됨

  return (
    <div className="h-24 w-full rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
