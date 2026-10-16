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
  const xml = raw => { const x = new DOMParser().parseFromString(raw, 'application/xml'); if (x.querySelector('parsererror')) throw Error('nevar nolasīt Excel XML'); return x; };
  const tags = (n, t) => [...n.getElementsByTagNameNS('*', t)];
  const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  /** Visas darblapas: [{ name, rows }] (secībā, kā Excel cilnēs) */
  async function parseXlsx(file) {
    const want = n => n === 'xl/sharedStrings.xml' || n === 'xl/workbook.xml' || n === 'xl/_rels/workbook.xml.rels' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n);
    const z = await U.unzip(await file.arrayBuffer(), want), dec = new TextDecoder();
    const txt = async n => z.has(n) ? dec.decode(await z.get(n)()) : '';
    let strings = [];
    if (z.has('xl/sharedStrings.xml')) strings = tags(xml(await txt('xl/sharedStrings.xml')), 'si').map(si => tags(si, 't').map(t => t.textContent).join(''));
    let order = [];
    const wb = await txt('xl/workbook.xml'), rels = await txt('xl/_rels/workbook.xml.rels');
    if (wb && rels) {
      const rm = {}; for (const r of tags(xml(rels), 'Relationship')) rm[r.getAttribute('Id')] = r.getAttribute('Target') || '';
      for (const sh of tags(xml(wb), 'sheet')) {
        const t = (rm[sh.getAttributeNS(RNS, 'id') || sh.getAttribute('r:id')] || '').replace(/^\/?(xl\/)?/, '');
        if (t) order.push({ name: sh.getAttribute('name') || t, path: 'xl/' + t, hidden: (sh.getAttribute('state') || 'visible') !== 'visible' });
      }
    }
    if (!order.length) order = [...z.keys()].filter(x => /sheet\d+\.xml$/.test(x)).sort((a, b) => Number(a.match(/(\d+)\.xml/)[1]) - Number(b.match(/(\d+)\.xml/)[1])).map((path, i) => ({ name: `Lapa ${i + 1}`, path }));
    const out = [];
    for (const sh of order) {
      if (!z.has(sh.path)) continue;
      const rows = [];
      for (const row of tags(xml(await txt(sh.path)), 'row')) {
        const arr = [], rn = Number(row.getAttribute('r')) || rows.length + 1;
        for (const c of tags(row, 'c')) {
          const letters = (c.getAttribute('r') || 'A').match(/^[A-Z]+/i)?.[0] || 'A'; let idx = 0;
          for (const ch of letters.toUpperCase()) idx = idx * 26 + ch.charCodeAt(0) - 64; idx--; if (idx < 0 || idx > 500) continue;
          let v = tags(c, 'v')[0]?.textContent || ''; const t = c.getAttribute('t');
          if (t === 's') v = strings[Number(v)] || ''; if (t === 'inlineStr') v = tags(c, 't').map(e => e.textContent).join('');
          arr[idx] = v;
        }
        while (rows.length < rn - 1 && rows.length < 5000) rows.push([]);   // tukšās rindas saglabā numerāciju
        rows.push(Array.from(arr, v => v ?? '')); if (rows.length > 5000) throw Error('maksimums 5000 rindas darblapā');
      }
      out.push({ name: sh.name, hidden: sh.hidden, rows });
    }
    if (!out.length) throw Error('XLSX nesatur darblapas');
    return out;
  }

  const hdr = s => U.norm(s).replace(/[^a-z0-9]/g, '');
  /* Kolonnu atpazīšana: vispirms precīzi nosaukumi, tad līdzīgi (piem. “Jaunsarga vārds”, “Vecāka tālr.”).
     Virsrakstu rindu meklē pirmajās 30 rindās; der arī divu rindu virsraksts (“Vecāks” virs “Vārds” / “Tālrunis”). */
  const ALIASES = {
    first: ['vards', 'firstname', 'first', 'skolenavards', 'jaunsargavards', 'dalibniekavards'], last: ['uzvards', 'lastname', 'last', 'skolenauzvards', 'jaunsargauzvards', 'dalibniekauzvards'],
    name: ['vardsuzvards', 'uzvardsvards', 'pilnsvards', 'fullname', 'name', 'skolens', 'audzeknis', 'izglitojamais', 'jaunsargs', 'dalibnieks', 'jaunsargavardsuzvards'],
    birth: ['dzimsanasdatums', 'dzimsanasdiena', 'dzimdat', 'dzimdatums', 'birth', 'dob', 'dzimis'], personalCode: ['personaskods', 'pk', 'perskods'],
    group: ['grupa', 'group', 'vieniba', 'nodala', 'apakvieniba'], schoolClass: ['klase', 'kurss', 'class'], school: ['skola', 'macibuiestade', 'izglitibasiestade'],
    phone: ['talrunis', 'telefons', 'phone', 'mobilais', 'talr', 'tel', 'telnr', 'talrnr'], email: ['epasts', 'email', 'epastaadrese', 'mail', 'eadrese'],
    parentCode: ['vecakapersonaskods', 'vecakupersonaskods', 'parstavjapersonaskods'], status: ['statuss', 'status'], idCardNo: ['apliecibasnr', 'apliecibasnumurs', 'jsapliecibasnr', 'apliecibanr'],
    parentName: ['vecaks', 'vecaki', 'vecakavardsuzvards', 'vecakavards', 'likumiskaisparstavis', 'parstavis', 'aizbildnis'],
    mother: ['mate', 'matesvardsuzvards'], motherPhone: ['matestalrunis', 'matestalr'], father: ['tevs', 'tevavardsuzvards'], fatherPhone: ['tevatalrunis', 'tevatalr'],
    other: ['citaatbildigapersona'], otherPhone: ['citaspersonastalrunis'],
    parent2Name: ['otravecakavardsuzvards', 'otrsvecaks', 'otravecakavards', 'vecaks2', '2vecaks', 'otrsparstavis'], parent2Phone: ['otravecakatalrunis', 'vecaka2talrunis', '2vecakatalrunis', 'otraparstavjatalrunis'],
    parentPhone: ['vecakatalrunis', 'vecakutalrunis', 'vecakatelefons', 'parstavjatalrunis', 'vecakatalr'], parentEmail: ['vecakaepasts', 'vecakuepasts', 'parstavjaepasts'],
    addressDeclared: ['deklaretaadrese', 'adrese', 'dzivesvieta'], addressActual: ['faktiskaadrese', 'faktiskadzivesvieta'], notes: ['piezimes', 'notes', 'komentars', 'komentari']
  };
  const FUZZY = {
    parentCode: /(vecak|parstav).*(kod|^pk)/, status: /^statuss/, idCardNo: /aplieci.*(nr|num)/,
    personalCode: /^(?!.*(vecak|parstav)).*(personas?kod|perskod)/, parentPhone: /^(?!.*vard)(.*(vecak|parstav|aizbild).*(talr|telef|mob|tel)|.*(talr|telef).*(vecak|parstav))/, parentEmail: /(vecak|parstav|aizbild).*(epast|mail)/,
    parentName: /vecak|parstav|aizbild/, motherPhone: /^mates.*(talr|telef|mob|tel)/, mother: /^mate($|s)/, fatherPhone: /^teva.*(talr|telef|mob|tel)/, father: /^tev(s|a)/,
    birth: /dzim(?!um)/, addressActual: /fakt.*(adres|dzivesv)|(adres|dzivesv).*fakt/, addressDeclared: /^(?!e(adres|past)).*(adres|dzivesviet)/, email: /epast|mail|^eadres/, phone: /talr|telef|phone|mobil/,
    schoolClass: /klase|kurss|class/, school: /skola|macibuiestad|izglitibasiestad/, group: /grupa|vieniba|nodala|group/, notes: /piezim|komentar|note/,
    other: /citaatbildig|aizbildn.*vard/, otherPhone: /cit.*persona.*(talr|telef)/,
    parent2Phone: /^(otr|2).*(vecak|parstav).*(talr|telef|mob|tel)/, parent2Name: /^(otr|2).*(vecak|parstav)(?!.*(talr|telef|mob|epast|kod))/,
    name: /vardsuzvards|uzvardsvards|pilnsvards|fullname/, last: /uzvard|surname|lastname/, first: /vards|firstname/
  };
  const PRIORITY = ['parentCode', 'idCardNo', 'status', 'personalCode', 'parent2Phone', 'parent2Name', 'parentPhone', 'parentEmail', 'motherPhone', 'fatherPhone', 'otherPhone', 'other', 'mother', 'father', 'parentName', 'birth', 'addressActual', 'addressDeclared', 'email', 'phone', 'schoolClass', 'school', 'group', 'notes', 'name', 'last', 'first'];
  const MAP_FIELDS = [['first', 'Vārds'], ['last', 'Uzvārds'], ['name', 'Vārds un uzvārds vienā kolonnā'], ['birth', 'Dzimšanas datums'], ['personalCode', 'Personas kods'], ['group', 'Grupa'], ['school', 'Skola'], ['schoolClass', 'Klase'],
    ['phone', 'Tālrunis'], ['email', 'E-pasts'], ['addressDeclared', 'Deklarētā adrese'], ['addressActual', 'Faktiskā adrese'], ['parentName', 'Vecāks'], ['parentPhone', 'Vecāka tālrunis'], ['parentEmail', 'Vecāka e-pasts'], ['parentCode', 'Vecāka personas kods'], ['parent2Name', 'Otrs vecāks'], ['parent2Phone', 'Otra vecāka tālrunis'],
    ['mother', 'Māte'], ['motherPhone', 'Mātes tālrunis'], ['father', 'Tēvs'], ['fatherPhone', 'Tēva tālrunis'], ['other', 'Cita atbildīgā persona'], ['otherPhone', 'Citas personas tālrunis'], ['status', 'Statuss'], ['idCardNo', 'Jaunsarga apliecības nr.'], ['notes', 'Piezīmes']];
  const colName = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  /** Virsraksta šūnas rindā r: savs teksts un (ja ir) virsraksts rindā virs tās (apvienotām šūnām — no kreisās) */
  function headerCells(rows, r) {
    const cur = rows[r] || [], prev = r > 0 ? rows[r - 1] || [] : [], n = Math.max(cur.length, prev.length), out = []; let carry = '';
    for (let c = 0; c < n; c++) {
      const own = String(cur[c] ?? '').trim(), up = String(prev[c] ?? '').trim();
      if (up) carry = up;
      // vertikāli apvienots virsraksts: šūna tukša, nosaukums ir rindā virs tās
      if (!own && up) out.push({ text: up, own: hdr(up), up: '' });
      else out.push({ text: own, own: hdr(own), up: own ? hdr(up || carry) : '' });
    }
    return out;
  }
  /** Divu rindu virsraksts: “Vecāks/Māte/Tēvs” virs “Vārds/Tālrunis/E-pasts” */
  function groupedField(up, own) {
    const who = /vecak|parstav|aizbild/.test(up) ? 'parent' : /^mate/.test(up) ? 'mother' : /^tev/.test(up) ? 'father' : '';
    if (!who) return '';
    const what = /talr|telef|mob|^tel/.test(own) ? 'Phone' : /epast|mail/.test(own) ? 'Email' : /vard/.test(own) ? 'Name' : '';
    if (!what) return '';
    if (who === 'parent') return 'parent' + what;
    return what === 'Name' ? who : what === 'Phone' ? who + 'Phone' : '';
  }
  function mapHeader(rows, r) {
    const H = headerCells(rows, r), map = {}, used = new Set();
    const take = (k, c) => { if (c >= 0 && !(k in map) && !used.has(c)) { map[k] = c; used.add(c); return true; } return false; };
    H.forEach((h, c) => { if (h.own && h.up) { const g = groupedField(h.up, h.own); if (g) take(g, c); } });
    for (const k of PRIORITY) take(k, H.findIndex((h, c) => !used.has(c) && h.own && ALIASES[k].includes(h.own)));
    for (const k of PRIORITY) if (!(k in map)) take(k, H.findIndex((h, c) => !used.has(c) && h.own && h.own.length > 1 && FUZZY[k].test(h.own)));
    if ('name' in map && 'first' in map && 'last' in map) { used.delete(map.name); delete map.name; }
    return map;
  }
  const hasName = m => ('first' in m && 'last' in m) || 'name' in m || ('first' in m);
  function detectHeader(rows) {
    let best = { r: 0, score: -1 };
    for (let r = 0; r < Math.min(30, rows.length); r++) {
      const m = mapHeader(rows, r), score = Object.keys(m).length + (hasName(m) ? 5 : 0);
      if (score > best.score && Object.keys(m).length >= 2 && hasName(m)) best = { r, score };
    }
    return best.score < 0 ? 0 : best.r;
  }
  /** “Vārds Uzvārds 26123456, Otrs Vecāks 29123456” → [{ name, phone }] */
  const PHONE_RE = /(\+?371[\s-]?)?\b[2-9](?:[\s-]?\d){7}\b/g;
  function splitContacts(text) {
    const t = String(text || '').replace(/\r/g, ''), out = []; let last = 0, m;
    PHONE_RE.lastIndex = 0;
    while ((m = PHONE_RE.exec(t))) {
      const name = t.slice(last, m.index).replace(/^[\s,;:\-–\/|]+|[\s,;:\-–\/|(]+$/g, '').replace(/\b(tel|tālr|mob)\.?\s*(nr\.?)?$/i, '').trim();
      out.push({ name, phone: m[0].replace(/[\s-]/g, '') }); last = m.index + m[0].length;
    }
    const rest = t.slice(last).replace(/^[\s,;:\-–\/|)]+/, '').trim();
    if (rest && /\p{L}{2}/u.test(rest)) out.push({ name: rest, phone: '' });
    return out.filter(x => x.name || x.phone).map(x => ({ name: x.name.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' '), phone: x.phone }));
  }
  /** Kolonnas, ko neliek piezīmēs (aprēķini, numerācija) */
  const SKIP_EXTRA = /^(npk|nr|nrpk|n)$|sodienas|^gadi$|^menesi$|^vecums$|^dienas$/;
  const EMPTYISH = /^(nav|navdati|nezinams|-+|—)$/;
  /** Excel datums kā skaitlis (piem. 40620) → ISO */
  const excelDate = v => /^\d{4,5}(\.\d+)?$/.test(v) && Number(v) > 3000 && Number(v) < 80000 ? new Date(Date.UTC(1899, 11, 30) + Math.round(Number(v)) * 864e5).toISOString().slice(0, 10) : '';
  function rowsToPeople(rows, headerRow, map, opts = {}) {
    if (!rows.length) return [];
    const idx = {}; for (const k of Object.keys(ALIASES)) idx[k] = k in map ? map[k] : -1;
    if (idx.first < 0 && idx.name < 0) throw Error('nav norādīta kolonna ar vārdu');
    const H = headerCells(rows, headerRow).map(h => h.own);
    const nameReversed = idx.name >= 0 && /^uzvards/.test(H[idx.name] || '');
    const fromEklase = H.includes('personaslietasnumurs');   // e-klases palīga CSV
    const out = [], skipped = [], used = new Set(Object.values(map));
    const extraCols = opts.extra ? H.map((h, c) => ({ c, h, label: headerCells(rows, headerRow)[c].text })).filter(x => x.h && !used.has(x.c) && !SKIP_EXTRA.test(x.h)) : [];
    io.lastSkipped = skipped;
    for (let ri = headerRow + 1; ri < rows.length; ri++) {
      const r = rows[ri], rn = ri + 1;
      // e-klases palīgs pirms +, -, = un @ liek apostrofu (Excel aizsardzība) — to noņem
      const cleanV = v => { v = String(v ?? '').trim().replace(/^'(?=[=+\-@])/, '').replace(/^(\d+)\.0+$/, '$1'); if (/^\d(\.\d+)?e\+?\d{1,2}$/i.test(v)) v = String(Math.round(Number(v))); return EMPTYISH.test(hdr(v)) ? '' : v; };
      const val = k => idx[k] < 0 ? '' : cleanV(r[idx[k]]);
      if (idx.first >= 0 && hdr(val('first')) === H[idx.first]) continue;   // atkārtots virsraksts
      let first = val('first'), last = val('last');
      let nameNote = '';
      if (!first && val('name')) {
        // “Anna Marija Ozola” → vārdi: Anna Marija, uzvārds: Ozola; “(…)” pie vārda → piezīmēs
        const raw = val('name').replace(/\s*\(([^)]*)\)\s*/g, (m0, x) => { nameNote = x.trim(); return ' '; }).replace(/\s*\n\s*/g, ' ').trim();
        const parts = raw.split(/\s+/).filter(Boolean);
        if (nameReversed) { last = parts.shift() || ''; first = parts.join(' '); } else { last = parts.length > 1 ? parts.pop() : ''; first = parts.join(' '); }
      }
      if (!first || !last) { if (first || last) skipped.push(rn); continue; }
      const p = { first, last, status: 'active', retentionMonths: S.db.settings.retentionDefault };
      for (const k of ['personalCode', 'group', 'schoolClass', 'school', 'phone', 'email', 'parentName', 'parentPhone', 'parentEmail', 'addressDeclared', 'addressActual', 'notes']) p[k] = val(k);
      if (U.norm(p.addressActual) === U.norm(p.addressDeclared)) p.addressActual = '';
      // e-klase: māte, tēvs, cita atbildīgā persona → 1. un 2. pārstāvis
      const fam = [['Māte', val('mother'), val('motherPhone')], ['Tēvs', val('father'), val('fatherPhone')], ['Cita atbildīgā persona', val('other'), val('otherPhone')]].filter(x => x[1]);
      if (val('parent2Name') || val('parent2Phone')) { p.parent2Name = val('parent2Name'); p.parent2Phone = val('parent2Phone'); }
      if (fam.length) {
        const i1 = Math.max(0, fam.findIndex(x => U.norm(x[1]) === U.norm(p.parentName)));
        const [r1, n1, t1] = fam[i1]; p.parentName = p.parentName || n1; p.parentPhone = p.parentPhone || t1; p.parentRelation = r1;
        const second = fam.find((x, i) => i !== i1);
        if (second && !p.parent2Name) { p.parent2Relation = second[0]; p.parent2Name = second[1]; p.parent2Phone = second[2]; }
      }
      // vārds un tālrunis vienā šūnā (arī divi vecāki vienā šūnā)
      if (/\d{6}/.test(p.parentName || '') || /\p{L}{2}/u.test(p.parentPhone || '')) {
        const cs = [...splitContacts(p.parentName), ...(/\p{L}{2}/u.test(p.parentPhone || '') ? splitContacts(p.parentPhone) : [])];
        if (/\p{L}{2}/u.test(p.parentPhone || '')) p.parentPhone = '';
        if (cs.length) {
          const a = cs[0]; p.parentName = a.name || (/\d{6}/.test(p.parentName) ? '' : p.parentName); p.parentPhone = p.parentPhone || a.phone;
          const b = cs.slice(1).find(x => U.norm(x.name) !== U.norm(a.name) || (x.phone && x.phone !== a.phone));
          if (b && !p.parent2Name) { p.parent2Name = b.name; p.parent2Phone = b.phone; }
        }
      } else if (/^\+?\d[\d\s-]{6,}$/.test(p.parentName || '')) { p.parentPhone = p.parentPhone || p.parentName.replace(/[\s-]/g, ''); p.parentName = ''; }
      if (p.phone) p.phone = p.phone.replace(/\s*\n\s*/g, ', ');
      const pc = val('parentCode'); if (pc && U.codeDigits(pc).length === 11) p.parentCode = U.fmtCode(pc);
      const stv = U.norm(val('status')); if (stv) p.status = /kandid/.test(stv) ? 'candidate' : /neaktiv|partrauk|izstaj|pauze/.test(stv) ? 'paused' : 'active';
      if (opts.status) p.status = opts.status;
      const icn = val('idCardNo'); if (icn && /\d/.test(icn)) p.idCard = { status: 'issued', number: icn.replace(/^nr\.?\s*/i, 'Nr. ').trim(), changedAt: U.now() };
      if (extraCols.length) {
        const ex = extraCols.map(x => [x.label, cleanV(r[x.c])]).filter(([, v]) => v).map(([l, v]) => `${l.replace(/\s+/g, ' ').replace(/[.:]+$/, '')}: ${v.replace(/\s*\n\s*/g, ' ')}`);
        if (ex.length) p.notes = [p.notes, 'No Excel — ' + ex.join('; ')].filter(Boolean).join('\n');
      }
      if (fromEklase) p.reg = { eklase: { done: true, date: U.iso() } };
      if (nameNote) p.notes = [p.notes, 'Pie vārda: ' + nameNote].filter(Boolean).join('\n');
      for (const k of Object.keys(p)) if (p[k] === '') delete p[k];
      if (p.personalCode && /^\d{10}$/.test(p.personalCode)) p.personalCode = '0' + p.personalCode;   // Excel nogriež sākuma nulli
      let pcBirth = '';
      if (p.personalCode && U.codeDigits(p.personalCode).length !== 11) {   // nepilns / aizklāts kods (piem. 010312-*****) — paturam tikai dzimšanas datumu
        const m6 = /^(\d{2})(\d{2})(\d{2})/.exec(U.codeDigits(p.personalCode));
        if (m6) { const yy = Number(m6[3]), y = yy <= new Date().getFullYear() % 100 ? 2000 + yy : 1900 + yy; pcBirth = U.parseDate(`${m6[1]}.${m6[2]}.${y}`); }
        delete p.personalCode;
      }
      if (p.personalCode && U.codeDigits(p.personalCode).length === 11) p.personalCode = U.fmtCode(p.personalCode);
      if (p.phone && /^\d{8}$/.test(p.phone) === false && /^\d+(\.0+)?$/.test(p.phone)) p.phone = p.phone.replace(/\.0+$/, '');
      p.birth = excelDate(val('birth')) || U.parseDate(val('birth')) || U.birthFromCode(p.personalCode) || pcBirth;
      const dd = D.duplicates(p); p._dup = dd.length > 0; p._match = dd.length === 1 ? dd[0].id : '';
      out.push(p);
    }
    return out;
  }

  let pending = [];
  A.import = mode => {
    impMode(mode === 'eklase' ? 'eklase' : 'file');
    U.$('importFile').value = ''; U.$('importPreview').innerHTML = ''; U.$('importMap').innerHTML = ''; U.$('importStatusSel').value = ''; imp = null; U.$('importStatus').textContent = ''; U.$('importConfirm').disabled = true; U.$('importGroup').value = S.db.settings.stickyGroup || '';
    ui.datalists(); pending = []; U.$('importDialog').showModal();
  };
  U.$('importFile').addEventListener('change', async e => {
    try {
      const f = e.target.files?.[0]; if (!f) return; if (f.size > 15 * 1024 * 1024) throw Error('fails pārsniedz 15 MB');
      if (/\.xls$/i.test(f.name)) throw Error('vecais .xls formāts netiek atbalstīts. Excel atver failu un saglabā to kā .xlsx (Fails → Saglabāt kā → Excel darbgrāmata).');
      const sheets = /\.xlsx$/i.test(f.name) ? await parseXlsx(f) : /\.(csv|txt)$/i.test(f.name) ? [{ name: f.name, rows: parseCSV(await f.text()) }] : null;
      if (!sheets) throw Error('atbalstīti .xlsx un .csv faili');
      imp = { sheets, sheet: 0, headerRow: 0, map: {} };
      // pirmā darblapa, kurā atrodas vārdu kolonna
      let found = -1;
      for (let i = 0; i < sheets.length && found < 0; i++) { if (sheets[i].hidden) continue; const r = detectHeader(sheets[i].rows); if (hasName(mapHeader(sheets[i].rows, r))) found = i; }
      selectSheet(found < 0 ? 0 : found);
    } catch (err) { imp = null; U.$('importMap').innerHTML = ''; U.$('importPreview').innerHTML = ''; U.$('importStatus').innerHTML = `<span class="red">Kļūda: ${esc(err.message)}</span>`; }
  });
  /* --- Kolonnu sasaiste: darblapa, virsrakstu rinda, kolonnas (lietotājs var labot) --- */
  let imp = null;
  function selectSheet(i) { imp.sheet = i; U.$('importStatusSel').value = /neaktiv|izstaj|bijus/i.test(U.norm(imp.sheets[i].name)) ? 'paused' : ''; selectHeader(detectHeader(imp.sheets[i].rows)); }
  function selectHeader(r) { imp.headerRow = r; imp.map = mapHeader(imp.sheets[imp.sheet].rows, r); rebuild(); }
  function rebuild() {
    const rows = imp.sheets[imp.sheet].rows;
    try { pending = hasName(imp.map) ? rowsToPeople(rows, imp.headerRow, imp.map, { extra: U.$('importExtra').checked, status: U.$('importStatusSel').value }) : []; } catch (e) { pending = []; io.lastSkipped = []; }
    renderMap(); showPreview();
    const sk = io.lastSkipped || [];
    if (sk.length) U.$('importStatus').insertAdjacentHTML('beforeend', ` <span class="warn">${sk.length} ${sk.length === 1 ? 'rinda izlaista' : 'rindas izlaistas'}: trūkst vārda vai uzvārda (${sk.slice(0, 8).map(n => n + '.').join(', ')}${sk.length > 8 ? ' …' : ''} rinda). Ja uzvārds ir citā kolonnā, norādi to zemāk.</span>`);
    if (!hasName(imp.map)) U.$('importStatus').innerHTML = '<span class="warn">Neatradu kolonnu ar vārdu. Izvēlies pareizo virsrakstu rindu vai zemāk norādi, kurā kolonnā ir vārds un uzvārds.</span>';
  }
  function renderMap() {
    const sh = imp.sheets[imp.sheet], rows = sh.rows, H = headerCells(rows, imp.headerRow);
    const cell = v => String(v ?? '').trim();
    const rowLabel = r => `${r + 1}. rinda: ${(rows[r] || []).map(cell).filter(Boolean).slice(0, 6).join(' | ').slice(0, 90) || '(tukša)'}`;
    const cols = H.map((h, c) => ({ c, label: `${colName(c)} · ${(h.text || '').slice(0, 40) || '(bez virsraksta)'}` })).filter((x, c) => H[c].text || rows.slice(imp.headerRow + 1, imp.headerRow + 20).some(r => cell(r[c])));
    const n = Object.keys(imp.map).length, ok = hasName(imp.map);
    U.$('importMap').innerHTML = `<div class="imp-map">
      <div class="fieldgrid">
        ${imp.sheets.length > 1 ? `<div class="field"><label>Darblapa</label><select id="impSheet">${imp.sheets.map((s, i) => `<option value="${i}" ${i === imp.sheet ? 'selected' : ''}>${esc(s.name)}${s.hidden ? ' (paslēpta)' : ''}</option>`).join('')}</select></div>` : ''}
        <div class="field ${imp.sheets.length > 1 ? '' : 'wide'}"><label>Rinda ar kolonnu nosaukumiem</label><select id="impHeader">${rows.slice(0, 30).map((r, i) => `<option value="${i}" ${i === imp.headerRow ? 'selected' : ''}>${esc(rowLabel(i))}</option>`).join('')}</select></div>
      </div>
      <details ${ok && !imp.open ? '' : 'open'} class="small" id="impColsBox"><summary>Atpazītas <b>${n}</b> kolonnas — pārbaudi vai labo</summary>
        <div class="imp-cols">${MAP_FIELDS.map(([k, l]) => `<label><span>${esc(l)}</span><select data-impcol="${k}"><option value="">— neimportēt —</option>${cols.map(x => `<option value="${x.c}" ${imp.map[k] === x.c ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>`).join('')}</div>
      </details></div>`;
  }
  U.$('importDialog').addEventListener('toggle', e => { if (imp && e.target.id === 'impColsBox') imp.open = e.target.open; }, true);
  U.$('importDialog').addEventListener('change', e => {
    const t = e.target; if (!imp) return;
    if (t.id === 'impSheet') selectSheet(Number(t.value));
    else if (t.id === 'importExtra' || t.id === 'importStatusSel') rebuild();
    else if (t.id === 'impHeader') selectHeader(Number(t.value));
    else if (t.dataset.impcol) {
      const k = t.dataset.impcol, v = t.value;
      imp.open = true;
      if (v === '') delete imp.map[k];
      else { const c = Number(v); for (const x of Object.keys(imp.map)) if (imp.map[x] === c) delete imp.map[x]; imp.map[k] = c; }
      rebuild();
    }
  });
  const fillOn = () => U.$('importFill').checked;
  // vecāku lauki tiek papildināti tikai kopā ar to pašu personu (lai saistība/tālrunis nepieliptu citam vecākam)
  const sameOrEmpty = (a, b) => !a || U.norm(a) === U.norm(b);
  const fillable = p => {
    const o = p._match && D.person(p._match); if (!o) return [];
    const p1ok = sameOrEmpty(o.parentName, p.parentName), p2ok = sameOrEmpty(o.parent2Name, p.parent2Name) && U.norm(p.parent2Name) !== U.norm(o.parentName);
    return Object.keys(p).filter(k => !k.startsWith('_') && !['status', 'retentionMonths', 'group', 'reg'].includes(k) && p[k] && !o[k]
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
        const om = D.person(p._match);
        if (om && p.reg?.eklase && !om.reg?.eklase?.done && CP.registry) CP.registry.setReg(om, 'eklase', true);
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

  /** Personas no Excel/CSV faila (bez saglabāšanas): { people, sheet, rows } — izmanto arī ārējo dalībnieku imports */
  io.peopleFromFile = async file => {
    if (/\.xls$/i.test(file.name)) throw Error('vecais .xls formāts netiek atbalstīts — saglabā kā .xlsx');
    const sheets = /\.xlsx$/i.test(file.name) ? await parseXlsx(file) : [{ name: file.name, rows: parseCSV(await file.text()) }];
    let best = null;
    for (const sh of sheets.filter(s => !s.hidden && s.rows.length)) {
      const r = detectHeader(sh.rows), map = mapHeader(sh.rows, r);
      if (!hasName(map)) continue;
      const score = Object.keys(map).length; if (!best || score > best.score) best = { sh, r, map, score };
    }
    if (!best) throw Error('failā netika atrasta tabula ar kolonnām “Vārds”, “Uzvārds”');
    return { people: rowsToPeople(best.sh.rows, best.r, best.map), sheet: best.sh.name, rows: best.sh.rows, headerRow: best.r };
  };
  CP.io = io;
})(window.CP);
