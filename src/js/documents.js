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

  function docRow(d, showPerson) {
    const exp = D.docExpiry(d) ? U.daysTo(D.docExpiry(d)) : null;
    const st = docs.statusOf(d);
    return `<div class="row doc">
      <div class="doc-ic">${/\.(jpe?g|png|webp|heic)$/i.test(d.path || '') ? '🖼' : /\.edoc$/i.test(d.path || '') ? '✍' : d.path ? '📄' : '🗂'}</div>
      <div class="grow">
        <div><b>${esc(d.kind)}</b> ${fmtTag(d.format)} ${docs.statusHtml(d)} ${showPerson ? `· <a href="#" data-person="${d.personId}" data-goto="docs">${esc(U.full(D.person(d.personId)))}</a>` : ''}</div>
        <div class="small muted">${d.yearId ? esc(U.yearLabel(d.yearId)) + ' · ' : ''}${REVIEW[d.review] ? esc(REVIEW[d.review]) + ' · ' : ''}${d.path ? esc(d.path) : 'Elektronisks fails nav piesaistīts'}${st?.detail && st.detail !== CP.FILE_STATUS[st.state] ? ' · ' + esc(st.detail) : ''}${d.received ? ' · saņemts ' + U.fmtDate(d.received) : ''}${d.issued ? ' · izsniegts ' + U.fmtDate(d.issued) : ''}${D.docExpiry(d) ? ` · <span class="${exp < 0 ? 'red' : exp <= 30 ? 'warn' : ''}">derīgs līdz ${U.fmtDate(D.docExpiry(d))}</span>` : (D.docRule(d.kind) ? ' · <span class="warn">nav norādīts izsniegšanas datums</span>' : '')}${D.docRule(d.kind)?.schoolYear && !D.docForYear(d, D.activeYear()) ? ' · <span class="warn">citam mācību gadam</span>' : ''}${d.notes ? ' · ' + esc(d.notes) : ''}</div>
      </div>
      ${d.path ? `<button class="sm mainbtn" data-act="view" data-arg="${keyOf(d.sourceId, d.path)}">Atvērt</button>` : ''}
      ${d.path ? `<button class="sm" data-act="checkDoc" data-arg="${d.id}">Pārbaudīt</button><button class="sm" data-act="relinkDoc" data-arg="${d.id}">Atjaunot sasaisti</button>` : ''}
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
    return `<section class="card docbrowser"><h3>Dokumentu mape <span class="tag">${esc(U.yearLabel(D.activeYear()))}</span><span class="right actions"><button class="sm" data-act="docMkdir" data-arg="${p.id}">Jauna mape</button><button class="sm mainbtn" data-act="docAddOpen" data-arg="${p.id}">Pievienot failu</button><button class="sm" data-act="docRefresh" data-arg="${p.id}">Atsvaidzināt</button></span></h3>
        <div class="crumbs" id="docCrumbs"></div>
        <input id="docTreeQ" type="search" placeholder="Meklēt dokumenta nosaukumā…" value="${esc(S.browse.q || '')}">
        <p class="muted small">Meklēšana skatās nosaukumus un ceļus, nevis failu saturu. Oriģināls datorā netiek dzēsts.</p>
        <div id="docTree" class="dropzone" data-drop="${p.id}"><p class="muted small">Ielādē mapi…</p></div></section>
      <section class="card"><h3>Visi dokumenti (${list.length})<span class="right actions"><button class="sm" data-act="addDoc" data-arg="${p.id}">＋ Papīra dokuments</button></span></h3>
        <div class="dropzone" data-drop="${p.id}">${list.map(d => docRow(d, false)).join('') || '<p class="muted small">Nav dokumentu. Ievelc failus šeit vai spied “Pievienot failu”.</p>'}</div></section>
      ${sugg.length ? `<section class="card"><h3>Mapē atrasti faili ar šo vārdu (${sugg.length})</h3><p class="muted small">Piesaisti ar vienu klikšķi — kategorija noteikta pēc faila nosaukuma.</p>
        ${sugg.map(f => `<div class="row"><div class="grow"><b>${esc(f.name)}</b><div class="small muted">${esc(f.sourceName)} / ${esc(f.path)}</div></div>
          <button class="sm" data-act="view" data-arg="${keyOf(f.sourceId, f.path)}">Skatīt</button>
          <button class="sm mainbtn" data-act="quickLink" data-arg="${keyOf(f.sourceId, f.path)}">＋ ${esc(D.guessKind(f.name))}</button>
          <button class="sm" data-act="associate" data-arg="${keyOf(f.sourceId, f.path)}">Cita…</button></div>`).join('')}</section>`
        : (S.root ? '' : '<p class="muted small">Izvēlies datu mapi, lai pievienotu failus un meklētu esošos.</p>')}`;
  };

  /* --- Dokumentu lapa --- */
  CP.pages.documents = {
    render() {
      const P = S.docsPage, q = U.norm(P.q);
      const head = ui.pageHead('Dokumenti', `${S.db.documents.length} reģistrēti dokumenti · ${S.index.length} faili ${S.roots.length} mapēs`,
        `<button data-act="checkDocs">Pārbaudīt pieejamību</button><button data-act="extra">＋ Papildu mape</button><button data-act="rescan">⟳ Pārskenēt</button>`);
      const tabs = `<nav class="tabs"><button class="${P.show === 'linked' ? 'active' : ''}" data-act="docsShow" data-arg="linked">Reģistrētie</button><button class="${P.show === 'missing' ? 'active' : ''}" data-act="docsShow" data-arg="missing">Trūkstošie</button><button class="${P.show === 'files' ? 'active' : ''}" data-act="docsShow" data-arg="files">Faili mapēs</button></nav>`;
      let body = '';
      if (P.show === 'linked') {
        const list = S.db.documents.filter(d => D.inYear(D.person(d.personId)) && (!P.kind || d.kind === P.kind) && (!q || U.norm(d.kind + ' ' + d.path + ' ' + U.full(D.person(d.personId))).includes(q)))
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
    if (docs.link(S.selected, D.guessKind(f.name), f.ext === 'edoc' ? 'edoc' : 'pdf', f.path, f.sourceId)) { CP.store.changed(); ui.toast('Piesaistīts: ' + D.guessKind(f.name), 'ok'); }
  };
  let assoc = null;
  A.associate = a => {
    const [sid, path] = splitKey(a); assoc = S.index.find(f => f.sourceId === sid && f.path === path); if (!assoc) return;
    ui.personOptions('associatePerson', S.selected); U.$('associateKind').innerHTML = ui.kindOptions(D.guessKind(assoc.name));
    U.$('associateName').textContent = assoc.path; U.$('associateFormat').value = assoc.ext === 'edoc' ? 'edoc' : 'pdf'; U.$('associateDialog').showModal();
  };
  U.$('associateConfirm').onclick = () => {
    if (assoc && docs.link(U.$('associatePerson').value, U.$('associateKind').value, U.$('associateFormat').value, assoc.path, assoc.sourceId)) { CP.store.changed(); ui.toast('Fails piesaistīts', 'ok'); }
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
    dform.reset(); dform.dataset.edit = ''; U.$('docTitle').textContent = 'Reģistrēt dokumentu';
    ui.personOptions('docPerson', pid || S.selected); U.$('docKind').innerHTML = ui.kindOptions(kind || '');
    dform.elements.received.value = U.iso(); dform.elements.format.value = 'paper'; dform.dataset.autoExp = '1'; docRuleUi(); U.$('documentDialog').showModal();
  };
  /** Ārsta izziņa u.c.: prasa izsniegšanas datumu, termiņu aprēķina pats (var labot) */
  function docRuleUi() {
    const kind = dform.elements.kind.value, r = D.docRule(kind), iss = dform.elements.issued, exp = dform.elements.expires;
    U.$('docIssuedLbl').innerHTML = r ? `${U.esc(kind)}: izsniegšanas datums <b class="red">*</b>` : 'Dokumenta datums (izsniegts)';
    iss.required = !!r;
    if (r && iss.value && (dform.dataset.autoExp || !exp.value)) { exp.value = D.docExpiry({ kind, issued: iss.value }); dform.dataset.autoExp = '1'; }
    U.$('docExpHint').textContent = r ? `Derīga ${r.months} mēn. no izsniegšanas${r.schoolYear ? ' un tikai savā mācību gadā — rīks atgādinās pirms termiņa, mācību gada beigās un jaunā gada sākumā' : ''}.` : '';
  }
  dform.addEventListener('change', e => { if (e.target.name === 'expires') dform.dataset.autoExp = ''; if (['kind', 'issued'].includes(e.target.name)) docRuleUi(); });
  A.editDoc = id => {
    const d = S.db.documents.find(x => x.id === id); if (!d) return;
    dform.reset(); dform.dataset.edit = id; U.$('docTitle').textContent = 'Rediģēt dokumentu';
    ui.personOptions('docPerson', d.personId, true); U.$('docKind').innerHTML = ui.kindOptions(d.kind);
    for (const k of ['format', 'received', 'issued', 'expires', 'notes', 'review']) if (dform.elements[k]) dform.elements[k].value = d[k] || '';
    dform.dataset.autoExp = d.expires && d.expires === D.docExpiry({ ...d, expires: '' }) ? '1' : '';
    docRuleUi(); U.$('documentDialog').showModal();
  };
  dform.addEventListener('submit', e => {
    e.preventDefault(); const o = Object.fromEntries(new FormData(dform));
    if (dform.dataset.edit) Object.assign(S.db.documents.find(x => x.id === dform.dataset.edit), o);
    else { S.db.documents.push({ ...o, id: U.uid(), path: '', sourceId: '', addedAt: U.now(), yearId: o.yearId || U.yearOfDate(o.received) || D.activeYear() }); D.audit(o.personId, 'doc-add', [o.kind]); }
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
  docs.addFiles = async (pid, files, kind, subRel) => {
    const p = D.person(pid); if (!p || !files.length) return;
    if (!S.root) return ui.toast('Vispirms izvēlies datu mapi', 'warn');
    const rel = subRel != null ? subRel : '';
    let n = 0;
    try { await CP.store.ensurePersonYearFolder(p); }
    catch (err) { ui.toast('Personas mape nav pieejama: ' + err.message + '. Sasaistes paliek.', 'err'); return; }
    const parts = [...CP.store.yearPersonDir(p), ...String(rel || '').split('/').filter(Boolean)];
    for (const f of files) {
      try {
        const name = kind === D.MTL ? `${D.MTL} ${U.iso()}.${(f.name.split('.').pop() || 'pdf').toLowerCase()}` : f.name;
        const path = await CP.store.saveFile(parts, name, f, { confirmConflict: true });
        if (!path) continue;
        const format = /\.edoc$/i.test(name) ? 'edoc' : 'pdf';
        if (docs.link(p.id, kind || D.guessKind(f.name), format, path, 'main', { size: f.size, review: 'received' })) n++;
      } catch (err) { ui.toast('Neizdevās saglabāt ' + f.name + ': ' + err.message, 'err'); }
    }
    if (n) {
      CP.store.changed();
      const last = n === 1 && S.db.documents.find(x => x.id === docs.lastLinked);
      // dokumentam ar derīguma termiņu (ārsta izziņa) uzreiz jautā izsniegšanas datumu
      if (last && D.docRule(last.kind) && !last.issued) { A.editDoc(last.id); setTimeout(() => dform.elements.issued.focus(), 50); ui.toast(`${last.kind} pievienota. Norādi izsniegšanas datumu — rīks atgādinās, kad beidzas derīgums.`, 'ok', 8000); }
      else ui.toast(`Pievienoti ${n} faili personas mapē. Oriģināli nav dzēsti.`, 'ok', 7000, last ? { act: 'editDoc', arg: last.id, label: '✎ Labot datus' } : null);
    }
  };
  /** Aizstāt dokumenta failu ar jaunu (vecais fails paliek mapē, ierakstā saglabājas versiju vēsture) */
  let replaceId = null;
  A.replaceDoc = id => { if (!S.root) return CP.needRoot?.(); replaceId = id; U.$('replaceFile').click(); };
  U.$('replaceFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; const d = S.db.documents.find(x => x.id === replaceId); if (!f || !d) return;
    const p = D.person(d.personId);
    try {
      await CP.store.ensurePersonYearFolder(p);
      const path = await CP.store.saveFile(CP.store.yearPersonDir(p), f.name, f, { confirmConflict: true }); if (!path) return;
      if (d.path) (d.versions = d.versions || []).push({ path: d.path, sourceId: d.sourceId || 'main', at: d.replacedAt || d.addedAt });
      Object.assign(d, { path, sourceId: 'main', format: /\.edoc$/i.test(f.name) ? 'edoc' : (d.format === 'paper' ? 'pdf' : d.format || 'pdf'), size: f.size, replacedAt: U.now(), fileState: 'check', _live: null });
      D.audit(d.personId, 'update', [`Aizstāts fails: ${d.kind}`]); CP.store.changed();
      ui.toast('Fails aizstāts. Iepriekšējais fails paliek personas mapē.', 'ok', 7000, { act: 'editDoc', arg: d.id, label: '✎ Labot datus' });
    } catch (err) { ui.toast('Neizdevās aizstāt: ' + err.message, 'err', 9000); }
  });
  // Failu ievilkšana kartiņas dokumentu sarakstā
  document.addEventListener('dragover', e => { const z = e.target.closest?.('[data-drop]'); if (z) { e.preventDefault(); z.classList.add('over'); } });
  document.addEventListener('dragleave', e => { e.target.closest?.('[data-drop]')?.classList.remove('over'); });
  document.addEventListener('drop', e => { const z = e.target.closest?.('[data-drop]'); if (!z) return; e.preventDefault(); z.classList.remove('over'); docs.addFiles(z.dataset.drop, [...e.dataTransfer.files], '', S.browse.pid === z.dataset.drop ? (S.browse.rel || '') : ''); });

  /* --- Skatītājs --- */
  let view = null;
  A.view = async a => {
    const [sid, path] = splitKey(a), h = await CP.store.handleFor(path, sid);
    if (!h) return ui.toast('Fails nav atrasts. Pārbaudi datu mapi vai pārskenē.', 'warn');
    try {
      const f = await h.getFile(), ext = f.name.split('.').pop().toLowerCase();
      const type = f.type || ({ pdf: 'application/pdf', txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }[ext] || '');
      if (view) URL.revokeObjectURL(view.url);
      view = { url: URL.createObjectURL(type && type !== f.type ? new Blob([f], { type }) : f), name: f.name };
      U.$('viewBody').innerHTML = /^image\//.test(type) ? `<img class="viewimg" src="${view.url}" alt="">`
        : (type === 'application/pdf' || /^text\//.test(type)) ? `<iframe class="viewer" src="${view.url}" title="${esc(f.name)}"></iframe>`
        : ui.empty(`Šo faila tipu (.${esc(ext)}) pārlūks nevar parādīt.<br>Spied “Lejupielādēt” — .edoc failus atver ar eParakstītāju 3.0.`);
      U.$('viewName').textContent = f.name; U.$('viewDialog').showModal();
    } catch (err) { ui.toast('Neizdevās atvērt: ' + err.message, 'err'); }
  };
  /** Atver jau piesaistītu dokumentu anketas ievadē, lai papildinātu kartiņu */
  A.readDoc = async id => {
    const d = S.db.documents.find(x => x.id === id); if (!d) return;
    const h = await CP.store.handleFor(d.path, d.sourceId); if (!h) return ui.toast('Fails nav atrasts', 'warn');
    const f = await h.getFile(); f._linked = true;
    CP.scan.openWith(f, D.person(d.personId)?.status !== 'archived' ? d.personId : '');
  };
  /** Rāda sagatavotu failu (piem. veidlapas PDF) tajā pašā skatītājā */
  docs.showBlob = (blob, name) => {
    if (view) URL.revokeObjectURL(view.url);
    view = { url: URL.createObjectURL(blob), name };
    U.$('viewBody').innerHTML = `<iframe class="viewer" src="${view.url}" title="${esc(name)}"></iframe>`;
    U.$('viewName').textContent = name; U.$('viewDialog').showModal();
  };
  A.viewTab = () => view && window.open(view.url, '_blank');
  A.viewDownload = () => { if (!view) return; const a = document.createElement('a'); a.href = view.url; a.download = view.name; a.click(); };
  U.$('viewDialog').addEventListener('close', () => { if (view) { URL.revokeObjectURL(view.url); view = null; } U.$('viewBody').innerHTML = ''; });

  let probeGen = 0;
  docs.probeLinked = async () => {
    const gen = ++probeGen;
    for (const d of S.db.documents) {
      if (!d.path) continue;
      if (gen !== probeGen) return;
      d._live = await CP.store.probeDoc(d);
      const el = document.querySelector(`[data-docstatus="${CSS.escape(d.id)}"]`);
      if (el) el.outerHTML = docs.statusHtml(d);
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
    const el = document.querySelector(`[data-docstatus="${CSS.escape(d.id)}"]`);
    if (el) el.outerHTML = docs.statusHtml(d);
  }
  A.checkDoc = async id => {
    const d = S.db.documents.find(x => x.id === id); if (!d) return;
    ui.toast('Pārbauda dokumentu…', 'ok', 2500);
    applyCheck(d, await CP.store.checkDoc(d));
    CP.store.changed({ silent: true });
    ui.toast(d.fileDetail || 'Pārbaude pabeigta', d.fileState === 'available' ? 'ok' : 'warn', 7000);
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
    U.$('relinkList').innerHTML = rows.map(f => `<div class="row"><div class="grow"><b>${esc(f.name)}</b><div class="small muted">${esc(f.sourceName)} / ${esc(f.path)}</div></div><button class="sm mainbtn" data-act="relinkUse" data-arg="${keyOf(f.sourceId, f.path)}">Izvēlēties</button></div>`).join('') || '<p class="muted small">Šajās mapēs nekas netika atrasts. Vari izvēlēties failu datorā.</p>';
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
    if (S.browse.pid !== p.id || S.browse.year !== D.activeYear()) S.browse = { pid: p.id, year: D.activeYear(), rel: '', q: '' };
  };
  let treeGen = 0;
  docs.paintTree = async () => {
    const box = U.$('docTree'), crumbs = U.$('docCrumbs');
    const gen = ++treeGen;
    const p = D.person(S.selected);
    if (!box || !p) return;
    if (!S.root) { box.innerHTML = '<p class="muted small">Izvēlies datu mapi, lai veidotu personas mapes un pievienotu failus.</p>'; if (crumbs) crumbs.innerHTML = ''; return; }
    let root;
    try { root = await CP.store.ensurePersonYearFolder(p); }
    catch (e) {
      if (gen !== treeGen) return;
      box.innerHTML = `<p class="warn">Neizdevās atvērt personas mapi: ${esc(e.message)}. Dokumentu sasaistes ir saglabātas.</p>`;
      return;
    }
    if (gen !== treeGen) return;
    const rel = S.browse.rel || '';
    const parts = [...root, ...rel.split('/').filter(Boolean)];
    const label = root[root.length - 1];
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
        if (r.kind === 'dir') return `<div class="row"><button class="sm" data-act="docOpen" data-arg="${enc(r.rel)}">📁 ${esc(r.name)}</button><span class="grow muted small">mape</span><button class="sm" data-act="docRename" data-arg="${enc(r.rel)}">Pārdēvēt</button></div>`;
        return `<div class="row"><div class="grow"><b>${esc(r.name)}</b> <span class="muted small">${esc(kind)} · ${fmtSize(r.size)}</span>${linked ? ` ${fmtTag(linked.format)} ${REVIEW[linked.review] ? `<span class="tag">${esc(REVIEW[linked.review])}</span>` : ''} ${docs.statusHtml(linked)}${linked.expires ? `<span class="muted small"> līdz ${esc(U.fmtDate(linked.expires))}</span>` : ''}` : ' <span class="muted small">nav piesaistīts</span>'}<div class="small muted">${esc(r.rel)}</div></div>
          <button class="sm mainbtn" data-act="view" data-arg="${keyOf('main', full)}">Atvērt</button>
          ${linked ? '' : `<button class="sm" data-act="docLinkHere" data-arg="${enc(r.rel)}">Piesaistīt</button>`}
          <button class="sm" data-act="docRename" data-arg="${enc(r.rel)}">Pārdēvēt</button>
          <button class="sm" data-act="docMoveOpen" data-arg="${enc(r.rel)}">Pārvietot</button></div>`;
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
      ui.toast('Fails ir pārvietots un sasaiste atjaunota', 'ok');
    } catch (err) { ui.toast(err.message, 'err'); }
  });
  A.docLinkHere = rel => {
    const p = D.person(S.selected); if (!p) return;
    const full = [...CP.store.yearPersonDir(p), ...dec(rel).split('/').filter(Boolean)].join('/');
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
