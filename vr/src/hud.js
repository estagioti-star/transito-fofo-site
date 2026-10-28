// HUD do jogo: placar ⭐ 🪪 💰, aviso de infração de 1 linha, "+10 ⭐" voando, flash do radar, seta da missão e
// relatório da viagem. Só DOM: todo número legal vem do evento do fiscal (multa(id) do lei.js), nada escrito à mão.
// Spec 006: aviso de 3 linhas legível (fila, ≥ 4 s cada), "−20 ⭐" vermelho voando, placar que treme ao perder,
// chip "próximo" (sinal/PARE/radar/faixa/rótula), indicadores dos lados no PARE e a mensagem da batida.
import { PONTOS_JOGO } from './lei.js';

export const brl = v => {
  const neg = v < 0, [int, dec] = Math.abs(v).toFixed(2).split('.');
  return (neg ? '−' : '') + 'R$ ' + int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
};
export const artigoCurto = a => a.replace(/^CTB\s+art\./i, 'Art.');
const NATUREZA_TXT = { leve: 'Leve', media: 'Média', grave: 'Grave', gravissima: 'Gravíssima' };
const TITULO = {
  sinal_vermelho: 'Sinal vermelho', pare: 'Não parou no PARE', pedestre_faixa: 'Pedestre na faixa',
  parar_sobre_faixa: 'Parou em cima da faixa', rotula_preferencia: 'Preferência na rótula',
  preferencia_cruzamento: 'Preferência no cruzamento', celular: 'Celular na mão', cinto: 'Sem cinto',
};
const kmhTxt = k => String(Math.round(k)).replace('.', ',');
export const tituloInfracao = ev => ev.multa.id.startsWith('vel_') ? `Radar ${kmhTxt(ev.kmh)} km/h` : (TITULO[ev.multa.id] || ev.multa.nome);
// "📸 Sinal vermelho! Gravíssima · 7 pts · R$ 293,47 · Art. 208"
export const textoInfracao = ev => {
  const m = ev.multa;
  return `📸 ${tituloInfracao(ev)}! ${NATUREZA_TXT[m.natureza] || m.natureza} · ${m.pontos} pts · ${brl(m.valor)} · ${artigoCurto(m.artigo)}`;
};
export const ACERTO_TXT = {
  parouVermelho: '🚦 Esperou o verde', parouPare: '🛑 Parou no PARE', deuPreferenciaPedestre: '🚶 Esperou o pedestre',
  rotulaCerta: '🔄 Rótula certinha', radarOk: '📷 Radar: velocidade certa', olhouEsperou: '👀 Olhou e esperou',
  setaCerta: '💡 Deu a seta', cintoCerto: '🔒 Pôs o cinto antes de sair',
  saiuGaragem: '🏠 Saiu da garagem com cuidado', bikeLonge: '🚲 Passou longe da bike', deuPassagem: '🚑 Deu passagem à ambulância', reduziuSusto: '🐾 Reduziu e esperou', estacionouCerto: '🅿️ Estacionou certinho', esperouPonte: '🌉 Esperou a ponte acabar', balizaCerta: '🚙 Baliza certinha',
};
// spec 007: texto do aviso de GPS — "⬅️ Vira à esquerda em 80 m"
export const GPS_AGORA_M = 15;
const metros = d => `${Math.max(0, Math.round(d / 5) * 5)} m`;
export const textoGps = (lado, d, saida) => saida
  ? (d <= GPS_AGORA_M ? `🔄 Sai agora (${saida}ª saída)!` : `🔄 Rótula: ${saida}ª saída · ${metros(d)}`)
  : d <= GPS_AGORA_M ? `${lado === 'esq' ? '⬅️' : '➡️'} Vira agora!`
  : `${lado === 'esq' ? '⬅️ Vira à esquerda' : '➡️ Vira à direita'} em ${metros(d)}`;
const menos = n => '−' + Math.abs(n);
// aviso de 3 linhas: "📸 SINAL VERMELHO!" / "−R$ 293,47 · +7 pts na carteira · −20 ⭐" / explicação
export const avisoInfracao = ev => {
  const m = ev.multa;
  return {
    titulo: `📸 ${tituloInfracao(ev).toUpperCase()}!`,
    linha: [`−${brl(m.valor)}`, `+${m.pontos} pts na carteira`, `${menos(PONTOS_JOGO.infracao)} ⭐`],
    explica: m.explica,
  };
};

export function criarHud() {
  const $ = id => document.getElementById(id);
  const el = {
    estrelas: $('estrelas'), cnh: $('pontosCnh'), dinheiro: $('dinheiro'), msg: $('msg'), aviso: $('aviso'),
    avisoLinha: $('avisoLinha'), avisoExplica: $('avisoExplica'), flash: $('flash'), seta: $('seta'), rumoTxt: $('rumoTxt'),
    rel: $('relatorio'), voo: $('voo'), foto: $('fotoRadar'), fotoImg: $('fotoImg'), fotoTxt: $('fotoTxt'), avisoTitulo: $('avisoTitulo'), proximo: $('proximo'),
    ladoEsq: $('ladoEsq'), ladoDir: $('ladoDir'), dica: $('dica'), dicaTxt: $('dicaTxt'), dicaSub: $('dicaSub'),
    gps: $('gps'), hud: $('hud'), gpsTxt: $('gpsTxt'), gpsSub: $('gpsSub'), setaEsq: $('setaEsq'), setaDir: $('setaDir'),
  };
  let dicaT = 0;
  const AVISO_SEG = 4.2;                                       // cada aviso de multa fica ≥ 4 s; o seguinte espera na fila
  let msgT = 0, avisoT = 0, ultimo = { e: null, p: null, d: null }, fila = [];
  const pulo = (e, cls = 'pula') => { const s = e.parentElement; s.classList.remove('pula', 'treme'); void s.offsetWidth; s.classList.add(cls); };

  function placar(est) {
    const e = Math.max(0, Math.round(est.estrelas));         // ⭐ nunca abaixo de 0 na tela (o fiscal pode guardar negativo)
    if (e !== ultimo.e) { el.estrelas.textContent = e; if (ultimo.e !== null) pulo(el.estrelas, e < ultimo.e ? 'treme' : 'pula'); ultimo.e = e; }
    if (est.pontosCnh !== ultimo.p) { el.cnh.textContent = est.pontosCnh; if (ultimo.p !== null) pulo(el.cnh); ultimo.p = est.pontosCnh; }
    if (est.dinheiro !== ultimo.d) { el.dinheiro.textContent = brl(est.dinheiro).replace('R$ ', ''); if (ultimo.d !== null) pulo(el.dinheiro); ultimo.d = est.dinheiro; }
  }
  function msg(txt, secs = 2.5) {
    if (avisoT > 0 || dicaT > 0) return;                     // o aviso de multa e a dica têm prioridade
    el.msg.textContent = txt; el.msg.classList.remove('hidden'); msgT = secs;
    el.msg.style.animation = 'none'; void el.msg.offsetWidth; el.msg.style.animation = '';
  }
  function voa(txt, perde = false) {                           // "+10 ⭐" (dourado) / "−20 ⭐" (vermelho) voa até o placar
    const s = document.createElement('div');
    s.className = perde ? 'voa perde' : 'voa'; s.textContent = txt;
    el.voo.appendChild(s);
    const alvo = el.estrelas.getBoundingClientRect();
    const x0 = innerWidth / 2, y0 = innerHeight * 0.42;     // spec 008: nasce logo abaixo dos avisos e voa para o placar
    s.style.left = x0 + 'px'; s.style.top = y0 + 'px';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      s.style.transform = `translate(${alvo.left + alvo.width / 2 - x0}px, ${alvo.top + alvo.height / 2 - y0}px) scale(.6)`;
      s.style.opacity = '0.2';
    }));
    setTimeout(() => s.remove(), 1300);
  }
  function acerto(ev) { voa(`+${ev.pontos} ⭐`); msg(`${ACERTO_TXT[ev.motivo] || '👍 Muito bem'}! +${ev.pontos} ⭐`, 1.8); }
  function mostraAviso(ev) {
    el.msg.classList.add('hidden'); msgT = 0; el.dica.classList.add('hidden'); dicaT = 0;
    const a = avisoInfracao(ev);
    el.avisoTitulo.textContent = a.titulo;
    el.avisoLinha.innerHTML = a.linha.map(p => `<span class="nw">${p}</span>`).join(' · ');   // "R$ 293,47" nunca quebra
    el.avisoExplica.textContent = a.explica;
    el.aviso.classList.remove('hidden');
    el.aviso.style.animation = 'none'; void el.aviso.offsetWidth; el.aviso.style.animation = '';
    avisoT = AVISO_SEG;
  }
  // spec 051: a foto do radar — { img (dataURL), kmh, lim, rua, quando }; some sozinha em 5 s
  let fotoT = null;
  function fotoRadar(f) {
    if (!el.foto) return;
    if (f.img) el.fotoImg.src = f.img;
    el.fotoTxt.innerHTML = `Velocidade medida: <b>${f.kmh} km/h</b><br>Limite da via: ${f.lim} km/h<br>${f.rua || ''}<br>${f.quando}`;
    el.foto.classList.remove('hidden', 'entra'); void el.foto.offsetWidth; el.foto.classList.add('entra');
    clearTimeout(fotoT); fotoT = setTimeout(() => el.foto.classList.add('hidden'), 5000);
  }
  function infracao(ev, radar) {
    voa(`${menos(PONTOS_JOGO.infracao)} ⭐`, true);
    if (avisoT > 0) fila.push(ev); else mostraAviso(ev);
    if (radar) { el.flash.classList.remove('hidden', 'pisca'); void el.flash.offsetWidth; el.flash.classList.add('pisca'); }
  }
  // cartão de dica (1 linha + linha menor opcional); o aviso de multa tem prioridade
  // spec 035: dica que chega com o aviso de multa aberto ESPERA (antes sumia) e aparece quando ele fecha
  let dicaEspera = null;
  function dica(txt, sub = '', secs = 3.2) {
    if (avisoT > 0) { dicaEspera = [txt, sub, secs]; return; }
    el.msg.classList.add('hidden'); msgT = 0;
    el.dicaTxt.textContent = txt; el.dicaSub.textContent = sub; el.dicaSub.classList.toggle('hidden', !sub);
    el.dica.classList.remove('hidden'); dicaT = secs;
    el.dica.style.animation = 'none'; void el.dica.offsetWidth; el.dica.style.animation = '';
  }
  // batida: "−30 ⭐" voando + dica de 1 linha (e, se conferido, o artigo da vida real)
  function batida(ev) {
    if (ev.pontos < 0) voa(`${menos(ev.pontos)} ⭐`, true);
    dica(`💥 ${ev.dica}`, ev.artigo ? `📖 Na vida real isso dá multa (${artigoCurto(ev.artigo)})` : '');
  }
  // seta esquecida (spec 007): "−10 ⭐" + dica com o artigo da vida real (art. 196, conferido) — nunca multa
  function semSeta(ev) {
    voa(`${menos(ev.pontos)} ⭐`, true);
    dica(`💡 ${ev.dica}`, ev.artigo ? `📖 Na vida real dá multa (${artigoCurto(ev.artigo)})` : '');
  }
  // sem cinto (spec 018): "−10 ⭐" + dica com o artigo da vida real (art. 167, conferido) — nunca multa
  function semCinto(ev) {
    voa(`${menos(ev.pontos)} ⭐`, true);
    dica(`🔓 ${ev.dica}`, ev.artigo ? `📖 Na vida real dá multa (${artigoCurto(ev.artigo)})` : '');
  }
  // bicicleta/ambulância (specs 023/024): "−N ⭐" + dica com o artigo da vida real — nunca multa
  function avisoLei(ev, ico) {
    voa(`${menos(ev.pontos)} ⭐`, true);
    // spec 036: regra sem penalidade própria (art. 36) → "Regra do CTB", nunca "dá multa"
    dica(`${ico} ${ev.dica}`, !ev.artigo ? '' : ev.temMulta === false ? `📖 Regra do CTB (${artigoCurto(ev.artigo)})` : `📖 Na vida real dá multa (${artigoCurto(ev.artigo)})`);
  }
  // aviso de GPS: { lado, d, ok } ou null. Some enquanto o aviso de multa ou a dica estão abertos (eles mandam).
  let gpsK = '';
  function gps(g) {
    const vis = !!g && avisoT <= 0 && dicaT <= 0;
    // spec 020: sinal da rota fechado antes da curva → "espera o verde" no lugar do "vira" (o GPS não manda furar o sinal)
    const txt = vis ? (g.espera ? `${g.espera === 'amarelo' ? '🟡' : '🔴'} Espera o verde para virar` : textoGps(g.lado, g.d, g.saida)) : '';
    const k = vis ? `${txt}|${g.ok}` : '';
    if (k === gpsK) return vis;
    const novo = vis && !gpsK;
    gpsK = k;
    el.gps.classList.toggle('hidden', !vis);
    if (!vis) return false;
    el.gpsTxt.textContent = txt;
    el.gpsSub.textContent = g.ok ? '✅ seta ligada!' : (g.espera ? 'mas já liga a seta' : 'liga a seta!');
    el.gps.classList.toggle('ok', !!g.ok && !g.espera); el.gps.classList.toggle('agora', !g.espera && g.d <= GPS_AGORA_M);
    el.gps.classList.toggle('espera', !!g.espera);
    if (novo) { el.gps.style.animation = 'none'; void el.gps.offsetWidth; el.gps.style.animation = ''; }
    return true;
  }
  // botões da seta: lado ligado ('esq'|'dir'|null) e a fase do pisca
  let setasK = '';
  function setas(lado, aceso) {
    const k = `${lado}|${aceso}`;
    if (k === setasK) return;
    setasK = k;
    for (const [b, l] of [[el.setaEsq, 'esq'], [el.setaDir, 'dir']]) {
      b.classList.toggle('ligada', lado === l); b.classList.toggle('aceso', lado === l && !!aceso);
    }
  }
  let cartaoK = false;
  function tick(dt) {
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) el.msg.classList.add('hidden'); }
    if (dicaT > 0) { dicaT -= dt; if (dicaT <= 0) el.dica.classList.add('hidden'); }
    if (avisoT > 0) {
      avisoT -= dt;
      if (avisoT <= 0) { if (fila.length) mostraAviso(fila.shift()); else el.aviso.classList.add('hidden'); }
      if (avisoT <= 0 && dicaEspera) { const d = dicaEspera; dicaEspera = null; dica(...d); }
    }
    const cartao = avisoT > 0 || dicaT > 0;          // spec 008: o cartão ocupa o alto do meio; os indicadores do PARE esperam
    if (cartao !== cartaoK) { cartaoK = cartao; el.hud.classList.toggle('cartao', cartao); }
  }
  // chips "próximo" abaixo do placar: [{ txt, cor?, tipo }] (vazio = esconde)
  let proxK = '';
  function proximo(lista = []) {
    const k = lista.map(p => p.txt + '|' + (p.cor || '')).join('#');
    if (k === proxK) return;
    proxK = k;
    el.proximo.classList.toggle('hidden', !lista.length);
    el.proximo.innerHTML = lista.map(p => `<span class="chip${p.cor ? ' ' + p.cor : ''}" data-tipo="${p.tipo}">${p.txt}</span>`).join('');
  }
  // indicadores dos lados no PARE: { esquerda, direita } (true = vem carro) ou null (esconde)
  let ladosK = '';
  function lados(p) {
    const k = p ? `${p.esquerda}|${p.direita}` : '';
    if (k === ladosK) return;
    ladosK = k;
    for (const [e, vem] of [[el.ladoEsq, p && p.esquerda], [el.ladoDir, p && p.direita]]) {
      e.classList.toggle('hidden', !p);
      if (!p) continue;
      e.classList.toggle('vem', !!vem); e.classList.toggle('livre', !vem);
      e.textContent = vem ? '🚗 vem vindo!' : '✅ livre';
    }
  }
  function rumo(rel, dist) {                                   // rel: ângulo do alvo em relação à frente (+ = esquerda)
    el.seta.style.transform = `rotate(${(-rel * 180 / Math.PI).toFixed(0)}deg)`;
    el.rumoTxt.textContent = `${Math.max(0, Math.round(dist / 10) * 10)} m`;
  }

  function relatorio(est, { tempo, onDeNovo, onMenu, missao, viagem } = {}) {
    if (missao) { $('relIcone').textContent = missao.icone; $('relTitulo').textContent = missao.relTitulo; $('relSub').textContent = missao.relSub; }
    // spec 021: medalha da viagem (e se é a melhor até agora nessa missão)
    const md = viagem ? viagem.medalha : null;
    $('relMedalha').innerHTML = md ? `${{ ouro: '🥇', prata: '🥈', bronze: '🥉' }[md]}${viagem.nova ? '<small>nova!</small>' : ''}` : '';
    $('relMedalha').title = md ? { ouro: 'Ouro: nenhum erro', prata: 'Prata: nenhuma multa', bronze: 'Bronze: chegou' }[md] : '';
    const grupo = {};
    for (const a of est.acertos) (grupo[a.motivo] ||= { n: 0, pts: 0 }), grupo[a.motivo].n++, grupo[a.motivo].pts += a.pontos;
    const li = [];
    if (est.odometro > 0) li.push(`<li class="ok">🛣️ Andou certinho <b>+${est.odometro} ⭐</b></li>`);
    for (const [k, g] of Object.entries(grupo)) li.push(`<li class="ok">${ACERTO_TXT[k] || k}${g.n > 1 ? ' ×' + g.n : ''} <b>+${g.pts} ⭐</b></li>`);
    const bat = (est.batidas || []).filter(b => b.pontos < 0);
    if (bat.length) li.push(`<li class="bat">💥 Batida${bat.length > 1 ? 's ×' + bat.length : ''} <b>−${-bat.reduce((s, b) => s + b.pontos, 0)} ⭐</b></li>`);
    for (const [lista, ico, txt, art] of [[est.bikePerto, '🚲', 'Perto da bike', 'Art. 201'], [est.semPassagem, '🚑', 'Não deu passagem', 'Art. 189'],
      [est.naoReduziu, '🐾', 'Não reduziu', ''], [est.buzinadas, '📯', 'Buzinou no silêncio', 'Art. 227'], [est.chuvaRapido, '🌧️', 'Rápido na chuva/neblina', 'Art. 220'],
      [est.contramaos, '⛔', 'Contramão (mão única)', 'Art. 186'], [est.vagasErradas, '♿', 'Vaga reservada', 'Art. 181'],
      [est.garagem, '🏠', 'Saiu da garagem sem esperar', 'Art. 36'], [est.ultrapassagens, '🌉', 'Ultrapassou na ponte', 'Art. 203, III'], [est.estacionouErrado, '🅿️', 'Estacionou errado na rua', 'Art. 181'], [est.atropelamentos, '🚨', 'Atropelou', 'Art. 29 § 2º — na vida real é crime (Art. 303)']]) {
      const l = lista || [];
      if (l.length) li.push(`<li class="bat">${ico} ${txt}${l.length > 1 ? ' ×' + l.length : ''} ${art ? `<small class="lin">· ${art}</small>` : ''} <b>−${-l.reduce((s, e) => s + e.pontos, 0)} ⭐</b></li>`);
    }
    const sc = est.semCinto || [];
    if (sc.length) li.push(`<li class="bat">🔓 Sem cinto${sc.length > 1 ? ' ×' + sc.length : ''} <small class="lin">· Art. 167</small> <b>−${-sc.reduce((s, e) => s + e.pontos, 0)} ⭐</b></li>`);
    const ss = est.semSeta || [];
    if (ss.length) li.push(`<li class="bat">💡 Sem seta${ss.length > 1 ? ' ×' + ss.length : ''} <small class="lin">· Art. 196</small> <b>−${-ss.reduce((s, e) => s + e.pontos, 0)} ⭐</b></li>`);
    for (const e of est.infracoes) {
      const m = e.multa;
      li.push(`<li class="multa" data-id="${m.id}" data-valor="${m.valor}" data-pontos="${m.pontos}">📸 ${tituloInfracao(e)}`
        + `<small>${NATUREZA_TXT[m.natureza]} · ${m.pontos} pts · ${artigoCurto(m.artigo)}</small><b>${brl(m.valor)}</b></li>`);
    }
    if (!est.infracoes.length) li.push('<li class="ok">🎉 Nenhuma multa! Motorista nota 10</li>');
    const total = est.infracoes.reduce((s, e) => s + e.multa.valor, 0);
    const sp = est.suspensao;
    $('relEstrelas').textContent = Math.max(0, Math.round(est.estrelas));
    $('relLista').innerHTML = li.join('');
    $('relTotal').textContent = brl(Math.round(total * 100) / 100);
    $('relTotal').dataset.valor = (Math.round(total * 100) / 100).toFixed(2);
    // spec 022: a carteirinha soma as viagens (art. 261); sem `viagem` (testes antigos) mostra só esta viagem
    const c = viagem ? viagem.cnh : sp;
    $('relPontos').textContent = c.pontos;
    $('relSusp').textContent = c.suspenso ? `🚫 CNH suspensa! (limite ${c.limite} pts) A carteirinha volta a zero.` : `✅ CNH em dia (limite ${c.limite} pts)`;
    $('relSusp').className = c.suspenso ? 'ruim' : 'bom';
    $('menuBtn').onclick = () => { el.rel.classList.add('hidden'); onMenu && onMenu(); };
    $('menuBtn').classList.toggle('hidden', !onMenu);
    $('relTempo').textContent = tempo ? `⏱️ ${Math.round(tempo)} s` : '';
    $('relatorio').classList.toggle('semMulta', !est.infracoes.length);
    el.rel.classList.remove('hidden');
    $('deNovoBtn').onclick = () => { el.rel.classList.add('hidden'); onDeNovo && onDeNovo(); };
  }
  function reset() { dicaEspera = null; ultimo = { e: null, p: null, d: null }; el.aviso.classList.add('hidden'); el.msg.classList.add('hidden'); el.dica.classList.add('hidden'); avisoT = msgT = dicaT = 0; fila = []; lados(null); proximo([]); gps(null); setas(null, false); }

  return { placar, msg, dica, voa, acerto, infracao, fotoRadar, batida, semSeta, semCinto, avisoLei, gps, setas, proximo, lados, tick, rumo, relatorio, reset, get avisoAberto() { return avisoT > 0; } };
}
