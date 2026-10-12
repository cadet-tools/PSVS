/* =====================================================================
   Pārskats un uzdevumu / brīdinājumu lapa
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const SEV = ['info', 'warn', 'bad'], ICON = { mtl: '▣', phone: '☎', task: '☐', retention: '🗄', birthday: '🎂', adult: '🔞', equipment: '▣', document: '📄' };

  const alertRow = a => `<div class="row alert ${SEV[a.sev]}"><span class="al-ic">${ICON[a.kind] || '•'}</span><div class="grow">${esc(a.msg)}${a.when ? `<small class="muted"> · ${U.fmtDate(a.when)}</small>` : ''}</div>
    ${a.year ? `<small class="muted">${esc(U.yearSlash(a.year))}</small>` : ''}${a.taskId ? `<button class="sm" data-act="taskDone" data-arg="${a.taskId}">✓ Izpildīts</button>` : ''}${a.personId ? `<button class="sm" data-person="${a.personId}">Atvērt</button>` : ''}</div>`;

  CP.pages.dashboard = {
    render() {
      const cur = D.peopleInYear().filter(D.isCurrent), al = D.alerts();
      const miss = cur.map(p => ({ p, m: D.missingDocs(p) })).filter(x => x.m.length).sort((a, b) => b.m.length - a.m.length || U.cmp(U.sortName(a.p), U.sortName(b.p)));
      const cnt = s => cur.filter(p => D.partStatus(p) === s).length;
      const recent = [...S.db.audit].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 8);
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
        <div class="actions">${S.pendingRoot ? `<button class="mainbtn" data-act="restoreRoot">🔓 Atļaut piekļuvi mapei “${esc(S.pendingRoot.name)}”</button><button data-act="pickRoot">Izvēlēties citu mapi</button>` : `<button class="mainbtn" data-act="pickRoot">📁 Izvēlēties datu mapi</button>`}</div>
        ${ui.rootDrop()}
        <p class="muted small">Dati tiek glabāti tikai tavā datorā (JSON failā bez šifrēšanas) — tos aizsargā datora konta un mapes tiesības.</p></section>`
        : B?.step === 'index' ? `<div class="bootidx"><span class="spin"></span> Indeksē dokumentus mapē “${esc(B.name || '')}”… <b id="bootIdxN">${B.count || 0}</b> faili. Vari strādāt — dokumentu saraksti papildināsies.</div>` : '';
      const head = ui.pageHead('Pārskats', `${U.yearLabel(D.activeYear())} · ` + new Date().toLocaleDateString('lv-LV', { weekday: 'long', day: 'numeric', month: 'long' }), ui.saveBtn());
      if (!S.root && B && B.step !== 'index') return `<div class="page">${head}${start}</div>`;   // kamēr mape atveras vai nav pieejama — tikai statuss
      return `<div class="page">${ui.pageHead('Pārskats', `${U.yearLabel(D.activeYear())} · ` + new Date().toLocaleDateString('lv-LV', { weekday: 'long', day: 'numeric', month: 'long' }), ui.saveBtn())}
        ${start}
        ${CP.years?.banner() || ''}
        <div class="stats">
          <button class="stat" data-act="openList" data-arg="active"><span>Aktīvie</span><strong>${cnt('active')}</strong></button>
          <button class="stat" data-act="openList" data-arg="candidate"><span>Kandidāti</span><strong>${cnt('candidate')}</strong></button>
          <button class="stat" data-act="openList" data-arg="missing"><span>Trūkst dokumentu</span><strong class="${miss.length ? 'warn' : ''}">${miss.length}</strong></button>
          <button class="stat" data-page="documents"><span>Dokumenti šajā gadā</span><strong>${S.db.documents.filter(d => d.yearId === D.activeYear() || (!d.yearId && D.inYear(D.person(d.personId)))).length}</strong></button>
          <button class="stat" data-page="equipment"><span>Izsniegts ekipējums</span><strong>${S.db.equipment.filter(x => !x.returned && D.inYear(D.person(x.personId))).length}</strong></button>
          <button class="stat" data-page="alerts"><span>Uzdevumi un brīdinājumi</span><strong class="${al.some(a => a.sev > 1) ? 'red' : al.length ? 'warn' : ''}">${al.length}</strong></button>
        </div>
        <section class="card quick"><button class="mainbtn" data-act="scan">📷 Ievadīt no anketas</button><button data-act="addPerson">＋ Jauna persona</button><button data-page="comms">✉ Ziņa grupai</button><button data-act="import">⬆ Imports no Excel / e-klases</button>${(S.db.settings.tools || []).filter(t => t.name && /^https?:/.test(t.url || '') && !/\{/.test(t.url)).map(t => `<a class="btn" href="${esc(t.url)}" target="_blank" rel="noopener">↗ ${esc(t.name)}</a>`).join('')}</section>
        <div class="cards2">
          <section class="card"><h3>Uzdevumi un brīdinājumi <button class="ghost sm right" data-page="alerts">Visi →</button></h3>${al.slice(0, 8).map(alertRow).join('') || '<p class="muted">Nekas nav jādara. ✓</p>'}</section>
          <section class="card"><h3>Trūkstošie dokumenti <button class="ghost sm right" data-act="openList" data-arg="missing">Visi →</button></h3>${miss.slice(0, 8).map(x => `<div class="row"><div class="who">${ui.avatar(x.p, 'sm')}<span><b>${esc(U.sortName(x.p))}</b><small class="muted">${esc(D.groupOf(x.p) || '')}</small></span></div><div class="grow small warn">${esc(x.m.join(', '))}</div><button class="sm" data-person="${x.p.id}" data-goto="docs">Atvērt</button></div>`).join('') || '<p class="muted">Visiem ir obligātie dokumenti. ✓</p>'}</section>
          <section class="card"><h3>Grupas</h3>${D.groups().map(g => `<div class="row"><div class="grow"><b>${esc(g)}</b></div><span class="muted">${cur.filter(p => D.groupOf(p) === g).length}</span></div>`).join('') || '<p class="muted">Šajā gadā grupas vēl nav.</p>'}</section>
          <section class="card wide"><h3>Pēdējās izmaiņas</h3>${recent.map(a => { const p = D.person(a.personId); return `<div class="row"><span class="muted small nowrap">${U.fmtDateTime(a.at)}</span><div class="grow">${p ? `<a href="#" data-person="${p.id}">${esc(U.full(p))}</a> — ` : ''}${esc({ create: 'izveidota kartīte', update: 'mainīti dati', scan: 'ievadīta no anketas', archive: 'arhivēta', restore: 'atjaunota', status: 'mainīts statuss', 'doc-add': 'pievienots dokuments', 'doc-remove': 'noņemts dokuments', 'doc-relink': 'atjaunota dokumenta sasaiste', 'eq-issue': 'izsniegts ekipējums', 'eq-return': 'atdots ekipējums', 'eq-edit': 'labots ekipējums', 'eq-delete': 'dzēsts ekipējuma ieraksts', erase: 'dzēsts reģistra ieraksts' }[a.action] || a.action)}${a.fields?.length ? ': ' + esc(a.fields.join(', ')) : ''}</div></div>`; }).join('') || '<p class="muted">Vēl nav izmaiņu.</p>'}</section>
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
    const al = D.alerts(), urgent = al.filter(a => a.sev >= 1), soon = al.filter(a => a.sev === 0);
    try { await CP.store.idbSet(key, today); } catch (e) { /* tikai ērtībai */ }
    if (!ages.length && !urgent.length && !soon.length) return;
    const row = a => `<div class="row alert ${SEV[a.sev]}"><span class="al-ic">${ICON[a.kind] || '•'}</span><div class="grow">${esc(a.msg)}${a.when ? `<small class="muted"> · ${U.fmtDate(a.when)}</small>` : ''}</div>${a.personId ? `<button class="sm" data-person="${a.personId}" data-close="noticeDialog" data-goto="${a.kind === 'mtl' ? 'equipment' : a.kind === 'document' ? 'docs' : 'overview'}">Atvērt</button>` : ''}</div>`;
    U.$('noticeBody').innerHTML =
      (ages.length ? `<h4 style="margin-top:0">🎂 Vecuma izmaiņas kopš ${U.fmtDate(last)}</h4>${ages.map(x => `<div class="row"><div class="grow"><b>${esc(U.full(x.p))}</b> — tagad <b>${x.age} g.</b>${x.age === 18 ? ' <span class="pill warn">pilngadīgs — pārstāvja piekrišana vairs nav vajadzīga, pārbaudi kontaktus un līgumu</span>' : ''}</div><button class="sm" data-person="${x.p.id}" data-close="noticeDialog">Atvērt</button></div>`).join('')}` : '')
      + (urgent.length ? `<h4>⚠ Jāpievērš uzmanība (${urgent.length})</h4>${urgent.slice(0, 25).map(row).join('')}${urgent.length > 25 ? `<p class="muted small">… un vēl ${urgent.length - 25}</p>` : ''}` : '')
      + (soon.length ? `<h4>📅 Drīzumā</h4>${soon.slice(0, 15).map(row).join('')}` : '');
    U.$('noticeDialog').showModal();
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
