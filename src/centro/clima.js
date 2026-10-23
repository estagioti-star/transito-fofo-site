// Spec 058 — o tempo no passeio em Chapecó (o mesmo do bairro, spec 029/035): ☀️ sol, 🌧️ chuva (céu cinza, pingos em
// volta da câmera, asfalto molhado, luz mais fraca) e 🌫️ neblina (vê pouco à frente). A regra (art. 220 VIII, reduzir a
// velocidade) é do fiscal; a aderência menor na chuva fica no carro (centro.js).
import * as THREE from '../../vendor/three.module.js';

export function aplicaClimaCentro(scene, { tempo = 'sol', hemi, sun, asfalto }) {
  const chove = tempo === 'chuva', neblina = tempo === 'neblina';
  if (chove) {
    scene.background.set('#9aa3b0'); scene.fog.color.set('#a8b0bb'); scene.fog.near = 40; scene.fog.far = 260;
    if (asfalto) asfalto.material.color.set(0x565c6b);                    // molhado: mais escuro
  } else if (neblina) {
    scene.background.set('#cdd3da'); scene.fog.color.set('#cdd3da'); scene.fog.near = 6; scene.fog.far = 80;
  }
  if (chove || neblina) { hemi.intensity = 1.5; sun.intensity = 0.8; }
  // pingos: 900 risquinhos que caem num cubo de 50 m em volta da câmera (1 draw call)
  const NP = 900, pos = new Float32Array(NP * 6), sem = [];
  for (let i = 0; i < NP; i++) sem.push([Math.random() * 50 - 25, Math.random() * 22, Math.random() * 50 - 25]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pingos = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xe6efff, transparent: true, opacity: 0.75, fog: false }));
  pingos.frustumCulled = false; pingos.visible = chove; pingos.renderOrder = 8; pingos.userData.dinamico = true; scene.add(pingos);
  function atualizar(dt, cam) {
    if (!chove) return;
    for (let i = 0; i < NP; i++) {
      const p = sem[i]; p[1] -= 19 * dt; if (p[1] < 0) { p[1] += 22; p[0] = Math.random() * 50 - 25; p[2] = Math.random() * 50 - 25; }
      const x = cam.x + p[0], z = cam.z + p[2], k = i * 6;
      pos[k] = x; pos[k + 1] = p[1]; pos[k + 2] = z; pos[k + 3] = x + 0.05; pos[k + 4] = p[1] + 0.7; pos[k + 5] = z;
    }
    g.attributes.position.needsUpdate = true;
  }
  return { tempo, atualizar };
}
