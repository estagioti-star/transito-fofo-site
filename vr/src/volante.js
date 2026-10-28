// Volante esportivo rosa ou azul (SVG): aro de "couro" com costura, centro de carbono,
// faixa no topo e coração no meio (sem logo de marca).

// aro em "D": círculo de raio r com a parte de baixo reta na altura y
function dPath(r, y) {
  const x = Math.sqrt(r * r - y * y).toFixed(2);
  return `M ${-x} ${y} A ${r} ${r} 0 1 1 ${x} ${y} Z`;
}

// paletas do aro e do coração (spec 015/016: tema rosa ou azul; os botõezinhos e a faixa amarela não mudam)
const PALETAS = {
  rosa: { aro: ['#ff8cc8', '#ff3d9a', '#c9136f'], puff: ['#ffc2e0', '#ff5fae', '#d0156f'], sombra: 'rgba(90,0,40,.35)', miolo: '#d81b77', brilho: '#ff9fd0', linha: '#c2185b' },
  azul: { aro: ['#7fb2ff', '#1e78ff', '#0b4fb5'], puff: ['#b9d6ff', '#4b93ff', '#0e5fd8'], sombra: 'rgba(0,30,90,.35)', miolo: '#0e5fd8', brilho: '#93beff', linha: '#1155b9' },
};
let n = 0;
export function wheelSVG(tema = 'rosa') {
  const P = PALETAS[tema] || PALETAS.rosa;
  const id = 'w' + (n++);   // ids únicos por cópia (gradientes/padrões)
  const R = 84, FLAT = 60;
  return `
<svg viewBox="-110 -110 220 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${id}rim" x1="0" y1="-1" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0" stop-color="${P.aro[0]}"/><stop offset=".5" stop-color="${P.aro[1]}"/><stop offset="1" stop-color="${P.aro[2]}"/>
    </linearGradient>
    <pattern id="${id}cf" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="8" height="8" fill="#26262e"/><rect width="4" height="4" fill="#3a3a46"/><rect x="4" y="4" width="4" height="4" fill="#3a3a46"/>
    </pattern>
    <radialGradient id="${id}puff" cx=".38" cy=".3" r=".75">
      <stop offset="0" stop-color="${P.puff[0]}"/><stop offset=".45" stop-color="${P.puff[1]}"/><stop offset="1" stop-color="${P.puff[2]}"/>
    </radialGradient>
    <radialGradient id="${id}hub" cx=".4" cy=".35" r=".8">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".25"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- sombra -->
  <path d="${dPath(R, FLAT)}" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="26" transform="translate(3 6)"/>
  <!-- raios e miolo de carbono -->
  <path d="M -80 -14 L -30 -24 L 30 -24 L 80 -14 L 80 14 L 34 22 L 22 ${FLAT} L -22 ${FLAT} L -34 22 L -80 14 Z" fill="url(#${id}cf)" stroke="#15151b" stroke-width="3"/>
  <rect x="-34" y="-30" width="68" height="60" rx="16" fill="url(#${id}cf)" stroke="#15151b" stroke-width="3"/>
  <rect x="-34" y="-30" width="68" height="60" rx="16" fill="url(#${id}hub)"/>
  <!-- botõezinhos coloridos -->
  <circle cx="-56" cy="-2" r="7" fill="#3ad1ff" stroke="#fff" stroke-width="2"/>
  <circle cx="-56" cy="18" r="5" fill="#ffd23f" stroke="#fff" stroke-width="2"/>
  <circle cx="56" cy="-2" r="7" fill="#7ee081" stroke="#fff" stroke-width="2"/>
  <circle cx="56" cy="18" r="5" fill="#ff5a5a" stroke="#fff" stroke-width="2"/>
  <!-- aro de couro (cor do tema) -->
  <path d="${dPath(R, FLAT)}" fill="none" stroke="url(#${id}rim)" stroke-width="24" stroke-linejoin="round"/>
  <path d="${dPath(R, FLAT)}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="6" transform="translate(-1 -3)"/>
  <!-- costuras -->
  <path d="${dPath(R - 8.5, FLAT - 8)}" fill="none" stroke="#fff" stroke-width="1.8" stroke-dasharray="5 4" stroke-linecap="round"/>
  <path d="${dPath(R + 8.5, FLAT + 8)}" fill="none" stroke="#fff" stroke-width="1.8" stroke-dasharray="5 4" stroke-linecap="round"/>
  <!-- faixa do "meio-dia" -->
  <path d="M -9 ${-R - 12} L 9 ${-R - 12} L 8 ${-R + 12} L -8 ${-R + 12} Z" fill="#fff3a6" stroke="#ffd23f" stroke-width="2"/>
  <!-- coração-almofadinha (capitonê) no meio: aperta pra buzinar -->
  <g class="hz">
    <path d="M 0 -4 C 0 -14 -16 -16 -16 -4 C -16 6 -4 12 0 18 C 4 12 16 6 16 -4 C 16 -16 0 -14 0 -4 Z" transform="translate(1 4) scale(1.75)" fill="${P.sombra}"/>
    <path d="M 0 -4 C 0 -14 -16 -16 -16 -4 C -16 6 -4 12 0 18 C 4 12 16 6 16 -4 C 16 -16 0 -14 0 -4 Z" transform="scale(1.75)" fill="url(#${id}puff)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M 0 -4 C 0 -14 -16 -16 -16 -4 C -16 6 -4 12 0 18 C 4 12 16 6 16 -4 C 16 -16 0 -14 0 -4 Z" transform="translate(0 1) scale(1.3)" fill="none" stroke="#fff" stroke-width="1.2" stroke-dasharray="2.2 2.2" stroke-linecap="round" opacity=".9"/>
    <ellipse cx="-11" cy="-12" rx="7" ry="4" transform="rotate(-35 -11 -12)" fill="#fff" opacity=".75"/>
    <circle cx="0" cy="4" r="3.6" fill="${P.miolo}"/>
    <circle cx="-0.8" cy="3" r="1.3" fill="${P.brilho}"/>
    <path d="M 0 4 L -9 -5 M 0 4 L 9 -5 M 0 4 L 0 16" stroke="${P.linha}" stroke-width="1" opacity=".45"/>
  </g>
</svg>`;
}
