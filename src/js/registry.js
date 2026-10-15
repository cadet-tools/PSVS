/* =====================================================================
   Reģistrācija ārējās sistēmās: DVS (pa dokumentiem) un e-klase.
   p.reg = { dvs: { docs: { 'Pieteikuma anketa': { done, date }, 'Līgums': {…}, … } },
             eklase: { done: true, date } }
   DVS dokumentu saraksts = obligātie dokumenti (Iestatījumi → Dokumenti).
   Katru dokumentu var reģistrēt citā datumā. Kamēr kāds nav atzīmēts — brīdinājums
   pārskatā un sadaļā Uzdevumi. Vecā vienotā DVS atzīme tiek nolasīta kā “visi dokumenti”.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, A = CP.actions, esc = U.esc;
  const REGS = [{ k: 'dvs', l: 'DVS', loc: 'DVS', long: 'Reģistrēts DVS sistēmā' }, { k: 'eklase', l: 'e-klase', loc: 'e-klasē', long: 'Ievadīts e-klasē' }];
  CP.REGS = REGS;
  const on = () => { const s = S.db.settings.registries; return REGS.filter(r => !Array.isArray(s) || s.includes(r.k)); };
  const dvsDocs = () => (S.db.settings.requiredDocs || []).filter(Boolean);
  const followed = p => !!p && p.status !== 'archived' && !['paused', 'archived'].includes(D.partStatus(p));
  /** DVS atzīme konkrētam dokumentam (ar vecās vienotās atzīmes atbalstu) */
  const dvsOf = (p, kind) => { const d = p.reg?.dvs; if (!d) return null; if (d.docs?.[kind]?.done) return d.docs[kind]; if (d.done && !d.docs) return { done: true, date: d.date }; return null; };
  D.dvsMissing = p => followed(p) && on().some(r => r.k === 'dvs') ? dvsDocs().filter(k => !dvsOf(p, k)) : [];
  /** Saderībai: sistēmas, kur kaut kas nav atzīmēts */
  D.regMissing = p => {
    if (!followed(p)) return [];
    return on().filter(r => r.k === 'dvs' ? D.dvsMissing(p).length : !p.reg?.[r.k]?.done);
  };
  D.regAlerts = roster => {
    const out = [];
    for (const p of roster) {
      if (!followed(p)) continue;
      const dm = D.dvsMissing(p), ek = on().some(r => r.k === 'eklase') && !p.reg?.eklase?.done;
      if (dm.length) {
        const inTool = dm.filter(k => !D.missingDocs(p).includes(k));
        out.push({ kind: 'registry', personId: p.id, sev: 1, when: '',
          msg: `${U.full(p)}: DVS nav reģistrēts — ${dm.join(', ')}${inTool.length ? ` (rīkā jau pievienots: ${inTool.join(', ')})` : ''}` });
      }
      if (ek) out.push({ kind: 'registry', personId: p.id, sev: 1, when: '', msg: `${U.full(p)}: nav atzīmēts, ka ievadīts e-klasē` });
    }
    return out;
  };

  function normDvs(p) {
    const d = p.reg?.dvs || {};
    if (d.done && !d.docs) return { docs: Object.fromEntries(dvsDocs().map(k => [k, { done: true, date: d.date }])) };   // vecā atzīme → visi
    return { docs: { ...(d.docs || {}) } };
  }
  function setDvs(p, kind, done, date) {
    p.reg = { ...(p.reg || {}) };
    const d = normDvs(p);
    if (done) d.docs[kind] = { done: true, date: date || d.docs[kind]?.date || U.iso() }; else delete d.docs[kind];
    p.reg.dvs = d; p.updatedAt = U.now();
  }
  function setReg(p, k, done) {
    if (k === 'dvs') { for (const kind of dvsDocs()) setDvs(p, kind, done); D.audit(p.id, 'update', [`DVS: ${done ? 'reģistrēti visi dokumenti' : 'atzīmes noņemtas'}`]); return; }
    p.reg = { ...(p.reg || {}) };
    if (done) p.reg[k] = { done: true, date: U.iso() }; else delete p.reg[k];
    p.updatedAt = U.now();
    D.audit(p.id, 'update', [`${REGS.find(r => r.k === k)?.l}: ${done ? 'ievadīts' : 'nav ievadīts'}`]);
  }
  A.regToggle = arg => {
    const [id, k] = String(arg).split('|'), p = D.person(id); if (!p) return;
    setReg(p, k, !p.reg?.[k]?.done); CP.store.changed();
  };
  A.dvsToggle = arg => {
    const [id, i] = String(arg).split('|'), p = D.person(id), kind = dvsDocs()[Number(i)]; if (!p || !kind) return;
    const was = !!dvsOf(p, kind); setDvs(p, kind, !was);
    D.audit(p.id, 'update', [`DVS — ${kind}: ${was ? 'atzīme noņemta' : 'reģistrēts'}`]); CP.store.changed();
  };
  /** Reģistrācijas datuma maiņa (dokuments var būt reģistrēts citā dienā) */
  CP.changeHandlers.push(e => {
    const t = e.target, v = t.dataset?.dvsdate; if (v == null) return false;
    const [id, i] = v.split('|'), p = D.person(id), kind = dvsDocs()[Number(i)]; if (!p || !kind || !t.value) return true;
    setDvs(p, kind, true, t.value); D.audit(p.id, 'update', [`DVS — ${kind}: datums ${U.fmtDate(t.value)}`]);
    setTimeout(() => CP.store.changed(), 0); return true;
  });
  A.bulkReg = k => {
    let n = 0;
    for (const id of S.list.sel) {
      const p = D.person(id); if (!p) continue;
      if (k === 'dvs' ? D.dvsMissing(p).length || !dvsDocs().every(x => dvsOf(p, x)) : !p.reg?.[k]?.done) { setReg(p, k, true); n++; }
    }
    CP.store.changed(); CP.ui.toast(k === 'dvs' ? `DVS: visi dokumenti atzīmēti kā reģistrēti ${n} personām` : `${REGS.find(r => r.k === k)?.l}: atzīmētas ${n} personas`, 'ok');
  };

  /** Kartītes sānu panelis */
  function personCard(p) {
    const list = on(); if (!list.length) return '';
    const fol = followed(p), missTool = D.missingDocs(p);
    const dvs = list.some(r => r.k === 'dvs') ? (() => {
      const docs = dvsDocs(), dm = D.dvsMissing(p), okN = docs.length - docs.filter(k => !dvsOf(p, k)).length;
      return `<div class="reg-group"><div class="reg-title"><b>DVS</b> <span class="pill ${okN === docs.length ? 'ok' : ''}">${okN}/${docs.length} reģistrēti</span></div>
        ${docs.map((kind, i) => {
          const v = dvsOf(p, kind), inTool = !missTool.includes(kind);
          return `<div class="reg-row ${v ? 'ok' : (fol ? 'miss' : '')}"><label class="check grow"><input type="checkbox" data-act="dvsToggle" data-arg="${p.id}|${i}" ${v ? 'checked' : ''}>
            <span><b>${esc(kind)}</b><br><small class="muted">rīkā: ${inTool ? '<span class="okc">✓ pievienots</span>' : '<span class="warn">✗ nav pievienots</span>'}${v ? '' : (fol ? ' · DVS: <span class="warn">nav reģistrēts</span>' : '')}</small></span></label>
            ${v ? `<input type="date" class="sm reg-date" data-dvsdate="${p.id}|${i}" value="${esc(v.date || '')}" title="Reģistrēšanas datums DVS">` : ''}</div>`;
        }).join('')}
        ${fol && dm.length ? `<p class="small warn" style="margin:4px 0 0">⚠ Atzīmē katru dokumentu, kad tas reģistrēts DVS. Datumu var nomainīt.</p>` : ''}</div>`;
    })() : '';
    const ek = list.some(r => r.k === 'eklase') ? (() => {
      const v = p.reg?.eklase, miss = fol && !v?.done;
      return `<div class="reg-group"><label class="reg-row ${v?.done ? 'ok' : (miss ? 'miss' : '')}"><input type="checkbox" data-act="regToggle" data-arg="${p.id}|eklase" ${v?.done ? 'checked' : ''}>
        <span class="grow"><b>e-klase</b> <small class="muted">${v?.done ? 'ievadīts ' + esc(U.fmtDate(v.date)) : (miss ? '— vēl nav ievadīts' : '')}</small></span></label></div>`;
    })() : '';
    return `<section class="card reg-card"><h3>${CP.ic('check', '✓')}Reģistrācija</h3>${dvs}${ek}</section>`;
  }
  CP.registry = { personCard, setReg, REGS, dvsOf };
})(window.CP);
