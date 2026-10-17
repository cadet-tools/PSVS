/* =====================================================================
   Jaunsarga nodošana citam instruktoram un pārņemšana no cita instruktora.
   • Nodot: personas lieta + dokumentu faili vienā ZIP:
       CADET_persona.json   — dati rīkam (pārņemšanai)
       Personas_lieta.html  — pārskats lasīšanai/drukāšanai bez rīka
       dokumenti/…          — skenētie dokumenti
     Pēc tam (pēc izvēles) persona tiek arhivēta ar iemeslu.
   • Pārņemt: izvēlas saņemto ZIP → priekšskatījums → jauna persona vai
     papildina esošo; dokumenti iekopēti personas mapē “Parnemtie”.
   • Bez paketes: kartītē lauks “Pārnācis no cita instruktora”.
   Fails tiek tikai lejupielādēts — sūtīt to instruktors izvēlas pats.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const FORMAT = 'cadet-person-transfer';
  const st = () => S.db.settings;
  const safe = s => String(s || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  const dlg = (id, html) => { let d = U.$(id); if (!d) { d = document.createElement('dialog'); d.id = id; d.className = 'wide'; document.body.appendChild(d); } d.innerHTML = html; return d; };
  const zipLib = async () => { await CP.reader.loadScript(CP.VENDOR + 'docx/jszip.min.js'); return window.JSZip; };
  const PERSON_KEYS = () => CP.FIELDS.map(f => f.k).filter(k => k !== 'notes' && k !== 'retentionMonths' && k !== 'group');

  /* ================= Nodot ================= */
  A.transferOut = pid => {
    const p = D.person(pid); if (!p) return;
    const docs = D.docsOf(p).filter(d => d.path), eq = D.openEquipment(p);
    const d = dlg('trOutDialog', `<form><header class="dlg-head"><h2>Nodot citam instruktoram — ${esc(U.full(p))}</h2><button type="button" class="ghost" data-close="trOutDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body">
        <p class="small" style="margin-top:0">Rīks sagatavo <b>personas lietas paku</b> (ZIP): pārskatu lasīšanai un drukāšanai, dokumentu failus un datus, ko jaunais instruktors ar <b>“⇩ Pārņemt no cita instruktora”</b> ieliek savā rīkā. Paku var atvērt arī bez rīka.</p>
        <div class="fieldgrid">
          <div class="field"><label>Kam nodod (instruktors)</label><input name="toName" data-cap="words" placeholder="Vārds Uzvārds"></div>
          <div class="field"><label>Vienība / vieta</label><input name="toUnit" data-cap="first" placeholder="piem., Siguldas vienība"></div>
        </div>
        <label class="check"><input type="checkbox" name="docs" checked> Dokumentu faili (${docs.length})</label>
        <label class="check"><input type="checkbox" name="hist" checked> Dalība, apmeklējums un kvalifikācijas</label>
        <label class="check"><input type="checkbox" name="eq" checked> Ekipējuma saraksts${eq.length ? ` <span class="warn">(${eq.length} neatdoti)</span>` : ''}</label>
        <label class="check"><input type="checkbox" name="notes"> Piezīmes</label>
        <label class="check"><input type="checkbox" name="inc"> Uzvedība un pārkāpumi</label>
        <hr>
        <label class="check"><input type="checkbox" name="archive" ${p.status === 'archived' ? '' : 'checked'} ${p.status === 'archived' ? 'disabled' : ''}> Pēc sagatavošanas pārvietot uz arhīvu (iemesls: “Pārgāja pie cita instruktora”)</label>
        ${eq.length ? `<p class="small warn">⚠ Nav atdots ekipējums: ${esc(eq.map(e => e.item).join(', '))}. Vienojies ar jauno instruktoru, vai tas jāatdod.</p>` : ''}
        <p class="small muted">Pakā ir personas dati (arī personas kods). Sūti to tikai jaunajam instruktoram drošā veidā (darba e-pasts, DVS) un pēc tam izdzēs no Lejupielādēm.</p>
      </div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="trOutDialog">Atcelt</button><button class="mainbtn" type="submit">⇪ Sagatavot paku</button></footer></form>`);
    d.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const f = e.target, btn = f.querySelector('[type=submit]');
      const o = { toName: f.toName.value.trim(), toUnit: f.toUnit.value.trim(), docs: f.docs.checked, hist: f.hist.checked, eq: f.eq.checked, notes: f.notes.checked, inc: f.inc.checked, archive: f.archive.checked && !f.archive.disabled };
      btn.disabled = true; btn.textContent = 'Sagatavo…';
      try { await buildOut(p, o); d.close(); }
      catch (err) { console.error(err); ui.toast('Paku neizdevās sagatavot: ' + err.message, 'err', 10000); btn.disabled = false; btn.textContent = '⇪ Sagatavot paku'; }
    };
    d.showModal();
  };

  async function buildOut(p, o) {
    const JSZip = await zipLib(), zip = new JSZip(), inst = st().instructor || {};
    const person = Object.fromEntries(PERSON_KEYS().map(k => [k, p[k] ?? '']).filter(([, v]) => v !== ''));
    const out = {
      format: FORMAT, v: 1, created: U.now(), tool: 'CADET PERSONĀLS ' + CP.VERSION,
      from: { name: inst.name || '', position: inst.position || '', unit: [inst.parvalde && `${inst.parvalde}. pārvalde`, inst.nodala && `${inst.nodala}. nodaļa`, inst.place].filter(Boolean).join(', '), email: inst.email || '', phone: inst.phone || '' },
      to: { name: o.toName, unit: o.toUnit },
      person, group: D.groupOf(p) || '', years: D.enrollmentsOf(p.id).map(e => ({ year: e.yearId, group: e.group || '', status: e.status || '' })),
      documents: [], quals: [], participation: [], attendance: null, equipment: [], notes: [], incidents: []
    };
    // dokumenti
    const used = new Set(), missing = [];
    for (const d of D.docsOf(p)) {
      const rec = { kind: d.kind, title: d.title || '', format: d.format || '', received: d.received || '', issued: d.issued || '', expires: d.expires || '', notes: d.notes || '', file: '' };
      if (o.docs && d.path) {
        try {
          const h = await CP.store.handleFor(d.path, d.sourceId); const file = h && await h.getFile();
          if (file) {
            let name = safe(`${CP.docs.label(d)} - ${file.name}`).slice(0, 120), i = 2; const dot = name.lastIndexOf('.');
            while (used.has(name)) name = dot > 0 ? `${name.slice(0, dot)} (${i++})${name.slice(dot)}` : `${name} (${i++})`;
            used.add(name); zip.file('dokumenti/' + name, file); rec.file = 'dokumenti/' + name;
          } else missing.push(CP.docs.label(d));
        } catch (e) { missing.push(CP.docs.label(d)); }
      }
      out.documents.push(rec);
    }
    if (o.hist) {
      const Q = st().quals || [];
      out.quals = (p.quals || []).map(x => ({ name: Q.find(q => q.id === x.qid)?.name || '', date: x.date || '', note: x.note || '' })).filter(x => x.name);
      out.participation = [
        ...(S.db.events || []).filter(e => (e.participants || []).some(x => x.pid === p.id)).map(e => ({ date: e.dateFrom || e.instrDate || '', type: e.type === 'camp' ? 'Nometne' : 'Pasākums', title: e.title || '' })),
        ...(S.db.sessions || []).filter(s => s.type && s.type !== 'Nodarbība' && ['+', 'k'].includes(s.att?.[p.id])).map(s => ({ date: s.date, type: s.type, title: s.topic || '' }))
      ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const r = D.attRate ? D.attRate(p) : null; if (r) out.attendance = { present: r.present, absent: r.absent, excused: r.excused, pct: r.pct };
    }
    if (o.eq) out.equipment = S.db.equipment.filter(e => e.personId === p.id && !e.returned).map(e => ({ item: e.item, qty: e.qty || 1, size: e.size || '', inventory: e.inventory || '', issued: e.issued || '', gift: !!e.keep, notes: e.notes || '' }));
    if (o.notes) out.notes = (p.noteLog || []).map(n => ({ at: n.at, text: n.text }));
    if (o.inc) out.incidents = (p.incidents || []).map(x => ({ date: x.date, type: x.type || '', severity: x.severity || '', text: x.text || '', action: x.action || '' }));
    zip.file('CADET_persona.json', JSON.stringify(out, null, 2));
    zip.file('Personas_lieta.html', summaryHtml(out));
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const name = `Personas_lieta_${safe(p.last)}_${safe(p.first)}_${U.iso()}.zip`.replace(/ /g, '_');
    U.download(blob, name);
    p.transferredTo = { name: o.toName, unit: o.toUnit, at: U.now() };
    D.audit(p.id, 'update', [`Sagatavota nodošanas paka${o.toName ? ' — ' + o.toName : ''}`]);
    if (o.archive) CP.people.archivePerson(p, { left: U.iso(), reason: `Pārgāja pie cita instruktora${o.toName || o.toUnit ? ': ' + [o.toName, o.toUnit].filter(Boolean).join(', ') : ''}` });
    CP.store.changed(); CP.render();
    ui.toast(`Paka “${name}” lejupielādēta${missing.length ? `. Neizdevās pievienot: ${missing.join(', ')}` : ''}${o.archive ? '. Persona pārvietota uz arhīvu' : ''}.`, missing.length ? 'warn' : 'ok', 12000);
  }

  function summaryHtml(o) {
    const P = o.person, F = Object.fromEntries(CP.FIELDS.map(f => [f.k, f])), e = s => esc(String(s ?? '')), dt = s => e(s ? U.fmtDate(String(s).slice(0, 10)) : '');
    const opt = (k, v) => (F[k]?.opts || []).find(x => x[0] === v)?.[1] || v;
    const SEC = [['basic', 'Pamatdati'], ['study', 'Mācības un dalība'], ['contact', 'Kontakti'], ['address', 'Adrese'], ['parent', 'Likumiskais pārstāvis'], ['parent2', 'Otrs vecāks'], ['emergency', 'Ārkārtas kontakts'], ['admin', 'Citi']];
    const rows = sid => CP.FIELDS.filter(f => f.s === sid && P[f.k]).map(f => `<tr><th>${e(f.l)}</th><td>${f.t === 'date' ? dt(P[f.k]) : e(opt(f.k, P[f.k]))}</td></tr>`).join('');
    const tbl = (head, list, fn) => list.length ? `<table><thead><tr>${head.map(h => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${list.map(fn).join('')}</tbody></table>` : '<p class="m">—</p>';
    return `<!doctype html><html lang="lv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Personas lieta — ${e(P.first)} ${e(P.last)}</title>
<style>body{font:14px/1.45 system-ui,Segoe UI,Arial,sans-serif;color:#111;background:#fff;max-width:900px;margin:24px auto;padding:0 16px}h1{margin:0 0 4px}h2{margin:22px 0 6px;font-size:16px;border-bottom:1px solid #ccc;padding-bottom:3px}table{border-collapse:collapse;width:100%;margin:4px 0}th,td{text-align:left;padding:4px 6px;border-bottom:1px solid #eee;vertical-align:top}th{width:34%;color:#444;font-weight:600}thead th{width:auto;background:#f4f4f4}.m{color:#666}.box{background:#f7f7f2;border:1px solid #ddd;border-radius:8px;padding:8px 12px}a{color:#0645ad}@media print{a{color:#000;text-decoration:none}}</style></head><body>
<h1>${e(P.first)} ${e(P.last)}</h1><p class="m">Personas lieta nodošanai citam instruktoram · sagatavota ${dt(o.created)} · ${e(o.tool)}</p>
<div class="box"><b>Nodod:</b> ${e([o.from.name, o.from.position, o.from.unit].filter(Boolean).join(', ') || '—')}${o.from.email ? ` · ${e(o.from.email)}` : ''}${o.from.phone ? ` · ${e(o.from.phone)}` : ''}<br><b>Saņem:</b> ${e([o.to.name, o.to.unit].filter(Boolean).join(', ') || '—')}<br><span class="m">Lai ieliktu CADET PERSONĀLS rīkā: Personas → “⇩ Pārņemt no cita instruktora” → izvēlies šo ZIP failu.</span></div>
${SEC.map(([k, l]) => rows(k) ? `<h2>${e(l)}</h2><table>${rows(k)}</table>` : '').join('')}
<h2>Mācību gadi</h2>${tbl(['Gads', 'Grupa', 'Statuss'], o.years, y => `<tr><td>${e(y.year)}</td><td>${e(y.group)}</td><td>${e(y.status)}</td></tr>`)}
<h2>Dokumenti</h2>${tbl(['Dokuments', 'Saņemts', 'Derīgs līdz', 'Fails'], o.documents, d => `<tr><td>${e(d.title || d.kind)}${d.notes ? `<div class="m">${e(d.notes)}</div>` : ''}</td><td>${dt(d.received)}</td><td>${dt(d.expires)}</td><td>${d.file ? `<a href="${e(encodeURI(d.file))}">atvērt</a>` : '<span class="m">nav pievienots</span>'}</td></tr>`)}
${o.quals.length || o.participation.length || o.attendance ? `<h2>Kvalifikācijas</h2>${tbl(['Kvalifikācija', 'Datums', 'Piezīme'], o.quals, q => `<tr><td>${e(q.name)}</td><td>${dt(q.date)}</td><td>${e(q.note)}</td></tr>`)}
<h2>Dalība pasākumos</h2>${tbl(['Datums', 'Veids', 'Nosaukums'], o.participation, x => `<tr><td>${dt(x.date)}</td><td>${e(x.type)}</td><td>${e(x.title)}</td></tr>`)}
${o.attendance ? `<p>Nodarbību apmeklējums šajā mācību gadā: <b>${o.attendance.pct ?? '—'}${o.attendance.pct != null ? '%' : ''}</b> (bija ${o.attendance.present}, nebija ${o.attendance.absent}, attaisnoti ${o.attendance.excused}).</p>` : ''}` : ''}
${o.equipment.length ? `<h2>Neatdotais ekipējums</h2>${tbl(['Priekšmets', 'Daudz.', 'Izmērs', 'Inv. nr.', 'Izsniegts'], o.equipment, x => `<tr><td>${e(x.item)}${x.gift ? ' <span class="m">(dāvinājums)</span>' : ''}</td><td>${e(x.qty)}</td><td>${e(x.size)}</td><td>${e(x.inventory)}</td><td>${dt(x.issued)}</td></tr>`)}` : ''}
${o.notes.length ? `<h2>Piezīmes</h2>${o.notes.map(n => `<p><span class="m">${dt(n.at)}</span> ${e(n.text)}</p>`).join('')}` : ''}
${o.incidents.length ? `<h2>Uzvedība un pārkāpumi</h2>${tbl(['Datums', 'Veids', 'Apraksts', 'Rīcība'], o.incidents, x => `<tr><td>${dt(x.date)}</td><td>${e(x.type)}</td><td>${e(x.text)}</td><td>${e(x.action)}</td></tr>`)}` : ''}
</body></html>`;
  }

  /* ================= Pārņemt ================= */
  let pkg = null;
  const pick = () => { let i = U.$('trInFile'); if (!i) { i = document.createElement('input'); i.type = 'file'; i.id = 'trInFile'; i.accept = '.zip,.json'; i.hidden = true; document.body.appendChild(i); i.addEventListener('change', onPick); } return i; };
  A.transferIn = () => { if (!S.root) return CP.needRoot?.() || ui.toast('Vispirms izvēlies datu mapi', 'warn'); const i = pick(); i.value = ''; i.click(); };
  async function onPick(e) {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      let json, files = new Map();
      if (/\.json$/i.test(f.name)) json = JSON.parse(await f.text());
      else {
        const z = await U.unzip(await f.arrayBuffer());
        const jn = [...z.keys()].find(n => /(^|\/)CADET_persona\.json$/i.test(n)); if (!jn) throw Error('ZIP failā nav CADET_persona.json — tā nav CADET personas lietas paka');
        json = JSON.parse(new TextDecoder().decode(await z.get(jn)()));
        const base = jn.replace(/CADET_persona\.json$/i, '');
        for (const n of z.keys()) if (n.startsWith(base + 'dokumenti/') && !n.endsWith('/')) files.set(n.slice(base.length), z.get(n));
      }
      if (json?.format !== FORMAT || !json.person) throw Error('fails nav CADET personas lietas paka');
      pkg = { json, files, name: f.name }; preview();
    } catch (err) { ui.toast('Paku neizdevās nolasīt: ' + err.message, 'err', 10000); }
  }
  const findDup = P => S.db.people.find(x => !x.anon && ((P.personalCode && x.personalCode && U.norm(x.personalCode).replace(/\D/g, '') === U.norm(P.personalCode).replace(/\D/g, '')) || (U.norm(x.first) === U.norm(P.first) && U.norm(x.last) === U.norm(P.last) && (!P.birth || !x.birth || x.birth === P.birth))));
  function preview() {
    const o = pkg.json, P = o.person, dup = findDup(P), from = [o.from?.name, o.from?.unit].filter(Boolean).join(', ');
    const d = dlg('trInDialog', `<form><header class="dlg-head"><h2>Pārņemt no cita instruktora</h2><button type="button" class="ghost" data-close="trInDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body">
        <p style="margin-top:0"><b>${esc(P.first)} ${esc(P.last)}</b>${P.birth ? ` · dz. ${esc(U.fmtDate(P.birth))}` : ''}${o.group ? ` · iepriekš grupā ${esc(o.group)}` : ''}</p>
        <p class="small">No: <b>${esc(from || 'nav norādīts')}</b>${o.from?.email ? ` · ${esc(o.from.email)}` : ''} · sagatavots ${esc(U.fmtDate(String(o.created).slice(0, 10)))}</p>
        <p class="small">Pakā: ${o.documents.length} dokumenti (${pkg.files.size} faili), ${o.quals.length} kvalifikācijas, ${o.participation.length} pasākumi${o.equipment.length ? `, ${o.equipment.length} ekipējuma vienības (tikai informācijai)` : ''}.</p>
        ${dup ? `<div class="notice">Rīkā jau ir <b>${esc(U.full(dup))}</b>${dup.birth ? ` (dz. ${esc(U.fmtDate(dup.birth))})` : ''}${dup.status === 'archived' ? ' — arhīvā' : ''}.</div>
          <label class="check"><input type="radio" name="mode" value="merge" checked> Papildināt esošo — pievienot dokumentus un kvalifikācijas, aizpildīt tukšos laukus${dup.status === 'archived' ? ', atjaunot no arhīva' : ''}</label>
          <label class="check"><input type="radio" name="mode" value="new"> Izveidot jaunu personu</label>` : '<input type="hidden" name="mode" value="new">'}
        <div class="fieldgrid" style="margin-top:8px">
          <div class="field"><label>Grupa (${esc(U.yearLabel(D.activeYear()))})</label><input name="group" list="dl_groups" value="${esc(dup ? D.groupOf(dup) : '')}" placeholder="var atstāt tukšu"></div>
          <div class="field"><label>Statuss</label><select name="status"><option value="active">Jaunsargs</option><option value="candidate">Kandidāts</option></select></div>
        </div>
        <p class="small muted">Dokumentu faili tiek iekopēti personas mapē (apakšmapē “Parnemtie”). Ekipējums netiek pievienots — tas pieder iepriekšējai vienībai; saraksts saglabājas piezīmē.</p>
      </div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="trInDialog">Atcelt</button><button class="mainbtn" type="submit">⇩ Pārņemt</button></footer></form>`);
    d.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const f = e.target, btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Pārņem…';
      try { const p = await doImport(f.mode.value === 'merge' ? dup : null, f.group.value.trim(), f.status.value); d.close(); if (p) ui.go('person', { person: p.id, tab: 'docs' }); }
      catch (err) { console.error(err); ui.toast('Neizdevās pārņemt: ' + err.message, 'err', 10000); btn.disabled = false; btn.textContent = '⇩ Pārņemt'; }
    };
    d.showModal();
  }
  async function doImport(existing, group, status) {
    const o = pkg.json, P = o.person, keys = PERSON_KEYS(), from = [o.from?.name, o.from?.unit].filter(Boolean).join(', ');
    let p = existing;
    if (p) {
      for (const k of keys) if ((p[k] == null || p[k] === '') && P[k] != null && P[k] !== '' && k !== 'status') p[k] = P[k];
      if (p.status === 'archived') { p.status = status; D.audit(p.id, 'restore'); }
      p.updatedAt = U.now();
    } else {
      p = { id: U.uid(), status, createdAt: U.now(), updatedAt: U.now() };
      for (const k of keys) if (P[k] != null && P[k] !== '' && k !== 'status') p[k] = P[k];
      CP.store.assignFolder(p); S.db.people.push(p);
      D.audit(p.id, 'create', ['Pārņemts no cita instruktora']);
    }
    p.fromInstructor = from || p.fromInstructor || 'cits instruktors';
    p.transferFrom = { ...(o.from || {}), at: U.now(), file: pkg.name };
    D.bindYear(p, { group, status: p.status, note: `Pārnācis no: ${from || 'cita instruktora'}` });
    // kvalifikācijas
    const Q = st().quals = st().quals || [];
    for (const q of o.quals || []) {
      let def = Q.find(x => U.norm(x.name) === U.norm(q.name)); if (!def) { def = { id: U.uid(), name: q.name, note: '' }; Q.push(def); }
      if (!(p.quals || []).some(x => x.qid === def.id)) (p.quals = p.quals || []).push({ qid: def.id, date: q.date, note: q.note, src: 'pārņemts' });
    }
    // dokumenti
    let n = 0, fail = 0;
    if (pkg.files.size) {
      await CP.store.ensurePersonYearFolder(p);
      const dir = [...CP.store.yearPersonDir(p), 'Parnemtie'];
      for (const d of o.documents || []) {
        if (!d.file || !pkg.files.has(d.file)) continue;
        try {
          const bytes = await pkg.files.get(d.file)(), name = d.file.split('/').pop();
          const path = await CP.store.saveFile(dir, name, new Blob([bytes]));
          if (path && CP.docs.link(p.id, d.kind || 'Cits', d.format || (/\.edoc$/i.test(name) ? 'edoc' : 'pdf'), path, 'main', { received: d.received || U.iso(), issued: d.issued || '', expires: d.expires || '', notes: [d.notes, `pārņemts no ${from || 'cita instruktora'}`].filter(Boolean).join(' · '), title: d.title || (d.kind === 'Cits' ? name.replace(/\.[^.]+$/, '') : ''), review: 'received', size: bytes.length })) n++;
        } catch (err) { fail++; }
      }
    }
    // vēsture piezīmē (pasākumi, apmeklējums, ekipējums, piezīmes, pārkāpumi)
    const lines = [`Pārņemts no ${from || 'cita instruktora'} (${U.fmtDate(U.iso())}).`];
    if (o.years?.length) lines.push('Iepriekšējie gadi: ' + o.years.map(y => `${y.year}${y.group ? ' ' + y.group : ''}`).join('; '));
    if (o.attendance?.pct != null) lines.push(`Apmeklējums iepriekšējā vienībā: ${o.attendance.pct}%`);
    if (o.participation?.length) lines.push('Pasākumi: ' + o.participation.map(x => `${U.fmtDate(x.date)} ${x.type}${x.title ? ' ' + x.title : ''}`).join('; '));
    if (o.equipment?.length) lines.push('Ekipējums no iepriekšējās vienības: ' + o.equipment.map(x => `${x.item}${x.qty > 1 ? ' ×' + x.qty : ''}${x.inventory ? ' (' + x.inventory + ')' : ''}`).join(', '));
    for (const x of o.notes || []) lines.push(`Piezīme (${U.fmtDate(String(x.at).slice(0, 10))}): ${x.text}`);
    (p.noteLog = p.noteLog || []).push({ id: U.uid(), at: U.now(), text: lines.join('\n') });
    for (const x of o.incidents || []) (p.incidents = p.incidents || []).push({ id: U.uid(), date: x.date, type: x.type, severity: x.severity || 'note', text: x.text + ' (no iepriekšējās vienības)', action: x.action, at: U.now() });
    CP.store.changed();
    ui.toast(`${U.full(p)} pārņemts${n ? `, pievienoti ${n} dokumenti` : ''}${fail ? `, ${fail} neizdevās` : ''}.`, fail ? 'warn' : 'ok', 9000);
    pkg = null;
    return p;
  }
  CP.transfer = { FORMAT };
})(window.CP);
