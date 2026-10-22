/* =====================================================================
   Reģistrācija ārējās sistēmās: DVS (pa dokumentiem), dokumentu nodošana Centra arhīvam (pa dokumentiem), e-klase
   un saziņa (ievietots ziņapmaiņas grupā — WhatsApp, Signal vai citā).
   p.reg = { dvs: { docs: { 'Pieteikuma anketa': { done, date }, 'Līgums': {…}, … } },
             arhivs: { docs: { 'Pieteikuma anketa': { done, date }, … } },
             eklase: { done: true, date },
             sazina: { done: true, date } }
   Arhīvam nododamie dokumenti = settings.archiveDocs (noklusēti anketa un līgums).
   DVS dokumentu saraksts = obligātie dokumenti (Iestatījumi → Dokumenti).
   Katru dokumentu var reģistrēt citā datumā. Kamēr kāds nav atzīmēts — brīdinājums
   pārskatā un sadaļā Uzdevumi. Vecā vienotā DVS atzīme tiek nolasīta kā “visi dokumenti”.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, A = CP.actions, esc = U.esc;
  const REGS = [{ k: 'dvs', l: 'DVS', loc: 'DVS', long: 'Reģistrēts DVS sistēmā' }, { k: 'arhivs', l: 'Centra arhīvs', loc: 'Centra arhīvā', long: 'Oriģināls nodots Jaunsardzes centra arhīvam' }, { k: 'eklase', l: 'e-klase', loc: 'e-klasē', long: 'Ievadīts e-klasē' }, { k: 'sazina', l: 'Ziņapmaiņas grupa', loc: 'ziņapmaiņas grupā', long: 'Ievietots ziņapmaiņas grupā (WhatsApp, Signal vai citā)' }];
  CP.REGS = REGS;
  const on = () => { const s = S.db.settings.registries; return REGS.filter(r => !Array.isArray(s) || s.includes(r.k)); };
  const dvsDocs = () => (S.db.settings.requiredDocs || []).filter(Boolean);
  const followed = p => !!p && p.status !== 'archived' && !['paused', 'archived'].includes(D.partStatus(p));
  /** DVS atzīme konkrētam dokumentam (ar vecās vienotās atzīmes atbalstu) */
  const dvsOf = (p, kind) => { const d = p.reg?.dvs; if (!d) return null; if (d.docs?.[kind]?.done) return d.docs[kind]; if (d.done && !d.docs) return { done: true, date: d.date }; return null; };
  D.dvsMissing = p => followed(p) && on().some(r => r.k === 'dvs') ? dvsDocs().filter(k => !dvsOf(p, k)) : [];
  /* --- Centra arhīvs: oriģināli nodoti (anketa, līgums …) --- */
  const arcDocs = () => (S.db.settings.archiveDocs || ['Pieteikuma anketa', 'Līgums']).filter(Boolean);
  const arcOf = (p, kind) => p.reg?.arhivs?.docs?.[kind]?.done ? p.reg.arhivs.docs[kind] : null;
  /** Nenodotie: tikai tie, kas jau saņemti (pievienoti rīkā vai reģistrēti DVS) — lai nav brīdinājuma par dokumentu, kura vēl nav */
  D.arcMissing = (p, all = false) => followed(p) && on().some(r => r.k === 'arhivs') ? arcDocs().filter(k => !arcOf(p, k) && (all || !D.missingDocs(p).includes(k) || dvsOf(p, k))) : [];
  function setArc(p, kind, done, date) {
    p.reg = { ...(p.reg || {}) };
    const a = { docs: { ...(p.reg.arhivs?.docs || {}) } };
    if (done) a.docs[kind] = { done: true, date: date || a.docs[kind]?.date || U.iso() }; else delete a.docs[kind];
    p.reg.arhivs = a; p.updatedAt = U.now();
  }
  A.arcToggle = arg => {
    const [id, i] = String(arg).split('|'), p = D.person(id), kind = arcDocs()[Number(i)]; if (!p || !kind) return;
    const was = !!arcOf(p, kind);
    if (!was && !received(p, kind) && !confirm(`“${kind}” vēl nav saņemts — kartītē nav skenēta faila.\n\nVai tiešām atzīmēt, ka oriģināls nodots Centra arhīvam?`)) return CP.render();
    setArc(p, kind, !was);
    D.audit(p.id, 'update', [`Centra arhīvs — ${kind}: ${was ? 'atzīme noņemta' : 'nodots'}`]); CP.store.changed();
  };
  CP.changeHandlers.push(e => {
    const t = e.target, v = t.dataset?.arcdate; if (v == null) return false;
    const [id, i] = v.split('|'), p = D.person(id), kind = arcDocs()[Number(i)]; if (!p || !kind || !t.value) return true;
    setArc(p, kind, true, t.value); D.audit(p.id, 'update', [`Centra arhīvs — ${kind}: datums ${U.fmtDate(t.value)}`]);
    setTimeout(() => CP.store.changed(), 0); return true;
  });
  /** Saderībai: sistēmas, kur kaut kas nav atzīmēts */
  D.regMissing = p => {
    if (!followed(p)) return [];
    return on().filter(r => r.k === 'dvs' ? D.dvsMissing(p).length : r.k === 'arhivs' ? D.arcMissing(p).length : !p.reg?.[r.k]?.done);
  };
  D.regAlerts = roster => {
    const out = [];
    for (const p of roster) {
      if (!followed(p)) continue;
      const dm = D.dvsMissing(p), ek = on().some(r => r.k === 'eklase') && !p.reg?.eklase?.done, sz = on().some(r => r.k === 'sazina') && !p.reg?.sazina?.done;
      if (dm.length) {
        const inTool = dm.filter(k => !D.missingDocs(p).includes(k));
        out.push({ kind: 'registry', personId: p.id, sev: 1, when: '',
          msg: `${U.full(p)}: DVS nav reģistrēts — ${dm.join(', ')}${inTool.length ? ` (rīkā jau pievienots: ${inTool.join(', ')})` : ''}` });
      }
      const am = D.arcMissing(p);
      if (am.length) out.push({ kind: 'registry', personId: p.id, sev: 1, when: '', msg: `${U.full(p)}: Centra arhīvam nav nodots — ${am.join(', ')}` });
      if (ek) out.push({ kind: 'registry', personId: p.id, sev: 1, when: '', msg: `${U.full(p)}: nav atzīmēts, ka ievadīts e-klasē` });
      if (sz) out.push({ kind: 'registry', personId: p.id, sev: 1, when: '', msg: `${U.full(p)}: nav ievietots ziņapmaiņas grupā (WhatsApp, Signal vai cita)` });
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
    if (k === 'arhivs') { for (const kind of arcDocs()) setArc(p, kind, done); D.audit(p.id, 'update', [`Centra arhīvs: ${done ? 'nodoti visi dokumenti' : 'atzīmes noņemtas'}`]); return; }
    if (k === 'sazina') {
      p.reg = { ...(p.reg || {}) };
      if (done) p.reg.sazina = { done: true, date: p.reg.sazina?.date || U.iso() }; else delete p.reg.sazina;
      p.updatedAt = U.now();
      D.audit(p.id, 'update', [`Ziņapmaiņas grupa: ${done ? 'ievietots' : 'atzīme noņemta'}`]);
      return;
    }
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
    const was = !!dvsOf(p, kind);
    if (!was && !received(p, kind) && !confirm(`“${kind}” vēl nav saņemts — kartītē nav skenēta faila.\n\nDVS reģistrē skenēto dokumentu. Vai tiešām atzīmēt kā reģistrētu DVS?`)) return CP.render();
    setDvs(p, kind, !was);
    D.audit(p.id, 'update', [`DVS — ${kind}: ${was ? 'atzīme noņemta' : 'reģistrēts'}`]); CP.store.changed();
  };
  /** Reģistrācijas datuma maiņa (dokuments var būt reģistrēts citā dienā) */
  CP.changeHandlers.push(e => {
    const t = e.target, v = t.dataset?.dvsdate; if (v == null) return false;
    const [id, i] = v.split('|'), p = D.person(id), kind = dvsDocs()[Number(i)]; if (!p || !kind || !t.value) return true;
    setDvs(p, kind, true, t.value); D.audit(p.id, 'update', [`DVS — ${kind}: datums ${U.fmtDate(t.value)}`]);
    setTimeout(() => CP.store.changed(), 0); return true;
  });
  CP.changeHandlers.push(e => {
    const t = e.target, v = t.dataset?.sazdate; if (v == null) return false;
    const p = D.person(v); if (!p || !t.value) return true;
    p.reg = { ...(p.reg || {}), sazina: { done: true, date: t.value } }; p.updatedAt = U.now();
    D.audit(p.id, 'update', [`Ziņapmaiņas grupa: datums ${U.fmtDate(t.value)}`]);
    setTimeout(() => CP.store.changed(), 0); return true;
  });
  A.bulkReg = k => {
    let n = 0;
    for (const id of S.list.sel) {
      const p = D.person(id); if (!p) continue;
      if (k === 'dvs' ? D.dvsMissing(p).length || !dvsDocs().every(x => dvsOf(p, x)) : k === 'arhivs' ? !arcDocs().every(x => arcOf(p, x)) : !p.reg?.[k]?.done) { setReg(p, k, true); n++; }
    }
    CP.store.changed(); CP.ui.toast(k === 'dvs' ? `DVS: visi dokumenti atzīmēti kā reģistrēti ${n} personām` : k === 'arhivs' ? `Centra arhīvs: visi dokumenti atzīmēti kā nodoti ${n} personām` : `${REGS.find(r => r.k === k)?.l}: atzīmētas ${n} personas`, 'ok');
  };

  /** Dokuments saņemts = kartītē ir skenēts fails (obligātajiem) vai vismaz ieraksts ar failu */
  function received(p, kind) {
    if ((S.db.settings.requiredDocs || []).includes(kind)) return !D.missingDocs(p).includes(kind);
    return D.docsOf(p).some(d => d.kind === kind && d.path);
  }
  const addBtn = (p, kind) => `<button type="button" class="sm reg-add" data-act="attach" data-arg="${p.id}|${esc(kind)}" title="Pievienot skenētu dokumentu">＋ Fails</button>`;
  /** Kartītes sānu panelis */
  function personCard(p) {
    const list = on(); if (!list.length) return '';
    const fol = followed(p), missTool = D.missingDocs(p);
    const dvs = list.some(r => r.k === 'dvs') ? (() => {
      const docs = dvsDocs(), dm = D.dvsMissing(p), okN = docs.length - docs.filter(k => !dvsOf(p, k)).length;
      return `<div class="reg-group"><div class="reg-title"><b>DVS</b> <span class="pill ${okN === docs.length ? 'ok' : ''}">${okN}/${docs.length} reģistrēti</span></div>
        ${docs.map((kind, i) => {
          const v = dvsOf(p, kind), inTool = received(p, kind);
          return `<div class="reg-row ${v ? 'ok' : !inTool ? 'nogot' : (fol ? 'miss' : '')}"><label class="check grow"><input type="checkbox" data-act="dvsToggle" data-arg="${p.id}|${i}" ${v ? 'checked' : ''}>
            <span><b>${esc(kind)}</b><br><small class="muted">${inTool ? 'rīkā: <span class="okc">✓ pievienots</span>' : '<span class="red">✗ nav saņemts — vispirms pievieno skenētu failu</span>'}${v ? (inTool ? '' : ' · <span class="red">atzīmēts DVS bez faila rīkā</span>') : (fol && inTool ? ' · DVS: <span class="warn">nav reģistrēts</span>' : '')}</small></span></label>
            ${v ? `<input type="date" class="sm reg-date" data-dvsdate="${p.id}|${i}" value="${esc(v.date || '')}" title="Reģistrēšanas datums DVS">` : ''}${inTool ? '' : addBtn(p, kind)}</div>`;
        }).join('')}
        ${fol && dm.length ? `<p class="small warn" style="margin:4px 0 0">⚠ Atzīmē katru dokumentu, kad tas reģistrēts DVS. Datumu var nomainīt.</p>` : ''}</div>`;
    })() : '';
    const arc = list.some(r => r.k === 'arhivs') ? (() => {
      const docs = arcDocs(), okN = docs.filter(k => arcOf(p, k)).length;
      return `<div class="reg-group"><div class="reg-title"><b>Centra arhīvs</b> <span class="pill ${okN === docs.length ? 'ok' : ''}">${okN}/${docs.length} nodoti</span></div>
        ${docs.map((kind, i) => {
          const v = arcOf(p, kind), got = received(p, kind), miss = fol && !v && got;
          return `<div class="reg-row ${v ? 'ok' : !got ? 'nogot' : (miss ? 'miss' : '')}"><label class="check grow"><input type="checkbox" data-act="arcToggle" data-arg="${p.id}|${i}" ${v ? 'checked' : ''}>
            <span><b>${esc(kind)}</b><br><small class="muted">${v ? 'oriģināls nodots arhīvam' + (got ? '' : ' · <span class="red">kartītē nav skenēta faila</span>') : got ? (fol ? '<span class="warn">saņemts, vēl nav nodots arhīvam</span>' : 'nav nodots') : '<span class="red">✗ vēl nav saņemts</span>'}</small></span></label>
            ${v ? `<input type="date" class="sm reg-date" data-arcdate="${p.id}|${i}" value="${esc(v.date || '')}" title="Nodošanas datums Centra arhīvam">` : ''}${got ? '' : addBtn(p, kind)}</div>`;
        }).join('')}</div>`;
    })() : '';
    const ek = list.some(r => r.k === 'eklase') ? (() => {
      const v = p.reg?.eklase, miss = fol && !v?.done;
      return `<div class="reg-group"><label class="reg-row ${v?.done ? 'ok' : (miss ? 'miss' : '')}"><input type="checkbox" data-act="regToggle" data-arg="${p.id}|eklase" ${v?.done ? 'checked' : ''}>
        <span class="grow"><b>e-klase</b> <small class="muted">${v?.done ? 'ievadīts ' + esc(U.fmtDate(v.date)) : (miss ? '— vēl nav ievadīts' : '')}</small></span></label></div>`;
    })() : '';
    const saz = list.some(r => r.k === 'sazina') ? (() => {
      const v = p.reg?.sazina, miss = fol && !v?.done;
      return `<div class="reg-group"><div class="reg-title"><b>Saziņa</b></div>
        <div class="reg-row ${v?.done ? 'ok' : (miss ? 'nogot' : '')}"><label class="check grow"><input type="checkbox" data-act="regToggle" data-arg="${p.id}|sazina" ${v?.done ? 'checked' : ''}>
          <span><b>Ievietots ziņapmaiņas grupā</b><br><small class="muted">${v?.done ? 'WhatsApp, Signal vai cita grupa' : (miss ? '<span class="red">✗ nav ievietots — WhatsApp, Signal vai cita grupa</span>' : 'WhatsApp, Signal vai cita grupa')}</small></span></label>
          ${v?.done ? `<input type="date" class="sm reg-date" data-sazdate="${p.id}" value="${esc(v.date || '')}" title="Datums, kad ievietots grupā">` : ''}</div>
        ${miss ? `<p class="small warn" style="margin:4px 0 0">⚠ Atzīmē, kad persona ir ievietota ziņapmaiņas grupā.</p>` : ''}</div>`;
    })() : '';
    return `<section class="card reg-card"><h3>${CP.ic('check', '✓')}Reģistrācija un arhīvs</h3>${dvs}${arc}${ek}${saz}</section>`;
  }
  CP.registry = { personCard, setReg, REGS, dvsOf, arcOf, arcDocs };
})(window.CP);
