import { useEffect, useRef } from 'react';
import { stft } from '../lib/dsp';

export function Waveform({
  samples,
  height = 72,
  color = '#22d3ee',
  marks = [],
  duration,
}: {
  samples: Float32Array;
  height?: number;
  color?: string;
  marks?: number[];
  duration?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const W = (c.width = c.clientWidth * 2);
    const H = (c.height = height * 2);
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, W, H);
    g.fillStyle = color;
    const step = Math.max(1, Math.floor(samples.length / W));
    for (let x = 0; x < W; x++) {
      let mn = 1;
      let mx = -1;
      for (let i = x * step; i < Math.min(samples.length, (x + 1) * step); i++) {
        mn = Math.min(mn, samples[i]);
        mx = Math.max(mx, samples[i]);
      }
      if (mx < mn) continue;
      const y1 = ((1 - mx * 1.4) * H) / 2;
      const y2 = ((1 - mn * 1.4) * H) / 2;
      g.fillRect(x, y1, 1, Math.max(1, y2 - y1));
    }
    if (duration) {
      g.strokeStyle = 'rgba(236,72,153,.8)';
      g.lineWidth = 2;
      marks.forEach((m) => {
        const x = (m / duration) * W;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, H);
        g.stroke();
      });
    }
  }, [samples, height, color, marks, duration]);
  return <canvas ref={ref} style={{ height }} className="w-full rounded-lg bg-black/25" />;
}

export function Spectrogram({ samples, height = 120 }: { samples: Float32Array; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const frames = stft(samples, 128).map((p) => p.map((v) => 10 * Math.log10(v + 1e-10)));
    const bins = 200;
    c.width = frames.length;
    c.height = bins;
    const g = c.getContext('2d')!;
    let max = -200;
    frames.forEach((f) => {
      for (let k = 0; k < bins; k++) max = Math.max(max, f[k]);
    });
    const img = g.createImageData(frames.length, bins);
    frames.forEach((f, x) => {
      for (let k = 0; k < bins; k++) {
        const t = Math.max(0, Math.min(1, (f[k] - (max - 70)) / 70));
        const o = ((bins - 1 - k) * frames.length + x) * 4;
        img.data[o] = 255 * Math.min(1, t * 2.2);
        img.data[o + 1] = 255 * Math.max(0, Math.min(1, (t - 0.35) * 2.2));
        img.data[o + 2] = 255 * (t < 0.5 ? 0.25 + t : Math.max(0, 1 - (t - 0.5) * 3));
        img.data[o + 3] = 255;
      }
    });
    g.putImageData(img, 0, 0);
  }, [samples]);
  return <canvas ref={ref} style={{ height }} className="w-full rounded-lg bg-black/25" />;
}

export function LineChart({
  data,
  height = 90,
  color = '#a78bfa',
  unit = '',
  breakAtZero = false,
}: {
  data: number[];
  height?: number;
  color?: string;
  unit?: string;
  breakAtZero?: boolean;
}) {
  const W = 400;
  const vals = breakAtZero ? data.filter((v) => v > 0) : data;
  const lo = vals.length ? Math.min(...vals) : 0;
  const hi = vals.length ? Math.max(...vals) : 1;
  const span = hi - lo || 1;
  const sx = (i: number) => (i / Math.max(1, data.length - 1)) * W;
  const sy = (v: number) => height - 8 - ((v - lo) / span) * (height - 16);
  const paths: string[] = [];
  let cur = '';
  data.forEach((v, i) => {
    if (breakAtZero && v <= 0) {
      if (cur) paths.push(cur);
      cur = '';
    } else cur += `${cur ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`;
  });
  if (cur) paths.push(cur);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full rounded-lg bg-black/25" style={{ height }}>
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <span className="absolute left-2 top-1 font-mono text-[10px] text-slate-400">{Math.round(hi)}{unit}</span>
      <span className="absolute bottom-1 left-2 font-mono text-[10px] text-slate-400">{Math.round(lo)}{unit}</span>
    </div>
  );
}

export function BarChart({ data, height = 90, color = '#06b6d4' }: { data: number[]; height?: number; color?: string }) {
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  return (
    <div className="flex items-end gap-[2px] rounded-lg bg-black/25 px-2 pb-1 pt-2" style={{ height }}>
      {data.map((v, i) => (
        <div key={i} title={v.toFixed(1)} className="flex-1 rounded-t" style={{ height: `${8 + ((v - lo) / (hi - lo || 1)) * 92}%`, background: color }} />
      ))}
    </div>
  );
}

