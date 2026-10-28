// Spec 065/066 — dirigir no óculos (Meta Quest, WebXR immersive-vr), no Bairro (jogo.js) e em Chapecó (centro.js).
// A pessoa senta no banco do motorista e dirige com os controles: gatilho direito acelera, esquerdo freia; stick (qualquer
// um) ou os DOIS grips apertados segurando o volante no ar = volante; X/A = seta esquerda/direita; B = ré; Y = cinto;
// stick direito apertado = buzina; stick esquerdo apertado = recentralizar a vista. No relatório: A = de novo, B = sair.
// Botão "✕ Menu" no painel: encostar o controle nele (segurar ~½ s) sai do óculos e volta ao menu.
// O HUD do jogo é DOM (não aparece no óculos): este módulo copia o texto dele para dois painéis 3D — o painel do carro
// (velocidade, limite, ⭐, rumo ou rua) e o "para-brisa" (aviso, dica, GPS). Lições da skill vr-ar-threejs: câmera volta
// igual ao sair (pai, posição, near/far), near pequeno só no XR, nada de redimensionar o renderer durante a sessão.
// Spec 066: anti-enjoo (vinheta) com 3 níveis — forte (padrão: bordas escuras sempre que o carro anda, mais nas curvas,
// arrancadas e freadas), médio (só curva/arrancada/freada) e desligado. A 1ª versão era fraca demais para se ver.
import * as THREE from '../vendor/three.module.js';

const OLHO = new THREE.Vector3(0.38, 1.47, -0.3);    // olho do motorista no carro (local: +z frente, +x esquerda)
const LS_VINHETA = 'transitoFofo.vinheta';
export const NIVEIS_VINHETA = ['forte', 'medio', 'nao'];
export const NOME_VINHETA = { forte: 'forte', medio: 'médio', nao: 'desligado' };
const lsLer = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsGravar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } };

function painelCanvas(w, h, larg, alt) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(larg, alt), mat);
  mesh.userData.vrUI = true;
  return { c, g: c.getContext('2d'), tex, mat, mesh, chave: '' };
}
const FONTE = '"Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif';
function caixa(g, x, y, w, h, r, cor) { g.fillStyle = cor; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
function texto(g, txt, x, y, px, cor = '#fff', alinha = 'left', peso = 800, maxW) {
  g.font = `${peso} ${px}px ${FONTE}`; g.fillStyle = cor; g.textAlign = alinha; g.textBaseline = 'middle';
  g.fillText(txt, x, y, maxW);
}
function quebra(g, txt, px, peso, maxW) {        // quebra em linhas que cabem em maxW (no máx. 2)
  g.font = `${peso} ${px}px ${FONTE}`;
  const out = []; let cur = '';
  for (const w of txt.split(' ')) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur);
  return out.length > 2 ? [out[0], out.slice(1).join(' ')] : out;
}
const vis = el => !!el && !el.classList.contains('hidden');
const tx = el => (el ? el.textContent.trim() : '');
const sim = () => true, nada = () => {};

// jogo = { carro, estado(), re(), seta(), piscaAceso(), volanteGraus() (o ângulo do volante desenhado), ligarSeta(l),
//          trocaMarcha(), buzinar(), voltarMenu(), aoSair() } e, só no Bairro: cinto(), porCinto(), deNovo()
export function criarVR({ renderer, camera, botoes = [], jogo }) {
  const $ = id => document.getElementById(id);
  const J = { cinto: sim, porCinto: nada, deNovo: nada, ...jogo };
  const carroG = J.carro.mesh.group;
  // rig: base no olho do motorista (virada para a frente do carro) → ajuste do "recentralizar" → câmera
  const rig = new THREE.Group(); rig.name = 'vrRig'; rig.position.copy(OLHO); rig.rotation.y = Math.PI; rig.userData.vrUI = true;
  const ajuste = new THREE.Group(); ajuste.name = 'vrAjuste'; rig.add(ajuste);
  const lido = lsLer(LS_VINHETA);
  const api = { ativo: false, sessao: null, suportado: false, quadros: 0, recentrou: 0, ultimoVolante: 'stick',
    vinheta: NIVEIS_VINHETA.includes(lido) ? lido : lido === '0' ? 'nao' : 'forte', menuToque: 0 };

  // ---- volante 3D (gira com o volante do jogo) e painel do carro
  const volante = new THREE.Group(); volante.userData.vrUI = true;
  {
    const rosa = new THREE.MeshLambertMaterial({ color: 0xff5fa8 }), escuro = new THREE.MeshLambertMaterial({ color: 0x2a2a33 });
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 10, 32), escuro);
    const raio = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.02), escuro);
    const raio2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.02), escuro); raio2.position.y = -0.08;
    const miolo = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), rosa); miolo.scale.z = 0.5;
    const topo = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.03), rosa); topo.position.y = 0.17;   // marca do centro
    volante.add(aro, raio, raio2, miolo, topo);
    volante.position.set(OLHO.x, 1.06, 0.12);
    volante.rotation.order = 'YXZ'; volante.rotation.set(-0.45, Math.PI, 0);
  }
  const painel = painelCanvas(1024, 384, 0.56, 0.21);
  painel.mesh.position.set(OLHO.x, 1.2, 0.6); painel.mesh.rotation.order = 'YXZ'; painel.mesh.rotation.set(-0.35, Math.PI, 0);
  const brisa = painelCanvas(1024, 448, 1.4, 0.6125);          // "para-brisa": aviso/dica/GPS, logo acima do capô
  brisa.mesh.position.set(OLHO.x, 1.62, 2.0); brisa.mesh.rotation.y = Math.PI;
  brisa.mat.depthTest = false; brisa.mesh.renderOrder = 1000;  // carro da frente não corta o aviso
  // spec 066: botão "✕ Menu" no painel, à direita do volante (ao alcance da mão direita): encostar o controle e segurar
  const botMenu = painelCanvas(256, 256, 0.13, 0.13);
  botMenu.mesh.position.set(OLHO.x - 0.42, 1.13, 0.38); botMenu.mesh.rotation.order = 'YXZ'; botMenu.mesh.rotation.set(-0.5, Math.PI - 0.55, 0);   // virado para o rosto
  const cabine = new THREE.Group(); cabine.add(volante, painel.mesh, brisa.mesh, botMenu.mesh); cabine.visible = false; cabine.userData.vrUI = true;
  carroG.add(cabine);
  // a cabeça do motorista (esfera + cabelo) ficaria dentro dos olhos: some no óculos
  const cabeca = J.carro.mesh.body.children.filter(m => m.isMesh && m.geometry.type === 'SphereGeometry' && Math.abs(m.position.x - OLHO.x) < 0.01 && m.position.y > 1.4);

  // ---- vinheta anti-enjoo: plano preso à cabeça, transparente no meio e preto nas bordas. Ângulos medidos do centro
  // da vista: o Quest 3 vê ~±50° por olho, então o preto tem de começar ANTES disso (a 1ª versão ficava fora da vista).
  const VIN_Z = 0.2, VIN_L = 1.2;                               // plano de 1,2 m a 20 cm: cobre ±72°
  const raioPx = (graus, px) => Math.tan(graus * Math.PI / 180) * VIN_Z / (VIN_L / 2) * px;
  const vinCanvas = document.createElement('canvas'); vinCanvas.width = vinCanvas.height = 512;
  const vinTex = new THREE.CanvasTexture(vinCanvas);
  function desenhaVinheta(nivel) {             // forte: limpo até 22°, preto a partir de 38° · médio: 30° → 48°
    const g = vinCanvas.getContext('2d'), [a, b] = nivel === 'forte' ? [22, 38] : [30, 48];
    const gr = g.createRadialGradient(256, 256, raioPx(a, 256), 256, 256, raioPx(b, 256));
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.clearRect(0, 0, 512, 512); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); vinTex.needsUpdate = true;
  }
  desenhaVinheta(api.vinheta);
  const vinheta = new THREE.Mesh(new THREE.PlaneGeometry(VIN_L, VIN_L), new THREE.MeshBasicMaterial({ map: vinTex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
  vinheta.position.z = -VIN_Z; vinheta.renderOrder = 1001; vinheta.visible = false; vinheta.userData.vrUI = true;
  let yawAnt = null, velAnt = null, vinAlvo = 0;

  // ---- controles: grips do three (pose) + gamepad (botões)
  const maos = {};
  const bolinhaMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (let i = 0; i < 2; i++) {
    const grip = renderer.xr.getControllerGrip(i);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), bolinhaMat); m.scale.set(1, 0.8, 1.6); grip.add(m);
    grip.addEventListener('connected', e => { grip.userData.mao = e.data.handedness; maos[e.data.handedness] = grip; });
    grip.addEventListener('disconnected', () => { if (maos[grip.userData.mao] === grip) delete maos[grip.userData.mao]; });
    ajuste.add(grip);
  }
  const ant = {};                 // botões apertados no quadro anterior (para pegar só a "descida")
  const ent = { gas: 0, freio: 0, graus: 0 };
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  function lerControles() {
    const s = api.sessao; if (!s) return;
    const g = {};
    for (const src of s.inputSources) if (src.gamepad && src.handedness) g[src.handedness] = src.gamepad;
    const v = (gp, i) => (gp && gp.buttons[i] ? gp.buttons[i].value : 0);
    const desceu = (mao, i) => { const k = mao + i, p = v(g[mao], i) > 0.5, d = p && !ant[k]; ant[k] = p; return d; };
    ent.gas = v(g.right, 0); ent.freio = v(g.left, 0);
    // volante: os 2 grips apertados = segurar o volante (ângulo da linha entre as mãos); senão o stick
    const segura = v(g.left, 1) > 0.5 && v(g.right, 1) > 0.5 && maos.left && maos.right;
    if (segura) {
      _a.copy(maos.left.position).applyEuler(ajuste.rotation); _b.copy(maos.right.position).applyEuler(ajuste.rotation);
      const dx = _b.x - _a.x, dy = _b.y - _a.y;
      if (dx > 0.08) { ent.graus = Math.max(-120, Math.min(120, -Math.atan2(dy, dx) * 180 / Math.PI)); api.ultimoVolante = 'maos'; }
    } else {
      const sx = [g.left, g.right].map(gp => (gp && gp.axes.length >= 4 ? gp.axes[2] : 0)).reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
      ent.graus = Math.abs(sx) < 0.08 ? 0 : sx * 90; api.ultimoVolante = 'stick';
    }
    const est = J.estado();
    if (est === 'relatorio') {
      if (desceu('right', 4)) J.deNovo();
      if (desceu('right', 5)) sair();
    } else if (est === 'dirigindo') {
      if (desceu('left', 4)) J.ligarSeta('esq');
      if (desceu('right', 4)) J.ligarSeta('dir');
      if (desceu('right', 5)) J.trocaMarcha();
      if (desceu('left', 5)) J.porCinto();
      if (desceu('right', 3)) J.buzinar();
    }
    if (desceu('left', 3)) recentrar();
  }
  // a vista "para a frente" passa a ser para onde a cabeça olha agora (e a cabeça volta para o banco)
  function recentrar() {
    const yaw = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y;
    ajuste.rotation.y = -yaw;
    ajuste.position.copy(camera.position).applyEuler(ajuste.rotation).negate();
    api.recentrou++;
  }

  // ---- botão ✕ Menu: um controle a menos de 8 cm dele por MENU_SEG enche o anel e volta ao menu
  const MENU_SEG = 0.5, _m = new THREE.Vector3(), _g = new THREE.Vector3();
  let menuT = 0, indoMenu = false;
  function desenhaBotMenu(frac) {
    const k = frac.toFixed(2); if (k === botMenu.chave) return; botMenu.chave = k;
    const g = botMenu.g;
    g.clearRect(0, 0, 256, 256);
    g.beginPath(); g.arc(128, 110, 92, 0, Math.PI * 2); g.fillStyle = frac > 0 ? '#ff2d6f' : 'rgba(40,20,45,0.9)'; g.fill();
    g.lineWidth = 10; g.strokeStyle = '#fff'; g.stroke();
    if (frac > 0) { g.beginPath(); g.arc(128, 110, 92, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); g.lineWidth = 18; g.strokeStyle = '#ffe066'; g.stroke(); }
    texto(g, '✕', 128, 104, 110, '#fff', 'center', 900);
    texto(g, 'Menu', 128, 232, 44, '#fff', 'center', 900);
    botMenu.tex.needsUpdate = true;
  }
  function passoMenu(dt) {
    botMenu.mesh.getWorldPosition(_m);
    let perto = false;
    for (const mao of Object.values(maos)) { mao.getWorldPosition(_g); if (_g.distanceTo(_m) < 0.08) perto = true; }
    menuT = perto ? menuT + dt : 0;
    desenhaBotMenu(Math.min(1, menuT / MENU_SEG));
    if (menuT >= MENU_SEG && !indoMenu) { api.menuToque++; irMenu(); }
  }
  function irMenu() { indoMenu = true; sair(); }

  // ---- painéis: copiam o HUD do DOM (só redesenha quando o texto muda). Bairro: velTxt/limPlaca/velBox; Chapecó:
  // velCarroN/velCarroLim/velCarro e o nome da rua no lugar do rumo da missão.
  function desenhaPainel() {
    const kmh = tx($('velTxt') || $('velCarroN')), lim = tx($('limPlaca') || $('velCarroLim'));
    const acima = ($('velBox') || $('velCarro')).classList.contains('acima');
    const re = J.re(), seta = J.seta(), pisca = J.piscaAceso(), cinto = J.cinto();
    const rua = $('ruaNome') ? tx($('ruaNome')) : '';
    const rumo = tx($('rumoTxt')), rot = rua ? '' : ($('seta').style.transform || ''), estrelas = tx($('estrelas')), din = tx($('dinheiro')), cnh = tx($('pontosCnh'));
    const prox = vis($('proximo')) ? tx($('proximo')) : '';
    const lados = [vis($('ladoEsq')) ? tx($('ladoEsq')) : '', vis($('ladoDir')) ? tx($('ladoDir')) : ''];
    const k = [kmh, lim, acima, re, seta, pisca, cinto, rua, rumo, rot, estrelas, din, cnh, prox, ...lados].join('|');
    if (k === painel.chave) return; painel.chave = k;
    const g = painel.g, W = 1024, H = 384;
    g.clearRect(0, 0, W, H);
    caixa(g, 4, 4, W - 8, H - 8, 46, 'rgba(40,20,45,0.88)');
    // velocidade + placa do limite
    texto(g, re ? 'R' : kmh, 190, 150, 150, acima ? '#ff5a6e' : '#fff', 'center', 900);
    texto(g, re ? 'ré' : 'km/h', 190, 250, 44, '#ffd1e8', 'center');
    g.beginPath(); g.arc(400, 160, 86, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 22; g.strokeStyle = '#e8102a'; g.stroke();
    texto(g, lim, 400, 164, 84, '#111', 'center', 900);
    // placar
    texto(g, `⭐ ${estrelas}`, 560, 80, 58, '#ffe066');
    texto(g, `💰 ${din}`, 560, 160, 50, '#fff');
    texto(g, `🪪 ${cnh} pts`, 560, 236, 46, '#fff');
    if (rua) {                       // Chapecó: o nome da rua (passeio livre, sem rumo de missão)
      texto(g, '📍', 905, 110, 70, '#fff', 'center');
      for (const [i, l] of quebra(g, rua, 38, 800, 230).entries()) texto(g, l, 905, 190 + i * 44, 38, '#fff', 'center', 800, 230);
    } else {                         // rumo da missão (a seta do HUD gira com "rotate(Ndeg)")
      const ang = (parseFloat((rot.match(/-?[\d.]+/) || ['0'])[0]) || 0) * Math.PI / 180;
      g.save(); g.translate(905, 120); g.rotate(ang); g.fillStyle = '#ff4fa3';
      g.beginPath(); g.moveTo(0, -58); g.lineTo(46, 4); g.lineTo(16, 4); g.lineTo(16, 56); g.lineTo(-16, 56); g.lineTo(-16, 4); g.lineTo(-46, 4); g.closePath(); g.fill(); g.restore();
      texto(g, rumo, 905, 220, 46, '#fff', 'center');
    }
    // linha de baixo: setas (pisca), cinto, próximo, lados no PARE
    texto(g, '⬅', 60, 330, 70, seta === 'esq' && pisca ? '#ffb000' : 'rgba(255,255,255,0.25)', 'center', 900);
    texto(g, '➡', 964, 330, 70, seta === 'dir' && pisca ? '#ffb000' : 'rgba(255,255,255,0.25)', 'center', 900);
    texto(g, cinto ? '🔒' : '🔓 cinto: Y', 120, 330, 44, cinto ? '#9dffb0' : '#ff8a8a');
    const linha = lados[0] || lados[1] ? `${lados[0]}  olhe os lados  ${lados[1]}` : prox;
    texto(g, linha, 650, 330, 42, '#fff', 'center', 800, 470);
    painel.tex.needsUpdate = true;
  }
  const AJUDA = () => ['🥽 Gatilho direito acelera · esquerdo freia',
    `Stick ou os 2 grips no volante · X/A seta${jogo.cinto ? ' · Y cinto' : ''} · B ré · ✕ Menu: encoste o controle`];
  let ajudaAte = 0;
  function desenhaBrisa(t) {
    let l1 = '', l2 = '', l3 = '', cor = 'rgba(255,79,163,0.92)';
    const est = J.estado();
    if (est === 'relatorio') {
      l1 = `${tx($('relTitulo'))} ⭐ ${tx($('relEstrelas'))}`; l2 = `💰 Multas ${tx($('relTotal'))} · 🪪 ${tx($('relPontos'))} pts`;
      l3 = 'A = dirigir de novo · B = sair do óculos'; cor = 'rgba(30,140,90,0.92)';
    } else if (vis($('aviso'))) { l1 = tx($('avisoTitulo')); l2 = tx($('avisoLinha')); l3 = tx($('avisoExplica')); cor = 'rgba(200,20,50,0.92)'; }
    else if (vis($('dica'))) { l1 = tx($('dicaTxt')); l2 = vis($('dicaSub')) ? tx($('dicaSub')) : ''; cor = 'rgba(40,90,200,0.92)'; }
    else if (vis($('msg'))) l1 = tx($('msg'));
    else if (t < ajudaAte) { [l1, l2] = AJUDA(); cor = 'rgba(60,40,90,0.9)'; }
    l1 = l1.replace('(C)', '(botão Y)');
    const gps = vis($('gps')) ? `${tx($('gpsTxt'))} ${tx($('gpsSub'))}`.trim() : '';
    const k = [l1, l2, l3, cor, gps].join('|');
    if (k === brisa.chave) return; brisa.chave = k;
    const g = brisa.g, W = 1024, H = 448;
    g.clearRect(0, 0, W, H);
    if (l1) {               // a caixa cresce com as linhas (frase longa quebra em até 2 linhas)
      const L = [...quebra(g, l1, 54, 900, W - 70).map(x => [x, 54, 900, '#fff']), ...[l2, l3].filter(Boolean).flatMap((x, i) => quebra(g, x, 40, 700, W - 70).map(y => [y, 40, 700, i ? '#ffe9f3' : '#fff']))].slice(0, 5);
      const alt = L.reduce((a, [, px]) => a + px * 1.3, 0) + 34;
      caixa(g, 8, 8, W - 16, alt, 36, cor);
      let y = 25; for (const [x, px, peso, c] of L) { y += px * 0.65; texto(g, x, W / 2, y, px, c, 'center', peso, W - 60); y += px * 0.65; }
    }
    if (gps) { caixa(g, 92, H - 104, W - 184, 96, 32, 'rgba(30,100,230,0.94)'); texto(g, gps, W / 2, H - 56, 46, '#fff', 'center', 900, W - 220); }
    brisa.tex.needsUpdate = true;
  }

  // ---- entrar / sair
  let guardado = null, tPainel = 0;
  async function entrar() {
    if (api.ativo || !navigator.xr) return false;
    let s;
    try { s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] }); }
    catch (e) { console.warn('VR: não deu para entrar', e); return false; }
    guardado = { pai: camera.parent, pos: camera.position.clone(), quat: camera.quaternion.clone(), near: camera.near, far: camera.far, fov: camera.fov };
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');        // origem = cabeça ao entrar: sentado ou em pé, o olho vai para o banco
    camera.near = 0.05; camera.updateProjectionMatrix();
    carroG.add(rig); ajuste.add(camera); camera.add(vinheta); ajuste.position.set(0, 0, 0); ajuste.rotation.set(0, 0, 0);
    camera.position.set(0, 0, 0); camera.quaternion.identity();
    for (const m of cabeca) m.visible = false;
    cabine.visible = true; painel.chave = brisa.chave = botMenu.chave = ''; api.quadros = 0; yawAnt = velAnt = null; vinAlvo = 0;
    menuT = 0; indoMenu = false;
    s.addEventListener('end', aoTerminar);
    api.sessao = s; api.ativo = true;
    await renderer.xr.setSession(s);
    ajudaAte = performance.now() / 1000 + 10;
    return true;
  }
  function sair() { if (api.sessao) api.sessao.end().catch(() => aoTerminar()); }
  function aoTerminar() {
    if (!api.ativo) return;
    api.ativo = false; api.sessao = null;
    renderer.xr.enabled = false;
    rig.removeFromParent(); vinheta.removeFromParent();
    const g = guardado;
    if (g.pai) g.pai.add(camera); else camera.removeFromParent();
    camera.position.copy(g.pos); camera.quaternion.copy(g.quat); camera.near = g.near; camera.far = g.far; camera.fov = g.fov; camera.updateProjectionMatrix();
    for (const m of cabeca) m.visible = true;
    cabine.visible = false; vinheta.visible = false;
    J.aoSair();
    if (indoMenu) { indoMenu = false; J.voltarMenu(); }
  }

  // a cada quadro do jogo (depois do syncMesh do carro), só no óculos
  function passo(dt) {
    if (!api.ativo) return;
    api.quadros++;
    if (api.quadros === 12) recentrar();                 // olha para a frente do carro, esteja a pessoa virada para onde for
    lerControles();
    const t = performance.now() / 1000;
    if (t - tPainel > 0.1) { tPainel = t; desenhaPainel(); desenhaBrisa(t); }
    passoMenu(dt);
    volante.rotation.z = (J.volanteGraus ? J.volanteGraus() : ent.graus) * Math.PI / 180;
    // vinheta: o que mais enjoa é o mundo girar (curva) e mudar de velocidade (arrancada/freada) sem o corpo sentir
    const c = J.carro, h = c.heading;
    const yr = yawAnt === null || dt <= 0 ? 0 : Math.abs(((h - yawAnt + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) / dt;
    const ac = velAnt === null || dt <= 0 ? 0 : Math.abs(c.speed - velAnt) / dt;
    yawAnt = h; velAnt = c.speed;
    const anda = Math.abs(c.speed) > 1.5;                                 // > ~5 km/h
    vinAlvo = api.vinheta === 'forte' ? Math.max(anda ? 0.55 : 0, Math.min(1, yr / 0.35), Math.min(1, ac / 2))
      : api.vinheta === 'medio' ? Math.max(Math.min(1, (yr - 0.1) / 0.5), Math.min(1, (ac - 0.8) / 2.5)) * 0.9 : 0;
    const o = vinheta.material.opacity;                                   // escurece rápido, clareia devagar
    vinheta.material.opacity = Math.max(0, o + (vinAlvo - o) * Math.min(1, dt * (vinAlvo > o ? 10 : 2.5)));
    vinheta.visible = vinheta.material.opacity > 0.02;
    // a câmera XR desta pose já está pronta: atualiza agora para a vinheta (filha da câmera) não andar 1 quadro atrás
    carroG.updateMatrixWorld(true); renderer.xr.updateCamera(camera); camera.updateMatrixWorld(true);
  }

  // entrada do carro no óculos: o jogo usa no playerInput/entrada (volante em graus, acelerador/freio analógicos)
  const input = () => ({ gas: ent.gas, brake: ent.freio, graus: ent.graus });

  function estado() {
    const c = J.carro, w = new THREE.Vector3(); camera.getWorldPosition(w);
    return { ativo: api.ativo, quadros: api.quadros, recentrou: api.recentrou, volante: api.ultimoVolante, ent: { ...ent },
      carro: { x: c.pos.x, z: c.pos.z, heading: c.heading, kmh: c.speed * 3.6, steer: c.steer },
      olhoMundo: w.toArray(), camPai: camera.parent ? camera.parent.name || camera.parent.type : null,
      near: camera.near, painel: painel.chave, brisa: brisa.chave, vinheta: vinheta.material.opacity, vinhetaNivel: api.vinheta,
      vinhetaVisivel: vinheta.visible && vinheta.parent === camera, menuToque: api.menuToque, menuCarga: menuT,
      calls: renderer.info.render.calls, quadro: renderer.info.render.frame, jogo: J.estado(), cinto: J.cinto(), seta: J.seta(), re: J.re(),
      volanteGraus: J.volanteGraus ? J.volanteGraus() : ent.graus };
  }
  // posição do botão ✕ Menu no mundo (para o teste encostar o controle nele)
  const posMenu = () => ajuste.worldToLocal(botMenu.mesh.getWorldPosition(new THREE.Vector3())).toArray();   // no espaço dos controles
  const posMao = lado => (maos[lado] ? maos[lado].position.toArray() : null);

  // botão só aparece se o aparelho tiver VR (Quest: sim; celular/PC: continua escondido)
  if (navigator.xr && navigator.xr.isSessionSupported) {
    navigator.xr.isSessionSupported('immersive-vr').then(ok => { api.suportado = ok; if (ok) for (const b of botoes) b.classList.remove('hidden'); }).catch(() => {});
  }
  const _olho = new THREE.Vector3();
  const olho = () => camera.getWorldPosition(_olho);      // posição da cabeça no mundo (chuva, setas da rota, pedaços)
  function trocaVinheta() {                                 // forte → médio → desligado → forte
    api.vinheta = NIVEIS_VINHETA[(NIVEIS_VINHETA.indexOf(api.vinheta) + 1) % NIVEIS_VINHETA.length];
    lsGravar(LS_VINHETA, api.vinheta); if (api.vinheta !== 'nao') desenhaVinheta(api.vinheta);
    return api.vinheta;
  }

  return Object.assign(api, { entrar, sair, passo, input, estado, recentrar, trocaVinheta, olho, irMenu, posMenu, posMao });
}
