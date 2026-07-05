/**
 * Lazy 3D product viewer. This module is only imported (dynamically) on
 * PDPs whose product ships a model — three.js never loads anywhere else.
 * Soft studio lighting matched to the bone palette; gentle auto-rotate
 * until first interaction; pinch/drag on touch via OrbitControls.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { reducedMotion } from '../lib/dom';

export async function mountViewer(
  host: HTMLElement,
  modelUrl: string,
  opts: { hint?: string } = {},
): Promise<() => void> {
  const gltf = await new GLTFLoader().loadAsync(modelUrl);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#F7F3EC');

  // Soft studio lighting in the bone palette.
  scene.add(new THREE.HemisphereLight('#FBF7EF', '#CFC6B5', 1.15));
  const key = new THREE.DirectionalLight('#FFF9EC', 1.6);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#E8EDE4', 0.5);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  const model = gltf.scene;
  scene.add(model);

  // Frame the model.
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  const radius = Math.max(size.x, size.y, size.z);

  const width = host.clientWidth || 480;
  const height = host.clientHeight || 600;
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.01, 100);
  camera.position.set(radius * 1.4, radius * 0.7, radius * 2.1);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  host.innerHTML = '';
  host.appendChild(renderer.domElement);
  if (opts.hint) {
    const hint = document.createElement('span');
    hint.className = 'viewer-hint';
    hint.textContent = opts.hint;
    host.appendChild(hint);
  }

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = radius * 1.1;
  controls.maxDistance = radius * 4;
  controls.enablePan = false;

  // Gentle auto-rotate until first interaction; disabled for reduced motion.
  controls.autoRotate = !reducedMotion();
  controls.autoRotateSpeed = 0.9;
  const stopAutoRotate = () => {
    controls.autoRotate = false;
  };
  renderer.domElement.addEventListener('pointerdown', stopAutoRotate, { once: true });

  let disposed = false;
  function frame(): void {
    if (disposed) return;
    requestAnimationFrame(frame);
    controls.update();
    renderer.render(scene, camera);
  }
  frame();

  const onResize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  return () => {
    disposed = true;
    window.removeEventListener('resize', onResize);
    controls.dispose();
    renderer.dispose();
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
    renderer.domElement.remove();
  };
}
