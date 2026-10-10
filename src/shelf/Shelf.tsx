import { animated, useSpring } from '@react-spring/three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useSelector } from '@xstate/react';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { boxActor, pullAlbum } from '../box/boxActor';
import { CASE } from '../box/dimensions';
import { useReducedMotion } from '../scene/useReducedMotion';
import { useApp } from '../store/store';
import { SpineAtlas } from './atlas';
import { atlasCell, ROWS_PER_COLUMN, shelfSlots, SLOT_HEIGHT, sortAlbums } from './layout';

const MAX_INSTANCES = 292;
const tmp = new THREE.Object3D();

/** Material com UV por instância (atributo `spineUv`), para ler a célula certa do atlas. */
function spineMaterial(map: THREE.Texture): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.5, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 spineUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv = spineUv.xy + uv * spineUv.zw;\n#endif');
  };
  return mat;
}

/**
 * Torre de CDs com lombadas para fora (RF12). Um InstancedMesh para os corpos e outro
 * para as lombadas com atlas; só a caixa puxada vira o modelo completo (RF14).
 */
export function Shelf() {
  const albums = useApp((s) => s.albums);
  const sort = useApp((s) => s.shelfSort);
  const focusId = useApp((s) => s.shelfFocus);
  const themeShelf = useApp((s) => s.theme.shelf);
  const pulledId = useSelector(boxActor, (s) => ((s.value as { case: string }).case === 'shelf' ? null : s.context.albumId));
  const reduced = useReducedMotion();

  const atlas = useMemo(() => new SpineAtlas(), []);
  useEffect(() => () => atlas.dispose(), [atlas]);
  useEffect(() => {
    void atlas.update(albums);
  }, [albums, atlas]);

  const bodies = useRef<THREE.InstancedMesh>(null);
  const spines = useRef<THREE.InstancedMesh>(null);
  const ordered = useMemo(() => sortAlbums(albums, sort), [albums, sort]);
  const slots = useMemo(() => shelfSlots(ordered), [ordered]);
  const atlasIndex = useMemo(() => new Map(albums.map((a, i) => [a.id, i])), [albums]);
  const current = useRef(new Map<string, THREE.Vector3>());

  const bodyMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#d9dde2', roughness: 0.15, transparent: true, opacity: 0.55, clearcoat: 1 }), []);
  const spineMat = useMemo(() => spineMaterial(atlas.texture), [atlas]);
  const spineGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(118, 6.5);
    g.setAttribute('spineUv', new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES * 4), 4));
    return g;
  }, []);
  const woodMat = useMemo(() => new THREE.MeshStandardMaterial({ color: themeShelf.color, roughness: themeShelf.roughness, metalness: themeShelf.metalness }), [themeShelf]);

  // Atualiza a UV de cada instância quando a ordem ou a coleção muda.
  useEffect(() => {
    const attr = spineGeo.getAttribute('spineUv') as THREE.InstancedBufferAttribute;
    slots.forEach((slot, i) => {
      const cell = atlasCell(atlasIndex.get(slot.albumId) ?? 0);
      attr.setXYZW(i, cell.u0, cell.v0, cell.du, cell.dv);
    });
    attr.needsUpdate = true;
  }, [slots, atlasIndex, spineGeo]);

  // Anima cada instância até a posição da ordem atual (RF13).
  useFrame((_, dt) => {
    const b = bodies.current;
    const s = spines.current;
    if (!b || !s) return;
    const k = reduced ? 1 : Math.min(1, dt * 6);
    slots.forEach((slot, i) => {
      let pos = current.current.get(slot.albumId);
      if (!pos) {
        pos = new THREE.Vector3(slot.x, slot.y, 0);
        current.current.set(slot.albumId, pos);
      }
      pos.x += (slot.x - pos.x) * k;
      pos.y += (slot.y - pos.y) * k;
      const pulled = slot.albumId === pulledId;
      const focused = slot.albumId === focusId;
      // A caixa puxada some da torre; a focada pelo teclado sai um pouco para fora.
      const targetZ = focused ? 14 : 0;
      pos.z += (targetZ - pos.z) * k;
      const scale = pulled ? 0.0001 : 1;
      tmp.position.set(pos.x, pos.y, pos.z);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.setScalar(scale);
      tmp.updateMatrix();
      b.setMatrixAt(i, tmp.matrix);
      tmp.position.z = pos.z + CASE.width / 2 + 0.05;
      tmp.updateMatrix();
      s.setMatrixAt(i, tmp.matrix);
    });
    b.count = s.count = slots.length;
    b.instanceMatrix.needsUpdate = true;
    s.instanceMatrix.needsUpdate = true;
  });

  // Foco: estante em primeiro plano quando não há caixa puxada; ao puxar, recua para o fundo.
  const { focus } = useSpring({ focus: pulledId ? 0 : 1, config: { tension: 80, friction: 20 }, immediate: reduced });
  const columns = Math.max(1, Math.ceil(ordered.length / ROWS_PER_COLUMN));
  const towerH = ROWS_PER_COLUMN * SLOT_HEIGHT + 8;

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const slot = e.instanceId !== undefined ? slots[e.instanceId] : undefined;
    if (slot) void pullAlbum(slot.albumId);
  };

  if (!albums.length) return null;

  return (
    <animated.group
      name="shelf"
      position-x={focus.to((f) => -300 + f * 300)}
      position-z={focus.to((f) => -420 + f * 420)}
      rotation-y={focus.to((f) => 0.5 * (1 - f) - 0.25 * f)}
    >
      {Array.from({ length: columns }, (_, c) => {
        const x = (c - (columns - 1) / 2) * 138;
        return (
          <group key={c} position={[x, 0, -2]}>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 66, 0, 0]} material={woodMat}>
                <boxGeometry args={[6, towerH + 12, CASE.width + 6]} />
              </mesh>
            ))}
            {[-1, 1].map((side) => (
              <mesh key={`h${side}`} position={[0, side * (towerH / 2 + 3), 0]} material={woodMat}>
                <boxGeometry args={[138, 6, CASE.width + 6]} />
              </mesh>
            ))}
          </group>
        );
      })}
      <instancedMesh ref={bodies} args={[undefined, undefined, MAX_INSTANCES]} material={bodyMat} onClick={onClick}>
        <boxGeometry args={[CASE.height, CASE.depth, CASE.width]} />
      </instancedMesh>
      <instancedMesh
        ref={spines}
        args={[spineGeo, spineMat, MAX_INSTANCES]}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      />
    </animated.group>
  );
}
