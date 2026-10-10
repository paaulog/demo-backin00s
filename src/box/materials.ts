import * as THREE from 'three';
import type { QualityLevel } from '../store/store';
import { crinkleNormal } from './textures';

/**
 * Materiais do techspec. `transmission` é o mais caro da cena: só no nível alto até a S0
 * medir GPU integrada; médio e baixo usam `opacity` simples.
 */
export function plasticMaterial(quality: QualityLevel, worn = false): THREE.Material {
  if (quality === 'high') {
    return new THREE.MeshPhysicalMaterial({
      transmission: 1,
      thickness: 1.2,
      // Índice de refração do poliestireno: valor de referência, não medido.
      ior: 1.59,
      roughness: worn ? 0.18 : 0.04,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: worn ? 0.3 : 0.05,
      color: worn ? new THREE.Color('#fff4d6') : new THREE.Color('#ffffff'),
      transparent: true,
      envMapIntensity: 1.2,
    });
  }
  return new THREE.MeshPhysicalMaterial({
    transparent: true,
    opacity: quality === 'medium' ? 0.22 : 0.18,
    roughness: 0.05,
    metalness: 0,
    clearcoat: quality === 'medium' ? 1 : 0,
    color: worn ? new THREE.Color('#fff4d6') : new THREE.Color('#ffffff'),
    depthWrite: false,
    envMapIntensity: 1.4,
  });
}

export function trayMaterial(variant: 'black' | 'clear' = 'black'): THREE.Material {
  return variant === 'black'
    ? new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.45, metalness: 0.05 })
    : new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.25, roughness: 0.1 });
}

/** Face de dados: metal espelhado com iridescência para o arco-íris. */
export function discDataMaterial(): THREE.Material {
  return new THREE.MeshPhysicalMaterial({
    color: '#d8dde6',
    metalness: 1,
    roughness: 0.12,
    iridescence: 1,
    iridescenceIOR: 1.8,
    iridescenceThicknessRange: [180, 620],
    envMapIntensity: 1.6,
    side: THREE.DoubleSide,
  });
}

export function paperMaterial(map: THREE.Texture | null, sheen = 0.25): THREE.Material {
  return new THREE.MeshPhysicalMaterial({
    map,
    color: map ? '#ffffff' : '#f2efe7',
    roughness: 0.55,
    metalness: 0,
    clearcoat: sheen,
    clearcoatRoughness: 0.6,
  });
}

export function shrinkwrapMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    transparent: true,
    opacity: 0.16,
    roughness: 0.15,
    metalness: 0,
    clearcoat: 1,
    normalMap: crinkleNormal(),
    normalScale: new THREE.Vector2(0.6, 0.6),
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
