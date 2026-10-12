/* =====================================================================
   Pārskata pulkstenis (taktiskā pulksteņa stilā) + darba laika taimeris.
   - Laiks tiek skaitīts, kamēr rīks ir atvērts. Ja rīks bijis paslēpts/aizvērts ilgāk par 5 min — tā ir pauze, sākas jauns posms.
   - Pēc 40 min nepārtraukta darba — paziņojums ar ieteikumu paņemt pauzi; “Sākt pauzi” skaita 5 min.
   Stāvoklis glabājas pārlūkā (localStorage), ne datu failā.
   ===================================================================== */
(function (CP) {
  'use strict';
  const S = CP.state, U = CP.util, A = CP.actions;
  const WORK_MIN = 40, BREAK_MIN = 5, GAP_MIN = 5, SNOOZE_MIN = 10;
  const KEY = 'cp-session';
  const DAYS = ['Svētdiena', 'Pirmdiena', 'Otrdiena', 'Trešdiena', 'Ceturtdiena', 'Piektdiena', 'Sestdiena'];
  const MONTHS = ['janv.', 'febr.', 'marts', 'apr.', 'maijs', 'jūn.', 'jūl.', 'aug.', 'sept.', 'okt.', 'nov.', 'dec.'];
  const pad = n => String(n).padStart(2, '0');
  const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const save = st => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* tikai ērtībai */ } };
  let st = load(); const now0 = Date.now();
  if (!st || now0 - (st.last || 0) > GAP_MIN * 60000) st = { start: now0, last: now0, remindAt: now0 + WORK_MIN * 60000, breakEnd: 0 };
  save(st);

  /** Darba sesija: sākums no jauna (pēc pauzes) */
  function restart(t = Date.now()) { st = { start: t, last: t, remindAt: t + WORK_MIN * 60000, breakEnd: 0 }; save(st); }

  A.breakStart = () => { st.breakEnd = Date.now() + BREAK_MIN * 60000; save(st); paint(); CP.ui.toast(`Pauze ${BREAK_MIN} minūtes. Pastaigā, izstaipies, padzer ūdeni.`, 'ok', 8000); };
  A.breakEnd = () => { restart(); paint(); };

  function tick() {
    const t = Date.now();
    if (document.visibilityState === 'visible') {
      if (t - st.last > GAP_MIN * 60000) restart(t);          // atgriezies pēc garākas prombūtnes — tā bija pauze
      st.last = t;
    }
    if (st.breakEnd && t >= st.breakEnd) { restart(t); CP.ui.toast('Pauze beigusies. Labu darbu turpinot!', 'ok', 8000); }
    if (!st.breakEnd && t >= st.remindAt && document.visibilityState === 'visible') {
      st.remindAt = t + SNOOZE_MIN * 60000;
      const min = Math.round((t - st.start) / 60000);
      CP.ui.toast(`Labs darbs! Tu strādā jau ${min} min. Laiks paņemt īsu pauzi — acīm un mugurai tas noder.`, 'ok', 60000, { act: 'breakStart', label: `Sākt pauzi (${BREAK_MIN} min)` });
    }
    if (t % 15000 < 1000) save(st);
    paint();
  }

  /* --- Pulksteņa ciparnīca (SVG) --- */
  const C = 150, R_CASE = 142, R_BEZEL = 128, R_FACE = 104;
  function ticks() {
    let s = '';
    for (let i = 0; i < 60; i++) {
      const a = i * 6 * Math.PI / 180, major = i % 5 === 0, r1 = R_BEZEL - (major ? 13 : 7), r2 = R_BEZEL - 2;
      s += `<line x1="${(C + r1 * Math.sin(a)).toFixed(1)}" y1="${(C - r1 * Math.cos(a)).toFixed(1)}" x2="${(C + r2 * Math.sin(a)).toFixed(1)}" y2="${(C - r2 * Math.cos(a)).toFixed(1)}" class="${major ? 'tk-major' : 'tk'}"/>`;
    }
    return s;
  }
  // taustiņi korpusa malā (grādos no 12): LIGHT, UP, DOWN kreisajā pusē; START, BACK labajā
  const BTN = [[-60, 'LIGHT'], [-110, 'UP · MENU'], [-145, 'DOWN'], [60, 'START · STOP'], [120, 'BACK · LAP']];
  const pt = (deg, r) => { const a = deg * Math.PI / 180; return [C + r * Math.sin(a), C - r * Math.cos(a)]; };
  function buttons() {
    return BTN.map(([d]) => { const [x, y] = pt(d, R_CASE + 4); return `<rect class="w-btn" x="${(x - 9).toFixed(1)}" y="${(y - 5).toFixed(1)}" width="18" height="10" rx="3" transform="rotate(${d + 90} ${x.toFixed(1)} ${y.toFixed(1)})"/>`; }).join('');
  }
  function bezelText() {
    return BTN.map(([d, t], i) => {
      const r = R_CASE - 7, span = 28, left = d < 0;
      const [x1, y1] = pt(d - span / 2, r), [x2, y2] = pt(d + span / 2, r);
      // apakšējā pusē teksts iet pretējā virzienā, lai būtu lasāms
      const bottom = Math.abs(d) > 90;
      const path = bottom ? `M${x2.toFixed(1)} ${y2.toFixed(1)} A${r} ${r} 0 0 0 ${x1.toFixed(1)} ${y1.toFixed(1)}` : `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      return `<path id="wbt${i}" d="${path}" fill="none"/><text class="w-engr${left ? '' : ''}"><textPath href="#wbt${i}" startOffset="50%" text-anchor="middle">${t}</textPath></text>`;
    }).join('');
  }
  // loki: kreisais (darbs) 205°→335°, labais (sekundes) 25°→155° — kā datu loki taktiskā pulkstenī
  const arcPath = (from, to, r) => { const [x1, y1] = pt(from, r), [x2, y2] = pt(to, r); return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };

  CP.watch = {
    html() {
      const rA = R_FACE - 9;
      return `<section class="card watch-card" aria-label="Pulkstenis un darba laiks">
        <svg class="watch" viewBox="0 0 300 300" role="img" aria-labelledby="wAria">
          <title id="wAria">Pulkstenis</title>
          <defs>
            <linearGradient id="wSteel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="st-a"/><stop offset=".5" class="st-b"/><stop offset="1" class="st-c"/></linearGradient>
            <radialGradient id="wFace" cx=".5" cy=".42" r=".65"><stop offset="0" class="fc-a"/><stop offset="1" class="fc-b"/></radialGradient>
          </defs>
          ${buttons()}
          <circle cx="${C}" cy="${C}" r="${R_CASE}" class="w-case" fill="url(#wSteel)"/>
          <circle cx="${C}" cy="${C}" r="${R_BEZEL + 1}" class="w-bezel"/>
          ${bezelText()}
          <g class="w-ticks">${ticks()}</g>
          <circle cx="${C}" cy="${C}" r="${R_FACE}" class="w-face" fill="url(#wFace)"/>
          <path d="${arcPath(205, 335, rA)}" class="w-track" pathLength="100"/>
          <path id="wArcWork" d="${arcPath(205, 335, rA)}" class="w-arc" pathLength="100" stroke-dasharray="0 100"/>
          <path d="${arcPath(25, 155, rA)}" class="w-track" pathLength="100"/>
          <path id="wArcSec" d="${arcPath(25, 155, rA)}" class="w-arc w-arc2" pathLength="100" stroke-dasharray="0 100"/>
          <text x="${C}" y="98" class="w-date" id="wDate"></text>
          <text x="${C - 10}" y="160" class="w-time" id="wTime">--:--</text>
          <text x="${C + 63}" y="160" class="w-sec" id="wSec">--</text>
          <line x1="${C - 58}" y1="176" x2="${C + 58}" y2="176" class="w-rule"/>
          <text x="${C}" y="198" class="w-lbl" id="wWorkLbl">Darbā</text>
          <text x="${C}" y="222" class="w-work" id="wWork">00:00</text>
        </svg>
        <div class="watch-foot" id="wNote"></div>
      </section>`;
    }
  };

  function paint() {
    const el = document.getElementById('wTime'); if (!el) return;
    const d = new Date(), t = d.getTime();
    el.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    document.getElementById('wSec').textContent = pad(d.getSeconds());
    document.getElementById('wDate').textContent = `${DAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
    document.getElementById('wArcSec').setAttribute('stroke-dasharray', `${(d.getSeconds() / 59 * 100).toFixed(1)} 100`);
    const work = document.getElementById('wWork'), lbl = document.getElementById('wWorkLbl'), arc = document.getElementById('wArcWork'), note = document.getElementById('wNote');
    const card = el.closest('.watch-card');
    if (st.breakEnd) {
      const left = st.breakEnd - t;
      lbl.textContent = 'Pauze'; work.textContent = mmss(left);
      arc.setAttribute('stroke-dasharray', `${(100 - left / (BREAK_MIN * 600)).toFixed(1)} 100`);
      card.dataset.state = 'break';
      note.innerHTML = `<span>Pauze līdz ${new Date(st.breakEnd).toLocaleTimeString('lv-LV', { hour: '2-digit', minute: '2-digit' })}</span><button class="sm ghost" data-act="breakEnd">Turpināt darbu</button>`;
      return;
    }
    const ms = t - st.start, pct = Math.min(100, ms / (WORK_MIN * 600));
    lbl.textContent = 'Darbā'; work.textContent = ms >= 3600000 ? `${Math.floor(ms / 3600000)}:${mmss(ms % 3600000)}` : mmss(ms);
    arc.setAttribute('stroke-dasharray', `${pct.toFixed(1)} 100`);
    const over = ms >= WORK_MIN * 60000;
    card.dataset.state = over ? 'over' : '';
    const key = over ? 'over' : 'work' + Math.floor(Math.max(0, WORK_MIN * 60000 - ms) / 60000);
    if (note.dataset.k !== key) {
      note.dataset.k = key;
      note.innerHTML = over ? `<span>Laiks pauzei</span><button class="sm" data-act="breakStart">Sākt pauzi</button>` : `<span>Pauze pēc ${Math.max(1, Math.ceil((WORK_MIN * 60000 - ms) / 60000))} min</span>`;
    }
  }
  CP.watch.paint = paint;

  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', tick);
})(window.CP);
