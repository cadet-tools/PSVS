/* =====================================================================
   Jaunsarga kopsavilkums (PDF ar diagrammām) — jaunsargam vai vecākiem.
   • Viena persona: personas kartītē (⋯ izvēlne un kartīte “Pārskatā”).
   • Vairākas personas: Veidlapas → “＋ Jaunsarga kopsavilkums” — katrai personai SAVS PDF.
   • Periods no–līdz (ātrās izvēles: šis / iepriekšējais mācību gads).
   • Sadaļas (izvēle saglabājas — settings.summary): apmeklējums pa mēnešiem, dalība pasākumos
     un nometnēs, kvalifikācijas un nozīmītes, VFS rezultāti un dinamika, instruktora komentārs.
   • Komentārs: kopīgs teksts visiem + katram savs (p.summaryComment, atceras).
   • Galvenē tikai vārds un uzvārds (bez personas koda, adreses, kontaktiem).
   • Saglabā katras personas dokumentu mapē (kategorija “Kopsavilkums”) un — vairākiem — ZIP lejupielāde.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const ic = (n, f = '') => CP.ic(n, f);
  const KIND = 'Kopsavilkums';
  const SECS = [['att', 'Nodarbību apmeklējums (diagramma pa mēnešiem)'], ['events', 'Dalība pasākumos un nometnēs'], ['quals', 'Kvalifikācijas un nozīmītes'], ['vfs', 'VFS testu rezultāti un dinamika'], ['comment', 'Instruktora komentārs']];
  const PRESENT = new Set(['+', 'k']), ABSENT = new Set(['n']), EXCUSED = new Set(['a', 's']);
  const MON = ['janv.', 'febr.', 'marts', 'apr.', 'maijs', 'jūn.', 'jūl.', 'aug.', 'sept.', 'okt.', 'nov.', 'dec.'];
  const cfg = () => { const s = S.db.settings; s.summary = s.summary || {}; const c = s.summary; c.inc = c.inc || { att: true, events: true, quals: true, vfs: true, comment: true }; c.intro = c.intro ?? ''; if (c.unit == null) c.unit = true; return c; };
  const isLesson = s => !s.type || s.type === 'Nodarbība';

  /* ---------------- Dati vienai personai periodā ---------------- */
  function gather(p, from, to) {
    const inR = d => { d = String(d || '').slice(0, 10); return d && d >= from && d <= to; };
    const today = U.iso(), end = to < today ? to : today;
    // nodarbības: personas grupa attiecīgajā mācību gadā (vai visa vienība)
    const lessons = (S.db.sessions || []).filter(s => isLesson(s) && s.date >= from && s.date <= end && (s.group === '*' || s.group === D.groupOf(p, s.yearId || U.schoolYear(s.date + 'T12:00:00'))))
      .sort((a, b) => a.date.localeCompare(b.date));
    let pr = 0, ab = 0, ex = 0; const months = new Map();
    for (const s of lessons) {
      const c = s.att?.[p.id] || '', k = s.date.slice(0, 7);
      if (!months.has(k)) months.set(k, { k, pr: 0, ab: 0, ex: 0, n: 0 });
      const m = months.get(k); m.n++;
      if (PRESENT.has(c)) { pr++; m.pr++; } else if (ABSENT.has(c)) { ab++; m.ab++; } else if (EXCUSED.has(c)) { ex++; m.ex++; }
    }
    // mēneši bez nodarbībām perioda iekšienē arī redzami (tukši)
    const mlist = [];
    if (lessons.length) {
      let [y, m] = lessons[0].date.slice(0, 7).split('-').map(Number); const [y2, m2] = lessons.at(-1).date.slice(0, 7).split('-').map(Number);
      while (y < y2 || (y === y2 && m <= m2)) { const k = `${y}-${String(m).padStart(2, '0')}`; mlist.push(months.get(k) || { k, pr: 0, ab: 0, ex: 0, n: 0 }); if (++m > 12) { m = 1; y++; } }
    }
    const att = { present: pr, absent: ab, excused: ex, total: lessons.length, pct: pr + ab ? Math.round(pr / (pr + ab) * 100) : null, months: mlist.map(x => ({ ...x, label: MON[+x.k.slice(5) - 1], pct: x.pr + x.ab ? Math.round(x.pr / (x.pr + x.ab) * 100) : null })) };
    // pasākumi un nometnes (Apmeklējums + Veidlapas; viens pasākums — vienreiz)
    const events = [
      ...(S.db.events || []).filter(e => (e.participants || []).some(x => x.pid === p.id) && inR(e.dateFrom || e.instrDate)).map(e => ({ date: String(e.dateFrom || e.instrDate).slice(0, 10), to: String(e.dateTo || '').slice(0, 10), type: e.type === 'camp' ? 'Nometne' : 'Pasākums', title: e.title || '' })),
      ...(S.db.sessions || []).filter(s => !isLesson(s) && PRESENT.has(s.att?.[p.id]) && inR(s.date)).map(s => ({ date: s.date, to: s.dateTo || '', type: s.type === 'Nometne' ? 'Nometne' : s.type || 'Pasākums', title: s.topic || '' }))
    ].sort((a, b) => a.date.localeCompare(b.date)).filter((x, i, arr) => arr.findIndex(y => y.date === x.date && U.norm(y.title) === U.norm(x.title)) === i);
    // kvalifikācijas: iegūtās periodā (un visas līdz perioda beigām)
    const Q = S.db.settings.quals || [];
    const quals = (p.quals || []).map(x => ({ name: Q.find(q => q.id === x.qid)?.name || '', date: String(x.date || '').slice(0, 10) })).filter(x => x.name && (!x.date || x.date <= to))
      .map(x => ({ ...x, isNew: inR(x.date) })).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    // VFS
    const V = CP.vfs, vfs = V ? (S.db.vfsTests || []).filter(t => t.res?.[p.id] && inR(t.date)).sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map(t => { const r = t.res[p.id], s = V.score(r); return { date: t.date, lvl: r.lvl || '', g: r.g || '', total: s.total, badge: s.badge, badgeName: s.badgeName, ex: V.EX.map(k => ({ k, name: V.exName ? V.exName(k, r.lvl, r.g, true) : k, val: r.v?.[k] == null ? '' : V.show(k, r.g, r.v[k]), pts: s.pts[k] })) }; }) : [];
    return { att, events, quals, vfs };
  }

  /* ---------------- PDF ---------------- */
  let FONTS = null, LOGO = null;
  async function fonts() {
    if (FONTS) return FONTS;
    const get = async n => new Uint8Array(await (await fetch(CP.VENDOR + n)).arrayBuffer());
    const [r, b, x] = await Promise.all(['pdf/Manrope_400Regular.ttf', 'pdf/Manrope_700Bold.ttf', 'pdf/Manrope_800ExtraBold.ttf'].map(get));
    FONTS = { r, b, x };
    try { LOGO = await get('brand/CADET_pdf.png'); } catch (e) { LOGO = null; }
    return FONTS;
  }
  const MM = 72 / 25.4;
  async function pdf(o) {
    const L = await CP.pdf.load(), FT = await fonts(), P = L.P;
    const doc = await P.PDFDocument.create(); doc.registerFontkit(L.fk);
    doc.setTitle(`Jaunsarga kopsavilkums — ${o.name}`); doc.setCreator('CADET PERSONĀLS'); doc.setProducer('CADET PERSONĀLS'); doc.setLanguage('lv');
    const F = { r: await doc.embedFont(FT.r, { subset: true }), b: await doc.embedFont(FT.b, { subset: true }), x: await doc.embedFont(FT.x, { subset: true }) };
    const logo = LOGO ? await doc.embedPng(LOGO).catch(() => null) : null;
    const rgb = h => P.rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
    const C = { ink: rgb('#14212b'), mut: rgb('#5f7180'), line: rgb('#dfe6ea'), soft: rgb('#f3f6f7'), brand: rgb('#5a0f0b'), brandSoft: rgb('#f7eceb'), teal: rgb('#2f9a85'), tealSoft: rgb('#e3f3ef'), warn: rgb('#d98a1c'), bad: rgb('#c8463d'), grey: rgb('#b8c3ca'),
      z: rgb('#c9a227'), s: rgb('#8e9aa3'), b: rgb('#b0703a'), white: rgb('#ffffff') };
    const clean = s => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/[^ -ſ‐-‧‰‹›€№™·]/g, '');
    const W = 595.28, H = 841.89, M = 16 * MM, CW = W - 2 * M;
    const width = (t, f, s) => f.widthOfTextAtSize(clean(t), s);
    const text = (pg, t, x, y, { f = F.r, s = 10, c = C.ink, align } = {}) => { const str = clean(t), w = width(str, f, s); pg.drawText(str, { x: align === 'right' ? x - w : align === 'center' ? x - w / 2 : x, y, size: s, font: f, color: c }); return w; };
    function wrap(t, f, s, w) {
      const out = [];
      for (const para of clean(t).split(/\n/)) {
        let line = '';
        for (let word of para.split(/\s+/).filter(Boolean)) {
          const c = line ? line + ' ' + word : word;
          if (width(c, f, s) <= w) { line = c; continue; }
          if (line) { out.push(line); line = ''; }
          while (width(word, f, s) > w) {   // ļoti garš vārds — dala pa burtiem
            let k = 1; while (k < word.length && width(word.slice(0, k + 1), f, s) <= w) k++;
            out.push(word.slice(0, k)); word = word.slice(k);
          }
          line = word;
        }
        out.push(line);
      }
      return out;
    }
    const rect = (pg, x, y, w, h, color, o = {}) => pg.drawRectangle({ x, y, width: w, height: h, color, borderColor: o.border, borderWidth: o.border ? (o.bw || 0.8) : 0, opacity: o.op ?? 1 });
    const hline = (pg, x1, x2, y, c = C.line, t = 0.7) => pg.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: t, color: c });
    let pg, y;
    const newPage = first => {
      pg = doc.addPage([W, H]);
      if (!first) { text(pg, o.name, M, H - 12 * MM, { f: F.b, s: 9, c: C.mut }); text(pg, 'Jaunsarga kopsavilkums', W - M, H - 12 * MM, { s: 9, c: C.mut, align: 'right' }); hline(pg, M, W - M, H - 14 * MM); y = H - 22 * MM; }
    };
    const need = h => { if (y - h < 22 * MM) newPage(false); };
    const section = (t, sub, min = 56) => {
      need(min); y -= 20;
      rect(pg, M, y - 2, 3.2, 15, C.brand);
      text(pg, t, M + 10, y + 1, { f: F.x, s: 13, c: C.brand });
      if (sub) text(pg, sub, W - M, y + 2, { s: 9, c: C.mut, align: 'right' });
      y -= 22;
    };
    const para = (t, { f = F.r, s = 10, c = C.ink, x = M, w = CW, lh = 1.45 } = {}) => { for (const ln of wrap(t, f, s, w)) { need(s * lh + 2); text(pg, ln, x, y - s, { f, s, c }); y -= s * lh; } };

    /* --- Galvene --- */
    newPage(true);
    rect(pg, 0, H - 6, W, 6, C.brand);
    const top = H - 13 * MM; let bottom = top;
    // labajā pusē — no kāda rīka: CADET.LV logo un zem tā “CADET PERSONĀLS”
    { const lw = 38 * MM, lh = logo ? lw * logo.height / logo.width : 0;
      if (logo) pg.drawImage(logo, { x: W - M - lw, y: top - lh, width: lw, height: lh });
      text(pg, 'CADET PERSONĀLS', W - M - (logo ? lw * 0.03 : 0), top - lh - 9, { f: F.b, s: 7.5, c: C.mut, align: 'right' });
      bottom = Math.min(bottom, top - lh - 12); }
    // kreisajā pusē — vienības logo un nosaukums (ja izvēlēts)
    if (o.unit) {
      const ul = o.unit.logo ? await doc.embedPng(o.unit.logo).catch(() => null) : null;
      const uh = 17 * MM, uw = ul ? Math.min(34 * MM, uh * ul.width / ul.height) : 0, uhh = ul ? uw * ul.height / ul.width : 0;
      if (ul) pg.drawImage(ul, { x: M, y: top - uhh, width: uw, height: uhh });
      if (o.unit.name) {
        const nx = M + (ul ? uw + 10 : 0), maxW = W - M - 38 * MM - 14 - nx, all = wrap(o.unit.name, F.x, 12.5, maxW), lines = all.slice(0, 3);
        if (all.length > 3) { let l = lines[2]; while (l && width(l + '…', F.x, 12.5) > maxW) l = l.slice(0, -1); lines[2] = l + '…'; }
        const blockH = lines.length * 15, y0 = ul ? top - uhh / 2 + blockH / 2 - 11 : top - 11;
        lines.forEach((ln, i) => text(pg, ln, nx, y0 - i * 15, { f: F.x, s: 12.5, c: C.ink }));
        bottom = Math.min(bottom, y0 - (lines.length - 1) * 15 - 6);
      }
      if (ul) bottom = Math.min(bottom, top - uhh);
    }
    y = Math.min(bottom - 26, H - 20 * MM);
    text(pg, 'JAUNSARGA KOPSAVILKUMS', M, y, { f: F.b, s: 9.5, c: C.brand }); y -= 30;
    text(pg, o.name, M, y, { f: F.x, s: 26, c: C.ink }); y -= 20;
    text(pg, `Periods: ${o.periodText}`, M, y, { s: 10.5, c: C.mut }); y -= 14;
    hline(pg, M, W - M, y, C.line, 1); y -= 16;

    /* --- Galvenie rādītāji --- */
    const d = o.data, tiles = [];
    if (o.inc.att) tiles.push([d.att.pct == null ? '—' : d.att.pct + '%', 'apmeklējums', d.att.total ? `${d.att.present} no ${d.att.present + d.att.absent} nodarbībām` : 'nodarbību nav', C.teal]);
    if (o.inc.events) tiles.push([String(d.events.length), d.events.length === 1 ? 'pasākums / nometne' : 'pasākumi un nometnes', d.events.filter(e => e.type === 'Nometne').length ? `t. sk. ${d.events.filter(e => e.type === 'Nometne').length} nometnes` : 'periodā', C.brand]);
    if (o.inc.quals) tiles.push([String(d.quals.filter(q => q.isNew).length), 'jaunas kvalifikācijas', `kopā ${d.quals.length}`, C.warn]);
    if (o.inc.vfs) { const lv = d.vfs.at(-1); tiles.push([lv?.total != null ? String(lv.total) : '—', 'VFS punkti (no 60)', lv ? (lv.badgeName ? 'nozīmīte: ' + lv.badgeName.toLowerCase() : `tests ${U.fmtDate(lv.date)}`) : 'testu nav', lv?.badge ? C[lv.badge] : C.mut]); }
    if (tiles.length) {
      const g = 8, tw = (CW - g * (tiles.length - 1)) / tiles.length, th = 62;
      tiles.forEach(([v, l, sub, col], i) => {
        const x = M + i * (tw + g);
        rect(pg, x, y - th, tw, th, C.soft); rect(pg, x, y - th, tw, 3, col);
        text(pg, v, x + 10, y - 30, { f: F.x, s: 22, c: col });
        text(pg, l, x + 10, y - 44, { f: F.b, s: 8.5, c: C.ink });
        text(pg, sub, x + 10, y - 55, { s: 7.8, c: C.mut });
      });
      y -= th + 8;
    }
    if (o.intro) { y -= 6; para(o.intro, { s: 10.5, c: C.ink }); y -= 2; }

    /* --- Apmeklējums --- */
    if (o.inc.att) {
      section('Nodarbību apmeklējums', d.att.total ? `bija ${d.att.present} · nebija ${d.att.absent}${d.att.excused ? ` · attaisnoti ${d.att.excused}` : ''}` : '', d.att.months.length ? 200 : 56);
      if (!d.att.months.length) para('Periodā nodarbību apmeklējums nav atzīmēts.', { c: C.mut });
      else {
        const ch = 120, x0 = M + 26, cw = CW - 26, ms = d.att.months, bw = Math.min(34, cw / ms.length * 0.62);
        need(ch + 34);
        const base = y - ch;
        for (const v of [0, 25, 50, 75, 100]) { const yy = base + ch * v / 100; hline(pg, x0, x0 + cw, yy, v ? C.line : C.grey, v ? 0.5 : 0.8); text(pg, v + '%', x0 - 5, yy - 3, { s: 7.5, c: C.mut, align: 'right' }); }
        ms.forEach((m, i) => {
          const cx = x0 + (i + 0.5) * cw / ms.length;
          if (m.pct != null) {
            const h = Math.max(1.5, ch * m.pct / 100), col = m.pct >= 75 ? C.teal : m.pct >= 50 ? C.warn : C.bad;
            rect(pg, cx - bw / 2, base, bw, h, col);
            text(pg, m.pct + '%', cx, base + h + 4, { f: F.b, s: 8, c: C.ink, align: 'center' });
          } else text(pg, '—', cx, base + 4, { s: 8, c: C.mut, align: 'center' });
          if (ms.length <= 14 || i % 2 === 0) {
            text(pg, m.label + (m.k.slice(5) === '01' || i === 0 ? ' ' + m.k.slice(2, 4) : ''), cx, base - 11, { s: 7.8, c: C.mut, align: 'center' });
            text(pg, `${m.pr}/${m.pr + m.ab}`, cx, base - 21, { s: 6.8, c: C.grey, align: 'center' });
          }
        });
        y = base - 32;
        text(pg, 'Stabiņš — apmeklēto nodarbību % mēnesī (attaisnotie kavējumi netiek ieskaitīti); zem tā — bija / atzīmētas nodarbības.', M, y, { s: 7.5, c: C.mut }); y -= 10;
      }
    }

    /* --- Pasākumi --- */
    if (o.inc.events) {
      section('Dalība pasākumos un nometnēs', d.events.length ? `${d.events.length}` : '');
      if (!d.events.length) para('Periodā dalība pasākumos vai nometnēs nav reģistrēta.', { c: C.mut });
      for (const e of d.events) {
        const lines = wrap(e.title || e.type, F.r, 10, CW - 150), h = Math.max(20, lines.length * 13 + 8);
        need(h);
        const dt = U.fmtDate(e.date) + (e.to && e.to !== e.date ? '–' + U.fmtDate(e.to).slice(0, 5) : '');
        text(pg, dt, M, y - 13, { s: 9, c: C.mut });
        const tagW = width(e.type, F.b, 8) + 12, camp = e.type === 'Nometne';
        rect(pg, M + 88, y - 16, tagW, 14, camp ? C.brandSoft : C.tealSoft);
        text(pg, e.type, M + 94, y - 12.5, { f: F.b, s: 8, c: camp ? C.brand : C.teal });
        lines.forEach((ln, i) => text(pg, ln, M + 150, y - 13 - i * 13, { s: 10 }));
        y -= h; hline(pg, M, W - M, y + 3);
      }
    }

    /* --- Kvalifikācijas --- */
    if (o.inc.quals) {
      section('Kvalifikācijas un nozīmītes', d.quals.length ? `periodā iegūtas ${d.quals.filter(q => q.isNew).length}` : '');
      if (!d.quals.length) para('Kvalifikāciju vēl nav.', { c: C.mut });
      else {
        let x = M; need(26);
        for (const q of d.quals) {
          const lbl = q.name + (q.date ? '  ' + U.fmtDate(q.date) : ''), w = Math.min(CW, width(q.name, F.b, 9) + (q.date ? width('  ' + U.fmtDate(q.date), F.r, 8) : 0) + 20);
          if (x + w > W - M) { x = M; y -= 24; need(26); }
          const col = /zelts/i.test(q.name) ? C.z : /sudrab/i.test(q.name) ? C.s : /bronz/i.test(q.name) ? C.b : q.isNew ? C.teal : C.grey;
          rect(pg, x, y - 18, w, 18, q.isNew ? C.tealSoft : C.soft, { border: col, bw: 0.9 });
          rect(pg, x, y - 18, 4, 18, col);
          const tw = text(pg, q.name, x + 10, y - 12.5, { f: F.b, s: 9 });
          if (q.date) text(pg, '  ' + U.fmtDate(q.date), x + 10 + tw, y - 12.5, { s: 8, c: C.mut });
          x += w + 6; void lbl;
        }
        y -= 30;
        if (d.quals.some(q => !q.isNew)) { text(pg, 'Iekrāsotas — iegūtas šajā periodā; pelēkas — agrāk.', M, y, { s: 7.5, c: C.mut }); y -= 8; }
      }
    }

    /* --- VFS --- */
    if (o.inc.vfs) {
      section('Vispārējās fiziskās sagatavotības (VFS) testi', d.vfs.length ? `${d.vfs.length} ${d.vfs.length === 1 ? 'tests' : 'testi'}` : '', d.vfs.length > 1 ? 190 : 140);
      if (!d.vfs.length) para('Periodā VFS testos nav piedalījies(-usies).', { c: C.mut });
      else {
        if (d.vfs.length > 1) {   // dinamika
          const ch = 110, x0 = M + 30, cw = CW - 30 - 62, n = d.vfs.length; need(ch + 30);
          const vals = d.vfs.map(t => t.total).filter(v => v != null), lo = Math.max(0, Math.min(30, Math.floor((Math.min(...vals, 41) - 6) / 10) * 10));
          const base = y - ch, yv = v => base + ch * (v - lo) / (60 - lo), xi = i => x0 + 14 + (n === 1 ? (cw - 28) / 2 : i * (cw - 28) / (n - 1));
          for (let v = lo; v <= 60; v += 10) { hline(pg, x0, x0 + cw, yv(v), C.line, 0.5); text(pg, String(v), x0 - 5, yv(v) - 3, { s: 7.5, c: C.mut, align: 'right' }); }
          for (const [v, c, l] of [[41, C.b, 'bronza 41'], [48, C.s, 'sudrabs 48'], [54, C.z, 'zelts 54']]) { pg.drawLine({ start: { x: x0, y: yv(v) }, end: { x: x0 + cw, y: yv(v) }, thickness: 0.8, color: c, dashArray: [3, 3] }); text(pg, l, x0 + cw + 5, yv(v) - 2.5, { f: F.b, s: 7, c }); }
          const pts = d.vfs.map((t, i) => [xi(i), t.total == null ? null : yv(t.total), t]);
          for (let i = 1; i < pts.length; i++) if (pts[i][1] != null && pts[i - 1][1] != null) pg.drawLine({ start: { x: pts[i - 1][0], y: pts[i - 1][1] }, end: { x: pts[i][0], y: pts[i][1] }, thickness: 2, color: C.teal });
          for (const [x, yy, t] of pts) {
            if (yy != null) { pg.drawCircle({ x, y: yy, size: 3.6, color: t.badge ? C[t.badge] : C.teal, borderColor: C.white, borderWidth: 1 }); text(pg, String(t.total), x, yy + 7, { f: F.b, s: 8, align: 'center' }); }
            text(pg, U.fmtDate(t.date).slice(0, 5) + '.' + String(t.date).slice(2, 4), x, base - 11, { s: 7.5, c: C.mut, align: 'center' });
          }
          y = base - 24;
        }
        const t = d.vfs.at(-1), first = d.vfs.length > 1 ? d.vfs[0] : null;
        need(30 + t.ex.length * 15);
        text(pg, `Pēdējais tests ${U.fmtDate(t.date)}${t.lvl ? ` · ${t.lvl} pakāpe` : ''}`, M, y - 10, { f: F.b, s: 10 });
        if (t.badgeName) { const bw2 = width('Nozīmīte: ' + t.badgeName, F.b, 8.5) + 14; rect(pg, W - M - bw2, y - 15, bw2, 15, C[t.badge]); text(pg, 'Nozīmīte: ' + t.badgeName, W - M - bw2 + 7, y - 11, { f: F.b, s: 8.5, c: C.white }); }
        y -= 22;
        const cx = [M, M + 190, M + 260, M + 330];
        text(pg, 'Vingrinājums', cx[0], y, { f: F.b, s: 8, c: C.mut }); text(pg, 'Rezultāts', cx[1], y, { f: F.b, s: 8, c: C.mut }); text(pg, 'Punkti', cx[2], y, { f: F.b, s: 8, c: C.mut });
        if (first) text(pg, `Pirmajā testā (${U.fmtDate(first.date)})`, cx[3], y, { f: F.b, s: 8, c: C.mut });
        y -= 5; hline(pg, M, W - M, y);
        for (const e of t.ex) {
          y -= 14;
          text(pg, e.name, cx[0], y + 3, { s: 9.5 });
          text(pg, e.val || '—', cx[1], y + 3, { s: 9.5, c: e.val ? C.ink : C.mut });
          if (e.pts != null) { const bar = 50 * e.pts / 10; rect(pg, cx[2], y + 2, 50, 6, C.soft); rect(pg, cx[2], y + 2, bar, 6, e.pts >= 4 ? C.teal : C.bad); text(pg, String(e.pts), cx[2] + 56, y + 2.5, { f: F.b, s: 8.5 }); }
          if (first) { const fe = first.ex.find(x => x.k === e.k); if (fe?.val) text(pg, `${fe.val} (${fe.pts ?? '—'} p.)`, cx[3], y + 3, { s: 9, c: C.mut }); }
          hline(pg, M, W - M, y - 2.5, C.soft);
        }
        y -= 12;
        text(pg, `Kopā: ${t.total ?? '—'} punkti no 60. Nozīmītei visos 6 vingrinājumos vismaz 4 punkti: bronza 41–47, sudrabs 48–53, zelts 54+.`, M, y, { s: 7.5, c: C.mut }); y -= 8;
      }
    }

    /* --- Komentārs --- */
    if (o.inc.comment && o.comment) {
      section('Instruktora komentārs');
      const lines = wrap(o.comment, F.r, 10.5, CW - 24), h = lines.length * 15 + 16;
      if (h < 600) need(h + 4);
      const top = y;
      rect(pg, M, top - h, CW, h, C.brandSoft); rect(pg, M, top - h, 3, h, C.brand);
      y -= 12;
      for (const ln of lines) { if (y < 26 * MM) { newPage(false); } text(pg, ln, M + 14, y - 10.5, { s: 10.5 }); y -= 15; }
      y -= 8;
    }

    /* --- Paraksts --- */
    need(56); y -= 22;
    const I = o.instructor;
    text(pg, [I.name, I.position].filter(Boolean).join(', ') || 'Instruktors', M, y, { f: F.b, s: 10 });
    text(pg, '_______________________', W - M, y, { s: 10, c: C.mut, align: 'right' }); y -= 13;
    if (I.unit) { text(pg, I.unit, M, y, { s: 9, c: C.mut }); y -= 12; }
    text(pg, `Sagatavots ${U.fmtDate(U.iso())}`, M, y, { s: 8.5, c: C.mut });
    const pages = doc.getPages();
    pages.forEach((p2, i) => {
      text(p2, 'CADET PERSONĀLS · cadet.lv', M, 10 * MM, { s: 7.5, c: C.grey });
      if (pages.length > 1) text(p2, `${i + 1} / ${pages.length}`, W - M, 10 * MM, { s: 7.5, c: C.grey, align: 'right' });
    });
    return doc.save();
  }

  /* ---------------- Logs ---------------- */
  let dlg = null;   // { pids: Set, single: pid|null, group, q }
  const roster = () => D.peopleInYear().filter(p => p.status !== 'archived' && !p.anon).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
  function spanOf(which) {
    const y = D.activeYear(), [f, t] = U.yearSpan(y);
    if (which === 'prev') { const m = /^(\d{4})-(\d{4})$/.exec(y); const [pf, pt] = m ? U.yearSpan(`${+m[1] - 1}-${+m[2] - 1}`) : [f, t]; return [pf, pt]; }
    const today = U.iso(); return [f, t < today ? t : today];
  }
  const periodText = (f, t) => `${U.fmtDate(f)}.–${U.fmtDate(t)}.`;
  A.sumNew = pid => {
    if (!S.db) return;
    const [f, t] = spanOf('cur');
    const all = pid === '*';   // '*' — visiem šī gada jaunsargiem (mācību gada noslēguma vednis)
    dlg = { pids: new Set(all ? roster().map(p => p.id) : pid ? [pid] : []), single: all ? null : pid || null, group: '', q: '', from: all ? f : dlg?.from || f, to: all ? t : dlg?.to || t };
    draw(); U.$('sumDialog').showModal();
  };
  function draw() {
    let d = U.$('sumDialog'); if (!d) { d = document.createElement('dialog'); d.id = 'sumDialog'; d.className = 'wide'; document.body.appendChild(d); }
    const c = cfg(), one = dlg.single && D.person(dlg.single);
    const list = one ? [] : roster().filter(p => (!dlg.group || D.groupOf(p) === dlg.group) && (!dlg.q || U.norm(U.full(p) + ' ' + U.sortName(p)).includes(U.norm(dlg.q))));
    const n = dlg.pids.size;
    d.innerHTML = `<form><header class="dlg-head"><h2>${ic('chart')}Jaunsarga kopsavilkums${one ? ' — ' + esc(U.full(one)) : ''}</h2><button type="button" class="ghost" data-close="sumDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body sum-dlg">
        <div class="field"><label>Periods</label><div class="sum-bar"><input type="date" data-sum="from" value="${esc(dlg.from)}"> – <input type="date" data-sum="to" value="${esc(dlg.to)}">
          <button type="button" class="sm ghost" data-act="sumSpan" data-arg="cur">Šis mācību gads</button><button type="button" class="sm ghost" data-act="sumSpan" data-arg="prev">Iepriekšējais</button></div></div>
        <div class="field"><label>Iekļaut</label><div class="sum-inc">${SECS.map(([k, l]) => `<label class="check"><input type="checkbox" data-suminc="${k}" ${c.inc[k] ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div>
        <div class="field"><label>Kopīgs teksts visiem <span class="muted small">(nav obligāts; parādās zem galvenajiem rādītājiem)</span></label><textarea data-sum="intro" rows="2" data-autogrow placeholder="piem., Paldies par aizvadīto mācību gadu! Šeit apkopota tava dalība un sasniegumi.">${esc(c.intro)}</textarea></div>
        ${one ? `<div class="field"><label>Komentārs ${esc(U.full(one))}</label><textarea data-sumc="${one.id}" rows="3" data-autogrow placeholder="Ko jaunsargs paveicis, kur var augt…">${esc(one.summaryComment || '')}</textarea></div>`
        : `<div class="field"><label>Personas <span class="muted small">— katrai tiek sagatavots savs PDF; komentāru var ierakstīt pie katras</span></label>
          <div class="sum-bar" style="margin-bottom:6px"><select data-sum="group"><option value="">Visas grupas</option>${D.groups().map(g => `<option ${dlg.group === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
            <input type="search" data-sum="q" placeholder="Meklēt…" value="${esc(dlg.q)}"><button type="button" class="sm ghost" data-act="sumAll">Atzīmēt redzamos</button><button type="button" class="sm ghost" data-act="sumNone">Notīrīt</button><span class="muted small">Atzīmēti: <b>${n}</b></span></div>
          <div class="sum-list">${list.map(p => `<div class="sum-row ${dlg.pids.has(p.id) ? 'on' : ''}"><label class="check"><input type="checkbox" data-sump="${p.id}" ${dlg.pids.has(p.id) ? 'checked' : ''}> ${esc(U.sortName(p))} <small class="muted">${esc(D.groupOf(p))}</small></label>
            ${dlg.pids.has(p.id) && c.inc.comment ? `<textarea data-sumc="${p.id}" rows="1" data-autogrow placeholder="Komentārs šai personai (nav obligāts)">${esc(p.summaryComment || '')}</textarea>` : ''}</div>`).join('') || '<p class="muted small">Nav personu.</p>'}</div></div>`}
        ${CP.unit?.has() ? `<label class="check"><input type="checkbox" data-sum="unit" ${c.unit ? 'checked' : ''}> Ar vienības logo un nosaukumu${CP.unit.get().name ? ` (“${esc(CP.unit.get().name)}”)` : ''} — kopā ar CADET.LV logo</label>` : `<p class="small muted" style="margin:0">Vienības logo un nosaukumu var pievienot Iestatījumi → Pamata → Vienība.</p>`}
        <label class="check"><input type="checkbox" data-sum="save" ${S.root ? 'checked' : 'disabled'}> Saglabāt PDF katras personas dokumentu mapē (kategorija “${KIND}”)</label>
        <p class="small muted">Galvenē ir tikai vārds un uzvārds — bez personas koda, adreses un kontaktiem. ${one ? 'PDF atvērsies skatīšanai un drukāšanai.' : 'Vairākām personām — visi PDF vienā ZIP failā.'}</p>
      </div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="sumDialog">Atcelt</button><button class="mainbtn" type="submit" ${one || n ? '' : 'disabled'}>${ic('file', '📄')} Sagatavot${one ? '' : ` (${n})`}</button></footer></form>`;
    d.querySelector('form').onsubmit = e => { e.preventDefault(); run(e.target.querySelector('[type=submit]')); };
  }
  const keepScroll = fn => { const box = U.qs('#sumDialog .sum-list'), top = box?.scrollTop || 0; fn(); const b2 = U.qs('#sumDialog .sum-list'); if (b2) b2.scrollTop = top; };
  A.sumSpan = w => { [dlg.from, dlg.to] = spanOf(w); draw(); };
  A.sumAll = () => { const q = U.norm(dlg.q); for (const p of roster()) if ((!dlg.group || D.groupOf(p) === dlg.group) && (!q || U.norm(U.full(p) + ' ' + U.sortName(p)).includes(q))) dlg.pids.add(p.id); keepScroll(draw); };
  A.sumNone = () => { dlg.pids.clear(); keepScroll(draw); };
  CP.changeHandlers.push(e => {
    const t = e.target; if (!t.closest?.('#sumDialog')) return false;
    if (t.dataset.suminc) { cfg().inc[t.dataset.suminc] = t.checked; CP.store.changed({ silent: true }); if (t.dataset.suminc === 'comment') keepScroll(draw); return true; }
    if (t.dataset.sump) { if (t.checked) dlg.pids.add(t.dataset.sump); else dlg.pids.delete(t.dataset.sump); keepScroll(draw); return true; }
    const k = t.dataset.sum;
    if (k === 'from' || k === 'to') { dlg[k] = t.value; return true; }
    if (k === 'unit') { cfg().unit = t.checked; CP.store.changed({ silent: true }); return true; }
    if (k === 'group') { dlg.group = t.value; keepScroll(draw); return true; }
    if (k === 'intro') { cfg().intro = t.value; CP.store.changed({ silent: true }); return true; }
    if (t.dataset.sumc) { const p = D.person(t.dataset.sumc); if (p) { p.summaryComment = t.value; CP.store.changed({ silent: true }); } return true; }
    return false;
  });
  CP.inputHandlers.push(e => {
    const t = e.target; if (!t.closest?.('#sumDialog')) return false;
    if (t.dataset.sum === 'q') { dlg.q = t.value; const pos = t.selectionStart; keepScroll(draw); const n = U.qs('#sumDialog [data-sum="q"]'); n?.focus(); n?.setSelectionRange(pos, pos); return true; }
    if (t.dataset.sumc) { const p = D.person(t.dataset.sumc); if (p) p.summaryComment = t.value; return true; }
    if (t.dataset.sum === 'intro') { cfg().intro = t.value; return true; }
    return false;
  });

  const safe = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '');
  async function build(p, from, to) {
    const c = cfg(), I = S.db.settings.instructor || {};
    const unit = [I.parvalde && `${I.parvalde}. novada pārvalde`, I.nodala && `${I.nodala}. nodaļa`].filter(Boolean).join(', ');
    const bytes = await pdf({ name: U.full(p), periodText: periodText(from, to), inc: c.inc, intro: c.intro.trim(), unit: c.unit && CP.unit?.has() ? { name: CP.unit.get().name, logo: CP.unit.logoBytes() } : null, comment: String(p.summaryComment || '').trim(), data: gather(p, from, to), instructor: { name: I.name || '', position: I.position || '', unit } });
    return { blob: new Blob([bytes], { type: 'application/pdf' }), name: `Kopsavilkums_${safe(p.last)}_${safe(p.first)}_${from}_${to}.pdf` };
  }
  async function saveTo(p, r, from, to) {
    await CP.store.ensurePersonYearFolder(p);
    const path = await CP.store.saveFile(CP.store.yearPersonDir(p), r.name, r.blob);
    if (path) CP.docs.link(p.id, KIND, 'pdf', path, 'main', { title: `Kopsavilkums ${periodText(from, to)}`, issued: U.iso(), review: 'received', size: r.blob.size });
    return path;
  }
  async function run(btn) {
    const from = dlg.from, to = dlg.to, save = !!U.qs('#sumDialog [data-sum="save"]')?.checked && !!S.root;
    if (!from || !to || from > to) return ui.toast('Norādi pareizu periodu (no — līdz)', 'warn');
    if (!SECS.some(([k]) => cfg().inc[k])) return ui.toast('Atzīmē vismaz vienu sadaļu', 'warn');
    const people = (dlg.single ? [dlg.single] : [...dlg.pids]).map(D.person).filter(Boolean);
    if (!people.length) return;
    btn.disabled = true; const label = btn.innerHTML;
    try {
      if (people.length === 1) {
        btn.textContent = 'Sagatavo…';
        const r = await build(people[0], from, to), path = save ? await saveTo(people[0], r, from, to) : null;
        U.$('sumDialog').close(); CP.docs.showBlob(r.blob, r.name);
        if (path) { CP.store.changed(); ui.toast('Kopsavilkums saglabāts personas mapē: ' + path, 'ok', 7000); }
        return;
      }
      await CP.reader.loadScript(CP.VENDOR + 'docx/jszip.min.js');
      const zip = new window.JSZip(), fails = [];
      for (let i = 0; i < people.length; i++) {
        btn.textContent = `Sagatavo ${i + 1}/${people.length}…`;
        try { const r = await build(people[i], from, to); zip.file(r.name, r.blob); if (save) await saveTo(people[i], r, from, to); }
        catch (e) { console.error(e); fails.push(U.full(people[i])); }
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      U.download(blob, `Kopsavilkumi_${from}_${to}.zip`);
      if (save) CP.store.changed();
      U.$('sumDialog').close();
      ui.toast(`Sagatavoti ${people.length - fails.length} kopsavilkumi${save ? ' (saglabāti personu mapēs)' : ''} un lejupielādēti ZIP failā.${fails.length ? ' Neizdevās: ' + fails.join(', ') : ''}`, fails.length ? 'warn' : 'ok', 10000);
    } catch (e) { console.error(e); ui.toast('Kopsavilkumu neizdevās sagatavot: ' + e.message, 'err', 12000); }
    finally { btn.disabled = false; btn.innerHTML = label; }
  }

  /** Kartīte personas pārskatā */
  const personCard = p => p.anon ? '' : `<section class="card wide sum-card"><h3>${ic('chart')}Jaunsarga kopsavilkums</h3><div class="row"><p class="small grow" style="margin:0">PDF ar diagrammām jaunsargam vai vecākiem: apmeklējums, pasākumi un nometnes, kvalifikācijas, VFS rezultāti un tavs komentārs — par izvēlētu periodu.${(S.db.documents || []).some(d => d.personId === p.id && d.kind === KIND) ? ' Iepriekšējie kopsavilkumi — cilnē Dokumenti.' : ''}</p><button class="sm mainbtn" data-act="sumNew" data-arg="${p.id}">${ic('file', '📄')} Sagatavot kopsavilkumu…</button></div></section>`;
  CP.summary = { gather, pdf, build, personCard, KIND };
})(window.CP);
