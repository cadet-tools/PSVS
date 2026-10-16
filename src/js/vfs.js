/* =====================================================================
   VFS — jaunsargu vispārējās fiziskās sagatavotības testi (JC 1.pielikums “Vispārīgās fiziskās sagatavotības sistēma”, no 01.09.2024).
   • Pakāpes: I 10–12, II 13–14, III 15–16, IV 17–21 gadi (vecums testa dienā; var mainīt rokām).
   • 6 vingrinājumi: pievilkšanās (zēni) / kāriens saliektās rokās (meitenes), atspiešanās, ķermeņa augšdaļas pacelšana,
     bumbiņas (IV — granātas) mešana, 60 m, garā distance (I 1000 m, II 1500 m, III–IV meitenes 2000 m, zēni 3000 m).
   • Punkti pēc 2. tabulas: zem 2 punktu robežas — 1 punkts, virs 10 — 10 punkti. Kopā līdz 60.
   • Sporta nozīmīte: visi 6 vingrinājumi, neviens < 4 punktiem; bronza 41–47, sudrabs 48–53, zelts ≥ 54.
     Iegūtā nozīmīte automātiski ierakstās kvalifikācijās (src “vfs:<testa id>”).
   Dati: S.db.vfsTests = [{ id, date, yearId, title, res: { pid: { g, lvl, v: { str, push, sit, thr, spr, run }, issued } } }]
         settings.vfs = { unit, instructor, region, sheet }
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const ic = (n, f = '') => CP.ic(n, f);
  // 2. tabula: robežas 10, 9, … 2 punktiem. Laiki — sekundēs.
  const NORMS = {"I":{"m":{"push":[39,36,32,29,25,18,13,11,9],"str":[9,8,7,6,5,4,3,2,1],"sit":[35,29,26,23,20,17,14,11,8],"thr":[42,38,34,30,27,25,22,19,16],"spr":[9.2,9.6,10,10.3,10.6,10.9,11.2,11.7,12.2],"run":[235,240,260,270,280,290,300,315,330]},"f":{"push":[16,15,14,13,12,11,8,6,4],"str":[15,13,11.5,9.25,7.25,5.25,3.75,1.8,1],"sit":[35,29,26,23,20,17,14,11,8],"thr":[26,23,20,19,17,15,14,12,10],"spr":[9.6,10,10.4,10.6,10.8,11.1,11.4,11.9,12.4],"run":[250,265,275,280,290,305,325,340,350]}},"II":{"m":{"push":[42,39,35,32,28,21,16,14,12],"str":[12,10,9,8,7,6,5,4,3],"sit":[45,41,36,32,28,24,21,18,15],"thr":[45,43,40,35,33,30,25,23,20],"spr":[8.4,9,9.4,9.7,10.2,10.5,10.9,11.4,11.9],"run":[330,360,390,405,420,435,450,480,525]},"f":{"push":[18,17,16,15,14,13,10,8,6],"str":[16.15,14.3,12.6,10.8,8.3,6.25,4.25,2.1,1.35],"sit":[40,36,31,27,23,19,16,13,10],"thr":[27,26,21,20,18,16,15,13,11],"spr":[9.15,9.45,9.75,10.05,10.35,10.65,10.95,11.25,11.55],"run":[460,485,501,519,551,583,606,626,649]}},"III":{"m":{"push":[46,43,39,36,32,25,20,18,16],"str":[16,14,12,11,9,8,7,6,5],"sit":[60,56,52,49,45,40,32,25,20],"thr":[50,47,44,41,38,35,32,29,25],"spr":[8.2,8.8,9.2,9.5,10,10.3,10.7,11.2,11.7],"run":[840,885,930,960,990,1020,1050,1080,1125]},"f":{"push":[20,19,18,17,16,15,12,10,8],"str":[18.15,16.45,14.6,12.6,9.75,7,4.8,2.2,1.5],"sit":[50,45,40,35,30,25,20,15,null],"thr":[32,30,25,24,22,20,19,18,15],"spr":[9,9.35,9.6,9.9,10.2,10.45,10.75,11.1,11.4],"run":[615,660,690,720,750,780,810,855,900]}},"IV":{"m":{"push":[49,46,42,39,35,28,23,21,19],"str":[18,16,14,13,11,10,9,8,7],"sit":[65,61,57,54,50,45,37,30,25],"thr":[53,50,47,43,40,35,30,26,22],"spr":[8,8.6,9,9.3,9.8,10.1,10.6,11.1,11.6],"run":[780,825,870,900,960,990,1020,1050,1080]},"f":{"push":[22,21,20,19,17,16,14,12,10],"str":[19,16.9,15,12.9,10,7.2,5,2.5,1.8],"sit":[55,50,45,40,35,30,25,20,15],"thr":[29,26,23,22,20,18,16,15,12],"spr":[9,9.35,9.6,9.9,10.2,10.45,10.75,11.1,11.4],"run":[615,660,690,720,750,780,810,855,900]}}};
  const LVLS = ['I', 'II', 'III', 'IV'];
  const LVL_AGE = { I: '10 – 12 gadi', II: '13 – 14 gadi', III: '15 – 16 gadi', IV: '17 – 21 gads' };
  const LVL_HEAD = { I: 'ZĒNI un MEITENES', II: 'ZĒNI un MEITENES', III: 'JAUNIEŠI un JAUNIETES', IV: 'JAUNIEŠI un JAUNIETES' };
  const EX = ['str', 'push', 'sit', 'thr', 'spr', 'run'];
  const LOW = new Set(['spr', 'run']);   // mazāks — labāk
  const runDist = (lvl, g) => lvl === 'I' ? '1000 m' : lvl === 'II' ? '1500 m' : g === 'f' ? '2000 m' : '3000 m';
  const exName = (k, lvl, g, short) => ({
    str: g === 'f' ? (short ? 'Kāriens' : 'Kāriens saliektās rokās (sek.)') : (short ? 'Pievilkšanās' : 'Pievilkšanās kārienā (reizes)'),
    push: short ? 'Atspiešanās' : 'Roku saliekšana un iztaisnošana balstā guļus (reizes)',
    sit: short ? 'Ķerm. pacelš.' : 'Ķermeņa augšdaļas pacelšana (reizes)',
    thr: lvl === 'IV' ? (short ? 'Granāta' : 'Granātas mešana (metri)') : (short ? 'Bumbiņa' : 'Bumbiņas mešana (metri)'),
    spr: short ? '60 m' : 'Īsā distance 60 m (sek.)',
    run: short ? (lvl ? runDist(lvl, g) : 'Garā dist.') : `Garā distance ${lvl ? runDist(lvl, g) : '1000–3000 m'} (min:s)`
  })[k];
  const UNIT_PH = { str: 'reizes / s', push: 'reizes', sit: 'reizes', thr: 'm', spr: 's', run: 'min:s' };
  const BADGES = [['z', 'Zelts', 54], ['s', 'Sudrabs', 48], ['b', 'Bronza', 41]];
  const QUAL = { b: { id: 'vfs-b', name: 'VFS sporta nozīmīte — bronza' }, s: { id: 'vfs-s', name: 'VFS sporta nozīmīte — sudrabs' }, z: { id: 'vfs-z', name: 'VFS sporta nozīmīte — zelts' } };

  /* ---------- Vērtības: ievade ↔ skaitlis ---------- */
  /** “9,3”, “9:30” (kāriens, 60 m — kols kā komats), “5:49” (garā distance), “14m” */
  function parse(k, g, s) {
    s = String(s ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(/(m|s|sek\.?|min\.?|reizes)$/, '');
    if (!s || s === '-' || s === '—') return null;
    if (k === 'run') {
      const m = s.match(/^(\d{1,2})[:.,'](\d{1,2})(?:[.,](\d))?$/); if (m) return +m[1] * 60 + +m[2] + (m[3] ? +m[3] / 10 : 0);
      const n = Number(s.replace(',', '.')); return isFinite(n) ? (n < 40 ? Math.round(n * 60) : n) : NaN;   // “5” = 5 min
    }
    if ((k === 'spr' || (k === 'str' && g === 'f'))) { const m = s.match(/^(\d{1,2}):(\d{1,2})$/); if (m) return +m[1] + +m[2] / (m[2].length === 1 ? 10 : 100); }
    const n = Number(s.replace(',', '.')); return isFinite(n) && n >= 0 ? n : NaN;
  }
  const fmtNum = (n, d) => n == null ? '' : (Math.round(n * 10 ** d) / 10 ** d).toFixed(d).replace(/\.?0+$/, '').replace('.', ',');
  function show(k, g, v) {
    if (v == null || v === '') return '';
    if (k === 'run') { const m = Math.floor(v / 60), s = v - m * 60; return `${m}:${String(Math.floor(s)).padStart(2, '0')}${s % 1 ? ',' + Math.round((s % 1) * 10) : ''}`; }
    if (k === 'spr' || (k === 'str' && g === 'f')) return fmtNum(v, 2);
    if (k === 'thr') return fmtNum(v, 2);
    return String(Math.round(v));
  }
  /** Punkti vienam vingrinājumam: null — nav izpildīts */
  /** mode 'strict' — norma jāsasniedz; 'generous' — starp robežām piešķir augstāko punktu (rezultāts labāks par zemākās pakāpes robežu) */
  function points(k, lvl, g, v, mode = curMode()) {
    if (v == null || !lvl || !g || !NORMS[lvl]) return null;
    const th = NORMS[lvl][g][k], better = (a, t) => LOW.has(k) ? a <= t + 1e-9 : a >= t - 1e-9, strictlyBetter = (a, t) => LOW.has(k) ? a < t - 1e-9 : a > t + 1e-9;
    for (let i = 0; i < th.length; i++) {
      const t = th[i]; if (t == null) continue;
      if (better(v, t)) return 10 - i;
      if (mode === 'generous') { let j = i + 1; while (j < th.length && th[j] == null) j++; if (j < th.length && strictlyBetter(v, th[j])) return 10 - i; }
    }
    return 1;
  }
  const curMode = () => S.db?.settings?.vfs?.mode === 'generous' ? 'generous' : 'strict';
  function score(r) {
    const pts = {}; let total = 0, done = 0, min = 10;
    for (const k of EX) { const p = points(k, r.lvl, r.g, r.v?.[k]); pts[k] = p; if (p != null) { total += p; done++; min = Math.min(min, p); } }
    const full = done === EX.length;
    const badge = full && min >= 4 ? (BADGES.find(b => total >= b[2]) || null) : null;
    const why = !r.g ? 'nav norādīts dzimums' : !r.lvl ? 'nav pakāpes' : !full ? `izpildīti ${done} no 6 vingrinājumiem` : min < 4 ? 'kādā vingrinājumā mazāk par 4 punktiem' : total < 41 ? 'mazāk par 41 punktu' : '';
    return { pts, total: done ? total : null, done, full, min: done ? min : null, badge: badge ? badge[0] : '', badgeName: badge ? badge[1] : '', why };
  }
  const ageAt = (birth, date) => { if (!birth) return null; const b = new Date(birth + 'T12:00:00'), d = new Date(date + 'T12:00:00'); let a = d.getFullYear() - b.getFullYear(); if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--; return a; };
  const lvlOfAge = a => a == null ? '' : a <= 12 ? (a >= 10 ? 'I' : '') : a <= 14 ? 'II' : a <= 16 ? 'III' : a <= 21 ? 'IV' : '';
  /** Dzimuma ieteikums pēc vārda galotnes (latviešu vārdi) */
  const guessG = first => { const w = U.norm(String(first || '').trim().split(/[\s-]+/)[0] || ''); if (!w) return ''; if (/[sš]$/.test(w) || /^(ivo|oto|arto|niko|teo|leo|hugo|marko|aleksandrs)$/.test(w)) return 'm'; if (/[ae]$/.test(w)) return 'f'; return ''; };

  /* ---------- Dati ---------- */
  const st = () => S.db.settings;
  const cfg = () => (st().vfs = st().vfs || { unit: '', instructor: st().formDefaults?.instrName || '', region: '', sheet: 0 });
  const tests = () => (S.db.vfsTests = S.db.vfsTests || []);
  const testOf = id => tests().find(t => t.id === id);
  const sortedTests = () => [...tests()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  function rowOf(t, pid) { const r = t.res[pid]; if (!r) return null; const p = D.person(pid); if (!r.g && p?.gender) r.g = p.gender; return r; }
  /** Personai: dzimums no kartītes, citādi ieteikums */
  const genderOf = p => p?.gender || '';
  function addPeople(t, ids) {
    let n = 0;
    for (const id of ids) {
      if (t.res[id]) continue; const p = D.person(id); if (!p) continue;
      t.res[id] = { g: genderOf(p), lvl: lvlOfAge(ageAt(p.birth, t.date)), v: {} }; n++;
    }
    return n;
  }
  /** Kvalifikācijas pēc nozīmītes (katram testam atsevišķi) */
  function syncQuals(t) {
    const Q = st().quals = st().quals || [];
    for (const q of Object.values(QUAL)) if (!Q.some(x => x.id === q.id)) Q.push({ id: q.id, name: q.name, note: 'Piešķir automātiski VFS testi' });
    const src = 'vfs:' + t.id;
    for (const [pid, r] of Object.entries(t.res)) {
      const p = D.person(pid); if (!p) continue;
      const s = score(r), cur = (p.quals || []).find(x => x.src === src), want = s.badge ? QUAL[s.badge].id : '';
      if (cur && cur.qid === want && cur.note === `${s.total} punkti`) continue;
      p.quals = (p.quals || []).filter(x => x.src !== src);
      if (want) p.quals.push({ qid: want, date: t.date, src, note: `${s.total} punkti` });
    }
  }
  // dzēšot testu — kvalifikācijas arī prom
  const dropQuals = t => { for (const p of S.db.people) if (p.quals?.some(x => x.src === 'vfs:' + t.id)) p.quals = p.quals.filter(x => x.src !== 'vfs:' + t.id); };

  /* ---------- Saskarne ---------- */
  const V = () => S.vfs || (S.vfs = { test: '', view: 'res', person: '', group: '' });
  const badgeTag = (code, name) => code ? `<span class="vfs-badge b-${code}">${esc(name)}</span>` : '<span class="muted">—</span>';
  const ptsTag = p => p == null ? '' : `<span class="vfs-p p${p >= 8 ? 'hi' : p >= 4 ? 'mid' : 'lo'}">${p}</span>`;
  function page() {
    const v = V(), list = sortedTests();
    if (v.test && !testOf(v.test)) v.test = '';
    if (!v.test && list[0]) v.test = list[0].id;
    const t = testOf(v.test);
    const vtab = (k, l) => `<button class="chipbtn ${v.view === k ? 'on' : ''}" data-act="vfsView" data-arg="${k}">${l}</button>`;
    return `<div class="vfs">
      <section class="card vfs-top"><div class="vfs-bar">
        <div class="chips">${list.map(x => `<button class="chipbtn ${x.id === v.test ? 'on' : ''}" data-act="vfsPick" data-arg="${x.id}">${esc(U.fmtDate(x.date))}${x.title ? ' · ' + esc(x.title) : ''} <small class="muted">${Object.keys(x.res).length}</small></button>`).join('') || '<span class="muted small">Vēl nav neviena testa.</span>'}</div>
        <span class="grow"></span>
        <button class="mainbtn sm" data-act="vfsNew">${ic('plus', '＋')} Jauns VFS tests</button><button class="sm" data-act="vfsImport">⇪ Importēt protokolu (Word)</button><button class="sm ghost" data-act="vfsSettings" title="Vienība, instruktors, novada pārvalde">⚙</button></div>
        <div class="chips" style="margin-top:8px">${vtab('res', 'Rezultāti')}${vtab('dyn', 'Dinamika')}${vtab('norms', 'Normatīvi')}</div></section>
      ${v.view === 'dyn' ? dyn(v) : v.view === 'norms' ? normsView() : t ? editor(t, v) : `<section class="card"><p class="muted">Izveido pirmo testu (“＋ Jauns VFS tests”) vai ievelc agrāko gadu protokolus (“⇪ Importēt protokolu”).</p>
        <p class="small muted">Tests notiek reizi mācību gadā. Rīks pats aprēķina punktus pēc JC normatīviem, pakāpi pēc vecuma un sporta nozīmīti, kā arī sagatavo protokolu un nozīmīšu uzskaites tabulu.</p></section>`}</div>`;
  }
  function editor(t, v) {
    const ids = Object.keys(t.res).filter(id => D.person(id));
    const byLvl = LVLS.map(l => [l, ids.filter(id => t.res[id].lvl === l)]).concat([['', ids.filter(id => !t.res[id].lvl)]]).filter(x => x[1].length);
    const sc = ids.map(id => score(t.res[id])), cnt = c => sc.filter(s => s.badge === c).length;
    const sug = ids.filter(id => !t.res[id].g && guessG(D.person(id)?.first)).length;
    return `<section class="card"><div class="vfs-head"><div><h3 style="margin:0">${ic('award')}VFS tests ${esc(U.fmtDate(t.date))}${t.title ? ' · ' + esc(t.title) : ''}</h3>
        <div class="small muted">${ids.length} dalībnieki · ${badgeTag('z', 'Zelts')} ${cnt('z')} · ${badgeTag('s', 'Sudrabs')} ${cnt('s')} · ${badgeTag('b', 'Bronza')} ${cnt('b')}</div></div>
        <span class="grow"></span><div class="actions">
          <button class="sm" data-act="vfsAddPeople">＋ Jaunsargi</button>
          <button class="sm mainbtn" data-act="vfsProtocol">⎙ Protokols (PDF)</button>
          <button class="sm" data-act="vfsBadgeXlsx" title="2. pielikums — sporta nozīmīšu uzskaites tabula">⇩ Nozīmīšu uzskaite (Excel)</button>
          <button class="sm ghost" data-act="vfsEditTest">✎</button><button class="sm ghost danger" data-act="vfsDel">Dzēst</button></div></div>
      ${sug ? `<p class="vfs-note small">${sug} jaunsargiem kartītē nav norādīts dzimums. Rīks to ieteica pēc vārda (iezīmēts ar ?). <button class="sm" data-act="vfsGenderOk">✓ Apstiprināt ieteikumus un ierakstīt kartītēs</button></p>` : ''}
      <p class="small muted" style="margin:6px 0 10px">Ievadi rezultātu, punkti tiek aprēķināti uzreiz. Laiki: <b>60 m</b> — 9,8 · <b>garā distance</b> — 5:49 · <b>kāriens</b> — 12,5 s. “-” vai tukšs — nav izpildīts. Enter — uz leju.</p>
      <div class="vfs-wrap"><table class="vfs-grid"><thead><tr><th class="nm">Jaunsargs</th><th title="Dzimums">Dz.</th><th title="Pakāpe">Pak.</th>${EX.map(k => `<th class="ex">${esc(exName(k, '', k === 'str' ? '' : 'm', true).replace('Pievilkšanās', 'Pievilkš. / kāriens'))}</th>`).join('')}<th>P kopā</th><th>Nozīmīte</th><th title="Nozīmīte izsniegta">Izsniegta</th><th></th></tr></thead>
        ${byLvl.map(([l, list]) => `<tbody><tr class="vfs-lvl"><td colspan="${EX.length + 7}">${l ? `${l} pakāpe · ${LVL_AGE[l]}` : 'Pakāpe nav noteikta — izvēlies rokām (nav dzimšanas datuma vai vecums ārpus 10–21)'}</td></tr>
          ${list.sort((a, b) => U.cmp(U.sortName(D.person(a)), U.sortName(D.person(b)))).map(id => rowHtml(t, id)).join('')}</tbody>`).join('') || `<tbody><tr><td colspan="${EX.length + 7}" class="muted">Pievieno jaunsargus (“＋ Jaunsargi”).</td></tr></tbody>`}
      </table></div></section>`;
  }
  function rowHtml(t, id) {
    const p = D.person(id), r = rowOf(t, id), s = score(r), sugg = !r.g ? guessG(p.first) : '';
    const g = r.g || sugg;
    return `<tr data-vrow="${id}">
      <td class="nm"><a href="#" data-person="${id}">${esc(U.sortName(p))}</a><div class="small muted">${esc(D.groupOf(p) || '')}${p.birth ? ` · ${ageAt(p.birth, t.date)} g.` : ''}</div></td>
      <td><select data-vfsg="${id}" class="${!r.g && sugg ? 'sugg' : ''}" title="${!r.g && sugg ? 'Ieteikums pēc vārda — apstiprini' : ''}"><option value="" ${!g ? 'selected' : ''}>?</option><option value="m" ${g === 'm' ? 'selected' : ''}>Z${!r.g && sugg === 'm' ? '?' : ''}</option><option value="f" ${g === 'f' ? 'selected' : ''}>M${!r.g && sugg === 'f' ? '?' : ''}</option></select></td>
      <td><select data-vfsl="${id}"><option value="">—</option>${LVLS.map(l => `<option ${r.lvl === l ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
      ${EX.map(k => `<td class="ex"><div class="vfs-cell"><input data-vfs="${id}|${k}" value="${esc(show(k, r.g, r.v?.[k]))}" placeholder="${k === 'str' ? (r.g === 'f' ? 's' : r.g === 'm' ? 'reizes' : '') : UNIT_PH[k]}" title="${esc(exName(k, r.lvl, r.g))}" inputmode="decimal" autocomplete="off">${ptsTag(s.pts[k])}</div></td>`).join('')}
      <td class="tot"><b>${s.total ?? ''}</b></td><td>${badgeTag(s.badge, s.badgeName)}${!s.badge && s.done ? `<div class="small muted">${esc(s.why)}</div>` : ''}</td>
      <td>${s.badge ? `<label class="check small"><input type="checkbox" data-vfsiss="${id}" ${r.issued ? 'checked' : ''}> ${r.issued ? esc(U.fmtDate(r.issued)) : ''}</label>` : ''}</td>
      <td><button class="sm ghost" data-act="vfsRemove" data-arg="${id}" title="Noņemt no testa">✕</button></td></tr>`;
  }
  // rindas pārzīmēšana pēc notikuma (fokusa maiņa / blur nedrīkst pārzīmēt to pašu rindu divreiz)
  const pend = new Set(); let pendT = 0;
  function refreshRow(t, id) {
    pend.add(id); clearTimeout(pendT);
    pendT = setTimeout(() => {
      const focus = document.activeElement?.dataset?.vfs;
      for (const rid of pend) { const tr = document.querySelector(`tr[data-vrow="${rid}"]`); if (!tr || !t.res[rid]) continue; const tmp = document.createElement('tbody'); tmp.innerHTML = rowHtml(t, rid); tr.replaceWith(tmp.firstElementChild); }
      pend.clear();
      if (focus) { const el = document.querySelector(`[data-vfs="${focus}"]`); if (el && document.activeElement !== el) { el.focus(); el.select?.(); } }
    }, 0);
  }

  /* --- Ievade --- */
  document.addEventListener('change', e => {
    const el = e.target, t = testOf(V().test); if (!t) return;
    if (el.dataset.vfs) {
      const [id, k] = el.dataset.vfs.split('|'), r = t.res[id]; if (!r) return;
      const v = parse(k, r.g, el.value);
      if (Number.isNaN(v)) { el.classList.add('bad'); return ui.toast(`Nesaprotu “${el.value}”. ${k === 'run' ? 'Garās distances laiku raksti kā 5:49.' : 'Raksti skaitli, piem., 12 vai 9,8.'}`, 'warn', 6000); }
      r.v = r.v || {}; if (v == null) delete r.v[k]; else r.v[k] = v;
      syncQuals(t); CP.store.changed({ silent: true }); refreshRow(t, id); updateHead(t);
    } else if (el.dataset.vfsg) {
      const id = el.dataset.vfsg, r = t.res[id], p = D.person(id); if (!r) return;
      r.g = el.value; if (p && el.value) { p.gender = el.value; p.updatedAt = U.now(); }
      // kāriens ↔ pievilkšanās: vērtība nav salīdzināma — paliek, bet punkti pārrēķinās
      syncQuals(t); CP.store.changed({ silent: true }); refreshRow(t, id); updateHead(t);
    } else if (el.dataset.vfsl) {
      const id = el.dataset.vfsl, r = t.res[id]; if (!r) return;
      r.lvl = el.value; syncQuals(t); CP.store.changed({ silent: true }); CP.render();
    } else if (el.dataset.vfsiss) {
      const r = t.res[el.dataset.vfsiss]; if (!r) return;
      r.issued = el.checked ? U.iso() : ''; CP.store.changed({ silent: true }); refreshRow(t, el.dataset.vfsiss);
    } else if (el.id === 'vfsPerson') { V().person = el.value; CP.render(); }
    else if (el.id === 'vfsDynGroup') { V().group = el.value; CP.render(); }
  });
  document.addEventListener('keydown', e => {
    const el = e.target; if (!el.dataset?.vfs || e.key !== 'Enter') return;
    e.preventDefault();
    const [id, k] = el.dataset.vfs.split('|');
    const all = [...document.querySelectorAll(`[data-vfs$="|${k}"]`)], i = all.findIndex(x => x.dataset.vfs === `${id}|${k}`);
    const nxKey = (all[i + 1] || document.querySelector(`[data-vfs$="|${EX[EX.indexOf(k) + 1]}"]`))?.dataset.vfs;
    el.blur();   // izsauc “change”
    setTimeout(() => { const nx = nxKey && document.querySelector(`[data-vfs="${nxKey}"]`); nx?.focus(); nx?.select?.(); }, 20);
  });
  const updateHead = t => { const h = document.querySelector('.vfs-head .small'); if (!h) return; const sc = Object.keys(t.res).filter(id => D.person(id)).map(id => score(t.res[id])), c = x => sc.filter(s => s.badge === x).length; h.innerHTML = `${sc.length} dalībnieki · ${badgeTag('z', 'Zelts')} ${c('z')} · ${badgeTag('s', 'Sudrabs')} ${c('s')} · ${badgeTag('b', 'Bronza')} ${c('b')}`; };

  /* --- Darbības --- */
  A.vfsPick = id => { V().test = id; V().view = 'res'; CP.render(); };
  A.vfsView = k => { V().view = k; CP.render(); };
  function dlg(id, html) { let d = U.$(id); if (!d) { d = document.createElement('dialog'); d.id = id; document.body.appendChild(d); } d.innerHTML = html; if (!d.open) d.showModal(); return d; }
  const groupOpts = sel => `<option value="*">Visa vienība</option>${D.groups().map(g => `<option ${g === sel ? 'selected' : ''}>${esc(g)}</option>`).join('')}`;
  const active = g => D.peopleInYear().filter(p => p.status !== 'archived' && p.status !== 'paused' && (g === '*' || D.groupOf(p) === g));
  A.vfsNew = () => {
    const d = dlg('vfsDlg', `<form><header class="dlg-head"><h2>Jauns VFS tests</h2><button type="button" class="ghost" data-close="vfsDlg" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><div class="fieldgrid"><div class="field"><label>Testa datums</label><input type="date" name="date" value="${U.iso()}" required></div>
        <div class="field"><label>Nosaukums (nav obligāti)</label><input name="title" placeholder="piem., Pavasara tests"></div>
        <div class="field wide"><label>Dalībnieki</label><select name="group">${groupOpts('*')}</select><small class="muted">Tiks pievienoti visi aktīvie jaunsargi. Liekos var noņemt, citus pievienot vēlāk.</small></div></div></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="vfsDlg">Atcelt</button><button class="mainbtn">Izveidot</button></footer></form>`);
    d.querySelector('form').onsubmit = e => {
      e.preventDefault(); const f = e.target;
      const t = { id: U.uid(), date: f.date.value, yearId: U.yearOfDate ? U.yearOfDate(f.date.value) : D.activeYear(), title: f.title.value.trim(), res: {}, createdAt: U.now() };
      addPeople(t, active(f.group.value).map(p => p.id)); tests().push(t); V().test = t.id; V().view = 'res'; d.close(); CP.store.changed();
    };
  };
  A.vfsEditTest = () => {
    const t = testOf(V().test); if (!t) return;
    const d = dlg('vfsDlg', `<form><header class="dlg-head"><h2>VFS tests</h2><button type="button" class="ghost" data-close="vfsDlg" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><div class="fieldgrid"><div class="field"><label>Testa datums</label><input type="date" name="date" value="${esc(t.date)}" required></div><div class="field"><label>Nosaukums</label><input name="title" value="${esc(t.title || '')}"></div></div>
        <label class="check"><input type="checkbox" name="relvl"> Pārrēķināt pakāpes pēc vecuma jaunajā datumā</label></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="vfsDlg">Atcelt</button><button class="mainbtn">Saglabāt</button></footer></form>`);
    d.querySelector('form').onsubmit = e => {
      e.preventDefault(); const f = e.target; t.date = f.date.value; t.title = f.title.value.trim(); if (U.yearOfDate) t.yearId = U.yearOfDate(t.date);
      if (f.relvl.checked) for (const [id, r] of Object.entries(t.res)) { const l = lvlOfAge(ageAt(D.person(id)?.birth, t.date)); if (l) r.lvl = l; }
      syncQuals(t); for (const p of S.db.people) for (const q of p.quals || []) if (q.src === 'vfs:' + t.id) q.date = t.date;
      d.close(); CP.store.changed();
    };
  };
  A.vfsDel = () => { const t = testOf(V().test); if (!t || !confirm(`Dzēst VFS testu ${U.fmtDate(t.date)} ar ${Object.keys(t.res).length} rezultātiem? Arī ar to piešķirtās nozīmītes kvalifikācijās tiks noņemtas.`)) return; dropQuals(t); S.db.vfsTests = tests().filter(x => x !== t); V().test = ''; CP.store.changed(); };
  A.vfsRemove = id => { const t = testOf(V().test); if (!t) return; const p = D.person(id); if (Object.keys(t.res[id]?.v || {}).length && !confirm(`Noņemt ${U.full(p)} no testa? Ievadītie rezultāti tiks dzēsti.`)) return; delete t.res[id]; if (p) p.quals = (p.quals || []).filter(x => x.src !== 'vfs:' + t.id); CP.store.changed(); };
  A.vfsAddPeople = () => {
    const t = testOf(V().test); if (!t) return;
    const cand = D.peopleInYear().filter(p => p.status !== 'archived' && !t.res[p.id]).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
    const d = dlg('vfsDlg', `<form><header class="dlg-head"><h2>Pievienot jaunsargus</h2><button type="button" class="ghost" data-close="vfsDlg" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body">${cand.length ? `<div class="vfs-pick">${cand.map(p => `<label class="check"><input type="checkbox" name="p" value="${p.id}"> ${esc(U.sortName(p))} <span class="small muted">${esc(D.groupOf(p) || '')}</span></label>`).join('')}</div>` : '<p class="muted">Visi jaunsargi jau ir šajā testā.</p>'}</div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="vfsDlg">Atcelt</button>${cand.length ? '<button class="mainbtn">Pievienot</button>' : ''}</footer></form>`);
    d.querySelector('form').onsubmit = e => { e.preventDefault(); const ids = [...e.target.querySelectorAll('[name=p]:checked')].map(x => x.value); addPeople(t, ids); d.close(); CP.store.changed(); };
  };
  A.vfsGenderOk = () => {
    const t = testOf(V().test); if (!t) return; let n = 0;
    for (const [id, r] of Object.entries(t.res)) { const p = D.person(id); if (!r.g && p) { const g = guessG(p.first); if (g) { r.g = g; p.gender = g; p.updatedAt = U.now(); n++; } } }
    syncQuals(t); CP.store.changed(); ui.toast(`Dzimums ierakstīts ${n} jaunsargu kartītēs`, 'ok');
  };
  A.vfsSettings = () => {
    const c = cfg();
    const d = dlg('vfsDlg', `<form><header class="dlg-head"><h2>VFS iestatījumi</h2><button type="button" class="ghost" data-close="vfsDlg" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><div class="fieldgrid">
        <div class="field wide"><label>Vienība (protokola virsrakstā)</label><input name="unit" value="${esc(c.unit)}" placeholder="piem., X pamatskolas jaunsargu vienība"></div>
        <div class="field"><label>Instruktors</label><input name="instructor" value="${esc(c.instructor)}" placeholder="Vārds Uzvārds"></div>
        <div class="field"><label>Nozīmīšu uzskaites lapa</label><select name="sheet">${[1, 2, 3, 4].map(n => `<option value="${n - 1}" ${+c.sheet === n - 1 ? 'selected' : ''}>${n}. nodaļa</option>`).join('')}</select></div>
        <div class="field wide"><label>Novada pārvalde un nodaļa (uzskaites tabulas galvenē)</label><input name="region" value="${esc(c.region)}" placeholder="piem., 5. novada pārvaldes 1.nodaļa"></div>
        <div class="field wide"><label>Rezultāts starp divām punktu robežām</label><div class="choice-list">
          <label class="choice"><input type="radio" name="mode" value="strict" ${c.mode !== 'generous' ? 'checked' : ''}><div class="grow"><b>Norma jāsasniedz</b><div class="small muted">Piem., 60 m 10,32 s, kur 7 punktiem jāskrien 10,3 s: <b>6 punkti</b>.</div></div></label>
          <label class="choice"><input type="radio" name="mode" value="generous" ${c.mode === 'generous' ? 'checked' : ''}><div class="grow"><b>Par labu jaunsargam</b><div class="small muted">Rezultāts labāks par zemākā punkta robežu (10,6 s), tāpēc <b>7 punkti</b>.</div></div></label></div></div></div></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="vfsDlg">Atcelt</button><button class="mainbtn">Saglabāt</button></footer></form>`);
    d.querySelector('form').onsubmit = e => { e.preventDefault(); const f = e.target; const was = c.mode; Object.assign(c, { unit: f.unit.value.trim(), instructor: f.instructor.value.trim(), region: f.region.value.trim(), sheet: +f.sheet.value, mode: f.mode.value }); if (was !== c.mode) tests().forEach(syncQuals); d.close(); CP.store.changed(); };
  };

  /* --- Normatīvi (uzziņai) --- */
  function normsView() {
    return `<section class="card"><h3>${ic('list')}Vērtējumu tabulas (JC 1.pielikums, 2.tabula)</h3>
      <p class="small muted" style="margin-top:0">Robežas, lai iegūtu attiecīgo punktu skaitu (${curMode() === 'generous' ? 'starpvērtībām — augstākais punkts' : 'norma jāsasniedz'}; maina ⚙ iestatījumos). Zem 2 punktu robežas — 1 punkts. Nozīmīte: visi 6 vingrinājumi, neviens mazāk par 4 punktiem; bronza 41–47, sudrabs 48–53, zelts 54 un vairāk.</p>
      ${LVLS.map(l => `<h4>${l} pakāpe · ${LVL_AGE[l]}</h4><div class="vfs-wrap"><table class="vfs-norms"><thead><tr><th>Punkti</th>${['m', 'f'].map(g => EX.map(k => `<th>${esc(exName(k, l, g, true))}<br><small>${g === 'm' ? 'zēni' : 'meitenes'}</small></th>`).join('')).join('')}</tr></thead>
        <tbody>${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<tr><td><b>${10 - i}</b></td>${['m', 'f'].map(g => EX.map(k => `<td>${esc(show(k, g, NORMS[l][g][k][i]) || '—')}</td>`).join('')).join('')}</tr>`).join('')}</tbody></table></div>`).join('')}</section>`;
  }

  /* --- Dinamika --- */
  function personHistory(pid) {
    return [...tests()].filter(t => t.res[pid]).sort((a, b) => String(a.date).localeCompare(String(b.date))).map(t => ({ t, r: t.res[pid], s: score(t.res[pid]) }));
  }
  function chart(points, h = 170) {
    const w = 560, pad = 28, n = points.length; if (!n) return '';
    const vals = points.map(p => p.v).filter(v => v != null), lo = Math.max(0, Math.min(36, ...vals) - 6);
    const x = i => n === 1 ? w / 2 : pad + i * (w - 2 * pad) / (n - 1), y = v => h - 22 - ((v - lo) / (60 - lo)) * (h - 40);
    const ln = points.map((p, i) => p.v == null ? '' : `${i && points[i - 1].v != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
    const bands = [[54, 'z'], [48, 's'], [41, 'b']].map(([v, c]) => `<line x1="${pad}" x2="${w - pad}" y1="${y(v)}" y2="${y(v)}" class="vfs-band b-${c}"/><text x="${w - pad + 3}" y="${y(v) + 3}" class="vfs-ax">${v}</text>`).join('');
    return `<svg class="vfs-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Punktu dinamika">${bands}
      <path d="${ln}" class="vfs-line"/>${points.map((p, i) => p.v == null ? '' : `<circle cx="${x(i)}" cy="${y(p.v)}" r="4" class="vfs-dot ${p.b ? 'b-' + p.b : ''}"/><text x="${x(i)}" y="${y(p.v) - 9}" text-anchor="middle" class="vfs-val">${p.v}</text>`).join('')}
      ${points.map((p, i) => `<text x="${x(i)}" y="${h - 6}" text-anchor="middle" class="vfs-ax">${esc(p.l)}</text>`).join('')}</svg>`;
  }
  function dyn(v) {
    const all = [...tests()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (!all.length) return '<section class="card"><p class="muted">Dinamika parādīsies, kad būs vismaz viens tests.</p></section>';
    const inG = id => { const p = D.person(id); return p && (!v.group || v.group === '*' || D.groupOf(p) === v.group); };
    // grupas kopsavilkums pa testiem
    const sum = all.map(t => { const ids = Object.keys(t.res).filter(inG), sc = ids.map(id => score(t.res[id])).filter(s => s.total != null); const avg = sc.length ? Math.round(sc.reduce((a, s) => a + s.total, 0) / sc.length * 10) / 10 : null; return { t, n: ids.length, avg, z: sc.filter(s => s.badge === 'z').length, s: sc.filter(s => s.badge === 's').length, b: sc.filter(s => s.badge === 'b').length }; });
    const ppl = [...new Set(all.flatMap(t => Object.keys(t.res)))].filter(inG).map(id => D.person(id)).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
    if (v.person && !ppl.some(p => p.id === v.person)) v.person = '';
    // progress: pēdējie divi testi
    const prog = ppl.map(p => { const h = personHistory(p.id).filter(x => x.s.total != null); if (h.length < 2) return null; const a = h.at(-2), b = h.at(-1); return { p, a, b, d: b.s.total - a.s.total }; }).filter(Boolean).sort((x, y) => y.d - x.d);
    const ph = v.person ? personHistory(v.person) : [];
    return `<div class="cards2">
      <section class="card"><h3>${ic('chart')}Vienības rezultāti pa testiem</h3>
        <div class="inline-form" style="margin:0 0 8px"><label class="small">Grupa</label><select id="vfsDynGroup">${groupOpts(v.group || '*')}</select></div>
        ${chart(sum.map(x => ({ v: x.avg, l: U.fmtDate(x.t.date).slice(3) })))}
        <table class="vfs-sum"><thead><tr><th>Tests</th><th>Dalībn.</th><th>Vid. punkti</th><th>Zelts</th><th>Sudrabs</th><th>Bronza</th></tr></thead><tbody>
        ${sum.map(x => `<tr><td><a href="#" data-act="vfsPick" data-arg="${x.t.id}">${esc(U.fmtDate(x.t.date))}</a></td><td>${x.n}</td><td><b>${x.avg ?? '—'}</b></td><td>${x.z}</td><td>${x.s}</td><td>${x.b}</td></tr>`).join('')}</tbody></table></section>
      <section class="card"><h3>${ic('user')}Jaunsarga dinamika</h3>
        <select id="vfsPerson"><option value="">Izvēlies jaunsargu…</option>${ppl.map(p => `<option value="${p.id}" ${p.id === v.person ? 'selected' : ''}>${esc(U.sortName(p))}</option>`).join('')}</select>
        ${ph.length ? `${chart(ph.map(x => ({ v: x.s.total, b: x.s.badge, l: U.fmtDate(x.t.date).slice(3) })))}
          <div class="vfs-wrap"><table class="vfs-sum"><thead><tr><th>Vingrinājums</th>${ph.map(x => `<th>${esc(U.fmtDate(x.t.date))}<br><small>${x.r.lvl || '—'} pak.</small></th>`).join('')}</tr></thead><tbody>
          ${EX.map(k => `<tr><td>${esc(exName(k, ph.at(-1).r.lvl, ph.at(-1).r.g, true))}</td>${ph.map((x, i) => { const val = x.r.v?.[k], pr = i ? ph[i - 1].r.v?.[k] : null, better = val != null && pr != null && val !== pr ? ((LOW.has(k) ? val < pr : val > pr) ? 'up' : 'down') : ''; return `<td>${val == null ? '<span class="muted">—</span>' : esc(show(k, x.r.g, val))} ${ptsTag(x.s.pts[k])}${better ? `<span class="vfs-tr ${better}">${better === 'up' ? '▲' : '▼'}</span>` : ''}</td>`; }).join('')}</tr>`).join('')}
          <tr class="tot"><td>Kopā</td>${ph.map(x => `<td><b>${x.s.total ?? '—'}</b> ${badgeTag(x.s.badge, x.s.badgeName)}</td>`).join('')}</tr></tbody></table></div>` : '<p class="muted small">Izvēlies jaunsargu, lai redzētu viņa rezultātus visos testos.</p>'}</section>
      <section class="card wide"><h3>${ic('chart')}Kurš uzlabojies (pēdējie divi testi)</h3>
        ${prog.length ? `<div class="vfs-prog">${prog.map(x => `<div class="row"><a href="#" data-act="vfsPersonDyn" data-arg="${x.p.id}" class="grow">${esc(U.sortName(x.p))}</a><span class="small muted">${x.a.s.total} → ${x.b.s.total}</span><b class="${x.d > 0 ? 'okc' : x.d < 0 ? 'red' : 'muted'}">${x.d > 0 ? '+' : ''}${x.d}</b></div>`).join('')}</div>` : '<p class="muted small">Vajag vismaz divus testus ar vienu un to pašu jaunsargu.</p>'}</section></div>`;
  }
  A.vfsPersonDyn = pid => { V().person = pid; V().view = 'dyn'; (S.att = S.att || {}).tab = 'vfs'; if (S.page !== 'attendance') CP.ui.go('attendance'); else CP.render(); };

  /* --- Protokols (PDF, 1.tabulas formā) --- */
  A.vfsProtocol = async () => {
    const t = testOf(V().test); if (!t) return; const c = cfg();
    const levels = LVLS.map(l => {
      const ids = Object.keys(t.res).filter(id => D.person(id) && t.res[id].lvl === l).sort((a, b) => U.cmp(U.full(D.person(a)), U.full(D.person(b))));
      return { lvl: l, head: `${LVL_HEAD[l]} (${LVL_AGE[l]})`, thr: l === 'IV' ? 'Granātas mešana (metri)' : 'Bumbiņas mešana (metri)', run: l === 'I' ? 'Garā distance 1000 m (min un sek.)' : l === 'II' ? 'Garā distance 1500 m (min un sek.)' : 'Garā distance 2000 m / 3000 m (min un sek.)', sexes: l === 'I' || l === 'II' ? ['Zēni', 'Meitenes'] : ['Jaunieši', 'Jaunietes'],
        rows: ids.map((id, i) => {
          const r = t.res[id], s = score(r), cell = k => r.v?.[k] == null ? ['-', '-'] : [show(k, r.g, r.v[k]), String(s.pts[k] ?? '-')];
          const pull = r.g === 'm' ? cell('str') : ['-', '-'], hang = r.g === 'f' ? cell('str') : ['-', '-'];
          return [`${i + 1}.`, U.full(D.person(id)), ...pull, ...hang, ...cell('push'), ...cell('sit'), ...cell('thr'), ...cell('spr'), ...cell('run'), s.total == null ? '-' : String(s.total), s.badgeName || '-'];
        }) };
    }).filter(x => x.rows.length);
    if (!levels.length) return ui.toast('Testā nav jaunsargu ar noteiktu pakāpi', 'warn');
    try {
      const bytes = await CP.pdf.vfs({ unit: c.unit, date: U.fmtDate(t.date), instructor: c.instructor, levels });
      await CP.printPdf(new Blob([bytes], { type: 'application/pdf' }), `VFS protokols ${c.unit ? c.unit + ' ' : ''}${t.date}.pdf`);
    } catch (e) { console.error(e); ui.toast('Protokolu neizdevās sagatavot: ' + e.message, 'err', 10000); }
  };

  /* --- Nozīmīšu uzskaites tabula (2. pielikums, Excel) --- */
  A.vfsBadgeXlsx = async () => {
    const t = testOf(V().test); if (!t) return; const c = cfg();
    const rows = Object.keys(t.res).filter(id => D.person(id)).map(id => ({ p: D.person(id), r: t.res[id], s: score(t.res[id]) })).filter(x => x.s.badge).sort((a, b) => U.cmp(U.full(a.p), U.full(b.p)));
    if (!rows.length) return ui.toast('Šajā testā neviens nav ieguvis nozīmīti', 'warn');
    try {
      const r = await fetch(CP.VENDOR + `templates/vfs-nozimites.xlsx?v=${CP.VERSION}`, { cache: 'no-cache' }); if (!r.ok) throw Error('veidne nav ielādējama (' + r.status + ')');
      const files = await U.unzip(await r.arrayBuffer()), dec = new TextDecoder(), enc = new TextEncoder(), out = [];
      const sheetNo = (+c.sheet || 0) + 1, target = `xl/worksheets/sheet${sheetNo}.xml`;
      const ym = /^(\d{4})-(\d{4})$/.exec(t.yearId || U.yearOfDate(t.date) || ''), yr = ym ? `${ym[1]}./${ym[2]}.` : '';
      for (const [name, get] of files) {
        let data = await get();
        if (name === target) data = enc.encode(fillSheet(dec.decode(data), rows, { region: c.region, year: yr, instructor: c.instructor }));
        out.push([name, data]);
      }
      const blob = await CP.docxFill.zip(out, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      U.download(blob, `VFS sporta nozīmīšu uzskaite ${t.date}.xlsx`);
      ui.toast(`Uzskaites tabulā ierakstīti ${rows.length} jaunsargi (${sheetNo}. nodaļas lapā)`, 'ok', 7000);
    } catch (e) { console.error(e); ui.toast('Tabulu neizdevās sagatavot: ' + e.message, 'err', 10000); }
  };
  function fillSheet(xml, rows, o) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml'), NS = doc.documentElement.namespaceURI;
    const sd = doc.getElementsByTagNameNS(NS, 'sheetData')[0];
    const rowEl = n => { let r = [...sd.getElementsByTagNameNS(NS, 'row')].find(x => +x.getAttribute('r') === n); if (!r) { r = doc.createElementNS(NS, 'row'); r.setAttribute('r', n); const after = [...sd.getElementsByTagNameNS(NS, 'row')].find(x => +x.getAttribute('r') > n); sd.insertBefore(r, after || null); } return r; };
    const colN = ref => ref.replace(/\d+/g, '').split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
    function set(ref, val, styleFrom) {
      const n = +ref.replace(/\D/g, ''), r = rowEl(n);
      let c = [...r.getElementsByTagNameNS(NS, 'c')].find(x => x.getAttribute('r') === ref);
      if (!c) {
        c = doc.createElementNS(NS, 'c'); c.setAttribute('r', ref);
        const after = [...r.getElementsByTagNameNS(NS, 'c')].find(x => colN(x.getAttribute('r')) > colN(ref)); r.insertBefore(c, after || null);
        if (styleFrom && styleFrom !== ref) { const sa = [...rowEl(+styleFrom.replace(/\D/g, '')).getElementsByTagNameNS(NS, 'c')].find(x => x.getAttribute('r') === styleFrom)?.getAttribute('s'); if (sa) c.setAttribute('s', sa); }
      }
      while (c.firstChild) c.removeChild(c.firstChild);
      if (val === '' || val == null) { c.removeAttribute('t'); return; }
      if (typeof val === 'number') { c.removeAttribute('t'); const v = doc.createElementNS(NS, 'v'); v.textContent = String(val); c.appendChild(v); return; }
      c.setAttribute('t', 'inlineStr'); const is = doc.createElementNS(NS, 'is'), tt = doc.createElementNS(NS, 't'); tt.textContent = String(val); tt.setAttribute('xml:space', 'preserve'); is.appendChild(tt); c.appendChild(is);
    }
    if (o.region) set('A2', o.region);
    if (o.year) set('A5', ` ${o.year} mācību gads`);
    rows.forEach((x, i) => {
      const n = 7 + i, ref = col => col + n, tpl = col => col + Math.min(n, 8);
      set(ref('A'), `${i + 1}.`, tpl('A')); set(ref('B'), U.full(x.p), tpl('B')); set(ref('C'), `${x.r.lvl} pakāpe`, tpl('C')); set(ref('D'), o.instructor || '', tpl('D'));
      set(ref('E'), x.s.total, tpl('E')); set(ref('F'), x.s.badgeName, tpl('F')); set(ref('G'), x.r.issued ? U.fmtDate(x.r.issued) : '', tpl('G'));
    });
    return new XMLSerializer().serializeToString(doc);
  }

  /* --- Imports no Word protokola (agrāko gadu rezultāti) --- */
  let IMP = null;
  A.vfsImport = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.docx'; i.onchange = () => i.files[0] && importFile(i.files[0]); i.click(); };
  async function importFile(file) {
    let parsed;
    try { parsed = await parseProtocol(await file.arrayBuffer()); } catch (e) { console.error(e); return ui.toast('Protokolu neizdevās nolasīt: ' + e.message, 'err', 10000); }
    if (!parsed.length) return ui.toast('Dokumentā netika atrasta VFS protokola tabula (ar kolonnām “Vārds Uzvārds”, “Rez.”, “Punkti”)', 'warn', 10000);
    const ppl = S.db.people, key = s => U.norm(s).replace(/[^a-z0-9āčēģīķļņšūž ]/g, '').split(/\s+/).filter(Boolean).sort().join(' ');
    const idx = new Map(); for (const p of ppl) idx.set(key(`${p.first} ${p.last}`), p);
    IMP = parsed.map(x => ({ ...x, pid: idx.get(key(x.name))?.id || '' }));
    const m = IMP.filter(x => x.pid).length;
    const d = dlg('vfsImpDlg', `<form><header class="dlg-head"><h2>Importēt VFS protokolu</h2><button type="button" class="ghost" data-close="vfsImpDlg" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><p class="small" style="margin-top:0">“${esc(file.name)}”: atrasti <b>${IMP.length}</b> jaunsargi, no tiem sarakstā atpazīti <b>${m}</b>. Punkti un nozīmītes tiks pārrēķinātas pēc normatīviem.</p>
        <div class="fieldgrid"><div class="field"><label>Testa datums</label><input type="date" name="date" required value="${esc(guessDate(file))}"></div><div class="field"><label>Nosaukums (nav obligāti)</label><input name="title" placeholder="piem., Imports no protokola"></div></div>
        <div class="vfs-wrap"><table class="vfs-sum"><thead><tr><th>Protokolā</th><th>Pak.</th><th>Persona rīkā</th></tr></thead><tbody>
        ${IMP.map((x, i) => `<tr><td>${esc(x.name)}</td><td>${x.lvl || '—'}</td><td><select name="m${i}"><option value="">— neimportēt —</option>${[...ppl].sort((a, b) => U.cmp(U.sortName(a), U.sortName(b))).map(p => `<option value="${p.id}" ${p.id === x.pid ? 'selected' : ''}>${esc(U.sortName(p))}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="vfsImpDlg">Atcelt</button><button class="mainbtn">Importēt</button></footer></form>`);
    d.querySelector('form').onsubmit = e => {
      e.preventDefault(); const f = e.target, date = f.date.value;
      const t = { id: U.uid(), date, yearId: U.yearOfDate ? U.yearOfDate(date) : D.activeYear(), title: f.title.value.trim() || 'Imports no protokola', res: {}, createdAt: U.now() };
      let n = 0;
      IMP.forEach((x, i) => {
        const pid = f['m' + i].value; if (!pid) return; const p = D.person(pid);
        const g = x.g || p?.gender || guessG(p?.first), v = {};
        for (const k of EX) { const raw = k === 'str' ? (g === 'f' ? x.raw.hang : x.raw.pull) : x.raw[k]; const val = parse(k, g, raw); if (val != null && !Number.isNaN(val)) v[k] = val; }
        t.res[pid] = { g, lvl: x.lvl || lvlOfAge(ageAt(p?.birth, date)), v }; n++;
        if (p && !p.gender && x.g) { p.gender = x.g; p.updatedAt = U.now(); }
      });
      if (!n) return ui.toast('Nav izvēlēts neviens jaunsargs', 'warn');
      tests().push(t); syncQuals(t); V().test = t.id; V().view = 'res'; d.close(); CP.store.changed();
      ui.toast(`Importēti ${n} jaunsargu rezultāti`, 'ok');
    };
  }
  const guessDate = f => { const m = f.name.match(/(20\d\d)[-._](\d\d)[-._](\d\d)/) || f.name.match(/(\d\d)[-._](\d\d)[-._](20\d\d)/); if (m) return m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2]}-${m[1]}`; return U.iso(); };
  /** Word protokols: tabulas ar “Vārds Uzvārds”; kolonnas — pievilkšanās, kāriens, atspiešanās, ķermeņa pacelšana, mešana, 60 m, garā distance */
  async function parseProtocol(buf) {
    const files = await U.unzip(buf, n => n === 'word/document.xml'); if (!files.has('word/document.xml')) throw Error('nav Word .docx fails');
    const xml = new TextDecoder().decode(await files.get('word/document.xml')());
    const doc = new DOMParser().parseFromString(xml, 'application/xml'), W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const txt = el => [...el.getElementsByTagNameNS(W, 't')].map(t => t.textContent).join('').trim();
    const out = []; let lastHead = '';
    const body = doc.getElementsByTagNameNS(W, 'body')[0];
    for (const el of body.children) {
      if (el.localName === 'p') { const s = txt(el); if (/gadi|gads/.test(s)) lastHead = s; continue; }
      if (el.localName !== 'tbl') continue;
      const rows = [...el.getElementsByTagNameNS(W, 'tr')].map(tr => [...tr.getElementsByTagNameNS(W, 'tc')].map(txt));
      const head = rows.map(r => r.join(' ')).join(' ') + ' ' + lastHead;
      const am = head.match(/(\d{2})\s*[–-]\s*(\d{2})\s*gad/), lvl = am ? lvlOfAge(+am[1]) : '';
      const hi = rows.findIndex(r => r.some(c => /vārds\s*uzvārds/i.test(c))); if (hi < 0) continue;
      for (const r of rows.slice(hi + 1)) {
        if (r.length < 16) continue;
        const name = r[1].replace(/\s+/g, ' ').trim(); if (!name || /^\d+\.?$/.test(name)) continue;
        const raw = { pull: r[2], hang: r[4], push: r[6], sit: r[8], thr: r[10], spr: r[12], run: r[14] };
        const has = s => s && !/^[-—–]?$/.test(s.trim());
        const g = has(raw.pull) && !has(raw.hang) ? 'm' : has(raw.hang) && !has(raw.pull) ? 'f' : '';
        out.push({ name, lvl, g, raw });
      }
    }
    return out;
  }

  /* --- Personas kartītē: īss VFS kopsavilkums (kvalifikāciju sadaļā) --- */
  function personSummary(p) {
    const h = personHistory(p.id); if (!h.length) return '';
    return `<div class="vfs-mini small">${h.slice(-4).map(x => `<span>${esc(U.fmtDate(x.t.date))}: <b>${x.s.total ?? '—'}</b> p. ${x.s.badge ? badgeTag(x.s.badge, x.s.badgeName) : ''}</span>`).join(' · ')} <a href="#" data-act="vfsPersonDyn" data-arg="${p.id}">Dinamika →</a></div>`;
  }

  CP.vfs = { page, parse, points, score, show, NORMS, EX, lvlOfAge, ageAt, guessG, parseProtocol, personSummary, syncQuals };
})(window.CP);
