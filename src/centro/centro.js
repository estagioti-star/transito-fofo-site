// Spec 041 (vinda da versão do site, spec 015 de lá) — passeio livre no Centro de Chapecó: as ruas e os prédios de
// verdade (OpenStreetMap, dados/centro.json), o mesmo carro, a mesma física e os mesmos controles do jogo (volante +
// pedal no toque; teclado no computador). Sem fiscal (passeio para conhecer o caminho). Laço fixo de física (1/120 s).
// Adaptado à nossa versão: Meninas/Meninos = o carro e o tema rosa/azul (transitoFofo.cor), Toque/Teclado do menu do
// jogo (transitoFofo.aparelho), o pedal do jogo (↑ acelera segurando, soltar zera — livre, sem parar no limite).
import * as THREE from '../../vendor/three.module.js';
import { novoCarro, stepCar, syncMesh, FIS } from '../carro.js';
import { criarPedais } from '../pedais.js';
import { wheelSVG } from '../volante.js';
import { criarVolanteToque } from '../volante-toque.js';
import { criarSons } from '../sons.js';
import { criarRede, largada } from './rede.js';
import { criarMundoCentro, criarSinaisCentro, criarVidaMesh, criarPinturaCentro, criarCasinhas } from './mundo-centro.js';
import { criarCarrosPatio } from '../mundo.js';
import { criarVida } from './vida.js';
import { dividirEmPedacos } from './pedacos.js';
import { aplicaClimaCentro } from './clima.js';
import { criarTeclado, MODOS_TECLAS, LS_TECLAS } from '../teclas.js';
import { criarOlharLivre, giraEmVolta } from '../olhar.js';
import { criarFiscal } from '../fiscal.js';
import * as LEI from '../lei.js';
import { criarHud } from '../hud.js';
import { fotoDoRadar, quandoAgora } from '../foto.js';
import { criarSinais } from './sinais.js';

const Q = new URLSearchParams(location.search);
const CAPTURE = Q.has('capture');
const $ = id => document.getElementById(id);
const ler = k => { try { return localStorage.getItem(k); } catch { return null; } };
// spec 058: o tempo escolhido no menu do jogo (☀️ sol, 🌧️ chuva, 🌫️ neblina); ?tempo=… força; no ?capture o padrão é sol
const TEMPO = ['sol', 'chuva', 'neblina'].includes(Q.get('tempo')) ? Q.get('tempo')
  : CAPTURE ? 'sol' : (['chuva', 'neblina'].includes(ler('transitoFofo.tempo')) ? ler('transitoFofo.tempo') : 'sol');
const COR = ['rosa', 'azul'].includes(Q.get('cor')) ? Q.get('cor') : (ler('transitoFofo.cor') === 'azul' ? 'azul' : 'rosa');
const detecta = () => (!matchMedia('(any-pointer: coarse)').matches && !(navigator.maxTouchPoints > 0) && innerWidth >= 700) ? 'pc' : 'toque';
const APARELHO = ['toque', 'pc'].includes(Q.get('aparelho')) ? Q.get('aparelho')
  : CAPTURE ? 'toque' : (['toque', 'pc'].includes(ler('transitoFofo.aparelho')) ? ler('transitoFofo.aparelho') : detecta());
document.body.classList.toggle('tema-azul', COR === 'azul');
document.body.classList.toggle('aparelho-pc', APARELHO === 'pc');
$('hintToque').classList.toggle('hidden', APARELHO === 'pc'); $('hintPc').classList.toggle('hidden', APARELHO !== 'pc');
if (COR === 'azul') $('bigIcon').textContent = '🏙️💙';
// spec 045: veio do menu do jogo → nem mostra a tela do Centro (só o "carregando" até o mapa chegar)
if (Q.has('go') && !CAPTURE) {           // (esconde os filhos — não apaga: o código ainda usa o botão e as dicas)
  const card = $('menu').querySelector('.card');
  for (const e of card.children) if (e.tagName !== 'H1' && !e.classList.contains('bigIcon')) e.style.display = 'none';
  const p = document.createElement('p'); p.className = 'sub'; p.textContent = 'Carregando as ruas…'; card.appendChild(p);
}

// spec 056: ?mapa=centro carrega o mapa antigo (só o Centro); o padrão é a área grande (3 × 3 km)
const dados = await (await fetch(Q.get('mapa') === 'centro' ? 'dados/centro.json' : 'dados/chapeco.json')).json();
const rede = criarRede(dados);
const S = criarSinais(dados, rede);              // spec 044: semáforos, PAREs, faixas e radares de verdade (OSM)

// --- renderizador, cena, câmera (mesmos valores do jogo.js)
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 1.5, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
renderer.setPixelRatio(pixelRatio);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.4, 1400);
const hemi = new THREE.HemisphereLight(0xeef7ff, 0xd9cfbd, 2.4); scene.add(hemi);          // mais luz que o bairro: prédios altos fazem muita parede na sombra (spec 044: chão neutro, não verde)
const sun = new THREE.DirectionalLight(0xfff1d6, 2.2); sun.position.set(60, 120, -40); scene.add(sun);
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 92 : 70; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const mundo = criarMundoCentro(scene, dados);
const clima = aplicaClimaCentro(scene, { tempo: TEMPO, hemi, sun, asfalto: mundo.asfalto });
const sinais = criarSinaisCentro(scene, S, dados);
const catedral = dados.marcos.find(m => m.nome.startsWith('Catedral')) || { x: 0, z: 0 };
const L0 = largada(dados, rede, 'Avenida Getúlio Vargas', catedral);
const vida = criarVida(dados, rede, S, { perto: L0 });   // spec 044/047: estacionados, árvores, postes e 35 carros andando (perto do jogador)
criarVidaMesh(scene, vida);
const casinhas = criarCasinhas(scene, dados, rede);          // spec 056: casinhas onde o OSM não tem prédio
const pintura = criarPinturaCentro(scene, dados, S, vida);   // spec 055: linha amarela, vagas, setas e PARE no chão
const carrosMesh = criarCarrosPatio(scene, vida.parados, vida.moveis.length);
// spec 056: o mapa grande em pedaços (só desenha o que está perto); ?pedacos=0 desliga (para medir)
const pedacos = Q.get('pedacos') === '0' ? null : dividirEmPedacos(scene, { alcance: Math.min(700, scene.fog.far + 60), tam: +(Q.get('tam') || 600), minTri: +(Q.get('minTri') || 20000), minInst: +(Q.get('minInst') || 500) });
const podeAndar = (x, z) => rede.podeAndar(x, z) && !vida.ocupa(x, z);
// spec 044: as regras do jogo no Centro — o MESMO fiscal do bairro, com a sinalização do OSM (sinais.js)
const fiscal = criarFiscal({ bairro: S.bairro, lei: LEI, fase: S.fase, naRua: S.naRua, limiteEm: S.limiteEm, clima: TEMPO === 'sol' ? null : TEMPO });   // spec 058: art. 220 VIII
const hud = criarHud();
function trataEventos(evs) {
  for (const e of evs) {
    if (e.tipo === 'infracao') {
      const radar = String(e.ref).startsWith('rc');
      sons.apito(); if (radar) sons.camera(); hud.infracao(e, radar);
      const rd = radar && S.radares.find(r => r.id === e.ref);
      if (rd) {                            // spec 051: a foto do radar (do poste na calçada da direita)
        const o = rd.largura ? rd.largura / 2 + 0.9 : 4.2, nome = (dados.ruas[+String(rd.rua).slice(1)]?.nome || '').replace(/ - [NSDELO]$/, '');
        const de = { x: rd.x - Math.cos(rd.heading) * o, y: 4.5, z: rd.z + Math.sin(rd.heading) * o };
        hud.fotoRadar({ img: fotoDoRadar(renderer, scene, de, carro.pos), kmh: Math.round(e.kmh), lim: rd.limiteKmh, rua: nome, quando: quandoAgora() });
      }
    }
    else if (e.tipo === 'acerto') { sons.ding(); hud.acerto(e); }
    else if (e.tipo === 'aviso' && e.motivo === 'contramao_unica') hud.avisoLei(e, '⛔');
    else if (e.tipo === 'aviso' && e.motivo === 'estacionou_errado') hud.avisoLei(e, '🅿️');
    else if (e.tipo === 'aviso' && e.motivo === 'chuva_rapido') hud.avisoLei(e, e.clima === 'neblina' ? '🌫️' : '🌧️');   // spec 058
  }
}
const carro = novoCarro(scene, { x: L0.x, z: L0.z, heading: L0.heading });
carro.mesh.pintar(COR);
carro.aderencia = TEMPO === 'chuva' ? 0.6 : 1;          // spec 058: na chuva o freio rende menos (como no bairro)
const sons = criarSons();

// --- controles
const pedais = criarPedais({ vmaxKmh: FIS.VMAX * 3.6 });
const keys = {};
// spec 059: o jeito do teclado escolhido no menu do jogo ('setas' ou 'wasd'); ?teclas=… força; ?capture = 'setas'
const TECLAS = MODOS_TECLAS.includes(Q.get('teclas')) ? Q.get('teclas') : CAPTURE ? 'setas' : (MODOS_TECLAS.includes(ler(LS_TECLAS)) ? ler(LS_TECLAS) : 'setas');
const teclado = criarTeclado(TECLAS);
addEventListener('keydown', e => {
  keys[e.code] = true; if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); if (e.code === 'KeyH') buzinar();
  // spec 046: pisca (A/D ou ← →, conforme o jeito do teclado); R ré — iguais ao bairro
  if (!e.repeat && estado === 'dirigindo') {
    const p = teclado.pisca(e.code); if (p) ligarSeta(p);
    if (e.code === 'KeyR') trocaMarcha();
  }
});
addEventListener('keyup', e => { keys[e.code] = false; });
$('pcPainel').innerHTML = teclado.painel() + '<div class="pcLinha"><kbd data-k="KeyH">H</kbd><span>buzina</span><kbd data-k="KeyR">R</kbd><span>ré</span></div>';
$('hintPc').innerHTML = teclado.dica().replace(' · C cinto', '');
const teclas = new Map([...document.querySelectorAll('#pcPainel kbd')].map(k => [k.dataset.k, k]));
addEventListener('keydown', e => teclas.get(e.code)?.classList.add('on'));
addEventListener('keyup', e => teclas.get(e.code)?.classList.remove('on'));
addEventListener('blur', () => { for (const k in keys) keys[k] = false; teclas.forEach(k => k.classList.remove('on')); });
document.querySelectorAll('.wheel').forEach(w => { w.innerHTML = wheelSVG(COR); });
const volante = criarVolanteToque($('thumb'), $('wheel'), () => buzinar());
function buzinar() { sons.buzina(); const w = $('wheel'); w.classList.remove('honk'); void w.offsetWidth; w.classList.add('honk'); }
for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) addEventListener(ev, e => {
  if (estado !== 'dirigindo' || (e.target.closest && e.target.closest('button, .ui, a'))) return;
  e.preventDefault();
  // spec 060: dedo na parte de cima da tela (longe do volante e dos pedais) = olhar para os lados
  const resto = olharLivre.toque(e, (x, y) => y < innerHeight * 0.55 && !volante.zona(x, y));   // spec 064: só os outros dedos
  if (!resto.changedTouches.length) return;
  volante.toque(resto); pedais.toque(resto);
}, { passive: false });
const olharLivre = criarOlharLivre();
for (const ev of ['mousedown', 'mousemove', 'mouseup']) addEventListener(ev, e => {
  if (estado !== 'dirigindo' || (e.target.closest && e.target.closest('button, .ui, a'))) return;
  // spec 060: no modo Teclado (ou na parte de cima da tela) arrastar o mouse = olhar para os lados
  if (olharLivre.ativo || (e.type === 'mousedown' && e.button === 0 && (APARELHO === 'pc' || e.clientY < innerHeight * 0.55))) {
    if (e.type === 'mousedown') olharLivre.pega('mouse', e.clientX); else if (e.type === 'mousemove') olharLivre.move('mouse', e.clientX); else olharLivre.solta('mouse');
    return;
  }
  if (APARELHO === 'pc') return;
  pedais.mouse(e);
});
let kbSteer = 0;
function entrada() {
  pedais.teclado(teclado.acel(keys, re), teclado.freio(keys, re), STEP);
  // spec 060: no teclado a direção vira aos poucos (1,9/s; volta 3,8/s) — toque rápido corrige pouco
  const quer = teclado.vira(keys) * 0.9, taxa = Math.abs(quer) > Math.abs(kbSteer) ? 1.9 : 3.8;
  kbSteer += Math.max(-taxa * STEP, Math.min(taxa * STEP, quer - kbSteer));
  // na ré, o acelerador (↑/W ou o da tela) anda para trás (como no bairro)
  return { steer: Math.max(-1, Math.min(1, volante.steer + kbSteer)), alvo: pedais.frac * FIS.VMAX, brake: pedais.freio ? 1 : 0, re };
}

// ---- spec 046: pisca (seta) e ré, como no bairro (jogo.js): tocar liga e pisca ~1,5 Hz com tique-taque; tocar de
// novo desliga; ligar um desliga o outro; desliga sozinho depois de virar (~60°) e endireitar o volante.
const PISCA_HZ = 1.5;
let seta = null, setaT0 = 0, setaH0 = 0, piscaAceso = false, re = false, reBip = 0;
function ligarSeta(lado) { seta = seta === lado ? null : lado; setaT0 = t; setaH0 = carro.heading; atualizaPisca(true); }
function atualizaPisca(forca = false) {
  const aceso = !!seta && Math.floor((t - setaT0) * PISCA_HZ * 2) % 2 === 0;
  if (aceso !== piscaAceso || forca) { if (seta && aceso !== piscaAceso) sons.tique(aceso); piscaAceso = aceso; }
  if (seta) {                                  // virou (≥ 60°) e endireitou o volante → desliga
    let dh = carro.heading - setaH0; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    if (Math.abs(dh) > 1.05 && Math.abs(carro.steer) < 0.12) { seta = null; piscaAceso = false; }
  }
  carro.seta = seta; carro.piscaAceso = piscaAceso;
  hud.setas(seta, piscaAceso);
}
document.querySelectorAll('.setaBtn[data-lado]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (estado === 'dirigindo') ligarSeta(b.dataset.lado); }));
function trocaMarcha() {
  if (estado !== 'dirigindo') return;
  if (Math.abs(carro.speed) > 0.5) { hud.msg('✋ Pare o carro para trocar a marcha', 1.8); return; }
  re = !re; carro.re = re; reBip = 0; $('reBtn').classList.toggle('on', re);
  hud.msg(re ? (APARELHO === 'pc' ? '🔙 Ré engatada — ' + teclado.reTexto() : '🔙 Ré engatada — o acelerador anda para trás') : '🚗 Marcha para frente', 2);
}
$('reBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); trocaMarcha(); });
function passoRe(dt) { if (re && carro.speed < -0.2) { reBip -= dt; if (reBip <= 0) { reBip = 0.9; sons.re(); } } else reBip = 0; }

// --- HUD: nome da rua no topo, velocidade em cima do carro (com o limite da rua ao lado)
const nomeCurto = n => (n || 'rua sem nome').replace(/ - [NSDELO]$/, '');
const velCarro = $('velCarro'), velN = $('velCarroN'), velLim = $('velCarroLim'), _vp = new THREE.Vector3();
let hudK = '', ruaK = '';
function hudCentro() {
  const r = rede.rumoEm(carro.pos.x, carro.pos.z), lim = r ? r.rua.limite : 40;
  const kmh = Math.round(Math.abs(carro.speed) * 3.6), k = kmh + '|' + lim;
  pedais.atualizar(Math.abs(carro.speed) * 3.6, lim);
  if (r && r.rua.nome !== ruaK) { ruaK = r.rua.nome; $('ruaNome').textContent = nomeCurto(ruaK); }
  _vp.set(carro.pos.x, 2.0, carro.pos.z).project(camera);
  velCarro.classList.toggle('hidden', estado !== 'dirigindo' || _vp.z > 1);
  velCarro.style.transform = `translate(${((_vp.x + 1) / 2 * innerWidth).toFixed(1)}px, ${((1 - _vp.y) / 2 * innerHeight - 4).toFixed(1)}px) translate(-50%, -100%)`;
  if (k !== hudK) { hudK = k; velN.textContent = kmh; velLim.textContent = lim; velCarro.classList.toggle('acima', kmh > lim); }
}

// --- câmera atrás do carro (CAM do jogo.js: em pé mais alta e recuada)
const CAM = { pe: { back: 11, up: 6, ahead: 20, lookY: -4 }, deitado: { back: 7.0, up: 3.6, ahead: 8, lookY: 1.2 } };
const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), snap: true }, _tp = new THREE.Vector3(), _tl = new THREE.Vector3();
function updateCamera(dt) {
  const c = carro, fx = Math.sin(c.heading), fz = Math.cos(c.heading), k = innerHeight > innerWidth ? CAM.pe : CAM.deitado;
  _tp.set(c.pos.x - fx * k.back, k.up, c.pos.z - fz * k.back); _tl.set(c.pos.x + fx * k.ahead, k.lookY, c.pos.z + fz * k.ahead);
  if (estado === 'menu') { const a = performance.now() * 0.00012; _tp.set(c.pos.x + Math.sin(a) * 60, 45, c.pos.z + Math.cos(a) * 60); _tl.set(c.pos.x, 0, c.pos.z); }
  if (cam.snap) { cam.pos.copy(_tp); cam.look.copy(_tl); cam.snap = false; }
  cam.pos.lerp(_tp, 1 - Math.exp(-dt * 6)); cam.look.lerp(_tl, 1 - Math.exp(-dt * 9));
  camera.position.copy(cam.pos);
  olharLivre.passo(dt); if (estado !== 'dirigindo') olharLivre.zera();
  if (olharLivre.ang) { giraEmVolta(camera.position, c.pos, olharLivre.ang); _tl.copy(cam.look); giraEmVolta(_tl, c.pos, olharLivre.ang); camera.lookAt(_tl); }   // spec 060
  else camera.lookAt(cam.look);
  camera.updateMatrixWorld();
}

// --- laço
const STEP = 1 / 120;
let acc = 0, t = 0, estado = 'menu';
function começar() {
  if (estado !== 'menu') return;
  sons.init(); estado = 'dirigindo'; cam.snap = true;
  $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
  $('thumb').classList.toggle('hidden', APARELHO === 'pc'); pedais.mostrar(true); pedais.layout('volante');
  $('pcPainel').classList.toggle('hidden', APARELHO !== 'pc');
  $('setas').classList.remove('hidden');                      // (no modo Teclado o CSS esconde)
}
$('playBtn').addEventListener('click', começar);
// spec 054: o que a câmera vê (até 260 m) — os carros não somem nem aparecem ali
const vista = new THREE.Frustum(), _pv = new THREE.Matrix4(), _esf = new THREE.Sphere(new THREE.Vector3(), 3);
const visto = (x, z) => Math.hypot(x - camera.position.x, z - camera.position.z) < 260 && vista.intersectsSphere((_esf.center.set(x, 1, z), _esf));
function update(dt) {
  t += dt;
  if (estado === 'dirigindo') {
    acc += dt;
    while (acc >= STEP) {
      acc -= STEP; stepCar(carro, entrada(), STEP, podeAndar);
      trataEventos(fiscal.tick({ t, carro: { x: carro.pos.x, z: carro.pos.z, heading: carro.heading, v: carro.speed }, pedestres: [], carros: vida.moveis, seta }, STEP));
    }
  }
  volante.passo(dt);
  sinais.atualizar(t);
  if (estado === 'dirigindo') { atualizaPisca(); passoRe(dt); }
  vista.setFromProjectionMatrix(_pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  vida.passo(dt, t, estado === 'dirigindo' ? { x: carro.pos.x, z: carro.pos.z, heading: carro.heading, v: Math.abs(carro.speed) } : null, visto); carrosMesh.sync(vida.moveis);
  syncMesh(carro, dt);
  updateCamera(dt);
  clima.atualizar(dt, camera.position);                 // spec 058: os pingos acompanham a câmera
  if (estado === 'dirigindo') { hudCentro(); const est = fiscal.estado(); hud.placar(est); hud.lados(est.pare); hud.tick(dt); }
  sons.motor(carro.speed, estado !== 'menu');
}
const render = () => { pedacos?.atualizar(camera); renderer.render(scene, camera); };
let fpsN = 0, fpsT = 0, baixo = 0;
function fpsTick(dt) {
  fpsN++; fpsT += dt;
  if (fpsT < 1) return;
  const fps = fpsN / fpsT;
  if (Q.has('fps') || CAPTURE) { $('fps').classList.remove('hidden'); $('fps').textContent = `${fps.toFixed(0)} fps · res ${pixelRatio.toFixed(2)}x`; }
  if (!CAPTURE) { baixo = fps < 45 ? baixo + 1 : 0; if (baixo >= 2 && pixelRatio > 0.8) { pixelRatio = Math.max(0.8, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); baixo = 0; } }
  fpsN = 0; fpsT = 0;
}
if (CAPTURE) {
  window.__centro = { dados, rede, carro, camera, renderer, scene, pedais, volante, keys, render, começar, get estado() { return estado; }, get t() { return t; },
    mundo, sinais, S, vida, pintura, pedacos, casinhas, TEMPO, clima, fiscal, ligarSeta, trocaMarcha, get seta() { return seta; }, get piscaAceso() { return piscaAceso; }, get re() { return re; }, L0, info: () => ({ draw: renderer.info.render.calls, tri: renderer.info.render.triangles }) };
  window.__step = (s = 1 / 30) => { const n = Math.max(1, Math.round(s * 30)); for (let i = 0; i < n; i++) update(1 / 30); render(); fpsTick(1 / 30); };
  if (!Q.has('menu')) começar();
  update(1 / 30); render();
} else {
  if (Q.has('go')) começar();                     // spec 045: veio do menu do jogo (mapa Chapecó) → já entra dirigindo
  let last = performance.now();
  renderer.setAnimationLoop(() => { const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); render(); fpsTick(dt); });
}
