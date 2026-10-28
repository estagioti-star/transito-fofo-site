// Bicicleta e ambulância de uma missão (specs 023/024). Só lógica (sem THREE, sem DOM): andam AO LONGO da rota da
// missão (pontos [[x, z], ...]); o desenho fica em mundo.js e o julgamento no fiscal.
//   bike: { s0, comprimento, vel }  → espera o jogador chegar a 50 m, pedala colada no meio-fio e some no fim do trecho
//   ambulancia: { gatilho, atras, vel } → quando o jogador passa de `gatilho` m da rota, nasce `atras` m atrás dele;
//     a 45 m dele vai para a faixa da esquerda (art. 29 VII a: os outros deixam a esquerda livre), passa e volta.
//   trator (spec 040): { de: [x, z], ate: [x, z], vel } → espera o jogador a 50 m (ele alcança o trator logo antes da ponte); anda devagar no meio da faixa da
//     direita (passando pela ponte) e no fim entra à direita no sítio (sai da pista e some).
import { naRua } from './bairro.js';

const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const BIKE_MEIOFIO = 1.6;        // bicicleta: 1,6 m à direita do centro da faixa (a faixa tem 2,5 m até o meio-fio)
const AMB_TROCA = 45;            // a ambulância vai para a esquerda a 45 m do jogador
const AMB_VOLTA = 20;            // e volta para a direita 20 m depois de passar
const AMB_FIM = 150;             // some 150 m à frente do jogador (ou no fim da rota)

export function amostrar(rota) {   // pontos a ~1 m com s (m) e h (rumo)
  const P = [];
  for (let i = 0; i < rota.length - 1; i++) {
    const [ax, az] = rota[i], [bx, bz] = rota[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az)));
    for (let k = 0; k < n; k++) P.push({ x: ax + (bx - ax) * k / n, z: az + (bz - az) * k / n });
  }
  P.push({ x: rota.at(-1)[0], z: rota.at(-1)[1] });
  let s = 0;
  P.forEach((p, i) => {
    if (i) s += Math.hypot(p.x - P[i - 1].x, p.z - P[i - 1].z);
    p.s = s; const q = P[Math.min(P.length - 1, i + 1)], o = i === P.length - 1 ? P[i - 1] : p;
    p.h = Math.atan2(q.x - o.x, q.z - o.z);
  });
  return P;
}

export function criarVivos(rota, cfg = {}) {
  const P = amostrar(rota), L = P.at(-1).s;
  const em = s => {                                   // ponto da rota no comprimento s
    s = Math.max(0, Math.min(L, s));
    let lo = 0, hi = P.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].s <= s) lo = m; else hi = m; }
    const a = P[lo], b = P[hi], k = (s - a.s) / Math.max(1e-6, b.s - a.s);
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, h: a.h };
  };
  const lateral = (p, w) => ({ x: p.x - Math.cos(p.h) * w, z: p.z + Math.sin(p.h) * w });   // w > 0 = à direita
  let idx = 0;
  function sNaRota(x, z) {                            // onde o jogador está ao longo da rota (null se longe dela)
    let best = idx, bd = Infinity;
    const varre = (i0, i1) => { for (let i = i0; i < i1; i++) { const d = (P[i].x - x) ** 2 + (P[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } } };
    varre(Math.max(0, idx - 15), Math.min(P.length, idx + 60));
    if (bd > 144) varre(0, P.length);
    if (bd > 400) return null;
    idx = best;
    const p = P[best];
    return p.s + (x - p.x) * Math.sin(p.h) + (z - p.z) * Math.cos(p.h);
  }

  const bike = cfg.bike ? { id: 'bike', s: cfg.bike.s0, fim: cfg.bike.s0 + cfg.bike.comprimento, vel: cfg.bike.vel || 4, estado: 'esperando' } : null;
  const sMaisPerto = ([x, z]) => { let b = 0, bd = Infinity; P.forEach((p, i) => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; b = i; } }); return P[b].s; };
  const trator = cfg.trator ? { id: 'trator', s0: sMaisPerto(cfg.trator.de), fim: sMaisPerto(cfg.trator.ate), vel: cfg.trator.vel || 6, w: 0, estado: 'esperando' } : null;
  if (trator) trator.s = trator.s0;
  const amb = cfg.ambulancia ? { id: 'ambulancia', s: 0, v: cfg.ambulancia.vel || 16, w: 0, estado: 'esperando', ...cfg.ambulancia } : null;

  // specs 027/028: cachorro / bola (+ criança correndo atrás) atravessando a rua no ponto (x, z) da rota. Começa
  // quando o jogador chega a `gatilho` m antes; sai da calçada da DIREITA dele e vai para a da esquerda.
  const travessias = (cfg.travessias || []).flatMap(c => {
    let b = 0, bd = Infinity; P.forEach((p, i) => { const d = (p.x - c.x) ** 2 + (p.z - c.z) ** 2; if (d < bd) { bd = d; b = i; } });
    const h = P[b].h, r = naRua(c.x, c.z), meia = r && r.rua === 'avenida' ? 6 : 5;
    const base = { s: P[b].s, h, cx: c.x, cz: c.z, meia, W: meia + 1.5, gatilho: c.gatilho, estado: 'esperando' };
    const lista = [{ ...base, id: c.id, tipo: c.tipo, vel: c.vel, atraso: 0, w: meia + 1.5, julgar: true }];
    if (c.crianca) lista.push({ ...base, id: c.id + '_crianca', tipo: 'crianca', vel: 1.6, atraso: 1.4, w: meia + 1.5, julgar: false });
    return lista;
  });

  function passo(dt, jog) {                           // jog = { x, z, v }
    const sj = sNaRota(jog.x, jog.z);
    for (const o of travessias) {
      if (o.estado === 'esperando' && sj !== null && sj >= o.s - o.gatilho) { o.estado = 'aguarda'; o.tAtraso = o.atraso; }
      if (o.estado === 'aguarda') { o.tAtraso -= dt; if (o.tAtraso <= 0) o.estado = 'cruzando'; }
      if (o.estado === 'cruzando') { o.w -= o.vel * dt; if (o.w <= -o.W) o.estado = 'foi'; }
    }
    if (bike) {
      if (bike.estado === 'esperando' && sj !== null && sj > bike.s - 50) bike.estado = 'pedalando';
      if (bike.estado === 'pedalando') { bike.s += bike.vel * dt; if (bike.s >= Math.min(bike.fim, L - 3)) bike.estado = 'foi'; }
    }
    if (trator) {
      if (trator.estado === 'esperando' && sj !== null && sj > trator.s0 - 50) trator.estado = 'andando';
      if (trator.estado === 'andando') { trator.s += trator.vel * dt; if (trator.s >= trator.fim) trator.estado = 'saindo'; }
      if (trator.estado === 'saindo') { trator.s += trator.vel * 0.5 * dt; trator.w += 2.2 * dt; if (trator.w > 9) trator.estado = 'foi'; }
    }
    if (amb) {
      if (amb.estado === 'esperando' && sj !== null && sj >= amb.gatilho && L - sj > 100) {
        amb.estado = 'vindo'; amb.s = Math.max(0, sj - amb.atras); amb.w = 0;
      }
      if (amb.estado === 'vindo') {
        amb.s += amb.v * dt;
        const p = em(amb.s), r = naRua(p.x, p.z, p.h), meia = r ? (r.rua === 'avenida' ? 3 : 2.5) : 2.5;
        const gap = sj === null ? Infinity : sj - amb.s;                  // + = o jogador está à frente
        const alvoW = gap < AMB_TROCA && gap > -AMB_VOLTA ? -2 * meia : 0; // faixa da esquerda enquanto passa
        amb.w += (alvoW - amb.w) * Math.min(1, dt * 1.6);
        if (amb.s >= L - 5 || (sj !== null && amb.s > sj + AMB_FIM)) amb.estado = 'foi';
      }
    }
  }

  function lista() {
    const out = { bicicletas: [], ambulancias: [], travessias: [], tratores: [] };
    // a bola continua "perigo" enquanto a criança dela ainda vai atravessar ou está na pista (a lição é: vem criança atrás)
    const perigoCrianca = id => travessias.some(k => k.id === id + '_crianca' && (k.estado === 'aguarda' || (k.estado === 'cruzando' && Math.abs(k.w) < k.meia)));
    for (const o of travessias) {
      if (o.estado === 'esperando' || (o.estado === 'foi' && !(o.tipo === 'bola' && perigoCrianca(o.id)))) continue;
      const x = o.cx - Math.cos(o.h) * o.w, z = o.cz + Math.sin(o.h) * o.w;     // w > 0 = à direita do rumo da rota
      const naPista = (o.estado === 'cruzando' && Math.abs(o.w) < o.meia) || (o.tipo === 'bola' && perigoCrianca(o.id));
      out.travessias.push({ id: o.id, tipo: o.tipo, x, z, cx: o.cx, cz: o.cz, heading: o.h + Math.PI / 2, naPista, julgar: o.julgar, andando: o.estado === 'cruzando' });
    }
    if (bike && bike.estado !== 'foi') {
      const p = em(bike.s), q = lateral(p, BIKE_MEIOFIO);
      out.bicicletas.push({ id: bike.id, x: q.x, z: q.z, heading: p.h, v: bike.estado === 'pedalando' ? bike.vel : 0 });
    }
    if (trator && trator.estado !== 'foi') {
      const p = em(trator.s), q = lateral(p, trator.w);
      out.tratores.push({ id: trator.id, x: q.x, z: q.z, heading: wrap(p.h + (trator.estado === 'saindo' ? -0.6 : 0)), v: trator.estado === 'esperando' ? 0 : trator.vel, naPista: trator.w < 3 });
    }
    if (amb && amb.estado === 'vindo') {
      const p = em(amb.s), q = lateral(p, amb.w), p2 = em(amb.s + 2);
      out.ambulancias.push({ id: amb.id, x: q.x, z: q.z, heading: wrap(Math.atan2(p2.x - p.x, p2.z - p.z) - amb.w * 0.02), v: amb.v, sirene: true });
    }
    return out;
  }
  return {
    passo, lista, sNaRota,
    reset() {
      if (bike) Object.assign(bike, { s: cfg.bike.s0, estado: 'esperando' }); if (trator) Object.assign(trator, { s: trator.s0, w: 0, estado: 'esperando' }); if (amb) Object.assign(amb, { s: 0, w: 0, estado: 'esperando' });
      for (const o of travessias) Object.assign(o, { w: o.W, estado: 'esperando' });
      idx = 0;
    },
    get travessias() { return travessias; },
    get bike() { return bike; }, get trator() { return trator; }, get ambulancia() { return amb; },
  };
}
