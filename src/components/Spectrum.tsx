// src/components/Spectrum.tsx
import { useEffect, useRef, useState } from 'react';

type Props = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  src?: string;
};

// <audio> -> MediaElementAudioSourceNode 매핑
const sourceRegistry = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

export default function Spectrum({ audioRef, src }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const acRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  const [ready, setReady] = useState(false);

  // (기존과 동일) 사용자 첫 클릭 시 AudioContext 허용
  useEffect(() => {
    const onClick = () => setReady(true);
    window.addEventListener('click', onClick, { once: true });
    return () => window.removeEventListener('click', onClick);
  }, []);

  // 🔵 여기부터 핵심 useEffect
  useEffect(() => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) return;

    // 0) 크로스 오리진 검사
    const srcUrl = audio.currentSrc || audio.src;
    let sameOrigin = false;
    try {
      if (!srcUrl) {
        sameOrigin = true;
      } else if (srcUrl.startsWith('blob:') || srcUrl.startsWith('data:')) {
        sameOrigin = true; // 로컬 파일
      } else {
        const u = new URL(srcUrl);
        sameOrigin = u.origin === window.location.origin;
      }
    } catch {
      sameOrigin = false;
    }

    // 🔴 Firebase 같은 외부 도메인이면 Web Audio를 건너뜀 (재생만)
    if (!sameOrigin) {
      console.warn('[Spectrum] cross-origin src, skip Web Audio:', srcUrl);
      return;
    }

    if (!ready) return;

    // 1) AudioContext / Analyser 준비
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
      // ✅ destination 연결은 analyser만 (audio 엘리먼트 기본 출력은 그대로 둠)
      analyser.connect(ac.destination);
    }

    // 2) 현재 <audio>에 대한 MediaElementSource 재사용
    let srcNode = sourceRegistry.get(audio);
    if (!srcNode) {
      try {
        srcNode = ac.createMediaElementSource(audio);
        sourceRegistry.set(audio, srcNode);
      } catch (e) {
        // StrictMode 더블 마운트 보호
        srcNode = sourceRegistry.get(audio) || null!;
      }
    }

    // 3) graph: audio -> gain -> analyser
    try {
      srcNode.disconnect();
    } catch {}
    try {
      gainRef.current!.disconnect();
    } catch {}

    srcNode.connect(gainRef.current!);
    gainRef.current!.connect(analyser);

    // 4) 재생 시마다 context 깨우기
    const onPlay = () => {
      if (ac.state === 'suspended') ac.resume().catch(() => {});
    };
    audio.addEventListener('play', onPlay);

    // 5) 캔버스 그리기
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    roRef.current = new ResizeObserver(resize);
    roRef.current.observe(canvas);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const render = () => {
      analyser.getByteFrequencyData(data);

      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);

      const bars = 60;
      const gap = 2;
      const bw = (w - gap * (bars - 1)) / bars;

      ctx2d.fillStyle = '#a78bfa';
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
      // 컨텍스트/소스는 재사용 (언마운트 전체 때만 닫는 걸 고려)
    };
  }, [ready, audioRef, src]);

  return (
    <div className="h-24 w-full rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
