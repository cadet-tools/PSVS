/* =====================================================================
   Grafika imports no instruktoru darba uzskaites Excel (.xlsm / .xlsx).
   Lasa tikai divas lapas (pēc virsrakstiem, nevis pēc pozīcijas):
   • “Darba plāns_secīgi” — Datums no | Laiks no | Datums līdz | Laiks līdz | Mācību grupa | Pasākuma veids |
     Obligātais pasākums | Pasākuma nosaukums | Norises vieta | Vadītājs | Atbalsta personāls | Dalībnieki
   • “Nodarbību saraksts” — grupas līmenis, nosaukums, vieta, adrese, mēnešu kolonnas ar dienām (“16.\n23.”),
     laiks no / līdz, piezīmes. Mācību gads no virsraksta “2026./2027.”
   Slēptās palīglapas un rindas ar “0” tiek izlaistas. Atkārtots imports: katram notikumam ir atslēga
   (ikey) → jauns / mainīts / failā vairs nav / bez izmaiņām. Rīkā izveidotie notikumi netiek aiztikti.
   Fails netiek saglabāts un nekur sūtīts — tiek nolasīti tikai grafika lauki.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, ui = CP.ui, A = CP.actions, esc = U.esc;
  const SC = () => CP.schedule;
  const st = () => S.db.settings;

  /* --- Excel lasīšana (tikai vajadzīgās lapas) --- */
  const xml = raw => { const x = new DOMParser().parseFromString(raw, 'application/xml'); if (x.querySelector('parsererror')) throw Error('Excel XML nav nolasāms'); return x; };
  const tags = (n, t) => [...n.getElementsByTagNameNS('*', t)];
  const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  async function readBook(buf) {
    const z = await U.unzip(buf, n => n === 'xl/sharedStrings.xml' || n === 'xl/workbook.xml' || n === 'xl/_rels/workbook.xml.rels' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n)), dec = new TextDecoder();
    const txt = async n => z.has(n) ? dec.decode(await z.get(n)()) : '';
    if (!z.has('xl/workbook.xml')) throw Error('fails nav Excel darbgrāmata');
    const strings = z.has('xl/sharedStrings.xml') ? tags(xml(await txt('xl/sharedStrings.xml')), 'si').map(si => tags(si, 't').map(t => t.textContent).join('')) : [];
    const rm = {}; for (const r of tags(xml(await txt('xl/_rels/workbook.xml.rels')), 'Relationship')) rm[r.getAttribute('Id')] = r.getAttribute('Target') || '';
    const sheets = tags(xml(await txt('xl/workbook.xml')), 'sheet').map(sh => ({ name: sh.getAttribute('name') || '', hidden: (sh.getAttribute('state') || 'visible') !== 'visible',
      path: 'xl/' + (rm[sh.getAttributeNS(RNS, 'id') || sh.getAttribute('r:id')] || '').replace(/^\/?(xl\/)?/, '') }));
    const rowsOf = async sh => {
      const rows = [];
      for (const row of tags(xml(await txt(sh.path)), 'row')) {
        const rn = Number(row.getAttribute('r')) || rows.length + 1, arr = [];
        for (const c of tags(row, 'c')) {
          const L = (c.getAttribute('r') || 'A').match(/^[A-Z]+/i)?.[0] || 'A'; let i = 0; for (const ch of L.toUpperCase()) i = i * 26 + ch.charCodeAt(0) - 64; i--; if (i < 0 || i > 200) continue;
          let v = tags(c, 'v')[0]?.textContent ?? ''; const t = c.getAttribute('t');
          if (t === 's') v = strings[Number(v)] ?? ''; else if (t === 'inlineStr') v = tags(c, 't').map(e => e.textContent).join('');
          arr[i] = v;
        }
        while (rows.length < rn - 1 && rows.length < 3000) rows.push([]);
        rows.push(Array.from(arr, v => v ?? '')); if (rows.length >= 3000) break;
      }
      return rows;
    };
    return { sheets, rowsOf, has: sh => z.has(sh.path) };
  }

  /* --- Palīgi --- */
  const clean = v => { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); return s === '0' ? '' : s; };
  const norm = s => clean(s).toLocaleLowerCase('lv').replace(/[^\p{L}\p{N}]+/gu, '');
  const isoOf = serial => { const n = Number(serial); if (!(n > 20000 && n < 80000)) return ''; const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 864e5); return d.toISOString().slice(0, 10); };
  const timeOf = v => {
    if (v === '' || v == null) return ''; const s = String(v).trim();
    const m = /^(\d{1,2}):(\d{2})/.exec(s); if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
    const n = Number(s); if (!isFinite(n) || n <= 0) return ''; const mins = Math.round((n - Math.floor(n)) * 1440); if (!mins) return '';
    return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  };
  const findHead = (rows, need) => { for (let r = 0; r < Math.min(rows.length, 30); r++) { const low = (rows[r] || []).map(c => norm(c)); if (need.every(n => low.some(c => c.startsWith(norm(n))))) return r; } return -1; };
  const col = (row, ...names) => { const low = (row || []).map(c => norm(c)); for (const n of names) { const i = low.findIndex(c => c.startsWith(norm(n))); if (i >= 0) return i; } return -1; };
  const MONTHS = ['janvāris', 'februāris', 'marts', 'aprīlis', 'maijs', 'jūnijs', 'jūlijs', 'augusts', 'septembris', 'oktobris', 'novembris', 'decembris'];

  /** Veida noteikšana no tabulas “Pasākuma veids” / grupas līmeņa */
  function typeOf(kind, sub, title) {
    const k = norm(kind) + ' ' + norm(sub) + ' ' + norm(title);
    if (/prombūtn|atvaļinā|slimīb/.test(k)) return 'Prombūtne';
    if (/nometn/.test(k)) return 'Nometne';
    if (/sacens/.test(k)) return 'Sacensības';
    if (/^evam|^vam| vam/.test(k)) return 'VAM nodarbība';
    if (/novadapārvald/.test(k)) return 'Novada pārvaldes darbs';
    if (/metodisk|studij|mentor|noliktav|dokument/.test(k)) return 'Metodiskais darbs';
    if (/seminār|sapulc|apmācīb/.test(k)) return 'Sapulce / apmācības';
    if (/pasākum/.test(k)) return 'Pasākums';
    return 'Cits';
  }

  /* --- Lapa “Darba plāns_secīgi” --- */
  function parsePlan(rows) {
    const h = findHead(rows, ['Datums no', 'Laiks no']); if (h < 0) return null;
    const top = rows[h - 1] || [], H = rows[h];
    const c = { d1: col(H, 'Datums no'), t1: col(H, 'Laiks no'), d2: col(H, 'Datums līdz'), t2: col(H, 'Laiks līdz'),
      grp: col(top, 'Mācību grupa'), kind: col(top, 'Pasākuma veids'), sub: col(top, 'Obligātais'), title: col(top, 'Pasākuma nosaukums'), place: col(top, 'Norises vieta'),
      lead: col(top, 'Nodarbības vai pasākuma vadītājs', 'Vadītājs'), sup: col(top, 'Atbalsta personāls'), js: col(H, 'jaunsargi'), oth: col(H, 'citi') };
    const out = [], skipped = [];
    for (let r = h + 1; r < rows.length; r++) {
      const R = rows[r] || [], g = i => i >= 0 ? R[i] : '';
      const date = isoOf(g(c.d1)); if (!date) { if (clean(g(c.title)) || clean(g(c.kind))) skipped.push({ row: r + 1, why: 'nav datuma', text: clean(g(c.title)) || clean(g(c.kind)) }); continue; }
      const kind = clean(g(c.kind)).replace(/_/g, ' '), sub = clean(g(c.sub)), title = clean(g(c.title)) || sub || kind;
      if (!title) continue;
      const type = typeOf(kind, sub, title), end = isoOf(g(c.d2)), start = timeOf(g(c.t1)), et = timeOf(g(c.t2));
      const grp = clean(g(c.grp)).split('/').map(x => x.trim()).filter(Boolean).slice(1).join(' · ');
      const lead = clean(g(c.lead)), sup = clean(g(c.sup)), js = Number(g(c.js)) || 0, oth = Number(g(c.oth)) || 0;
      const notes = [kind && kind !== title ? kind + (sub && sub !== title ? ' — ' + sub : '') : (sub && sub !== title ? sub : ''), grp && 'Grupa: ' + grp,
        lead && lead !== 'Dalība' ? 'Vada: ' + lead : lead === 'Dalība' ? 'Dalība' : '', sup && 'Atbalsts: ' + sup, js || oth ? `Dalībnieki: ${js ? js + ' jaunsargi' : ''}${js && oth ? ', ' : ''}${oth ? oth + ' citi' : ''}` : ''].filter(Boolean).join('\n');
      const allDay = type === 'Prombūtne' || !start;
      out.push({ src: 'plan', title, type, date, endDate: end && end > date ? end : '', allDay, start: allDay ? '' : start, end: allDay ? '' : (et && (end > date || et > start) ? et : ''), place: clean(g(c.place)), notes, row: r + 1 });
    }
    return { events: out, skipped };
  }

  /* --- Lapa “Nodarbību saraksts” --- */
  function parseLessons(rows) {
    const h = findHead(rows, ['Septembris', 'laiks no']); if (h < 0) return null;
    const H = rows[h];
    let y1 = 0; for (let r = 0; r < h; r++) { const m = /(\d{4})\.?\s*\/\s*(\d{4})/.exec((rows[r] || []).join(' ')); if (m) { y1 = Number(m[1]); break; } }
    if (!y1) y1 = Number(String(CP.data.activeYear()).slice(0, 4)) || new Date().getFullYear();
    const months = MONTHS.map((m, i) => ({ i, c: col(H, m) })).filter(x => x.c >= 0);
    const c = { lvl: col(H, 'Mācību grupas līmenis'), name: col(H, 'Mācību grupas nosaukums'), place: col(H, 'Mācību vietas nosaukums'), addr: col(H, 'Mācību vietas, adrese', 'Mācību vietas adrese'),
      t1: col(H, 'laiks no'), t2: col(H, 'laiks līdz'), note: col(H, 'Piezīmes') };
    const out = [], skipped = [];
    for (let r = h + 1; r < rows.length; r++) {
      const R = rows[r] || [], g = i => i >= 0 ? R[i] : '';
      const lvl = clean(g(c.lvl)), name = clean(g(c.name)); if (!lvl && !name) continue;
      const t0 = typeOf(lvl, '', name), type = t0 === 'Cits' ? 'Nodarbība' : t0, start = timeOf(g(c.t1)), end = timeOf(g(c.t2));
      const title = type === 'VAM nodarbība' ? [lvl, name].filter(Boolean).join(' ') : type === 'Metodiskais darbs' ? [lvl, name].filter(Boolean).join(' — ') : `Nodarbība ${lvl}${name ? ' ' + name : ''}`;
      const place = [clean(g(c.place)), clean(g(c.addr))].filter(Boolean).join(', '), notes = clean(g(c.note));
      let n = 0;
      for (const m of months) {
        const cell = String(g(m.c) ?? '').trim(); if (!cell || cell === '0') continue;
        const days = /^\d+(\.\d+)?$/.test(cell) && Number(cell) > 31 ? [] : (cell.match(/\d{1,2}/g) || []).map(Number).filter(d => d >= 1 && d <= 31);
        const yr = m.i >= 8 ? y1 : y1 + 1;
        for (const d of days) {
          const iso = `${yr}-${String(m.i + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          if (new Date(iso + 'T12:00:00').getMonth() !== m.i) continue;
          out.push({ src: 'les', title, type, date: iso, endDate: '', allDay: !start, start, end: start && end > start ? end : '', place, notes, row: r + 1 }); n++;
        }
      }
      if (!n) skipped.push({ row: r + 1, why: 'mēnešu kolonnās nav datumu', text: title });
    }
    return { events: out, skipped, year: `${y1}./${y1 + 1}.` };
  }

  async function parseFile(file) {
    if (/\.xls$/i.test(file.name)) throw Error('vecais .xls formāts netiek atbalstīts — saglabā failu kā .xlsx vai .xlsm');
    const bk = await readBook(await file.arrayBuffer());
    const vis = bk.sheets.filter(s => !s.hidden && bk.has(s));
    const pick = (pref, test) => [...vis.filter(s => norm(s.name) === norm(pref)), ...vis.filter(s => norm(s.name) !== norm(pref))];
    let plan = null, les = null, planSheet = '', lesSheet = '';
    for (const sh of pick('Darba plāns_secīgi')) { if (plan) break; if (/matric/i.test(sh.name)) continue; const p = parsePlan(await bk.rowsOf(sh)); if (p) { plan = p; planSheet = sh.name; } }
    for (const sh of pick('Nodarbību saraksts')) { if (les) break; const p = parseLessons(await bk.rowsOf(sh)); if (p) { les = p; lesSheet = sh.name; } }
    if (!plan && !les) throw Error('failā netika atrastas lapas “Darba plāns_secīgi” vai “Nodarbību saraksts” ar gaidītajiem virsrakstiem');
    // atslēgas: avots + datums + nosaukums (+ kārtas nr., ja vienā dienā vairāki vienādi)
    const all = [...(plan?.events || []), ...(les?.events || [])], seen = {};
    for (const e of all) { const k = `${e.src}|${e.date}|${norm(e.title)}`; seen[k] = (seen[k] || 0) + 1; e.ikey = seen[k] > 1 ? `${k}#${seen[k]}` : k; }
    return { name: file.name, events: all, skipped: [...(plan?.skipped || []), ...(les?.skipped || [])], planSheet, lesSheet, year: les?.year || '' };
  }

  /* --- Salīdzināšana ar esošo grafiku --- */
  const FIELDS = ['title', 'type', 'date', 'endDate', 'allDay', 'start', 'end', 'place', 'notes'];
  const FL = { title: 'nosaukums', type: 'veids', date: 'datums', endDate: 'beigu datums', allDay: 'visu dienu', start: 'sākums', end: 'beigas', place: 'vieta', notes: 'piezīmes' };
  function diff(parsed, opt) {
    const today = U.iso(), keep = e => (opt.past || (e.endDate || e.date) >= today) && (opt.absent || e.type !== 'Prombūtne') && (opt[e.src] !== false);
    const wanted = parsed.events.filter(keep), pastN = parsed.events.filter(e => !opt.past && (e.endDate || e.date) < today).length;
    const cur = new Map(SC().list().filter(e => e.ikey).map(e => [e.ikey, e]));
    const add = [], chg = [], same = [], del = [];
    for (const e of wanted) {
      const x = cur.get(e.ikey);
      if (!x) add.push({ e, on: true });
      else { const ch = FIELDS.filter(f => String(x[f] ?? '') !== String(e[f] ?? '')); if (ch.length) chg.push({ e, x, ch, edited: x.updatedAt && x.importedAt && x.updatedAt > x.importedAt, on: true }); else same.push(e); }
    }
    const keys = new Set(parsed.events.map(e => e.ikey));
    const srcIn = new Set([parsed.planSheet && 'plan', parsed.lesSheet && 'les'].filter(Boolean));
    for (const x of cur.values()) {
      const s = x.ikey.split('|')[0]; if (!srcIn.has(s)) continue;
      if ((x.endDate || x.date) < today && !opt.past) continue;          // pagātni neaiztiek
      if (!keys.has(x.ikey)) del.push({ x, edited: x.updatedAt && x.importedAt && x.updatedAt > x.importedAt, on: true });
    }
    return { add, chg, same, del, pastN };
  }

  /* --- Dialogs --- */
  let P = null, OPT = { past: false, absent: true, plan: true, les: true }, D = null;
  async function open(file) {
    if (!S.root) return CP.needRoot?.();
    try { ui.toast('Nolasa failu…', 'ok', 1500); P = await parseFile(file); }
    catch (e) { console.error(e); return ui.toast('Neizdevās nolasīt failu: ' + e.message, 'err', 10000); }
    draw();
  }
  const when = e => `${U.fmtDate(e.date)}${e.endDate ? '–' + U.fmtDate(e.endDate) : ''} ${SC().timeTxt(e).replace(/^visu dienu.*/, 'visu dienu')}`;
  function draw() {
    D = diff(P, OPT);
    let d = U.$('schImpDialog'); if (!d) { d = document.createElement('dialog'); d.id = 'schImpDialog'; d.className = 'wide'; document.body.appendChild(d); }
    const n = D.add.filter(x => x.on).length + D.chg.filter(x => x.on).length + D.del.filter(x => x.on).length;
    const row = (k, i, it, body) => `<label class="imp-row ${k}"><input type="checkbox" data-imp="${k}|${i}" ${it.on ? 'checked' : ''}><span class="nowrap imp-when">${esc(when(it.e || it.x))}</span><span class="grow">${body}</span></label>`;
    const tag = e => `<span class="tag" style="--c:${(SC().TYPES.find(t => t[0] === e.type) || [])[1]}">${esc(e.type)}</span>`;
    const sec = (title, cls, arr, render, note = '') => arr.length ? `<details class="imp-sec" ${cls !== 'same' ? 'open' : ''}><summary><b class="${cls}">${title} (${arr.length})</b>${note}</summary>${arr.map(render).join('')}</details>` : '';
    d.innerHTML = `<header class="dlg-head"><h2>Darba grafika imports — ${esc(P.name)}</h2><button type="button" class="ghost" data-close="schImpDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body">
        <p class="small muted" style="margin-top:0">Nolasītas lapas: ${[P.planSheet && `<b>${esc(P.planSheet)}</b>`, P.lesSheet && `<b>${esc(P.lesSheet)}</b>${P.year ? ` (${esc(P.year)} m. g.)` : ''}`].filter(Boolean).join(' un ')}. Failā atrasti ${P.events.length} notikumi. Rīkā paša izveidotie notikumi netiek mainīti.</p>
        <div class="imp-opts">
          ${P.planSheet ? `<label class="check"><input type="checkbox" data-impopt="plan" ${OPT.plan ? 'checked' : ''}> Darba plāns (pasākumi, semināri, metodiskais darbs)</label>` : ''}
          ${P.lesSheet ? `<label class="check"><input type="checkbox" data-impopt="les" ${OPT.les ? 'checked' : ''}> Nodarbību saraksts (regulārās nodarbības)</label>` : ''}
          <label class="check"><input type="checkbox" data-impopt="absent" ${OPT.absent ? 'checked' : ''}> Prombūtne (atvaļinājumi)</label>
          <label class="check"><input type="checkbox" data-impopt="past" ${OPT.past ? 'checked' : ''}> Arī pagājušie notikumi${D.pastN && !OPT.past ? ` <span class="muted">(${D.pastN} netiek importēti)</span>` : ''}</label></div>
        <div class="imp-sum"><span class="pill ok">＋ ${D.add.length} jauni</span><span class="pill warn">✎ ${D.chg.length} mainīti</span><span class="pill bad">✕ ${D.del.length} failā vairs nav</span><span class="pill">= ${D.same.length} bez izmaiņām</span></div>
        ${sec('Jauni', 'okc', D.add, (it, i) => row('add', i, it, `<b>${esc(it.e.title)}</b> ${tag(it.e)}${it.e.place ? ` <small class="muted">· ${esc(it.e.place)}</small>` : ''}`))}
        ${sec('Mainīti', 'warn', D.chg, (it, i) => row('chg', i, it, `<b>${esc(it.e.title)}</b> ${tag(it.e)} <small>${it.ch.map(f => `${FL[f]}: <s class="muted">${esc(String(it.x[f] ?? '') || '—').slice(0, 40)}</s> → ${esc(String(it.e[f] ?? '') || '—').slice(0, 40)}`).join('; ')}</small>${it.edited ? ' <span class="warn small">⚠ labots rīkā — tiks pārrakstīts</span>' : ''}`))}
        ${sec('Failā vairs nav — tiks noņemti no grafika', 'red', D.del, (it, i) => row('del', i, it, `<b>${esc(it.x.title)}</b> ${tag(it.x)}${it.edited ? ' <span class="warn small">⚠ labots rīkā</span>' : ''}`), ' <small class="muted">(piem., pārcelts uz citu datumu vai izdzēsts tabulā)</small>')}
        ${sec('Bez izmaiņām', 'same', D.same, e => `<div class="imp-row same"><span></span><span class="nowrap imp-when">${esc(when(e))}</span><span class="grow muted">${esc(e.title)}</span></div>`)}
        ${P.skipped.length ? `<details class="imp-sec"><summary><span class="muted">Izlaistas rindas (${P.skipped.length})</span></summary>${P.skipped.map(s => `<div class="small muted">rinda ${s.row}: ${esc(s.text)} — ${esc(s.why)}</div>`).join('')}</details>` : ''}
        ${!n ? `<p class="okc">✓ Grafiks jau atbilst failam — nekas nav jāmaina.</p>` : ''}
      </div>
      <footer class="dlg-foot"><span class="small muted">Pēc importa izmaiņas aiziet arī uz Google kalendāru, ja tas ir savienots.</span><span class="grow"></span><button type="button" data-close="schImpDialog">Atcelt</button><button class="mainbtn" data-act="schImpGo" ${n ? '' : 'disabled'}>Importēt (${n})</button></footer>`;
    if (!d.open) d.showModal();
  }
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset?.impopt) { OPT[t.dataset.impopt] = t.checked; draw(); }
    else if (t.dataset?.imp) { const [k, i] = t.dataset.imp.split('|'); D[k][Number(i)].on = t.checked; const n = ['add', 'chg', 'del'].reduce((a, k2) => a + D[k2].filter(x => x.on).length, 0); const b = document.querySelector('[data-act=schImpGo]'); if (b) { b.textContent = `Importēt (${n})`; b.disabled = !n; } }
  });
  A.schImpGo = () => {
    const now = U.now(), L = SC().list(), def = st().schDefaultRemind || [60, 1440]; let a = 0, c = 0, r = 0;
    const pick = e => Object.fromEntries(FIELDS.map(f => [f, e[f]]));
    for (const it of D.add) if (it.on) { L.push({ id: U.uid(), ...pick(it.e), remind: it.e.type === 'Prombūtne' ? [] : [...def], ikey: it.e.ikey, importedAt: now, createdAt: now, updatedAt: now }); a++; }
    for (const it of D.chg) if (it.on) { Object.assign(it.x, pick(it.e), { importedAt: now, updatedAt: now }); c++; }
    const gone = new Set(D.del.filter(x => x.on).map(x => x.x));
    for (const x of gone) if (x.gcalId) SC().delQ().push(x.gcalId);
    if (gone.size) { S.db.schedule = L.filter(x => !gone.has(x)); r = gone.size; }
    st().schImport = { name: P.name, at: now, n: SC().list().filter(e => e.ikey).length };
    U.$('schImpDialog').close();
    CP.store.changed(); SC().autoSync();
    ui.toast(`Grafiks atjaunināts no Excel: ${a} jauni, ${c} mainīti, ${r} noņemti`, 'ok', 7000);
  };

  /* --- Faila izvēle un ievilkšana --- */
  A.schImport = () => {
    if (!S.root) return CP.needRoot?.();
    let inp = U.$('schImpFile'); if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.id = 'schImpFile'; inp.accept = '.xlsx,.xlsm,application/vnd.ms-excel.sheet.macroEnabled.12,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; inp.hidden = true; document.body.appendChild(inp); inp.onchange = () => { const f = inp.files[0]; inp.value = ''; if (f) open(f); }; }
    inp.click();
  };
  const isXl = f => /\.(xlsx|xlsm)$/i.test(f?.name || '');
  const zone = e => S.page === 'schedule' && S.root && !U.qs('dialog[open]') ? e.target.closest?.('.page') : null;
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  document.addEventListener('dragover', e => { if (!hasFiles(e) || !zone(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; zone(e).classList.add('sch-over'); });
  document.addEventListener('dragleave', e => { if (!e.relatedTarget || !e.relatedTarget.closest?.('.page')) document.querySelectorAll('.sch-over').forEach(x => x.classList.remove('sch-over')); });
  document.addEventListener('drop', e => {
    if (!hasFiles(e) || !zone(e)) return; e.preventDefault(); document.querySelectorAll('.sch-over').forEach(x => x.classList.remove('sch-over'));
    const f = [...e.dataTransfer.files].find(isXl); if (!f) return ui.toast('Ievelc Excel failu (.xlsm vai .xlsx) ar darba uzskaiti', 'warn', 6000);
    open(f);
  });
  CP.schedImport = { parseFile, diff, open };
})(window.CP);
