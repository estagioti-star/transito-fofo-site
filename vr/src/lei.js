// A lei em dados. Lógica pura (sem THREE, sem DOM).
// Valores de lei/ctb-conferido.md (CTB, Lei 9.503/1997, conferido no Planalto em 05/10/2026).

const CTB = 'https://www.planalto.gov.br/ccivil_03/leis/l9503compilado.htm';

// Art. 258 (valor em R$) e art. 259 (pontos).
export const NATUREZAS = {
  leve:       { pontos: 3, valor: 88.38 },
  media:      { pontos: 4, valor: 130.16 },
  grave:      { pontos: 5, valor: 195.23 },
  gravissima: { pontos: 7, valor: 293.47 },
};

export const INFRACOES = {
  sinal_vermelho: {
    artigo: 'CTB art. 208', nome: 'Avançar o sinal vermelho', natureza: 'gravissima', fator: 1,
    explica: 'No vermelho, para antes da faixa branca.', fonte: CTB,
  },
  pare: {
    artigo: 'CTB art. 208', nome: 'Avançar a placa PARE', natureza: 'gravissima', fator: 1,
    explica: 'Na placa PARE, o carro para de verdade.', fonte: CTB,
  },
  pedestre_faixa: {
    artigo: 'CTB art. 214, I', nome: 'Não dar preferência ao pedestre na faixa', natureza: 'gravissima', fator: 1,
    explica: 'Pedestre na faixa? O carro espera ele passar.', fonte: CTB,
  },
  parar_sobre_faixa: {
    artigo: 'CTB art. 182, VI', nome: 'Parar sobre a faixa de pedestres', natureza: 'leve', fator: 1,
    explica: 'Pare antes da faixa: ela é do pedestre.', fonte: CTB,
  },
  preferencia_cruzamento: {
    artigo: 'CTB art. 215, I, b', nome: 'Não dar preferência a quem vem da direita', natureza: 'grave', fator: 1,
    explica: 'Cruzamento sem placa: quem vem da direita passa primeiro.', fonte: CTB,
  },
  rotula_preferencia: {
    artigo: 'CTB art. 215, I, a', nome: 'Não dar preferência a quem já está na rotatória', natureza: 'grave', fator: 1,
    explica: 'Na rotatória, quem já está dentro tem a preferência.', fonte: CTB,
  },
  vel_ate20: {
    artigo: 'CTB art. 218, I', nome: 'Excesso de velocidade até 20%', natureza: 'media', fator: 1,
    explica: 'Passou do limite em até 20%. Devagar se chega.', fonte: CTB,
  },
  vel_20a50: {
    artigo: 'CTB art. 218, II', nome: 'Excesso de velocidade de 20% a 50%', natureza: 'grave', fator: 1,
    explica: 'Muito acima do limite: perigo para todo mundo.', fonte: CTB,
  },
  vel_acima50: {
    artigo: 'CTB art. 218, III', nome: 'Excesso de velocidade acima de 50%', natureza: 'gravissima', fator: 3,
    explica: 'Mais de 50% acima: multa três vezes maior.', fonte: CTB,
  },
  celular: {
    artigo: 'CTB art. 252, V e parágrafo único', nome: 'Dirigir segurando o celular', natureza: 'gravissima', fator: 1,
    explica: 'Celular na mão ao dirigir? Nunca. Duas mãos no volante.', fonte: CTB,
  },
  cinto: {
    artigo: 'CTB art. 167', nome: 'Não usar o cinto de segurança', natureza: 'grave', fator: 1,
    explica: 'Cinto de segurança sempre, no banco da frente e de trás.', fonte: CTB,
  },
  // spec 007: conferido no Planalto em 05/10/2026 (lei/ctb-conferido.md, item 15). No jogo NÃO vira multa (sem guarda):
  // só −⭐ e a dica com o artigo (SETA abaixo).
  seta: {
    artigo: 'CTB art. 196', nome: 'Deixar de dar a seta', natureza: 'grave', fator: 1,
    explica: 'Vai virar ou trocar de faixa? Dê a seta antes.', fonte: CTB,
  },
  // spec 023/024 (conferidos em 14/10/2026, lei/ctb-conferido.md itens 16 e 17). No jogo só viram ⭐ + dica.
  ambulancia: {
    artigo: 'CTB art. 189', nome: 'Não dar passagem à ambulância', natureza: 'gravissima', fator: 1,
    explica: 'Sirene ligada? Vá para a direita e pare, se precisar.', fonte: CTB,
  },
  bicicleta: {
    artigo: 'CTB art. 201', nome: 'Passar perto da bicicleta', natureza: 'media', fator: 1,
    explica: 'Ao passar a bicicleta, deixe 1,5 m de distância.', fonte: CTB,
  },
  // spec 026 (conferido em 15/10/2026, lei/ctb-conferido.md item 18). No jogo só vira ⭐ + dica.
  // spec 034 (conferidos em 15/10/2026, lei/ctb-conferido.md item 20). No jogo só viram ⭐ + dica.
  contramao_unica: {
    artigo: 'CTB art. 186, II', nome: 'Contramão em rua de mão única', natureza: 'gravissima', fator: 1,
    explica: 'Rua de mão única: só se anda no sentido da seta.', fonte: CTB,
  },
  vaga_reservada: {
    artigo: 'CTB art. 181, XX', nome: 'Parar em vaga de idoso ou PcD', natureza: 'gravissima', fator: 1,
    explica: 'Vaga de idoso e de pessoa com deficiência só com credencial.', fonte: CTB,
  },
  buzina: {
    artigo: 'CTB art. 227', nome: 'Buzinar onde é proibido', natureza: 'leve', fator: 1,
    explica: 'Perto de hospital e posto de saúde: silêncio, nada de buzina.', fonte: CTB,
  },
};

const arred2 = (x) => Math.round(x * 100) / 100;

export function multa(id) {
  const inf = INFRACOES[id];
  if (!inf) throw new Error(`infracao desconhecida: ${id}`);
  const nat = NATUREZAS[inf.natureza];
  return {
    id, artigo: inf.artigo, nome: inf.nome, natureza: inf.natureza,
    pontos: nat.pontos, valor: arred2(nat.valor * inf.fator), explica: inf.explica,
  };
}

// Res. CONTRAN 798/2020 (art. 8º e Anexo III). 7% acima da faixa: confirmado no PDF.
// 7 km/h até 100 km/h (e portanto até 107 medidos): só em fonte secundária (Portaria Inmetro 544/2014).
export const TOLERANCIA = {
  confirmado: 'parcial',
  kmh: 7,
  ateMedidoKmh: 107,
  percentual: 7,
  fontes: [
    'https://www.gov.br/transportes/pt-br/assuntos/transito/conteudo-contran/resolucoes/resolucao798-2020.pdf',
    'Portaria Inmetro 544/2014 (fonte secundária para o 7 km/h)',
  ],
};

export function velocidadeConsiderada(medidaKmh) {
  const erro = medidaKmh <= TOLERANCIA.ateMedidoKmh
    ? TOLERANCIA.kmh
    : Math.round(medidaKmh * TOLERANCIA.percentual / 100);
  return Math.max(0, medidaKmh - erro);
}

// Art. 218: faixas sobre a velocidade considerada (já com tolerância).
export function infracaoVelocidade(medidaKmh, limiteKmh) {
  const v = velocidadeConsiderada(medidaKmh);
  const exc = v - limiteKmh;
  if (exc <= 0) return null;
  if (exc * 100 <= 20 * limiteKmh) return 'vel_ate20';
  if (exc * 100 <= 50 * limiteKmh) return 'vel_20a50';
  return 'vel_acima50';
}

// Art. 261, I: em 12 meses, 20 (2+ gravíssimas), 30 (1 gravíssima) ou 40 pontos (nenhuma).
export function suspensao(ids) {
  let pontos = 0, gravissimas = 0;
  for (const id of ids) {
    const inf = INFRACOES[id];
    if (!inf) throw new Error(`infracao desconhecida: ${id}`);
    pontos += NATUREZAS[inf.natureza].pontos;
    if (inf.natureza === 'gravissima') gravissimas++;
  }
  const limite = gravissimas >= 2 ? 20 : gravissimas === 1 ? 30 : 40;
  return { pontos, gravissimas, limite, suspenso: pontos >= limite };
}

// Pontos lúdicos do jogo (NÃO é lei).
export const PONTOS_JOGO = {
  parouVermelho: 10, parouPare: 10, deuPreferenciaPedestre: 15, rotulaCerta: 15, radarOk: 5, infracao: -20,
  olhouEsperou: 15, batida: -30, odometro: 1, setaCerta: 10, semSeta: -10, cintoCerto: 10, semCinto: -10,
  deuPassagem: 20, naoDeuPassagem: -20, bikeLonge: 10, bikePerto: -15,
  buzinou: -10, reduziuSusto: 15, naoReduziu: -15, chuvaRapido: -10,
  contramaoUnica: -20, vagaReservada: -20, estacionouCerto: 20,
  saiuGaragem: 5, garagemPreferencia: -15,
  ultrapassouPonte: -20, esperouPonte: 15,                                      // spec 040
  balizaCerta: 20, estacionouErrado: -15,                                       // spec 042
  atropelou: -50,                                                               // spec 050
};

// Batidas (spec 006). No jogo NUNCA viram multa (não há agente vendo). O artigo só aparece se CONFERIDO no
// Planalto (lei/ctb-conferido.md, item 14, 05/10/2026):
// - traseira: art. 192 (deixar de guardar distância de segurança frontal) = grave. CONFIRMADO.
// - preferencia (parou no PARE e entrou cortando quem vem na preferencial): o CTB não tem artigo próprio
//   confirmado para isso (art. 208 = avançar o PARE; art. 215 = interseção sem sinalização ou "Dê a
//   Preferência"; art. 44 = regra de conduta, sem penalidade no próprio artigo). Fica só a dica, sem artigo.
export const BATIDAS = {
  traseira: { dica: 'Guarde distância do carro da frente.',
    multaReal: { artigo: 'CTB art. 192', natureza: 'grave', confirmado: true, fonte: CTB } },
  preferencia: { dica: 'Espere a pista ficar livre.', multaReal: null },
  outra: { dica: 'Cuidado! Olhe em volta antes de andar.', multaReal: null },
};

// Seta (spec 007): art. 196 = grave, CONFIRMADO no Planalto (lei/ctb-conferido.md, item 15). No jogo nunca vira multa;
// esquecer a seta tira ⭐ e mostra a dica com o artigo da vida real.
// Cinto (spec 018): art. 167, grave, CONFERIDO (lei/ctb-conferido.md item 11). No jogo nunca vira multa (não há agente
// vendo): só ⭐ e a dica com o artigo da vida real.
export const CINTO = {
  dica: 'Ponha o cinto antes de andar — você e a vovó!',
  multaReal: { artigo: 'CTB art. 167', natureza: 'grave', confirmado: true, fonte: CTB },
};
// Ambulância e bicicleta (specs 023/024): artigos CONFERIDOS; no jogo nunca viram multa (não há agente vendo).
export const AMBULANCIA = {
  dica: 'Ambulância! Vá para a direita e pare até ela passar.',
  multaReal: { artigo: 'CTB art. 189', natureza: 'gravissima', confirmado: true, fonte: CTB },
};
export const BICICLETA = {
  dica: 'Deixe 1,5 m de distância ao passar a bicicleta.',
  multaReal: { artigo: 'CTB art. 201', natureza: 'media', confirmado: true, fonte: CTB },
};
// Specs 026–028: buzina (art. 227, leve, CONFERIDO) e art. 220 (VIII chuva, XI animal): a natureza dos incisos II–XII
// é NÃO CONFIRMADA (item 12/19) → as dicas citam só o artigo, nunca a natureza. Nada disso vira multa no jogo.
export const BUZINA = {
  dica: 'Perto do posto de saúde: silêncio, nada de buzina!',
  multaReal: { artigo: 'CTB art. 227', natureza: 'leve', confirmado: true, fonte: CTB },
};
export const REDUZIR = {   // art. 220: deixar de reduzir a velocidade (o inciso vai na dica de cada situação)
  chuva: { dica: 'Na chuva o carro escorrega e freia mais longe: vá mais devagar!', artigo: 'CTB art. 220, VIII', fonte: CTB },
  neblina: { dica: 'Na neblina quase não dá pra ver: vá devagar e de farol baixo!', artigo: 'CTB art. 220, VIII', fonte: CTB },   // spec 035
  animal: { dica: 'Animal na pista! Reduza e espere ele passar.', artigo: 'CTB art. 220, XI', fonte: CTB },
  bola: { dica: 'Bola na rua? Uma criança pode vir atrás! Reduza.', artigo: null, fonte: null },
};
// Centro (spec 034): mão única (art. 186 II) e vaga reservada (art. 181 XX), CONFERIDOS. Nunca viram multa no jogo.
export const CONTRAMAO = {
  dica: 'Contramão! Rua de mão única: siga o sentido da seta.',
  multaReal: { artigo: 'CTB art. 186, II', natureza: 'gravissima', confirmado: true, fonte: CTB },
};
export const VAGA = {
  dica: 'Vaga de idoso e de pessoa com deficiência: só com credencial! Procure uma vaga comum.',
  multaReal: { artigo: 'CTB art. 181, XX', natureza: 'gravissima', confirmado: true, fonte: CTB },
};
// Saída de garagem (spec 036): art. 36 é regra de conduta SEM penalidade própria → a dica cita a regra, não "multa".
export const GARAGEM_REGRA = {
  dica: 'Saindo da garagem: espere quem vem pela rua passar!',
  regra: 'CTB art. 36', temMulta: false, fonte: CTB,
};
// spec 040: na ponte não se ultrapassa (art. 32: regra; art. 203, III: a infração, gravíssima, multa ×5 — conferido
// no Planalto em 15/10/2026, lei/ctb-conferido.md item 22). No jogo: só −⭐ + dica, nunca multa.
export const ULTRAPASSAR = {
  dica: 'Na ponte não se ultrapassa! Espere a ponte acabar.',
  multaReal: { artigo: 'CTB art. 203, III', natureza: 'gravissima', fator: 5, confirmado: true, fonte: CTB },
};
// spec 040: estrada = via de trânsito rápido, 80 km/h onde não há placa (art. 61, § 1º, I, a); a placa manda (caput)
export const VIA_RAPIDA = { dica: 'Estrada: o limite aqui é 80 km/h. Veja a placa!', regra: 'CTB art. 61', limiteKmh: 80, fonte: CTB };
// spec 042: estacionar na rua (art. 181 — conferido no Planalto em 19/10/2026, lei/ctb-conferido.md item 23). No jogo
// nada vira multa: só −⭐ + dica "Na vida real dá multa (Art. 181, …)".
export const ESTACIONAR_RUA = {
  meioFio: 0.5,                          // até 50 cm do meio-fio = certo
  afastado: { dica: 'Longe do meio-fio! Encoste até 50 cm da calçada.', artigo: 'CTB art. 181, II', natureza: 'leve' },
  muitoAfastado: { dica: 'Muito longe do meio-fio! Encoste na calçada.', artigo: 'CTB art. 181, III', natureza: 'grave' },
  esquina: { dica: 'Na esquina não se estaciona: deixe 5 m livres.', artigo: 'CTB art. 181, I', natureza: 'media' },
  guia: { dica: 'Na frente de garagem (guia rebaixada) não se estaciona!', artigo: 'CTB art. 181, IX', natureza: 'media' },
  filaDupla: { dica: 'Fila dupla! Não pare ao lado de carro estacionado.', artigo: 'CTB art. 181, XI', natureza: 'grave' },
  contramao: { dica: 'Estacionou na contramão! Encoste no lado direito da rua.', artigo: 'CTB art. 181, XV', natureza: 'media' },
  confirmado: true, fonte: CTB,
};
// spec 050: atropelar (pedestre, criança, ciclista, animal). Regra: art. 29, § 2º ("os motorizados [...] juntos, pela
// incolumidade dos pedestres"); na vida real é CRIME (art. 303: lesão corporal culposa na direção — detenção de 6 meses a
// 2 anos e suspensão da habilitação). Conferido no Planalto em 21/10/2026 (lei/ctb-conferido.md item 24). No jogo: −50 ⭐.
export const ATROPELAMENTO = {
  dica: 'Atropelou! Quem dirige é sempre responsável por quem está a pé.',
  regra: 'CTB art. 29, § 2º', crime: 'CTB art. 303', confirmado: true, fonte: CTB,
};
export const SETA = {
  dica: 'Dê a seta antes de virar!',
  multaReal: { artigo: INFRACOES.seta.artigo, natureza: INFRACOES.seta.natureza, confirmado: true, fonte: CTB },
};
