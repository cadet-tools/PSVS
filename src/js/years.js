/* =====================================================================
   Mācību gadi: reģistrs, izvēlne, mapes, personu pārcelšana.
   Viena persona paliek viens profils. Gadam pieder tikai dalības ieraksts.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;

  function paint() {
    const btn = U.$('yearBtn'), menu = U.$('yearMenu');
    if (!btn || !menu) return;
    const id = D.activeYear();
    btn.textContent = `Mācību gads: ${U.yearSlash(id)} ▾`;
    const years = [...(S.db.years || [])].sort((a, b) => b.start - a.start);
    menu.innerHTML = years.map(y => `<button type="button" data-act="setYear" data-arg="${esc(y.id)}" class="${y.id === id ? 'on' : ''}">${esc(U.yearSlash(y.id))}${y.id === id ? ' · izvēlēts' : ''}${y.id === U.schoolYear() ? ' · pašreizējais' : ''}</button>`).join('')
      + `<button type="button" data-act="openAddYear">＋ Pievienot mācību gadu</button>`
      + (CP.yearEnd ? `<button type="button" data-act="yearEnd">✓ Noslēgt mācību gadu…</button>` : '')
      + `<button type="button" data-act="goSetCard" data-arg="yearsCard">Pārvaldīt mācību gadus</button>`;
  }
  /* --- Mācību gada dzēšana: tukšu — pēc apstiprinājuma; ar datiem — vispirms pārceļ uz citu gadu --- */
  function yearContent(id) {
    const db = S.db, n = (arr, f = x => x.yearId === id) => (arr || []).filter(f).length;
    return [
      ['dalības', n(db.enrollments)], ['nodarbības', n(db.sessions)], ['pasākumi', n(db.events)], ['VFS testi', n(db.vfsTests)],
      ['grupas', ((db.settings.groupsByYear || {})[id] || []).length]
    ].filter(([, c]) => c);
  }
  function dropYear(id) {
    const s = S.db.settings;
    S.db.years = S.db.years.filter(y => y.id !== id);
    s.yearsDeleted = [...new Set([...(s.yearsDeleted || []), id])];
    if (s.groupsByYear) delete s.groupsByYear[id];
  }
  A.yearDelete = id => {
    if (!D.yearById(id)) return;
    if (id === D.activeYear() || id === U.schoolYear()) return ui.toast('Izvēlēto un pašreizējo mācību gadu nevar dzēst', 'warn');
    const what = yearContent(id);
    if (!what.length) {
      if (!confirm(`Dzēst mācību gadu ${U.yearLabel(id)}?\n\nTajā nav neviena ieraksta. Mape datorā (Macibu_gadi/${id}) netiek dzēsta.`)) return;
      dropYear(id); CP.store.changed(); CP.render(); paint();
      return ui.toast(`Mācību gads ${U.yearLabel(id)} dzēsts`, 'ok');
    }
    const targets = [...S.db.years].filter(y => y.id !== id).sort((a, b) => Math.abs(a.start - D.yearById(id).start) - Math.abs(b.start - D.yearById(id).start));
    let dlg = U.$('yearDelDialog');
    if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'yearDelDialog'; document.body.appendChild(dlg); }
    dlg.innerHTML = `<form method="dialog" id="yearDelForm">
      <header class="dlg-head"><h2>Dzēst mācību gadu ${esc(U.yearLabel(id))}</h2><button type="button" class="ghost" data-close="yearDelDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><p>Šajā gadā ir dati: <b>${what.map(([l, c]) => `${esc(l)} ${c}`).join(', ')}</b>.</p>
        <p>Pirms dzēšanas tie jāpārceļ uz citu mācību gadu.</p>
        <div class="field"><label for="yearDelTo">Pārcelt uz</label><select id="yearDelTo">${targets.map(y => `<option value="${esc(y.id)}">${esc(U.yearLabel(y.id))}${y.id === D.activeYear() ? ' · izvēlētais' : ''}</option>`).join('')}</select></div>
        <p class="small muted">Ja persona jau ir izvēlētajā gadā, tur paliek tās esošā dalība (grupa, statuss). Dokumenti un ekipējums saglabā savu saņemšanas gadu; faili datorā netiek pārvietoti, un saites uz tiem darbojas kā līdz šim. Mape Macibu_gadi/${esc(id)} datorā paliek.</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="yearDelDialog">Atcelt</button><button type="button" class="mainbtn danger" id="yearDelGo">Pārcelt un dzēst</button></footer></form>`;
    dlg.querySelector('#yearDelGo').onclick = () => {
      const to = dlg.querySelector('#yearDelTo').value; if (!to || to === id) return;
      if (!confirm(`Pārcelt visus ${U.yearLabel(id)} datus uz ${U.yearLabel(to)} un dzēst ${U.yearLabel(id)}?`)) return;
      const db = S.db; let kept = 0;
      db.enrollments = db.enrollments.filter(e => {
        if (e.yearId !== id) return true;
        if (D.enroll(e.personId, to)) { kept++; return false; }
        e.yearId = to; return true;
      });
      // dokumenti, ekipējums, uzdevumi un saziņa paliek ar savu (vēsturisko) gadu — no tā atkarīgs, piem., ārsta izziņas derīgums
      for (const k of ['sessions', 'events', 'vfsTests']) for (const r of db[k] || []) if (r.yearId === id) r.yearId = to;
      const g = db.settings.groupsByYear || {};
      if (g[id]?.length) D.setDeclaredGroups([...(g[to] || []), ...g[id]], to);
      dropYear(id);
      dlg.close(); CP.store.changed(); CP.render(); paint();
      ui.toast(`${U.yearLabel(id)} dzēsts, dati pārcelti uz ${U.yearLabel(to)}${kept ? ` (${kept} personām ${U.yearLabel(to)} jau bija dalība — tā saglabāta)` : ''}`, 'ok', 9000);
    };
    dlg.showModal();
  };

  /* --- CADET.LV logo galvenē — loga (ne satura daļas) vidū --- */
  function centerLogo() {
    const bar = document.querySelector('.yearbar'), l = bar?.querySelector('.hdr-logo'); if (!l) return;
    const r = bar.getBoundingClientRect(), pick = U.$('yearPick')?.getBoundingClientRect(), w = l.offsetWidth || 120;
    let x = innerWidth / 2 - r.left;
    if (pick && r.left + x + w / 2 + 12 > pick.left) x = r.width / 2;   // šaurā logā — joslas vidū, lai nepārklātu gada pogu
    l.style.left = Math.round(x) + 'px';
  }
  addEventListener('resize', centerLogo);
  if (window.ResizeObserver) { const ro = new ResizeObserver(centerLogo); const go = () => { const b = document.querySelector('.yearbar'); if (b) { ro.observe(b); centerLogo(); } else setTimeout(go, 200); }; go(); }

  CP.years = { paint, centerLogo };

  A.toggleYear = () => { const m = U.$('yearMenu'); if (m) m.classList.toggle('hidden'); };
  A.setYear = id => {
    if (!D.yearById(id) || id === D.activeYear()) { U.$('yearMenu')?.classList.add('hidden'); return; }
    S.db.settings.activeYear = id;
    S.list.sel.clear();
    U.$('yearMenu')?.classList.add('hidden');
    CP.store.changed();
    ui.toast(`Mācību gads: ${U.yearSlash(id)}. Dati nav pārvietoti.`, 'ok');
  };
  document.addEventListener('click', e => {
    const menu = U.$('yearMenu');
    if (!menu || menu.classList.contains('hidden')) return;
    if (e.target.closest('#yearPick')) return;
    menu.classList.add('hidden');
  });

  function banner() {
    const n = D.unassignedPeople().length;
    const loose = (S.db.documents || []).filter(d => !d.yearId).length + (S.db.equipment || []).filter(e => !e.yearId).length;
    if (!n && !loose) return '';
    return `<section class="card yearnote"><b>Nepiesaistīti ieraksti.</b> ${n ? n + ' personas nav nevienā mācību gadā. ' : ''}${loose ? loose + ' dokumenti vai ekipējuma ieraksti ir bez gada, jo tiem nav datuma. ' : ''}Gads netiek uzminēts.<div class="actions"><button class="mainbtn sm" data-act="openAssign">Piesaistīt gadam…</button></div></section>`;
  }
  CP.years.banner = banner;

  A.ensureFolders = async () => {
    if (!S.root) return ui.toast('Vispirms izvēlies datu mapi', 'warn');
    try { await CP.store.ensureYearFolders(); ui.toast('Mācību gadu mapes ir sagatavotas', 'ok'); }
    catch (e) { ui.toast(e.message, 'err'); }
  };
  A.openAddYear = () => {
    U.$('yearMenu')?.classList.add('hidden');
    const last = Math.max(...(S.db.years || []).map(y => y.start), U.schoolStart());
    U.$('addYearStart').value = last + 1;
    previewYear();
    U.$('addYearDialog').showModal();
  };
  function previewYear() {
    const start = Number(U.$('addYearStart').value);
    const el = U.$('addYearPreview');
    if (!el) return;
    if (!start || start < 1990 || start > 2500) { el.textContent = 'Ievadi sākuma gadu, piemēram, 2027.'; return; }
    const id = U.yearId(start);
    el.textContent = D.yearById(id) ? `${U.yearLabel(id)} jau ir reģistrā.` : `Tiks izveidots ${U.yearLabel(id)}.`;
  }
  CP.inputHandlers.push(e => { if (e.target.id !== 'addYearStart') return false; previewYear(); return true; });
  A.addYearOk = async () => {
    const start = Number(U.$('addYearStart').value);
    if (!start || start < 1990 || start > 2500) return ui.toast('Ievadi sākuma gadu', 'warn');
    const id = U.yearId(start);
    if (D.yearById(id)) return ui.toast(`${U.yearLabel(id)} jau ir`, 'warn');
    S.db.years.push({ id, start, createdAt: U.now() });
    S.db.years.sort((a, b) => a.start - b.start);
    if (U.$('addYearDialog').open) U.$('addYearDialog').close();
    CP.store.changed({ silent: true });
    let folders = '';
    if (S.root) {
      try { await CP.store.ensureYearFolders(); folders = ' Mapes ir izveidotas.'; }
      catch (e) { folders = ' Mapes neizdevās izveidot: ' + e.message; }
    } else folders = ' Mapes tiks izveidotas, kad būs izvēlēta datu mape.';
    const prev = U.yearId(start - 1);
    const go = confirm(`${U.yearLabel(id)} ir pievienots.${folders}\n\nPārslēgties uz šo gadu?`);
    if (go) A.setYear(id);
    else CP.render();
    if (D.yearById(prev) && D.peopleInYear(prev).length && confirm(`Pārcelt personas no ${U.yearLabel(prev)} uz ${U.yearLabel(id)}?`)) {
      if (D.activeYear() !== id) A.setYear(id);
      A.openMove(prev);
    }
  };

  A.openAssign = () => {
    const sel = U.$('assignYear');
    sel.innerHTML = (S.db.years || []).map(y => `<option value="${esc(y.id)}" ${y.id === D.activeYear() ? 'selected' : ''}>${esc(U.yearLabel(y.id))}</option>`).join('');
    U.$('assignInfo').textContent = `${D.unassignedPeople().length} personas un ${(S.db.documents || []).filter(d => !d.yearId).length + (S.db.equipment || []).filter(e => !e.yearId).length} ieraksti bez gada.`;
    U.$('assignDialog').showModal();
  };
  A.assignOk = () => {
    const yearId = U.$('assignYear').value;
    if (!D.yearById(yearId)) return;
    let n = 0;
    for (const p of D.unassignedPeople()) {
      D.bindYear(p, { yearId, group: p.group || '', status: p.status === 'archived' ? 'archived' : (p.status || 'active'), note: 'Piesaistīts manuāli' });
      n++;
    }
    if (U.$('assignLoose').checked) {
      for (const d of S.db.documents) if (!d.yearId) d.yearId = yearId;
      for (const e of S.db.equipment) if (!e.yearId) e.yearId = yearId;
    }
    U.$('assignDialog').close();
    CP.store.changed();
    ui.toast(n ? `Piesaistītas ${n} personas gadam ${U.yearLabel(yearId)}` : 'Personas jau bija piesaistītas', 'ok');
  };

  /* --- Dalībnieku pārcelšana uz citu mācību gadu (atzīmētie — pārceļ, pārējos — pēc izvēles arhivē) --- */
  let moveSel = new Set(), moveFromSeen = '';
  const mvFrom = () => U.$('moveFrom').value, mvTo = () => U.$('moveTo').value;
  function moveAllPeople() { return D.peopleInYear(mvFrom()).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b))); }
  function movePeople() {
    const q = U.norm(U.$('moveQ').value).replace(/ /g, '');
    return moveAllPeople().filter(p => !q || U.norm(U.full(p) + ' ' + U.sortName(p)).replace(/ /g, '').includes(q));
  }
  /** Kurus arhivēs: gada dalībnieki, kas nav atzīmēti, nav arhivēti un nav jau mērķa gadā */
  const moveRest = () => moveAllPeople().filter(p => !moveSel.has(p.id) && p.status !== 'archived' && !D.enroll(p.id, mvTo()));
  function moveCount() {
    const n = [...moveSel].filter(id => !D.enroll(id, mvTo())).length, rest = moveRest().length, arc = U.$('moveArchiveRest').checked && rest;
    U.$('moveCount').textContent = `Atzīmēti: ${n} · nepārcelti: ${rest}`;
    U.$('moveArchiveLbl').innerHTML = `Nepārceltos (${rest}) pārvietot uz arhīvu${rest ? ` — <span class="muted">${esc(moveRest().slice(0, 6).map(U.full).join(', '))}${rest > 6 ? ' …' : ''}</span>` : ''}`;
    U.$('moveDo').textContent = n || arc ? `Pārcelt ${n}${arc ? ` un arhivēt ${rest}` : ''}` : 'Pārcelt';
    U.$('moveDo').disabled = !n && !arc;
  }
  function paintMove() {
    const from = mvFrom(), to = mvTo();
    if (from !== moveFromSeen) {   // jauns avota gads — atzīmē visus aktīvos
      moveFromSeen = from;
      moveSel = new Set(moveAllPeople().filter(p => p.status !== 'archived' && !D.enroll(p.id, to)).map(p => p.id));
    }
    const needIzz = Object.keys(S.db.settings.docValidity || {}).filter(k => (S.db.settings.requiredDocs || []).includes(k));
    U.$('moveList').innerHTML = from === to ? '<p class="warn">Izvēlies citu mācību gadu, uz kuru pārcelt.</p>' : (movePeople().map(p => {
      const en = D.enroll(p.id, from), already = !!D.enroll(p.id, to), eq = D.openEquipment(p).length;
      return `<label class="moveitem ${already ? 'muted' : ''}"><input type="checkbox" data-mv="${esc(p.id)}" ${moveSel.has(p.id) && !already ? 'checked' : ''} ${already ? 'disabled' : ''}>
        <span class="grow"><b>${esc(U.full(p))}</b> <small class="muted">${esc(en?.group || 'bez grupas')}${p.status === 'archived' ? ' · arhivēta' : ''}${already ? ` · jau ${esc(U.yearLabel(to))}` : ''}${eq ? ` · <span class="warn">neatdots ekipējums: ${eq}</span>` : ''}${needIzz.length && !already ? ` · ${esc(needIzz.join(', '))} — jāiesniedz jauna` : ''}</small></span></label>`;
    }).join('') || '<p class="muted">Šajā gadā nav personu.</p>');
    moveCount();
  }
  document.addEventListener('change', e => {
    const id = e.target?.dataset?.mv; if (id != null) { if (e.target.checked) moveSel.add(id); else moveSel.delete(id); moveCount(); return; }
    if (e.target?.id === 'moveTo') paintMove();
    if (e.target?.id === 'moveArchiveRest') moveCount();
  });
  A.openMove = (fromId, toId) => {
    const years = [...(S.db.years || [])].sort((a, b) => b.start - a.start);
    if (years.length < 2) return ui.toast('Vajag vismaz divus mācību gadus. Vispirms pievieno jauno gadu.', 'warn');
    const to = toId && D.yearById(toId) ? toId : D.activeYear();
    const prev = years.find(y => y.id !== to && y.start < (D.yearById(to)?.start ?? 0) && D.peopleInYear(y.id).length)?.id;
    const from = fromId && D.yearById(fromId) && fromId !== to ? fromId : (prev || years.find(y => y.id !== to).id);
    const opt = (sel, skip) => years.map(y => `<option value="${esc(y.id)}" ${y.id === sel ? 'selected' : ''}>${esc(U.yearLabel(y.id))} (${D.peopleInYear(y.id).length})</option>`).join('');
    U.$('moveFrom').innerHTML = opt(from); U.$('moveTo').innerHTML = opt(to);
    U.$('moveQ').value = ''; U.$('moveGroup').value = ''; U.$('moveActivate').checked = false; U.$('moveArchiveRest').checked = true;
    moveFromSeen = ''; paintMove();
    U.$('moveDialog').showModal();
  };
  CP.changeHandlers.push(e => { if (e.target.id !== 'moveFrom') return false; paintMove(); return true; });
  CP.inputHandlers.push(e => {
    if (e.target.id === 'moveQ') { paintMove(); return true; }
    if (e.target.closest?.('#moveList')) { moveCount(); return true; }
    return false;
  });
  document.addEventListener('click', e => {
    const menu = U.$('yearMenu');
    if (!menu || menu.classList.contains('hidden') || e.target.closest('#yearBtn')) return;
    if (e.target.closest('#yearPick')) menu.classList.add('hidden');
  });
  A.moveAll = () => { for (const p of movePeople()) if (!D.enroll(p.id, mvTo())) moveSel.add(p.id); paintMove(); };
  A.moveNone = () => { for (const p of movePeople()) moveSel.delete(p.id); paintMove(); };
  A.moveDo = async () => {
    const from = mvFrom(), dest = mvTo(), group = U.$('moveGroup').value.trim();
    if (!from || !dest || from === dest) return ui.toast('Izvēlies divus dažādus mācību gadus', 'warn');
    const ids = [...moveSel].filter(id => D.person(id) && D.inYear(D.person(id), from));
    const rest = U.$('moveArchiveRest').checked ? moveRest() : [];
    if (!ids.length && !rest.length) return ui.toast('Atzīmē vismaz vienu personu', 'warn');
    const archived = ids.filter(id => D.person(id)?.status === 'archived');
    if (archived.length && !U.$('moveActivate').checked && !confirm(`${archived.length} atlasītās personas ir arhivētas. Tās tiks piesaistītas gadam, bet paliks arhivētas. Turpināt?`)) return;
    if (rest.length && !confirm(`Pārcelt ${ids.length} uz ${U.yearLabel(dest)} un ${rest.length} nepārceltos pārvietot uz arhīvu?\n\n${rest.slice(0, 15).map(U.full).join(', ')}${rest.length > 15 ? ' …' : ''}\n\nArhivētos vēlāk var atjaunot. Viņu dati un dokumenti paliek.`)) return;
    const skipped = [], added = [], made = [];
    for (const id of ids) {
      const p = D.person(id); if (!p) continue;
      if (D.enroll(id, dest)) { skipped.push(U.full(p)); continue; }
      const src = D.enroll(id, from);
      const activate = p.status === 'archived' && U.$('moveActivate').checked;
      if (activate) { p.status = 'active'; p.updatedAt = U.now(); D.audit(id, 'restore'); }
      D.bindYear(p, {
        yearId: dest,
        group: group || src?.group || '',
        status: p.status === 'archived' ? 'archived' : (src?.status && src.status !== 'archived' ? src.status : 'active'),
        note: `Pārcelts no ${U.yearLabel(from)}`,
        fromYearId: from
      });
      added.push(U.full(p)); made.push(p);
      D.audit(id, 'year-move', [U.yearLabel(from) + ' → ' + U.yearLabel(dest)]);
    }
    const [, endFrom] = U.yearSpan(from);
    const left = endFrom && endFrom < U.iso() ? endFrom : U.iso();
    for (const p of rest) CP.people.archivePerson(p, { left, reason: `Nav pārcelts uz ${U.yearLabel(dest)}` });
    for (const p of made) {
      try { await CP.store.ensurePersonYearFolder(p, dest); }
      catch (err) { ui.toast('Jaunā gada mapi neizdevās izveidot ' + U.full(p) + ': ' + err.message, 'warn', 9000); }
    }
    U.$('moveDialog').close();
    CP.store.changed(); CP.render();
    ui.toast(`Pārceltas ${added.length} personas uz ${U.yearLabel(dest)}${rest.length ? `, arhivētas ${rest.length}` : ''}.${skipped.length ? ' Jau bija šajā gadā: ' + skipped.join(', ') : ''}`, skipped.length ? 'warn' : 'ok', 9000,
      dest !== D.activeYear() ? { act: 'setYear', arg: dest, label: `Atvērt ${U.yearLabel(dest)}` } : null);
  };

})(window.CP);
