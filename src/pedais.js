// Pedais na tela (spec 005): acelerador deslizante à direita + freio à esquerda, com multitoque (um polegar em cada).
// O acelerador não é liga/desliga: a altura do dedo (0–1) é a VELOCIDADE-ALVO. A faixa dourada marca o limite da via.
// Só DOM: quem transforma alvo/freio em movimento é carro.js (stepCar com inp.alvo).
// Spec 008: layout 'volante' — freio logo ACIMA do acelerador (os dois no polegar direito). O dedo que desliza do
// acelerador para o freio (mesmo toque) passa a frear; deslizar de volta acelera de novo.

const PAD = 14;                 // px de folga em cima/embaixo do trilho (dedo no pé do pedal = 0, no topo = 1)
const clamp01 = v => Math.max(0, Math.min(1, v));

export function criarPedais({ vmaxKmh = 70 } = {}) {
  const $ = id => document.getElementById(id);
  const raiz = $('pedais'), acel = $('acel'), trilho = $('acelTrilho'), freioEl = $('freio'), limTxt = $('acelLim');
  const st = { acelId: null, freioId: null, frac: 0, freio: false, mouse: null, lim: -1, kmh: -1, acima: null, vis: false, layout: 'pedais', dedos: new Map() };

  const caixa = () => acel.getBoundingClientRect();     // a caixa SEM o "afundar" (o trilho apertado fica inclinado/menor)
  function fracDeY(y) { const r = caixa(); return clamp01((r.bottom - PAD - y) / (r.height - 2 * PAD)); }
  function yDeFrac(f) { const r = caixa(); return r.bottom - PAD - f * (r.height - 2 * PAD); }
  // zonas generosas para o polegar: metade de baixo da tela, lado direito = acelerador, esquerdo = freio
  function zona(x, y) {
    const a = acel.getBoundingClientRect(), f = freioEl.getBoundingClientRect();
    if (st.layout === 'volante') {               // coluna da direita: freio em cima, acelerador embaixo
      if (x < Math.min(a.left, f.left) - 24 || y < f.top - 24) return null;
      return y < (f.bottom + a.top) / 2 ? 'freio' : 'acel';
    }
    if (x >= Math.max(innerWidth * 0.5, a.left - 24) && y >= a.top - 50) return 'acel';
    if (x < innerWidth * 0.5 && x <= f.right + 24 && y >= f.top - 60) return 'freio';
    return null;
  }
  // layout volante: cada dedo da coluna da direita pode deslizar entre freio e acelerador
  function recalculaDedos() {
    let freio = false, fy = null;
    for (const [, d] of st.dedos) { if (d.z === 'freio') freio = true; else if (fy === null) fy = d.y; }
    st.freio = freio;
    st.acelId = fy === null ? null : -1;
    st.frac = fy === null ? 0 : fracDeY(fy);
  }

  function desenhaPedal() {
    raiz.style.setProperty('--f', st.frac.toFixed(4));
    const ap = st.acelId !== null || st.mouse === 'acel' || st.teclaAcel;
    acel.classList.toggle('apertado', ap);
    if (ap) acel.classList.add('usado');
    freioEl.classList.toggle('apertado', st.freio);
    raiz.classList.toggle('freando', st.freio);
    const acima = st.frac * vmaxKmh > st.lim + 0.5 && st.frac > 0;
    if (acima !== st.acima) { st.acima = acima; acel.classList.toggle('acima', acima); }
  }

  // toques (touchstart/move/end/cancel) — cada dedo fica preso ao pedal em que começou
  function toque(e) {
    if (st.layout === 'volante') {
      for (const t of e.changedTouches) {
        const fim = e.type === 'touchend' || e.type === 'touchcancel';
        if (e.type === 'touchstart') { const z = zona(t.clientX, t.clientY); if (z) st.dedos.set(t.identifier, { z, y: t.clientY }); }
        else if (st.dedos.has(t.identifier)) {
          if (fim) st.dedos.delete(t.identifier);
          else {
            const a = acel.getBoundingClientRect(), f = freioEl.getBoundingClientRect();
            st.dedos.set(t.identifier, { z: t.clientY < (f.bottom + a.top) / 2 ? 'freio' : 'acel', y: t.clientY });
          }
        }
      }
      recalculaDedos(); desenhaPedal();
      return;
    }
    for (const t of e.changedTouches) {
      const fim = e.type === 'touchend' || e.type === 'touchcancel';
      if (e.type === 'touchstart') {
        const z = zona(t.clientX, t.clientY);
        if (z === 'acel' && st.acelId === null) { st.acelId = t.identifier; st.frac = fracDeY(t.clientY); }
        else if (z === 'freio' && st.freioId === null) { st.freioId = t.identifier; st.freio = true; }
      } else if (t.identifier === st.acelId) {
        if (fim) { st.acelId = null; st.frac = 0; } else st.frac = fracDeY(t.clientY);
      } else if (t.identifier === st.freioId && fim) { st.freioId = null; st.freio = false; }
    }
    desenhaPedal();
  }

  // mouse no PC (opcional; o teclado é o principal)
  function mouse(e) {
    if (e.type === 'mousedown') {
      const z = zona(e.clientX, e.clientY);
      if (!z) return false;
      st.mouse = z;
      if (z === 'acel') st.frac = fracDeY(e.clientY); else st.freio = true;
    } else if (e.type === 'mousemove') { if (st.mouse === 'acel') st.frac = fracDeY(e.clientY); else return false; }
    else if (e.type === 'mouseup') { if (!st.mouse) return false; if (st.mouse === 'acel') st.frac = 0; else st.freio = st.freioId !== null; st.mouse = null; }
    desenhaPedal();
    return true;
  }

  // teclado: segurar ↑ sobe o alvo aos poucos (≈2,2 s até o fundo), soltar zera
  function teclado(subir, frear, dt) {
    const tocando = st.acelId !== null || st.mouse === 'acel';
    if (!tocando) {
      const antes = st.frac;
      st.frac = subir ? clamp01(st.frac + dt * 0.45) : (st.teclaAcel ? 0 : st.frac);
      st.teclaAcel = !!subir;
      if (antes !== st.frac) desenhaPedal();
    }
    st.freioTecla = !!frear;
  }

  // a cada quadro: faixa dourada (limite da via) e o risquinho da velocidade de agora
  function atualizar(kmh, lim) {
    if (lim !== st.lim) {
      st.lim = lim; limTxt.textContent = lim;
      raiz.style.setProperty('--lim', clamp01(lim / vmaxKmh).toFixed(4));
      st.acima = null; desenhaPedal();
    }
    const k = Math.round(kmh);
    if (k !== st.kmh) { st.kmh = k; raiz.style.setProperty('--v', clamp01(kmh / vmaxKmh).toFixed(4)); }
  }

  function mostrar(sim) { st.vis = sim; raiz.classList.toggle('hidden', !sim); }
  function soltarTudo() { st.dedos.clear(); st.acelId = st.freioId = st.mouse = null; st.frac = 0; st.freio = false; st.teclaAcel = false; desenhaPedal(); }
  // chip da curva da direção automática (spec 007: aparece junto do aviso de GPS, com o lado da curva)
  const curvaEl = $('acelCurva');
  function curva(sim, lado = null) {
    if (sim !== st.curva) { st.curva = sim; acel.classList.toggle('curva', sim); curvaEl.classList.toggle('on', sim); }
    if (sim && lado !== st.curvaLado) { st.curvaLado = lado; $('acelCurva').textContent = lado === 'esq' ? '↩ curva!' : '↪ curva!'; }
  }

  return {
    toque, mouse, teclado, atualizar, mostrar, soltarTudo, curva,
    layout(l) { st.layout = l; soltarTudo(); },
    get frac() { return st.frac; },
    get freio() { return st.freio || !!st.freioTecla; },
    get alvoKmh() { return st.frac * vmaxKmh; },
    get lim() { return st.lim; },
    // ganchos de teste: onde pôr o dedo para pedir X km/h; centro do freio; altura (px) da faixa dourada
    yParaKmh: kmh => yDeFrac(clamp01(kmh / vmaxKmh)),
    xAcel: () => { const r = caixa(); return r.left + r.width / 2; },
    centroFreio: () => { const r = freioEl.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
    yFaixa: () => { const r = $('acelFaixa').getBoundingClientRect(); return r.top + r.height / 2; },
  };
}
