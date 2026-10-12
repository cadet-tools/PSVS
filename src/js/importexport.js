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
    parentName: ['vecaks', 'vecakavardsuzvards', 'vecakavards', 'likumiskaisparstavis', 'parstavis', 'mate', 'tevs'],
    parentPhone: ['vecakatalrunis', 'vecakutalrunis', 'vecakatelefons', 'parstavjatalrunis'], parentEmail: ['vecakaepasts', 'vecakuepasts', 'parstavjaepasts'],
    addressDeclared: ['deklaretaadrese', 'adrese'], notes: ['piezimes', 'notes', 'komentars']
  };
  function rowsToPeople(rows) {
    if (!rows.length) return [];
    const header = rows[0].map(hdr), idx = {};
    for (const [k, arr] of Object.entries(ALIASES)) idx[k] = header.findIndex(x => arr.includes(x));
    if (idx.first < 0 && idx.name < 0) throw Error('neatradu kolonnu “Vārds” vai “Vārds uzvārds” pirmajā rindā');
    const out = [];
    for (const r of rows.slice(1)) {
      const val = k => idx[k] < 0 ? '' : String(r[idx[k]] ?? '').trim();
      let first = val('first'), last = val('last');
      if (!first && val('name')) { const parts = val('name').split(/\s+/); first = parts.shift() || ''; last = parts.join(' '); }
      if (!first || !last) continue;
      const p = { first, last, status: 'active', retentionMonths: S.db.settings.retentionDefault };
      for (const k of ['personalCode', 'group', 'schoolClass', 'school', 'phone', 'email', 'parentName', 'parentPhone', 'parentEmail', 'addressDeclared', 'notes']) p[k] = val(k);
      if (p.personalCode && U.codeDigits(p.personalCode).length === 11) p.personalCode = U.fmtCode(p.personalCode);
      p.birth = U.parseDate(val('birth')) || U.birthFromCode(p.personalCode);
      p._dup = D.duplicates(p).length > 0;
      out.push(p);
    }
    return out;
  }

  let pending = [];
  A.import = () => {
    U.$('importFile').value = ''; U.$('importPreview').innerHTML = ''; U.$('importStatus').textContent = ''; U.$('importConfirm').disabled = true; U.$('importGroup').value = S.db.settings.stickyGroup || '';
    ui.datalists(); pending = []; U.$('importDialog').showModal();
  };
  U.$('importFile').addEventListener('change', async e => {
    try {
      const f = e.target.files?.[0]; if (!f) return; if (f.size > 15 * 1024 * 1024) throw Error('fails pārsniedz 15 MB');
      const rows = /\.xlsx$/i.test(f.name) ? await parseXlsx(f) : /\.(csv|txt)$/i.test(f.name) ? parseCSV(await f.text()) : null;
      if (!rows) throw Error('atbalstīti .xlsx un .csv faili');
      pending = rowsToPeople(rows);
      const dups = pending.filter(p => p._dup).length;
      U.$('importStatus').innerHTML = `Atrastas <b>${pending.length}</b> personas${dups ? `, no tām <span class="warn">${dups} jau ir uzskaitē</span> (tiks izlaistas)` : ''}.`;
      U.$('importPreview').innerHTML = `<table class="table"><thead><tr><th>Vārds, uzvārds</th><th>Dzim. datums</th><th>Grupa / klase</th><th>Vecāks</th><th></th></tr></thead><tbody>${pending.slice(0, 30).map(p => `<tr class="${p._dup ? 'muted' : ''}"><td>${esc(U.full(p))}</td><td>${U.fmtDate(p.birth)}</td><td>${esc(p.group || p.schoolClass)}</td><td>${esc(p.parentName)}</td><td>${p._dup ? 'dublikāts' : ''}</td></tr>`).join('')}</tbody></table>${pending.length > 30 ? `<p class="muted small">… un vēl ${pending.length - 30}</p>` : ''}`;
      U.$('importConfirm').disabled = !pending.some(p => !p._dup);
    } catch (err) { U.$('importStatus').innerHTML = `<span class="red">Kļūda: ${esc(err.message)}</span>`; }
  });
  U.$('importConfirm').onclick = () => {
    const g = U.$('importGroup').value.trim(); let n = 0;
    for (const p of pending) {
      if (p._dup) continue; delete p._dup; if (g && !p.group) p.group = g;
      const np = { ...p, id: U.uid(), createdAt: U.now(), updatedAt: U.now() }; CP.store.assignFolder(np); S.db.people.push(np); D.bindYear(np, { group: np.group || '', status: np.status || 'active' }); D.audit(np.id, 'create', ['imports']); n++;
    }
    pending = []; U.$('importDialog').close(); S.page = 'people'; CP.store.changed(); ui.toast(`Importētas ${n} personas`, 'ok');
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
