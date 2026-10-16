/* =====================================================================
   Lietotāja Word (.docx) veidnes aizpildīšana.
   Atzīmes: {nosaukums}, {datums} … Tabulas rinda ar dalībnieka atzīmēm ({nr}, {vards} …)
   tiek atkārtota katram dalībniekam; rinda ar {d_…} — katram darbiniekam.
   Atzīme, kas Word sadalīta vairākos “gabalos”, tiek apvienota (rindkopas formatējums paliek no pirmā gabala).
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, D = CP.data;
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const fmtD = iso => { const s = U.fmtDate(iso); return s ? s + '.' : ''; };
  const phone = n => n ? (U.prettyPhone ? U.prettyPhone(n) : n) : '';

  const FIELDS_HELP = [
    ['{nosaukums}', 'pasākuma / nometnes nosaukums'], ['{norises_laiks}', 'piem. 2026. gada 17.–18. oktobris'], ['{datums}', 'instruktāžas datums'],
    ['{gads}', 'gads'], ['{grupa}', 'grupa(-s)'], ['{piezimes}', 'piezīmes'], ['{amats}', 'instruktāžas veicēja amats'], ['{instruktors}', 'instruktāžas veicējs'],
    ['{vaditajs}', 'nometnes vadītājs'], ['{dalibnieku_skaits}', 'dalībnieku skaits'],
    ['Dalībnieka rinda', '{nr} {vards} {vards_uzvards} {uzvards} {personas_kods} {dzimsanas_datums} {grupa_p} {adrese} {talrunis} {vecaki} {audzinatajs} {rindas_datums}'],
    ['Darbinieka rinda', '{d_nr} {d_vards} {d_personas_kods} {d_amats} {d_adrese} {d_talrunis}']
  ];

  /** Dati atzīmēm */
  function data(ev, people, staff, counselorOf) {
    const leader = staff.find(s => s.id === ev.leaderId);
    const addr = x => { const a = [x.addressDeclared]; if (x.addressActual && U.norm(x.addressActual) !== U.norm(x.addressDeclared || '')) a.push('fakt.: ' + x.addressActual); return a.filter(Boolean).join('; '); };
    const global = {
      nosaukums: ev.title || '', norises_laiks: ev.when || '', datums: fmtD(ev.instrDate), gads: (ev.instrDate || U.iso()).slice(0, 4), grupa: ev.group || '',
      piezimes: ev.notes || '', amats: ev.instrPosition || '', instruktors: ev.instrName || '', vaditajs: leader?.name || '', dalibnieku_skaits: String(people.length)
    };
    const rows = people.map((p, i) => ({
      nr: `${i + 1}.`, vards: U.full(p), vards_uzvards: U.full(p), uzvards: p.last || '', personas_kods: p.personalCode || '', dzimsanas_datums: fmtD(p.birth), grupa_p: D.groupOf(p, ev.yearId) || '',
      adrese: [addr(p), phone(p.phone) && 'tālr. ' + phone(p.phone)].filter(Boolean).join(', '), talrunis: phone(p.phone),
      vecaki: [[p.parentName, phone(p.parentPhone)], [p.parent2Name, phone(p.parent2Phone)]].filter(([n, t]) => n || t).map(x => x.filter(Boolean).join(', ')).join('; '),
      audzinatajs: counselorOf ? counselorOf(p) : '', rindas_datums: ev.fillDates === false ? '' : fmtD(ev.instrDate)
    }));
    const st = staff.filter(s => (ev.staff || []).includes(s.id)).map((s, i) => ({ d_nr: `${i + 1}.`, d_vards: s.name, d_personas_kods: s.personalCode || '', d_amats: s.role || '', d_adrese: [s.address, phone(s.phone) && 'tālr. ' + phone(s.phone)].filter(Boolean).join(', '), d_talrunis: phone(s.phone) }));
    return { global, rows, staff: st, blankRows: Math.max(0, Number(ev.blankRows) || 0), staffBlank: Math.max(0, Number(ev.staffBlankRows) || 0) };
  }

  /* --- XML apstrāde --- */
  const ROW_KEYS = ['nr', 'vards', 'vards_uzvards', 'uzvards', 'personas_kods', 'dzimsanas_datums', 'grupa_p', 'adrese', 'talrunis', 'vecaki', 'audzinatajs', 'rindas_datums'];
  const STAFF_KEYS = ['d_nr', 'd_vards', 'd_personas_kods', 'd_amats', 'd_adrese', 'd_talrunis'];
  const tEls = el => [...el.getElementsByTagNameNS(W, 't')];
  /** Apvieno atzīmes, kas sadalītas pa vairākiem w:t vienā rindkopā */
  function mergeParagraphs(doc) {
    for (const p of doc.getElementsByTagNameNS(W, 'p')) {
      const ts = tEls(p); if (ts.length < 2) continue;
      if (!/\{[a-z_0-9]+\}/i.test(ts.map(t => t.textContent).join(''))) continue;
      // apvieno tikai tos gabalus, kas pārdala kādu {atzīmi}
      const open = s => { const i = s.lastIndexOf('{'); return i >= 0 && s.indexOf('}', i) < 0; };
      for (let i = 0; i < ts.length; i++) {
        let j = i;
        while (open(ts[i].textContent) && j + 1 < ts.length) { j++; ts[i].textContent += ts[j].textContent; ts[j].textContent = ''; }
        if (j > i) ts[i].setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
        i = j;
      }
    }
  }
  function fillText(el, map) {
    for (const t of tEls(el)) {
      const v = t.textContent; if (!v.includes('{')) continue;
      t.textContent = v.replace(/\{([a-z_0-9]+)\}/gi, (m, k) => (k.toLowerCase() in map ? String(map[k.toLowerCase()] ?? '') : m)).replace(/\s*\n\s*/g, '; ');
      t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    }
  }
  function repeatRows(doc, keys, items, blank, nrKey) {
    const rows = [...doc.getElementsByTagNameNS(W, 'tr')].filter(tr => keys.some(k => tr.textContent.includes('{' + k + '}')));
    for (const tpl of rows) {
      const parent = tpl.parentNode, list = [...items];
      for (let i = 0; i < blank; i++) list.push({ [nrKey]: `${items.length + i + 1}.` });
      for (const it of list) { const tr = tpl.cloneNode(true); fillText(tr, Object.fromEntries(keys.map(k => [k, it[k] ?? '']))); parent.insertBefore(tr, tpl); }
      parent.removeChild(tpl);
    }
  }
  function processXml(xml, d) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw Error('Word dokumenta XML nav nolasāms');
    mergeParagraphs(doc);
    repeatRows(doc, STAFF_KEYS, d.staff, d.staffBlank, 'd_nr');
    repeatRows(doc, ROW_KEYS, d.rows, d.blankRows, 'nr');
    fillText(doc.documentElement, d.global);
    return new XMLSerializer().serializeToString(doc);
  }

  /* --- ZIP rakstītājs (deflate, CRC-32) --- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u => { let c = 0xffffffff; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const deflate = async u => new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  async function zip(entries, type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    const now = new Date(), dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)), dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate());
    for (const [name, data] of entries) {
      const nb = enc.encode(name), comp = await deflate(data), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 8, true); h.setUint16(10, dt, true); h.setUint16(12, dd, true);
      h.setUint32(14, crc, true); h.setUint32(18, comp.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nb, comp);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 8, true); c.setUint16(12, dt, true); c.setUint16(14, dd, true);
      c.setUint32(16, crc, true); c.setUint32(20, comp.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nb);
      off += 30 + nb.length + comp.length;
    }
    const csize = central.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type });
  }

  async function fill(buf, d) {
    const files = await U.unzip(buf), out = [], dec = new TextDecoder(), enc = new TextEncoder();
    if (!files.has('word/document.xml')) throw Error('fails nav Word .docx dokuments');
    let found = false;
    for (const [name, get] of files) {
      let data = await get();
      if (/^word\/(document|header\d*|footer\d*)\.xml$/.test(name)) {
        const xml = dec.decode(data); if (/\{[a-z_0-9]+\}/i.test(xml.replace(/<[^>]+>/g, ''))) found = true;
        data = enc.encode(processXml(xml, d));
      }
      out.push([name, data]);
    }
    if (!found) CP.ui.toast('Veidnē netika atrasta neviena atzīme {…}. Fails tika saglabāts bez izmaiņām.', 'warn', 10000);
    return zip(out);
  }

  CP.docxFill = { fill, data, FIELDS_HELP, zip };
})(window.CP);
