// Progresso entre viagens (specs 021/022): medalha por missão e a carteirinha que enche. Puro: o armazenamento entra
// de fora (localStorage no jogo, um objeto qualquer nos testes). Sem DOM, sem THREE.
import { suspensao } from './lei.js';

export const MEDALHAS = ['bronze', 'prata', 'ouro'];
export const MEDALHA_TXT = { ouro: '🥇', prata: '🥈', bronze: '🥉' };
export const MEDALHA_NOME = { ouro: 'Medalha de ouro', prata: 'Medalha de prata', bronze: 'Medalha de bronze' };

// medalha de uma viagem que CHEGOU ao destino (estado() do fiscal):
//   ouro = nenhuma multa, nenhuma batida que tirou ⭐, nenhuma conversão sem seta, nunca sem cinto
//   prata = nenhuma multa · bronze = chegou
export function medalha(est) {
  if ((est.infracoes || []).length) return 'bronze';
  const bateu = (est.batidas || []).some(b => b.pontos < 0);
  const erros = bateu || (est.semSeta || []).length || (est.semCinto || []).length
    || (est.semPassagem || []).length || (est.bikePerto || []).length
    || (est.naoReduziu || []).length || (est.buzinadas || []).length || (est.chuvaRapido || []).length
    || (est.contramaos || []).length || (est.vagasErradas || []).length || (est.garagem || []).length || (est.ultrapassagens || []).length || (est.estacionouErrado || []).length || (est.atropelamentos || []).length;
  return erros ? 'prata' : 'ouro';
}
const melhor = (a, b) => (MEDALHAS.indexOf(a) >= MEDALHAS.indexOf(b) ? a : b);

const CHAVE = 'transitoFofo.progresso';
// armazenamento = { getItem(k), setItem(k, v) } (localStorage); se faltar ou der erro, só não lembra
export function criarProgresso(armazenamento = null) {
  let dados = { medalhas: {}, cnh: [] };
  try {
    const bruto = armazenamento && armazenamento.getItem(CHAVE);
    if (bruto) { const d = JSON.parse(bruto); dados = { medalhas: d.medalhas || {}, cnh: Array.isArray(d.cnh) ? d.cnh : [] }; }
  } catch { /* storage bloqueado ou lixo: começa do zero */ }
  const grava = () => { try { armazenamento && armazenamento.setItem(CHAVE, JSON.stringify(dados)); } catch { /* sem storage */ } };

  // fim de uma viagem que chegou: guarda a melhor medalha e soma as multas na carteirinha. Se encheu (art. 261), a
  // CNH é suspensa e os pontos voltam a zero (art. 261 §3º). Devolve o resumo para o relatório.
  function registrarViagem(missaoId, est) {
    const m = medalha(est), antes = dados.medalhas[missaoId] || null;
    dados.medalhas[missaoId] = antes ? melhor(m, antes) : m;
    dados.cnh = dados.cnh.concat((est.infracoes || []).map(e => e.id));
    const cnh = suspensao(dados.cnh);
    if (cnh.suspenso) dados.cnh = [];
    grava();
    return { medalha: m, melhor: dados.medalhas[missaoId], nova: !antes || MEDALHAS.indexOf(m) > MEDALHAS.indexOf(antes), cnh, suspensa: cnh.suspenso };
  }
  return {
    registrarViagem,
    medalhas: () => ({ ...dados.medalhas }),
    cnh: () => suspensao(dados.cnh),          // { pontos, gravissimas, limite, suspenso } acumulado
    zerar() { dados = { medalhas: {}, cnh: [] }; grava(); },
  };
}
