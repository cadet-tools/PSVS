/* =====================================================================
   Ekipējuma izsniegšana un atdošana + MTL aprites lapa
   MTL lapa nav obligāta, kamēr personai nav izsniegts ekipējums.
   Ja ekipējums ir izsniegts — brīdina, ja MTL lapas nav, vai ja pēc pēdējām
   izmaiņām ekipējumā (izsniegts / atdots / labots) nav pievienota jauna lapa.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const eq = {};

  function table(arr, showPerson = true) {
    if (!arr.length) return '<p class="muted">Nav ierakstu.</p>';
    return `<div class="tablewrap"><table class="table eqtable"><thead><tr>${showPerson ? '<th>Persona</th>' : ''}<th>Ekipējums</th><th>Inv. nr.</th><th>Izmērs</th><th>Daudz.</th><th>Izsniegts</th><th>Atdot līdz</th><th>Statuss</th><th>Piezīmes</th><th></th></tr></thead><tbody>
      ${arr.map(e => {
        const p = D.person(e.personId), late = !e.returned && e.due && U.daysTo(e.due) < 0;
        return `<tr class="${e.returned ? 'done' : ''}">${showPerson ? `<td><a href="#" data-person="${e.personId}" data-goto="equipment">${esc(U.sortName(p))}</a>${mtlBadge(p)}</td>` : ''}
          <td><b>${esc(e.item)}</b></td><td>${esc(e.inventory || '—')}</td><td>${esc(e.size || '—')}</td><td>${esc(e.qty || 1)}</td>
          <td>${U.fmtDate(e.issued)}${e.yearId ? `<div class="muted small">${esc(U.yearLabel(e.yearId))}</div>` : ''}</td><td class="${late ? 'red' : ''}">${e.keep ? '—' : U.fmtDate(e.due) || '—'}</td>
          <td>${e.keep ? `<span class="pill ok" title="Apbalvojums / nozīmīte — nav jāatdod">Pasniegts${e.src?.startsWith('vfs:') ? ' (VFS)' : ''}</span>` : e.returned ? `<span class="pill ok">Atdots ${U.fmtDate(e.returned)}</span>` : `<span class="pill ${late ? 'bad' : 'warn'}">${late ? 'Kavēts' : 'Izsniegts'}</span>`}</td>
          <td class="small">${esc(e.notes || '')}${e.returnNote ? `<div class="muted">Atdodot: ${esc(e.returnNote)}</div>` : ''}</td>
          <td class="right nowrap"><button class="sm ghost" data-act="editEq" data-arg="${e.id}" title="Labot">✎</button>${e.returned || e.keep ? '' : `<button class="sm" data-act="returnEq" data-arg="${e.id}">Atdots</button>`}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  }
  const mtlBadge = p => { const m = D.mtlStatus(p); return m.state === 'missing' ? ' <span class="pill bad" title="Nav MTL aprites lapas">MTL ✗</span>' : m.state === 'outdated' ? ' <span class="pill warn" title="MTL lapa nav atjaunota pēc izmaiņām">MTL ⟳</span>' : ''; };

  /** MTL aprites lapas kartīte personas ekipējuma cilnē */
  function mtlCard(p) {
    const m = D.mtlStatus(p), last = m.latest;
    const status = m.state === 'missing' ? `<p class="warn">⚠ Personai ir izsniegts ekipējums, bet nav pievienota MTL aprites lapa.</p>`
      : m.state === 'outdated' ? `<p class="warn">⚠ Ekipējumā ir izmaiņas (${U.fmtDateTime(m.lastChange)}), bet jauna MTL lapa nav pievienota. Pēdējā lapa: ${U.fmtDate(last.received)}.</p>`
      : m.state === 'ok' ? `<p class="good">✓ MTL lapa ir aktuāla (${U.fmtDate(last.received)}).</p>`
      : `<p class="muted small">Nav izsniegta ekipējuma — MTL lapa nav nepieciešama.</p>`;
    return `<section class="card ${m.state === 'missing' || m.state === 'outdated' ? 'dupcard' : ''}"><h3>${CP.ic('clipboard')}MTL aprites lapa
        <span class="right actions"><button class="sm mainbtn" data-act="attach" data-arg="${p.id}|${esc(D.MTL)}">📎 Pievienot ${last ? 'jaunu ' : ''}lapu</button><button class="sm" data-act="addDoc" data-arg="${p.id}|${esc(D.MTL)}">📄 Papīra</button></span></h3>
      ${status}
      ${m.all.length ? m.all.map((d, i) => `<div class="row doc"><div class="grow"><b>${i === 0 ? 'Pēdējā' : 'Iepriekšējā'}</b> · ${U.fmtDate(d.received)}<div class="small muted">${esc(d.path || 'papīrs (bez faila)')}</div></div>${d.path ? `<button class="sm ${i === 0 ? 'mainbtn' : ''}" data-act="view" data-arg="${esc(d.sourceId || 'main')}|${esc(d.path)}">Atvērt</button>` : ''}</div>`).join('') : ''}</section>`;
  }
  eq.mtlCard = mtlCard;

  eq.personTab = p => {
    const arr = S.db.equipment.filter(e => e.personId === p.id).sort((a, b) => (a.returned ? 1 : 0) - (b.returned ? 1 : 0) || String(b.issued).localeCompare(String(a.issued)));
    return mtlCard(p) + `<section class="card"><h3>${CP.ic('backpack')}Ekipējums <button class="sm mainbtn right" data-act="addEq" data-arg="${p.id}">＋ Izsniegt</button></h3>${table(arr, false)}</section>`;
  };
  CP.pages.equipment = {
    render() {
      const mine = e => D.inYear(D.person(e.personId));
      const awards = S.db.equipment.filter(e => e.keep && mine(e));
      const out = S.db.equipment.filter(e => !e.returned && !e.keep && mine(e)), back = S.db.equipment.filter(e => e.returned && !e.keep && (e.yearId === D.activeYear() || (!e.yearId && mine(e))));
      const people = [...new Set(S.db.equipment.filter(e => !e.keep).map(e => e.personId))].map(D.person).filter(p => p && p.status !== 'archived');
      const mtlIssues = people.map(p => ({ p, m: D.mtlStatus(p) })).filter(x => x.m.state === 'missing' || x.m.state === 'outdated');
      return `<div class="page">${ui.pageHead('Ekipējums', `${out.reduce((n, e) => n + Number(e.qty || 1), 0)} vienības izsniegtas ${new Set(out.map(e => e.personId)).size} personām`, `<button class="mainbtn" data-act="addEq">＋ Izsniegt</button>`)}
        ${mtlIssues.length ? `<section class="card dupcard"><h3>⚠ MTL aprites lapas (${mtlIssues.length})</h3>${mtlIssues.map(x => `<div class="row"><div class="grow"><a href="#" data-person="${x.p.id}" data-goto="equipment">${esc(U.full(x.p))}</a> — <span class="warn">${x.m.state === 'missing' ? 'nav MTL lapas' : 'MTL lapa nav atjaunota pēc izmaiņām'}</span></div><button class="sm" data-act="attach" data-arg="${x.p.id}|${esc(D.MTL)}">📎 Pievienot</button></div>`).join('')}</section>` : ''}
        <section class="card"><h3>Izsniegts</h3>${table(out.sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9'))))}</section>
        ${awards.length ? `<details class="card"><summary><b>Pasniegtās nozīmītes un apbalvojumi (${awards.length})</b> <span class="small muted">— paliek jaunsargam, nav jāatdod</span></summary>${table(awards.sort((a, b) => String(b.issued).localeCompare(String(a.issued))))}</details>` : ''}
        <details class="card"><summary><b>Atdotais (${back.length})</b></summary>${table(back.sort((a, b) => String(b.returned).localeCompare(String(a.returned))))}</details></div>`;
    }
  };

  /* --- Izsniegšana / labošana --- */
  const f = U.$('equipmentForm'), fld = n => f.querySelector(`[name="${n}"]`);   // ne f.elements.item — tas ir iebūvēts metodes nosaukums
  A.addEq = pid => {
    if (!S.db.people.length) return ui.toast('Vispirms pievieno personu', 'warn');
    f.reset(); f.dataset.edit = ''; U.$('eqTitle').textContent = 'Izsniegt ekipējumu'; U.$('eqDel').classList.add('hidden'); U.$('eqReturnedWrap').classList.add('hidden'); U.$('eqRetNoteWrap').classList.add('hidden');
    ui.personOptions('eqPerson', pid || S.selected); fld('issued').value = U.iso(); fld('qty').value = 1; U.$('equipmentDialog').showModal(); fld('item').focus();
  };
  A.editEq = id => {
    const e = S.db.equipment.find(x => x.id === id); if (!e) return;
    f.reset(); f.dataset.edit = id; U.$('eqTitle').textContent = 'Labot ekipējumu'; U.$('eqDel').classList.remove('hidden'); U.$('eqReturnedWrap').classList.remove('hidden'); U.$('eqRetNoteWrap').classList.remove('hidden');
    ui.personOptions('eqPerson', e.personId, true);
    for (const k of ['item', 'inventory', 'size', 'qty', 'issued', 'due', 'notes', 'returned', 'returnNote']) fld(k).value = e[k] ?? (k === 'qty' ? 1 : '');
    fld('keep').checked = !!e.keep;
    U.$('equipmentDialog').showModal();
  };
  f.addEventListener('submit', ev => {
    ev.preventDefault(); const o = Object.fromEntries(new FormData(f)); o.qty = Number(o.qty || 1); o.keep = fld('keep').checked || undefined; if (o.keep) { o.due = ''; o.returned = ''; }
    if (f.dataset.edit) {
      const e = S.db.equipment.find(x => x.id === f.dataset.edit), changed = Object.keys(o).filter(k => String(e[k] ?? '') !== String(o[k] ?? ''));
      if (changed.length) { Object.assign(e, o); if (!e.keep) delete e.keep; e.changedAt = U.now(); D.audit(e.personId, 'eq-edit', [e.item]); CP.vfs?.eqChanged(e); }
    } else { if (!o.keep) delete o.keep; S.db.equipment.push({ ...o, id: U.uid(), returned: '', changedAt: U.now(), yearId: D.activeYear() }); D.audit(o.personId, 'eq-issue', [`${o.item}${o.qty > 1 ? ' × ' + o.qty : ''}`]); }
    U.$('equipmentDialog').close(); CP.store.changed(); mtlReminder(o.personId);
  });
  A.delEq = () => {
    const e = S.db.equipment.find(x => x.id === f.dataset.edit); if (!e || !confirm(`Dzēst ierakstu “${e.item}”? (Ja ekipējums atdots — labāk atzīmē “Atdots”.)`)) return;
    S.db.equipment = S.db.equipment.filter(x => x !== e); CP.vfs?.eqChanged(e, true); D.audit(e.personId, 'eq-delete', [e.item]); U.$('equipmentDialog').close(); CP.store.changed();
  };
  A.returnEq = id => {
    const x = S.db.equipment.find(z => z.id === id); if (!x) return;
    const note = prompt(`“${x.item}” atdots. Piezīme par stāvokli (nav obligāta):`, ''); if (note === null) return;
    x.returned = U.iso(); x.returnNote = note.trim(); x.changedAt = U.now(); D.audit(x.personId, 'eq-return', [x.item]); CP.store.changed(); mtlReminder(x.personId);
  };
  /** Pēc izmaiņām ekipējumā atgādina pievienot jaunu MTL lapu */
  function mtlReminder(pid) {
    const p = D.person(pid), m = p && D.mtlStatus(p);
    if (m && (m.state === 'missing' || m.state === 'outdated')) ui.toast(m.state === 'missing' ? 'Ekipējums izsniegts — pievieno MTL aprites lapu.' : 'Ekipējumā izmaiņas — pievieno atjaunotu MTL aprites lapu.', 'warn', 10000, { label: '📎 Pievienot MTL', act: 'attach', arg: `${pid}|${D.MTL}` });
  }
  CP.equipment = eq;
})(window.CP);
