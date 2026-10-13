/* =====================================================================
   Imports (CSV / XLSX, arī e-klases eksports) un eksports (CSV, JSON)
   XLSX tiek nolasīts bez ārējām bibliotēkām.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const io = {};

  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/)[0], delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : (first.includes('\t') ? '\t' : ',');
    const out = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') { if (q && text[i + 1] === '"') { cell += '"'; i++; } else q = !q; }
      else if (c === delim && !q) { row.push(cell); cell = ''; }
      else if ((c === '\n' || c === '\r') && !q) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(v => v !== '')) out.push(row); row = []; cell = ''; }
      else cell += c;
    }
    row.push(cell); if (row.some(v => v !== '')) out.push(row); return out;
  }
  async function unzip(file) {
    const z = await U.unzip(await file.arrayBuffer(), n => n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n)), out = new Map(), dec = new TextDecoder();
    for (const [k, fn] of z) out.set(k, async () => dec.decode(await fn()));
    return out;
  }
  const xml = raw => { const x = new DOMParser().parseFromString(raw, 'application/xml'); if (x.querySelector('parsererror')) throw Error('nevar nolasīt Excel XML'); return x; };
  const tags = (n, t) => [...n.getElementsByTagNameNS('*', t)];
  async function parseXlsx(file) {
    const z = await unzip(file); let strings = [];
    if (z.has('xl/sharedStrings.xml')) strings = tags(xml(await z.get('xl/sharedStrings.xml')()), 'si').map(si => tags(si, 't').map(t => t.textContent).join(''));
    const sheet = [...z.keys()].filter(x => /sheet\d+\.xml$/.test(x)).sort((a, b) => Number(a.match(/(\d+)\.xml/)[1]) - Number(b.match(/(\d+)\.xml/)[1]))[0];
    if (!sheet) throw Error('XLSX nesatur darblapas');
    const out = [];
    for (const row of tags(xml(await z.get(sheet)()), 'row')) {
      const arr = [];
      for (const c of tags(row, 'c')) {
        const letters = (c.getAttribute('r') || 'A').match(/^[A-Z]+/i)?.[0] || 'A'; let idx = 0;
        for (const ch of letters.toUpperCase()) idx = idx * 26 + ch.charCodeAt(0) - 64; idx--; if (idx < 0 || idx > 500) continue;
        let v = tags(c, 'v')[0]?.textContent || ''; const t = c.getAttribute('t');
        if (t === 's') v = strings[Number(v)] || ''; if (t === 'inlineStr') v = tags(c, 't').map(e => e.textContent).join('');
        arr[idx] = v;
      }
      out.push(Array.from(arr, v => v ?? '')); if (out.length > 5000) throw Error('maksimums 5000 rindas');
    }
    return out;
  }

  const hdr = s => U.norm(s).replace(/[^a-z0-9]/g, '');
  const ALIASES = {
    first: ['vards', 'firstname', 'first', 'skolenavards'], last: ['uzvards', 'lastname', 'last', 'skolenauzvards'],
    name: ['vardsuzvards', 'uzvardsvards', 'pilnsvards', 'fullname', 'name', 'skolens', 'audzeknis', 'izglitojamais'],
    birth: ['dzimsanasdatums', 'dzimsanasdiena', 'dzimdat', 'birth', 'dob'], personalCode: ['personaskods', 'pk'],
    group: ['grupa', 'group', 'vieniba', 'nodala'], schoolClass: ['klase', 'kurss', 'class'], school: ['skola', 'macibuiestade', 'izglitibasiestade'],
    phone: ['talrunis', 'telefons', 'phone', 'mobilais', 'talr'], email: ['epasts', 'email', 'epastaadrese'],
    parentName: ['vecaks', 'vecakavardsuzvards', 'vecakavards', 'likumiskaisparstavis', 'parstavis'],
    mother: ['mate'], motherPhone: ['matestalrunis'], father: ['tevs'], fatherPhone: ['tevatalrunis'],
    other: ['citaatbildigapersona'], otherPhone: ['citaspersonastalrunis'],
    parentPhone: ['vecakatalrunis', 'vecakutalrunis', 'vecakatelefons', 'parstavjatalrunis'], parentEmail: ['vecakaepasts', 'vecakuepasts', 'parstavjaepasts'],
    addressDeclared: ['deklaretaadrese', 'adrese'], addressActual: ['faktiskaadrese'], notes: ['piezimes', 'notes', 'komentars']
  };
  function rowsToPeople(rows) {
    if (!rows.length) return [];
    const header = rows[0].map(hdr), idx = {};
    for (const [k, arr] of Object.entries(ALIASES)) idx[k] = header.findIndex(x => arr.includes(x));
    if (idx.first < 0 && idx.name < 0) throw Error('neatradu kolonnu “Vārds” vai “Vārds uzvārds” pirmajā rindā');
    const out = [];
    for (const r of rows.slice(1)) {
      // e-klases palīgs pirms +, -, = un @ liek apostrofu (Excel aizsardzība) — to noņem
      const val = k => idx[k] < 0 ? '' : String(r[idx[k]] ?? '').trim().replace(/^'(?=[=+\-@])/, '');
      let first = val('first'), last = val('last');
      if (!first && val('name')) { const parts = val('name').split(/\s+/); first = parts.shift() || ''; last = parts.join(' '); }
      if (!first || !last) continue;
      const p = { first, last, status: 'active', retentionMonths: S.db.settings.retentionDefault };
      for (const k of ['personalCode', 'group', 'schoolClass', 'school', 'phone', 'email', 'parentName', 'parentPhone', 'parentEmail', 'addressDeclared', 'addressActual', 'notes']) p[k] = val(k);
      if (U.norm(p.addressActual) === U.norm(p.addressDeclared)) p.addressActual = '';
      // e-klase: māte, tēvs, cita atbildīgā persona → 1. un 2. pārstāvis
      const fam = [['Māte', val('mother'), val('motherPhone')], ['Tēvs', val('father'), val('fatherPhone')], ['Cita atbildīgā persona', val('other'), val('otherPhone')]].filter(x => x[1]);
      if (fam.length) {
        const i1 = Math.max(0, fam.findIndex(x => U.norm(x[1]) === U.norm(p.parentName)));
        const [r1, n1, t1] = fam[i1]; p.parentName = p.parentName || n1; p.parentPhone = p.parentPhone || t1; p.parentRelation = r1;
        const second = fam.find((x, i) => i !== i1);
        if (second) { p.parent2Relation = second[0]; p.parent2Name = second[1]; p.parent2Phone = second[2]; }
      }
      for (const k of Object.keys(p)) if (p[k] === '') delete p[k];
      if (p.personalCode && U.codeDigits(p.personalCode).length === 11) p.personalCode = U.fmtCode(p.personalCode);
      p.birth = U.parseDate(val('birth')) || U.birthFromCode(p.personalCode);
      const dd = D.duplicates(p); p._dup = dd.length > 0; p._match = dd.length === 1 ? dd[0].id : '';
      out.push(p);
    }
    return out;
  }

  let pending = [];
  A.import = mode => {
    impMode(mode === 'eklase' ? 'eklase' : 'file');
    U.$('importFile').value = ''; U.$('importPreview').innerHTML = ''; U.$('importStatus').textContent = ''; U.$('importConfirm').disabled = true; U.$('importGroup').value = S.db.settings.stickyGroup || '';
    ui.datalists(); pending = []; U.$('importDialog').showModal();
  };
  U.$('importFile').addEventListener('change', async e => {
    try {
      const f = e.target.files?.[0]; if (!f) return; if (f.size > 15 * 1024 * 1024) throw Error('fails pārsniedz 15 MB');
      const rows = /\.xlsx$/i.test(f.name) ? await parseXlsx(f) : /\.(csv|txt)$/i.test(f.name) ? parseCSV(await f.text()) : null;
      if (!rows) throw Error('atbalstīti .xlsx un .csv faili');
      pending = rowsToPeople(rows);
      showPreview();
    } catch (err) { U.$('importStatus').innerHTML = `<span class="red">Kļūda: ${esc(err.message)}</span>`; }
  });
  const fillOn = () => U.$('importFill').checked;
  // vecāku lauki tiek papildināti tikai kopā ar to pašu personu (lai saistība/tālrunis nepieliptu citam vecākam)
  const sameOrEmpty = (a, b) => !a || U.norm(a) === U.norm(b);
  const fillable = p => {
    const o = p._match && D.person(p._match); if (!o) return [];
    const p1ok = sameOrEmpty(o.parentName, p.parentName), p2ok = sameOrEmpty(o.parent2Name, p.parent2Name) && U.norm(p.parent2Name) !== U.norm(o.parentName);
    return Object.keys(p).filter(k => !k.startsWith('_') && !['status', 'retentionMonths', 'group'].includes(k) && p[k] && !o[k]
      && (!/^parent2/.test(k) || p2ok) && (!/^parent(?!2)/.test(k) || p1ok));
  };
  const fLabel = k => /^parent2/.test(k) ? '2. pārstāvis' : /^parent/.test(k) ? 'vecāks' : (CP.FIELD[k]?.l || k).toLowerCase();
  const fLabels = ks => [...new Set(ks.map(fLabel))].join(', ');
  function showPreview() {
    const dups = pending.filter(p => p._dup), fill = fillOn() ? dups.filter(p => fillable(p).length) : [];
    U.$('importStatus').innerHTML = `Atrastas <b>${pending.length}</b> personas${dups.length ? `, no tām <span class="warn">${dups.length} jau ir uzskaitē</span>${fill.length ? ` — ${fill.length} kartītēm tiks papildināti tukšie lauki` : ' (tiks izlaistas)'}` : ''}.`;
    const note = p => !p._dup ? 'jauna' : fillOn() && fillable(p).length ? `papildinās: ${fLabels(fillable(p))}` : 'jau ir';
    U.$('importPreview').innerHTML = `<table class="table"><thead><tr><th>Vārds, uzvārds</th><th>Dzim. datums</th><th>Grupa / klase</th><th>Vecāks</th><th></th></tr></thead><tbody>${pending.slice(0, 30).map(p => `<tr class="${p._dup && !(fillOn() && fillable(p).length) ? 'muted' : ''}"><td>${esc(U.full(p))}</td><td>${U.fmtDate(p.birth)}</td><td>${esc(p.group || p.schoolClass)}</td><td>${esc(p.parentName)}</td><td class="small">${esc(note(p))}</td></tr>`).join('')}</tbody></table>${pending.length > 30 ? `<p class="muted small">… un vēl ${pending.length - 30}</p>` : ''}`;
    U.$('importConfirm').disabled = !pending.some(p => !p._dup || (fillOn() && fillable(p).length));
  }
  U.$('importFill').addEventListener('change', () => { if (pending.length) showPreview(); });
  /* cilnes: fails / e-klase */
  function impMode(m) {
    U.$('importDialog').querySelectorAll('[data-imp]').forEach(b => b.classList.toggle('active', b.dataset.imp === m));
    U.$('impFileHelp').hidden = m !== 'file'; U.$('impEklaseHelp').hidden = m !== 'eklase';
    if (m === 'eklase') U.$('impScript').value = CP.EKLASE_SCRIPT || '';
  }
  U.$('importDialog').addEventListener('click', e => { const b = e.target.closest('[data-imp]'); if (b) impMode(b.dataset.imp); });
  U.$('impCopyScript').addEventListener('click', async () => {
    const t = CP.EKLASE_SCRIPT || '';
    try { await navigator.clipboard.writeText(t); ui.toast('Eksporta palīgs nokopēts. Tagad ielīmē to e-klases cilnes Console.', 'ok', 6000); }
    catch (e) { const ta = U.$('impScript'); ta.closest('details').open = true; ta.value = t; ta.focus(); ta.select(); ui.toast('Neizdevās nokopēt automātiski: kods ir iezīmēts, nospied Ctrl+C.', 'warn', 8000); }
  });
  U.$('importConfirm').onclick = () => {
    const g = U.$('importGroup').value.trim(); let n = 0, upd = 0;
    for (const p of pending) {
      if (p._dup) {
        const o = fillOn() && fillable(p).length && D.person(p._match);
        if (o) { const ks = fillable(p); for (const k of ks) o[k] = p[k]; o.updatedAt = U.now(); D.audit(o.id, 'update', ks.map(k => CP.FIELD[k]?.l || k)); upd++; }
        continue;
      }
      delete p._dup; delete p._match; if (g && !p.group) p.group = g;
      const np = { ...p, id: U.uid(), createdAt: U.now(), updatedAt: U.now() }; CP.store.assignFolder(np); S.db.people.push(np); D.bindYear(np, { group: np.group || '', status: np.status || 'active' }); D.audit(np.id, 'create', ['imports']); n++;
    }
    pending = []; U.$('importDialog').close(); S.page = 'people'; CP.store.changed(); ui.toast(`Importētas ${n} personas${upd ? `, papildinātas ${upd} kartītes` : ''}`, 'ok');
  };

  io.exportCsv = (people, withCodes = false) => {
    const cols = [['last', 'Uzvārds'], ['first', 'Vārds'], ['birth', 'Dzimšanas datums'], withCodes && ['personalCode', 'Personas kods'], ['status', 'Statuss'], ['group', 'Grupa'], ['school', 'Mācību iestāde'], ['schoolClass', 'Klase'], ['phone', 'Tālrunis'], ['email', 'E-pasts'], ['parentName', 'Vecāks'], ['parentPhone', 'Vecāka tālrunis'], ['parentEmail', 'Vecāka e-pasts']].filter(Boolean);
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const val = (p, k) => k === 'status' ? (CP.STATUSES[D.partStatus(p)] || '') : k === 'group' ? D.groupOf(p) : k === 'birth' ? U.fmtDate(p.birth) : p[k];
    const csv = '﻿' + [cols.map(c => q(c[1])).join(';'), ...people.sort((a, b) => U.cmp(U.sortName(a), U.sortName(b))).map(p => cols.map(c => q(val(p, c[0]))).join(';'))].join('\r\n');
    U.download(new Blob([csv], { type: 'text/csv' }), `personas_${U.iso()}.csv`);
    ui.toast(`Eksportētas ${people.length} personas${withCodes ? '' : ' (bez personas kodiem)'}`, 'ok');
  };
  A.exportCsv = () => io.exportCsv(D.peopleInYear().filter(D.isCurrent));
  A.backup = () => U.download(new Blob([JSON.stringify(S.db, null, 2)], { type: 'application/json' }), `CADET_REZERVE_${U.iso()}.json`);

  CP.io = io;
})(window.CP);
