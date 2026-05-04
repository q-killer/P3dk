import * as T from 'three';

export const initScene = () => {
  const W = window;
  const r = new T.WebGLRenderer({ antialias: true, alpha: true });
  const c = new T.PerspectiveCamera(45, W.innerWidth / W.innerHeight, 0.1, 5000);
  const s = new T.Scene();
  const d = new T.DirectionalLight(0x00ffff, 1.8);
  
  r.setSize(W.innerWidth, W.innerHeight);
  r.setPixelRatio(Math.min(W.devicePixelRatio, 2));
  r.domElement.style.cssText = "position:fixed;inset:0;z-index:0;touch-action:none";
  document.body.appendChild(r.domElement);
  
  c.position.set(0, 60, 180);
  d.position.set(60, 120, 90);
  s.add(new T.AmbientLight(0xffffff, 0.6), d, new T.GridHelper(800, 80, 0xff1100, 0x660000));
  
  return { scene: s, camera: c, renderer: r };
};