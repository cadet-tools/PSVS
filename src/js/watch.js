/* =====================================================================
   Pārskata pulkstenis (taktiskā pulksteņa stilā)
   Ciparnīcas: taktiskā, analogā, lielie cipari, nakts (sarkana).
   Režīmi: laiks, hronometrs (ar apļiem), taimeris (nodarbībām, ar skaņas signālu).
   Taustiņi uz korpusa: LIGHT — lielais skats, UP·MENU — ciparnīca, DOWN — režīms,
   START·STOP — sākt/apturēt, BACK·LAP — aplis / atiestatīt.
   Darba laiks: skaita, kamēr rīks atvērts; pēc N min atgādina par pauzi.
   Bez darbības N min — pulkstenis lielā skatā virs rīka (paslēpj arī datus). Ja iestatīts PIN (lock.js) — izejot prasa PIN.
   ===================================================================== */
(function (CP) {
  'use strict';
  const S = CP.state, A = CP.actions;
  const pad = n => String(n).padStart(2, '0');
  const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
  const hmmss = ms => ms >= 3600000 ? `${Math.floor(ms / 3600000)}:${mmss(ms % 3600000)}` : mmss(ms);
  const swFmt = ms => { const cs = Math.floor(ms / 10) % 100; return `${hmmss(ms)}.${pad(cs)}`; };
  const DAYS = ['Svētdiena', 'Pirmdiena', 'Otrdiena', 'Trešdiena', 'Ceturtdiena', 'Piektdiena', 'Sestdiena'];
  const MONTHS = ['janv.', 'febr.', 'marts', 'apr.', 'maijs', 'jūn.', 'jūl.', 'aug.', 'sept.', 'okt.', 'nov.', 'dec.'];
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ērtībai */ } } };

  /* --- Iestatījumi (pārlūkā + datu failā, tāpat kā izskats) --- */
  const DEF = { face: 'tactical', mode: 'time', workMin: 40, breakMin: 5, snoozeMin: 10, remind: true, idle: true, idleMin: 5, sound: true };
  const FACES = [['tactical', 'Taktiskā'], ['analog', 'Analogā'], ['big', 'Lielie cipari'], ['night', 'Nakts']];
  const MODES = [['time', 'Laiks'], ['stopwatch', 'Hronometrs'], ['timer', 'Taimeris']];
  CP.WATCH_FACES = FACES; CP.WATCH_MODES = MODES;
  function prefs() {
    let p = {}; try { p = JSON.parse(ls.get('cp-watch') || 'null') || {}; } catch (e) { p = {}; }
    const fromDb = S.db?.settings?.look?.watch || {};
    return { ...DEF, ...fromDb, ...p };
  }
  let P = prefs();
  CP.watchPrefs = () => P;
  CP.setWatchPref = (k, v) => {
    P = { ...P, [k]: v };
    ls.set('cp-watch', JSON.stringify(P));
    const st = S.db?.settings; if (st) { st.look = { ...(st.look || {}), watch: { ...P } }; if (S.root) CP.store.changed({ silent: true }); }
    if (k === 'workMin') { ses.remindAt = ses.start + P.workMin * 60000; saveSes(); }
    rebuild();
    if (S.page === 'settings') CP.render();   // lai izvēlētā poga iezīmējas uzreiz
  };

  /* --- Darba sesija --- */
  const KEY = 'cp-session';
  const loadSes = () => { try { return JSON.parse(ls.get(KEY) || 'null'); } catch (e) { return null; } };
  const saveSes = () => ls.set(KEY, JSON.stringify(ses));
  let ses = loadSes(); const t0 = Date.now();
  if (!ses || t0 - (ses.last || 0) > 5 * 60000) ses = { start: t0, last: t0, remindAt: t0 + P.workMin * 60000, breakEnd: 0 };
  saveSes();
  function restart(t = Date.now()) { ses = { start: t, last: t, remindAt: t + P.workMin * 60000, breakEnd: 0 }; saveSes(); }
  A.breakStart = () => { ses.breakEnd = Date.now() + P.breakMin * 60000; saveSes(); paint(true); CP.ui.toast(`Pauze ${P.breakMin} min. Pastaigā, izstaipies, padzer ūdeni.`, 'ok', 8000); };
  A.breakEnd = () => { restart(); paint(true); };

  /* --- Hronometrs un taimeris (tikai šajā cilnē) --- */
  const sw = { run: false, t0: 0, acc: 0, laps: [] };
  const swNow = () => sw.acc + (sw.run ? Date.now() - sw.t0 : 0);
  const cd = { dur: 5 * 60000, end: 0, left: 5 * 60000, run: false, done: false };
  const cdLeft = () => cd.run ? Math.max(0, cd.end - Date.now()) : cd.left;

  A.watchMode = m => { CP.setWatchPref('mode', MODES.some(x => x[0] === m) ? m : MODES[(MODES.findIndex(x => x[0] === P.mode) + 1) % MODES.length][0]); };
  A.watchFace = f => { CP.setWatchPref('face', FACES.some(x => x[0] === f) ? f : FACES[(FACES.findIndex(x => x[0] === P.face) + 1) % FACES.length][0]); };
  A.watchStart = () => {
    if (P.mode === 'time') { P = { ...P, mode: 'stopwatch' }; ls.set('cp-watch', JSON.stringify(P)); }
    if (P.mode === 'stopwatch') { if (sw.run) { sw.acc += Date.now() - sw.t0; sw.run = false; } else { sw.t0 = Date.now(); sw.run = true; } }
    else if (P.mode === 'timer') {
      if (cd.done) { cd.done = false; cd.left = cd.dur; }
      if (cd.run) { cd.left = Math.max(0, cd.end - Date.now()); cd.run = false; } else if (cd.left > 0) { cd.end = Date.now() + cd.left; cd.run = true; }
    }
    rebuild();
  };
  A.watchLap = () => {
    if (P.mode === 'stopwatch') {
      if (sw.run) { const tot = swNow(), prev = sw.laps[0]?.tot || 0; sw.laps.unshift({ n: sw.laps.length + 1, tot, split: tot - prev }); }
      else { sw.acc = 0; sw.laps = []; }
    } else if (P.mode === 'timer') { cd.run = false; cd.done = false; cd.left = cd.dur; }
    rebuild();
  };
  A.watchSet = min => { const m = Math.max(0.25, Math.min(180, Number(min) || 0)); cd.dur = cd.left = Math.round(m * 60000); cd.run = false; cd.done = false; if (P.mode !== 'timer') CP.setWatchPref('mode', 'timer'); else rebuild(); };
  A.watchBig = () => showBig(true);

  /* --- Skaņa (WebAudio, bez failiem) --- */
  let actx = null;
  function beep(times = 3) {
    if (!P.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < times; i++) {
        const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * 0.32;
        o.type = 'square'; o.frequency.value = 1760; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.2);
      }
    } catch (e) { /* bez skaņas */ }
  }
  CP.watchBeep = beep;

  /* --- SVG ģeometrija --- */
  const C = 150, R_CASE = 142, R_BEZEL = 128, R_FACE = 104, R_ARC = 95;
  const pt = (deg, r) => { const a = deg * Math.PI / 180; return [C + r * Math.sin(a), C - r * Math.cos(a)]; };
  const f1 = n => n.toFixed(1);
  const arcPath = (from, to, r) => { const [x1, y1] = pt(from, r), [x2, y2] = pt(to, r); return `M${f1(x1)} ${f1(y1)} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${f1(x2)} ${f1(y2)}`; };
  const BTN = [[-60, 'LIGHT', 'watchBig', 'Liels pulkstenis'], [-110, 'UP · MENU', 'watchFace', 'Mainīt ciparnīcu'], [-145, 'DOWN', 'watchMode', 'Mainīt režīmu'], [60, 'START · STOP', 'watchStart', 'Sākt / apturēt'], [120, 'BACK · LAP', 'watchLap', 'Aplis / atiestatīt']];
  function ticks() {
    let s = '';
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0, [x1, y1] = pt(i * 6, R_BEZEL - (major ? 13 : 7)), [x2, y2] = pt(i * 6, R_BEZEL - 2);
      s += `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" class="${major ? 'tk-major' : 'tk'}"/>`;
    }
    return s;
  }
  let uid = 0;
  function caseSvg(inner, id) {
    const btns = BTN.map(([d, , act, title]) => { const [x, y] = pt(d, R_CASE + 4); return `<g class="w-btnhit" data-act="${act}" role="button" aria-label="${title}"><title>${title}</title><circle cx="${f1(x)}" cy="${f1(y)}" r="16" fill="transparent"/><rect class="w-btn" x="${f1(x - 9)}" y="${f1(y - 5)}" width="18" height="10" rx="3" transform="rotate(${d + 90} ${f1(x)} ${f1(y)})"/></g>`; }).join('');
    const txt = BTN.map(([d, t], i) => {
      const r = R_CASE - 7, [x1, y1] = pt(d - 15, r), [x2, y2] = pt(d + 15, r), bottom = Math.abs(d) > 90;
      const path = bottom ? `M${f1(x2)} ${f1(y2)} A${r} ${r} 0 0 0 ${f1(x1)} ${f1(y1)}` : `M${f1(x1)} ${f1(y1)} A${r} ${r} 0 0 1 ${f1(x2)} ${f1(y2)}`;
      return `<path id="${id}t${i}" d="${path}" fill="none"/><text class="w-engr"><textPath href="#${id}t${i}" startOffset="50%" text-anchor="middle">${t}</textPath></text>`;
    }).join('');
    return `<svg class="watch" viewBox="0 0 300 300" role="img" aria-label="Pulkstenis">
      <defs><linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="st-a"/><stop offset=".5" class="st-b"/><stop offset="1" class="st-c"/></linearGradient>
      <radialGradient id="${id}f" cx=".5" cy=".42" r=".65"><stop offset="0" class="fc-a"/><stop offset="1" class="fc-b"/></radialGradient></defs>
      ${btns}<circle cx="${C}" cy="${C}" r="${R_CASE}" class="w-case" fill="url(#${id}s)"/><circle cx="${C}" cy="${C}" r="${R_BEZEL + 1}" class="w-bezel"/>${txt}
      <g class="w-ticks">${ticks()}</g><circle cx="${C}" cy="${C}" r="${R_FACE}" class="w-face" fill="url(#${id}f)"/>${inner}</svg>`;
  }
  const arcs = () => `<path d="${arcPath(205, 335, R_ARC)}" class="w-track" pathLength="100"/><path data-w="arcA" d="${arcPath(205, 335, R_ARC)}" class="w-arc" pathLength="100" stroke-dasharray="0 100"/>
    <path d="${arcPath(25, 155, R_ARC)}" class="w-track" pathLength="100"/><path data-w="arcB" d="${arcPath(25, 155, R_ARC)}" class="w-arc w-arc2" pathLength="100" stroke-dasharray="0 100"/>`;
  /** Ciparnīcas iekšpuse atkarībā no ciparnīcas un režīma */
  function faceInner() {
    const f = P.face, m = P.mode;
    if (f === 'analog') {
      let nums = ''; for (const [h, n] of [[0, '12'], [90, '3'], [270, '9']]) { const [x, y] = pt(h, 82); nums += `<text x="${f1(x)}" y="${f1(y + 6)}" class="w-num">${n}</text>`; }
      return `${nums}<text x="${C}" y="114" class="w-date" data-w="date"></text>
        <text x="${C}" y="176" class="w-lbl" data-w="lbl"></text>
        <rect x="${C - 44}" y="184" width="88" height="28" rx="7" class="w-win"/><text x="${C}" y="204" class="w-winv" data-w="small"></text>
        <g data-w="hh"><line x1="${C}" y1="${C + 12}" x2="${C}" y2="${C - 52}" class="w-hand-h"/></g>
        <g data-w="mm"><line x1="${C}" y1="${C + 16}" x2="${C}" y2="${C - 80}" class="w-hand-m"/></g>
        <g data-w="ss"><line x1="${C}" y1="${C + 22}" x2="${C}" y2="${C - 88}" class="w-hand-s"/></g>
        <circle cx="${C}" cy="${C}" r="5" class="w-pin"/>`;
    }
    if (f === 'big') {
      return `<text x="${C}" y="104" class="w-date" data-w="date"></text>
        <text x="${C}" y="${m === 'time' ? 170 : 164}" class="w-huge ${m === 'stopwatch' ? 'sw' : ''}" data-w="main"></text>
        <text x="${C}" y="204" class="w-lbl" data-w="lbl"></text><text x="${C}" y="228" class="w-work" data-w="small"></text>`;
    }
    // taktiskā un nakts
    return `${arcs()}<text x="${C}" y="98" class="w-date" data-w="date"></text>
      <text x="${m === 'time' ? C - 10 : C}" y="160" class="w-time ${m === 'stopwatch' ? 'sw' : ''}" data-w="main"></text>
      ${m === 'time' ? `<text x="${C + 63}" y="160" class="w-sec" data-w="sec"></text>` : ''}
      <line x1="${C - 58}" y1="176" x2="${C + 58}" y2="176" class="w-rule"/>
      <text x="${C}" y="198" class="w-lbl" data-w="lbl"></text><text x="${C}" y="222" class="w-work" data-w="small"></text>`;
  }
  const modeTabs = () => `<div class="w-modes" role="tablist" aria-label="Pulksteņa režīms">${MODES.map(([k, l]) => `<button type="button" role="tab" aria-selected="${P.mode === k}" class="${P.mode === k ? 'on' : ''}" data-act="watchMode" data-arg="${k}">${l}</button>`).join('')}</div>`;
  function controls() {
    if (P.mode === 'stopwatch') return `<div class="w-ctl"><button type="button" class="mainbtn sm" data-act="watchStart">${sw.run ? 'Apturēt' : (swNow() ? 'Turpināt' : 'Sākt')}</button><button type="button" class="sm" data-act="watchLap">${sw.run ? 'Aplis' : 'Nulles'}</button></div>
      ${sw.laps.length ? `<ol class="w-laps">${sw.laps.slice(0, 6).map(l => `<li><span>${l.n}.</span><b>${swFmt(l.split)}</b><small>${swFmt(l.tot)}</small></li>`).join('')}</ol>` : ''}`;
    if (P.mode === 'timer') return `<div class="w-presets">${[1, 2, 3, 5, 10, 15].map(m => `<button type="button" class="sm ${cd.dur === m * 60000 ? 'on' : ''}" data-act="watchSet" data-arg="${m}">${m} min</button>`).join('')}<input type="number" min="0.25" max="180" step="0.5" id="wCustom" class="w-custom" placeholder="min" title="Savs laiks minūtēs" aria-label="Savs laiks minūtēs"></div>
      <div class="w-ctl"><button type="button" class="mainbtn sm" data-act="watchStart">${cd.run ? 'Pauze' : cd.done ? 'Vēlreiz' : (cd.left < cd.dur ? 'Turpināt' : 'Sākt')}</button><button type="button" class="sm" data-act="watchLap">Atiestatīt</button></div>`;
    return `<div class="w-foot" data-w="note"></div>`;
  }

  CP.watch = {
    html() {
      return `<section class="card watch-card" data-face="${P.face}" data-mode="${P.mode}">
        <div class="w-host">${caseSvg(faceInner(), 'w' + (++uid))}</div>
        ${modeTabs()}<div class="w-panel">${controls()}</div>
      </section>`;
    },
    paint: () => paint(true)
  };
  /** Pārzīmē pulksteņa kartīti (pēc režīma/ciparnīcas maiņas), nepārzīmējot visu lapu */
  function rebuild() {
    document.querySelectorAll('.watch-card').forEach(card => { const tmp = document.createElement('div'); tmp.innerHTML = CP.watch.html(); card.replaceWith(tmp.firstElementChild); });
    const ov = document.getElementById('watchBig'); if (ov) ov.querySelector('.wb-host').innerHTML = caseSvg(faceInner(), 'wb' + (++uid));
    paint(true);
  }

  /* --- Zīmēšana --- */
  const set = (root, k, v) => root.querySelectorAll(`[data-w="${k}"]`).forEach(el => { if (el.textContent !== v) el.textContent = v; });
  const attr = (root, k, a, v) => root.querySelectorAll(`[data-w="${k}"]`).forEach(el => el.setAttribute(a, v));
  function paint(full) {
    const roots = [...document.querySelectorAll('.watch-card, #watchBig')]; if (!roots.length) return;
    const d = new Date(), t = d.getTime(), work = t - ses.start, onBreak = !!ses.breakEnd;
    const workTxt = onBreak ? mmss(ses.breakEnd - t) : hmmss(work), workLbl = onBreak ? 'Pauze' : 'Darbā';
    const workPct = onBreak ? 100 - (ses.breakEnd - t) / (P.breakMin * 600) : Math.min(100, work / (P.workMin * 600));
    const over = !onBreak && work >= P.workMin * 60000;
    const h = d.getHours() % 12, mi = d.getMinutes(), s = d.getSeconds();
    for (const r of roots) {
      r.dataset.face = P.face; r.dataset.mode = P.mode;
      let state = onBreak ? 'break' : over ? 'over' : '';
      set(r, 'date', `${DAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`);
      attr(r, 'hh', 'transform', `rotate(${(h + mi / 60) * 30} ${C} ${C})`); attr(r, 'mm', 'transform', `rotate(${(mi + s / 60) * 6} ${C} ${C})`); attr(r, 'ss', 'transform', `rotate(${s * 6} ${C} ${C})`);
      if (P.mode === 'time') {
        set(r, 'main', `${pad(d.getHours())}:${pad(mi)}`); set(r, 'sec', pad(s));
        set(r, 'lbl', workLbl); set(r, 'small', workTxt);
        attr(r, 'arcA', 'stroke-dasharray', `${f1(workPct)} 100`); attr(r, 'arcB', 'stroke-dasharray', `${f1(s / 59 * 100)} 100`);
      } else if (P.mode === 'stopwatch') {
        const ms = swNow();
        set(r, 'main', P.face === 'analog' ? swFmt(ms) : swFmt(ms));
        set(r, 'lbl', sw.laps.length ? `Aplis ${sw.laps.length + 1}` : 'Hronometrs');
        set(r, 'small', P.face === 'analog' ? swFmt(ms) : sw.laps.length ? swFmt(ms - sw.laps[0].tot) : (sw.run ? 'iet…' : 'START — sākt'));
        attr(r, 'arcA', 'stroke-dasharray', `${f1((ms % 60000) / 600)} 100`); attr(r, 'arcB', 'stroke-dasharray', `${f1(workPct)} 100`);
        state = sw.run ? 'run' : state;
      } else {
        const left = cdLeft(), txt = hmmss(Math.ceil(left / 1000) * 1000);
        set(r, 'main', txt); set(r, 'lbl', cd.done ? 'Laiks beidzies!' : cd.run ? 'Taimeris' : 'Taimeris · gaida');
        set(r, 'small', P.face === 'analog' ? txt : `no ${hmmss(cd.dur)}`);
        attr(r, 'arcA', 'stroke-dasharray', `${f1(100 - left / cd.dur * 100)} 100`); attr(r, 'arcB', 'stroke-dasharray', `${f1(workPct)} 100`);
        state = cd.done ? 'alarm' : cd.run ? 'run' : state;
      }
      if (P.face === 'analog' && P.mode === 'time') set(r, 'small', workTxt);
      r.dataset.state = state;
      const note = r.querySelector('[data-w="note"]');
      if (note) {
        const key = onBreak ? 'b' : over ? 'o' : (P.remind ? 'w' + Math.ceil((P.workMin * 60000 - work) / 60000) : 'n' + Math.floor(work / 60000));
        if (full || note.dataset.k !== key) {
          note.dataset.k = key;
          note.innerHTML = onBreak ? `<span>Pauze līdz ${new Date(ses.breakEnd).toLocaleTimeString('lv-LV', { hour: '2-digit', minute: '2-digit' })}</span><button type="button" class="sm ghost" data-act="breakEnd">Turpināt darbu</button>`
            : over && P.remind ? `<span>Laiks pauzei</span><button type="button" class="sm" data-act="breakStart">Sākt pauzi</button>`
            : P.remind ? `<span>Pauze pēc ${Math.max(1, Math.ceil((P.workMin * 60000 - work) / 60000))} min</span>` : `<span>Darbā ${Math.floor(work / 60000)} min</span>`;
        }
      }
    }
  }

  /* --- Laika cikls --- */
  let lastIdleCheck = 0;
  function tick() {
    const t = Date.now();
    if (document.visibilityState === 'visible') { if (t - ses.last > 5 * 60000) restart(t); ses.last = t; }
    if (ses.breakEnd && t >= ses.breakEnd) { restart(t); beep(2); CP.ui.toast('Pauze beigusies. Labu darbu turpinot!', 'ok', 8000); }
    if (P.remind && !ses.breakEnd && t >= ses.remindAt && document.visibilityState === 'visible') {
      ses.remindAt = t + P.snoozeMin * 60000;
      CP.ui.toast(`Labs darbs! Tu strādā jau ${Math.round((t - ses.start) / 60000)} min. Laiks paņemt īsu pauzi — acīm un mugurai tas noder.`, 'ok', 60000, { act: 'breakStart', label: `Sākt pauzi (${P.breakMin} min)` });
    }
    if (cd.run && t >= cd.end) { cd.run = false; cd.left = 0; cd.done = true; beep(4); CP.ui.toast(`Taimeris: ${hmmss(cd.dur)} pagājis.`, 'warn', 15000); rebuild(); }
    if (t % 15000 < 260) saveSes();
    if (t - lastIdleCheck > 1000) { lastIdleCheck = t; idleCheck(t); }
    paint(false);
  }
  setInterval(tick, 250);   // 4× sekundē — hronometra simtdaļām pietiek, slodze niecīga
  document.addEventListener('visibilitychange', tick);

  /* --- Liels pulkstenis virs rīka (bez darbības N min vai ar LIGHT) --- */
  let lastAct = Date.now();
  ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, e => {
    lastAct = Date.now();
    const ov = document.getElementById('watchBig'); if (!ov) return;
    if (!ov.dataset.manual) { if (e.type !== 'pointermove' || Date.now() - Number(ov.dataset.shown || 0) > 600) hideBig(); }
    else if (e.type === 'keydown' && e.key === 'Escape') hideBig();
  }, { passive: true, capture: true }));
  function idleCheck(t) {
    if (!P.idle || document.getElementById('watchBig') || document.visibilityState !== 'visible') return;
    if (t - lastAct >= P.idleMin * 60000) showBig(false);
  }
  function showBig(manual) {
    if (document.getElementById('watchBig')) return;
    const ov = document.createElement('div'); ov.id = 'watchBig'; ov.className = 'watch-big'; ov.dataset.shown = String(Date.now()); if (manual) ov.dataset.manual = '1';
    ov.innerHTML = `<div class="wb-host">${caseSvg(faceInner(), 'wb' + (++uid))}</div><p class="wb-hint">${manual ? 'Klikšķis ārpus pulksteņa vai Esc — atpakaļ' : 'Pakustini peli vai nospied taustiņu, lai turpinātu'}</p>`;
    ov.addEventListener('click', e => { if (!e.target.closest('[data-act]')) hideBig(); });
    // ja iestatīts PIN, bloķēšana ieliek pulksteni savā logā (virs visiem citiem logiem)
    if (manual || !CP.lock?.adopt?.(ov)) document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('on')); paint(true);
  }
  function hideBig(force) { if (force !== true && CP.lock?.guard?.()) return; document.getElementById('watchBig')?.remove(); }
  CP.watchShowBig = showBig; CP.watchHideBig = hideBig;

  let customLast = '';
  CP.changeHandlers.push(e => {
    if (e.target.id !== 'wCustom') return false;
    const v = e.target.value; if (!v || !e.target.isConnected || v === customLast) return true;
    customLast = v; setTimeout(() => { A.watchSet(v); customLast = ''; }, 0);   // pēc notikuma — lai lauka aizvietošana netraucē fokusa notikumiem
    return true;
  });
  /** Pēc datu ielādes — iestatījumi no datu faila, ja šajā pārlūkā savu vēl nav */
  CP.watchReload = () => { if (!ls.get('cp-watch')) { P = prefs(); rebuild(); } };
})(window.CP);
