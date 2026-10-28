// O bairro em 3D: chão, ruas, faixas pintadas, placas desenhadas em canvas, semáforos, casas, árvores.
// Só desenha: toda a informação vem de BAIRRO (src/bairro.js). InstancedMesh para tudo que se repete.
import * as THREE from '../vendor/three.module.js';
import { faseSemaforo, naPistaEstrada } from './bairro.js';

export function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
export function poe(im, i, x, y, z, sx, sy, sz, ry = 0) {
  _e.set(0, ry, 0); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
  im.setMatrixAt(i, _m.compose(_p, _q, _s));
}
// caixas instanciadas: lista de { x, y, z, sx, sy, sz, ry, cor? } (y = centro)
function caixas(scene, lista, mat, geo = new THREE.BoxGeometry(1, 1, 1)) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, lista.length));
  lista.forEach((b, i) => { poe(im, i, b.x, b.y, b.z, b.sx, b.sy, b.sz, b.ry || 0); if (b.cor !== undefined) im.setColorAt(i, _c.set(b.cor)); });
  im.count = lista.length;
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  scene.add(im);
  return im;
}

// ---------------------------------------------------------------------------------------------------------------
// Placas no padrão brasileiro, desenhadas em canvas. `sil` = só a silhueta cinza (verso da placa).
// ---------------------------------------------------------------------------------------------------------------
export function octogono(g, cx, cy, r) {
  g.beginPath();
  for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + (k * Math.PI) / 4; g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  g.closePath();
}
function placaVel(g, cx, cy, r, v, sil) {        // R-19: círculo branco, aro vermelho, número preto
  g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = sil ? '#9aa0aa' : '#e8262f'; g.fill();
  if (sil) return;
  g.beginPath(); g.arc(cx, cy, r * 0.78, 0, 7); g.fillStyle = '#fff'; g.fill();
  g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${r * 0.95}px Arial Black, Arial`; g.fillText(String(v), cx, cy - r * 0.04);
  g.font = `bold ${r * 0.22}px Arial`; g.fillText('km/h', cx, cy + r * 0.52);
}
export function desenhaRadar(g, w, h, sil, v) {   // R-19 + placa "fiscalização eletrônica"
    placaVel(g, w / 2, 112, 106, v, sil);
    const rr = (x, y, ww, hh, r) => { g.beginPath(); g.roundRect(x, y, ww, hh, r); };
    rr(10, 226, w - 20, 150, 16); g.fillStyle = sil ? '#9aa0aa' : '#111'; g.fill();
    if (sil) return;
    rr(18, 234, w - 36, 134, 10); g.fillStyle = '#fff'; g.fill();
    // câmera
    g.fillStyle = '#111'; rr(92, 246, 56, 34, 6); g.fill(); g.beginPath(); g.arc(120, 263, 11, 0, 7); g.fillStyle = '#fff'; g.fill();
    g.fillStyle = '#111'; g.fillRect(148, 254, 14, 18);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 26px Arial'; g.fillText('FISCALIZAÇÃO', w / 2, 310);
    g.fillText('ELETRÔNICA', w / 2, 343);
}
const DESENHO = {
  pare: [256, 256, (g, w, h, sil) => {           // R-1: octógono vermelho, borda branca, PARE em branco
    octogono(g, w / 2, h / 2, w / 2 - 4); g.fillStyle = sil ? '#9aa0aa' : '#fff'; g.fill();
    if (sil) return;
    octogono(g, w / 2, h / 2, w / 2 - 18); g.fillStyle = '#e3121b'; g.fill();
    g.fillStyle = '#fff'; g.font = '900 78px Arial Black, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('PARE', w / 2, h / 2 + 4);
  }],
  vel30: [256, 256, (g, w, h, sil) => placaVel(g, w / 2, h / 2, w / 2 - 4, 30, sil)],
  vel40: [256, 256, (g, w, h, sil) => placaVel(g, w / 2, h / 2, w / 2 - 4, 40, sil)],
  vel60: [256, 256, (g, w, h, sil) => placaVel(g, w / 2, h / 2, w / 2 - 4, 60, sil)],
  escola: [256, 256, (g, w, h, sil) => {         // A-33b: losango amarelo, borda preta, duas crianças andando
    const losango = (m) => { g.beginPath(); g.moveTo(w / 2, m); g.lineTo(w - m, h / 2); g.lineTo(w / 2, h - m); g.lineTo(m, h / 2); g.closePath(); };
    losango(4); g.fillStyle = sil ? '#9aa0aa' : '#111'; g.fill();
    if (sil) return;
    losango(16); g.fillStyle = '#ffd400'; g.fill();
    g.fillStyle = '#111'; g.strokeStyle = '#111'; g.lineCap = 'round';
    const crianca = (x, y, s) => {
      g.beginPath(); g.arc(x, y - 34 * s, 9 * s, 0, 7); g.fill();
      g.lineWidth = 11 * s; g.beginPath(); g.moveTo(x, y - 22 * s); g.lineTo(x, y + 8 * s); g.stroke();
      g.lineWidth = 7 * s; g.beginPath(); g.moveTo(x, y + 6 * s); g.lineTo(x - 12 * s, y + 34 * s); g.moveTo(x, y + 6 * s); g.lineTo(x + 12 * s, y + 34 * s);
      g.moveTo(x, y - 16 * s); g.lineTo(x - 14 * s, y + 2 * s); g.moveTo(x, y - 16 * s); g.lineTo(x + 14 * s, y); g.stroke();
    };
    crianca(108, 132, 1.15); crianca(150, 140, 0.95);
    g.lineWidth = 6; g.beginPath(); g.moveTo(122, 128); g.lineTo(136, 126); g.stroke();   // de mãos dadas
    g.fillRect(78, 182, 100, 7);
  }],
  radar: [256, 384, (g, w, h, sil) => desenhaRadar(g, w, h, sil, 60)],
  radar80: [256, 384, (g, w, h, sil) => desenhaRadar(g, w, h, sil, 80)],     // spec 040
  radar40: [256, 384, (g, w, h, sil) => desenhaRadar(g, w, h, sil, 40)],     // spec 041 (radares do site)
  radar30: [256, 384, (g, w, h, sil) => desenhaRadar(g, w, h, sil, 30)],
  vel80: [256, 256, (g, w, h, sil) => placaVel(g, w / 2, h / 2, w / 2 - 4, 80, sil)],
  // spec 040: R-7 "proibido ultrapassar": círculo branco com aro vermelho, carro preto e carro vermelho, tarja vermelha
  nao_ultrapasse: [256, 256, (g, w, h, sil) => {
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, 7); g.fillStyle = sil ? '#9aa0aa' : '#e8262f'; g.fill();
    if (sil) return;
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 30, 0, 7); g.fillStyle = '#fff'; g.fill();
    const carro = (x, cor) => { g.fillStyle = cor; g.beginPath(); g.roundRect(x - 26, 82, 52, 96, 14); g.fill(); g.fillStyle = '#fff'; g.fillRect(x - 17, 100, 34, 18); g.fillRect(x - 17, 146, 34, 14); };
    carro(w / 2 - 34, '#111'); carro(w / 2 + 34, '#e8262f');
    g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 4); g.fillStyle = '#e8262f'; g.fillRect(-(w / 2 - 30), -11, w - 60, 22); g.restore();
  }],
  rotula: [256, 256, (g, w, h, sil) => {         // R-33 sentido circular obrigatório: azul com setas brancas
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, 7); g.fillStyle = sil ? '#9aa0aa' : '#1e63d6'; g.fill();
    if (sil) return;
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 14, 0, 7); g.strokeStyle = '#fff'; g.lineWidth = 6; g.stroke();
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 18;
    for (let k = 0; k < 3; k++) {                // anti-horário
      const a0 = k * 2 * Math.PI / 3 + 0.25, a1 = a0 + 1.45, r = 64;
      g.beginPath(); g.arc(w / 2, h / 2, r, -a0, -a1, true); g.stroke();
      const ax = w / 2 + r * Math.cos(-a1), ay = h / 2 + r * Math.sin(-a1), tx = Math.sin(-a1), ty = -Math.cos(-a1);
      g.beginPath(); g.moveTo(ax + tx * 26, ay + ty * 26); g.lineTo(ax - ty * 20, ay + tx * 20); g.lineTo(ax + ty * 20, ay - tx * 20); g.closePath(); g.fill();
    }
  }],
  // spec 034: R-3 "sentido proibido" (círculo vermelho, faixa branca), R-24a "sentido de circulação" e "E" estacionamento
  proibido: [256, 256, (g, w, h, sil) => {
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, 7); g.fillStyle = sil ? '#9aa0aa' : '#e3121b'; g.fill();
    if (sil) return;
    g.fillStyle = '#fff'; g.fillRect(40, h / 2 - 26, w - 80, 52);
  }],
  mao_unica: [384, 192, (g, w, h, sil) => {
    g.fillStyle = sil ? '#9aa0aa' : '#111'; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 14); g.fill();
    if (sil) return;
    g.fillStyle = '#fff'; g.beginPath(); g.roundRect(14, 14, w - 28, h - 28, 8); g.fill();
    g.fillStyle = '#111'; g.fillRect(50, h / 2 - 16, w - 150, 32);
    g.beginPath(); g.moveTo(w - 100, h / 2 - 50); g.lineTo(w - 44, h / 2); g.lineTo(w - 100, h / 2 + 50); g.closePath(); g.fill();
  }],
  estacionamento: [256, 256, (g, w, h, sil) => {
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, 7); g.fillStyle = sil ? '#9aa0aa' : '#1e63d6'; g.fill();
    if (sil) return;
    g.fillStyle = '#fff'; g.font = '900 150px Arial Black, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('E', w / 2, h / 2 + 8);
  }],
};
// spec 006: placas e semáforos ~1,8× maiores que o real, de propósito (ver de longe no celular)
const SINAL = 1.8;
const LAMPADA_D = 0.38 * SINAL;     // diâmetro da lâmpada do semáforo (m), usado pelo miolo do halo
const TAMANHO = { pare: [1.35, 1.35], vel30: [1.25, 1.25], vel40: [1.25, 1.25], vel60: [1.25, 1.25], vel80: [1.25, 1.25], radar80: [1.25, 1.875], radar40: [1.25, 1.875], radar30: [1.25, 1.875], nao_ultrapasse: [1.25, 1.25], escola: [1.5, 1.5], radar: [1.25, 1.875], rotula: [1.25, 1.25], proibido: [1.25, 1.25], mao_unica: [1.4, 0.7], estacionamento: [1.1, 1.1] };

export function criarMundo(scene, B) {
  const lambert = (o) => new THREE.MeshLambertMaterial(o);
  let ceuCores = null;
  const R = B.rotula, LIM = B.limites;

  // --- céu e chão ---------------------------------------------------------------------------------------------
  // céu: domo com degradê nas cores dos vértices, desenhado POR ÚLTIMO (renderOrder alto): só pinta o pixel que
  // sobrou. Fundo em textura cobria a tela inteira antes de tudo e custava ~35% do quadro no celular fraco.
  scene.background = new THREE.Color(0xa9dcff);
  {
    const geo = new THREE.SphereGeometry(900, 24, 12), pos = geo.attributes.position, cor = [];
    const c0 = new THREE.Color('#5ab8ff'), c1 = new THREE.Color('#a9dcff'), c2 = new THREE.Color('#fff1f8'), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 900;                       // 1 = zênite, 0 = horizonte
      if (y > 0.25) tmp.copy(c1).lerp(c0, Math.min(1, (y - 0.25) / 0.75)); else tmp.copy(c2).lerp(c1, Math.max(0, (y + 0.05) / 0.3));
      cor.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
    // spec 021 (noite): o mesmo domo com o degradê da noite (troca só o atributo de cor)
    const n0 = new THREE.Color('#070b26'), n1 = new THREE.Color('#141c48'), n2 = new THREE.Color('#3a2f5e'), corNoite = [];
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 900;
      if (y > 0.25) tmp.copy(n1).lerp(n0, Math.min(1, (y - 0.25) / 0.75)); else tmp.copy(n2).lerp(n1, Math.max(0, (y + 0.05) / 0.3));
      corNoite.push(tmp.r, tmp.g, tmp.b);
    }
    ceuCores = { dia: new THREE.Float32BufferAttribute(cor, 3), noite: new THREE.Float32BufferAttribute(corNoite, 3), geo };
    const ceu = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    ceu.renderOrder = 10; ceu.frustumCulled = false;
    ceu.position.set((LIM.x0 + LIM.x1) / 2, 0, (LIM.z0 + LIM.z1) / 2);   // raio 900 < far 1200 de qualquer ponto do bairro
    scene.add(ceu);
  }
  scene.fog = new THREE.Fog(0xd8eeff, 160, 520);
  const cx = (LIM.x0 + LIM.x1) / 2, cz = (LIM.z0 + LIM.z1) / 2;
  const texGrama = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#86d65e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { g.fillStyle = Math.random() < 0.5 ? '#78c953' : '#97e06c'; g.fillRect(Math.random() * w, Math.random() * h, 2, 3); }
  });
  texGrama.repeat.set(120, 120);
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000, 40, 40), lambert({ map: texGrama }));
  chao.rotation.x = -Math.PI / 2; chao.position.set(cx, -0.03, cz); chao.renderOrder = 6; scene.add(chao);   // planões por último: só pintam o que sobrou

  const texAsfalto = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#626879'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { const v = 85 + Math.random() * 40 | 0; g.fillStyle = `rgb(${v},${v + 4},${v + 18})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  });
  const W = LIM.x1 - LIM.x0, D = LIM.z1 - LIM.z0;
  texAsfalto.repeat.set(W / 8, D / 8);
  const asf = new THREE.Mesh(new THREE.PlaneGeometry(W, D, 30, 18), lambert({ map: texAsfalto }));
  asf.rotation.x = -Math.PI / 2; asf.position.set(cx, 0, cz); asf.renderOrder = 5; scene.add(asf);

  // --- spec 040: estrada de 80, rio com 2 pontes, defensas, sítio do trator e a barraca de frutas ----------------------
  function estradaERio() {
    const E = B.estrada, RIO = E.rio, estr = B.ruas.filter(r => r.estrada);
    // asfalto de cada perna (passa meia largura das pontas para fechar as quinas)
    for (const r of estr) {
      const [[ax, az], [bx, bz]] = r.pontos, L = Math.hypot(bx - ax, bz - az) + r.largura, h = Math.atan2(bx - ax, bz - az);
      const t = texAsfalto.clone(); t.needsUpdate = true; t.repeat.set(r.largura / 8, L / 8);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(r.largura, L).rotateX(-Math.PI / 2), lambert({ map: t }));
      m.rotation.y = h; m.position.set((ax + bx) / 2, 0, (az + bz) / 2); m.renderOrder = 5; scene.add(m);
    }
    // rio (passa por baixo das duas pernas) + margens de areia
    const zr0 = LIM.z0 - 320, zr1 = LIM.z1 + 320, rioM = new THREE.Mesh(new THREE.PlaneGeometry(RIO.x1 - RIO.x0, zr1 - zr0).rotateX(-Math.PI / 2), lambert({ color: 0x4aa8e0 }));
    rioM.position.set((RIO.x0 + RIO.x1) / 2, -0.012, (zr0 + zr1) / 2); scene.add(rioM);
    for (const x of [RIO.x0 - 1.5, RIO.x1 + 1.5]) {
      const mg = new THREE.Mesh(new THREE.PlaneGeometry(3, zr1 - zr0).rotateX(-Math.PI / 2), lambert({ color: 0xe6d29a }));
      mg.position.set(x, -0.018, (zr0 + zr1) / 2); scene.add(mg);
    }
    // pontes: tabuleiro de concreto um pouco mais largo, mureta dos dois lados, vigas e pilares dentro d'água
    const concreto = [], pilares = [];
    for (const p of B.pontes) {
      const zc = (p.z0 + p.z1) / 2, w = p.z1 - p.z0, L = p.x1 - p.x0, xc = (p.x0 + p.x1) / 2;
      concreto.push({ x: xc, y: -0.004, z: zc, sx: L, sy: 0.01, sz: w + 1.6 });
      for (const zz of [p.z0 - 0.55, p.z1 + 0.55]) {
        concreto.push({ x: xc, y: 0.55, z: zz, sx: L, sy: 1.1, sz: 0.4 });                          // mureta
        concreto.push({ x: xc, y: 1.15, z: zz, sx: L + 0.2, sy: 0.12, sz: 0.55, cor: '#ffd23f' });    // corrimão amarelo
      }
      for (const x of [RIO.x0 + 7, (RIO.x0 + RIO.x1) / 2, RIO.x1 - 7]) for (const zz of [p.z0 + 1, p.z1 - 1]) pilares.push({ x, y: -0.3, z: zz, sx: 1.2, sy: 0.6, sz: 1.2 });
    }
    caixas(scene, concreto.map(c => ({ cor: '#d9d6cf', ...c })), lambert({ color: 0xffffff }));
    caixas(scene, pilares, lambert({ color: 0xb8b4ab }), new THREE.CylinderGeometry(0.5, 0.5, 1, 10));
    // defensas metálicas nas beiras (menos nas pontes, perto do bairro e na entrada do sítio)
    const postesD = [], laminas = [];
    const livre = (x, z) => B.pontes.some(p => x > p.x0 - 1 && x < p.x1 + 1 && Math.abs(z - (p.z0 + p.z1) / 2) < 9) || x < 392
      || (x > 543 && x < 554 && z > 172);
    for (const r of estr) {
      const [[ax, az], [bx, bz]] = r.pontos, L = Math.hypot(bx - ax, bz - az), h = Math.atan2(bx - ax, bz - az);
      const fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
      for (const lado of [-1, 1]) for (let d = r.largura / 2; d < L - r.largura / 2; d += 4) {
        const x = ax + fx * d + rx * lado * (r.largura / 2 + 0.6), z = az + fz * d + rz * lado * (r.largura / 2 + 0.6);
        // spec 052: nem dentro da pista de outra perna da estrada (na quina a defensa atravessava a pista)
        if (livre(x, z) || estr.some(o => o !== r && (naPistaEstrada(o, x, z, 1.5) || naPistaEstrada(o, x + fx * 4, z + fz * 4, 1.5)))) continue;   // (o poste e a ponta da lâmina)
        postesD.push({ x, y: 0.4, z, sx: 0.12, sy: 0.8, sz: 0.12 });
        laminas.push({ x: x + fx * 2, y: 0.62, z: z + fz * 2, sx: 0.06, sy: 0.3, sz: 4, ry: h });
      }
    }
    caixas(scene, postesD, lambert({ color: 0x8a909c }));
    caixas(scene, laminas, lambert({ color: 0xc9ced8 }));
    // sítio: estradinha de terra até o celeiro, plantação em fileiras e cerca
    const terra = new THREE.Mesh(new THREE.PlaneGeometry(5, 12).rotateX(-Math.PI / 2), lambert({ color: 0xc79a62 }));
    terra.position.set(548.5, 0.005, 181); scene.add(terra);
    const fileiras = [];
    for (let k = 0; k < 14; k++) fileiras.push({ x: 600 - k * 2.4 + 2, y: 0.25, z: 196, sx: 1.1, sy: 0.5, sz: 26, cor: k % 2 ? '#5fae3a' : '#79c04a' });
    for (let k = 0; k < 14; k++) fileiras.push({ x: 432 + k * 2.4, y: 0.25, z: 196, sx: 1.1, sy: 0.5, sz: 26, cor: k % 3 ? '#e8c34a' : '#d6b23a' });   // milho
    caixas(scene, fileiras, lambert({ color: 0xffffff }));
    const cerca = [];
    for (let x = 520; x < 612; x += 3) if (x < 545 || x > 553) cerca.push({ x, y: 0.5, z: 179.5, sx: 0.14, sy: 1.0, sz: 0.14 });
    caixas(scene, cerca, lambert({ color: 0xb98a5a }));
    caixas(scene, [{ x: 566, y: 0.7, z: 179.5, sx: 92, sy: 0.1, sz: 0.08 }, { x: 566, y: 0.35, z: 179.5, sx: 92, sy: 0.1, sz: 0.08 }], lambert({ color: 0xb98a5a }));
  }

  // --- calçadas e gramados dos quarteirões ------------------------------------------------------------------------
  const calc = B.predios.filter(p => p.tipo === 'calcada');
  const matCalcada = lambert({ color: 0xf1e6d2 });
  caixas(scene, calc.map(p => ({ x: (p.x0 + p.x1) / 2, y: 0.1, z: (p.z0 + p.z1) / 2, sx: p.x1 - p.x0, sy: 0.2, sz: p.z1 - p.z0 })), matCalcada);
  // calçada em volta do mapa (lado de fora das ruas da beirada)
  const CW = 4;
  if (B.anel) {                                    // spec 043: o anel já vem recortado (garagem, estrada e baias de fora)
    caixas(scene, B.anel.map(p => ({ x: (p.x0 + p.x1) / 2, y: 0.1, z: (p.z0 + p.z1) / 2, sx: p.x1 - p.x0, sy: 0.2, sz: p.z1 - p.z0 })), matCalcada);
    for (const b of B.baiasFora) {
      const t = texAsfalto.clone(); t.needsUpdate = true; t.repeat.set((b.x1 - b.x0) / 8, (b.z1 - b.z0) / 8);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b.x1 - b.x0, b.z1 - b.z0).rotateX(-Math.PI / 2), lambert({ map: t }));
      m.position.set((b.x0 + b.x1) / 2, 0.001, (b.z0 + b.z1) / 2); m.renderOrder = 5; scene.add(m);
    }
  } else caixas(scene, [
    { x: cx, y: 0.1, z: LIM.z0 - CW / 2, sx: W + 2 * CW, sy: 0.2, sz: CW },
    // calçada da beirada sul com a abertura da rampa da garagem (spec 036)
    ...(B.garagem ? [[LIM.x0 - CW, B.garagem.x0], [B.garagem.x1, LIM.x1 + CW]].map(([a, b]) => ({ x: (a + b) / 2, y: 0.1, z: LIM.z1 + CW / 2, sx: b - a, sy: 0.2, sz: CW }))
      : [{ x: cx, y: 0.1, z: LIM.z1 + CW / 2, sx: W + 2 * CW, sy: 0.2, sz: CW }]),
    { x: LIM.x0 - CW / 2, y: 0.1, z: cz, sx: CW, sy: 0.2, sz: D },
    // spec 040: beirada leste aberta onde a estrada sai (z 0, 12 m) e onde ela volta (z 170, 10 m)
    ...(B.estrada ? [[LIM.z0, -6], [6, 165], [175, LIM.z1]] : [[LIM.z0, LIM.z1]]).map(([a, b]) => ({ x: LIM.x1 + CW / 2, y: 0.1, z: (a + b) / 2, sx: CW, sy: 0.2, sz: b - a }))], matCalcada);
  if (B.estrada) estradaERio();
  const gramas = [];
  for (const p of (B.quadras || calc)) {           // spec 043: o gramado sai da quadra inteira (antes de recortar as baias)
    const base = B.quadras || calc;
    const costura = (lado) => base.some(o => o !== p && (
      (lado === 'x0' && Math.abs(o.x1 - p.x0) < 0.01 && o.z0 < p.z1 && o.z1 > p.z0) || (lado === 'x1' && Math.abs(o.x0 - p.x1) < 0.01 && o.z0 < p.z1 && o.z1 > p.z0) ||
      (lado === 'z0' && Math.abs(o.z1 - p.z0) < 0.01 && o.x0 < p.x1 && o.x1 > p.x0) || (lado === 'z1' && Math.abs(o.z0 - p.z1) < 0.01 && o.x0 < p.x1 && o.x1 > p.x0)));
    const i = 2.4 + (B.quadras ? 2.6 : 0);         // spec 043: baia (2,6) + calçada
    const x0 = p.x0 + (costura('x0') ? 0 : i), x1 = p.x1 - (costura('x1') ? 0 : i), z0 = p.z0 + (costura('z0') ? 0 : i), z1 = p.z1 - (costura('z1') ? 0 : i);
    gramas.push({ x: (x0 + x1) / 2, y: 0.21, z: (z0 + z1) / 2, sx: x1 - x0, sy: 0.02, sz: z1 - z0 });
  }
  caixas(scene, gramas, lambert({ color: 0x8edc66 }));

  // --- rótula: ilha com canteiro e florzinhas ---------------------------------------------------------------------
  const meio = new THREE.Mesh(new THREE.CylinderGeometry(R.ilha, R.ilha, 0.3, 40), lambert({ color: 0xf1e6d2 }));
  meio.position.set(R.x, 0.15, R.z); scene.add(meio);
  const canteiro = new THREE.Mesh(new THREE.CylinderGeometry(R.ilha - 0.8, R.ilha - 0.8, 0.36, 40), lambert({ color: 0x7fd65a }));
  canteiro.position.set(R.x, 0.18, R.z); scene.add(canteiro);
  const flores = [];
  for (let k = 0; k < 46; k++) {
    const a = k * 2.399, r = 1.5 + (k % 9) * 0.62;
    flores.push({ x: R.x + Math.cos(a) * r, y: 0.5, z: R.z + Math.sin(a) * r, sx: 0.45, sy: 0.45, sz: 0.45, cor: ['#ff5fa8', '#ffd84d', '#ffffff', '#b37bff'][k % 4] });
  }

  // --- pintura no asfalto -----------------------------------------------------------------------------------------
  const branco = [], amarelo = [];
  for (const tr of B.trechos) {
    const r = B.ruas.find(x => x.id === tr.rua), L = Math.hypot(tr.bx - tr.ax, tr.bz - tr.az);
    const mx = (tr.ax + tr.bx) / 2, mz = (tr.az + tr.bz) / 2, h = tr.heading, rx = -Math.cos(h), rz = Math.sin(h);
    if (tr.unica) {                                  // spec 034: mão única = faixas no mesmo sentido, tracejado branco
      const ux = Math.sin(h), uz = Math.cos(h);
      for (let d = -L / 2 + 2; d < L / 2 - 2; d += 7) branco.push({ x: mx + ux * (d + 1.5), y: 0.03, z: mz + uz * (d + 1.5), sx: 0.14, sy: 0.02, sz: 3, ry: h });
    } else if (r.estrada) {                         // spec 040: tracejada onde pode ultrapassar; dupla contínua na zona da ponte
      const ux = Math.sin(h), uz = Math.cos(h), zona = (x, z) => B.pontes.some(p => x > p.x0 - B.estrada.zonaPonte && x < p.x1 + B.estrada.zonaPonte && Math.abs(z - (p.z0 + p.z1) / 2) < 8);
      for (let d = -L / 2; d < L / 2 - 0.5; d += 2) {
        const x = mx + ux * (d + 1), z = mz + uz * (d + 1);
        if (zona(x, z)) for (const o of [-0.16, 0.16]) amarelo.push({ x: x + rx * o, y: 0.03, z: z + rz * o, sx: 0.14, sy: 0.02, sz: 2.02, ry: h });
        else if (Math.round(d / 2) % 3 === 0) amarelo.push({ x: x + ux, y: 0.03, z: z + uz, sx: 0.14, sy: 0.02, sz: 4, ry: h });
      }
    } else for (const o of [-0.16, 0.16]) amarelo.push({ x: mx + rx * o, y: 0.03, z: mz + rz * o, sx: 0.14, sy: 0.02, sz: L, ry: h });
    for (const o of [-(r.largura / 2 - 0.45), r.largura / 2 - 0.45]) branco.push({ x: mx + rx * o, y: 0.03, z: mz + rz * o, sx: 0.14, sy: 0.02, sz: L, ry: h });
  }
  const linhas = [...B.pares.map(p => p.linha), ...B.semaforos.flatMap(s => s.linhas)];
  for (const l of linhas) {
    const r = B.ruas.find(x => x.id === l.rua), hw = r.largura / 2;
    branco.push({ x: l.x, y: 0.035, z: l.z, sx: hw - 0.1, sy: 0.02, sz: 0.55, ry: l.heading });
  }
  for (const f of B.faixas) {     // zebra: listras no sentido da rua, espalhadas de um lado ao outro
    const rx = -Math.cos(f.heading), rz = Math.sin(f.heading), n = Math.floor(f.comprimento / 1.0);
    for (let k = 0; k < n; k++) {
      const o = -f.comprimento / 2 + 0.5 + k * 1.0 + 0.25;
      branco.push({ x: f.x + rx * o, y: 0.036, z: f.z + rz * o, sx: 0.55, sy: 0.02, sz: f.largura, ry: f.heading });
    }
  }
  // borda do anel da rótula (pontilhado branco na entrada da rótula)
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    if (k % 2) continue;
    branco.push({ x: R.x + Math.cos(a) * (R.ilha + 0.5), y: 0.03, z: R.z + Math.sin(a) * (R.ilha + 0.5), sx: 0.14, sy: 0.02, sz: 0.5, ry: -a });
  }
  caixas(scene, branco, lambert({ color: 0xffffff }));
  caixas(scene, amarelo, lambert({ color: 0xffc81e }));

  // "PARE" pintado no chão antes da linha
  const texPareChao = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#fff'; g.font = '900 104px Arial Black, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.scale(1, 1.15); g.fillText('PARE', w / 2, h / 2 / 1.15 + 4); g.restore();
  }, false);
  const decal = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.6, 1.9).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ map: texPareChao, transparent: true, depthWrite: false }), B.pares.length);
  B.pares.forEach((p, i) => { const l = p.linha; poe(decal, i, l.x - Math.sin(l.heading) * 3, 0.04, l.z - Math.cos(l.heading) * 3, 1, 1, 1, l.heading + Math.PI); });
  scene.add(decal);

  // lombada: corcova listrada amarela e preta
  const texLomb = canvasTex(128, 32, (g, w, h) => { for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#222' : '#ffcc00'; g.fillRect(k * w / 8, 0, w / 8, h); } }, false);
  for (const l of B.lombadas) {
    const r = B.ruas.find(x => x.id === l.rua);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, r.largura, 20, 1, false, 0, Math.PI), lambert({ map: texLomb }));
    m.rotation.set(0, l.heading, Math.PI / 2); m.rotation.order = 'YXZ'; m.scale.set(0.16, 1, 1.1);
    m.position.set(l.x, 0, l.z); scene.add(m);
  }

  // --- placas -----------------------------------------------------------------------------------------------------
  const postes = [];
  const porTipo = {};
  for (const p of B.placas) { const k = p.tipo === 'vel' ? 'vel' + p.valor : p.tipo; (porTipo[k] ||= []).push(p); }
  for (const [k, lista] of Object.entries(porTipo)) {
    const [cw, ch, draw] = DESENHO[k], [pw, ph] = TAMANHO[k].map(v => v * SINAL);
    const frente = canvasTex(cw, ch, (g, w, h) => draw(g, w, h, false), false);
    const verso = canvasTex(cw, ch, (g, w, h) => draw(g, w, h, true), false);
    const gF = new THREE.PlaneGeometry(pw, ph), gV = new THREE.PlaneGeometry(pw, ph).rotateY(Math.PI).translate(0, 0, -0.03);
    const imF = new THREE.InstancedMesh(gF, new THREE.MeshBasicMaterial({ map: frente, alphaTest: 0.5 }), lista.length);
    const imV = new THREE.InstancedMesh(gV, new THREE.MeshLambertMaterial({ map: verso, alphaTest: 0.5 }), lista.length);
    lista.forEach((p, i) => {
      const y = 2.2 + ph / 2;
      poe(imF, i, p.x, y, p.z, 1, 1, 1, p.heading + Math.PI); poe(imV, i, p.x, y, p.z, 1, 1, 1, p.heading + Math.PI);
      postes.push({ x: p.x + Math.sin(p.heading) * 0.08, y: (2.2 + ph - 0.1) / 2, z: p.z + Math.cos(p.heading) * 0.08, sx: 0.1, sy: 2.2 + ph - 0.1, sz: 0.1 });
    });
    scene.add(imF, imV);
  }

  // --- semáforos: poste na calçada da direita + braço sobre a faixa + grupo focal ---------------------------------
  const escuro = [], lampadas = [], focos = [];   // lampadas: { sem, cor: 0 verm / 1 amar / 2 verde }; focos: 1 por grupo focal
  const S = SINAL;
  for (const s of B.semaforos) for (const l of s.linhas) {
    const r = B.ruas.find(x => x.id === l.rua), hw = r.largura / 2, lw = r.largura / 4;
    const h = l.heading, fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
    const px = l.x + rx * (hw - lw + 0.9) + fx * 1.2, pz = l.z + rz * (hw - lw + 0.9) + fz * 1.2;   // pé do poste
    escuro.push({ x: px, y: 3.3, z: pz, sx: 0.26, sy: 6.6, sz: 0.26 });
    const braco = hw - lw + 0.9 + lw;            // até o meio da faixa
    escuro.push({ x: px - rx * braco / 2, y: 6.5, z: pz - rz * braco / 2, sx: braco + 0.3, sy: 0.2, sz: 0.2, ry: h });
    // só o grupo focal do braço, sobre a faixa (spec 019: o repetidor do poste parecia "outro semáforo abrindo junto")
    for (const [hx, hz, hy] of [[px - rx * braco, pz - rz * braco, 5.3]]) {
      escuro.push({ x: hx, y: hy, z: hz, sx: 0.62 * S, sy: 1.6 * S, sz: 0.4 * S, ry: h });
      const foco = { sem: s.id, fx: -fx, fz: -fz, lamp: [] };
      for (let c = 0; c < 3; c++) {
        const L = { sem: s.id, cor: c, h, x: hx - fx * 0.21 * S, y: hy + (0.48 - c * 0.48) * S, z: hz - fz * 0.21 * S };
        lampadas.push(L); foco.lamp.push(L);      // (sem pala: ela tapava o brilho da lâmpada de longe; o disco já só aparece de frente)
      }
      focos.push(foco);
    }
  }
  // radar: poste e caixa com a lente virada pra quem chega
  for (const rd of B.radares) {
    const r = B.ruas.find(x => x.id === rd.rua), hw = r.largura / 2, lw = r.largura / 4;
    const rx = -Math.cos(rd.heading), rz = Math.sin(rd.heading), px = rd.x + rx * (hw - lw + 1.2), pz = rd.z + rz * (hw - lw + 1.2);
    escuro.push({ x: px, y: 2.2, z: pz, sx: 0.22, sy: 4.4, sz: 0.22 });
    const cx2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1.0), lambert({ color: 0xffd23f }));
    cx2.position.set(px, 4.5, pz); cx2.rotation.y = rd.heading; scene.add(cx2);
    const lente = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x111122 }));
    lente.position.set(px - Math.sin(rd.heading) * 0.52, 4.5, pz - Math.cos(rd.heading) * 0.52); lente.rotation.y = rd.heading; scene.add(lente);
  }
  caixas(scene, escuro, lambert({ color: 0x30323c }));
  caixas(scene, postes, lambert({ color: 0x8a909c }), new THREE.CylinderGeometry(0.5, 0.5, 1, 8));
  // lâmpada = disco virado só para quem chega (FrontSide): de lado/de trás não aparece — antes era uma bolinha e,
  // olhando de lado, o verde da outra rua parecia aceso junto com o seu vermelho
  const imLamp = new THREE.InstancedMesh(new THREE.CircleGeometry(0.19, 16), new THREE.MeshBasicMaterial(), lampadas.length);
  lampadas.forEach((l, i) => poe(imLamp, i, l.x, l.y, l.z, S, S, 1, l.h + Math.PI));
  scene.add(imLamp);
  const ACESA = ['#ff2a2a', '#ffc81a', '#2bff6a'], APAGADA = ['#4d1717', '#4d3d12', '#123d22'], IDX = { vermelho: 0, amarelo: 1, verde: 2 };
  const HALO_COR = ['#ff3a2a', '#ffb81a', '#2bff70'];
  const halo = criarHalos(scene, focos);
  let ultimo = '';
  function atualizar(t) {
    const fases = B.semaforos.map(s => faseSemaforo(s.id, t)), chave = fases.join();
    if (chave === ultimo) return;
    ultimo = chave;
    const f = Object.fromEntries(B.semaforos.map((s, i) => [s.id, IDX[fases[i]]]));
    lampadas.forEach((l, i) => imLamp.setColorAt(i, _c.set(f[l.sem] === l.cor ? ACESA[l.cor] : APAGADA[l.cor])));
    imLamp.instanceColor.needsUpdate = true;
    focos.forEach((fo, i) => { const k = f[fo.sem], L = fo.lamp[k]; halo.poe(i, L.x + fo.fx * 0.15, L.y, L.z + fo.fz * 0.15, HALO_COR[k]); });
    halo.pronto();
  }
  atualizar(0);

  // --- casas e prédios especiais ----------------------------------------------------------------------------------
  const texParede = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#bfe6ff'; g.strokeStyle = '#ffffff';
    for (const x of [18, 82]) { g.fillRect(x, 34, 28, 28); g.fillStyle = '#e8e8e8'; g.fillRect(x - 3, 62, 34, 5); g.fillStyle = '#bfe6ff'; }
    g.fillStyle = '#c98a5a'; g.fillRect(54, 74, 20, 54);
    g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, h - 8, w, 8);
  }, false);
  const casas = B.predios.filter(p => p.tipo === 'casa');
  const corpo = casas.map(p => ({ x: (p.x0 + p.x1) / 2, y: 0.2 + p.altura / 2, z: (p.z0 + p.z1) / 2, sx: p.x1 - p.x0, sy: p.altura, sz: p.z1 - p.z0, cor: p.cor }));
  caixas(scene, corpo, lambert({ map: texParede }));
  const TELHA = ['#e8574a', '#d9634a', '#7a5cff', '#2fa6c9', '#ff7aa8', '#9a6a4a'];
  const telhados = casas.map((p, i) => ({ x: (p.x0 + p.x1) / 2, y: 0.2 + p.altura + 1.25, z: (p.z0 + p.z1) / 2, sx: (p.x1 - p.x0) * 1.12, sy: 2.5, sz: (p.z1 - p.z0) * 1.12, cor: TELHA[i % TELHA.length] }));
  caixas(scene, telhados, lambert({ color: 0xffffff }), new THREE.ConeGeometry(0.7072, 1, 4).rotateY(Math.PI / 4));

  // spec 034: prédios altos do centro (janelas, topo reto) e carros parados no estacionamento
  const altos = B.predios.filter(p => p.tipo === 'alto');
  if (altos.length) {
    const texJanela = canvasTex(64, 64, (g, w, h) => {
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#9fd0f0'; for (const x of [8, 36]) for (const y of [8, 36]) g.fillRect(x, y, 20, 20);
    });
    const geoAlto = new THREE.BoxGeometry(1, 1, 1);
    const imAlto = new THREE.InstancedMesh(geoAlto, lambert({ map: texJanela }), altos.length);
    texJanela.repeat.set(4, 6);
    altos.forEach((p, i) => { poe(imAlto, i, (p.x0 + p.x1) / 2, 0.2 + p.altura / 2, (p.z0 + p.z1) / 2, p.x1 - p.x0, p.altura, p.z1 - p.z0); imAlto.setColorAt(i, _c.set(p.cor)); });
    imAlto.instanceMatrix.needsUpdate = true; if (imAlto.instanceColor) imAlto.instanceColor.needsUpdate = true; scene.add(imAlto);
    caixas(scene, altos.map(p => ({ x: (p.x0 + p.x1) / 2, y: 0.2 + p.altura + 0.3, z: (p.z0 + p.z1) / 2, sx: p.x1 - p.x0 + 0.4, sy: 0.6, sz: p.z1 - p.z0 + 0.4, cor: '#7a8090' })), lambert({ color: 0xffffff }));
  }
  // (carros parados do estacionamento: desenhados por criarCarrosPatio, com o carrinho de verdade — spec 035)
  // spec 036/038: garagem da vovó — anexo rosa com telhado roxo, portão basculante, teto com lâmpada, prateleiras e pneus
  let portaoPivo = null, temaGaragem = () => {};
  if (B.garagem) {
    const G = B.garagem, gp = B.predios.filter(p => p.tipo === 'garagem'), cx = (G.x0 + G.x1) / 2, ZF = 177.5;
    const paredesG = caixas(scene, gp.map(p => ({ x: (p.x0 + p.x1) / 2, y: 0.2 + p.altura / 2, z: (p.z0 + p.z1) / 2, sx: p.x1 - p.x0, sy: p.altura, sz: p.z1 - p.z0, cor: p.cor })), lambert({ color: 0xffffff }));
    const plano = (w, d, cor, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), lambert({ color: cor })); m.position.set(x, y, z); scene.add(m); return m; };
    plano(G.x1 - G.x0, G.z1 - ZF, 0xd8d3ca, cx, 0.03, (ZF + G.z1) / 2);                 // piso de dentro
    plano(4.6, ZF - G.z0, 0xbdb7ad, cx, 0.025, (G.z0 + ZF) / 2);                          // rampa (entrada de carro)
    const extras = [
      { x: cx, y: 0.2 + 2.95, z: ZF + 0.25, sx: 4.6, sy: 0.5, sz: 0.5, cor: '#ff7fbf' },                            // verga em cima do portão
      { x: cx, y: 0.2 + 2.68, z: ZF - 0.03, sx: 4.9, sy: 0.08, sz: 0.1, cor: '#ffffff' },                           // friso branco
      { x: cx, y: 0.12, z: 186.4, sx: 2.4, sy: 0.16, sz: 0.3, cor: '#ffd23a' },                                     // batente amarelo do pneu
      // prateleira na parede da esquerda (lado oeste) com caixas coloridas
      ...[0.9, 1.6].map(y => ({ x: 24.35, y, z: 184.2, sx: 0.7, sy: 0.06, sz: 3.2, cor: '#b98a5a' })),
      ...[['#5fb8ff', 183.2, 0.9], ['#ffb43a', 184.0, 0.9], ['#7ad67a', 185.0, 0.9], ['#e8574a', 183.6, 1.6], ['#b84aff', 184.7, 1.6]]
        .map(([cor, z, y]) => ({ x: 24.4, y: y + 0.22, z, sx: 0.5, sy: 0.38, sz: 0.55, cor })),
      // luminárias na fachada, dos dois lados do portão
      ...[24.3, 30.7].map(x => ({ x, y: 2.5, z: ZF - 0.12, sx: 0.28, sy: 0.4, sz: 0.2, cor: '#fff3b0' })),
    ];
    const extrasG = caixas(scene, extras, lambert({ color: 0xffffff }));
    // laje: forro claro por dentro (MeshBasic: a luz do céu não pinta o lado de baixo de verde)
    const laje = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.16, 188 - ZF + 0.4), [lambert({ color: 0xff7fbf }), lambert({ color: 0xff7fbf }), lambert({ color: 0xff7fbf }),
      new THREE.MeshBasicMaterial({ color: 0xf1e4ea }), lambert({ color: 0xff7fbf }), lambert({ color: 0xff7fbf })]);
    laje.position.set(cx, 0.2 + 3.2 + 0.08, (ZF + 188) / 2); scene.add(laje);
    const tel = new THREE.Mesh(new THREE.ConeGeometry(0.7072, 1, 4).rotateY(Math.PI / 4), lambert({ color: '#b84aff' }));
    tel.scale.set(9.2, 1.6, 11.6); tel.position.set(cx, 0.2 + 3.36 + 0.8, (ZF + 188) / 2); scene.add(tel);
    // pneus empilhados na parede da direita (leste)
    const pneu = new THREE.TorusGeometry(0.33, 0.13, 8, 16).rotateX(Math.PI / 2), mp = lambert({ color: 0x2b2b30 });
    for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(pneu, mp); m.position.set(30.4, 0.18 + k * 0.27, 185.8); scene.add(m); }
    // lâmpada no teto (acesa)
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 2.2), new THREE.MeshBasicMaterial({ color: 0xfffbe8 }));
    lamp.position.set(cx, 0.2 + 3.2 - 0.04, 183); scene.add(lamp);
    // plaquinha "GARAGEM" na verga e o portão basculante (gira na dobradiça de cima para dentro, até ficar sob o teto)
    const texPlaca = cor => canvasTex(256, 52, (g, w, h) => {
      g.fillStyle = '#fff'; g.beginPath(); g.roundRect(0, 0, w, h, 12); g.fill();
      g.fillStyle = cor; g.font = '900 30px Arial Black, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🚗 GARAGEM', w / 2, h / 2 + 1);
    }, false);
    const placaRosa = texPlaca('#e0157a'), placaAzul = texPlaca('#1a5fd0');
    const placa = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.38), new THREE.MeshBasicMaterial({ map: placaRosa, transparent: true }));
    placa.rotation.y = Math.PI; placa.position.set(cx, 0.2 + 2.95, ZF - 0.02); scene.add(placa);
    const texPortao = canvasTex(256, 160, (g, w, h) => {
      g.fillStyle = '#f7f3ff'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) { g.fillStyle = '#dcd3ee'; g.fillRect(0, y + 12, w, 4); }
      g.fillStyle = '#c9bfe0'; g.fillRect(w / 2 - 18, h - 26, 36, 8);                   // puxador
    }, false);
    portaoPivo = new THREE.Group(); portaoPivo.position.set(cx, 0.2 + 2.7, ZF + 0.3);
    const folha = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.7), lambert({ map: texPortao, side: THREE.DoubleSide }));
    folha.position.y = -1.35; portaoPivo.add(folha); scene.add(portaoPivo);
    // spec 049: a garagem segue o tema — Meninas rosa / Meninos azul (paredes, verga, laje, telhado e plaquinha)
    temaGaragem = azul => {
      const parede = azul ? '#7fb2ff' : '#ff7fbf', teto = azul ? '#2b5fd9' : '#b84aff';
      for (let i = 0; i < paredesG.count; i++) paredesG.setColorAt(i, _c.set(parede));
      paredesG.instanceColor.needsUpdate = true;
      extrasG.setColorAt(0, _c.set(parede)); extrasG.instanceColor.needsUpdate = true;      // a verga é o 1º dos extras
      laje.material.forEach((m, i) => { if (i !== 3) m.color.set(parede); });                // (a 4ª face é o forro claro)
      tel.material.color.set(teto);
      placa.material.map = azul ? placaAzul : placaRosa; placa.material.needsUpdate = true;
    };
  }
  // abre (1) / fecha (0) o portão: a folha gira para dentro e para cima até ficar deitada sob o teto
  function portao(v) { if (portaoPivo) portaoPivo.rotation.x = -Math.PI / 2 * Math.max(0, Math.min(1, v)); }
  // spec 034: pintura das vagas — linhas brancas; PcD azul com a cadeirinha; idoso amarelo com "IDOSO"
  if (B.vagas && B.vagas.length) {
    const linhasV = [];
    for (const v of B.vagas) {
      if (v.tipo === 'lateral') {             // spec 042: vaga na rua — linha de fora contínua + marcas entre as vagas
        linhasV.push({ x: v.x1 - 0.06, y: 0.03, z: (v.z0 + v.z1) / 2, sx: 0.12, sy: 0.02, sz: v.z1 - v.z0 });
        for (const z of [v.z0, v.z1]) linhasV.push({ x: (v.x0 + v.x1) / 2, y: 0.031, z, sx: v.x1 - v.x0, sy: 0.02, sz: 0.12 });
        continue;
      }
      for (const x of [v.x0, v.x1]) linhasV.push({ x, y: 0.03, z: (v.z0 + v.z1) / 2, sx: 0.12, sy: 0.02, sz: v.z1 - v.z0 });
    }
    caixas(scene, linhasV, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const simbolo = (fundo, desenha) => canvasTex(128, 192, (g, w, h) => { g.fillStyle = fundo; g.fillRect(0, 0, w, h); desenha(g, w, h); }, false);
    const texPcd = simbolo('#1e63d6', (g, w, h) => { g.font = '96px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♿', w / 2, h / 2); });
    const texIdoso = simbolo('#e6b800', (g, w, h) => { g.fillStyle = '#111'; g.font = '900 30px Arial Black, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('IDOSO', w / 2, h / 2); });
    for (const v of B.vagas) if (v.tipo === 'pcd' || v.tipo === 'idoso') {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(v.x1 - v.x0 - 0.2, v.z1 - v.z0 - 0.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: v.tipo === 'pcd' ? texPcd : texIdoso }));
      m.position.set((v.x0 + v.x1) / 2, 0.035, (v.z0 + v.z1) / 2); if (v.heading === Math.PI) m.rotation.y = Math.PI; scene.add(m);
    }
  }

  const letreiro = (txt, bg, fg, icone) => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let x = 30; x < w; x += 120) { g.fillStyle = '#bfe6ff'; g.fillRect(x, 150, 60, 60); }
    g.fillStyle = '#fff'; g.beginPath(); g.roundRect(40, 22, w - 80, 96, 26); g.fill();
    g.fillStyle = fg; g.font = '900 64px Arial Black, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((icone ? icone + ' ' : '') + txt, w / 2, 72);
  }, false);
  const especial = (p, faceFrente, tex, cor, telhado) => {
    const mat = lambert({ color: cor }), front = lambert({ map: tex });
    const mats = [mat, mat, mat, mat, mat, mat]; mats[faceFrente] = front;
    const m = new THREE.Mesh(new THREE.BoxGeometry(p.x1 - p.x0, p.altura, p.z1 - p.z0), mats);
    m.position.set((p.x0 + p.x1) / 2, 0.2 + p.altura / 2, (p.z0 + p.z1) / 2); scene.add(m);
    if (telhado) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.7072, 1, 4).rotateY(Math.PI / 4), lambert({ color: telhado }));
      t.scale.set((p.x1 - p.x0) * 1.1, 3, (p.z1 - p.z0) * 1.1); t.position.set(m.position.x, 0.2 + p.altura + 1.5, m.position.z); scene.add(t);
    }
    return m;
  };
  const P = tipo => B.predios.find(p => p.tipo === tipo);
  // BoxGeometry: faces +x, -x, +y, -y, +z, -z
  especial(P('escola'), 5, letreiro('ESCOLA', '#ffb43a', '#e8262f'), 0xffb43a, '#e8574a');
  especial(P('farmacia'), 4, letreiro('FARMÁCIA', '#5fd38d', '#16a34a'), 0x5fd38d);
  especial(P('vovo'), 5, letreiro('VOVÓ', '#ff7fbf', '#e0157a'), 0xff7fbf, '#b84aff');
  especial(P('mercado'), 4, letreiro('MERCADO', '#7fc8ff', '#1a5fd0'), 0x7fc8ff);   // spec 021
  especial(P('posto'), 4, letreiro('POSTO DE SAÚDE', '#ffffff', '#e8262f'), 0xf2f6ff, '#7fb2ff');   // spec 026
  if (P('frutas')) especial(P('frutas'), 4, letreiro('FRUTAS', '#ffb27a', '#e0157a', '🍓'), 0xffb27a, '#e8262f');   // spec 040 (frente pro sul = estrada)
  if (P('celeiro')) especial(P('celeiro'), 5, letreiro('SÍTIO', '#d9463b', '#7a2a1a', '🚜'), 0xd9463b, '#6b3a2a');
  especial(P('veterinario'), 5, letreiro('VETERINÁRIO', '#ffe08a', '#b35d00'), 0xffe08a, '#c98a5a');   // spec 027
  // cruz vermelha em cima do posto
  { const f = P('posto'), m = lambert({ color: 0xe8262f, emissive: 0x600000 });
    for (const [sx, sy] of [[3, 1], [1, 3]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.4), m); c.position.set((f.x0 + f.x1) / 2, 0.2 + f.altura + 5, f.z1 - 1); scene.add(c); } }
  // spec 026: placas de "proibido buzinar" nas duas pontas da zona de silêncio (na calçada, para quem chega)
  { const tex = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
      g.strokeStyle = '#e8262f'; g.lineWidth = 12; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.stroke();
      g.font = '64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('📯', 64, 68);
      g.beginPath(); g.moveTo(26, 26); g.lineTo(102, 102); g.stroke();
    }, false);
    for (const z of B.zonasSilencio || []) for (const [x, h] of [[z.x1, -Math.PI / 2], [z.x0, Math.PI / 2]]) {
      const zz = h < 0 ? 164 : 176;                         // calçada da direita de quem chega
      const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3), lambert({ color: 0x8a909c })); poste.position.set(x, 1.5, zz); scene.add(poste);
      const pl = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ map: tex })); pl.position.set(x, 3.2, zz); pl.rotation.y = h + Math.PI; scene.add(pl);
    } }
  // cruz verde da farmácia em cima
  { const f = P('farmacia'), m = lambert({ color: 0x16c060, emissive: 0x0a6030 });
    for (const [sx, sy] of [[3, 1], [1, 3]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.4), m); c.position.set((f.x0 + f.x1) / 2, 0.2 + f.altura + 2, f.z1 - 1); scene.add(c); } }
  // bandeirinha e parquinho da escola
  { const e = P('escola'), mastro = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 9), lambert({ color: 0xdddddd }));
    mastro.position.set(e.x0 - 3, 4.7, e.z0); scene.add(mastro);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), lambert({ color: 0x2bbf5a, side: THREE.DoubleSide }));
    band.position.set(e.x0 - 1.8, 8.3, e.z0); scene.add(band);
    const losango = new THREE.Mesh(new THREE.CircleGeometry(0.62, 4), lambert({ color: 0xffd400, side: THREE.DoubleSide }));
    losango.scale.set(1.4, 0.9, 1); losango.position.set(e.x0 - 1.8, 8.3, e.z0 - 0.02); scene.add(losango); }

  // praça: caminhos, chafariz, bancos
  { const p = P('praca'), mx = (p.x0 + p.x1) / 2, mz = (p.z0 + p.z1) / 2;
    caixas(scene, [{ x: mx, y: 0.24, z: mz, sx: 4, sy: 0.04, sz: p.z1 - p.z0 }, { x: mx, y: 0.24, z: mz, sx: p.x1 - p.x0, sy: 0.04, sz: 4 }], lambert({ color: 0xf6e3b8 }));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.6, 32), lambert({ color: 0xf6e3b8 })); base.position.set(mx, 0.3, mz); scene.add(base);
    const agua = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 0.7, 32), lambert({ color: 0x4fc3ff, emissive: 0x0a3a60 })); agua.position.set(mx, 0.35, mz); scene.add(agua);
    const torre = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.1, 2.6, 12), lambert({ color: 0xff8fb8 })); torre.position.set(mx, 1.6, mz); scene.add(torre);
    const prato = new THREE.Mesh(new THREE.CylinderGeometry(2, 1.2, 0.4, 16), lambert({ color: 0xff8fb8 })); prato.position.set(mx, 2.9, mz); scene.add(prato);
    const bancos = [];
    for (const [dx, dz, ry] of [[-9, -5, 0], [9, 5, 0], [-5, 9, Math.PI / 2], [5, -9, Math.PI / 2]]) bancos.push({ x: mx + dx, y: 0.65, z: mz + dz, sx: 3, sy: 0.25, sz: 0.8, ry });
    caixas(scene, bancos, lambert({ color: 0xc9824a }));
    for (let k = 0; k < 60; k++) flores.push({ x: p.x0 + 3 + (k * 37 % 80), y: 0.45, z: p.z0 + 3 + (k * 53 % 70), sx: 0.5, sy: 0.5, sz: 0.5, cor: ['#ff5fa8', '#ffd84d', '#ffffff', '#b37bff', '#ff7a3d'][k % 5] });
  }
  caixas(scene, flores, lambert({ color: 0xffffff }), new THREE.IcosahedronGeometry(0.5, 0));

  // --- árvores (bairro + uma mata em volta, para o horizonte não ficar vazio) -----------------------------------
  const naFaixaDaEstrada = (x, z, m) => B.ruas.some(r => r.estrada && (() => {
    const [[ax, az], [bx, bz]] = r.pontos, sx = bx - ax, sz = bz - az, L2 = sx * sx + sz * sz, t = Math.max(0, Math.min(1, ((x - ax) * sx + (z - az) * sz) / L2));
    return Math.hypot(x - ax - sx * t, z - az - sz * t) < r.largura / 2 + m; })());
  const arv = [...B.arvores];
  for (let k = 0; k < 110; k++) {
    const a = k * 0.571, rr = Math.max(215, Math.hypot(LIM.x1 - LIM.x0, LIM.z1 - LIM.z0) / 2 + 30) + (k * 29 % 70);   // spec 034: mapa maior
    const x = cx + Math.cos(a) * rr * 1.15, z = cz + Math.sin(a) * rr * 0.95;
    if (B.estrada && (naFaixaDaEstrada(x, z, 12) || (x > B.estrada.rio.x0 - 8 && x < B.estrada.rio.x1 + 8))) continue;   // spec 040
    arv.push({ x, z, r: 4 + (k % 5) });
  }
  if (B.estrada) for (let k = 0; k < 40; k++) {           // spec 040: árvores dentro da volta da estrada (longe da pista e do rio)
    const x = 395 + (k * 83 % 215), z = 18 + (k * 47 % 135);
    if (x > B.estrada.rio.x0 - 8 && x < B.estrada.rio.x1 + 8) continue;
    arv.push({ x, z, r: 3 + (k % 4) });
  }
  caixas(scene, arv.map(a => ({ x: a.x, y: 0.2 + a.r * 0.5, z: a.z, sx: a.r * 0.18, sy: a.r, sz: a.r * 0.18 })), lambert({ color: 0x9a6a44 }), new THREE.CylinderGeometry(0.5, 0.7, 1, 6));
  const VERDES = ['#4cc25a', '#5fd36a', '#3daf55', '#7ad65a'];
  caixas(scene, arv.map((a, i) => ({ x: a.x, y: 0.2 + a.r * 1.35, z: a.z, sx: a.r, sy: a.r * 0.95, sz: a.r, cor: VERDES[i % 4] })), lambert({ color: 0xffffff, flatShading: true }), new THREE.IcosahedronGeometry(1, 1));

  // --- noite (spec 021): postes de luz nas calçadas, cada um com uma "poça" de luz no asfalto. Sem luz de verdade
  // (pesaria no celular): poste escuro + lâmpada MeshBasic + disco aditivo no chão. 3 draw calls, só de noite.
  const postesLuz = [];
  for (const r of B.ruas) {
    if (r.pontos.length !== 2) continue;                                   // (spec 034: mão única também tem poste)
    const [[ax, az], [bx, bz]] = r.pontos, L = Math.hypot(bx - ax, bz - az), h = Math.atan2(bx - ax, bz - az);
    const fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
    for (let s = 16, k = 0; s < L - 10; s += 30, k++) {
      const x = ax + fx * s, z = az + fz * s;
      if (B.nos.some(n => Math.hypot(n.x - x, n.z - z) < 12)) continue;       // longe dos cruzamentos
      const lado = k % 2 ? 1 : -1, off = r.largura / 2 + (r.estrada ? 1.1 : 3.8);   // spec 043: atrás da baia
      postesLuz.push({ x: x + rx * off * lado, z: z + rz * off * lado, lx: x + rx * (r.largura / 4) * lado, lz: z + rz * (r.largura / 4) * lado });
    }
  }
  const grupoNoite = new THREE.Group(); grupoNoite.visible = false; scene.add(grupoNoite);
  const poste = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.13, 1, 6), lambert({ color: 0x3a3d48 }), postesLuz.length);
  const bulbo = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 10, 6), new THREE.MeshBasicMaterial({ color: 0xfff1b0 }), postesLuz.length);
  const texPoca = canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,220,140,0.85)'); gr.addColorStop(0.5, 'rgba(255,200,110,0.35)'); gr.addColorStop(1, 'rgba(255,190,100,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, false);
  const poca = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: texPoca, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), postesLuz.length);
  postesLuz.forEach((p, i) => {
    poe(poste, i, p.x, 2.6, p.z, 1, 5.2, 1);
    poe(bulbo, i, (p.x + p.lx) / 2, 5.3, (p.z + p.lz) / 2, 1, 0.7, 1);
    poe(poca, i, (p.x + p.lx) / 2, 0.07, (p.z + p.lz) / 2, 13, 1, 13);
  });
  poca.renderOrder = 7;
  for (const m of [poste, bulbo, poca]) { m.instanceMatrix.needsUpdate = true; grupoNoite.add(m); }
  const fogDia = scene.fog.color.clone(), fundoDia = scene.background.clone();
  let noiteOn = false;
  function noite(liga) { noiteOn = liga; grupoNoite.visible = liga; aplicaCeu(); }

  // --- chuva (spec 029): céu cinza, neblina, asfalto molhado (mais escuro) e pingos caindo em volta da câmera ------
  const NP = 900, pingosPos = new Float32Array(NP * 6), sem = [];
  for (let i = 0; i < NP; i++) sem.push([Math.random() * 50 - 25, Math.random() * 22, Math.random() * 50 - 25]);
  const gPingos = new THREE.BufferGeometry(); gPingos.setAttribute('position', new THREE.BufferAttribute(pingosPos, 3));
  const pingos = new THREE.LineSegments(gPingos, new THREE.LineBasicMaterial({ color: 0xe6efff, transparent: true, opacity: 0.75, fog: false }));
  pingos.frustumCulled = false; pingos.visible = false; pingos.renderOrder = 8; scene.add(pingos);
  const ceuChuva = (() => {
    const geo = ceuCores.geo, pos = geo.attributes.position, cor = [], tmp = new THREE.Color();
    const a = new THREE.Color('#6f7a8a'), b = new THREE.Color('#9aa3b0'), c = new THREE.Color('#b8bfc8');
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 900; if (y > 0.25) tmp.copy(b).lerp(a, Math.min(1, (y - 0.25) / 0.75)); else tmp.copy(c).lerp(b, Math.max(0, (y + 0.05) / 0.3)); cor.push(tmp.r, tmp.g, tmp.b); }
    return new THREE.Float32BufferAttribute(cor, 3);
  })();
  const corAsf = asf.material.color.clone();
  let chovendo = false;
  let nebuloso = false;
  function neblina(liga) { nebuloso = liga; aplicaCeu(); }        // spec 035: neblina (vê pouco à frente)
  function chuva(liga) {
    chovendo = liga; pingos.visible = liga;
    asf.material.color.copy(liga ? new THREE.Color(0x8890a4) : corAsf);    // asfalto molhado
    aplicaCeu();
  }
  // céu, fundo e neblina conforme o clima (a noite manda; senão a chuva; senão o dia)
  function aplicaCeu() {
    const [cores, fundo, fog, near, far] = noiteOn ? [ceuCores.noite, '#070b26', '#151b3d', 70, 330]
      : chovendo ? [ceuChuva, '#9aa3b0', '#a8b0bb', 40, 240] : [ceuCores.dia, null, null, 160, 520];
    ceuCores.geo.setAttribute('color', cores);
    scene.background.copy(fundo ? new THREE.Color(fundo) : fundoDia);
    scene.fog.color.copy(fog ? new THREE.Color(fog) : fogDia);
    scene.fog.near = near; scene.fog.far = far;
    if (nebuloso) {                                  // neblina: o fundo some na cor da névoa a ~100 m
      const cor = new THREE.Color(noiteOn ? '#1c2238' : '#cdd3da');
      ceuCores.geo.setAttribute('color', noiteOn ? ceuCores.noite : ceuChuva); scene.background.copy(cor); scene.fog.color.copy(cor);
      scene.fog.near = 6; scene.fog.far = noiteOn ? 55 : 72;
    }
  }
  function atualizarChuva(dt, cam) {
    if (!chovendo) return;
    for (let i = 0; i < NP; i++) {
      const p = sem[i]; p[1] -= 19 * dt; if (p[1] < 0) { p[1] += 22; p[0] = Math.random() * 50 - 25; p[2] = Math.random() * 50 - 25; }
      const x = cam.x + p[0], z = cam.z + p[2], k = i * 6;
      // spec 053: embaixo do teto da garagem não chove (o pingo some abaixo da laje)
      const G = B.garagem, coberto = G && x > G.x0 - 0.7 && x < G.x1 + 0.7 && z > 177.3 && z < 188.3;
      const y = coberto && p[1] < 3.6 ? -50 : p[1];
      pingosPos[k] = x; pingosPos[k + 1] = y; pingosPos[k + 2] = z; pingosPos[k + 3] = x + 0.05; pingosPos[k + 4] = y + 0.7; pingosPos[k + 5] = z;
    }
    gPingos.attributes.position.needsUpdate = true;
  }

  return { atualizar, noite, chuva, neblina, atualizarChuva, portao, temaGaragem: azul => temaGaragem(azul), get postesLuz() { return postesLuz.length; } };
}

// ---------------------------------------------------------------------------------------------------------------
// Atores do trânsito (carros IA e pedestres) e o marcador do destino. Tudo instanciado: 6 carros = 2 draw calls,
// 8 pedestres = 2 draw calls, materiais compartilhados, sem sombra.
// ---------------------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------
// Halo dos semáforos (spec 006): 1 ponto por grupo focal, todos num só THREE.Points com mistura ADITIVA e brilho
// desenhado no shader (sem textura, sem luz real). Tamanho em metros (fica do tamanho certo de perto) com mínimo em
// pixels (visível a 100 m) e só aparece para quem olha de frente para a lâmpada.
// ---------------------------------------------------------------------------------------------------------------
function criarHalos(scene, focos) {
  const n = focos.length, pos = new Float32Array(n * 3), cor = new Float32Array(n * 3), dir = new Float32Array(n * 2);
  focos.forEach((f, i) => { dir[i * 2] = f.fx; dir[i * 2 + 1] = f.fz; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('cor', new THREE.BufferAttribute(cor, 3));
  g.setAttribute('dir', new THREE.BufferAttribute(dir, 2));
  // spec 007: miolo OPACO do tamanho da lâmpada (com mínimo em pixels: ≥ 10 px a 100 m) + brilho aditivo em volta.
  // Mistura pré-multiplicada (ONE, ONE_MINUS_SRC_ALPHA): alfa 1 no miolo = cor sólida; alfa 0 no brilho = soma (aditivo).
  const mat = new THREE.ShaderMaterial({
    uniforms: { escala: { value: 600 }, tam: { value: 4.5 }, minPx: { value: 24 }, lamp: { value: LAMPADA_D }, miolMin: { value: 16 } },
    vertexShader: `
      attribute vec3 cor; attribute vec2 dir; uniform float escala, tam, minPx, lamp, miolMin; varying vec3 vCor; varying float vA, vMiolo;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float dist = max(-mv.z, 0.1);
        float miolo = max(lamp * escala / dist, miolMin);
        gl_PointSize = clamp(max(tam * escala / dist, minPx), miolo * 2.2, 320.0);
        vMiolo = miolo / gl_PointSize;
        vec2 aCam = normalize(cameraPosition.xz - position.xz + vec2(1e-4));
        vA = smoothstep(0.35, 0.75, dot(aCam, normalize(dir)));     // só de frente (até ~65°)
        vCor = cor;
        // puxa o ponto 1,2 m para a câmera: de longe a profundidade empata com o braço do próprio semáforo (meio metro
        // atrás) e o braço cortava o brilho; 1,2 m não atravessa prédio nenhum
        mv.xyz += normalize(-mv.xyz) * 1.2;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vCor; varying float vA, vMiolo;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (vA < 0.05) discard;
        if (d < vMiolo) { gl_FragColor = vec4(vCor, 1.0); return; }          // miolo sólido (a lâmpada "acesa" de longe)
        float a = pow(max(0.0, 1.0 - d), 1.3) * vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vCor * (0.75 + 0.25 * a) * a, 0.0);               // brilho somado
      }`,
    transparent: true, depthWrite: false, blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false; pts.renderOrder = 5;
  const _v = new THREE.Vector2();
  pts.onBeforeRender = (r, s, cam) => {           // pixels por metro a 1 m: altura do buffer / (2·tan(fov/2))
    mat.uniforms.escala.value = r.getDrawingBufferSize(_v).y / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
    mat.uniforms.minPx.value = Math.max(24, _v.y / 26);
    mat.uniforms.miolMin.value = Math.max(16, _v.y / 75);     // 844 @1,5 → 16,9 px (≥ 10 px de altura, com folga)
  };
  scene.add(pts);
  return {
    pontos: pts, material: mat,
    poe(i, x, y, z, c) { pos.set([x, y, z], i * 3); _c.set(c); cor.set([_c.r, _c.g, _c.b], i * 3); },
    pronto() { g.attributes.position.needsUpdate = true; g.attributes.cor.needsUpdate = true; },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// "POW!" da batida (spec 006): 1 sprite com estrela amarela, letras e fumacinha desenhadas num canvas. Aparece em cima
// dos carros, cresce com um pulinho, sobe e some (~1,3 s). Sem luz.
// ---------------------------------------------------------------------------------------------------------------
export function criarPow(scene) {
  const tex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = 'rgba(235,235,240,.92)';                                    // fumacinha
    for (const [x, y, r] of [[48, 196, 34], [86, 218, 28], [200, 200, 36], [166, 226, 26], [36, 150, 22], [222, 150, 24]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    g.beginPath();                                                            // estrela de 12 pontas
    for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12, r = k % 2 ? 62 : 112; g.lineTo(128 + Math.cos(a) * r, 120 + Math.sin(a) * r * 0.85); }
    g.closePath(); g.fillStyle = '#ffe14d'; g.fill(); g.lineWidth = 9; g.strokeStyle = '#ff3b2f'; g.lineJoin = 'round'; g.stroke();
    g.font = '900 72px "Trebuchet MS", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = '#fff'; g.strokeText('POW!', 128, 124);
    g.fillStyle = '#e8262f'; g.fillText('POW!', 128, 124);
  }, false);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true });
  const sp = new THREE.Sprite(mat);
  sp.renderOrder = 10; sp.visible = false; scene.add(sp);
  let vida = 0, x0 = 0, z0 = 0;
  const DUR = 1.3;
  return {
    sprite: sp,
    get visivel() { return sp.visible; },
    mostrar(x, z) { x0 = x; z0 = z; vida = DUR; sp.visible = true; },
    esconder() { vida = 0; sp.visible = false; },
    atualizar(dt) {
      if (vida <= 0) return;
      vida -= dt;
      const k = 1 - Math.max(0, vida) / DUR;                     // 0 → 1
      const s = 2.8 * (k < 0.15 ? k / 0.15 * 1.25 : k < 0.3 ? 1.25 - (k - 0.15) / 0.15 * 0.25 : 1);
      sp.scale.set(s, s, 1); sp.position.set(x0, 2.6 + k * 1.2, z0);
      mat.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      if (vida <= 0) sp.visible = false;
    },
  };
}

function junta(partes) {          // [{ geo, x, y, z, rx?, ry?, rz?, cor? }] → uma BufferGeometry com cor por vértice
  const pos = [], nor = [], col = [], idx = [];
  let base = 0;
  const m = new THREE.Matrix4(), c = new THREE.Color();
  for (const p of partes) {
    const g = p.geo.index ? p.geo : p.geo;
    _e.set(p.rx || 0, p.ry || 0, p.rz || 0); _q.setFromEuler(_e);
    m.compose(_p.set(p.x || 0, p.y || 0, p.z || 0), _q, _s.set(p.sx || 1, p.sy || 1, p.sz || 1));
    g.applyMatrix4(m);
    c.set(p.cor ?? '#ffffff');
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(c.r, c.g, c.b); }
    if (g.index) for (const k of g.index.array) idx.push(k + base); else for (let i = 0; i < P.count; i++) idx.push(i + base);
    base += P.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// o carrinho do trânsito: lataria (pinta por instância) + detalhes (vidro, teto, rodas, faróis, motorista)
function geoCarrinho({ motorista = true, ladosRoda = 12 } = {}) {   // spec 043: parado = sem motorista, roda de 8 lados
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const lataria = junta([
    { geo: B(1.7, 0.6, 3.3), y: 0.7 }, { geo: B(1.66, 0.18, 1.0), y: 1.04, z: 1.1 },
    ...[[0.72, 0.58], [-0.72, 0.58], [0.72, -1.06], [-0.72, -1.06]].map(([x, z]) => ({ geo: B(0.1, 0.75, 0.12), x, y: 1.38, z })),
    ...[-0.92, 0.92].map(x => ({ geo: B(0.22, 0.16, 0.1), x, y: 1.2, z: 0.5 })),
  ]);
  const roda = () => new THREE.CylinderGeometry(0.4, 0.4, 0.3, ladosRoda);
  const detalhes = junta([
    { geo: B(1.5, 0.75, 1.7), y: 1.38, z: -0.25, cor: '#9fd8ff' },
    { geo: B(1.62, 0.14, 1.85), y: 1.8, z: -0.25, cor: '#ffffff' },
    { geo: B(1.76, 0.24, 0.2), y: 0.5, z: 1.66, cor: '#ffffff' }, { geo: B(1.76, 0.24, 0.2), y: 0.5, z: -1.66, cor: '#ffffff' },
    ...[-0.55, 0.55].flatMap(x => [{ geo: B(0.32, 0.22, 0.06), x, y: 0.84, z: 1.67, cor: '#fff6c8' }, { geo: B(0.34, 0.2, 0.06), x, y: 0.84, z: -1.67, cor: '#ff2030' }]),
    ...[[-0.82, 1.08], [0.82, 1.08], [-0.82, -1.08], [0.82, -1.08]].map(([x, z]) => ({ geo: roda(), x, y: 0.4, z, rz: Math.PI / 2, cor: '#26262e' })),
    ...(motorista ? [{ geo: new THREE.SphereGeometry(0.24, 10, 8), x: 0.38, y: 1.52, z: -0.35, cor: '#f7d0bb' }] : []),     // motorista
  ]);
  return { lataria, detalhes };
}
// spec 035: carros do estacionamento (os parados nas vagas e os que andam no pátio), o mesmo carrinho do trânsito
export function criarCarrosPatio(scene, parados, nMoveis) {
  // spec 043: os parados (centenas, nas vagas de todas as ruas) usam o carrinho leve; os que andam no pátio, o completo
  const leve = geoCarrinho({ motorista: false, ladosRoda: 8 }), cheio = geoCarrinho();
  const CORES_M = ['#ff8a3d', '#3ad1ff'];
  const grupo = (g, n) => {
    const lat = new THREE.InstancedMesh(g.lataria, new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, n));
    const det = new THREE.InstancedMesh(g.detalhes, new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), Math.max(1, n));
    lat.count = det.count = n;
    for (const im of [lat, det]) { im.frustumCulled = false; scene.add(im); }
    return { lat, det };
  };
  const P = grupo(leve, parados.length), M = grupo(cheio, nMoveis);
  parados.forEach((p, i) => { poe(P.lat, i, p.x, 0, p.z, 1, 1, 1, p.heading); P.det.setMatrixAt(i, _m); P.lat.setColorAt(i, _c.set(p.cor)); });
  for (let k = 0; k < nMoveis; k++) M.lat.setColorAt(k, _c.set(CORES_M[k % 2]));
  for (const g of [P, M]) { g.lat.instanceMatrix.needsUpdate = g.det.instanceMatrix.needsUpdate = true; if (g.lat.instanceColor) g.lat.instanceColor.needsUpdate = true; }
  return {
    sync(moveis) {
      moveis.forEach((c, k) => { poe(M.lat, k, c.x, 0, c.z, 1, 1, 1, c.heading); M.det.setMatrixAt(k, _m); });
      M.lat.instanceMatrix.needsUpdate = M.det.instanceMatrix.needsUpdate = true;
    },
  };
}
export function criarAtores(scene, T) {
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  // --- carros: lataria (cor de cada carro) + detalhes (vidro, teto, rodas, faróis) -------------------------------
  const { lataria, detalhes } = geoCarrinho();
  const matCor = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const matVtx = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  const nC = Math.max(1, T.carros.length);
  const imLat = new THREE.InstancedMesh(lataria, matCor, nC), imDet = new THREE.InstancedMesh(detalhes, matVtx, nC);
  T.carros.forEach((c, i) => imLat.setColorAt(i, _c.set(c.cor)));
  imLat.count = imDet.count = T.carros.length;
  for (const im of [imLat, imDet]) { im.frustumCulled = false; scene.add(im); }

  // --- pedestres: camiseta (cor de cada um) + cabeça, cabelo e pernas ---------------------------------------------
  const corpo = junta([{ geo: new THREE.CapsuleGeometry(0.26, 0.42, 3, 10), y: 0.92 }]);
  const resto = junta([
    { geo: new THREE.SphereGeometry(0.27, 12, 10), y: 1.55, cor: '#f7d0bb' },
    { geo: new THREE.SphereGeometry(0.285, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), y: 1.6, z: -0.03, cor: '#6a4128' },
    { geo: B(0.14, 0.55, 0.16), x: -0.11, y: 0.3, cor: '#3d5a99' }, { geo: B(0.14, 0.55, 0.16), x: 0.11, y: 0.3, cor: '#3d5a99' },
  ]);
  const nP = Math.max(1, T.pedestres.length);
  const imCorpo = new THREE.InstancedMesh(corpo, matCor, nP), imResto = new THREE.InstancedMesh(resto, matVtx, nP);
  T.pedestres.forEach((p, i) => imCorpo.setColorAt(i, _c.set(p.cor)));
  imCorpo.count = imResto.count = T.pedestres.length;
  for (const im of [imCorpo, imResto]) { im.frustumCulled = false; scene.add(im); }

  function sync() {
    T.carros.forEach((c, i) => {        // c.sacode > 0: acabou de bater (spec 006), balança um pouquinho
      const sac = c.sacode > 0 ? Math.sin(c.sacode * 45) * 0.12 * c.sacode / 0.6 : 0;
      poe(imLat, i, c.x, 0, c.z, 1, 1, 1, c.heading + sac); imDet.setMatrixAt(i, _m);
    });
    T.pedestres.forEach((p, i) => {
      const anda = p.estado === 'andando' || p.estado === 'atravessando';
      const y = anda ? Math.abs(Math.sin(p.passo * 3.2)) * 0.09 : 0;
      const e = p.estado === 'fora' ? 0.0001 : p.crianca ? 0.72 : 1;      // spec 025: criança menor; "fora" = escondida
      poe(imCorpo, i, p.x, 0.2 + y, p.z, e, e, e, p.heading); imResto.setMatrixAt(i, _m);
    });
    for (const im of [imLat, imDet, imCorpo, imResto]) im.instanceMatrix.needsUpdate = true;
  }
  sync();
  return { sync };
}

// alfinete cor-de-rosa girando em cima do destino + anel no chão
export function criarMarcador(scene, x, z) {
  const g = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color: 0xff4fa3, emissive: 0x8a1050 });
  const bola = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), mat); bola.position.y = 1.6;
  const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.8, 16).rotateX(Math.PI), mat); ponta.position.y = 0.3;
  const pin = new THREE.Group(); pin.add(bola, ponta); pin.position.y = 3; g.add(pin);
  const anel = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.4, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff4fa3 }));
  anel.position.y = 0.05; g.add(anel);
  g.position.set(x, 0, z); scene.add(g);
  // tema (spec 015): rosa ou azul
  const tema = (cor, brilho) => { mat.color.set(cor); mat.emissive.set(brilho); anel.material.color.set(cor); };
  return { atualizar(t) { pin.position.y = 3 + Math.sin(t * 3) * 0.4; pin.rotation.y = t * 1.5; }, grupo: g, tema };
}

// ---------------------------------------------------------------------------------------------------------------
// Setas da rota: setas rosas pintadas no asfalto antes de cada conversão (3 por curva, na faixa da direita) e uma
// seta grande flutuando no cruzamento da PRÓXIMA conversão. `definir(conv)` (re)monta para a rota atual (o GPS pode
// recalcular); `proxima(id, d, t)` a cada quadro. 2 InstancedMesh (esq/dir) + 1 placa = 3 draw calls.
// ---------------------------------------------------------------------------------------------------------------
const SETA_CHAO_ANTES = [14, 26, 38, 50];           // m antes do meio da curva
const SETA_GRANDE_M = 120;                      // a placa aparece a até 120 m da conversão
function texSetaChao(lado, cor = '#ff4fa3') {
  return canvasTex(128, 256, (g, w, h) => {
    if (lado === 'esq') { g.translate(w, 0); g.scale(-1, 1); }       // desenha "vira à direita" e espelha
    g.lineCap = 'round'; g.lineJoin = 'round';
    const traco = () => { g.beginPath(); g.moveTo(54, 240); g.lineTo(54, 120); g.quadraticCurveTo(54, 78, 92, 78); g.stroke(); };
    const ponta = () => { g.beginPath(); g.moveTo(84, 42); g.lineTo(122, 78); g.lineTo(84, 114); g.closePath(); g.fill(); g.stroke(); };
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 46; traco(); g.lineWidth = 14; ponta();
    g.strokeStyle = cor; g.fillStyle = cor; g.lineWidth = 28; traco(); g.lineWidth = 2; ponta();
  }, false);
}
export function criarSetasRota(scene, bairro) {
  const geo = new THREE.PlaneGeometry(3, 6).rotateX(-Math.PI / 2);
  const naZebra = (x, z) => bairro.faixas.some(f => Math.hypot(f.x - x, f.z - z) < 7);
  const mat = lado => new THREE.MeshBasicMaterial({ map: texSetaChao(lado), transparent: true, depthWrite: false, opacity: 0.92 });
  const MAX = 24, chao = {};
  for (const lado of ['esq', 'dir']) {
    const im = new THREE.InstancedMesh(geo, mat(lado), MAX);
    im.count = 0; im.frustumCulled = false; im.renderOrder = 7; scene.add(im); chao[lado] = im;
  }
  // placa grande: seta apontando para +x (direita do motorista); 'esq' espelha. Contorno branco atrás.
  const forma = s => {
    const f = new THREE.Shape();
    f.moveTo(-2.2 * s, 0.7 * s); f.lineTo(0.6 * s, 0.7 * s); f.lineTo(0.6 * s, 1.6 * s); f.lineTo(2.4 * s, 0);
    f.lineTo(0.6 * s, -1.6 * s); f.lineTo(0.6 * s, -0.7 * s); f.lineTo(-2.2 * s, -0.7 * s); f.closePath();
    return new THREE.ShapeGeometry(f);
  };
  const placa = new THREE.Group(), seta = new THREE.Group(); placa.add(seta);
  const fundo = new THREE.Mesh(forma(1.18), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  const frente = new THREE.Mesh(forma(1), new THREE.MeshBasicMaterial({ color: 0xff4fa3, side: THREE.DoubleSide }));
  fundo.position.z = -0.05; frente.position.set(0.05, 0, 0.02); seta.add(fundo, frente);
  placa.visible = false; scene.add(placa);
  let lista = [];
  function definir(conv) {
    const P = conv.P, ponto = s => { let i = 0; while (i < P.length - 1 && P[i].s < s) i++; return P[i]; };
    lista = conv.lista.map(k => { const a = ponto(k.s - 16); return { ...k, hEntra: a.h, ax: a.x, az: a.z }; });
    const n = { esq: 0, dir: 0 };
    for (const k of lista) {
      if (k.rotula) continue;                    // na rótula a seta do chão ficaria no meio do anel: só a placa
      for (const antes of SETA_CHAO_ANTES) {
        if (k.s - antes < 3 || n[k.lado] >= MAX) continue;
        const p = ponto(k.s - antes);
        if (naZebra(p.x, p.z)) continue;
        poe(chao[k.lado], n[k.lado]++, p.x, 0.06, p.z, 1, 1, 1, p.h + Math.PI);
      }
    }
    for (const lado of ['esq', 'dir']) { chao[lado].count = n[lado]; chao[lado].instanceMatrix.needsUpdate = true; }
    placa.visible = false;
  }
  // próxima conversão (id, distância em m) → placa no cruzamento, de frente para quem chega, balançando
  function proxima(id, d, t, cam) {
    const k = id && d <= SETA_GRANDE_M ? lista.find(c => c.id === id) : null;
    placa.visible = !!k;
    if (!k) return;
    const h = k.hEntra, fx = Math.sin(h), fz = Math.cos(h);
    // de longe: além do cruzamento e bem alta (não some atrás do semáforo). Chegando (40 → 15 m): desce para dentro
    // da rua de saída, mais baixa — fica na tela bem na hora de virar e mostra por onde ir. Na rótula: sempre na saída.
    const f = Math.max(0, Math.min(1, (40 - d) / 25)), sx = Math.sin(k.hSaida), sz = Math.cos(k.hSaida);
    const lx = k.rotula ? k.x + sx * 3 : k.x + fx * 9, lz = k.rotula ? k.z + sz * 3 : k.z + fz * 9;
    const px = k.x + sx * 12, pz = k.z + sz * 12;
    placa.position.set(lx + (px - lx) * f, 8 - 3.5 * f + Math.sin(t * 3) * 0.4, lz + (pz - lz) * f);
    // sempre de frente para a câmera; a seta aponta para o lado (da tela) em que fica a rua de saída
    const yaw = Math.atan2(cam.x - placa.position.x, cam.z - placa.position.z);
    placa.rotation.y = yaw;
    const lado = sx * Math.cos(yaw) - sz * Math.sin(yaw) >= 0 ? 1 : -1;      // saída · direita da tela
    seta.scale.set(lado, 1, 1);
    seta.position.x = lado * Math.sin(t * 6) * 0.3;     // "empurra" para o lado da curva
    placa.scale.setScalar(1.7);
  }
  // tema (spec 015): redesenha as setas do chão e pinta a placa na cor do tema
  function tema(cor) {
    for (const lado of ['esq', 'dir']) { const m = chao[lado].material; m.map.dispose(); m.map = texSetaChao(lado, cor); m.needsUpdate = true; }
    frente.material.color.set(cor);
  }
  return { definir, proxima, chao, placa, tema };
}

// ---------------------------------------------------------------------------------------------------------------
// Bicicleta e ambulância (specs 023/024): desenho simples, escondidos quando a missão não tem ou já passaram.
// `sync(lista, t)` com o que `vivos.lista()` devolve. Giroflex alterna vermelho/azul trocando o material.
// ---------------------------------------------------------------------------------------------------------------
export function criarVivosMesh(scene) {
  const L = o => new THREE.MeshLambertMaterial(o);
  // bicicleta + ciclista de capacete (local: +z = frente)
  const bike = new THREE.Group();
  const pneu = new THREE.TorusGeometry(0.33, 0.05, 6, 16).rotateY(Math.PI / 2), escuro = L({ color: 0x222228 });
  for (const z of [-0.55, 0.55]) { const r = new THREE.Mesh(pneu, escuro); r.position.set(0, 0.36, z); bike.add(r); }
  const quadro = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.0), L({ color: 0x1fae4b })); quadro.position.set(0, 0.62, 0); bike.add(quadro);
  const corpo = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.34), new THREE.MeshBasicMaterial({ color: 0xffd400 }));   // colete amarelo (aparece de longe)
  corpo.position.set(0, 1.12, -0.1); corpo.rotation.x = 0.35; bike.add(corpo);
  const cabeca = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), L({ color: 0xf7d0bb })); cabeca.position.set(0, 1.55, 0.08); bike.add(cabeca);
  const capacete = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), L({ color: 0xe8262f })); capacete.position.set(0, 1.58, 0.08); bike.add(capacete);
  for (const x of [-0.12, 0.12]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), L({ color: 0x3a5fd0 })); p.position.set(x, 0.62, 0.05); bike.add(p); }
  bike.scale.setScalar(1.4); bike.visible = false; scene.add(bike);
  // ambulância: van branca com faixa vermelha, cruz nas laterais e giroflex
  const amb = new THREE.Group();
  const branco = L({ color: 0xffffff }), vermelho = L({ color: 0xe8262f });
  const cx = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.1, 4.8), branco); cx.position.y = 1.35; amb.add(cx);
  const faixa = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.28, 4.84), vermelho); faixa.position.y = 1.0; amb.add(faixa);
  const vidro = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 0.06), L({ color: 0x9fd8ff })); vidro.position.set(0, 1.85, 2.41); amb.add(vidro);
  const texCruz = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8262f'; g.fillRect(24, 8, 16, 48); g.fillRect(8, 24, 48, 16); }, false);
  for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: texCruz })); c.position.set(s * 1.07, 1.7, -0.6); c.rotation.y = s * Math.PI / 2; amb.add(c); }
  for (const z of [-1.5, 1.5]) for (const x of [-0.95, 0.95]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12).rotateZ(Math.PI / 2), escuro); r.position.set(x, 0.38, z); amb.add(r); }
  const luzV = new THREE.MeshBasicMaterial({ color: 0xff2a2a }), luzA = new THREE.MeshBasicMaterial({ color: 0x2a6aff }), apagada = new THREE.MeshBasicMaterial({ color: 0x333344 });
  const gV = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.35), luzV), gA = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.35), luzA);
  gV.position.set(-0.4, 2.52, 1.6); gA.position.set(0.4, 2.52, 1.6); amb.add(gV, gA);
  amb.visible = false; scene.add(amb);
  // specs 027/028: cachorro caramelo, bola e a criança que corre atrás dela (local: +z = frente)
  const cao = new THREE.Group(), pelo = L({ color: 0xc98a3a });
  const tronco = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.95), pelo); tronco.position.y = 0.62; cao.add(tronco);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.38), pelo); cab.position.set(0, 0.9, 0.58); cao.add(cab);
  for (const x of [-0.13, 0.13]) { const o = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.08), L({ color: 0x8a5a2a })); o.position.set(x, 1.12, 0.52); cao.add(o); }
  const rabo = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.4), pelo); rabo.position.set(0, 0.85, -0.6); rabo.rotation.x = -0.6; cao.add(rabo);
  const patas = [];
  for (const [x, z] of [[-0.14, 0.32], [0.14, 0.32], [-0.14, -0.32], [0.14, -0.32]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.42, 0.11), pelo); p.position.set(x, 0.22, z); cao.add(p); patas.push(p); }
  cao.scale.setScalar(1.25); cao.visible = false; scene.add(cao);
  const texBola = canvasTex(64, 32, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#222'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(i * 11 + 5, (i % 2) * 16 + 8, 5, 0, 7); g.fill(); } }, false);
  const bola = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), new THREE.MeshLambertMaterial({ map: texBola }));
  bola.visible = false; scene.add(bola);
  const crianca = new THREE.Group();
  const cc = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.28), new THREE.MeshBasicMaterial({ color: 0xff5fa8 })); cc.position.y = 0.95; crianca.add(cc);
  const ch = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), L({ color: 0xf7d0bb })); ch.position.y = 1.42; crianca.add(ch);
  const pernas = [];
  for (const x of [-0.1, 0.1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.55, 0.13), L({ color: 0x3a5fd0 })); p.position.set(x, 0.38, 0); crianca.add(p); pernas.push(p); }
  crianca.visible = false; scene.add(crianca);
  // spec 040: trator verde (rodão atrás, rodinha na frente, cabine e giroflex laranja) com o agricultor de chapéu
  const trator = new THREE.Group(), verde = L({ color: 0x2f9e44 });
  const capo = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 2.0), verde); capo.position.set(0, 1.15, 0.7); trator.add(capo);
  const cabine = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.4), verde); cabine.position.set(0, 1.9, -0.8); trator.add(cabine);
  const vidroT = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.42), L({ color: 0xbfe8ff })); vidroT.position.set(0, 2.25, -0.8); trator.add(vidroT);
  const teto = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 1.6), L({ color: 0xf4f4f4 })); teto.position.set(0, 2.75, -0.8); trator.add(teto);
  const rodaoG = new THREE.CylinderGeometry(0.85, 0.85, 0.5, 14).rotateZ(Math.PI / 2), rodinhaG = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12).rotateZ(Math.PI / 2);
  const rodas = [];
  for (const x of [-1.0, 1.0]) { const r = new THREE.Mesh(rodaoG, escuro); r.position.set(x, 0.85, -0.9); trator.add(r); rodas.push(r); }
  for (const x of [-0.7, 0.7]) { const r = new THREE.Mesh(rodinhaG, escuro); r.position.set(x, 0.45, 1.3); trator.add(r); rodas.push(r); }
  for (const x of [-1.0, 1.0]) { const ar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), L({ color: 0xffd23f })); ar.position.set(x, 0.85, -0.9); trator.add(ar); }
  const giro = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), new THREE.MeshBasicMaterial({ color: 0xff8a00 })); giro.position.set(0, 2.92, -0.8); trator.add(giro);
  const chapeu = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 12), L({ color: 0xe8c36a })); chapeu.position.set(0, 2.45, -0.8); trator.add(chapeu);
  trator.visible = false; scene.add(trator);
  return {
    sync(l, t) {
      const b = l.bicicletas[0], a = l.ambulancias[0];
      const tr = tipo => (l.travessias || []).find(o => o.tipo === tipo);
      for (const [obj, o, membros] of [[cao, tr('cachorro'), patas], [crianca, tr('crianca'), pernas]]) {
        obj.visible = !!o;
        if (o) { obj.position.set(o.x, 0, o.z); obj.rotation.y = o.heading; membros.forEach((m, i) => { m.rotation.x = o.andando ? Math.sin(t * 14 + i * Math.PI) * 0.5 : 0; }); }
      }
      const bo = tr('bola'); bola.visible = !!bo;
      if (bo) { bola.position.set(bo.x, 0.32, bo.z); bola.rotation.x = t * 12; }
      bike.visible = !!b; if (b) { bike.position.set(b.x, 0, b.z); bike.rotation.y = b.heading; }
      const tt = (l.tratores || [])[0];
      trator.visible = !!tt;
      if (tt) { trator.position.set(tt.x, 0, tt.z); trator.rotation.y = tt.heading; rodas.forEach(r => { r.rotation.x = -t * tt.v * 1.4; }); giro.visible = Math.floor(t * 3) % 2 === 0; }
      amb.visible = !!a;
      if (a) {
        amb.position.set(a.x, 0, a.z); amb.rotation.y = a.heading;
        const fase = Math.floor(t * 6) % 2;          // pisca 3 Hz alternando
        gV.material = fase ? luzV : apagada; gA.material = fase ? apagada : luzA;
      }
    },
    bike, amb, trator,
  };
}
