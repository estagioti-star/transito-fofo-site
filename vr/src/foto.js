// Spec 051 — a "foto do radar": quando o radar pega o carro acima do limite, renderiza a cena do ponto de vista do
// radar (no alto do poste, olhando o carro) e devolve a imagem (dataURL). Usa o mesmo renderer do jogo: desenha com a
// câmera do radar, lê o canvas na hora (antes do navegador mostrar o quadro) e o jogo volta a desenhar com a câmera dele.
import * as THREE from '../vendor/three.module.js';

const camRadar = new THREE.PerspectiveCamera(32, 4 / 3, 0.4, 400);

// de = { x, y, z } (a lente do radar); para = { x, z } (o carro)
export function fotoDoRadar(renderer, scene, de, para) {
  try {
    const tam = new THREE.Vector2(); renderer.getSize(tam);
    camRadar.aspect = tam.x / Math.max(1, tam.y); camRadar.updateProjectionMatrix();
    camRadar.position.set(de.x, de.y, de.z); camRadar.lookAt(para.x, 0.9, para.z); camRadar.updateMatrixWorld();
    renderer.render(scene, camRadar);
    // recorta o meio do quadro em 4:3 e reduz (a foto fica pequena no cartão)
    const src = renderer.domElement, c = document.createElement('canvas'); c.width = 320; c.height = 240;
    const w = src.width, h = src.height, rw = Math.min(w, h * 4 / 3), rh = rw * 3 / 4;
    c.getContext('2d').drawImage(src, (w - rw) / 2, (h - rh) / 2, rw, rh, 0, 0, 320, 240);
    return c.toDataURL('image/jpeg', 0.75);
  } catch (e) { return null; }
}

// texto de data/hora do jeito do auto de infração
export const quandoAgora = () => {
  const d = new Date(), z = n => String(n).padStart(2, '0');
  return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
};
