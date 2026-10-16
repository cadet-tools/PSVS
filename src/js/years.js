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
      + `<button type="button" data-act="goSetCard" data-arg="yearsCard">Pārvaldīt mācību gadus</button>`;
  }
  CP.years = { paint };

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

  function movePeople() {
    const from = U.$('moveFrom').value, q = U.norm(U.$('moveQ').value).replace(/ /g, '');
    return D.peopleInYear(from).filter(p => !q || U.norm(U.full(p) + ' ' + U.sortName(p)).replace(/ /g, '').includes(q))
      .sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
  }
  function moveCount() {
    const n = U.qsa('#moveList input:checked').length;
    U.$('moveCount').textContent = `Atlasītas: ${n} personas`;
    U.$('moveDo').textContent = n ? `Pārcelt ${n} personas` : 'Pārcelt atlasītās personas';
  }
  function paintMove() {
    const dest = D.activeYear();
    U.$('moveDest').textContent = U.yearLabel(dest);
    const from = U.$('moveFrom').value;
    U.$('moveList').innerHTML = movePeople().map(p => {
      const en = D.enroll(p.id, from);
      const already = !!D.enroll(p.id, dest);
      return `<label class="moveitem ${already ? 'muted' : ''}"><input type="checkbox" value="${esc(p.id)}" ${already ? 'disabled' : ''}> <span><b>${esc(U.full(p))}</b> <small class="muted">${esc(en?.group || 'bez grupas')}${p.status === 'archived' ? ' · arhivēta' : ''}${already ? ' · jau šajā gadā' : ''}</small></span></label>`;
    }).join('') || '<p class="muted">Šajā gadā nav personu.</p>';
    moveCount();
  }
  A.openMove = fromId => {
    const dest = D.activeYear();
    U.$('moveDest').textContent = U.yearLabel(dest);
    const opts = (S.db.years || []).filter(y => y.id !== dest);
    U.$('moveFrom').innerHTML = opts.map(y => `<option value="${esc(y.id)}" ${y.id === fromId ? 'selected' : ''}>${esc(U.yearLabel(y.id))}</option>`).join('');
    if (!opts.length) return ui.toast('Nav cita mācību gada, no kura pārcelt', 'warn');
    U.$('moveQ').value = '';
    U.$('moveGroup').value = '';
    U.$('moveActivate').checked = false;
    paintMove();
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
  A.moveAll = () => { U.qsa('#moveList input:not(:disabled)').forEach(i => { i.checked = true; }); moveCount(); };
  A.moveNone = () => { U.qsa('#moveList input').forEach(i => { i.checked = false; }); moveCount(); };
  A.moveDo = async () => {
    const dest = D.activeYear(), from = U.$('moveFrom').value, group = U.$('moveGroup').value.trim();
    const ids = U.qsa('#moveList input:checked').map(i => i.value);
    if (!ids.length) return ui.toast('Atzīmē vismaz vienu personu', 'warn');
    const archived = ids.filter(id => D.person(id)?.status === 'archived');
    if (archived.length && !U.$('moveActivate').checked && !confirm(`${archived.length} atlasītās personas ir arhivētas. Tās tiks piesaistītas gadam, bet paliks arhivētas. Turpināt?`)) return;
    const skipped = [], added = [], made = [];
    for (const id of ids) {
      const p = D.person(id); if (!p) continue;
      if (D.enroll(id, dest)) { skipped.push(U.full(p)); continue; }
      const src = D.enroll(id, from);
      const activate = p.status === 'archived' && U.$('moveActivate').checked;
      if (activate) { p.status = 'active'; p.updatedAt = U.now(); D.audit(id, 'restore'); }
      D.bindYear(p, {
        yearId: dest,
        group,
        status: p.status === 'archived' ? 'archived' : (src?.status && src.status !== 'archived' ? src.status : 'active'),
        note: `Pārcelts no ${U.yearLabel(from)}`,
        fromYearId: from
      });
      added.push(U.full(p));
      made.push(p);
      D.audit(id, 'year-move', [U.yearLabel(from) + ' → ' + U.yearLabel(dest)]);
    }
    for (const p of made) {
      try { await CP.store.ensurePersonYearFolder(p, dest); }
      catch (err) { ui.toast('Jaunā gada mapi neizdevās izveidot ' + U.full(p) + ': ' + err.message + '. Dokumenti nav kopēti.', 'warn', 9000); }
    }
    U.$('moveDialog').close();
    CP.store.changed();
    ui.toast(`Pārceltas ${added.length} personas.${skipped.length ? ' Jau bija šajā gadā: ' + skipped.join(', ') : ''}`, skipped.length ? 'warn' : 'ok', 9000);
  };

})(window.CP);
