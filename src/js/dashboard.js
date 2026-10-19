/* =====================================================================
   Pārskats un uzdevumu / brīdinājumu lapa
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const SEV = ['info', 'warn', 'bad'], ICON = { mtl: CP.ic('clipboard', '▣'), phone: CP.ic('phone', '☎'), task: CP.ic('task', '☐'), retention: CP.ic('archive', '🗄'), birthday: CP.ic('cake', '🎂'), adult: CP.ic('adult', '🔞'), equipment: CP.ic('backpack', '▣'), document: CP.ic('file', '📄'), idcard: CP.ic('idcard', '🪪'), registry: CP.ic('check', '✓'), attendance: CP.ic('calendar', '📅'), backup: CP.ic('shield', '🔐'), age21: CP.ic('adult', '🎓'), adult18: CP.ic('adult', '🔞'), quality: CP.ic('list', '☰') };

  const alertRow = a => `<div class="row alert ${SEV[a.sev]}"><span class="al-ic">${ICON[a.kind] || '•'}</span><div class="grow">${esc(a.msg)}${a.when ? `<small class="muted"> · ${U.fmtDate(a.when)}</small>` : ''}</div>
    ${a.year ? `<small class="muted">${esc(U.yearSlash(a.year))}</small>` : ''}${a.taskId ? `<button class="sm" data-act="taskDone" data-arg="${a.taskId}">✓ Izpildīts</button>` : ''}${a.personId ? `<button class="sm" data-person="${a.personId}">Atvērt</button>` : ''}${a.page ? `<button class="sm" data-page="${a.page}">Pārskatīt</button>` : ''}${a.act ? `<button class="sm" data-act="${esc(a.act)}" data-arg="${esc(a.arg || '')}">${esc(a.actLabel || 'Atvērt')}</button>` : ''}</div>`;

  CP.pages.dashboard = {
    after() { CP.watch?.paint(); },
    render() {
      const cur = D.peopleInYear().filter(D.isCurrent), al = D.alerts();
      const miss = cur.map(p => ({ p, m: D.missingDocs(p) })).filter(x => x.m.length).sort((a, b) => b.m.length - a.m.length || U.cmp(U.sortName(a.p), U.sortName(b.p)));
      const cnt = s => cur.filter(p => D.partStatus(p) === s).length;
      const recent = [...S.db.audit].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 10);
      const B = S.boot;
      const start = B && !S.root && !B.error ? `<section class="card hero boot"><h2>Atver datu mapi${B.name ? ` “${esc(B.name)}”` : ''}</h2>
          <div class="bootbar"><span style="width:${Math.max(4, B.pct || 0)}%"></span></div>
          <p><b>${esc(B.msg || 'Lūdzu, uzgaidi…')}</b></p>
          <p class="muted small">${esc(B.detail || 'Pārbauda mapes pieejamību. Tīkla mapei vai zibatmiņai tas var aizņemt kādu brīdi — lūdzu, uzgaidi.')}</p></section>`
        : B && B.error && !S.root ? `<section class="card hero booterr"><h2>⚠ ${esc(B.title)}</h2>
          <ul class="hints">${B.hints.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          ${B.errText ? `<p class="small muted">Tehniski: ${esc(B.errText)}</p>` : ''}
          <div class="actions"><button class="mainbtn" data-act="retryRestore">↻ Mēģināt vēlreiz</button>${B.error === 'nodata' ? '<button data-act="bootNew">Sākt jaunu uzskaiti šeit</button>' : ''}<button data-act="pickRoot">📁 Izvēlēties citu mapi</button></div>
          ${ui.rootDrop()}</section>`
        : !S.root ? `<section class="card hero"><h2>Sāc darbu</h2><p>${S.pendingRoot ? `Mape <b>“${esc(S.pendingRoot.name)}”</b> ir atrasta. Chrome drošības dēļ pēc pārlūka restartēšanas lūdz apstiprināt piekļuvi — spied pogu zemāk.` : 'Pieslēdz datu mapi datorā — tajā glabāsies uzskaites fails un personu dokumenti. Pārlūks mapi atcerēsies.'}</p>
        <div class="actions">${S.pendingRoot ? `<button class="mainbtn" data-act="restoreRoot">🔓 Atļaut piekļuvi mapei “${esc(S.pendingRoot.name)}”</button><button data-act="pickRoot">Izvēlēties citu mapi</button>` : `<button class="mainbtn" data-act="pickRoot">📁 Izvēlēties datu mapi</button>`}<button class="ghost" data-act="encRestore" title="Jauns dators vai pazaudēta mape? Atjauno visu no šifrētās kopijas">🔐 Atjaunot no šifrētās kopijas</button></div>
        ${ui.rootDrop()}
        <div class="root-howto"><b>Kā sākt:</b>${ui.rootSteps()}</div>
        <p class="muted small">Kamēr mape nav pievienota, personas, dokumentus un veidlapas nevar ievadīt. Dati glabājas tikai tavā datorā, izvēlētajā mapē.</p></section>`
        : B?.step === 'index' ? `<div class="bootidx"><span class="spin"></span> Indeksē dokumentus mapē “${esc(B.name || '')}”… <b id="bootIdxN">${B.count || 0}</b> faili. Vari strādāt — dokumentu saraksti papildināsies.</div>` : '';
      const head = ui.pageHead('Pārskats', `${U.yearLabel(D.activeYear())} · ` + new Date().toLocaleDateString('lv-LV', { weekday: 'long', day: 'numeric', month: 'long' }), `<span class="head-btns">${CP.setup?.chip() || ''}<button class="ghost" data-act="lockNow" title="Bloķēt rīku (Ctrl+Shift+L)">${CP.ic('lock', '🔒')} Bloķēt rīku</button>${ui.saveBtn()}</span>`);
      if (!S.root) return `<div class="page">${head}${start}</div>`;   // bez mapes — tikai mapes pievienošana (statistika un darbības nav pieejamas)
      return `<div class="page">${ui.pageHead('Pārskats', `${U.yearLabel(D.activeYear())} · ` + new Date().toLocaleDateString('lv-LV', { weekday: 'long', day: 'numeric', month: 'long' }), `<span class="head-btns">${CP.setup?.chip() || ''}<button class="ghost" data-act="lockNow" title="Bloķēt rīku (Ctrl+Shift+L)">${CP.ic('lock', '🔒')} Bloķēt rīku</button>${ui.saveBtn()}</span>`)}
        ${start}
        ${CP.setup?.card() || ''}
        ${CP.years?.banner() || ''}
        <div class="dash-top">${CP.watch ? CP.watch.html() : ''}
        <div class="stats">
          <button class="stat" data-tone="green" data-act="openList" data-arg="active">${CP.ic('userCheck')}<span>Jaunsargi</span><strong>${cnt('active')}</strong></button>
          <button class="stat" data-tone="blue" data-act="openList" data-arg="candidate">${CP.ic('userClock')}<span>Kandidāti</span><strong>${cnt('candidate')}</strong></button>
          <button class="stat" data-tone="amber" data-act="openList" data-arg="missing">${CP.ic('fileAlert')}<span>Trūkst dokumentu</span><strong class="${miss.length ? 'warn' : ''}">${miss.length}</strong></button>
          <button class="stat" data-tone="violet" data-page="documents">${CP.ic('files')}<span>Dokumenti šajā gadā</span><strong>${S.db.documents.filter(d => d.yearId === D.activeYear() || (!d.yearId && D.inYear(D.person(d.personId)))).length}</strong></button>
          <button class="stat" data-tone="olive" data-page="equipment">${CP.ic('backpack')}<span>Izsniegts ekipējums</span><strong>${S.db.equipment.filter(x => !x.returned && !x.keep && D.inYear(D.person(x.personId))).length}</strong></button>
          <button class="stat" data-tone="red" data-page="alerts">${CP.ic('bell')}<span>Uzdevumi un brīdinājumi</span><strong class="${al.some(a => a.sev > 1) ? 'red' : al.length ? 'warn' : ''}">${al.length}</strong></button>
        </div></div>
        <section class="card quick"><button class="mainbtn" data-act="scan">${CP.ic('scan', '📷')} Ievadīt no anketas</button><button data-act="addPerson">${CP.ic('userPlus', '＋')} Jauna persona</button><button data-page="comms">${CP.ic('megaphone', '✉')} Ziņa grupai</button><button data-act="import">${CP.ic('upload', '⬆')} Imports no Excel</button><button data-act="import" data-arg="eklase">${CP.ic('upload', '⬆')} No e-klases</button>${(S.db.settings.tools || []).filter(t => t.name && /^https?:/.test(t.url || '') && !/\{/.test(t.url)).map(t => `<a class="btn" href="${esc(t.url)}" target="_blank" rel="noopener">${CP.ic('external', '↗')} ${esc(t.name)}</a>`).join('')}</section>
        <div class="cards2">
          ${CP.schedule?.dashCard ? CP.schedule.dashCard() : ''}
          <section class="card" data-fill="5" data-mcol="1"><h3>Uzdevumi un brīdinājumi <button class="ghost sm right" data-page="alerts">Visi →</button></h3>${al.slice(0, 40).map(alertRow).join('') || '<p class="muted">Nekas nav jādara. ✓</p>'}${al.length ? `<div class="fill-more" data-total="${al.length}"><button class="sm ghost" data-page="alerts"></button></div>` : ''}</section>
          <section class="card" data-fill="5" data-mcol="2"><h3>Trūkstošie dokumenti <button class="ghost sm right" data-act="openList" data-arg="missing">Visi →</button></h3>${miss.slice(0, 40).map(x => `<div class="row"><div class="who">${ui.avatar(x.p, 'sm')}<span><b>${esc(U.sortName(x.p))}</b><small class="muted">${esc(D.groupOf(x.p) || '')}</small></span></div><div class="grow small warn">${esc(x.m.join(', '))}</div><button class="sm" data-person="${x.p.id}" data-goto="docs">Atvērt</button></div>`).join('') || '<p class="muted">Visiem ir obligātie dokumenti. ✓</p>'}${miss.length ? `<div class="fill-more" data-total="${miss.length}"><button class="sm ghost" data-act="openList" data-arg="missing"></button></div>` : ''}</section>
          <section class="card" data-mcol="0"><h3>Grupas <button class="ghost sm right" data-act="groupNew" title="Pievienot jaunu grupu">＋ Jauna grupa</button></h3>${D.groups().map(g => `<div class="row grp-row"><div class="grow"><b>${esc(g)}</b></div><span class="muted">${cur.filter(p => D.groupOf(p) === g).length}</span><span class="grp-btns"><button class="sm ghost" data-act="groupEdit" data-arg="${esc(g)}" title="Pārdēvēt vai apvienot ar citu grupu" aria-label="Pārdēvēt grupu ${esc(g)}">✎</button><button class="sm ghost danger" data-act="groupDel" data-arg="${esc(g)}" title="Dzēst grupu" aria-label="Dzēst grupu ${esc(g)}">✕</button></span></div>`).join('') || '<p class="muted">Šajā gadā grupas vēl nav.</p>'}</section>
          <section class="card wide"><h3>Pēdējās izmaiņas <button class="ghost sm right" data-page="changes">Viss žurnāls →</button></h3><div class="recent-grid">${CP.changelog?.recentHtml(10) || recent.map(a => { const p = D.person(a.personId); return `<div class="row"><span class="muted small nowrap">${U.fmtDateTime(a.at)}</span><div class="grow">${p ? `<a href="#" data-person="${p.id}">${esc(U.full(p))}</a> — ` : ''}${esc({ create: 'izveidota kartīte', update: 'mainīti dati', scan: 'ievadīta no anketas', archive: 'arhivēta', restore: 'atjaunota', status: 'mainīts statuss', 'doc-add': 'pievienots dokuments', 'doc-remove': 'noņemts dokuments', 'doc-relink': 'atjaunota dokumenta sasaiste', 'eq-issue': 'izsniegts ekipējums', 'eq-return': 'atdots ekipējums', 'eq-edit': 'labots ekipējums', 'eq-delete': 'dzēsts ekipējuma ieraksts', idcard: 'apliecība', event: 'pievienots pasākumam', erase: 'dzēsts reģistra ieraksts', retention: 'izpildīti glabāšanas termiņi' }[a.action] || a.action)}${a.fields?.length ? ': ' + esc(a.fields.join(', ')) : ''}</div></div>`; }).join('') || '<p class="muted">Vēl nav izmaiņu.</p>'}</div></section>
        </div></div>`;
    }
  };
  /* --- Paziņojumi katru reizi, atverot rīku --- */
  CP.notices = async () => {
    // Pēdējās atvēršanas datums glabājas pārlūkā (IndexedDB), lai rīka atvēršana neradītu “nesaglabātas izmaiņas”
    const st = S.db.settings, today = U.iso(), key = 'lastVisit:' + (S.rootName || '');
    let last = '';
    try { last = (await CP.store.idbGet(key)) || st.lastVisit || ''; } catch (e) { last = st.lastVisit || ''; }
    const ages = [];
    if (last && last < today && D.activeYear() === U.schoolYear()) for (const p of D.peopleInYear().filter(D.isCurrent)) {
      if (!p.birth) continue;
      // vai dzimšanas diena bija starp pēdējo apmeklējumu un šodienu
      const ageNow = U.age(p.birth), lastD = new Date(last + 'T12:00:00'), b = new Date(p.birth + 'T12:00:00');
      const ageThen = lastD.getFullYear() - b.getFullYear() - ((lastD.getMonth() < b.getMonth() || (lastD.getMonth() === b.getMonth() && lastD.getDate() < b.getDate())) ? 1 : 0);
      if (ageNow > ageThen) ages.push({ p, age: ageNow });
    }
    // 18 / 21 gadu brīdinājumi uznirstošajā logā — ne vairāk kā 3 reizes katram (kartītē un Uzdevumos paliek, līdz atrisināts)
    let seenN = {}; try { seenN = JSON.parse(localStorage.getItem('cp-notice-count') || '{}') || {}; } catch (e) { seenN = {}; }
    const al = D.alerts().filter(a => !a.quiet && (!a.nkey || (seenN[a.nkey] || 0) < 3)), urgent = al.filter(a => a.sev >= 1), soon = al.filter(a => a.sev === 0);
    const shownKeys = al.filter(a => a.nkey).map(a => a.nkey);
    try { await CP.store.idbSet(key, today); } catch (e) { /* tikai ērtībai */ }
    if (!ages.length && !urgent.length && !soon.length) return;
    const row = a => `<div class="row alert ${SEV[a.sev]}"><span class="al-ic">${ICON[a.kind] || '•'}</span><div class="grow">${esc(a.msg)}${a.when ? `<small class="muted"> · ${U.fmtDate(a.when)}</small>` : ''}</div>${a.personId ? `<button class="sm" data-person="${a.personId}" data-close="noticeDialog" data-goto="${a.kind === 'mtl' ? 'equipment' : a.kind === 'document' ? 'docs' : 'overview'}">Atvērt</button>` : ''}${a.page ? `<button class="sm" data-page="${a.page}" data-close="noticeDialog">Pārskatīt</button>` : ''}${a.act ? `<button class="sm" data-act="${esc(a.act)}" data-arg="${esc(a.arg || '')}">${esc(a.actLabel || 'Atvērt')}</button>` : ''}</div>`;
    U.$('noticeBody').innerHTML =
      (ages.length ? `<h4 style="margin-top:0">🎂 Vecuma izmaiņas kopš ${U.fmtDate(last)}</h4>${ages.map(x => `<div class="row"><div class="grow"><b>${esc(U.full(x.p))}</b> — tagad <b>${x.age} g.</b>${x.age === 18 ? ' <span class="pill warn">pilngadīgs — jānoslēdz jauns līgums ar jaunsargu (vecāku dati kartītē paliek)</span>' : ''}</div><button class="sm" data-person="${x.p.id}" data-close="noticeDialog">Atvērt</button></div>`).join('')}` : '')
      + (urgent.length ? `<h4>⚠ Jāpievērš uzmanība (${urgent.length})</h4>${urgent.slice(0, 25).map(row).join('')}${urgent.length > 25 ? `<p class="muted small">… un vēl ${urgent.length - 25}</p>` : ''}` : '')
      + (soon.length ? `<h4>📅 Drīzumā</h4>${soon.slice(0, 15).map(row).join('')}` : '');
    U.$('noticeDialog').showModal();
    if (shownKeys.length) { for (const k of shownKeys) seenN[k] = (seenN[k] || 0) + 1; try { localStorage.setItem('cp-notice-count', JSON.stringify(seenN)); } catch (e) { } }
  };
  A.noticeAlerts = () => { U.$('noticeDialog').close(); ui.go('alerts'); };

  A.openList = k => {
    S.list.sel.clear();
    if (k === 'missing') { S.list.status = 'current'; S.list.missing = true; } else { S.list.status = k; S.list.missing = false; }
    ui.go('people');
  };

  CP.pages.alerts = {
    render() {
      const al = D.alerts(), inY = t => D.inYear(D.person(t.personId)) || t.yearId === D.activeYear();
      const done = S.db.tasks.filter(t => t.done && inY(t)).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt))).slice(0, 15);
      const allTasks = S.db.tasks.filter(t => !t.done && inY(t) && !(t.due && U.daysTo(t.due) <= 7));
      return `<div class="page">${ui.pageHead('Uzdevumi un brīdinājumi', `${U.yearLabel(D.activeYear())} · termiņi, dokumenti, ekipējums, dzimšanas dienas`)}
        <section class="card">${al.map(alertRow).join('') || '<p class="muted">Nav aktīvu brīdinājumu.</p>'}</section>
        ${allTasks.length ? `<section class="card"><h3>Vēlāki uzdevumi</h3>${allTasks.map(t => alertRow({ kind: 'task', personId: t.personId, taskId: t.id, sev: 0, msg: `${U.full(D.person(t.personId))}: ${t.text}`, when: t.due })).join('')}</section>` : ''}
        ${(() => { if (D.activeYear() !== U.schoolYear()) return ''; const g = D.phoneConflicts().filter(x => x.entries.some(e => D.inYear(e.p))); return g.length ? `<section class="card"><h3>☎ Sakrītoši tālruņi (${g.length})</h3><p class="muted small">⚠ — viens numurs norādīts dažādām personām (iespējama kļūda). ℹ — tas pats vecāks vairākiem bērniem (brāļi/māsas).</p>${g.map(x => `<div class="row"><span class="${x.suspicious ? 'warn' : 'muted'}">${x.suspicious ? '⚠' : 'ℹ'} <b>${esc(U.prettyPhone(x.num))}</b></span><div class="grow small">${x.entries.map(e => e.f === 'phone' ? `<a href="#" data-person="${e.p.id}">${esc(U.full(e.p))}</a> <span class="muted">(jaunietis)</span>` : `${esc(e.p[e.f.replace('Phone', 'Name')] || '?')} <span class="muted">(${e.role},</span> <a href="#" data-person="${e.p.id}">${esc(U.full(e.p))}</a><span class="muted">)</span>`).join('; ')}</div></div>`).join('')}</section>` : ''; })()}
        ${done.length ? `<details class="card"><summary><b>Nesen izpildītie</b></summary>${done.map(t => `<div class="row done"><div class="grow">${esc(U.full(D.person(t.personId)))}: ${esc(t.text)}</div><button class="sm ghost" data-act="taskDone" data-arg="${t.id}">Atjaunot</button></div>`).join('')}</details>` : ''}</div>`;
    }
  };
})(window.CP);
/* --- Kartīšu “mūra” izkārtojums: .cards2 kolonnās kartītes saliekas cieši cita zem citas (bez tukšām starpām),
       secība pa rindām paliek tā pati. Augstums tiek pārrēķināts, mainoties saturam vai loga platumam. --- */
(function (CP) {
  'use strict';
  const GAP = 14, UNIT = 2;
  const ro = 'ResizeObserver' in window ? new ResizeObserver(entries => { const grids = new Set(entries.map(e => e.target.parentElement).filter(g => g && !g._laying)); grids.forEach(lay); }) : null;
  /** Kartīte ar data-fill: rāda tik rindu, cik ietilpst līdz garākās kolonnas apakšai (vismaz data-fill), pārējās — “… un vēl N” */
  const fillRows = c => [...c.children].filter(x => x.classList.contains('row'));
  function setFill(c, n) {
    const rows = fillRows(c); rows.forEach((r, i) => { r.hidden = i >= n; });
    const more = c.querySelector('.fill-more'), total = Number(more?.dataset.total || rows.length), shown = Math.min(n, rows.length);
    if (more) { more.hidden = total <= shown; const b = more.querySelector('button'); if (b) b.textContent = `… un vēl ${total - shown} →`; }
  }
  function place(grid, n) {
    const h = Array(n).fill(0), at = new Map();
    for (const c of grid.children) {
      const span = Math.max(1, Math.ceil((c.getBoundingClientRect().height + GAP) / UNIT));
      if (c.classList.contains('wide')) { const top = Math.max(...h); c.style.gridColumn = '1 / -1'; c.style.gridRow = `${top + 1} / span ${span}`; h.fill(top + span); continue; }
      const col = c.dataset.mcol != null ? Math.min(Number(c.dataset.mcol), n - 1) : h.indexOf(Math.min(...h));   // noteikta kolonna vai īsākā
      c.style.gridColumn = String(col + 1); c.style.gridRow = `${h[col] + 1} / span ${span}`; at.set(c, { col, top: h[col], span }); h[col] += span;
    }
    return at;
  }
  function lay(grid) {
    if (!grid?.isConnected) return;
    grid._laying = true; clearTimeout(grid._layT);
    for (const c of grid.children) c.classList.remove('mas-stretch');   // mēra dabisko augstumu
    const n = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length, kids = [...grid.children], fills = kids.filter(c => c.dataset.fill);
    if (n <= 1) { for (const c of kids) c.style.gridColumn = c.style.gridRow = ''; grid.classList.remove('masonry'); fills.forEach(c => setFill(c, Number(c.dataset.fill) + 2)); }
    else {
      grid.classList.add('masonry');
      const k = new Map(fills.map(c => [c, Number(c.dataset.fill)]));
      fills.forEach(c => setFill(c, k.get(c)));                    // sāk ar minimumu
      const bottoms = at => { const b = Array(n).fill(0); for (const [c, a] of at) b[a.col] = Math.max(b[a.col], a.top + a.span); return b; };
      const done = new Set();
      for (let it = 0; it < 120; it++) {
        const at = place(grid, n), b = bottoms(at), max = Math.max(...b);
        // īsākā kolonna, kurā ir kartīte, kas vēl var augt
        const cand = fills.filter(c => !done.has(c) && at.has(c) && k.get(c) < fillRows(c).length).sort((x, y) => b[at.get(x).col] - b[at.get(y).col])[0];
        if (!cand) break;
        const col = at.get(cand).col; setFill(cand, k.get(cand) + 1);
        const b2 = bottoms(place(grid, n));
        if (b2[col] > max || Math.max(...b2) > max) { setFill(cand, k.get(cand)); done.add(cand); } else k.set(cand, k.get(cand) + 1);
      }
      // katras kolonnas pēdējā kartīte tiek izstiepta līdz kopējai apakšai → vienāda atstarpe līdz nākamajai (platajai) kartītei
      const at = place(grid, n), wideTops = [...grid.children].filter(c => c.classList.contains('wide')).map(c => Number(/^(\d+)/.exec(c.style.gridRow)?.[1] || 1) - 1).sort((a, b) => a - b);
      const band = a => wideTops.filter(t => t <= a.top).length;          // josla = cik platās kartītes ir virs
      const last = new Map(), bottom = new Map();
      for (const [c, a] of at) {
        const k = `${band(a)}|${a.col}`, b = band(a);
        if (!last.has(k) || a.top > at.get(last.get(k)).top) last.set(k, c);
        bottom.set(b, Math.max(bottom.get(b) || 0, a.top + a.span));
      }
      for (const c of last.values()) { const a = at.get(c), end = bottom.get(band(a)); if (band(a) < wideTops.length && end > a.top + a.span) {   // tikai, ja zemāk seko platā kartīte
        c.style.gridRow = `${a.top + 1} / ${end + 1}`; c.classList.add('mas-stretch'); } }
    }
    grid._layT = setTimeout(() => { grid._laying = false; }, 150);
  }
  function apply() {
    document.querySelectorAll('#main .cards2:not(.forms-eq)').forEach(g => {   // forms-eq — vienāda augstuma kastītes, bez mūra izkārtojuma
      if (!g._mas) { g._mas = true; for (const c of g.children) ro?.observe(c); }
      lay(g);
    });
  }
  (CP.afterRender = CP.afterRender || []).push(apply);
  window.addEventListener('resize', () => document.querySelectorAll('#main .cards2:not(.forms-eq)').forEach(lay));
  CP.masonry = { apply, lay };
})(window.CP);

/* --- Grupu pārdēvēšana / apvienošana / dzēšana (aktīvajā mācību gadā). Personas netiek dzēstas. --- */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const members = g => (S.db.enrollments || []).filter(e => e.yearId === D.activeYear() && e.group === g);
  function moveGroup(from, to) {
    const list = members(from);
    for (const e of list) { e.group = to; const p = D.person(e.personId); if (p) { p.updatedAt = U.now(); D.audit(p.id, 'update', [to ? `Grupa: ${from} → ${to}` : `Grupa “${from}” dzēsta — bez grupas`]); } }
    const st = S.db.settings;
    if (st.stickyGroup === from) st.stickyGroup = to;
    if (S.list?.group === from) S.list.group = to || '';
    if (st.groupDays?.[from]) { if (to && !st.groupDays[to]) st.groupDays[to] = st.groupDays[from]; delete st.groupDays[from]; }
    // apmeklējuma nodarbības: pārdēvējot / apvienojot pāriet uz jauno grupu (vēsture saglabājas); dzēšot paliek ar veco nosaukumu
    if (to) for (const s of S.db.sessions || []) if (s.group === from && s.yearId === D.activeYear() && !(S.db.sessions || []).some(x => x !== s && x.group === to && x.date === s.date)) s.group = to;
    if (S.att?.group === from) S.att.group = to || '';
    D.setDeclaredGroups([...D.declaredGroups().filter(x => x !== from), ...(to ? [to] : [])]);
    return list.length;
  }
  function dlg(html) { let d = U.$('groupDialog'); if (!d) { d = document.createElement('dialog'); d.id = 'groupDialog'; document.body.appendChild(d); } d.innerHTML = html; d.showModal(); return d; }
  A.groupEdit = g => {
    const others = D.groups().filter(x => x !== g), n = members(g).length;
    const d = dlg(`<form><header class="dlg-head"><h2>Pārdēvēt grupu “${esc(g)}”</h2><button type="button" class="ghost" data-close="groupDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><div class="field"><label>Jaunais nosaukums</label><input name="to" value="${esc(g)}" list="dl_grp" required><datalist id="dl_grp">${others.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <p class="small muted">${n} personām šajā mācību gadā. Ja ieraksti jau esošas grupas nosaukumu, grupas tiks apvienotas. Apmeklējuma atzīmes un nodarbību dienas pāriet līdzi.</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="groupDialog">Atcelt</button><button class="mainbtn" type="submit">Saglabāt</button></footer></form>`);
    d.querySelector('form').onsubmit = e => {
      e.preventDefault(); const to = e.target.to.value.trim(); if (!to || to === g) return d.close();
      const merge = D.groups().includes(to);
      if (merge && !confirm(`Grupa “${to}” jau ir. Apvienot “${g}” ar “${to}”?`)) return;
      const k = moveGroup(g, to); d.close(); CP.store.changed(); ui.toast(merge ? `Grupa “${g}” apvienota ar “${to}” (${k} personas)` : `Grupa pārdēvēta: “${g}” → “${to}”`, 'ok');
    };
  };
  A.groupNew = () => {
    const d = dlg(`<form><header class="dlg-head"><h2>Jauna grupa</h2><button type="button" class="ghost" data-close="groupDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><div class="field"><label>Grupas nosaukums</label><input name="name" required placeholder="piem., 2.4. vai J1"></div>
      <p class="small muted">Grupa uzreiz parādīsies visās izvēlnēs: personas kartītē, sarakstu filtrā, apmeklējumā, saziņā un importā (mācību gadam ${esc(U.yearLabel(D.activeYear()))}).</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="groupDialog">Atcelt</button><button class="mainbtn" type="submit">Pievienot</button></footer></form>`);
    d.querySelector('[name=name]').focus();
    d.querySelector('form').onsubmit = e => {
      e.preventDefault(); const n = e.target.name.value.trim(); if (!n) return;
      if (!D.addGroup(n)) { d.close(); return ui.toast(`Grupa “${n}” jau ir`, 'warn'); }
      d.close(); CP.store.changed(); ui.datalists(); ui.toast(`Grupa “${n}” pievienota`, 'ok');
    };
  };
  A.groupDel = g => {
    const others = D.groups().filter(x => x !== g), n = members(g).length;
    const d = dlg(`<form><header class="dlg-head"><h2>Dzēst grupu “${esc(g)}”</h2><button type="button" class="ghost" data-close="groupDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body">${!n ? `<p style="margin-top:0">Grupā nav personu. To var droši dzēst.</p>` : `<p style="margin-top:0">Grupā šajā mācību gadā ir <b>${n}</b> ${n === 1 ? 'persona' : 'personas'}. <b>Personas netiek dzēstas</b> — izvēlies, kur tās likt:</p>`}
        <div class="choice-list" ${n ? '' : 'hidden'}>
          ${others.length ? `<label class="choice"><input type="radio" name="how" value="move" checked><div class="grow"><b>Pārcelt uz citu grupu</b><select name="to" aria-label="Grupa, uz kuru pārcelt">${others.map(x => `<option>${esc(x)}</option>`).join('')}</select></div></label>` : ''}
          <label class="choice"><input type="radio" name="how" value="none" ${others.length ? '' : 'checked'}><div class="grow"><b>Atstāt bez grupas</b><div class="small muted">Personas paliek sarakstā, tikai bez grupas</div></div></label>
        </div>
        <p class="small muted">Iepriekšējo mācību gadu dalība netiek mainīta.</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="groupDialog">Atcelt</button><button class="mainbtn danger" type="submit">Dzēst grupu</button></footer></form>`);
    d.querySelector('[name=to]')?.addEventListener('focus', () => { d.querySelector('[name=how][value=move]').checked = true; });
    d.querySelector('form').onsubmit = e => {
      e.preventDefault(); const f = e.target, to = f.how.value === 'move' ? f.to.value : '';
      const k = moveGroup(g, to); d.close(); CP.store.changed();
      ui.toast(to ? `Grupa “${g}” dzēsta — ${k} personas pārceltas uz “${to}”` : `Grupa “${g}” dzēsta — ${k} personas bez grupas`, 'ok', 6000);
    };
  };
})(window.CP);
