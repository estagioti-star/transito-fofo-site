// Spec 060 — olhar para os lados: arrastar o dedo (na parte de cima da tela, longe do volante, dos pedais e dos botões)
// ou o mouse gira a câmera em volta do carro, como virar a cabeça. Soltou → volta devagar para a frente.
// ang: + = esquerda (o mesmo sinal do "olhar no PARE" do bairro).
const K = 0.0065;              // rad por pixel arrastado (≈ 300 px = 110°)
const MAX = 2.7;               // até ~155° (dá para olhar quase para trás)

export function criarOlharLivre() {
  const st = { id: null, x0: 0, a0: 0, alvo: 0, ang: 0 };
  return {
    get ang() { return st.ang; },
    get ativo() { return st.id !== null; },
    pega(id, x) { st.id = id; st.x0 = x; st.a0 = st.alvo; },
    move(id, x) {
      if (id !== st.id) return false;
      st.alvo = Math.max(-MAX, Math.min(MAX, st.a0 - (x - st.x0) * K));     // arrastou para a direita → olha à direita
      return true;
    },
    solta(id) { if (id === st.id) st.id = null; },
    // toques: começa na zona livre (livre(x, y) = true). Devolve o evento SÓ com os outros dedos (volante, pedal) —
    // spec 064: antes devolvia "é meu" e o evento inteiro era descartado, e o dedo do volante "soltava" no meio da curva
    toque(e, livre) {
      const outros = [];
      for (const t of e.changedTouches) {
        if (e.type === 'touchstart' && st.id === null && livre(t.clientX, t.clientY)) { this.pega(t.identifier, t.clientX); continue; }
        if (t.identifier !== st.id) { outros.push(t); continue; }
        if (e.type === 'touchend' || e.type === 'touchcancel') this.solta(t.identifier); else this.move(t.identifier, t.clientX);
      }
      return { type: e.type, changedTouches: outros, touches: e.touches, target: e.target, preventDefault() {} };
    },
    passo(dt) {
      if (st.id === null) st.alvo *= Math.exp(-dt * 2.2);                     // soltou: volta devagar
      if (Math.abs(st.alvo) < 0.002 && st.id === null) st.alvo = 0;
      st.ang += (st.alvo - st.ang) * (1 - Math.exp(-dt * 12));
      if (Math.abs(st.ang) < 0.001 && !st.alvo) st.ang = 0;
    },
    zera() { st.id = null; st.alvo = st.ang = 0; },
  };
}

// gira (posição, alvo) da câmera em volta do ponto c por ang (+ = esquerda)
export function giraEmVolta(v, c, ang) {
  const ca = Math.cos(ang), sa = Math.sin(ang), dx = v.x - c.x, dz = v.z - c.z;
  v.x = c.x + dx * ca + dz * sa; v.z = c.z - dx * sa + dz * ca;
}
