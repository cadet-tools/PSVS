/* =====================================================================
   Reģistrācija ārējās sistēmās: DVS un e-klase.
   p.reg = { dvs: { done: true, date: 'YYYY-MM-DD' }, eklase: { … } }
   Kamēr nav atzīmēts “ievadīts”, pārskatā un kartītē redzams brīdinājums.
   Iestatījumos (settings.registries) var izvēlēties, kuras sistēmas jāseko.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, A = CP.actions, esc = U.esc;
  const REGS = [{ k: 'dvs', l: 'DVS', loc: 'DVS', long: 'Ievadīts DVS sistēmā' }, { k: 'eklase', l: 'e-klase', loc: 'e-klasē', long: 'Ievadīts e-klasē' }];
  CP.REGS = REGS;
  const on = () => { const s = S.db.settings.registries; return REGS.filter(r => !Array.isArray(s) || s.includes(r.k)); };
  /** Kurām sistēmām persona vēl nav atzīmēta (arhivētām un pārtrauktajām nebrīdina) */
  D.regMissing = p => {
    if (!p || p.status === 'archived' || D.partStatus(p) === 'paused' || D.partStatus(p) === 'archived') return [];
    return on().filter(r => !p.reg?.[r.k]?.done);
  };
  D.regAlerts = roster => roster.map(p => ({ p, m: D.regMissing(p) })).filter(x => x.m.length)
    .map(({ p, m }) => ({ kind: 'registry', personId: p.id, sev: 1, msg: `${U.full(p)}: nav atzīmēts, ka ievadīts — ${m.map(r => r.l).join(', ')}`, when: '' }));

  function setReg(p, k, done) {
    p.reg = { ...(p.reg || {}) };
    if (done) p.reg[k] = { done: true, date: U.iso() }; else delete p.reg[k];
    p.updatedAt = U.now();
    D.audit(p.id, 'update', [`${REGS.find(r => r.k === k)?.l}: ${done ? 'ievadīts' : 'nav ievadīts'}`]);
  }
  A.regToggle = arg => {
    const [id, k] = String(arg).split('|'), p = D.person(id); if (!p) return;
    setReg(p, k, !p.reg?.[k]?.done); CP.store.changed();
  };
  A.bulkReg = k => {
    let n = 0; for (const id of S.list.sel) { const p = D.person(id); if (p && !p.reg?.[k]?.done) { setReg(p, k, true); n++; } }
    CP.store.changed(); CP.ui.toast(`${REGS.find(r => r.k === k)?.l}: atzīmētas ${n} personas`, 'ok');
  };

  /** Kartītes sānu panelis */
  function personCard(p) {
    const list = on(); if (!list.length) return '';
    const miss = D.regMissing(p);
    return `<section class="card reg-card"><h3>${CP.ic('check', '✓')}Reģistrācija</h3>
      ${list.map(r => { const v = p.reg?.[r.k]; return `<label class="reg-row ${v?.done ? 'ok' : (miss.includes(r) ? 'miss' : '')}"><input type="checkbox" data-act="regToggle" data-arg="${p.id}|${r.k}" ${v?.done ? 'checked' : ''}>
        <span class="grow"><b>${esc(r.l)}</b> <small class="muted">${v?.done ? 'ievadīts ' + esc(U.fmtDate(v.date)) : (miss.includes(r) ? '— vēl nav ievadīts' : 'nav jāseko šim statusam')}</small></span></label>`; }).join('')}
      ${miss.length ? `<p class="small warn" style="margin:6px 0 0">⚠ Kad persona ir ievadīta ${miss.map(r => r.loc).join(' un ')}, atzīmē to šeit.</p>` : ''}</section>`;
  }
  CP.registry = { personCard, setReg, REGS };
})(window.CP);
