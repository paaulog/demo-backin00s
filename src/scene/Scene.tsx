import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useGesture } from '@use-gesture/react';
import { useSelector } from '@xstate/react';
import { useEffect, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { bookletPages } from '../art/pick';
import { boxActor } from '../box/boxActor';
import { JewelCase } from '../box/JewelCase';
import type { BoxEvent, CaseState } from '../box/machine';
import { currentAlbum, useApp } from '../store/store';
import { Shelf } from '../shelf/Shelf';
import { useReducedMotion } from './useReducedMotion';

export interface ViewState {
  rotX: number;
  rotY: number;
  distance: number;
}

const MIN_DIST = 260;
const MAX_DIST = 900;

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Lights() {
  const theme = useApp((s) => s.theme);
  const key = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Color(theme.lightColor), [theme.lightColor]);
  const reduced = useReducedMotion();
  // Transição da cor da luz em ~600 ms (S8); instantânea com movimento reduzido.
  useFrame((_, dt) => {
    if (!key.current) return;
    key.current.color.lerp(target, reduced ? 1 : Math.min(1, dt * 5));
    key.current.intensity += (theme.lightIntensity * 2.2 - key.current.intensity) * (reduced ? 1 : Math.min(1, dt * 5));
  });
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight ref={key} position={[180, 260, 420]} intensity={2.2} />
      <directionalLight position={[-300, -100, 200]} intensity={0.5} color="#cfd8ff" />
    </>
  );
}

/** Aplica a rotação e o zoom dos gestos com amortecimento. */
function Rig({ view, children }: { view: React.RefObject<ViewState>; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  useFrame((_, dt) => {
    const v = view.current;
    const g = group.current;
    if (!v || !g) return;
    const k = Math.min(1, dt * 8);
    g.rotation.y += (v.rotY - g.rotation.y) * k;
    g.rotation.x += (v.rotX - g.rotation.x) * k;
    camera.position.z += (v.distance - camera.position.z) * k;
  });
  return <group ref={group}>{children}</group>;
}

function Effects() {
  const quality = useApp((s) => s.quality);
  if (quality !== 'high') return null;
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={0.35} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur />
    </EffectComposer>
  );
}

const ORDER: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];

function CaseInScene() {
  const album = useApp(currentAlbum);
  const quality = useApp((s) => s.quality);
  const playing = useApp((s) => s.player.isPlaying && s.player.albumId === s.currentAlbumId);
  const page = useApp((s) => s.bookletPage);
  const setPage = useApp((s) => s.setBookletPage);
  const snap = useSelector(boxActor, (s) => s);
  const reduced = useReducedMotion();
  const value = snap.value as { case: CaseState; booklet: 'open' | 'closed' };
  if (!album || value.case === 'shelf' || snap.context.albumId !== album.id) return null;
  const pages = bookletPages(album).length;
  return (
    <JewelCase
      album={album}
      state={value.case}
      bookletOpen={value.booklet === 'open'}
      wrapped={!snap.context.shrinkwrapRemoved}
      quality={quality}
      spinning={value.case === 'playing' && playing}
      bookletPage={page}
      reducedMotion={reduced}
      send={(e: BoxEvent) => boxActor.send(e)}
      onPage={(p) => setPage(p >= pages ? 0 : Math.max(0, p))}
    />
  );
}

export default function Scene() {
  const view = useRef<ViewState>({ rotX: 0.08, rotY: -0.35, distance: 520 });
  const wrapper = useRef<HTMLDivElement>(null);
  const setQuality = useApp((s) => s.setQuality);
  const quality = useApp((s) => s.quality);
  const setWebglFailed = useApp((s) => s.setWebglFailed);
  const background = useApp((s) => s.theme.background);

  useGesture(
    {
      onDrag: ({ delta: [dx, dy], pinching, event }) => {
        if (pinching) return;
        event.preventDefault();
        view.current.rotY += dx * 0.008;
        view.current.rotX = THREE.MathUtils.clamp(view.current.rotX + dy * 0.006, -0.7, 0.7);
      },
      onWheel: ({ delta: [, dy], event }) => {
        event.preventDefault();
        view.current.distance = THREE.MathUtils.clamp(view.current.distance + dy * 0.6, MIN_DIST, MAX_DIST);
      },
      onPinch: ({ offset: [scale] }) => {
        view.current.distance = THREE.MathUtils.clamp(520 / scale, MIN_DIST, MAX_DIST);
      },
    },
    { target: wrapper, eventOptions: { passive: false }, drag: { filterTaps: true }, pinch: { scaleBounds: { min: 0.55, max: 2 } } },
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const step = 0.12;
    const v = view.current;
    switch (e.key) {
      case 'ArrowLeft':
        v.rotY -= step;
        break;
      case 'ArrowRight':
        v.rotY += step;
        break;
      case 'ArrowUp':
        v.rotX = Math.max(-0.7, v.rotX - step);
        break;
      case 'ArrowDown':
        v.rotX = Math.min(0.7, v.rotX + step);
        break;
      case '+':
      case '=':
        v.distance = Math.max(MIN_DIST, v.distance - 40);
        break;
      case '-':
        v.distance = Math.min(MAX_DIST, v.distance + 40);
        break;
      case 'Enter':
        boxActor.send({ type: 'PRIMARY' });
        break;
      case 'Escape':
        boxActor.send({ type: 'BACK' });
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <div
      ref={wrapper}
      className="canvas-wrap"
      tabIndex={0}
      role="application"
      aria-label="Caixa de CD em 3D. Setas giram, + e - aproximam, Enter faz a próxima ação, Esc volta."
      onKeyDown={onKeyDown}
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
      data-testid="canvas-wrap"
    >
      <Canvas
        dpr={[1, quality === 'low' ? 1 : 2]}
        camera={{ fov: 32, near: 10, far: 4000, position: [0, 0, 520] }}
        gl={{ antialias: quality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: false }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.domElement.addEventListener('webglcontextlost', (ev) => {
            ev.preventDefault();
            setWebglFailed(true);
          });
        }}
        style={{ background }}
      >
        <PerformanceMonitor
          onDecline={() => setQuality(ORDER[Math.max(0, ORDER.indexOf(useApp.getState().quality) - 1)] ?? 'low')}
          onIncline={() => setQuality(ORDER[Math.min(2, ORDER.indexOf(useApp.getState().quality) + 1)] ?? 'high')}
          flipflops={3}
          onFallback={() => setQuality('low')}
        />
        <Environment />
        <Lights />
        <Rig view={view}>
          <CaseInScene />
        </Rig>
        <Shelf />
        <Effects />
      </Canvas>
    </div>
  );
}
