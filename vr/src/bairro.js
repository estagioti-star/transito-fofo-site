// O bairro inventado, em dados puros. Sem THREE, sem DOM, sem window: roda no Node.
// Coordenadas (convencoes/README.md): metros, x = leste, z = -norte (sul é +z), heading h → frente (sin h, cos h).
// Mão brasileira: trafega pela DIREITA. A direita de quem vai no rumo h é (-cos h, sin h).
//   h = 0 → vai pro sul (+z), direita = oeste (-x) · h = π/2 → leste (+x), direita = sul (+z)
//   h = π → norte (-z), direita = leste (+x)       · h = -π/2 → oeste (-x), direita = norte (-z)

const PI = Math.PI;
export const RUMO = { sul: 0, leste: PI / 2, norte: PI, oeste: -PI / 2 };

// Grade: 5 ruas norte-sul × 4 ruas leste-oeste = 12 quarteirões (~85 × 75 m de calçada a calçada).
// Spec 034 (mapa maior): ganhou a fileira norte (z −85, com o CENTRO) e a coluna leste (x 380).
export const GRADE = { X: [0, 95, 190, 285, 380], Z: [-85, 0, 85, 170] };
const LARG = 10, LARG_AV = 12;                       // rua comum mão dupla e avenida
export const ROTULA = { x: 190, z: 85, ilha: 8, R: 13, externo: 18 };   // anel de 8 a 18 m do centro
const CORTE = 19;                                    // quarteirões em volta da rótula perdem a quina (quadrado de 19 m)
export const LIMITES_MAPA = { x0: -5, z0: -90, x1: 385, z1: 175 };      // borda externa das ruas da beirada
// spec 040: a ESTRADA (via de trânsito rápido, 80 km/h — CTB art. 61 § 1º I a) sai do bairro pelo leste: continua a
// avenida (z 0) até x 620, desce até a Rua da Praça (z 170) e volta para o bairro. Um rio corta as duas pernas
// leste-oeste: 2 pontes (art. 203 III / art. 32: não se ultrapassa na ponte). Fora do bairro só se anda NA estrada.
export const ESTRADA = { x: 620, rio: { x0: 478, x1: 506 }, zonaPonte: 40 };
const GX = [...GRADE.X, ESTRADA.x];                  // nós do GPS: a grade + a quina da estrada (só em z 0 e z 170)
const existeNo = (x, z) => x !== ESTRADA.x || z === 0 || z === 170;

// ---------------------------------------------------------------------------------------------------------------
// Ruas. `pontos` na ordem do desenho; numa rua de mão única (rótula) essa é a ÚNICA direção permitida.
// ---------------------------------------------------------------------------------------------------------------
const anel = [];
for (let k = 0; k <= 48; k++) {            // anti-horário visto de cima com o norte pra cima: θ decrescente
  const th = PI - (k * 2 * PI) / 48;
  anel.push([+(ROTULA.x + ROTULA.R * Math.cos(th)).toFixed(3), +(ROTULA.z + ROTULA.R * Math.sin(th)).toFixed(3)]);
}
const ruas = [
  { id: 'avenida', nome: 'Avenida dos Ipês', pontos: [[0, 0], [380, 0]], limiteKmh: 60, largura: LARG_AV, maoDupla: true },
  { id: 'escola_o', nome: 'Rua da Escola', pontos: [[0, 85], [190 - ROTULA.R, 85]], limiteKmh: 40, largura: LARG, maoDupla: true },
  { id: 'escola_l', nome: 'Rua da Escola', pontos: [[190 + ROTULA.R, 85], [380, 85]], limiteKmh: 40, largura: LARG, maoDupla: true },
  { id: 'praca', nome: 'Rua da Praça', pontos: [[0, 170], [380, 170]], limiteKmh: 30, largura: LARG, maoDupla: true },
  { id: 'margaridas', nome: 'Rua das Margaridas', pontos: [[0, -85], [0, 170]], limiteKmh: 30, largura: LARG, maoDupla: true },
  { id: 'girassois', nome: 'Rua dos Girassóis', pontos: [[95, 0], [95, 170]], limiteKmh: 40, largura: LARG, maoDupla: true },
  { id: 'sabia_n', nome: 'Rua do Sabiá', pontos: [[190, 0], [190, 85 - ROTULA.R]], limiteKmh: 40, largura: LARG, maoDupla: true },
  { id: 'sabia_s', nome: 'Rua do Sabiá', pontos: [[190, 85 + ROTULA.R], [190, 170]], limiteKmh: 40, largura: LARG, maoDupla: true },
  { id: 'jabuticabeiras', nome: 'Rua das Jabuticabeiras', pontos: [[285, -85], [285, 170]], limiteKmh: 30, largura: LARG, maoDupla: true },
  // spec 034: ruas novas. Mão única (maoDupla: false): a ordem dos `pontos` é o ÚNICO sentido permitido.
  { id: 'acacias', nome: 'Rua das Acácias', pontos: [[0, -85], [380, -85]], limiteKmh: 40, largura: LARG, maoDupla: true },
  { id: 'palmeiras', nome: 'Rua das Palmeiras', pontos: [[380, -85], [380, 170]], limiteKmh: 40, largura: LARG, maoDupla: true },
  { id: 'centro_girassois', nome: 'Rua dos Girassóis (centro)', pontos: [[95, 0], [95, -85]], limiteKmh: 30, largura: LARG, maoDupla: false },   // só sobe (norte)
  { id: 'centro_sabia', nome: 'Rua do Sabiá (centro)', pontos: [[190, -85], [190, 0]], limiteKmh: 30, largura: LARG, maoDupla: false },        // só desce (sul)
  { id: 'rotula', nome: 'Rótula da Escola', pontos: anel, limiteKmh: 30, largura: 10, maoDupla: false },
  // spec 040: estrada (80 km/h). A perna norte continua a avenida (12 m); as outras têm 10 m.
  { id: 'estrada_n', nome: 'Estrada do Rio', pontos: [[380, 0], [ESTRADA.x, 0]], limiteKmh: 80, largura: LARG_AV, maoDupla: true, estrada: true },
  { id: 'estrada_l', nome: 'Estrada do Rio', pontos: [[ESTRADA.x, 0], [ESTRADA.x, 170]], limiteKmh: 80, largura: LARG, maoDupla: true, estrada: true },
  { id: 'estrada_s', nome: 'Estrada do Rio', pontos: [[380, 170], [ESTRADA.x, 170]], limiteKmh: 80, largura: LARG, maoDupla: true, estrada: true },
];
const RUA = Object.fromEntries(ruas.map(r => [r.id, r]));

// ---------------------------------------------------------------------------------------------------------------
// Nós (cruzamentos)
// ---------------------------------------------------------------------------------------------------------------
const nos = [];
const TIPO_NO = { '95,170': 'semaforo', '95,0': 'semaforo', '95,85': 'pare', '190,0': 'pare', '190,85': 'rotula' };
for (const x of GX) for (const z of GRADE.Z) {
  if (!existeNo(x, z)) continue;
  const tipo = TIPO_NO[`${x},${z}`] || 'livre';
  const n = { id: `n_${x}_${z}`, x, z, tipo };
  if (tipo === 'rotula') { n.raio = ROTULA.R; n.ilha = ROTULA.ilha; n.externo = ROTULA.externo; }
  nos.push(n);
}

// meia-largura da rua que CRUZA a rua `r` no nó (x, z) → onde fica a linha de parada
const meiaCruzada = (r, x, z) => {
  const horizontal = r.pontos[0][1] === r.pontos[r.pontos.length - 1][1];
  if (horizontal) return LARG / 2;
  return z === 0 ? LARG_AV / 2 : LARG / 2;
};
// linha de parada de quem chega ao nó (x, z) pela rua `ruaId` no rumo h: no meio da faixa da direita,
// 2 m antes da borda da rua cruzada
function linhaDeParada(ruaId, x, z, h) {
  const r = RUA[ruaId], lw = r.largura / 4, g = meiaCruzada(r, x, z) + 2;
  const fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
  return { rua: ruaId, x: +(x - fx * g + rx * lw).toFixed(3), z: +(z - fz * g + rz * lw).toFixed(3), heading: h };
}

// Semáforos: cada entrada é um GRUPO focal (um sentido de chegada). Spec 019: no mesmo nó cada sentido abre SOZINHO
// (antes os dois sentidos da mesma rua abriam juntos, e quem virava à esquerda cruzava quem vinha de frente).
// Ciclo de 42 s por nó com 3 sentidos: verde 10 + amarelo 3 + 1 s de "todos vermelhos" para cada um.
const ciclo = fase0 => ({ verde: 10, amarelo: 3, vermelho: 29, fase0 });
const semaforos = [
  { id: 'sem_praca_rua', no: 'n_95_170', ciclo: ciclo(0), linhas: [linhaDeParada('praca', 95, 170, RUMO.leste)] },
  { id: 'sem_praca_girassois', no: 'n_95_170', ciclo: ciclo(14), linhas: [linhaDeParada('girassois', 95, 170, RUMO.sul)] },
  { id: 'sem_praca_rua_o', no: 'n_95_170', ciclo: ciclo(28), linhas: [linhaDeParada('praca', 95, 170, RUMO.oeste)] },
  { id: 'sem_av_rua', no: 'n_95_0', ciclo: ciclo(7), linhas: [linhaDeParada('avenida', 95, 0, RUMO.oeste)] },
  { id: 'sem_av_girassois', no: 'n_95_0', ciclo: ciclo(21), linhas: [linhaDeParada('girassois', 95, 0, RUMO.norte)] },
  { id: 'sem_av_rua_l', no: 'n_95_0', ciclo: ciclo(35), linhas: [linhaDeParada('avenida', 95, 0, RUMO.leste)] },
];

// linha de parada na ENTRADA da rótula (spec 041, vinda da versão do site — spec 011 de lá): no meio da faixa da
// direita, 2 m antes do anel (raio externo)
function linhaRotula(ruaId, h) {
  const r = RUA[ruaId], lw = r.largura / 4, g = ROTULA.externo + 2;
  const fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
  return { rua: ruaId, x: +(ROTULA.x - fx * g + rx * lw).toFixed(3), z: +(ROTULA.z - fz * g + rz * lw).toFixed(3), heading: h };
}
const pares = [
  { id: 'pare_girassois_n', no: 'n_95_85', linha: linhaDeParada('girassois', 95, 85, RUMO.norte) },
  { id: 'pare_girassois_s', no: 'n_95_85', linha: linhaDeParada('girassois', 95, 85, RUMO.sul) },
  { id: 'pare_sabia_av', no: 'n_190_0', linha: linhaDeParada('sabia_n', 190, 0, RUMO.norte) },
  { id: 'pare_centro_av', no: 'n_190_0', linha: linhaDeParada('centro_sabia', 190, 0, RUMO.sul) },   // spec 034: quem desce do centro
  // spec 041 (escolha do Maki, 19/10/2026, igual ao site — "como nas rótulas de Chapecó"): PARE nas 4 entradas da rótula
  { id: 'pare_rotula_o', no: 'n_190_85', linha: linhaRotula('escola_o', RUMO.leste) },
  { id: 'pare_rotula_l', no: 'n_190_85', linha: linhaRotula('escola_l', RUMO.oeste) },
  { id: 'pare_rotula_n', no: 'n_190_85', linha: linhaRotula('sabia_n', RUMO.sul) },
  { id: 'pare_rotula_s', no: 'n_190_85', linha: linhaRotula('sabia_s', RUMO.norte) },
];

// heading da faixa = rumo da rua (sentido do desenho); vale para os dois sentidos numa rua de mão dupla
const faixas = [
  { id: 'faixa_praca', rua: 'praca', x: 55, z: 170, heading: RUMO.leste, largura: 4, comprimento: LARG },
  { id: 'faixa_escola', rua: 'escola_o', x: 140, z: 85, heading: RUMO.leste, largura: 4, comprimento: LARG },
  { id: 'faixa_farmacia', rua: 'avenida', x: 45, z: 0, heading: RUMO.leste, largura: 4, comprimento: LARG_AV },
];
const radares = [{ id: 'radar_av', rua: 'avenida', x: 140, z: -3, heading: RUMO.oeste, limiteKmh: 60 },
  { id: 'radar_estrada', rua: 'estrada_n', x: 440, z: -3, heading: RUMO.oeste, limiteKmh: 80 },   // spec 040: radar de 80 na volta
  // spec 041 (escolha do Maki, 19/10/2026): os 3 radares da versão do site (aviso = placa quantos m antes)
  { id: 'radar_girassois', rua: 'girassois', x: 97.5, z: 140, heading: RUMO.norte, limiteKmh: 40, aviso: 16 },
  { id: 'radar_escola', rua: 'escola_o', x: 130, z: 87.5, heading: RUMO.leste, limiteKmh: 30, aviso: 22 },
  { id: 'radar_sabia', rua: 'sabia_n', x: 192.5, z: 35, heading: RUMO.norte, limiteKmh: 40, aviso: 22 }];
// spec 040: pontes = onde a estrada passa sobre o rio (retângulo do tabuleiro, um pouco além das margens)
const pontes = [['estrada_n', 0, LARG_AV], ['estrada_s', 170, LARG]].map(([rua, z, w]) =>
  ({ id: 'ponte_' + rua.slice(-1), rua, x0: ESTRADA.rio.x0 - 4, x1: ESTRADA.rio.x1 + 4, z0: z - w / 2, z1: z + w / 2 }));
export const naPonte = (x, z, folga = 0) => pontes.find(p => x > p.x0 - folga && x < p.x1 + folga && z > p.z0 - 1 && z < p.z1 + 1) || null;
const lombadas = [{ id: 'lombada_praca', rua: 'praca', x: 32, z: 170, heading: RUMO.leste }];
const escola = { x0: 106, z0: 79, x1: 172, z1: 91, limiteKmh: 30 };
// spec 026: zona de silêncio (placa "proibido buzinar") na frente do posto de saúde, na Rua da Praça
const zonasSilencio = [{ id: 'silencio_posto', x0: 205, x1: 265, z0: 160, z1: 180 }];

// ---------------------------------------------------------------------------------------------------------------
// Prédios: calçadas dos quarteirões (altura baixa, também barram), casas, escola, farmácia, vovó, praça.
// ---------------------------------------------------------------------------------------------------------------
const predios = [];
const CORES = ['#ff8fb8', '#ffd166', '#7fd8ff', '#a0e57a', '#c9a3ff', '#ffb27a', '#ff6f7d', '#8ef0d4', '#fff07a'];
let semente = 7;
const rnd = () => { semente = (semente * 16807) % 2147483647; return (semente - 1) / 2147483646; };
const sobrepoe = (a, b, m = 0) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.z0 < b.z1 + m && a.z1 > b.z0 - m;

// spec 042: estacionamento LATERAL (paralelo ao meio-fio) numa baia na calçada da praça, na Rua dos Girassóis, para
// quem DESCE (rumo sul: a mão direita é o lado da praça). O meio-fio da baia fica em x 87,4 (a pista acaba em x 90).
export const BAIA = { x0: 87.4, x1: 90, z0: 102, z1: 146, heading: RUMO.sul };
const P_BAIA = 2.6;                                     // spec 043: profundidade de toda baia de estacionamento lateral
const quarteiroes = [];
const meiaH = z => (z === 0 ? LARG_AV : LARG) / 2;           // meia largura da rua leste-oeste na linha z (avenida = 12)
for (let i = 0; i < GRADE.X.length - 1; i++) for (let j = 0; j < GRADE.Z.length - 1; j++) {
  const q = { x0: GRADE.X[i] + LARG / 2, x1: GRADE.X[i + 1] - LARG / 2, z0: GRADE.Z[j] + meiaH(GRADE.Z[j]), z1: GRADE.Z[j + 1] - meiaH(GRADE.Z[j + 1]) };
  // spec 034: o CENTRO = os 2 quarteirões ao norte da avenida entre a Girassóis e a Jabuticabeiras (prédios altos)
  q.centro = GRADE.Z[j] === -85 && GRADE.X[i] >= 95 && GRADE.X[i + 1] <= 285;
  quarteiroes.push(q);
}
// spec 034: estacionamento no centro (quarteirão x 95–190). Entra pela Girassóis (mão única, subindo): vira à direita.
// Chão de asfalto = área SEM calçada (podeAndar deixa andar); meio-fio fino com a entrada aberta.
export const ESTACIONAMENTO = { x0: 100, x1: 172, z0: -76, z1: -44, entrada: { z0: -65, z1: -55 } };
const VAGA_L = 2.8, VAGA_P = 5;
const vagas = [];
{
  const E = ESTACIONAMENTO, tipos = ['pcd', 'pcd', 'idoso', 'idoso'];
  for (const [fila, z0, z1, h] of [['n', E.z0, E.z0 + VAGA_P, RUMO.norte], ['s', E.z1 - VAGA_P, E.z1, RUMO.sul]]) {
    for (let k = 0, x = E.x0 + 8; x + VAGA_L <= E.x1 - 2; k++, x += VAGA_L) {
      const tipo = fila === 'n' && k < 4 ? tipos[k] : 'comum';      // reservadas perto da entrada (como na vida real)
      vagas.push({ id: `vaga_${fila}${k + 1}`, tipo, x0: +x.toFixed(2), x1: +(x + VAGA_L).toFixed(2), z0, z1, heading: h });
    }
  }
  // carros já estacionados (ocupam a vaga e barram): sobram livres umas comuns (mais longe) e as reservadas (tentação!)
  const ocupadas = new Set(['vaga_n5', 'vaga_n6', 'vaga_n7', 'vaga_n9', 'vaga_n10', 'vaga_n12', 'vaga_n13', 'vaga_n15', 'vaga_n16', 'vaga_n18',
    'vaga_s1', 'vaga_s2', 'vaga_s4', 'vaga_s5', 'vaga_s6', 'vaga_s8', 'vaga_s10', 'vaga_s11', 'vaga_s12', 'vaga_s14', 'vaga_s16', 'vaga_s17', 'vaga_s19']);
  for (const v of vagas) v.ocupada = ocupadas.has(v.id);
}
// spec 042: 8 vagas laterais de 5,5 m na baia (tipo 'lateral', rumo sul). Livres: 2, 3, 4 e 6 (a missão para na 4,
// entre dois carros; entra pela 2 e 3 livres, de frente — o piloto não faz ré).
const VAGA_LAT = 5.5;
for (let k = 0, z = BAIA.z0; z + VAGA_LAT <= BAIA.z1 + 0.01; k++, z += VAGA_LAT)
  vagas.push({ id: `vaga_l${k + 1}`, tipo: 'lateral', x0: BAIA.x0, x1: BAIA.x1, z0: z, z1: +(z + VAGA_LAT).toFixed(2), heading: BAIA.heading,
    ocupada: [0, 4, 6, 7].includes(k), meioFio: { eixo: 'x', v: BAIA.x0, s: 1 } });
// recorta a quina do quarteirão que encosta na rótula (quadrado de CORTE m a partir do centro)
function recorta(q) {
  const cx = ROTULA.x, cz = ROTULA.z;
  const nx = Math.abs(q.x1 - cx) < 10 ? 'x1' : Math.abs(q.x0 - cx) < 10 ? 'x0' : null;
  const nz = Math.abs(q.z1 - cz) < 10 ? 'z1' : Math.abs(q.z0 - cz) < 10 ? 'z0' : null;
  if (!nx || !nz) return [q];
  const cxl = nx === 'x1' ? cx - CORTE : cx + CORTE, czl = nz === 'z1' ? cz - CORTE : cz + CORTE;
  const zFica = nz === 'z1' ? [q.z0, czl] : [czl, q.z1], zCorte = nz === 'z1' ? [czl, q.z1] : [q.z0, czl];
  const xFica = nx === 'x1' ? [q.x0, cxl] : [cxl, q.x1];
  return [{ x0: q.x0, x1: q.x1, z0: zFica[0], z1: zFica[1] }, { x0: xFica[0], x1: xFica[1], z0: zCorte[0], z1: zCorte[1] }];
}
const quinaRotula = { x0: ROTULA.x - CORTE - 3, x1: ROTULA.x + CORTE + 3, z0: ROTULA.z - CORTE - 3, z1: ROTULA.z + CORTE + 3 };
const ehLoteEstac = q => q.centro && q.x0 < ESTACIONAMENTO.x0 + 1 && q.x1 > ESTACIONAMENTO.x1;
for (const q of quarteiroes) {
  // spec 042: o quarteirão da praça perde a faixa da baia (x 87,4–90, z 102–146): vira asfalto (podeAndar deixa)
  if (q.x1 === 90 && q.z0 === 90 && q.z1 === 165) {
    for (const c of [{ x0: q.x0, x1: BAIA.x0, z0: q.z0, z1: q.z1 }, { x0: BAIA.x0, x1: q.x1, z0: q.z0, z1: BAIA.z0 }, { x0: BAIA.x0, x1: q.x1, z0: BAIA.z1, z1: q.z1 }])
      predios.push({ ...c, altura: 0.2, cor: '#ece3d3', tipo: 'calcada' });
    continue;
  }
  if (!ehLoteEstac(q)) { for (const p of recorta(q)) predios.push({ ...p, altura: 0.2, cor: '#ece3d3', tipo: 'calcada' }); continue; }
  // quarteirão do estacionamento: calçada em volta do pátio + meio-fio fino na frente, aberto na entrada
  const E = ESTACIONAMENTO, mf = E.x0 + 0.6;
  for (const c of [{ x0: q.x0, x1: q.x1, z0: q.z0, z1: E.z0 }, { x0: q.x0, x1: q.x1, z0: E.z1, z1: q.z1 }, { x0: E.x1, x1: q.x1, z0: E.z0, z1: E.z1 },
    { x0: q.x0, x1: mf, z0: E.z0, z1: E.entrada.z0 }, { x0: q.x0, x1: mf, z0: E.entrada.z1, z1: E.z1 }]) predios.push({ ...c, altura: 0.2, cor: '#ece3d3', tipo: 'calcada' });
}
// carros parados nas vagas ocupadas (barram como prédio; mundo.js desenha um carrinho)
for (const v of vagas) if (v.ocupada) {
  const cx = v.tipo === 'lateral' ? v.x0 + 0.25 + 0.9 : (v.x0 + v.x1) / 2, cz = (v.z0 + v.z1) / 2;
  predios.push({ x0: cx - 0.9, x1: cx + 0.9, z0: cz - 1.8, z1: cz + 1.8, altura: 1.6, cor: CORES[(rnd() * CORES.length) | 0], tipo: 'carroParado', heading: v.heading });
}

// especiais
const PRACA = { x0: 5 + P_BAIA, z0: 90 + P_BAIA, x1: BAIA.x0, z1: 165 - P_BAIA };   // o quarteirão sudoeste (menos as baias)
const ESCOLA_LOTE = { x0: 100, z0: 90, x1: 172, z1: 128 };
predios.push({ ...PRACA, altura: 0.25, cor: '#8fdc6a', tipo: 'praca' });
predios.push({ x0: 116, z0: 94, x1: 164, z1: 112, altura: 8, cor: '#ffb43a', tipo: 'escola' });
predios.push({ x0: 10, z0: -24, x1: 36, z1: -10, altura: 6, cor: '#5fd38d', tipo: 'farmacia' });
predios.push({ x0: 6, z0: 179, x1: 22, z1: 192, altura: 5, cor: '#ff7fbf', tipo: 'vovo' });
// spec 036: garagem da casa da vovó (o carro começa aqui dentro, de frente para a Rua da Praça). Paredes barram; a rampa
// atravessa a calçada (podeAndar deixa andar nela, mesmo fora dos limites do bairro)
export const GARAGEM = { x0: 24, x1: 31, z0: 175, z1: 187.4, carro: { x: 27.5, z: 182.5, heading: RUMO.norte } };
// spec 038: anexo da casa (rosa como ela), com os pilares da frente — vão do portão de x 25,2 a 29,8
for (const p of [{ x0: 23.4, x1: 24, z0: 177.5, z1: 188 }, { x0: 31, x1: 31.6, z0: 177.5, z1: 188 }, { x0: 23.4, x1: 31.6, z0: 187.4, z1: 188 },
  { x0: 23.4, x1: 25.2, z0: 177.5, z1: 178 }, { x0: 29.8, x1: 31.6, z0: 177.5, z1: 178 }])
  predios.push({ ...p, altura: 3.2, cor: '#ff7fbf', tipo: 'garagem' });
predios.push({ x0: 200, z0: -26, x1: 228, z1: -10, altura: 5, cor: '#7fc8ff', tipo: 'mercado' });   // spec 021
predios.push({ x0: 220, z0: 140, x1: 250, z1: 162, altura: 6, cor: '#f2f6ff', tipo: 'posto' });      // spec 026
predios.push({ x0: 60, z0: 179, x1: 84, z1: 192, altura: 5, cor: '#ffe08a', tipo: 'veterinario' }); // spec 027
predios.push({ x0: 414, z0: -20, x1: 428, z1: -11, altura: 3.4, cor: '#ffb27a', tipo: 'frutas' });   // spec 040: barraca de frutas
predios.push({ x0: 560, z0: 186, x1: 578, z1: 202, altura: 6, cor: '#d9463b', tipo: 'celeiro' });    // spec 040: o sítio do trator
const reservados = [PRACA, ESCOLA_LOTE, quinaRotula, ...quarteiroes.filter(q => q.centro),
  { x0: 6, z0: -26, x1: 38, z1: -8 }, { x0: 2, z0: 177, x1: 26, z1: 194 }, { x0: 198, z0: -28, x1: 230, z1: -8 },
  { x0: 216, z0: 136, x1: 254, z1: 166 }, { x0: 56, z0: 177, x1: 88, z1: 194 }, { x0: 22.5, z0: 176, x1: 33, z1: 190 },
  { x0: 380, z0: -10, x1: 640, z1: 10 }, { x0: 380, z0: 160, x1: 640, z1: 180 }];      // spec 040: as pernas da estrada

function casa(x0, z0, x1, z1) {
  const c = { x0, z0, x1, z1 };
  if (reservados.some(r => sobrepoe(c, r))) return;
  if (predios.some(p => p.tipo !== 'calcada' && sobrepoe(c, p, 1))) return;
  predios.push({ x0, z0, x1, z1, altura: +(4 + rnd() * 3.5).toFixed(2), cor: CORES[(rnd() * CORES.length) | 0], tipo: 'casa' });
}
// casas em volta de cada quarteirão, de frente para a rua, recuadas 2,5 m (calçada)
const REC = 2.5 + P_BAIA, PROF = 9, LADO = 10, PASSO = 13;      // spec 043: recuo = baia (2,6) + calçada (2,5)
for (const q of quarteiroes) {
  if (q.centro) continue;                                       // centro: prédios altos (abaixo)
  for (let x = q.x0 + REC; x + LADO <= q.x1 - REC + 0.01; x += PASSO) {
    casa(x, q.z0 + REC, x + LADO, q.z0 + REC + PROF);
    casa(x, q.z1 - REC - PROF, x + LADO, q.z1 - REC);
  }
  for (let z = q.z0 + REC + PROF + 3; z + LADO <= q.z1 - REC - PROF - 2; z += PASSO) {
    casa(q.x0 + REC, z, q.x0 + REC + PROF, z + LADO);
    casa(q.x1 - REC - PROF, z, q.x1 - REC, z + LADO);
  }
}
// spec 034: prédios altos do centro, de frente para a rua (sem casa no meio do quarteirão; o estacionamento fica livre)
function alto(x0, z0, x1, z1) {
  const c = { x0, z0, x1, z1 };
  if (sobrepoe(c, ESTACIONAMENTO, 2) || predios.some(p => p.tipo !== 'calcada' && sobrepoe(c, p, 1))) return;
  predios.push({ x0, z0, x1, z1, altura: +(14 + rnd() * 14).toFixed(2), cor: ['#b9c7d8', '#d8c6b0', '#c4d6c8', '#e0c4cc', '#c8c0e0'][(rnd() * 5) | 0], tipo: 'alto' });
}
for (const q of quarteiroes) if (q.centro) {
  const AL = 15, AP = 13, AS = 18;
  for (let x = q.x0 + REC; x + AL <= q.x1 - REC + 0.01; x += AS) { alto(x, q.z0 + REC, x + AL, q.z0 + REC + AP); alto(x, q.z1 - REC - AP, x + AL, q.z1 - REC); }
  for (let z = q.z0 + REC + AP + 3; z + AL <= q.z1 - REC - AP - 2; z += AS) { alto(q.x0 + REC, z, q.x0 + REC + AP, z + AL); alto(q.x1 - REC - AP, z, q.x1 - REC, z + AL); }
}
// fileiras de casas do lado de fora do mapa (enfeite, o carro não chega lá)
for (let x = 2; x < 378; x += PASSO) { casa(x, -110, x + LADO, -110 + PROF + 3); casa(x, 179, x + LADO, 179 + PROF + 2); }
for (let z = -83; z < 172; z += PASSO) { casa(-23, z, -11, z + LADO); casa(391, z, 403, z + LADO); }

// árvores (só enfeite): praça, ilha da rótula, quintais
const arvores = [];
for (let x = PRACA.x0 + 8; x < PRACA.x1 - 4; x += 11) for (let z = PRACA.z0 + 8; z < PRACA.z1 - 4; z += 11) {
  const ax = x + (rnd() - 0.5) * 4, az = z + (rnd() - 0.5) * 4;
  const cx = (PRACA.x0 + PRACA.x1) / 2, cz = (PRACA.z0 + PRACA.z1) / 2;
  if (Math.abs(ax - cx) < 4 || Math.abs(az - cz) < 4 || Math.hypot(ax - cx, az - cz) < 12) continue;   // caminhos e chafariz
  arvores.push({ x: +ax.toFixed(2), z: +az.toFixed(2), r: +(2.2 + rnd() * 1.2).toFixed(2) });
}
for (const a of [0.6, 2.7, 4.8]) arvores.push({ x: +(ROTULA.x + 4 * Math.cos(a)).toFixed(2), z: +(ROTULA.z + 4 * Math.sin(a)).toFixed(2), r: 1.6 });
for (const q of quarteiroes) {
  const cx = (q.x0 + q.x1) / 2, cz = (q.z0 + q.z1) / 2, c = { x0: cx - 3, z0: cz - 3, x1: cx + 3, z1: cz + 3 };
  if (q.centro || sobrepoe(c, PRACA) || sobrepoe(c, ESCOLA_LOTE) || sobrepoe(c, quinaRotula)) continue;
  for (const [dx, dz] of [[-12, -8], [10, 6], [-4, 12], [14, -10]]) arvores.push({ x: cx + dx, z: cz + dz, r: +(2 + rnd()).toFixed(2) });
}

// ---------------------------------------------------------------------------------------------------------------
// Geometria das ruas
// ---------------------------------------------------------------------------------------------------------------
const wrap = a => { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; };
// ponto mais próximo da linha central da rua: distância, lateral com sinal (+ = direita do sentido do desenho), direção
function medeRua(r, x, z) {
  let best = null;
  const p = r.pontos;
  for (let i = 0; i < p.length - 1; i++) {
    const ax = p[i][0], az = p[i][1], bx = p[i + 1][0], bz = p[i + 1][1];
    const sx = bx - ax, sz = bz - az, L2 = sx * sx + sz * sz, L = Math.sqrt(L2);
    const t = Math.max(0, Math.min(1, ((x - ax) * sx + (z - az) * sz) / L2));
    const cx = ax + sx * t, cz = az + sz * t, d = Math.hypot(x - cx, z - cz);
    if (!best || d < best.d) {
      const dx = sx / L, dz = sz / L;
      best = { d, lat: (x - cx) * -dz + (z - cz) * dx, dx, dz };
    }
  }
  return best;
}

// Em qual rua está o ponto e de que lado. Com `heading`, escolhe a rua alinhada com o rumo (num cruzamento o
// ponto está em duas) e diz se está na mão certa. Sem `heading`, usa o sentido do desenho da rua.
const ladoNa = (r, m, al) => (!r.maoDupla ? (al > 0 ? 'direita' : 'contramao') : (m.lat * (al >= 0 ? 1 : -1) > 0 ? 'direita' : 'contramao'));
export function naRua(x, z, heading) {
  let best = null, bestScore = -Infinity;
  const todas = [];
  for (const r of ruas) {
    const m = medeRua(r, x, z);
    if (m.d > r.largura / 2 + 1e-6) continue;
    const al = heading === undefined ? 1 : Math.sin(heading) * m.dx + Math.cos(heading) * m.dz;
    const score = Math.abs(al) * 100 - m.d;
    todas.push({ r, m, al });
    if (score > bestScore) { bestScore = score; best = { r, m, al }; }
  }
  if (!best) return null;
  let { r, m, al } = best, lado = ladoNa(r, m, al);
  // dentro de um cruzamento o ponto está em 2 ruas: se está certo em alguma delas (andando nela), conta como certo
  // (spec 034: na curva da Sabiá para a avenida o carro passa por cima da Sabiá do centro, que é mão única)
  if (lado === 'contramao') {
    const ok = todas.find(k => k !== best && Math.abs(k.al) > 0.3 && ladoNa(k.r, k.m, k.al) === 'direita');
    if (ok) ({ r, m, al } = ok), lado = 'direita';
  }
  return { rua: r.id, lado, dist: +Math.abs(m.lat).toFixed(3) };
}

export const naEscola = (x, z) => x >= escola.x0 && x <= escola.x1 && z >= escola.z0 && z <= escola.z1;

// Limite de velocidade (km/h) da via ali. A zona da escola vale 30. Fora de rua: o da rua mais perto.
export function limiteEm(x, z, heading) {
  if (naEscola(x, z)) return escola.limiteKmh;
  const n = naRua(x, z, heading);
  if (n) return RUA[n.rua].limiteKmh;
  let best = null, bd = Infinity;
  for (const r of ruas) { const d = medeRua(r, x, z).d; if (d < bd) { bd = d; best = r; } }
  return best.limiteKmh;
}

// O carro pode estar aqui? Não dentro de prédio/calçada, não na ilha da rótula, não fora do bairro.
// spec 052: a pista da estrada vai meia largura além das pontas de cada perna — a QUINA (onde uma perna vira na outra)
// é pista inteira (antes o canto de fora contava como fora e o carro enroscava na curva)
export function naPistaEstrada(r, x, z, folga = 0) {
  const [[ax, az], [bx, bz]] = r.pontos, L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, e = r.largura / 2;
  const t = (x - ax) * ux + (z - az) * uz, w = Math.abs(-(x - ax) * uz + (z - az) * ux);
  return t > -e && t < L + e && w < r.largura / 2 + folga;
}
export function podeAndar(x, z) {
  const B = LIMITES_MAPA, G = GARAGEM;
  const naGaragem = x > G.x0 && x < G.x1 && z >= B.z1 - 0.5 && z < G.z1;   // spec 036: rampa e garagem
  if (!naGaragem && (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) && !naBaiaDeFora(x, z)) {
    // spec 040: fora do bairro, só na pista da estrada (as defensas seguram); a ponte é pista também
    return ruas.some(r => r.estrada && naPistaEstrada(r, x, z, -0.3));
  }
  if (Math.hypot(x - ROTULA.x, z - ROTULA.z) < ROTULA.ilha) return false;
  for (const p of predios) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) return false;
  return true;
}

// Fase do semáforo no instante t (s). Ciclo determinístico; grupos do mesmo nó nunca ficam verdes juntos.
const SEM = Object.fromEntries(semaforos.map(s => [s.id, s]));
export function faseSemaforo(id, t) {
  const c = SEM[id].ciclo, T = c.verde + c.amarelo + c.vermelho;
  const tt = (((t - c.fase0) % T) + T) % T;
  return tt < c.verde ? 'verde' : tt < c.verde + c.amarelo ? 'amarelo' : 'vermelho';
}

// ---------------------------------------------------------------------------------------------------------------
// Trechos (pedaço de rua entre dois cruzamentos, para desenhar a faixa amarela) e placas
// ---------------------------------------------------------------------------------------------------------------
const trechos = [];
for (const r of ruas) {
  if (r.pontos.length !== 2) continue;                          // (a rótula é desenhada à parte)
  const [[ax, az], [bx, bz]] = r.pontos, L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L;
  const cortes = [];
  for (const n of nos) {
    const t = (n.x - ax) * dx + (n.z - az) * dz, d = Math.abs((n.x - ax) * -dz + (n.z - az) * dx);
    if (d < 0.5 && t > -0.5 && t < L + 0.5) cortes.push({ t, g: meiaCruzada(r, n.x, n.z) + 2 });
  }
  for (const [t, ext] of [[0, true], [L, true]]) if (!cortes.some(c => Math.abs(c.t - t) < 1)) cortes.push({ t, g: ROTULA.externo - ROTULA.R + 1 });
  cortes.sort((a, b) => a.t - b.t);
  for (let i = 0; i < cortes.length - 1; i++) {
    const t0 = cortes[i].t + cortes[i].g, t1 = cortes[i + 1].t - cortes[i + 1].g;
    if (t1 - t0 < 5) continue;
    trechos.push({ rua: r.id, ax: ax + dx * t0, az: az + dz * t0, bx: ax + dx * t1, bz: az + dz * t1, heading: Math.atan2(dx, dz), unica: !r.maoDupla });
  }
}

// placas: { id, tipo:'pare'|'vel'|'escola'|'radar'|'rotula', valor?, x, z, heading } — heading = rumo de quem LÊ
const placas = [];
const naCalcada = (r, x, z, h, antes) => {   // ponto na calçada da direita, `antes` m antes de (x, z)
  const hw = r.largura / 2, fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
  const m = medeRua(r, x, z), cx = x - rx * m.lat * Math.sign(m.dx * fx + m.dz * fz || 1), cz = z - rz * m.lat * Math.sign(m.dx * fx + m.dz * fz || 1);
  return { x: +(cx + rx * (hw + 1.2) - fx * antes).toFixed(2), z: +(cz + rz * (hw + 1.2) - fz * antes).toFixed(2), heading: h };
};
for (const p of pares) placas.push({ id: 'placa_' + p.id, tipo: 'pare', ...naCalcada(RUA[p.linha.rua], p.linha.x, p.linha.z, p.linha.heading, 1) });
for (const tr of trechos) {
  const r = RUA[tr.rua], L = Math.hypot(tr.bx - tr.ax, tr.bz - tr.az);
  if (L < 30) continue;
  // mão única (spec 034): só a placa de quem entra no sentido certo
  for (const [sx, sz, h] of tr.unica ? [[tr.ax, tr.az, tr.heading]] : [[tr.ax, tr.az, tr.heading], [tr.bx, tr.bz, wrap(tr.heading + PI)]]) {
    const px = sx + Math.sin(h) * 10, pz = sz + Math.cos(h) * 10;
    const lw = r.largura / 4, lx = px - Math.cos(h) * lw, lz = pz + Math.sin(h) * lw;
    placas.push({ id: `vel_${tr.rua}_${placas.length}`, tipo: 'vel', valor: limiteEm(lx, lz, h), ...naCalcada(r, px, pz, h, 0) });
  }
}
placas.push({ id: 'escola_l', tipo: 'escola', ...naCalcada(RUA.escola_o, escola.x0 - 2, 85, RUMO.leste, 0) });
placas.push({ id: 'escola_o', tipo: 'escola', ...naCalcada(RUA.escola_o, escola.x1 - 6, 85, RUMO.oeste, 0) });
placas.push({ id: 'radar_aviso', tipo: 'radar', valor: 60, ...naCalcada(RUA.avenida, radares[0].x + 30, 0, RUMO.oeste, 0) });
for (const [ruaId, x, z, h] of [['escola_o', 190 - 24, 85, RUMO.leste], ['escola_l', 190 + 24, 85, RUMO.oeste],
  ['sabia_n', 190, 85 - 24, RUMO.sul], ['sabia_s', 190, 85 + 24, RUMO.norte]]) placas.push({ id: 'rotula_' + ruaId, tipo: 'rotula', ...naCalcada(RUA[ruaId], x, z, h, 0) });
// spec 034: mão única — "sentido proibido" (R-3) para quem chegaria na contramão; "sentido de circulação" (R-24a) na entrada certa
for (const r of ruas) if (!r.maoDupla && r.pontos.length === 2) {
  const [[ax, az], [bx, bz]] = r.pontos, h = Math.atan2(bx - ax, bz - az), fx = Math.sin(h), fz = Math.cos(h);
  placas.push({ id: 'proibido_' + r.id, tipo: 'proibido', ...naCalcada(r, bx - fx * 9, bz - fz * 9, wrap(h + PI), 0) });
  placas.push({ id: 'maounica_' + r.id, tipo: 'mao_unica', ...naCalcada(r, ax + fx * 9, az + fz * 9, h, 0) });
}
// spec 040: "proibido ultrapassar" (R-7) antes de cada ponte, nos dois sentidos; aviso do radar de 80
for (const p of pontes) for (const [x, h] of [[p.x0 - ESTRADA.zonaPonte + 6, RUMO.leste], [p.x1 + ESTRADA.zonaPonte - 6, RUMO.oeste]])
  placas.push({ id: `nao_ultrapasse_${p.id}_${h > 0 ? 'l' : 'o'}`, tipo: 'nao_ultrapasse', ...naCalcada(RUA[p.rua], x, (p.z0 + p.z1) / 2, h, 0) });
placas.push({ id: 'radar_aviso_estrada', tipo: 'radar80', valor: 80, ...naCalcada(RUA.estrada_n, radares[1].x + 30, 0, RUMO.oeste, 0) });
// spec 041: placa de cada radar novo, `aviso` m antes dele
for (const r of radares) if (r.aviso) {
  const fx = Math.sin(r.heading), fz = Math.cos(r.heading);
  placas.push({ id: 'radar_aviso_' + r.id, tipo: 'radar' + r.limiteKmh, valor: r.limiteKmh, ...naCalcada(RUA[r.rua], r.x - fx * r.aviso, r.z - fz * r.aviso, r.heading, 0) });
}
// spec 034: placa "E" (estacionamento) na entrada do pátio, para quem sobe a Girassóis
placas.push({ id: 'estac_baia', tipo: 'estacionamento', x: BAIA.x0 - 1.2, z: BAIA.z0 + 2, heading: RUMO.sul });   // spec 042
placas.push({ id: 'estac_entrada', tipo: 'estacionamento', ...naCalcada(RUA.centro_girassois, 95, ESTACIONAMENTO.entrada.z1 + 6, RUMO.norte, 0) });

// ---------------------------------------------------------------------------------------------------------------
// Missão: casa da vovó → farmácia, sempre pela mão direita, passando por tudo
// ---------------------------------------------------------------------------------------------------------------
function arredonda(pts) {    // troca cada canto de 90° por um arco (direita r = 4 m, esquerda r = 7,5 m)
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], [cx, cz] = pts[i + 1];
    const h1 = Math.atan2(bx - ax, bz - az), h2 = Math.atan2(cx - bx, cz - bz), dh = wrap(h2 - h1);
    const l1 = Math.hypot(bx - ax, bz - az), l2 = Math.hypot(cx - bx, cz - bz);
    if (Math.abs(dh) < 0.6) { out.push(pts[i]); continue; }
    const r0 = dh < 0 ? 4 : 7.5;
    let d = r0 * Math.tan(Math.abs(dh) / 2); d = Math.min(d, 0.45 * Math.min(l1, l2));
    const r = d / Math.tan(Math.abs(dh) / 2);
    const px = bx - Math.sin(h1) * d, pz = bz - Math.cos(h1) * d;
    const sg = dh > 0 ? 1 : -1;   // esquerda: centro à esquerda (= -direita)
    const ox = px + Math.cos(h1) * r * sg, oz = pz - Math.sin(h1) * r * sg;
    const a0 = Math.atan2(px - ox, pz - oz), n = Math.max(3, Math.ceil(Math.abs(dh) * r / 1.0));
    for (let k = 0; k <= n; k++) { const a = a0 + (dh * k) / n; out.push([ox + Math.sin(a) * r, oz + Math.cos(a) * r]); }
  }
  out.push(pts[pts.length - 1]);
  return out.map(([x, z]) => [+x.toFixed(3), +z.toFixed(3)]);
}
const ROTA_CANTOS = [
  [8, 172.5],                      // casa da vovó, Rua da Praça, indo pro leste (lombada, faixa da praça)
  [97.5, 172.5],                   // semáforo da praça: vira à esquerda (norte) na Rua dos Girassóis
  [97.5, 87.5],                    // PARE: vira à direita (leste) na Rua da Escola (zona 30, faixa da escola)
];
const th0 = PI - Math.asin(2.5 / ROTULA.R), th1 = -Math.acos(2.5 / ROTULA.R);
for (let k = 0; k <= 24; k++) {    // rótula: entra pela direita, roda anti-horário, sai pro norte
  const th = th0 + ((th1 - th0) * k) / 24;
  ROTA_CANTOS.push([ROTULA.x + ROTULA.R * Math.cos(th), ROTULA.z + ROTULA.R * Math.sin(th)]);
}
ROTA_CANTOS.push([192.5, -3]);     // PARE na avenida: vira à esquerda (oeste); radar e semáforo da avenida
ROTA_CANTOS.push([22, -3]);        // farmácia
const missao = {
  id: 'vovo', emoji: '👵', nome: 'Levar a vovó até a farmácia', curto: 'Vovó → farmácia',
  origem: { x: 8, z: 172.5, heading: RUMO.leste },
  destino: { x: 22, z: -3, raio: 6 },
  rota: arredonda(ROTA_CANTOS),
  icone: '💊', bora: '👵 Bora! Leva a vovó 💊', chegou: '💊 Chegou na farmácia! A vovó agradece 💗',
  relTitulo: 'Chegou na farmácia!', relSub: 'A vovó agradece 💗', quem: 'você e a vovó',
  ensina: 'Semáforo, PARE, rótula, radar e faixa de pedestre', dificuldade: 2,
};

// ---------------------------------------------------------------------------------------------------------------
// GPS: rota pela mão direita de (x, z, rumo h) até o destino, pelo caminho mais curto na grade. Não faz retorno no
// meio do quarteirão nem em cruzamento (só a rótula deixa dar a volta). Devolve pontos como missao.rota, ou null
// se o carro não está numa rua da grade (ou está na rótula — aí espera ele sair).
// ---------------------------------------------------------------------------------------------------------------
const chaveNo = (x, z) => `${x},${z}`;
const ehRotula = k => k === chaveNo(ROTULA.x, ROTULA.z);
// spec 034: aresta a → b só se há rua entre os dois nós e, se a rua é de mão única, no sentido dela
function podeIr(x0, z0, x1, z1) {
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  for (const r of ruas) {
    if (r.id === 'rotula' || r.pontos.length !== 2 || medeRua(r, mx, mz).d > 1) continue;
    if (r.maoDupla) return true;
    const [[ax, az], [bx, bz]] = r.pontos;
    return (bx - ax) * (x1 - x0) + (bz - az) * (z1 - z0) > 0;
  }
  return false;
}
// nós vizinhos numa linha: o próximo nó que EXISTE (spec 040: x 620 só tem nó em z 0 e z 170)
const nosNaLinhaZ = z => GX.filter(x => existeNo(x, z)), nosNaLinhaX = x => GRADE.Z.filter(z => existeNo(x, z));
const vizinhos = {};
for (const x of GX) for (const z of GRADE.Z) {
  if (!existeNo(x, z)) continue;
  const lx = nosNaLinhaZ(z), lz = nosNaLinhaX(x), i = lx.indexOf(x), j = lz.indexOf(z);
  vizinhos[chaveNo(x, z)] = [[lx[i - 1], z], [lx[i + 1], z], [x, lz[j - 1]], [x, lz[j + 1]]]
    .filter(([a, b]) => a !== undefined && b !== undefined && podeIr(x, z, a, b)).map(([a, b]) => chaveNo(a, b));
}
const noXZ = k => k.split(',').map(Number);
const rumoDe = (a, b) => { const [ax, az] = noXZ(a), [bx, bz] = noXZ(b); return Math.atan2(bx - ax, bz - az); };
// meia-faixa (centro da faixa da direita) da rua entre dois nós: avenida (z = 0) 3 m, as outras 2,5 m
const meiaFaixa = (a, b) => { const [, az] = noXZ(a), [, bz] = noXZ(b); return az === 0 && bz === 0 ? LARG_AV / 4 : LARG / 4; };
const direita = (h, w) => [-Math.cos(h) * w, Math.sin(h) * w];

// em que trecho (nó de trás → nó da frente) da grade está o ponto andando no rumo h
function trechoDe(x, z, h) {
  const horiz = Math.abs(Math.sin(h)) >= Math.abs(Math.cos(h));
  const [linhas, ao, ac, vai] = horiz ? [GRADE.Z, x, z, Math.sin(h) > 0] : [GX, z, x, Math.cos(h) > 0];
  const L = linhas.reduce((a, b) => (Math.abs(b - ac) < Math.abs(a - ac) ? b : a));
  if (Math.abs(ac - L) > 7) return null;
  const nos = horiz ? nosNaLinhaZ(L) : nosNaLinhaX(L);
  const frente = vai ? nos.find(n => n > ao + 1) : [...nos].reverse().find(n => n < ao - 1);
  const tras = vai ? [...nos].reverse().find(n => n <= ao + 1) : nos.find(n => n >= ao - 1);
  if (frente === undefined || tras === undefined) return null;
  return horiz ? { de: chaveNo(tras, L), para: chaveNo(frente, L) } : { de: chaveNo(L, tras), para: chaveNo(L, frente) };
}
// o trecho e o sentido do destino saem do lado da rua em que ele está (mão direita)
function trechoDoDestino(d) {
  const zL = GRADE.Z.reduce((a, b) => (Math.abs(b - d.z) < Math.abs(a - d.z) ? b : a));
  const xL = GX.reduce((a, b) => (Math.abs(b - d.x) < Math.abs(a - d.x) ? b : a));
  const h = Math.abs(d.z - zL) <= Math.abs(d.x - xL) ? (d.z < zL ? RUMO.oeste : RUMO.leste) : (d.x > xL ? RUMO.norte : RUMO.sul);
  return trechoDe(d.x, d.z, h);
}

export function rotaAte(x, z, h, destino = missao.destino) {
  if (Math.hypot(x - ROTULA.x, z - ROTULA.z) < ROTULA.externo + 2) return null;
  const ini = trechoDe(x, z, h), fim = trechoDoDestino(destino);
  if (!ini || !fim) return null;
  const dist = (a, b) => { const [ax, az] = noXZ(a), [bx, bz] = noXZ(b); return Math.hypot(bx - ax, bz - az); };
  const [fx, fz] = noXZ(ini.para), hIni = rumoDe(ini.de, ini.para);
  const [Bx, Bz] = noXZ(fim.para), hFim = rumoDe(fim.de, fim.para);
  let nosRota;
  // já no trecho do destino e antes dele: segue reto
  if (ini.de === fim.de && ini.para === fim.para && (destino.x - x) * Math.sin(hFim) + (destino.z - z) * Math.cos(hFim) > 0) {
    nosRota = [ini.de];
  } else {
    // Dijkstra nos estados "cheguei em v vindo de u" (proíbe o retorno u → v → u, menos na rótula)
    const custo = new Map(), veio = new Map(), fila = [[Math.hypot(fx - x, fz - z), ini.de, ini.para]];
    let melhor = null;
    while (fila.length) {
      fila.sort((a, b) => a[0] - b[0]);
      const [c, u, v] = fila.shift(), k = u + '>' + v;
      if (custo.has(k)) continue;
      custo.set(k, c);
      if (v === fim.de && u !== fim.para) {
        const [ax, az] = noXZ(v), total = c + Math.hypot(destino.x - ax, destino.z - az);
        if (!melhor || total < melhor.total) melhor = { total, k };
      }
      for (const w of vizinhos[v]) {
        if (w === u && !ehRotula(v)) continue;
        const kw = v + '>' + w;
        if (custo.has(kw)) continue;
        if (!veio.has(kw) || veio.get(kw).c > c + dist(v, w)) veio.set(kw, { c: c + dist(v, w), de: k });
        fila.push([c + dist(v, w), v, w]);
      }
    }
    if (!melhor) return null;
    nosRota = [];
    for (let k = melhor.k; k; k = veio.get(k)?.de) { const [u, v] = k.split('>'); nosRota.unshift(v); if (!veio.has(k)) nosRota.unshift(u); }
    nosRota.push(fim.para);
  }
  // pontos: largada na faixa da direita, um canto por conversão (ou o arco da rótula), chegada no destino
  const w0 = meiaFaixa(ini.de, ini.para), [rx, rz] = direita(hIni, w0);
  const [dx, dz] = noXZ(ini.de), al = (x - dx) * Math.sin(hIni) + (z - dz) * Math.cos(hIni);
  const pts = [[dx + Math.sin(hIni) * al + rx, dz + Math.cos(hIni) * al + rz]];
  for (let i = 1; i < nosRota.length - 1; i++) {
    const a = nosRota[i - 1], v = nosRota[i], b = nosRota[i + 1];
    const h1 = rumoDe(a, v), h2 = rumoDe(v, b), [vx, vz] = noXZ(v);
    if (ehRotula(v)) {             // entra pela direita, roda anti-horário (θ decrescente) e sai no braço de b
      const wa = meiaFaixa(a, v), wb = meiaFaixa(v, b), ra = Math.sqrt(ROTULA.R ** 2 - wa * wa), rb = Math.sqrt(ROTULA.R ** 2 - wb * wb);
      const [ex, ez] = direita(h1, wa), [sx, sz] = direita(h2, wb);
      const tIn = Math.atan2(-Math.cos(h1) * ra + ez, -Math.sin(h1) * ra + ex);
      let tOut = Math.atan2(Math.cos(h2) * rb + sz, Math.sin(h2) * rb + sx);
      while (tOut >= tIn) tOut -= 2 * PI;
      for (let k = 0; k <= 24; k++) { const th = tIn + ((tOut - tIn) * k) / 24; pts.push([vx + ROTULA.R * Math.cos(th), vz + ROTULA.R * Math.sin(th)]); }
    } else if (Math.abs(wrap(h2 - h1)) > 0.1) {
      const [ax, az] = direita(h1, meiaFaixa(a, v)), [bx, bz] = direita(h2, meiaFaixa(v, b));
      pts.push([vx + ax + bx, vz + az + bz]);
    }
  }
  pts.push([destino.x, destino.z]);
  return arredonda(pts);
}

// ---------------------------------------------------------------------------------------------------------------
// Missões (spec 021). A da vovó tem a rota desenhada à mão (passa por tudo); as outras saem do GPS (caminho mais
// curto pela mão direita). `noite: true` = mesma cidade de noite (faróis, postes acesos).
// ---------------------------------------------------------------------------------------------------------------
// spec 035: TODAS as missões saem do mesmo lugar — de casa (a casa da vovó, na Rua da Praça, indo para o leste)
export const CASA = { x: 8, z: 172.5, heading: RUMO.leste };
// `via` (opcional): passa primeiro por esse ponto (na faixa da direita, com o rumo dado) e depois segue para o destino
function rotaMissao(m) {
  if (m.rota) return m.rota;
  if (m.fimDaRota) {                     // spec 042: GPS até um ponto e daí os pontos dados (entrar na vaga da rua)
    const r1 = rotaAte(m.origem.x, m.origem.z, m.origem.heading, { ...m.fimDaRota.ate, raio: 1 });
    return r1 ? [...r1, ...m.fimDaRota.pontos] : null;
  }
  if (!m.via) return rotaAte(m.origem.x, m.origem.z, m.origem.heading, m.destino);
  const r1 = rotaAte(m.origem.x, m.origem.z, m.origem.heading, { ...m.via, raio: 1 });
  const r2 = rotaAte(m.via.x, m.via.z, m.via.heading, m.destino);
  return r1 && r2 ? [...r1, ...r2.slice(1)] : null;
}
const novaMissao = m => ({ ...m, origem: CASA, rota: rotaMissao({ ...m, origem: CASA }) });
export const MISSOES = [
  missao,
  novaMissao({
    id: 'escola', emoji: '🎒', nome: 'Levar a criança à escola', curto: 'Criança → escola',
    destino: { x: 152, z: 87.5, raio: 6 },
    icone: '🎒', bora: '🎒 Bora! Leva a criança pra escola', chegou: '🎒 Chegou na escola! Boa aula 📚',
    relTitulo: 'Chegou na escola!', relSub: 'Boa aula! 📚', quem: 'você e a criança', saidaEscola: true,
    ensina: 'Saída da escola e bicicleta (1,5 m)', dificuldade: 1,
    vivos: { bike: { s0: 40, comprimento: 95, vel: 4 } },   // spec 024
  }),
  novaMissao({
    id: 'mercado', emoji: '🛒', nome: 'Fazer compras no mercado', curto: 'Escola → mercado',
    destino: { x: 213, z: -3, raio: 6 },
    icone: '🛒', bora: '🛒 Bora! Lista de compras na mão', chegou: '🛒 Chegou no mercado! Hora das compras',
    relTitulo: 'Chegou no mercado!', relSub: 'Não esqueça a lista 📝', quem: 'você',
    ensina: 'Rótula, bicicleta e ambulância', dificuldade: 2,
    vivos: { bike: { s0: 100, comprimento: 70, vel: 4 }, ambulancia: { gatilho: 190, atras: 70, vel: 16 } },   // specs 023/024
  }),
  novaMissao({
    id: 'noite', emoji: '🌙', nome: 'Buscar o remédio da vovó, à noite', curto: 'Farmácia à noite',
    destino: { x: 22, z: -3, raio: 6 },
    icone: '🌙', bora: '🌙 De noite: faróis ligados! Vai buscar o remédio da vovó', chegou: '💊 Chegou na farmácia! A vovó vai dormir bem 💤',
    relTitulo: 'Chegou na farmácia!', relSub: 'Remédio da vovó na mão 💤', quem: 'você', noite: true,
    ensina: 'Dirigir no escuro e dar passagem à ambulância', dificuldade: 2,
    vivos: { ambulancia: { gatilho: 130, atras: 60, vel: 16 } },   // spec 023 (spec 035: depois do semáforo da praça, na reta da Girassóis)
  }),
  // ---- specs 026–030: missões novas
  novaMissao({
    id: 'posto', emoji: '🏥', nome: 'Levar a vizinha ao posto de saúde', curto: 'Posto de saúde',
    destino: { x: 235, z: 167.5, raio: 6 },
    icone: '🏥', bora: '🏥 Bora! Leva a vizinha ao posto', chegou: '🏥 Chegou no posto! Melhoras, vizinha 💗',
    relTitulo: 'Chegou no posto!', relSub: 'Melhoras, vizinha 💗', quem: 'você e a vizinha',
    ensina: 'Silêncio perto do posto: nada de buzina', dificuldade: 1,
  }),
  novaMissao({
    id: 'veterinario', emoji: '🐶', nome: 'Levar o cachorro ao veterinário', curto: 'Veterinário',
    destino: { x: 72, z: 172.5, raio: 6 },
    icone: '🐾', bora: '🐶 Bora! O Totó vai tomar vacina', chegou: '🐾 Chegou no veterinário! Au au 💗',
    relTitulo: 'Chegou no veterinário!', relSub: 'O Totó agradece 🐾', quem: 'você e o Totó',
    ensina: 'Animal na pista: reduzir e esperar', dificuldade: 1,
    vivos: { travessias: [{ id: 'cachorro', tipo: 'cachorro', x: 38, z: 170, gatilho: 32, vel: 2.4 }] },   // spec 027
  }),
  novaMissao({
    id: 'futebol', emoji: '⚽', nome: 'Buscar a criança no futebol da praça', curto: 'Futebol na praça',
    destino: { x: 92.5, z: 132, raio: 6 },
    icone: '⚽', bora: '⚽ Bora! O jogo já acabou', chegou: '⚽ Chegou na praça! Golaço 🥅',
    relTitulo: 'Chegou na praça!', relSub: 'Golaço! 🥅', quem: 'você',
    ensina: 'Bola na rua: pode vir criança atrás', dificuldade: 2,
    vivos: { travessias: [{ id: 'bola', tipo: 'bola', x: 95, z: 112, gatilho: 30, vel: 4, crianca: true }] },   // spec 028
  }),
  novaMissao({
    id: 'chuva', emoji: '🌧️', nome: 'Levar a criança à escola na chuva', curto: 'Escola na chuva',
    destino: { x: 152, z: 87.5, raio: 6 },
    icone: '☔', bora: '🌧️ Chuva! Devagar: o carro escorrega', chegou: '☔ Chegou na escola, sequinho! 📚',
    relTitulo: 'Chegou na escola!', relSub: 'Sem molhar ninguém ☔', quem: 'você e a criança',
    ensina: 'Chuva: frear mais cedo e ir mais devagar', dificuldade: 3, chuva: true,   // spec 029
  }),
  novaMissao({
    id: 'avenida', emoji: '🚦', nome: 'Desafio da avenida', curto: 'Desafio da avenida',
    via: { x: 165, z: 3, heading: RUMO.leste }, destino: { x: 22, z: -3, raio: 6 },   // passa do radar, volta pelo centro e pega o radar
    icone: '🏁', bora: '🚦 Desafio! Avenida, centro e de volta pelo radar de 60', chegou: '🏁 Desafio completo!',
    relTitulo: 'Desafio completo!', relSub: 'Radar e semáforo 🚦', quem: 'você',
    ensina: 'Radar de 60, semáforo e faixa de pedestre', dificuldade: 3,   // spec 030
  }),
  novaMissao({
    id: 'estrada', emoji: '🛣️', nome: 'Passeio na estrada', curto: 'Estrada e ponte',
    via: { x: 622.5, z: 60, heading: RUMO.norte }, destino: { x: 421, z: -3, raio: 6 },   // spec 040: ponte sul (trator), volta pela ponte norte e o radar de 80
    icone: '🍓', bora: '🛣️ Bora! Estrada de 80 e ponte: na ponte não se ultrapassa', chegou: '🍓 Chegou na barraca de frutas!',
    relTitulo: 'Chegou na barraca!', relSub: 'Morango fresquinho 🍓', quem: 'você',
    ensina: 'Estrada de 80 e ponte: não ultrapassar', dificuldade: 3,
    vivos: { trator: { de: [430, 172.5], ate: [548, 172.5], vel: 6 } },
  }),
  novaMissao({
    id: 'baliza', emoji: '🚙', nome: 'Estacionar na rua (baliza)', curto: 'Baliza na praça',
    destino: { x: 88.5, z: 121.25, raio: 3 }, estacionar: 'lateral',
    // spec 042: o GPS leva até a faixa da direita da Girassóis descendo; o fim entra na baia de frente (pelas vagas
    // 2 e 3 livres) e para na 4, colado no meio-fio (25 cm), entre dois carros
    fimDaRota: { ate: { x: 92.5, z: 106, heading: RUMO.sul }, pontos: [[92.5, 107], [91.9, 110.5], [90, 113.5], [88.7, 116.5], [88.5, 119], [88.5, 121.25]] },
    icone: '🚙', bora: '🚙 Bora! Estacione na rua, na frente da praça: colado no meio-fio', chegou: '🚙 Baliza perfeita! 👏',
    relTitulo: 'Estacionou na rua!', relSub: 'Colado no meio-fio 🚙', quem: 'você',
    ensina: 'Vaga na rua: meio-fio, esquina e fila dupla', dificuldade: 2,
  }),
  novaMissao({
    id: 'estacionar', emoji: '🅿️', nome: 'Estacionar no centro', curto: 'Estacionar no centro',
    destino: { x: 97.5, z: -60, raio: 6 },
    icone: '🅿️', bora: '🅿️ Bora! Estacione no centro (vaga comum)', chegou: '🅿️ Estacionou certinho! 👏',
    relTitulo: 'Estacionou!', relSub: 'Vaga comum, do jeito certo 🅿️', quem: 'você',
    ensina: 'Mão única e vaga de idoso/PcD', dificuldade: 2, estacionar: true,   // spec 034: termina ao parar numa vaga comum
  }),
];

// ---------------------------------------------------------------------------------------------------------------
// spec 043 (pedido do Maki, 19/10/2026: "todas as ruas precisam ter estacionamento lateral"): vagas paralelas ao
// meio-fio nos DOIS lados de toda rua da cidade (fora a rótula e a estrada de 80 — art. 181 V), numa baia recortada da
// calçada (a pista não muda). Sem vaga (art. 181): a menos de 5 m da esquina (I, +1 m de folga), na faixa de pedestre e
// onde os pedestres esperam (VIII), nas entradas (garagem, estacionamento — IX), junto de placa, radar e na travessia
// das missões. Na mão única, só do lado direito do fluxo. ~45% das vagas com carro parado.
// ---------------------------------------------------------------------------------------------------------------
const baias = [], baiasFora = [];
{
  const ESQ = 6, FAIXA = 14, PLACA = 4;
  const pontosProibidos = [...faixas.map(f => ({ x: f.x, z: f.z, r: FAIXA })), ...placas.map(p => ({ x: p.x, z: p.z, r: PLACA })),
    ...radares.map(r => ({ x: r.x, z: r.z, r: PLACA })),
    ...MISSOES.flatMap(m => (m.vivos?.travessias || []).map(t => ({ x: t.x, z: t.z, r: 7 })))];
  const areasProibidas = [ESTACIONAMENTO, { x0: GARAGEM.x0 - 2, x1: GARAGEM.x1 + 2, z0: 170, z1: 190 }, BAIA,
    { x0: 380, x1: 640, z0: -12, z1: 12 }, { x0: 380, x1: 640, z0: 159, z1: 181 },        // a boca das 2 pernas da estrada
    ...predios.filter(p => !['calcada', 'casa', 'carroParado', 'praca'].includes(p.tipo))];
  const longeDaRotula = (x, z) => Math.hypot(x - ROTULA.x, z - ROTULA.z) > ROTULA.externo + 10;
  // face: segmento do meio-fio da pista (a, b ao longo de `eixoL`), o lado da baia e o rumo de quem estaciona ali
  function face({ eixoL, a, b, fixo, dentro, rumo, fora = false }) {
    // a rua desta face: se for mão única no sentido contrário ao `rumo`, não tem vaga deste lado
    const rx = eixoL === 'x' ? (a + b) / 2 : fixo - dentro * 2, rz = eixoL === 'x' ? fixo - dentro * 2 : (a + b) / 2;
    const nr = naRua(rx, rz, rumo);
    if (!nr || nr.lado !== 'direita' || RUA[nr.rua].estrada || nr.rua === 'rotula') return;
    const curb = fixo + dentro * P_BAIA, lista = [];
    for (let s = a + ESQ; s + VAGA_LAT <= b - ESQ + 0.01; s += VAGA_LAT) {
      const r = eixoL === 'x' ? { x0: s, x1: s + VAGA_LAT, z0: Math.min(fixo, curb), z1: Math.max(fixo, curb) }
        : { x0: Math.min(fixo, curb), x1: Math.max(fixo, curb), z0: s, z1: s + VAGA_LAT };
      const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
      if (!longeDaRotula(cx, cz) || pontosProibidos.some(p => Math.hypot(p.x - cx, p.z - cz) < p.r + VAGA_LAT / 2)
        || areasProibidas.some(q => sobrepoe(r, q, 0.3))) { lista.push(null); continue; }
      lista.push(r);
    }
    // vagas seguidas viram uma baia (é ela que sai da calçada)
    let ini = null;
    lista.push(null);
    lista.forEach((r, i) => {
      if (r && !ini) ini = r;
      if (!r && ini) {
        const fim = lista[i - 1];
        (fora ? baiasFora : baias).push({ x0: Math.min(ini.x0, fim.x0), x1: Math.max(ini.x1, fim.x1), z0: Math.min(ini.z0, fim.z0), z1: Math.max(ini.z1, fim.z1) });
        ini = null;
      }
      if (!r) return;
      const ocupada = rnd() < 0.45, k = vagas.length;
      vagas.push({ id: `vaga_r${k}`, tipo: 'lateral', ...r, heading: rumo, ocupada, meioFio: { eixo: eixoL === 'x' ? 'z' : 'x', v: curb, s: -dentro } });
      if (ocupada) {          // carro parado encostado no meio-fio (25 cm), no meio da vaga
        const c = curb - dentro * (0.25 + 0.9), m = (eixoL === 'x' ? (r.x0 + r.x1) : (r.z0 + r.z1)) / 2;
        predios.push(eixoL === 'x' ? { x0: m - 1.8, x1: m + 1.8, z0: c - 0.9, z1: c + 0.9 } : { x0: c - 0.9, x1: c + 0.9, z0: m - 1.8, z1: m + 1.8 });
        Object.assign(predios.at(-1), { altura: 1.6, cor: CORES[(rnd() * CORES.length) | 0], tipo: 'carroParado', heading: rumo });
      }
    });
  }
  for (const q of quarteiroes) {
    // dentro = +1/−1: de que lado do meio-fio da pista fica a baia (para dentro do quarteirão)
    face({ eixoL: 'x', a: q.x0, b: q.x1, fixo: q.z0, dentro: 1, rumo: RUMO.leste });    // lado sul da rua de cima
    face({ eixoL: 'x', a: q.x0, b: q.x1, fixo: q.z1, dentro: -1, rumo: RUMO.oeste });   // lado norte da rua de baixo
    face({ eixoL: 'z', a: q.z0, b: q.z1, fixo: q.x0, dentro: 1, rumo: RUMO.norte });    // lado leste da rua da esquerda
    face({ eixoL: 'z', a: q.z0, b: q.z1, fixo: q.x1, dentro: -1, rumo: RUMO.sul });     // lado oeste da rua da direita
  }
  // o lado de FORA das ruas da beirada (na calçada em volta do mapa); esquinas = os nós da beirada
  const L = LIMITES_MAPA, foraDe = (lista, a, b) => { const out = []; let x = a; for (const n of lista) { out.push([x, n - 5]); x = n + 5; } out.push([x, b]); return out; };
  // (as pontas também são esquinas: começa 5 m depois do bordo da rua da quina)
  for (const [a, b] of foraDe(GRADE.X.slice(1, -1), GRADE.X[0] + 5, GRADE.X.at(-1) - 5)) {
    face({ eixoL: 'x', a, b, fixo: L.z0, dentro: -1, rumo: RUMO.oeste, fora: true });  // norte da Rua das Acácias
    face({ eixoL: 'x', a, b, fixo: L.z1, dentro: 1, rumo: RUMO.leste, fora: true });   // sul da Rua da Praça
  }
  for (const [a, b] of foraDe(GRADE.Z.slice(1, -1), GRADE.Z[0] + 5, GRADE.Z.at(-1) - 5)) {
    face({ eixoL: 'z', a, b, fixo: L.x0, dentro: -1, rumo: RUMO.sul, fora: true });    // oeste da Rua das Margaridas
    face({ eixoL: 'z', a, b, fixo: L.x1, dentro: 1, rumo: RUMO.norte, fora: true });   // leste da Rua das Palmeiras
  }
  // a calçada perde as baias (retângulo menos retângulo); os pedaços pequenos somem
  const menos = (r, b) => {
    if (!(b.x0 < r.x1 && b.x1 > r.x0 && b.z0 < r.z1 && b.z1 > r.z0)) return [r];
    const out = [], z0 = Math.max(r.z0, b.z0), z1 = Math.min(r.z1, b.z1);
    if (b.z0 > r.z0) out.push({ ...r, z1: b.z0 });
    if (b.z1 < r.z1) out.push({ ...r, z0: b.z1 });
    if (b.x0 > r.x0) out.push({ ...r, x1: b.x0, z0, z1 });
    if (b.x1 < r.x1) out.push({ ...r, x0: b.x1, z0, z1 });
    return out;
  };
  const calcadas = predios.filter(p => p.tipo === 'calcada');
  const quadras = calcadas.map(p => ({ x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1 }));   // para o gramado (antes do recorte)
  let novas = calcadas;
  for (const b of baias) novas = novas.flatMap(p => menos(p, b));
  novas = novas.filter(p => (p.x1 - p.x0) > 0.05 && (p.z1 - p.z0) > 0.05);
  for (let i = predios.length - 1; i >= 0; i--) if (predios[i].tipo === 'calcada') predios.splice(i, 1);
  predios.push(...novas);
  // calçada em volta do mapa (só desenho) = 4 faixas menos a rampa da garagem, as saídas da estrada e as baias de fora
  const CW = 4;
  let anel = [{ x0: L.x0 - CW, x1: L.x1 + CW, z0: L.z0 - CW, z1: L.z0 }, { x0: L.x0 - CW, x1: L.x1 + CW, z0: L.z1, z1: L.z1 + CW },
    { x0: L.x0 - CW, x1: L.x0, z0: L.z0, z1: L.z1 }, { x0: L.x1, x1: L.x1 + CW, z0: L.z0, z1: L.z1 }];
  for (const b of [{ x0: GARAGEM.x0, x1: GARAGEM.x1, z0: L.z1, z1: L.z1 + CW }, { x0: L.x1, x1: L.x1 + CW, z0: -6, z1: 6 }, { x0: L.x1, x1: L.x1 + CW, z0: 165, z1: 175 }, ...baiasFora])
    anel = anel.flatMap(p => menos(p, b));
  Object.assign(BAIA, { quadras, anel });
}
export const naBaiaDeFora = (x, z) => baiasFora.some(b => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);

export const BAIRRO = { ruas, nos, semaforos, pares, faixas, radares, lombadas, escola, predios, missao, missoes: MISSOES, zonasSilencio, estacionamento: ESTACIONAMENTO, vagas, garagem: GARAGEM, trechos, placas, arvores, rotula: ROTULA, limites: LIMITES_MAPA, estrada: ESTRADA, pontes, baia: BAIA, baias, baiasFora, quadras: BAIA.quadras, anel: BAIA.anel };
