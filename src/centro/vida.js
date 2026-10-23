// Spec 044 — a vida na rua do Centro de Chapecó, em lógica pura (sem THREE): carros estacionados, árvores e postes
// (posições), e uns poucos carros andando. Pedido do Maki: "não poluir" → pouca coisa, espaçada.
// - Estacionados: só nas ruas de MÃO ÚNICA com ≥ 6,5 m (a maioria do Centro), encostados no meio-fio da DIREITA, no
//   sentido da rua (CTB art. 48 / 181 II–XV), longe de cruzamento (art. 181 I: ≥ 5 m — aqui 12 m), de faixa de pedestre
//   (VIII) e de semáforo/PARE/radar. Rua de mão dupla de 6 m não tem (não sobraria pista). ~250 no total.
// - Árvores e postes: só nas avenidas e nas praças. Fora das plantas dos prédios.
// - Carros andando (spec 047): 45 circulando pela rede de ruas (respeitam a mão única), param no vermelho/amarelo
//   (a mesma fase de sinais.js), 1,5 s no PARE e atrás de quem está na frente (o jogador incluso).

const MEIO_CARRO_C = 1.8, MEIO_CARRO_L = 0.9;
let semente = 11;
const rnd = () => { semente = (semente * 16807) % 2147483647; return (semente - 1) / 2147483646; };

function amostra(pontos) {                    // polilinha a cada ~1 m, com s acumulado e rumo
  const P = [];
  for (let i = 0; i < pontos.length - 1; i++) {
    const [ax, az] = pontos[i], [bx, bz] = pontos[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L));
    for (let k = 0; k < n; k++) P.push({ x: ax + (bx - ax) * k / n, z: az + (bz - az) * k / n, h: Math.atan2(bx - ax, bz - az) });
  }
  const ul = pontos.at(-1); P.push({ x: ul[0], z: ul[1], h: P.at(-1)?.h ?? 0 });
  let s = 0; P.forEach((p, i) => { if (i) s += Math.hypot(p.x - P[i - 1].x, p.z - P[i - 1].z); p.s = s; });
  return P;
}
const dentroPoligono = (x, z, p) => { let d = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, zi] = p[i], [xj, zj] = p[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d; } return d; };

export function criarVida(dados, rede, S, { maxParados = 700, nMoveis = 45, perto = null } = {}) {   // spec 056: 700 estacionados no mapa grande
  semente = 11;
  const L = dados.limites;
  // grade de 20 m com os prédios (para não pôr árvore/poste dentro de um)
  const CEL = 20, grade = new Map(), ck = (i, j) => i * 100003 + j;
  dados.predios.forEach((b, k) => {
    const xs = b.p.map(p => p[0]), zs = b.p.map(p => p[1]);
    for (let i = Math.floor(Math.min(...xs) / CEL); i <= Math.floor(Math.max(...xs) / CEL); i++)
      for (let j = Math.floor(Math.min(...zs) / CEL); j <= Math.floor(Math.max(...zs) / CEL); j++) { const c = ck(i, j); if (!grade.has(c)) grade.set(c, []); grade.get(c).push(k); }
  });
  const emPredio = (x, z) => (grade.get(ck(Math.floor(x / CEL), Math.floor(z / CEL))) || []).some(k => dentroPoligono(x, z, dados.predios[k].p));
  const proib = [...S.cruzamentos.map(c => [c.x, c.z, 12]), ...S.faixas.map(f => [f.x, f.z, 8]),
    ...[...S.semaforos.flatMap(s => s.linhas), ...S.pares.map(p => p.linha), ...S.radares].map(l => [l.x, l.z, 14])];
  const livre = (x, z) => x > L.x0 + 10 && x < L.x1 - 10 && z > L.z0 + 10 && z < L.z1 - 10 && !proib.some(([px, pz, r]) => Math.hypot(px - x, pz - z) < r);

  // ---- carros andando (spec 047): circulam pela REDE de ruas. Cada rua vira um ou dois "trilhos" (mão única: só no
  // sentido dela; mão dupla: os dois, cada um na sua faixa da direita). No fim de um trilho o carro segue por um que
  // começa ali (de preferência reto; nunca dá meia-volta se houver outro); sem saída (beira do mapa) → reaparece longe
  // do jogador. Na mão única larga vai pela faixa da esquerda (a direita tem estacionados).
  const chave = (x, z) => x.toFixed(1) + ',' + z.toFixed(1);
  const trilhos = [], porInicio = new Map();
  const addTrilho = (ri, pontos, off) => {
    const P = amostra(pontos), L = P.at(-1).s;
    if (L < 0.3) return;
    const r = dados.ruas[ri], t = { k: trilhos.length, ri, P, L, off, ini: chave(...pontos[0]), fim: chave(...pontos.at(-1)), h0: P[0].h, h1: P.at(-1).h,
      vmax: Math.min(r.limite, 40) / 3.6 * 0.85, sinais: [...S.semaforos.filter(x => x.linhas[0].ri === ri).map(x => ({ id: x.id, l: x.linhas[0], pare: false })),
        ...S.pares.filter(x => x.linha.ri === ri).map(x => ({ id: x.id, l: x.linha, pare: true }))] };
    trilhos.push(t);
    if (!porInicio.has(t.ini)) porInicio.set(t.ini, []);
    porInicio.get(t.ini).push(t);
  };
  // spec 053: as ruas do OSM se cruzam em nós do MEIO umas das outras; o trilho só achava continuação nas pontas e o
  // carro "sumia" ao chegar numa ponta que cai no meio de outra rua. Agora cada rua é cortada nos nós que divide com
  // outra (cruzamentos) e os pedaços se ligam ali.
  const usoNo = new Map();
  dados.ruas.forEach(r => { if (r.largura >= 4) new Set(r.pontos.map(q => chave(...q))).forEach(k => usoNo.set(k, (usoNo.get(k) || 0) + 1)); });
  const pedacos = pts => { const out = []; let a = 0;
    for (let i = 1; i < pts.length; i++) if (i === pts.length - 1 || usoNo.get(chave(...pts[i])) > 1) { out.push(pts.slice(a, i + 1)); a = i; }
    return out; };
  dados.ruas.forEach((r, ri) => {
    if (r.largura < 4) return;
    for (const pd of pedacos(r.pontos)) {
      if (r.maoUnica) addTrilho(ri, pd, r.largura >= 6.5 ? -1.0 : 0);
      else { addTrilho(ri, pd, r.largura / 4); addTrilho(ri, [...pd].reverse(), r.largura / 4); }
    }
  });
  const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  function proximo(tr, jog) {
    const ali = porInicio.get(tr.fim) || [], op = ali.filter(o => !(o.ri === tr.ri && o.fim === tr.ini));   // sem meia-volta
    if (!op.length) {   // beco de verdade: na mão dupla, perto do jogador, faz o retorno (não some na frente dele)
      const volta = ali.find(o => o.ri === tr.ri && o.fim === tr.ini);
      return volta && jog && Math.hypot(tr.P.at(-1).x - jog.x, tr.P.at(-1).z - jog.z) < 200 ? volta : null;
    }
    op.sort((a, b) => Math.abs(wrapA(a.h0 - tr.h1)) - Math.abs(wrapA(b.h0 - tr.h1)));
    return rnd() < 0.55 ? op[0] : op[(rnd() * op.length) | 0];
  }
  const noMapa = (x, z, f = 15) => x > L.x0 + f && x < L.x1 - f && z > L.z0 + f && z < L.z1 - f;
  const longos = trilhos.filter(t => t.L > 30 && noMapa(t.P[0].x, t.P[0].z, 30));   // spec 047b: nasce dentro do mapa
  const naRota = new Set();
  const CORES = ['#ff8a3d', '#3ad1ff', '#9b6bff', '#3ccf8e', '#ffd23f', '#ff5f6d', '#ffffff', '#2fa6c9'];
  const moveis = [];
  const ponto = (T, s) => {
    s = Math.max(0, Math.min(T.L, s)); let lo = 0, hi = T.P.length - 1;
    while (hi - lo > 1) { const md = (lo + hi) >> 1; if (T.P[md].s <= s) lo = md; else hi = md; }
    const a = T.P[lo], b = T.P[hi], k = (s - a.s) / Math.max(1e-6, b.s - a.s);
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
  };
  const em = (m, s, hOff) => {                // spec 047b: rumo pela corda (±2,5 m): vira suave nas quinas
    const T = m.tr, a = ponto(T, s - 2.5), b = ponto(T, s + 2.5), c = ponto(T, s);
    const h = Math.hypot(b.x - a.x, b.z - a.z) > 0.2 ? Math.atan2(b.x - a.x, b.z - a.z) : (T.P[0].h);
    // spec 054: o deslocamento da faixa usa o rumo suavizado do carro (hOff) — na troca de trecho o rumo da corda
    // vira de uma vez e o carro pulava 3–5 m de lado
    const ho = hOff ?? h, rx = -Math.cos(ho), rz = Math.sin(ho), off = m.off ?? T.off;   // m.off desliza até T.off
    return { x: c.x + rx * off, z: c.z + rz * off, h };
  };
  // o trânsito acompanha o jogador: nasce a 30–250 m dele (na largada); quem fica a > 320 m reaparece a 140–300 m
  const pertoDe = (q, a, b) => longos.filter(t => { const d = Math.hypot(t.P[0].x - q.x, t.P[0].z - q.z); return d > a && d < b; });
  const iniciais = perto ? pertoDe(perto, 30, 250) : longos;
  for (let k = 0; k < nMoveis && longos.length; k++) {
    const lista = iniciais.length ? iniciais : longos;
    const m = { id: 'mc' + k, k, tr: null, s: 0, v: 0, cor: CORES[k % CORES.length], x: 0, z: 0, heading: 0, parado: 0, feitos: new Set(), off: 0 };
    for (let n = 0; n < 40; n++) {                // um ponto sem ninguém a menos de 25 m (spec 047b: nasciam juntos)
      m.tr = lista[(rnd() * lista.length) | 0]; m.s = m.tr.L * (0.1 + rnd() * 0.8); m.off = m.tr.off;
      const p = em(m, m.s); m.x = p.x; m.z = p.z; m.heading = p.h;
      if (!moveis.some(o => Math.hypot(o.x - m.x, o.z - m.z) < 25)) break;
    }
    moveis.push(m);
  }

  // reaparece num ponto de QUALQUER trecho de rua a 140–300 m do jogador (fora da vista), dentro do mapa e sem carro a
  // menos de 25 m (spec 047b — antes era só no começo das ruas: perto da borda do mapa faltava lugar e o carro ia parar
  // longe, saía de novo e ficava pulando). Sem lugar agora: tenta de novo no próximo quadro.
  function reaparece(m, jog, visto) {
    for (let n = 0; n < 40; n++) {
      const tr = trilhos[(rnd() * trilhos.length) | 0], s0 = rnd() * tr.L, q = ponto(tr, s0);
      const d = jog ? Math.hypot(q.x - jog.x, q.z - jog.z) : 200;
      if (d < 140 || d > 300 || !noMapa(q.x, q.z, 20) || (visto && d < 260 && visto(q.x, q.z)) || moveis.some(o => o !== m && Math.hypot(o.x - q.x, o.z - q.z) < 25)) continue;
      m.tr = tr; m.s = s0; m.v = 0; m.feitos = new Set(); m.off = tr.off;
      const p = em(m, m.s); m.x = p.x; m.z = p.z; m.heading = p.h;
      return true;
    }
    return false;
  }

  // ---- estacionados: vagas a cada 7 m nas ruas de mão única largas (fora das rotas dos carros andando)
  const vagas = [];
  dados.ruas.forEach((r, ri) => {
    if (!r.maoUnica || r.largura < 6.5 || naRota.has(ri)) return;
    const P = amostra(r.pontos), hw = r.largura / 2, off = hw - 0.25 - MEIO_CARRO_L;
    for (let s = 10; s < P.at(-1).s - 10; s += 7) {
      const p = P[Math.min(P.length - 1, Math.round(s))], q = P[Math.min(P.length - 1, Math.round(s) + 3)];
      let dh = q.h - p.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
      if (Math.abs(dh) > 0.25) continue;                                            // na curva, não
      const x = p.x - Math.cos(p.h) * off, z = p.z + Math.sin(p.h) * off;
      if (livre(x, z)) vagas.push({ x, z, heading: p.h });
    }
  });
  const prob = Math.min(0.45, maxParados / Math.max(1, vagas.length));
  const parados = vagas.filter(() => rnd() < prob).map(v => ({ ...v, cor: ['#ff8fb8', '#ffd166', '#7fd8ff', '#a0e57a', '#c9a3ff', '#ffb27a', '#e6e6e6', '#8ef0d4'][(rnd() * 8) | 0] }));

  // ---- árvores e postes: nas avenidas (dos dois lados, espaçados) e nas praças
  const arvores = [], postes = [];
  dados.ruas.forEach(r => {
    if (!/^Avenida/.test(r.nome)) return;
    const P = amostra(r.pontos), hw = r.largura / 2 + 0.9;
    for (let s = 12, k = 0; s < P.at(-1).s - 12; s += 24, k++) {
      const p = P[Math.round(s)];
      for (const lado of [-1, 1]) {
        const x = p.x - Math.cos(p.h) * hw * lado, z = p.z + Math.sin(p.h) * hw * lado;
        if (!livre(x, z) || emPredio(x, z) || parados.some(c => Math.hypot(c.x - x, c.z - z) < 3)) continue;
        if ((k + (lado > 0 ? 1 : 0)) % 2) arvores.push({ x, z, r: 2.2 + rnd() * 0.8 }); else if (k % 4 === 0) postes.push({ x, z, h: p.h });
      }
    }
  });
  for (const pr of dados.pracas) {
    const xs = pr.p.map(p => p[0]), zs = pr.p.map(p => p[1]), area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs));
    const n = Math.min(10, Math.floor(area / 300));
    for (let k = 0, tent = 0; k < n && tent < 60; tent++) {
      const x = Math.min(...xs) + rnd() * (Math.max(...xs) - Math.min(...xs)), z = Math.min(...zs) + rnd() * (Math.max(...zs) - Math.min(...zs));
      if (dentroPoligono(x, z, pr.p) && !rede.podeAndar(x, z) && !emPredio(x, z)) { arvores.push({ x, z, r: 2.4 + rnd() }); k++; }
    }
  }

  // colisão: o jogador não entra num carro (parado ou andando); grade de 10 m para os parados
  const gp = new Map(), C2 = 10;
  parados.forEach(c => { const k = ck(Math.floor(c.x / C2), Math.floor(c.z / C2)); if (!gp.has(k)) gp.set(k, []); gp.get(k).push(c); });
  const dentroCarro = (c, x, z) => { const fx = Math.sin(c.heading), fz = Math.cos(c.heading), dx = x - c.x, dz = z - c.z; return Math.abs(dx * fx + dz * fz) < MEIO_CARRO_C + 0.6 && Math.abs(-dx * fz + dz * fx) < MEIO_CARRO_L + 0.6; };
  function ocupa(x, z) {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const c of gp.get(ck(Math.floor(x / C2) + i, Math.floor(z / C2) + j)) || []) if (dentroCarro(c, x, z)) return true;
    return moveis.some(m => dentroCarro(m, x, z));
  }

  // o carro `o` atrapalha `m`? { d, lado } — na frente na mesma faixa (até 18 m), ou chegando de lado perto (até 8 m)
  function ve(m, o) {
    const fx = Math.sin(m.heading), fz = Math.cos(m.heading), dx = o.x - m.x, dz = o.z - m.z, d = dx * fx + dz * fz, w = Math.abs(-dx * fz + dz * fx);
    if (d <= 0) return null;
    if (d < 18 && w < 2.2 && Math.cos(o.heading - m.heading) > 0.3) return { d, lado: false };   // fila: o da frente
    if (d < 12 && w < 2.0) return { d, lado: true };            // parado/atravessado no meu caminho (qualquer rumo)
    if (d < 8 && w < 2.8) return { d, lado: true };
    return null;
  }
  // spec 047b: cruzamento sem semáforo — as duas trajetórias (retas à frente) se cruzam a < 25 m de cada um e eles
  // chegariam lá com < 2,5 s de diferença → quem chega depois (empate: índice maior) para 4 m antes do ponto
  function cruza(m, o, sempre = false) {          // sempre: m cede mesmo chegando antes (o jogador)
    const ux = Math.sin(m.heading), uz = Math.cos(m.heading), wx = Math.sin(o.heading), wz = Math.cos(o.heading);
    const cr = ux * wz - uz * wx;
    if (Math.abs(cr) < 0.5) return null;                       // quase paralelos: é caso de "seguir o da frente"
    const qx = o.x - m.x, qz = o.z - m.z, a = (qx * wz - qz * wx) / cr, b = (qx * uz - qz * ux) / cr;
    if (a <= 0 || b <= -2 || a > 25 || b > 25) return null;
    const tm = a / Math.max(m.v, 1), to = Math.max(0, b) / Math.max(o.v, 1);
    if (Math.abs(tm - to) > 2.5) return null;
    return sempre || tm > to || (tm === to && m.k > o.k) ? a : null;
  }
  const consegueParar = (v, d) => v * v / (2 * Math.max(d, 0.1)) <= 5 || v < 0.6;   // amarelo em cima: segue
  // visto(x, z): o jogador está vendo esse ponto (câmera) — spec 054: ninguém some nem aparece na frente dele
  function passo(dt, t, jog, visto = null) {
    const naVista = m => visto && visto(m.x, m.z);
    for (const m of moveis) {
      let alvo = m.tr.vmax, pare = Infinity;
      const pa = em(m, m.s), fx = Math.sin(pa.h), fz = Math.cos(pa.h);
      for (const sn of m.tr.sinais) {              // vermelho/amarelo: para antes da linha; PARE: para 1,5 s e segue
        const l = sn.l, d = (l.x - pa.x) * fx + (l.z - pa.z) * fz;
        if (d <= 0.5 || d > 40 || Math.cos(l.heading - pa.h) < 0.5) continue;
        if (sn.pare) {
          if (m.feitos.has(sn.id)) continue;
          if (d < 3.5 && m.v < 0.2) { m.parado += dt; if (m.parado > 1.5) { m.feitos.add(sn.id); m.parado = 0; continue; } }
          pare = Math.min(pare, d - 2);
        } else if (S.fase(sn.id, t) !== 'verde') pare = Math.min(pare, d - 2);
      }
      // spec 047b: cruzamento com semáforo mesmo sem poste nesta entrada → obedece a fase do eixo em que está
      for (const cs of S.cruzSinal || []) {
        const dx = cs.x - pa.x, dz = cs.z - pa.z, d = dx * fx + dz * fz, w = Math.abs(-dx * fz + dz * fx);
        // só antes de chegar (a parada fica 9 m antes do meio); quem já está entrando termina de passar
        if (d > 10.5 && d < 35 && w < 4 && S.faseCruz(cs, pa.h, t) !== 'verde' && consegueParar(m.v, d - 9)) pare = Math.min(pare, d - 9);
      }
      if (jog) {                                     // o jogador logo à frente — ou cruzando o caminho (o IA sempre dá a vez)
        const dx = jog.x - pa.x, dz = jog.z - pa.z, d = dx * fx + dz * fz, w = Math.abs(-dx * fz + dz * fx);
        if (d > 0 && d < 18 && w < 2.4) pare = Math.min(pare, d - 6);
        if (jog.heading !== undefined) { const a = cruza(m, { ...jog, k: -1 }, true); if (a !== null) pare = Math.min(pare, a - 4); }
      }
      // spec 047b: esperou > 5 s por causa de cruzamento (sem sinal) → passa devagar por 3 s (desfaz o "todo mundo esperando")
      const vai = t < (m.vaiAte || 0);
      let porCruz = Infinity;
      for (const o of moveis) {                      // outro carro: na mesma trilha à frente, ou cruzando/juntando perto
        if (o === m) continue;
        const a = vai ? null : cruza(m, o);
        if (a !== null) porCruz = Math.min(porCruz, a - 4);
        const v = ve(m, o);
        if (v === null) continue;
        if (v.lado && (vai || (ve(o, m)?.lado && m.k < o.k))) continue;   // os dois se veem de lado: o de índice menor passa
        if (v.lado) porCruz = Math.min(porCruz, v.d - 3.5); else pare = Math.min(pare, v.d - 6);
      }
      if (porCruz < Infinity && porCruz < pare) {
        m.esperaCruz = (m.esperaCruz || 0) + (m.v < 0.2 ? dt : 0);
        if (m.esperaCruz > 5) { m.vaiAte = t + 3; m.esperaCruz = 0; }
      } else m.esperaCruz = 0;
      pare = Math.min(pare, porCruz);
      if (vai) alvo = Math.min(alvo, 3);
      if (pare < Infinity) alvo = Math.min(alvo, Math.sqrt(2 * 3 * Math.max(0, pare)));
      m.v += Math.max(-6 * dt, Math.min(2.5 * dt, alvo - m.v));
      m.s += Math.max(0, m.v) * dt;
      if (m.s >= m.tr.L - 0.3) {                   // fim do trilho: segue pelo próximo (ou reaparece longe)
        const nx = proximo(m.tr, jog);
        if (nx) { m.s -= m.tr.L; m.tr = nx; m.feitos = new Set(); }
        else if (naVista(m) || !reaparece(m, jog, visto)) { m.s = m.tr.L - 0.31; m.v = 0; }   // à vista: espera no fim
      }
      if (((jog && Math.hypot(m.x - jog.x, m.z - jog.z) > 320) || !noMapa(m.x, m.z, 5)) && !naVista(m) && reaparece(m, jog, visto)) continue;
      m.off += Math.max(-1.5 * dt, Math.min(1.5 * dt, m.tr.off - m.off));   // troca de faixa a 1,5 m/s (não pula)
      const h = em(m, m.s).h;
      m.heading += wrapA(h - m.heading) * Math.min(1, dt * 7);        // spec 047b: gira suave (também na troca de rua)
      const p = em(m, m.s, m.heading); m.x = p.x; m.z = p.z;
    }
  }
  passo(0, 0, null);
  return { parados, vagas, arvores, postes, moveis, passo, ocupa };
}
