import { animated, useSpring, type SpringValue } from '@react-spring/three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { artworkOf, bookletPages, pickArtwork } from '../art/pick';
import type { Album } from '../core/types';
import type { QualityLevel } from '../store/store';
import { BOOKLET, CASE, COVER_CENTER, coverCrop, DISC, INLAY, INLAY_BACK_WIDTH, inlayRegions, type UvRange } from './dimensions';
import type { BoxEvent, CaseState } from './machine';
import { discDataMaterial, paperMaterial, plasticMaterial, shrinkwrapMaterial, trayMaterial } from './materials';
import { textTexture, useArtTexture } from './textures';

const HALF_W = CASE.width / 2;
const HALF_D = CASE.depth / 2;
const LID_OPEN = -1.95;

/** Poses do disco em coordenadas da caixa (mm). */
export const DISC_POSES = {
  tray: { x: 4, y: 0, z: -1.3, tilt: 0 },
  hand: { x: 18, y: 8, z: 48, tilt: -0.35 },
  player: { x: 150, y: -6, z: 3, tilt: 0 },
} as const;

/** Posição da caixa inteira por estado: desloca para a esquerda quando o aparelho aparece. */
const RIG_X: Record<CaseState, number> = { shelf: 0, closed: 0, open: 0, discInHand: -40, playing: -45 };

/** Plano com UVs recortadas, para colar arte por medida sem esticar. */
function croppedPlane(w: number, h: number, uv: UvRange, rotateUv = false): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  const attr = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < attr.count; i++) {
    const u = attr.getX(i);
    const v = attr.getY(i);
    const [su, sv] = rotateUv ? [v, 1 - u] : [u, v];
    attr.setXY(i, uv.u0 + su * (uv.u1 - uv.u0), uv.v0 + sv * (uv.v1 - uv.v0));
  }
  attr.needsUpdate = true;
  return g;
}

function aspectOf(tex: THREE.Texture | null): number {
  const img = tex?.image as { width?: number; height?: number } | undefined;
  return img?.width && img.height ? img.width / img.height : 1;
}

export interface JewelCaseProps {
  album: Album;
  state: CaseState;
  bookletOpen: boolean;
  wrapped: boolean;
  quality: QualityLevel;
  spinning: boolean;
  bookletPage: number;
  reducedMotion: boolean;
  send(event: BoxEvent): void;
  onPage(page: number): void;
}

export function JewelCase(props: JewelCaseProps) {
  const { album, state, bookletOpen, wrapped, quality, spinning, bookletPage, reducedMotion, send } = props;
  const immediate = reducedMotion;
  const plastic = useMemo(() => plasticMaterial(quality, (album.year ?? 2100) < 2000), [quality, album.year]);
  const tray = useMemo(() => trayMaterial('black'), []);

  const lidOpen = state === 'open' || state === 'discInHand' || state === 'playing';
  const { lid } = useSpring({ lid: lidOpen ? LID_OPEN : 0, config: { tension: 120, friction: 18 }, immediate });
  const { rigX } = useSpring({ rigX: RIG_X[state], config: { tension: 90, friction: 20 }, immediate });
  const pose = state === 'playing' ? DISC_POSES.player : state === 'discInHand' ? DISC_POSES.hand : DISC_POSES.tray;
  const disc = useSpring({ dx: pose.x, dy: pose.y, dz: pose.z, tilt: pose.tilt, config: { tension: 110, friction: 20 }, immediate });
  const { player } = useSpring({ player: state === 'discInHand' || state === 'playing' ? 1 : 0, immediate });
  const { wrap } = useSpring({ wrap: wrapped ? 0 : 1, config: { tension: 70, friction: 16 }, immediate });
  const { reader } = useSpring({ reader: bookletOpen ? 1 : 0, config: { tension: 100, friction: 20 }, immediate });

  const pointer = (e: ThreeEvent<PointerEvent>, on: boolean) => {
    e.stopPropagation();
    document.body.style.cursor = on ? 'pointer' : '';
  };
  const click = (event: BoxEvent) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    send(event);
  };

  return (
    <animated.group position-x={rigX}>
      <Base plastic={plastic} tray={tray} album={album} onTrayClick={state === 'discInHand' ? click({ type: 'RETURN_DISC' }) : undefined} />

      {/* Tampa: pivô no eixo da dobradiça (x = -71, frente da caixa). */}
      <animated.group position={[-HALF_W, 0, HALF_D]} rotation-y={lid}>
        <group position={[HALF_W, 0, -HALF_D]}>
          <Lid
            plastic={plastic}
            onClick={click(state === 'closed' ? (wrapped ? { type: 'UNWRAP' } : { type: 'OPEN' }) : { type: 'CLOSE' })}
            onPointer={pointer}
          />
        </group>
      </animated.group>

      <Booklet
        album={album}
        lidAngle={lid}
        reader={reader}
        page={bookletPage}
        open={bookletOpen}
        onClick={(e) => {
          e.stopPropagation();
          if (bookletOpen) props.onPage(bookletPage + 1);
          else if (state === 'open' || state === 'playing') send({ type: 'OPEN_BOOKLET' });
          else if (state === 'closed') send(wrapped ? { type: 'UNWRAP' } : { type: 'OPEN' });
        }}
        onPointer={pointer}
      />

      <animated.group position-x={disc.dx} position-y={disc.dy} position-z={disc.dz} rotation-x={disc.tilt}>
        <Disc
          album={album}
          spinning={spinning && !reducedMotion}
          onClick={
            state === 'open'
              ? click({ type: 'TAKE_DISC' })
              : state === 'discInHand'
                ? click({ type: 'INSERT_DISC' })
                : state === 'playing'
                  ? click({ type: 'EJECT' })
                  : undefined
          }
          onPointer={pointer}
        />
      </animated.group>

      <animated.group position={[DISC_POSES.player.x, DISC_POSES.player.y, -3]} scale={player.to((p) => Math.max(0.001, p))}>
        <PlayerPlatter
          onClick={state === 'discInHand' ? click({ type: 'INSERT_DISC' }) : state === 'playing' ? click({ type: 'EJECT' }) : undefined}
          onPointer={pointer}
        />
      </animated.group>

      <Shrinkwrap progress={wrap} album={album} onClick={wrapped && state === 'closed' ? click({ type: 'UNWRAP' }) : undefined} onPointer={pointer} />
    </animated.group>
  );
}

// ---------- peças ----------

function Base({ plastic, tray, album, onTrayClick }: { plastic: THREE.Material; tray: THREE.Material; album: Album; onTrayClick?: (e: ThreeEvent<MouseEvent>) => void }) {
  const back = pickArtwork(album, 'back');
  const spineArt = pickArtwork(album, 'spine');
  const backTex = useArtTexture(back?.url);
  const spineTex = useArtTexture(spineArt?.url);
  const regions = inlayRegions();

  const inlayMat = useMemo(() => paperMaterial(backTex, 0.15), [backTex]);
  const spineMat = useMemo(() => paperMaterial(spineTex ?? backTex, 0.15), [spineTex, backTex]);
  // A arte da contracapa pode não ter a proporção do inlay: recorta pelo centro.
  const crop = coverCrop(aspectOf(backTex), INLAY.width / INLAY.height);
  const sub = (r: UvRange): UvRange => ({ u0: crop.u0 + r.u0 * (crop.u1 - crop.u0), u1: crop.u0 + r.u1 * (crop.u1 - crop.u0), v0: crop.v0, v1: crop.v1 });
  const spineFromOwnArt = Boolean(spineTex);
  const spineRotate = spineFromOwnArt && aspectOf(spineTex) > 1;
  const full = { u0: 0, u1: 1, v0: 0, v1: 1 };

  const backGeo = useMemo(() => croppedPlane(INLAY_BACK_WIDTH, INLAY.height, sub(regions.back)), [crop.u0, crop.u1, crop.v0, crop.v1]); // eslint-disable-line react-hooks/exhaustive-deps
  const leftGeo = useMemo(() => croppedPlane(INLAY.spine, INLAY.height, spineFromOwnArt ? full : sub(regions.leftSpine), spineRotate), [spineFromOwnArt, spineRotate, crop.u0, crop.u1]); // eslint-disable-line react-hooks/exhaustive-deps
  const rightGeo = useMemo(() => croppedPlane(INLAY.spine, INLAY.height, spineFromOwnArt ? full : sub(regions.rightSpine), spineRotate), [spineFromOwnArt, spineRotate, crop.u0, crop.u1]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group name="base">
      {/* Fundo de poliestireno e paredes laterais. */}
      <mesh position={[0, 0, -HALF_D + 0.6]} material={plastic}>
        <boxGeometry args={[CASE.width, CASE.height, 1.2]} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={`wall-y${s}`} position={[0, (s * (CASE.height - 1.2)) / 2, -1]} material={plastic}>
          <boxGeometry args={[CASE.width, 1.2, 7]} />
        </mesh>
      ))}
      <mesh position={[HALF_W - 0.6, 0, -1]} material={plastic}>
        <boxGeometry args={[1.2, CASE.height, 7]} />
      </mesh>

      {/* Inlay: painel traseiro de 138 mm e as duas lombadas de 6,5 mm, voltados para fora. */}
      <mesh name="inlay" geometry={backGeo} material={inlayMat} position={[0, 0, -HALF_D + 1.25]} rotation-y={Math.PI} />
      <mesh name="inlay_spine_r" geometry={leftGeo} material={spineMat} position={[HALF_W - 1.25, 0, -HALF_D + 1.2 + INLAY.spine / 2]} rotation-y={Math.PI / 2} />
      <mesh name="inlay_spine_l" geometry={rightGeo} material={spineMat} position={[-HALF_W + 1.25, 0, -HALF_D + 1.2 + INLAY.spine / 2]} rotation-y={-Math.PI / 2} />

      {/* Bandeja preta com recesso e pino central (rosette). */}
      <mesh name="tray" position={[2, 0, -2.2]} material={tray} onClick={onTrayClick}>
        <boxGeometry args={[136, 118, 1.6]} />
      </mesh>
      <group name="rosette" position={[DISC_POSES.tray.x, 0, -1.3]}>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 6.6, Math.sin(a) * 6.6, 0.6]} rotation-z={a} material={tray}>
              <boxGeometry args={[2.2, 1, 1.6]} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function Lid({ plastic, onClick, onPointer }: { plastic: THREE.Material; onClick: (e: ThreeEvent<MouseEvent>) => void; onPointer: (e: ThreeEvent<PointerEvent>, on: boolean) => void }) {
  return (
    <group name="lid" onClick={onClick} onPointerOver={(e) => onPointer(e, true)} onPointerOut={(e) => onPointer(e, false)}>
      <mesh position={[0, 0, HALF_D - 0.75]} material={plastic}>
        <boxGeometry args={[CASE.width, CASE.height, 1.5]} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, (s * (CASE.height - 1.4)) / 2, HALF_D - 2.6]} material={plastic}>
          <boxGeometry args={[CASE.width - 2, 1.4, 2.4]} />
        </mesh>
      ))}
      {/* Nervuras da dobradiça que pegam a luz. */}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[-HALF_W + 3 + i * 1.4, 0, HALF_D - 0.1]} material={plastic}>
          <boxGeometry args={[0.5, CASE.height - 6, 0.4]} />
        </mesh>
      ))}
    </group>
  );
}

const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const yAxis = new THREE.Vector3(0, 1, 0);

interface BookletProps {
  album: Album;
  lidAngle: SpringValue<number>;
  reader: SpringValue<number>;
  page: number;
  open: boolean;
  onClick(e: ThreeEvent<MouseEvent>): void;
  onPointer(e: ThreeEvent<PointerEvent>, on: boolean): void;
}

/**
 * Encarte: preso à tampa quando fechado; no modo leitura sai da tampa e vem para a frente.
 * Cada folha gira em torno da lombada (borda esquerda).
 */
function Booklet({ album, lidAngle, reader, page, open, onClick, onPointer }: BookletProps) {
  const group = useRef<THREE.Group>(null);
  const pages = bookletPages(album);
  const leaves = pages.length ? pages : [];

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const theta = lidAngle.get();
    const t = reader.get();
    // Pose presa à tampa: centro do encarte girado com a dobradiça.
    const lx = COVER_CENTER.x + HALF_W;
    const lz = -2.1;
    const fx = -HALF_W + lx * Math.cos(theta) + lz * Math.sin(theta);
    const fz = HALF_D - lx * Math.sin(theta) + lz * Math.cos(theta);
    const reader3 = { x: 0, y: 4, z: 75 };
    g.position.set(fx + (reader3.x - fx) * t, (reader3.y) * t, fz + (reader3.z - fz) * t);
    tmpQ.setFromAxisAngle(yAxis, theta);
    tmpQ2.identity();
    g.quaternion.copy(tmpQ).slerp(tmpQ2, t);
  });

  return (
    <group ref={group} name="booklet" onClick={onClick} onPointerOver={(e) => onPointer(e, true)} onPointerOut={(e) => onPointer(e, false)}>
      {leaves.map((art, i) => (
        <Leaf key={`${art.url}-${i}`} url={art.url} index={i} count={leaves.length} flipped={open && i < page} />
      ))}
      {!leaves.length && (
        <mesh material={paperMaterial(null)}>
          <planeGeometry args={[BOOKLET.size, BOOKLET.size]} />
        </mesh>
      )}
    </group>
  );
}

function Leaf({ url, index, count, flipped }: { url: string; index: number; count: number; flipped: boolean }) {
  const tex = useArtTexture(url);
  const crop = coverCrop(aspectOf(tex), 1);
  const front = useMemo(() => croppedPlane(BOOKLET.size, BOOKLET.size, crop), [crop.u0, crop.u1, crop.v0, crop.v1]); // eslint-disable-line react-hooks/exhaustive-deps
  const mat = useMemo(() => paperMaterial(tex, 0.3), [tex]);
  const backMat = useMemo(() => paperMaterial(null, 0.1), []);
  const { rot } = useSpring({ rot: flipped ? -Math.PI + 0.02 * index : 0, config: { tension: 140, friction: 22 } });
  // Folhas não viradas empilham com a primeira por cima; viradas, a última virada por cima.
  const z = flipped ? index * 0.08 : (count - index) * 0.08;
  return (
    <animated.group name={`booklet_page_${index}`} position={[-BOOKLET.size / 2, 0, z]} rotation-y={rot}>
      <mesh geometry={front} material={mat} position={[BOOKLET.size / 2, 0, 0.02]} />
      <mesh material={backMat} position={[BOOKLET.size / 2, 0, -0.02]} rotation-y={Math.PI}>
        <planeGeometry args={[BOOKLET.size, BOOKLET.size]} />
      </mesh>
    </animated.group>
  );
}

function Disc({ album, spinning, onClick, onPointer }: { album: Album; spinning: boolean; onClick?: (e: ThreeEvent<MouseEvent>) => void; onPointer(e: ThreeEvent<PointerEvent>, on: boolean): void }) {
  const spin = useRef<THREE.Group>(null);
  const speed = useRef(0);
  const label = artworkOf(album, 'medium')[0] ?? pickArtwork(album, 'front');
  const tex = useArtTexture(label?.url);
  const labelMat = useMemo(() => new THREE.MeshPhysicalMaterial({ map: tex, color: tex ? '#ffffff' : '#e8e8e8', roughness: 0.5, clearcoat: 0.4 }), [tex]);
  const dataMat = useMemo(() => discDataMaterial(), []);
  const edgeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.8, roughness: 0.3 }), []);
  const hubMat = useMemo(() => new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.35, roughness: 0.05, clearcoat: 1 }), []);

  // RF11: gira enquanto toca, com parada suave no pause. Velocidade decorativa fixa.
  useFrame((_, dt) => {
    const target = spinning ? 9 : 0;
    speed.current += (target - speed.current) * Math.min(1, dt * 2.5);
    if (spin.current) spin.current.rotation.z -= speed.current * dt;
  });

  return (
    <group ref={spin} name="disc" onClick={onClick} onPointerOver={(e) => onClick && onPointer(e, true)} onPointerOut={(e) => onPointer(e, false)}>
      <mesh material={labelMat} position={[0, 0, DISC.thickness / 2 + 0.01]}>
        <ringGeometry args={[DISC.labelInner, DISC.radius, 96, 1]} />
      </mesh>
      <mesh material={dataMat} position={[0, 0, -DISC.thickness / 2]} rotation-y={Math.PI}>
        <ringGeometry args={[DISC.hole, DISC.radius, 96, 1]} />
      </mesh>
      <mesh material={hubMat} position={[0, 0, DISC.thickness / 2]}>
        <ringGeometry args={[DISC.hole, DISC.labelInner, 64, 1]} />
      </mesh>
      <mesh material={edgeMat} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[DISC.radius, DISC.radius, DISC.thickness, 96, 1, true]} />
      </mesh>
    </group>
  );
}

/** Aparelho minimalista: prato redondo com pino, desenho próprio, sem imitar marca. */
function PlayerPlatter({ onClick, onPointer }: { onClick?: (e: ThreeEvent<MouseEvent>) => void; onPointer(e: ThreeEvent<PointerEvent>, on: boolean): void }) {
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: '#202226', roughness: 0.35, metalness: 0.6 }), []);
  const ring = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a9099', roughness: 0.25, metalness: 0.9 }), []);
  return (
    <group name="player" onClick={onClick} onPointerOver={(e) => onClick && onPointer(e, true)} onPointerOut={(e) => onPointer(e, false)}>
      <mesh rotation-x={Math.PI / 2} material={body}>
        <cylinderGeometry args={[70, 72, 6, 96]} />
      </mesh>
      <mesh position={[0, 0, 3.05]} material={ring}>
        <ringGeometry args={[66, 68, 96]} />
      </mesh>
      <mesh position={[0, 0, 4]} rotation-x={Math.PI / 2} material={ring}>
        <cylinderGeometry args={[7, 7, 3, 32]} />
      </mesh>
    </group>
  );
}

function Shrinkwrap({ progress, album, onClick, onPointer }: { progress: SpringValue<number>; album: Album; onClick?: (e: ThreeEvent<MouseEvent>) => void; onPointer(e: ThreeEvent<PointerEvent>, on: boolean): void }) {
  const wrapMat = useMemo(() => shrinkwrapMaterial(), []);
  const sticker = useMemo(() => textTexture(`${album.artist} · ${album.title}`.toUpperCase(), 512, 64), [album.artist, album.title]);
  const stickerMat = useMemo(() => new THREE.MeshStandardMaterial({ map: sticker, roughness: 0.4 }), [sticker]);
  const group = useRef<THREE.Group>(null);
  useEffect(() => () => sticker.dispose(), [sticker]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const p = progress.get();
    g.visible = p < 0.999;
    g.position.y = p * 160;
    g.position.z = p * 40;
    g.rotation.z = p * 0.5;
    wrapMat.opacity = 0.16 * (1 - p);
    stickerMat.opacity = 1 - p;
    stickerMat.transparent = p > 0;
  });

  return (
    <group ref={group} name="shrinkwrap" onClick={onClick} onPointerOver={(e) => onClick && onPointer(e, true)} onPointerOut={(e) => onPointer(e, false)}>
      <mesh material={wrapMat}>
        <boxGeometry args={[CASE.width + 1.2, CASE.height + 1.2, CASE.depth + 1.2]} />
      </mesh>
      {/* Adesivo do topo envolvendo a borda superior (frente, topo e trás). */}
      <group name="top_sticker" position={[20, CASE.height / 2 + 0.7, 0]}>
        <mesh position={[0, -7, HALF_D + 0.75]} material={stickerMat}>
          <planeGeometry args={[60, 14]} />
        </mesh>
        <mesh position={[0, 0.05, 0]} rotation-x={-Math.PI / 2} material={stickerMat}>
          <planeGeometry args={[60, CASE.depth + 1.4]} />
        </mesh>
        <mesh position={[0, -7, -HALF_D - 0.75]} rotation-y={Math.PI} material={stickerMat}>
          <planeGeometry args={[60, 14]} />
        </mesh>
      </group>
    </group>
  );
}
