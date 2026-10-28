// Spec 059 — dois jeitos de dirigir no teclado (escolha no menu, modo 💻 Teclado; vale no bairro e em Chapecó).
// O que dirige num jeito é o pisca no outro:
// - 'setas' (padrão): ↑ anda · ↓/espaço freia · ← → vira · A D (ou Q E) pisca
// - 'wasd': W anda · S/espaço freia · A D vira · ← → (ou Q E) pisca
// Ré igual nos dois: R engata/desengata e o "anda" (↑ ou W) leva o carro para trás.
export const MODOS_TECLAS = ['setas', 'wasd'];
export const LS_TECLAS = 'transitoFofo.teclas';

const MAPA = {
  setas: { acel: ['ArrowUp'], freio: ['ArrowDown', 'Space'], esq: ['ArrowLeft'], dir: ['ArrowRight'], piscaEsq: ['KeyA', 'KeyQ'], piscaDir: ['KeyD', 'KeyE'] },
  wasd: { acel: ['KeyW'], freio: ['KeyS', 'Space'], esq: ['KeyA'], dir: ['KeyD'], piscaEsq: ['ArrowLeft', 'KeyQ'], piscaDir: ['ArrowRight', 'KeyE'] },
};
const algum = (keys, lista) => lista.some(k => keys[k]);

export function criarTeclado(modo = 'setas') {
  const M = MAPA[modo] || MAPA.setas;
  return {
    modo,
    acel: keys => algum(keys, M.acel),                        // na ré o mesmo "anda" leva o carro para trás
    freio: keys => algum(keys, M.freio),
    vira: keys => (algum(keys, M.esq) ? 1 : 0) - (algum(keys, M.dir) ? 1 : 0),      // +1 = esquerda
    pisca: code => M.piscaEsq.includes(code) ? 'esq' : M.piscaDir.includes(code) ? 'dir' : null,
    // textos das dicas
    reTexto: () => (modo === 'wasd' ? 'W' : '↑') + ' anda para trás · R volta pra frente',
    // painel do modo Teclado (as teclas acendem quando apertadas: data-k = e.code)
    painel: () => modo === 'wasd'
      ? `<div class="pcLinha"><kbd data-k="KeyW">W</kbd><span>anda</span><kbd data-k="KeyS">S</kbd><kbd data-k="Space" class="largo">espaço</kbd><span>freia</span></div>
         <div class="pcLinha"><kbd data-k="KeyA">A</kbd><kbd data-k="KeyD">D</kbd><span>vira</span><kbd data-k="ArrowLeft">←</kbd><kbd data-k="ArrowRight">→</kbd><span>pisca</span></div>`
      : `<div class="pcLinha"><kbd data-k="ArrowUp">↑</kbd><span>acelera</span><kbd data-k="ArrowDown">↓</kbd><kbd data-k="Space" class="largo">espaço</kbd><span>freia</span></div>
         <div class="pcLinha"><kbd data-k="ArrowLeft">←</kbd><kbd data-k="ArrowRight">→</kbd><span>vira</span><kbd data-k="KeyA">A</kbd><kbd data-k="KeyD">D</kbd><span>pisca</span></div>`,
    dica: () => modo === 'wasd' ? '⌨️ W anda · S ou espaço freia · A D vira<br>← → pisca · H buzina · C cinto · R ré'
      : '⌨️ ↑ acelera · ↓ ou espaço freia · ← → vira<br>A/D (ou Q/E) pisca · H buzina · C cinto · R ré',
  };
}
