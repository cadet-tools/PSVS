/* =====================================================================
   Dokumentu lasītājs
   ---------------------------------------------------------------------
   1) Ielāde → vienots dokumenta modelis:
        { kind: 'pdf'|'image'|'docx', pages: [canvas], html, words: [...], source }
      vārds = { t (teksts), n (normalizēts), p (lapa), x0,y0,x1,y1 (0..1), conf, blk }
      • PDF ar teksta slāni (aizpildīts datorā, saglabāts PDF) → teksts precīzi, bez OCR
      • DOCX (aizpildīts Word) → teksts no dokumenta struktūras, bez OCR
      • eDoc / ASiC-E → tiek atvērts konteinerī esošais PDF vai DOCX
      • Attēls vai skenēts PDF → teksts no atpazīšanas (OCR)
   2) Lauku nolasīšana pēc ETIĶETĒM un IZKĀRTOJUMA, nevis fiksētām koordinātām:
        'right'   — vērtība pa labi no etiķetes tajā pašā rindā
        'between' — starp divām etiķetēm (piem., “Personas” … “kods”)
        'below'   — rindas zem etiķetes līdz nākamajai etiķetei
        'above'   — rinda virs paraksta (piem., virs “(vārds, uzvārds)”)
        'code'    — personas koda formāts jebkur sadaļā
        'checkbox'— atzīmēta izvēles rūtiņa (☒) pie teksta
      Tāpēc anketas versijas var atšķirties pēc izkārtojuma — svarīgas ir etiķetes.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util;
  const R = {};
  const PDFJS_URL = CP.VENDOR + 'pdfjs/pdf.min.js';
  const PDFJS_WORKER = CP.VENDOR + 'pdfjs/pdf.worker.min.js';

  /* =================== Ielāde =================== */
  R.accept = '.pdf,.docx,.edoc,.asice,.bdoc,image/*';
  R.load = async (file, onProgress) => {
    const name = (file.name || '').toLowerCase();
    if (/\.(edoc|asice|bdoc)$/.test(name)) {
      const z = await U.unzip(await file.arrayBuffer(), n => !/^META-INF\//i.test(n) && /\.(pdf|docx|jpe?g|png)$/i.test(n));
      const inner = [...z.keys()].sort((a, b) => rank(a) - rank(b))[0];
      if (!inner) throw Error('eDoc konteinerī nav atrasts PDF, DOCX vai attēls');
      const bytes = await z.get(inner)(), innerName = inner.split('/').pop();
      const doc = await R.load(new File([bytes], innerName, { type: mime(innerName) }), onProgress);
      doc.container = 'edoc'; doc.innerName = innerName; return doc;
    }
    if (/\.docx$/.test(name)) return loadDocx(file);
    if (file.type === 'application/pdf' || /\.pdf$/.test(name)) return loadPdf(file, onProgress);
    if (/^image\//.test(file.type) || /\.(jpe?g|png|webp|bmp|gif|tiff?|heic)$/.test(name)) return { kind: 'image', pages: await CP.ocr.imageToPages(file), words: [], source: 'none' };
    if (/\.doc$/.test(name)) throw Error('Vecais .doc formāts netiek atbalstīts — saglabā Word kā .docx vai PDF');
    throw Error('Neatbalstīts faila tips. Der PDF, DOCX, eDoc un attēli.');
  };
  const rank = n => /\.pdf$/i.test(n) ? 0 : /\.docx$/i.test(n) ? 1 : 2;
  const mime = n => /\.pdf$/i.test(n) ? 'application/pdf' : /\.png$/i.test(n) ? 'image/png' : /\.jpe?g$/i.test(n) ? 'image/jpeg' : '';

  const scripts = {};
  R.loadScript = src => scripts[src] || (scripts[src] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res;
    s.onerror = () => { delete scripts[src]; s.remove(); rej(Error('Neizdevās ielādēt lokālo bibliotēku. Pārbaudi, vai mape vendor atrodas blakus index.html.')); };
    document.head.appendChild(s);
  }));

  /* --- PDF: lapas skatīšanai + teksta slānis (ja ir) --- */
  async function loadPdf(file, onProgress) {
    await R.loadScript(PDFJS_URL);
    const raw = await file.arrayBuffer();
    const open = disableWorker => window.pdfjsLib.getDocument({ data: raw.slice(0), disableWorker }).promise;
    let pdf;
    if (location.protocol === 'file:') pdf = await open(true);
    else {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(PDFJS_WORKER, window.location.href).href;
      try { pdf = await open(false); } catch (e) { pdf = await open(true); }
    }
    const pages = [], words = [], n = Math.min(pdf.numPages, 8);
    for (let i = 1; i <= n; i++) {
      onProgress?.(`Atver lapu ${i}/${n}`, (i - 1) / n);
      const pg = await pdf.getPage(i), vp1 = pg.getViewport({ scale: 1 });
      const vp = pg.getViewport({ scale: Math.min(3.5, 2800 / Math.max(vp1.width, vp1.height)) });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: ctx, viewport: vp }).promise; pages.push(c);
      const tc = await pg.getTextContent();
      for (const it of tc.items) {
        if (!it.str || !it.str.trim()) continue;
        const [a, b, cc, d, e, f] = it.transform, fh = Math.hypot(cc, d) || Math.hypot(a, b) || 10;
        const [x, y] = vp1.convertToViewportPoint(e, f), w = it.width || fh * it.str.length * 0.5, L = it.str.length;
        for (const m of it.str.matchAll(/\S+/g)) {
          const x0 = x + w * m.index / L, x1 = x + w * (m.index + m[0].length) / L;
          words.push(mkWord(m[0], i - 1, x0 / vp1.width, (y - fh * 0.85) / vp1.height, x1 / vp1.width, (y + fh * 0.2) / vp1.height, 100));
        }
      }
    }
    return { kind: 'pdf', pages, words, source: words.length > 15 ? 'text' : 'none', pageCount: pdf.numPages };
  }

  /* --- DOCX: struktūra → HTML skatīšanai + vārdi ar sintētisku izkārtojumu (rinda = y, šūna = x) --- */
  async function loadDocx(file) {
    const z = await U.unzip(await file.arrayBuffer(), n => n === 'word/document.xml');
    if (!z.has('word/document.xml')) throw Error('DOCX failā nav dokumenta satura');
    const xml = new DOMParser().parseFromString(new TextDecoder().decode(await z.get('word/document.xml')()), 'application/xml');
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const kids = (el, name) => [...el.childNodes].filter(c => c.nodeType === 1 && c.localName === name && c.namespaceURI === W);
    const runText = p => {
      let s = '';
      const walk = el => { for (const c of el.childNodes) { if (c.nodeType !== 1) continue; const ln = c.localName;
        if (ln === 't') s += c.textContent; else if (ln === 'tab') s += '\t'; else if (ln === 'br') s += ' ';
        else if (ln === 'sym') s += /^(F0FE|F078|F0FD|F054|2612|2611)$/i.test(c.getAttributeNS(W, 'char') || '') ? '☒' : '☐';
        else if (ln !== 'rPr' && ln !== 'pPr' && ln !== 'instrText' && ln !== 'del') walk(c); } };
      walk(p); return s;
    };
    const rows = []; let html = '';
    const esc = U.esc;
    const pHtml = (text, p) => { const jc = p.getElementsByTagNameNS(W, 'jc')[0]?.getAttributeNS(W, 'val'); const bold = !!p.getElementsByTagNameNS(W, 'b')[0]; return `<p style="${jc === 'center' ? 'text-align:center;' : jc === 'right' ? 'text-align:right;' : ''}${bold ? 'font-weight:700;' : ''}">${esc(text.replace(/\t/g, '    ')) || '&nbsp;'}</p>`; };
    function block(el) {
      for (const c of el.childNodes) {
        if (c.nodeType !== 1 || c.namespaceURI !== W) continue;
        if (c.localName === 'p') { const t = runText(c); const r = rows.length; rows.push({ cells: [t] }); html += `<div class="dx-blk" data-blk="${r}">${pHtml(t, c)}</div>`; }
        else if (c.localName === 'tbl') {
          html += '<table class="dx-tbl">';
          for (const tr of kids(c, 'tr')) {
            const cells = kids(tr, 'tc').map(tc => kids(tc, 'p').map(runText).join(' '));
            const r = rows.length; rows.push({ cells });
            html += `<tr class="dx-blk" data-blk="${r}">${kids(tr, 'tc').map(tc => `<td>${kids(tc, 'p').map(p => pHtml(runText(p), p)).join('')}</td>`).join('')}</tr>`;
          }
          html += '</table>';
        } else if (c.localName === 'sdt') { const sc = c.getElementsByTagNameNS(W, 'sdtContent')[0]; if (sc) block(sc); }
      }
    }
    block(xml.getElementsByTagNameNS(W, 'body')[0]);
    // Sintētiskas koordinātas: katra rinda — josla, katra šūna — kolonna
    const N = Math.max(rows.length, 1), words = [];
    rows.forEach((row, r) => {
      const nC = row.cells.length;
      row.cells.forEach((text, ci) => {
        const t = text.replace(/\t/g, ' '), L = Math.max(t.length, 1), cx0 = ci / nC, cw = 1 / nC;
        for (const m of t.matchAll(/\S+/g)) words.push({ ...mkWord(m[0], 0, cx0 + cw * m.index / L, r / N, cx0 + cw * (m.index + m[0].length) / L, (r + 0.7) / N, 100), blk: r });
      });
    });
    return { kind: 'docx', html, words, source: 'docx', pages: [] };
  }

  function mkWord(t, p, x0, y0, x1, y1, conf) { return { t, n: U.norm(t), p, x0, y0, x1, y1, conf }; }
  R.mkWord = mkWord;

  /* =================== Rindas un enkuri =================== */
  /** Sagrupē vārdus rindās (pēc lapas un vertikālā centra) */
  R.lines = words => {
    const sorted = words.filter(w => w.n || /[☐☒☑✓✔]/.test(w.t)).slice().sort((a, b) => a.p - b.p || (a.y0 + a.y1) - (b.y0 + b.y1));
    const lines = [];
    for (const w of sorted) {
      const yc = (w.y0 + w.y1) / 2, h = w.y1 - w.y0;
      const L = lines.find(l => l.p === w.p && Math.abs(l.yc - yc) < Math.max(h, l.h) * 0.55 && (w.blk === undefined || l.blk === w.blk));
      if (L) { L.words.push(w); L.yc = (L.yc * (L.words.length - 1) + yc) / L.words.length; L.h = Math.max(L.h, h); }
      else lines.push({ p: w.p, yc, h, blk: w.blk, words: [w] });
    }
    for (const l of lines) {
      l.words.sort((a, b) => a.x0 - b.x0);
      l.x0 = Math.min(...l.words.map(w => w.x0)); l.x1 = Math.max(...l.words.map(w => w.x1));
      l.y0 = Math.min(...l.words.map(w => w.y0)); l.y1 = Math.max(...l.words.map(w => w.y1));
      l.text = l.words.map(w => w.t).join(' ');
      // normalizētā rinda un katra vārda pozīcija tajā — enkuru meklēšanai
      let s = ''; l.spans = l.words.map(w => { if (!w.n) return [-1, -1]; if (s) s += ' '; const a = s.length; s += w.n; return [a, s.length]; });
      l.norm = s; l.conf = Math.min(...l.words.map(w => w.conf ?? 100));
    }
    lines.sort((a, b) => a.p - b.p || a.yc - b.yc);
    lines.forEach((l, i) => l.i = i);
    return lines;
  };
  const gy = (p, y) => p + y;
  function findAnchors(lines, re, opts = {}) {
    const out = [], g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    for (const l of lines) {
      for (const m of l.norm.matchAll(g)) {
        if (opts.notBefore && opts.notBefore.test(l.norm.slice(Math.max(0, m.index - 10), m.index))) continue;
        const ws = l.words.filter((w, k) => l.spans[k][0] >= 0 && l.spans[k][1] > m.index && l.spans[k][0] < m.index + m[0].length);
        if (!ws.length) continue;
        out.push({ p: l.p, line: l, words: ws, x0: Math.min(...ws.map(w => w.x0)), x1: Math.max(...ws.map(w => w.x1)), y0: Math.min(...ws.map(w => w.y0)), y1: Math.max(...ws.map(w => w.y1)), g0: gy(l.p, Math.min(...ws.map(w => w.y0))), g1: gy(l.p, Math.max(...ws.map(w => w.y1))) });
      }
    }
    return out;
  }

  /* =================== Anketu profili =================== */
  // Jaunsardzes “Iesniegums – anketa dalībai Jaunsardzē” (2021. gada noteikumu pielikums un līdzīgas versijas)
  const CODE = [{ m: 'code' }, { m: 'between', a: /\bpersonas\b/, b: /\bkods\b/, need: true }];
  const PERSON_BLOCK = sec => [
    { f: sec ? 'parentCode' : 'personalCode', sec, try: CODE },
    { f: sec ? 'parentAddressDeclared' : 'addressDeclared', sec, try: [{ m: 'below', a: /dzivesvietas adrese deklaret|deklaret\S* (dzivesvietas )?adrese/ }] },
    { f: sec ? 'parentAddressActual' : 'addressActual', sec, try: [{ m: 'below', a: /faktisk\S* (dzivesvietas )?adrese/ }] },
    { f: sec ? 'parentPhone' : 'phone', sec, try: [{ m: 'between', a: /\btalrunis\b|\btalr\b/, b: /\be ?pasts\b/ }] },
    { f: sec ? 'parentEmail' : 'email', sec, try: [{ m: 'right', a: /\be ?pasts\b/ }, { m: 'below', a: /\be ?pasts\b/ }] }
  ];
  const JAUNSARDZE = {
    id: 'jaunsardze', name: 'Jaunsardzes iesniegums-anketa',
    detect: /iesniegums anketa|dalibai jaunsardz|iestaties jaunsardz/,
    sections: [['parent', /aizpilda berna likumiskais parstavis|likumiska parstavja personas dati/], ['emergency', /arkartas kontaktperson/]],
    rules: [
      { f: '_name', sec: '', try: [{ m: 'between', a: /^es\b/, b: /velos brivpratigi iestaties jaunsardz\S*|velos\b/ }, { m: 'above', a: /vards uzvard/, notBefore: /berna\s*$/ }] },
      ...PERSON_BLOCK(''),
      { f: 'school', sec: '', try: [{ m: 'right', a: /macibu iestades nosaukums|macibu iestade/ }, { m: 'below', a: /macibu iestades nosaukums|macibu iestade/ }] },
      { f: 'schoolClass', sec: '', try: [{ m: 'right', a: /klase kurss vai grupa|klase kurss|\bklase\b/ }] },
      { f: 'parentName', sec: 'parent', try: [{ m: 'above', a: /vards uzvard/, notBefore: /berna\s*$/, last: true }, { m: 'between', a: /^es\b/, b: /piekritu/ }] },
      { f: '_name2', sec: 'parent', try: [{ m: 'above', a: /berna vards uzvards/ }] },
      ...PERSON_BLOCK('parent'),
      { f: 'emergencyName', sec: 'emergency', try: [{ m: 'above', a: /vards uzvard/ }, { m: 'right', a: /arkartas kontaktpersona/ }, { m: 'below', a: /arkartas kontaktpersona/ }] },
      { f: 'emergencyPhone', sec: 'emergency', try: [{ m: 'between', a: /\btalrunis\b|\btalr\b/, b: /radniecib/ }] },
      { f: 'emergencyRelation', sec: 'emergency', try: [{ m: 'right', a: /radniecib/ }] }
    ],
    // Papildu teksti, kas nav vērtības (lai tos neieliktu laukos un lai “below” zinātu, kur apstāties)
    labels: [/\bdatums\b/, /paraksts|parakst/, /iestaties jaunsardz\S*/, /tiek uznemts\S* \S*\s*jaunsardz\S*/, /^ka\b/, /piekritu manu personas datu/, /par sevi sniedzu( sadas)?( zinas)?/, /tiek uznemts/, /iesniegums anketa/, /dalibai jaunsardze/, /pielikums/, /jaunsardzes centra/, /noteikumiem nr/,
      /piekritu berna dalibai/, /esmu informets/, /izvertesanai un liguma/, /kontaktinformacija liguma/, /iesniegumu anketu iesniedz/, /papira forma/, /jaunieti(s|sa) vai berna/, /ja atskiras/, /ja jaunietis ir jaunaks/]
  };
  // Vispārīgais profils citām anketām: “Etiķete: vērtība” vai vērtība zem etiķetes
  const G = (f, a, sec = '', modes = ['right', 'below']) => ({ f, sec, try: modes.map(m => ({ m, a })) });
  const GENERIC = {
    id: 'generic', name: 'Vispārīga anketa',
    sections: [['parent', /vecak\S* dati|likumisk\S* parstavi|parstavja dati|aizbildn/], ['emergency', /arkartas kontakt/]],
    rules: [
      G('_name', /^(vards uzvards|uzvards vards)\b/), G('first', /^vards\b(?! uzvards)/), G('last', /^uzvards\b/),
      { f: 'personalCode', sec: '', try: [{ m: 'right', a: /personas kods/ }, ...CODE] },
      G('birth', /dzimsanas (datums|diena)/), G('school', /macibu iestade|izglitibas iestade|\bskola\b/), G('schoolClass', /^klase\b|^kurss\b/, '', ['right']), G('group', /^grupa\b|vieniba/, '', ['right']),
      G('addressDeclared', /deklaret/), G('addressActual', /faktisk|dzivesvieta/), G('phone', /\btalr|telefon|mobil/, '', ['right']), G('email', /\be ?pasts|e ?mail/, '', ['right']),
      G('parentName', /vards uzvards|vecaks/, 'parent'), { f: 'parentCode', sec: 'parent', try: [{ m: 'right', a: /personas kods/ }, ...CODE] },
      G('parentPhone', /\btalr|telefon|mobil/, 'parent', ['right']), G('parentEmail', /\be ?pasts|e ?mail/, 'parent', ['right']), G('parentRelation', /saistiba|radniecib/, 'parent', ['right']),
      G('emergencyName', /vards uzvards|kontaktpersona/, 'emergency'), G('emergencyPhone', /\btalr|telefon/, 'emergency', ['right']), G('emergencyRelation', /radniecib|saistiba/, 'emergency', ['right'])
    ],
    labels: [/\bdatums\b/, /paraksts/]
  };
  R.PROFILES = [JAUNSARDZE, GENERIC];

  /* =================== Nolasīšana =================== */
  const isMark = w => /^[☐☒☑✓✔■□]$/.test(w.t);
  /** Atgriež { profile, values: {lauks: {raw, conf, box, blks, mode}}, lines, regions } */
  R.extract = doc => {
    const lines = R.lines(doc.words);
    const all = lines.map(l => l.norm).join('\n');
    const prof = R.PROFILES.find(p => p.detect && p.detect.test(all)) || GENERIC;
    // Sadaļu robežas (pēc pirmās marķiera parādīšanās)
    const secStart = { '': 0 };
    for (const [id, re] of prof.sections) { const a = findAnchors(lines, re)[0]; if (a) secStart[id] = a.g0; }
    const order = Object.entries(secStart).sort((a, b) => a[1] - b[1]);
    const secRange = id => { const i = order.findIndex(([k]) => k === id); if (i < 0) return null; return [order[i][1], i + 1 < order.length ? order[i + 1][1] : Infinity]; };
    // Visas etiķetes — vērtībās netiek iekļautas
    const labelAnchors = [];
    const addLabels = (re, o) => { for (const a of findAnchors(lines, re, o)) { labelAnchors.push(a); a.words.forEach(w => w.isLabel = true); } };
    for (const r of prof.rules) for (const t of r.try) { if (t.a) addLabels(t.a, t); if (t.b) addLabels(t.b); }
    for (const [, re] of prof.sections) addLabels(re);
    for (const re of prof.labels || []) addLabels(re);
    for (const l of lines) for (const w of l.words) if (!w.n && !isMark(w)) w.isLabel = true;   // tikai pasvītras, punkti u.c.
    labelAnchors.sort((a, b) => a.g0 - b.g0 || a.x0 - b.x0);

    const values = {};
    for (const rule of prof.rules) {
      const range = secRange(rule.sec); if (!range) continue;
      const inSec = a => a.g0 >= range[0] - 1e-6 && a.g0 < range[1];
      for (const t of rule.try) {
        const res = run(t, rule, inSec, range);
        if (res && (res.raw || '').trim()) { values[rule.f] = res; break; }
        if (res && !values[rule.f]) values[rule.f] = res;   // tukšs, bet zināma vieta (apgabals pietuvināšanai)
      }
    }
    // Pilnais vārds → vārds + uzvārds
    const nm = values._name?.raw?.trim() ? values._name : values._name2?.raw?.trim() ? values._name2 : values._name || values._name2;
    if (nm) {
      const parts = nm.raw.replace(/[^\p{L}\s\-']/gu, ' ').trim().split(/\s+/).filter(Boolean);
      if (!values.first?.raw) values.first = { ...nm, raw: parts[0] || '' };
      if (!values.last?.raw) values.last = { ...nm, raw: parts.slice(1).join(' ') };
    }
    delete values._name; delete values._name2;
    for (const k of ['personalCode', 'parentCode']) if (values[k]?.box) values[k].boxed = true;   // rūtiņās rakstīti cipari
    return { profile: prof, values, lines };

    /* --- Režīmi --- */
    function run(t, rule, inSec, range) {
      if (t.m === 'code') return codeIn(range, rule.f);
      let anchors = findAnchors(lines, t.a, t).filter(inSec);
      if (t.last) anchors = anchors.reverse();
      if (!anchors.length) return null;
      let first = null;
      for (const a of anchors) {
        const r = t.m === 'right' ? right(a) : t.m === 'between' ? between(a, t.b, t.need) : t.m === 'below' ? below(a) : t.m === 'above' ? above(a) : t.m === 'checkbox' ? checkbox(a) : null;
        if (!r) continue; r.mode = t.m;
        if ((r.raw || '').trim()) return r;
        first = first || r;
      }
      return first;
    }
    // Rindas josla: rokraksts mēdz būt virs līnijas, tāpēc josla stiepjas uz augšu; DOCX — tikai tā pati rinda
    function band(a) { const h = a.y1 - a.y0; return doc.kind === 'docx' ? [a.y0 - h * 0.1, a.y1 + h * 0.1] : [a.y0 - h * 1.3, a.y1 + h * 0.6]; }
    function collect(p, x0, y0, x1, y1) {
      return doc.words.filter(w => w.p === p && !w.isLabel && !isMark(w) && (w.x0 + w.x1) / 2 >= x0 && (w.x0 + w.x1) / 2 <= x1 && (w.y0 + w.y1) / 2 >= y0 && (w.y0 + w.y1) / 2 <= y1);
    }
    function result(ws, box) {
      const ls = R.lines(ws);
      return { raw: ls.map(l => l.text).join(' ').replace(/\s+/g, ' ').trim(), conf: ws.length ? Math.min(...ws.map(w => w.conf ?? 100)) : 0, box, blks: [...new Set(ws.map(w => w.blk).filter(b => b !== undefined))], words: ws };
    }
    function nextOnBand(a) {
      const [y0, y1] = band(a);
      return labelAnchors.filter(o => o.p === a.p && o !== a && o.x0 > a.x1 - 1e-4 && (o.y0 + o.y1) / 2 >= y0 && (o.y0 + o.y1) / 2 <= y1 && !o.words.some(w => a.words.includes(w))).sort((x, y) => x.x0 - y.x0)[0];
    }
    function right(a, stop) {
      stop = stop || nextOnBand(a);
      const [y0, y1] = band(a), x0 = a.x1, x1 = stop ? stop.x0 : 0.99;
      return result(collect(a.p, x0, y0, x1, y1), { page: a.p, x: x0, y: y0, w: Math.max(0.05, x1 - x0), h: y1 - y0 });
    }
    function between(a, reB, need) {
      const [y0, y1] = band(a);
      const b = findAnchors([a.line, ...lines.filter(l => l.p === a.p && l !== a.line && l.yc >= y0 && l.yc <= y1)], reB).filter(o => o.x0 > a.x1).sort((x, y) => x.x0 - y.x0)[0];
      if (need && !b) return null;
      return right(a, b);
    }
    function below(a) {
      // vērtība var būt arī tajā pašā rindā aiz etiķetes
      const same = right(a);
      const next = labelAnchors.find(o => o.g0 > a.g1 - 1e-6 && o.line !== a.line && !o.words.some(w => a.words.includes(w)));
      const gEnd = next ? next.g0 : a.p + 1;
      const ws = doc.words.filter(w => !w.isLabel && !isMark(w) && gy(w.p, (w.y0 + w.y1) / 2) > a.g1 && gy(w.p, (w.y0 + w.y1) / 2) < gEnd);
      // nesalasāmas “drupatas” (atpazīšanas troksnis) netiek ņemtas
      const ls = R.lines(ws).filter(l => doc.source !== 'ocr' || (l.text.replace(/[^\p{L}\d]/gu, '').length >= 4 && l.conf >= 30)).slice(0, 3), picked = ls.flatMap(l => l.words);
      const y1 = next && next.p === a.p ? next.y0 : 1;
      const box = { page: a.p, x: 0.04, y: a.y1 + 0.003, w: 0.92, h: Math.max(0.02, Math.min(y1, a.y1 + 0.12) - a.y1) };
      if (picked.length && picked[0].p !== a.p) Object.assign(box, { page: picked[0].p, y: Math.max(0, Math.min(...picked.map(w => w.y0)) - 0.01), h: 0.06 });
      const r = result([...same.words, ...picked], box);
      return r;
    }
    function above(a) {
      const h = a.y1 - a.y0, x0 = Math.max(0, a.x0 - 0.35), x1 = Math.min(1, a.x1 + 0.35), y0 = a.y0 - h * 4.5, y1 = a.y0 + h * 0.15;
      const ls = R.lines(collect(a.p, x0, y0, x1, y1)).filter(l => !l.words.every(w => w.isLabel));
      const near = ls.sort((p, q) => q.yc - p.yc)[0];
      return result(near ? near.words : [], { page: a.p, x: x0, y: Math.max(0, a.y0 - h * 3), w: x1 - x0, h: h * 3.2 });
    }
    function codeIn(range, field) {
      const found = [];
      for (const l of lines) {
        const g = gy(l.p, l.yc); if (g < range[0] - 1e-6 || g >= range[1]) continue;
        const joined = l.words.filter(w => !w.isLabel || /\d/.test(w.t)).map(w => w.t).join('');
        // rūtiņu malas ([ ] | ( )) nav cipari — tās izmet; pārējās tipiskās kļūdas labo
        const fixed = joined.replace(/[\[\]|(){}]/g, '').replace(/[OoQD]/g, '0').replace(/[Il!]/g, '1').replace(/[Ss]/g, '5').replace(/B/g, '8');
        const m0 = fixed.match(/(\d{6})[-–—.]?(\d{5})/);
        if (m0) found.push({ code: m0[1] + '-' + m0[2], line: l });
        else if ((fixed.match(/\d/g) || []).length >= 8 && /[-–]/.test(fixed) && !/\p{L}{3}/u.test(fixed)) found.push({ code: '', raw: fixed, line: l });   // cipari ir, bet nesalasāmi — vieta zināma
      }
      const ok = found.filter(f => U.checkCode(f.code)), pick = (ok[0] || found.find(f => f.code) || found[0]);
      if (!pick) return null;
      const l = pick.line, dw = l.words.filter(w => /\d/.test(w.t)), bw = dw.length ? dw : l.words;
      const x0 = Math.min(...bw.map(w => w.x0)), x1 = Math.max(...bw.map(w => w.x1)), y0 = Math.min(...bw.map(w => w.y0)), y1 = Math.max(...bw.map(w => w.y1));
      return { raw: pick.code || pick.raw, conf: pick.code ? Math.min(100, l.conf + (U.checkCode(pick.code) ? 20 : 0)) : 0, boxed: true, box: { page: l.p, x: x0 - 0.01, y: y0 - (y1 - y0) * 0.3, w: x1 - x0 + 0.02, h: (y1 - y0) * 1.6 }, blks: l.blk !== undefined ? [l.blk] : [], words: l.words };
    }
    function checkbox(a) {
      const text = a.line.text;
      // Attēliem: salīdzina “tintes” daudzumu rūtiņās pirms “Piekrītu” un “nepiekrītu”
      if (doc.pages?.length && doc.source === 'ocr') {
        const yes = a.line.words.find(w => /^piekritu/.test(w.n)), no = a.line.words.find(w => /^nepiekritu/.test(w.n));
        if (yes && no) {
          const ink = w => { const h = w.y1 - w.y0, c = doc.pages[w.p]; return CP.ocr.ink(c, { x: w.x0 - h * 1.7 * c.height / c.width, y: w.y0, w: h * 1.4 * c.height / c.width, h }); };
          const iy = ink(yes), iN = ink(no);
          if (Math.abs(iy - iN) > 0.06) return { raw: iy > iN ? 'yes' : 'no', conf: 80, box: { page: a.p, x: a.line.x0, y: a.line.y0, w: a.line.x1 - a.line.x0, h: a.line.y1 - a.line.y0 }, blks: [], words: [] };
        }
      }
      const yes = /[☒☑✓✔■xX×]\s*piekr/i.test(text.replace(/ne\s*piekr/gi, 'NE'));
      const no = /[☒☑✓✔■xX×]\s*ne\s*piekr/i.test(text);
      const raw = no && !yes ? 'no' : yes && !no ? 'yes' : '';
      return { raw, conf: raw ? 90 : 0, box: { page: a.p, x: a.line.x0, y: a.line.y0, w: a.line.x1 - a.line.x0, h: a.line.y1 - a.line.y0 }, blks: a.line.blk !== undefined ? [a.line.blk] : [], words: [] };
    }
  };

  CP.reader = R;
})(window.CP);
