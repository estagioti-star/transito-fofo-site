// Sons (WebAudio): motor sintetizado, buzina (gravação CC0 de Fusca, com reserva sintetizada), batida, chegada,
// ding de acerto, clique de câmera do radar e apito da infração; spec 006: pow (batida) e plim (odômetro);
// spec 007: gps (plim-plom do aviso de conversão) e tique (pisca).
// Adaptado do sfx do Martina Kart.
export function criarSons() {
  let ctx = null, master = null, eng = null, engGain = null, last = 0, muted = false, fusca = null;
  let engSub = null, engLp = null, engTrem = null, engPulso = null, vAnt = 0;   // motor (spec 035)
  const MARCHAS = [0, 4.5, 9, 13.5, 18, 24];      // trocas de marcha (m/s ≈ 16, 32, 49, 65 km/h)
  try { muted = localStorage.getItem('transitoMudo') === '1'; } catch (e) {}
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
      // spec 035: motor novo — 2 osciladores (ronco + sub-grave) num passa-baixa que abre com a rotação, e um tremolo na
      // frequência das explosões (a "batidinha"); a rotação sobe em cada marcha e cai na troca
      eng = ctx.createOscillator(); eng.type = 'sawtooth';
      engSub = ctx.createOscillator(); engSub.type = 'square';
      engLp = ctx.createBiquadFilter(); engLp.type = 'lowpass'; engLp.frequency.value = 300; engLp.Q.value = 1.2;
      const mix = ctx.createGain(); mix.gain.value = 0.7;
      engTrem = ctx.createGain(); engTrem.gain.value = 1;
      engPulso = ctx.createOscillator(); engPulso.type = 'sine';
      const prof = ctx.createGain(); prof.gain.value = 0.35;
      engPulso.connect(prof).connect(engTrem.gain);
      engGain = ctx.createGain(); engGain.gain.value = 0;
      eng.connect(engLp); engSub.connect(mix).connect(engLp);
      engLp.connect(engTrem).connect(engGain).connect(master);
      for (const o of [eng, engSub, engPulso]) o.start();
      fetch('assets/sons/buzina-fusca.mp3').then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => { fusca = buf; }).catch(() => {});
    } catch (e) { ctx = null; }
  }
  function beep(f, dur, type = 'square', vol = 0.12, quando = 0) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + quando;
    o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur);
  }
  return {
    init,
    get mudo() { return muted; },
    set mudo(v) { muted = v; try { localStorage.setItem('transitoMudo', v ? '1' : '0'); } catch (e) {} if (master) master.gain.value = v ? 0 : 1; },
    buzina() {
      if (!ctx) return;
      if (fusca) { const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = fusca; g.gain.value = 0.2; s.connect(g).connect(master); s.start(); return; }
      const t = ctx.currentTime, shaper = ctx.createWaveShaper(), curve = new Float32Array(256);
      for (let k = 0; k < 256; k++) { const x = k / 128 - 1; curve[k] = Math.tanh(x * 2.5); }
      shaper.curve = curve;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 950; bp.Q.value = 1.3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.1, t + 0.008); g.gain.setValueAtTime(0.1, t + 0.2); g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      shaper.connect(bp).connect(g).connect(master);
      for (const f of [392, 405]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(shaper); o.start(t); o.stop(t + 0.27); }
    },
    motor(v, ligado) {
      if (!ctx) return;
      const sp = Math.abs(v), t = ctx.currentTime;
      // rotação: em cada marcha vai de 900 a ~3200 rpm; na troca cai
      let m = 1; while (m < MARCHAS.length - 1 && sp > MARCHAS[m]) m++;
      const a = MARCHAS[m - 1], b = MARCHAS[m], rpm = 850 + Math.min(1, (sp - a) / Math.max(0.1, b - a)) * (m === 1 ? 2000 : 2300);
      const f = rpm / 60 * 1.5;                                    // ~21–80 Hz: ronco grave
      eng.frequency.setTargetAtTime(f, t, 0.05); engSub.frequency.setTargetAtTime(f / 2, t, 0.05);
      engPulso.frequency.setTargetAtTime(rpm / 60 / 2, t, 0.05);    // "batidinha" das explosões
      engLp.frequency.setTargetAtTime(220 + rpm * 0.16, t, 0.08);
      const acelerando = sp - vAnt > 0.004; vAnt = sp;             // acelerando: mais forte; soltou: mais macio
      engGain.gain.setTargetAtTime(ligado ? (acelerando ? 0.05 : 0.032) : 0, t, 0.12);
    },
    // sirene da ambulância (spec 023): oscilador com o tom subindo e descendo; vol 0 = desliga
    sirene(vol) {
      if (!ctx) return;
      if (!this._sir && vol > 0) {
        const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = 760; lfo.frequency.value = 0.7; lg.gain.value = 260; g.gain.value = 0;
        lfo.connect(lg).connect(o.frequency); o.connect(g).connect(master); o.start(); lfo.start();
        this._sir = { o, lfo, g };
      }
      if (this._sir) this._sir.g.gain.setTargetAtTime(Math.max(0, Math.min(0.06, vol * 0.06)), ctx.currentTime, 0.1);
    },
    re() { beep(1050, 0.28, 'square', 0.05); },                                                  // bipe da ré
    batida() { const t = performance.now(); if (t - last > 250) { last = t; beep(110, 0.12, 'square', 0.08); } },
    ding() { beep(1318, 0.18, 'triangle', 0.13); beep(1760, 0.3, 'triangle', 0.11, 0.09); },          // acerto
    camera() {                                                                                   // clique + flash do radar
      if (!ctx) return;
      const t = ctx.currentTime, n = ctx.sampleRate * 0.06, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
      const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; g.gain.value = 0.35; s.connect(g).connect(master); s.start(t);
      beep(3200, 0.05, 'square', 0.05, 0.005); beep(2400, 0.25, 'sine', 0.04, 0.06);
    },
    apito() {                                                                                    // apito curto do guarda
      if (!ctx) return;
      const t = ctx.currentTime, o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 2750; lfo.frequency.value = 38; lg.gain.value = 120;
      lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.02); g.gain.setValueAtTime(0.09, t + 0.32); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(g).connect(master); o.start(t); lfo.start(t); o.stop(t + 0.42); lfo.stop(t + 0.42);
    },
    // spec 006 — batida engraçada: "bóim" que desce + estalinho de lata (≈ 0,4 s, volume moderado)
    pow() {
      if (!ctx) return;
      const t = ctx.currentTime, n = Math.floor(ctx.sampleRate * 0.12), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
      const s = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), gn = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 1800; gn.gain.value = 0.22;
      s.buffer = buf; s.connect(lp).connect(gn).connect(master); s.start(t);
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(520, t + 0.03); o.frequency.exponentialRampToValueAtTime(110, t + 0.42);
      lfo.frequency.value = 18; lg.gain.value = 30; lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.connect(g).connect(master); o.start(t); lfo.start(t); o.stop(t + 0.46); lfo.stop(t + 0.46);
    },
    // odômetro: "plim" curtinho (70 ms) e baixinho; o tom sobe 1/4 de semitom por ponto da sequência (teto: 1 oitava)
    plim(seq = 1) {
      const semi = Math.min(12, Math.max(0, seq - 1) * 0.25);
      beep(988 * Math.pow(2, semi / 12), 0.07, 'sine', 0.035);
    },
    // a cada 50 da sequência: "plim-plim" mais alto (2 notas de 70 ms)
    plimplim() { beep(1319, 0.07, 'triangle', 0.09); beep(1976, 0.07, 'triangle', 0.09, 0.08); },
    // spec 007 — aviso de GPS "plim-plom" (2 notas que descem) e o tique-taque baixinho da seta
    gps() { beep(1175, 0.16, 'sine', 0.1); beep(880, 0.26, 'sine', 0.09, 0.15); },
    cinto() { beep(1320, 0.22, 'sine', 0.09); beep(990, 0.3, 'sine', 0.08, 0.2); },             // "dim-dom" do painel sem cinto
    clique() { beep(320, 0.04, 'square', 0.08); beep(620, 0.05, 'square', 0.06, 0.05); },       // fivela do cinto
    tique(aceso) { beep(aceso ? 2100 : 1500, 0.018, 'square', 0.018); },
    chegada() { [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.22, 'triangle', 0.14, i * 0.12)); },
  };
}
