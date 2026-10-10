/**
 * Spike S0 (descartável). Mede os três riscos do techspec e gera um JSON para o registro.
 * Sem React de propósito: isola o custo do three e do material.
 */
import { parseBlob } from 'music-metadata';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

type Results = Record<string, unknown>;
const results: Results = { userAgent: navigator.userAgent, date: new Date().toISOString() };

const $ = <T extends HTMLElement>(id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} ausente`);
  return el as T;
};

function render() {
  $('out').textContent = JSON.stringify(results, null, 2);
}

function status(id: string, text: string, ok?: boolean) {
  const el = $(id);
  el.textContent = text;
  el.className = ok === undefined ? '' : ok ? 'ok' : 'fail';
}

// ---------- 1. transmission vs opacity ----------

function gpuName(renderer: THREE.WebGLRenderer): string {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'desconhecida';
}

async function measure(mode: 'transmission' | 'opacity', seconds: number): Promise<number> {
  const canvas = $('gl') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  results.gpu = gpuName(renderer);
  results.dpr = Math.min(devicePixelRatio, 2);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.background = new THREE.Color('#2a2a2e');

  const camera = new THREE.PerspectiveCamera(35, canvas.clientWidth / canvas.clientHeight, 1, 2000);
  camera.position.set(0, 0, 340);

  // Caixa nas medidas reais (mm), com uma "capa" atrás para o material refratar algo.
  const coverTex = new THREE.CanvasTexture(makeStripes());
  coverTex.colorSpace = THREE.SRGBColorSpace;
  const cover = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ map: coverTex }));
  cover.position.z = -2;

  const material =
    mode === 'transmission'
      ? new THREE.MeshPhysicalMaterial({ transmission: 1, roughness: 0.05, ior: 1.59, thickness: 2, metalness: 0, clearcoat: 1 })
      : new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0, clearcoat: 1 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(142, 125, 10), material);
  const group = new THREE.Group();
  group.add(cover, box);
  scene.add(group);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (mode === 'transmission') {
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(canvas.clientWidth, canvas.clientHeight), 0.35, 0.4, 0.9));
  }

  let frames = 0;
  const start = performance.now();
  await new Promise<void>((done) => {
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      group.rotation.y = Math.sin(t) * 0.8;
      group.rotation.x = Math.cos(t * 0.7) * 0.25;
      composer.render();
      frames++;
      if (t < seconds) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  });
  const fps = frames / ((performance.now() - start) / 1000);
  composer.dispose();
  renderer.dispose();
  return Math.round(fps * 10) / 10;
}

function makeStripes(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = `hsl(${i * 22}, 70%, 55%)`;
    ctx.fillRect(0, i * 32, 512, 32);
  }
  return c;
}

$('run-fps').addEventListener('click', async () => {
  status('fps-status', 'Medindo transmission + bloom…');
  const transmission = await measure('transmission', 6);
  status('fps-status', 'Medindo opacity…');
  const opacity = await measure('opacity', 6);
  results.fps = { transmission, opacity };
  const decision =
    transmission >= 55 ? 'transmission no nível médio e alto' : transmission >= 30 ? 'transmission só no nível alto' : 'opacity em todos os níveis exceto alto';
  results.fpsDecision = decision;
  status('fps-status', `transmission: ${transmission} fps · opacity: ${opacity} fps → ${decision}`, transmission >= 30);
  render();
});

// ---------- 2. CORS ----------

async function loadTexture(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      url,
      (tex) => {
        // Upload real na GPU: sem CORS válido o WebGL lança SecurityError aqui.
        try {
          const r = new THREE.WebGLRenderer();
          r.initTexture(tex);
          r.dispose();
          resolve(true);
        } catch {
          resolve(false);
        }
      },
      undefined,
      () => resolve(false),
    );
  });
}

$('run-cors').addEventListener('click', async () => {
  status('cors-status', 'Testando…');
  const cors: Record<string, unknown> = {};
  let mbid: string | null = null;
  try {
    const res = await fetch('https://musicbrainz.org/ws/2/release/?query=release:Nevermind%20AND%20artist:Nirvana&fmt=json&limit=5');
    cors.musicbrainzFetch = res.ok;
    const data = (await res.json()) as { releases?: { id: string }[] };
    mbid = data.releases?.[0]?.id ?? null;
  } catch (e) {
    cors.musicbrainzFetch = false;
    cors.musicbrainzError = String(e);
  }
  if (!mbid) {
    results.cors = cors;
    status('cors-status', 'MusicBrainz não respondeu ao navegador; sem MBID para testar o CAA', false);
    render();
    return;
  }
  cors.mbid = mbid;
  try {
    const res = await fetch(`https://coverartarchive.org/release/${mbid}/`);
    cors.caaJsonFetch = res.ok || res.status === 404;
    cors.caaJsonStatus = res.status;
  } catch (e) {
    cors.caaJsonFetch = false;
    cors.caaJsonError = String(e);
  }
  cors.caaTexture = await loadTexture(`https://coverartarchive.org/release/${mbid}/front-250`);
  results.cors = cors;
  results.corsDecision = cors.caaTexture ? 'CAA direto; /api/img desligado' : 'usar /api/img como proxy';
  status('cors-status', `MB: ${String(cors.musicbrainzFetch)} · CAA JSON: ${String(cors.caaJsonFetch)} · textura: ${String(cors.caaTexture)}`, Boolean(cors.caaTexture));
  render();
});

// ---------- 3. music-metadata ----------

async function parseAll(files: File[]) {
  const out: Record<string, unknown>[] = [];
  for (const file of files) {
    try {
      const meta = await parseBlob(file);
      out.push({
        file: file.name,
        ok: true,
        title: meta.common.title,
        artist: meta.common.artist,
        album: meta.common.album,
        track: meta.common.track.no,
        pictures: meta.common.picture?.map((p) => ({ type: p.type, format: p.format, bytes: p.data.length })) ?? [],
        duration: meta.format.duration,
      });
    } catch (e) {
      out.push({ file: file.name, ok: false, error: String(e) });
    }
  }
  results.musicMetadata = out;
  const allOk = out.every((r) => r.ok === true);
  status('mm-status', allOk ? `OK em ${out.length} arquivo(s)` : 'Falhou em algum arquivo, ver JSON', allOk);
  render();
}

$('run-mm').addEventListener('click', async () => {
  const base = import.meta.env.BASE_URL;
  const names = ['demo/01-luz-de-tubo.mp3', 'spike/sample.flac'];
  const files: File[] = [];
  for (const name of names) {
    const res = await fetch(`${base}${name}`);
    files.push(new File([await res.blob()], name.split('/').pop() ?? name));
  }
  await parseAll(files);
});

$<HTMLInputElement>('mm-files').addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  if (input.files) void parseAll([...input.files]);
});

$('copy').addEventListener('click', () => void navigator.clipboard.writeText(JSON.stringify(results, null, 2)));
render();
