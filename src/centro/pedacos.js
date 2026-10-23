// Spec 056 — o mapa grande de Chapecó (3 × 3 km) em PEDAÇOS: depois que o mundo está montado, cada malha grande e
// parada (chão, ruas, prédios, pintura, árvores, estacionados...) é cortada em quadrados de `tam` metros. Só os
// pedaços perto da câmera ficam visíveis (a neblina do Centro some com tudo depois de 650 m, então nada "pisca").
// Malhas que mudam por índice (luz do semáforo, carros andando) ficam fora: marcadas com userData.dinamico.
import * as THREE from '../../vendor/three.module.js';

export function dividirEmPedacos(scene, { tam = 400, alcance = 700, minTri = 3000, minInst = 150 } = {}) {
  const ck = (x, z) => Math.floor(x / tam) + ':' + Math.floor(z / tam);
  const pedacos = new Map();                          // chave → { cx, cz, objs: [] }
  const guarda = (k, o) => {
    if (!pedacos.has(k)) { const [i, j] = k.split(':').map(Number); pedacos.set(k, { x0: i * tam, z0: j * tam, objs: [] }); }
    pedacos.get(k).objs.push(o);
  };
  const alvos = [];
  scene.traverse(o => { if (o.isMesh && !o.userData.dinamico && o.parent === scene) alvos.push(o); });
  let cortadas = 0;
  for (const o of alvos) {
    const g = o.geometry;
    if (o.isInstancedMesh) {
      if (o.count < minInst) continue;
      const grupos = new Map(), m = new THREE.Matrix4(), p = new THREE.Vector3();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m); p.setFromMatrixPosition(m);
        const k = ck(p.x, p.z); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(i);
      }
      const c = new THREE.Color();
      for (const [k, ids] of grupos) {
        const im = new THREE.InstancedMesh(g, o.material, ids.length);
        ids.forEach((i, n) => { o.getMatrixAt(i, m); im.setMatrixAt(n, m); if (o.instanceColor) { o.getColorAt(i, c); im.setColorAt(n, c); } });
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere(); im.renderOrder = o.renderOrder; im.frustumCulled = true;
        scene.add(im); guarda(k, im);
      }
    } else {
      const gi = g.index ? g.toNonIndexed() : g, pos = gi.attributes.position, nTri = pos.count / 3;
      if (nTri < minTri) continue;
      const grupos = new Map();
      for (let t = 0; t < nTri; t++) {
        const a = t * 3, x = (pos.getX(a) + pos.getX(a + 1) + pos.getX(a + 2)) / 3, z = (pos.getZ(a) + pos.getZ(a + 1) + pos.getZ(a + 2)) / 3;
        const k = ck(x, z); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(t);
      }
      const nomes = Object.keys(gi.attributes);
      for (const [k, tris] of grupos) {
        const ng = new THREE.BufferGeometry();
        for (const nm of nomes) {
          const at = gi.attributes[nm], is = at.itemSize, src = at.array, dst = new src.constructor(tris.length * 3 * is);
          tris.forEach((t, n) => dst.set(src.subarray(t * 3 * is, (t + 1) * 3 * is), n * 3 * is));
          ng.setAttribute(nm, new THREE.BufferAttribute(dst, is, at.normalized));
        }
        ng.computeBoundingSphere();
        const nm = new THREE.Mesh(ng, o.material); nm.renderOrder = o.renderOrder; nm.position.copy(o.position);
        scene.add(nm); guarda(k, nm);
      }
      if (gi !== g) gi.dispose();
    }
    scene.remove(o); if (!o.isInstancedMesh) g.dispose();
    cortadas++;
  }
  const lista = [...pedacos.values()];
  let ultimo = null;
  function atualizar(cam) {                            // liga só o que está a até `alcance` da câmera
    const x = cam.position.x, z = cam.position.z;
    if (ultimo && Math.hypot(x - ultimo.x, z - ultimo.z) < 20) return;
    ultimo = { x, z };
    for (const p of lista) {
      const dx = Math.max(p.x0 - x, 0, x - (p.x0 + tam)), dz = Math.max(p.z0 - z, 0, z - (p.z0 + tam));
      const ver = Math.hypot(dx, dz) < alcance;
      for (const o of p.objs) o.visible = ver;
    }
  }
  return { atualizar, nPedacos: lista.length, nObjetos: lista.reduce((s, p) => s + p.objs.length, 0), cortadas };
}
