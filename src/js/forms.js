/* =====================================================================
   Veidlapas: drošības instruktāžas lapa un nometnes žurnāls.
   - Pasākums (S.db.events) glabā nosaukumu, laikus, dalībniekus, darbiniekus, audzinātājus.
   - Dalībnieku izvēle: meklēšana, grupa, “atzīmēt redzamos”, atsevišķi.
   - Brīdinājums (tikai rīkā): trūkst/nederīga anketa, līgums, ārsta izziņa. Pievienot drīkst.
   - Rezultāts: PDF (rīka veidne) vai aizpildīts Word (lietotāja veidne ar {atzīmēm}).
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const ic = (n, f = '') => CP.ic(n, f);
  const TYPES = { instr: { l: 'Drošības instruktāžas lapa', short: 'Instruktāža', icon: 'clipboard' }, camp: { l: 'Nometnes žurnāls', short: 'Nometne', icon: 'users' } };
  CP.FORM_TYPES = TYPES;
  const st = () => S.db.settings;
  const staffList = () => st().staff || [];
  const staffById = id => staffList().find(s => s.id === id);

  /** Dokumentu problēmas dalībai pasākumā (tikai rīkā, nevis uz veidlapas) */
  D.eventDocIssues = p => D.missingDocs(p);
  const MONTHS_GEN = ['janvāris', 'februāris', 'marts', 'aprīlis', 'maijs', 'jūnijs', 'jūlijs', 'augusts', 'septembris', 'oktobris', 'novembris', 'decembris'];
  /** “2026. gada 17.–18. oktobris” no datumiem */
  function whenText(from, to) {
    const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(from || ''); if (!a) return '';
    const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(to || '') || a;
    const [, y1, m1, d1] = a, [, y2, m2, d2] = b;
    if (from === to || !to) return `${y1}. gada ${+d1}. ${MONTHS_GEN[m1 - 1]}`;
    if (y1 === y2 && m1 === m2) return `${y1}. gada ${+d1}.–${+d2}. ${MONTHS_GEN[m1 - 1]}`;
    if (y1 === y2) return `${y1}. gada ${+d1}. ${MONTHS_GEN[m1 - 1]} – ${+d2}. ${MONTHS_GEN[m2 - 1]}`;
    return `${y1}. gada ${+d1}. ${MONTHS_GEN[m1 - 1]} – ${y2}. gada ${+d2}. ${MONTHS_GEN[m2 - 1]}`;
  }

  /* ---------------- Saraksts ---------------- */
  const evPeople = ev => (ev.participants || []).map(x => D.person(x.pid)).filter(Boolean);
  /* Visas sagatavotās veidlapas vienā sarakstā: pasākumi (instruktāža, nometne) + līgumi no personu kartītēm */
  const KIND = { instr: { l: 'Instruktāža', icon: 'clipboard' }, camp: { l: 'Nometne', icon: 'users' }, contract: { l: 'Līgums', icon: 'file' } };
  const CVAR = { 'jaunietis-papirs': 'ar jaunieti, papīrs', 'parstavis-papirs': 'ar pārstāvi, papīrs', 'jaunietis-edoc': 'ar jaunieti, EDOC', 'parstavis-edoc': 'ar pārstāvi, EDOC' };
  function allItems() {
    const out = [];
    for (const ev of S.db.events || []) {
      const ps = evPeople(ev);
      out.push({ kind: ev.type === 'camp' ? 'camp' : 'instr', id: ev.id, date: String(ev.dateFrom || ev.instrDate || ev.createdAt || '').slice(0, 10), title: ev.title || '(bez nosaukuma)', ev, ps,
        hay: U.norm([ev.title, ev.when, ev.group, ...ps.map(U.full)].join(' ')) });
    }
    for (const p of S.db.people || []) for (const c of p.contracts || []) {
      out.push({ kind: 'contract', id: c.id, date: String(c.date || c.at || '').slice(0, 10), title: `Līgums ${c.no ? 'Nr. ' + c.no : '(bez numura)'}`, p, c,
        hay: U.norm([U.full(p), U.sortName(p), c.no, D.groupOf(p)].join(' ')) });
    }
    return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }
  let showN = 40;
  CP.pages.forms = {
    render() {
      const F = S.formFilter || (S.formFilter = { kind: '', q: '', from: '', to: '', year: '' });
      const all = allItems(), [yf, yt] = F.year ? U.yearSpan(F.year) : ['', ''];
      const base = all.filter(x => (!F.q || x.hay.includes(U.norm(F.q))) && (!F.from || x.date >= F.from) && (!F.to || x.date <= F.to) && (!F.year || (x.date >= yf && x.date <= yt)));
      const list = base.filter(x => !F.kind || x.kind === F.kind);
      const cnt = k => base.filter(x => x.kind === k).length;
      const chip = (k, l) => `<button class="chipbtn ${F.kind === k ? 'on' : ''}" data-act="ffKind" data-arg="${k}">${l} <small>${k ? cnt(k) : base.length}</small></button>`;
      const years = [...new Set(all.map(x => /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? U.schoolYear(x.date + 'T12:00:00') : '').filter(y => /^\d{4}-\d{4}$/.test(y)))].sort().reverse();
      const row = x => {
        const K = KIND[x.kind];
        if (x.kind === 'contract') {
          const { p, c } = x;
          return `<div class="row ev-row"><span class="feat-ic">${ic(K.icon)}</span><div class="grow"><b>${esc(x.title)}</b> <span class="tag">${K.l}</span>
            <div class="small muted"><a href="#" data-person="${p.id}">${esc(U.full(p))}</a> · ${esc(U.fmtDate(x.date))} · ${esc(CVAR[`${c.kind}-${c.form}`] || '')}</div></div>
            ${c.path ? `<button class="sm" data-act="contractView" data-arg="${p.id}|${c.id}">${ic('file', '📄')} Skatīt / drukāt</button><button class="sm ghost" data-act="contractOpen" data-arg="${p.id}|${c.id}" title="Lejupielādēt Word failu">${ic('download', '⬇')} Word</button>` : ''}
            <button class="sm ghost danger" data-act="contractDel" data-arg="${p.id}|${c.id}" title="Noņemt no saraksta">✕</button></div>`;
        }
        const ev = x.ev, ps = x.ps, warn = ps.filter(q => D.eventDocIssues(q).length).length;
        return `<div class="row ev-row"><span class="feat-ic">${ic(K.icon)}</span><div class="grow"><b>${esc(x.title)}</b> <span class="tag">${K.l}</span>
          <div class="small muted">${esc(ev.when || U.fmtDate(ev.instrDate) || '')} · ${ps.length} dalībnieki${warn ? ` · <span class="warn">⚠ ${warn} bez dokumentiem</span>` : ''}</div></div>
          <button class="sm" data-act="formOpen" data-arg="${ev.id}">${ic('edit', '✎')} Atvērt</button><button class="sm" data-act="formPdf" data-arg="${ev.id}">${ic('file', '📄')} PDF</button><button class="sm ghost" data-act="formPrint" data-arg="${ev.id}">Drukāt</button>
          <button class="sm ghost danger" data-act="formDelete" data-arg="${ev.id}" title="Dzēst pasākumu">✕</button></div>`;
      };
      const filtered = F.kind || F.q || F.from || F.to || F.year;
      const filters = `<div class="ff-bar">
          <input type="search" id="ffQ" placeholder="Meklēt: persona, nosaukums, līguma nr…" value="${esc(F.q)}" autocomplete="off">
          <label class="small muted">No <input type="date" data-ff="from" value="${esc(F.from)}"></label><label class="small muted">Līdz <input type="date" data-ff="to" value="${esc(F.to)}"></label>
          <select data-ff="year"><option value="">Visi mācību gadi</option>${years.map(y => `<option value="${y}" ${F.year === y ? 'selected' : ''}>${esc(U.yearLabel(y))}</option>`).join('')}</select>
          ${filtered ? `<button class="sm ghost" data-act="ffClear">Notīrīt filtrus</button>` : ''}</div>
        <div class="chips" style="margin:8px 0 4px">${chip('', 'Visi')}${chip('instr', 'Instruktāžas')}${chip('camp', 'Nometnes')}${chip('contract', 'Līgumi')}</div>`;
      const body = all.length ? (list.length ? list.slice(0, showN).map(row).join('') + (list.length > showN ? `<div class="actions" style="margin-top:8px"><button class="sm" data-act="ffMore">Rādīt vēl (${list.length - showN})</button></div>` : '') : '<p class="muted pad">Nekas neatbilst filtram.</p>')
        : ui.empty('Vēl nav sagatavotu veidlapu. Sāc ar “Instruktāžas lapa”, “Nometnes žurnāls” vai “Līgums”.');
      return `<div class="page">${ui.pageHead('Veidlapas', 'Instruktāžas lapas, nometņu žurnāli un līgumi no kartīšu datiem', `<button class="mainbtn" data-act="formNew" data-arg="instr">${ic('plus', '＋')} Instruktāžas lapa</button><button data-act="formNew" data-arg="camp">${ic('plus', '＋')} Nometnes žurnāls</button><button data-act="contractNew">${ic('plus', '＋')} Līgums</button>`)}
        <div class="cards2">
          <section class="card wide"><h3>${ic('clipboard')}Sagatavotās veidlapas <span class="pill">${list.length}${list.length !== all.length ? ' no ' + all.length : ''}</span></h3>${all.length ? filters : ''}<div class="ev-list-all">${body}</div></section>
          <section class="card"><h3>${ic('users')}Darbinieki un audzinātāji</h3>${staffCard()}</section>
          <section class="card"><h3>${ic('file')}Savas Word veidnes</h3>${tplCard()}</section>
        </div></div>`;
    }
  };
  A.ffKind = k => { S.formFilter.kind = k || ''; showN = 40; CP.render(); };
  A.ffClear = () => { S.formFilter = { kind: '', q: '', from: '', to: '', year: '' }; showN = 40; CP.render(); };
  A.ffMore = () => { showN += 40; renderKeepScroll(); };
  CP.inputHandlers.push(e => { if (e.target.id !== 'ffQ' || S.page !== 'forms') return false; S.formFilter.q = e.target.value; showN = 40; renderKeepFocus('ffQ'); return true; });
  CP.changeHandlers.push(e => { const k = e.target.dataset?.ff; if (!k || S.page !== 'forms') return false; S.formFilter[k] = e.target.value; showN = 40; setTimeout(() => CP.render(), 0); return true; });

  /* ---------------- Darbinieku saraksts (saglabājas, var dzēst) ---------------- */
  function staffCard() {
    const list = staffList();
    return `${list.length ? list.map(s => `<div class="row"><div class="grow"><b>${esc(s.name)}</b><div class="small muted">${esc([s.role, s.phone && U.prettyPhone(s.phone), s.counselor ? 'audzinātājs' : ''].filter(Boolean).join(' · '))}</div></div>
      <button class="sm ghost" data-act="staffEdit" data-arg="${s.id}">${ic('edit', '✎')}</button><button class="sm ghost danger" data-act="staffDelete" data-arg="${s.id}" title="Dzēst">✕</button></div>`).join('') : '<p class="muted small">Saraksts ir tukšs. Darbiniekus un audzinātājus ievadi vienreiz — nākamajās nometnēs tie būs izvēlami.</p>'}
      <div class="actions" style="margin-top:10px"><button class="sm" data-act="staffEdit">${ic('userPlus', '＋')} Pievienot</button></div>`;
  }
  A.staffEdit = id => {
    const s = staffById(id) || {}, f = U.$('staffForm');
    f.reset(); f.dataset.id = s.id || '';
    for (const k of ['name', 'personalCode', 'role', 'address', 'phone']) f.elements[k].value = s[k] || '';
    f.elements.counselor.checked = !!s.counselor;
    U.$('staffTitle').textContent = s.id ? 'Labot darbinieku' : 'Jauns darbinieks / audzinātājs';
    U.$('staffDialog').showModal(); f.elements.name.focus();
  };
  U.$('staffForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target, o = Object.fromEntries(new FormData(f)); for (const k in o) o[k] = String(o[k]).trim();
    o.counselor = f.elements.counselor.checked;
    if (!o.name) return;
    const list = st().staff = staffList();
    if (f.dataset.id) Object.assign(list.find(s => s.id === f.dataset.id), o);
    else { const ns = { id: U.uid(), ...o }; list.push(ns); if (S.formEdit && S.formEdit.type === 'camp') S.formEdit.staff = [...new Set([...(S.formEdit.staff || []), ns.id])]; }
    U.$('staffDialog').close(); CP.store.changed();
  });
  A.staffDelete = id => {
    const s = staffById(id); if (!s || !confirm(`Dzēst “${s.name}” no darbinieku saraksta?\n\nJau sagatavotos pasākumos vārds paliek tikai tad, ja PDF jau ir saglabāts.`)) return;
    st().staff = staffList().filter(x => x.id !== id);
    if (S.formEdit) { S.formEdit.staff = (S.formEdit.staff || []).filter(x => x !== id); if (S.formEdit.leaderId === id) S.formEdit.leaderId = ''; }
    CP.store.changed();
  };

  /* ---------------- Savas Word veidnes ---------------- */
  function tplCard() {
    const list = st().docTemplates || [];
    return `<p class="small muted" style="margin-top:0">Ielādē savu Word veidni ar atzīmēm, piem. <code>{nosaukums}</code>, <code>{datums}</code>, un tabulas rindu ar <code>{nr}</code> <code>{vards}</code>. Rīks to aizpildīs. Paraugus vari lejupielādēt un pielāgot.</p>
      ${list.map(t => `<div class="row"><div class="grow"><b>${esc(t.name)}</b><div class="small muted">${esc(t.type === 'contract' ? 'Līgums' : TYPES[t.type]?.l || '')}</div></div><button class="sm ghost danger" data-act="tplDocDelete" data-arg="${t.id}" title="Noņemt">✕</button></div>`).join('')}
      <div class="actions" style="margin-top:10px">
        <button class="sm" data-act="tplDocAdd" data-arg="instr">${ic('upload', '⬆')} Instruktāžas veidne</button><button class="sm" data-act="tplDocAdd" data-arg="camp">${ic('upload', '⬆')} Nometnes veidne</button><button class="sm" data-act="tplDocAdd" data-arg="contract">${ic('upload', '⬆')} Līguma veidne</button>
        <button class="sm ghost" data-act="tplDocSample" data-arg="instr">${ic('download', '⬇')} Paraugs: instruktāža</button><button class="sm ghost" data-act="tplDocSample" data-arg="camp">${ic('download', '⬇')} Paraugs: nometne</button><button class="sm ghost" data-act="tplDocSample" data-arg="contract">${ic('download', '⬇')} Paraugs: līgums</button></div>
      <details class="small" style="margin-top:10px"><summary>Pieejamās atzīmes</summary>${ui.dl(CP.docxFill ? CP.docxFill.FIELDS_HELP : [])}<p class="small"><b>Līgumam:</b></p>${ui.dl(CP.CONTRACT_FIELDS_HELP || [])}</details>`;
  }
  let tplType = 'instr';
  A.tplDocAdd = type => { if (!S.root) return ui.toast('Vispirms pieslēdz datu mapi', 'warn'); tplType = type; U.$('tplDocFile').click(); };
  U.$('tplDocFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (!/\.docx$/i.test(f.name)) return ui.toast('Veidnei jābūt Word .docx failam', 'warn');
    try {
      const path = await CP.store.saveFile(['Veidnes'], f.name, f);
      (st().docTemplates = st().docTemplates || []).push({ id: U.uid(), type: tplType, name: f.name.replace(/\.docx$/i, ''), path });
      CP.store.changed(); ui.toast('Veidne pievienota: ' + f.name, 'ok');
    } catch (err) { ui.toast('Veidni neizdevās saglabāt: ' + err.message, 'err'); }
  });
  A.tplDocDelete = id => {
    const t = (st().docTemplates || []).find(x => x.id === id); if (!t || !confirm(`Noņemt veidni “${t.name}” no saraksta? Fails mapē Veidnes paliek.`)) return;
    st().docTemplates = st().docTemplates.filter(x => x.id !== id); CP.store.changed();
  };
  A.tplDocSample = async type => {
    const file = type === 'camp' ? 'nometnes-zurnals' : type === 'contract' ? 'ligums-parstavis-papirs' : 'instruktaza';
    const nice = type === 'camp' ? 'Nometnes žurnāls (veidne).docx' : type === 'contract' ? 'Līgums ar likumisko pārstāvi (veidne).docx' : 'Instruktāžas lapa (veidne).docx';
    try { const r = await fetch(CP.VENDOR + `templates/${file}.docx?v=${CP.VERSION}`, { cache: "no-cache" }); if (!r.ok) throw Error(r.status); U.download(await r.blob(), nice); }
    catch (e) { ui.toast('Paraugu neizdevās ielādēt: ' + e.message, 'err'); }
  };

  /* ---------------- Redaktors ---------------- */
  function blank(type) {
    const fd = st().formDefaults || {};
    return { id: '', type, title: '', dateFrom: U.iso(), dateTo: '', when: '', whenAuto: true, instrDate: U.iso(), group: '', groupAuto: true, notes: '',
      instrPosition: fd.instrPosition || 'JSI', instrName: fd.instrName || '', fillDates: fd.fillDates !== false, blankRows: 0, staffBlankRows: 0,
      participants: [], staff: type === 'camp' ? staffList().filter(s => s.lastUsed).map(s => s.id) : [], leaderId: fd.leaderId || '', groupCounselors: {}, yearId: D.activeYear(), files: [] };
  }
  A.formNew = type => { S.formEdit = blank(type === 'camp' ? 'camp' : 'instr'); S.formPick = { q: '', group: '', onlySel: false }; ui.go('formEdit'); };
  A.formOpen = id => { const ev = (S.db.events || []).find(e => e.id === id); if (!ev) return; S.formEdit = JSON.parse(JSON.stringify(ev)); S.formPick = { q: '', group: '', onlySel: false }; ui.go('formEdit'); };
  A.formDelete = id => {
    const ev = (S.db.events || []).find(e => e.id === id); if (!ev || !confirm(`Dzēst pasākumu “${ev.title || ''}”?\n\nSaglabātie PDF faili mapē paliek.`)) return;
    S.db.events = S.db.events.filter(e => e.id !== id); CP.store.changed();
  };
  const sel = () => new Set((S.formEdit?.participants || []).map(x => x.pid));
  function autoFields(ev) {
    if (ev.whenAuto) ev.when = whenText(ev.dateFrom, ev.dateTo);
    if (ev.groupAuto) ev.group = [...new Set(evPeople(ev).map(p => D.groupOf(p, ev.yearId)).filter(Boolean))].sort(U.cmp).join(', ');
  }
  const stepper = (k, label, hint, warn) => `<div class="field"><label>${label}</label><div class="stepper"><button type="button" class="sm" data-act="formBlank" data-arg="${k}|-1" aria-label="Mazāk">−</button><input type="number" data-ev="${k}" min="0" max="60" value="${Number(S.formEdit?.[k]) || 0}" inputmode="numeric"><button type="button" class="sm" data-act="formBlank" data-arg="${k}|1" aria-label="Vairāk">+</button></div><small class="${warn ? 'warn' : 'muted'}">${hint}</small></div>`;
  CP.pages.formEdit = {
    render() {
      const ev = S.formEdit; if (!ev) return CP.pages.forms.render();
      autoFields(ev);
      const T = TYPES[ev.type], chosen = sel(), pick = S.formPick || (S.formPick = { q: '', group: '', onlySel: false });
      const pool = D.peopleInYear(ev.yearId).filter(p => p.status !== 'archived')
        .filter(p => !pick.group || D.groupOf(p, ev.yearId) === pick.group)
        .filter(p => !pick.onlySel || chosen.has(p.id))
        .filter(p => !pick.q || U.norm(`${U.full(p)} ${U.sortName(p)} ${D.groupOf(p, ev.yearId)}`).includes(U.norm(pick.q)))
        .sort((a, b) => U.cmp(D.groupOf(a, ev.yearId), D.groupOf(b, ev.yearId)) || U.cmp(U.sortName(a), U.sortName(b)));
      const ps = evPeople(ev), issues = ps.map(p => ({ p, m: D.eventDocIssues(p) })).filter(x => x.m.length);
      const groups = D.groups();
      const f = (k, label, type = 'text', extra = '') => `<div class="field"><label>${label}</label><input type="${type}" data-ev="${k}" value="${esc(ev[k] ?? '')}" ${extra}></div>`;
      const counselorOpts = (cur, empty = '— nav —') => `<option value="">${empty}</option>` + staffList().map(s => `<option value="${s.id}" ${cur === s.id ? 'selected' : ''}>${esc(s.name)}${s.counselor ? '' : ' (darbinieks)'}</option>`).join('');
      const evGroups = [...new Set(ps.map(p => D.groupOf(p, ev.yearId) || '(bez grupas)'))].sort(U.cmp);

      const left = `<section class="card"><h3>${ic(T.icon)}${esc(T.l)}</h3><div class="fieldgrid">
          <div class="field wide"><label>${ev.type === 'camp' ? 'Nometnes nosaukums' : 'Nodarbības vai pasākuma nosaukums'}</label><input data-ev="title" value="${esc(ev.title)}" placeholder="${ev.type === 'camp' ? 'piem., Vasaras nometne “Ozols”' : 'piem., Orientēšanās nodarbība Siguldā'}"></div>
          ${f('dateFrom', 'Norises sākums', 'date')}${f('dateTo', 'Beigas (ja vairākas dienas)', 'date')}
          <div class="field wide"><label>Norises laiks (tā, kā rakstīts veidlapā)</label><input data-ev="when" value="${esc(ev.when)}" placeholder="piem., 2026. gada 17.–18. oktobris"><small class="muted">${ev.whenAuto ? 'Tiek veidots no datumiem — vari pārrakstīt.' : '<a href="#" data-act="formWhenAuto">Veidot no datumiem</a>'}</small></div>
          ${f('instrDate', 'Instruktāžas datums', 'date')}
          ${ev.type === 'instr' ? `<div class="field"><label>Grupa</label><input data-ev="group" value="${esc(ev.group)}" list="dl_groups"><small class="muted">${ev.groupAuto ? 'No izvēlētajiem dalībniekiem.' : '<a href="#" data-act="formGroupAuto">No dalībniekiem</a>'}</small></div>` : ''}
          ${ev.type === 'instr' ? `${f('instrPosition', 'Instruktāžas veicēja amats')}${f('instrName', 'Vārds, uzvārds')}` : ''}
          ${ev.type === 'camp' ? `<div class="field"><label>Nometnes vadītājs</label><select data-ev="leaderId">${counselorOpts(ev.leaderId, '— izvēlies —')}</select></div>` : ''}
          <div class="field wide"><label>Piezīmes</label><textarea data-ev="notes" rows="2">${esc(ev.notes)}</textarea></div>
          ${stepper('blankRows', 'Tukšas rindas veidlapas beigās', evPeople(ev).length ? (Number(ev.blankRows) || 0) ? `Veidlapā būs ${evPeople(ev).length} dalībnieki + ${Number(ev.blankRows)} tukšas rindas.` : `Veidlapā būs tieši ${evPeople(ev).length} rindas — bez tukšām.` : (Number(ev.blankRows) || 0) ? `Nav izvēlētu dalībnieku — veidlapā būs ${Number(ev.blankRows)} tukšas rindas.` : 'Nav izvēlētu dalībnieku — norādi, cik tukšu rindu vajag.', !evPeople(ev).length && !(Number(ev.blankRows) || 0))}
          ${ev.type === 'camp' ? stepper('staffBlankRows', 'Tukšas rindas darbinieku tabulā', `${(ev.staff || []).length} izvēlēti darbinieki${(Number(ev.staffBlankRows) || 0) ? ` + ${Number(ev.staffBlankRows)} tukšas rindas` : ''}.`) : ''}
          ${ev.type === 'instr' ? `<div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" data-ev="fillDates" ${ev.fillDates !== false ? 'checked' : ''}> Datumu ierakstīt katrā rindā</label></div>` : ''}
        </div></section>
        ${ev.type === 'camp' ? `<section class="card"><h3>${ic('users')}Darbinieki nometnē</h3>
          ${staffList().length ? staffList().map(s => `<label class="check ev-staff"><input type="checkbox" data-evstaff="${s.id}" ${(ev.staff || []).includes(s.id) ? 'checked' : ''}> <b>${esc(s.name)}</b> <span class="small muted">${esc([s.role, s.counselor ? 'audzinātājs' : ''].filter(Boolean).join(' · '))}</span></label>`).join('') : '<p class="muted small">Vēl nav neviena darbinieka.</p>'}
          <div class="actions" style="margin-top:8px"><button class="sm" data-act="staffEdit">${ic('userPlus', '＋')} Pievienot darbinieku vai audzinātāju</button></div></section>
          <section class="card"><h3>${ic('userCheck')}Audzinātāji</h3>
          ${evGroups.length ? evGroups.map(g => `<div class="inline-form"><span class="grow"><b>${esc(g)}</b> <span class="small muted">${ps.filter(p => (D.groupOf(p, ev.yearId) || '(bez grupas)') === g).length} dal.</span></span><select data-evgroup="${esc(g)}" style="max-width:240px">${counselorOpts(ev.groupCounselors?.[g])}</select></div>`).join('') : '<p class="muted small">Izvēlies dalībniekus — tad varēs piešķirt audzinātāju katrai grupai.</p>'}
          <p class="small muted">Atsevišķam dalībniekam audzinātāju var nomainīt sarakstā labajā pusē.</p></section>` : ''}`;

      const prow = p => {
        const on = chosen.has(p.id), m = D.eventDocIssues(p), part = (ev.participants || []).find(x => x.pid === p.id);
        return `<div class="row pick ${on ? 'on' : ''}"><label class="check grow"><input type="checkbox" data-evpick="${p.id}" ${on ? 'checked' : ''}> ${ui.avatar(p, 'sm')}<span><b>${esc(U.sortName(p))}</b><small class="muted"> ${esc(D.groupOf(p, ev.yearId) || '')}</small>
          ${m.length ? `<br><small class="warn" title="Bez šiem dokumentiem jaunsargs nedrīkst piedalīties pasākumā">⚠ Trūkst: ${esc(m.join(', '))}</small>` : ''}</span></label>
          ${on && ev.type === 'camp' ? `<select class="sm" data-evcoun="${p.id}" title="Audzinātājs šim dalībniekam" style="max-width:170px">${counselorOpts(part?.counselorId || '', '↳ kā grupai')}</select>` : ''}</div>`;
      };
      const right = `<section class="card ev-pick"><h3>${ic('users')}Dalībnieki <span class="pill ${ps.length ? 'ok' : ''}">${ps.length} izvēlēti</span></h3>
          <div class="ev-pickbar"><input type="search" id="evQ" placeholder="Meklēt vārdu…" value="${esc(pick.q)}" autocomplete="off">
            <select id="evGroup"><option value="">Visas grupas</option>${groups.map(g => `<option ${g === pick.group ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
            <label class="check small"><input type="checkbox" id="evOnlySel" ${pick.onlySel ? 'checked' : ''}> Tikai izvēlētie</label></div>
          <div class="actions" style="margin:8px 0"><button class="sm" data-act="evPickAll">Atzīmēt redzamos (${pool.length})</button><button class="sm ghost" data-act="evPickNone">Noņemt visus</button></div>
          ${issues.length ? `<div class="notice">⚠ <b>${issues.length}</b> ${issues.length === 1 ? 'dalībniekam' : 'dalībniekiem'} trūkst obligāto dokumentu (anketa, līgums vai ārsta izziņa). Pasākumā bez tiem piedalīties nedrīkst — pārbaudi pirms pasākuma. Uz veidlapas šis brīdinājums netiek drukāts.</div>` : ''}
          <div class="ev-list">${pool.map(prow).join('') || '<p class="muted small pad">Neviens neatbilst filtram.</p>'}</div></section>`;

      const tpls = (st().docTemplates || []).filter(t => t.type === ev.type);
      const actions = `<button data-act="formSave">${ic('save', '💾')} Saglabāt</button><button class="mainbtn" data-act="formPdf">${ic('file', '📄')} Skatīt PDF</button><button data-act="formPrint">Drukāt</button><button data-act="formDownload">${ic('download', '⬇')} Lejupielādēt PDF</button>
        ${tpls.map(t => `<button data-act="formDocx" data-arg="${t.id}" title="Aizpildīt manu Word veidni">${ic('file', '📄')} Word: ${esc(t.name)}</button>`).join('')}`;
      return `<div class="page">${ui.pageHead(ev.title ? esc(ev.title) : (ev.id ? 'Pasākums' : 'Jauna ' + T.l.toLowerCase()), esc(T.l) + (ev.when ? ' · ' + esc(ev.when) : ''), actions)}
        <div class="ev-layout"><div>${left}</div><div>${right}</div></div></div>`;
    }
  };

  /* --- Ievade redaktorā --- */
  const NUM = new Set(['blankRows', 'staffBlankRows']);
  CP.inputHandlers.push(e => {
    const t = e.target; if (!S.formEdit) return false;
    if (t.id === 'evQ') { S.formPick.q = t.value; renderKeepFocus('evQ'); return true; }
    const k = t.dataset?.ev; if (!k || t.type === 'checkbox' || t.tagName === 'SELECT') return false;
    S.formEdit[k] = NUM.has(k) ? Math.max(0, Math.min(60, Number(t.value) || 0)) : t.value;
    if (k === 'when') S.formEdit.whenAuto = false;
    if (k === 'group') S.formEdit.groupAuto = false;
    if (k === 'dateFrom' || k === 'dateTo') { if (S.formEdit.whenAuto) { autoFields(S.formEdit); const w = document.querySelector('[data-ev="when"]'); if (w) w.value = S.formEdit.when; } }
    return true;
  });
  CP.changeHandlers.push(e => {
    const t = e.target, ev = S.formEdit; if (!ev) return false;
    if (t.id === 'evGroup') { S.formPick.group = t.value; CP.render(); return true; }
    if (t.id === 'evOnlySel') { S.formPick.onlySel = t.checked; CP.render(); return true; }
    if (t.dataset.evpick) {
      const id = t.dataset.evpick;
      if (t.checked) { if (!sel().has(id)) ev.participants.push({ pid: id }); } else ev.participants = ev.participants.filter(x => x.pid !== id);
      renderKeepScroll(); return true;
    }
    if (t.dataset.evstaff) { const id = t.dataset.evstaff; ev.staff = t.checked ? [...new Set([...(ev.staff || []), id])] : (ev.staff || []).filter(x => x !== id); return true; }
    if (t.dataset.evgroup != null && t.dataset.evgroup !== undefined && t.hasAttribute('data-evgroup')) { ev.groupCounselors = { ...(ev.groupCounselors || {}), [t.dataset.evgroup]: t.value }; return true; }
    if (t.dataset.evcoun) { const x = ev.participants.find(x => x.pid === t.dataset.evcoun); if (x) x.counselorId = t.value; return true; }
    const k = t.dataset.ev; if (!k) return false;
    if (NUM.has(k)) { setTimeout(() => { if (S.page === 'formEdit') renderKeepScroll(); }, 0); return true; }
    if (t.type === 'checkbox') ev[k] = t.checked; else if (t.tagName === 'SELECT') ev[k] = t.value; else return false;
    return true;
  });
  function renderKeepScroll() { const l = document.querySelector('.ev-list'), top = l ? l.scrollTop : 0, v = U.$('view').scrollTop; CP.render(); const l2 = document.querySelector('.ev-list'); if (l2) l2.scrollTop = top; U.$('view').scrollTop = v; }
  function renderKeepFocus(id) { const el = U.$(id), pos = el?.selectionStart; renderKeepScroll(); const n = U.$(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* */ } } }
  A.evPickAll = () => {
    const ev = S.formEdit, pick = S.formPick, chosen = sel();
    const pool = D.peopleInYear(ev.yearId).filter(p => p.status !== 'archived').filter(p => !pick.group || D.groupOf(p, ev.yearId) === pick.group)
      .filter(p => !pick.q || U.norm(`${U.full(p)} ${U.sortName(p)} ${D.groupOf(p, ev.yearId)}`).includes(U.norm(pick.q)));
    for (const p of pool) if (!chosen.has(p.id)) ev.participants.push({ pid: p.id });
    renderKeepScroll();
  };
  A.evPickNone = () => { if (S.formEdit.participants.length && !confirm('Noņemt visus izvēlētos dalībniekus?')) return; S.formEdit.participants = []; renderKeepScroll(); };
  A.formBlank = arg => { const ev = S.formEdit; if (!ev) return; const [k, d] = String(arg).split('|'); ev[k] = Math.max(0, Math.min(60, (Number(ev[k]) || 0) + Number(d))); renderKeepScroll(); };
  A.formWhenAuto = () => { S.formEdit.whenAuto = true; CP.render(); };
  A.formGroupAuto = () => { S.formEdit.groupAuto = true; CP.render(); };

  /* --- Saglabāšana --- */
  function commit(quiet) {
    const ev = S.formEdit; if (!ev) return null;
    autoFields(ev);
    ev.updatedAt = U.now();
    if (!ev.id) { ev.id = U.uid(); ev.createdAt = ev.updatedAt; }
    const list = S.db.events = S.db.events || [], i = list.findIndex(x => x.id === ev.id);
    const before = new Set(i >= 0 ? (list[i].participants || []).map(x => x.pid) : []);
    const copy = JSON.parse(JSON.stringify(ev));
    if (i >= 0) list[i] = copy; else list.push(copy);
    // atceras instruktoru un vadītāju nākamajai reizei
    const fd = st().formDefaults = st().formDefaults || {};
    if (ev.type === 'instr') { fd.instrPosition = ev.instrPosition; fd.instrName = ev.instrName; fd.fillDates = ev.fillDates !== false; }
    if (ev.type === 'camp') { fd.leaderId = ev.leaderId; for (const s of staffList()) s.lastUsed = (ev.staff || []).includes(s.id) || undefined; }
    for (const p of evPeople(ev)) if (!before.has(p.id)) D.audit(p.id, 'event', [ev.title || TYPES[ev.type].short]);   // tikai jaunpievienotajiem
    CP.store.changed({ silent: true });
    if (!quiet) ui.toast('Pasākums saglabāts', 'ok');
    return copy;
  }
  A.formSave = () => { commit(false); CP.render(); };

  /* --- PDF --- */
  function counselorFor(ev) {
    return p => {
      const own = (ev.participants || []).find(x => x.pid === p.id)?.counselorId;
      const g = D.groupOf(p, ev.yearId) || '(bez grupas)';
      return staffById(own || ev.groupCounselors?.[g])?.name || '';
    };
  }
  async function buildPdf(ev) {
    const people = evPeople(ev).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
    ui.toast('Sagatavo PDF…', 'ok', 2500);
    const bytes = ev.type === 'camp'
      ? await CP.pdf.camp(ev, people, staffList(), counselorFor(ev))
      : await CP.pdf.instruction(ev, people);
    return new Blob([bytes], { type: 'application/pdf' });
  }
  const fileBase = ev => `${(ev.dateFrom || ev.instrDate || U.iso()).slice(0, 10)} ${TYPES[ev.type].short} ${ev.title || ''}`.trim().replace(/\s+/g, ' ').slice(0, 90);
  async function savePdfCopy(ev, blob) {
    if (!S.root) return null;
    try {
      const dir = ['Macibu_gadi', ev.yearId || D.activeYear(), 'Pasakumi', fileBase(ev)];
      const path = await CP.store.saveFile(dir, `${TYPES[ev.type].l}.pdf`, blob);
      const list = S.db.events.find(x => x.id === ev.id); if (list) { (list.files = list.files || []).push({ path, at: U.now(), kind: 'pdf' }); CP.store.changed({ silent: true }); }
      return path;
    } catch (e) { ui.toast('PDF kopiju mapē neizdevās saglabāt: ' + e.message, 'warn', 9000); return null; }
  }
  const current = id => { if (id) { const ev = (S.db.events || []).find(e => e.id === id); return ev ? JSON.parse(JSON.stringify(ev)) : null; } return commit(true); };
  async function withPdf(id, fn) {
    const ev = current(id); if (!ev) return;
    if (!evPeople(ev).length && !(Number(ev.blankRows) || 0)) { ui.toast('Nav izvēlēts neviens dalībnieks. Izvēlies dalībniekus vai norādi, cik tukšu rindu vajag veidlapā.', 'warn', 8000); U.qs('[data-ev="blankRows"]')?.focus(); return; }
    try { const blob = await buildPdf(ev); await fn(blob, ev); }
    catch (e) { console.error(e); ui.toast('PDF neizdevās sagatavot: ' + e.message, 'err', 12000); }
  }
  A.formPdf = id => withPdf(id, async (blob, ev) => { const path = await savePdfCopy(ev, blob); CP.docs.showBlob(blob, `${fileBase(ev)}.pdf`); if (path) ui.toast('Kopija saglabāta: ' + path, 'ok', 7000); });
  A.formDownload = id => withPdf(id, async (blob, ev) => { U.download(blob, `${fileBase(ev)}.pdf`); await savePdfCopy(ev, blob); });
  /* --- Drukāšana: PDF lapas tiek pārvērstas attēlos un parādītas priekšskatījumā rīkā; “Drukāt” atver pārlūka drukas logu ar tām pašām lapām --- */
  async function renderPages(blob) {
    await CP.reader.loadScript(CP.VENDOR + 'pdfjs/pdf.min.js');
    const lib = window.pdfjsLib, data = new Uint8Array(await blob.arrayBuffer());
    let pdf;
    if (location.protocol === 'file:') pdf = await lib.getDocument({ data, disableWorker: true }).promise;
    else { lib.GlobalWorkerOptions.workerSrc = new URL(CP.VENDOR + 'pdfjs/pdf.worker.min.js', location.href).href; try { pdf = await lib.getDocument({ data: data.slice(0) }).promise; } catch (e) { pdf = await lib.getDocument({ data, disableWorker: true }).promise; } }
    const out = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const pg = await pdf.getPage(i), v1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: 2200 / Math.max(v1.width, v1.height) });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: ctx, viewport: vp }).promise;
      out.push({ src: c.toDataURL('image/png'), land: v1.width > v1.height });
    }
    return out;
  }
  let printPages = [], printBlob = null, printName = '', printSrc = { kind: 'img' };
  CP.setPrintSource = src => { printSrc = src; const dl = U.qs('#printDialog [data-act=printDownload]'); if (dl) dl.textContent = src.kind === 'html' ? 'Lejupielādēt Word' : 'Lejupielādēt PDF'; printBlob = src.blob || null; printName = src.name || ''; if (src.kind === 'img') printPages = src.pages || []; };
  A.formPrint = id => withPdf(id, async (blob, ev) => {
    const d = U.$('printDialog'); CP.setPrintSource({ kind: 'img', pages: [], blob, name: `${fileBase(ev)}.pdf` }); U.$('printGo').disabled = true;
    U.$('printPages').innerHTML = '<p class="muted pad">Sagatavo priekšskatījumu…</p>'; U.$('printInfo').textContent = ''; d.showModal();
    try {
      printPages = await renderPages(blob); printSrc.pages = printPages;
      U.$('printInfo').textContent = `${printPages.length} ${printPages.length === 1 ? 'lapa' : 'lapas'} · A4 ${printPages[0]?.land ? 'ainava' : 'portrets'}`;
      U.$('printPages').innerHTML = printPages.map((p, i) => `<figure class="print-page ${p.land ? 'land' : ''}"><img src="${p.src}" alt="${i + 1}. lapa"><figcaption>${i + 1}. lapa</figcaption></figure>`).join('');
      U.$('printGo').disabled = false;
    } catch (e) { console.error(e); U.$('printPages').innerHTML = `<p class="red pad">Priekšskatījumu neizdevās sagatavot: ${esc(e.message)}. Vari lejupielādēt PDF un izdrukāt to.</p>`; }
  });
  /* Drukā pašu rīka lapu: drukas laikā redzamas tikai veidlapas lapas (bez iegultiem rāmjiem — Chrome priekšskatījums ielādējas uzreiz) */
  /* Drukā tieši no galvenā loga (bez iframe — Chrome drukas logs ar slēptu rāmi bieži “ielādējas” bezgalīgi):
     lapas tiek ieliktas #printSheet, @media print paslēpj visu pārējo. */
  A.printGo = async () => {
    const html = printSrc.kind === 'html';
    if (!html && !printPages.length) return;
    const land = !html && printPages[0].land;
    let sheet = U.$('printSheet'); if (!sheet) { sheet = document.createElement('div'); sheet.id = 'printSheet'; document.body.appendChild(sheet); }
    let st = U.$('printPageStyle'); if (!st) { st = document.createElement('style'); st.id = 'printPageStyle'; document.head.appendChild(st); }
    st.textContent = html ? '@page{size:A4 portrait;margin:0}' : `@page{size:A4 ${land ? 'landscape' : 'portrait'};margin:0}#printSheet img{width:${land ? '296mm' : '209mm'};height:${land ? '208mm' : '295mm'};margin:0 auto}`;
    sheet.className = html ? 'docx-print' : '';
    sheet.innerHTML = html ? printSrc.node.innerHTML : printPages.map(p => `<img src="${p.src}" alt="">`).join('');
    await Promise.all([...sheet.querySelectorAll('img')].map(i => i.decode ? i.decode().catch(() => {}) : null));
    const dlg = U.$('printDialog'); dlg.close();             // modālais logs netiek drukāts
    document.documentElement.classList.add('printing');
    const done = () => { document.documentElement.classList.remove('printing'); sheet.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    // lapas paliek #printSheet līdz drukas loga aizvēršanai (afterprint) — uz ekrāna tās nav redzamas
    setTimeout(() => { try { window.print(); } catch (e) { ui.toast('Drukas logu neizdevās atvērt: ' + e.message, 'err'); } }, 60);
  };
  A.printDownload = () => { if (printBlob) U.download(printBlob, printName); };

  /* --- Sava Word veidne --- */
  A.formDocx = async tid => {
    const t = (st().docTemplates || []).find(x => x.id === tid); if (!t) return;
    const ev = commit(true);
    try {
      const h = await CP.store.handleFor(t.path, 'main'); if (!h) throw Error('veidnes fails mapē Veidnes nav atrasts');
      const people = evPeople(ev).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
      const blob = await CP.docxFill.fill(await (await h.getFile()).arrayBuffer(), CP.docxFill.data(ev, people, staffList(), counselorFor(ev)));
      U.download(blob, `${fileBase(ev)}.docx`);
      if (S.root) { const path = await CP.store.saveFile(['Macibu_gadi', ev.yearId || D.activeYear(), 'Pasakumi', fileBase(ev)], `${t.name}.docx`, blob); const x = S.db.events.find(e => e.id === ev.id); if (x) { (x.files = x.files || []).push({ path, at: U.now(), kind: 'docx' }); CP.store.changed({ silent: true }); } }
    } catch (e) { console.error(e); ui.toast('Word veidni neizdevās aizpildīt: ' + e.message, 'err', 12000); }
  };

  /* --- Personas kartītē: dalība pasākumos --- */
  CP.forms = {
    personCard(p) {
      const evs = (S.db.events || []).filter(e => (e.participants || []).some(x => x.pid === p.id)).sort((a, b) => String(b.dateFrom || b.instrDate).localeCompare(String(a.dateFrom || a.instrDate)));
      if (!evs.length) return '';
      return `<section class="card"><h3>${ic('clipboard')}Pasākumi</h3>${evs.slice(0, 6).map(e => `<div class="row"><div class="grow"><b>${esc(e.title || TYPES[e.type].short)}</b><div class="small muted">${esc(TYPES[e.type].short)} · ${esc(e.when || U.fmtDate(e.instrDate))}</div></div><button class="sm ghost" data-act="formOpen" data-arg="${e.id}">Atvērt</button></div>`).join('')}${evs.length > 6 ? `<p class="small muted">… un vēl ${evs.length - 6}</p>` : ''}</section>`;
    },
    whenText
  };
})(window.CP);
