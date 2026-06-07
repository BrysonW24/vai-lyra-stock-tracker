'use client';

import { useEffect, useRef, useState } from 'react';
import { TickerLogo } from '@/components/TickerLogo';

/**
 * Ticker Constellation - a 3D glassmorphism scene (Three.js, loaded from the cdnjs
 * CDN at runtime so it needs no npm install). Glowing ticker nodes drift in
 * straight lines and BOUNCE off the walls of the panel (DVD-logo style), with a
 * constellation web that re-draws between nearby nodes as they move. Crisp HTML
 * glass chips with company logos track each node by projecting its 3D position to
 * the screen. Falls back to a clean CSS grid if WebGL / the CDN is unavailable,
 * and holds a calm static frame under prefers-reduced-motion.
 */

interface ConstellationNode {
  ticker: string;
  sector: string;
  color: string;
}

const SECTOR_COLORS: Record<string, string> = {
  Semiconductors: '#60a5fa',
  'Mega-cap': '#f3a33a',
  Cloud: '#43d18b',
  Cybersecurity: '#a78bfa',
  'AI infra': '#4fd1d9',
};

const NODES: ConstellationNode[] = [
  { ticker: 'NVDA', sector: 'Semiconductors', color: '#60a5fa' },
  { ticker: 'AMD', sector: 'Semiconductors', color: '#60a5fa' },
  { ticker: 'AVGO', sector: 'Semiconductors', color: '#60a5fa' },
  { ticker: 'AAPL', sector: 'Mega-cap', color: '#f3a33a' },
  { ticker: 'MSFT', sector: 'Mega-cap', color: '#f3a33a' },
  { ticker: 'GOOGL', sector: 'Mega-cap', color: '#f3a33a' },
  { ticker: 'SNOW', sector: 'Cloud', color: '#43d18b' },
  { ticker: 'CRM', sector: 'Cloud', color: '#43d18b' },
  { ticker: 'NET', sector: 'Cloud', color: '#43d18b' },
  { ticker: 'CRWD', sector: 'Cybersecurity', color: '#a78bfa' },
  { ticker: 'PANW', sector: 'Cybersecurity', color: '#a78bfa' },
  { ticker: 'S', sector: 'Cybersecurity', color: '#a78bfa' },
  { ticker: 'SMCI', sector: 'AI infra', color: '#4fd1d9' },
  { ticker: 'ANET', sector: 'AI infra', color: '#4fd1d9' },
  { ticker: 'TSM', sector: 'AI infra', color: '#4fd1d9' },
];

const SECTORS = Array.from(new Set(NODES.map((n) => n.sector)));

let threePromise: Promise<unknown> | null = null;
function loadThree(): Promise<unknown> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  const w = window as unknown as { THREE?: unknown };
  if (w.THREE) return Promise.resolve(w.THREE);
  if (threePromise) return threePromise;
  threePromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.async = true;
    s.onload = () => resolve((window as unknown as { THREE: unknown }).THREE);
    s.onerror = () => reject(new Error('three load failed'));
    document.head.appendChild(s);
  });
  return threePromise;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function makeGlowTexture(THREE: any): any {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.Texture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function TickerConstellation() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let raf = 0;
    let disposed = false;
    let cleanup: (() => void) | null = null;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    loadThree()
      .then((THREEmod) => {
        if (disposed) return;
        const THREE = THREEmod as any;
        try {
          let width = container.clientWidth || 480;
          let height = container.clientHeight || 420;

          const scene = new THREE.Scene();
          const cameraZ = 7;
          const fov = 50;
          const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 100);
          camera.position.set(0, 0, cameraZ);

          const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          renderer.setSize(width, height);
          renderer.setClearColor(0x000000, 0);
          renderer.domElement.style.display = 'block';
          container.appendChild(renderer.domElement);

          const glowTex = makeGlowTexture(THREE);

          // Bounding box (half-extents) sized to the visible frustum at z=0, inset
          // so the glow never clips the panel edges. Recomputed on resize.
          const bounds = { x: 3, y: 3, z: 1.1 };
          const computeBounds = () => {
            const halfH = Math.tan((fov * Math.PI) / 180 / 2) * cameraZ;
            const halfW = halfH * (width / height);
            bounds.x = Math.max(1.2, halfW - 0.5);
            bounds.y = Math.max(1.2, halfH - 0.5);
          };
          computeBounds();

          // Each node gets a position + velocity; it travels straight and bounces.
          const nodeObjs: { sprite: any; pos: any; vel: any; phase: number }[] = [];
          NODES.forEach((node, i) => {
            const px = (((i * 73) % 100) / 100) * 2 - 1;
            const py = (((i * 149) % 100) / 100) * 2 - 1;
            const pz = (((i * 37) % 100) / 100) * 2 - 1;
            const pos = new THREE.Vector3(px * bounds.x * 0.8, py * bounds.y * 0.8, pz * bounds.z * 0.7);
            const angle = i * 0.97;
            const speed = 0.55 + (i % 5) * 0.07;
            const vel = new THREE.Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed, ((i % 3) - 1) * 0.12);

            const mat = new THREE.SpriteMaterial({
              map: glowTex,
              color: new THREE.Color(node.color),
              transparent: true,
              opacity: 0.9,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(0.66, 0.66, 0.66);
            sprite.position.copy(pos);
            scene.add(sprite);
            nodeObjs.push({ sprite, pos, vel, phase: i * 1.3 });
          });

          // Dynamic proximity links (constellation web) - preallocated buffer.
          const maxPairs = (NODES.length * (NODES.length - 1)) / 2;
          const linePos = new Float32Array(maxPairs * 2 * 3);
          const lineGeo = new THREE.BufferGeometry();
          lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
          const lineMat = new THREE.LineBasicMaterial({ color: 0x5a7da6, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending });
          const lines = new THREE.LineSegments(lineGeo, lineMat);
          scene.add(lines);
          const LINK_DIST = 2.4;

          const tmp = new THREE.Vector3();

          const updateLinks = () => {
            let v = 0;
            for (let i = 0; i < nodeObjs.length; i++) {
              for (let j = i + 1; j < nodeObjs.length; j++) {
                const a = nodeObjs[i].pos;
                const b = nodeObjs[j].pos;
                if (a.distanceTo(b) < LINK_DIST) {
                  linePos[v++] = a.x; linePos[v++] = a.y; linePos[v++] = a.z;
                  linePos[v++] = b.x; linePos[v++] = b.y; linePos[v++] = b.z;
                }
              }
            }
            lineGeo.setDrawRange(0, v / 3);
            lineGeo.attributes.position.needsUpdate = true;
          };

          const positionLabels = () => {
            for (let i = 0; i < nodeObjs.length; i++) {
              const el = labelRefs.current[i];
              if (!el) continue;
              tmp.copy(nodeObjs[i].pos).project(camera);
              const x = (tmp.x * 0.5 + 0.5) * width;
              const y = (-tmp.y * 0.5 + 0.5) * height;
              el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
              el.style.opacity = tmp.z < 1 ? '1' : '0';
            }
          };

          let last = performance.now();
          const step = (now: number) => {
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            for (const n of nodeObjs) {
              n.pos.addScaledVector(n.vel, dt);
              // Bounce off each wall.
              if (n.pos.x > bounds.x) { n.pos.x = bounds.x; n.vel.x = -Math.abs(n.vel.x); }
              else if (n.pos.x < -bounds.x) { n.pos.x = -bounds.x; n.vel.x = Math.abs(n.vel.x); }
              if (n.pos.y > bounds.y) { n.pos.y = bounds.y; n.vel.y = -Math.abs(n.vel.y); }
              else if (n.pos.y < -bounds.y) { n.pos.y = -bounds.y; n.vel.y = Math.abs(n.vel.y); }
              if (n.pos.z > bounds.z) { n.pos.z = bounds.z; n.vel.z = -Math.abs(n.vel.z); }
              else if (n.pos.z < -bounds.z) { n.pos.z = -bounds.z; n.vel.z = Math.abs(n.vel.z); }
              n.sprite.position.copy(n.pos);
              const s = 0.62 + Math.sin(now / 1000 * 1.4 + n.phase) * 0.05;
              n.sprite.scale.set(s, s, s);
            }
            updateLinks();
            renderer.render(scene, camera);
            positionLabels();
          };

          const animate = () => {
            step(performance.now());
            raf = requestAnimationFrame(animate);
          };

          if (reduceMotion) {
            updateLinks();
            renderer.render(scene, camera);
            positionLabels();
          } else {
            last = performance.now();
            animate();
          }

          const onResize = () => {
            width = container.clientWidth || width;
            height = container.clientHeight || height;
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            computeBounds();
            renderer.render(scene, camera);
            positionLabels();
          };
          const ro = new ResizeObserver(onResize);
          ro.observe(container);

          cleanup = () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            lineGeo.dispose();
            lineMat.dispose();
            glowTex.dispose();
            nodeObjs.forEach((n) => n.sprite.material.dispose());
            renderer.dispose();
            if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
          };
        } catch {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));

    return () => {
      disposed = true;
      if (cleanup) cleanup();
    };
  }, []);

  if (failed) {
    return (
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
        {SECTORS.map((sector) => (
          <div key={sector} className="terminal-panel rounded-xl p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: SECTOR_COLORS[sector] }}>
              {sector}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {NODES.filter((n) => n.sector === sector).map((n) => (
                <span key={n.ticker} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] text-[#dbe5ee]">
                  <TickerLogo symbol={n.ticker} size={12} /> {n.ticker}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full min-h-[120px] w-full overflow-hidden lg:min-h-[420px]">
      {NODES.map((node, i) => (
        <div
          key={node.ticker}
          ref={(el) => { labelRefs.current[i] = el; }}
          className="pointer-events-none absolute left-0 top-0 z-10 flex items-center gap-1 rounded-full border px-2 py-0.5 opacity-0 shadow-[0_8px_22px_-10px_rgba(0,0,0,0.8)] backdrop-blur-md transition-opacity"
          style={{ borderColor: `${node.color}55`, background: 'rgba(13,17,23,0.55)' }}
        >
          <TickerLogo symbol={node.ticker} size={14} />
          <span className="font-mono text-[10px] font-semibold tracking-tight text-[#eef3f8]">{node.ticker}</span>
        </div>
      ))}
    </div>
  );
}
