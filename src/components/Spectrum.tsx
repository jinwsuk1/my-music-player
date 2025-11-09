import { useEffect, useRef, useState } from 'react';

export default function Spectrum({ audioRef }: { audioRef: React.RefObject<HTMLAudioElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);

  // 사용자 제스처 이후에만 AudioContext 생성
  useEffect(() => {
    const onClick = () => setReady(true);
    window.addEventListener('click', onClick, { once: true });
    return () => window.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (!ready) return;

    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) return;

    // 이미 연결된 경우(중복 방지)
    // data-connected 플래그로 재연결 차단
    if ((audio as any)._spectrumConnected) return;
    (audio as any)._spectrumConnected = true;

    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ac = new AC();

    // 한 audioElement 당 MediaElementSource는 1개만 허용됨
    const source = ac.createMediaElementSource(audio);
    const analyser = ac.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.85;

    source.connect(analyser);
    analyser.connect(ac.destination);

    const bufLen = analyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const render = () => {
      analyser.getByteFrequencyData(data);
      const { width, height } = canvas;
      ctx2d.clearRect(0, 0, width, height);

      const bars = Math.min(64, bufLen);
      const barW = (width / bars) * 0.75;
      const gap = (width / bars) * 0.25;

      ctx2d.fillStyle = '#a78bfa'; // violet-400 근사
      for (let i = 0; i < bars; i++) {
        const v = data[i] / 255;
        const h = v * height;
        const x = i * (barW + gap);
        ctx2d.fillRect(x, height - h, barW, h);
      }
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      rafRef.current && cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      try {
        source.disconnect();
        analyser.disconnect();
        ac.close();
      } catch {}
      (audio as any)._spectrumConnected = false;
    };
  }, [ready, audioRef]);

  return (
    <div className="h-16 w-full rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}

