// Spec 015 — o Centro de Chapecó em 3D a partir de dados/centro.json: chão, praças, calçadas, ruas, prédios e o nome dos
// marcos (Catedral, Prefeitura…). Tudo junto em poucas malhas (1 por material) para o celular aguentar.
import * as THREE from '../../vendor/three.module.js';
import { canvasTex, poe, octogono, desenhaRadar } from '../mundo.js';

// spec 044: cores de cidade (suaves, ainda alegres) — a textura das janelas é branca e a cor de cada prédio a tinge
const CORES = ['#f6efe4', '#efe3cf', '#f7d9c4', '#dbe8f3', '#e9e0f2', '#f4e6b8', '#e0ecd9', '#f8d6de', '#e6e6e6', '#f2d2b0'];

// junta geometrias (sem índice) numa só, com cor por vértice
function junta(lista) {
  let n = 0;
  for (const { g } of lista) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), cor = new Float32Array(n * 3);
  let o = 0;
  const c = new THREE.Color();
  for (const { g, cor: k } of lista) {
    const gi = g.index ? g.toNonIndexed() : g, p = gi.attributes.position.array, q = gi.attributes.normal.array, m = gi.attributes.position.count;
    pos.set(p, o * 3); nor.set(q, o * 3);
    c.set(k);
    for (let i = 0; i < m; i++) { cor[(o + i) * 3] = c.r; cor[(o + i) * 3 + 1] = c.g; cor[(o + i) * 3 + 2] = c.b; }
    o += m;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  return g;
}

// faixa (fita) de largura `w` ao longo da polilinha, em y; com um disquinho em cada junta para não abrir fresta
function fita(pontos, w, y, saida) {
  const h = w / 2;
  for (let i = 0; i < pontos.length - 1; i++) {
    const [ax, az] = pontos[i], [bx, bz] = pontos[i + 1], L = Math.hypot(bx - ax, bz - az);
    if (L < 0.01) continue;
    const nx = -(bz - az) / L * h, nz = (bx - ax) / L * h;
    saida.push(ax + nx, y, az + nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz);
    saida.push(ax + nx, y, az + nz, bx - nx, y, bz - nz, ax - nx, y, az - nz);
  }
  for (const [x, z] of pontos) {
    const N = 10;
    for (let k = 0; k < N; k++) {
      const a0 = k / N * Math.PI * 2, a1 = (k + 1) / N * Math.PI * 2;
      saida.push(x, y, z, x + Math.cos(a1) * h, y, z + Math.sin(a1) * h, x + Math.cos(a0) * h, y, z + Math.sin(a0) * h);
    }
  }
}
const plano = (arr, mat) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
};

export function criarMundoCentro(scene, dados) {
  const L = dados.limites, cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
  scene.background = new THREE.Color(0xa9dcff);
  scene.fog = new THREE.Fog(0xd8eeff, 220, 650);
  // chão: concreto claro de cidade (spec 044 — antes era gramado); só as praças ficam verdes
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(L.x1 - L.x0 + 1400, L.z1 - L.z0 + 1400).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xdcd6c9 }));
  chao.position.set(cx, 0, cz); scene.add(chao);
  // praças
  const verde = new THREE.MeshLambertMaterial({ color: 0x86d65e });
  for (const p of dados.pracas) {
    const s = new THREE.Shape(p.p.map(([x, z]) => new THREE.Vector2(x, -z)));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2), verde); m.position.y = 0.015; scene.add(m);
  }
  // calçadas (mais largas, embaixo) e asfalto (em cima): 2 malhas para todas as ruas
  const calc = [], asf = [];
  for (const r of dados.ruas) { fita(r.pontos, r.largura + 3.2, 0.02, calc); fita(r.pontos, r.largura, 0.04, asf); }
  scene.add(plano(calc, new THREE.MeshLambertMaterial({ color: 0xece3d3 })));
  const asfalto = plano(asf, new THREE.MeshLambertMaterial({ color: 0x6a7080 }));
  scene.add(asfalto);
  // (a linha amarela do meio agora é da criarPinturaCentro — spec 055)
  // prédios (spec 044): paredes com janelas (1 módulo = 3,2 m de largura × 3 m de andar), térreo com vitrine e laje por
  // cima um pouco mais escura. 3 malhas para os 900 prédios; a cor de cada prédio vem por vértice.
  const M_L = 3.2, ANDAR = 3, TERREO = 3.4;
  const texJanela = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f0ece6'; g.fillRect(0, h - 10, w, 10);                                   // friso entre andares
    g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(30, 26, 68, 66, 10); g.fill();       // moldura
    g.fillStyle = '#8fb3cc'; g.beginPath(); g.roundRect(36, 32, 56, 54, 7); g.fill();        // vidro
    g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(40, 36, 14, 46);                       // reflexo
  });
  const texVitrine = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8e2d8'; g.fillRect(0, 0, w, 20);                                         // faixa do letreiro
    g.fillStyle = '#ffffff'; g.fillRect(10, 28, 108, 100);
    g.fillStyle = '#a9cbdc'; g.fillRect(16, 34, 96, 94);                                      // vitrine
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(22, 40, 18, 80);
  });
  const parede = { pos: [], nor: [], uv: [], cor: [] }, terreo = { pos: [], nor: [], uv: [], cor: [] }, laje = { pos: [], nor: [], cor: [] };
  const liso = { pos: [], nor: [], uv: [], cor: [] };           // igrejas e a Catedral: parede lisa (sem janela de apartamento)
  const _c = new THREE.Color();
  const tom = b => b.tipo === 'cathedral' || b.tipo === 'church' ? '#fff8ec' : b.tipo === 'civic' || b.tipo === 'public' ? '#ffe7a8' : CORES[b.c % CORES.length];
  function faixaParede(A, pts, y0, y1, k, v0, altura) {
    let u = 0;
    const cxp = pts.reduce((s, p) => s + p[0], 0) / pts.length, czp = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
      if (L < 0.05) continue;
      let nx = -dz / L, nz = dx / L;                                         // normal para fora (longe do centro)
      const fora = ((ax + bx) / 2 - cxp) * nx + ((az + bz) / 2 - czp) * nz > 0;
      if (!fora) { nx = -nx; nz = -nz; }
      const u0 = u / M_L, u1 = (u + L) / M_L, w0 = (y0 - v0) / altura, w1 = (y1 - v0) / altura;
      // (a0,b0,b1) tem normal (-dz,0,dx): se ela não é a de fora, inverte a ordem
      const q = [[ax, y0, az, u0, w0], [bx, y0, bz, u1, w0], [bx, y1, bz, u1, w1], [ax, y1, az, u0, w1]];
      const ordem = fora ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      for (const o of ordem) { const v = q[o]; A.pos.push(v[0], v[1], v[2]); A.nor.push(nx, 0, nz); A.uv.push(v[3], v[4]); A.cor.push(k.r, k.g, k.b); }
      u += L;
    }
  }
  let catedral = null;
  for (const b of dados.predios) {
    const pts = b.p.length > 3 && b.p[0][0] === b.p.at(-1)[0] && b.p[0][1] === b.p.at(-1)[1] ? b.p.slice(0, -1) : b.p;
    _c.set(tom(b));
    const h = b.h, t = Math.min(TERREO, h);
    if (b.tipo === 'cathedral' || b.tipo === 'church') faixaParede(liso, pts, 0, h, _c, 0, ANDAR);
    else {
      faixaParede(terreo, pts, 0, t, _c, 0, TERREO);
      if (h > t + 0.3) faixaParede(parede, pts, t, h, _c, t, ANDAR);
    }
    // laje: a planta triangulada em cima (um pouco mais escura), virada para cima
    const v2 = pts.map(([x, z]) => new THREE.Vector2(x, z)), tri = THREE.ShapeUtils.triangulateShape(v2, []);
    const kl = _c.clone().multiplyScalar(0.86);
    for (const [a, bb, cc] of tri) {
      const [x0, z0] = pts[a], [x1, z1] = pts[bb], [x2, z2] = pts[cc];
      const cima = (x1 - x0) * (z2 - z0) - (z1 - z0) * (x2 - x0) < 0;      // normal +y quando o giro em xz é horário
      for (const k of cima ? [a, bb, cc] : [a, cc, bb]) { laje.pos.push(pts[k][0], h, pts[k][1]); laje.nor.push(0, 1, 0); laje.cor.push(kl.r, kl.g, kl.b); }
    }
    if (b.tipo === 'cathedral') catedral = { b, pts };
  }
  const malha = (A, mat) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(A.nor, 3));
    if (A.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(A.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(A.cor, 3));
    const m = new THREE.Mesh(g, mat); scene.add(m); return m;
  };
  const predios = malha(parede, new THREE.MeshLambertMaterial({ map: texJanela, vertexColors: true }));
  malha(terreo, new THREE.MeshLambertMaterial({ map: texVitrine, vertexColors: true }));
  malha(laje, new THREE.MeshLambertMaterial({ vertexColors: true }));
  malha(liso, new THREE.MeshLambertMaterial({ vertexColors: true }));
  // Catedral: torre com telhado de 4 águas e cruz, numa ponta do prédio (perto do ponto mais longe do centro da planta)
  if (catedral) {
    const { b, pts } = catedral, cxp = pts.reduce((s, p) => s + p[0], 0) / pts.length, czp = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const ponta = pts.reduce((m, p) => (Math.hypot(p[0] - cxp, p[1] - czp) > Math.hypot(m[0] - cxp, m[1] - czp) ? p : m));
    const tx = ponta[0] + (cxp - ponta[0]) * 0.25, tz = ponta[1] + (czp - ponta[1]) * 0.25, H = b.h + 16, branco = new THREE.MeshLambertMaterial({ color: 0xfff8ec });
    const torre = new THREE.Mesh(new THREE.BoxGeometry(6, H, 6), branco); torre.position.set(tx, H / 2, tz); scene.add(torre);
    const teto = new THREE.Mesh(new THREE.ConeGeometry(4.6, 6, 4).rotateY(Math.PI / 4), new THREE.MeshLambertMaterial({ color: 0x9a6a4a })); teto.position.set(tx, H + 3, tz); scene.add(teto);
    const ouro = new THREE.MeshLambertMaterial({ color: 0xe8c36a });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.2, 0.4), ouro); c1.position.set(tx, H + 7.6, tz); scene.add(c1);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.4), ouro); c2.position.set(tx, H + 8.3, tz); scene.add(c2);
  }
  // nome dos marcos: placa flutuante (sprite) sobre o prédio
  for (const m of dados.marcos) {
    if (!/^(Catedral|Prefeitura|Câmara|Museu|Shopping)/.test(m.nome)) continue;   // spec 057: + o shopping
    const nome = m.nome.replace(/ e Museu.*$/, '').replace('Municipal de Chapecó', '').replace('de Vereadores de Chapecó', 'de Vereadores').trim();
    const tex = canvasTex(512, 96, (g, w, h) => {
      g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 30); g.fill();
      g.strokeStyle = '#ff4fa3'; g.lineWidth = 6; g.stroke();
      g.fillStyle = '#5a2a4a'; g.font = '900 40px Roboto, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      let f = 40; g.font = `900 ${f}px Roboto, Arial, sans-serif`;
      while (g.measureText(nome).width > w - 50 && f > 18) { f -= 2; g.font = `900 ${f}px Roboto, Arial, sans-serif`; }   // spec 044: cabe inteiro
      g.fillText(nome, w / 2, h / 2 + 2);
    }, false);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }));
    const alto = Math.max(...dados.predios.filter(b => Math.hypot(b.p[0][0] - m.x, b.p[0][1] - m.z) < 40).map(b => b.h), 10);
    sp.position.set(m.x, alto + 6, m.z); sp.scale.set(16, 3, 1); scene.add(sp);
  }
  return { atualizar() {}, predios, asfalto };
}

// ---------------------------------------------------------------------------------------------------------------
// Spec 044 — sinalização de verdade (de sinais.js): faixas brancas nas beiradas, zebras, linhas de parada, semáforos
// (as luzes mudam com a fase), placas de PARE e de radar. Pouca coisa e só onde o OSM marca (pedido: "não poluir").
// ---------------------------------------------------------------------------------------------------------------
// spec 055 — "miolo" de cruzamento: o ponto (x, z) cai na pista de OUTRA rua que corta esta (rumo diferente em > 25°).
// Rua que só continua a mesma (outro trecho do OSM, mesmo rumo) não conta.
function mioloDe(dados) {
  const CEL = 20, grade = new Map(), gk = (i, j) => i * 100003 + j;
  dados.ruas.forEach((r, ri) => {
    for (let i = 0; i < r.pontos.length - 1; i++) {
      const [ax, az] = r.pontos[i], [bx, bz] = r.pontos[i + 1], L = Math.hypot(bx - ax, bz - az);
      if (L < 0.05) continue;
      const sg = { ri, ax, az, ux: (bx - ax) / L, uz: (bz - az) / L, L, hw: r.largura / 2 }, m = sg.hw + 1;
      for (let a = Math.floor((Math.min(ax, bx) - m) / CEL); a <= Math.floor((Math.max(ax, bx) + m) / CEL); a++)
        for (let b = Math.floor((Math.min(az, bz) - m) / CEL); b <= Math.floor((Math.max(az, bz) + m) / CEL); b++) {
          const k = gk(a, b); if (!grade.has(k)) grade.set(k, []); grade.get(k).push(sg);
        }
    }
  });
  return (x, z, ri, h) => {
    const fx = Math.sin(h), fz = Math.cos(h);
    for (const sg of grade.get(gk(Math.floor(x / CEL), Math.floor(z / CEL))) || []) {
      if (sg.ri === ri || Math.abs(sg.ux * fx + sg.uz * fz) > 0.9) continue;          // mesma rua / mesmo rumo
      const dx = x - sg.ax, dz = z - sg.az, u = dx * sg.ux + dz * sg.uz;
      if (u < -0.5 || u > sg.L + 0.5) continue;
      if (Math.abs(-dx * sg.uz + dz * sg.ux) < sg.hw - 0.1) return true;
    }
    return false;
  };
}

const SINAL = 1.5;      // placas e semáforos um pouco maiores que o real (como no bairro), para ler de longe
export function criarSinaisCentro(scene, S, dados) {
  const branco = new THREE.MeshLambertMaterial({ color: 0xffffff });
  // linhas brancas nas beiradas das ruas largas (fita deslocada para cada lado), em passos de 1 m; spec 055: não
  // atravessam o miolo dos cruzamentos (pedaço que cai na pista de uma rua transversal)
  const borda = [], noMiolo = mioloDe(dados);
  dados.ruas.forEach((r, ri) => {
    if (r.largura < 6) return;
    const off = r.largura / 2 - 0.35, w = 0.07;
    for (let i = 0; i < r.pontos.length - 1; i++) {
      const [ax, az] = r.pontos[i], [bx, bz] = r.pontos[i + 1], L = Math.hypot(bx - ax, bz - az);
      if (L < 0.05) continue;
      const nx = -(bz - az) / L, nz = (bx - ax) / L, h = Math.atan2(bx - ax, bz - az);
      for (const sd of [-1, 1]) {                    // junta os metros seguidos fora do miolo numa fita só
        const o = sd * off, o1 = o - w, o2 = o + w, y = 0.05;
        const emite = (t1, t2) => {
          const x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1, x2 = ax + (bx - ax) * t2, z2 = az + (bz - az) * t2;
          borda.push(x1 + nx * o1, y, z1 + nz * o1, x2 + nx * o1, y, z2 + nz * o1, x2 + nx * o2, y, z2 + nz * o2,
            x1 + nx * o1, y, z1 + nz * o1, x2 + nx * o2, y, z2 + nz * o2, x1 + nx * o2, y, z1 + nz * o2);
        };
        let ini = null;
        for (let k = 0; k < L; k++) {
          const t1 = k / L, t2 = Math.min(L, k + 1) / L, tm = (t1 + t2) / 2;
          const fora = !noMiolo(ax + (bx - ax) * tm + nx * o, az + (bz - az) * tm + nz * o, ri, h);
          if (fora && ini === null) ini = t1;
          if (!fora && ini !== null) { emite(ini, t1); ini = null; }
        }
        if (ini !== null) emite(ini, 1);
      }
    }
  });
  scene.add(plano(borda, new THREE.MeshBasicMaterial({ color: 0xf4f4f4, side: THREE.DoubleSide })));
  // zebras e linhas de parada: caixinhas brancas instanciadas
  const pecas = [];
  for (const f of S.faixas) {
    const rx = -Math.cos(f.heading), rz = Math.sin(f.heading), n = Math.floor(f.comprimento / 1.0);
    for (let k = 0; k < n; k++) { const o = -f.comprimento / 2 + 0.5 + k; pecas.push([f.x + rx * o, f.z + rz * o, 0.5, f.largura, f.heading]); }
  }
  for (const l of [...S.semaforos.flatMap(s => s.linhas), ...S.pares.map(p => p.linha)]) {
    const rx = -Math.cos(l.heading), rz = Math.sin(l.heading), meia = l.mao ? l.largura / 4 : 0;   // mão dupla: só a metade da direita
    const larg = l.mao ? l.largura / 2 : l.largura;
    pecas.push([l.x + rx * meia, l.z + rz * meia, larg - 0.3, 0.5, l.heading]);
  }
  const imPeca = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.02, 1), branco, Math.max(1, pecas.length));
  pecas.forEach(([x, z, sx, sz, h], i) => poe(imPeca, i, x, 0.055, z, sx, 1, sz, h));
  imPeca.instanceMatrix.needsUpdate = true; scene.add(imPeca);
  // postes: semáforo (poste + caixa + 3 luzes, virado para quem chega) e placas na calçada da direita
  const naCalcada = (l, ladoM = 0.9) => { const rx = -Math.cos(l.heading), rz = Math.sin(l.heading), o = l.mao ? l.largura / 2 : l.largura / 2; return [l.x + rx * (o + ladoM), l.z + rz * (o + ladoM)]; };
  const escuro = new THREE.MeshLambertMaterial({ color: 0x30323c });
  const sems = S.semaforos.map(s => ({ s, l: s.linhas[0] }));
  const imPoste = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.13, 1, 6), escuro, Math.max(1, sems.length + S.pares.length + S.radares.length));
  const imCaixa = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 1.6, 0.4), escuro, Math.max(1, sems.length));
  const imLuz = new THREE.InstancedMesh(new THREE.CircleGeometry(0.19, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, sems.length * 3));
  let np = 0;
  const luzes = [];
  sems.forEach(({ s, l }, i) => {
    const [px, pz] = naCalcada(l), fx = Math.sin(l.heading), fz = Math.cos(l.heading);
    poe(imPoste, np++, px, 2.4, pz, 1, 4.8, 1);
    poe(imCaixa, i, px, 4.8, pz, SINAL, SINAL, SINAL, l.heading);
    for (let c = 0; c < 3; c++) {
      poe(imLuz, i * 3 + c, px - fx * 0.21 * SINAL, 4.8 + (0.48 - c * 0.48) * SINAL, pz - fz * 0.21 * SINAL, SINAL, SINAL, 1, l.heading + Math.PI);
      luzes.push({ id: s.id, c });
    }
  });
  // placas: PARE (octógono) e radar (velocidade + "fiscalização eletrônica"), viradas para quem chega
  const placa = (desenho, lista, larg, alt) => {
    if (!lista.length) return;
    const tex = canvasTex(256, Math.round(256 * alt / larg), desenho, false);
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(larg * SINAL, alt * SINAL), new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }), lista.length);
    lista.forEach((l, i) => { const [px, pz] = naCalcada(l); poe(im, i, px, 2.2 + alt * SINAL / 2, pz, 1, 1, 1, l.heading + Math.PI); poe(imPoste, np++, px, (2.2 + alt * SINAL / 2) / 2, pz, 1, 2.2 + alt * SINAL / 2, 1); });
    im.instanceMatrix.needsUpdate = true; scene.add(im);
  };
  placa((g, w, h) => {
    octogono(g, w / 2, h / 2, w / 2 - 4); g.fillStyle = '#fff'; g.fill();
    octogono(g, w / 2, h / 2, w / 2 - 18); g.fillStyle = '#e3121b'; g.fill();
    g.fillStyle = '#fff'; g.font = '900 78px Arial Black, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PARE', w / 2, h / 2 + 4);
  }, S.pares.map(p => p.linha), 1.0, 1.0);
  for (const v of [...new Set(S.radares.map(r => r.limiteKmh))])
    placa((g, w, h) => desenhaRadar(g, w, h, false, v), S.radares.filter(r => r.limiteKmh === v), 0.9, 1.35);
  imPoste.count = np; imPoste.instanceMatrix.needsUpdate = true;
  for (const im of [imPoste, imCaixa, imLuz]) { im.instanceMatrix.needsUpdate = true; scene.add(im); }
  imLuz.userData.dinamico = true;                   // spec 056: a cor muda por índice — não entra nos pedaços
  // luzes: só repinta quando alguma fase muda
  const ACESA = ['#ff2a2a', '#ffc81a', '#2bff6a'], APAGADA = ['#4d1717', '#4d3d12', '#123d22'], IDX = { vermelho: 0, amarelo: 1, verde: 2 }, _k = new THREE.Color();
  let chave = '';
  function atualizar(t) {
    const fases = sems.map(({ s }) => IDX[S.fase(s.id, t)]), k = fases.join('');
    if (k === chave) return;
    chave = k;
    luzes.forEach((L, i) => imLuz.setColorAt(i, _k.set(fases[Math.floor(i / 3)] === L.c ? ACESA[L.c] : APAGADA[L.c])));
    imLuz.instanceColor.needsUpdate = true;
  }
  atualizar(0);
  return { atualizar, nSemaforos: sems.length, nPares: S.pares.length, nFaixas: S.faixas.length, nRadares: S.radares.length };
}

// spec 044 — árvores e postes do Centro (posições de vida.js): 4 malhas instanciadas
export function criarVidaMesh(scene, vida) {
  const L = o => new THREE.MeshLambertMaterial(o), A = vida.arvores, P = vida.postes;
  const tronco = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.7, 1, 6), L({ color: 0x9a6a44 }), Math.max(1, A.length));
  const copa = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), L({ color: 0xffffff, flatShading: true }), Math.max(1, A.length));
  const VERDES = ['#4cc25a', '#5fd36a', '#3daf55', '#7ad65a'], _k = new THREE.Color();
  A.forEach((a, i) => { poe(tronco, i, a.x, a.r * 0.5, a.z, a.r * 0.18, a.r, a.r * 0.18); poe(copa, i, a.x, a.r * 1.35, a.z, a.r, a.r * 0.95, a.r); copa.setColorAt(i, _k.set(VERDES[i % 4])); });
  const haste = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.11, 1, 6), L({ color: 0x5a5f6b }), Math.max(1, P.length));
  const lamp = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.18, 0.9), L({ color: 0xf2f2e8 }), Math.max(1, P.length));
  P.forEach((p, i) => { poe(haste, i, p.x, 3.2, p.z, 1, 6.4, 1); poe(lamp, i, p.x, 6.4, p.z, 1, 1, 1, p.h); });
  tronco.count = copa.count = A.length; haste.count = lamp.count = P.length;
  for (const im of [tronco, copa, haste, lamp]) { im.instanceMatrix.needsUpdate = true; scene.add(im); }
  if (copa.instanceColor) copa.instanceColor.needsUpdate = true;
}

// ---------------------------------------------------------------------------------------------------------------
// spec 055 — pintura do chão (CTB Anexo II, sinalização horizontal; ver lei/ctb-conferido.md item 25):
// - mão dupla: linha AMARELA no meio (divide sentidos opostos) — contínua perto de cruzamento e de faixa de pedestre,
//   seccionada (3 m de traço, 6 m de espaço) no resto; não atravessa o miolo do cruzamento;
// - vagas: marcação BRANCA completa (linha que fecha a faixa das vagas + traço entre uma vaga e outra);
// - mão única: seta BRANCA "siga em frente" (5 m) antes do cruzamento, só nos trechos ≥ 30 m (não polui);
// - PARE: a legenda "PARE" branca no chão antes da linha de retenção.
export function criarPinturaCentro(scene, dados, S, vida) {
  const ch = (x, z) => x.toFixed(1) + ',' + z.toFixed(1);
  const uso = new Map();
  dados.ruas.forEach(r => new Set(r.pontos.map(q => ch(...q))).forEach(k => uso.set(k, (uso.get(k) || 0) + 1)));
  const CEL = 30, grade = new Map(), gk = (i, j) => i + ':' + j;
  const poeGrade = (x, z, v) => { const k = gk(Math.floor(x / CEL), Math.floor(z / CEL)); if (!grade.has(k)) grade.set(k, []); grade.get(k).push(v); };
  uso.forEach((n, k) => { if (n > 1) { const [x, z] = k.split(',').map(Number); poeGrade(x, z, { x, z, tipo: 0 }); } });   // cruzamentos
  S.faixas.forEach(f => poeGrade(f.x, f.z, { x: f.x, z: f.z, tipo: 1 }));                                                  // faixas de pedestre
  const perto = (x, z, raio, tipo) => {
    const i = Math.floor(x / CEL), j = Math.floor(z / CEL);
    for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++)
      for (const o of grade.get(gk(a, b)) || []) if (o.tipo === tipo && Math.hypot(o.x - x, o.z - z) < raio) return true;
    return false;
  };
  // fita no chão de (ax,az) a (bx,bz), deslocada `o` para o lado, com largura w
  const fita = (arr, ax, az, bx, bz, o, w, y = 0.056) => {
    const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) return;
    const nx = -(bz - az) / L, nz = (bx - ax) / L, o1 = o - w / 2, o2 = o + w / 2;
    arr.push(ax + nx * o1, y, az + nz * o1, bx + nx * o1, y, bz + nz * o1, bx + nx * o2, y, bz + nz * o2,
      ax + nx * o1, y, az + nz * o1, bx + nx * o2, y, bz + nz * o2, ax + nx * o2, y, az + nz * o2);
  };
  const amarelo = [], branco = [];
  // linha do meio (amarela) nas ruas de mão dupla, em passos de 1 m
  const noMiolo = mioloDe(dados);
  dados.ruas.forEach((r, ri) => {
    if (r.maoUnica || r.largura < 5) return;
    let s = 0;
    const passos = [];                                                       // pedaços de 1 m: pinta? (fora do miolo)
    for (let i = 0; i < r.pontos.length - 1; i++) {
      const [ax, az] = r.pontos[i], [bx, bz] = r.pontos[i + 1], L = Math.hypot(bx - ax, bz - az), h = Math.atan2(bx - ax, bz - az);
      for (let k = 0; k < L; k += 1) {
        const k2 = Math.min(L, k + 1), t1 = k / L, t2 = k2 / L, mx = ax + (bx - ax) * (t1 + t2) / 2, mz = az + (bz - az) * (t1 + t2) / 2;
        const continua = perto(mx, mz, 16, 0) || perto(mx, mz, 10, 1);
        passos.push({ fora: !noMiolo(mx, mz, ri, h), tinta: continua || ((s + (k + k2) / 2) % 9) <= 3,   // seccionada 3:6
          x1: ax + (bx - ax) * t1, z1: az + (bz - az) * t1, x2: ax + (bx - ax) * t2, z2: az + (bz - az) * t2 });
      }
      s += L;
    }
    for (let i = 0; i < passos.length; i++) {
      const p = passos[i];
      if (!p.fora || !p.tinta) continue;
      let a = i, b = i; while (a > 0 && passos[a - 1].fora) a--; while (b < passos.length - 1 && passos[b + 1].fora) b++;
      if (b - a < 3) continue;                                               // sobra entre dois miolos (canteiro): não pinta
      fita(amarelo, p.x1, p.z1, p.x2, p.z2, 0, 0.12);
    }
  });
  // vagas: linha que fecha a faixa das vagas + traços entre as vagas (do meio-fio até a linha)
  for (const v of vida.vagas || []) {
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading), rx = -Math.cos(v.heading), rz = Math.sin(v.heading);
    const ex = v.x - rx * 1.15, ez = v.z - rz * 1.15;                   // borda da vaga do lado da pista
    fita(branco, ex - fx * 3.5, ez - fz * 3.5, ex + fx * 3.5, ez + fz * 3.5, 0, 0.1);
    for (const d of [-3.5, 3.5]) {
      const qx = v.x + fx * d, qz = v.z + fz * d;
      fita(branco, qx - rx * 1.15, qz - rz * 1.15, qx + rx * 1.1, qz + rz * 1.1, 0, 0.1);
    }
  }
  const tinta = cor => new THREE.MeshBasicMaterial({ color: cor, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
  if (amarelo.length) scene.add(plano(amarelo, tinta(0xf2c230)));
  if (branco.length) scene.add(plano(branco, tinta(0xf4f4f4)));

  // setas e PARE: planos com textura, instanciados (2 draw calls)
  const setas = [], pares = [];
  const ocupado = (x, z) => perto(x, z, 7, 1) || S.semaforos.some(sm => sm.linhas.some(l => Math.hypot(l.x - x, l.z - z) < 7))
    || S.pares.some(p => Math.hypot(p.linha.x - x, p.linha.z - z) < 7);
  for (const r of dados.ruas) {
    if (!r.maoUnica || r.largura < 5) continue;
    const off = r.largura >= 6.5 ? -1.0 : 0, P = r.pontos, acum = [0];
    for (let i = 1; i < P.length; i++) acum.push(acum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    let a = 0;
    for (let i = 1; i < P.length; i++) {
      if (i < P.length - 1 && !(uso.get(ch(...P[i])) > 1)) continue;         // fim de trecho: cruzamento (ou fim da rua)
      const Lp = acum[i] - acum[a]; a = i;
      if (Lp < 30 || !(uso.get(ch(...P[i])) > 1)) continue;
      const alvo = acum[i] - 14;                                             // 14 m antes do cruzamento
      let j = 1; while (j < P.length - 1 && acum[j] < alvo) j++;
      const [px, pz] = P[j - 1], [qx, qz] = P[j], t = (alvo - acum[j - 1]) / Math.max(1e-6, acum[j] - acum[j - 1]);
      const h = Math.atan2(qx - px, qz - pz), x = px + (qx - px) * t - Math.cos(h) * off, z = pz + (qz - pz) * t + Math.sin(h) * off;
      if (!ocupado(x, z)) setas.push({ x, z, h });
    }
  }
  for (const p of S.pares) {
    const l = p.linha, fx = Math.sin(l.heading), fz = Math.cos(l.heading), rx = -Math.cos(l.heading), rz = Math.sin(l.heading);
    const meia = l.mao ? l.largura / 4 : 0;
    pares.push({ x: l.x - fx * 3.2 + rx * meia, z: l.z - fz * 3.2 + rz * meia, h: l.heading });
  }
  const chao = (lista, larg, comp, desenho) => {
    if (!lista.length) return;
    const tex = canvasTex(256, Math.round(256 * comp / larg), desenho, false);
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(larg, comp).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), lista.length);
    lista.forEach((o, i) => poe(im, i, o.x, 0.058, o.z, 1, 1, 1, o.h + Math.PI));   // topo do desenho para a frente
    im.instanceMatrix.needsUpdate = true; scene.add(im);
  };
  chao(setas, 1.1, 5, (g, w, h) => {                      // "siga em frente"
    g.fillStyle = '#f4f4f4'; g.beginPath();
    g.moveTo(w / 2, 4); g.lineTo(w - 6, h * 0.3); g.lineTo(w * 0.66, h * 0.3); g.lineTo(w * 0.66, h - 4);
    g.lineTo(w * 0.34, h - 4); g.lineTo(w * 0.34, h * 0.3); g.lineTo(6, h * 0.3); g.closePath(); g.fill();
  });
  chao(pares, 2.6, 4, (g, w, h) => {                      // legenda alongada (lida de longe, por quem chega)
    g.fillStyle = '#f4f4f4'; g.font = '900 100px Arial Black, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const sx = w * 0.9 / g.measureText('PARE').width, sy = h * 0.8 / 100;   // letras finas e altas
    g.save(); g.translate(w / 2, h / 2); g.scale(sx, sy); g.fillText('PARE', 0, 4); g.restore();
  });
  return { nSetas: setas.length, nPares: pares.length, nVagas: (vida.vagas || []).length };
}

// ---------------------------------------------------------------------------------------------------------------
// spec 056 — casinhas: nos bairros o OpenStreetMap tem poucos prédios cadastrados (o chão fica vazio). Ao longo das
// ruas, a cada ~15 m e recuadas da calçada, entra uma casinha genérica (1–2 andares, telhado de 4 águas) onde NÃO há
// rua, prédio do OSM, praça nem outra casinha. São só enfeite (não são dados do mapa). 2 malhas instanciadas.
export function criarCasinhas(scene, dados, rede) {
  let sem = 7; const rnd = () => { sem = (sem * 16807) % 2147483647; return (sem - 1) / 2147483646; };
  const L = dados.limites, CEL = 20, ck = (i, j) => i * 100003 + j;
  const caixas = new Map();                            // grade com as caixas (x0,z0,x1,z1) de prédios e casinhas
  const poeCaixa = (b) => {
    for (let i = Math.floor(b[0] / CEL); i <= Math.floor(b[2] / CEL); i++)
      for (let j = Math.floor(b[1] / CEL); j <= Math.floor(b[3] / CEL); j++) { const k = ck(i, j); if (!caixas.has(k)) caixas.set(k, []); caixas.get(k).push(b); }
  };
  const bate = (b) => {
    for (let i = Math.floor(b[0] / CEL); i <= Math.floor(b[2] / CEL); i++)
      for (let j = Math.floor(b[1] / CEL); j <= Math.floor(b[3] / CEL); j++)
        for (const o of caixas.get(ck(i, j)) || []) if (b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) return true;
    return false;
  };
  for (const p of [...dados.predios, ...dados.pracas]) {
    const xs = p.p.map(q => q[0]), zs = p.p.map(q => q[1]);
    poeCaixa([Math.min(...xs) - 2, Math.min(...zs) - 2, Math.max(...xs) + 2, Math.max(...zs) + 2]);
  }
  const naRua = (x, z) => { const m = rede.maisPerto(x, z); return m && m.d < m.seg.meia + 2.2; };   // pista + calçada
  const casas = [];
  for (const r of dados.ruas) {
    if (r.largura < 4) continue;
    const P = r.pontos, hw = r.largura / 2;
    for (let i = 0; i < P.length - 1; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1], Ls = Math.hypot(bx - ax, bz - az);
      if (Ls < 20) continue;
      const ux = (bx - ax) / Ls, uz = (bz - az) / Ls, h = Math.atan2(ux, uz);
      for (let s = 10; s < Ls - 10; s += 15) {
        for (const lado of [-1, 1]) {
          const w = 7.5 + rnd() * 3, d = 7.5 + rnd() * 2.5, o = lado * (hw + 1.6 + 1.8 + d / 2);
          const x = ax + ux * s - uz * o, z = az + uz * s + ux * o;     // normal (−uz, ux)
          if (x < L.x0 + 15 || x > L.x1 - 15 || z < L.z0 + 15 || z > L.z1 - 15) continue;
          const R = Math.max(w, d) / 2 + 0.5, cx = [x, x + R, x - R, x, x], cz = [z, z, z, z + R, z - R];
          if (cx.some((qx, k) => naRua(qx, cz[k]))) continue;
          const b = [x - R, z - R, x + R, z + R];
          if (bate(b)) continue;
          poeCaixa(b);
          casas.push({ x, z, h, w, d, alt: rnd() < 0.25 ? 5.8 : 3.4, cor: rnd(), teto: rnd() });
        }
      }
    }
  }
  if (!casas.length) return { n: 0 };
  const CORES = [0xfff1d6, 0xffd9e6, 0xdff3ff, 0xe5f7d8, 0xfde7c4, 0xf1e3ff, 0xffffff], TETOS = [0xc9634a, 0xb5563f, 0xd9824f, 0x9a5a48];
  const corpo = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), casas.length);
  const telhado = new THREE.InstancedMesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0),
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), casas.length);
  const c = new THREE.Color();
  casas.forEach((k, i) => {
    poe(corpo, i, k.x, 0, k.z, k.d, k.alt, k.w, k.h);
    poe(telhado, i, k.x, k.alt, k.z, k.d * 1.12, 2.2, k.w * 1.12, k.h);
    corpo.setColorAt(i, c.set(CORES[Math.floor(k.cor * CORES.length)]));
    telhado.setColorAt(i, c.set(TETOS[Math.floor(k.teto * TETOS.length)]));
  });
  for (const im of [corpo, telhado]) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; scene.add(im); }
  return { n: casas.length };
}
