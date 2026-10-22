/* =====================================================================
   Dokumenti: personas dokumentu cilne, dokumentu reģistrs, skatītājs,
   failu pievienošana un piesaiste. Oriģinālie faili netiek pārvietoti.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const docs = {};

  const FORMAT = { paper: '📄 Papīrs', edoc: '✍ eDoc', pdf: '💻 Elektronisks' };
  const REVIEW = { received: 'Saņemts', checked: 'Pārbaudīts', clarify: 'Jāprecizē', missing: 'Trūkst' };
  const fmtTag = f => `<span class="tag">${FORMAT[f] || FORMAT.pdf}</span>`;
  const keyOf = (sid, path) => `${esc(sid || 'main')}|${esc(path)}`;
  const PILL = { available: 'ok', noaccess: 'bad', missing: 'bad', check: 'warn' };
  docs.statusOf = d => d._live || (d.path ? { state: d.fileState || 'check', detail: d.fileDetail || '' } : null);
  docs.statusHtml = d => {
    const st = docs.statusOf(d); if (!st) return '';
    const label = CP.FILE_STATUS[st.state] || st.state;
    return `<span class="pill ${PILL[st.state] || 'warn'}" data-docstatus="${esc(d.id)}" title="${esc(st.detail || label)}">${esc(label)}</span>`;
  };

  /** Mācību gadi, kuros personai ir mape ar dokumentiem (+ aktīvais) */
  function docYears(p) {
    const ys = new Set([D.activeYear()]);
    for (const d of D.docsOf(p)) { const m = /^Macibu_gadi\/([^/]+)\/Personas\//.exec(d.path || ''); if (m && (d.sourceId || 'main') === 'main') ys.add(m[1]); }
    return [...ys].sort();
  }
  /** Kur dokuments atrodas datorā: datu mape › … › fails */
  docs.where = (path, sid) => {
    const src = (sid || 'main') === 'main' ? (S.rootName || 'datu mape') : (S.roots.find(r => r.id === sid)?.name || 'papildu mape');
    return [src, ...String(path || '').split('/').filter(Boolean)];
  };
  const whereHtml = (path, sid) => { const b = docs.where(path, sid); return `<span class="docwhere" title="${esc(b.join(' / '))}">📁 ${b.slice(0, -1).map(esc).join(' <span class="muted">›</span> ')} <span class="muted">›</span> <b>${esc(b.at(-1))}</b></span>`; };
  /** Kartītē rādāmais nosaukums: kategorijai “Cits” — instruktora ierakstītais nosaukums */
  docs.label = d => (d.title && String(d.title).trim()) || d.kind;
  const needsTitle = kind => kind === 'Cits';
  function docRow(d, showPerson) {
    const exp = D.docExpiry(d) ? U.daysTo(D.docExpiry(d)) : null;
    const st = docs.statusOf(d);
    return `<div class="row doc">
      <div class="doc-ic">${/\.(jpe?g|png|webp|heic)$/i.test(d.path || '') ? '🖼' : /\.edoc$/i.test(d.path || '') ? '✍' : d.path ? '📄' : '🗂'}</div>
      <div class="grow">
        <div><b>${esc(docs.label(d))}</b>${d.title ? ` <span class="tag">${esc(d.kind)}</span>` : ''} ${fmtTag(d.format)} ${docs.statusHtml(d)} ${showPerson ? `· <a href="#" data-person="${d.personId}" data-goto="docs">${esc(U.full(D.person(d.personId)))}</a>` : ''}</div>
        <div class="small muted">${[d.yearId && esc(U.yearLabel(d.yearId)), d.kind === 'Līgums' ? (d.contractNo ? 'Nr. ' + esc(d.contractNo) : '<span class="warn">nav līguma numura</span>') : '', REVIEW[d.review] && esc(REVIEW[d.review]), !d.path && 'Elektronisks fails nav piesaistīts'].filter(Boolean).join(' · ')}${st?.detail && st.detail !== CP.FILE_STATUS[st.state] ? ' · ' + esc(st.detail) : ''}${d.received ? ' · saņemts ' + U.fmtDate(d.received) : ''}${d.issued ? ' · izsniegts ' + U.fmtDate(d.issued) : ''}${D.docExpiry(d) ? ` · <span class="${exp < 0 ? 'red' : exp <= 30 ? 'warn' : ''}">derīgs līdz ${U.fmtDate(D.docExpiry(d))}</span>` : (D.docRule(d.kind) ? ' · <span class="warn">nav norādīts izsniegšanas datums</span>' : '')}${D.docRule(d.kind)?.schoolYear && !D.docForYear(d, D.activeYear()) ? ' · <span class="warn">citam mācību gadam</span>' : ''}${d.notes ? ' · ' + esc(d.notes) : ''}</div>
        ${d.path ? `<div class="small">${whereHtml(d.path, d.sourceId)}</div>` : ''}
      </div>
      ${d.path ? `<button class="sm mainbtn" data-act="view" data-arg="${keyOf(d.sourceId, d.path)}">Atvērt</button>` : ''}
      ${d.path ? `<button class="sm" data-act="checkDoc" data-arg="${d.id}" title="Pārbaudīt, vai fails ir vietā un nav mainījies">Pārbaudīt</button><button class="sm" data-act="relinkDoc" data-arg="${d.id}">Atjaunot sasaisti</button>` : ''}
      ${d.path && /\.(pdf|docx|edoc|asice|jpe?g|png)$/i.test(d.path) ? `<button class="sm" data-act="readDoc" data-arg="${d.id}" title="Nolasīt datus no šī dokumenta kartiņā">📥 Nolasīt</button>` : ''}
      <button class="sm" data-act="editDoc" data-arg="${d.id}" title="Labot dokumenta datus (veids, datumi, statuss)">✎ Labot</button>
      <button class="sm" data-act="replaceDoc" data-arg="${d.id}" title="Aizstāt failu ar jaunu (vecais paliek mapē)">⇄ Aizstāt failu</button>
      <button class="sm ghost danger" data-act="delDoc" data-arg="${d.id}" title="Dzēst ierakstu (fails mapē paliek)">✕ Dzēst</button></div>`;
  }

  /* --- Personas cilne --- */
  docs.personTab = p => {
    const list = D.docsOf(p).sort((a, b) => U.cmp(a.kind, b.kind)), miss = D.missingDocs(p);
    const linked = new Set(list.map(d => (d.sourceId || 'main') + '|' + d.path));
    const fn = U.norm(p.first), ln = U.norm(p.last);
    const sugg = fn && ln ? S.index.filter(f => f.n.includes(ln) && f.n.includes(fn) && !linked.has(f.sourceId + '|' + f.path)).slice(0, 40) : [];
    // Obligātie dokumenti (✓/✗, pievienot, labot, aizstāt, dzēst, atgādināt) ir sānjoslā — šeit netiek dublēti
    void miss;
    // Sadaļas “Dokumentu mape” un “Mapē atrasti faili” sākumā aizvērtas; atvērtas paliek tikai, kamēr instruktors ir šajā kartiņā
    const sec = S.docSec && S.docSec.pid === p.id ? S.docSec : (S.docSec = { pid: p.id, tree: false, sugg: false });
    return `<section class="card"><h3>Visi personas dokumenti (${list.length})<span class="right actions"><button class="sm" data-act="attach" data-arg="${p.id}">📎 Pievienot skenētu dokumentu</button></span></h3>
        <div class="dropzone" data-drop="${p.id}">${list.map(d => docRow(d, false)).join('') || '<p class="muted small">Nav dokumentu. Ievelc failus šeit vai spied “Pievienot skenētu dokumentu”.</p>'}</div></section>
      <details class="card docbrowser docsec" data-docsec="tree" ${sec.tree ? 'open' : ''}><summary><h3>Dokumentu mape <span class="tag">${esc(U.yearLabel(D.activeYear()))}</span> <span class="muted small docsec-hint">visi faili personas mapē datorā</span></h3></summary>
        ${(() => { const ys = docYears(p), cur = S.browse.pid === p.id && S.browse.year ? S.browse.year : D.activeYear();
          return ys.length > 1 ? `<div class="actions docsec-years"><span class="small muted">Mācību gads:</span>${ys.map(y => `<button type="button" class="sm ${y === cur ? 'on' : ''}" data-act="docYear" data-arg="${esc(y)}">${esc(U.yearLabel(y))}${y === D.activeYear() ? ' · tagad' : ''}</button>`).join('')}</div>` : ''; })()}
        <p class="small docsec-where" id="docWhere"></p>
        <div class="actions docsec-acts"><button class="sm" data-act="docMkdir" data-arg="${p.id}">Jauna mape</button><button class="sm mainbtn" data-act="docAddOpen" data-arg="${p.id}">Pievienot failu</button><button class="sm" data-act="docRefresh" data-arg="${p.id}">Atsvaidzināt</button></div>
        <div class="crumbs" id="docCrumbs"></div>
        <input id="docTreeQ" type="search" placeholder="Meklēt dokumenta nosaukumā…" value="${esc(S.browse.q || '')}">
        <p class="muted small">Meklēšana skatās nosaukumus un ceļus, nevis failu saturu. Oriģināls datorā netiek dzēsts.</p>
        <div id="docTree" class="dropzone" data-drop="${p.id}"><p class="muted small">Ielādē mapi…</p></div></details>
      ${sugg.length ? `<details class="card docsec" data-docsec="sugg" ${sec.sugg ? 'open' : ''}><summary><h3>Mapē atrasti faili ar šo vārdu (${sugg.length}) <span class="muted small docsec-hint">vēl nav piesaistīti</span></h3></summary><p class="muted small">Piesaisti ar vienu klikšķi — kategorija noteikta pēc faila nosaukuma.</p>
        ${sugg.map(f => `<div class="row"><div class="grow"><b>${esc(f.name)}</b><div class="small">${whereHtml(f.path, f.sourceId)}</div></div>
          <button class="sm" data-act="view" data-arg="${keyOf(f.sourceId, f.path)}">Skatīt</button>
          <button class="sm mainbtn" data-act="quickLink" data-arg="${keyOf(f.sourceId, f.path)}">＋ ${needsTitle(D.guessKind(f.name)) ? 'Piesaistīt…' : esc(D.guessKind(f.name))}</button>
          <button class="sm" data-act="associate" data-arg="${keyOf(f.sourceId, f.path)}">Cita…</button>
          ${f.sourceId === 'main' ? `<button class="sm ghost danger" data-act="docDelFile" data-arg="${keyOf(f.sourceId, f.path)}" title="Dzēst failu datorā">✕ Dzēst</button>` : ''}</div>`).join('')}</details>`
        : (S.root ? '' : '<p class="muted small">Izvēlies datu mapi, lai pievienotu failus un meklētu esošos.</p>')}`;
  };
  // atvērtās/aizvērtās sadaļas stāvoklis paliek, kamēr kartiņa pārzīmējas
  document.addEventListener('toggle', e => {
    const k = e.target?.dataset?.docsec; if (!k || !S.docSec) return;
    S.docSec[k] = e.target.open;
  }, true);

  /* --- Dokumentu lapa --- */
  CP.pages.documents = {
    render() {
      const P = S.docsPage, q = U.norm(P.q);
      const head = ui.pageHead('Dokumenti', `${S.db.documents.length} reģistrēti dokumenti · ${S.index.length} faili ${S.roots.length} mapēs`,
        `<button data-act="checkDocs">Pārbaudīt pieejamību</button><button data-act="extra">＋ Papildu mape</button><button data-act="rescan">⟳ Pārskenēt</button>`);
      const tabs = `<nav class="tabs"><button class="${P.show === 'linked' ? 'active' : ''}" data-act="docsShow" data-arg="linked">Reģistrētie</button><button class="${P.show === 'missing' ? 'active' : ''}" data-act="docsShow" data-arg="missing">Trūkstošie</button><button class="${P.show === 'files' ? 'active' : ''}" data-act="docsShow" data-arg="files">Faili mapēs</button></nav>`;
      let body = '';
      if (P.show === 'linked') {
        const list = S.db.documents.filter(d => D.inYear(D.person(d.personId)) && (!P.kind || d.kind === P.kind) && (!q || U.norm(d.kind + ' ' + (d.title || '') + ' ' + d.path + ' ' + U.full(D.person(d.personId))).includes(q)))
          .sort((a, b) => U.cmp(U.sortName(D.person(a.personId)), U.sortName(D.person(b.personId))));
        body = `<div class="filters card"><input id="docsQ" type="search" placeholder="Meklēt pēc personas, kategorijas, faila…" value="${esc(P.q)}"><select data-docs="kind"><option value="">Visas kategorijas</option>${ui.kindOptions(P.kind)}</select></div>
          <section class="card" id="docsBody">${list.map(d => docRow(d, true)).join('') || '<p class="muted">Nav dokumentu.</p>'}</section>`;
      } else if (P.show === 'missing') {
        const rows = D.peopleInYear().filter(p => p.status !== 'archived').map(p => ({ p, m: D.missingDocs(p) })).filter(x => x.m.length).sort((a, b) => U.cmp(U.sortName(a.p), U.sortName(b.p)));
        body = `<section class="card">${rows.map(x => `<div class="row"><div class="who">${ui.avatar(x.p, 'sm')}<span><b>${esc(U.sortName(x.p))}</b><small class="muted">${esc(D.groupOf(x.p) || '')}</small></span></div><div class="grow chips">${x.m.map(k => `<span class="chip miss">${esc(k)}</span>`).join('')}</div><button class="sm" data-person="${x.p.id}" data-goto="docs">Atvērt</button></div>`).join('') || '<p class="muted">Visiem ir visi obligātie dokumenti. 🎉</p>'}</section>`;
      } else {
        body = `<section class="card"><input id="fileSearch" type="search" placeholder="Meklēt faila nosaukumā vai ceļā…" value="${esc(P.q)}"><p class="muted small">Tiek lasīti tikai failu nosaukumi un ceļi, nevis saturs.</p><div id="fileResults">${fileResults()}</div></section>`;
      }
      return `<div class="page">${head}${tabs}${body}</div>`;
    }
  };
  function fileResults() {
    const q = U.norm(S.docsPage.q), arr = S.index.filter(x => x.n.includes(q)).slice(0, 150);
    if (!S.root) return '<p class="muted">Vispirms izvēlies datu mapi.</p>';
    return arr.map(x => `<div class="row"><div class="grow"><b>${esc(x.name)}</b><div class="small muted">${esc(x.sourceName)} / ${esc(x.path)}</div></div><button class="sm" data-act="view" data-arg="${keyOf(x.sourceId, x.path)}">Skatīt</button><button class="sm" data-act="associate" data-arg="${keyOf(x.sourceId, x.path)}">Piesaistīt</button></div>`).join('') || '<p class="muted">Nekas netika atrasts.</p>';
  }
  CP.inputHandlers.push(e => {
    if (e.target.id === 'fileSearch') { S.docsPage.q = e.target.value; U.$('fileResults').innerHTML = fileResults(); return true; }
    if (e.target.id === 'docsQ') { S.docsPage.q = e.target.value; const pos = e.target.selectionStart; CP.render(); const el = U.$('docsQ'); el.focus(); el.setSelectionRange(pos, pos); return true; }
    return false;
  });
  CP.changeHandlers.push(e => {
    if (e.target.dataset.docs) { S.docsPage[e.target.dataset.docs] = e.target.value; CP.render(); return true; }
    return false;
  });
  A.docsShow = k => { S.docsPage.show = k; S.docsPage.q = ''; CP.render(); };
  A.rescan = () => CP.store.scanAll();
  A.extra = () => CP.store.addExtra();

  /* --- Saites un ieraksti --- */
  docs.link = (personId, kind, format, path, sourceId, extra = {}) => {
    if (S.db.documents.some(x => x.personId === personId && x.path === path && (x.sourceId || 'main') === (sourceId || 'main'))) { ui.toast('Šis fails jau ir piesaistīts', 'warn'); return false; }
    const id = U.uid(); docs.lastLinked = id;
    S.db.documents.push({ id, personId, kind, format, path, sourceId: sourceId || 'main', received: U.iso(), addedAt: U.now(), yearId: D.activeYear(), ...extra });
    D.audit(personId, 'doc-add', [kind]); return true;
  };
  const splitKey = a => { const i = a.indexOf('|'); return [a.slice(0, i), a.slice(i + 1)]; };
  A.quickLink = a => {
    const [sid, path] = splitKey(a), f = S.index.find(x => x.sourceId === sid && x.path === path); if (!f) return;
    if (needsTitle(D.guessKind(f.name))) return A.associate(a);
    if (docs.link(S.selected, D.guessKind(f.name), f.ext === 'edoc' ? 'edoc' : 'pdf', f.path, f.sourceId)) { CP.store.changed(); ui.toast('Piesaistīts: ' + D.guessKind(f.name), 'ok'); }
  };
  let assoc = null;
  A.associate = a => {
    const [sid, path] = splitKey(a);
    assoc = S.index.find(f => f.sourceId === sid && f.path === path);
    if (!assoc) { const name = path.split('/').pop(); assoc = { sourceId: sid || 'main', path, name, ext: (name.split('.').pop() || '').toLowerCase() }; }
    ui.personOptions('associatePerson', S.selected); U.$('associateKind').innerHTML = ui.kindOptions(D.guessKind(assoc.name));
    U.$('associateTitle').value = '';
    U.$('associateName').innerHTML = whereHtml(assoc.path, assoc.sourceId); U.$('associateFormat').value = assoc.ext === 'edoc' ? 'edoc' : 'pdf'; assocTitleUi(); U.$('associateDialog').showModal();
  };
  function assocTitleUi() {
    const kind = U.$('associateKind').value, on = needsTitle(kind), lig = kind === 'Līgums';
    U.$('associateTitleWrap').classList.toggle('hidden', !on); U.$('associateNoWrap').classList.toggle('hidden', !lig);
    if (lig && !U.$('associateNo').value) { const p = D.person(U.$('associatePerson').value); if (p?.contractNo) U.$('associateNo').value = p.contractNo; }
    if (on) setTimeout(() => U.$('associateTitle').focus(), 30); else if (lig) setTimeout(() => U.$('associateNo').focus(), 30);
  }
  U.$('associateKind').addEventListener('change', assocTitleUi);
  U.$('associateConfirm').onclick = () => {
    if (!assoc) return;
    const kind = U.$('associateKind').value, title = U.$('associateTitle').value.trim(), no = U.$('associateNo').value.trim();
    if (needsTitle(kind) && !title) { U.$('associateTitle').focus(); return ui.toast('Ieraksti dokumenta nosaukumu — kategorijai “Cits” tas ir obligāts', 'warn'); }
    if (kind === 'Līgums' && !no) { U.$('associateNo').focus(); return ui.toast('Ieraksti līguma numuru — līgumam tas ir obligāts', 'warn'); }
    if (docs.link(U.$('associatePerson').value, kind, U.$('associateFormat').value, assoc.path, assoc.sourceId, { review: 'received', ...(needsTitle(kind) ? { title } : {}), ...(kind === 'Līgums' ? { contractNo: no } : {}) })) {
      if (kind === 'Līgums') rememberContractNo(U.$('associatePerson').value, no);
      CP.store.changed(); ui.toast('Fails piesaistīts — redzams sadaļā “Visi personas dokumenti”', 'ok');
    }
    U.$('associateDialog').close();
  };
  A.delDoc = id => {
    const d = S.db.documents.find(x => x.id === id); if (!d || !confirm(`Dzēst dokumenta ierakstu “${d.kind}”?\n\nIeraksts tiek noņemts no kartītes. Pats fails datu mapē netiek dzēsts.`)) return;
    S.db.documents = S.db.documents.filter(x => x.id !== id); D.audit(d.personId, 'doc-remove', [d.kind]); CP.store.changed();
  };

  /* --- Dokumenta dialogs (jauns papīra dokuments / rediģēšana) --- */
  const dform = U.$('documentForm');
  A.addDoc = arg => {
    if (!S.db.people.length) return ui.toast('Vispirms pievieno personu', 'warn');
    const [pid, kind] = String(arg || '').split('|');
    endCopyUi(); dform.reset(); dform.dataset.edit = ''; U.$('docTitle').textContent = 'Reģistrēt dokumentu';
    ui.personOptions('docPerson', pid || S.selected); U.$('docKind').innerHTML = ui.kindOptions(kind || '');
    dform.elements.received.value = U.iso(); dform.elements.format.value = 'paper'; dform.dataset.autoExp = '1'; docRuleUi(); U.$('documentDialog').showModal();
  };
  const isContract = kind => kind === 'Līgums';
  /** Kartītes “Līguma Nr.” ir tas pats numurs, ko instruktors ieraksta pie līguma dokumenta. Maiņa pārraksta iepriekšējo. */
  function rememberContractNo(personId, no) {
    const p = D.person(personId), n = String(no || '').trim(); if (!p || !n || p.contractNo === n) return;
    p.contractNo = n; D.audit(personId, 'update', ['Līguma Nr.']);
  }
  /** Ārsta izziņa u.c.: prasa izsniegšanas datumu, termiņu aprēķina pats (var labot). Līgumam — numurs. */
  function docRuleUi() {
    const kind = dform.elements.kind.value, r = D.docRule(kind), iss = dform.elements.issued, exp = dform.elements.expires;
    const tn = needsTitle(kind), lig = isContract(kind);
    U.$('docTitleWrap').classList.toggle('hidden', !tn && !dform.elements.title.value); dform.elements.title.required = tn;
    U.$('docNoWrap').classList.toggle('hidden', !lig); dform.elements.contractNo.required = lig;
    if (lig && !dform.elements.contractNo.value) { const p = D.person(dform.elements.personId.value); if (p?.contractNo) dform.elements.contractNo.value = p.contractNo; }
    U.$('docIssuedLbl').innerHTML = r ? `${U.esc(kind)}: izsniegšanas datums <b class="red">*</b>` : 'Dokumenta datums (izsniegts)';
    iss.required = !!r;
    const arc = (S.db.settings.archiveDocs || []).includes(kind);
    U.$('docPaperHint').textContent = r ? 'Ārsta izziņas papīrs paliek pie instruktora — vari pierakstīt, kur to glabā.' : arc ? 'Papīra oriģināls jānodod Centra arhīvam (atzīme kartītē “Reģistrācija un arhīvs”).' : '';
    if (r && iss.value && (dform.dataset.autoExp || !exp.value)) { exp.value = D.docExpiry({ kind, issued: iss.value }); dform.dataset.autoExp = '1'; }
    U.$('docExpHint').textContent = r ? `Derīga ${r.months} mēn. no izsniegšanas${r.schoolYear ? ' un tikai savā mācību gadā — rīks atgādinās pirms termiņa, mācību gada beigās un jaunā gada sākumā' : ''}.` : '';
  }
  dform.addEventListener('change', e => { if (e.target.name === 'expires') dform.dataset.autoExp = ''; if (['kind', 'issued'].includes(e.target.name)) docRuleUi(); });
  A.editDoc = id => {
    const d = S.db.documents.find(x => x.id === id); if (!d) return;
    dform.reset(); dform.dataset.edit = id; U.$('docTitle').textContent = 'Rediģēt dokumentu';
    ui.personOptions('docPerson', d.personId, true); U.$('docKind').innerHTML = ui.kindOptions(d.kind);
    for (const k of ['format', 'received', 'issued', 'expires', 'notes', 'review', 'title', 'contractNo']) if (dform.elements[k]) dform.elements[k].value = d[k] || '';
    dform.dataset.autoExp = d.expires && d.expires === D.docExpiry({ ...d, expires: '' }) ? '1' : '';
    docRuleUi(); U.$('documentDialog').showModal();
  };
  dform.addEventListener('submit', e => {
    e.preventDefault(); const o = Object.fromEntries(new FormData(dform));
    if (dform.dataset.copying === '1') return ui.toast('Fails vēl tiek kopēts — uzgaidi, līdz josla ir pilna.', 'warn');
    o.title = String(o.title || '').trim();
    o.contractNo = isContract(o.kind) ? String(o.contractNo || '').trim() : '';
    if (needsTitle(o.kind) && !o.title) { dform.elements.title.focus(); return ui.toast('Ieraksti dokumenta nosaukumu — kategorijai “Cits” tas ir obligāts', 'warn'); }
    if (isContract(o.kind) && !o.contractNo) { dform.elements.contractNo.focus(); return ui.toast('Ieraksti līguma numuru — līgumam tas ir obligāts', 'warn'); }
    if (dform.dataset.edit) Object.assign(S.db.documents.find(x => x.id === dform.dataset.edit), o);
    else { S.db.documents.push({ ...o, id: U.uid(), path: '', sourceId: '', addedAt: U.now(), yearId: o.yearId || U.yearOfDate(o.received) || D.activeYear() }); D.audit(o.personId, 'doc-add', [o.kind]); }
    if (isContract(o.kind)) rememberContractNo(o.personId, o.contractNo);
    U.$('documentDialog').close(); CP.store.changed();
  });

  /* --- Failu pievienošana (iekopē personas mapē) --- */
  let attachCtx = null;
  A.attach = arg => {
    if (!S.root) return ui.toast('Vispirms izvēlies datu mapi', 'warn');
    const [pid, kind] = String(arg).split('|'); attachCtx = { pid, kind, sub: '' }; U.$('attachFile').click();
  };
  U.$('attachFile').addEventListener('change', async e => {
    const files = [...e.target.files]; e.target.value = ''; if (attachCtx) await docs.addFiles(attachCtx.pid, files, attachCtx.kind, attachCtx.sub || '');
  });
  let copyAc = null;
  const saveBtn = () => dform.querySelector('[type=submit]');
  function copyUi(state, text, pct) {
    const box = U.$('docCopy'); if (!box) return;
    box.classList.toggle('hidden', !state);
    box.classList.toggle('done', state === 'done');
    box.classList.toggle('bad', state === 'bad');
    U.$('docCopyTxt').textContent = text || '';
    U.$('docCopyBar').style.width = Math.max(0, Math.min(100, pct || 0)) + '%';
  }
  function fileJob(on, text, pct) {
    const el = U.$('fileJob'); if (!el) return;
    el.hidden = !on;
    if (!on) return;
    U.$('fileJobTxt').textContent = text || '';
    U.$('fileJobBar').style.width = Math.max(0, Math.min(100, pct || 0)) + '%';
  }
  function endCopyUi() {
    dform.dataset.copying = '';
    if (saveBtn()) saveBtn().disabled = false;
    copyUi('', '', 0);
  }
  function contractOpen() { return !!(dform.dataset.edit && isContract(dform.elements.kind.value) && !String(dform.elements.contractNo.value || '').trim()); }
  U.$('documentDialog').addEventListener('cancel', e => {
    if (dform.dataset.copying === '1') { if (!confirm('Faila kopēšana vēl nav pabeigta. Pārtraukt? Fails netiks pievienots.')) e.preventDefault(); return; }
    if (contractOpen()) { e.preventDefault(); dform.elements.contractNo.focus(); ui.toast('Ieraksti līguma numuru — bez tā līgumu nevar pabeigt.', 'warn'); }
  });
  U.$('documentDialog').addEventListener('click', e => {
    if (!e.target.closest('[data-close="documentDialog"]')) return;
    if (dform.dataset.copying === '1') { if (!confirm('Faila kopēšana vēl nav pabeigta. Pārtraukt? Fails netiks pievienots.')) { e.stopPropagation(); e.preventDefault(); } return; }
    if (contractOpen()) { e.stopPropagation(); e.preventDefault(); dform.elements.contractNo.focus(); ui.toast('Ieraksti līguma numuru — bez tā līgumu nevar pabeigt.', 'warn'); }
  }, true);
  U.$('documentDialog').addEventListener('close', () => {
    if (copyAc) { copyAc.abort(); copyAc = null; }
    endCopyUi();
  });
  /** Viens fails: logs atveras uzreiz, kopēšana redzama joslā, datus var rakstīt pa to laiku. */
  async function copyIntoDialog(p, f, kindHint, rel) {
    const kind = kindHint || D.guessKind(f.name);
    const ac = new AbortController(); copyAc = ac;
    dform.reset(); dform.dataset.edit = ''; dform.dataset.copying = '1';
    U.$('docTitle').textContent = 'Dokuments';
    ui.personOptions('docPerson', p.id); U.$('docKind').innerHTML = ui.kindOptions(kind);
    dform.elements.received.value = U.iso();
    dform.elements.format.value = /\.edoc$/i.test(f.name) ? 'edoc' : 'pdf';
    dform.elements.review.value = 'received';
    docRuleUi();
    if (saveBtn()) saveBtn().disabled = true;
    copyUi('run', `Sagatavo mapi un kopē “${f.name}”…`, 4);
    if (!U.$('documentDialog').open) U.$('documentDialog').showModal();
    if (isContract(kind)) setTimeout(() => { if (dform.dataset.copying === '1') dform.elements.contractNo.focus(); }, 40);
    const pct = (done, total) => total ? Math.round(done / total * 100) : 8;
    try {
      await CP.store.ensurePersonYearFolder(p);
      if (ac.signal.aborted) return;
      const parts = [...CP.store.yearPersonDir(p), ...String(rel || '').split('/').filter(Boolean)];
      const name = kind === D.MTL ? `${D.MTL} ${U.iso()}.${(f.name.split('.').pop() || 'pdf').toLowerCase()}` : f.name;
      copyUi('run', `Kopē “${f.name}”…`, 8);
      const path = await CP.store.saveFile(parts, name, f, {
        confirmConflict: true, signal: ac.signal,
        onProgress: (done, total) => { if (!ac.signal.aborted && U.$('documentDialog').open) copyUi('run', `Kopē “${f.name}”… ${pct(done, total)}%`, pct(done, total)); }
      });
      if (ac.signal.aborted || !U.$('documentDialog').open) return;
      if (!path) { copyAc = null; U.$('documentDialog').close(); ui.toast('Fails netika pievienots.', 'warn'); return; }
      const savedKind = dform.elements.kind.value || kind;
      const format = /\.edoc$/i.test(name) ? 'edoc' : (dform.elements.format.value || 'pdf');
      if (!docs.link(p.id, savedKind, format, path, 'main', { size: f.size, review: 'received' })) { copyAc = null; U.$('documentDialog').close(); return; }
      CP.store.changed();
      dform.dataset.edit = docs.lastLinked;
      dform.dataset.copying = '';
      if (saveBtn()) saveBtn().disabled = false;
      copyUi('done', '✓ Fails iekopēts. Pārbaudi datus un spied “Saglabāt”.', 100);
      const focus = isContract(savedKind) && !dform.elements.contractNo.value ? dform.elements.contractNo : (D.docRule(savedKind) && !dform.elements.issued.value ? dform.elements.issued : null);
      if (focus && !dform.contains(document.activeElement)) focus.focus();
    } catch (err) {
      if (ac.signal.aborted || err.name === 'AbortError') return;
      dform.dataset.copying = '';
      if (saveBtn()) saveBtn().disabled = true;
      copyUi('bad', 'Neizdevās iekopēt: ' + err.message, 0);
      ui.toast('Neizdevās saglabāt ' + f.name + ': ' + err.message, 'err', 9000);
    } finally { if (copyAc === ac) copyAc = null; }
  }
  docs.addFiles = async (pid, files, kind, subRel) => {
    const p = D.person(pid); if (!p || !files.length) return;
    if (!S.root) return ui.toast('Vispirms izvēlies datu mapi', 'warn');
    const rel = subRel != null ? subRel : '';
    if (files.length === 1) return copyIntoDialog(p, files[0], kind, rel);
    let n = 0;
    try { await CP.store.ensurePersonYearFolder(p); }
    catch (err) { ui.toast('Personas mape nav pieejama: ' + err.message + '. Sasaistes paliek.', 'err'); return; }
    const parts = [...CP.store.yearPersonDir(p), ...String(rel || '').split('/').filter(Boolean)];
    fileJob(true, `Kopē failus… 0/${files.length}`, 0);
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const name = kind === D.MTL ? `${D.MTL} ${U.iso()}.${(f.name.split('.').pop() || 'pdf').toLowerCase()}` : f.name;
        fileJob(true, `Kopē “${f.name}” (${i + 1}/${files.length})…`, Math.round(i / files.length * 100));
        const path = await CP.store.saveFile(parts, name, f, {
          confirmConflict: true,
          onProgress: (done, total) => fileJob(true, `Kopē “${f.name}” (${i + 1}/${files.length})… ${total ? Math.round(done / total * 100) : ''}%`, Math.round((i + (total ? done / total : 0)) / files.length * 100))
        });
        if (!path) continue;
        const format = /\.edoc$/i.test(name) ? 'edoc' : 'pdf';
        if (docs.link(p.id, kind || D.guessKind(f.name), format, path, 'main', { size: f.size, review: 'received' })) n++;
      } catch (err) { ui.toast('Neizdevās saglabāt ' + f.name + ': ' + err.message, 'err'); }
    }
    fileJob(false);
    if (n) {
      CP.store.changed();
      ui.toast(`Pievienoti ${n} faili personas mapē. Oriģināli nav dzēsti.`, 'ok', 7000, n === 1 ? { act: 'editDoc', arg: docs.lastLinked, label: '✎ Labot datus' } : null);
    }
  };
  /** Aizstāt dokumenta failu ar jaunu (vecais fails paliek mapē, ierakstā saglabājas versiju vēsture) */
  let replaceId = null;
  A.replaceDoc = id => { if (!S.root) return CP.needRoot?.(); replaceId = id; U.$('replaceFile').click(); };
  U.$('replaceFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; const d = S.db.documents.find(x => x.id === replaceId); if (!f || !d) return;
    const p = D.person(d.personId);
    try {
      fileJob(true, `Aizstāj failu “${f.name}”…`, 6);
      await CP.store.ensurePersonYearFolder(p);
      const path = await CP.store.saveFile(CP.store.yearPersonDir(p), f.name, f, { confirmConflict: true, onProgress: (done, total) => fileJob(true, `Aizstāj “${f.name}”… ${total ? Math.round(done / total * 100) : ''}%`, total ? Math.round(done / total * 100) : 8) });
      fileJob(false);
      if (!path) return;
      if (d.path) (d.versions = d.versions || []).push({ path: d.path, sourceId: d.sourceId || 'main', at: d.replacedAt || d.addedAt });
      Object.assign(d, { path, sourceId: 'main', format: /\.edoc$/i.test(f.name) ? 'edoc' : (d.format === 'paper' ? 'pdf' : d.format || 'pdf'), size: f.size, replacedAt: U.now(), fileState: 'check', _live: null });
      D.audit(d.personId, 'update', [`Aizstāts fails: ${d.kind}`]); CP.store.changed();
      ui.toast('Fails aizstāts. Iepriekšējais fails paliek personas mapē.', 'ok', 7000, { act: 'editDoc', arg: d.id, label: '✎ Labot datus' });
    } catch (err) { fileJob(false); ui.toast('Neizdevās aizstāt: ' + err.message, 'err', 9000); }
  });
  // Failu ievilkšana kartiņas dokumentu sarakstā
  document.addEventListener('dragover', e => { const z = e.target.closest?.('[data-drop]'); if (z) { e.preventDefault(); z.classList.add('over'); } });
  document.addEventListener('dragleave', e => { e.target.closest?.('[data-drop]')?.classList.remove('over'); });
  document.addEventListener('drop', e => { const z = e.target.closest?.('[data-drop]'); if (!z) return; e.preventDefault(); z.classList.remove('over'); docs.addFiles(z.dataset.drop, [...e.dataTransfer.files], '', S.browse.pid === z.dataset.drop ? (S.browse.rel || '') : ''); });

  /* --- Skatītājs: PDF, attēli, teksts, Word (.docx), eDoc konteineri, Excel (.xlsx) un CSV — viss rīkā, bez lejupielādes --- */
  let view = null, viewGen = 0;
  const MIME = { pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml' };
  const extOf = n => (String(n).split('.').pop() || '').toLowerCase();
  const pick = n => /\.pdf$/i.test(n) ? 0 : /\.docx$/i.test(n) ? 1 : /\.(jpe?g|png)$/i.test(n) ? 2 : 3;
  const objUrl = blob => { const u = URL.createObjectURL(blob); view?.urls.push(u); return u; };
  async function renderInto(box, file, depth = 0) {
    const name = file.name, ext = extOf(name), type = MIME[ext] || file.type || '';
    if (/^(edoc|asice|bdoc|sce)$/.test(ext) && depth < 2) {
      const z = await U.unzip(await file.arrayBuffer(), n => !/^META-INF\//i.test(n) && !/mimetype$/i.test(n) && !n.endsWith('/'));
      const inner = [...z.keys()].sort((x, y) => pick(x) - pick(y));
      if (!inner.length) return box.innerHTML = ui.empty('eDoc konteinerī nav atrasts neviens dokuments.');
      const bar = document.createElement('div'); bar.className = 'view-edoc small';
      bar.innerHTML = `✍ Parakstīts eDoc konteiners · ${inner.length > 1 ? 'dokumenti: ' + inner.map((n, i) => `<button type="button" class="sm ${i ? '' : 'on'}" data-edoc="${i}">${esc(n.split('/').pop())}</button>`).join(' ') : 'saturs: <b>' + esc(inner[0].split('/').pop()) + '</b>'} <span class="muted">· paraksta derīgumu pārbauda eParakstītājs 3.0</span>`;
      const body = document.createElement('div'); body.className = 'view-inner';
      box.innerHTML = ''; box.append(bar, body);
      const show = async i => { bar.querySelectorAll('[data-edoc]').forEach(b => b.classList.toggle('on', +b.dataset.edoc === i)); body.innerHTML = '<p class="muted pad">Atver…</p>'; const n = inner[i].split('/').pop(); await renderInto(body, new File([await z.get(inner[i])()], n, { type: MIME[extOf(n)] || '' }), depth + 1); };
      bar.addEventListener('click', e => { const b = e.target.closest('[data-edoc]'); if (b) show(+b.dataset.edoc).catch(err => body.innerHTML = ui.empty('Neizdevās atvērt: ' + esc(err.message))); });
      return show(0);
    }
    if (/^image\//.test(type) && ext !== 'heic' && ext !== 'tif' && ext !== 'tiff') return box.innerHTML = `<img class="viewimg" src="${objUrl(new Blob([file], { type }))}" alt="">`;
    if (type === 'application/pdf' || ext === 'txt') return box.innerHTML = `<iframe class="viewer" src="${objUrl(new Blob([file], { type: type || 'text/plain' }))}" title="${esc(name)}"></iframe>`;
    if (ext === 'docx') {
      box.innerHTML = '<p class="muted pad">Sagatavo Word dokumentu…</p>';
      await CP.reader.loadScript(CP.VENDOR + 'docx/jszip.min.js');
      await CP.reader.loadScript(CP.VENDOR + 'docx/docx-preview.min.js');
      const holder = document.createElement('div'); holder.className = 'docx-holder view-docx';
      await window.docx.renderAsync(file, holder, null, { inWrapper: false, breakPages: true, ignoreLastRenderedPageBreak: false, useBase64URL: true, renderHeaders: true, renderFooters: true });
      box.innerHTML = ''; box.appendChild(holder); return;
    }
    if (ext === 'xlsx' || ext === 'csv') {
      const sheets = ext === 'xlsx' ? await CP.sheetReader.xlsx(file) : [{ name, rows: CP.sheetReader.csv(await file.text()) }];
      const vis = sheets.filter(s => !s.hidden && s.rows.some(r => r.some(v => v !== '')));
      if (!vis.length) return box.innerHTML = ui.empty('Tabulā nav datu.');
      const tbl = s => { const w = Math.min(60, Math.max(...s.rows.map(r => r.length))); return `<div class="view-sheet"><table class="table"><tbody>${s.rows.slice(0, 2000).map(r => `<tr>${Array.from({ length: w }, (_, i) => `<td>${esc(r[i] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>${s.rows.length > 2000 ? `<p class="muted small">… rādītas pirmās 2000 rindas no ${s.rows.length}</p>` : ''}</div>`; };
      box.innerHTML = (vis.length > 1 ? `<nav class="tabs view-tabs">${vis.map((s, i) => `<button type="button" class="${i ? '' : 'active'}" data-sheet="${i}">${esc(s.name)}</button>`).join('')}</nav>` : '') + `<div class="view-sheetbox">${tbl(vis[0])}</div>`;
      box.querySelector('.view-tabs')?.addEventListener('click', e => { const b = e.target.closest('[data-sheet]'); if (!b) return; box.querySelectorAll('[data-sheet]').forEach(x => x.classList.toggle('active', x === b)); box.querySelector('.view-sheetbox').innerHTML = tbl(vis[+b.dataset.sheet]); });
      return;
    }
    const why = ext === 'doc' ? 'Vecais Word .doc formāts pārlūkā nav attēlojams — atver to Word un saglabā kā .docx vai PDF.'
      : ext === 'xls' ? 'Vecais Excel .xls formāts pārlūkā nav attēlojams — saglabā to kā .xlsx.'
      : /^(heic|tiff?)$/.test(ext) ? `Attēla formātu .${esc(ext)} pārlūks nerāda — saglabā to kā JPG vai PNG.`
      : `Šo faila tipu (.${esc(ext)}) rīks nevar parādīt.`;
    box.innerHTML = ui.empty(why + '<br>Spied “Lejupielādēt”, lai atvērtu to datorā.');
  }
  async function openView(file, title) {
    const gen = ++viewGen;
    if (view) view.urls.forEach(u => URL.revokeObjectURL(u));
    const ext = extOf(file.name), tab = /^(pdf|txt|jpe?g|png|webp|gif|bmp|svg)$/.test(ext);
    view = { url: URL.createObjectURL(tab && MIME[ext] && file.type !== MIME[ext] ? new Blob([file], { type: MIME[ext] }) : file), name: file.name, urls: [], tab }; view.urls.push(view.url);
    const box = U.$('viewBody'); box.innerHTML = '<p class="muted pad">Atver…</p>';
    U.$('viewName').textContent = title || file.name; if (!U.$('viewDialog').open) U.$('viewDialog').showModal();
    try { await renderInto(box, file); }
    catch (err) { if (gen === viewGen) box.innerHTML = ui.empty('Dokumentu neizdevās attēlot: ' + esc(err.message) + '<br>Spied “Lejupielādēt”, lai atvērtu to datorā.'); }
  }
  A.view = async a => {
    const [sid, path] = splitKey(a), h = await CP.store.handleFor(path, sid);
    if (!h) return ui.toast('Fails nav atrasts. Pārbaudi datu mapi vai pārskenē.', 'warn');
    let f; try { f = await h.getFile(); } catch (err) { return ui.toast('Neizdevās atvērt: ' + err.message, 'err'); }
    openView(f);
  };
  docs.openFile = openView;
  /** Atver jau piesaistītu dokumentu anketas ievadē, lai papildinātu kartiņu */
  A.readDoc = async id => {
    const d = S.db.documents.find(x => x.id === id); if (!d) return;
    const h = await CP.store.handleFor(d.path, d.sourceId); if (!h) return ui.toast('Fails nav atrasts', 'warn');
    const f = await h.getFile(); f._linked = true;
    CP.scan.openWith(f, D.person(d.personId)?.status !== 'archived' ? d.personId : '');
  };
  /** Rāda sagatavotu failu (piem. veidlapas PDF) tajā pašā skatītājā */
  docs.showBlob = (blob, name) => {
    if (view) view.urls.forEach(u => URL.revokeObjectURL(u));
    view = { url: URL.createObjectURL(blob), name, urls: [], tab: true }; view.urls.push(view.url);
    U.$('viewBody').innerHTML = `<iframe class="viewer" src="${view.url}" title="${esc(name)}"></iframe>`;
    U.$('viewName').textContent = name; U.$('viewDialog').showModal();
  };
  A.viewTab = () => { if (!view) return; if (!view.tab) return ui.toast('Šo faila tipu pārlūka cilne neatver — tas ir redzams šeit skatītājā. Lai atvērtu datorā, spied “Lejupielādēt”.', 'warn', 7000); window.open(view.url, '_blank'); };
  A.viewDownload = () => { if (!view) return; const a = document.createElement('a'); a.href = view.url; a.download = view.name; a.click(); };
  U.$('viewDialog').addEventListener('close', () => { viewGen++; if (view) { view.urls.forEach(u => URL.revokeObjectURL(u)); view = null; } U.$('viewBody').innerHTML = ''; });

  let probeGen = 0;
  docs.probeLinked = async () => {
    const gen = ++probeGen;
    for (const d of S.db.documents) {
      if (!d.path) continue;
      if (gen !== probeGen) return;
      d._live = await CP.store.probeDoc(d);
      document.querySelectorAll(`[data-docstatus="${CSS.escape(d.id)}"]`).forEach(el => { el.outerHTML = docs.statusHtml(d); });
      await new Promise(r => setTimeout(r, 0));
    }
  };
  function applyCheck(d, result) {
    if (!result) return;
    d._live = { state: result.state, detail: result.detail };
    d.fileState = result.state;
    d.fileDetail = result.detail;
    d.checkedAt = U.now();
    if (result.state === 'available' && result.sha256 && !result.changed) {
      d.sha256 = result.sha256; d.size = result.size; d.modified = result.modified;
    }
    document.querySelectorAll(`[data-docstatus="${CSS.escape(d.id)}"]`).forEach(el => { el.outerHTML = docs.statusHtml(d); });
  }
  A.checkDoc = async id => {
    const d = S.db.documents.find(x => x.id === id); if (!d) return;
    probeGen++;   // fona pārbaude vairs nepārraksta šīs pārbaudes rezultātu
    const btns = [...document.querySelectorAll(`[data-act="checkDoc"][data-arg="${CSS.escape(id)}"]`)];
    btns.forEach(b => { b.disabled = true; b.textContent = 'Pārbauda…'; });
    document.querySelectorAll(`[data-docstatus="${CSS.escape(d.id)}"]`).forEach(el => { el.className = 'pill'; el.textContent = 'Pārbauda…'; });
    try { applyCheck(d, await CP.store.checkDoc(d)); }
    catch (err) { ui.toast('Neizdevās pārbaudīt: ' + err.message, 'err'); }
    CP.store.changed({ silent: true });
    if (S.page === 'person') CP.render();
    else btns.forEach(b => { b.disabled = false; b.textContent = 'Pārbaudīt'; });
    ui.toast(d.fileState === 'available' ? `${d.kind}: pārbaudīts — fails ir vietā${d.fileDetail === 'Saturs sakrīt' ? ' un nav mainījies' : ''}.` : (d.fileDetail || 'Pārbaude pabeigta'), d.fileState === 'available' ? 'ok' : 'warn', 5000);
  };
  A.checkDocs = async () => {
    const list = S.db.documents.filter(d => d.path);
    if (!list.length) return ui.toast('Nav piesaistītu failu', 'warn');
    ui.toast(`Pārbauda ${list.length} dokumentus. Lieli faili tiek lasīti pa daļām.`, 'ok', 4000);
    for (const d of list) {
      applyCheck(d, await CP.store.checkDoc(d));
      await new Promise(r => setTimeout(r, 0));
    }
    CP.store.changed({ silent: true });
    const bad = list.filter(d => d.fileState && d.fileState !== 'available').length;
    ui.toast(bad ? `Pārbaude pabeigta. ${bad} dokumenti nav kārtībā.` : 'Visi pārbaudītie dokumenti ir pieejami.', bad ? 'warn' : 'ok', 8000);
  };
  let relinkId = null;
  A.relinkDoc = id => {
    const d = S.db.documents.find(x => x.id === id); if (!d) return;
    relinkId = id;
    U.$('relinkName').textContent = `${d.kind} — pašreiz: ${d.path || 'bez faila'}`;
    U.$('relinkQ').value = (d.path || '').split('/').pop();
    fillRelink();
    U.$('relinkDialog').showModal();
  };
  function fillRelink() {
    const q = U.norm(U.$('relinkQ').value);
    const rows = S.index.filter(f => !q || f.n.includes(q)).slice(0, 40);
    U.$('relinkList').innerHTML = rows.map(f => `<div class="row"><div class="grow"><b>${esc(f.name)}</b><div class="small">${whereHtml(f.path, f.sourceId)}</div></div><button class="sm mainbtn" data-act="relinkUse" data-arg="${keyOf(f.sourceId, f.path)}">Izvēlēties</button></div>`).join('') || '<p class="muted small">Šajās mapēs nekas netika atrasts. Vari izvēlēties failu datorā.</p>';
  }
  CP.inputHandlers.push(e => { if (e.target.id !== 'relinkQ') return false; fillRelink(); return true; });
  A.relinkUse = async key => {
    const d = S.db.documents.find(x => x.id === relinkId); if (!d) return;
    const [sid, path] = splitKey(key);
    const f = S.index.find(x => x.sourceId === sid && x.path === path); if (!f) return;
    d.previousPaths = [...(d.previousPaths || []), { path: d.path || '', sourceId: d.sourceId || '', at: U.now() }];
    d.path = f.path; d.sourceId = f.sourceId; d.sha256 = ''; d.fileState = 'check'; d.fileDetail = 'Sasaite mainīta — jāpārbauda'; d._live = null;
    try { const file = await f.handle.getFile(); d.size = file.size; d.modified = file.lastModified; } catch (e) { d.size = null; }
    D.audit(d.personId, 'doc-relink', [d.kind]);
    U.$('relinkDialog').close(); CP.store.changed(); ui.toast('Sasaite atjaunota. Iepriekšējais ceļš paliek ieraksta vēsturē. Fails netika pārvietots.', 'ok', 8000);
  };
  A.relinkPick = async () => {
    const d = S.db.documents.find(x => x.id === relinkId); if (!d) return;
    if (!window.showOpenFilePicker) return ui.toast('Šis pārlūks neļauj izvēlēties failu. Izvēlies to no pieslēgtās mapes saraksta.', 'warn');
    try {
      const [fh] = await showOpenFilePicker();
      const file = await fh.getFile();
      let found = null;
      for (const item of S.index.filter(x => x.name === file.name)) {
        try { if (await item.handle.isSameEntry(fh)) { found = item; break; } } catch (e) { /* turpina meklēt */ }
      }
      d.previousPaths = [...(d.previousPaths || []), { path: d.path || '', sourceId: d.sourceId || '', at: U.now() }];
      d.sha256 = ''; d.size = file.size; d.modified = file.lastModified; d.fileState = 'check'; d.fileDetail = 'Sasaite mainīta — jāpārbauda'; d._live = null;
      if (found) { d.path = found.path; d.sourceId = found.sourceId; }
      else {
        await CP.store.rememberDocHandle(d.id, fh);
        d.path = file.name; d.sourceId = 'fails:' + d.id;
      }
      D.audit(d.personId, 'doc-relink', [d.kind]);
      U.$('relinkDialog').close(); CP.store.changed();
      ui.toast(found ? 'Sasaite atjaunota uz failu pieslēgtajā mapē.' : 'Sasaite atjaunota uz izvēlēto failu. Pēc pārlūka aizvēršanas Chrome var prasīt atļauju vēlreiz.', 'ok', 9000);
    } catch (e) { if (e.name !== 'AbortError') ui.toast(e.message, 'err'); }
  };
  const personAfter = CP.pages.person.after;
  CP.pages.person.after = () => { personAfter?.(); if (S.tab === 'docs') { docs.syncBrowse(); docs.paintTree(); docs.probeLinked(); } };

  const enc = s => encodeURIComponent(s || '');
  const dec = s => { try { return decodeURIComponent(s || ''); } catch (e) { return s || ''; } };
  function fmtSize(n) {
    if (n == null) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  docs.syncBrowse = () => {
    const p = D.person(S.selected);
    if (!p) return;
    if (S.browse.pid !== p.id || !S.browse.year || (S.browse.active !== D.activeYear())) S.browse = { pid: p.id, year: D.activeYear(), active: D.activeYear(), rel: '', q: '' };
  };
  let treeGen = 0;
  docs.paintTree = async () => {
    const box = U.$('docTree'), crumbs = U.$('docCrumbs');
    const gen = ++treeGen;
    const p = D.person(S.selected);
    if (!box || !p) return;
    if (!S.root) { box.innerHTML = '<p class="muted small">Izvēlies datu mapi, lai veidotu personas mapes un pievienotu failus.</p>'; if (crumbs) crumbs.innerHTML = ''; return; }
    let root;
    const year = S.browse.year || D.activeYear(), other = year !== D.activeYear();
    try { if (other) root = CP.store.yearPersonDir(p, year); else root = await CP.store.ensurePersonYearFolder(p); }
    catch (e) {
      if (gen !== treeGen) return;
      box.innerHTML = `<p class="warn">Neizdevās atvērt personas mapi: ${esc(e.message)}. Dokumentu sasaistes ir saglabātas.</p>`;
      return;
    }
    if (gen !== treeGen) return;
    const rel = S.browse.rel || '';
    const parts = [...root, ...rel.split('/').filter(Boolean)];
    const label = root[root.length - 1];
    const wh = U.$('docWhere');
    if (wh) wh.innerHTML = `${whereHtml([...root, ...rel.split('/').filter(Boolean)].join('/') + '/', 'main').replace(/<span class="muted">›<\/span> <b><\/b>/, '')}${other ? ` <span class="warn">· iepriekšējā gada mape — jauni faili tiek likti ${esc(U.yearLabel(D.activeYear()))} mapē</span>` : ''}`;
    if (crumbs) {
      const bits = rel ? rel.split('/').filter(Boolean) : [];
      crumbs.innerHTML = `<button type="button" class="sm" data-act="docOpen" data-arg="">${esc(label)}</button>` + bits.map((b, i) => `<span class="muted">/</span><button type="button" class="sm" data-act="docOpen" data-arg="${enc(bits.slice(0, i + 1).join('/'))}">${esc(b)}</button>`).join('');
    }
    try {
      const q = U.norm(S.browse.q || '');
      const rows = q ? await CP.store.searchNames(root, S.browse.q) : (await CP.store.listLevel(parts)).map(r => ({ ...r, rel: rel ? rel + '/' + r.name : r.name }));
      if (gen !== treeGen) return;
      const up = !q && rel ? `<div class="row"><button class="sm" data-act="docUp">↑ Augstāk</button><span class="muted small">${esc(rel)}</span></div>` : '';
      box.innerHTML = up + (rows.map(r => {
        const full = [...root, ...r.rel.split('/').filter(Boolean)].join('/');
        const linked = r.kind === 'file' ? S.db.documents.find(d => d.personId === p.id && d.path === full && (d.sourceId || 'main') === 'main') : null;
        const kind = r.kind === 'dir' ? 'mape' : (r.ext || 'fails').toUpperCase();
        if (r.kind === 'dir') return `<div class="row"><button class="sm" data-act="docOpen" data-arg="${enc(r.rel)}">📁 ${esc(r.name)}</button><span class="grow muted small">mape</span>${other ? '' : `<button class="sm ghost danger" data-act="docDelEntry" data-arg="${enc(r.rel)}" title="Dzēst mapi datorā">✕ Dzēst</button>`}</div>`;
        return `<div class="row"><div class="grow"><b>${esc(r.name)}</b> <span class="muted small">${esc(kind)} · ${fmtSize(r.size)}</span>${linked ? ` ${fmtTag(linked.format)} ${REVIEW[linked.review] ? `<span class="tag">${esc(REVIEW[linked.review])}</span>` : ''} ${docs.statusHtml(linked)}${linked.expires ? `<span class="muted small"> līdz ${esc(U.fmtDate(linked.expires))}</span>` : ''}` : ' <span class="muted small">nav piesaistīts</span>'}<div class="small muted">${esc(r.rel)}</div></div>
          <button class="sm mainbtn" data-act="view" data-arg="${keyOf('main', full)}">Atvērt</button>
          ${linked ? '' : `<button class="sm" data-act="associate" data-arg="${keyOf('main', full)}" title="Piesaistīt kartītei — būs redzams sadaļā “Visi personas dokumenti”">＋ Piesaistīt</button>`}
          ${other ? '' : `<button class="sm" data-act="docMoveOpen" data-arg="${enc(r.rel)}" title="Pārvietot uz citu apakšmapi personas mapē">Pārvietot</button>`}
          <button class="sm ghost danger" data-act="docDelFile" data-arg="${keyOf('main', full)}" title="Dzēst failu datorā">✕ Dzēst</button></div>`;
      }).join('') || '<p class="muted small">Šajā mapē vēl nav dokumentu.</p>');
    } catch (e) {
      if (gen !== treeGen) return;
      box.innerHTML = `<p class="warn">Neizdevās nolasīt mapi: ${esc(e.message)}. Dokumentu sasaistes ir saglabātas.</p>`;
    }
  };
  function folderOptions(list, selected) {
    return list.map(f => `<option value="${esc(f)}" ${f === selected ? 'selected' : ''}>${esc(f || 'Personas mape')}</option>`).join('');
  }
  async function fillFolderSelect(id, selected) {
    const p = D.person(S.selected); if (!p || !S.root) return;
    const root = CP.store.yearPersonDir(p);
    const list = await CP.store.listFolders(root);
    U.$(id).innerHTML = folderOptions(list, selected || '');
  }
  A.docRefresh = () => docs.paintTree();
  A.docYear = y => { docs.syncBrowse(); S.browse.year = y; S.browse.rel = ''; S.browse.q = ''; document.querySelectorAll('[data-act="docYear"]').forEach(b => b.classList.toggle('on', b.dataset.arg === y)); docs.paintTree(); };
  A.docOpen = rel => { S.browse.rel = dec(rel); S.browse.q = ''; const q = U.$('docTreeQ'); if (q) q.value = ''; docs.paintTree(); };
  A.docUp = () => { S.browse.rel = (S.browse.rel || '').split('/').slice(0, -1).join('/'); docs.paintTree(); };
  A.docMkdir = async () => {
    if (!S.root) return ui.toast('Vispirms izvēlies datu mapi', 'warn');
    docs.syncBrowse();
    await fillFolderSelect('mkdirParent', S.browse.rel || '');
    U.$('mkdirName').value = '';
    U.$('mkdirDialog').showModal();
  };
  U.$('mkdirForm').addEventListener('submit', async e => {
    e.preventDefault();
    const p = D.person(S.selected); if (!p) return;
    try {
      const rel = await CP.store.makeSubdir(CP.store.yearPersonDir(p), U.$('mkdirParent').value, U.$('mkdirName').value);
      U.$('mkdirDialog').close();
      S.browse.rel = rel.split('/').slice(0, -1).join('/');
      await docs.paintTree();
      ui.toast('Mape ir izveidota', 'ok');
    } catch (err) { ui.toast(err.message, 'err'); }
  });
  A.docAddOpen = async () => {
    if (!S.root) return ui.toast('Vispirms izvēlies datu mapi', 'warn');
    docs.syncBrowse();
    await fillFolderSelect('addFileDir', S.browse.rel || '');
    U.$('addFileDialog').showModal();
  };
  U.$('addFileForm').addEventListener('submit', e => {
    e.preventDefault();
    attachCtx = { pid: S.selected, kind: '', sub: U.$('addFileDir').value };
    U.$('addFileDialog').close();
    U.$('attachFile').click();
  });
  let renameRel = '';
  A.docRename = rel => {
    renameRel = dec(rel);
    const name = renameRel.split('/').pop();
    U.$('renameEntryTitle').textContent = 'Pārdēvēt';
    U.$('renameEntryName').value = name;
    U.$('renameEntryDialog').showModal();
  };
  U.$('renameEntryForm').addEventListener('submit', async e => {
    e.preventDefault();
    const p = D.person(S.selected); if (!p) return;
    const root = CP.store.yearPersonDir(p);
    const next = U.$('renameEntryName').value.trim();
    if (!confirm(`Pārdēvēt “${renameRel.split('/').pop()}” uz “${next}”?`)) return;
    try {
      const moved = await CP.store.relocate(root, renameRel, renameRel.split('/').slice(0, -1).join('/'), next);
      docs.retargetPath(moved.from, moved.path, moved.kind === 'directory');
      await CP.store.reindexDir(root);
      U.$('renameEntryDialog').close();
      CP.store.changed();
      ui.toast('Nosaukums ir nomainīts un sasaistes atjaunotas', 'ok');
    } catch (err) { ui.toast(err.message, 'err'); }
  });
  let moveRel = '';
  A.docMoveOpen = async rel => {
    moveRel = dec(rel);
    U.$('moveFileLabel').textContent = moveRel;
    await fillFolderSelect('moveFileDir', moveRel.split('/').slice(0, -1).join('/'));
    U.$('moveFileDialog').showModal();
  };
  U.$('moveFileForm').addEventListener('submit', async e => {
    e.preventDefault();
    const p = D.person(S.selected); if (!p) return;
    const dest = U.$('moveFileDir').value;
    if (!confirm(`Pārvietot “${moveRel.split('/').pop()}” uz “${dest || 'personas mapi'}”?`)) return;
    try {
      const root = CP.store.yearPersonDir(p);
      const moved = await CP.store.relocate(root, moveRel, dest, moveRel.split('/').pop());
      docs.retargetPath(moved.from, moved.path, false);
      await CP.store.reindexDir(root);
      U.$('moveFileDialog').close();
      CP.store.changed();
      ui.toast(moved.copied ? 'Fails nokopēts jaunajā vietā un sasaiste atjaunota. Veco failu Chrome neļāva noņemt — tas palika iepriekšējā vietā.' : 'Fails ir pārvietots un sasaiste atjaunota', moved.copied ? 'warn' : 'ok', moved.copied ? 10000 : 4000);
    } catch (err) { ui.toast(err.message, 'err'); }
  });
  /* --- Failu un apakšmapju dzēšana personas mapē (tikai datu mapē; papildu mapes ir tikai lasāmas) --- */
  async function afterDelete(paths, isDir) {
    const hit = d => (d.sourceId || 'main') === 'main' && d.path && paths.some(x => isDir ? d.path.startsWith(x + '/') : d.path === x);
    const gone = S.db.documents.filter(hit);
    for (const d of gone) D.audit(d.personId, 'doc-remove', [docs.label(d) + ' (fails dzēsts)']);
    S.db.documents = S.db.documents.filter(d => !hit(d));
    S.index = S.index.filter(f => !(f.sourceId === 'main' && paths.some(x => isDir ? f.path.startsWith(x + '/') : f.path === x)));
    CP.store.changed(); CP.render();
    return gone.length;
  }
  A.docDelFile = async a => {
    const [sid, path] = splitKey(a); if ((sid || 'main') !== 'main') return ui.toast('Papildu mapes failus rīks nedzēš — tās ir tikai lasāmas', 'warn');
    const linked = S.db.documents.filter(d => (d.sourceId || 'main') === 'main' && d.path === path);
    if (!confirm(`Dzēst failu “${path.split('/').pop()}” no datora?\n\n${path}\n\n${linked.length ? `Fails ir piesaistīts kartītei (${linked.map(docs.label).join(', ')}) — tiks noņemts arī ieraksts.\n\n` : ''}Fails tiek dzēsts neatgriezeniski (nenonāk atkritnē).`)) return;
    try { await CP.store.deletePath(path, false); const n = await afterDelete([path], false); ui.toast(`Fails dzēsts${n ? ' un ieraksts noņemts no kartītes' : ''}`, 'ok'); }
    catch (e) { ui.toast('Neizdevās dzēst: ' + e.message, 'err', 9000); }
  };
  A.docDelEntry = async rel => {
    const p = D.person(S.selected); if (!p) return;
    const full = [...CP.store.yearPersonDir(p), ...dec(rel).split('/').filter(Boolean)].join('/');
    let count = 0; try { count = await CP.store.countFiles(full); } catch (e) { count = S.index.filter(f => f.sourceId === 'main' && f.path.startsWith(full + '/')).length; }
    const files = { length: count };
    const linked = S.db.documents.filter(d => (d.sourceId || 'main') === 'main' && d.path && d.path.startsWith(full + '/'));
    if (!confirm(`Dzēst mapi “${full.split('/').pop()}” no datora?\n\n${full}\n\n${files.length ? `Mapē ir ${files.length} fail${files.length === 1 ? 's' : 'i'}${linked.length ? `, no tiem ${linked.length} piesaistīti kartītei — ieraksti tiks noņemti` : ''}.\n\n` : 'Mape ir tukša.\n\n'}Mape tiek dzēsta neatgriezeniski kopā ar saturu.`)) return;
    try { await CP.store.deletePath(full, true); const n = await afterDelete([full], true); S.browse.rel = ''; ui.toast(`Mape dzēsta${n ? `, noņemti ${n} ieraksti` : ''}`, 'ok'); }
    catch (e) { ui.toast('Neizdevās dzēst: ' + e.message, 'err', 9000); }
  };
  A.docLinkHere = rel => {
    const p = D.person(S.selected); if (!p) return;
    const full = [...CP.store.yearPersonDir(p, S.browse.year || D.activeYear()), ...dec(rel).split('/').filter(Boolean)].join('/');
    const name = full.split('/').pop();
    if (docs.link(p.id, D.guessKind(name), /\.edoc$/i.test(name) ? 'edoc' : 'pdf', full, 'main', { review: 'received' })) {
      CP.store.changed(); ui.toast('Dokuments piesaistīts kartītei', 'ok');
    }
  };
  docs.retargetPath = (from, to, isDir) => {
    for (const d of S.db.documents) {
      if ((d.sourceId || 'main') !== 'main' || !d.path) continue;
      const hit = isDir ? (d.path === from || d.path.startsWith(from + '/')) : d.path === from;
      if (!hit) continue;
      d.previousPaths = [...(d.previousPaths || []), { path: d.path, sourceId: d.sourceId || 'main', at: U.now() }];
      d.path = isDir ? to + d.path.slice(from.length) : to;
      d.fileState = 'check'; d.fileDetail = 'Ceļš atjaunots'; d._live = null;
      D.audit(d.personId, 'doc-relink', [d.kind]);
    }
  };
  CP.inputHandlers.push(e => {
    if (e.target.id !== 'docTreeQ') return false;
    S.browse.q = e.target.value;
    docs.paintTree();
    return true;
  });
  CP.pages.documents.after = () => docs.probeLinked();

  CP.docs = docs;
})(window.CP);
