/* =====================================================================
   PDF veidlapas (pdf-lib + fontkit, Tinos — Times līdzīgs fonts ar latviešu burtiem).
   Bibliotēkas tiek ielādētas tikai pirmajā PDF veidošanas reizē.
   Instruktāžas lapa (A4 stateniski) un nometnes žurnāls (A4 guļus) pēc Jaunsardzes paraugiem.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util;
  const MM = 72 / 25.4;
  let LIB = null;
  async function load() {
    if (LIB) return LIB;
    await CP.reader.loadScript(CP.VENDOR + 'pdf/pdf-lib.min.js');
    await CP.reader.loadScript(CP.VENDOR + 'pdf/fontkit.umd.min.js');
    const get = async n => new Uint8Array(await (await fetch(CP.VENDOR + 'pdf/' + n)).arrayBuffer());
    const [reg, bold, ital] = await Promise.all(['Tinos-400Regular.ttf', 'Tinos-700Bold.ttf', 'Tinos-400Regular_Italic.ttf'].map(get));
    LIB = { P: window.PDFLib, fk: window.fontkit, reg, bold, ital };
    return LIB;
  }

  /* --- Zīmēšanas palīgs vienam dokumentam --- */
  async function newDoc(title) {
    const L = await load(), doc = await L.P.PDFDocument.create();
    doc.registerFontkit(L.fk);
    doc.setTitle(title); doc.setCreator('CADET PERSONĀLS'); doc.setProducer('CADET PERSONĀLS'); doc.setLanguage('lv');
    const F = { r: await doc.embedFont(L.reg, { subset: true }), b: await doc.embedFont(L.bold, { subset: true }), i: await doc.embedFont(L.ital, { subset: true }) };
    const black = L.P.rgb(0, 0, 0), grey = L.P.rgb(0.35, 0.35, 0.35);
    const clean = s => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/[^ -ſ‐-‧‰‹›€№™]/g, '?');
    const width = (t, f, s) => f.widthOfTextAtSize(clean(t), s);
    /** Teksta sadalīšana rindās pēc platuma */
    function wrap(text, f, s, w) {
      const out = [];
      for (const para of clean(text).split(/\n/)) {
        let line = '';
        for (const word of para.split(/\s+/).filter(Boolean)) {
          const cand = line ? line + ' ' + word : word;
          if (width(cand, f, s) <= w) { line = cand; continue; }
          if (line) out.push(line);
          if (width(word, f, s) <= w) { line = word; continue; }
          let part = '';   // ļoti garš vārds — dala pa burtiem
          for (const ch of word) { if (width(part + ch, f, s) > w && part) { out.push(part); part = ch; } else part += ch; }
          line = part;
        }
        out.push(line);
      }
      return out.length ? out : [''];
    }
    function text(page, t, x, y, o = {}) {
      const f = o.font || F.r, s = o.size || 11, str = clean(t);
      let tx = x; const w = width(str, f, s);
      if (o.align === 'center') tx = x - w / 2; else if (o.align === 'right') tx = x - w;
      page.drawText(str, { x: tx, y, size: s, font: f, color: o.color || black });
      if (o.underline) page.drawLine({ start: { x: tx, y: y - 1.5 }, end: { x: tx + w, y: y - 1.5 }, thickness: 0.6, color: o.color || black });
      return w;
    }
    const line = (page, x1, y1, x2, y2, t = 0.7) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: t, color: black });
    /** Teksts šūnā (vairākas rindas, centrēts vertikāli) */
    function cell(page, t, x, yTop, w, h, o = {}) {
      const f = o.font || F.r, s = o.size || 10, lh = s * 1.15, pad = o.pad ?? 3;
      const lines = wrap(t, f, s, w - 2 * pad);
      const total = lines.length * lh, y0 = yTop - (h - total) / 2 - s * 0.82;
      lines.forEach((ln, i) => {
        const y = y0 - i * lh;
        if (o.align === 'center') text(page, ln, x + w / 2, y, { font: f, size: s, align: 'center' });
        else if (o.align === 'right') text(page, ln, x + w - pad, y, { font: f, size: s, align: 'right' });
        else text(page, ln, x + pad, y, { font: f, size: s });
      });
    }
    const cellLines = (t, w, o = {}) => wrap(t, o.font || F.r, o.size || 10, w - 2 * (o.pad ?? 3)).length;
    return { L, doc, F, text, line, cell, cellLines, wrap, width, grey };
  }

  /** Tabula ar galveni (var būt 2 rindas ar apvienotu grupu), automātiska lapošana un galvenes atkārtošana */
  function table(ctx, { page: firstPage, newPage, x, yTop, yMin, cols, head, rows, minH, size = 10, headSize = 9.5 }) {
    const { F, line, cell, cellLines } = ctx;
    const W = cols.reduce((a, c) => a + c.w, 0);
    let page = firstPage, y = yTop;
    const drawHead = () => {
      const h1 = head.h1, h2 = head.h2 || 0, top = y;
      line(page, x, top, x + W, top);
      let cx = x;
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i], g = head.groups?.find(g => g.from === i);
        if (g) {   // apvienota grupas virsrinda
          const gw = cols.slice(g.from, g.to + 1).reduce((a, c) => a + c.w, 0);
          cell(page, g.title, cx, top, gw, h1, { font: F.b, size: headSize, align: 'center' });
          line(page, cx, top - h1, cx + gw, top - h1);
          let sx = cx;
          for (let j = g.from; j <= g.to; j++) { cell(page, cols[j].title, sx, top - h1, cols[j].w, h2, { font: F.b, size: headSize - 0.5, align: 'center' }); sx += cols[j].w; if (j < g.to) line(page, sx, top - h1, sx, top - h1 - h2); }
          cx += gw; i = g.to; line(page, cx, top, cx, top - h1 - h2); continue;
        }
        cell(page, c.title, cx, top, c.w, h1 + h2, { font: F.b, size: headSize, align: 'center' });
        line(page, cx, top, cx, top - h1 - h2);
        cx += c.w;
      }
      line(page, x, top, x, top - h1 - h2);
      y = top - h1 - h2; line(page, x, y, x + W, y);
    };
    drawHead();
    const pages = [page];
    for (const r of rows) {
      const lines = Math.max(1, ...cols.map((c, i) => r[i] ? cellLines(r[i], c.w, { size, font: c.bold ? F.b : F.r }) : 1));
      const h = Math.max(minH, lines * size * 1.15 + 6);
      if (y - h < yMin) { page = newPage(); pages.push(page); y = page.__top; drawHead(); }
      let cx = x;
      cols.forEach((c, i) => {
        if (r[i] != null && r[i] !== '') cell(page, r[i], cx, y, c.w, h, { size: c.size || size, font: c.bold ? F.b : c.italic ? F.i : F.r, align: c.align });
        line(page, cx, y, cx, y - h); cx += c.w;
      });
      line(page, x + W, y, x + W, y - h);
      y -= h; line(page, x, y, x + W, y);
    }
    return { page, y, pages };
  }
  const fmtD = iso => { const s = U.fmtDate(iso); return s ? s + '.' : ''; };
  function pageNumbers(ctx, w) {
    const pages = ctx.doc.getPages(); if (pages.length < 2) return;
    pages.forEach((p, i) => ctx.text(p, `${i + 1}. lapa no ${pages.length}`, w - 15 * MM, 8 * MM, { size: 8, align: 'right', color: ctx.grey }));
  }

  /* =================== Drošības noteikumu instruktāžas veidlapa =================== */
  async function instruction(ev, people) {
    const ctx = await newDoc(`Instruktāžas veidlapa — ${ev.title || ''}`), { doc, F, text, line } = ctx;
    const W = 595.28, H = 841.89, M = 15 * MM, cw = W - 2 * M;
    const add = () => { const p = doc.addPage([W, H]); p.__top = H - 14 * MM; return p; };
    const p1 = add();
    let y = H - 16 * MM;
    text(p1, 'Drošības noteikumu instruktāžas veidlapa', W / 2, y, { font: F.b, size: 16, align: 'center' }); y -= 24;
    if (ev.title) text(p1, ev.title, W / 2, y + 3, { font: F.b, size: 12.5, align: 'center' });
    line(p1, M + 20, y, W - M - 20, y, 0.7); y -= 11;
    text(p1, '(nodarbības vai pasākuma nosaukums)', W / 2, y, { font: F.i, size: 8.5, align: 'center' }); y -= 16;
    const w1 = text(p1, 'dalībnieku iepazīstināšana', M, y, { font: F.i, size: 11, underline: true });
    text(p1, ' ar drošības noteikumiem, kas jāievēro nodarbībā vai pasākumā.', M + w1, y, { size: 11 }); y -= 20;
    const when = ev.when || '';
    if (when) { text(p1, when, W - M, y, { size: 11, align: 'right', underline: true }); }
    else { text(p1, `${(ev.instrDate || U.iso()).slice(0, 4)}.gada ____________________`, W - M, y, { size: 11, align: 'right' }); }
    y -= 11; text(p1, '(nodarbības vai pasākuma norises laiks)', W - M, y, { font: F.i, size: 8.5, align: 'right' }); y -= 8;

    const date = ev.fillDates === false ? '' : fmtD(ev.instrDate);
    const cols = [{ title: 'N.p.k.', w: 13 * MM, align: 'center', bold: true }, { title: 'Vārds, Uzvārds', w: 50 * MM }, { title: '“iepazinos”', w: 24 * MM, align: 'center' },
      { title: 'Datums', w: 25 * MM, align: 'center' }, { title: 'Paraksts', w: 30 * MM }, { title: 'Piezīmes', w: cw - 142 * MM, size: 9 }];
    const rows = people.map((p, i) => [`${i + 1}.`, U.full(p), '“iepazinos”', date, '', ev.rowNote?.(p) || '']);
    // tieši tik rindu, cik dalībnieku + norādītās tukšās rindas (tukšai veidlapai — vismaz 10)
    const blank = Math.max(0, Math.min(60, Number(ev.blankRows) || 0)), totalRows = rows.length ? rows.length + blank : Math.max(10, blank);
    for (let i = rows.length; i < totalRows; i++) rows.push([`${i + 1}.`, '', '“iepazinos”', '', '', '']);
    const t = table(ctx, { page: p1, newPage: add, x: M, yTop: y, yMin: 16 * MM, cols, head: { h1: 15 }, rows, minH: 19.5, size: 10.5 });
    let page = t.page; y = t.y - 22;
    if (y < 40 * MM) { page = add(); y = page.__top - 10; }
    text(page, `Grupa: ${ev.group || ''}`, M, y, { size: 11 }); y -= 16;
    if (ev.notes) { for (const ln of ctx.wrap('Piezīmes: ' + ev.notes, F.r, 11, cw)) { text(page, ln, M, y, { size: 11 }); y -= 14; } }
    else { text(page, 'Piezīmes' + '.'.repeat(118), M, y, { size: 11 }); y -= 14; }
    y -= 14;
    text(page, `Datums: ${ev.instrDate ? fmtD(ev.instrDate) : '___.___.______'}`, M, y, { size: 11 });
    const instr = [ev.instrPosition || 'JSI', ev.instrName || ''].filter(Boolean);
    const right = W / 2 + 8;
    text(page, `${instr[0]} _____________ / ${ev.instrName || '__________________________'}`, right, y, { size: 11 });
    y -= 12;
    text(page, '(instruktāžas datums)', M, y, { font: F.i, size: 8.5 });
    text(page, '(instruktāžas veicēja amats, vārds, uzvārds, paraksts)', right, y, { font: F.i, size: 8.5 });
    pageNumbers(ctx, W);
    return doc.save();
  }

  /* =================== Nometnes žurnāls =================== */
  async function camp(ev, people, staff, counselorOf) {
    const ctx = await newDoc(`Nometnes žurnāls — ${ev.title || ''}`), { doc, F, text } = ctx;
    const W = 841.89, H = 595.28, M = 14 * MM, cw = W - 2 * M;
    const add = () => { const p = doc.addPage([W, H]); p.__top = H - 14 * MM; return p; };
    const titleLine = (p, y) => text(p, `NOMETNES  “${ev.title || '_________________'}”  ŽURNĀLS`, W / 2, y, { font: F.b, size: 12.5, align: 'center' });
    const footer = (page, y) => {
      if (y < 30 * MM) { page = add(); y = page.__top - 10; }
      text(page, `Instruktāžas datums: ${ev.instrDate ? fmtD(ev.instrDate) : ''}`, M + 8 * MM, y, { size: 11 }); y -= 18;
      const leader = staff.find(s => s.id === ev.leaderId);
      text(page, `Nometnes vadītājs: ${leader ? leader.name : 'Vārds Uzvārds'}, paraksts / _____________`, M + 8 * MM, y, { size: 11 });
    };
    const addr = x => {
      const parts = [];
      if (x.addressDeclared) parts.push(x.addressDeclared);
      if (x.addressActual && U.norm(x.addressActual) !== U.norm(x.addressDeclared || '')) parts.push('fakt.: ' + x.addressActual);
      const ph = x.phone ? U.prettyPhone ? U.prettyPhone(x.phone) : x.phone : '';
      return [parts.join('; '), ph].filter(Boolean).join(', tālr. ');
    };
    // --- Darbinieki ---
    const p1 = add(); let y = H - 22 * MM;
    titleLine(p1, y); y -= 20; text(p1, 'Darbinieki', W / 2, y, { font: F.b, size: 10.5, align: 'center' }); y -= 12;
    const sigW = (cw - 157 * MM) / 3;
    const sCols = [{ title: 'N.P.K.', w: 13 * MM, align: 'center', bold: true }, { title: 'Vārds Uzvārds', w: 42 * MM }, { title: 'Personas kods', w: 27 * MM, align: 'center' },
      { title: 'Amats nometnē', w: 22 * MM, align: 'center' }, { title: 'Deklarētās un faktiskās dzīvesvietas adrese, tālruņa numurs', w: 53 * MM, size: 9 },
      { title: 'Darba kārtības noteikumiem', w: sigW }, { title: 'Iekšējās kārtības noteikumiem', w: sigW }, { title: 'Darba drošības un ugunsdrošības noteikumiem', w: sigW }];
    const sRows = staff.filter(s => (ev.staff || []).includes(s.id)).map((s, i) => [`${i + 1}.`, s.name, s.personalCode || '', s.role || '', addr({ addressDeclared: s.address, phone: s.phone }), '', '', '']);
    const sTotal = sRows.length ? sRows.length : 3;   // ja darbinieki nav izvēlēti — 3 tukšas rindas aizpildīšanai ar roku
    for (let i = sRows.length; i < sTotal; i++) sRows.push([`${i + 1}.`, '', '', '', '', '', '', '']);
    let t = table(ctx, { page: p1, newPage: add, x: M, yTop: y, yMin: 18 * MM, cols: sCols, head: { h1: 16, h2: 34, groups: [{ from: 5, to: 7, title: 'Paraksts par iepazīšanos ar nometnes' }] }, rows: sRows, minH: 21, size: 9.5 });
    footer(t.page, t.y - 24);
    // --- Dalībnieki ---
    const p2 = add(); y = H - 22 * MM;
    titleLine(p2, y); y -= 20; text(p2, 'Dalībnieki', W / 2, y, { font: F.b, size: 10.5, align: 'center' }); y -= 12;
    const sig2 = (cw - 207 * MM) / 2;
    const pCols = [{ title: 'N.P.K.', w: 13 * MM, align: 'center', bold: true }, { title: 'Vārds Uzvārds', w: 36 * MM }, { title: 'Dzimšanas datums un gads', w: 22 * MM, align: 'center' },
      { title: 'Deklarētās un faktiskās dzīvesvietas adrese, tālruņa numurs', w: 62 * MM, size: 8.8 }, { title: 'Likumisko pārstāvju vārds, uzvārds, kontakttālrunis', w: 44 * MM, size: 8.8 },
      { title: 'Audzinātājs nometnē / piezīmes', w: 30 * MM, size: 9 }, { title: 'Iekšējās kārtības noteikumiem', w: sig2 }, { title: 'drošības noteikumiem', w: sig2 }];
    const parents = p => [[p.parentName, p.parentPhone && (U.prettyPhone ? U.prettyPhone(p.parentPhone) : p.parentPhone)], [p.parent2Name, p.parent2Phone && (U.prettyPhone ? U.prettyPhone(p.parent2Phone) : p.parent2Phone)]]
      .filter(([n, t]) => n || t).map(([n, t]) => [n, t].filter(Boolean).join(', ')).join('; ');
    const pRows = people.map((p, i) => [`${i + 1}.`, U.full(p), fmtD(p.birth), addr(p), parents(p), [counselorOf(p), ev.noteOf?.(p)].filter(Boolean).join('; '), '', '']);
    const pBlank = Math.max(0, Math.min(60, Number(ev.blankRows) || 0)), pTotal = pRows.length ? pRows.length + pBlank : Math.max(10, pBlank);
    for (let i = pRows.length; i < pTotal; i++) pRows.push([`${i + 1}.`, '', '', '', '', '', '', '']);
    t = table(ctx, { page: p2, newPage: add, x: M, yTop: y, yMin: 16 * MM, cols: pCols, head: { h1: 26, h2: 34, groups: [{ from: 6, to: 7, title: 'Paraksts par iepazīšanos ar nometnes' }] }, rows: pRows, minH: 30, size: 9.5 });
    footer(t.page, t.y - 24);
    pageNumbers(ctx, W);
    return doc.save();
  }

  CP.pdf = { load, instruction, camp };
})(window.CP);
