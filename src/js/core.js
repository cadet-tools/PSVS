/* =====================================================================
   CADET PERSONĀLS — kodols
   Palīgfunkcijas, validācija, datu shēma, migrācijas, kopīgais stāvoklis
   un domēna vaicājumi (kontakti, trūkstošie dokumenti, brīdinājumi).
   Visi moduļi lieto vienu vārdtelpu window.CP (darbojas arī no file://).
   ===================================================================== */
window.CP = window.CP || {};
(function (CP) {
  'use strict';

  CP.VERSION = '1.58.0';
  /** “Ziņot” sūtīšanas adrese: izstrādātāja Google Apps Script tīmekļa lietotne (…/exec). Tukša → tikai “Saglabāt failā”. */
  CP.FEEDBACK_URL = 'https://script.google.com/macros/s/AKfycbyzvkwL6wk-0agFYpD2fqAy8JQdNUjpDyk31xEvqCkmh5HJAKeUVbWnVp_psljGpCUr/exec';
  /* Lietošanas analītika (docs/ANALYTICS.md): Apps Script tīmekļa lietotnes adrese (…/exec). Tukša = nekas netiek sūtīts.
     Stabilajā kanālā analītika darbojas tikai, kad ANALYTICS_STABLE = true (vispirms pārbauda testa kanālā). */
  CP.ANALYTICS_URL = 'https://script.google.com/macros/s/AKfycbzO6Gc7VYcph6gIa1wbCSFyOe0OJN1X5Mkd-diq1Fzc_eKKpGb150brf71_6uz_F2JoZQ/exec';
  CP.ANALYTICS_STABLE = true;
  CP.SCHEMA = 7;
  CP.DATAFILE = 'CADET_PERSONALS_DATI.json';
  /* Tīmekļa versija (GitHub Pages, https) vai lokālā (file://). Kanāls: stabilā vai testa — no <meta name="cp-channel">. */
  CP.WEB = /^https?:$/.test(location.protocol);
  CP.CHANNEL = (document.querySelector('meta[name="cp-channel"]') || {}).content || 'stable';
  CP.VENDOR = (document.querySelector('meta[name="cp-vendor"]') || {}).content || 'vendor/';

  /* ---------------- Palīgfunkcijas ---------------- */
  const U = {};
  U.$ = id => document.getElementById(id);
  U.qs = (sel, root = document) => root.querySelector(sel);
  U.qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
  U.esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
  U.iso = (d = new Date()) => d.toLocaleDateString('sv-SE');
  U.stamp = (d = new Date()) => {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  };
  U.now = () => new Date().toISOString();
  U.norm = s => String(s || '').toLocaleLowerCase('lv').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9@.+]+/g, ' ').trim();
  U.full = p => `${p?.first || ''} ${p?.last || ''}`.trim();
  U.sortName = p => `${p?.last || ''} ${p?.first || ''}`.trim();
  U.initials = p => ((p?.first || '?')[0] + (p?.last || '?')[0]).toUpperCase();
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.cmp = (a, b) => String(a || '').localeCompare(String(b || ''), 'lv', { sensitivity: 'base', numeric: true });

  U.fmtDate = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : (s || ''); };
  U.fmtDateTime = s => s ? new Date(s).toLocaleString('lv-LV', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  U.age = s => {
    if (!s) return null; const d = new Date(s + 'T12:00:00'), t = new Date(); if (isNaN(d)) return null;
    return t.getFullYear() - d.getFullYear() - ((t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) ? 1 : 0);
  };
  U.daysTo = s => Math.round((new Date(s + 'T12:00:00') - new Date(U.iso() + 'T12:00:00')) / 86400000);   // round: vasaras/ziemas laika maiņa nedod ±1 d.
  U.daysUntilBirthday = s => {
    if (!s) return null; const d = new Date(s + 'T12:00:00'); if (isNaN(d)) return null;
    const now = new Date(), t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const t = new Date(now.getFullYear(), d.getMonth(), d.getDate()); if (t < t0) t.setFullYear(t.getFullYear() + 1);
    return Math.round((t - t0) / 86400000);
  };
  U.addMonths = (dt, months) => {
    if (!dt) return ''; const d = new Date(dt + 'T12:00:00'), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + Number(months || 0));
    d.setDate(Math.min(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(), day)); return U.iso(d);
  };
  /** Mācību gads Latvijā: no 1. septembra līdz nākamā gada 31. augustam. */
  U.schoolStart = (date = new Date()) => { const y = date.getFullYear(); return date.getMonth() >= 8 ? y : y - 1; };
  U.yearId = start => `${Number(start)}-${Number(start) + 1}`;
  U.schoolYear = (date = new Date()) => U.yearId(U.schoolStart(date instanceof Date ? date : new Date(date)));
  U.yearLabel = id => { const m = /^(\d{4})-(\d{4})$/.exec(id || ''); return m ? `${m[1]}–${m[2]}` : (id || ''); };
  U.yearSlash = id => { const m = /^(\d{4})-(\d{4})$/.exec(id || ''); return m ? `${m[1]} / ${m[2]}` : (id || ''); };
  U.yearOfDate = iso => {
    const s = String(iso || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    const d = new Date(s + 'T12:00:00');
    return Number.isNaN(d.getTime()) ? '' : U.schoolYear(d);
  };
  U.yearSpan = id => { const m = /^(\d{4})-(\d{4})$/.exec(id || ''); return m ? [`${m[1]}-09-01`, `${m[2]}-08-31`] : ['', '']; };
  /** Saprot 2026-10-11, 11.10.2026, 11/10/2026, 11-10-26, Excel sērijas numuru */
  U.parseDate = v => {
    if (!v) return ''; const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    let m = s.match(/(\d{1,2})\s*[.\/\-]\s*(\d{1,2})\s*[.\/\-]\s*(\d{4}|\d{2})\b/);
    if (m) {
      let y = Number(m[3]); if (m[3].length === 2) y += y > (new Date().getFullYear() % 100) ? 1900 : 2000;
      const out = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; const d = new Date(out + 'T12:00:00');
      return !isNaN(d) && d.getDate() === Number(m[1]) ? out : '';
    }
    if (/^\d{5}(\.\d+)?$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000).toISOString().slice(0, 10);
    return '';
  };

  /* --- Personas kods --- */
  U.codeDigits = v => String(v || '').replace(/\D/g, '');
  U.fmtCode = v => { const d = U.codeDigits(v); return d.length === 11 ? d.slice(0, 6) + '-' + d.slice(6) : String(v || ''); };
  U.birthFromCode = code => {
    const c = U.codeDigits(code); if (c.length !== 11 || c.startsWith('32')) return '';
    const cent = { 0: 1800, 1: 1900, 2: 2000 }[c[6]]; if (cent === undefined) return '';
    const out = `${cent + Number(c.slice(4, 6))}-${c.slice(2, 4)}-${c.slice(0, 2)}`; const d = new Date(out + 'T12:00:00');
    return !isNaN(d) && d.getDate() === Number(c.slice(0, 2)) ? out : '';
  };
  /** Vecā formāta (ar dzimšanas datumu) kontrolcipars; jaunais formāts 32xxxx tiek pieņemts pēc garuma */
  U.checkCode = v => {
    const d = U.codeDigits(v); if (d.length !== 11) return false; if (d.startsWith('32')) return true;
    const w = [1, 6, 3, 7, 9, 10, 5, 8, 4, 2]; let s = 0; for (let i = 0; i < 10; i++) s += Number(d[i]) * w[i];
    return (1101 - s) % 11 === Number(d[10]) && !!U.birthFromCode(d);
  };
  U.maskCode = v => { const d = U.codeDigits(v); return d.length === 11 ? d.slice(0, 2) + '••••-•••' + d.slice(9) : (v ? '•••' : ''); };

  /* --- Tālrunis --- */
  U.normPhone = (s, cc) => {
    cc = cc || CP.state?.db?.settings?.countryCode || '371';
    let d = String(s || '').replace(/[^\d+]/g, ''); if (!d) return '';
    if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('00')) d = d.slice(2); else if (d.length === 8) d = cc + d;
    return d.length >= 8 && d.length <= 15 ? d : '';
  };
  U.prettyPhone = s => {
    const n = U.normPhone(s); if (!n) return String(s || '');
    return n.length === 11 && n.startsWith('371') ? `+371 ${n.slice(3, 7)} ${n.slice(7)}` : '+' + n;
  };

  /* --- Validācija (kopīga formām un teksta atpazīšanai) --- */
  const LETTERS = /^[\p{L}][\p{L}' \-]*$/u;
  const titleCase = s => s.toLocaleLowerCase('lv').replace(/(^|[\s\-'])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('lv'));
  U.validate = (kind, raw) => {
    const v = String(raw ?? '').trim(); if (!v) return { ok: true, value: '' };
    switch (kind) {
      case 'name': {
        const s = v.replace(/\s+/g, ' ');
        if (!LETTERS.test(s) || s.length > 40 || s.split(' ').length > 3) return { ok: false, msg: 'nav līdzīgs vārdam' };
        return { ok: true, value: (s === s.toUpperCase() || s === s.toLowerCase()) ? titleCase(s) : U.capWords(s) };
      }
      case 'fullname': {
        const s = v.replace(/\s+/g, ' ');
        if (!LETTERS.test(s) || s.split(' ').length < 2 || s.length > 60) return { ok: false, msg: 'vajag vārdu un uzvārdu' };
        return { ok: true, value: (s === s.toUpperCase() || s === s.toLowerCase()) ? titleCase(s) : U.capWords(s) };
      }
      case 'personalCode': {
        const d = U.codeDigits(v); if (d.length !== 11) return { ok: false, msg: 'jābūt 11 cipariem' };
        if (!U.checkCode(d)) return { ok: false, msg: 'kontrolcipars neatbilst' };
        return { ok: true, value: U.fmtCode(d) };
      }
      case 'phone': {
        const n = U.normPhone(v); if (!n) return { ok: false, msg: 'nav derīgs numurs' };
        if (n.startsWith('371') && (n.length !== 11 || !/^371[2689]/.test(n))) return { ok: false, msg: 'LV numuram jābūt 8 cipariem' };
        return { ok: true, value: U.prettyPhone(n) };
      }
      case 'email': {
        const s = v.toLowerCase();
        if (!/^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/.test(s)) return { ok: false, msg: 'nav derīga e-pasta adrese' };
        return { ok: true, value: s };
      }
      case 'date': {
        const d = U.parseDate(v); if (!d) return { ok: false, msg: 'nesaprotams datums' };
        const y = Number(d.slice(0, 4)); if (y < 1900 || y > new Date().getFullYear() + 2) return { ok: false, msg: 'neticams gads' };
        return { ok: true, value: d };
      }
      case 'schoolClass': {
        if (v.length > 20) return { ok: false, msg: 'pārāk garš' };
        return { ok: true, value: v.replace(/\s+/g, ' ') };
      }
      case 'place': {
        if (v.length > 120) return { ok: false, msg: 'pārāk garš' };
        return { ok: true, value: U.capFirst(v) };
      }
      case 'address': {
        const letters = (v.match(/\p{L}/gu) || []).length;
        if (v.length < 5 || letters < 3 || letters / v.length < 0.45) return { ok: false, msg: 'nav līdzīgs adresei' };
        return { ok: true, value: v.replace(/\s+/g, ' ') };
      }
      default: {
        const good = (v.match(/[\p{L}\p{N}]/gu) || []).length;
        if (good / v.replace(/\s/g, '').length < 0.6) return { ok: false, msg: 'daudz nesaprotamu simbolu' };
        return { ok: true, value: v.replace(/\s+/g, ' ') };
      }
    }
  };

  /** Minimāls ZIP lasītājs (DOCX, XLSX, eDoc ir ZIP arhīvi). Atgriež Map nosaukums → async () => Uint8Array */
  U.unzip = async (buf, want = () => true) => {
    const dv = new DataView(buf); let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw Error('fails nav derīgs ZIP/Office arhīvs');
    const n = dv.getUint16(eocd + 10, true), dec = new TextDecoder(), files = new Map(); let pos = dv.getUint32(eocd + 16, true);
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(pos, true) !== 0x02014b50) throw Error('bojāts arhīvs');
      const method = dv.getUint16(pos + 10, true), size = dv.getUint32(pos + 20, true), nl = dv.getUint16(pos + 28, true), xl = dv.getUint16(pos + 30, true), cl = dv.getUint16(pos + 32, true), local = dv.getUint32(pos + 42, true);
      const name = dec.decode(new Uint8Array(buf, pos + 46, nl));
      if (want(name)) files.set(name, async () => {
        const off = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true), raw = new Uint8Array(buf, off, size);
        if (method === 0) return raw.slice();
        if (method !== 8) throw Error('neatbalstīta kompresija');
        return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      });
      pos += 46 + nl + xl + cl;
    }
    return files;
  };
  /** Vārdi, uzvārdi: katra vārda pirmais burts lielais (pārējais paliek); viss ar lielajiem → “Jānis Bērziņš” */
  U.capWords = v => { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); if (!s) return s; const base = s === s.toUpperCase() && /\p{Lu}{2}/u.test(s) ? s.toLocaleLowerCase('lv') : s; return base.replace(/(^|[\s\-'’.])(\p{Ll})/gu, (m, a, c) => a + c.toLocaleUpperCase('lv')); };
  /** Vietas nosaukums: tikai pirmais burts lielais (“Rīgas novads”, “Skolas sporta zāle”) */
  U.capFirst = v => { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); return s ? s[0].toLocaleUpperCase('lv') + s.slice(1) : s; };
  // Ievades laukiem ar data-cap="words|first" — pārveido, pirms citi apstrādātāji nolasa vērtību
  document.addEventListener('change', e => { const t = e.target, m = t?.dataset?.cap; if (!m || typeof t.value !== 'string') return; const v = m === 'words' ? U.capWords(t.value) : U.capFirst(t.value); if (v !== t.value) t.value = v; }, true);
  U.download = (blob, name) => {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  /** SHA-256 pa gabaliem, lai liels fails neaizturētu saskarni. */
  U.sha256Blob = async (blob, yieldEvery = 4) => {
    const K = new Uint32Array([
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]);
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const buf = new Uint8Array(64);
    let n = 0, bits = 0n, chunks = 0;
    const rotr = (x, r) => (x >>> r) | (x << (32 - r));
    const block = b => {
      const w = new Uint32Array(64);
      for (let i = 0; i < 16; i++) w[i] = ((b[i * 4] << 24) | (b[i * 4 + 1] << 16) | (b[i * 4 + 2] << 8) | b[i * 4 + 3]) >>> 0;
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let a = h0, b0 = h1, c = h2, d = h3, e = h4, f = h5, g = h6, hh = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b0) ^ (a & c) ^ (b0 & c);
        const t2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b0; b0 = a; a = (t1 + t2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b0) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + hh) >>> 0;
    };
    const add = bytes => {
      bits += BigInt(bytes.length) * 8n;
      let off = 0;
      while (off < bytes.length) {
        const take = Math.min(64 - n, bytes.length - off);
        buf.set(bytes.subarray(off, off + take), n);
        n += take; off += take;
        if (n === 64) { block(buf); n = 0; }
      }
    };
    const reader = blob.stream().getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      add(value);
      if (++chunks % yieldEvery === 0) await new Promise(r => setTimeout(r, 0));
    }
    const pad = new Uint8Array(n < 56 ? 64 : 128);
    if (n) pad.set(buf.subarray(0, n));
    pad[n] = 0x80;
    const view = new DataView(pad.buffer);
    view.setUint32(pad.length - 8, Number((bits >> 32n) & 0xffffffffn), false);
    view.setUint32(pad.length - 4, Number(bits & 0xffffffffn), false);
    block(pad.subarray(0, 64));
    if (pad.length > 64) block(pad.subarray(64));
    return [h0, h1, h2, h3, h4, h5, h6, h7].map(x => x.toString(16).padStart(8, '0')).join('');
  };
  CP.util = U;

  /* ---------------- Datu shēma ---------------- */
  CP.STATUSES = { candidate: 'Kandidāts', active: 'Jaunsargs', paused: 'Pārtraukts', archived: 'Arhīvā' };
  CP.COMM_STATUS = { prepared: 'Sagatavots', opened: 'Atvērts ārējā lietotnē', confirmed: 'Lietotājs apstiprinājis nosūtīšanu', cancelled: 'Atcelts' };
  CP.FILE_STATUS = { available: 'Pārbaudīts', noaccess: 'Nav piekļuves', missing: 'Nav atrasts', check: 'Jāpārbauda' };

  CP.SECTIONS = [
    ['basic', 'Pamatdati'], ['study', 'Dalība un mācības'], ['contact', 'Kontakti'], ['address', 'Adreses'],
    ['parent', 'Likumiskais pārstāvis'], ['parent2', 'Otrs vecāks / pārstāvis'], ['emergency', 'Ārkārtas kontakts'], ['admin', 'Administratīvie dati']
  ];
  // k=atslēga, l=nosaukums, s=sadaļa, t=ievades tips, v=validācijas veids
  CP.FIELDS = [
    { k: 'first', l: 'Vārds', s: 'basic', req: 1, v: 'name' },
    { k: 'last', l: 'Uzvārds', s: 'basic', req: 1, v: 'name' },
    { k: 'status', l: 'Statuss', s: 'basic', t: 'select', opts: [['candidate', 'Kandidāts'], ['active', 'Jaunsargs'], ['paused', 'Pārtraukts']], noScan: 1 },
    { k: 'personalCode', l: 'Personas kods', s: 'basic', v: 'personalCode', sens: 1, ph: '000000-00000' },
    { k: 'birth', l: 'Dzimšanas datums', s: 'basic', t: 'date', v: 'date' },
    { k: 'gender', l: 'Dzimums', s: 'basic', t: 'select', opts: [['', 'Nav norādīts'], ['m', 'Zēns / jaunietis'], ['f', 'Meitene / jauniete']], noScan: 1 },
    { k: 'group', l: 'Grupa', s: 'study', list: 'dl_groups' },
    { k: 'joined', l: 'Iestāšanās datums', s: 'study', t: 'date', v: 'date' },
    { k: 'fromInstructor', l: 'Pārnācis no cita instruktora', s: 'study', ph: 'instruktors, vienība — ja pārnāca', noScan: 1 },
    { k: 'school', l: 'Mācību iestāde', s: 'study', v: 'place' },
    { k: 'schoolClass', l: 'Klase / kurss', s: 'study', v: 'schoolClass' },
    { k: 'phone', l: 'Tālrunis', s: 'contact', t: 'tel', v: 'phone' },
    { k: 'email', l: 'E-pasts', s: 'contact', t: 'email', v: 'email' },
    { k: 'addressDeclared', l: 'Deklarētā adrese', s: 'address', wide: 1, v: 'address' },
    { k: 'addressActual', l: 'Faktiskā adrese', s: 'address', wide: 1, v: 'address' },
    { k: 'parentName', l: 'Vārds, uzvārds', s: 'parent', v: 'fullname' },
    { k: 'parentRelation', l: 'Saistība', s: 'parent', ph: 'Māte, tēvs, aizbildnis…', list: 'dl_rel' },
    { k: 'parentCode', l: 'Personas kods', s: 'parent', v: 'personalCode', sens: 1, ph: '000000-00000' },
    { k: 'parentPhone', l: 'Tālrunis', s: 'parent', t: 'tel', v: 'phone' },
    { k: 'parentEmail', l: 'E-pasts', s: 'parent', t: 'email', v: 'email' },
    { k: 'parentAddressDeclared', l: 'Deklarētā adrese', s: 'parent', wide: 1, v: 'address' },
    { k: 'parentAddressActual', l: 'Faktiskā adrese', s: 'parent', wide: 1, v: 'address' },
    { k: 'parent2Name', l: 'Vārds, uzvārds', s: 'parent2', v: 'fullname' },
    { k: 'parent2Relation', l: 'Saistība', s: 'parent2', list: 'dl_rel' },
    { k: 'parent2Phone', l: 'Tālrunis', s: 'parent2', t: 'tel', v: 'phone' },
    { k: 'parent2Email', l: 'E-pasts', s: 'parent2', t: 'email', v: 'email' },
    { k: 'emergencyName', l: 'Vārds, uzvārds', s: 'emergency', v: 'fullname' },
    { k: 'emergencyPhone', l: 'Tālrunis', s: 'emergency', t: 'tel', v: 'phone' },
    { k: 'emergencyRelation', l: 'Radniecība', s: 'emergency', list: 'dl_rel' },
    // foto/video piekrišana netiek prasīta atsevišķi — to dod, parakstot līgumu (agrāk ievadītās vērtības ierakstos paliek)
    { k: 'retentionMonths', l: 'Glabāšana pēc izstāšanās (mēn.)', s: 'admin', t: 'number', noScan: 1 },
    { k: 'notes', l: 'Jauna piezīme (tiks pievienota piezīmju žurnālam)', s: 'admin', t: 'textarea', wide: 1 }
  ];
  CP.FIELD = Object.fromEntries(CP.FIELDS.map(f => [f.k, f]));

  CP.defaultSettings = () => ({
    countryCode: '371',
    waMode: 'web', sigMode: 'web',
    autosave: true,
    retentionDefault: 12,
    // glabāšanas termiņi (mēneši); izstājušos termiņš = retentionDefault. Skat. retention.js
    retention: { left: { act: 'anon', on: true, m: 12 }, cand: { m: 6, on: true }, med: { m: 3, on: true }, comms: { m: 24, on: true }, ext: { m: 12, on: true }, backups: { m: 6, on: true }, changelog: { m: 12, on: true } },
    docKinds: ['Pieteikuma anketa', 'Līgums', 'Ārsta izziņa', 'MTL aprites lapa', 'Jaunsarga apliecība', 'Pateicības raksts', 'Paskaidrojums', 'Cits'],
    requiredDocs: ['Pieteikuma anketa', 'Līgums', 'Ārsta izziņa'],
    registries: ['dvs', 'arhivs', 'eklase'], arhivsAdded: true,
    archiveDocs: ['Pieteikuma anketa', 'Līgums'],
    // pasākumu dokumenti: katram dalībniekam (visiem pasākumiem / nometnēm) un pasākumam kopīgie
    evDocsAll: ['Vecāku atļauja'], evDocsCamp: ['Dalībnieka aptaujas lapa'], evDocsEvent: ['Kopējā parakstu lapa'], evDocsEventCamp: ['Nometnes žurnāls (aizpildīts)'],
    // dokumenti ar derīguma termiņu: mēneši no izsniegšanas; schoolYear — derīgs tikai savā mācību gadā
    groupDays: {},
    absenceStreak: 3,
    quals: [],
    docValidity: { 'Ārsta izziņa': { months: 12, schoolYear: true } },
    templates: [
      { name: 'Brīva ziņa', text: 'Labdien, {saņēmējs}!\n\n' },
      { name: 'Trūkstošie dokumenti', text: 'Labdien, {saņēmējs}! Atgādinu, ka par {vārds} {uzvārds} vēl jāiesniedz: {trūkst}. Paldies!' },
      { name: 'Nodarbības atgādinājums', text: 'Labdien, {saņēmējs}! Atgādinu par nodarbību. Grupa: {grupa}.' },
      { name: 'Ekipējuma atdošana', text: 'Labdien, {saņēmējs}! Lūdzu atgriezt izsniegto ekipējumu: {ekipējums}. Paldies!' }
    ],
    tools: [{ name: 'E-klase', url: 'https://my.e-klase.lv/' }, { name: 'DVS', url: 'https://dvs.mod.gov.lv/' }],
    toolsAdded: ['dvs'],
    staff: [], formDefaults: { instrPosition: 'JSI', instrName: '', fillDates: true }, docTemplates: [],
    ocr: { engine: 'tesseract', googleKey: '', enhance: true, minConf: 65 },
    contactOrg: 'Jaunsardze',
    labelYouth: 'Jaunsardze – jaunsargi',
    labelParents: 'Jaunsardze – vecāki',
    formTemplates: [],
    activeTemplate: '',
    activeYear: '',
    stickyGroup: '',
    lastVisit: ''
  });

  CP.blank = () => ({
    version: CP.SCHEMA, people: [], documents: [], equipment: [], relations: [], log: [], tasks: [], audit: [], changelog: [],
    years: [], enrollments: [], events: [], sessions: [], schedule: [], scheduleDel: [],
    sources: [], nextFolderSeq: 1, revision: 0,
    settings: CP.defaultSettings(), createdAt: U.now(), updatedAt: null
  });

  /** Migrē datus no 0.2 (v2), 0.3 (v3), v4 un vecākām versijām uz v5. Nekas netiek dzēsts. */
  /** Piezīmes kā ierakstu žurnāls: p.noteLog / enrollment.noteLog = [{ id, at, text, editedAt }].
      Teksts, kas nonāk p.notes (imports, anketa, rediģēšanas logs) vai e.note, tiek pārnests uz žurnālu. */
  CP.flushNotes = (d, old) => {
    let n = 0;
    const move = (o, key, at) => {
      const t = String(o[key] ?? '').trim(); if (o[key] !== undefined && !t) { delete o[key]; return; } if (!t) return;
      const e = { id: U.uid(), at: U.now(), text: t };
      if (old && at) { e.at = /^\d{4}-\d{2}-\d{2}$/.test(at) ? at + 'T12:00:00' : at; e.dateOnly = true; }   // agrāk ievadīta: precīzs laiks nav zināms
      (o.noteLog = Array.isArray(o.noteLog) ? o.noteLog : []).push(e); delete o[key]; n++;
    };
    for (const p of d.people || []) if (p.notes !== undefined) move(p, 'notes', p.updatedAt || p.createdAt);
    for (const e of d.enrollments || []) if (e.note !== undefined) move(e, 'note', e.at ? String(e.at) : '');
    return n;
  };
  CP.migrate = raw => {
    const def = CP.defaultSettings();
    const d = { ...CP.blank(), ...raw };
    d.settings = { ...def, ...(raw.settings || {}) };
    d.settings.ocr = { ...def.ocr, ...(raw.settings?.ocr || {}) };
    for (const k of ['people', 'documents', 'equipment', 'relations', 'log', 'tasks', 'audit', 'changelog', 'sources', 'years', 'enrollments', 'events', 'sessions', 'schedule', 'scheduleDel', 'vfsTests']) if (!Array.isArray(d[k])) d[k] = [];
    for (const k of ['docKinds', 'requiredDocs', 'templates', 'tools', 'formTemplates', 'staff', 'docTemplates', 'registries', 'quals', 'archiveDocs', 'evDocsAll', 'evDocsCamp', 'evDocsEvent', 'evDocsEventCamp']) if (!Array.isArray(d.settings[k])) d.settings[k] = def[k];
    // jaunā atzīme “Centra arhīvs” — esošajām datu mapēm ieslēdz vienu reizi (lietotājs vēlāk var izslēgt)
    if (!raw.settings?.arhivsAdded) { if (!d.settings.registries.includes('arhivs')) d.settings.registries.splice(1, 0, 'arhivs'); d.settings.arhivsAdded = true; }
    d.settings.formDefaults = { ...def.formDefaults, ...(raw.settings?.formDefaults || {}) };
    d.settings.docValidity = { ...def.docValidity, ...(raw.settings?.docValidity || {}) };
    d.settings.retention = Object.fromEntries(Object.entries(def.retention).map(([k, v]) => [k, { ...v, ...((raw.settings?.retention || {})[k] || {}) }]));
    if ((raw.version || 2) < 4) {
      // Kartes saite personālvadībā nav vajadzīga
      d.settings.tools = d.settings.tools.filter(t => !/google\.[a-z.]+\/maps/i.test(t.url || ''));
    }
    // Jauni noklusētie rīki tiek pievienoti vienreiz (ja lietotājs tos izdzēš — atpakaļ netiek likti)
    const added = d.settings.toolsAdded = [...(raw.settings?.toolsAdded || (raw.settings ? [] : ['dvs']))];
    // “Vecāku piekrišana” nav atsevišķs dokuments — esošie ieraksti kļūst par “Vecāku atļauja”
    if (!added.includes('kind-noconsent')) { d.settings.docKinds = d.settings.docKinds.filter(k => k !== 'Vecāku piekrišana'); for (const x of d.documents || []) if (x.kind === 'Vecāku piekrišana') x.kind = 'Vecāku atļauja'; d.settings.requiredDocs = (d.settings.requiredDocs || []).map(k => k === 'Vecāku piekrišana' ? 'Vecāku atļauja' : k); added.push('kind-noconsent'); }
    if (!added.includes('kind-explain')) { if (!d.settings.docKinds.includes('Paskaidrojums')) d.settings.docKinds.splice(Math.max(0, d.settings.docKinds.indexOf('Cits')), 0, 'Paskaidrojums'); added.push('kind-explain'); }
    if (!added.includes('kind-idcard')) { if (!d.settings.docKinds.includes('Jaunsarga apliecība')) d.settings.docKinds.splice(Math.max(0, d.settings.docKinds.indexOf('Cits')), 0, 'Jaunsarga apliecība'); added.push('kind-idcard'); }
    if (!added.includes('dvs')) { if (!d.settings.tools.some(t => /dvs\.mod\.gov\.lv/i.test(t.url || ''))) d.settings.tools.push({ name: 'DVS', url: 'https://dvs.mod.gov.lv/' }); added.push('dvs'); }
    if (d.settings.ocr.engine !== 'google') d.settings.ocr.engine = d.settings.ocr.engine || 'tesseract';
    let seq = Number(d.nextFolderSeq) || 1;
    for (const p of d.people) {
      if (!p || typeof p !== 'object') continue;
      if (!p.status) p.status = 'active';
      if (!p.id) p.id = U.uid();
      const m = /^P(\d+)$/.exec(p.folderId || '');
      if (m) seq = Math.max(seq, Number(m[1]) + 1);
    }
    d.nextFolderSeq = seq;
    for (const s of d.sources) {
      if (!s || typeof s !== 'object') continue;
      if (!s.id) s.id = 'src_' + U.uid().replace(/-/g, '').slice(0, 12);
      if (!s.name) s.name = 'Mape';
      if (!s.addedAt) s.addedAt = d.createdAt || U.now();
    }
    if (typeof d.revision !== 'number' || !Number.isFinite(d.revision)) d.revision = 0;
    const yearIds = new Set();
    d.years = d.years.filter(y => y && /^(\d{4})-(\d{4})$/.test(y.id) && Number(y.id.slice(5)) === Number(y.id.slice(0, 4)) + 1 && !yearIds.has(y.id) && yearIds.add(y.id));
    const yDel = new Set(d.settings.yearsDeleted || []);   // lietotāja dzēstie gadi netiek atjaunoti
    for (const e of d.enrollments || []) if (e?.yearId) yDel.delete(e.yearId);
    d.settings.yearsDeleted = [...yDel];
    for (let y = 2017; y <= 2026; y++) {
      const id = U.yearId(y);
      if (!yearIds.has(id) && !yDel.has(id)) { d.years.push({ id, start: y, createdAt: null }); yearIds.add(id); }
    }
    d.years.forEach(y => { if (y.start == null) y.start = Number(y.id.slice(0, 4)); });
    d.years.sort((a, b) => a.start - b.start);
    const seenEn = new Set();
    d.enrollments = d.enrollments.filter(e => {
      if (!e || !e.personId || !e.yearId || seenEn.has(e.personId + '|' + e.yearId)) return false;
      seenEn.add(e.personId + '|' + e.yearId);
      if (!e.id) e.id = U.uid();
      if (e.group == null) e.group = '';
      if (!e.status) e.status = 'active';
      if (!e.at) e.at = d.createdAt || null;
      return true;
    });
    const curYear = U.schoolYear();
    if (!yearIds.has(curYear)) d.years.push({ id: curYear, start: U.schoolStart(), createdAt: U.now() });
    if (!d.settings.activeYear || !d.years.some(y => y.id === d.settings.activeYear)) d.settings.activeYear = curYear;
    const stampYear = (row, ...keys) => { if (!row || row.yearId) return; const y = keys.map(k => U.yearOfDate(row[k])).find(Boolean); if (y) row.yearId = y; };
    for (const doc of d.documents) stampYear(doc, 'received', 'addedAt');
    for (const eq of d.equipment) stampYear(eq, 'issued', 'changedAt');
    for (const t of d.tasks) stampYear(t, 'due', 'createdAt');
    for (const l of d.log) stampYear(l, 'at');
    CP.flushNotes(d, true);
    d.version = CP.SCHEMA;
    return d;
  };

  /** Pirms rakstīšanas: struktūra ir nolasāma un lauki nav sajaukti. Lieki lauki netiek noraidīti. */
  CP.validateDb = db => {
    if (!db || typeof db !== 'object' || Array.isArray(db)) throw Error('dati nav objekts');
    if (!Array.isArray(db.people)) throw Error('trūkst personu saraksta');
    for (const k of ['documents', 'equipment', 'relations', 'log', 'tasks', 'audit', 'sources', 'years', 'enrollments']) {
      if (db[k] != null && !Array.isArray(db[k])) throw Error('bojāts lauks: ' + k);
    }
    if (!db.settings || typeof db.settings !== 'object' || Array.isArray(db.settings)) throw Error('trūkst iestatījumu');
    const ids = new Set();
    for (const p of db.people) {
      if (!p || typeof p !== 'object' || !p.id) throw Error('personai trūkst identifikatora');
      if (ids.has(p.id)) throw Error('divas personas ar vienu identifikatoru');
      ids.add(p.id);
    }
    for (const doc of db.documents || []) if (!doc || typeof doc !== 'object' || !doc.id) throw Error('dokumentam trūkst identifikatora');
    return true;
  };

  /* ---------------- Kopīgais stāvoklis ---------------- */
  CP.state = {
    db: CP.migrate(CP.blank()),
    root: null, rootName: '', roots: [], index: [], pendingRoot: null,
    dirty: false, fileStamp: 0, loadedRevision: 0, conflict: false, saving: false, rev: 0,
    page: 'dashboard', tab: 'overview', selected: '', historyFilter: 'all',
    sideArchive: false, groupFilter: '', reveal: new Set(),
    list: { status: 'current', group: '', missing: false, q: '', sort: 'name', dir: 1, sel: new Set() },
    docsPage: { q: '', kind: '', show: 'linked' },
    browse: { pid: '', year: '', rel: '', q: '' },
    comms: { group: '', audience: 'parents', channel: 'whatsapp', tpl: 0, text: null, done: new Set(), ids: null }
  };
  CP.actions = {};
  CP.pages = {};
  CP.changeHandlers = [];
  CP.inputHandlers = [];

  /* ---------------- Domēna vaicājumi ---------------- */
  const D = {};
  const db = () => CP.state.db;
  D.person = id => db().people.find(p => p.id === id);
  D.isCurrent = p => p.status !== 'archived';
  D.activeYear = () => db().settings.activeYear || U.schoolYear();
  D.yearById = id => (db().years || []).find(y => y.id === id);
  D.enroll = (pid, yearId = D.activeYear()) => (db().enrollments || []).find(e => e.personId === pid && e.yearId === yearId) || null;
  D.enrollmentsOf = pid => (db().enrollments || []).filter(e => e.personId === pid).sort((a, b) => U.cmp(a.yearId, b.yearId));
  D.inYear = (p, yearId = D.activeYear()) => !!(p && D.enroll(p.id, yearId));
  D.peopleInYear = (yearId = D.activeYear()) => db().people.filter(p => D.inYear(p, yearId));
  D.groupOf = (p, yearId = D.activeYear()) => (p && D.enroll(p.id, yearId)?.group) || '';
  D.partStatus = (p, yearId = D.activeYear()) => {
    if (!p) return '';
    if (p.status === 'archived') return 'archived';
    return D.enroll(p.id, yearId)?.status || '';
  };
  D.unassignedPeople = () => db().people.filter(p => !D.enrollmentsOf(p.id).length);
  D.formPerson = p => {
    if (!p) return null;
    const e = D.enroll(p.id);
    return { ...p, group: e ? (e.group || '') : '', status: p.status === 'archived' ? 'archived' : (e?.status || 'active') };
  };
  /** Pievieno vai atjaunina tikai norādītā gada dalību. Citu gadu ieraksti paliek. */
  D.bindYear = (p, opts = {}) => {
    if (!p?.id) return null;
    const yearId = opts.yearId || D.activeYear();
    let e = D.enroll(p.id, yearId);
    if (!e) {
      e = { id: U.uid(), personId: p.id, yearId, group: '', status: p.status === 'archived' ? 'archived' : 'active', at: U.now(), note: opts.note || '', fromYearId: opts.fromYearId || '' };
      db().enrollments.push(e);
    }
    if (opts.group != null) e.group = opts.group;
    if (opts.status) e.status = opts.status;
    if (opts.note != null && opts.note !== '') e.note = opts.note;
    if (p.status === 'archived' && !opts.status) e.status = e.status || 'archived';
    return e;
  };
  /** Pieteiktās grupas (var būt arī tukšas): settings.groupsByYear = { yearId: [nosaukums] } */
  D.declaredGroups = (yearId = D.activeYear()) => ((db().settings.groupsByYear || {})[yearId] || []).filter(Boolean);
  D.setDeclaredGroups = (list, yearId = D.activeYear()) => { const s = db().settings; s.groupsByYear = { ...(s.groupsByYear || {}), [yearId]: [...new Set(list.map(x => String(x).trim()).filter(Boolean))].sort(U.cmp) }; };
  D.addGroup = name => { const n = String(name || '').trim(); if (!n) return false; if (D.groups().includes(n)) { if (!D.declaredGroups().includes(n)) D.setDeclaredGroups([...D.declaredGroups(), n]); return false; } D.setDeclaredGroups([...D.declaredGroups(), n]); return true; };
  D.groups = () => [...new Set([...D.peopleInYear().filter(D.isCurrent).map(p => D.groupOf(p)).filter(Boolean), ...D.declaredGroups()])].sort(U.cmp);
  D.contacts = p => [
    { kind: 'youth', role: 'Jaunietis', name: U.full(p), phone: p.phone, email: p.email },
    { kind: 'parent', role: p.parentRelation || 'Vecāks', name: p.parentName, phone: p.parentPhone, email: p.parentEmail },
    { kind: 'parent2', role: p.parent2Relation || 'Otrs vecāks', name: p.parent2Name, phone: p.parent2Phone, email: p.parent2Email },
    { kind: 'emergency', role: 'Ārkārtas' + (p.emergencyRelation ? ' · ' + p.emergencyRelation : ''), name: p.emergencyName, phone: p.emergencyPhone, email: '' }
  ].map((c, i) => ({ ...c, idx: i })).filter(c => U.normPhone(c.phone) || c.email);
  D.docsOf = p => db().documents.filter(d => d.personId === p.id);
  /* --- Derīguma termiņi (piem., ārsta izziņa: 12 mēn. un tikai savā mācību gadā) --- */
  /** Visas dokumentu kategorijas vienā sarakstā: iestatītās, pasākumu dokumenti un faktiski lietotās; “Cits” — beigās */
  D.allDocKinds = () => {
    const s = db().settings, out = [];
    const add = k => { k = String(k || '').trim(); if (k && k !== 'Cits' && !out.includes(k)) out.push(k); };
    (s.docKinds || []).forEach(add);
    [...(s.evDocsAll || []), ...(s.evDocsCamp || [])].forEach(add);   // dalībnieka pasākuma dokumenti (kopīgie pieder pasākumam)
    (db().documents || []).forEach(d => add(d.kind));
    return [...out, 'Cits'];
  };
  D.docRule = kind => (db().settings.docValidity || {})[kind] || null;
  D.docDate = d => String(d.issued || d.received || d.addedAt || '').slice(0, 10);
  /** Termiņš: ievadītais “derīgs līdz” vai izsniegšanas datums + N mēneši − 1 diena */
  D.docExpiry = d => { if (d.expires) return d.expires; const r = D.docRule(d.kind); if (!r?.months || !d.issued) return ''; const e = U.addMonths(d.issued, r.months); const x = new Date(e + 'T12:00:00'); x.setDate(x.getDate() - 1); return U.iso(x); };
  /** Vai dokuments der konkrētajam mācību gadam (izsniegts no 1. augusta pirms gada sākuma līdz gada beigām vai piesaistīts šim gadam) */
  D.docForYear = (d, yearId) => {
    const r = D.docRule(d.kind); if (!r?.schoolYear) return true;
    const [from, to] = U.yearSpan(yearId), dt = D.docDate(d); if (!from) return true;
    if (dt) { const f = new Date(from + 'T12:00:00'); f.setMonth(f.getMonth() - 1); return dt >= U.iso(f) && dt <= to; }
    return !d.yearId || d.yearId === yearId;   // bez datumiem un gada — neuzskata par nederīgu
  };
  D.docValid = (d, yearId = D.activeYear(), today = U.iso()) => { const e = D.docExpiry(d); return !(e && e < today) && D.docForYear(d, yearId); };
  D.missingDocs = p => (db().settings.requiredDocs || []).filter(k => !db().documents.some(d => d.personId === p.id && d.kind === k && d.path && D.docValid(d)));   // obligātajam dokumentam jābūt skenētam failam (to liek arī DVS)
  D.openEquipment = p => db().equipment.filter(e => e.personId === p.id && !e.returned && !e.keep);
  D.commSent = l => l.type === 'call' || (['whatsapp', 'signal', 'sms', 'email'].includes(l.type) && (!l.status || l.status === 'confirmed'));
  D.lastContact = () => {
    const m = {};
    for (const l of db().log) if (D.commSent(l) && (!m[l.personId] || m[l.personId] < l.at)) m[l.personId] = l.at;
    return m;
  };
  D.fillTpl = (text, p, c) => {
    const map = {
      'vārds': p.first, 'uzvārds': p.last, 'pilns': U.full(p), 'grupa': D.groupOf(p), 'vecāks': p.parentName, 'saņēmējs': c?.name || '',
      'datums': new Date().toLocaleDateString('lv-LV'), 'trūkst': D.missingDocs(p).join(', ') || '—',
      'ekipējums': D.openEquipment(p).map(e => e.item).join(', ') || '—'
    };
    return String(text || '').replace(/\{([^}]+)\}/g, (m, k) => k in map ? (map[k] || '') : m).replace(/,\s*!/g, '!');
  };
  D.guessKind = name => {
    const n = U.norm(name), kinds = D.allDocKinds();
    const rules = [[/anket|pieteikum/, 'Pieteikuma anketa'], [/ligum/, 'Līgums'], [/izzin|arst|medic|026/, 'Ārsta izziņa'], [/mtl|aprit/, 'MTL aprites lapa'], [/piekris|atlauj/, 'Vecāku atļauja'], [/pateic/, 'Pateicības raksts'], [/paskaidr/, 'Paskaidrojums']];
    for (const [r, k] of rules) if (r.test(n) && kinds.includes(k)) return k;
    return kinds.includes('Cits') ? 'Cits' : kinds[0];
  };
  D.familyKeys = k => [U.normPhone(k.parentPhone), U.normPhone(k.parent2Phone), U.norm(k.parentEmail), U.norm(k.parent2Email), U.codeDigits(k.parentCode)].filter(x => x && x.length > 5);
  D.family = p => { const mine = new Set(D.familyKeys(p)); return mine.size ? db().people.filter(o => o.id !== p.id && D.familyKeys(o).some(k => mine.has(k))) : []; };
  D.duplicates = (o, exceptId) => {
    const key = U.norm(o.first) + '|' + U.norm(o.last), code = U.codeDigits(o.personalCode);
    return db().people.filter(p => p.id !== exceptId && ((code.length === 11 && U.codeDigits(p.personalCode) === code) || (U.norm(p.first) + '|' + U.norm(p.last) === key && (!o.birth || !p.birth || o.birth === p.birth))));
  };
  /* --- MTL aprites lapa: vajadzīga tikai, ja izsniegts ekipējums --- */
  D.MTL = 'MTL aprites lapa';
  const docStamp = d => d.addedAt || (d.received ? d.received + 'T23:59:59' : '');
  D.mtlStatus = p => {
    const eqs = db().equipment.filter(e => e.personId === p.id && !e.keep), open = eqs.filter(e => !e.returned);   // nozīmītes (keep) MTL lapā neskaitās
    const all = db().documents.filter(d => d.personId === p.id && d.kind === D.MTL).sort((a, b) => docStamp(b).localeCompare(docStamp(a)));
    const latest = all[0];
    const lastChange = eqs.map(e => [e.changedAt || '', e.issued ? e.issued + 'T00:00:00' : '', e.returned ? e.returned + 'T00:00:00' : ''].sort().at(-1)).sort().at(-1) || '';
    if (!eqs.length) return { state: 'none', all, latest };
    if (!latest) return { state: open.length ? 'missing' : 'none', all, lastChange };
    if (docStamp(latest) < lastChange) return { state: 'outdated', all, latest, lastChange };
    return { state: 'ok', all, latest };
  };

  /* --- Tālruņu salīdzināšana starp visām personām --- */
  D.PHONE_FIELDS = { phone: 'jaunieša tālrunis', parentPhone: 'vecāka tālrunis', parent2Phone: 'otra vecāka tālrunis', emergencyPhone: 'ārkārtas kontakta tālrunis' };
  D.phoneIndex = () => {
    const m = new Map();
    for (const p of db().people) for (const f of Object.keys(D.PHONE_FIELDS)) {
      const n = U.normPhone(p[f]); if (!n) continue;
      if (!m.has(n)) m.set(n, []); m.get(n).push({ p, f, role: D.PHONE_FIELDS[f] });
    }
    return m;
  };
  /** Kur vēl šis numurs ir izmantots (izņemot pašas personas to pašu lauku) */
  D.phoneMatches = (num, selfId, selfField) => {
    const n = U.normPhone(num); if (!n) return [];
    return (D.phoneIndex().get(n) || []).filter(e => !(e.p.id === selfId && e.f === selfField));
  };
  /** Vai sakritība ir aizdomīga: jaunieša numurs sakrīt ar citu numuru; vecāku kopīgs numurs = ģimene (normāli) */
  /** Kam pieder numurs: jaunietim — viņa vārds, vecākam — vecāka vārds utt. */
  D.phoneOwner = (p, f) => U.norm(f === 'phone' ? U.full(p) : p[f.replace('Phone', 'Name')]);
  /** Aizdomīgi, ja vienam numuram ir dažādi īpašnieki (dažādi vārdi). Viens vecāks vairākiem bērniem — normāli. */
  D.phoneSuspicious = entries => new Set(entries.map(e => D.phoneOwner(e.p, e.f)).filter(Boolean)).size > 1;
  D.phoneConflicts = () => [...D.phoneIndex()].map(([num, entries]) => ({ num, entries, suspicious: D.phoneSuspicious(entries) }))
    .filter(g => g.entries.length > 1 && (new Set(g.entries.map(e => e.p.id)).size > 1 || g.suspicious))
    .sort((a, b) => b.suspicious - a.suspicious || b.entries.length - a.entries.length);

  D.log = (personId, type, detail, extra = {}) => db().log.push({ id: U.uid(), personId, at: U.now(), type, detail: String(detail || '').slice(0, 600), ...extra });
  D.audit = (personId, action, fields = []) => db().audit.push({ id: U.uid(), personId, at: U.now(), action, fields });

  D.alerts = () => {
    const a = [], today = U.iso(), d = db(), yearId = D.activeYear(), live = yearId === U.schoolYear();
    const [from, to] = U.yearSpan(yearId);
    const inSpan = iso => { const s = String(iso || '').slice(0, 10); return !!from && s >= from && s <= to; };
    const push = row => a.push({ ...row, year: yearId });
    const roster = d.people.filter(p => D.inYear(p));
    for (const t of d.tasks) if (!t.done && t.due && D.inYear(D.person(t.personId)) && (live ? U.daysTo(t.due) <= 7 : inSpan(t.due))) {
      const p = D.person(t.personId); push({ kind: 'task', personId: t.personId, taskId: t.id, sev: U.daysTo(t.due) < 0 ? 2 : 1, msg: `${p ? U.full(p) + ': ' : ''}${t.text}`, when: t.due });
    }
    for (const p of roster) {
      if (p.status === 'archived') continue;   // glabāšanas termiņi — viens kopsavilkums zemāk (retention.js)
      if (p.birth && live) {
        const n = U.daysUntilBirthday(p.birth);
        if (n !== null && n <= 7) push({ kind: 'birthday', personId: p.id, sev: 0, msg: `${U.full(p)} — dzimšanas diena ${n === 0 ? 'šodien' : 'pēc ' + n + ' d.'} (${(U.age(p.birth) || 0) + (n === 0 ? 0 : 1)} g.)`, when: '' });
      } else if (p.birth && !live) {
        const md = p.birth.slice(5), y = md >= '09-01' ? Number(yearId.slice(0, 4)) : Number(yearId.slice(5));
        const when = `${y}-${md}`;
        if (inSpan(when)) push({ kind: 'birthday', personId: p.id, sev: 0, msg: `${U.full(p)} — dzimšanas diena šajā mācību gadā`, when });
      }
    }
    for (const e of d.equipment) if (!e.returned && !e.keep && D.inYear(D.person(e.personId))) {
      const p = D.person(e.personId), diff = e.due ? U.daysTo(e.due) : null;
      if (!live && !(e.due && inSpan(e.due))) continue;
      if (p?.status === 'archived') push({ kind: 'equipment', personId: e.personId, sev: 2, msg: `${U.full(p)} ir arhīvā, bet nav atdots: ${e.item}`, when: e.due });
      else if (diff !== null && (live ? diff <= 14 : inSpan(e.due))) push({ kind: 'equipment', personId: e.personId, sev: diff < 0 ? 2 : 1, msg: `${U.full(p)}: ${e.item} — ${live ? (diff < 0 ? 'kavēts ' + (-diff) + ' d.' : 'jāatdod pēc ' + diff + ' d.') : 'atdošanas termiņš šajā gadā'}`, when: e.due });
    }
    for (const doc of d.documents) if (doc.expires && !D.docRule(doc.kind) && D.inYear(D.person(doc.personId)) && D.person(doc.personId)?.status !== 'archived' && (live ? U.daysTo(doc.expires) <= 30 : inSpan(doc.expires))) {
      const p = D.person(doc.personId), diff = U.daysTo(doc.expires);
      push({ kind: 'document', personId: doc.personId, sev: diff < 0 ? 2 : 1, msg: `${U.full(p)}: ${doc.kind} — ${live ? (diff < 0 ? 'beidzies derīgums' : 'derīgs vēl ' + diff + ' d.') : 'derīgums šajā mācību gadā'}`, when: doc.expires });
    }
    if (live) {
      for (const p of roster) if (p.status !== 'archived') {
        const m = D.mtlStatus(p);
        if (m.state === 'missing') push({ kind: 'mtl', personId: p.id, sev: 1, msg: `${U.full(p)}: izsniegts ekipējums, bet nav MTL aprites lapas`, when: '' });
        if (m.state === 'outdated') push({ kind: 'mtl', personId: p.id, sev: 1, msg: `${U.full(p)}: MTL aprites lapa nav atjaunota pēc izmaiņām ekipējumā`, when: (m.lastChange || '').slice(0, 10) });
      }
      if (D.regAlerts) for (const r of D.regAlerts(roster)) push(r);
      if (D.attAlerts) for (const r of D.attAlerts(roster)) push(r);
      // dokumenti ar derīguma noteikumiem (ārsta izziņa)
      for (const [kind, rule] of Object.entries(d.settings.docValidity || {})) for (const p of roster) {
        if (p.status === 'archived' || D.partStatus(p) === 'paused') continue;
        const docs = d.documents.filter(x => x.personId === p.id && x.kind === kind).sort((a, b) => D.docDate(b).localeCompare(D.docDate(a)));
        if (!docs.length) continue;
        const cur = docs.find(x => D.docForYear(x, yearId)), who = U.full(p), kl = kind.toLowerCase();
        if (!cur) { const last = docs[0]; push({ kind: 'document', personId: p.id, sev: 1, msg: `${who}: jaunajā mācību gadā jāiesniedz jauna ${kl}${D.docDate(last) ? ` (iepriekšējā: ${U.fmtDate(D.docDate(last))})` : ''}`, when: '' }); continue; }
        if (!cur.issued && !cur.expires) { push({ kind: 'document', personId: p.id, docId: cur.id, sev: 1, msg: `${who}: ${kl} — nav norādīts izsniegšanas datums. Norādi to, lai rīks atgādinātu par termiņu.`, when: '' }); }
        const exp = D.docExpiry(cur), [, yEnd] = U.yearSpan(yearId);
        if (exp) { const n = U.daysTo(exp); if (n < 0) { push({ kind: 'document', personId: p.id, docId: cur.id, sev: 2, msg: `${who}: ${kl} — beidzies derīgums (${U.fmtDate(exp)})`, when: exp }); continue; } if (n <= 30) push({ kind: 'document', personId: p.id, docId: cur.id, sev: 1, msg: `${who}: ${kl} — derīga vēl ${n} d. (līdz ${U.fmtDate(exp)})`, when: exp }); }
        if (rule.schoolYear && yEnd && today >= yEnd.slice(0, 4) + '-05-01' && today <= yEnd) push({ kind: 'document', personId: p.id, docId: cur.id, sev: 0, msg: `${who}: ${kl} derīga līdz mācību gada beigām — nākamajam mācību gadam vajadzēs jaunu`, when: yEnd });
      }
      if (D.idCardAlerts) for (const r of D.idCardAlerts(roster.filter(p => p.status !== 'archived' || p.idCard?.status === 'issued'))) push(r);
      for (const g of D.phoneConflicts()) if (g.suspicious && g.entries.some(e => D.inYear(e.p))) {
        const who = [...new Map(g.entries.map(e => [e.p.id, e.p])).values()];
        push({ kind: 'phone', personId: who[0].id, sev: 1, msg: `Tālrunis ${U.prettyPhone(g.num)} norādīts dažādām personām: ${g.entries.map(e => e.f === 'phone' ? `${U.full(e.p)} (jaunietis)` : `${e.p[e.f.replace('Phone', 'Name')] || '?'} (${e.role}, ${U.full(e.p)})`).join('; ')}`, when: '' });
      }
    }
    if (live && CP.retention) { const n = CP.retention.dueCount(); if (n) push({ kind: 'retention', page: 'retention', top: 1, sev: 1, msg: `Beidzies datu glabāšanas termiņš: ${n} ${n % 10 === 1 && n % 100 !== 11 ? 'ieraksts' : 'ieraksti'} — pārskatīt (anonimizēt vai dzēst)`, when: '' }); }
    return a.sort((x, y) => (y.top || 0) - (x.top || 0) || y.sev - x.sev || String(x.when || '9').localeCompare(String(y.when || '9')));
  };
  CP.data = D;
})(window.CP);
