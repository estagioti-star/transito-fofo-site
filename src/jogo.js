// Jogo de trânsito — spec 004: o bairro em 3D com trânsito vivo, o fiscal julgando cada passo, missão e relatório.
// Laço de física fixo (STEP = 1/120) + relógio real (realDt), câmera atrás, volante de 1 polegar — do Martina Kart.
import * as THREE from '../vendor/three.module.js';
import { BAIRRO, MISSOES, limiteEm, podeAndar, faseSemaforo, rotaAte, naRua, naPonte } from './bairro.js';
import { criarProgresso, MEDALHA_TXT } from './progresso.js';
import { criarMundo, criarAtores, criarMarcador, criarPow, criarSetasRota, canvasTex, criarVivosMesh, criarCarrosPatio } from './mundo.js';
import { criarVivos } from './vivos.js';
import { novoCarro, stepCar, syncMesh, FIS, MODELOS } from './carro.js';
import { criarSons } from './sons.js';
import { wheelSVG } from './volante.js';
import { criarFiscal, calcularConversoes } from './fiscal.js';
import { criarTransito, eventosDoCaminho, local } from './transito.js';
import { criarHud } from './hud.js';
import { criarPedais } from './pedais.js';
import { PONTOS_JOGO } from './lei.js';
import { fotoDoRadar, quandoAgora } from './foto.js';

const Q = new URLSearchParams(location.search);
const CAPTURE = Q.has('capture');      // passo a passo controlado de fora (testes)
const AUTO = Q.has('auto');            // piloto automático segue a rota da missão
const ERRADO = Q.get('auto') === 'errado';   // ?auto=errado: fura o 1º semáforo e o 1º PARE, radar a 80, ignora o pedestre da farmácia
const SHOW_FPS = Q.has('fps') || CAPTURE;
// spec 032 (pedido do Maki): o modo "pedais" (o carro vira sozinho e o jogador só acelera) saiu do jogo — o jogador
// sempre dirige com o volante. `?controle=pedais` fica só para os testes antigos da física do pedal.
// spec 041 (junta com a versão do site): Volante (padrão) ou Pedais (o carro vira sozinho na rota) e Toque ou Teclado.
// ?controle= / ?aparelho= forçam; senão a última escolha do menu; senão o padrão (nos testes ?capture: volante e toque).
const lsLer = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsGravar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem storage: só não lembra */ } };
const LS_APARELHO = 'transitoFofo.aparelho';
const MODOS = ['volante', 'pedais'], APARELHOS = ['toque', 'pc'];
const detectaAparelho = () => (!matchMedia('(any-pointer: coarse)').matches && !(navigator.maxTouchPoints > 0) && innerWidth >= 700) ? 'pc' : 'toque';
const escolha = (q, k, lista, padrao) => lista.includes(Q.get(q)) ? Q.get(q) : (!Q.has('capture') && lista.includes(lsLer(k)) ? lsLer(k) : padrao());
// spec 048 (Maki, 20/10/2026: "tire essa opção dele andar sozinho"): sem a escolha Pedais no menu — sempre volante.
// (?controle=pedais continua só para os testes antigos da direção automática)
let CONTROLE = MODOS.includes(Q.get('controle')) ? Q.get('controle') : 'volante';
let APARELHO = escolha('aparelho', LS_APARELHO, APARELHOS, () => (Q.has('capture') ? 'toque' : detectaAparelho()));
const $ = id => document.getElementById(id);
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// ---------------------------------------------------------------------------------------------------------------
// Renderizador / cena
// ---------------------------------------------------------------------------------------------------------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 1.5 && Q.get('aa') !== '0',   // tela densa não precisa de MSAA (custa ~1/3 do quadro)
  powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
renderer.setPixelRatio(pixelRatio);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.4, 1200);
const hemi = new THREE.HemisphereLight(0xe6f4ff, 0x6f9a4a, 1.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
sun.position.set(60, 120, -40);
scene.add(sun);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 92 : 70;     // celular em pé: grande angular
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const mundo = criarMundo(scene, BAIRRO);
// spec 021: missão escolhida no menu (?missao=id força; no ?capture sem ?missao é sempre a da vovó, para os testes)
const LS_MISSAO = 'transitoFofo.missao';
const missaoPorId = id => MISSOES.find(m => m.id === id) || null;
let M = missaoPorId(Q.get('missao')) || (CAPTURE ? null : (() => { try { return missaoPorId(localStorage.getItem(LS_MISSAO)); } catch { return null; } })()) || MISSOES[0];
// spec 035: tempo escolhido no menu (☀️ sol, 🌧️ chuva, 🌫️ neblina). A missão "Escola na chuva" sempre chove.
// ?tempo=… força; no ?capture o padrão é sol (testes); senão a última escolha.
const TEMPOS = ['sol', 'chuva', 'neblina'];
let TEMPO = TEMPOS.includes(Q.get('tempo')) ? Q.get('tempo') : CAPTURE ? 'sol' : (() => { try { return TEMPOS.includes(localStorage.getItem('transitoFofo.tempo')) ? localStorage.getItem('transitoFofo.tempo') : 'sol'; } catch { return 'sol'; } })();
const climaDe = m => (m.chuva ? 'chuva' : TEMPO);
const progresso = criarProgresso((() => { try { return localStorage; } catch { return null; } })());
let cnhBase = progresso.cnh().pontos;   // pontos que a carteirinha já tinha ao sair (o placar mostra base + viagem)
// spec 036: o jogo começa DENTRO da garagem da casa da vovó (no ?capture só com ?garagem — testes antigos começam na rua).
// A rota da missão ganha o trecho da saída (rampa + curva à direita): o GPS pede a seta (art. 196) como numa curva.
const USA_GARAGEM = !CAPTURE || Q.has('garagem');
const largada = m => (USA_GARAGEM ? BAIRRO.garagem.carro : m.origem);
function rotaDe(m) {
  if (!USA_GARAGEM) return m.rota;
  const G = BAIRRO.garagem.carro, i = m.rota.findIndex(p => p[0] >= 34 && Math.abs(p[1] - 172.5) < 0.8);
  return i < 0 ? m.rota : [[G.x, G.z], [G.x, 177], [28.3, 174.2], [30.5, 172.8], ...m.rota.slice(i)];
}
const carro = novoCarro(scene, largada(M));
if (ERRADO) carro.fis = { ...FIS, ACC: 22, VMAX: 120 / 3.6 };     // turbo de teste: chegar a 80 km/h nos 50 m antes do radar
const sons = criarSons();
const transito = criarTransito();
const atores = criarAtores(scene, transito);
// alfinete do destino; na missão de estacionar fica no meio do pátio (a entrada é só o fim da rota do GPS)
const ondeMarcador = m => (m.estacionar === true ? { x: (BAIRRO.estacionamento.x0 + BAIRRO.estacionamento.x1) / 2, z: (BAIRRO.estacionamento.z0 + BAIRRO.estacionamento.z1) / 2 } : m.destino);
const marcador = criarMarcador(scene, ondeMarcador(M).x, ondeMarcador(M).z);
const setasRota = criarSetasRota(scene, BAIRRO);      // setas no asfalto + placa flutuante na próxima conversão
// specs 023/024: bicicleta e ambulância da missão (andam ao longo da rota dela)
const vivosMesh = criarVivosMesh(scene);
// spec 035: estacionamento com carros de verdade — os parados nas vagas e 2 dando a volta devagar pelo corredor do pátio
// (param se o jogador estiver na frente; são sólidos)
const patio = (() => {
  const E = BAIRRO.estacionamento;
  if (!E) return { carros: [], passo() {}, ocupa: () => false };
  const parados = BAIRRO.predios.filter(p => p.tipo === 'carroParado').map(p => ({ x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2, heading: p.heading, cor: p.cor }));
  const zA = (E.z0 + E.z1) / 2 - 4, zB = (E.z0 + E.z1) / 2 + 4, xA = E.x0 + 12, xB = E.x1 - 6;   // volta no corredor (sentido anti-horário)
  const P = [[xA, zB], [xB, zB], [xB, zA], [xA, zA]], seg = [];
  let L = 0; for (let i = 0; i < 4; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % 4], l = Math.hypot(bx - ax, bz - az); seg.push({ ax, az, bx, bz, l, s0: L }); L += l; }
  const em = s => { s = ((s % L) + L) % L; const g = seg.find(k => s < k.s0 + k.l) || seg[3], k = (s - g.s0) / g.l;
    return { x: g.ax + (g.bx - g.ax) * k, z: g.az + (g.bz - g.az) * k, heading: Math.atan2(g.bx - g.ax, g.bz - g.az) }; };
  const carros = [{ s: 0 }, { s: L / 2 }].map(c => ({ ...c, ...em(c.s) }));
  const mesh = criarCarrosPatio(scene, parados, carros.length);
  return {
    carros,
    passo(dt, jog) {
      for (const c of carros) {
        const fx = Math.sin(c.heading), fz = Math.cos(c.heading), dx = jog.x - c.x, dz = jog.z - c.z;
        const frente = dx * fx + dz * fz, lado = Math.abs(-dx * fz + dz * fx);
        if (!(frente > 0 && frente < 7 && lado < 2.5)) c.s += 2.2 * dt;        // o jogador na frente: espera
        Object.assign(c, em(c.s));
      }
      mesh.sync(carros);
    },
    ocupa(x, z) { return carros.some(c => { const fx = Math.sin(c.heading), fz = Math.cos(c.heading), dx = x - c.x, dz = z - c.z;
      return Math.abs(dx * fx + dz * fz) < 2.4 && Math.abs(-dx * fz + dz * fx) < 1.3; }); },
  };
})();
let vivos = criarVivos(rotaDe(M), M.vivos || {}), ambAvisou = false;
// spec 006: a viagem começa com ⭐ 50 e o odômetro de estrelas ligado (+1 ⭐ a cada 10 m andando certo)
// spec 007: as conversões da rota (seta) — o fiscal julga a seta em cada uma
let CONV = calcularConversoes(rotaDe(M), BAIRRO.rotula);     // muda quando o GPS recalcula a rota
const novoFiscal = () => criarFiscal({ estrelasIniciais: 50, odometro: true, conversoes: CONV, cinto: true, clima: climaDe(M) === 'sol' ? null : climaDe(M) });
let fiscal = novoFiscal();
setasRota.definir(CONV);
const hud = criarHud();
const pow = criarPow(scene);
const jogadorTransito = () => ({ x: carro.pos.x, z: carro.pos.z, heading: carro.heading, v: Math.max(0, carro.speed) });
// o jogador não atravessa os carros IA (só bloqueia quem está entrando num carro, nunca prende quem já encostou)
let barrouMuro = false;      // o último "não pode" foi prédio/calçada (e não um carro IA)?
const podeAndarJogador = (x, z) => {
  if (!podeAndar(x, z)) { barrouMuro = true; return false; }
  if (transito.ocupado(x, z) && !transito.ocupado(carro.pos.x, carro.pos.z)) { barrouMuro = false; return false; }
  // spec 050: quem está a pé é sólido para o carro INTEIRO (antes só o centro do carro contava e ele passava por dentro
  // do pedestre): pedestres e crianças da faixa, cachorro e criança das travessias (a bola não)
  const fx = Math.sin(carro.heading), fz = Math.cos(carro.heading), noCarro = (px, pz) => {
    const dx = px - x, dz = pz - z; return Math.abs(dx * fx + dz * fz) < 2.0 && Math.abs(-dx * fz + dz * fx) < 1.2; };
  for (const p of transito.pedestres) if (p.estado !== 'fora' && noCarro(p.x, p.z)) { barrouMuro = false; return false; }
  for (const o of vivos.lista().travessias) if (o.tipo !== 'bola' && noCarro(o.x, o.z)) { barrouMuro = false; return false; }
  if (patio.ocupa(x, z)) { barrouMuro = false; return false; }      // spec 035: carros andando no estacionamento
  // spec 040: o trator também é sólido (2,6 m de meia-largura de comprimento, 1,4 de meia-largura com folga)
  for (const o of vivos.lista().tratores) {
    const fx = Math.sin(o.heading), fz = Math.cos(o.heading), dx = x - o.x, dz = z - o.z;
    if (Math.abs(dx * fx + dz * fz) < 3.6 && Math.abs(-dx * fz + dz * fx) < 1.9) { barrouMuro = false; return false; }
  }
  // spec 024: a bicicleta também é sólida (o carro não passa por dentro dela)
  for (const b of vivos.lista().bicicletas) {
    const fx = Math.sin(b.heading), fz = Math.cos(b.heading), dx = x - b.x, dz = z - b.z;
    if (Math.abs(dx * fx + dz * fz) < 2.6 && Math.abs(-dx * fz + dz * fx) < 1.25) { barrouMuro = false; return false; }
  }
  return true;
};
carro.batidasMuro = 0;

// ---------------------------------------------------------------------------------------------------------------
// Piloto automático (?auto ou ?auto=certo): segue missao.rota pela mão direita e OBEDECE: 90% do limite, para no
// vermelho e no PARE, espera o pedestre, cede na rótula, não encosta no carro da frente.
// ?auto=errado: obedece tudo, menos 4 coisas de propósito (fura o 1º semáforo no vermelho, não para no 1º PARE,
// passa no radar a 82 km/h e não espera o pedestre da faixa da farmácia) — para o teste ver o fiscal multar.
// ---------------------------------------------------------------------------------------------------------------
function criarPiloto(R) {          // R = pontos da rota (missao.rota ou a que o GPS recalculou)
  const P = [];
  for (let i = 0; i < R.length - 1; i++) {
    const [ax, az] = R[i], [bx, bz] = R[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L));
    for (let k = 0; k < n; k++) P.push({ x: ax + (bx - ax) * k / n, z: az + (bz - az) * k / n });
  }
  P.push({ x: R.at(-1)[0], z: R.at(-1)[1] });
  let s = 0;
  P.forEach((p, i) => { if (i) s += Math.hypot(p.x - P[i - 1].x, p.z - P[i - 1].z); p.s = s; const q = P[Math.min(P.length - 1, i + 1)], o = P[Math.max(0, i - (i === P.length - 1 ? 1 : 0))]; p.h = Math.atan2(q.x - o.x, q.z - o.z); });
  const ALAT = 3.0, DEC = 3.5, W = 3, FATOR = ERRADO ? 1 : climaDe(M) !== 'sol' ? 0.6 : 0.9;   // chuva/neblina: piloto bem mais devagar
  P.forEach((p, i) => {
    const a = P[Math.max(0, i - W)], b = P[Math.min(P.length - 1, i + W)];
    const k = Math.abs(wrap(b.h - a.h)) / Math.max(1, b.s - a.s);
    p.v = Math.min(limiteEm(p.x, p.z, p.h) * FATOR / 3.6, k > 1e-4 ? Math.sqrt(ALAT / k) : 99);
  });
  // teto de curva (modo pedais): só a curvatura, sem limite da via nem paradas; freia antes com PEDAL.CURVA
  P.forEach((p, i) => {
    const a = P[Math.max(0, i - W)], b = P[Math.min(P.length - 1, i + W)];
    const k = Math.abs(wrap(b.h - a.h)) / Math.max(1, b.s - a.s);
    p.vc = k > 1e-4 ? Math.sqrt(ALAT / k) : 99;
  });
  for (let i = P.length - 2; i >= 0; i--) P[i].vc = Math.min(P[i].vc, Math.sqrt(P[i + 1].vc ** 2 + 2 * 3.0 * (P[i + 1].s - P[i].s)));
  P.at(-1).v = 0;
  for (let i = P.length - 2; i >= 0; i--) P[i].v = Math.min(P[i].v, Math.sqrt(P[i + 1].v ** 2 + 2 * DEC * (P[i + 1].s - P[i].s)));
  const cam = { P, N: P.length, L: P.at(-1).s, fechado: false };
  const eventos = eventosDoCaminho(cam);
  const sem1 = eventos.find(e => e.tipo === 'semaforo'), pare1 = eventos.find(e => e.tipo === 'pare');
  // radar: onde a rota cruza a linha dele
  const rd = BAIRRO.radares[0];
  let sRadar = null;
  for (let i = 0; i < P.length - 1 && sRadar === null; i++) { const a = local(rd, rd.heading, P[i].x, P[i].z), b = local(rd, rd.heading, P[i + 1].x, P[i + 1].z); if (a.s < 0 && b.s >= 0 && Math.abs(b.w) < 4) sRadar = P[i + 1].s; }
  if (ERRADO && sRadar !== null) for (const p of P) if (p.s > sRadar - 60 && p.s <= sRadar + 2 && Math.abs(wrap(p.h - rd.heading)) < 0.15) p.v = 82 / 3.6;
  const piloto_sRadar = sRadar;
  let idx = 0, mem = {};
  function input(c) {
    let best = idx, bd = Infinity;
    for (let i = idx; i < Math.min(P.length, idx + 40); i++) { const d = (P[i].x - c.pos.x) ** 2 + (P[i].z - c.pos.z) ** 2; if (d < bd) { bd = d; best = i; } }
    if (bd > 400) for (let i = 0; i < P.length; i++) { const d = (P[i].x - c.pos.x) ** 2 + (P[i].z - c.pos.z) ** 2; if (d < bd) { bd = d; best = i; } }   // longe da rota (carro reposto): procura em tudo
    idx = best;
    const v = Math.max(0, c.speed);
    const Ld = Math.max(4, v * 0.8);
    let j = idx; while (j < P.length - 1 && P[j].s - P[idx].s < Ld) j++;
    const alpha = wrap(Math.atan2(P[j].x - c.pos.x, P[j].z - c.pos.z) - c.heading);
    const F = c.fis || FIS;
    const yawMax = Math.min(F.VOLANTE_MAX * Math.min(1, v / 3), F.A_LAT / Math.max(v, 1));
    let steer = yawMax > 0.05 ? (2 * v * Math.sin(alpha) / Ld) / yawMax : Math.sign(alpha) * Math.min(1, Math.abs(alpha) * 2);
    steer = Math.max(-1, Math.min(1, steer));
    // ---- regras: onde tenho de parar?
    const sAqui = P[idx].s + ((c.pos.x - P[idx].x) * Math.sin(P[idx].h) + (c.pos.z - P[idx].z) * Math.cos(P[idx].h));
    let pare = Infinity;
    const parar = d => { pare = Math.min(pare, Math.max(0, d)); };
    const AD = c.aderencia ?? 1;                                   // spec 029: na chuva o freio rende menos
    const consegue = (d, a = 5) => v * v / (2 * Math.max(d, 0.05)) <= a * AD || v < 0.6;
    const vs = transito.carros;
    for (const e of eventos) {
      const d = e.s - sAqui, m = mem[e.k] ||= {};
      if (d < -1 || d > 80) continue;
      if (e.tipo === 'semaforo') {
        const f = faseSemaforo(e.ref, t);
        if (ERRADO && e === sem1) {             // espera o vermelho (com folga) e passa nele
          if (f === 'vermelho' && faseSemaforo(e.ref, t + 4) === 'vermelho') m.vai = true;
          if (!m.vai) parar(d - 3);
          continue;
        }
        if (f === 'verde') { m.vai = false; continue; }
        if (m.vai) continue;
        if (ERRADO && piloto_sRadar !== null && sAqui < piloto_sRadar + 1 && e.s > piloto_sRadar) continue;   // acelera até o radar, freia depois
        if (d > 0.3 && consegue(d - 2, ERRADO ? 7.8 : 5)) parar(d - 2); else m.vai = true;
      } else if (e.tipo === 'pare') {
        if (ERRADO && e === pare1) continue;    // passa direto
        if (m.feito) continue;
        if (d < 9 && v < 0.2) m.parado = (m.parado || 0) + STEP;
        const lados = fiscal.estado().pare;          // spec 006: só sai com os dois lados livres (indicador ✅ ✅)
        // spec 041 (?auto=errado): com o PARE novo da rótula o relógio mudou — no PARE da Sabiá espera a avenida ficar
        // livre de carro IA até o semáforo e o verde dele chegar junto, para passar no radar a 82 sem frear por ninguém
        const esperaAv = ERRADO && e.ref === 'pare_sabia_av' && (vs.some(o => o.x > 95 && o.x < 200 && o.z > -7 && o.z < 0.5)
          || !['verde'].includes(faseSemaforo('sem_av_rua', t + 7)) || faseSemaforo('sem_av_rua', t + 10) !== 'verde');
        if (m.parado > 1.0 && !esperaAv && !vs.some(o => o.v > 0.5 && Math.hypot(o.x - e.no.x, o.z - e.no.z) < 16)
          && !(lados && (lados.esquerda || lados.direita))) { m.feito = true; continue; }
        parar(d - 2.5);
      } else if (e.tipo === 'faixa') {
        if (ERRADO && e.ref === 'faixa_farmacia') continue;
        if (d < 0.3) continue;
        if (transito.conflitoFaixa(e.ref) && consegue(d - 2, 7.5)) parar(d - 2);
      } else if (e.tipo === 'rotula') {
        if (m.vai || d > 35) continue;
        if (d < 2.5) { m.vai = true; continue; }
        if (transito.conflitoRotula(e.x, e.z, null, 24)) { if (consegue(d - 1.5)) parar(d - 1.5); else m.vai = true; }
      }
    }
    // carro IA na minha frente (na trilha): segue a uns 5,5 m centro a centro
    const alc = Math.min(45, 8 + v * v / 6 + v * 1.5);
    const lv = vivos.lista();                                     // spec 024: a bicicleta conta como "quem vai na frente"
    for (const o of [...vs, ...lv.bicicletas, ...lv.tratores]) {          // spec 040: segue o trator (não ultrapassa)
      if (Math.hypot(o.x - c.pos.x, o.z - c.pos.z) > alc + 3) continue;
      const mesmo = Math.abs(wrap(o.heading - c.heading)) < 1.0;
      for (let k = idx + 1; k < P.length && P[k].s - sAqui <= alc; k++) {
        if (Math.abs(P[k].x - o.x) < 1.9 && Math.abs(P[k].z - o.z) < 1.9) {
          const d = P[k].s - sAqui;
          if (mesmo || d < 9) parar(d - 5.5);
          break;
        }
      }
    }
    // specs 027/028: cachorro / bola / criança na pista à frente → para antes
    for (const o of lv.travessias) {
      const sRel = (o.x - c.pos.x) * Math.sin(c.heading) + (o.z - c.pos.z) * Math.cos(c.heading);
      const wRel = Math.abs(-(o.x - c.pos.x) * Math.cos(c.heading) + (o.z - c.pos.z) * Math.sin(c.heading));
      if (o.naPista && sRel > 0 && sRel < 35 && wRel < 6) parar(sRel - 5);
    }
    // spec 023: ambulância vindo atrás (a < 45 m) → para à direita até ela passar (art. 29 VII a)
    for (const a of lv.ambulancias) {
      const sRel = (a.x - c.pos.x) * Math.sin(c.heading) + (a.z - c.pos.z) * Math.cos(c.heading);
      if (sRel < 0 && sRel > -45) parar(0.3);
    }
    let alvo = chegou ? 0 : P[Math.min(P.length - 1, idx + 2)].v;
    if (pare < Infinity) alvo = Math.min(alvo, Math.sqrt(2 * 3 * Math.max(0, pare - 0.3)));
    const need = pare < Infinity ? v * v / (2 * Math.max(0.1, pare)) : 0;
    const err = alvo - c.speed;
    let gas = 0, brake = 0;
    if (chegou || (pare < 0.15 && v > 0.05)) brake = 1;
    else if (pare < Infinity && need > 2.5 * AD) brake = Math.min(1, need / (F.FREIO * AD) * 1.3);
    else if (err > 0.2) gas = Math.min(1, err * 0.6 + 0.25);
    else if (err < -0.5) brake = Math.min(1, -err * 0.35);
    if (pare < 0.15 && v <= 0.05) { gas = 0; brake = 1; }
    return { steer, gas, brake };
  }
  // modo pedais: só o volante do piloto (segue a rota) + o teto de curva à frente
  function direcao(c) { const steer = input(c).steer; return { steer, teto: P[Math.min(P.length - 1, idx + 2)].vc }; }
  return { input, direcao, get progresso() { return P[idx].s / P.at(-1).s; }, P, eventos, sRadar, reset() { idx = 0; mem = {}; } };
}
let piloto = criarPiloto(rotaDe(M));

// guia da missão (seta): ponto da rota uns 25 m à frente de onde o carro está
const guia = { idx: 0, d: 0 };      // d = distância (m) do carro à rota
function atualizaGuia() {
  const P = piloto.P, c = carro.pos;
  let best = guia.idx, bd = Infinity;
  for (let i = Math.max(0, guia.idx - 20); i < Math.min(P.length, guia.idx + 60); i++) { const d = (P[i].x - c.x) ** 2 + (P[i].z - c.z) ** 2; if (d < bd) { bd = d; best = i; } }
  if (bd > 400) for (let i = 0; i < P.length; i++) { const d = (P[i].x - c.x) ** 2 + (P[i].z - c.z) ** 2; if (d < bd) { bd = d; best = i; } }
  guia.idx = best; guia.d = Math.sqrt(bd);
  guia.s = P[best].s + ((c.x - P[best].x) * Math.sin(P[best].h) + (c.z - P[best].z) * Math.cos(P[best].h));
  let j = best; while (j < P.length - 1 && P[j].s - P[best].s < 25) j++;
  const rel = wrap(Math.atan2(P[j].x - c.x, P[j].z - c.z) - carro.heading);
  hud.rumo(rel, P.at(-1).s - P[best].s + Math.sqrt(bd));
  hud.proximo(proximoItens(P[best].s + ((c.x - P[best].x) * Math.sin(P[best].h) + (c.z - P[best].z) * Math.cos(P[best].h))));
}
// chip "próximo" (spec 006): o próximo item da rota a ≤ 120 m, com distância. Se ele não for semáforo/PARE e um
// semáforo/PARE vier logo depois (≤ 120 m), mostra os dois lado a lado (o que manda parar nunca fica escondido).
function proximoItens(sAqui) {
  const lista = ITENS.filter(i => i.s - sAqui > -0.5 && i.s - sAqui <= 120);
  if (!lista.length) return [];
  const out = [chipDe(lista[0], sAqui)];
  if (lista[0].tipo !== 'semaforo' && lista[0].tipo !== 'pare') {
    const sinal = lista.find(i => i.tipo === 'semaforo' || i.tipo === 'pare');
    if (sinal) out.push(chipDe(sinal, sAqui));
  }
  return out;
}
const itensDe = pl => [...pl.eventos, ...(pl.sRadar !== null ? [{ tipo: 'radar', s: pl.sRadar }] : [])].sort((a, b) => a.s - b.s);
let ITENS = itensDe(piloto);

// GPS: saiu da rota (> 10 m dela, ou andando no sentido contrário) por 1 s → recalcula pelo caminho mais curto até
// o destino. Troca tudo o que depende da rota: piloto (direção automática do modo pedais), chips "próximo", seta
// guia, conversões do fiscal (seta) e o chip do GPS. ⭐ e multas continuam.
const GPS_LONGE = 10, GPS_ESPERA = 1.0;
let foraRotaT = 0, rotaTrocas = 0, manualAte = -1;   // manualAte: modo pedais, ← → seguradas há pouco (s)
function trocarRota(R, avisar = true) {
  piloto = criarPiloto(R); ITENS = itensDe(piloto); CONV = calcularConversoes(R, BAIRRO.rotula);
  fiscal.trocarConversoes(CONV); setasRota.definir(CONV); guia.idx = 0; guia.d = 0; gpsUltimo = null; desliga = null; foraRotaT = 0; manualAte = -1;
  if (avisar) { rotaTrocas++; aviso('🔄 Recalculando a rota…', 2); sons.gps(); }
}
function vigiaRota(dt) {
  if (re) { foraRotaT = 0; return; }                  // dando ré: espera engatar para frente
  const p = piloto.P[guia.idx], desvio = Math.abs(wrap(carro.heading - p.h));
  // modo pedais: enquanto ← → estão seguradas não recalcula (o jogador está virando); ao soltar, se ele saiu da rota,
  // recalcula NA HORA — senão a direção automática puxaria o carro de volta para a rota antiga
  if (CONTROLE === 'pedais' && (keys.ArrowLeft || keys.ArrowRight)) { manualAte = t + 1.5; foraRotaT = 0; return; }
  const manual = t < manualAte;
  const contra = guia.d < GPS_LONGE && carro.speed > 1 && desvio > 2.2;
  const fora = guia.d > (manual ? 4 : GPS_LONGE) || contra || (manual && desvio > 0.7);
  foraRotaT = fora ? foraRotaT + dt : 0;
  if (foraRotaT < (manual ? 0.05 : GPS_ESPERA)) return;
  const R = rotaAte(carro.pos.x, carro.pos.z, carro.heading, M.destino);   // (antes ia sempre para a farmácia)
  if (R) trocarRota(R); else foraRotaT = GPS_ESPERA - 0.5;     // na rótula / fora da rua: tenta de novo daqui a pouco
}
const LIM_RADAR = BAIRRO.radares[0].limiteKmh;
function chipDe(e, sAqui) {
  const d = e.s - sAqui;
  const m = `${Math.max(0, Math.round(d / 5) * 5)} m`;
  if (e.tipo === 'semaforo') { const f = faseSemaforo(e.ref, t); return { txt: `🚦 ${m}`, cor: f, tipo: e.tipo, d }; }
  if (e.tipo === 'pare') return { txt: `🛑 PARE ${m}`, cor: 'pare', tipo: e.tipo, d };
  if (e.tipo === 'radar') return { txt: `📸 radar ${LIM_RADAR} · ${m}`, tipo: e.tipo, d };
  if (e.tipo === 'faixa') return { txt: `🚸 faixa ${m}`, tipo: e.tipo, d };
  if (e.tipo === 'rotula') return { txt: `🔄 rótula ${m}`, tipo: e.tipo, d };
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Entrada: teclado + volante de 1 polegar (dedo no volante = acelera · puxa pra baixo = freia · solta = vai parando)
// ---------------------------------------------------------------------------------------------------------------
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true; if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); if (e.code === 'KeyH') buzinar();
  // spec 033: A/D (ou Q/E) = pisca esquerdo/direito; R = ré; C = cinto
  if (!e.repeat && estado === 'dirigindo') { if (e.code === 'KeyQ' || e.code === 'KeyA') ligarSeta('esq'); if (e.code === 'KeyE' || e.code === 'KeyD') ligarSeta('dir'); if (e.code === 'KeyR') trocaMarcha(); if (e.code === 'KeyC') porCinto(); }
});
addEventListener('keyup', e => { keys[e.code] = false; teclaPc(e.code, false); });
// spec 041 (do site): no painel do modo Teclado, a tecla apertada acende
const teclasPc = new Map([...document.querySelectorAll('#pcPainel kbd')].map(k => [k.dataset.k, k]));
const teclaPc = (code, on) => { const k = teclasPc.get(code) || (code === 'KeyQ' ? teclasPc.get('KeyA') : code === 'KeyE' ? teclasPc.get('KeyD') : null); if (k) k.classList.toggle('on', on); };
addEventListener('keydown', e => teclaPc(e.code, true));
// spec 008: volante FIXO embaixo à esquerda, só vira (polegar esquerdo). Arrastar para o lado ou girar o aro;
// soltou → volta ao centro suavemente. Toque rápido no coração = buzina. Acelerar/frear é no pedal da direita.
const thumb = { id: null, cx: 0, cy: 0, steer: 0, ang: 0, alvo: 0, tap: null, grab: null };
const thumbEl = $('thumb'), wheelEl = $('wheel');
document.querySelectorAll('.wheel').forEach(w => { w.innerHTML = wheelSVG(); });
const HEART_R = 0.2, TAP_MS = 250, TAP_MOVE = 10, ANG_MAX = 120;     // HEART_R em fração do diâmetro do volante
function zonaVolante(x, y) {
  const r = thumbEl.getBoundingClientRect();
  return x <= r.right + 20 && x < innerWidth * 0.62 && y >= r.top - 30;
}
function readThumb(e) {
  for (const t of e.changedTouches) {
    if (e.type === 'touchstart' && thumb.id === null && zonaVolante(t.clientX, t.clientY)) {
      const r = thumbEl.getBoundingClientRect();
      thumb.cx = r.left + r.width / 2; thumb.cy = r.top + r.height / 2;
      const dist = Math.hypot(t.clientX - thumb.cx, t.clientY - thumb.cy);
      thumb.id = t.identifier;
      // a0: ângulo do dedo no aro (girar) — perto do miolo, só o arrastar conta
      thumb.alvo = thumb.ang;                       // pegou o volante voltando: segura onde ele está
      thumb.grab = { x: t.clientX, ang0: thumb.ang, a0: dist > r.width * 0.22 ? Math.atan2(t.clientX - thumb.cx, thumb.cy - t.clientY) * 180 / Math.PI : null };
      thumb.tap = dist < r.width * HEART_R ? { t0: performance.now(), move: 0, x: t.clientX, y: t.clientY } : null;
      thumbEl.classList.add('active');
      continue;
    }
    if (t.identifier !== thumb.id) continue;
    if (e.type === 'touchend' || e.type === 'touchcancel') {
      if (thumb.tap && performance.now() - thumb.tap.t0 < TAP_MS && thumb.tap.move < TAP_MOVE) buzinar();
      thumb.id = null; thumb.alvo = 0; thumb.tap = null;
      thumbEl.classList.remove('active');
      continue;
    }
    if (thumb.tap) {
      thumb.tap.move = Math.max(thumb.tap.move, Math.hypot(t.clientX - thumb.tap.x, t.clientY - thumb.tap.y));
      if (thumb.tap.move < TAP_MOVE) continue;
      thumb.tap = null;
    }
    const gr = thumb.grab;
    const angSlide = (t.clientX - gr.x) / 70 * 90;
    let ang = angSlide;
    if (gr.a0 !== null) {
      let d = Math.atan2(t.clientX - thumb.cx, thumb.cy - t.clientY) * 180 / Math.PI - gr.a0;
      d = ((d + 540) % 360) - 180;
      if (Math.abs(d) > Math.abs(angSlide) && Math.sign(d) === Math.sign(angSlide || d)) ang = d;
    }
    thumb.alvo = Math.max(-ANG_MAX, Math.min(ANG_MAX, gr.ang0 + ang));
  }
}
// a cada quadro: o volante segue o dedo (rápido) ou volta ao centro (suave) e vira "steer"
let rodaK = '';
function passoVolante(dt) {
  if (thumb.id === null) {     // PC: ← → giram o volante desenhado (90° ≈ steer 0,9, como era antes)
    const kL = keys.ArrowLeft, kR = keys.ArrowRight;          // spec 033: A/D agora são o pisca, não viram
    thumb.alvo = ((kR ? 1 : 0) - (kL ? 1 : 0)) * 84;
  }
  const k = thumb.id !== null || thumb.alvo ? 22 : 7;
  thumb.ang += (thumb.alvo - thumb.ang) * (1 - Math.exp(-dt * k));
  if (thumb.id === null && Math.abs(thumb.ang) < 0.3) thumb.ang = 0;
  const a = Math.abs(thumb.ang);
  thumb.steer = a < 5 ? 0 : -Math.sign(thumb.ang) * Math.pow(Math.min(1, a / 90), 1.3);
  const rk = thumb.ang.toFixed(1);
  if (rk !== rodaK) { rodaK = rk; wheelEl.style.transform = `rotate(${rk}deg)`; }
}
const pedais = criarPedais({ vmaxKmh: FIS.VMAX * 3.6 });
function onTouch(e) {
  if (estado === 'menu') return;
  if (e.target && e.target.closest && e.target.closest('button, .ui')) return;
  e.preventDefault();
  isTouchUI = true;
  if (CONTROLE === 'volante') readThumb(e);       // o volante pega só os toques da esquerda; o resto é do pedal
  pedais.toque(e);
}
for (const ev of ['mousedown', 'mousemove', 'mouseup']) addEventListener(ev, e => {
  if (estado === 'menu' || isTouchUI || (e.target.closest && e.target.closest('button, .ui'))) return;
  // PC, modo volante: o mouse pega o volante como se fosse um dedo (mesma lógica do toque)
  if (CONTROLE === 'volante' && (thumb.id === 'mouse' || (e.type === 'mousedown' && thumb.id === null && zonaVolante(e.clientX, e.clientY)))) {
    const tipo = { mousedown: 'touchstart', mousemove: 'touchmove', mouseup: 'touchend' }[e.type];
    readThumb({ type: tipo, changedTouches: [{ identifier: 'mouse', clientX: e.clientX, clientY: e.clientY }] });
    return;
  }
  pedais.mouse(e);
});
let isTouchUI = false;
for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) addEventListener(ev, onTouch, { passive: false });

// ---------------------------------------------------------------------------------------------------------------
// Seta (spec 007): tocar liga e pisca (~1,5 Hz, botão + lanterna 3D + tique-taque); tocar de novo desliga; ligar um
// desliga o outro. Desliga sozinha ~1 s depois de completar a conversão (rumo já alinhado com a rua de saída).
// ---------------------------------------------------------------------------------------------------------------
const PISCA_HZ = 1.5, GPS_M = 80, AUTO_SETA_M = 60;
let seta = null, setaT0 = 0, piscaAceso = false, desliga = null, gpsUltimo = null, gpsVis = false, gpsLado = null;
function ligarSeta(lado) {
  seta = seta === lado ? null : lado; setaT0 = t; desliga = null;
  atualizaPisca(true);
}
function atualizaPisca(forca = false) {
  const aceso = !!seta && Math.floor((t - setaT0) * PISCA_HZ * 2) % 2 === 0;
  if (aceso !== piscaAceso || forca) {
    if (seta && aceso !== piscaAceso) sons.tique(aceso);
    piscaAceso = aceso;
  }
  carro.seta = seta; carro.piscaAceso = piscaAceso;
  hud.setas(seta, piscaAceso);
}
// o fiscal julgou a conversão `ref`: quando o rumo alinhar com a saída, conta 1 s e desliga (se for a seta daquele lado)
function conversaoFeita(ref, tf) {
  const k = CONV.lista.find(c => c.id === ref);
  if (k) desliga = { lado: k.lado, hSaida: k.hSaida, tJulgou: tf, em: null };
}
function autoDesliga() {
  if (!desliga) return;
  if (desliga.em === null && (Math.abs(wrap(carro.heading - desliga.hSaida)) < 0.3 || t - desliga.tJulgou > 5)) desliga.em = t + 1;
  if (desliga.em !== null && t >= desliga.em) {
    if (seta === desliga.lado) { seta = null; atualizaPisca(true); }
    desliga = null;
  }
}
document.querySelectorAll('.setaBtn').forEach(b => b.addEventListener('pointerdown', e => {
  e.preventDefault(); e.stopPropagation();
  if (estado === 'dirigindo') ligarSeta(b.dataset.lado);
}));

let buzinouAgora = false;            // spec 026: o fiscal vê a buzina no próximo passo (zona de silêncio)
let estacionouAgora = false, dicaEstac = false;   // spec 034: missão de estacionar
function buzinar() {
  sons.buzina(); carro.honks++; buzinouAgora = true;
  wheelEl.classList.remove('honk'); void wheelEl.offsetWidth; wheelEl.classList.add('honk');
}
let vibrouEm = -99, vibracoes = 0, curvaAgora = false;
// ré: tecla R ou tocar no velocímetro engata/desengata, só com o carro parado
let re = false;
function trocaMarcha() {
  if (estado !== 'dirigindo') return;
  if (Math.abs(carro.speed) > 0.5) { aviso('✋ Pare o carro para trocar a marcha', 1.8); return; }
  re = !re; ultimoHud = ''; carro.re = re; reBip = 0;
  aviso(re ? (isTouchUI ? '🔙 Ré engatada — o acelerador anda para trás' : '🔙 Ré engatada — ↑ anda para trás · R volta pra frente') : '🚗 Marcha para frente', 2);
}
let reBip = 0;
// cinto (spec 018): começa sem (no ?capture começa COM, para os testes antigos; ?cinto=0 força sem). Pôr = clique +
// botão verde que some; andando sem cinto, "dim-dom" a cada 2 s (como no painel de um carro de verdade).
const CINTO_INICIAL = CAPTURE ? Q.get('cinto') !== '0' : false;
let cinto = CINTO_INICIAL, cintoBip = 0, cintoSome = null;
function mostraCinto() {
  const b = $('cintoBtn');
  b.classList.toggle('hidden', estado !== 'dirigindo' || (cinto && cintoSome === null));
  b.classList.toggle('ok', cinto); b.textContent = cinto ? '🔒 Cinto ok!' : '🔓 Pôr o cinto';
}
function porCinto() {
  if (estado !== 'dirigindo' || cinto) return;
  cinto = true; cintoSome = t + 1.5; sons.clique(); mostraCinto();
  aviso(Math.abs(carro.speed) < 0.5 ? `🔒 Cinto colocado — ${M.quem}!` : '🔒 Cinto colocado! (o certo é antes de sair)', 2);
}
let cintoPediu = -99;
function pedeCinto() {            // tentou acelerar sem cinto: avisa (no máx. 1× a cada 2,5 s) e chacoalha o botão
  if (t - cintoPediu < 2.5) return;
  cintoPediu = t; sons.cinto(); aviso('🔒 Sem cinto o carro não anda! Põe o cinto (C)', 2.2);
  const b = $('cintoBtn'); b.classList.remove('chama'); void b.offsetWidth; b.classList.add('chama');
}
$('cintoBtn').addEventListener('animationend', e => { if (e.animationName === 'cintoChama') $('cintoBtn').classList.remove('chama'); });
$('cintoBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); porCinto(); });
function passoCinto(dt) {
  if (!cinto && carro.speed > 5 / 3.6) { cintoBip -= dt; if (cintoBip <= 0) { cintoBip = 2; sons.cinto(); } } else cintoBip = 0;
  if (cintoSome !== null && t >= cintoSome) { cintoSome = null; mostraCinto(); }
}
function passoRe(dt) {             // bipe da ré andando
  if (re && carro.speed < -0.2) { reBip -= dt; if (reBip <= 0) { reBip = 0.9; sons.re(); } } else reBip = 0;
}
$('velBox').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); trocaMarcha(); });
function playerInput() {
  if (AUTO) return piloto.input(carro);
  // spec 018 (revisto a pedido do Maki): SEM CINTO O CARRO NÃO ANDA — como a retenção do art. 167
  if (!cinto) {
    pedais.teclado(keys.ArrowUp || keys.KeyW, false, STEP);
    if (pedais.frac > 0.02 || keys.ArrowUp || keys.KeyW) pedeCinto();
    return { steer: 0, alvo: 0, brake: 1 };
  }
  const kL = keys.ArrowLeft, kR = keys.ArrowRight;            // spec 033: A/D agora são o pisca, não viram
  if (re) {                    // ré como num carro de verdade: acelerador (↑ ou o da tela) = para trás; ↓/espaço freia
    pedais.teclado(keys.ArrowUp || keys.KeyW, keys.ArrowDown || keys.KeyS || keys.Space, STEP);
    const steer = CONTROLE === 'volante' ? thumb.steer : ((kL ? 1 : 0) - (kR ? 1 : 0)) * 0.9;
    return { steer, alvo: pedais.frac * FIS.VMAX, brake: pedais.freio ? 1 : 0, re: true };
  }
  if (CONTROLE === 'pedais') {
    pedais.teclado(keys.ArrowUp || keys.KeyW, keys.ArrowDown || keys.KeyS || keys.Space, STEP);
    const d = piloto.direcao(carro), alvo = pedais.frac * FIS.VMAX;
    // PC: ← → seguradas assumem a direção (soltou → volta a direção automática)
    const steer = kL || kR ? ((kL ? 1 : 0) - (kR ? 1 : 0)) * 0.9 : d.steer;
    return { steer, alvo, teto: d.teto, brake: pedais.freio ? 1 : 0 };
  }
  // spec 008, modo volante: volante (polegar esquerdo) + o mesmo acelerador/freio (polegar direito). Sem direção
  // automática e sem o freio automático de curva (sem "teto"). No PC, ← → giram o volante (passoVolante).
  pedais.teclado(keys.ArrowUp || keys.KeyW, keys.ArrowDown || keys.KeyS || keys.Space, STEP);
  return { steer: thumb.steer, alvo: pedais.frac * FIS.VMAX, brake: pedais.freio ? 1 : 0 };
}

// ---------------------------------------------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------------------------------------------
const ui = { vel: $('velTxt'), lim: $('limPlaca'), velBox: $('velBox'), fps: $('fps') };
$('missaoTxt').textContent = M.emoji + ' ' + M.nome;
const aviso = (txt, secs = 2.5) => hud.msg(txt, secs);
let ultimoHud = '';
let estAnt = null, deltaEventos = 0, perdaVel = 0;
function updateHud() {
  const kmh = Math.round(Math.abs(carro.speed) * 3.6);
  const lim = limiteEm(carro.pos.x, carro.pos.z, carro.heading);
  const k = kmh + '|' + lim + '|' + re;
  const est = fiscal.estado();
  hud.placar({ ...est, pontosCnh: cnhBase + est.pontosCnh });
  // perda de ⭐ aos pouquinhos (acima do limite sem radar): a cada 2 ⭐ perdidas, "−2 ⭐" voa também
  if (estAnt !== null) { const resto = est.estrelas - estAnt - deltaEventos; if (resto < 0) perdaVel -= resto; }
  estAnt = est.estrelas; deltaEventos = 0;
  if (perdaVel >= 2) { const n = Math.floor(perdaVel); perdaVel -= n; hud.voa(`−${n} ⭐`, true); }
  // spec 040: dicas da estrada (1× por viagem): entrou na estrada (80, art. 61) / trator na frente perto da ponte (art. 32)
  if (estado === 'dirigindo') {
    const nr = naRua(carro.pos.x, carro.pos.z, carro.heading);
    if (!dicaEstrada && nr && BAIRRO.ruas.find(r => r.id === nr.rua)?.estrada) { dicaEstrada = true; hud.dica('🛣️ Estrada: aqui o limite é 80 km/h', 'Via de trânsito rápido — siga a placa (CTB art. 61)', 4); }
    const tr = vivos.lista().tratores[0];
    if (!dicaTrator && tr && tr.naPista && Math.hypot(tr.x - carro.pos.x, tr.z - carro.pos.z) < 45 && naPonte(tr.x, tr.z, BAIRRO.estrada.zonaPonte)) {
      dicaTrator = true; hud.dica('🚜 Trator devagar na frente', 'Na ponte não se ultrapassa: espere ela acabar (CTB art. 32)', 4.5);
    }
  }
  // spec 037: saindo da garagem → alerta 1× + indicadores dos lados (🚗 vem vindo / ✅ livre), como no PARE
  const naGar = estado === 'dirigindo' && naGaragem();
  if (naGar && !garagemAvisou) { garagemAvisou = true; hud.dica('🏠 Saindo da garagem: devagar!', 'Olhe os dois lados — quem está na rua tem a vez (CTB art. 36)', 4); }
  hud.lados(estado === 'dirigindo' ? (est.pare || (naGar ? ladosGaragem() : null)) : null);
  // aviso de GPS a ~80 m da conversão (com "plim-plom" ao aparecer); o "↪ curva!" da direção automática vem junto
  const cv = estado === 'dirigindo' ? est.conversao : null;
  gpsVis = !!cv && cv.d <= GPS_M;
  gpsLado = gpsVis ? cv.lado : null;
  // spec 020: semáforo da rota entre o carro e a curva, fechado → o GPS manda esperar e a seta grande some
  const semAntes = cv ? ITENS.find(i => i.tipo === 'semaforo' && i.s - (guia.s ?? 0) > -1 && i.s - (guia.s ?? 0) <= cv.d + 2) : null;
  const faseAntes = semAntes ? faseSemaforo(semAntes.ref, t) : 'verde';
  const espera = faseAntes !== 'verde' ? faseAntes : null;
  hud.gps(gpsVis ? { lado: cv.lado, d: cv.d, ok: seta === cv.lado, saida: cv.saida, espera } : null);
  setasRota.proxima(cv && !espera ? cv.id : null, cv ? cv.d : Infinity, t, camera.position);
  if (gpsVis && cv.id !== gpsUltimo) { gpsUltimo = cv.id; sons.gps(); }
  // piloto ?auto (certo) dá a seta a ~60 m da conversão
  if (AUTO && !ERRADO && cv && cv.d <= AUTO_SETA_M && seta !== cv.lado) ligarSeta(cv.lado);
  olharNoPare(est.pare);
  {                                                // os dois modos usam o acelerador/freio da direita
    pedais.atualizar(Math.abs(carro.speed) * 3.6, lim);
    pedais.curva(((CONTROLE === 'pedais' && curvaAgora) || gpsVis) && estado === 'dirigindo', gpsLado);
    if (kmh > lim && t - vibrouEm >= 3) {          // passou do limite: tremidinha (no máx. 1× a cada 3 s)
      vibrouEm = t; vibracoes++;
      try { if (navigator.vibrate) navigator.vibrate(40); } catch { /* PC / sem permissão */ }
    }
  }
  if (k === ultimoHud) return;
  ultimoHud = k;
  ui.vel.textContent = kmh; ui.lim.textContent = lim;
  ui.velBox.classList.toggle('re', re); $('velUn').textContent = re ? 'R' : 'km/h';
  ui.velBox.classList.toggle('acima', kmh > lim);
}
// o que o fiscal disse neste passo vira som, aviso e animação
function trataEventos(evs, tf) {
  for (const e of evs) {
    if (e.tipo === 'infracao') {
      const radar = e.id.startsWith('vel_');
      sons.apito(); if (radar) sons.camera();
      hud.infracao(e, radar); deltaEventos += PONTOS_JOGO.infracao;
      if (radar) {                         // spec 051: a foto do radar, tirada do alto do poste dele
        const rd = BAIRRO.radares.find(r => r.id === e.ref);
        if (rd) {
          const r = BAIRRO.ruas.find(x => x.id === rd.rua), o = r.largura / 2 - r.largura / 4 + 1.2;
          const de = { x: rd.x - Math.cos(rd.heading) * o, y: 4.5, z: rd.z + Math.sin(rd.heading) * o };
          hud.fotoRadar({ img: fotoDoRadar(renderer, scene, de, carro.pos), kmh: Math.round(e.kmh), lim: rd.limiteKmh, rua: r.nome, quando: quandoAgora() });
        }
      }
    } else if (e.tipo === 'acerto') {
      sons.ding(); hud.acerto(e); deltaEventos += e.pontos;
      if (e.motivo === 'setaCerta') conversaoFeita(e.ref, tf);
    } else if (e.tipo === 'estacionou') {
      if (M.estacionar && (M.estacionar === 'lateral') === (e.tipoVaga === 'lateral')) estacionouAgora = true;   // spec 042: baliza só na rua
    } else if (e.tipo === 'odometro') {
      deltaEventos += e.pontos;
      if (e.sequencia % 50 === 0) { sons.plimplim(); aviso(`⭐ ${e.sequencia} seguidas! Isso aí!`, 1.6); } else sons.plim(e.sequencia);
    } else if (e.tipo === 'batida') {
      deltaEventos += e.pontos;
      batida(e, tf);
    } else if (e.tipo === 'aviso') {
      if (e.motivo === 'sem_seta') { deltaEventos += e.pontos; hud.semSeta(e); conversaoFeita(e.ref, tf); }
      else if (e.motivo === 'sem_cinto') { deltaEventos += e.pontos; hud.semCinto(e); }
      else if (e.motivo === 'bike_perto') { deltaEventos += e.pontos; hud.avisoLei(e, '🚲'); }
      else if (e.motivo === 'nao_deu_passagem') { deltaEventos += e.pontos; hud.avisoLei(e, '🚑'); }
      else if (e.motivo === 'nao_reduziu') { deltaEventos += e.pontos; hud.avisoLei(e, e.ref === 'cachorro' ? '🐶' : '⚽'); }
      else if (e.motivo === 'buzinou') { deltaEventos += e.pontos; hud.avisoLei(e, '📯'); }
      else if (e.motivo === 'chuva_rapido') { deltaEventos += e.pontos; hud.avisoLei(e, e.clima === 'neblina' ? '🌫️' : '🌧️'); }
      else if (e.motivo === 'contramao_unica') { deltaEventos += e.pontos; hud.avisoLei(e, '⛔'); }
      else if (e.motivo === 'ultrapassou_ponte') { deltaEventos += e.pontos; hud.avisoLei(e, '🌉'); }
      else if (e.motivo === 'estacionou_errado') { deltaEventos += e.pontos; hud.avisoLei(e, '🅿️'); }
      else if (e.motivo === 'atropelou') { deltaEventos += e.pontos; sons.apito(); hud.avisoLei(e, '🚨'); hud.dica('🚨 Atropelou!', 'Na vida real atropelar é crime (CTB art. 303). Devagar perto de quem está a pé!', 4); }
      else if (e.motivo === 'garagem_preferencia') { deltaEventos += e.pontos; hud.avisoLei(e, '🏠'); }
      else if (e.motivo === 'vaga_reservada') { deltaEventos += e.pontos; hud.avisoLei(e, e.tipoVaga === 'pcd' ? '♿' : '👴'); }
      else if (e.motivo === 'quase') hud.dica('😮 Ufa! Quase…', 'Espere a pista ficar livre.', 2.8);
      else aviso(`🐢 Devagar! Limite ${e.limite} km/h · −⭐`, 2);
    }
  }
}
// batida (spec 006): POW, som engraçado, os dois carros sacodem e ficam parados ~1,5 s
const PARADO_BATIDA = 1.5;
function batida(e, tf) {
  sons.pow(); hud.batida(e);
  const i = transito.carros.findIndex(c => c.id === e.carro), o = transito.carros[i];
  transito.bater(i, tf + PARADO_BATIDA);
  carro.speed = 0; carro.travadoAte = tf + PARADO_BATIDA; carro.bump = 0.45;
  pow.mostrar(o ? (o.x + carro.pos.x) / 2 : carro.pos.x, o ? (o.z + carro.pos.z) / 2 : carro.pos.z);
}
// olhar para os lados no PARE (spec 006): parou nos 10 m antes da linha → câmera vira à esquerda, à direita e volta
// (~1,4 s, ±60°), 1× por parada
const OLHAR = [[0, 0], [0.35, 1], [0.55, 1], [0.9, -1], [1.1, -1], [1.4, 0]], OLHAR_MAX = 60 * Math.PI / 180;
const olhar = { ref: null, t0: 0, ang: 0 };
function olharNoPare(p) {
  if (!p || estado !== 'dirigindo') { olhar.ref = null; return; }
  if (olhar.ref === null) { olhar.ref = p.ref; olhar.t0 = t; }
}
function anguloOlhar() {
  if (olhar.ref === null && olhar.ang === 0) return 0;
  const tau = t - olhar.t0;
  if (olhar.ref === null || tau >= OLHAR.at(-1)[0]) return 0;
  for (let k = 1; k < OLHAR.length; k++) {
    const [ta, va] = OLHAR[k - 1], [tb, vb] = OLHAR[k];
    if (tau <= tb) { const u = (tau - ta) / (tb - ta), s = u * u * (3 - 2 * u); return (va + (vb - va) * s) * OLHAR_MAX; }
  }
  return 0;
}

// spec 037: carro na garagem ou na rampa (até a beira da rua) e quem vem pela Rua de casa de cada lado (até 30 m)
let garagemAvisou = false, dicaEstrada = false, dicaTrator = false;
function naGaragem() {
  const G = BAIRRO.garagem, p = carro.pos;
  return USA_GARAGEM && p.x > G.x0 - 1.5 && p.x < G.x1 + 1.5 && p.z > G.z0 - 1.5 && p.z < G.z1;
}
function ladosGaragem() {
  const x = carro.pos.x, r = { esquerda: false, direita: false };
  for (const o of transito.carros) {
    const dx = o.x - x, sx = Math.sin(o.heading);
    if (Math.abs(o.z - 170) > 5 || Math.abs(dx) > 30 || o.v < 0.5) continue;
    if (dx < 0 && sx > 0.3) r.esquerda = true;          // à esquerda, vindo para o leste (na nossa direção)
    if (dx > 0 && sx < -0.3) r.direita = true;          // à direita, vindo para o oeste
  }
  return r;
}

// spec 038: a câmera dentro da garagem fica embaixo do teto (3 m), entre as paredes e antes da parede do fundo
const sobTeto = v => USA_GARAGEM && v.x > BAIRRO.garagem.x0 - 0.6 && v.x < BAIRRO.garagem.x1 + 0.6 && v.z > 177.3 && v.z < 196;
function prendeNaGaragem(v) {
  const G = BAIRRO.garagem;
  v.y = Math.min(v.y, 3.0); v.z = Math.min(v.z, G.z1 - 0.5); v.x = Math.max(G.x0 + 0.4, Math.min(G.x1 - 0.4, v.x));
}
// portão basculante: aberto no menu (mostra o carro); ao começar a missão fecha e abre devagar (1,8 s)
let portaoV = 1;
function atualizaPortao(dt) {
  if (!USA_GARAGEM) return;
  if (estado === 'menu') portaoV = 1; else portaoV = Math.min(1, portaoV + dt / 1.8);
  mundo.portao(portaoV);
}

// ---------------------------------------------------------------------------------------------------------------
// Câmera atrás do carro
// ---------------------------------------------------------------------------------------------------------------
const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), snap: true };
// spec 008: em pé, câmera mais alta e mais atrás, olhando para baixo — carro menor (~10% da altura) no pé da faixa do
// meio (53–63%) e a rua/cruzamento à frente no meio dela (era back 7,2 · up 4,2 · ahead 6 · lookY 0,4: carro 53–70%)
const CAM = { pe: { back: 11, up: 6, ahead: 20, lookY: -4 }, deitado: { back: 7.0, up: 3.6, ahead: 8, lookY: 1.2 } };
const _tp = new THREE.Vector3(), _tl = new THREE.Vector3();
function updateCamera(dt) {
  const c = carro, fx = Math.sin(c.heading), fz = Math.cos(c.heading);
  const portrait = innerHeight > innerWidth;
  const k = portrait ? CAM.pe : CAM.deitado;
  _tp.set(c.pos.x - fx * k.back, k.up, c.pos.z - fz * k.back);
  _tl.set(c.pos.x + fx * k.ahead, k.lookY, c.pos.z + fz * k.ahead);
  if (sobTeto(_tp)) { prendeNaGaragem(_tp); _tl.y = 0.6; }          // spec 038: debaixo do teto da garagem, atrás do carro
  if (estado === 'menu' && USA_GARAGEM && naGaragem()) {          // menu: a garagem vista da rua, portão aberto, carro lá dentro
    const a = performance.now() * 0.0003, G = BAIRRO.garagem;
    _tp.set(G.carro.x + Math.sin(a) * 6, 3.4, 166); _tl.set(G.carro.x, 1.4, 181);
  } else if (estado === 'menu') {       // volta lenta mostrando o carro na frente da casa da vovó
    const a = performance.now() * 0.00025;
    _tp.set(c.pos.x + Math.sin(a) * 11, 4.5, c.pos.z + Math.cos(a) * 11); _tl.set(c.pos.x, 1, c.pos.z);
  }
  if (cam.snap) { cam.pos.copy(_tp); cam.look.copy(_tl); cam.snap = false; }
  cam.pos.lerp(_tp, 1 - Math.exp(-dt * 6)); cam.look.lerp(_tl, 1 - Math.exp(-dt * 9));
  if (sobTeto(cam.pos)) prendeNaGaragem(cam.pos);                  // nem no meio da transição atravessa o teto/paredes
  camera.position.copy(cam.pos);
  // olhar no PARE: gira a câmera (posição e alvo) em volta do carro; + = esquerda
  olhar.ang = estado === 'dirigindo' ? anguloOlhar() : 0;
  if (olhar.ang !== 0) {
    const a = olhar.ang, ca = Math.cos(a), sa = Math.sin(a), gira = (v) => {
      const dx = v.x - c.pos.x, dz = v.z - c.pos.z;
      v.x = c.pos.x + dx * ca + dz * sa; v.z = c.pos.z - dx * sa + dz * ca;
    };
    gira(camera.position); _tl.copy(cam.look); gira(_tl); camera.lookAt(_tl);
  } else camera.lookAt(cam.look);
}

// ---------------------------------------------------------------------------------------------------------------
// Laço principal
// ---------------------------------------------------------------------------------------------------------------
const STEP = 1 / 120;
let acc = 0, realDt = 1 / 30, t = 0, estado = 'menu', chegou = false, tChegada = null, tLargada = 0, relT = 0;
function começar() {
  if (estado !== 'menu') return;
  sons.init();
  estado = 'dirigindo'; cam.snap = true; tLargada = t; portaoV = 0;
  $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
  $('thumb').classList.toggle('hidden', CONTROLE !== 'volante'); pedais.mostrar(true);
  pedais.layout(CONTROLE);
  document.body.classList.toggle('modo-pedais', CONTROLE === 'pedais'); document.body.classList.toggle('modo-volante', CONTROLE === 'volante');
  document.body.classList.toggle('aparelho-pc', APARELHO === 'pc');       // spec 041: teclado = painel de teclas, sem pedal/volante na tela
  $('pcPainel').classList.toggle('hidden', APARELHO !== 'pc');
  $('setas').classList.remove('hidden');
  if (AUTO) cinto = true;
  mostraCinto();
  aviso(cinto ? M.bora : '🔒 Põe o cinto para o carro andar!', 2.5);
}
// spec 021 (noite): céu/neblina/postes (mundo), luz fraca cor de luar e o facho dos faróis no chão
// spec 036: farol de verdade — um foco de luz preso ao carro (ilumina asfalto, carros e casas à frente), 2 fachos no
// chão saindo de cada farol e o brilho das lentes. Só aceso de noite e na neblina (o grupo inteiro liga/desliga).
const farol = (() => {
  const g = new THREE.Group(); g.visible = false;
  const tex = canvasTex(64, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, 'rgba(255,248,215,0.95)'); gr.addColorStop(0.35, 'rgba(255,244,205,0.55)'); gr.addColorStop(1, 'rgba(255,240,190,0)');
    c.fillStyle = gr; c.beginPath(); c.moveTo(w * 0.4, h); c.lineTo(w * 0.6, h); c.lineTo(w, 0); c.lineTo(0, 0); c.closePath(); c.fill();
  }, false);
  const matFacho = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  for (const x of [-0.6, 0.6]) {                       // um facho por farol, da frente do carro até ~24 m
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 22).rotateX(-Math.PI / 2), matFacho);
    m.position.set(x, 0.08, 1.8 + 11); m.rotation.y = Math.PI; m.renderOrder = 7; g.add(m);
  }
  const brilho = canvasTex(64, 64, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.3, 'rgba(255,245,200,0.7)'); gr.addColorStop(1, 'rgba(255,240,190,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }, false);
  for (const x of [-0.55, 0.55]) {                     // lentes acesas
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: brilho, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.position.set(x, 0.84, 1.8); sp.scale.set(1.2, 1.2, 1); g.add(sp);
  }
  const luz = new THREE.SpotLight(0xfff1d0, 90, 48, 0.62, 0.55, 1.1);   // ilumina o que está à frente
  luz.position.set(0, 1.0, 1.8); luz.target.position.set(0, 0, 22); g.add(luz, luz.target);
  carro.mesh.group.add(g);
  return g;
})();
function aplicaNoite(liga) {
  mundo.noite(liga); farol.visible = liga;
  hemi.intensity = liga ? 0.5 : 1.7; hemi.color.set(liga ? 0x8ea0ff : 0xe6f4ff); hemi.groundColor.set(liga ? 0x1a2236 : 0x6f9a4a);
  sun.intensity = liga ? 0.3 : 2.2; sun.color.set(liga ? 0x9fb4ff : 0xfff1d6);
}
// clima da missão: noite (spec 021) ou chuva (spec 029: céu cinza, pingos, asfalto molhado e o carro com 60% da aderência)
function aplicaClima(m) {
  const c = climaDe(m);
  aplicaNoite(!!m.noite);
  mundo.chuva(c === 'chuva'); mundo.neblina(c === 'neblina');
  if (c !== 'sol' && !m.noite) { hemi.intensity = 1.15; sun.intensity = 0.9; }
  if (c === 'neblina') farol.visible = true;                 // neblina: farol baixo aceso
  carro.aderencia = c === 'chuva' ? 0.6 : 1;
}
// volta o carro para a largada da missão M, com fiscal, rota e HUD novos (usado por "Dirigir de novo" e pelo menu)
function reinicia() {
  garagemAvisou = false; dicaEstrada = false; dicaTrator = false;
  Object.assign(carro, { pos: { x: largada(M).x, z: largada(M).z }, heading: largada(M).heading, speed: 0, steer: 0, batidas: 0, bump: 0 });
  trocarRota(rotaDe(M), false); fiscal = novoFiscal(); guia.idx = 0; hud.reset(); pedais.soltarTudo(); thumb.id = null; thumb.alvo = thumb.ang = thumb.steer = 0; carro.batidasMuro = 0;
  carro.travadoAte = 0; pow.esconder(); olhar.ref = null; estAnt = null; perdaVel = 0;
  chegou = false; tChegada = null; cam.snap = true; tLargada = t; acc = 0; portaoV = 0;
  seta = null; desliga = null; gpsUltimo = null; atualizaPisca(true); re = false; carro.re = false; ultimoHud = '';
  cinto = AUTO || CINTO_INICIAL; cintoSome = null; cnhBase = progresso.cnh().pontos;
  vivos.reset(); ambAvisou = false; sons.sirene(0); estacionouAgora = false; dicaEstac = false;
  transito.saidaEscola(!!M.saidaEscola);
}
function deNovo() {                    // "Dirigir de novo": mesma missão, do começo
  reinicia(); estado = 'dirigindo'; mostraCinto();
  aviso(M.bora.replace('Bora!', 'De novo!'), 2.5);
}
// spec 021: troca a missão (menu): destino, rota, largada, textos e noite
function aplicaMissao(m) {
  M = m; try { if (!CAPTURE) localStorage.setItem(LS_MISSAO, M.id); } catch { /* sem storage */ }
  marcador.grupo.position.set(ondeMarcador(M).x, 0, ondeMarcador(M).z);
  $('missaoTxt').textContent = M.emoji + ' ' + M.nome; $('rumoIco').textContent = M.emoji + (M.icone !== M.emoji ? M.icone : '');
  aplicaClima(M); marcaTempo();                    // spec 053: o menu mostra o tempo da missão
  if (transito.saidaEscola) transito.saidaEscola(!!M.saidaEscola);
  vivos = criarVivos(rotaDe(M), M.vivos || {});
  reinicia(); marcaMissoes();
}
function voltarMenu() {               // relatório → "Outras missões"
  reinicia(); estado = 'menu'; mostraCinto();
  $('menu').classList.remove('hidden'); $('hud').classList.add('hidden'); $('thumb').classList.add('hidden');
  $('setas').classList.add('hidden'); pedais.mostrar(false); marcaMissoes();
  $('telaMissoes').classList.remove('hidden');      // do relatório "Missões" já abre a tela de missões
}
function marcaMissoes() {
  const med = progresso.medalhas(), dif = n => '⭐'.repeat(n) + '<u>' + '⭐'.repeat(3 - n) + '</u>';
  // spec 031: tela de missões — cartão com emoji, nome, o que ensina, dificuldade e a melhor medalha
  $('missaoCtl').innerHTML = MISSOES.map(m => `<span data-missao="${m.id}" class="${m.id === M.id ? 'on' : ''}">`
    + `<b>${m.emoji}</b><strong>${m.curto} <small class="dif">${dif(m.dificuldade)}</small></strong><em>${m.ensina}</em>`
    + `<i>${med[m.id] ? MEDALHA_TXT[med[m.id]] : ''}</i></span>`).join('')
    // spec 045: o Centro de Chapecó também aparece aqui, como um cartão a mais
    + `<span data-mapa="chapeco" class="chapeco"><b>🏙️</b><strong>Chapecó</strong><em>Centro e bairros: ruas de verdade, com as regras</em><i></i></span>`;
  const feitas = MISSOES.filter(m => med[m.id]).length;
  $('missaoAtual').innerHTML = `<span class="ico">${M.emoji}</span><span><b>${M.nome}</b><small>${M.ensina}</small></span>`
    + `<span class="troca">🗺️ Missões ${feitas}/${MISSOES.length}</span>`;
  const c = progresso.cnh();
  $('menuCnh').textContent = `🪪 Carteirinha: ${c.pontos} de ${c.limite} pontos`;
  if (MAPA === 'chapeco') $('missaoAtual').innerHTML = `<span class="ico">🏙️</span><span><b>Passeio em Chapecó</b><small>Ruas de verdade: semáforos, PAREs e radares valendo</small></span><span class="troca">🗺️ Missões</span>`;
}
$('missaoCtl').addEventListener('click', e => {
  if (estado !== 'menu') return;
  const c = e.target.closest('[data-mapa]'); if (c) { escolheMapa('chapeco'); $('telaMissoes').classList.add('hidden'); return; }
  const b = e.target.closest('[data-missao]'); if (!b) return;
  if (MAPA !== 'bairro') escolheMapa('bairro');
  aplicaMissao(missaoPorId(b.dataset.missao)); $('telaMissoes').classList.add('hidden');
});
$('missaoAtual').addEventListener('click', () => { if (estado === 'menu') { marcaMissoes(); $('telaMissoes').classList.remove('hidden'); } });
$('fechaMissoes').addEventListener('click', () => $('telaMissoes').classList.add('hidden'));
// spec 045: mapa — Bairro (as missões) ou Centro de Chapecó (as ruas de verdade, passeio com as regras)
const LS_MAPA = 'transitoFofo.mapa';
let MAPA = !Q.has('capture') && lsLer(LS_MAPA) === 'chapeco' ? 'chapeco' : 'bairro';
function marcaMapa() {
  document.querySelectorAll('#mapaCtl [data-mapa]').forEach(b => b.classList.toggle('on', b.dataset.mapa === MAPA));
  marcaTempo();                                    // spec 058: o tempo vale também no passeio em Chapecó
  marcaMissoes();
}
const escolheMapa = m => { MAPA = m; lsGravar(LS_MAPA, MAPA); marcaMapa(); };
document.querySelectorAll('#mapaCtl [data-mapa]').forEach(b => b.addEventListener('click', () => escolheMapa(b.dataset.mapa)));
$('playBtn').addEventListener('click', () => { if (MAPA === 'chapeco') location.href = 'centro.html?go'; else começar(); });
function marcaModo() {          // spec 041: Toque/Teclado (as dicas mudam junto); spec 048: sem Pedais
  document.querySelectorAll('#aparelhoCtl [data-aparelho]').forEach(b => b.classList.toggle('on', b.dataset.aparelho === APARELHO));
  $('hintVolante').classList.toggle('hidden', APARELHO === 'pc');
  $('hintPc').classList.toggle('hidden', APARELHO !== 'pc');
  $('hintPc').querySelector('.soVolante').classList.toggle('off', CONTROLE !== 'volante');
}
document.querySelectorAll('#aparelhoCtl [data-aparelho]').forEach(b => b.addEventListener('click', () => { APARELHO = b.dataset.aparelho; lsGravar(LS_APARELHO, APARELHO); marcaModo(); }));
// modelo do carrinho (rosa com corações / azul com estrelas): ?cor=azul força; senão a última escolha
const LS_COR = 'transitoFofo.cor';
let COR = MODELOS[Q.get('cor')] ? Q.get('cor') : (() => { try { return MODELOS[localStorage.getItem(LS_COR)] ? localStorage.getItem(LS_COR) : 'rosa'; } catch { return 'rosa'; } })();
function marcaCor() {
  carro.mesh.pintar(COR);
  // tema completo (spec 015): a interface (CSS body.tema-azul), o volante, as setas da rota e o alfinete do destino
  document.body.classList.toggle('tema-azul', COR === 'azul');
  document.querySelectorAll('.wheel').forEach(w => { w.innerHTML = wheelSVG(COR); });
  const TEMA = COR === 'azul' ? { cor: '#2b80ff', brilho: '#0c3a8a' } : { cor: '#ff4fa3', brilho: '#8a1050' };
  setasRota.tema(TEMA.cor); marcador.tema(TEMA.cor, TEMA.brilho);
  mundo.temaGaragem(COR === 'azul');                 // spec 049: garagem azul no tema Meninos
  const ic = document.querySelector('#menu .bigIcon'); if (ic) ic.textContent = COR === 'azul' ? '🚗💙' : '🚗💗';
  document.querySelectorAll('#corCtl [data-cor]').forEach(b => b.classList.toggle('on', b.dataset.cor === COR));
}
document.querySelectorAll('#corCtl [data-cor]').forEach(b => b.addEventListener('click', () => {
  COR = b.dataset.cor; try { localStorage.setItem(LS_COR, COR); } catch { /* sem storage */ } marcaCor();
}));
// spec 053: o menu mostra o tempo que VALE — na missão da chuva é sempre chuva (Sol/Neblina ficam apagados)
function marcaTempo() {
  const trava = !!M.chuva && MAPA !== 'chapeco';    // spec 058: em Chapecó (passeio) vale a escolha
  const vale = trava ? 'chuva' : TEMPO;
  document.querySelectorAll('#tempoCtl [data-tempo]').forEach(b => b.classList.toggle('on', b.dataset.tempo === vale));
  $('tempoCtl').classList.toggle('travado', trava);
  $('tempoCtl').title = trava ? 'Esta missão é na chuva' : '';
}
document.querySelectorAll('#tempoCtl [data-tempo]').forEach(b => b.addEventListener('click', () => {
  if (M.chuva && MAPA !== 'chapeco') { aviso('🌧️ Esta missão é na chuva!', 1.8); return; }
  TEMPO = b.dataset.tempo; try { localStorage.setItem('transitoFofo.tempo', TEMPO); } catch { /* sem storage */ }
  marcaTempo(); aplicaClima(M); reinicia();       // reinicia: fiscal e piloto novos com o tempo novo
}));
marcaTempo();
marcaCor();
marcaModo();
aplicaClima(M);
if (transito.saidaEscola) transito.saidaEscola(!!M.saidaEscola);
$('rumoIco').textContent = M.emoji + (M.icone !== M.emoji ? M.icone : '');
marcaMissoes();
marcaMapa();
document.body.classList.remove('carregando');      // spec 045: menu pronto
$('muteBtn').addEventListener('click', () => { sons.mudo = !sons.mudo; $('muteBtn').textContent = sons.mudo ? '🔇 Som desligado' : '🔊 Som ligado'; });
$('muteBtn').textContent = sons.mudo ? '🔇 Som desligado' : '🔊 Som ligado';

function update(dt) {
  const t0 = t;
  t += dt;
  transito.passo(dt, t, jogadorTransito());
  const pf = transito.paraFiscal();
  if (estado === 'dirigindo') vivos.passo(dt, { x: carro.pos.x, z: carro.pos.z, v: carro.speed });
  const lv = estado === 'menu' ? { bicicletas: [], ambulancias: [], travessias: [], tratores: [] } : vivos.lista();
  if (estado === 'dirigindo' || estado === 'chegou' || estado === 'relatorio') {
    acc += dt;
    let k = 0;
    while (acc >= STEP) {
      acc -= STEP; k++;
      const tf = Math.min(t, t0 + k * STEP);
      const travado = carro.travadoAte > tf;          // bateu: fica parado ~1,5 s
      const inp = (estado !== 'dirigindo' && !AUTO) || travado ? { steer: 0, gas: 0, brake: 1 } : playerInput();
      const b0 = carro.batidas;
      barrouMuro = false;
      stepCar(carro, inp, STEP, podeAndarJogador);
      if (carro.batidas > b0) { sons.batida(); if (barrouMuro) carro.batidasMuro++; }
      if (inp.teto !== undefined) curvaAgora = inp.alvo > inp.teto + 0.5 && carro.speed > inp.teto - 0.3 && !inp.brake;
      if (estado === 'dirigindo') trataEventos(fiscal.tick({ t: tf, carro: { x: carro.pos.x, z: carro.pos.z, heading: carro.heading, v: carro.speed }, pedestres: pf.pedestres, carros: pf.carros, seta, cinto, bicicletas: lv.bicicletas, ambulancias: lv.ambulancias, travessias: lv.travessias, tratores: lv.tratores, buzinou: buzinouAgora }, STEP), tf);
      buzinouAgora = false;
    }
    // lombada: o carro dá um pulinho ao passar
    carro.lombadaT = Math.max(0, (carro.lombadaT || 0) - dt);
    for (const l of BAIRRO.lombadas) {
      const fx = Math.sin(l.heading), fz = Math.cos(l.heading), dx = carro.pos.x - l.x, dz = carro.pos.z - l.z;
      if (Math.abs(dx * fx + dz * fz) < 0.5 && Math.abs(-dx * fz + dz * fx) < 5 && carro.lombadaT <= 0 && Math.abs(carro.speed) > 1) carro.lombadaT = 0.35;
    }
    const d = Math.hypot(carro.pos.x - M.destino.x, carro.pos.z - M.destino.z);
    // spec 034: na missão de estacionar, chegar na entrada só dá a dica; termina quando o fiscal diz "estacionou"
    if (M.estacionar && !AUTO && !chegou && d < 14 && !dicaEstac) {
      dicaEstac = true;
      aviso(M.estacionar === 'lateral' ? '🚙 Pare numa vaga livre colado no meio-fio (até 50 cm), de frente para o sentido da rua' : '🅿️ Entre à direita e pare numa vaga COMUM livre (não a de idoso/PcD)', 3.5);
    }
    // spec 035: só "chegou" no FIM da rota — a rota pode passar perto do destino antes, pela outra faixa (futebol)
    const noFimDaRota = guia.s === undefined || guia.s > piloto.P.at(-1).s - 20;
    if (!chegou && (estacionouAgora || (d < M.destino.raio && noFimDaRota && (!M.estacionar || (AUTO && M.estacionar !== 'lateral'))))) {
      estacionouAgora = false;
      chegou = true; tChegada = t; estado = 'chegou'; sons.chegada(); relT = 1.6; mostraCinto();
      aviso(M.chegou, 3);
    }
    if (estado === 'chegou') { relT -= dt; if (relT <= 0) {
      estado = 'relatorio';
      const est = fiscal.estado(), viagem = progresso.registrarViagem(M.id, est);   // medalha + carteirinha (spec 021/022)
      hud.relatorio(est, { tempo: tChegada - tLargada, onDeNovo: deNovo, onMenu: voltarMenu, missao: M, viagem });
    } }
  }
  if (estado === 'dirigindo' && !AUTO) { vigiaRota(dt); passoRe(dt); }
  if (estado === 'dirigindo') passoCinto(dt);
  if (estado !== 'menu') { autoDesliga(); atualizaPisca(); }
  if (CONTROLE === 'volante') passoVolante(dt);
  syncMesh(carro, dt);
  for (const c of transito.carros) if (c.sacode > 0) c.sacode = Math.max(0, c.sacode - dt);
  atores.sync();
  patio.passo(dt, carro.pos);
  vivosMesh.sync(lv, t);
  { // sirene: volume pela distância; 1º aviso quando ela aparece
    const a = lv.ambulancias[0], d = a ? Math.hypot(a.x - carro.pos.x, a.z - carro.pos.z) : Infinity;
    sons.sirene(a && estado === 'dirigindo' ? Math.max(0.15, 1 - d / 140) : 0);
    if (a && !ambAvisou && estado === 'dirigindo') { ambAvisou = true; aviso('🚑 Sirene! Encoste à direita e pare até ela passar', 3); }
    // "retrovisor": a câmera olha para a frente, então um chip piscando diz que ela vem atrás e a quantos metros
    const atras = a ? -((a.x - carro.pos.x) * Math.sin(carro.heading) + (a.z - carro.pos.z) * Math.cos(carro.heading)) : -1;
    const chip = $('ambChip'), vis = estado === 'dirigindo' && atras > 0 && atras < 100;
    chip.classList.toggle('hidden', !vis);
    if (vis) chip.textContent = `🚑 vem atrás · ${Math.max(5, Math.round(atras / 5) * 5)} m · encoste e pare`;
  }
  pow.atualizar(dt);
  mundo.atualizarChuva(dt, camera.position);
  mundo.atualizar(t); atualizaPortao(dt);
  marcador.atualizar(t);
  if (estado !== 'menu') { updateHud(); atualizaGuia(); }
  hud.tick(realDt);
  sons.motor(carro.speed, estado !== 'menu');
  updateCamera(dt);
  if (CAPTURE && window.__game && window.__game.aoQuadro) window.__game.aoQuadro(t, dt);
}
const render = () => renderer.render(scene, camera);

// FPS + qualidade adaptativa (celular fraco baixa a resolução sozinho)
let fpsFrames = 0, fpsT = 0, lowStreak = 0;
function fpsTick(dt) {
  fpsFrames++; fpsT += dt;
  if (fpsT >= 1) {
    const fps = fpsFrames / fpsT;
    if (SHOW_FPS) { ui.fps.classList.remove('hidden'); ui.fps.textContent = `${fps.toFixed(0)} fps · res ${pixelRatio.toFixed(2)}x`; }
    if (!CAPTURE) {
      lowStreak = fps < 45 ? lowStreak + 1 : 0;
      if (lowStreak >= 2 && pixelRatio > 0.8) { pixelRatio = Math.max(0.8, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); lowStreak = 0; }
    }
    fpsFrames = 0; fpsT = 0;
  }
}

if (CAPTURE) {
  window.__game = {
    carro, bairro: BAIRRO, get t() { return t; }, fase: id => faseSemaforo(id, t),
    podeAndar, limiteEm, get piloto() { return piloto; }, get chegou() { return chegou; }, get tChegada() { return tChegada; },
    get fiscal() { return fiscal; }, transito, pedais, pow, get olhar() { return olhar.ang; }, proximoItens, hud, get controle() { return CONTROLE; }, get aparelho() { return APARELHO; }, get vibracoes() { return vibracoes; },
    estado: () => ({ fase: estado, chegou, t, ...fiscal.estado() }),
    começar, deNovo, render, renderer, scene, camera, aoQuadro: null,
    get CONV() { return CONV; }, get rotaTrocas() { return rotaTrocas; }, get cor() { return COR; }, get missao() { return M; }, get tempo() { return TEMPO; }, get vivos() { return vivos; }, aplicaMissao: id => aplicaMissao(missaoPorId(id)), progresso, voltarMenu, get cinto() { return cinto; }, porCinto, setasRota, get re() { return re; }, trocaMarcha, rotaAte, ligarSeta, volante: thumb, CAM, get seta() { return seta; }, get piscaAceso() { return piscaAceso; }, get gpsVisivel() { return gpsVis; },
  };
  window.__step = (secs = 1 / 30) => {
    const n = Math.max(1, Math.round(secs * 30));
    realDt = 1 / 30;
    for (let i = 0; i < n; i++) update(1 / 30);
    render(); fpsTick(1 / 30);
  };
  começar();
  update(1 / 30); render();
} else {
  let last = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    realDt = Math.min(0.5, (now - last) / 1000);
    last = now;
    update(dt); render(); fpsTick(dt);
  });
  if (AUTO || Q.has('go')) começar();
}
