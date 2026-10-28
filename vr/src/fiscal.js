// O fiscal: recebe o mundo a cada passo e devolve eventos de acerto, infração ou aviso. Lógica pura (sem THREE/DOM).
// Justiça: o carro é um ponto no centro; uma linha só fiscaliza quem a cruza NO SENTIDO dela (produto escalar > 0);
// cada coisa conta 1× por passagem; na dúvida (fronteira de fase, parar um pouco além da linha) o jogador é favorecido.
import * as LEI from './lei.js';
import { BAIRRO, faseSemaforo as faseB, limiteEm as limiteB, naRua as naRuaB } from './bairro.js';

const PARADO = 1 / 3.6;          // v < 1 km/h = parado (m/s)
const ZONA = 10;                 // "nos 10 m antes" da linha
const LIMIAR = 1.5;              // o veredito da linha sai quando o centro passa 1,5 m dela (parar um pouco além não pune)
const REARMA = 3;                // para contar outra passagem, o carro tem de voltar 3 m antes da linha
const MEIA_CARRO = 0.9;          // meia largura do carro (tolerância lateral e na faixa de pedestre)
const SALTO = 15;                // passo maior que isso = teletransporte (reinício): não julga nada
const ZONA_RADAR = 30;           // trecho antes do radar em que ele "vê" o carro (sem perda de ⭐ por excesso)
const AVISO_INTERVALO = 5;       // aviso de excesso no máximo 1× a cada 5 s
const ESTRELAS_POR_SEG = 2;      // −2 ⭐ por segundo acima do limite sem radar
const PED_PERTO = 2;             // pedestre a até 2 m da faixa, entrando, conta como na faixa
const ROTULA_ANTES = 15;         // carro circulando a menos de 15 m antes do ponto de entrada
// spec 006
const CAIXA = { c: 1.7, l: 0.88 };  // meia caixa de um carrinho (3,3 × 1,7 m + para-choque)
const MEIA_NO = 7.7;             // centro do cruzamento até a borda + meio carro (avenida 6 m + 1,7)
const VEM_SEG = 4;               // "vem vindo" = chega ao cruzamento em menos de 4 s
const SAIU_PARE = 4;             // batida até 4 s depois de sair do PARE, com o outro na transversal = preferência
const ODO_METROS = 10;           // odômetro: +1 ⭐ a cada 10 m dentro do limite, na mão certa
const ODO_LIMPO = 5;             // ... e sem infração nem batida nos últimos 5 s
// spec 007 — seta
const SETA_ANTES = 30;           // a seta certa tem de estar ligada desde ≥ 30 m antes do ponto da conversão (regra do jogo)
const CONV_GRAUS = 45;           // conversão = o rumo muda mais que 45° (curvinhas suaves não contam)
const CONV_K = 0.02;             // curvatura mínima (rad/m, raio < 50 m) para um ponto contar como "virando"
const CONV_JUNTA = 3;            // trechos virando separados por até 3 m são a mesma curva
const NA_ROTA = 8;               // fora disto (m) o carro não está seguindo a rota: seta não é julgada
const REARMA_CONV = 40;          // voltar 40 m antes da conversão rearma o julgamento
const BIKE_DIST = 1.5;           // art. 201: 1,50 m de distância lateral ao passar a bicicleta
const MEIA_BIKE = 0.35;          // meia largura da bicicleta com o ciclista (m)
const AMB_PERTO = 40;            // ambulância a menos de 40 m atrás, no mesmo rumo = "vem vindo" (m)
const AMB_V = 15 / 3.6;          // reduziu para ≤ 15 km/h enquanto ela vinha = deu passagem (m/s)
const SUSTO_PERTO = 40;          // cachorro/bola na pista a < 40 m à frente = situação de reduzir (m)
const CHUVA_FOLGA = 10;          // na chuva: andar a menos de 10 km/h do limite...
const CHUVA_T = 3;               // ...por 3 s seguidos = não reduziu (art. 220 VIII; regra do jogo para "reduzir")
const CHUVA_REPETE = 15;         // o aviso da chuva volta no máx. a cada 15 s
const BUZINA_REPETE = 3;         // buzinar na zona de silêncio: no máx. 1 aviso a cada 3 s
const CONTRA_T = 1;              // spec 034: na contramão de rua de mão única por 1 s seguido = aviso
const CONTRA_REPETE = 10;        // e de novo a cada 10 s se continuar
const VAGA_T = 1.5;
const CARRO_L = 1.7, CARRO_C = 3.4;  // largura e comprimento do carrinho (m)              // parado 1,5 s dentro de uma vaga, alinhado = estacionou
const CINTO_V = 5 / 3.6;          // começou a andar (m/s): a partir daqui o cinto é julgado
const CINTO_REPETE = 20;         // andando sem cinto, o aviso (−⭐) volta a cada 20 s
const VIROU_RAD = 0.5;           // rumo a < ~29° da saída = virou de fato (só então a seta é julgada)
const PEND_MAX_S = 8;            // passou o meio da curva e não virou em 8 s → seguiu por outro caminho, não julga

const r2 = (x) => Math.round(x * 100) / 100;
const TAU = 2 * Math.PI;

// coordenadas de (x, z) no referencial de uma linha/objeto com rumo h: s = à frente, w = à direita
function local(o, h, x, z) {
  const fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
  const dx = x - o.x, dz = z - o.z;
  return { s: dx * fx + dz * fz, w: dx * rx + dz * rz };
}

// as duas caixas (carro do jogador e outro carro) se encostam? (eixos separadores, 2D)
function encostam(a, ha, b, hb, m = CAIXA) {
  const eixos = [ha, ha + Math.PI / 2, hb, hb + Math.PI / 2];
  const dx = b.x - a.x, dz = b.z - a.z;
  const proj = (h, e) => {               // meia projeção da caixa de rumo h no eixo e
    const c = Math.abs(Math.cos(h - e)), s = Math.abs(Math.sin(h - e));
    return m.c * c + m.l * s;
  };
  for (const e of eixos) {
    const d = Math.abs(dx * Math.sin(e) + dz * Math.cos(e));
    if (d > proj(ha, e) + proj(hb, e)) return false;
  }
  return true;
}

const wrapA = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

// Conversões de uma rota (polilinha [[x,z],...]): pontos onde o rumo muda > 45° (lado 'esq'|'dir'). Na rótula conta uma
// só, na SAÍDA (direita). Devolve { P (amostras a ~1 m com s e h), lista: [{ id, s, x, z, lado, hSaida }] }.
export function calcularConversoes(rota, rotula = BAIRRO.rotula) {
  const P = [];
  for (let i = 0; i < rota.length - 1; i++) {
    const [ax, az] = rota[i], [bx, bz] = rota[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az)));
    for (let k = 0; k < n; k++) P.push({ x: ax + (bx - ax) * k / n, z: az + (bz - az) * k / n });
  }
  P.push({ x: rota.at(-1)[0], z: rota.at(-1)[1] });
  let s = 0;
  P.forEach((p, i) => {
    if (i) s += Math.hypot(p.x - P[i - 1].x, p.z - P[i - 1].z);
    p.s = s;
    const q = P[Math.min(P.length - 1, i + 1)], o = i === P.length - 1 ? P[i - 1] : p;
    p.h = Math.atan2(q.x - o.x, q.z - o.z);
  });
  // trechos "virando" (curvatura > CONV_K), juntando os separados por até CONV_JUNTA m
  const grupos = [];
  for (let i = 0; i < P.length - 1; i++) {
    const dh = wrapA(P[i + 1].h - P[i].h), ds = Math.max(1e-6, P[i + 1].s - P[i].s);
    if (Math.abs(dh) / ds < CONV_K) continue;
    const g = grupos.at(-1);
    if (g && P[i].s - P[g.fim].s <= CONV_JUNTA) { g.fim = i + 1; g.dh += dh; } else grupos.push({ ini: i, fim: i + 1, dh });
  }
  const naRotula = i => rotula && Math.hypot(P[i].x - rotula.x, P[i].z - rotula.z) <= rotula.externo + 6;
  const lista = [];
  let rot = null;
  for (const g of grupos) {
    if (naRotula(Math.round((g.ini + g.fim) / 2))) { rot = rot ? { ...rot, fim: g.fim } : { ...g }; continue; }
    if (Math.abs(g.dh) <= CONV_GRAUS * Math.PI / 180) continue;
    const sm = (P[g.ini].s + P[g.fim].s) / 2;
    let m = g.ini; while (m < g.fim && P[m].s < sm) m++;
    lista.push({ s: sm, x: P[m].x, z: P[m].z, lado: g.dh > 0 ? 'esq' : 'dir', hSaida: P[g.fim].h });
  }
  if (rot) {        // saída da rótula: último ponto sobre o anel (antes de a rota se afastar do centro)
    let e = rot.fim;
    let a = null;
    for (let i = rot.ini; i <= rot.fim; i++) if (Math.hypot(P[i].x - rotula.x, P[i].z - rotula.z) <= rotula.R + 0.5) { e = i; if (a === null) a = i; }
    // qual saída: quartos de volta do ponto de entrada até o de saída (o anel gira com θ decrescente)
    const th = i => Math.atan2(P[i].z - rotula.z, P[i].x - rotula.x);
    let giro = th(a ?? rot.ini) - th(e); while (giro < 0.3) giro += TAU;
    const saida = Math.max(1, Math.min(4, Math.round(giro / (Math.PI / 2))));
    lista.push({ s: P[e].s, x: P[e].x, z: P[e].z, lado: 'dir', hSaida: P[Math.min(P.length - 1, e + 3)].h, rotula: true, saida });
  }
  lista.sort((a, b) => a.s - b.s).forEach((c, i) => { c.id = `conv_${i + 1}`; });
  return { P, lista };
}

export function criarFiscal({ bairro = BAIRRO, lei = LEI, saldoInicial = 1000, fase = faseB, limiteEm = limiteB,
  naRua = naRuaB, estrelasIniciais = 0, odometro = false, conversoes = null, cinto: julgaCinto = false, chuva = false, clima = null } = {}) {
  const climaRuim = clima || (chuva ? 'chuva' : null);       // spec 035: 'chuva' | 'neblina' (art. 220 VIII vale para os dois)
  const largura = Object.fromEntries(bairro.ruas.map(r => [r.id, r.largura]));
  const novaLinha = (tipo, ref, L, extra = {}) => ({
    tipo, ref, L, meia: largura[L.rua] / 4 + MEIA_CARRO,
    armada: true, passando: false, faseCruzou: null, parouNaLinha: false, parouZona: false, ...extra,
  });
  const linhas = [];
  for (const g of bairro.semaforos) for (const L of g.linhas) linhas.push(novaLinha('semaforo', g.id, L));
  for (const p of bairro.pares) linhas.push(novaLinha('pare', p.id, p.linha, { no: bairro.nos.find(n => n.id === p.no), parado: false, saiu: null }));
  const radares = bairro.radares.map(r => ({ r, meia: largura[r.rua] / 4 + MEIA_CARRO, armada: true }));
  const nosSemaforo = bairro.nos.filter(n => n.tipo === 'semaforo');
  const faixas = bairro.faixas.map(f => ({
    f, B: f.largura / 2 + MEIA_CARRO, dentro: false, esperou: false, paradoT: 0, multouParada: false,
    perto: nosSemaforo.some(n => Math.hypot(n.x - f.x, n.z - f.z) < 20),
  }));
  const ROT = bairro.rotula;
  const rot = { dentro: false };
  let rotContraT = 0;                 // spec 062: tempo girando ao contrário no anel

  let estrelas = estrelasIniciais, pontosCnh = 0, dinheiro = saldoInicial, ultimoAviso = -Infinity;
  const infracoes = [], acertos = [], batidas = [];
  let tErro = -Infinity, seq = 0, odAcc = 0, odEstrelas = 0;      // odômetro de estrelas
  let cruz = null, saidaPare = null, quase = null;                 // olhar no PARE / batida de preferência
  const contato = new Map();                                       // carro → último instante encostado
  let prev = null, pedPrev = new Map();
  // seta (spec 007): onde (s na rota) a seta atual foi ligada; conversões já julgadas nesta passagem
  const novoCV = cv => ({ P: cv.P, lista: cv.lista.map(k => ({ ...k, julgada: false })), idx: 0 });
  let CV = conversoes ? novoCV(conversoes) : null;
  let setaAnt = null, setaIni = null, sRota = null, sRotaAnt = null, proxConv = null;
  const semSeta = [];
  let cintoJulgado = false, semCintoT = null;
  const semCinto = [];
  const bikes = new Map(), bikePerto = [], ambs = new Map(), semPassagem = [];   // specs 023/024
  const sustos = new Map(), naoReduziu = [], buzinadas = [], chuvaRapido = [];   // specs 026–029
  let buzinaT = -Infinity, chuvaAcima = 0, chuvaT = -Infinity;
  const contramaos = [], vagasErradas = [];               // spec 034
  const garagem = [];                                      // spec 036
  const lentos = new Map(), ultrapassagens = [];           // spec 040: trator (veículo lento) e a ponte
  const atropelamentos = [], atropT = new Map();          // spec 050
  let vRec = 0;                                            // maior |velocidade| dos últimos instantes (o carro para ao bater)
  const pontes = bairro.pontes || [];
  const naPonteF = (x, z, folga) => pontes.find(p => x > p.x0 - folga && x < p.x1 + folga && z > p.z0 - 1 && z < p.z1 + 1);
  let saiuGaragem = false;
  let contraT = 0, contraAviso = -Infinity, paradoVaga = 0, vagaJulgada = null, estacionou = null;
  let estacionouT = -Infinity;        // spec 063: quando deu a última ⭐ de estacionar
  const estacionouErrado = [];                             // spec 042: estacionar na rua (art. 181)
  let paradoRua = 0, ruaJulgada = false, paradoDupla = 0, duplaJulgada = false;
  const parados = (bairro.predios || []).filter(p => p.tipo === 'carroParado').map(p => ({ x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2 }));
  const avisoRua = (out, c, t, chave) => {
    const info = lei.ESTACIONAR_RUA[chave], pontos = lei.PONTOS_JOGO.estacionouErrado;
    const e = { tipo: 'aviso', motivo: 'estacionou_errado', caso: chave, pontos, dica: info.dica, artigo: info.artigo, x: c.x, z: c.z, t };
    estrelas += pontos; estacionouErrado.push(e); out.push(e);
  };
  const maoDupla = Object.fromEntries(bairro.ruas.map(r => [r.id, r.maoDupla]));

  const infracao = (out, id, c, t, ref, kmh) => {
    const m = lei.multa(id);
    const e = { tipo: 'infracao', id, multa: m, x: c.x, z: c.z, t, ref };
    if (kmh !== undefined) e.kmh = kmh;
    dinheiro = r2(dinheiro - m.valor); pontosCnh += m.pontos; estrelas += lei.PONTOS_JOGO.infracao;
    tErro = t; seq = 0; odAcc = 0;
    infracoes.push(e); out.push(e);
  };
  const acerto = (out, motivo, c, t, ref, kmh) => {
    const pontos = lei.PONTOS_JOGO[motivo];
    const e = { tipo: 'acerto', motivo, pontos, x: c.x, z: c.z, t, ref };
    if (kmh !== undefined) e.kmh = kmh;
    estrelas += pontos; acertos.push(e); out.push(e);
  };

  // quem vem pela transversal até o cruzamento do PARE `l` (lado do ponto de vista de quem está na linha)
  function perigo(l, carros) {
    const r = { esquerda: false, direita: false };
    if (l.no.tipo === 'rotula') {            // spec 041 (do site): no PARE da rótula o perigo vem do anel, girando pela esquerda
      const te = Math.atan2(l.L.z - ROT.z, l.L.x - ROT.x);
      r.esquerda = carros.some(o => {
        const d = Math.hypot(o.x - ROT.x, o.z - ROT.z);
        if (d < ROT.ilha || d > ROT.externo || !(o.v > PARADO)) return false;
        return ((((Math.atan2(o.z - ROT.z, o.x - ROT.x) - te) % TAU) + TAU) % TAU) * ROT.R < ROTULA_ANTES;
      });
      return r;
    }
    for (const o of carros) {
      if (o.heading === undefined) continue;
      if (Math.abs(Math.cos(o.heading - l.L.heading)) > 0.7) continue;          // mesma rua (paralelo): não cruza
      const fx = Math.sin(o.heading), fz = Math.cos(o.heading), dx = l.no.x - o.x, dz = l.no.z - o.z;
      const ao = dx * fx + dz * fz, lat = Math.abs(-dx * fz + dz * fx);
      if (lat > 9 || ao < -MEIA_NO) continue;                                      // não passa por aqui / já passou
      const borda = ao - MEIA_NO, v = o.v || 0;
      if (borda <= 0 || (v > 0.5 && borda / v < VEM_SEG)) r[local(l.L, l.L.heading, o.x, o.z).w > 0 ? 'direita' : 'esquerda'] = true;
    }
    return r;
  }

  // pedestre em conflito com a faixa: sobre a zebra, ou a até 2 m da ponta dela andando para dentro
  function pedestreNaFaixa(fx, pedestres) {
    const f = fx.f;
    return pedestres.some((p, i) => {
      if (p.faixa !== undefined && p.faixa !== f.id) return false;
      const { s: u, w } = local(f, f.heading, p.x, p.z);
      if (Math.abs(u) > f.largura / 2 + 0.5) return false;
      const aw = Math.abs(w), meio = f.comprimento / 2;
      if (aw <= meio) return true;
      if (aw > meio + PED_PERTO) return false;
      if (p.entrando === true) return true;
      const q = pedPrev.get(p.id ?? i);
      if (!q) return false;
      return aw < Math.abs(local(f, f.heading, q.x, q.z).w) - 1e-6;
    });
  }

  const LONGE = 90;                    // m (spec 056)
  function tick(mundo, dt) {
    const out = [];
    const { t, carro: c } = mundo;
    const pedestres = mundo.pedestres || [], carros = mundo.carros || [];
    const v = c.v, kmh = Math.round(v * 36) / 10;
    cruz = null;
    const salto = prev && Math.hypot(c.x - prev.x, c.z - prev.z) > SALTO;
    if (CV) { sRotaAnt = salto ? null : sRota; sRota = naRota(c.x, c.z); }
    if (!prev || salto) {     // primeiro passo ou reinício: zera as passagens em andamento, não julga
      for (const l of linhas) Object.assign(l, { armada: true, passando: false, parouZona: false, parouNaLinha: false });
      for (const r of radares) r.armada = true;
      for (const fx of faixas) Object.assign(fx, { dentro: false, esperou: false, paradoT: 0, multouParada: false });
      rot.dentro = Math.hypot(c.x - ROT.x, c.z - ROT.z) <= ROT.externo;
      for (const fx of faixas) {
        const a = local(fx.f, fx.f.heading, c.x, c.z);
        fx.dentro = Math.abs(a.s) <= fx.B && Math.abs(a.w) <= fx.f.comprimento / 2 + 0.5;
      }
    } else {
      // ---- linhas de parada: semáforo e PARE
      // spec 056: no mapa grande só olha o que está a até LONGE m; o que fica longe volta ao estado de repouso
      for (const l of linhas) {
        if (Math.abs(l.L.x - c.x) > LONGE || Math.abs(l.L.z - c.z) > LONGE) {
          if (!l.longe) { Object.assign(l, { armada: true, passando: false, parouZona: false, parouNaLinha: false, parado: false, saiu: null }); l.longe = true; }
          continue;
        }
        l.longe = false;
        const a = local(l.L, l.L.heading, prev.x, prev.z), b = local(l.L, l.L.heading, c.x, c.z);
        if (b.s < -REARMA) l.armada = true;
        if (b.s < -ZONA - 5 || Math.abs(b.w) > 20) { l.parouZona = false; l.passando = false; l.parado = false; l.saiu = null; }
        const naFaixa = Math.abs(b.w) <= l.meia;
        if (l.tipo === 'pare' && naFaixa && b.s >= -ZONA && b.s < LIMIAR) {       // parado no PARE: olha para os lados
          const p = perigo(l, carros);
          if (v < PARADO) { l.parado = true; cruz = { ref: l.ref, ...p }; }
          else if (l.parado) { l.parado = false; l.saiu = { t, livre: !p.esquerda && !p.direita }; }
        }
        if (naFaixa && b.s >= -ZONA && b.s < LIMIAR && v < PARADO && !l.passando) {
          if (l.tipo === 'pare' || fase(l.ref, t) === 'vermelho') l.parouZona = true;
        }
        if (l.armada && !l.passando && a.s < 0 && b.s >= 0) {
          const k = a.s / (a.s - b.s), wx = a.w + (b.w - a.w) * k;     // lateral no ponto em que cruzou
          if (Math.abs(wx) <= l.meia) {
            l.passando = true; l.armada = false; l.parouNaLinha = false;
            l.faseCruzou = l.tipo === 'semaforo' ? fase(l.ref, t) : null;
          }
        }
        if (!l.passando) continue;
        if (b.s < 0) { l.passando = false; l.armada = true; continue; }      // voltou: não passou
        if (b.s < LIMIAR) {
          if (v < PARADO) {
            l.parouNaLinha = true;
            if (l.tipo === 'pare' || fase(l.ref, t) === 'vermelho') l.parouZona = true;
          }
          continue;
        }
        // veredito (o centro passou LIMIAR m da linha)
        l.passando = false;
        if (l.tipo === 'pare') {
          if (l.parouZona) acerto(out, 'parouPare', c, t, l.ref); else infracao(out, 'pare', c, t, l.ref);
          if (l.parouZona && l.saiu && l.saiu.livre) acerto(out, 'olhouEsperou', c, t, l.ref);
          else if (l.parouZona && l.saiu) quase = { t: l.saiu.t, ref: l.ref };
          saidaPare = { t: l.saiu ? l.saiu.t : t, heading: l.L.heading, ref: l.ref };
          l.saiu = null; l.parado = false;
        } else {
          const f = l.parouNaLinha ? fase(l.ref, t) : l.faseCruzou;
          if (f === 'vermelho') infracao(out, 'sinal_vermelho', c, t, l.ref);
          else if (f === 'verde' && l.parouZona) acerto(out, 'parouVermelho', c, t, l.ref);
        }
        l.parouZona = false;
      }

      // ---- radar
      for (const R of radares) {
        if (Math.abs(R.r.x - c.x) > LONGE || Math.abs(R.r.z - c.z) > LONGE) { R.armada = true; continue; }
        const a = local(R.r, R.r.heading, prev.x, prev.z), b = local(R.r, R.r.heading, c.x, c.z);
        if (b.s < -REARMA) R.armada = true;
        if (R.armada && a.s < 0 && b.s >= 0) {
          const k = a.s / (a.s - b.s), wx = a.w + (b.w - a.w) * k;
          if (Math.abs(wx) <= R.meia) {
            R.armada = false;
            const id = lei.infracaoVelocidade(kmh, R.r.limiteKmh);
            if (id) infracao(out, id, c, t, R.r.id, kmh); else acerto(out, 'radarOk', c, t, R.r.id, kmh);
          }
        }
      }

      // ---- faixas de pedestre
      for (const fx of faixas) {
        if (Math.abs(fx.f.x - c.x) > LONGE || Math.abs(fx.f.z - c.z) > LONGE) {
          if (fx.dentro || fx.esperou || fx.paradoT || fx.multouParada) Object.assign(fx, { dentro: false, esperou: false, paradoT: 0, multouParada: false });
          continue;
        }
        const f = fx.f, a = local(f, f.heading, prev.x, prev.z), b = local(f, f.heading, c.x, c.z);
        const latOk = Math.abs(b.w) <= f.comprimento / 2 + 0.5;
        const conflito = () => pedestreNaFaixa(fx, pedestres);
        // esperando antes da faixa, de frente para ela, com pedestre atravessando
        const frente = Math.sin(c.heading) * Math.sin(f.heading) + Math.cos(c.heading) * Math.cos(f.heading);
        if (!fx.dentro && latOk && Math.abs(b.s) > fx.B && Math.abs(b.s) <= fx.B + ZONA && frente * b.s < 0
          && v < PARADO && conflito()) fx.esperou = true;
        if (!latOk || Math.abs(b.s) > fx.B + ZONA + 5) fx.esperou = false;
        const entrou = !fx.dentro && latOk && Math.abs(a.s) > fx.B
          && (Math.abs(b.s) <= fx.B || Math.sign(a.s) !== Math.sign(b.s));
        if (entrou) {
          fx.dentro = true; fx.multouParada = false; fx.paradoT = 0;
          if (conflito()) infracao(out, 'pedestre_faixa', c, t, f.id);
          else if (fx.esperou) acerto(out, 'deuPreferenciaPedestre', c, t, f.id);
          fx.esperou = false;
        }
        if (fx.dentro && (!latOk || Math.abs(b.s) > fx.B + 1)) { fx.dentro = false; fx.paradoT = 0; }
        // parado com o centro sobre a zebra por mais de 1 s (fora de semáforo)
        const sobre = Math.abs(b.s) <= f.largura / 2 && Math.abs(b.w) <= f.comprimento / 2;
        if (sobre && v < PARADO && !fx.perto) {
          fx.paradoT += dt;
          if (fx.paradoT > 1 && !fx.multouParada) { fx.multouParada = true; infracao(out, 'parar_sobre_faixa', c, t, f.id); }
        } else fx.paradoT = 0;
      }

      // ---- rótula: entrar no anel (cruzar o raio externo para dentro)
      const d0 = Math.hypot(prev.x - ROT.x, prev.z - ROT.z), d1 = Math.hypot(c.x - ROT.x, c.z - ROT.z);
      if (d1 > ROT.externo + 2) rot.dentro = false;
      if (!rot.dentro && d0 > ROT.externo && d1 <= ROT.externo) {
        rot.dentro = true;
        const te = Math.atan2(c.z - ROT.z, c.x - ROT.x);
        // o anel gira com θ decrescendo: quem vem "antes" da entrada tem θ maior
        const vem = carros.some(o => {
          const d = Math.hypot(o.x - ROT.x, o.z - ROT.z);
          if (d < ROT.ilha || d > ROT.externo || !(o.v > PARADO)) return false;
          const arco = ((((Math.atan2(o.z - ROT.z, o.x - ROT.x) - te) % TAU) + TAU) % TAU) * ROT.R;
          return arco < ROTULA_ANTES;
        });
        // spec 062: o anel gira com θ DECRESCENDO (anti-horário visto de cima); tangente do giro = (sen θ, −cos θ).
        // Entrou virando contra o giro (contramão na rótula) → sem ⭐ (o aviso de contramão vem abaixo)
        const noSentido = Math.sin(c.heading) * Math.sin(te) - Math.cos(c.heading) * Math.cos(te) > -0.35 || v < 0;
        if (vem) infracao(out, 'rotula_preferencia', c, t, 'rotula'); else if (noSentido) acerto(out, 'rotulaCerta', c, t, 'rotula');
      }
      // spec 062: girando no anel ao contrário (θ crescendo) por 1 s → aviso de contramão (art. 186 II), como nas ruas
      // de mão única (a rótula é de sentido único: placa de sentido de circulação)
      if (ROT) {
        const rx = c.x - ROT.x, rz = c.z - ROT.z, d = Math.hypot(rx, rz);
        const omega = (rx * Math.cos(c.heading) - rz * Math.sin(c.heading)) * v / Math.max(1, d * d);   // dθ/dt
        const contraRot = d > ROT.ilha - 1 && d < ROT.externo && Math.abs(v) > PARADO * 3 && omega > 0.05;
        rotContraT = contraRot ? rotContraT + dt : 0;
        if (rotContraT >= CONTRA_T && t - contraAviso >= CONTRA_REPETE) {
          contraAviso = t;
          const info = lei.CONTRAMAO, pontos = lei.PONTOS_JOGO.contramaoUnica;
          const e = { tipo: 'aviso', motivo: 'contramao_unica', rua: 'rotula', pontos, dica: info.dica, artigo: info.multaReal.artigo, x: c.x, z: c.z, t };
          estrelas += pontos; contramaos.push(e); out.push(e);
        }
      }

      // ---- batida (caixa × caixa) com outro carro. Conta 1× por encostão (precisa separar 1 s para contar de novo)
      carros.forEach((o, i) => {
        if (o.heading === undefined) return;
        const k = o.id ?? i;
        if (!encostam(c, c.heading, o, o.heading)) { if (contato.has(k) && t - contato.get(k) > 1) contato.delete(k); return; }
        const novo = !contato.has(k);
        contato.set(k, t);
        if (!novo || !(v > 1 || (o.v || 0) > 1)) return;
        let motivo = 'outra';
        if (saidaPare && t - saidaPare.t <= SAIU_PARE && Math.abs(Math.cos(o.heading - saidaPare.heading)) < 0.7) motivo = 'preferencia';
        else if (Math.cos(o.heading - c.heading) > 0.7 && local(c, c.heading, o.x, o.z).s > 0) motivo = 'traseira';
        // 'outra' com o jogador parado (bateram nele): não perde ⭐
        const pontos = motivo === 'outra' && v <= 1 ? 0 : lei.PONTOS_JOGO.batida;
        const info = lei.BATIDAS[motivo];
        const e = { tipo: 'batida', motivo, pontos, carro: k, dica: info.dica, artigo: info.multaReal ? info.multaReal.artigo : null, x: c.x, z: c.z, t };
        estrelas += pontos; tErro = t; seq = 0; odAcc = 0; quase = null;
        batidas.push(e); out.push(e);
      });
      // ---- bicicleta (spec 024, art. 201): ao passar por ela (o centro do carro cruza o dela, no rumo dela), mede a
      // folga lateral entre a lateral do carro e a bicicleta. < 1,5 m → aviso (−⭐); senão acerto. 1× por bicicleta.
      for (const b of mundo.bicicletas || []) {
        const a = local(b, b.heading, c.x, c.z), k = bikes.get(b.id) || { s: null, julgada: false };
        if (!k.julgada && k.s !== null && k.s < 0 && a.s >= 0 && Math.abs(a.w) < 8) {
          k.julgada = true;
          const folga = Math.abs(a.w) - MEIA_CARRO - MEIA_BIKE;
          if (folga < BIKE_DIST) {
            const pontos = lei.PONTOS_JOGO.bikePerto, info = lei.BICICLETA;
            const e = { tipo: 'aviso', motivo: 'bike_perto', ref: b.id, folga: +folga.toFixed(2), pontos, dica: info.dica, artigo: info.multaReal.artigo, x: c.x, z: c.z, t };
            estrelas += pontos; bikePerto.push(e); out.push(e);
          } else acerto(out, 'bikeLonge', c, t, b.id);
        }
        k.s = a.s; bikes.set(b.id, k);
      }
      // ---- ambulância (spec 023, art. 189 + art. 29 VII a): vindo atrás, no mesmo rumo, a < 40 m → janela aberta,
      // guarda a menor velocidade do jogador. Quando ela passa (cruza o jogador): reduziu a ≤ 15 km/h = deu passagem.
      for (const m of mundo.ambulancias || []) {
        const a = local(c, c.heading, m.x, m.z), k = ambs.get(m.id) || { s: null, vMin: Infinity, julgada: false };
        const mesmoRumo = Math.abs(wrapA(m.heading - c.heading)) < 0.8;
        if (!k.julgada && mesmoRumo && a.s < 0 && a.s > -AMB_PERTO && Math.abs(a.w) < 10) k.vMin = Math.min(k.vMin, v);
        if (!k.julgada && k.s !== null && k.s < 0 && a.s >= 0 && k.vMin < Infinity) {
          k.julgada = true;
          if (k.vMin <= AMB_V) acerto(out, 'deuPassagem', c, t, m.id);
          else {
            const pontos = lei.PONTOS_JOGO.naoDeuPassagem, info = lei.AMBULANCIA;
            const e = { tipo: 'aviso', motivo: 'nao_deu_passagem', ref: m.id, kmh: Math.round(k.vMin * 36) / 10, pontos, dica: info.dica, artigo: info.multaReal.artigo, x: c.x, z: c.z, t };
            estrelas += pontos; semPassagem.push(e); out.push(e);
          }
        }
        k.s = a.s; ambs.set(m.id, k);
      }
      // ---- cachorro / bola atravessando (specs 027/028, art. 220 XI): enquanto está NA PISTA e a < 40 m à frente,
      // guarda a menor velocidade; quando sai da pista (ou o jogador passa por ele), julga: ≤ 15 km/h = reduziu.
      const vistos = new Set();
      const julgaSusto = (k, tipo) => {
        k.julgado = true;
        if (k.vMin <= AMB_V) { acerto(out, 'reduziuSusto', c, t, tipo); return; }
        const info = lei.REDUZIR[tipo === 'cachorro' ? 'animal' : 'bola'], pontos = lei.PONTOS_JOGO.naoReduziu;
        const e = { tipo: 'aviso', motivo: 'nao_reduziu', ref: tipo, kmh: Math.round(k.vMin * 36) / 10, pontos, dica: info.dica, artigo: info.artigo, x: c.x, z: c.z, t };
        estrelas += pontos; naoReduziu.push(e); out.push(e);
      };
      for (const o of mundo.travessias || []) {
        if (o.julgar === false) continue;                       // a criança atrás da bola é julgada junto com a bola
        vistos.add(o.id);
        // distância até o PONTO DA TRAVESSIA (meio da rua): a bola pode já estar na outra calçada com a criança ainda vindo
        const a = local(c, c.heading, o.cx ?? o.x, o.cz ?? o.z), k = sustos.get(o.id) || { vMin: Infinity, julgado: false, tipo: o.tipo };
        if (!k.julgado && o.naPista && a.s > 0 && a.s < SUSTO_PERTO && Math.abs(a.w) < 8) k.vMin = Math.min(k.vMin, v);
        if (!k.julgado && k.vMin < Infinity && (!o.naPista || a.s < -1)) { julgaSusto(k, o.tipo); sustos.set(o.id, k); continue; }
        sustos.set(o.id, k);
      }
      for (const [id, k] of sustos) if (!vistos.has(id) && !k.julgado && k.vMin < Infinity) julgaSusto(k, k.tipo);   // saiu da lista
      // ---- buzina na zona de silêncio do posto de saúde (spec 026, art. 227 IV)
      if (mundo.buzinou && t - buzinaT >= BUZINA_REPETE && (bairro.zonasSilencio || []).some(z => c.x >= z.x0 && c.x <= z.x1 && c.z >= z.z0 && c.z <= z.z1)) {
        buzinaT = t;
        const info = lei.BUZINA, pontos = lei.PONTOS_JOGO.buzinou;
        const e = { tipo: 'aviso', motivo: 'buzinou', pontos, dica: info.dica, artigo: info.multaReal.artigo, x: c.x, z: c.z, t };
        estrelas += pontos; buzinadas.push(e); out.push(e);
      }
      // ---- chuva (spec 029, art. 220 VIII): andar a menos de 10 km/h do limite por 3 s seguidos = não reduziu
      if (climaRuim) {
        const limC = limiteEm(c.x, c.z, c.heading);
        chuvaAcima = v > PARADO && kmh > limC - CHUVA_FOLGA ? chuvaAcima + dt : 0;
        if (chuvaAcima >= CHUVA_T && t - chuvaT >= CHUVA_REPETE) {
          chuvaT = t; chuvaAcima = 0;
          const info = lei.REDUZIR[climaRuim], pontos = lei.PONTOS_JOGO.chuvaRapido;
          const e = { tipo: 'aviso', motivo: 'chuva_rapido', clima: climaRuim, kmh, limite: limC, pontos, dica: info.dica, artigo: info.artigo, x: c.x, z: c.z, t };
          estrelas += pontos; chuvaRapido.push(e); out.push(e);
        }
      }
      // ---- atropelamento (spec 050, art. 29 § 2º / art. 303): alguém a pé (pedestre, criança, cachorro) ou de bicicleta
      // encostado na FRENTE do carro com ele andando (> 1 m/s agora há pouco) → −50 ⭐ + aviso; 1× a cada 8 s por pessoa
      vRec = Math.max(Math.abs(v), vRec * Math.exp(-dt * 4));
      {
        const fx = Math.sin(c.heading), fz = Math.cos(c.heading), sg = v < -0.1 ? -1 : 1;   // de ré: a "frente" é a traseira
        const gente = [...pedestres.map(p => ({ id: p.id, x: p.x, z: p.z, quem: p.crianca ? 'crianca' : 'pedestre' })),
          ...(mundo.travessias || []).filter(o => o.tipo !== 'bola').map(o => ({ id: o.id, x: o.x, z: o.z, quem: o.tipo })),
          ...(mundo.bicicletas || []).map(b => ({ id: b.id, x: b.x, z: b.z, quem: 'ciclista' }))];
        for (const g of gente) {
          const s = ((g.x - c.x) * fx + (g.z - c.z) * fz) * sg, w = Math.abs(-(g.x - c.x) * fz + (g.z - c.z) * fx);
          if (s > 0 && s < 2.6 && w < 1.3 && vRec > 1 && t - (atropT.get(g.id) ?? -99) > 8) {
            atropT.set(g.id, t);
            const info = lei.ATROPELAMENTO, pontos = lei.PONTOS_JOGO.atropelou;
            const e = { tipo: 'aviso', motivo: 'atropelou', quem: g.quem, pontos, dica: info.dica, artigo: info.regra, crime: info.crime, x: c.x, z: c.z, t };
            estrelas += pontos; atropelamentos.push(e); out.push(e);
          }
        }
      }
      // ---- ultrapassagem na ponte (spec 040, art. 32 / art. 203 III): o jogador passa à frente de um veículo lento
      // (o trator) que vai no mesmo sentido. Se isso acontece na ponte (ou com o trator nela) → −20 ⭐ + dica, 1× por
      // veículo. Se ele segue atrás pela ponte inteira e só passa depois → +15 ⭐ (esperou a ponte acabar).
      for (const o of mundo.tratores || []) {
        let k = lentos.get(o.id);
        if (!k) lentos.set(o.id, k = { rel: null, julgado: false, seguiuNaPonte: false, saiuDaPonte: false });
        const fx = Math.sin(o.heading), fz = Math.cos(o.heading);
        const rel = (c.x - o.x) * fx + (c.z - o.z) * fz, lat = Math.abs(-(c.x - o.x) * fz + (c.z - o.z) * fx);
        const mesmoSentido = Math.cos(c.heading - o.heading) > 0.5;
        const tratorNaPonte = !!naPonteF(o.x, o.z, 2);
        if (tratorNaPonte && rel < 0 && rel > -45 && lat < 6 && mesmoSentido) k.seguiuNaPonte = true;
        if (!k.julgado && k.rel !== null && k.rel < -2 && rel >= -2 && rel < 6 && lat < 7 && mesmoSentido && o.naPista !== false) {
          k.julgado = true;
          if (naPonteF(c.x, c.z, 3) || tratorNaPonte) {
            const info = lei.ULTRAPASSAR, pontos = lei.PONTOS_JOGO.ultrapassouPonte;
            const e = { tipo: 'aviso', motivo: 'ultrapassou_ponte', pontos, dica: info.dica, artigo: info.multaReal.artigo, x: c.x, z: c.z, t };
            estrelas += pontos; ultrapassagens.push(e); out.push(e);
          }
        }
        if (k.seguiuNaPonte && !k.julgado && !tratorNaPonte && !k.saiuDaPonte) {
          k.saiuDaPonte = true; acerto(out, 'esperouPonte', c, t, o.id);
        }
        k.rel = rel;
      }
      // ---- saída da garagem (spec 036, art. 36): ao passar da rampa para a rua (cruzar a borda da calçada), se um carro
      // vem pela rua a < 25 m (vindo na direção da garagem) = não deu preferência; senão acerto. 1× por viagem.
      const G = bairro.garagem;
      if (G && !saiuGaragem && prev && prev.z >= G.z0 && c.z < G.z0 && c.x > G.x0 - 1 && c.x < G.x1 + 1) {
        saiuGaragem = true;
        const vem = carros.some(o => Math.abs(o.z - (G.z0 - 5)) < 6 && Math.abs(o.x - c.x) < 25 && (o.v ?? 1) > 0.5
          && Math.sign(Math.sin(o.heading ?? 0)) === Math.sign(c.x - o.x));
        if (vem) {
          const info = lei.GARAGEM_REGRA, pontos = lei.PONTOS_JOGO.garagemPreferencia;
          const e = { tipo: 'aviso', motivo: 'garagem_preferencia', pontos, dica: info.dica, artigo: info.regra, temMulta: false, x: c.x, z: c.z, t };
          estrelas += pontos; garagem.push(e); out.push(e);
        } else acerto(out, 'saiuGaragem', c, t, 'garagem');
      }
      // ---- contramão em rua de mão única (spec 034, art. 186 II): só nas ruas retas de mão única (a rótula fica de fora)
      {
        const nr = naRua(c.x, c.z, c.heading);
        const contra = v > PARADO * 3 && nr && nr.lado === 'contramao' && maoDupla[nr.rua] === false && nr.rua !== 'rotula';
        contraT = contra ? contraT + dt : 0;
        if (contraT >= CONTRA_T && t - contraAviso >= CONTRA_REPETE) {
          contraAviso = t;
          const info = lei.CONTRAMAO, pontos = lei.PONTOS_JOGO.contramaoUnica;
          const e = { tipo: 'aviso', motivo: 'contramao_unica', rua: nr.rua, pontos, dica: info.dica, artigo: info.multaReal.artigo, x: c.x, z: c.z, t };
          estrelas += pontos; contramaos.push(e); out.push(e);
        }
      }
      // ---- estacionamento (spec 034): parado 1,5 s dentro de uma vaga e alinhado com ela (de frente ou de ré).
      // Vaga de idoso/PcD → aviso (art. 181 XX); vaga comum → acerto + evento "estacionou" (a missão do centro termina).
      {
        // o carro (1,7 × 3,4 m) tem de estar INTEIRO dentro da vaga (2,8 × 5 m), com folga de 15 cm, e alinhado (≤ 15°)
        // spec 063: a vaga pode ser comprida em x (rua leste–oeste) ou em z — o carro deitado junto (antes só valia em z)
        const dentroVaga = g => { const emX = g.x1 - g.x0 > g.z1 - g.z0, lx = emX ? CARRO_C : CARRO_L, lz = emX ? CARRO_L : CARRO_C;
          return Math.abs(c.x - (g.x0 + g.x1) / 2) <= (g.x1 - g.x0 - lx) / 2 + 0.15 && Math.abs(c.z - (g.z0 + g.z1) / 2) <= (g.z1 - g.z0 - lz) / 2 + 0.15; };
        const vg = Math.abs(v) < 0.2 ? (bairro.vagas || []).find(g => !g.ocupada && Math.abs(Math.cos(c.heading - g.heading)) > 0.966 && dentroVaga(g)) : null;
        paradoVaga = vg ? paradoVaga + dt : 0;
        if (!vg) vagaJulgada = null;
        if (vg && paradoVaga >= VAGA_T && vagaJulgada !== vg.id) {
          vagaJulgada = vg.id;
          if (vg.tipo === 'lateral') {         // spec 042: vaga na rua — de frente para o sentido da rua e colado no meio-fio
            const mf = vg.meioFio;                                                             // spec 043: { eixo, v }
            const folga = Math.abs(c[mf.eixo] - mf.v) - CARRO_L / 2;
            if (Math.cos(c.heading - vg.heading) < 0) avisoRua(out, c, t, 'contramao');
            else if (folga > 1) avisoRua(out, c, t, 'muitoAfastado');
            else if (folga > lei.ESTACIONAR_RUA.meioFio) avisoRua(out, c, t, 'afastado');
            else if (estacionou !== vg.id) {   // spec 063: avisa a cada vaga nova (a missão termina na vaga perto do destino)
              if (t - estacionouT >= 30) { acerto(out, 'balizaCerta', c, t, vg.id); estacionouT = t; }   // ⭐ no máx. 1× a cada 30 s
              estacionou = vg.id;
              out.push({ tipo: 'estacionou', vaga: vg.id, tipoVaga: 'lateral', folga: +folga.toFixed(2), x: c.x, z: c.z, t });
            }
          } else if (vg.tipo !== 'comum') {
            const info = lei.VAGA, pontos = lei.PONTOS_JOGO.vagaReservada;
            const e = { tipo: 'aviso', motivo: 'vaga_reservada', vaga: vg.id, tipoVaga: vg.tipo, pontos, dica: info.dica, artigo: info.multaReal.artigo, x: c.x, z: c.z, t };
            estrelas += pontos; vagasErradas.push(e); out.push(e);
          } else if (estacionou !== vg.id) {
            if (t - estacionouT >= 30) { acerto(out, 'estacionouCerto', c, t, vg.id); estacionouT = t; }
            estacionou = vg.id;
            out.push({ tipo: 'estacionou', vaga: vg.id, tipoVaga: vg.tipo, x: c.x, z: c.z, t });
          }
        }
        // ---- spec 042: parado 3 s ENCOSTADO no meio-fio (até 1 m dele), fora de vaga = estacionou na rua. Julga 1× por
        // parada: contramão (XV), esquina a < 5 m (I), guia rebaixada da garagem (IX), 50 cm a 1 m do meio-fio (II).
        const nr = !vg && Math.abs(v) < 0.2 ? naRua(c.x, c.z, c.heading) : null;
        const folgaRua = nr ? largura[nr.rua] / 2 - nr.dist - CARRO_L / 2 : Infinity;
        const encostado = nr && nr.rua !== 'rotula' && !bairro.ruas.find(r => r.id === nr.rua)?.estrada && folgaRua <= 1;
        paradoRua = encostado ? paradoRua + dt : 0;
        if (Math.abs(v) > 0.5) ruaJulgada = false;
        if (encostado && paradoRua >= 3 && !ruaJulgada) {
          ruaJulgada = true;
          const G = bairro.garagem;
          if (nr.lado === 'contramao') avisoRua(out, c, t, 'contramao');
          else if (bairro.nos.some(n => Math.hypot(n.x - c.x, n.z - c.z) < (n.z === 0 ? 6 : 5) + 5 + CARRO_C / 2)) avisoRua(out, c, t, 'esquina');
          else if (G && c.x > G.x0 - 1.5 && c.x < G.x1 + 1.5 && c.z > 168) avisoRua(out, c, t, 'guia');
          else if (folgaRua > lei.ESTACIONAR_RUA.meioFio) avisoRua(out, c, t, 'afastado');
        }
        // ---- spec 042: fila dupla (XI) — parado 8 s na pista AO LADO de um carro estacionado, sem ninguém na frente,
        // longe de linha de parada (semáforo/PARE), de faixa de pedestre e sem ambulância/travessia por perto (spec 043)
        const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
        const aoLado = !vg && !encostado && Math.abs(v) < 0.2 && parados.some(p => {
          const s = (p.x - c.x) * fx + (p.z - c.z) * fz, w = Math.abs(-(p.x - c.x) * fz + (p.z - c.z) * fx);
          return Math.abs(s) < 3 && w > 2 && w < 4.6;
        }) && !carros.some(o => { const s = (o.x - c.x) * fx + (o.z - c.z) * fz, w = Math.abs(-(o.x - c.x) * fz + (o.z - c.z) * fx); return s > 0 && s < 12 && w < 2; })
          && !linhas.some(l => Math.hypot(l.L.x - c.x, l.L.z - c.z) < 30) && !bairro.faixas.some(f => Math.hypot(f.x - c.x, f.z - c.z) < 25)
          && !(mundo.ambulancias || []).some(a => Math.hypot(a.x - c.x, a.z - c.z) < 80) && !(mundo.travessias || []).some(o => Math.hypot(o.x - c.x, o.z - c.z) < 40);
        paradoDupla = aoLado ? paradoDupla + dt : 0;
        if (Math.abs(v) > 0.5) duplaJulgada = false;
        if (aoLado && paradoDupla >= 8 && !duplaJulgada) { duplaJulgada = true; avisoRua(out, c, t, 'filaDupla'); }
      }
      // ---- cinto (spec 018): ao começar a andar (> 5 km/h) com cinto = acerto 1×; sem cinto = aviso (−⭐) e, andando
      // sem cinto, de novo a cada CINTO_REPETE s. Nunca multa (não há agente vendo).
      if (julgaCinto && v > CINTO_V) {
        if (mundo.cinto) { if (!cintoJulgado) { cintoJulgado = true; acerto(out, 'cintoCerto', c, t, 'cinto'); } }
        else if (semCintoT === null || t - semCintoT >= CINTO_REPETE) {
          cintoJulgado = true; semCintoT = t;
          const pontos = lei.PONTOS_JOGO.semCinto, info = lei.CINTO;
          const e = { tipo: 'aviso', motivo: 'sem_cinto', pontos, dica: info.dica, artigo: info.multaReal.artigo, x: c.x, z: c.z, t };
          estrelas += pontos; semCinto.push(e); out.push(e);
        }
      }
      // ---- seta (spec 007): a seta do lado certo ligada desde ≥ 30 m antes e mantida até o ponto da conversão
      if (CV) julgaSeta(out, mundo.seta ?? null, c, t);
      if (quase && t - quase.t >= SAIU_PARE) { out.push({ tipo: 'aviso', motivo: 'quase', ref: quase.ref, x: c.x, z: c.z, t }); quase = null; }

      // ---- acima do limite sem radar: não multa, tira ⭐ e avisa
      const lim = limiteEm(c.x, c.z, c.heading);
      if (kmh > lim) {
        const vigiado = radares.some(R => {
          const p = local(R.r, R.r.heading, c.x, c.z);
          return Math.abs(p.w) <= R.meia && p.s >= -ZONA_RADAR && p.s <= 5
            && Math.sin(c.heading) * Math.sin(R.r.heading) + Math.cos(c.heading) * Math.cos(R.r.heading) > 0;
        });
        if (!vigiado) {
          estrelas -= ESTRELAS_POR_SEG * dt;
          if (t - ultimoAviso >= AVISO_INTERVALO - 1e-9) {
            ultimoAviso = t;
            out.push({ tipo: 'aviso', motivo: 'acima_limite', kmh, limite: lim, x: c.x, z: c.z, t });
          }
        }
      }

      // ---- odômetro de estrelas: +1 ⭐ a cada 10 m dentro do limite, na mão certa, limpo há 5 s
      if (odometro && v > PARADO && kmh <= lim && t - tErro >= ODO_LIMPO) {
        const nr = naRua(c.x, c.z, c.heading);
        if (nr && nr.lado === 'direita') {
          odAcc += Math.hypot(c.x - prev.x, c.z - prev.z);
          while (odAcc >= ODO_METROS) {
            odAcc -= ODO_METROS; seq++; odEstrelas++; estrelas += lei.PONTOS_JOGO.odometro;
            out.push({ tipo: 'odometro', pontos: lei.PONTOS_JOGO.odometro, sequencia: seq, x: c.x, z: c.z, t });
          }
        }
      }
    }
    if (CV) { if ((mundo.seta ?? null) !== setaAnt) setaIni = mundo.seta ? sRota : null; else if (mundo.seta && setaIni === null) setaIni = sRota; setaAnt = mundo.seta ?? null; }
    prev = { x: c.x, z: c.z };
    pedPrev = new Map(pedestres.map((p, i) => [p.id ?? i, { x: p.x, z: p.z }]));
    return out;
  }

  // posição do carro ao longo da rota (s, m) ou null se ele não está nela (> NA_ROTA m)
  function naRota(x, z) {
    const P = CV.P, d2 = i => (P[i].x - x) ** 2 + (P[i].z - z) ** 2;
    let best = CV.idx, bd = Infinity;
    for (let i = Math.max(0, CV.idx - 10); i < Math.min(P.length, CV.idx + 40); i++) { const d = d2(i); if (d < bd) { bd = d; best = i; } }
    if (bd > NA_ROTA * NA_ROTA) for (let i = 0; i < P.length; i++) { const d = d2(i); if (d < bd) { bd = d; best = i; } }
    if (bd > NA_ROTA * NA_ROTA) return null;
    CV.idx = best;
    const p = P[best];
    return p.s + (x - p.x) * Math.sin(p.h) + (z - p.z) * Math.cos(p.h);
  }
  function julgaSeta(out, seta, c, t) {
    proxConv = null;
    if (sRota === null) { for (const k of CV.lista) k.pend = null; return; }   // saiu da rota: nada a julgar
    for (const k of CV.lista) {
      if (k.julgada && sRota < k.s - REARMA_CONV) { k.julgada = false; k.pend = null; }
      // passou o meio da curva: anota se a seta estava certa, mas só julga quando o carro VIRAR de fato (rumo
      // alinhado com a saída; na rótula, já fora do anel). Seguiu reto / outra rua → saiu da rota → não julga.
      if (!k.julgada && sRotaAnt !== null && sRotaAnt < k.s && sRota >= k.s) {
        k.julgada = true;
        k.pend = { t, ok: seta === k.lado && setaIni !== null && setaIni <= k.s - SETA_ANTES, seta };
      }
      if (k.pend) {
        const virou = Math.abs(wrapA(c.heading - k.hSaida)) < VIROU_RAD &&
          (!k.rotula || !ROT || Math.hypot(c.x - ROT.x, c.z - ROT.z) > ROT.externo);
        if (!virou) { if (t - k.pend.t > PEND_MAX_S) k.pend = null; continue; }
        const { ok, seta: s0 } = k.pend; k.pend = null;
        if (ok) acerto(out, 'setaCerta', c, t, k.id);
        else {
          const seta = s0;
          const pontos = lei.PONTOS_JOGO.semSeta, info = lei.SETA;
          const e = { tipo: 'aviso', motivo: 'sem_seta', ref: k.id, lado: k.lado, seta, pontos, dica: info.dica,
            artigo: info.multaReal.artigo, x: c.x, z: c.z, t };
          estrelas += pontos; semSeta.push(e); out.push(e);
        }
      }
      if (!proxConv && !k.julgada && k.s >= sRota) proxConv = { id: k.id, lado: k.lado, d: k.s - sRota, hSaida: k.hSaida, saida: k.saida };
    }
  }

  function estado() {
    return {
      estrelas: r2(estrelas), pontosCnh, dinheiro: r2(dinheiro),
      infracoes: infracoes.slice(), acertos: acertos.slice(), batidas: batidas.slice(),
      odometro: odEstrelas, sequencia: seq, pare: cruz ? { ...cruz } : null,
      semSeta: semSeta.slice(), semCinto: semCinto.slice(), bikePerto: bikePerto.slice(), semPassagem: semPassagem.slice(), naoReduziu: naoReduziu.slice(), buzinadas: buzinadas.slice(), chuvaRapido: chuvaRapido.slice(), contramaos: contramaos.slice(), vagasErradas: vagasErradas.slice(), garagem: garagem.slice(), ultrapassagens: ultrapassagens.slice(), atropelamentos: atropelamentos.slice(), estacionouErrado: estacionouErrado.slice(), estacionou, conversao: proxConv ? { ...proxConv } : null, sRota,
      suspensao: lei.suspensao(infracoes.map(e => e.id)),
    };
  }

  // GPS recalculou a rota: as conversões passam a ser as da rota nova (⭐ e o resto do estado continuam)
  function trocarConversoes(cv) { CV = cv ? novoCV(cv) : null; sRota = sRotaAnt = setaIni = proxConv = null; }

  return { tick, estado, trocarConversoes };
}
