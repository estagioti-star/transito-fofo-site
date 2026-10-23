// Spec 044 — a sinalização de verdade do Centro de Chapecó (semáforos, PAREs, faixas de pedestre e radares do
// OpenStreetMap, em dados/centro.json), em lógica pura (sem THREE, sem DOM): cada ponto vira uma LINHA DE PARADA de
// quem chega (rumo, lado direito da pista) e um "bairro" no formato que o fiscal do jogo entende — assim as regras e as
// multas do Centro são as MESMAS do bairro (fiscal.js), sem copiar código.
//
// De que lado vale: o OSM marca o semáforo/PARE no ponto da rua uns metros antes do cruzamento, quase sempre sem o
// sentido. Vale para quem anda na direção do cruzamento mais perto (na mão única, sempre no sentido da rua; no PARE,
// "forward/backward" do OSM manda quando existe).
// Semáforos de um mesmo cruzamento se alternam por eixo (a rua e a transversal): ciclo de 30 s, verde 12 + amarelo 3,
// e o outro eixo depois; cruzamentos vizinhos com a fase deslocada.

const TAU = 2 * Math.PI;
const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
export const CICLO = { verde: 12, amarelo: 3, total: 30 };

export function criarSinais(dados, rede) {
  const L = dados.limites, dentro = p => p.x > L.x0 + 5 && p.x < L.x1 - 5 && p.z > L.z0 + 5 && p.z < L.z1 - 5;
  const nomeBase = n => (n || '').replace(/ - [NSDELO]$/, '');
  // cruzamentos: pontos que aparecem em ruas de nomes diferentes
  const m = new Map();
  dados.ruas.forEach(r => r.pontos.forEach(([x, z]) => {
    const k = x.toFixed(1) + ',' + z.toFixed(1);
    if (!m.has(k)) m.set(k, { x, z, nomes: new Set() });
    m.get(k).nomes.add(nomeBase(r.nome));
  }));
  const cruz = [...m.values()].filter(c => c.nomes.size >= 2);
  const cruzMaisPerto = (x, z, max) => { let b = null, bd = max; for (const c of cruz) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; b = c; } } return b; };

  // um ponto do OSM → linha de parada { x, z (no eixo da rua), heading (de quem chega), rua (índice), meia (meia-largura que vale) }
  // perto(x, z, raio): a rua mais perto até `raio` m da beira (spec 060: o radar do OSM fica no POSTE, até ~9 m do eixo —
  // a grade da rede só enxerga a pista, então procura em todos os segmentos)
  function maisPertoLonge(x, z, raio) {
    let m = null;
    for (const s of rede.segs) {
      const px = x - s.ax, pz = z - s.az, t = Math.max(0, Math.min(s.L, px * s.ux + pz * s.uz)), d = Math.hypot(px - s.ux * t, pz - s.uz * t);
      if (d - s.meia <= raio && (!m || d - s.meia < m.d - m.seg.meia)) m = { d, t, seg: s };
    }
    return m;
  }
  function linhaDe(p, sentido, raio = 0) {
    const mp = raio ? maisPertoLonge(p.x, p.z, raio) : rede.maisPerto(p.x, p.z);
    if (!mp || mp.d > mp.seg.meia + Math.max(2, raio)) return null;
    const s = mp.seg, r = dados.ruas[s.ri], h = Math.atan2(s.ux, s.uz);
    const x = s.ax + s.ux * mp.t, z = s.az + s.uz * mp.t;
    let rumo = h;
    if (r.maoUnica) rumo = h;
    else if (sentido === 'backward') rumo = h + Math.PI;
    else if (sentido !== 'forward') {
      const c = cruzMaisPerto(x, z, 25);
      if (c && Math.hypot(c.x - x, c.z - z) > 1.5 && (c.x - x) * s.ux + (c.z - z) * s.uz < 0) rumo = h + Math.PI;
    }
    rumo = wrap(rumo);
    // linha um pouco antes do ponto (o semáforo fica na esquina; o carro para antes)
    return { x, z, heading: rumo, rua: 'r' + s.ri, ri: s.ri, largura: r.largura, mao: !r.maoUnica, nome: nomeBase(r.nome) };
  }

  // ---- semáforos: agrupa por cruzamento e, dentro dele, por eixo
  const semaforos = [];
  const grupos = new Map();                       // cruzamento → eixo de referência
  dados.semaforos.filter(dentro).forEach((p, i) => {
    const l = linhaDe(p, p.sentido);
    if (!l) return;
    const c = cruzMaisPerto(l.x, l.z, 30) || { x: l.x, z: l.z };
    // spec 047b: cruzamentos a < 25 m um do outro (avenida com canteiro: 2 nós) são UM só, com o mesmo tempo
    let ck = c.x.toFixed(1) + ',' + c.z.toFixed(1);
    for (const [k, g] of grupos) if (Math.hypot(g.x - c.x, g.z - c.z) < 25) { ck = k; break; }
    if (!grupos.has(ck)) grupos.set(ck, { eixo: l.heading, n: grupos.size, x: c.x, z: c.z, nos: [] });
    const gr = grupos.get(ck), eixo = Math.abs(Math.cos(l.heading - gr.eixo)) > 0.7 ? 0 : 1;
    if (!gr.nos.some(q => Math.hypot(q.x - c.x, q.z - c.z) < 1)) gr.nos.push({ x: c.x, z: c.z });
    // cruzamentos vizinhos não abrem todos juntos: desloca a fase 7 s por cruzamento
    semaforos.push({ id: 'sc' + i, no: 'cz_' + ck, ciclo: { eixo, off: (gr.n * 7) % CICLO.total }, linhas: [l], cx: gr.x, cz: gr.z });
  });
  const SEM = new Map(semaforos.map(s => [s.id, s]));
  // spec 047b: o cruzamento inteiro com semáforo (para os carros IA que chegam por uma entrada sem poste no OSM)
  // (um por NÓ do cruzamento, todos com o tempo do grupo)
  const cruzSinal = [...grupos.values()].flatMap(g => g.nos.map(q => ({ x: q.x, z: q.z, eixo: g.eixo, off: (g.n * 7) % CICLO.total })));
  function faseCruz(c, heading, t) {
    const eixo = Math.abs(Math.cos(heading - c.eixo)) > 0.7 ? 0 : 1;
    const tt = (((t + c.off - eixo * 15) % CICLO.total) + CICLO.total) % CICLO.total;
    return tt < CICLO.verde ? 'verde' : tt < CICLO.verde + CICLO.amarelo ? 'amarelo' : 'vermelho';
  }
  function fase(id, t) {
    const s = SEM.get(id); if (!s) return 'verde';
    const tt = (((t + s.ciclo.off - s.ciclo.eixo * 15) % CICLO.total) + CICLO.total) % CICLO.total;
    return tt < CICLO.verde ? 'verde' : tt < CICLO.verde + CICLO.amarelo ? 'amarelo' : 'vermelho';
  }

  // ---- PAREs (o fiscal precisa do "nó": o cruzamento à frente)
  const pares = [];
  dados.pares.filter(dentro).forEach((p, i) => {
    const l = linhaDe(p, p.sentido);
    if (!l) return;
    const c = cruzMaisPerto(l.x, l.z, 30) || { x: l.x + Math.sin(l.heading) * 6, z: l.z + Math.cos(l.heading) * 6 };
    pares.push({ id: 'pc' + i, no: 'pn' + i, linha: l, cx: c.x, cz: c.z });
  });
  // ---- faixas de pedestre (a zebra atravessa a rua toda) e radares (limite do OSM)
  const faixas = [];
  dados.faixas.filter(dentro).forEach((p, i) => {
    const l = linhaDe(p, '');
    if (l) faixas.push({ id: 'fc' + i, rua: l.rua, x: l.x, z: l.z, heading: l.heading, largura: 4, comprimento: l.largura });
  });
  const radares = [];
  dados.radares.filter(dentro).forEach((p, i) => {
    const l = linhaDe(p, p.sentido, 7);          // spec 060: até 7 m da beira (radar no poste)
    if (l) radares.push({ id: 'rc' + i, rua: l.rua, x: l.x, z: l.z, heading: l.heading, limiteKmh: p.limite || dados.ruas[l.ri].limite });
  });

  // ---- o "bairro" para o fiscal: ruas com largura e mão; nós de semáforo/PARE; naRua e limite do OSM
  const ruas = dados.ruas.map((r, i) => ({ id: 'r' + i, nome: r.nome, pontos: r.pontos, largura: r.largura, maoDupla: !r.maoUnica, limiteKmh: r.limite }));
  const nos = [...semaforos.map(s => ({ id: s.no, x: s.cx, z: s.cz, tipo: 'semaforo' })), ...pares.map(p => ({ id: p.no, x: p.cx, z: p.cz, tipo: 'pare' }))];
  function naRua(x, z, heading) {
    const mp = rede.maisPerto(x, z);
    if (!mp || mp.d > mp.seg.meia + 0.6) return null;
    const s = mp.seg, r = dados.ruas[s.ri], px = s.ax + s.ux * mp.t, pz = s.az + s.uz * mp.t;
    const lat = (x - px) * -s.uz + (z - pz) * s.ux, al = heading === undefined ? 1 : Math.sin(heading) * s.ux + Math.cos(heading) * s.uz;
    const lado = r.maoUnica ? (al > 0 ? 'direita' : 'contramao') : (lat * (al >= 0 ? 1 : -1) > 0 ? 'direita' : 'contramao');
    return { rua: 'r' + s.ri, lado, dist: +Math.abs(lat).toFixed(3) };
  }
  const limiteEm = (x, z) => { const r = rede.rumoEm(x, z); return r ? r.rua.limite : 40; };
  const bairro = {
    ruas, nos, semaforos, pares, faixas, radares, lombadas: [], escola: { x0: 1e9, x1: 1e9, z0: 1e9, z1: 1e9, limiteKmh: 30 },
    predios: [], vagas: [], zonasSilencio: [], pontes: [], rotula: { x: 1e7, z: 1e7, ilha: 1, R: 2, externo: 3 },
  };
  return { bairro, fase, naRua, limiteEm, semaforos, pares, faixas, radares, cruzamentos: cruz, cruzSinal, faseCruz };
}
