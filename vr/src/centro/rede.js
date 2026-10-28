// Spec 015 — a rede de ruas do Centro de Chapecó (dados/centro.json, do OpenStreetMap), lógica pura (sem THREE, sem DOM).
// Uma grade de 20 m guarda os segmentos de rua que passam em cada célula; "está na rua" = o centro do carro a até
// meia-largura (+ folga) do eixo de algum segmento. Rótulas são ruas como as outras (o miolo não é rua, então barra).

const CEL = 20;
const FOLGA = 0.6;            // m além da meia-largura: o carro (1,7 m) pode encostar no meio-fio sem travar

export function criarRede(dados) {
  const segs = [];
  dados.ruas.forEach((r, ri) => {
    for (let i = 0; i < r.pontos.length - 1; i++) {
      const [ax, az] = r.pontos[i], [bx, bz] = r.pontos[i + 1], L = Math.hypot(bx - ax, bz - az);
      if (L < 0.01) continue;
      segs.push({ ri, ax, az, bx, bz, L, ux: (bx - ax) / L, uz: (bz - az) / L, meia: r.largura / 2 });
    }
  });
  const grade = new Map();
  const chave = (i, j) => i * 100003 + j;
  segs.forEach((s, k) => {
    const m = s.meia + FOLGA;
    const i0 = Math.floor((Math.min(s.ax, s.bx) - m) / CEL), i1 = Math.floor((Math.max(s.ax, s.bx) + m) / CEL);
    const j0 = Math.floor((Math.min(s.az, s.bz) - m) / CEL), j1 = Math.floor((Math.max(s.az, s.bz) + m) / CEL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const c = chave(i, j); if (!grade.has(c)) grade.set(c, []); grade.get(c).push(k);
    }
  });
  const L = dados.limites;

  // o segmento mais perto de (x, z): { rua, d (m do eixo), t (m ao longo do segmento), seg }
  function maisPerto(x, z) {
    const lista = grade.get(chave(Math.floor(x / CEL), Math.floor(z / CEL)));
    if (!lista) return null;
    let melhor = null;
    for (const k of lista) {
      const s = segs[k], px = x - s.ax, pz = z - s.az;
      const t = Math.max(0, Math.min(s.L, px * s.ux + pz * s.uz));
      const d = Math.hypot(px - s.ux * t, pz - s.uz * t);
      if (!melhor || d - s.meia < melhor.d - melhor.seg.meia) melhor = { d, t, seg: s, rua: dados.ruas[s.ri] };
    }
    return melhor;
  }
  function podeAndar(x, z) {
    if (x < L.x0 || x > L.x1 || z < L.z0 || z > L.z1) return false;
    const m = maisPerto(x, z);
    return !!m && m.d <= m.seg.meia + FOLGA;
  }
  // rumo do segmento mais perto (no sentido do desenho = sentido da mão única) e a rua
  function rumoEm(x, z) {
    const m = maisPerto(x, z);
    if (!m) return null;
    return { heading: Math.atan2(m.seg.ux, m.seg.uz), rua: m.rua, d: m.d };
  }
  return { segs, maisPerto, podeAndar, rumoEm, limites: L };
}

// ponto de largada: no meio da pista da rua `nome` mais perto do marco `perto`, no sentido do desenho
export function largada(dados, rede, nome, perto) {
  let melhor = null;
  for (const s of rede.segs) {
    const r = dados.ruas[s.ri];
    if (!r.nome.startsWith(nome)) continue;
    const mx = (s.ax + s.bx) / 2, mz = (s.az + s.bz) / 2, d = Math.hypot(mx - perto.x, mz - perto.z);
    if (s.L > 12 && (!melhor || d < melhor.d)) melhor = { d, x: mx, z: mz, heading: Math.atan2(s.ux, s.uz), rua: r };
  }
  return melhor;
}
