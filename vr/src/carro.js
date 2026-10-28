// O carrinho do jogador: modelo 3D fofo (adaptado do makeCar do Martina Kart) e física de carro de rua
// (sem drift, sem pista: anda livre em x,z e o prédio/calçada barra).
import * as THREE from '../vendor/three.module.js';
import { canvasTex } from './mundo.js';

// física (m/s, m/s², rad/s). Velocidade máxima ~70 km/h; freio forte de verdade; soltar = desacelera devagar.
export const FIS = { ACC: 5.0, FREIO: 8.0, VMAX: 100 / 3.6,   // spec 040: 100 (era 70) para a estrada de 80
   RE: 4.0, A_LAT: 6.5, VOLANTE_MAX: 1.9 };
const FIS_PADRAO = FIS;
// controle por pedais (spec 005): o acelerador dá uma VELOCIDADE-ALVO e o carro chega nela suave e segura ali.
//   ACC   = aceleração máxima (longe do alvo); TAU = constante de tempo da chegada (perto do alvo é exponencial: não passa)
//   EMBALO = desaceleração com o pé fora (rolando); FREIO = pedal do freio; CURVA = quanto a direção automática
//   pode frear sozinha antes de uma curva fechada (senão o carro não faz a esquina).
export const PEDAL = { ACC: 3.2, TAU: 0.8, EMBALO: 1.25, FREIO: 6.5, CURVA: 3.5 };

function starShape(pontas = 5, r1 = 0.62, r0 = 0.27) {
  const s = new THREE.Shape();
  for (let i = 0; i <= pontas * 2; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / pontas, r = i % 2 ? r0 : r1;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}
// modelos do carrinho do jogador: cor da carroceria + enfeite (coração ou estrela)
export const MODELOS = {
  rosa: { cor: 0xff5fa8, enfeite: 'coracao' },
  azul: { cor: 0x3d8bff, enfeite: 'estrela' },
};
function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.15, -0.3, -0.6, -0.1, -0.6, 0.2); s.bezierCurveTo(-0.6, 0.55, -0.15, 0.6, 0, 0.3);
  s.bezierCurveTo(0.15, 0.6, 0.6, 0.55, 0.6, 0.2); s.bezierCurveTo(0.6, -0.1, 0.15, -0.3, 0, -0.5);
  return s;
}

// várias caixas [sx, sy, sz, x, y, z] numa geometria só (1 draw call)
function juntaCaixas(lista) {
  const pos = [], nor = [], idx = [];
  for (const [sx, sy, sz, x, y, z] of lista) {
    const b = new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z), base = pos.length / 3;
    pos.push(...b.attributes.position.array); nor.push(...b.attributes.normal.array);
    idx.push(...Array.from(b.index.array, i => i + base));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

export function makeCar(scene, o = {}) {
  const corpo = o.cor ?? 0xff5fa8, detalhe = o.detalhe ?? 0xffffff;
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const M = (c, extra = {}) => new THREE.MeshPhongMaterial({ color: c, shininess: 70, specular: 0x555555, ...extra });
  const bodyMat = M(corpo), whiteMat = M(detalhe), darkMat = new THREE.MeshLambertMaterial({ color: 0x26262e });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x9fd8ff, shininess: 120, transparent: true, opacity: 0.55 });
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xfff2b0, emissiveIntensity: 0.9 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xff2030, emissive: 0xff0010, emissiveIntensity: 0.6 });
  const add = (geo, mat, x, y, z, par = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; };
  // local: +z = frente, +x = ESQUERDA do motorista (o carro gira pelo heading), y = cima
  add(new THREE.BoxGeometry(1.7, 0.6, 3.3), bodyMat, 0, 0.7, 0);                 // chassi
  add(new THREE.BoxGeometry(1.66, 0.18, 1.0), bodyMat, 0, 1.04, 1.1);            // capô
  // cabine: colunas + vidros + teto branco
  add(new THREE.BoxGeometry(1.5, 0.75, 1.7), glassMat, 0, 1.38, -0.25);
  for (const [x, z] of [[0.72, 0.58], [-0.72, 0.58], [0.72, -1.06], [-0.72, -1.06]]) add(new THREE.BoxGeometry(0.1, 0.75, 0.12), bodyMat, x, 1.38, z);
  add(new THREE.BoxGeometry(1.62, 0.14, 1.85), whiteMat, 0, 1.8, -0.25);
  // para-choques, faróis, lanternas
  add(new THREE.BoxGeometry(1.76, 0.24, 0.2), whiteMat, 0, 0.5, 1.66);
  add(new THREE.BoxGeometry(1.76, 0.24, 0.2), whiteMat, 0, 0.5, -1.66);
  for (const sx of [-0.55, 0.55]) {
    const hl = add(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 14), lightMat, sx, 0.84, 1.66); hl.rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(0.34, 0.2, 0.06), tailMat, sx, 0.84, -1.66);
  }
  // coração na traseira e nas portas (sem logo de marca)
  const heartGeo = new THREE.ExtrudeGeometry(heartShape(), { depth: 0.08, bevelEnabled: false, curveSegments: 8 });
  const heartMat = M(0xffffff);
  const starGeo = new THREE.ExtrudeGeometry(starShape(), { depth: 0.08, bevelEnabled: false });
  const enfeites = { coracao: [], estrela: [] };
  for (const [tipo, geo] of [['coracao', heartGeo], ['estrela', starGeo]]) {
    const hb = add(geo, heartMat, 0, 1.0, -1.7); hb.scale.setScalar(0.45); hb.rotation.y = Math.PI; enfeites[tipo].push(hb);
    for (const sx of [-0.86, 0.86]) { const h = add(geo, heartMat, sx, 0.78, 0.1); h.scale.setScalar(0.5); h.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; enfeites[tipo].push(h); }
  }
  // troca o modelo (menu): cor da carroceria + coração/estrela
  function pintar(nome) {
    const m = MODELOS[nome] || MODELOS.rosa;
    bodyMat.color.set(m.cor);
    for (const [tipo, lista] of Object.entries(enfeites)) for (const e of lista) e.visible = tipo === m.enfeite;
  }
  pintar(o.modelo || 'rosa');
  // retrovisores
  for (const sx of [-0.92, 0.92]) add(new THREE.BoxGeometry(0.22, 0.16, 0.1), bodyMat, sx, 1.2, 0.5);
  // motorista (à esquerda) e a vovó (à direita), vistos pelo vidro
  const pele = new THREE.MeshLambertMaterial({ color: 0xf7d0bb });
  add(new THREE.SphereGeometry(0.24, 14, 10), pele, 0.38, 1.52, -0.35);
  add(new THREE.SphereGeometry(0.25, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshLambertMaterial({ color: 0x8a5a33 }), 0.38, 1.57, -0.37);
  add(new THREE.SphereGeometry(0.23, 14, 10), pele, -0.38, 1.5, -0.35);
  const cabeloVo = new THREE.MeshLambertMaterial({ color: 0xf2f2f6 });
  add(new THREE.SphereGeometry(0.245, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), cabeloVo, -0.38, 1.54, -0.37);
  add(new THREE.SphereGeometry(0.11, 10, 8), cabeloVo, -0.38, 1.76, -0.5);            // coque
  // rodas
  const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 18); wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.32, 8); rimGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshLambertMaterial({ color: 0x1c1c22 }), rimMat = M(0xffffff);
  const wheels = [];
  for (const [x, z] of [[-0.82, 1.08], [0.82, 1.08], [-0.82, -1.08], [0.82, -1.08]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.4, z); g.add(pivot);
    const w = new THREE.Mesh(wheelGeo, tireMat); pivot.add(w); w.add(new THREE.Mesh(rimGeo, rimMat));
    wheels.push({ pivot, w, front: z > 0 });
  }
  // sombrinha
  const blobTex = canvasTex(64, 64, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }, false);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.06; g.add(blob);
  // luz de freio acende; luz de ré (branca, no para-choque de trás) acende com a ré engatada
  const freioLuz = tailMat;
  const reApagada = new THREE.MeshLambertMaterial({ color: 0xd8d8d8, emissive: 0x000000 });
  const reAcesa = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 });
  const reLuz = add(juntaCaixas([[0.26, 0.14, 0.04, 0.32, 0.5, -1.78], [0.26, 0.14, 0.04, -0.32, 0.5, -1.78]]), reApagada, 0, 0, 0);
  // spec 007: setas (pisca) âmbar — frente, trás e no retrovisor, 1 malha por lado (caixas juntas numa geometria).
  // Piscar = trocar o material (apagado ↔ aceso); nada de luz real.
  const piscaApagado = new THREE.MeshLambertMaterial({ color: 0xb36b00, emissive: 0x000000 });
  const piscaAceso = new THREE.MeshLambertMaterial({ color: 0xffc23a, emissive: 0xff9a00, emissiveIntensity: 1 });   // mesmo tipo: troca sem compilar shader
  const pisca = {};
  for (const [lado, sx] of [['esq', 1], ['dir', -1]]) {           // +x = esquerda do motorista
    const geo = juntaCaixas([
      [0.2, 0.16, 0.08, sx * 0.78, 0.84, 1.68],                    // frente
      [0.17, 0.34, 0.08, sx * 0.79, 0.84, -1.68],                  // trás (o que a câmera vê): ao lado da lanterna vermelha
      [0.06, 0.1, 0.12, sx * 1.04, 1.2, 0.5],                      // repetidor no retrovisor
    ]);
    pisca[lado] = add(geo, piscaApagado, 0, 0, 0);
  }
  scene.add(g);
  return { group: g, body, wheels, freioLuz, pisca, piscaApagado, piscaAceso, reLuz, reApagada, reAcesa, pintar };
}

export function novoCarro(scene, origem) {
  return { pos: { x: origem.x, z: origem.z }, heading: origem.heading, speed: 0, steer: 0, batidas: 0, bump: 0,
    freando: false, honks: 0, mesh: makeCar(scene) };
}

// pedais: inp.alvo (m/s) = o que o acelerador pede; inp.teto (m/s) = máximo da curva à frente; inp.brake vence tudo
function pedalSpeed(c, inp, dt, FIS) {
  const brk = inp.brake || 0;
  c.freando = brk > 0 && c.speed > 0.2;
  const ad = c.aderencia ?? 1;     // spec 029: na chuva o pneu segura menos (freia mais longe, curva mais aberta)
  if (brk > 0) { c.speed = c.speed > 0 ? Math.max(0, c.speed - PEDAL.FREIO * ad * brk * dt) : Math.min(0, c.speed + PEDAL.FREIO * ad * dt); return; }
  if (inp.re) {                 // ré engatada: o acelerador dá a velocidade para trás (até FIS.RE), sem teto de curva
    if (inp.alvo <= 0) { c.speed = c.speed < 0 ? Math.min(0, c.speed + PEDAL.EMBALO * dt) : Math.max(0, c.speed - PEDAL.EMBALO * dt); return; }
    const err = -Math.min(inp.alvo, FIS.RE) - c.speed;
    c.speed += Math.max(-PEDAL.ACC, Math.min(PEDAL.EMBALO, err / PEDAL.TAU)) * dt;
    return;
  }
  let alvo = Math.max(0, Math.min(inp.alvo, FIS.VMAX)), dec = PEDAL.EMBALO;
  if (inp.teto !== undefined && inp.teto < alvo) { alvo = inp.teto; if (c.speed > alvo) dec = PEDAL.CURVA; }
  const err = alvo - c.speed;
  if (err > 0) c.speed += Math.min(err / PEDAL.TAU, PEDAL.ACC * (1 - 0.35 * c.speed / FIS.VMAX)) * dt;
  else c.speed -= Math.min(-err / PEDAL.TAU, dec) * dt;
  if (alvo === 0 && Math.abs(c.speed) < 0.12) c.speed = 0;
}

// um passo de física. inp = { steer -1..1 (+ = esquerda), gas 0..1, brake 0..1, re: segurar o freio parado dá ré }
// ou, no modo pedais, { steer, alvo (m/s), teto? (m/s), brake 0..1, re?: ré engatada (alvo vira velocidade para trás) }
export function stepCar(c, inp, dt, podeAndar) {
  const FIS = c.fis || FIS_PADRAO;                        // c.fis: física especial (só o piloto de teste ?auto=errado usa)
  c.steer += (inp.steer - c.steer) * Math.min(1, dt * 6);
  const gas = inp.gas || 0, brk = inp.brake || 0;
  c.freando = brk > 0 && c.speed > 0.2;
  if (inp.alvo !== undefined) pedalSpeed(c, inp, dt, FIS);
  else if (gas > 0) {
    if (c.speed < -0.05) c.speed = Math.min(0, c.speed + FIS.FREIO * dt);            // estava de ré: segura
    else c.speed += FIS.ACC * gas * Math.max(0, 1 - c.speed / FIS.VMAX) * dt;
  }
  if (brk > 0 && inp.alvo === undefined) {
    if (c.speed > 0.2) c.speed = Math.max(0, c.speed - FIS.FREIO * (c.aderencia ?? 1) * brk * dt);
    else if (inp.re && !gas) c.speed = Math.max(-FIS.RE, Math.min(c.speed, 0) - 2.5 * brk * dt);   // parado e segurando: ré
    else if (c.speed < -0.2) c.speed = Math.min(0, c.speed + FIS.FREIO * brk * dt);
    else c.speed = 0;
  }
  if (!gas && !brk && inp.alvo === undefined) {                                         // solto: freio-motor + rolamento
    const s = Math.sign(c.speed), dec = Math.abs(c.speed) * 0.12 + 0.45;
    c.speed = Math.abs(c.speed) <= dec * dt ? 0 : c.speed - s * dec * dt;
  }
  const sp = Math.abs(c.speed);
  const yawMax = Math.min(FIS.VOLANTE_MAX * Math.min(1, sp / 3), FIS.A_LAT * (c.aderencia ?? 1) / Math.max(sp, 1));
  c.heading += c.steer * yawMax * Math.sign(c.speed) * dt;

  const ox = c.pos.x, oz = c.pos.z;
  const nx = ox + Math.sin(c.heading) * c.speed * dt, nz = oz + Math.cos(c.heading) * c.speed * dt;
  if (podeAndar(nx, nz)) { c.pos.x = nx; c.pos.z = nz; return; }
  // bateu no meio-fio / prédio: tenta escorregar ao longo da parede, senão para e volta um tiquinho
  const forte = sp > 3;
  if (podeAndar(nx, oz)) { c.pos.x = nx; c.speed *= 0.9; }
  else if (podeAndar(ox, nz)) { c.pos.z = nz; c.speed *= 0.9; }
  else { c.speed *= -0.2; }
  if (forte) { c.bump = 0.25; c.batidas++; }
}

const _up = new THREE.Vector3(0, 1, 0);
export function syncMesh(c, dt) {
  const m = c.mesh, g = m.group;
  g.position.set(c.pos.x, 0, c.pos.z);
  g.quaternion.setFromAxisAngle(_up, c.heading);
  c.bump = Math.max(0, c.bump - dt);
  m.body.rotation.z = -c.steer * Math.min(1, Math.abs(c.speed) / FIS.VMAX) * 0.06;
  m.body.rotation.x = c.freando ? 0.025 : 0;                                           // mergulha de leve ao frear
  m.body.position.y = Math.sin(c.bump * 40) * c.bump * 0.3 + (c.lombadaT > 0 ? Math.sin(c.lombadaT * Math.PI / 0.35) * 0.18 : 0);
  m.freioLuz.emissiveIntensity = c.freando ? 2.2 : 0.6;
  const reMat = c.re ? m.reAcesa : m.reApagada;
  if (m.reLuz.material !== reMat) m.reLuz.material = reMat;
  // seta: c.seta = 'esq'|'dir'|null, c.piscaAceso = fase do pisca (quem decide o ritmo é o jogo)
  for (const lado of ['esq', 'dir']) {
    const mat = c.seta === lado && c.piscaAceso ? m.piscaAceso : m.piscaApagado;
    if (m.pisca[lado].material !== mat) m.pisca[lado].material = mat;
  }
  for (const w of m.wheels) {
    w.w.rotation.x += c.speed * dt / 0.4;
    if (w.front) w.pivot.rotation.y = c.steer * 0.45;
  }
}
