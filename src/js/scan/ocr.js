/* =====================================================================
   Teksta atpazīšana (OCR) attēliem un skenētiem PDF
   - Lokāli: Tesseract.js (latviešu + angļu modeļi), darbojas pārlūkā
   - Pēc izvēles: Google Cloud Vision (labāk lasa rokrakstu; sūta attēlu Google)
   - Priekšapstrāde: pelēktoņi, kontrasts, adaptīvā binarizācija, anketas līniju noņemšana
   - Divas kārtas: 1) visa lapa → vārdi ar koordinātām (etiķešu atrašanai),
     2) katra atrastā lauka apgabals atsevišķi, ar atļautajiem simboliem
   - Katra vērtība tiek iztīrīta un pārbaudīta (kontrolcipars, formāti)
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state;
  const TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.min.js';
  const ocr = {};
  const loadScript = src => CP.reader.loadScript(src);

  /* ---------------- Attēls → lapa ---------------- */
  ocr.imageToPages = async file => {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const m = Math.max(bmp.width, bmp.height), k = Math.min(3200 / m, Math.max(1, 2200 / m));
    const c = canvas(bmp.width * k, bmp.height * k), ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return [c];
  };
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); return c; }
  ocr.rotate = c => { const r = canvas(c.height, c.width), x = r.getContext('2d'); x.translate(r.width, 0); x.rotate(Math.PI / 2); x.drawImage(c, 0, 0); return r; };

  /* ---------------- Priekšapstrāde ---------------- */
  /** Pelēktoņi + kontrasta izstiepšana + adaptīvā (lokālā vidējā) binarizācija — izlīdzina ēnas telefona foto */
  ocr.enhance = (src, binarize = true, removeLines = null) => {
    const w = src.width, h = src.height, img = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h), d = img.data, n = w * h;
    const g = new Uint8ClampedArray(n), hist = new Uint32Array(256);
    for (let i = 0; i < n; i++) { const v = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000; g[i] = v; hist[g[i]]++; }
    let lo = 0, hi = 255, acc = 0; for (; lo < 255 && (acc += hist[lo]) < n * 0.01; lo++); acc = 0; for (; hi > 0 && (acc += hist[hi]) < n * 0.05; hi--);
    const span = Math.max(1, hi - lo); for (let i = 0; i < n; i++) g[i] = (g[i] - lo) * 255 / span;
    if (binarize) {
      const I = new Uint32Array((w + 1) * (h + 1));
      for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += g[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
      const r = Math.max(8, Math.round(Math.min(w, h) / 30));
      const out = new Uint8ClampedArray(n);
      for (let y = 0; y < h; y++) {
        const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
        for (let x = 0; x < w; x++) {
          const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
          const sum = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
          const mean = sum / ((x1 - x0) * (y1 - y0));
          out[y * w + x] = g[y * w + x] < mean * 0.86 - 4 ? 0 : 255;
        }
      }
      g.set(out);
      if (removeLines) stripLines(g, w, h, removeLines);
    }
    for (let i = 0; i < n; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g[i]; d[i * 4 + 3] = 255; }
    const c = canvas(w, h); c.getContext('2d').putImageData(img, 0, 0); return c;
  };
  /** Noņem garas horizontālas/vertikālas līnijas (anketas pasvītras, rāmji), kas traucē atpazīšanai */
  function stripLines(g, w, h, opt) {
    const minH = Math.max(40, Math.round(w * opt.h)), minV = Math.max(40, Math.round(h * opt.v)), GAPS = 2;
    const kill = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      let start = -1, gap = 0;
      for (let x = 0; x <= w; x++) {
        const dark = x < w && g[y * w + x] === 0;
        if (dark) { if (start < 0) start = x; gap = 0; }
        else if (start >= 0 && ++gap > GAPS) { const end = x - gap; if (end - start >= minH) for (let i = start; i <= end; i++) kill[y * w + i] = 1; start = -1; gap = 0; }
      }
    }
    for (let x = 0; x < w; x++) {
      let start = -1, gap = 0;
      for (let y = 0; y <= h; y++) {
        const dark = y < h && g[y * w + x] === 0;
        if (dark) { if (start < 0) start = y; gap = 0; }
        else if (start >= 0 && ++gap > GAPS) { const end = y - gap; if (end - start >= minV) for (let i = start; i <= end; i++) kill[i * w + x] = 1; start = -1; gap = 0; }
      }
    }
    for (let i = 0; i < w * h; i++) if (kill[i]) g[i] = 255;
  }
  /** Izgriež zonu ar nelielu rezervi un palielina tā, lai teksta augstums būtu Tesseract optimālais */
  ocr.crop = (src, z, multi = false) => {
    const W = src.width, H = src.height;
    let x = z.x * W, y = z.y * H, w = z.w * W, h = z.h * H;
    const px = Math.min(w * 0.04, 20), py = multi ? 3 : Math.min(h * 0.25, 25);
    x = U.clamp(x - px, 0, W); y = U.clamp(y - py, 0, H); w = Math.min(W - x, w + 2 * px); h = Math.min(H - y, h + 2 * py);
    const k = multi ? U.clamp(1600 / w, 1, 3) : U.clamp(120 / h, 1, 4);
    const c = canvas(w * k, h * k), ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(src, x, y, w, h, 0, 0, c.width, c.height);
    return c;
  };

  /* ---------------- Tesseract ---------------- */
  let worker = null, progress = null;
  const STATUS = { 'loading tesseract core': 'Ielādē atpazīšanas dzinēju', 'initializing tesseract': 'Sagatavo', 'loading language traineddata': 'Ielādē latviešu valodas modeli', 'initializing api': 'Sagatavo', 'recognizing text': 'Atpazīst' };
  /* Tīmekļa versijā atpazīšana tiek ielādēta no paša rīka mapes vendor/tesseract (bez ārējiem serveriem,
     pēc pirmās reizes — arī bezsaistē). Lokālajā file:// versijā darba procesus no failiem palaist nevar, tāpēc CDN. */
  const LOCAL_TESS = CP.VENDOR + 'tesseract/';
  async function getWorker() {
    if (worker) return worker;
    let local = false;
    if (CP.WEB) { try { await loadScript(LOCAL_TESS + 'tesseract.min.js'); local = true; } catch (e) { /* nav iekļauts — CDN */ } }
    if (!local) await loadScript(TESS_URL);
    const opts = { logger: m => progress?.(STATUS[m.status] || m.status, m.progress) };
    if (local) {
      const base = new URL(LOCAL_TESS, location.href).href;
      Object.assign(opts, { workerPath: base + 'worker.min.js', corePath: base + 'core', langPath: base + 'lang', workerBlobURL: false });
    }
    worker = await window.Tesseract.createWorker(['lav', 'eng'], 1, opts);
    return worker;
  }
  const LV = 'AĀBCČDEĒFGĢHIĪJKĶLĻMNŅOPQRSŠTUŪVWXYZŽaābcčdeēfgģhiījkķlļmnņopqrsštuūvwxyzž';
  const WHITELIST = { email: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@._-+', personalCode: '0123456789-', phone: '0123456789+ ', date: '0123456789.-/', name: LV + " -'", fullname: LV + " -'" };

  /** 1. kārta: visa lapa → vārdi ar normalizētām koordinātām */
  async function tessPageWords(c, p, onProgress) {
    const w = await getWorker(); progress = onProgress;
    const src = S.db.settings.ocr.enhance ? ocr.enhance(c, true, { h: 0.12, v: 0.04 }) : c;
    const { data } = await w.recognize(src, { tessedit_pageseg_mode: '3', preserve_interword_spaces: '1' }, { text: true, blocks: true });
    const out = [];
    for (const b of data.blocks || []) for (const pa of b.paragraphs || []) for (const l of pa.lines || []) for (const wd of l.words || []) {
      const t = (wd.text || '').trim(); if (!t) continue;
      out.push(CP.reader.mkWord(t, p, wd.bbox.x0 / c.width, wd.bbox.y0 / c.height, wd.bbox.x1 / c.width, wd.bbox.y1 / c.height, wd.confidence));
    }
    return out;
  }
  /** 2. kārta: viena lauka apgabals → teksts un ticamība */
  async function tessRegion(c, box, field) {
    const w = await getWorker(); progress = null;
    const kind = CP.FIELD[field]?.v, multi = kind === 'address';
    let img = ocr.crop(c, box, multi); img = ocr.enhance(img, true, { h: 0.3, v: kind === 'personalCode' ? 0.35 : multi ? 0.5 : 0.7 });
    const { data } = await w.recognize(img, { tessedit_pageseg_mode: multi ? '6' : '7', tessedit_char_whitelist: WHITELIST[kind] || '', preserve_interword_spaces: '1' }, { text: true });
    return { text: (data.text || '').replace(/\s+/g, ' ').trim(), conf: data.confidence || 0 };
  }

  /** Personas kods rūtiņās: atrod rūtiņu vertikālās malas un katru ciparu atpazīst atsevišķi */
  async function tessBoxedDigits(c, box) {
    const w = await getWorker(); progress = null;
    const img = ocr.enhance(ocr.crop(c, box), true), W = img.width, H = img.height;
    const px = img.getContext('2d').getImageData(0, 0, W, H).data, dark = (x, y) => px[(y * W + x) * 4] < 128;
    // katrai kolonnai garākais nepārtrauktais tumšais posms; rūtiņu malas ir garākie posmi
    const runs = [];
    for (let x = 0; x < W; x++) { let best = 0, bs = 0, cur = 0, cs = 0; for (let y = 0; y < H; y++) { if (dark(x, y)) { if (!cur) cs = y; cur++; if (cur > best) { best = cur; bs = cs; } } else cur = 0; } runs.push({ len: best, y0: bs }); }
    const maxRun = Math.max(...runs.map(r => r.len)); if (maxRun < H * 0.2) return null;
    const lines = [];
    for (let x = 0; x < W; x++) if (runs[x].len >= maxRun * 0.8) { if (lines.length && x - lines.at(-1).x1 <= 2) lines.at(-1).x1 = x; else lines.push({ x0: x, x1: x, y0: runs[x].y0, y1: runs[x].y0 + runs[x].len }); }
    if (lines.length < 6) return null;
    const bh = maxRun, cells = [];
    for (let i = 0; i + 1 < lines.length; i++) { const a = lines[i].x1 + 1, b = lines[i + 1].x0 - 1; if (b - a > bh * 0.25 && b - a < bh * 1.6) cells.push([a, b, Math.min(lines[i].y0, lines[i + 1].y0), Math.max(lines[i].y1, lines[i + 1].y1)]); }
    let out = '';
    for (const [a, b, y0, y1] of cells) {
      const cw = b - a, ch = y1 - y0, ix = Math.round(cw * 0.1), iy = Math.round(ch * 0.1);
      const cell = canvas(cw + 40, ch + 40), cx = cell.getContext('2d');
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, cell.width, cell.height);
      cx.drawImage(img, a + ix, y0 + iy, cw - 2 * ix, ch - 2 * iy, 20 + ix, 20 + iy, cw - 2 * ix, ch - 2 * iy);
      if (ocr.ink(cell, { x: 0, y: 0, w: 1, h: 1 }) < 0.01) continue;   // tukša rūtiņa
      const { data } = await w.recognize(cell, { tessedit_pageseg_mode: '10', tessedit_char_whitelist: '0123456789-' }, { text: true });
      out += (data.text || '').trim().slice(0, 1);
    }
    if (!out.includes('-') && out.length === 11) out = out.slice(0, 6) + '-' + out.slice(6);
    return { text: out, conf: 75 };
  }
  /** Tumšo pikseļu īpatsvars apgabalā (0..1), apgabals normalizētās koordinātās */
  ocr.ink = (c, b) => {
    const x = Math.max(0, Math.round(b.x * c.width)), y = Math.max(0, Math.round(b.y * c.height)), w = Math.max(1, Math.min(c.width - x, Math.round(b.w * c.width))), h = Math.max(1, Math.min(c.height - y, Math.round(b.h * c.height)));
    const d = c.getContext('2d', { willReadFrequently: true }).getImageData(x, y, w, h).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 300) n++;
    return n / (w * h);
  };

  /* ---------------- Google Cloud Vision (pēc izvēles) ---------------- */
  async function googleWords(c, p) {
    if (S.db.settings.ocr.engine !== 'google') throw Error('Google Vision nav ieslēgts');
    const key = S.db.settings.ocr.googleKey; if (!key) throw Error('Iestatījumos nav ievadīta Google Vision API atslēga');
    const k = Math.min(1, 3000 / Math.max(c.width, c.height)), sc = canvas(c.width * k, c.height * k); sc.getContext('2d').drawImage(c, 0, 0, sc.width, sc.height);
    const r = await fetch('https://vision.googleapis.com/v1/images:annotate?key=' + encodeURIComponent(key), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ image: { content: sc.toDataURL('image/jpeg', 0.9).split(',')[1] }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }], imageContext: { languageHints: ['lv', 'en'] } }] })
    });
    const j = await r.json().catch(() => ({})), err = j.error || j.responses?.[0]?.error;
    if (!r.ok || err) throw Error('Google Vision: ' + (err?.message || r.status));
    const pg = j.responses?.[0]?.fullTextAnnotation?.pages?.[0]; if (!pg) return [];
    const W = pg.width, H = pg.height, out = [];
    for (const b of pg.blocks || []) for (const pa of b.paragraphs || []) for (const wd of pa.words || []) {
      const v = wd.boundingBox?.vertices || [], xs = v.map(q => q.x || 0), ys = v.map(q => q.y || 0);
      out.push(CP.reader.mkWord((wd.symbols || []).map(s => s.text).join(''), p, Math.min(...xs) / W, Math.min(...ys) / H, Math.max(...xs) / W, Math.max(...ys) / H, (wd.confidence ?? 0.9) * 100));
    }
    return out;
  }

  /* ---------------- Publiskā saskarne ---------------- */
  ocr.engine = () => S.db.settings.ocr.engine;
  /** Visu lapu vārdi */
  ocr.pageWords = async (pages, onProgress) => {
    const out = [];
    for (let i = 0; i < pages.length; i++) {
      const lbl = pages.length > 1 ? ` — lapa ${i + 1}/${pages.length}` : '';
      if (ocr.engine() === 'google') { onProgress?.('Sūta uz Google Vision' + lbl); out.push(...await googleWords(pages[i], i)); }
      else out.push(...await tessPageWords(pages[i], i, (s, p) => onProgress?.(s + lbl, p)));
    }
    return out;
  };
  /** Lauka apgabala atkārtota atpazīšana (tikai lokālajam dzinējam) */
  ocr.region = async (pages, box, field) => (ocr.engine() === 'google' || !pages[box.page || 0]) ? null : tessRegion(pages[box.page || 0], box, field);
  // Rūtiņās rakstīti cipari vienmēr tiek nolasīti lokāli (pa vienam) — arī ja izvēlēts Google Vision
  ocr.boxedDigits = async (pages, box) => {
    const pg = pages[box.page || 0]; if (!pg) return null;
    const valid = r => { const dg = (r?.text || '').replace(/\D/g, ''); return dg.length === 11 && U.checkCode(dg); };
    let first = null;
    // zona var būt iezīmēta plašāk vai šaurāk par rūtiņām — mēģina dažus apgabalus, ņem pirmo ar derīgu kontrolciparu
    for (const [dx, dy] of [[0, 0], [-0.006, -0.003], [-0.012, -0.005], [0.006, 0.003], [-0.02, -0.006]]) {
      const b = { ...box, x: box.x - dx, y: box.y - dy, w: Math.max(0.02, box.w + 2 * dx), h: Math.max(0.008, box.h + 2 * dy) };
      const r = await tessBoxedDigits(pg, b);
      if (valid(r)) return r;
      if (!first) first = r;
    }
    return first;
  };

  /* ---------------- Tīrīšana un pārbaude ---------------- */
  const TLDS = ['lv', 'com', 'net', 'org', 'eu', 'ee', 'lt', 'de', 'uk', 'ru', 'io', 'info', 'edu', 'gov', 'fi', 'se', 'no'];
  const DOMAINS = ['inbox.lv', 'gmail.com', 'apollo.lv', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'tvnet.lv', 'mail.ru', 'one.lv', 'e-klase.lv', 'edu.lv'];
  const digitFix = s => s.replace(/[OoQD]/g, '0').replace(/[Il|!iL\]\[]/g, '1').replace(/[Ss$]/g, '5').replace(/B/g, '8').replace(/[Zz]/g, '2').replace(/G/g, '6').replace(/[Tt]/g, '7').replace(/[gq]/g, '9');
  /** Iztīra atpazīto tekstu konkrētam laukam. Atgriež {ok, value, msg} */
  ocr.clean = (field, raw) => {
    const f = CP.FIELD[field] || {}; let s = String(raw || '').replace(/[_|]{2,}/g, ' ').replace(/^[\s:;.,\-–_]+|[\s:;,\-–_]+$/g, '').trim();
    if (!s) return { ok: false, value: '', msg: 'tukšs' };
    switch (f.v) {
      case 'personalCode': {
        const m = digitFix(s.replace(/\s/g, '')).match(/(\d{6})[-–—.]?(\d{5})/);
        return m ? U.validate('personalCode', m[1] + m[2]) : { ok: false, msg: 'neatradu 11 ciparus' };
      }
      case 'phone': {
        const t = digitFix(s).replace(/[^\d+]/g, ''), m = t.match(/(?:\+?371)?([2689]\d{7})/) || t.match(/\+?\d{8,15}/);
        return m ? U.validate('phone', m[1] || m[0]) : { ok: false, msg: 'neatradu numuru' };
      }
      case 'email': {
        let e = s.replace(/\s*(?:\(a\)|\[at\]|©|®|@)\s*/gi, '@').replace(/\s+/g, '').replace(/,/g, '.').toLowerCase()
          .replace(/gmai1|grnail|gmall/g, 'gmail').replace(/\.corn\b/, '.com').replace(/\.1v\b/, '.lv');
        e = e.replace(/^[^a-z0-9]+/, '');
        if (!e.includes('@')) {   // '@' bieži tiek nolasīts kā E, Q, G, & vai a — atjauno pēc zināmiem domēniem
          const dom = DOMAINS.find(d => e.endsWith(d) && e.length > d.length + 1);
          if (dom) { const pre = e.slice(0, -dom.length); e = (/[eqg&8a]$/.test(pre) && pre.length > 2 ? pre.slice(0, -1) : pre) + '@' + dom; }
        }
        const m = e.match(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/); if (!m) return { ok: false, msg: 'nav e-pasta formātā' };
        let addr = m[0]; const tld = addr.split('.').pop();
        if (!TLDS.includes(tld)) { const fix = TLDS.find(t => tld.startsWith(t)); if (fix) addr = addr.slice(0, -tld.length) + fix; }
        return U.validate('email', addr);
      }
      case 'date': return U.validate('date', digitFix(s.replace(/[^\dOoIlSsBZz.\/\- ]/g, '')).replace(/\s/g, ''));
      case 'schoolClass': {
        const m = s.match(/\b(\d{1,2})\s*\.?\s*([a-zA-ZāčēģīķļņšūžĀČĒĢĪĶĻŅŠŪŽ])?(?=\b|\s|$)/); if (!m) return U.validate('schoolClass', s);
        return { ok: true, value: m[1] + '.' + (m[2] ? m[2].toLowerCase() : '') };
      }
      case 'name': case 'fullname': {
        const t = s.replace(/[^\p{L}\s\-']/gu, ' ').split(/\s+/).filter(w => w.length > 1 && !/^[OoMmIlQ0]+$/.test(w)).join(' ').trim();
        return U.validate(f.v, t);
      }
      default: return U.validate(f.v || 'text', s);
    }
  };

  CP.ocr = ocr;
})(window.CP);
