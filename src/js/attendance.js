/* =====================================================================
   Apmeklējums: nodarbību žurnāls (kā e-klasē), mēneša veidlapa, rādītāji,
   brīdinājumi par kavējumiem; personām — pārkāpumi, dalība un kvalifikācijas.

   Dati:
   S.db.sessions = [{ id, date, group ('*' = visa vienība), yearId, type, topic, notes, att: { pid: kods } }]
   settings.groupDays = { grupa: [1..7] }   (1 = pirmdiena)
   settings.absenceStreak = 3
   settings.quals = [{ id, name, note }]           p.quals = [{ qid, date, note, src }]
   settings.incidentTypes = [...]                   p.incidents = [{ id, date, type, severity, text, action, at }]
   Kodi: + bija, n nebija, k kavēja (ieradās vēlāk), a attaisnots, s slimības dēļ
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const ic = (n, f = '') => CP.ic(n, f);
  const CODES = [['+', 'Bija', 'ok'], ['n', 'Nebija', 'bad'], ['k', 'Kavēja (ieradās vēlāk)', 'warn'], ['a', 'Attaisnots', 'exc'], ['s', 'Slimības dēļ', 'exc']];
  const CYCLE = ['', '+', 'n', 'k', 'a', 's'];
  const PRESENT = new Set(['+', 'k']), ABSENT = new Set(['n']), EXCUSED = new Set(['a', 's']);
  const TYPES = ['Nodarbība', 'Pasākums', 'Nometne', 'Sacensības', 'Cits'];
  const WD = ['P', 'O', 'T', 'C', 'Pk', 'S', 'Sv'], WDL = ['pirmdiena', 'otrdiena', 'trešdiena', 'ceturtdiena', 'piektdiena', 'sestdiena', 'svētdiena'];
  const MON = ['janvāris', 'februāris', 'marts', 'aprīlis', 'maijs', 'jūnijs', 'jūlijs', 'augusts', 'septembris', 'oktobris', 'novembris', 'decembris'];
  const MON_LOC = ['Janvārī', 'Februārī', 'Martā', 'Aprīlī', 'Maijā', 'Jūnijā', 'Jūlijā', 'Augustā', 'Septembrī', 'Oktobrī', 'Novembrī', 'Decembrī'];
  const LEGEND = 'Apzīmējumi: + bija, n nebija, k kavēja (ieradās vēlāk), a attaisnots, s slimības dēļ';
  CP.ATT_CODES = CODES;

  const st = () => S.db.settings;
  const sessions = () => (S.db.sessions = S.db.sessions || []);
  const wdOf = iso => (new Date(iso + 'T12:00:00').getDay() + 6) % 7 + 1;
  const daysOf = g => g === '*' ? [...new Set(Object.values(st().groupDays || {}).flat())].sort() : ((st().groupDays || {})[g] || []);
  const monthDates = ym => { const [y, m] = ym.split('-').map(Number), n = new Date(y, m, 0).getDate(); return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`); };
  const shiftMonth = (ym, d) => { const [y, m] = ym.split('-').map(Number), x = new Date(y, m - 1 + d, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };
  const roster = (g, yearId = D.activeYear()) => D.peopleInYear(yearId).filter(p => p.status !== 'archived' && !['archived', 'paused'].includes(D.partStatus(p, yearId)) && (g === '*' || D.groupOf(p, yearId) === g))
    .sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
  const sessFor = (g, date) => sessions().find(s => s.group === g && s.date === date);
  /** Personai attiecināmās nodarbības: savas grupas un visas vienības, līdz šodienai */
  const personSessions = (p, yearId = D.activeYear()) => { const g = D.groupOf(p, yearId), today = U.iso(); return sessions().filter(s => (s.group === g || s.group === '*') && s.date <= today && (!yearId || s.yearId === yearId)).sort((a, b) => a.date.localeCompare(b.date)); };

  /* --- Rādītāji --- */
  function rateOf(pid, list) {
    let pr = 0, ab = 0, ex = 0;
    for (const s of list) { const c = s.att?.[pid] || ''; if (PRESENT.has(c)) pr++; else if (ABSENT.has(c)) ab++; else if (EXCUSED.has(c)) ex++; }
    return { present: pr, absent: ab, excused: ex, marked: pr + ab + ex, pct: pr + ab ? Math.round(pr / (pr + ab) * 100) : null };
  }
  const sessionPct = s => { let pr = 0, ab = 0; for (const c of Object.values(s.att || {})) { if (PRESENT.has(c)) pr++; else if (ABSENT.has(c)) ab++; } return pr + ab ? Math.round(pr / (pr + ab) * 100) : null; };
  /** Kavējumi pēc kārtas (attaisnotie un neatzīmētie neskaitās un nepārtrauc) */
  function streak(p) {
    const list = personSessions(p).reverse(); let n = 0, last = '';
    for (const s of list) { const c = s.att?.[p.id] || ''; if (ABSENT.has(c)) { n++; if (!last) last = s.date; } else if (PRESENT.has(c)) break; }
    return { n, last };
  }
  D.attRate = p => rateOf(p.id, personSessions(p));
  D.attStreak = streak;
  D.attAlerts = list => {
    const lim = Number(st().absenceStreak) || 3, out = [];
    for (const p of list) {
      if (p.status === 'archived' || D.partStatus(p) === 'paused') continue;
      const s = streak(p);
      if (s.n >= lim) out.push({ kind: 'attendance', personId: p.id, sev: s.n >= lim * 2 ? 2 : 1, when: s.last, msg: `${U.full(p)}: nav apmeklējis ${s.n} nodarbības pēc kārtas (pēdējā: ${U.fmtDate(s.last)})` });
    }
    return out;
  };
  /** Tendence: pēdējo 4 atzīmēto nodarbību % pret iepriekšējām 4 */
  function trend(p) {
    const list = personSessions(p).filter(s => { const c = s.att?.[p.id]; return PRESENT.has(c) || ABSENT.has(c); });
    const a = rateOf(p.id, list.slice(-4)).pct, b = rateOf(p.id, list.slice(-8, -4)).pct;
    return a == null || b == null ? 0 : a - b;
  }
  /** Personas sērija: slīdošais % pa nodarbībām (ar 4 nodarbību logu) */
  function personSeries(p) {
    const list = personSessions(p).filter(s => { const c = s.att?.[p.id]; return PRESENT.has(c) || ABSENT.has(c); });
    return list.map((s, i) => ({ x: s.date, y: rateOf(p.id, list.slice(Math.max(0, i - 3), i + 1)).pct }));
  }

  /* --- “Trading” stila līnijgrafiks (SVG): laukums ar gradientu, slīdošā vidējā, krustiņš un vērtība pie peles --- */
  let chartN = 0;
  function tchart(points, o = {}) {
    const W = o.w || 1000, H = o.h || 250, P = { l: 34, r: 10, t: 12, b: 22 }, id = 'tc' + (++chartN);
    const pts = points.filter(p => p.y != null);
    if (pts.length < 2) return `<div class="tchart-empty muted small">${esc(o.empty || 'Vēl nav pietiekami daudz datu grafikam (vajag vismaz 2 nodarbības ar atzīmēm).')}</div>`;
    const xs = i => P.l + (W - P.l - P.r) * (pts.length === 1 ? 0.5 : i / (pts.length - 1)), ys = v => P.t + (H - P.t - P.b) * (1 - v / 100);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.y).toFixed(1)}`).join('');
    const area = `${line}L${xs(pts.length - 1).toFixed(1)},${ys(0)}L${xs(0).toFixed(1)},${ys(0)}Z`;
    const k = o.ma || 4, ma = pts.map((p, i) => { const w = pts.slice(Math.max(0, i - k + 1), i + 1); return w.reduce((a, b) => a + b.y, 0) / w.length; });
    const maLine = ma.map((v, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join('');
    const last = pts.at(-1).y, first = pts[0].y, up = last >= (pts.at(-2)?.y ?? first);
    const grid = [0, 25, 50, 75, 100].map(v => `<line x1="${P.l}" x2="${W - P.r}" y1="${ys(v)}" y2="${ys(v)}" class="tc-grid"/><text x="${P.l - 6}" y="${ys(v) + 3}" class="tc-ax" text-anchor="end">${v}%</text>`).join('');
    const ticks = pts.map((p, i) => ({ i, p })).filter(({ i }) => pts.length <= 8 || i % Math.ceil(pts.length / 8) === 0 || i === pts.length - 1)
      .map(({ i, p }) => `<text x="${xs(i)}" y="${H - 6}" class="tc-ax" text-anchor="${i === pts.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'}">${esc(U.fmtDate(p.x).slice(0, 5))}</text>`).join('');
    const data = esc(JSON.stringify(pts.map((p, i) => [xs(i), ys(p.y), p.x, p.y, Math.round(ma[i]), p.label || ''])));
    return `<div class="tchart" data-tc="${data}"><div class="tc-head"><b class="tc-val ${up ? 'up' : 'down'}">${last}%</b> <span class="small ${up ? 'okc' : 'warn'}">${up ? '▲' : '▼'} ${Math.abs(last - (pts.at(-2)?.y ?? last))} p.p.</span><span class="small muted"> · vidēji ${Math.round(pts.reduce((a, b) => a + b.y, 0) / pts.length)}% · slīdošā vidējā ${k} nod.</span></div>
      <svg viewBox="0 0 ${W} ${H}" class="tc-svg" role="img" aria-label="${esc(o.title || 'Apmeklējuma grafiks')}">
        <defs><linearGradient id="${id}g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--teal);stop-opacity:.38"/><stop offset="1" style="stop-color:var(--teal);stop-opacity:0"/></linearGradient></defs>
        ${grid}<path d="${area}" fill="url(#${id}g)"/><path d="${line}" class="tc-line"/><path d="${maLine}" class="tc-ma"/>${ticks}
        <line class="tc-x" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" style="display:none"/><circle class="tc-dot" r="4" style="display:none"/>
      </svg><div class="tc-tip" style="display:none"></div></div>`;
  }
  document.addEventListener('mousemove', e => {
    const box = e.target.closest?.('.tchart'); document.querySelectorAll('.tchart.hover').forEach(b => { if (b !== box) { b.classList.remove('hover'); b.querySelector('.tc-x').style.display = b.querySelector('.tc-dot').style.display = b.querySelector('.tc-tip').style.display = 'none'; } });
    if (!box) return;
    const svg = box.querySelector('svg'), r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, x = (e.clientX - r.left) * vb.width / r.width;
    const pts = JSON.parse(box.dataset.tc); let best = pts[0]; for (const p of pts) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
    const xl = box.querySelector('.tc-x'), dot = box.querySelector('.tc-dot'), tip = box.querySelector('.tc-tip');
    xl.setAttribute('x1', best[0]); xl.setAttribute('x2', best[0]); dot.setAttribute('cx', best[0]); dot.setAttribute('cy', best[1]);
    xl.style.display = dot.style.display = tip.style.display = ''; box.classList.add('hover');
    tip.innerHTML = `<b>${esc(U.fmtDate(best[2]))}</b> · ${best[3]}%<br><span class="muted">vidējā: ${best[4]}%</span>${best[5] ? `<br>${esc(best[5])}` : ''}`;
    const px = best[0] * r.width / vb.width; tip.style.left = Math.min(r.width - 150, Math.max(0, px - 70)) + 'px';
  });
  const spark = (vals, w = 90, h = 22) => {
    const v = vals.filter(x => x != null); if (v.length < 2) return '<span class="muted small">—</span>';
    const d = v.map((y, i) => `${i ? 'L' : 'M'}${(i / (v.length - 1) * w).toFixed(1)},${(h - 2 - y / 100 * (h - 4)).toFixed(1)}`).join('');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><path d="${d}"/></svg>`;
  };
  const dots = (p, n = 10) => personSessions(p).slice(-n).map(s => { const c = s.att?.[p.id] || ''; return `<span class="adot c${c === '+' ? 'p' : c || 'x'}" title="${esc(U.fmtDate(s.date) + ' · ' + (CODES.find(x => x[0] === c)?.[1] || 'nav atzīmēts') + (s.topic ? ' · ' + s.topic : ''))}">${c === '+' ? '' : esc(c)}</span>`; }).join('');
  const pctTag = v => v == null ? '<span class="muted">—</span>' : `<b class="${v >= 75 ? 'okc' : v >= 50 ? 'warn' : 'red'}">${v}%</b>`;

  /* ================== Lapa ================== */
  const view = () => S.att || (S.att = { tab: 'grid', group: '', month: U.iso().slice(0, 7), all: false, statG: '*', qual: '', dir: (() => { try { return localStorage.getItem('cp.attDir') || 'down'; } catch (e) { return 'down'; } })() });
  CP.pages.attendance = {
    render() {
      const v = view(), groups = D.groups();
      if (!v.group || (v.group !== '*' && !groups.includes(v.group))) v.group = groups[0] || '*';
      const tab = (k, l, i) => `<button role="tab" data-act="attTab" data-arg="${k}" class="${v.tab === k ? 'active' : ''}">${ic(i)}${l}</button>`;
      const body = v.tab === 'journal' ? journal(v) : v.tab === 'stats' ? stats(v) : v.tab === 'quals' ? quals(v) : grid(v);
      return `<div class="page">${ui.pageHead('Apmeklējums', 'Nodarbību žurnāls, mēneša veidlapa, rādītāji un kvalifikācijas', `<button class="mainbtn" data-act="sessNew">${ic('plus', '＋')} Nodarbība</button>`)}
        <nav class="tabs" role="tablist">${tab('grid', 'Mēneša tabula', 'calendar')}${tab('journal', 'Žurnāls', 'list')}${tab('stats', 'Rādītāji', 'chart')}${tab('quals', 'Kvalifikācijas un dalība', 'award')}</nav>${body}</div>`;
    }
  };
  A.attTab = k => { view().tab = k; CP.render(); };
  const groupSel = (v, id = 'attGroup', withAll = true) => `<select id="${id}">${withAll ? `<option value="*" ${v === '*' ? 'selected' : ''}>Visa vienība</option>` : ''}${D.groups().map(g => `<option ${g === v ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>`;
  function gridDates(v) {
    const all = monthDates(v.month), days = daysOf(v.group);
    const sess = sessions().filter(s => s.group === v.group && s.date.startsWith(v.month)).map(s => s.date);
    return v.all || !days.length ? all : [...new Set([...all.filter(d => days.includes(wdOf(d))), ...sess])].sort();
  }

  /* --- Mēneša tabula --- */
  function grid(v) {
    const dates = gridDates(v), ppl = roster(v.group), days = daysOf(v.group), [y, m] = v.month.split('-').map(Number);
    const daysPick = v.group === '*' ? `<span class="small muted">Visas vienības dienas = grupu dienu apvienojums.</span>` : `<span class="small muted">Nodarbību dienas:</span> ${WD.map((w, i) => `<label class="wd ${days.includes(i + 1) ? 'on' : ''}" title="${WDL[i]}"><input type="checkbox" data-gday="${i + 1}" ${days.includes(i + 1) ? 'checked' : ''}>${w}</label>`).join('')}`;
    const head = dates.map(d => { const s = sessFor(v.group, d), wd = wdOf(d), today = d === U.iso(); return `<th class="ad-h ${s ? 'has' : ''} ${today ? 'today' : ''} ${days.includes(wd) ? 'jd' : ''}"><button class="ad-hb" data-act="sessOpen" data-arg="${esc(v.group)}|${d}" title="${esc((s?.topic ? s.topic + ' · ' : '') + WDL[wd - 1] + ' — klikšķis: tēma, piezīmes, “visi bija”')}">${d.slice(8)}.<small>${WD[wd - 1]}</small>${s?.topic ? '<i>●</i>' : ''}</button></th>`; }).join('');
    const rows = ppl.map((p, i) => {
      const mSess = sessions().filter(s => (s.group === v.group || (v.group !== '*' && s.group === '*')) && s.date.startsWith(v.month));
      const r = rateOf(p.id, mSess), sk = streak(p), lim = Number(st().absenceStreak) || 3;
      return `<tr><td class="ad-n">${i + 1}.</td><td class="ad-name"><a href="#" data-person="${p.id}">${esc(U.sortName(p))}</a>${sk.n >= lim ? ` <span class="warn" title="${sk.n} kavējumi pēc kārtas">⚠${sk.n}</span>` : ''}</td>
        ${dates.map(d => { const s = sessFor(v.group, d), c = s?.att?.[p.id] || ''; return `<td class="ad-c"><button class="acell c${c === '+' ? 'p' : c || 'x'}" data-act="attCell" data-arg="${p.id}|${d}" title="${esc(U.full(p) + ' · ' + U.fmtDate(d) + ' — klikšķis vai + n k a s')}">${esc(c)}</button></td>`; }).join('')}
        <td class="ad-pct">${pctTag(r.pct)}</td></tr>`;
    }).join('');
    const foot = dates.map(d => { const s = sessFor(v.group, d), n = s ? Object.values(s.att || {}).filter(c => PRESENT.has(c)).length : ''; return `<td class="ad-c small">${n === '' ? '' : n}</td>`; }).join('');
    return `<section class="card"><div class="att-bar">
        ${groupSel(v.group)}
        <span class="att-month"><button class="sm ghost" data-act="attMonth" data-arg="-1" title="Iepriekšējais mēnesis">◀</button><input type="month" id="attMonth" value="${esc(v.month)}"><button class="sm ghost" data-act="attMonth" data-arg="1" title="Nākamais mēnesis">▶</button></span>
        <span class="seg"><button class="sm ${!v.all ? 'on' : ''}" data-act="attAll" data-arg="0">Jaunsardzes dienas</button><button class="sm ${v.all ? 'on' : ''}" data-act="attAll" data-arg="1">Visas mēneša dienas</button></span>
        <span class="grow"></span>
        <button class="sm" data-act="attPdf" data-arg="blank">${ic('file', '📄')} Tukša veidlapa</button><button class="sm" data-act="attPdf" data-arg="filled">${ic('file', '📄')} Ar atzīmēm</button></div>
      <div class="att-days">${daysPick}${!days.length && v.group !== '*' && !v.all ? ' <span class="warn small">— atzīmē grupas nodarbību dienas, vai izvēlies “Visas mēneša dienas”.</span>' : ''}</div>
      <p class="small muted" style="margin:6px 0">${esc(MON[m - 1])} ${y}. <b>Ar peli:</b> klikšķis maina atzīmi: <b>+</b> bija → <b>n</b> nebija → <b>k</b> kavēja → <b>a</b> attaisnots → <b>s</b> slimības dēļ → tukšs. Klikšķis uz datuma — tēma, piezīmes, “visi bija”.</p>
      <div class="att-keys" id="attKeyHint"><span class="small"><b>Ar tastatūru:</b> uzklikšķini uz rūtiņas un raksti <kbd>+</kbd> (vai <kbd>B</kbd>) <kbd>N</kbd> <kbd>K</kbd> <kbd>A</kbd> <kbd>S</kbd> — atzīme tiek ierakstīta un fokuss pāriet tālāk. <kbd>Del</kbd> notīra, <kbd>Atstarpe</kbd> = klikšķis, bultiņas pārvietojas, <kbd>Esc</kbd> beidz.</span>
        <span class="seg"><span class="small muted" style="padding:0 6px">Pēc atzīmes:</span><button class="sm ${(v.dir || 'down') === 'down' ? 'on' : ''}" data-act="attDir" data-arg="down" title="Nākamā persona tajā pašā datumā (atzīmē vienu nodarbību)">↓ nākamā persona</button><button class="sm ${v.dir === 'right' ? 'on' : ''}" data-act="attDir" data-arg="right" title="Nākamais datums tai pašai personai">→ nākamais datums</button></span></div>
      ${ppl.length ? `<div class="att-wrap"><table class="att-grid"><thead><tr><th class="ad-n">N.p.k.</th><th class="ad-name">Vārds, uzvārds</th>${head}<th class="ad-pct">Mēn.</th></tr></thead><tbody>${rows}</tbody>
        <tfoot><tr><td></td><td class="small muted">Klātesošie</td>${foot}<td></td></tr></tfoot></table></div>` : ui.empty('Šajā grupā nav personu.')}
      <p class="small muted">${esc(LEGEND)}. Procentos neskaita attaisnotos (a, s).</p></section>`;
  }
  A.attMonth = d => { const v = view(); v.month = shiftMonth(v.month, Number(d)); CP.render(); };
  A.attAll = x => { view().all = x === '1'; CP.render(); };
  CP.changeHandlers.push(e => {
    const t = e.target, v = view();
    if (t.id === 'attGroup') { v.group = t.value; CP.render(); return true; }
    if (t.id === 'attStatG') { v.statG = t.value; CP.render(); return true; }
    if (t.id === 'attMonth') { if (t.value) v.month = t.value; CP.render(); return true; }
    if (t.dataset?.gday) { const set = new Set(daysOf(v.group)), d = Number(t.dataset.gday); t.checked ? set.add(d) : set.delete(d); st().groupDays = { ...(st().groupDays || {}), [v.group]: [...set].sort() }; CP.store.changed(); return true; }
    if (t.id === 'attLimit') { st().absenceStreak = Math.max(1, Math.min(20, Number(t.value) || 3)); CP.store.changed(); return true; }
    if (t.id === 'attQual') { v.qual = t.value; CP.render(); return true; }
    return false;
  });
  function ensureSess(g, date) {
    let s = sessFor(g, date);
    if (!s) { s = { id: U.uid(), date, group: g, yearId: U.yearOfDate(date) || D.activeYear(), type: 'Nodarbība', topic: '', notes: '', att: {}, createdAt: U.now() }; sessions().push(s); }
    return s;
  }
  /** Atzīmes ierakstīšana vienā rūtiņā (pele vai tastatūra) */
  function setCode(arg, code) {
    const [pid, date] = String(arg).split('|'), v = view(), s = ensureSess(v.group, date);
    if (code) s.att[pid] = code; else delete s.att[pid];
    s.updatedAt = U.now();
    const btn = document.querySelector(`[data-act="attCell"][data-arg="${CSS.escape(arg)}"]`);
    if (btn) { btn.textContent = code; btn.className = 'acell c' + (code === '+' ? 'p' : code || 'x'); }
    CP.store.changed({ silent: true });
    // tabulas kopsavilkumi (%, klātesošie) tiek pārzīmēti, kad atzīmēšana apstājas; fokuss un ritinājums paliek
    clearTimeout(A._attT); A._attT = setTimeout(() => {
      if (S.page !== 'attendance' || view().tab !== 'grid') return;
      const w = document.querySelector('.att-wrap'), sl = w?.scrollLeft, st0 = window.scrollY, f = document.activeElement?.closest?.('.acell')?.dataset.arg;
      CP.render(); const w2 = document.querySelector('.att-wrap'); if (w2) w2.scrollLeft = sl; window.scrollTo(0, st0);
      if (f) document.querySelector(`.acell[data-arg="${CSS.escape(f)}"]`)?.focus({ preventScroll: true });
    }, 1500);
  }
  A.attCell = (arg, el) => {
    const [pid, date] = String(arg).split('|'), c = sessFor(view().group, date)?.att?.[pid] || '';
    setCode(arg, CYCLE[(CYCLE.indexOf(c) + 1) % CYCLE.length]);
    el?.focus?.({ preventScroll: true });
  };
  A.attDir = d => { view().dir = d; try { localStorage.setItem('cp.attDir', d); } catch (e) { } document.querySelectorAll('[data-act="attDir"]').forEach(b => b.classList.toggle('on', b.dataset.arg === d)); document.querySelector('.att-grid')?.querySelector('.acell:focus')?.focus(); };
  /** Tastatūra: + n k a s ieraksta atzīmi un pāriet uz nākamo rūtiņu; bultiņas pārvietojas; Delete notīra; atstarpe = kā klikšķis */
  const KEYMAP = { '+': '+', '=': '+', 'b': '+', '1': '+', 'p': '+', 'n': 'n', 'k': 'k', 'a': 'a', 's': 's', 'delete': '', 'backspace': '', '0': '', '-': '' };
  function moveFrom(btn, dr, dc) {
    const td = btn.closest('td'), tr = td.parentElement, ci = [...tr.children].indexOf(td), rows = [...tr.parentElement.children];
    let ri = rows.indexOf(tr) + dr, cj = ci + dc;
    const cells = r => [...r.querySelectorAll('.acell')], first = [...tr.children].findIndex(x => x.querySelector('.acell'));
    const nCols = cells(tr).length;
    if (cj < first) { cj = first + nCols - 1; ri--; } else if (cj >= first + nCols) { cj = first; ri++; }
    const row = rows[ri]; const nx = row?.children[cj]?.querySelector('.acell');
    if (nx) { nx.focus(); nx.scrollIntoView({ block: 'nearest', inline: 'nearest' }); return true; }
    return false;
  }
  document.addEventListener('keydown', e => {
    const btn = e.target.closest?.('.acell'); if (!btn || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase(), dir = view().dir || 'down';
    const nav = { arrowdown: [1, 0], arrowup: [-1, 0], arrowright: [0, 1], arrowleft: [0, -1], enter: dir === 'right' ? [0, 1] : [1, 0], tab: e.shiftKey ? [0, -1] : [0, 1] }[k];
    if (nav) { if (moveFrom(btn, ...nav) || k !== 'tab') e.preventDefault(); return; }
    if (k === 'home' || k === 'end') { e.preventDefault(); const c = [...btn.closest('tr').querySelectorAll('.acell')]; (k === 'home' ? c[0] : c.at(-1))?.focus(); return; }
    if (k === 'escape') { btn.blur(); return; }
    if (k in KEYMAP) {
      e.preventDefault(); setCode(btn.dataset.arg, KEYMAP[k]);
      if (k !== 'delete' && k !== 'backspace') moveFrom(btn, ...(dir === 'right' ? [0, 1] : [1, 0]));
    }
  });
  /** Fokusētās rūtiņas rinda un kolonna tiek izgaismotas */
  document.addEventListener('focusin', e => {
    document.querySelectorAll('.att-grid .hl').forEach(x => x.classList.remove('hl'));
    const btn = e.target.closest?.('.acell'); if (!btn) return;
    const td = btn.closest('td'), tr = td.parentElement, ci = [...tr.children].indexOf(td), tb = tr.closest('table');
    tr.classList.add('hl'); tb.querySelector('thead tr')?.children[ci]?.classList.add('hl');
    const hint = document.getElementById('attKeyHint'); if (hint) hint.classList.add('on');
  });

  /* --- Nodarbības logs --- */
  let edit = null;
  A.sessOpen = arg => { const [g, date] = String(arg).split('|'); edit = { g, date }; sessDialog(); };
  A.sessNew = () => { const v = view(); edit = { g: v.group || '*', date: U.iso(), isNew: true }; sessDialog(); };
  function sessDialog() {
    let d = U.$('sessDialog'); if (!d) { d = document.createElement('dialog'); d.id = 'sessDialog'; d.className = 'wide'; document.body.appendChild(d); }
    const s = sessFor(edit.g, edit.date) || {}, topics = [...new Set(sessions().map(x => x.topic).filter(Boolean))].slice(-60);
    const ppl = roster(edit.g), cnt = c => ppl.filter(p => (s.att || {})[p.id] === c).length;
    d.innerHTML = `<form id="sessForm"><header class="dlg-head"><h2>${s.id ? 'Nodarbība' : 'Jauna nodarbība'}</h2><button type="button" class="ghost" data-close="sessDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><div class="fieldgrid">
        <div class="field"><label>Datums</label><input type="date" name="date" value="${esc(edit.date)}" required ${s.id ? '' : ''}></div>
        <div class="field"><label>Grupa</label>${groupSel(edit.g, 'sessGroup').replace('<select id="sessGroup">', '<select id="sessGroup" name="group">')}</div>
        <div class="field"><label>Veids</label><select name="type">${TYPES.map(t => `<option ${t === (s.type || 'Nodarbība') ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field wide"><label>Tēma</label><input name="topic" value="${esc(s.topic || '')}" list="dl_topics" placeholder="piem., Orientēšanās ar karti"><datalist id="dl_topics">${topics.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
        <div class="field wide"><label>Piezīmes</label><textarea name="notes" rows="2" data-autogrow>${esc(s.notes || '')}</textarea></div>
      </div>
      ${s.id ? `<p class="small">Atzīmes: <b>${cnt('+') + cnt('k')}</b> klātesoši · <b>${cnt('n')}</b> nebija · <b>${cnt('a') + cnt('s')}</b> attaisnoti · ${ppl.length - Object.keys(s.att || {}).filter(k => ppl.some(p => p.id === k)).length} neatzīmēti</p>` : ''}
      <div class="actions"><button type="button" class="sm" data-act="sessFill" data-arg="all">Visi bija (+)</button><button type="button" class="sm" data-act="sessFill" data-arg="rest">Neatzīmētie — nebija (n)</button><button type="button" class="sm ghost" data-act="sessFill" data-arg="clear">Notīrīt atzīmes</button></div></div>
      <footer class="dlg-foot">${s.id ? `<button type="button" class="ghost danger" data-act="sessDel">Dzēst nodarbību</button>` : ''}<span class="grow"></span><button type="button" data-close="sessDialog">Atcelt</button><button class="mainbtn" type="submit">Saglabāt</button></footer></form>`;
    d.querySelector('form').onsubmit = e => {
      e.preventDefault(); const f = e.target, o = Object.fromEntries(new FormData(f));
      let s2 = sessFor(edit.g, edit.date);
      if (s2 && (o.date !== edit.date || o.group !== edit.g)) { if (sessFor(o.group, o.date)) return ui.toast('Šai grupai šajā datumā nodarbība jau ir', 'warn'); s2.date = o.date; s2.group = o.group; s2.yearId = U.yearOfDate(o.date) || s2.yearId; }
      if (!s2) s2 = ensureSess(o.group, o.date);
      Object.assign(s2, { type: o.type, topic: o.topic.trim(), notes: o.notes.trim(), updatedAt: U.now() });
      d.close(); const v = view(); if (edit.isNew) { v.group = o.group; v.month = o.date.slice(0, 7); }
      CP.store.changed(); ui.toast('Nodarbība saglabāta', 'ok', 2500);
    };
    if (!d.open) d.showModal();
  }
  A.sessFill = how => {
    const s = ensureSess(edit.g, edit.date), ppl = roster(edit.g);
    if (how === 'all') for (const p of ppl) s.att[p.id] = '+';
    if (how === 'rest') for (const p of ppl) if (!s.att[p.id]) s.att[p.id] = 'n';
    if (how === 'clear') s.att = {};
    CP.store.changed(); sessDialog();
  };
  A.sessDel = () => {
    const s = sessFor(edit.g, edit.date); if (!s || !confirm(`Dzēst nodarbību ${U.fmtDate(s.date)}${s.topic ? ' “' + s.topic + '”' : ''} un visas tās atzīmes?`)) return;
    S.db.sessions = sessions().filter(x => x !== s); U.$('sessDialog').close(); CP.store.changed();
  };

  /* --- PDF veidlapa --- */
  A.attPdf = async how => {
    const v = view(), dates = gridDates(v), ppl = roster(v.group), [y, m] = v.month.split('-').map(Number);
    if (!dates.length) return ui.toast('Nav datumu: atzīmē nodarbību dienas vai izvēlies “Visas mēneša dienas”.', 'warn', 7000);
    const marks = how === 'filled' ? Object.fromEntries(ppl.map(p => [p.id, Object.fromEntries(dates.map(d => [d, sessFor(v.group, d)?.att?.[p.id] || '']))])) : null;
    try {
      ui.toast('Sagatavo veidlapu…', 'ok', 2000);
      const bytes = await CP.pdf.attendance({ title: 'Nodarbību apmeklējums', group: v.group === '*' ? 'visa vienība' : v.group, year: `${y}. gads`, monthTitle: MON_LOC[m - 1], dates, people: ppl, marks, legend: LEGEND, instructor: st().instructor?.name ? `${st().instructor.position || 'Instruktors'} ${st().instructor.name}` : '' });
      await CP.printPdf(new Blob([bytes], { type: 'application/pdf' }), `Apmeklējums ${v.group === '*' ? 'vienība' : v.group} ${v.month}.pdf`);
    } catch (e) { console.error(e); ui.toast('Veidlapu neizdevās sagatavot: ' + e.message, 'err', 9000); }
  };

  /* --- Žurnāls (saraksts kā e-klasē) --- */
  function journal(v) {
    const list = sessions().filter(s => (v.group === '*' || s.group === v.group || s.group === '*') && s.date.startsWith(v.month)).sort((a, b) => b.date.localeCompare(a.date));
    return `<section class="card"><div class="att-bar">${groupSel(v.group)}<span class="att-month"><button class="sm ghost" data-act="attMonth" data-arg="-1">◀</button><input type="month" id="attMonth" value="${esc(v.month)}"><button class="sm ghost" data-act="attMonth" data-arg="1">▶</button></span><span class="grow"></span><button class="sm mainbtn" data-act="sessNew">${ic('plus', '＋')} Jauna nodarbība</button></div>
      ${list.length ? `<table class="table"><thead><tr><th>Datums</th><th>Grupa</th><th>Veids</th><th>Tēma</th><th>Klātesoši</th><th>%</th><th></th></tr></thead><tbody>${list.map(s => {
        const ppl = roster(s.group), pr = ppl.filter(p => PRESENT.has(s.att?.[p.id])).length;
        return `<tr><td class="nowrap">${esc(U.fmtDate(s.date))} <small class="muted">${WD[wdOf(s.date) - 1]}</small></td><td>${esc(s.group === '*' ? 'Visa vienība' : s.group)}</td><td><span class="tag">${esc(s.type || 'Nodarbība')}</span></td><td>${esc(s.topic || '—')}${s.notes ? `<div class="small muted">${esc(s.notes)}</div>` : ''}</td><td>${pr} / ${ppl.length}</td><td>${pctTag(sessionPct(s))}</td>
          <td><button class="sm" data-act="sessOpen" data-arg="${esc(s.group)}|${s.date}">✎ Atvērt</button></td></tr>`;
      }).join('')}</tbody></table>` : ui.empty('Šajā mēnesī vēl nav nodarbību. Atzīmē apmeklējumu mēneša tabulā vai spied “Jauna nodarbība”.')}</section>`;
  }

  /* --- Rādītāji --- */
  function stats(v) {
    const g = v.statG || '*', today = U.iso(), yearId = D.activeYear();
    const ss = sessions().filter(s => s.yearId === yearId && s.date <= today && (g === '*' || s.group === g || s.group === '*')).sort((a, b) => a.date.localeCompare(b.date));
    const ppl = roster(g), pts = ss.map(s => ({ x: s.date, y: sessionPct(s), label: [s.group === '*' ? 'Visa vienība' : s.group, s.topic].filter(Boolean).join(' · ') }));
    const yearR = (() => { let pr = 0, ab = 0; for (const s of ss) for (const [pid, c] of Object.entries(s.att || {})) { if (g !== '*' && !ppl.some(p => p.id === pid)) continue; if (PRESENT.has(c)) pr++; else if (ABSENT.has(c)) ab++; } return pr + ab ? Math.round(pr / (pr + ab) * 100) : null; })();
    const month = ss.filter(s => s.date.startsWith(today.slice(0, 7))), mR = month.length ? Math.round(month.map(sessionPct).filter(x => x != null).reduce((a, b) => a + b, 0) / Math.max(1, month.map(sessionPct).filter(x => x != null).length)) : null;
    const lim = Number(st().absenceStreak) || 3, warn = ppl.filter(p => streak(p).n >= lim);
    const groupsCmp = D.groups().map(gr => { const gs = sessions().filter(s => s.yearId === yearId && s.date <= today && s.group === gr); const vals = gs.map(sessionPct).filter(x => x != null); return { gr, n: gs.length, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null }; });
    const rows = ppl.map(p => ({ p, r: D.attRate(p), t: trend(p), s: personSeries(p) })).sort((a, b) => (a.r.pct ?? 101) - (b.r.pct ?? 101));
    return `<section class="card"><div class="att-bar"><select id="attStatG"><option value="*" ${g === '*' ? 'selected' : ''}>Visa vienība</option>${D.groups().map(x => `<option ${x === g ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <span class="grow"></span><label class="small">Brīdināt pēc <input type="number" id="attLimit" min="1" max="20" value="${lim}" style="width:64px"> kavējumiem pēc kārtas</label></div>
      <div class="kpis"><div class="kpi"><small>Mācību gadā</small>${pctTag(yearR)}</div><div class="kpi"><small>Šajā mēnesī</small>${pctTag(mR)}</div><div class="kpi"><small>Nodarbības</small><b>${ss.length}</b></div><div class="kpi ${warn.length ? 'bad' : ''}"><small>Ilgstoši neapmeklē</small><b>${warn.length}</b></div></div>
      <h4 style="margin:14px 0 4px">Apmeklējuma dinamika ${g === '*' ? '— visa vienība' : '— ' + esc(g)}</h4>${tchart(pts, { title: 'Apmeklējuma dinamika' })}</section>
      ${D.groups().length > 1 ? `<section class="card"><h3>${ic('users')}Grupu salīdzinājums</h3>${groupsCmp.map(x => `<div class="gbar"><span class="gname">${esc(x.gr)}</span><span class="gtrack"><span style="width:${x.avg ?? 0}%"></span></span>${pctTag(x.avg)}<small class="muted">${x.n} nod.</small></div>`).join('')}</section>` : ''}
      <section class="card"><h3>${ic('user')}Personu apmeklējums un tendence</h3>${rows.length ? `<table class="table"><thead><tr><th>Persona</th><th>Grupa</th><th>Gadā</th><th>Pēdējās nodarbības</th><th>Tendence</th><th>Dinamika</th></tr></thead><tbody>${rows.map(({ p, r, t, s }) => {
        const sk = streak(p);
        return `<tr><td><a href="#" data-person="${p.id}">${esc(U.sortName(p))}</a>${sk.n >= lim ? ` <span class="warn">⚠ ${sk.n} pēc kārtas</span>` : ''}</td><td>${esc(D.groupOf(p))}</td><td>${pctTag(r.pct)} <small class="muted">${r.present}/${r.present + r.absent}</small></td><td class="nowrap">${dots(p, 8)}</td>
          <td>${t > 0 ? `<span class="okc">▲ ${t}</span>` : t < 0 ? `<span class="red">▼ ${-t}</span>` : '<span class="muted">—</span>'}</td><td>${spark(s.map(x => x.y))}</td></tr>`;
      }).join('')}</tbody></table>` : ui.empty('Nav personu.')}</section>`;
  }

  /* --- Kvalifikācijas un dalība --- */
  const qualList = () => (st().quals = st().quals || []);
  function quals(v) {
    const Q = qualList(), q = Q.find(x => x.id === v.qual) || Q[0]; if (q) v.qual = q.id;
    const ppl = D.peopleInYear().filter(p => p.status !== 'archived').sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
    const has = q ? ppl.filter(p => (p.quals || []).some(x => x.qid === q.id)) : [], not = q ? ppl.filter(p => !has.includes(p)) : [];
    const camps = (S.db.events || []).filter(e => e.type === 'camp');
    return `<div class="cards2"><section class="card"><h3>${ic('award')}Kvalifikācijas</h3>
        <p class="small muted" style="margin-top:0">Pats nosaki, kas ir kvalifikācija, piem., “Pamatnometne”, “1. līmenis”, “Ziemas nometne”. Tad redzams, kam tā ir un kam vēl nav, piem., piesakot uz retām nometnēm.</p>
        ${Q.map(x => `<div class="row ${q && x.id === q.id ? 'sel' : ''}"><div class="grow"><a href="#" data-act="qualPick" data-arg="${x.id}"><b>${esc(x.name)}</b></a>${x.note ? `<div class="small muted">${esc(x.note)}</div>` : ''}</div><span class="pill">${ppl.filter(p => (p.quals || []).some(y => y.qid === x.id)).length}</span><button class="sm ghost danger" data-act="qualDel" data-arg="${x.id}" title="Dzēst kvalifikāciju">✕</button></div>`).join('') || '<p class="muted small">Vēl nav nevienas kvalifikācijas.</p>'}
        <form class="inline-form" id="qualForm" style="margin-top:10px"><input name="name" placeholder="Jauna kvalifikācija, piem., Pamatnometne" required><input name="note" placeholder="Piezīme (nav obligāti)"><button class="sm mainbtn">＋ Pievienot</button></form></section>
      ${q ? `<section class="card"><h3>${esc(q.name)}</h3>
        ${camps.length ? `<div class="inline-form"><select id="qualCamp"><option value="">Piešķirt nometnes dalībniekiem…</option>${camps.map(e => `<option value="${e.id}">${esc(e.title || 'Nometne')} · ${esc(U.fmtDate(e.dateFrom || e.instrDate))}</option>`).join('')}</select><button class="sm" data-act="qualFromCamp" data-arg="${q.id}">Piešķirt</button></div>` : ''}
        <h4>Ir (${has.length})</h4>${has.map(p => { const x = p.quals.find(y => y.qid === q.id); return `<div class="row"><div class="grow"><a href="#" data-person="${p.id}">${esc(U.sortName(p))}</a> <small class="muted">${esc(D.groupOf(p))} · ${esc(U.fmtDate(x.date))}${x.src ? ' · ' + esc(x.src) : ''}</small></div><button class="sm ghost danger" data-act="qualRemove" data-arg="${p.id}|${q.id}" title="Noņemt">✕</button></div>`; }).join('') || '<p class="muted small">Nevienam.</p>'}
        <h4>Vēl nav (${not.length})</h4><div class="inline-form"><input type="date" id="qualDate" value="${U.iso()}"><button class="sm mainbtn" data-act="qualGive" data-arg="${q.id}">Piešķirt atzīmētajiem</button></div>
        <div class="qual-not">${not.map(p => `<label class="check"><input type="checkbox" data-qualp="${p.id}"> ${esc(U.sortName(p))} <small class="muted">${esc(D.groupOf(p))} · apmeklējums ${D.attRate(p).pct ?? '—'}${D.attRate(p).pct != null ? '%' : ''}</small></label>`).join('') || '<p class="muted small">Visiem ir.</p>'}</div></section>` : ''}</div>`;
  }
  document.addEventListener('submit', e => {
    if (e.target.id !== 'qualForm') return; e.preventDefault();
    const o = Object.fromEntries(new FormData(e.target)); if (!o.name.trim()) return;
    qualList().push({ id: U.uid(), name: o.name.trim(), note: o.note.trim() }); view().qual = qualList().at(-1).id; CP.store.changed();
  });
  A.qualPick = id => { view().qual = id; CP.render(); };
  A.qualDel = id => { const q = qualList().find(x => x.id === id); if (!q || !confirm(`Dzēst kvalifikāciju “${q.name}”? Tā tiks noņemta arī visām personām.`)) return; st().quals = qualList().filter(x => x.id !== id); for (const p of S.db.people) if (p.quals) p.quals = p.quals.filter(x => x.qid !== id); CP.store.changed(); };
  const giveQual = (p, qid, date, src) => { p.quals = p.quals || []; if (p.quals.some(x => x.qid === qid)) return false; p.quals.push({ qid, date, src: src || '' }); D.audit(p.id, 'update', ['Kvalifikācija: ' + (qualList().find(x => x.id === qid)?.name || '')]); return true; };
  A.qualGive = qid => { const date = U.$('qualDate')?.value || U.iso(); let n = 0; document.querySelectorAll('[data-qualp]:checked').forEach(c => { const p = D.person(c.dataset.qualp); if (p && giveQual(p, qid, date)) n++; }); if (!n) return ui.toast('Atzīmē personas sarakstā “Vēl nav”', 'warn'); CP.store.changed(); ui.toast(`Kvalifikācija piešķirta ${n} personām`, 'ok'); };
  A.qualFromCamp = qid => { const ev = (S.db.events || []).find(e => e.id === U.$('qualCamp')?.value); if (!ev) return ui.toast('Izvēlies nometni', 'warn'); let n = 0; for (const x of ev.participants || []) { const p = D.person(x.pid); if (p && giveQual(p, qid, ev.dateTo || ev.dateFrom || ev.instrDate || U.iso(), ev.title || 'nometne')) n++; } CP.store.changed(); ui.toast(`Piešķirta ${n} nometnes dalībniekiem`, 'ok'); };
  A.qualRemove = arg => { const [pid, qid] = String(arg).split('|'), p = D.person(pid); if (!p || !confirm('Noņemt kvalifikāciju šai personai?')) return; p.quals = (p.quals || []).filter(x => x.qid !== qid); D.audit(p.id, 'update', ['Noņemta kvalifikācija']); CP.store.changed(); };

  /* ================== Personas kartītē ================== */
  /** Sānjosla: apmeklējums */
  function attCard(p) {
    const r = D.attRate(p), sk = streak(p), lim = Number(st().absenceStreak) || 3, ser = personSeries(p);
    if (!personSessions(p).length) return '';
    return `<section class="card"><h3>${ic('calendar')}Apmeklējums</h3>
      <div class="att-mini"><div>${pctTag(r.pct)} <small class="muted">mācību gadā · ${r.present} no ${r.present + r.absent}${r.excused ? ` · ${r.excused} attaisnoti` : ''}</small></div>${spark(ser.map(x => x.y), 110, 26)}</div>
      <div style="margin:6px 0">${dots(p, 12)}</div>
      ${sk.n >= lim ? `<p class="small warn" style="margin:0">⚠ Nav apmeklējis ${sk.n} nodarbības pēc kārtas</p>` : ''}
      <div class="actions" style="margin-top:6px"><button class="sm ghost" data-page="attendance">Apmeklējuma žurnāls →</button></div></section>`;
  }
  /** Galvenā kolonna: dalība, kvalifikācijas, pārkāpumi */
  const SEV = { note: ['Piezīme', ''], warn: ['Brīdinājums', 'warn'], serious: ['Nopietns', 'red'] };
  function historyCards(p) {
    const Q = qualList(), myQ = (p.quals || []).map(x => ({ ...x, q: Q.find(q => q.id === x.qid) })).filter(x => x.q);
    const evs = (S.db.events || []).filter(e => (e.participants || []).some(x => x.pid === p.id)).map(e => ({ date: e.dateFrom || e.instrDate, t: e.type === 'camp' ? 'Nometne' : 'Pasākums (instruktāža)', title: e.title }));
    const ses = sessions().filter(s => s.type && s.type !== 'Nodarbība' && PRESENT.has(s.att?.[p.id])).map(s => ({ date: s.date, t: s.type, title: s.topic }));
    const part = [...evs, ...ses].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const inc = [...(p.incidents || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const nodN = personSessions(p).filter(s => PRESENT.has(s.att?.[p.id])).length;
    return `<section class="card wide"><h3>${ic('award')}Dalība un kvalifikācijas</h3>
        <div class="chips">${myQ.map(x => `<span class="chip ok" title="${esc(U.fmtDate(x.date) + (x.src ? ' · ' + x.src : ''))}">🏅 ${esc(x.q.name)} <small>${esc(U.fmtDate(x.date))}</small></span>`).join('') || '<span class="muted small">Kvalifikāciju vēl nav.</span>'}
          ${Q.filter(q => !myQ.some(x => x.qid === q.id)).length ? `<select class="sm" data-qualadd="${p.id}"><option value="">＋ Piešķirt…</option>${Q.filter(q => !myQ.some(x => x.qid === q.id)).map(q => `<option value="${q.id}">${esc(q.name)}</option>`).join('')}</select>` : ''}</div>
        <p class="small muted" style="margin:8px 0 4px">Apmeklētas nodarbības šajā mācību gadā: <b>${nodN}</b>. Dalība pasākumos un nometnēs:</p>
        ${part.slice(0, 12).map(x => `<div class="row small"><span class="muted nowrap">${esc(U.fmtDate(x.date))}</span><span class="tag">${esc(x.t)}</span><span class="grow">${esc(x.title || '')}</span></div>`).join('') || '<p class="muted small">Vēl nav reģistrēta dalība pasākumos vai nometnēs.</p>'}</section>
      <section class="card wide"><h3>${ic('alert', '⚠')}Uzvedība un pārkāpumi <button class="sm right" data-act="incEdit" data-arg="${p.id}|">＋ Ieraksts</button></h3>
        ${inc.map(x => `<div class="inc sev-${esc(x.severity || 'note')}"><div class="grow"><b>${esc(U.fmtDate(x.date))}</b> <span class="tag ${SEV[x.severity]?.[1] || ''}">${esc(SEV[x.severity]?.[0] || 'Piezīme')}</span> <span class="tag">${esc(x.type || '')}</span>
          <div>${esc(x.text || '')}</div>${x.action ? `<div class="small muted">Veiktie pasākumi: ${esc(x.action)}</div>` : ''}</div><button class="sm ghost" data-act="incEdit" data-arg="${p.id}|${x.id}" title="Labot">✎</button><button class="sm ghost danger" data-act="incDel" data-arg="${p.id}|${x.id}" title="Dzēst">✕</button></div>`).join('') || '<p class="muted small">Nav ierakstu. Šeit vari pierakstīt pārkāpumus un svarīgus gadījumus, lai vēlāk atcerētos, kas ar personu bijis.</p>'}</section>`;
  }
  CP.changeHandlers.push(e => {
    const pid = e.target.dataset?.qualadd; if (!pid || !e.target.value) return false;
    const p = D.person(pid); if (p && giveQual(p, e.target.value, U.iso())) { CP.store.changed(); ui.toast('Kvalifikācija piešķirta', 'ok'); } return true;
  });
  A.incEdit = arg => {
    const [pid, id] = String(arg).split('|'), p = D.person(pid); if (!p) return;
    const x = (p.incidents || []).find(i => i.id === id) || {}, types = st().incidentTypes || ['Disciplīna', 'Forma un izskats', 'Drošība', 'Kavējumi', 'Uzvedība pret citiem', 'Cits'];
    let d = U.$('incDialog'); if (!d) { d = document.createElement('dialog'); d.id = 'incDialog'; document.body.appendChild(d); }
    d.innerHTML = `<form><header class="dlg-head"><h2>${x.id ? 'Labot ierakstu' : 'Jauns ieraksts'} — ${esc(U.full(p))}</h2><button type="button" class="ghost" data-close="incDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><div class="fieldgrid">
        <div class="field"><label>Datums</label><input type="date" name="date" value="${esc(x.date || U.iso())}" required></div>
        <div class="field"><label>Smagums</label><select name="severity">${Object.entries(SEV).map(([k, [l]]) => `<option value="${k}" ${(x.severity || 'note') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field wide"><label>Veids</label><input name="type" list="dl_inc" value="${esc(x.type || '')}" placeholder="piem., Disciplīna"><datalist id="dl_inc">${types.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
        <div class="field wide"><label>Kas notika</label><textarea name="text" rows="3" data-autogrow required>${esc(x.text || '')}</textarea></div>
        <div class="field wide"><label>Veiktie pasākumi (nav obligāti)</label><textarea name="action" rows="2" data-autogrow placeholder="piem., pārrunas, informēti vecāki">${esc(x.action || '')}</textarea></div>
      </div><p class="small muted">Ieraksti redzami tikai rīkā, personas kartītē.</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="incDialog">Atcelt</button><button class="mainbtn" type="submit">Saglabāt</button></footer></form>`;
    d.querySelector('form').onsubmit = e => {
      e.preventDefault(); const o = Object.fromEntries(new FormData(e.target)); for (const k in o) o[k] = String(o[k]).trim();
      p.incidents = p.incidents || [];
      if (x.id) Object.assign(p.incidents.find(i => i.id === x.id), o, { editedAt: U.now() }); else p.incidents.push({ id: U.uid(), ...o, at: U.now() });
      D.audit(p.id, 'update', [x.id ? 'Labots uzvedības ieraksts' : 'Jauns uzvedības ieraksts']); d.close(); CP.store.changed();
    };
    d.showModal();
  };
  A.incDel = arg => { const [pid, id] = String(arg).split('|'), p = D.person(pid); if (!p || !confirm('Dzēst šo ierakstu?')) return; p.incidents = (p.incidents || []).filter(i => i.id !== id); D.audit(p.id, 'update', ['Dzēsts uzvedības ieraksts']); CP.store.changed(); };

  CP.attendance = { attCard, historyCards, tchart, streak, rateOf };
})(window.CP);
