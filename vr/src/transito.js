// Trânsito vivo: 6 carros IA e 8 pedestres. Só lógica (sem THREE, sem DOM): o desenho fica em mundo.js.
// Os carros andam "sobre trilhos" (circuitos fechados no meio da faixa da direita) e obedecem: param no vermelho
// e no PARE, esperam o pedestre na faixa, cedem a vez na rótula e não encostam em ninguém.
// Os pedestres andam na calçada e atravessam na faixa quando nenhum carro vem perto demais para frear.
import { BAIRRO, limiteEm as limiteB, faseSemaforo as faseB } from './bairro.js';

const PI = Math.PI, TAU = 2 * PI;
const wrap = a => { while (a > PI) a -= TAU; while (a < -PI) a += TAU; return a; };
export const MEIO_COMPR = 1.65, MEIA_LARG = 0.85;      // meia medida do carrinho (3,3 × 1,7 m)
const ALAT = 2.5, ACC = 2.5, DEC = 3, DEC_MAX = 7;      // conforto do motorista IA (m/s²)
const FOLGA = 5.5;                                      // distância centro a centro ao parar atrás de alguém
const CRUZEIRO = 0.85;                                  // anda a 85% do limite

// referencial de um objeto com rumo h: s = à frente, w = à direita
export function local(o, h, x, z) {
  const fx = Math.sin(h), fz = Math.cos(h), dx = x - o.x, dz = z - o.z;
  return { s: dx * fx + dz * fz, w: -dx * fz + dz * fx };
}

// ---------------------------------------------------------------------------------------------------------------
// Caminhos: polilinha (1 ponto por metro) com s acumulado, rumo e limite de velocidade por curva/via
// ---------------------------------------------------------------------------------------------------------------
function arredondaCantos(pts, fechado) {         // canto de 90° vira arco (direita r = 4 m, esquerda r = 7,5 m)
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    if (!fechado && (i === 0 || i === n - 1)) { out.push(pts[i]); continue; }
    const [ax, az] = pts[(i - 1 + n) % n], [bx, bz] = pts[i], [cx, cz] = pts[(i + 1) % n];
    const h1 = Math.atan2(bx - ax, bz - az), h2 = Math.atan2(cx - bx, cz - bz), dh = wrap(h2 - h1);
    const l1 = Math.hypot(bx - ax, bz - az), l2 = Math.hypot(cx - bx, cz - bz);
    if (Math.abs(dh) < 0.6) { out.push(pts[i]); continue; }
    const r0 = dh < 0 ? 4 : 7.5;
    let d = r0 * Math.tan(Math.abs(dh) / 2); d = Math.min(d, 0.45 * Math.min(l1, l2));
    const r = d / Math.tan(Math.abs(dh) / 2), sg = dh > 0 ? 1 : -1;
    const px = bx - Math.sin(h1) * d, pz = bz - Math.cos(h1) * d;
    const ox = px + Math.cos(h1) * r * sg, oz = pz - Math.sin(h1) * r * sg;
    const a0 = Math.atan2(px - ox, pz - oz), m = Math.max(3, Math.ceil(Math.abs(dh) * r / 1.0));
    for (let k = 0; k <= m; k++) { const a = a0 + (dh * k) / m; out.push([ox + Math.sin(a) * r, oz + Math.cos(a) * r]); }
  }
  return out;
}

export function criarCaminho(cantos, { fechado = false, limiteEm = limiteB, fator = CRUZEIRO } = {}) {
  const R = arredondaCantos(cantos, fechado);
  if (fechado) R.push(R[0]);
  const P = [];
  for (let i = 0; i < R.length - 1; i++) {
    const [ax, az] = R[i], [bx, bz] = R[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L));
    if (L < 1e-6) continue;
    for (let k = 0; k < n; k++) P.push({ x: ax + (bx - ax) * k / n, z: az + (bz - az) * k / n });
  }
  if (!fechado) P.push({ x: R.at(-1)[0], z: R.at(-1)[1] });
  const N = P.length;
  let s = 0;
  P.forEach((p, i) => { if (i) s += Math.hypot(p.x - P[i - 1].x, p.z - P[i - 1].z); p.s = s; });
  const L = fechado ? s + Math.hypot(P[0].x - P[N - 1].x, P[0].z - P[N - 1].z) : s;
  const at = i => fechado ? P[((i % N) + N) % N] : P[Math.max(0, Math.min(N - 1, i))];
  P.forEach((p, i) => { const q = at(i + 1), o = at(i - (!fechado && i === N - 1 ? 1 : 0)); p.h = Math.atan2(q.x - o.x, q.z - o.z); if (!fechado && i === N - 1) { const a = at(N - 2); p.h = Math.atan2(p.x - a.x, p.z - a.z); } });
  const W = 3;
  P.forEach((p, i) => {
    const a = at(i - W), b = at(i + W), k = Math.abs(wrap(b.h - a.h)) / (2 * W);
    p.lim = limiteEm(p.x, p.z, p.h);
    p.v = Math.min(p.lim * fator / 3.6, k > 1e-4 ? Math.sqrt(ALAT / k) : 99);
  });
  if (!fechado) P[N - 1].v = 0;
  // passada para trás: dá tempo de frear antes da curva / zona mais lenta (2 voltas fecham o circuito)
  for (let rep = 0; rep < (fechado ? 2 : 1); rep++)
    for (let i = (fechado ? N - 1 : N - 2); i >= 0; i--) { const q = at(i + 1), d = fechado && i === N - 1 ? L - P[i].s : q.s - P[i].s; P[i].v = Math.min(P[i].v, Math.sqrt(q.v ** 2 + 2 * DEC * d)); }
  const cam = { P, L, fechado, N };
  cam.idx = s0 => { let ss = fechado ? ((s0 % L) + L) % L : Math.max(0, Math.min(L, s0)); let i = Math.min(N - 1, Math.floor(ss)); while (i > 0 && P[i].s > ss) i--; while (i < N - 1 && P[i + 1].s <= ss) i++; return i; };
  cam.pos = s0 => {
    const ss = fechado ? ((s0 % L) + L) % L : Math.max(0, Math.min(L, s0)), i = cam.idx(ss), a = P[i], b = at(i + 1);
    const seg = (i === N - 1 ? (fechado ? L : a.s + 1) : b.s) - a.s, k = seg > 0 ? Math.min(1, (ss - a.s) / seg) : 0;
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, i };
  };
  cam.rumo = s0 => { const a = cam.pos(s0 - 1.2), b = cam.pos(s0 + 1.8); return Math.atan2(b.x - a.x, b.z - a.z); };
  cam.eventos = eventosDoCaminho(cam);
  return cam;
}

// Onde, ao longo do caminho, ele cruza linha de semáforo/PARE (no sentido dela e na faixa dela), entra numa
// faixa de pedestre e entra na rótula. Mesma geometria do fiscal.
export function eventosDoCaminho(cam, B = BAIRRO) {
  const { P, N, fechado } = cam, ev = [];
  const larg = Object.fromEntries(B.ruas.map(r => [r.id, r.largura]));
  const M = fechado ? N : N - 1;
  const seg = i => [P[i], fechado ? P[(i + 1) % N] : P[i + 1], fechado && i === N - 1 ? cam.L : P[i + 1].s];
  const linhas = [...B.semaforos.flatMap(g => g.linhas.map(L => ({ tipo: 'semaforo', ref: g.id, L, no: B.nos.find(n => n.id === g.no) }))),
    ...B.pares.map(p => ({ tipo: 'pare', ref: p.id, L: p.linha, no: B.nos.find(n => n.id === p.no) }))];
  for (const l of linhas) {
    const meia = larg[l.L.rua] / 4 + 0.9;
    for (let i = 0; i < M; i++) {
      const [a, b, sb] = seg(i), A = local(l.L, l.L.heading, a.x, a.z), Bq = local(l.L, l.L.heading, b.x, b.z);
      if (A.s < 0 && Bq.s >= 0) {
        const k = A.s / (A.s - Bq.s), w = A.w + (Bq.w - A.w) * k;
        if (Math.abs(w) <= meia) ev.push({ tipo: l.tipo, ref: l.ref, s: a.s + (sb - a.s) * k, no: l.no, L: l.L });   // spec 041: L = linha (PARE da rótula)
      }
    }
  }
  for (const f of B.faixas) {
    const Bf = f.largura / 2 + 0.9;
    let dentro = null;
    for (let i = 0; i <= M; i++) {
      const p = fechado ? P[i % N] : P[Math.min(i, N - 1)], a = local(f, f.heading, p.x, p.z);
      const ok = Math.abs(a.s) <= Bf && Math.abs(a.w) <= f.comprimento / 2 + 0.5;
      if (ok && dentro === null) dentro = i;
      if (!ok && dentro !== null) {
        if (dentro > 0 || !fechado) ev.push({ tipo: 'faixa', ref: f.id, s: P[dentro].s - 0.5, s1: (i === N ? cam.L : P[i % N].s) });
        dentro = null;
      }
    }
  }
  const ROT = B.rotula;
  for (let i = 0; i < M; i++) {
    const [a, b, sb] = seg(i), d0 = Math.hypot(a.x - ROT.x, a.z - ROT.z), d1 = Math.hypot(b.x - ROT.x, b.z - ROT.z);
    if (d0 > ROT.externo && d1 <= ROT.externo) ev.push({ tipo: 'rotula', ref: 'rotula', s: a.s + (sb - a.s) * (d0 - ROT.externo) / (d0 - d1), x: b.x, z: b.z });
  }
  ev.sort((a, b) => a.s - b.s);
  ev.forEach((e, i) => { e.k = i; });
  return ev;
}

// ---------------------------------------------------------------------------------------------------------------
// Circuitos dos carros IA: sequência de cruzamentos; 'R' = a rótula. Faixa da direita = 1/4 da largura da rua.
// ---------------------------------------------------------------------------------------------------------------
export function circuito(nos, B = BAIRRO) {
  const ROT = B.rotula, n = nos.length;
  const P = nos.map(p => p === 'R' ? { x: ROT.x, z: ROT.z, rot: true } : { x: p[0], z: p[1] });
  const off = (a, b) => (a.z === b.z && a.z === 0 ? 12 : 10) / 4;          // avenida tem 12 m
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = P[(i - 1 + n) % n], c = P[i], q = P[(i + 1) % n];
    const L1 = Math.hypot(c.x - p.x, c.z - p.z), d1 = [(c.x - p.x) / L1, (c.z - p.z) / L1], r1 = [-d1[1], d1[0]], o1 = off(p, c);
    const L2 = Math.hypot(q.x - c.x, q.z - c.z), d2 = [(q.x - c.x) / L2, (q.z - c.z) / L2], r2 = [-d2[1], d2[0]], o2 = off(c, q);
    if (c.rot) {
      const t1 = -Math.sqrt(ROT.R ** 2 - o1 ** 2), t2 = Math.sqrt(ROT.R ** 2 - o2 ** 2);
      const ex = c.x + r1[0] * o1 + d1[0] * t1, ez = c.z + r1[1] * o1 + d1[1] * t1;
      const sx = c.x + r2[0] * o2 + d2[0] * t2, sz = c.z + r2[1] * o2 + d2[1] * t2;
      const th0 = Math.atan2(ez - c.z, ex - c.x), th1 = Math.atan2(sz - c.z, sx - c.x);
      const dth = ((th0 - th1) % TAU + TAU) % TAU, m = Math.ceil(dth * ROT.R / 1.5);
      for (let k = 0; k <= m; k++) { const th = th0 - dth * k / m; out.push([c.x + ROT.R * Math.cos(th), c.z + ROT.R * Math.sin(th)]); }
      continue;
    }
    if (Math.abs(d1[0] * d2[1] - d1[1] * d2[0]) < 1e-6) continue;             // segue reto
    // cruzamento das duas linhas de faixa (ruas da grade são retas norte-sul / leste-oeste)
    const x = Math.abs(d1[0]) < 0.5 ? p.x + r1[0] * o1 : c.x + r2[0] * o2;
    const z = Math.abs(d1[1]) < 0.5 ? p.z + r1[1] * o1 : c.z + r2[1] * o2;
    out.push([x, z]);
  }
  return out;
}

export const CIRCUITOS = [
  { nos: [[0, 0], [95, 0], [95, 85], [0, 85]], cor: '#4fa3ff', s0: 0.15 },                 // avenida → Girassóis (PARE)
  { nos: [[0, 85], [95, 85], [95, 170], [0, 170]], cor: '#ffd23f', s0: 0.55 },            // Girassóis (semáforo) → Praça
  { nos: [[95, 85], 'R', [190, 170], [95, 170]], cor: '#9b6bff', s0: 0.3 },               // escola → rótula → praça → PARE
  { nos: [[190, 0], [285, 0], [285, 170], [190, 170], 'R'], cor: '#3ccf8e', s0: 0.65 },   // grandão do leste, rótula, PARE
  { nos: [[285, 0], [0, 0], [0, 170], [285, 170]], cor: '#ff8a3d', s0: 0.62 },            // volta no bairro todo (radar)
  { nos: [[190, 0], [285, 0], [285, 85], 'R'], cor: '#ff5f6d', s0: 0.1 },                 // rótula pelo leste, PARE
  // spec 034 (mapa maior): volta no centro (sobe a Girassóis e desce a Sabiá: as duas de mão única, no sentido certo, PARE na
  // avenida) e a volta na coluna leste
  { nos: [[95, 0], [95, -85], [190, -85], [190, 0]], cor: '#e8574a', s0: 0.4 },
  { nos: [[285, -85], [380, -85], [380, 170], [285, 170]], cor: '#2fa6c9', s0: 0.3 },
  // spec 040: 2 carros na estrada, no sentido CONTRÁRIO ao da missão (vêm de frente na ponte: por isso não se ultrapassa)
  { nos: [[380, 0], [620, 0], [620, 170], [380, 170]], cor: '#ffffff', s0: 0.05 },
  { nos: [[380, 0], [620, 0], [620, 170], [380, 170]], cor: '#ff9ec4', s0: 0.55 },
];

// ---------------------------------------------------------------------------------------------------------------
// Pedestres: cada um mora numa faixa e vai e volta: calçada → beira → (espera) → atravessa → calçada → pausa.
// ---------------------------------------------------------------------------------------------------------------
const PEDESTRES = [
  { faixa: 'faixa_praca', lado: -1, u: -9, espera: 0.6, vel: 1.25, cor: '#ff5fa8' },
  { faixa: 'faixa_praca', lado: 1, u: 7, espera: 4.0, vel: 1.1, cor: '#7a5cff' },
  { faixa: 'faixa_praca', lado: -1, u: 12, espera: 1.5, vel: 1.4, cor: '#2fa6c9' },
  { faixa: 'faixa_escola', lado: 1, u: -8, espera: 1.0, vel: 1.3, cor: '#ffb43a' },
  { faixa: 'faixa_escola', lado: -1, u: 10, espera: 5.0, vel: 1.15, cor: '#3ccf8e' },
  { faixa: 'faixa_escola', lado: 1, u: 6, espera: 2.0, vel: 1.35, cor: '#e8574a' },
  { faixa: 'faixa_farmacia', lado: -1, u: -10, espera: 3.0, vel: 1.2, cor: '#16a34a' },
  { faixa: 'faixa_farmacia', lado: 1, u: 8, espera: 1.0, vel: 1.3, cor: '#c98a5a' },
];
// spec 025: saída da escola — 4 crianças a mais na faixa da escola, desligadas fora da missão da escola
const CRIANCAS = [
  { faixa: 'faixa_escola', lado: 1, u: -5, espera: 0.4, vel: 1.2, cor: '#ff5fa8' },
  { faixa: 'faixa_escola', lado: -1, u: 4, espera: 0.8, vel: 1.25, cor: '#3ad1ff' },
  { faixa: 'faixa_escola', lado: 1, u: 9, espera: 0.6, vel: 1.15, cor: '#7ee081' },
  { faixa: 'faixa_escola', lado: -1, u: -9, espera: 1.0, vel: 1.3, cor: '#ffd23f' },
];

export function criarTransito({ bairro = BAIRRO, fase = faseB, limiteEm = limiteB, nCarros = 10, nPedestres = 8 } = {}) {
  const ROT = bairro.rotula;
  const FAIXA = Object.fromEntries(bairro.faixas.map(f => [f.id, f]));
  const carros = CIRCUITOS.slice(0, nCarros).map((c, i) => {
    const cam = criarCaminho(circuito(c.nos, bairro), { fechado: true, limiteEm });
    const s = c.s0 * cam.L, p = cam.pos(s);
    return { id: 'ia' + i, i, cor: c.cor, cam, s, v: 0, x: p.x, z: p.z, heading: cam.rumo(s), parado: 0, mem: {}, freando: false };
  });
  const pedestres = [...PEDESTRES.slice(0, nPedestres), ...CRIANCAS.map(c => ({ ...c, crianca: true }))].map((d, i) => {
    const f = FAIXA[d.faixa], W = f.comprimento / 2 + 1.3;
    const p = { id: 'p' + i, i, faixa: f.id, f, cor: d.cor, vel: d.vel, espera: d.espera, W, lado: d.lado, uCasa: d.u,
      u: d.u, w: d.lado * W, estado: d.crianca ? 'fora' : 'pausa', alvo: null, tEspera: 0, tPausa: 0.5 + i * 0.9, passo: i * 0.7, x: 0, z: 0, heading: 0, crianca: !!d.crianca };
    return p;
  });
  function mundoXZ(p) { const f = p.f, fx = Math.sin(f.heading), fz = Math.cos(f.heading); p.x = f.x + fx * p.u - fz * p.w; p.z = f.z + fz * p.u + fx * p.w; }
  pedestres.forEach(mundoXZ);

  // máquina do pedestre: pausa em casa → anda até a beira → espera → atravessa → anda até o ponto do outro lado → pausa
  function chegou(p) {
    if (p.estado === 'atravessando') {
      p.estado = 'andando'; p.alvo = { u: Math.sign(p.w) === p.lado ? p.uCasa : -p.uCasa, w: p.w, fim: true }; p.atravessou = true;
    } else if (p.alvo && p.alvo.beira) { p.estado = 'esperando'; p.tEspera = 0; p.alvo = null; }
    else if (p.crianca && p.atravessou) { p.estado = 'fora'; p.alvo = null; }      // spec 025: atravessou → entrou
    else { p.estado = 'pausa'; p.tPausa = 1.5 + (p.i % 3); p.alvo = null; }
  }
  const rumoBeira = p => { p.estado = 'andando'; p.alvo = { u: (Math.sign(p.u) || 1) * 0.9, w: p.w, beira: true }; };
  const entrando = p => p.estado === 'atravessando' && Math.abs(p.w) > p.f.comprimento / 2 && Math.sign(p.w) !== Math.sign(p.alvo.w);

  // um carro (IA ou jogador) vindo para a faixa perto demais para frear com calma? Ou em cima dela?
  function veiculos(jogador) { const l = carros.map(c => ({ x: c.x, z: c.z, heading: c.heading, v: c.v, ia: c })); if (jogador) l.push({ ...jogador, jog: true }); return l; }
  function podeAtravessar(f, vs) {
    const B = f.largura / 2 + 0.9;
    for (const c of vs) {
      const a = local(f, f.heading, c.x, c.z);
      if (Math.abs(a.w) > f.comprimento / 2 + 1) continue;
      if (Math.abs(a.s) <= B + MEIO_COMPR) return false;                       // em cima da zebra
      const frente = Math.sin(c.heading) * Math.sin(f.heading) + Math.cos(c.heading) * Math.cos(f.heading);
      if (frente * a.s >= 0 || Math.abs(frente) < 0.5) continue;              // indo embora / atravessado
      const d = Math.abs(a.s) - B, v = Math.max(0, c.v);
      if (v > 0.5 && d < v * v / (2 * 2.5) + 4 + v * 1.2) return false;
    }
    return true;
  }
  // pedestre ocupando a faixa (sobre a zebra, ou saindo da beira para dentro) — mesma régua do fiscal
  function conflitoFaixa(fid) {
    const f = FAIXA[fid], meio = f.comprimento / 2;
    return pedestres.some(p => p.estado !== 'fora' && p.faixa === fid && Math.abs(p.u) <= f.largura / 2 + 0.5
      && (Math.abs(p.w) <= meio + 0.3 || (p.estado === 'atravessando' && Math.abs(p.w) <= meio + 2.2)));
  }
  // alguém andando no anel e chegando ao ponto de entrada (x, z) a menos de `arco` m
  function conflitoRotula(x, z, vs, eu, arco = 22) {
    const te = Math.atan2(z - ROT.z, x - ROT.x);
    return vs.some(o => {
      if (o.ia === eu) return false;
      const d = Math.hypot(o.x - ROT.x, o.z - ROT.z);
      if (d < ROT.ilha || d > ROT.externo || !(o.v > 0.3)) return false;
      const a = ((((Math.atan2(o.z - ROT.z, o.x - ROT.x) - te) % TAU) + TAU) % TAU) * ROT.R;
      return a < arco;
    });
  }
  // cruzamento do PARE livre: ninguém andando a menos de 16 m do meio do nó
  const noLivre = (no, vs, eu) => !vs.some(o => o.ia !== eu && o.v > 0.5 && Math.hypot(o.x - no.x, o.z - no.z) < 16);

  // spec 006: na via preferencial o carro IA NÃO cede a quem sai do PARE cortando a frente dele (é a lei: quem
  // está no PARE espera). Só "não enxerga" o jogador que anda atravessado, perto de um cruzamento com PARE.
  const nosPare = bairro.nos.filter(n => n.tipo === 'pare');
  const cortando = (c, o) => o.jog && o.v > 0.5 && Math.abs(Math.cos(o.heading - c.heading)) < 0.7
    && nosPare.some(n => Math.hypot(o.x - n.x, o.z - n.z) < 14);

  // primeiro obstáculo no caminho à frente (outro carro perto da trilha): distância ao longo da trilha
  function obstaculo(c, vs, alcance) {
    const cam = c.cam;
    let melhor = null;
    for (const o of vs) {
      if (o.ia === c || cortando(c, o)) continue;
      const dx = o.x - c.x, dz = o.z - c.z, d0 = Math.hypot(dx, dz);
      if (d0 > alcance + 3) continue;
      for (let d = 1; d <= alcance; d += 1) {
        const p = cam.pos(c.s + d);
        if (Math.abs(p.x - o.x) < 1.9 && Math.abs(p.z - o.z) < 1.9 && Math.hypot(p.x - o.x, p.z - o.z) < 1.9) {
          if (!melhor || d < melhor.d) melhor = { d, o };
          break;
        }
      }
    }
    return melhor;
  }

  function passoCarros(dt, t, jogador) {
    const vs = veiculos(jogador);
    const planos = carros.map(c => {
      const cam = c.cam, L = cam.L, v = c.v;
      const pi = cam.pos(c.s).i;
      let cap = cam.P[pi].v;
      const ahead = cam.P[(pi + 3) % cam.N].v; cap = Math.min(cap, ahead + 1);
      let pare = Infinity;                                      // distância até onde tenho de parar
      const parar = (d) => { pare = Math.min(pare, Math.max(0, d)); };
      const consegue = (d, a = 5) => v * v / (2 * Math.max(d, 0.05)) <= a || v < 0.6;
      for (const e of cam.eventos) {
        const d = ((e.s - c.s) % L + L) % L;                    // à frente, dando a volta
        const m = c.mem[e.k] ||= {};
        if (d > L - 8) { m.feito = false; m.vai = false; m.parado = 0; }   // acabou de passar: rearma para a próxima volta
        if (d > 70) continue;
        if (e.tipo === 'semaforo') {
          const f = fase(e.ref, t);
          if (f === 'verde') { m.vai = false; continue; }
          if (m.vai) continue;
          if (d > 0.4 && consegue(d - 2)) parar(d - 2); else m.vai = true;      // amarelo perto demais: segue
        } else if (e.tipo === 'pare') {
          if (m.feito) continue;
          if (d < 9 && v < 0.2) m.parado = (m.parado || 0) + dt;
          // spec 041 (do site): no PARE da rótula, sai quando ninguém vem girando pela esquerda
          const livre = e.no.tipo === 'rotula' ? !conflitoRotula(e.L.x, e.L.z, vs, c) : noLivre(e.no, vs, c);
          if (m.parado > 1.2 && livre) { m.feito = true; continue; }
          parar(d - 2.5);
        } else if (e.tipo === 'faixa') {
          if (d < 0.3 || d > 45) continue;
          if (conflitoFaixa(e.ref) && consegue(d - 1.8, 6.5)) parar(d - 1.8);
        } else if (e.tipo === 'rotula') {
          if (m.vai || d > 35) continue;
          if (d < 2.5) { m.vai = true; continue; }
          if (conflitoRotula(e.x, e.z, vs, c)) { if (consegue(d - 1.5)) parar(d - 1.5); else m.vai = true; }
        }
      }
      const alc = Math.min(45, 7 + v * v / (2 * DEC) + v * 1.5);
      const ob = obstaculo(c, vs, alc);
      return { c, cap, pare, ob };
    });
    // quem bloqueia quem; se dois cruzando se bloqueiam ao mesmo tempo, o de número menor passa
    for (const pl of planos) {
      if (!pl.ob) continue;
      const o = pl.ob.o;
      if (o.ia) {
        const outro = planos[o.ia.i], dh = Math.abs(wrap(o.heading - pl.c.heading));
        if (outro.ob && outro.ob.o.ia === pl.c && dh > 1.0 && pl.c.i < o.ia.i) continue;
      }
      let d = pl.ob.d - FOLGA;
      // não para em cima da zebra: se a parada cairia nela, para antes
      for (const e of pl.c.cam.eventos) if (e.tipo === 'faixa') {
        const L = pl.c.cam.L, de = ((e.s - pl.c.s) % L + L) % L, de1 = de + (e.s1 - e.s);
        if (d > de - 2.2 && d < de1 + MEIO_COMPR && de > 2.2 && de < 60) d = de - 2.2;
      }
      pl.pare = Math.min(pl.pare, Math.max(0, d));
    }
    for (const { c, cap, pare } of planos) {
      if (c.paradoAte > t) { c.v = 0; c.parado += dt; continue; }        // bateu: fica parado ~1,5 s
      let alvo = cap;
      if (pare < Infinity) alvo = Math.min(alvo, Math.sqrt(2 * DEC * Math.max(0, pare - 0.3)));
      if (c.v < alvo) c.v = Math.min(alvo, c.v + ACC * dt);
      else {
        const need = pare < Infinity ? c.v * c.v / (2 * Math.max(0.1, pare)) : DEC;
        c.v = Math.max(alvo, c.v - Math.min(DEC_MAX, Math.max(DEC, need)) * dt);
      }
      if (pare <= 0.05) c.v = Math.max(0, c.v - DEC_MAX * dt);
      c.freando = c.v < alvo - 0.01 ? false : c.v > 0.1 && alvo < c.v + 0.01 && pare < 30;
      c.s = (c.s + c.v * dt) % c.cam.L;
      const p = c.cam.pos(c.s);
      c.x = p.x; c.z = p.z; c.heading = c.cam.rumo(c.s);
      c.parado = c.v < 0.05 ? c.parado + dt : 0;
    }
  }

  function passoPedestres(dt, t, jogador) {
    const vs = veiculos(jogador);
    for (const p of pedestres) {
      if (p.estado === 'fora') continue;                       // criança da saída da escola, fora da missão
      if (p.estado === 'aguardando') {                         // spec 025: espera o jogador chegar a 70 m da faixa
        if (jogador && Math.hypot(jogador.x - p.f.x, jogador.z - p.f.z) < 70) { p.estado = 'pausa'; p.tPausa = 0.2 + (p.i % 4) * 0.9; }
        continue;
      }
      if (p.estado === 'pausa') { p.tPausa -= dt; if (p.tPausa <= 0) rumoBeira(p); mundoXZ(p); continue; }
      if (p.estado === 'esperando') {
        p.tEspera += dt;
        if (p.tEspera >= p.espera && podeAtravessar(p.f, vs)) { p.estado = 'atravessando'; p.alvo = { u: p.u, w: -Math.sign(p.w) * p.W }; }
        mundoXZ(p); continue;
      }
      const du = p.alvo.u - p.u, dw = p.alvo.w - p.w, L = Math.hypot(du, dw), st = p.vel * dt;
      if (L > 1e-6) {               // rumo no mundo (frente da faixa = rumo dela, w = à direita)
        const f = p.f, fx = Math.sin(f.heading), fz = Math.cos(f.heading);
        p.heading = Math.atan2(fx * du - fz * dw, fz * du + fx * dw);
      }
      if (L <= st) { p.u = p.alvo.u; p.w = p.alvo.w; chegou(p); }
      else { p.u += du / L * st; p.w += dw / L * st; p.passo += st; }
      mundoXZ(p);
    }
  }

  return {
    carros, pedestres, conflitoFaixa, podeAtravessar,
    conflitoRotula: (x, z, jogador, arco) => conflitoRotula(x, z, veiculos(null), null, arco),
    // dt grande vira passos de no máximo 1/30 s
    passo(dt, t, jogador) {
      const n = Math.max(1, Math.ceil(dt / (1 / 30 + 1e-9)));
      for (let k = 0; k < n; k++) { const h = dt / n, tt = t - dt + h * (k + 1); passoCarros(h, tt, jogador); passoPedestres(h, tt, jogador); }
    },
    // o jogador pode ocupar (x, z)? (não atravessa os carros IA)
    ocupado(x, z) {
      for (const c of carros) { const a = local(c, c.heading, x, z); if (Math.abs(a.s) < MEIO_COMPR + 0.75 && Math.abs(a.w) < MEIA_LARG + 0.7) return true; }
      return false;
    },
    // para o fiscal: pedestres e carros no formato dele
    paraFiscal() {
      return {
        pedestres: pedestres.filter(p => p.estado !== 'fora').map(p => ({ x: p.x, z: p.z, faixa: p.faixa, id: p.id, crianca: p.crianca, entrando: entrando(p) })),
        carros: carros.map(c => ({ id: c.id, x: c.x, z: c.z, v: c.v, heading: c.heading })),
      };
    },
    // batida (spec 006): o carro i para até `ate` (s do relógio do jogo) e dá uma sacudida
    // spec 025: liga/desliga as crianças da saída da escola (voltam para a calçada, em casa)
    saidaEscola(liga) {
      for (const p of pedestres) if (p.crianca) {
        Object.assign(p, { estado: liga ? 'aguardando' : 'fora', tPausa: 0, alvo: null, u: p.uCasa, w: p.lado * p.W, atravessou: false });
        mundoXZ(p);
      }
    },
    bater(i, ate) { const c = carros[i]; if (!c) return; c.paradoAte = ate; c.v = 0; c.sacode = 0.6; },
    // testes: põe o carro i no ponto do circuito dele mais perto de (x, z), andando a `v` m/s (ou na velocidade da via)
    posicionar(i, x, z, v) {
      const c = carros[i], P = c.cam.P;
      let b = 0, bd = Infinity;
      P.forEach((p, k) => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; b = k; } });
      c.s = P[b].s; const q = c.cam.pos(c.s); c.x = q.x; c.z = q.z; c.heading = c.cam.rumo(c.s);
      c.v = v ?? P[b].v; c.mem = {}; c.paradoAte = 0;
      return { x: c.x, z: c.z, heading: c.heading, v: c.v };
    },
    // testes: põe um pedestre atravessando a faixa agora, na posição w (m à direita do rumo da faixa), indo para `para`
    forcarPedestre(fid, w = 3, para = 1) {
      const p = pedestres.find(q => q.faixa === fid) || pedestres[0];
      p.f = FAIXA[fid]; p.faixa = fid; p.W = p.f.comprimento / 2 + 1.3;
      p.u = 0.9; p.w = w; p.estado = 'atravessando'; p.alvo = { u: 0.9, w: para * p.W };
      mundoXZ(p);
      return p.id;
    },
  };
}
