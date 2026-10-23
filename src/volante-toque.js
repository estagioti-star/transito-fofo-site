// Volante na tela (spec 008), em módulo para outras fases (spec 015, Centro). Mesmo comportamento do jogo.js: volante FIXO
// embaixo à esquerda, só vira (arrastar para o lado ou girar o aro; pegar de novo continua do ângulo atual), soltou →
// volta ao centro suave; toque rápido no coração = buzina. (O jogo.js do bairro inventado ainda tem a cópia dele.)
const HEART_R = 0.2, TAP_MS = 250, TAP_MOVE = 10, ANG_MAX = 120;

export function criarVolanteToque(thumbEl, wheelEl, buzinar) {
  const st = { id: null, cx: 0, cy: 0, steer: 0, ang: 0, alvo: 0, tap: null, grab: null };
  const zona = (x, y) => { const r = thumbEl.getBoundingClientRect(); return x <= r.right + 20 && x < innerWidth * 0.62 && y >= r.top - 30; };
  function toque(e) {
    for (const t of e.changedTouches) {
      if (e.type === 'touchstart' && st.id === null && zona(t.clientX, t.clientY)) {
        const r = thumbEl.getBoundingClientRect();
        st.cx = r.left + r.width / 2; st.cy = r.top + r.height / 2;
        const dist = Math.hypot(t.clientX - st.cx, t.clientY - st.cy);
        st.id = t.identifier; st.alvo = st.ang;
        st.grab = { x: t.clientX, ang0: st.ang, a0: dist > r.width * 0.22 ? Math.atan2(t.clientX - st.cx, st.cy - t.clientY) * 180 / Math.PI : null };
        st.tap = dist < r.width * HEART_R ? { t0: performance.now(), move: 0, x: t.clientX, y: t.clientY } : null;
        thumbEl.classList.add('active');
        continue;
      }
      if (t.identifier !== st.id) continue;
      if (e.type === 'touchend' || e.type === 'touchcancel') {
        if (st.tap && performance.now() - st.tap.t0 < TAP_MS && st.tap.move < TAP_MOVE) buzinar();
        st.id = null; st.alvo = 0; st.tap = null; thumbEl.classList.remove('active');
        continue;
      }
      if (st.tap) {
        st.tap.move = Math.max(st.tap.move, Math.hypot(t.clientX - st.tap.x, t.clientY - st.tap.y));
        if (st.tap.move < TAP_MOVE) continue;
        st.tap = null;
      }
      const gr = st.grab, angSlide = (t.clientX - gr.x) / 110 * 90;   // spec 060: era /70 (sensível demais)
      let ang = angSlide;
      if (gr.a0 !== null) {
        let d = Math.atan2(t.clientX - st.cx, st.cy - t.clientY) * 180 / Math.PI - gr.a0;
        d = ((d + 540) % 360) - 180;
        if (Math.abs(d) > Math.abs(angSlide) && Math.sign(d) === Math.sign(angSlide || d)) ang = d;
      }
      st.alvo = Math.max(-ANG_MAX, Math.min(ANG_MAX, gr.ang0 + ang));
    }
  }
  let rodaK = '';
  function passo(dt) {
    const k = st.id !== null ? 22 : 7;
    st.ang += (st.alvo - st.ang) * (1 - Math.exp(-dt * k));
    if (st.id === null && Math.abs(st.ang) < 0.3) st.ang = 0;
    const a = Math.abs(st.ang);
    st.steer = a < 5 ? 0 : -Math.sign(st.ang) * Math.pow(Math.min(1, a / 90), 1.7);   // spec 060: mais fino no meio
    const rk = st.ang.toFixed(1);
    if (rk !== rodaK) { rodaK = rk; wheelEl.style.transform = `rotate(${rk}deg)`; }
  }
  return { toque, passo, zona, estado: st, get steer() { return st.steer; }, soltar() { st.id = null; st.alvo = st.ang = st.steer = 0; } };
}
