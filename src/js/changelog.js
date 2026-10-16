/* =====================================================================
   Darbību žurnāls — kas, kad un kā mainīts, ar iespēju atjaunot iepriekšējo vērtību.
   • Darbojas automātiski: katrā saglabāšanā salīdzina datus ar iepriekšējo stāvokli (personas, dokumenti,
     ekipējums, pasākumi, nodarbības, grafiks, mācību gadi, uzdevumi, iestatījumi) un pieraksta izmaiņas: lauks, no → uz.
   • Glabājas datu failā (S.db.changelog) — tātad arī rezerves kopijās. Termiņš 12 mēneši, ne vairāk kā 8000 ierakstu.
   • Dzēšot personu neatgriezeniski (“Dzēst reģistra ierakstu”), arī viņas ieraksti žurnālā tiek izdzēsti.
   • Atjaunošana: lauka vērtība atpakaļ / dzēsts ieraksts atpakaļ / nejauši izveidots ieraksts prom. Pati atjaunošana arī nonāk žurnālā.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const ic = (n, f = '') => CP.ic(n, f);
  const MAX = 8000, KEEP_MS = 365 * 864e5, BIG = 6000;
  const pName = id => { const p = D.person(id); return p ? U.full(p) : ''; };
  const dd = d => d ? U.fmtDate(String(d).slice(0, 10)) : '';
  /* Ko seko un kā to nosauc */
  const T = {
    people: { l: 'Persona', g: 'people', pid: o => o.id, name: o => U.full(o) || 'persona', skip: ['updatedAt', 'createdAt'] },
    documents: { l: 'Dokuments', g: 'docs', pid: o => o.personId, name: o => [o.kind, pName(o.personId)].filter(Boolean).join(' — '), skip: ['addedAt'] },
    equipment: { l: 'Ekipējums', g: 'eq', pid: o => o.personId, name: o => [o.item, pName(o.personId)].filter(Boolean).join(' — '), skip: ['changedAt'] },
    events: { l: 'Pasākums', g: 'events', name: o => [o.title || 'pasākums', dd(o.date || o.from)].filter(Boolean).join(' · '), skip: ['updatedAt'] },
    sessions: { l: 'Nodarbība', g: 'att', name: o => [dd(o.date), o.topic || o.type || 'nodarbība', o.group && o.group !== '*' ? o.group : ''].filter(Boolean).join(' · '), skip: [] },
    schedule: { l: 'Grafiks', g: 'sched', name: o => [o.title || 'notikums', dd(o.date)].filter(Boolean).join(' · '), skip: ['gcalId', 'gsig', 'importedAt'] },
    enrollments: { l: 'Mācību gada dalība', g: 'people', pid: o => o.personId, name: o => [pName(o.personId), U.yearLabel?.(o.yearId) || o.yearId].filter(Boolean).join(' — '), skip: [] },
    years: { l: 'Mācību gads', g: 'settings', name: o => o.label || U.yearLabel?.(o.id) || o.id, skip: [] },
    sources: { l: 'Papildu mape', g: 'settings', name: o => o.name || o.id, skip: [] },
    tasks: { l: 'Uzdevums', g: 'people', pid: o => o.personId, name: o => [String(o.text || o.title || 'uzdevums').slice(0, 60), pName(o.personId)].filter(Boolean).join(' — '), skip: [] },
    relations: { l: 'Saistība', g: 'people', pid: o => o.a, name: o => [pName(o.a), pName(o.b)].filter(Boolean).join(' ↔ '), skip: [] }
  };
  const SET_SKIP = new Set(['lastVisit', 'activeYear', 'stickyGroup', 'look', 'activeTemplate']);
  const GROUPS = [['all', 'Viss'], ['people', 'Personas'], ['docs', 'Dokumenti'], ['eq', 'Ekipējums'], ['events', 'Pasākumi'], ['att', 'Apmeklējums'], ['sched', 'Grafiks'], ['settings', 'Iestatījumi']];
  const SENS = new Set(['personalCode', 'parentCode', 'googleKey']);
  const SEC = { parent: 'Vecāks', parent2: 'Otrs vecāks', emergency: 'Ārkārtas kontakts' };
  const KL = {
    noteLog: 'Piezīmes', contracts: 'Līgumi', quals: 'Kvalifikācijas', incidents: 'Uzvedības ieraksti', reg: 'Reģistri', dvs: 'DVS', idcard: 'Apliecība', left: 'Izstāšanās datums', reason: 'Iemesls',
    folder: 'Mape', date: 'Datums', endDate: 'Beigu datums', from: 'No', to: 'Līdz', title: 'Nosaukums', type: 'Veids', place: 'Vieta', start: 'Sākums', end: 'Beigas', notes: 'Piezīmes', topic: 'Tēma',
    att: 'Apmeklējums', kind: 'Veids', path: 'Fails', sourceId: 'Mape', item: 'Priekšmets', size: 'Izmērs', qty: 'Skaits', issued: 'Izsniegts', returned: 'Atdots', returnNote: 'Atdošanas piezīme', group: 'Grupa', status: 'Statuss',
    participants: 'Dalībnieki', staff: 'Darbinieki', external: 'Citu vienību dalībnieki', extStaff: 'Citu vienību darbinieki', remind: 'Atgādinājumi', allDay: 'Visu dienu', seriesId: 'Sērija', issuedAt: 'Izdots', validTo: 'Derīgs līdz',
    yearId: 'Mācību gads', personId: 'Persona', text: 'Teksts', due: 'Termiņš', done: 'Izpildīts', name: 'Nosaukums', label: 'Nosaukums',
    groups: 'Grupas', groupDays: 'Grupu nodarbību dienas', docKinds: 'Dokumentu veidi', requiredDocs: 'Obligātie dokumenti', retentionDefault: 'Glabāšanas termiņš', autosave: 'Automātiskā saglabāšana', staff_s: 'Darbinieki',
    templates: 'Ziņu veidnes', tools: 'Rīki', gcal: 'Google kalendārs', notify: 'Paziņojumi', ocr: 'Teksta atpazīšana', quals_s: 'Kvalifikāciju saraksts', absenceStreak: 'Kavējumu brīdinājums', docValidity: 'Dokumentu derīgums',
    formDefaults: 'Veidlapu noklusējumi', formTemplates: 'Veidlapu veidnes', docTemplates: 'Dokumentu veidnes', contactOrg: 'Kontaktu organizācija', countryCode: 'Valsts kods', waMode: 'WhatsApp režīms', schDefaultRemind: 'Noklusējuma atgādinājumi'
  };
  function label(coll, k) {
    if (coll === 'people' && CP.FIELD?.[k]) { const f = CP.FIELD[k]; return (SEC[f.s] ? SEC[f.s] + ': ' : '') + f.l.replace(/^Jauna piezīme.*/, 'Piezīme'); }
    if (coll === 'settings') return KL[k + '_s'] || KL[k] || k;
    return KL[k] || k;
  }
  /* --- Stāvokļa momentuzņēmums --- */
  const clean = (coll, o) => { const sk = T[coll].skip, x = {}; for (const k of Object.keys(o).sort()) if (!sk.includes(k) && !k.startsWith('_')) x[k] = o[k]; return x; };
  let base = null;   // { ref, colls: { coll: Map(id → json) }, settings: Map(k → json) }
  function snap(db) {
    const colls = {};
    for (const c of Object.keys(T)) { const m = new Map(); for (const o of db[c] || []) if (o && o.id) m.set(o.id, JSON.stringify(clean(c, o))); colls[c] = m; }
    const st = new Map(); for (const [k, v] of Object.entries(db.settings || {})) if (!SET_SKIP.has(k)) st.set(k, JSON.stringify(k === 'gcal' && v ? { ...v, lastSync: undefined } : v));
    return { ref: db, colls, settings: st };
  }
  const rebase = () => { if (S.db) base = snap(S.db); };
  let undoTag = null;   // { of: entry id } — nākamā saglabāšana ir atjaunošana
  /** Saglabāšanas brīdī: pieraksta izmaiņas kopš pēdējā stāvokļa */
  function capture(db) {
    if (!db) return;
    if (!base || base.ref !== db) { base = snap(db); return; }
    const now = snap(db), at = U.now(), batch = U.uid().slice(0, 8), out = [];
    const push = e => out.push({ id: U.uid(), at, b: batch, ...e, ...(undoTag ? { undo: undoTag.of } : {}) });
    for (const c of Object.keys(T)) {
      const a = base.colls[c], b = now.colls[c], t = T[c];
      for (const [id, js] of b) {
        const old = a.get(id);
        if (old === js) continue;
        const o = JSON.parse(js);
        if (old === undefined) { push({ c, eid: id, pid: t.pid?.(o) || null, n: t.name(o), op: 'add' }); continue; }
        const p = JSON.parse(old), ch = [];
        for (const k of new Set([...Object.keys(p), ...Object.keys(o)])) {
          const f = JSON.stringify(p[k]), to = JSON.stringify(o[k]);
          if (f === to) continue;
          ch.push((f || '').length + (to || '').length > BIG ? { k, big: 1, sf: summary(p[k]), st: summary(o[k]) } : { k, f: p[k], t: o[k] });
        }
        if (ch.length) push({ c, eid: id, pid: t.pid?.(o) || null, n: t.name(o), op: 'edit', ch });
      }
      for (const [id, js] of a) if (!b.has(id)) {
        const o = JSON.parse(js);
        push({ c, eid: id, pid: t.pid?.(o) || null, n: t.name(o), op: 'del', ...(js.length <= BIG * 4 ? { obj: o } : {}) });
      }
    }
    // iestatījumi
    const ch = [];
    for (const k of new Set([...base.settings.keys(), ...now.settings.keys()])) {
      const f = base.settings.get(k), to = now.settings.get(k); if (f === to) continue;
      const fv = f === undefined ? undefined : JSON.parse(f), tv = to === undefined ? undefined : JSON.parse(to);
      ch.push((f || '').length + (to || '').length > BIG ? { k, big: 1, sf: summary(fv), st: summary(tv) } : { k, f: fv, t: tv });
    }
    if (ch.length) push({ c: 'settings', eid: 'settings', pid: null, n: 'Iestatījumi', op: 'edit', ch });
    base = now; undoTag = null;
    if (!out.length) return;
    const log = db.changelog = Array.isArray(db.changelog) ? db.changelog : [];
    log.push(...out);
    const cut = new Date(Date.now() - KEEP_MS).toISOString();
    let i = 0; while (i < log.length && (log.length - i > MAX || String(log[i].at) < cut)) i++;
    if (i) log.splice(0, i);
  }
  /** Neatgriezeniska personas dzēšana: izdzēš arī viņas ierakstus žurnālā un neieraksta dzēsto saturu */
  function forget(pid) {
    if (!S.db) return;
    // citu ierakstu vērtībās (apmeklējuma atzīmes, dalībnieku saraksti) izņem šīs personas id
    const scrub = v => Array.isArray(v) ? v.filter(x => x !== pid && !(x && typeof x === 'object' && (x.id === pid || x.personId === pid))).map(scrub)
      : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k, x]) => k !== pid && x !== pid).map(([k, x]) => [k, scrub(x)])) : v;
    S.db.changelog = (S.db.changelog || []).filter(e => e.pid !== pid && e.eid !== pid && !(e.c === 'relations' && JSON.stringify(e).includes(pid)))
      .map(e => JSON.stringify(e).includes(pid) ? { ...e, ch: e.ch && scrub(e.ch), obj: e.obj && scrub(e.obj) } : e);
    S.db.enrollments = (S.db.enrollments || []).filter(x => x.personId !== pid);   // dalība mācību gados — arī prom
    if (base) for (const c of Object.keys(T)) for (const [id, js] of [...base.colls[c]]) {
      try {
        const o = JSON.parse(js); if (!(id === pid || T[c].pid?.(o) === pid || o.b === pid)) continue;
        const cur = (S.db[c] || []).find(x => x.id === id);
        if (cur) base.colls[c].set(id, JSON.stringify(clean(c, cur))); else base.colls[c].delete(id);
      } catch (e) { }
    }
  }

  /* --- Vērtību rādīšana --- */
  function summary(v) {
    if (v === undefined || v === null || v === '') return '—';
    if (Array.isArray(v)) return v.length ? `${v.length} ${v.length === 1 ? 'ieraksts' : 'ieraksti'}` : 'tukšs';
    if (typeof v === 'object') return `${Object.keys(v).length} vērtības`;
    return String(v);
  }
  function show(c, k, v) {
    if (v === undefined || v === null || v === '') return '<span class="muted">—</span>';
    if (SENS.has(k)) return '<span class="muted">•••••• (paslēpts)</span>';
    if (typeof v === 'boolean') return v ? 'jā' : 'nē';
    if (c === 'people' && CP.FIELD?.[k]?.opts) { const o = CP.FIELD[k].opts.find(x => x[0] === v); if (o) return esc(o[1]); }
    if (k === 'status' && c === 'people') return esc({ archived: 'Arhīvā', active: 'Jaunsargs', candidate: 'Kandidāts', paused: 'Pārtraukts' }[v] || v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return esc(U.fmtDate(v));
    if (typeof v === 'object') return esc(summary(v));
    const s = String(v); return esc(s.length > 90 ? s.slice(0, 88) + '…' : s);
  }
  function chHtml(e, c) {
    if (c.k === 'att' && !c.big && c.f && c.t && typeof c.f === 'object') {   // apmeklējums — cik atzīmju mainīts
      const ks = new Set([...Object.keys(c.f), ...Object.keys(c.t)]); let n = 0, names = [];
      for (const k of ks) if (c.f[k] !== c.t[k]) { n++; if (names.length < 4) names.push(`${esc(pName(k) || '?')}: ${esc(c.f[k] || '—')} → ${esc(c.t[k] || '—')}`); }
      return `<li><b>Apmeklējums</b>: ${n} ${n === 1 ? 'atzīme' : 'atzīmes'}${names.length ? ` <span class="small muted">(${names.join('; ')}${n > names.length ? '; …' : ''})</span>` : ''}</li>`;
    }
    if (c.big) return `<li><b>${esc(label(e.c, c.k))}</b>: ${esc(c.sf)} → ${esc(c.st)}</li>`;
    if (Array.isArray(c.f) || Array.isArray(c.t)) {
      const a = Array.isArray(c.f) ? c.f.length : 0, b = Array.isArray(c.t) ? c.t.length : 0;
      return `<li><b>${esc(label(e.c, c.k))}</b>: ${b > a ? `pievienots ${b - a}` : b < a ? `noņemts ${a - b}` : 'mainīts'} <span class="small muted">(${a} → ${b})</span></li>`;
    }
    return `<li><b>${esc(label(e.c, c.k))}</b>: ${show(e.c, c.k, c.f)} <span class="arrow">→</span> ${show(e.c, c.k, c.t)}</li>`;
  }
  const OPL = { add: ['izveidots', 'ok'], edit: ['mainīts', 'edit'], del: ['dzēsts', 'del'] };

  /* --- Atjaunošana --- */
  const list = () => S.db?.changelog || [];
  const coll = c => S.db[c] || (S.db[c] = []);
  function canUndo(e) {
    if (e.undone) return false;
    if (e.op === 'edit') return e.ch.some(c => !c.big);
    if (e.op === 'del') return !!e.obj && !(coll(e.c).some(o => o.id === e.eid));
    if (e.op === 'add') return e.c !== 'people' && e.c !== 'years' && coll(e.c).some(o => o.id === e.eid);
    return false;
  }
  A.clUndo = id => {
    const e = list().find(x => x.id === id); if (!e || !canUndo(e)) return ui.toast('Šo izmaiņu vairs nevar atjaunot', 'warn');
    if (e.op === 'edit') {
      const tgt = e.c === 'settings' ? S.db.settings : coll(e.c).find(o => o.id === e.eid);
      if (!tgt) return ui.toast('Ieraksts vairs nepastāv — vērtību nevar atjaunot', 'warn');
      const chs = e.ch.filter(c => !c.big), later = chs.filter(c => JSON.stringify(tgt[c.k]) !== JSON.stringify(c.t));
      if (!confirm(`Atjaunot iepriekšējo vērtību — ${e.n}?\n\n${chs.map(c => `${label(e.c, c.k)}: ${SENS.has(c.k) ? '(paslēpts)' : summary(c.f)}`).join('\n')}` + (later.length ? `\n\nUzmanību: ${later.map(c => label(e.c, c.k)).join(', ')} kopš tā laika mainīts vēlreiz — pašreizējā vērtība tiks aizstāta.` : ''))) return;
      for (const c of chs) { if (c.f === undefined) delete tgt[c.k]; else tgt[c.k] = JSON.parse(JSON.stringify(c.f)); }
      if (e.c === 'people') tgt.updatedAt = U.now();
    } else if (e.op === 'del') {
      if (!confirm(`Atjaunot dzēsto ierakstu — ${T[e.c]?.l || ''}: ${e.n}?`)) return;
      coll(e.c).push(JSON.parse(JSON.stringify(e.obj)));
    } else if (e.op === 'add') {
      if (!confirm(`Noņemt izveidoto ierakstu — ${T[e.c]?.l || ''}: ${e.n}?`)) return;
      S.db[e.c] = coll(e.c).filter(o => o.id !== e.eid);
    }
    e.undone = U.now(); undoTag = { of: e.id };
    CP.store.changed(); ui.toast('↶ Atjaunots. Arī šī darbība ir pierakstīta žurnālā.', 'ok', 5000);
  };

  /* --- Lapa “Darbību žurnāls” --- */
  const F = { g: 'all', q: '', pid: '', days: 30, n: 150 };
  A.clFilter = g => { F.g = g; F.n = 150; CP.render(); };
  A.clDays = d => { F.days = +d; F.n = 150; CP.render(); };
  A.clMore = () => { F.n += 300; CP.render(); };
  A.clPerson = pid => { F.pid = pid || ''; F.g = 'all'; F.q = ''; F.days = 0; F.n = 150; CP.ui.go('changes'); };
  CP.inputHandlers = CP.inputHandlers || [];
  document.addEventListener('input', e => { if (e.target.id === 'clQ') { F.q = e.target.value; F.n = 150; clearTimeout(qT); qT = setTimeout(() => { const el = U.$('clList'); if (el) el.innerHTML = rows(); }, 200); } });
  let qT = 0;
  document.addEventListener('change', e => { if (e.target.id === 'clDays') A.clDays(e.target.value); });
  function filtered() {
    const cut = F.days ? new Date(Date.now() - F.days * 864e5).toISOString() : '', q = U.norm(F.q || '');
    return list().filter(e => (!cut || e.at >= cut) && (F.g === 'all' || (e.c === 'settings' ? 'settings' : T[e.c]?.g) === F.g) && (!F.pid || e.pid === F.pid) &&
      (!q || U.norm(`${e.n} ${T[e.c]?.l || ''} ${(e.ch || []).map(c => label(e.c, c.k)).join(' ')}`).includes(q))).reverse();
  }
  function entryHtml(e) {
    const [ol, oc] = OPL[e.op] || [e.op, ''], t = e.c === 'settings' ? 'Iestatījumi' : T[e.c]?.l || e.c;
    const nm = e.pid && D.person(e.pid) ? `<a href="#" data-person="${e.pid}">${esc(e.n)}</a>` : esc(e.n);
    const undoBtn = canUndo(e) ? `<button class="sm ghost" data-act="clUndo" data-arg="${e.id}" title="${e.op === 'add' ? 'Noņemt šo ierakstu' : 'Atjaunot iepriekšējo'}">↶ ${e.op === 'add' ? 'Atsaukt' : 'Atjaunot'}</button>` : e.undone ? `<span class="small muted">atjaunots ${esc(U.fmtDateTime(e.undone))}</span>` : '';
    return `<div class="cl-row"><span class="cl-time small muted">${esc(new Date(e.at).toTimeString().slice(0, 5))}</span>
      <div class="grow cl-body"><div class="cl-head">${e.c === 'settings' ? '' : `<span class="cl-type">${esc(t)}</span>`}<b>${nm}</b><span class="cl-op ${oc}">${ol}</span>${e.undo ? '<span class="cl-op undo">↶ atjaunošana</span>' : ''}</div>
        ${e.op === 'edit' && e.ch?.length ? `<ul class="cl-ch">${e.ch.slice(0, 12).map(c => chHtml(e, c)).join('')}${e.ch.length > 12 ? `<li class="muted">… vēl ${e.ch.length - 12}</li>` : ''}</ul>` : ''}</div>
      <div class="cl-act">${undoBtn}</div></div>`;
  }
  function rows() {
    const all = filtered(), items = all.slice(0, F.n);
    if (!items.length) return `<p class="muted">${list().length ? 'Nav ierakstu ar šiem filtriem.' : 'Žurnāls sāks pildīties ar nākamo izmaiņu. Tiek pierakstīts viss, kas mainās datos.'}</p>`;
    let day = '', h = '';
    for (const e of items) { const d = String(e.at).slice(0, 10); if (d !== day) { day = d; h += `<h4 class="cl-day">${esc(new Date(e.at).toLocaleDateString('lv-LV', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</h4>`; } h += entryHtml(e); }
    return h + (all.length > items.length ? `<div class="actions" style="justify-content:center"><button data-act="clMore">Rādīt vairāk (${all.length - items.length})</button></div>` : '');
  }
  CP.pages.changes = {
    render() {
      const chip = ([k, l]) => `<button class="chipbtn ${F.g === k ? 'on' : ''}" data-act="clFilter" data-arg="${k}">${l}</button>`;
      const per = [[7, '7 dienas'], [30, '30 dienas'], [90, '3 mēneši'], [0, 'Viss']];
      return `<div class="page">${ui.pageHead('Darbību žurnāls', 'Kas, kad un kā mainīts datos. Iepriekšējo vērtību var atjaunot.', '')}
        <section class="card"><div class="cl-filters"><div class="chips">${GROUPS.map(chip).join('')}</div>
          <div class="cl-f2"><input id="clQ" type="search" placeholder="Meklēt žurnālā (vārds, lauks…)" value="${esc(F.q)}" autocomplete="off">
            <select id="clDays" aria-label="Periods">${per.map(([v, l]) => `<option value="${v}" ${F.days === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          ${F.pid ? `<div class="chips"><span class="chipbtn on">Persona: ${esc(pName(F.pid) || '?')}</span><button class="sm ghost" data-act="clPerson" data-arg="">✕ visas personas</button></div>` : ''}</div>
          <div id="clList" class="cl-list">${rows()}</div>
          <p class="small muted" style="margin-top:14px">Žurnāls glabājas datu failā un rezerves kopijās, ne ilgāk par 12 mēnešiem. Personas kodi žurnālā netiek rādīti. Dzēšot personu neatgriezeniski, tiek dzēsti arī viņas ieraksti žurnālā.</p></section></div>`;
    }
  };
  /** Pārskatam: pēdējie ieraksti */
  function recentHtml(n = 10) {
    const items = list().slice(-n).reverse();
    if (!items.length) return '';
    return items.map(e => {
      const [ol] = OPL[e.op] || [e.op];
      const nm = e.pid && D.person(e.pid) ? `<a href="#" data-person="${e.pid}">${esc(e.n)}</a>` : esc(e.n);
      const what = e.op === 'edit' && e.ch?.length ? ': ' + esc(e.ch.slice(0, 3).map(c => label(e.c, c.k)).join(', ')) + (e.ch.length > 3 ? '…' : '') : '';
      return `<div class="row"><span class="muted small nowrap">${U.fmtDateTime(e.at)}</span><div class="grow"><span class="small muted">${esc(e.c === 'settings' ? 'Iestatījumi' : T[e.c]?.l || '')}</span> ${nm} — ${ol}${what}${e.undo ? ' <span class="small muted">(atjaunošana)</span>' : ''}</div></div>`;
    }).join('');
  }

  CP.afterRootLoad = CP.afterRootLoad || []; CP.afterRootLoad.unshift(rebase);
  CP.changelog = { capture, forget, rebase, recentHtml, list, T, label };
})(window.CP);
