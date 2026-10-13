/* =====================================================================
   Personas: saraksts (tabula ar filtriem un masveida darbībām),
   personas kartiņa, rediģēšana, statusi, arhīvs, vēsture, saistības.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions;
  const esc = U.esc;

  /* =================== Saraksts =================== */
  const STATUS_FILTERS = [['current', 'Visi aktuālie'], ['active', 'Aktīvie'], ['candidate', 'Kandidāti'], ['paused', 'Pārtrauktie'], ['archived', 'Arhīvs'], ['all', 'Visi ieraksti']];

  function listRows() {
    const L = S.list, q = U.norm(L.q).replace(/ /g, ''), last = D.lastContact();
    let rows = S.db.people.filter(p => D.inYear(p) &&
      (L.status === 'all' || (L.status === 'current' ? D.partStatus(p) !== 'archived' : D.partStatus(p) === L.status)) &&
      (!L.group || D.groupOf(p) === L.group) &&
      (!L.missing || (D.partStatus(p) !== 'archived' && D.missingDocs(p).length)) &&
      (!q || U.norm([U.full(p), U.sortName(p), D.groupOf(p), p.parentName, p.phone, p.parentPhone, p.email, p.parentEmail, p.school, p.schoolClass].join(' ')).replace(/ /g, '').includes(q)));
    const key = {
      name: p => U.sortName(p).toLocaleLowerCase('lv'), group: p => (D.groupOf(p) || '~').toLocaleLowerCase('lv'), age: p => p.birth || '9999',
      status: p => D.partStatus(p), docs: p => D.missingDocs(p).length, contact: p => last[p.id] || ''
    }[L.sort] || (p => U.sortName(p));
    rows.sort((a, b) => { const x = key(a), y = key(b); const c = typeof x === 'number' ? x - y : U.cmp(x, y); return (c || U.cmp(U.sortName(a), U.sortName(b))) * L.dir; });
    return { rows, last };
  }

  function listTable() {
    const { rows, last } = listRows(), L = S.list, req = S.db.settings.requiredDocs.length;
    for (const id of [...L.sel]) if (!rows.some(r => r.id === id)) L.sel.delete(id);
    const th = (k, t) => `<th class="sortable ${L.sort === k ? 'on' : ''}" data-act="listSort" data-arg="${k}">${t}${L.sort === k ? (L.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
    const all = rows.length && rows.every(r => L.sel.has(r.id));
    const bulk = L.sel.size ? `<div class="bulkbar"><b>Atlasītas ${L.sel.size}</b>
      <button class="sm" data-act="bulkMsg">✉ Ziņa</button>
      <button class="sm" data-act="bulkGroup">Mainīt grupu…</button>
      <select class="sm" data-bulk="status"><option value="">Mainīt statusu…</option><option value="active">Aktīvs</option><option value="candidate">Kandidāts</option><option value="paused">Pārtraukts</option></select>
      <button class="sm" data-act="bulkReg" data-arg="dvs" title="Atzīmēt, ka atlasītie ievadīti DVS">✓ DVS</button>
      <button class="sm" data-act="bulkReg" data-arg="eklase" title="Atzīmēt, ka atlasītie ievadīti e-klasē">✓ e-klase</button>
      <button class="sm" data-act="bulkCsv">⬇ CSV</button>
      <button class="sm" data-act="bulkVcard" title="Kontakti Google / telefonam">📇 vCard</button>
      <button class="sm" data-act="bulkArchive">Arhivēt</button>
      <button class="sm ghost" data-act="bulkClear">Notīrīt</button></div>` : '';
    return bulk + `<div class="tablewrap"><table class="table">
      <thead><tr><th class="chk"><input type="checkbox" data-act="listAll" ${all ? 'checked' : ''} aria-label="Atlasīt visus"></th>
      ${th('name', 'Persona')}${th('group', 'Grupa')}${th('age', 'Vecums')}${th('status', 'Statuss')}<th>Vecāks / kontakts</th>${th('docs', 'Dokumenti')}${th('contact', 'Pēdējā saziņa')}</tr></thead>
      <tbody>${rows.map(p => {
        const miss = D.missingDocs(p), c = D.contacts(p).find(c => c.kind === 'parent') || D.contacts(p)[0];
        return `<tr class="${L.sel.has(p.id) ? 'sel' : ''}" data-person="${p.id}">
          <td class="chk"><input type="checkbox" data-act="listSel" data-arg="${p.id}" ${L.sel.has(p.id) ? 'checked' : ''} aria-label="Atlasīt"></td>
          <td><div class="who">${ui.avatar(p, 'sm')}<span><b>${esc(U.sortName(p))}</b><small class="muted">${esc([p.school, p.schoolClass].filter(Boolean).join(', '))}</small></span></div></td>
          <td>${esc(D.groupOf(p) || '—')}</td>
          <td>${p.birth ? U.age(p.birth) : '—'}</td>
          <td>${ui.status(D.partStatus(p))}</td>
          <td>${c ? `<span>${esc(c.name || c.role)}</span><small class="muted">${esc(c.phone ? U.prettyPhone(c.phone) : c.email)}</small>` : '<span class="muted">—</span>'}</td>
          <td>${D.partStatus(p) === 'archived' ? '<span class="muted">—</span>' : miss.length ? `<span class="pill warn" title="Trūkst: ${esc(miss.join(', '))}">${req - miss.length}/${req}</span>` : `<span class="pill ok">${req}/${req}</span>`}</td>
          <td class="muted small">${last[p.id] ? U.fmtDate(last[p.id].slice(0, 10)) : '—'}</td></tr>`;
      }).join('')}</tbody></table>
      ${rows.length ? '' : ui.empty(S.db.people.length ? 'Šajā mācību gadā pēc šiem filtriem neviens netika atrasts.' : 'Šajā mācību gadā vēl nav personu.', `<div class="actions center"><button class="mainbtn" data-act="openMove">Pārcelt no cita gada</button><button data-act="addPerson">＋ Jauna persona</button><button data-act="scan">📷 Ievadīt no anketas</button></div>`)}</div>
      <p class="muted small">${rows.length} personas mācību gadā ${esc(U.yearLabel(D.activeYear()))}</p>`;
  }

  CP.pages.people = {
    render() {
      const L = S.list, gs = D.groups();
      return `<div class="page">` + ui.pageHead('Personas', `Mācību gads ${U.yearLabel(D.activeYear())}. Viena persona ir viens profils.`,
        `<button data-act="openMove">Pārcelt no cita gada</button><button data-act="scan">📷 Ievadīt no anketas</button><button data-act="import">⬆ Imports</button><button class="mainbtn" data-act="addPerson">＋ Jauna persona</button>`)
        + (CP.years?.banner() || '')
        + `<div class="filters card">
          <input id="listQ" type="search" placeholder="Meklēt vārdu, tālruni, vecāku, skolu…" value="${esc(L.q)}">
          <select data-list="status">${STATUS_FILTERS.map(([v, t]) => `<option value="${v}" ${L.status === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <select data-list="group"><option value="">Visas grupas</option>${gs.map(g => `<option ${g === L.group ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
          <label class="check"><input type="checkbox" data-list="missing" ${L.missing ? 'checked' : ''}> Tikai ar trūkstošiem dokumentiem</label>
        </div><div id="listBody">${listTable()}</div></div>`;
    }
  };
  CP.inputHandlers.push(e => { if (e.target.id !== 'listQ') return false; S.list.q = e.target.value; U.$('listBody').innerHTML = listTable(); return true; });
  CP.changeHandlers.push(e => {
    const k = e.target.dataset.list; if (k) { S.list[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; CP.render(); return true; }
    if (e.target.dataset.bulk === 'status' && e.target.value) {
      const st = e.target.value; for (const id of S.list.sel) { const p = D.person(id); if (p && p.status !== 'archived' && D.partStatus(p) !== st) { D.bindYear(p, { status: st, group: D.groupOf(p) }); D.audit(id, 'status', [CP.STATUSES[st]]); } }
      CP.store.changed(); ui.toast(`Statuss mainīts ${S.list.sel.size} personām`, 'ok'); return true;
    }
    return false;
  });
  A.listSort = k => { const L = S.list; if (L.sort === k) L.dir *= -1; else { L.sort = k; L.dir = 1; } U.$('listBody').innerHTML = listTable(); };
  A.listSel = id => { const s = S.list.sel; s.has(id) ? s.delete(id) : s.add(id); U.$('listBody').innerHTML = listTable(); };
  A.listAll = () => { const { rows } = listRows(), s = S.list.sel, all = rows.every(r => s.has(r.id)); rows.forEach(r => all ? s.delete(r.id) : s.add(r.id)); U.$('listBody').innerHTML = listTable(); };
  A.bulkClear = () => { S.list.sel.clear(); U.$('listBody').innerHTML = listTable(); };
  A.bulkMsg = () => { S.comms.ids = new Set(S.list.sel); S.comms.group = ''; S.comms.done.clear(); ui.go('comms'); };
  A.bulkCsv = () => CP.io.exportCsv(S.db.people.filter(p => S.list.sel.has(p.id)));
  A.bulkGroup = () => {
    const g = prompt(`Jaunā grupa ${S.list.sel.size} personām:`, S.list.group || ''); if (g === null) return;
    for (const id of S.list.sel) { const p = D.person(id); if (p && D.groupOf(p) !== g.trim()) { D.bindYear(p, { group: g.trim(), status: D.partStatus(p) === 'archived' ? 'archived' : (D.enroll(p.id)?.status || 'active') }); D.audit(id, 'update', ['Grupa']); } }
    CP.store.changed(); ui.toast('Grupa nomainīta', 'ok');
  };
  A.bulkArchive = () => {
    const ids = [...S.list.sel].filter(id => D.person(id)?.status !== 'archived'); if (!ids.length) return;
    if (!confirm(`Arhivēt ${ids.length} personas ar šodienas izstāšanās datumu? Dati netiek dzēsti.`)) return;
    for (const id of ids) archive(D.person(id), { left: U.iso(), reason: '', months: S.db.settings.retentionDefault });
    S.list.sel.clear(); CP.store.changed();
  };

  /* =================== Personas kartiņa =================== */
  const TABS = [['overview', 'Pārskats'], ['data', 'Visi dati'], ['docs', 'Dokumenti'], ['history', 'Vēsture'], ['relations', 'Saistības'], ['equipment', 'Ekipējums'], ['idcard', 'Apliecība']];
  const TAB_IC = { overview: 'layout', data: 'list', docs: 'file', history: 'clock', relations: 'link', equipment: 'backpack', idcard: 'idcard' };

  CP.pages.person = {
    render() {
      const p = D.person(S.selected);
      if (!p) { S.page = 'people'; return CP.pages.people.render(); }
      const miss = D.missingDocs(p), docs = D.docsOf(p), fam = D.family(p).length + S.db.relations.filter(r => r.a === p.id || r.b === p.id).length;
      const openTasks = S.db.tasks.filter(t => t.personId === p.id && !t.done).length, eq = D.openEquipment(p).length;
      const sub = [`<span class="tag">${esc(U.yearLabel(D.activeYear()))}</span>`, D.groupOf(p) && `<span class="tag">${esc(D.groupOf(p))}</span>`, p.birth && `${U.age(p.birth)} g.`, [p.school, p.schoolClass].filter(Boolean).map(esc).join(', ')].filter(Boolean).join(' · ');
      const head = `${ui.backBtn()}<header class="person-head">${ui.avatar(p, 'lg')}<div class="ph-main"><h1>${esc(U.full(p))} ${ui.status(D.partStatus(p))}</h1><p class="muted">${sub || 'Nav grupas'}</p></div>
        <div class="actions">
          <button data-act="msg" data-arg="${p.id}">✉ Ziņa</button>
          <button data-act="edit" data-arg="${p.id}">✎ Rediģēt</button>
          <details class="menu"><summary class="btn">⋯</summary><div class="menu-list">
            ${p.status === 'archived' ? `<button data-act="restore" data-arg="${p.id}">Atjaunot no arhīva</button>` : `<button data-act="archive" data-arg="${p.id}">Arhivēt (izstājies)</button>`}
            <button data-act="exportPerson" data-arg="${p.id}">Eksportēt personas datus (GDPR)</button>
            <button data-act="print">Drukāt kartiņu</button>
            ${p.status === 'archived' ? `<button class="danger" data-act="erase" data-arg="${p.id}">Dzēst neatgriezeniski…</button>` : ''}
          </div></details>
          ${ui.saveBtn()}</div></header>`;
      const counts = { docs: `${docs.length}${miss.length ? ' <span class="warn">⚠</span>' : ''}`, history: openTasks ? `<span class="count">${openTasks}</span>` : '', relations: fam || '', equipment: eq || '', idcard: D.idCardBadge ? D.idCardBadge(p) : '' };
      const tabs = `<nav class="tabs" role="tablist">${TABS.map(([k, t]) => `<button role="tab" data-tab="${k}" class="${S.tab === k ? 'active' : ''}">${CP.ic(TAB_IC[k])}${t}${counts[k] ? ` <small>${counts[k]}</small>` : ''}</button>`).join('')}</nav>`;
      let body = '';
      if (S.tab === 'overview') body = overview(p, miss);
      else if (S.tab === 'data') body = allData(p);
      else if (S.tab === 'docs') body = CP.docs.personTab(p);
      else if (S.tab === 'history') body = history(p);
      else if (S.tab === 'relations') body = relations(p);
      else if (S.tab === 'equipment') body = CP.equipment.personTab(p);
      else if (S.tab === 'idcard') body = CP.idcard.personTab(p);
      return `<div class="page">${head}<div class="person-layout"><div class="pl-main">${tabs}${body}</div><aside class="pl-side">${side(p, miss)}</aside></div></div>`;
    }
  };

  function codeView(p, key) {
    const v = p[key]; if (!v) return '';
    const shown = S.reveal.has(p.id + key);
    return `${esc(shown ? U.fmtCode(v) : U.maskCode(v))} <button class="ghost sm" data-act="reveal" data-arg="${p.id}|${key}" title="${shown ? 'Paslēpt' : 'Parādīt'}">${shown ? '🙈' : '👁'}</button>${U.checkCode(v) ? '' : ' <span class="warn small" title="Kontrolcipars neatbilst">⚠</span>'}`;
  }
  const photo = p => p.photoConsent === 'yes' ? 'Piekrīt' + (p.photoConsentDate ? ` (${U.fmtDate(p.photoConsentDate)})` : '') : p.photoConsent === 'no' ? 'Nepiekrīt' : 'Nav zināms';

  function side(p, miss) {
    const cs = D.contacts(p);
    const contacts = cs.map(c => {
      const n = U.normPhone(c.phone);
      return `<div class="contact"><div class="c-top"><span class="role">${esc(c.role)}</span></div><div class="c-name">${esc(c.name || '—')}</div>
        <div class="c-how">${n ? `<a href="tel:+${n}" data-act="call" data-arg="${p.id}|${c.idx}">${esc(U.prettyPhone(c.phone))}</a>` : ''}${c.email ? `<span>${esc(c.email)}</span>` : ''}</div>
        <div class="c-btns">${n ? `<button class="wabtn sm" data-act="msgTo" data-arg="${p.id}|${c.idx}|whatsapp">💬 WhatsApp</button><button class="sm" data-act="call" data-arg="${p.id}|${c.idx}" title="Zvanīt">📞</button><button class="sm" data-act="msgTo" data-arg="${p.id}|${c.idx}|sms">SMS</button>` : ''}${c.email ? `<button class="sm" data-act="msgTo" data-arg="${p.id}|${c.idx}|email">✉</button>` : ''}</div></div>`;
    }).join('') || `<p class="muted small">Nav ievadīts neviens tālrunis vai e-pasts.</p><button class="sm" data-act="edit" data-arg="${p.id}" data-sec="contact">＋ Pievienot kontaktus</button>`;
    const req = S.db.settings.requiredDocs;
    const docs = req.length ? `<div class="chips col">${req.map(k => `<span class="chip ${miss.includes(k) ? 'miss' : 'ok'}">${miss.includes(k) ? '✗' : '✓'} ${esc(k)}</span>`).join('')}</div>
      ${miss.length ? `<div class="actions" style="margin-top:10px"><button class="sm" data-tab="docs">Pievienot</button>${cs.length ? `<button class="sm" data-act="remindDocs" data-arg="${p.id}">💬 Atgādināt</button>` : ''}</div>` : ''}` : '<p class="muted small">Iestatījumos nav norādīti obligātie dokumenti.</p>';
    const tools = CP.comms.toolLinks(p);
    const tasks = S.db.tasks.filter(t => t.personId === p.id && !t.done).sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9')));
    const dups = Object.keys(D.PHONE_FIELDS).flatMap(f => D.phoneMatches(p[f], p.id, f).filter(e => e.p.id !== p.id).map(e => ({ f, e })));
    const dupCard = dups.length ? `<section class="card dupcard"><h3>☎ Sakrītoši tālruņi</h3>${dups.map(({ f, e }) => `<div class="small"><span class="${D.phoneOwner(p, f) !== D.phoneOwner(e.p, e.f) ? 'warn' : 'muted'}">${D.phoneOwner(p, f) !== D.phoneOwner(e.p, e.f) ? '⚠' : 'ℹ'} ${U.prettyPhone(p[f])}</span> (${D.PHONE_FIELDS[f]}) = ${e.f === 'phone' ? '' : esc(e.p[e.f.replace('Phone', 'Name')] || '?') + ', '}<a href="#" data-person="${e.p.id}">${esc(U.full(e.p))}</a> <span class="muted">(${e.role})</span></div>`).join('')}</section>` : '';
    return `<section class="card"><h3>Kontakti <button class="sm right" data-act="vcard" data-arg="${p.id}" title="Saglabāt telefonā / Google kontaktos">📇 Uz telefonu</button></h3>${contacts}</section>${dupCard}
      <section class="card"><h3>Obligātie dokumenti</h3>${docs}</section>
      ${tasks.length ? `<section class="card"><h3>Uzdevumi</h3>${tasks.map(taskRow).join('')}</section>` : ''}
      ${CP.registry ? CP.registry.personCard(p) : ''}
      ${CP.forms ? CP.forms.personCard(p) : ''}
      ${tools ? `<section class="card"><h3>Rīki</h3><div class="actions">${tools}</div></section>` : ''}`;
  }
  const taskRow = t => `<div class="task ${t.due && U.daysTo(t.due) < 0 ? 'late' : ''}"><input type="checkbox" data-act="taskDone" data-arg="${t.id}" ${t.done ? 'checked' : ''} aria-label="Izpildīts"><span>${esc(t.text)}${t.due ? `<small class="muted"> · ${U.fmtDate(t.due)}</small>` : ''}</span></div>`;

  function overview(p, miss) {
    const recent = timeline(p).slice(0, 6);
    const parent = D.contacts(p).find(c => c.kind === 'parent');
    return `<div class="cards2">
      <section class="card"><h3>Pamatdati <button class="ghost sm right" data-act="edit" data-arg="${p.id}" data-sec="basic">✎</button></h3>${ui.dl([
        ['Vārds, uzvārds', U.full(p)], ['Dzimšanas datums', p.birth ? `${U.fmtDate(p.birth)} (${U.age(p.birth)} g.)` : ''], ['Personas kods', codeView(p, 'personalCode'), 1],
        ['Tālrunis', p.phone && U.prettyPhone(p.phone)], ['E-pasts', p.email], ['Faktiskā adrese', p.addressActual || p.addressDeclared]])}</section>
      <section class="card"><h3>Dalība <button class="ghost sm right" data-act="edit" data-arg="${p.id}" data-sec="study">✎</button></h3>${ui.dl([
        ['Mācību gads', U.yearLabel(D.activeYear())], ['Statuss šajā gadā', ui.status(D.partStatus(p)), 1], ['Grupa šajā gadā', D.groupOf(p)], ['Iestājies', U.fmtDate(p.joined)], ['Mācību iestāde', p.school], ['Klase / kurss', p.schoolClass],
        ['Foto/video', photo(p)], p.status === 'archived' && ['Izstājies', `${U.fmtDate(p.left)}${p.reason ? ' · ' + p.reason : ''}`]])}</section>
      <section class="card"><h3>Likumiskais pārstāvis <button class="ghost sm right" data-act="edit" data-arg="${p.id}" data-sec="parent">✎</button></h3>${ui.dl([
        ['Vārds, uzvārds', p.parentName], ['Saistība', p.parentRelation], ['Tālrunis', p.parentPhone && U.prettyPhone(p.parentPhone)], ['E-pasts', p.parentEmail],
        p.parent2Name && ['Otrs vecāks', `${p.parent2Name}${p.parent2Phone ? ' · ' + U.prettyPhone(p.parent2Phone) : ''}`],
        ['Ārkārtas kontakts', [p.emergencyName, p.emergencyPhone && U.prettyPhone(p.emergencyPhone)].filter(Boolean).join(' · ')]])}
        ${!parent && U.age(p.birth) < 18 ? '<p class="warn small">Nepilngadīgam nav norādīts pārstāvja kontakts.</p>' : ''}</section>
      <section class="card"><h3>Pēdējā aktivitāte <button class="ghost sm right" data-tab="history">Viss →</button></h3>${recent.length ? recent.map(timelineRow).join('') : '<p class="muted small">Vēl nav ierakstu.</p>'}</section>
      <section class="card wide"><h3>Dalība pa mācību gadiem</h3>${D.enrollmentsOf(p.id).map(e => `<div class="row"><div class="grow"><b>${esc(U.yearLabel(e.yearId))}</b> <span class="tag">${esc(e.group || 'bez grupas')}</span> ${ui.status(e.status)}<div class="small muted">${e.at ? U.fmtDate(String(e.at).slice(0, 10)) : ''}${e.fromYearId ? ' · pārcelts no ' + esc(U.yearLabel(e.fromYearId)) : ''}</div>${noteBox('year', p.id, e.yearId, e.note, 'Piezīme par šo gadu', 1)}</div></div>`).join('') || '<p class="muted small">Šai personai vēl nav dalības ierakstu.</p>'}</section>
      <section class="card wide"><h3>Piezīmes</h3>${noteBox('person', p.id, '', p.notes, 'Piezīmes par personu (piem., veselība, īpaši norādījumi, vienošanās)…', Math.min(10, Math.max(2, String(p.notes || '').split('\n').length + 1)))}</section>
    </div>`;
  }

  function allData(p) {
    const val = f => {
      const v = p[f.k]; if (f.sens) return codeView(p, f.k);
      if (f.t === 'date') return esc(U.fmtDate(v)); if (f.t === 'tel') return esc(v ? U.prettyPhone(v) : '');
      if (f.k === 'photoConsent') return esc(photo(p)); if (f.k === 'status') return ui.status(D.partStatus(p)); if (f.k === 'group') return esc(D.groupOf(p));
      return esc(v ?? '');
    };
    return `<div class="cards2">${CP.SECTIONS.map(([sid, title]) => {
      const fields = CP.FIELDS.filter(f => f.s === sid);
      return `<section class="card ${sid === 'admin' ? 'wide' : ''}"><h3>${title} <button class="ghost sm right" data-act="edit" data-arg="${p.id}" data-sec="${sid}">✎</button></h3>${ui.dl(fields.map(f => [f.l, val(f), 1]))}</section>`;
    }).join('')}
    <section class="card wide"><h3>Ieraksts</h3>${ui.dl([['Izveidots', U.fmtDateTime(p.createdAt)], ['Pēdējās izmaiņas', U.fmtDateTime(p.updatedAt)], ['Glabāšana pēc izstāšanās', `${p.retentionMonths ?? S.db.settings.retentionDefault} mēn.`]])}</section></div>`;
  }

  /* --- Vēsture: saziņa, piezīmes, uzdevumi, izmaiņas vienā laika joslā --- */
  const TYPE = { whatsapp: ['💬', 'WhatsApp'], sms: ['✉', 'SMS'], email: ['✉', 'E-pasts'], call: ['📞', 'Zvans'], note: ['📝', 'Piezīme'], task: ['☐', 'Uzdevums'], audit: ['✎', 'Izmaiņas'] };
  const AUDIT = { create: 'Izveidota kartīte', update: 'Mainīti dati', status: 'Mainīts statuss', archive: 'Arhivēta', restore: 'Atjaunota no arhīva', scan: 'Ievadīta no anketas', 'doc-add': 'Pievienots dokuments', 'doc-remove': 'Noņemts dokumenta ieraksts', 'doc-relink': 'Atjaunota dokumenta sasaiste', 'eq-issue': 'Izsniegts ekipējums', 'eq-return': 'Atdots ekipējums', 'eq-edit': 'Labots ekipējuma ieraksts', 'eq-delete': 'Dzēsts ekipējuma ieraksts' , idcard: 'Jaunsarga apliecība', event: 'Pasākums'};
  function timeline(p) {
    const items = [];
    for (const l of S.db.log) if (l.personId === p.id) items.push({ at: l.at, type: l.type, text: l.detail, status: l.status, grp: l.type === 'note' ? 'notes' : 'comms' });
    for (const a of S.db.audit) if (a.personId === p.id) items.push({ at: a.at, type: 'audit', text: (AUDIT[a.action] || a.action) + (a.fields?.length ? ': ' + a.fields.join(', ') : ''), grp: 'changes' });
    for (const t of S.db.tasks) if (t.personId === p.id) items.push({ at: t.createdAt, type: 'task', task: t, grp: 'tasks' });
    return items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }
  const timelineRow = i => {
    const [ic, name] = TYPE[i.type] || ['•', i.type];
    if (i.task) return `<div class="tl"><span class="tl-ic">${ic}</span><div class="tl-body"><div class="tl-meta">${name} · ${U.fmtDateTime(i.at)}</div>${taskRow(i.task)}</div></div>`;
    const st = i.status && CP.COMM_STATUS[i.status] ? ` · ${esc(CP.COMM_STATUS[i.status])}` : '';
    return `<div class="tl"><span class="tl-ic">${ic}</span><div class="tl-body"><div class="tl-meta">${name}${st} · ${U.fmtDateTime(i.at)}</div><div class="pre">${esc(i.text)}</div></div></div>`;
  };
  function history(p) {
    const f = S.historyFilter, all = timeline(p), items = f === 'all' ? all : all.filter(i => i.grp === f);
    const chip = (k, t) => `<button class="chipbtn ${f === k ? 'on' : ''}" data-act="histFilter" data-arg="${k}">${t}</button>`;
    return `<section class="card"><h3>Jauns ieraksts</h3><div class="composer"><textarea id="noteText" rows="2" placeholder="Piemēram: “Runāju ar mammu par nometni” vai uzdevums “Paņemt parakstītu līgumu”"></textarea>
        <div class="actions"><label class="inline">Atgādināt <input type="date" id="noteDue"></label><span class="muted small">Ar datumu ieraksts kļūst par uzdevumu. Enter — pievienot, Shift+Enter — jauna rinda.</span><span class="grow"></span><button class="mainbtn" data-act="addNote" data-arg="${p.id}">Pievienot</button></div></div></section>
      <section class="card"><div class="chips" style="margin-bottom:10px">${chip('all', 'Viss')}${chip('comms', 'Saziņa')}${chip('notes', 'Piezīmes')}${chip('tasks', 'Uzdevumi')}${chip('changes', 'Izmaiņas')}</div>
      ${items.map(timelineRow).join('') || '<p class="muted small">Nav ierakstu.</p>'}</section>`;
  }
  /* --- Piezīmju lauks ar pogu “Saglabāt”: Enter saglabā, Shift+Enter — jauna rinda, iziešana no lauka arī saglabā --- */
  function noteBox(kind, pid, yearId, value, ph, rows = 2) {
    return `<div class="notebox" data-nb="${esc(kind)}|${esc(pid)}|${esc(yearId || '')}"><textarea data-notebox rows="${rows}" placeholder="${esc(ph)}">${esc(value || '')}</textarea>
      <div class="notebox-bar"><small class="muted">Enter — saglabāt · Shift+Enter — jauna rinda</small><span class="grow"></span><span class="nb-state small"></span><button type="button" class="sm mainbtn" data-act="noteSave">Saglabāt</button></div></div>`;
  }
  CP.noteBox = noteBox;
  function saveBox(box) {
    if (!box) return;
    const [kind, pid, yearId] = box.dataset.nb.split('|'), ta = box.querySelector('textarea'), v = ta.value.replace(/\s+$/, ''), p = D.person(pid);
    const st = box.querySelector('.nb-state'); if (!p) return;
    if (kind === 'year') {
      const r = (S.db.enrollments || []).find(x => x.personId === pid && x.yearId === yearId); if (!r) return;
      if ((r.note || '') !== v) { r.note = v; D.audit(pid, 'update', ['Piezīme par ' + U.yearLabel(yearId)]); }
    } else if ((p.notes || '') !== v) { p.notes = v; p.updatedAt = U.now(); D.audit(pid, 'update', ['Piezīmes']); }
    CP.store.changed({ silent: true });
    box.classList.remove('dirty'); st.textContent = 'Saglabāts ✓'; st.className = 'nb-state small ok';
    clearTimeout(box._t); box._t = setTimeout(() => { if (!box.classList.contains('dirty')) st.textContent = ''; }, 4000);
  }
  A.noteSave = (arg, el) => saveBox(el.closest('.notebox'));
  CP.inputHandlers.push(e => {
    const t = e.target; if (!t.matches?.('[data-notebox]')) return false;
    const box = t.closest('.notebox'), st = box.querySelector('.nb-state');
    box.classList.add('dirty'); st.textContent = 'Nav saglabāts'; st.className = 'nb-state small warn'; return true;
  });
  document.addEventListener('keydown', e => {
    const t = e.target; if (e.key !== 'Enter' || e.shiftKey || e.isComposing || !t.matches?.('[data-notebox]')) return;
    e.preventDefault(); saveBox(t.closest('.notebox'));
  });
  document.addEventListener('focusout', e => { const t = e.target; if (t.matches?.('[data-notebox]') && t.closest('.notebox')?.classList.contains('dirty')) saveBox(t.closest('.notebox')); });

  A.histFilter = k => { S.historyFilter = k; CP.render(); };
  A.addNote = pid => {
    const t = U.$('noteText').value.trim(), due = U.$('noteDue').value; if (!t) return U.$('noteText').focus();
    if (due) S.db.tasks.push({ id: U.uid(), personId: pid, text: t, due, done: false, createdAt: U.now() });
    else D.log(pid, 'note', t);
    CP.store.changed(); ui.toast(due ? 'Uzdevums pievienots' : 'Ieraksts pievienots', 'ok', 2500);
  };
  A.taskDone = id => { const t = S.db.tasks.find(x => x.id === id); if (t) { t.done = !t.done; t.doneAt = t.done ? U.now() : null; CP.store.changed(); } };

  /* --- Saistības --- */
  function relations(p) {
    const fam = D.family(p), manual = S.db.relations.filter(r => r.a === p.id || r.b === p.id);
    const same = D.groupOf(p) ? S.db.people.filter(o => o.id !== p.id && o.status !== 'archived' && D.inYear(o) && D.groupOf(o) === D.groupOf(p)).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b))) : [];
    const others = S.db.people.filter(o => o.id !== p.id).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
    const personRow = (o, extra = '') => `<div class="row"><div class="who">${ui.avatar(o, 'sm')}<span><b>${esc(U.full(o))}</b><small class="muted">${esc(D.groupOf(o) || o.group || '')}${o.status === 'archived' ? ' · arhīvā' : ''}</small></span></div>${extra}<button class="sm" data-person="${o.id}">Atvērt</button></div>`;
    return `<div class="cards2">
      <section class="card"><h3>Ģimene</h3><p class="muted small">Atrasti automātiski pēc kopīga vecāka tālruņa, e-pasta vai personas koda.</p>${fam.map(o => personRow(o)).join('') || '<p class="muted small">Nav atrasts.</p>'}</section>
      <section class="card"><h3>Citas saistības</h3>${manual.map(r => { const o = D.person(r.a === p.id ? r.b : r.a); return o ? personRow(o, `<span class="tag">${esc(r.type)}</span><button class="sm ghost" data-act="delRel" data-arg="${r.id}" title="Noņemt">✕</button>`) : ''; }).join('') || '<p class="muted small">Nav.</p>'}
        <div class="inline-form"><select id="relPerson">${others.map(o => `<option value="${o.id}">${esc(U.sortName(o))}</option>`).join('')}</select><input id="relType" placeholder="Brālis, draugs, komandas biedrs…" list="dl_rel"><button data-act="addRel" data-arg="${p.id}">＋</button></div></section>
      <section class="card wide"><h3>Grupa: ${esc(D.groupOf(p) || '—')} ${D.groupOf(p) ? `<button class="sm right" data-act="groupMsg" data-arg="${esc(D.groupOf(p))}">✉ Ziņa grupai</button>` : ''}</h3>
        ${same.length ? `<div class="namegrid">${same.map(o => `<button class="namechip" data-person="${o.id}">${esc(U.sortName(o))}</button>`).join('')}</div>` : '<p class="muted small">Grupā nav citu personu.</p>'}</section></div>`;
  }
  A.addRel = a => { const b = U.$('relPerson').value, type = U.$('relType').value.trim() || 'Saistīts'; if (!b) return; S.db.relations.push({ id: U.uid(), a, b, type }); CP.store.changed(); };
  A.delRel = id => { S.db.relations = S.db.relations.filter(r => r.id !== id); CP.store.changed(); };
  A.reveal = arg => { S.reveal.has(arg.replace('|', '')) ? S.reveal.delete(arg.replace('|', '')) : S.reveal.add(arg.replace('|', '')); CP.render(); };
  A.print = () => window.print();

  /* =================== Rediģēšana =================== */
  const form = U.$('personForm');
  U.$('personFields').innerHTML = ui.fieldsHTML({ prefix: 'pf_', sectionIds: true });
  let editing = null;

  A.addPerson = () => openPerson(null);
  A.edit = (pid, el) => openPerson(pid, el?.dataset.sec);
  function openPerson(pid, sec) {
    editing = pid || null; const p = pid ? D.person(pid) : null;
    U.$('personTitle').textContent = p ? 'Rediģēt: ' + U.full(p) : 'Jauna persona';
    ui.datalists(); ui.fillForm(form, p ? D.formPerson(p) : null); delete form.dataset.warned; U.qsa('.duphint', form).forEach(x => x.remove());
    const st = form.elements.status; st.disabled = p?.status === 'archived';
    if (p?.status === 'archived') st.innerHTML = '<option value="archived">Arhīvā</option>'; else st.innerHTML = CP.FIELD.status.opts.map(([v, l]) => `<option value="${v}" ${v === (p?.status || 'active') ? 'selected' : ''}>${l}</option>`).join('');
    if (!p) form.elements.joined.value = U.iso();
    U.$('personDialog').showModal();
    const target = sec ? U.$('pf_sec_' + sec) : null;
    (target || form).scrollIntoView?.({ block: 'start' });
    setTimeout(() => (target?.querySelector('input,select,textarea') || form.elements.first).focus(), 30);
  }
  form.addEventListener('change', e => {
    if (e.target.name in D.PHONE_FIELDS) ui.phoneHints(form, editing);
    if (e.target.name === 'personalCode' && !form.elements.birth.value) form.elements.birth.value = U.birthFromCode(e.target.value);
    if (e.target.name === 'parentCode' || e.target.name === 'personalCode') delete form.dataset.warned;
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const o = ui.readForm(form);
    if (!o.birth && o.personalCode) o.birth = U.birthFromCode(o.personalCode);
    const chk = ui.checkForm(form, o);
    if (chk.errors) { ui.toast('Aizpildi obligātos laukus', 'err'); U.qs('.field.bad input', form)?.focus(); return; }
    const dupPhones = ui.phoneHints(form, editing);
    if ((chk.warnings || dupPhones) && !form.dataset.warned) { form.dataset.warned = '1'; ui.toast(dupPhones ? 'Tālruņa numurs sakrīt ar citas personas numuru (skat. pie lauka). Pārbaudi vai spied “Saglabāt” vēlreiz.' : 'Dažas vērtības izskatās aizdomīgas (iezīmētas). Labo vai spied “Saglabāt” vēlreiz, lai saglabātu tāpat.', 'warn', 8000); (U.qs('.field.warn input', form) || U.qs('.duphint.bad', form)?.closest('.field').querySelector('input'))?.focus(); return; }
    if (!editing) {
      const dup = D.duplicates(o);
      if (dup.length && !confirm(`Iespējams dublikāts: ${dup.map(U.full).join(', ')}.\n\nVienalga izveidot jaunu personu?`)) return;
    }
    savePerson(o, editing, 'update');
    U.$('personDialog').close(); CP.store.changed();
    if (editing) ui.toast('Izmaiņas saglabātas', 'ok');
    else if (D.contacts(D.person(S.selected)).some(c => U.normPhone(c.phone))) ui.toast('Persona pievienota.', 'ok', 9000, { label: '📇 Saglabāt kontaktos', act: 'vcard', arg: S.selected });
    else ui.toast('Persona pievienota', 'ok');
  });
  /** Izveido vai atjaunina personu un ieraksta auditā mainīto lauku nosaukumus (ne vērtības) */
  function savePerson(o, id, action) {
    if (id) {
      const p = D.person(id), changed = [];
      for (const [k, v] of Object.entries(o)) if (k in CP.FIELD && String(p[k] ?? '') !== String(v ?? '') && !(k === 'status' && p.status === 'archived')) { changed.push(CP.FIELD[k].l); p[k] = v; }
      if (p.status === 'archived') p.status = 'archived';
      if (changed.length) { p.updatedAt = U.now(); D.audit(id, action, changed); }
      const yearPatch = {};
      if ('group' in o) yearPatch.group = o.group || '';
      if (p.status === 'archived') yearPatch.status = 'archived';
      else if ('status' in o) yearPatch.status = o.status || 'active';
      D.bindYear(p, yearPatch);
      S.selected = id; return p;
    }
    const p = { ...o, id: U.uid(), status: o.status || 'active', createdAt: U.now(), updatedAt: U.now() };
    CP.store.assignFolder(p);
    S.db.people.push(p); D.bindYear(p, { group: p.group || '', status: p.status || 'active' }); D.audit(p.id, action === 'scan' ? 'scan' : 'create');
    if (S.root) CP.store.ensurePersonYearFolder(p).catch(e => ui.toast('Personas dokumentu mapi neizdevās izveidot: ' + e.message, 'warn'));
    S.selected = p.id; S.page = 'person'; S.tab = 'overview'; return p;
  }
  CP.people = { savePerson, openPerson };

  /* --- Arhīvs, atjaunošana, dzēšana --- */
  function archive(p, o) {
    p.status = 'archived'; p.left = o.left; p.reason = o.reason || ''; p.retentionMonths = Number(o.months ?? S.db.settings.retentionDefault); p.updatedAt = U.now();
    p.archiveSnapshot = {
      at: U.now(), left: p.left, reason: p.reason, retentionMonths: p.retentionMonths,
      documents: D.docsOf(p).map(d => ({ id: d.id, kind: d.kind, path: d.path || '', sourceId: d.sourceId || '', format: d.format || '', expires: d.expires || '', received: d.received || '' })),
      equipment: S.db.equipment.filter(e => e.personId === p.id).map(e => ({ id: e.id, item: e.item, inventory: e.inventory || '', size: e.size || '', qty: e.qty, issued: e.issued || '', due: e.due || '', returned: e.returned || '', returnNote: e.returnNote || '', notes: e.notes || '' }))
    };
    D.audit(p.id, 'archive', o.reason ? [o.reason] : []);
  }
  A.archive = pid => {
    const f = U.$('archiveForm'); f.reset(); f.dataset.pid = pid; f.elements.left.value = U.iso();
    f.elements.months.value = D.person(pid)?.retentionMonths ?? S.db.settings.retentionDefault;
    const person = D.person(pid), eq = D.openEquipment(person);
    U.$('archiveWarn').innerHTML = eq.length ? `<p class="warn">⚠ Nav atdots ekipējums: ${esc(eq.map(e => e.item).join(', '))}. Arhivēšana to nedzēš un neatgriež.</p>` : '';
    U.$('archiveDialog').showModal();
  };
  U.$('archiveForm').addEventListener('submit', e => {
    e.preventDefault(); const f = e.currentTarget, p = D.person(f.dataset.pid); if (!p) return;
    archive(p, Object.fromEntries(new FormData(f))); U.$('archiveDialog').close(); CP.store.changed(); ui.toast('Persona pārvietota uz arhīvu', 'ok');
  });
  A.restore = pid => { const p = D.person(pid); if (!p || !confirm('Atjaunot personu kā aktīvu?')) return; p.status = 'active'; p.updatedAt = U.now(); D.audit(pid, 'restore'); CP.store.changed(); };
  A.erase = pid => {
    const p = D.person(pid); if (!p) return;
    const db = S.db;
    const docs = db.documents.filter(d => d.personId === pid);
    const files = docs.filter(d => d.path);
    const eq = db.equipment.filter(e => e.personId === pid);
    U.$('eraseTitle').textContent = 'Dzēst reģistra ierakstu — ' + U.full(p);
    U.$('eraseBody').innerHTML = `<p>Tiks dzēsts <b>tikai ieraksts datubāzē</b>: kartīte, ${docs.length} dokumentu ieraksti, ${eq.length} ekipējuma ieraksti, vēsture, uzdevumi un saistības.</p>
      <p><b>Netiks dzēsts:</b></p>
      <ul class="small">
        <li>dokumentu faili mapēs (${files.length})</li>
        <li>JSON rezerves kopijas un datu arhīvi mapēs <b>_rezerves</b> un <b>_arhivi</b></li>
      </ul>
      ${files.length ? `<p class="small muted">Paliek faili:<br>${files.slice(0, 12).map(d => esc(d.path)).join('<br>')}${files.length > 12 ? '<br>…' : ''}</p>` : '<p class="small muted">Šai personai nav piesaistītu failu.</p>'}
      <p class="small">Rezerves kopijas jāpārskata pašam Iestatījumos. Sistēma tās nedzēš.</p>
      <div class="field"><label for="eraseLast">Apstiprinājumam ieraksti uzvārdu</label><input id="eraseLast" autocomplete="off"></div>`;
    U.$('eraseForm').dataset.pid = pid;
    U.$('eraseDialog').showModal();
    U.$('eraseLast').focus();
  };
  U.$('eraseForm').addEventListener('submit', e => {
    e.preventDefault();
    const pid = e.currentTarget.dataset.pid, p = D.person(pid); if (!p) return;
    if (U.norm(U.$('eraseLast').value) !== U.norm(p.last)) return ui.toast('Uzvārds nesakrīt — nekas netika dzēsts', 'warn');
    const db = S.db, nDocs = db.documents.filter(d => d.personId === pid).length, nFiles = db.documents.filter(d => d.personId === pid && d.path).length;
    db.people = db.people.filter(x => x.id !== pid); db.documents = db.documents.filter(d => d.personId !== pid);
    db.equipment = db.equipment.filter(x => x.personId !== pid); db.log = db.log.filter(x => x.personId !== pid);
    db.tasks = db.tasks.filter(x => x.personId !== pid); db.relations = db.relations.filter(r => r.a !== pid && r.b !== pid);
    db.audit = db.audit.filter(x => x.personId !== pid);
    db.audit.push({ id: U.uid(), personId: null, at: U.now(), action: 'erase', fields: [`dzēsts reģistra ieraksts un ${nDocs} dokumentu ieraksti; ${nFiles} faili un rezerves kopijas palika`] });
    U.$('eraseDialog').close();
    S.page = 'people'; CP.store.changed();
    ui.toast('Dzēsts tikai reģistra ieraksts. Faili un rezerves kopijas palika.', 'ok', 9000);
  });
  A.exportPerson = pid => {
    const p = D.person(pid), db = S.db;
    const out = { eksportēts: U.now(), persona: p, dokumenti: db.documents.filter(d => d.personId === pid), ekipējums: db.equipment.filter(e => e.personId === pid), vēsture: db.log.filter(l => l.personId === pid), uzdevumi: db.tasks.filter(t => t.personId === pid), izmaiņas: db.audit.filter(a => a.personId === pid) };
    U.download(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }), `Personas_dati_${p.last}_${p.first}_${U.iso()}.json`);
  };
})(window.CP);
