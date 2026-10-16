/* =====================================================================
   Jaunsarga apliecība — neobligāta, tāpat kā ekipējums.
   Glabājas personas ierakstā: p.idCard = { status, number, requested, issued, validUntil, notes, changedAt }
   Skenējums — parasts dokuments ar veidu “Jaunsarga apliecība”.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const KIND = D.IDCARD = 'Jaunsarga apliecība';
  const ST = D.IDCARD_STATUS = {
    none: { l: 'Nav pieprasīta', c: '' },
    requested: { l: 'Pieprasīta', c: 'warn' },
    ready: { l: 'Saņemta, jāpasniedz', c: 'warn' },
    issued: { l: 'Izdota', c: 'ok' },
    returned: { l: 'Nodota atpakaļ', c: '' },
    lost: { l: 'Nozaudēta', c: 'bad' }
  };
  const card = p => p?.idCard || null;
  const scans = p => S.db.documents.filter(d => d.personId === p.id && d.kind === KIND).sort((a, b) => String(b.received || b.addedAt || '').localeCompare(String(a.received || a.addedAt || '')));
  const numKey = n => String(n || '').replace(/\s+/g, '').toUpperCase();

  /** Cita persona ar to pašu numuru */
  D.idCardDuplicate = (num, selfId) => { const k = numKey(num); return k ? S.db.people.find(x => x.id !== selfId && numKey(x.idCard?.number) === k) : null; };

  /** Brīdinājumi (izsauc D.alerts pašreizējā mācību gadā) */
  D.idCardAlerts = roster => {
    const out = [];
    for (const p of roster) {
      const c = card(p); if (!c || !c.status || c.status === 'none') continue;
      const who = U.full(p);
      if ((c.status === 'issued' || c.status === 'ready') && !String(c.number || '').trim()) out.push({ kind: 'idcard', personId: p.id, sev: 1, msg: `${who}: apliecība ${c.status === 'issued' ? 'izdota' : 'saņemta'}, bet nav ievadīts numurs`, when: '' });
      if (c.status === 'issued' && c.validUntil) {
        const d = U.daysTo(c.validUntil);
        if (d < 0) out.push({ kind: 'idcard', personId: p.id, sev: 1, msg: `${who}: jaunsarga apliecībai beidzies derīgums`, when: c.validUntil });
        else if (d <= 30) out.push({ kind: 'idcard', personId: p.id, sev: 0, msg: `${who}: apliecība derīga vēl ${d} d.`, when: c.validUntil });
      }
      if (c.status === 'requested' && c.requested && U.daysTo(c.requested) < -60) out.push({ kind: 'idcard', personId: p.id, sev: 0, msg: `${who}: apliecība pieprasīta pirms ${-U.daysTo(c.requested)} dienām, vēl nav saņemta`, when: c.requested });
      if (c.status === 'ready') out.push({ kind: 'idcard', personId: p.id, sev: 0, msg: `${who}: apliecība saņemta — jāpasniedz jaunsargam`, when: '' });
      if (c.status === 'issued' && (p.status === 'archived' || p.status === 'paused')) out.push({ kind: 'idcard', personId: p.id, sev: 1, msg: `${who}: dalība beigusies, bet apliecība nav nodota atpakaļ`, when: '' });
      if (c.status === 'issued' && c.number && D.idCardDuplicate(c.number, p.id)) out.push({ kind: 'idcard', personId: p.id, sev: 1, msg: `${who}: apliecības nr. ${c.number} ievadīts arī citai personai`, when: '' });
    }
    return out;
  };

  /** Īss statuss (cilnes skaitītājam / sarakstiem) */
  D.idCardBadge = p => {
    const c = card(p); if (!c || !c.status || c.status === 'none') return '';
    const bad = D.idCardAlerts([p]).some(a => a.sev > 0);
    return bad ? '<span class="warn">⚠</span>' : c.status === 'issued' ? '✓' : '•';
  };

  /** Personas cilne “Apliecība” */
  CP.idcard = {
    personTab(p) {
      const c = card(p), st = ST[c?.status || 'none'] || ST.none, sc = scans(p), al = D.idCardAlerts([p]);
      const dup = c?.number ? D.idCardDuplicate(c.number, p.id) : null;
      const rows = c && c.status && c.status !== 'none' ? ui.dl([
        ['Statuss', `<span class="pill ${st.c}">${esc(st.l)}</span>`, true],
        ['Apliecības numurs', c.number ? `<b class="mono">${esc(c.number)}</b>${dup ? ` <span class="pill bad">sakrīt ar: ${esc(U.full(dup))}</span>` : ''}` : '<span class="muted">nav ievadīts</span>', true],
        ['Pieprasīta', U.fmtDate(c.requested)],
        ['Izdota', U.fmtDate(c.issued)],
        ['Derīga līdz', c.validUntil ? `${esc(U.fmtDate(c.validUntil))}${U.daysTo(c.validUntil) < 0 ? ' <span class="pill bad">beidzies</span>' : ''}` : '', true],
        ['Piezīmes', c.notes || '']
      ]) : `<p class="muted">Apliecības dati nav ievadīti.</p>`;
      return `<section class="card ${al.some(a => a.sev > 0) ? 'dupcard' : ''}"><h3>${CP.ic('idcard', '🪪')} Jaunsarga apliecība
          <span class="right actions"><button class="sm mainbtn" data-act="editIdCard" data-arg="${p.id}">${c && c.status && c.status !== 'none' ? '✎ Labot' : '＋ Ievadīt datus'}</button></span></h3>
        ${al.length ? al.map(a => `<p class="${a.sev ? 'warn' : 'muted'}">${a.sev ? '⚠' : 'ℹ'} ${esc(a.msg.replace(U.full(p) + ': ', ''))}</p>`).join('') : ''}
        ${rows}</section>
        <section class="card"><h3>Apliecības kopija
          <span class="right actions"><button class="sm" data-act="attach" data-arg="${p.id}|${esc(KIND)}">📎 Pievienot skenējumu</button></span></h3>
        ${sc.length ? sc.map((d, i) => `<div class="row doc"><div class="grow"><b>${i === 0 ? 'Pēdējā' : 'Iepriekšējā'}</b> · ${U.fmtDate(d.received)}<div class="small muted">${esc(d.path || 'papīrs (bez faila)')}</div></div>${d.path ? `<button class="sm ${i === 0 ? 'mainbtn' : ''}" data-act="view" data-arg="${esc(d.sourceId || 'main')}|${esc(d.path)}">Atvērt</button>` : ''}</div>`).join('') : '<p class="muted small">Nav pievienota.</p>'}</section>`;
    }
  };

  /* --- Labošanas logs --- */
  const f = U.$('idCardForm'), fld = n => f.querySelector(`[name="${n}"]`);
  function syncFields() {
    const s = fld('status').value;
    U.qsa('#idCardForm [data-when]').forEach(el => el.classList.toggle('hidden', !el.dataset.when.split(' ').includes(s)));
    const dup = D.idCardDuplicate(fld('number').value, f.dataset.pid);
    U.$('idCardHint').innerHTML = dup ? `<span class="warn">⚠ Šis numurs jau ievadīts: ${esc(U.full(dup))}</span>` : '';
  }
  A.editIdCard = pid => {
    const p = D.person(pid); if (!p) return;
    const c = card(p) || {};
    f.reset(); f.dataset.pid = pid;
    U.$('idCardTitle').textContent = 'Jaunsarga apliecība — ' + U.full(p);
    for (const k of ['status', 'number', 'requested', 'issued', 'validUntil', 'notes']) fld(k).value = c[k] || (k === 'status' ? 'none' : '');
    syncFields(); U.$('idCardDialog').showModal(); fld('status').focus();
  };
  f.addEventListener('change', e => {
    if (e.target.name === 'status') {   // ērtībai — šodienas datums, ja vēl nav
      const s = e.target.value;
      if (s === 'requested' && !fld('requested').value) fld('requested').value = U.iso();
      if (s === 'issued' && !fld('issued').value) fld('issued').value = U.iso();
    }
    syncFields();
  });
  f.addEventListener('input', e => { if (e.target.name === 'number') syncFields(); });
  f.addEventListener('submit', ev => {
    ev.preventDefault();
    const p = D.person(f.dataset.pid); if (!p) return;
    const o = Object.fromEntries(new FormData(f)); for (const k in o) o[k] = String(o[k] || '').trim();
    if ((o.status === 'issued' || o.status === 'ready') && !o.number && !confirm('Apliecības numurs nav ievadīts. Saglabāt tāpat?')) return;
    const dup = D.idCardDuplicate(o.number, p.id);
    if (dup && !confirm(`Numurs ${o.number} jau ievadīts personai ${U.full(dup)}. Saglabāt tāpat?`)) return;
    const prev = p.idCard || {}, changed = Object.keys(o).filter(k => String(prev[k] || '') !== o[k]);
    if (changed.length) {
      p.idCard = { ...prev, ...o, changedAt: U.now() };
      p.updatedAt = U.now();
      D.audit(p.id, 'idcard', [ST[o.status]?.l || o.status, ...(o.number && changed.includes('number') ? ['nr. ' + o.number] : [])]);
      CP.store.changed();
    }
    U.$('idCardDialog').close();
    if (changed.includes('status') && o.status === 'issued' && !scans(p).length) ui.toast('Apliecība atzīmēta kā izdota. Ja vēlies, pievieno tās kopiju.', 'ok', 9000, { act: 'attach', arg: `${p.id}|${KIND}`, label: '📎 Pievienot' });
  });
})(window.CP);
