/* CADET PERSONĀLS — apvienots no 35 failiem (avots: mape js/). Nelabo šo failu — labo js/ un būvē no jauna. */

/* ==== js/core.js ==== */
/* =====================================================================
   CADET PERSONĀLS — kodols
   Palīgfunkcijas, validācija, datu shēma, migrācijas, kopīgais stāvoklis
   un domēna vaicājumi (kontakti, trūkstošie dokumenti, brīdinājumi).
   Visi moduļi lieto vienu vārdtelpu window.CP (darbojas arī no file://).
   ===================================================================== */
window.CP = window.CP || {};
(function (CP) {
  'use strict';

  CP.VERSION = '1.30.0';
  /** “Ziņot” sūtīšanas adrese: izstrādātāja Google Apps Script tīmekļa lietotne (…/exec). Tukša → tikai “Saglabāt failā”. */
  CP.FEEDBACK_URL = '';
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
  U.daysTo = s => Math.ceil((new Date(s + 'T12:00:00') - new Date(U.iso() + 'T12:00:00')) / 86400000);
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
        return { ok: true, value: (s === s.toUpperCase() || s === s.toLowerCase()) ? titleCase(s) : s };
      }
      case 'fullname': {
        const s = v.replace(/\s+/g, ' ');
        if (!LETTERS.test(s) || s.split(' ').length < 2 || s.length > 60) return { ok: false, msg: 'vajag vārdu un uzvārdu' };
        return { ok: true, value: (s === s.toUpperCase() || s === s.toLowerCase()) ? titleCase(s) : s };
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
  CP.FILE_STATUS = { available: 'Pieejams', noaccess: 'Nav piekļuves', missing: 'Nav atrasts', check: 'Jāpārbauda' };

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
    { k: 'group', l: 'Grupa', s: 'study', list: 'dl_groups' },
    { k: 'joined', l: 'Iestāšanās datums', s: 'study', t: 'date', v: 'date' },
    { k: 'school', l: 'Mācību iestāde', s: 'study' },
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
    { k: 'photoConsent', l: 'Foto/video publicēšana', s: 'admin', t: 'select', opts: [['', 'Nav zināms'], ['yes', 'Piekrīt'], ['no', 'Nepiekrīt']] },
    { k: 'photoConsentDate', l: 'Piekrišanas datums', s: 'admin', t: 'date', v: 'date' },
    { k: 'retentionMonths', l: 'Glabāšana pēc izstāšanās (mēn.)', s: 'admin', t: 'number', noScan: 1 },
    { k: 'notes', l: 'Jauna piezīme (tiks pievienota piezīmju žurnālam)', s: 'admin', t: 'textarea', wide: 1 }
  ];
  CP.FIELD = Object.fromEntries(CP.FIELDS.map(f => [f.k, f]));

  CP.defaultSettings = () => ({
    countryCode: '371',
    waMode: 'web',
    autosave: true,
    retentionDefault: 12,
    docKinds: ['Pieteikuma anketa', 'Līgums', 'Ārsta izziņa', 'MTL aprites lapa', 'Jaunsarga apliecība', 'Vecāku piekrišana', 'Pateicības raksts', 'Cits'],
    requiredDocs: ['Pieteikuma anketa', 'Līgums', 'Ārsta izziņa'],
    registries: ['dvs', 'eklase'],
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
    version: CP.SCHEMA, people: [], documents: [], equipment: [], relations: [], log: [], tasks: [], audit: [],
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
    for (const k of ['people', 'documents', 'equipment', 'relations', 'log', 'tasks', 'audit', 'sources', 'years', 'enrollments', 'events', 'sessions', 'schedule', 'scheduleDel']) if (!Array.isArray(d[k])) d[k] = [];
    for (const k of ['docKinds', 'requiredDocs', 'templates', 'tools', 'formTemplates', 'staff', 'docTemplates', 'registries', 'quals']) if (!Array.isArray(d.settings[k])) d.settings[k] = def[k];
    d.settings.formDefaults = { ...def.formDefaults, ...(raw.settings?.formDefaults || {}) };
    d.settings.docValidity = { ...def.docValidity, ...(raw.settings?.docValidity || {}) };
    if ((raw.version || 2) < 4) {
      // Kartes saite personālvadībā nav vajadzīga
      d.settings.tools = d.settings.tools.filter(t => !/google\.[a-z.]+\/maps/i.test(t.url || ''));
    }
    // Jauni noklusētie rīki tiek pievienoti vienreiz (ja lietotājs tos izdzēš — atpakaļ netiek likti)
    const added = d.settings.toolsAdded = [...(raw.settings?.toolsAdded || (raw.settings ? [] : ['dvs']))];
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
    for (let y = 2017; y <= 2026; y++) {
      const id = U.yearId(y);
      if (!yearIds.has(id)) { d.years.push({ id, start: y, createdAt: null }); yearIds.add(id); }
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
  D.missingDocs = p => (db().settings.requiredDocs || []).filter(k => !db().documents.some(d => d.personId === p.id && d.kind === k && D.docValid(d)));
  D.openEquipment = p => db().equipment.filter(e => e.personId === p.id && !e.returned);
  D.commSent = l => l.type === 'call' || (['whatsapp', 'sms', 'email'].includes(l.type) && (!l.status || l.status === 'confirmed'));
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
    const n = U.norm(name), kinds = db().settings.docKinds;
    const rules = [[/anket|pieteikum/, 'Pieteikuma anketa'], [/ligum/, 'Līgums'], [/izzin|arst|medic|026/, 'Ārsta izziņa'], [/mtl|aprit/, 'MTL aprites lapa'], [/piekris|atlauj/, 'Vecāku piekrišana'], [/pateic/, 'Pateicības raksts']];
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
    const eqs = db().equipment.filter(e => e.personId === p.id), open = eqs.filter(e => !e.returned);
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
      if (p.status === 'archived') {
        if (!live) continue;
        const due = U.addMonths(p.left, p.retentionMonths ?? d.settings.retentionDefault);
        if (due && due <= today) push({ kind: 'retention', personId: p.id, sev: 1, msg: `Beidzies glabāšanas termiņš — pārskatīt datus (netiek dzēsti automātiski): ${U.full(p)}`, when: due });
        continue;
      }
      if (p.birth && live) {
        const n = U.daysUntilBirthday(p.birth);
        if (n !== null && n <= 7) push({ kind: 'birthday', personId: p.id, sev: 0, msg: `${U.full(p)} — dzimšanas diena ${n === 0 ? 'šodien' : 'pēc ' + n + ' d.'} (${(U.age(p.birth) || 0) + (n === 0 ? 0 : 1)} g.)`, when: '' });
        if (U.age(p.birth) < 18) {
          const b = new Date(p.birth + 'T12:00:00'); b.setFullYear(b.getFullYear() + 18); const diff = U.daysTo(U.iso(b));
          if (diff >= 0 && diff <= 60) push({ kind: 'adult', personId: p.id, sev: 0, msg: `${U.full(p)} — pilngadība pēc ${diff} d. (pārskatīt pārstāvja tiesības)`, when: U.iso(b) });
        }
      } else if (p.birth && !live) {
        const md = p.birth.slice(5), y = md >= '09-01' ? Number(yearId.slice(0, 4)) : Number(yearId.slice(5));
        const when = `${y}-${md}`;
        if (inSpan(when)) push({ kind: 'birthday', personId: p.id, sev: 0, msg: `${U.full(p)} — dzimšanas diena šajā mācību gadā`, when });
        const adult = new Date(p.birth + 'T12:00:00'); adult.setFullYear(adult.getFullYear() + 18);
        if (inSpan(U.iso(adult))) push({ kind: 'adult', personId: p.id, sev: 0, msg: `${U.full(p)} — pilngadība šajā mācību gadā`, when: U.iso(adult) });
      }
    }
    for (const e of d.equipment) if (!e.returned && D.inYear(D.person(e.personId))) {
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
    return a.sort((x, y) => y.sev - x.sev || String(x.when || '9').localeCompare(String(y.when || '9')));
  };
  CP.data = D;
})(window.CP);


/* ==== js/icons.js ==== */
/* =====================================================================
   Ikonas un tēma (dizains v2).
   Vienots līniju ikonu komplekts — 24×24, apaļi gali, krāsa = currentColor.
   Ieslēdzas ar <meta name="cp-design" content="v2">; bez tā rīks izskatās kā līdz šim.
   ===================================================================== */
(function (CP) {
  'use strict';
  const P = {
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.8a3.2 3.2 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',
    message: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"/><path d="M8 8.5h8M8 11.5h5"/>',
    file: '<path d="M6.5 2.8h7L18.5 8v11.2a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2V4.8a2 2 0 0 1 2-2z"/><path d="M13.5 2.8V8h5M8 12.5h7M8 16h5"/>',
    files: '<path d="M8 6.5V5a2 2 0 0 1 2-2h6l4 4v9.5a2 2 0 0 1-2 2h-1.5"/><path d="M5.5 7h6l3.5 3.5V19a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/>',
    fileAlert: '<path d="M6.5 2.8h7L18.5 8v11.2a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2V4.8a2 2 0 0 1 2-2z"/><path d="M13.5 2.8V8h5M11.5 11v4M11.5 17.8v.1"/>',
    backpack: '<path d="M6.5 8.5a5.5 5.5 0 0 1 11 0v11a1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M9.5 6.5V5a2.5 2.5 0 0 1 5 0v1.5M6.5 13.5h11M10 13.5v2.5h4v-2.5"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    archive: '<rect x="3" y="4" width="18" height="4.5" rx="1.5"/><path d="M5 8.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5M10 12.5h4"/>',
    sliders: '<path d="M4 7h9M17.5 7H20M4 17h2.5M11 17h9"/><circle cx="15.2" cy="7" r="2.3"/><circle cx="8.8" cy="17" r="2.3"/>',
    scan: '<path d="M3.5 8V6A2.5 2.5 0 0 1 6 3.5h2M16 3.5h2A2.5 2.5 0 0 1 20.5 6v2M20.5 16v2a2.5 2.5 0 0 1-2.5 2.5h-2M8 20.5H6A2.5 2.5 0 0 1 3.5 18v-2M7 12h10"/>',
    userPlus: '<circle cx="10" cy="8" r="3.8"/><path d="M3 20c.7-3.8 3.6-5.8 7-5.8 1.4 0 2.7.3 3.8 1M18 14v6M15 17h6"/>',
    userCheck: '<circle cx="10" cy="8" r="3.8"/><path d="M3 20c.7-3.8 3.6-5.8 7-5.8 1.6 0 3 .4 4.1 1.2M15 18l2 2 4-4.5"/>',
    userClock: '<circle cx="10" cy="8" r="3.8"/><path d="M3 20c.7-3.8 3.6-5.8 7-5.8"/><circle cx="17.5" cy="17.5" r="3.5"/><path d="M17.5 16v1.7l1.1.8"/>',
    megaphone: '<path d="M3.5 10v4a1 1 0 0 0 1 1H7l7 4.5v-15L7 9H4.5a1 1 0 0 0-1 1z"/><path d="M17.5 9a4 4 0 0 1 0 6M7.5 15l1 5"/>',
    upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4.5 15v3A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-3"/>',
    external: '<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    layout: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M3.5 9.5h17M9.5 9.5v11"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r=".9"/><circle cx="4.8" cy="12" r=".9"/><circle cx="4.8" cy="17.5" r=".9"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    idcard: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><circle cx="8.5" cy="11" r="2.2"/><path d="M5.2 16c.5-1.6 1.8-2.4 3.3-2.4s2.8.8 3.3 2.4M14.5 10h4.5M14.5 13.5h3"/>',
    clipboard: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5v-.7a1.3 1.3 0 0 1 1.3-1.3h3.4A1.3 1.3 0 0 1 15 3.8v.7M8.5 11l1.5 1.5 3-3M8.5 16.5h7"/>',
    phone: '<path d="M5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 3 5.7 2 2 0 0 1 5 3.5z"/>',
    task: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="m8 12 3 3 5-6"/>',
    cake: '<path d="M4 20.5h16M5 20.5v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M5 15.5c1.2 1 2.3 1 3.5 0s2.3-1 3.5 0 2.3 1 3.5 0 2.3-1 3.5 0M12 11.5V8"/><path d="M12 5.8c-.9-1-.9-2.1 0-3.3.9 1.2.9 2.3 0 3.3z"/>',
    adult: '<circle cx="12" cy="12" r="8.5"/><text x="12" y="15.3" text-anchor="middle" font-size="8.6" font-weight="800" fill="currentColor" stroke="none">18</text>',
    camera: '<path d="M4.5 7.5h3L9 5h6l1.5 2.5h3A1.5 1.5 0 0 1 21 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V9a1.5 1.5 0 0 1 1.5-1.5z"/><circle cx="12" cy="13" r="3.5"/>',
    folder: '<path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    save: '<path d="M5 3.5h11l3.5 3.5v11.5a2 2 0 0 1-2 2H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5z"/><path d="M8 3.5v5h7v-5M7.5 20.5v-6h9v6"/>',
    edit: '<path d="M14.5 5.5l4 4M4 20l1-4.5L15.8 4.7a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L8.5 19z"/>',
    chat: '<path d="M20.5 11.5a8 8 0 0 1-11.8 7L3.5 20l1.5-4.8A8 8 0 1 1 20.5 11.5z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/>',
    contactCard: '<rect x="4" y="3" width="15" height="18" rx="2.5"/><circle cx="11.5" cy="10" r="2.6"/><path d="M7.5 17c.6-2 2.1-3 4-3s3.4 1 4 3M19 7h1.5M19 12h1.5"/>',
    clip: '<path d="M20 11.5 12 19.5a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>',
    unlock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 7.7-1.5M12 14.5v2.5"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 15v3A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-3"/>',
    alert: '<path d="M10.3 4.2 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.5M12 17.2v.1"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    inbox: '<path d="M3.5 13.5 6 5.5a1.5 1.5 0 0 1 1.4-1h9.2a1.5 1.5 0 0 1 1.4 1l2.5 8v4.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 13.5h5l1 2.5h5l1-2.5h5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    mobile: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
    folderOpen: '<path d="M3.5 18V7a2 2 0 0 1 2-2h4l2 2.5h6a2 2 0 0 1 2 2v1.5"/><path d="M3.5 18l2.3-6.2a1.5 1.5 0 0 1 1.4-1h13.3a1 1 0 0 1 .9 1.4L19 17.6a2 2 0 0 1-1.8 1.4H5a1.5 1.5 0 0 1-1.5-1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>',
    chart: '<path d="M3.5 20.5h17"/><path d="m4.5 16 4.5-5 3.5 3 6.5-7.5"/><path d="M15 6.5h4v4"/>',
    flag: '<path d="M5.5 21V4"/><path d="M5.5 4.5h11.5l-2.2 4.2 2.2 4.3H5.5"/>',
    award: '<circle cx="12" cy="9" r="5.5"/><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7"/>',
    user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.4 7.5 9.5 4.4-1.1 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>'
  };
  CP.ICON_NAMES = Object.keys(P);
  CP.D2 = ((document.querySelector('meta[name="cp-design"]') || {}).content || '') === 'v2';
  /** Ikona kā SVG (dizainā v2) vai iepriekšējais simbols (fallback) */
  CP.ic = (name, fallback = '') => CP.D2 && P[name] ? `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[name]}</svg>` : fallback;
  /** Statiskajā HTML: <span data-ic="grid">▦</span> → ikona */
  CP.hydrateIcons = (root = document) => { if (!CP.D2) return; root.querySelectorAll('[data-ic]').forEach(el => { if (!el.dataset.icDone) { el.innerHTML = CP.ic(el.dataset.ic, el.innerHTML); el.dataset.icDone = '1'; } }); };

  /* Pogu sākuma simboli → ikonas (v2). Teksts paliek; simbols tiek aizstāts tikai vizuāli. */
  const EMO = { '＋': 'plus', '➕': 'plus', '⬇': 'download', '⚠': 'alert', '📎': 'clip', '✉': 'message', '🔓': 'unlock', '📁': 'folder', '📂': 'folderOpen', '📄': 'file', '💬': 'chat',
    '📇': 'contactCard', '📷': 'scan', '↻': 'refresh', '⟳': 'refresh', '☎': 'phone', '📞': 'phone', '✎': 'edit', '📥': 'inbox', '⬆': 'upload', '📱': 'mobile', '💾': 'save', '↗': 'external', '🔔': 'bell', '📅': 'calendar', '⧉': 'copy', '🪪': 'idcard', '⇩': 'download', '←': 'back' };
  const EMO_RE = new RegExp('^\\s*(' + Object.keys(EMO).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\uFE0F?\\s*');
  CP.iconize = (root = document) => {
    if (!CP.D2) return;
    root.querySelectorAll('button, a.btn, .btn, label.btn, h2, h3, b').forEach(el => {
      const t = el.firstChild; if (!t || t.nodeType !== 3) return;
      const m = t.nodeValue.match(EMO_RE); if (!m) return;
      t.nodeValue = t.nodeValue.slice(m[0].length);
      el.insertAdjacentHTML('afterbegin', CP.ic(EMO[m[1]]) + (t.nodeValue.trim() ? '' : ''));
    });
  };

  /* --- Tēma: tumšā (noklusējums) / gaišā / kā sistēmā. Pārlūkā, nevis datu failā. --- */
  /* Izskats glabājas pārlūkā (ātrai ielādei) un datu failā (lai citā datorā ir tāds pats). */
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ērtībai */ } } };
  const look = () => (CP.state && CP.state.db && CP.state.db.settings && CP.state.db.settings.look) || {};
  function remember(k, v) {
    ls.set('cp-' + k, v);
    const st = CP.state?.db?.settings; if (!st) return;
    st.look = { ...(st.look || {}), [k]: v };
    if (CP.state.root) CP.store.changed({ silent: true });
  }
  const HEX = /^#[0-9a-f]{6}$/i;
  CP.DEFAULT_ACCENT = '#4f9cff';   // noklusējums: zils (tēma — tumšā)
  CP.ACCENTS = [['#3ccf7e', 'Zaļš'], ['#7cb342', 'Meža'], ['#2ec4b6', 'Tirkīzs'], ['#4f9cff', 'Zils'], ['#7c83ff', 'Indigo'], ['#a879ff', 'Violets'], ['#f472b6', 'Rozā'], ['#ef5b5b', 'Sarkans'], ['#ff9f43', 'Oranžs'], ['#e6b422', 'Zelts'], ['#94a3a0', 'Pelēks']];
  /** Teksta krāsa uz akcenta pogas: balta vai tumša pēc kontrasta (WCAG relatīvais spilgtums) */
  function inkFor(hex, factor) {
    // pogas fons = akcents × factor (sajaukts ar melnu): 0,72 tumšajā, 0,88 gaišajā tēmā
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255 * factor).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return 1.05 / (L + 0.05) >= 3.2 ? '#ffffff' : '#0e1512';
  }
  CP.theme = {
    get() { return ls.get('cp-theme') || look().theme || 'dark'; },
    set(v) { remember('theme', v); CP.theme.apply(); },
    accent() { const v = ls.get('cp-accent') || look().accent || CP.DEFAULT_ACCENT; return HEX.test(v) ? v : CP.DEFAULT_ACCENT; },
    setAccent(v) { if (!HEX.test(v)) return; remember('accent', v.toLowerCase()); CP.theme.apply(); },
    apply() {
      if (!CP.D2) return;
      const v = CP.theme.get(), light = v === 'light' || (v === 'auto' && matchMedia('(prefers-color-scheme: light)').matches);
      const root = document.documentElement, acc = CP.theme.accent();
      root.dataset.theme = light ? 'light' : 'dark';
      root.style.setProperty('--acc', acc);
      root.style.setProperty('--accent-ink', inkFor(acc, light ? 0.88 : 0.72));
      const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = light ? '#f3f6f4' : '#0b1219';
    }
  };
  if (CP.D2) {
    document.documentElement.classList.add('d2');
    CP.theme.apply();
    try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => CP.theme.get() === 'auto' && CP.theme.apply()); } catch (e) { /* vecs pārlūks */ }
    CP.hydrateIcons();
    // pēc katras pārzīmēšanas (lapas, dialogi, paziņojumi)
    let pend = false;
    new MutationObserver(() => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; CP.hydrateIcons(); CP.iconize(); }); }).observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => CP.iconize());
    setTimeout(() => CP.iconize(), 0);
  }
})(window.CP);


/* ==== js/storage.js ==== */
/* =====================================================================
   Datu glabāšana: datu mape, JSON fails, rezerves kopijas, failu indekss.
   Strādā ar File System Access API (Chrome / Edge).
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state;
  const store = {};
  const TMP = CP.DATAFILE + '.raksta';

  /* --- Mapes atcerēšanās starp sesijām (IndexedDB) --- */
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('cadet-personals' + (CP.CHANNEL === 'test' ? '-test' : ''), 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error || Error('IndexedDB nav pieejama'));
    });
  }
  store.idbSet = async (k, v) => {
    const d = await idb();
    await new Promise((res, rej) => {
      const t = d.transaction('kv', 'readwrite');
      t.objectStore('kv').put(v, k);
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error || Error('IndexedDB ieraksts neizdevās'));
    });
  };
  store.idbGet = async k => {
    const d = await idb();
    return await new Promise((res, rej) => {
      const r = d.transaction('kv').objectStore('kv').get(k);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error || Error('IndexedDB lasīšana neizdevās'));
    });
  };

  async function ensurePerm(ask) {
    if (!S.root) return false;
    if (await S.root.queryPermission({ mode: 'readwrite' }) === 'granted') return true;
    if (!ask) return false;
    return (await S.root.requestPermission({ mode: 'readwrite' })) === 'granted';
  }
  store.ensurePerm = ensurePerm;

  /* --- Izmaiņu reģistrēšana un saglabāšana --- */
  store.changed = (opts = {}) => {
    if (S.db && CP.flushNotes) CP.flushNotes(S.db);
    S.dirty = true;
    S.rev = (S.rev || 0) + 1;
    if (!opts.silent) CP.render();
    else CP.ui.updateSaveState();
    store.schedule();
  };
  const autosave = U.debounce(() => store.save(true), 1000);
  store.schedule = () => { if (S.root && S.db.settings.autosave && !S.conflict && !S.newerFile) autosave(); };

  /** Cita cilne vai ārējs labojums: laika zīmogs vai revīzijas numurs nesakrīt. */
  store.fileChanged = (loadedStamp, loadedRev, fileStamp, fileRev) => {
    if (!loadedStamp) return false;
    if (fileStamp !== loadedStamp) return true;
    if (loadedRev != null && fileRev != null && Number(fileRev) !== Number(loadedRev)) return true;
    return false;
  };

  let chain = Promise.resolve();
  store.save = silent => {
    const job = chain.then(() => performSave(!!silent));
    chain = job.then(() => true, () => false);
    return job;
  };

  async function readStamp(handle) {
    const f = await handle.getFile();
    const text = await f.text();
    let revision = null, parseOk = false;
    if (text) {
      try {
        const parsed = JSON.parse(text);
        revision = parsed && typeof parsed.revision === 'number' ? parsed.revision : null;
        parseOk = !!(parsed && Array.isArray(parsed.people));
      } catch (e) { parseOk = false; }
    }
    return { lastModified: f.lastModified, revision, parseOk, text, empty: !text };
  }

  async function writeExact(fh, text) {
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
    const got = await (await fh.getFile()).text();
    if (got !== text) throw Error('fails pēc ieraksta nesakrīt ar saglabāto tekstu');
    const parsed = JSON.parse(got);
    CP.validateDb(parsed);
    return fh;
  }

  async function backupText(text, opts = {}) {
    if (!text) return { ok: true, skipped: true };
    try {
      const dir = await S.root.getDirectoryHandle('_rezerves', { create: true });
      if (opts.daily) {
        const day = U.iso();
        if (S.backupDay === day) return { ok: true, skipped: true };
        let exists = false;
        for await (const [n, h] of dir.entries()) if (h.kind === 'file' && n.startsWith('DATI_' + day)) { exists = true; break; }
        if (exists) { S.backupDay = day; return { ok: true, skipped: true }; }
      }
      const name = opts.name || `DATI_${U.stamp()}.json`;
      const fh = await dir.getFileHandle(name, { create: true });
      await writeExact(fh, text);
      if (opts.daily) S.backupDay = U.iso();
      return { ok: true, name };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  }

  function noteBackup(result) {
    if (!result || result.ok || result.skipped) return;
    if (S.backupError === result.error) return;
    S.backupError = result.error;
    CP.ui.toast('Rezerves kopija neizdevās: ' + result.error, 'warn', 12000);
  }

  async function performSave(silent) {
    if (S.newerFile) {
      CP.ui.toast(`Datu failu saglabājusi jaunāka CADET PERSONĀLS versija. Lai dati netiktu sabojāti, saglabāšana ir atslēgta. Pārlādē lapu (Ctrl+F5) vai atver jaunāko versiju.`, 'err', 20000);
      return false;
    }
    if (!S.root) {
      CP.ui.toast(silent ? 'Dati nav saglabāti — nav piekļuves datu mapei' : 'Vispirms izvēlies datu mapi', silent ? 'err' : 'warn', 8000);
      CP.ui.updateSaveState();
      return false;
    }
    const prevRev = S.db.revision || 0;
    const prevUpdated = S.db.updatedAt;
    const wasDirty = S.dirty;
    const revAtStart = S.rev;
    try {
      if (!(await ensurePerm(!silent))) {
        CP.ui.toast('Dati nav saglabāti: nav rakstīšanas atļaujas datu mapei', 'err', 9000);
        CP.ui.updateSaveState();
        return false;
      }
      let existing = null;
      try { existing = await S.root.getFileHandle(CP.DATAFILE); }
      catch (e) { if (e.name !== 'NotFoundError') throw e; }
      if (existing) {
        const stamp = await readStamp(existing);
        const external = !stamp.parseOk || store.fileChanged(S.fileStamp, S.loadedRevision, stamp.lastModified, stamp.revision);
        if (S.fileStamp && external) {
          S.conflict = true;
          CP.ui.updateSaveState();
          if (silent) {
            if (!S.conflictNotified) {
              S.conflictNotified = true;
              CP.ui.toast('Datu fails ir mainīts ārpus šī loga (cita cilne vai dators). Automātiskā saglabāšana apturēta — pārbaudi un spied “Saglabāt”.', 'warn', 12000);
            }
            return false;
          }
          if (!confirm('Datu fails kopš ielādes ir mainīts ārpus šī loga (cita cilne vai dators).\n\nPārrakstīt to ar šajā logā redzamajiem datiem?')) return false;
        }
        if (stamp.text) noteBackup(await backupText(stamp.text, { daily: true }));
      }
      const seen = S.rev;
      S.db.revision = prevRev + 1;
      S.db.updatedAt = U.now();
      CP.validateDb(S.db);
      let text = JSON.stringify(S.db, null, 2);
      const tmp = await S.root.getFileHandle(TMP, { create: true });
      await writeExact(tmp, text);
      if (existing) {
        const again = await readStamp(existing);
        const external = !again.parseOk || store.fileChanged(S.fileStamp, S.loadedRevision, again.lastModified, again.revision);
        if (S.fileStamp && external) {
          S.db.revision = prevRev;
          S.db.updatedAt = prevUpdated;
          S.conflict = true;
          CP.ui.updateSaveState();
          if (silent || !confirm('Kamēr dati tika sagatavoti, fails paspēja mainīties citā logā.\n\nTomēr pārrakstīt ar šī loga datiem?')) {
            CP.ui.toast('Saglabāšana apturēta — datu fails ir mainīts citur. Nesaglabātās izmaiņas ir paturētas.', 'warn', 12000);
            return false;
          }
          S.db.revision = prevRev + 1;
          S.db.updatedAt = U.now();
          text = JSON.stringify(S.db, null, 2);
          await writeExact(tmp, text);
        }
      }
      const fh = existing || await S.root.getFileHandle(CP.DATAFILE, { create: true });
      await writeExact(fh, text);
      const file = await fh.getFile();
      S.fileStamp = file.lastModified;
      S.loadedRevision = S.db.revision;
      S.conflict = false;
      S.conflictNotified = false;
      if (S.rev !== seen) S.dirty = true;
      else S.dirty = false;
      CP.ui.updateSaveState();
      try { await S.root.removeEntry(TMP); }
      catch (e) { CP.ui.toast('Dati saglabāti, bet pagaidu failu neizdevās izdzēst: ' + e.message, 'warn'); }
      if (!silent) CP.ui.toast('Saglabāts', 'ok');
      if (S.dirty && S.db.settings.autosave && !S.conflict) store.schedule();
      return true;
    } catch (e) {
      S.db.revision = prevRev;
      S.db.updatedAt = prevUpdated;
      S.dirty = wasDirty || S.rev !== revAtStart;
      CP.ui.updateSaveState();
      CP.ui.toast('Saglabāšana neizdevās: ' + (e.message || e) + '. Nesaglabātās izmaiņas ir paturētas.', 'err', 12000);
      return false;
    }
  }

  /* --- Rezerves kopijas un arhīvs --- */
  store.backupNow = async () => {
    if (!S.root) { CP.ui.toast('Vispirms izvēlies datu mapi', 'warn'); return { ok: false }; }
    if (!(await ensurePerm(true))) { CP.ui.toast('Nav rakstīšanas atļaujas — kopija netika izveidota', 'err'); return { ok: false }; }
    try { CP.validateDb(S.db); }
    catch (e) { CP.ui.toast('Kopija netika veidota: ' + e.message, 'err'); return { ok: false, error: e.message }; }
    const result = await backupText(JSON.stringify(S.db, null, 2), { name: `DATI_${U.stamp()}.json` });
    if (!result.ok) CP.ui.toast('Rezerves kopija neizdevās: ' + result.error, 'err', 12000);
    else CP.ui.toast('Izveidota JSON kopija ' + result.name + '. Tajā nav pašu dokumentu failu.', 'ok', 9000);
    return result;
  };
  store.listBackups = async () => {
    if (!S.root) return [];
    try {
      const dir = await S.root.getDirectoryHandle('_rezerves');
      const out = [];
      for await (const [name, h] of dir.entries()) {
        if (h.kind !== 'file' || !name.endsWith('.json')) continue;
        const f = await h.getFile();
        out.push({ name, size: f.size, modified: f.lastModified });
      }
      return out.sort((a, b) => b.modified - a.modified || b.name.localeCompare(a.name));
    } catch (e) {
      if (e.name === 'NotFoundError') return [];
      throw e;
    }
  };
  store.verifyBackup = async name => {
    const text = await readBackup(name);
    try {
      const parsed = JSON.parse(text);
      CP.validateDb(parsed);
      return { ok: true, people: parsed.people.length, documents: (parsed.documents || []).length, version: parsed.version, bytes: text.length };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  };
  async function readBackup(name) {
    if (!S.root) throw Error('nav datu mapes');
    if (!/^[\w.\-]+\.json$/.test(name)) throw Error('nederīgs kopijas nosaukums');
    const dir = await S.root.getDirectoryHandle('_rezerves');
    const fh = await dir.getFileHandle(name);
    return (await fh.getFile()).text();
  }
  store.restoreBackup = async name => {
    if (!S.root) { CP.ui.toast('Vispirms izvēlies datu mapi', 'warn'); return false; }
    if (!confirm(`Atjaunot datubāzi no kopijas ${name}?\n\nPašreizējie dati vispirms tiks saglabāti mapē _rezerves. Dokumentu faili un iepriekšējās kopijas netiks dzēsti.`)) return false;
    let parsed;
    try {
      parsed = JSON.parse(await readBackup(name));
      CP.validateDb(parsed);
    } catch (e) { CP.ui.toast('Kopija nav derīga, atjaunošana netika sākta: ' + e.message, 'err', 12000); return false; }
    let currentText = '';
    try {
      const cur = await S.root.getFileHandle(CP.DATAFILE);
      currentText = await (await cur.getFile()).text();
    } catch (e) {
      if (e.name !== 'NotFoundError') { CP.ui.toast('Atjaunošana apturēta — neizdevās nolasīt pašreizējos datus: ' + e.message, 'err'); return false; }
    }
    if (currentText) {
      const pre = await backupText(currentText, { name: `PIRMS_ATJAUNOSANAS_${U.stamp()}.json` });
      if (!pre.ok) { CP.ui.toast('Atjaunošana apturēta — neizdevās saglabāt pašreizējo versiju: ' + pre.error, 'err', 12000); return false; }
    }
    const db = CP.migrate(parsed);
    try { CP.validateDb(db); }
    catch (e) { CP.ui.toast('Atjaunotie dati nav derīgi: ' + e.message, 'err'); return false; }
    S.db = db;
    S.conflict = false;
    S.conflictNotified = false;
    S.dirty = true;
    S.rev = (S.rev || 0) + 1;
    const ok = await store.save(false);
    if (!ok) {
      CP.ui.toast('Atjaunošana nav pabeigta. Pašreizējā versija, ja tā tika izveidota, ir mapē _rezerves.', 'err', 12000);
      return false;
    }
    S.selected = db.people.find(CP.data.isCurrent)?.id || '';
    await restoreSources();
    CP.render();
    CP.ui.toast('Datubāze atjaunota no ' + name, 'ok');
    return true;
  };

  store.listArchives = async () => {
    if (!S.root) return [];
    try {
      const dir = await S.root.getDirectoryHandle('_arhivi');
      const out = [];
      for await (const [name, h] of dir.entries()) {
        if (h.kind !== 'directory') continue;
        let manifest = null, error = '';
        try {
          const mf = await h.getFileHandle('MANIFESTS.json');
          manifest = JSON.parse(await (await mf.getFile()).text());
        } catch (e) { error = e.message; }
        out.push({ name, manifest, error });
      }
      return out.sort((a, b) => b.name.localeCompare(a.name));
    } catch (e) {
      if (e.name === 'NotFoundError') return [];
      throw e;
    }
  };

  function isExternalSource(id) {
    return !!(id && id !== 'main' && !String(id).startsWith('fails:'));
  }
  store.createArchive = async ({ copyExternal = false } = {}) => {
    if (!S.root) { CP.ui.toast('Vispirms izvēlies datu mapi', 'warn'); return null; }
    if (!(await ensurePerm(true))) { CP.ui.toast('Nav rakstīšanas atļaujas — arhīvs netika veidots', 'err'); return null; }
    CP.validateDb(S.db);
    const stamp = U.stamp();
    const root = await S.root.getDirectoryHandle('_arhivi', { create: true });
    const dir = await root.getDirectoryHandle('ARHIVS_' + stamp, { create: true });
    const jsonName = CP.DATAFILE;
    const text = JSON.stringify(S.db, null, 2);
    await writeExact(await dir.getFileHandle(jsonName, { create: true }), text);
    const files = [];
    let missing = 0;
    const docs = S.db.documents.filter(d => d && d.path);
    for (const d of docs) {
      await new Promise(r => setTimeout(r, 0));
      const sid = d.sourceId || 'main';
      const row = { id: d.id, personId: d.personId, kind: d.kind, sourceId: sid, path: d.path, size: null, sha256: '', included: false, reason: '' };
      if (isExternalSource(sid) && !copyExternal) {
        row.reason = 'Ārējā mape — fails nav iekopēts, jo nebija piekrišanas';
        missing++;
        files.push(row);
        continue;
      }
      const h = await store.handleFor(d.path, sid);
      if (!h) {
        row.reason = isExternalSource(sid) ? 'Ārējā mape nav pieslēgta — fails nav iekopēts' : 'Fails pamatmapē nav atrasts';
        missing++;
        files.push(row);
        continue;
      }
      try {
        const file = await h.getFile();
        row.size = file.size;
        row.sha256 = await U.sha256Blob(file);
        const parts = d.path.split('/').filter(Boolean);
        let dest = await dir.getDirectoryHandle('dokumenti', { create: true });
        dest = await dest.getDirectoryHandle(sid.replace(/[\\/:*?"<>|]/g, '_'), { create: true });
        for (let i = 0; i < parts.length - 1; i++) dest = await dest.getDirectoryHandle(parts[i].replace(/[\\/:*?"<>|]/g, '_'), { create: true });
        const out = await dest.getFileHandle(parts.at(-1).replace(/[\\/:*?"<>|]/g, '_'), { create: true });
        const w = await out.createWritable();
        await w.write(file);
        await w.close();
        const copied = await out.getFile();
        if (copied.size !== file.size) throw Error('nokopētais izmērs nesakrīt');
        row.included = true;
      } catch (e) {
        row.included = false;
        row.reason = e.message || String(e);
        missing++;
      }
      files.push(row);
    }
    const paper = S.db.documents.filter(d => d && !d.path).length;
    const pilns = missing === 0 && docs.length > 0;
    const manifest = {
      veids: pilns ? 'pilns-registrēto-dokumentu-arhivs' : 'dalejs-arhivs',
      pilns,
      izveidots: U.now(),
      versija: CP.VERSION,
      json: jsonName,
      piezime: pilns
        ? 'Iekļauta JSON datubāze un visi reģistrētie dokumentu faili.'
        : 'Šis nav pilns dokumentu arhīvs. JSON datubāze ir iekļauta. Faili ar included:false nav iekopēti.',
      paperWithoutFile: paper,
      navIeklauti: files.filter(f => !f.included).map(f => ({ path: f.path, sourceId: f.sourceId, reason: f.reason })),
      faili: files
    };
    const manText = JSON.stringify(manifest, null, 2);
    const man = await dir.getFileHandle('MANIFESTS.json', { create: true });
    const mw = await man.createWritable();
    await mw.write(manText);
    await mw.close();
    const back = await (await man.getFile()).text();
    if (back !== manText) throw Error('manifests pēc ieraksta nesakrīt');
    const title = pilns ? 'Pilns reģistrēto dokumentu arhīvs' : 'Daļējs arhīvs — nav visi dokumenti';
    CP.ui.toast(title + ': _arhivi/ARHIVS_' + stamp + (missing ? ` (${missing} faili nav iekļauti)` : ''), pilns ? 'ok' : 'warn', 12000);
    return manifest;
  };

  /* --- Datu mapes izvēle un ielāde --- */
  /* Divi pieslēgšanas veidi:
     1) dialogs showDirectoryPicker() — izsaukts kā PIRMĀ darbība klikšķī (bez confirm/await pirms tā),
        lai netiktu zaudēta lietotāja aktivācija; bez "id" (atcerētā sākuma mape var būt nepieejams tīkla ceļš);
     2) mapes ievilkšana no File Explorer (DataTransferItem.getAsFileSystemHandle) — darbojas arī tad,
        ja Chrome dialogā izvēlēto vietu uzskata par sistēmas mapi (tīkla/roaming profils) un atgriež AbortError.
     Abi veidi nonāk store.connectRoot(): rakstīšanas atļauja → rakstīšanas pārbaude → loadRoot → IndexedDB. */
  /* Ja index.html atvērts no tīkla ceļa (file://jicfs01/...), adresei ir "host". Chrome tad lapas izcelsmi
     neuzskata par to pašu, kam pieder mapes atļauja, un rakstīšanas atļauju nepiešķir:
     requestPermission → SecurityError "Not allowed to request permissions in this context",
     showDirectoryPicker({mode:'readwrite'}) → AbortError. No lokāla ceļa vai diska burta (file:///C:/…, file:///H:/…) tas strādā. */
  store.netPath = location.protocol === 'file:' && !!location.hostname;
  store.netPathMsg = () => `Programma atvērta no tīkla ceļa \\\\${location.hostname}\\… — no šādas vietas Chrome neļauj piešķirt rakstīšanas atļauju nevienai mapei. Pārkopē programmas mapi uz lokālu vietu (piem. Lejupielādes / Downloads vai C:\\…) vai atver to caur diska burtu (piem. H:\\…) un atver index.html no turienes. Datu mape var palikt, kur ir.`;
  const ctxErr = e => e && e.name === 'SecurityError' && /this context/i.test(e.message || '');
  store.diag = { protocol: location.protocol, host: location.hostname || '(lokāls)', secure: window.isSecureContext, secure: window.isSecureContext, picker: typeof window.showDirectoryPicker, dropHandle: typeof (window.DataTransferItem && DataTransferItem.prototype.getAsFileSystemHandle), last: null };
  const errText = e => (e && (e.name ? e.name + ': ' : '') + (e.message || e)) || 'nezināma kļūda';
  function note(via, step, e, extra) {
    store.diag.last = { via, step, error: e ? errText(e) : '', at: new Date().toLocaleString('lv-LV'), ...(extra || {}) };
    if (e) console.warn('[CADET mape]', via, step, e);
  }
  let picking = false;
  store.pickRoot = () => {
    if (!window.showDirectoryPicker) { CP.ui.toast('Šim pārlūkam nav mapju izvēles dialoga. Ievelc datu mapi no File Explorer laukā “Datu mape”.', 'err', 12000); return; }
    if (picking) return;                     // dubultklikšķis — otrs dialogs netiek atvērts
    picking = true;
    const t0 = performance.now();
    let pr;
    try { pr = window.showDirectoryPicker({ mode: 'readwrite' }); }   // sinhroni, tieši klikšķa apstrādē
    catch (e) { picking = false; pickFailed(e, 0); return; }
    return pr.then(async h => {
      picking = false;
      if (S.dirty && S.root && !confirm('Ir nesaglabātas izmaiņas. Mainīt datu mapi?')) return;
      await store.connectRoot(h, 'dialogs');
    }, e => { picking = false; pickFailed(e, Math.round(performance.now() - t0)); });
  };
  function pickFailed(e, ms) {
    note('dialogs', 'showDirectoryPicker', e, { ms });
    const drop = ' Droši strādājošs veids: atver File Explorer un IEVELC datu mapi laukā “Datu mape” (pārskatā vai Iestatījumos).';
    let msg;
    if (store.netPath && e.name === 'AbortError') msg = 'Mape netika pieslēgta (AbortError). ' + store.netPathMsg();
    else if (e.name === 'AbortError') msg = ms < 600
      ? `Chrome aizvēra mapes dialogu, pirms to varēja izmantot (${ms} ms).` + drop
      : 'Mape netika pieslēgta (Chrome atgrieza AbortError). Ja tu mapi izvēlējies, nevis atcēli, Chrome šo atrašanās vietu uzskata par aizsargātu sistēmas mapi — tā mēdz būt ar tīkla (roaming) profilu, piem. \\\\jicfs01\\Profiles\\…\\Desktop.' + drop;
    else if (e.name === 'SecurityError' || e.name === 'NotAllowedError') msg = 'Chrome neļāva atvērt mapes dialogu (' + errText(e) + '). Spied pogu vēlreiz ar peli.' + drop;
    else msg = 'Mapes dialoga kļūda: ' + errText(e) + '.' + drop;
    CP.ui.toast(msg, 'err', 25000);
    CP.render();
  }

  /** Ievilkšana: items[i].getAsFileSystemHandle() jāizsauc sinhroni drop notikumā, šeit nonāk jau solījums. */
  store.dropRoot = async (pr, count) => {
    if (!pr) { note('ievilkšana', 'getAsFileSystemHandle', Error('pārlūks neatbalsta')); CP.ui.toast('Šis pārlūks neatbalsta mapes ievilkšanu. Lieto Google Chrome vai Microsoft Edge.', 'err', 12000); return; }
    let h;
    try { h = await pr; }
    catch (e) { note('ievilkšana', 'getAsFileSystemHandle', e); CP.ui.toast('Ievilkto mapi neizdevās nolasīt: ' + errText(e), 'err', 15000); return; }
    if (!h) { note('ievilkšana', 'getAsFileSystemHandle', Error('null')); CP.ui.toast('Ievilktais objekts nav mape vai fails datorā (piem., saite vai e-pasta pielikums). Ievelc mapi no File Explorer.', 'err', 12000); return; }
    if (h.kind !== 'directory') { note('ievilkšana', 'kind', Error('fails: ' + h.name)); CP.ui.toast(`Ievilki failu “${h.name}”, nevis mapi. Ievelc pašu datu mapi (piem. “CADET PERSONALS”).`, 'warn', 12000); return; }
    if (count > 1) CP.ui.toast('Ievilkti vairāki objekti — tiek izmantota tikai mape “' + h.name + '”.', 'warn', 8000);
    if (S.root && S.root.isSameEntry && await S.root.isSameEntry(h).catch(() => false)) { CP.ui.toast('Šī mape jau ir pieslēgta: ' + h.name, 'ok'); return; }
    if (S.dirty && S.root && !confirm('Ir nesaglabātas izmaiņas. Mainīt datu mapi uz “' + h.name + '”?')) return;
    await store.connectRoot(h, 'ievilkšana');
  };

  /** Pārbauda rakstīšanu ar īslaicīgu pārbaudes failu (tiek izdzēsts; esošie faili netiek skarti). */
  async function writeProbe(h) {
    const name = '.cadet_rakstisanas_parbaude.tmp', txt = 'ok ' + Date.now();
    const fh = await h.getFileHandle(name, { create: true });
    const w = await fh.createWritable(); await w.write(txt); await w.close();
    const back = await (await fh.getFile()).text();
    try { await h.removeEntry(name); } catch (e) { /* atstāts pārbaudes fails netraucē — tiek ignorēts indeksā */ }
    if (back !== txt) throw Error('ierakstītais saturs nesakrīt');
  }

  /** Kopējais pieslēgšanas ceļš abiem veidiem. Ja rakstīšanas atļauju nevar pieprasīt bez klikšķa, rāda pogu. */
  store.connectRoot = async (h, via) => {
    let perm = 'prompt';
    try { perm = await h.queryPermission({ mode: 'readwrite' }); } catch (e) { note(via, 'queryPermission', e); }
    if (perm !== 'granted') {
      try { perm = await h.requestPermission({ mode: 'readwrite' }); }
      catch (e) { console.info('[CADET mape] rakstīšanas atļaujai vajag klikšķi:', e.message); note(via, 'gaida klikšķi uz “Atļaut piekļuvi”'); perm = 'needs-click'; }   // ievilkšana nav lietotāja aktivācija
    }
    if (perm !== 'granted') {
      S.pendingRoot = h; S.pendingVia = via;
      try { await store.idbSet('root', h); } catch (e) { /* tikai atcerēšanās */ }
      CP.render();
      CP.ui.toast(perm === 'needs-click'
        ? `Mape “${h.name}” saņemta. Spied “🔓 Atļaut piekļuvi” un Chrome logā izvēlies “Rediģēt failus” / “Atļaut”, lai varētu saglabāt datus.`
        : `Rakstīšana mapē “${h.name}” netika atļauta. Spied “🔓 Atļaut piekļuvi” un Chrome logā izvēlies “Atļaut”.`, 'warn', 15000);
      return false;
    }
    try { await writeProbe(h); }
    catch (e) {
      note(via, 'rakstīšanas pārbaude', e);
      CP.ui.toast(`Mapē “${h.name}” nevar rakstīt (${errText(e)}). Iespējams, mape ir tikai lasāma vai tīkla disks nav pieejams. Izvēlies citu mapi. Nekas netika mainīts.`, 'err', 20000);
      return false;
    }
    note(via, 'pieslēgta', null, { folder: h.name });
    await store.loadRoot(h);
    return true;
  };
  store.loadRoot = async h => {
    let db, isNew = false;
    if (!S.boot || S.boot.error) S.boot = { name: h.name };
    S.boot.name = h.name; S.boot.error = null;
    store.bootStep(50, `Nolasa datu failu no “${h.name}”…`);
    try {
      const fh = await h.getFileHandle(CP.DATAFILE);
      const stamp = await readStamp(fh);
      if (!stamp.parseOk) throw Error(stamp.empty ? 'datu fails ir tukšs' : 'neatbilstošs datu faila formāts');
      const parsed = JSON.parse(stamp.text);
      const fileVer = parsed.version || 0;
      // Datu fails no JAUNĀKAS rīka versijas — atver tikai lasīšanai, lai vecāks kods to nesabojātu
      S.newerFile = fileVer > CP.SCHEMA ? fileVer : 0;
      // Pirms jebkuras datu pārveidošanas uz jaunu shēmu — kopija ar oriģinālo saturu
      if (fileVer < CP.SCHEMA && (parsed.people || []).length) {
        const prevRoot = S.root; S.root = h;
        const bak = await backupText(stamp.text, { name: `DATI_pirms_atjauninasanas_v${fileVer}-v${CP.SCHEMA}_${U.stamp()}.json` });
        S.root = prevRoot;
        if (!bak.ok) CP.ui.toast('Rezerves kopiju pirms datu atjaunināšanas neizdevās izveidot: ' + (bak.error || ''), 'warn', 12000);
      }
      db = CP.migrate(parsed);
      CP.validateDb(db);
      S.fileStamp = stamp.lastModified;
      S.loadedRevision = db.revision || 0;
      if (S.newerFile) CP.ui.toast(`Uzmanību: šo datu failu saglabājusi jaunāka rīka versija. Dati atvērti tikai apskatei — saglabāšana atslēgta. Pārlādē lapu ar Ctrl+F5, lai ielādētu jaunāko versiju.`, 'err', 30000);
      else CP.ui.toast(`Ielādēts: ${db.people.length} personas`, 'ok');
    } catch (e) {
      if (e.name !== 'NotFoundError') { bootFail('other', h, Object.assign(Error('datu fails: ' + e.message + '. Fails netika mainīts.'), { name: e.name })); return; }
      db = CP.migrate(CP.blank());
      S.fileStamp = 0;
      S.loadedRevision = 0;
      isNew = true;
    }
    S.db = db; S.root = h; S.rootName = h.name; S.pendingRoot = null; S.dirty = false; S.conflict = false; S.conflictNotified = false; S.rev = 0;
    S.roots = [{ id: 'main', name: h.name, handle: h, ok: true }];
    S.index = [];
    S.selected = db.people.find(CP.data.isCurrent)?.id || '';
    store.bootStep(65, 'Sagatavo uzskaiti…');
    try { await store.idbSet('root', h); }
    catch (e) { CP.ui.toast('Datu mape ir atvērta, bet to neizdevās atcerēties nākamajai reizei: ' + e.message, 'warn', 10000); }
    await restoreSources();
    store.bootStep(75, 'Pārbauda mācību gadu mapes…');
    try { await store.ensureYearFolders(); }
    catch (e) { CP.ui.toast('Mācību gadu mapes neizdevās izveidot: ' + e.message, 'warn', 10000); }
    if (isNew) {   // jaunai mapei datu fails tiek izveidots uzreiz — nākamreiz mape tiek atpazīta kā uzskaites mape
      const okSave = await store.save(true);
      CP.ui.toast(okSave === false ? 'Jaunā datu mape pieslēgta, bet datu failu neizdevās izveidot — pārbaudi rakstīšanas tiesības.' : `Jauna uzskaite izveidota mapē “${h.name}”`, okSave === false ? 'warn' : 'ok', 8000);
    }
    S.boot = { step: 'index', name: h.name, count: 0 };      // dati jau redzami; dokumenti indeksējas fonā
    S.page = 'dashboard'; CP.render();
    await store.scanAll();
    S.boot = null; CP.render();
    for (const f of CP.afterRootLoad || []) { try { f(); } catch (e) { console.error(e); } }
    await CP.notices?.();
  };
  /* --- Starts: atcerētās mapes pārbaude ar progresu (S.boot) --- */
  const boot = (o) => { S.boot = o ? { ...(S.boot || {}), ...o } : null; CP.render(); };
  store.bootStep = (pct, msg) => { if (S.boot && !S.boot.error) { S.boot.pct = pct; S.boot.msg = msg; S.boot.detail = ''; CP.render(); } };
  /** Gaida solījumu; pēc 8 s parāda “tīkla mape atbild lēni”, pēc 90 s atsakās. */
  function slow(pr, label) {
    let t1, t2;
    return Promise.race([
      pr,
      new Promise((_, rej) => {
        t1 = setTimeout(() => { if (S.boot && !S.boot.error) { S.boot.detail = 'Mape atbild lēni (tīkla disks vai zibatmiņa). Lūdzu, uzgaidi…'; CP.render(); } }, 8000);
        t2 = setTimeout(() => rej(Object.assign(Error(label + ' neatbildēja 90 sekundēs'), { name: 'TimeoutError' })), 90000);
      })
    ]).finally(() => { clearTimeout(t1); clearTimeout(t2); });
  }
  function bootFail(kind, h, e) {
    const name = h?.name || S.boot?.name || 'datu mape';
    const T = {
      gone: { title: `Datu mapi “${name}” neizdevās atrast`, hints: ['Pārbaudi, vai mape nav pārdēvēta, pārvietota vai izdzēsta.', 'Ja mape ir tīklā vai zibatmiņā — pārbaudi tīkla savienojumu vai ievieto zibatmiņu un spied “Mēģināt vēlreiz”.', 'Ja mape tagad ir citur — ievelc to šeit vai izvēlies no jauna. Dati un dokumentu saites saglabāsies.'] },
      nodata: { title: `Mapē “${name}” nav datu faila`, hints: [`Mapē nav faila ${CP.DATAFILE}. Varbūt tas pārvietots vai pārdēvēts?`, 'Ja izvēlēta nepareiza mape — izvēlies pareizo vai ievelc to šeit.', 'Ja šī tiešām ir jauna mape — spied “Sākt jaunu uzskaiti šeit”.'] },
      timeout: { title: `Mape “${name}” neatbild`, hints: ['Tīkla disks vai zibatmiņa nav pieejama vai ļoti lēna.', 'Pārbaudi savienojumu un spied “Mēģināt vēlreiz”.'] },
      other: { title: `Datu mapi “${name}” neizdevās atvērt`, hints: ['Spied “Mēģināt vēlreiz”. Ja neizdodas — izvēlies mapi no jauna vai ievelc to šeit.', 'Kļūdas tekstu vari nosūtīt atbalstam.'] }
    }[kind];
    S.bootHandle = h || null;
    note('starts', kind, e || null);
    boot({ error: kind, title: T.title, hints: T.hints, errText: e ? errText(e) : '', pct: 100 });
  }
  store.tryRestore = async () => {
    boot({ step: 'idb', pct: 5, msg: 'Meklē atcerēto datu mapi…', error: null, detail: '' });
    let h = null;
    try { h = await store.idbGet('root'); }
    catch (e) { bootFail('other', null, e); return; }
    if (!h) { boot(null); return; }
    S.boot.name = h.name;
    store.bootStep(15, `Pārbauda piekļuvi mapei “${h.name}”…`);
    let perm = 'prompt';
    try { perm = h.queryPermission ? await slow(h.queryPermission({ mode: 'readwrite' }), 'Atļauju pārbaude') : 'granted'; }
    catch (e) { if (e.name === 'TimeoutError') return bootFail('timeout', h, e); perm = 'prompt'; }
    if (perm !== 'granted') { S.pendingRoot = h; boot(null); return; }   // Chrome prasa apstiprinājumu — poga “Atļaut piekļuvi”
    store.bootStep(30, `Pārbauda, vai mape “${h.name}” ir pieejama…`);
    try { await slow(h.getFileHandle(CP.DATAFILE), 'Mape'); }
    catch (e) {
      if (e.name === 'TimeoutError') return bootFail('timeout', h, e);
      if (e.name !== 'NotFoundError') return bootFail('other', h, e);
      // nav faila VAI nav pašas mapes — pārbauda mapi
      try { const it = h.values(); await slow(it.next(), 'Mape'); return bootFail('nodata', h, null); }
      catch (e2) { return bootFail(e2.name === 'TimeoutError' ? 'timeout' : 'gone', h, e2); }
    }
    try { await store.loadRoot(h); }
    catch (e) { bootFail(e.name === 'TimeoutError' ? 'timeout' : 'other', h, e); }
  };
  store.retryRestore = () => { S.bootHandle = null; return store.tryRestore(); };
  store.bootNew = async () => {
    const h = S.bootHandle; if (!h) return;
    if (!confirm(`Sākt jaunu, tukšu uzskaiti mapē “${h.name}”?\n\nEsošie faili netiks dzēsti. Datu fails tiks izveidots pēc pirmās izmaiņas.`)) return;
    boot({ error: null, pct: 40, msg: 'Sagatavo jaunu uzskaiti…' });
    await store.loadRoot(h);
  };
  store.restoreRoot = () => {
    const h = S.pendingRoot; if (!h) return;
    let pr;
    try { pr = h.requestPermission({ mode: 'readwrite' }); }       // sinhroni klikšķī
    catch (e) { note('atjaunošana', 'requestPermission', e); CP.ui.toast('Atļauju neizdevās pieprasīt: ' + errText(e), 'err', 12000); return; }
    return pr.then(async perm => {
      if (perm === 'granted') await store.connectRoot(h, S.pendingVia || 'atjaunošana');
      else { note('atjaunošana', 'requestPermission', Error(perm)); CP.ui.toast('Piekļuve mapei netika atļauta. Dati nav ielādēti. Mēģini vēlreiz vai ievelc mapi no File Explorer.', 'warn', 12000); }
    }, e => {
      note('atjaunošana', 'requestPermission', e);
      CP.ui.toast(ctxErr(e) ? 'Chrome neļauj šeit pieprasīt atļauju (' + errText(e) + '). ' + (store.netPath ? store.netPathMsg() : 'Atver index.html tieši Chrome cilnē (ne iegultā logā) no lokālas mapes.') : (e.name === 'NotFoundError' ? 'Atcerētā mape vairs nav atrodama (pārdēvēta, pārvietota vai tīkla disks nav pieejams). Ievelc mapi no jauna.' : 'Atļauju neizdevās saņemt: ' + errText(e)), 'err', 30000);
    });
  };

  async function restoreSources() {
    const metas = S.db.sources || [];
    let map = {};
    try { map = (await store.idbGet('sources')) || {}; }
    catch (e) { CP.ui.toast('Papildu mapju sarakstu neizdevās nolasīt: ' + e.message, 'warn', 10000); }
    for (const meta of metas) {
      if (!meta?.id) continue;
      const handle = map[meta.id] || null;
      let perm = 'denied';
      if (handle?.queryPermission) {
        try { perm = await handle.queryPermission({ mode: 'read' }); }
        catch (e) { perm = 'denied'; }
      }
      S.roots.push({
        id: meta.id, name: meta.name || handle?.name || 'Mape',
        handle: perm === 'granted' ? handle : null,
        pending: handle && perm !== 'granted' ? handle : null,
        ok: perm === 'granted'
      });
    }
  }
  async function saveSourceHandle(id, handle) {
    const map = (await store.idbGet('sources')) || {};
    map[id] = handle;
    await store.idbSet('sources', map);
  }
  function upsertRoot(id, handle, ok) {
    const row = S.roots.find(r => r.id === id);
    const next = { id, name: handle.name, handle: ok ? handle : null, pending: ok ? null : handle, ok };
    if (row) Object.assign(row, next);
    else S.roots.push(next);
  }
  async function matchSource(handle) {
    let map = {};
    try { map = (await store.idbGet('sources')) || {}; } catch (e) { map = {}; }
    for (const meta of S.db.sources || []) {
      const known = S.roots.find(r => r.id === meta.id)?.handle || S.roots.find(r => r.id === meta.id)?.pending || map[meta.id];
      if (!known?.isSameEntry) continue;
      try { if (await known.isSameEntry(handle)) return meta; } catch (e) { /* salīdzinājums neizdevās — nesaista pēc nosaukuma */ }
    }
    return null;
  }

  /* --- Failu indekss (tikai nosaukumi un ceļi, saturs netiek lasīts) --- */
  store.scanAll = async () => {
    const out = [];
    for (const s of S.roots) {
      if (!s.handle) continue;
      try { await walk(s.handle, '', s, 0, out); }
      catch (e) { CP.ui.toast('Nevar nolasīt mapi ' + s.name + ': ' + e.message, 'err'); }
    }
    S.index = out; CP.render();
  };
  function bootCount(n) {
    if (S.boot?.step !== 'index') return;
    S.boot.count = n;
    const el = document.getElementById('bootIdxN'); if (el) el.textContent = n;
  }
  async function walk(folder, path, src, depth, out) {
    if (depth > 32 || out.length > 20000) return;
    for await (const [name, h] of folder.entries()) {
      if (name.startsWith('.') || name.startsWith('~$') || name === '_rezerves' || name === '_arhivi' || name === '_atjaunosana' || name.endsWith('.raksta')) continue;
      const rel = path ? path + '/' + name : name;
      if (h.kind === 'directory') await walk(h, rel, src, depth + 1, out);
      else if (name !== CP.DATAFILE) {
        out.push({ sourceId: src.id, sourceName: src.name, path: rel, name, handle: h, ext: (name.split('.').pop() || '').toLowerCase(), n: U.norm(rel) });
        if (out.length % 25 === 0) bootCount(out.length);
      }
    }
  }
  store.addExtra = async () => {
    if (!S.root) return CP.ui.toast('Vispirms izvēlies datu mapi — mapes identifikators jāsaglabā datu failā', 'warn');
    try {
      const h = await showDirectoryPicker({ id: 'cadet-external', mode: 'read' });
      if (S.root.isSameEntry && await S.root.isSameEntry(h)) return CP.ui.toast('Šī jau ir atvērtā datu mape', 'warn');
      const existing = await matchSource(h);
      if (existing) {
        existing.name = h.name;
        await saveSourceHandle(existing.id, h);
        upsertRoot(existing.id, h, true);
        store.changed();
        await store.scanAll();
        CP.ui.toast('Pieslēgta jau reģistrētā mape “' + h.name + '”', 'ok');
        return;
      }
      const meta = { id: 'src_' + U.uid().replace(/-/g, '').slice(0, 12), name: h.name, addedAt: U.now() };
      S.db.sources.push(meta);
      await saveSourceHandle(meta.id, h);
      upsertRoot(meta.id, h, true);
      store.changed();
      await store.scanAll();
      CP.ui.toast('Papildu mape reģistrēta. Pēc pārlūka aizvēršanas to pieslēdz ar pogu “Pieslēgt”, ja Chrome to prasa.', 'ok', 9000);
    } catch (e) {
      if (e.name !== 'AbortError') CP.ui.toast('Papildu mapi neizdevās pievienot: ' + e.message, 'err');
    }
  };
  store.reconnectSource = async id => {
    const meta = (S.db.sources || []).find(s => s.id === id);
    if (!meta) return;
    const row = S.roots.find(r => r.id === id);
    if (row?.pending) {
      try {
        if (await row.pending.requestPermission({ mode: 'read' }) === 'granted') {
          row.handle = row.pending; row.ok = true; row.pending = null;
          await store.scanAll();
          CP.ui.toast('Mape pieslēgta: ' + meta.name, 'ok');
        } else CP.ui.toast('Piekļuve mapei netika atļauta. Dokumentu saites ir saglabātas, bet mape nav pieejama.', 'warn', 9000);
      } catch (e) { CP.ui.toast(e.message, 'err'); }
      return;
    }
    try {
      const h = await showDirectoryPicker({ mode: 'read' });
      const other = await matchSource(h);
      if (other && other.id !== id) { CP.ui.toast('Šī mape jau ir reģistrēta kā “' + other.name + '”. Otrs avots netika veidots.', 'warn', 9000); return; }
      if (other && other.id === id) {
        await saveSourceHandle(id, h);
        upsertRoot(id, h, true);
        await store.scanAll();
        CP.ui.toast('Mape pieslēgta: ' + h.name, 'ok');
        return;
      }
      if (!confirm(`Piesaistīt izvēlēto mapi “${h.name}” avotam “${meta.name}”?\n\nVienāds nosaukums nenozīmē, ka tā ir tā pati mape. Apstiprini tikai tad, ja zini, ka tā ir.`)) return;
      meta.name = h.name;
      await saveSourceHandle(id, h);
      upsertRoot(id, h, true);
      store.changed();
      await store.scanAll();
      CP.ui.toast('Mape piesaistīta avotam “' + meta.name + '”', 'ok');
    } catch (e) { if (e.name !== 'AbortError') CP.ui.toast(e.message, 'err'); }
  };

  store.handleFor = async (path, sourceId) => {
    const sid = sourceId || 'main';
    if (String(sid).startsWith('fails:')) {
      try { return await store.idbGet('doc:' + sid.slice(6)); } catch (e) { return null; }
    }
    const item = S.index.find(f => f.path === path && f.sourceId === sid);
    if (item) return item.handle;
    const src = S.roots.find(r => r.id === sid);
    if (!src?.handle) return null;
    try {
      const parts = path.split('/').filter(Boolean); let h = src.handle;
      for (let i = 0; i < parts.length - 1; i++) h = await h.getDirectoryHandle(parts[i]);
      return await h.getFileHandle(parts.at(-1));
    } catch (e) { return null; }
  };
  store.rememberDocHandle = async (id, handle) => { await store.idbSet('doc:' + id, handle); };

  function compareMeta(d, file) {
    if (d.sha256 && d.size != null && file.size === d.size && d.modified && file.lastModified === d.modified) return { state: 'available', detail: 'Pieejams' };
    if (d.sha256 && (file.size !== d.size || (d.modified && file.lastModified !== d.modified))) return { state: 'check', detail: 'Metadati mainījušies — jāpārbauda saturs' };
    return { state: 'check', detail: d.sha256 ? 'Jāpārbauda' : 'Vēl nav pārbaudīta kontrolsumma' };
  }
  store.probeDoc = async d => {
    if (!d?.path) return null;
    const sid = d.sourceId || 'main';
    if (String(sid).startsWith('fails:')) {
      let h = null;
      try { h = await store.idbGet('doc:' + d.id); } catch (e) { return { state: 'noaccess', detail: 'Faila rokturi neizdevās nolasīt' }; }
      if (!h) return { state: 'noaccess', detail: 'Tiešā faila atļauja nav saglabāta' };
      try {
        if (h.queryPermission && await h.queryPermission({ mode: 'read' }) !== 'granted') return { state: 'noaccess', detail: 'Jāatjauno atļauja failam' };
        return compareMeta(d, await h.getFile());
      } catch (e) { return { state: 'missing', detail: 'Fails nav atverams' }; }
    }
    const src = S.roots.find(r => r.id === sid);
    if (sid !== 'main' && (!src || !src.ok)) return { state: 'noaccess', detail: 'Dokumenta mape nav pieslēgta' };
    if (!S.root && sid === 'main') return { state: 'noaccess', detail: 'Datu mape nav pieslēgta' };
    const h = await store.handleFor(d.path, sid);
    if (!h) {
      const base = d.path.split('/').pop();
      const moved = S.index.find(f => f.sourceId === sid && f.name === base && f.path !== d.path);
      if (moved) return { state: 'missing', detail: 'Pārvietots: ' + moved.path };
      return { state: 'missing', detail: 'Nav atrasts' };
    }
    try { return compareMeta(d, await h.getFile()); }
    catch (e) { return { state: 'noaccess', detail: e.message }; }
  };
  store.checkDoc = async d => {
    const live = await store.probeDoc(d);
    if (!live) return null;
    if (live.state === 'noaccess') return live;
    if (live.state === 'missing') {
      if (!d.sha256) return live;
      const sid = d.sourceId || 'main';
      const parent = d.path.split('/').slice(0, -1).join('/');
      const candidates = S.index.filter(f => f.sourceId === sid && f.path !== d.path)
        .sort((a, b) => (a.path.startsWith(parent) ? 0 : 1) - (b.path.startsWith(parent) ? 0 : 1));
      let n = 0;
      for (const c of candidates) {
        if (c.path === d.path) continue;
        if (++n > 40) break;
        await new Promise(r => setTimeout(r, 0));
        try {
          const file = await c.handle.getFile();
          if (d.size != null && file.size !== d.size) continue;
          const sha = await U.sha256Blob(file);
          if (sha === d.sha256) {
            const renamed = c.path.split('/').slice(0, -1).join('/') === parent;
            return { state: 'missing', detail: (renamed ? 'Pārdēvēts: ' : 'Pārvietots: ') + c.path };
          }
        } catch (e) { /* kandidātu izlaižam */ }
      }
      return live;
    }
    const h = await store.handleFor(d.path, d.sourceId || 'main');
    if (!h) return live;
    const file = await h.getFile();
    const sha = await U.sha256Blob(file);
    if (!d.sha256 || sha === d.sha256) {
      return { state: 'available', detail: d.sha256 ? 'Saturs sakrīt' : 'Kontrolsumma saglabāta', sha256: sha, size: file.size, modified: file.lastModified, baseline: !d.sha256 };
    }
    return { state: 'check', detail: 'Saturs mainījies', sha256: sha, size: file.size, modified: file.lastModified, changed: true };
  };

  /** Ieraksta failu datu mapē, nekad nepārrakstot esošu (pievieno (2), (3)…). Atgriež relatīvo ceļu vai null, ja lietotājs atceļ. */
  store.saveFile = async (dirParts, fileName, blob, opts = {}) => {
    if (!(await ensurePerm(true))) throw Error('nav rakstīšanas atļaujas');
    let dir = S.root; for (const d of dirParts) dir = await dir.getDirectoryHandle(d.replace(/[\\/:*?"<>|]/g, '_'), { create: true });
    const clean = fileName.replace(/[\\/:*?"<>|]/g, '_'), dot = clean.lastIndexOf('.');
    const base = dot > 0 ? clean.slice(0, dot) : clean, ext = dot > 0 ? clean.slice(dot) : '';
    let occupied = false;
    try { await dir.getFileHandle(clean); occupied = true; } catch (e) { if (e.name !== 'NotFoundError') throw e; }
    if (occupied && opts.confirmConflict && !confirm(`“${clean}” jau ir šajā mapē. Saglabāt kā jaunu kopiju ar citu nosaukumu? Esošais fails netiks pārrakstīts.`)) return null;
    let name = clean, i = 2;
    for (;;) { try { await dir.getFileHandle(name); name = `${base} (${i++})${ext}`; } catch (e) { if (e.name === 'NotFoundError') break; throw e; } }
    const fh = await dir.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(blob); await w.close();
    const written = await fh.getFile();
    if (blob.size != null && written.size !== blob.size) throw Error('ierakstītais fails nav pilnīgs');
    const path = [...dirParts.map(d => d.replace(/[\\/:*?"<>|]/g, '_')), name].join('/');
    S.index.push({ sourceId: 'main', sourceName: S.rootName, path, name, handle: fh, ext: ext.slice(1).toLowerCase(), n: U.norm(path) });
    return path;
  };
  function pathSegments(rel) {
    const parts = String(rel || '').split('/').filter(Boolean);
    if (parts.some(p => p === '.' || p === '..' || /[\\:*?"<>|]/.test(p))) throw Error('nederīgs ceļš');
    return parts;
  }
  function within(rootParts, parts) {
    return parts.length >= rootParts.length && rootParts.every((p, i) => parts[i] === p);
  }
  async function openDir(parts, create) {
    if (!S.root) throw Error('nav datu mapes');
    let dir = S.root;
    for (const part of parts) {
      if (part === '.' || part === '..') throw Error('nederīgs ceļš');
      dir = await dir.getDirectoryHandle(part, { create: !!create });
    }
    return dir;
  }
  /** Mācību gada personas mape. Vecās mapes un saites netiek pārvietotas. */
  store.yearPersonDir = (p, yearId = CP.data.activeYear()) => {
    store.assignFolder(p);
    const label = p.folderLabel || store.folderSlug(p);
    return ['Macibu_gadi', yearId, 'Personas', `${p.folderId}_${label}`];
  };
  store.ensurePersonYearFolder = async (p, yearId) => {
    if (!S.root || !p) return null;
    if (!(await ensurePerm(true))) throw Error('nav rakstīšanas atļaujas');
    const parts = store.yearPersonDir(p, yearId || CP.data.activeYear());
    await openDir(parts, true);
    return parts;
  };
  store.listLevel = async parts => {
    const dir = await openDir(parts, false);
    const rows = [];
    for await (const [name, h] of dir.entries()) {
      if (name.startsWith('.') || name === CP.DATAFILE) continue;
      if (h.kind === 'directory') rows.push({ name, kind: 'dir' });
      else {
        let size = null;
        try { size = (await h.getFile()).size; } catch (e) { size = null; }
        rows.push({ name, kind: 'file', size, ext: (name.split('.').pop() || '').toLowerCase() });
      }
    }
    rows.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, 'lv') : (a.kind === 'dir' ? -1 : 1)));
    return rows;
  };
  store.listFolders = async (rootParts, maxDepth = 30) => {
    const out = [''];
    const walkDirs = async (rel, depth) => {
      if (depth > maxDepth) return;
      let dir;
      try { dir = await openDir([...rootParts, ...pathSegments(rel)], false); } catch (e) { return; }
      for await (const [name, h] of dir.entries()) {
        if (h.kind !== 'directory' || name.startsWith('.')) continue;
        const child = rel ? rel + '/' + name : name;
        out.push(child);
        await walkDirs(child, depth + 1);
      }
    };
    await walkDirs('', 0);
    return out;
  };
  /** Meklē tikai nosaukumus un ceļus. Failu saturs netiek lasīts, izmērs ir metadati. */
  store.searchNames = async (rootParts, q, maxDepth = 30) => {
    const nq = U.norm(q);
    const hits = [];
    const walkNames = async (rel, depth) => {
      if (depth > maxDepth || hits.length > 200) return;
      let dir;
      try { dir = await openDir([...rootParts, ...pathSegments(rel)], false); } catch (e) { return; }
      for await (const [name, h] of dir.entries()) {
        if (name.startsWith('.') || hits.length > 200) continue;
        const child = rel ? rel + '/' + name : name;
        const match = !nq || U.norm(name).includes(nq) || U.norm(child).includes(nq);
        if (h.kind === 'directory') {
          if (match && nq) hits.push({ name, rel: child, kind: 'dir' });
          await walkNames(child, depth + 1);
        } else if (match) {
          let size = null;
          try { size = (await h.getFile()).size; } catch (e) { size = null; }
          hits.push({ name, rel: child, kind: 'file', size, ext: (name.split('.').pop() || '').toLowerCase() });
        }
      }
    };
    await walkNames('', 0);
    return hits;
  };
  store.makeSubdir = async (rootParts, parentRel, folderName) => {
    const raw = String(folderName || '').trim();
    if (!raw || /[\\/]/.test(raw) || raw === '.' || raw === '..') throw Error('norādi vienu mapes nosaukumu');
    const name = raw.replace(/[\\/:*?"<>|]/g, '_');
    const parent = [...rootParts, ...pathSegments(parentRel)];
    if (!within(rootParts, parent)) throw Error('mape ir ārpus personas mapes');
    const dir = await openDir(parent, false);
    try { await dir.getDirectoryHandle(name); throw Error('šāda mape jau ir'); } catch (e) { if (e.message === 'šāda mape jau ir') throw e; if (e.name !== 'NotFoundError') throw e; }
    try { await dir.getFileHandle(name); throw Error('fails ar šādu nosaukumu jau ir'); } catch (e) { if (e.message === 'fails ar šādu nosaukumu jau ir') throw e; if (e.name !== 'NotFoundError') throw e; }
    await dir.getDirectoryHandle(name, { create: true });
    return (pathSegments(parentRel).concat(name)).join('/');
  };
  /**
   * Pārdēvē vai pārvieto tikai personas mapes iekšienē.
   * Lieto pārlūka move(). Ja tas nav pieejams, neko nemaina.
   * Pēc move pārbauda, ka galamērķis ir nolasāms un faila izmērs sakrīt. Nekas netiek dzēsts papildus.
   */
  store.relocate = async (rootParts, fromRel, toDirRel, newName) => {
    const fromSeg = pathSegments(fromRel);
    if (!fromSeg.length) throw Error('nav ko pārvietot');
    const name = fromSeg.pop();
    const fromParts = [...rootParts, ...fromSeg];
    const destParts = [...rootParts, ...pathSegments(toDirRel)];
    if (!within(rootParts, fromParts) || !within(rootParts, destParts)) throw Error('darbība ir ārpus personas mapes');
    const target = String(newName || name).trim();
    if (!target || /[\\/]/.test(target) || target === '.' || target === '..') throw Error('nederīgs nosaukums');
    const fromFull = [...fromParts, name].join('/');
    const destFull = destParts.join('/');
    if (destFull === fromFull || destFull.startsWith(fromFull + '/')) throw Error('mapi nevar ievietot sevī');
    const srcDir = await openDir(fromParts, false);
    const destDir = await openDir(destParts, false);
    let handle;
    try { handle = await srcDir.getFileHandle(name); }
    catch (e) {
      if (e.name !== 'NotFoundError') throw e;
      handle = await srcDir.getDirectoryHandle(name);
    }
    if (typeof handle.move !== 'function') throw Error('Šis pārlūks neļauj droši pārdēvēt vai pārvietot. Dokuments paliek savā vietā.');
    const samePlace = await srcDir.isSameEntry(destDir);
    if (!(samePlace && target === name)) {
      let clash = false;
      try { await destDir.getFileHandle(target); clash = true; } catch (e) { if (e.name !== 'NotFoundError') throw e; }
      if (!clash) try { await destDir.getDirectoryHandle(target); clash = true; } catch (e) { if (e.name !== 'NotFoundError') throw e; }
      if (clash) throw Error('šāds nosaukums jau ir — esošais fails netika pārrakstīts');
    }
    let sizeBefore = null;
    if (handle.kind === 'file') sizeBefore = (await handle.getFile()).size;
    if (!(samePlace && target === name)) {
      if (samePlace) await handle.move(target);
      else await handle.move(destDir, target);
    }
    let next;
    try { next = handle.kind === 'file' ? await destDir.getFileHandle(target) : await destDir.getDirectoryHandle(target); }
    catch (e) { throw Error('galamērķis pēc darbības nav nolasāms. Programma neko papildus nedzēsa.'); }
    if (handle.kind === 'file') {
      const f = await next.getFile();
      if (f.size !== sizeBefore) throw Error('faila izmērs pēc pārvietošanas nesakrīt. Programma neko papildus nedzēsa.');
    }
    return { from: fromFull, path: [...destParts, target].join('/'), kind: handle.kind };
  };
  store.reindexDir = async parts => {
    const prefix = parts.join('/');
    S.index = S.index.filter(x => x.sourceId !== 'main' || (x.path !== prefix && !x.path.startsWith(prefix + '/')));
    const src = S.roots.find(r => r.id === 'main');
    if (!src?.handle) return;
    const dir = await openDir(parts, false);
    await walk(dir, prefix, src, parts.length, S.index);
  };
  store.folderSlug = p => {
    const s = `${p?.last || ''}_${p?.first || ''}`.trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    return s || 'persona';
  };
  /** Jaunai personai piešķir nemainīgu mapes ID. Esošai personai bez ID ceļš netiek mainīts. */
  store.assignFolder = p => {
    if (!p || p.folderId) return p;
    const n = Number(S.db.nextFolderSeq) || 1;
    p.folderId = 'P' + String(n).padStart(6, '0');
    p.folderLabel = store.folderSlug(p);
    S.db.nextFolderSeq = n + 1;
    return p;
  };
  store.personFolder = p => {
    if (p?.folderId) return [U.schoolYear(), 'Personu dokumenti', `${p.folderId}_${p.folderLabel || store.folderSlug(p)}`];
    return [U.schoolYear(), 'Personu dokumenti', `${p?.last || ''} ${p?.first || ''}`.trim() || 'persona'];
  };
  store.ensureYearFolders = async () => {
    if (!S.root) return;
    if (!(await ensurePerm(true))) throw Error('nav rakstīšanas atļaujas');
    const mk = async parts => {
      let dir = S.root;
      for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
      return dir;
    };
    await mk(['Dokumenti']);
    await mk(['Rezerves_kopijas']);
    for (const y of S.db.years || []) {
      for (const sub of ['Dokumenti', 'Pasakumi', 'Atskaites', 'Personas']) await mk(['Macibu_gadi', y.id, sub]);
    }
  };
  store.createYear = async () => {
    if (!S.root) return CP.ui.toast('Vispirms izvēlies datu mapi', 'warn');
    try {
      if (!(await ensurePerm(true))) throw Error('nav rakstīšanas atļaujas');
      const h = await S.root.getDirectoryHandle(U.schoolYear(), { create: true });
      await h.getDirectoryHandle('Personu dokumenti', { create: true });
      await store.scanAll(); CP.ui.toast('Izveidota mape ' + U.schoolYear() + '/Personu dokumenti', 'ok');
    } catch (e) { CP.ui.toast('Neizdevās izveidot: ' + e.message, 'err'); }
  };

  /* --- Brīdinājums, ja programma atvērta vairākās cilnēs --- */
  try {
    const bc = new BroadcastChannel('cadet-personals' + (CP.CHANNEL === 'test' ? '-test' : ''));
    bc.onmessage = e => {
      if (e.data === 'hello') bc.postMessage('here');
      if (e.data === 'here') CP.ui.toast('Programma ir atvērta arī citā cilnē. Strādā tikai vienā, lai izmaiņas nepārrakstītu viena otru.', 'warn', 12000);
    };
    setTimeout(() => bc.postMessage('hello'), 500);
  } catch (e) { CP.ui?.toast?.('Vairāku ciļņu brīdinājums nav pieejams šajā pārlūkā', 'warn'); }

  CP.store = store;
})(window.CP);


/* ==== js/ui.js ==== */
/* =====================================================================
   Saskarne: ziņojumi, maršrutēšana, sānjosla, kopīgie komponenti.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data;
  const ui = {};

  /* --- Ziņojumi: vienmēr redzami tajā logā, kurā lietotājs strādā --- */
  ui.toast = (msg, type = 'ok', ms = 5000, action = null) => {
    const dialogs = U.qsa('dialog[open]'), top = dialogs.at(-1);
    if (top && top.id === 'scanDialog' && CP.scan) { CP.scan.msg(msg, type); return; }
    const parent = top || document.body;
    let host = parent.querySelector(':scope > .toast-host');
    if (!host) { host = document.createElement('div'); host.className = 'toast-host'; parent.appendChild(host); }
    const el = document.createElement('div');
    el.className = 'toast ' + type; el.setAttribute('role', 'status');
    el.innerHTML = `<span>${U.esc(msg)}</span>${action ? `<button class="sm mainbtn" data-act="${action.act}" data-arg="${U.esc(action.arg || '')}">${U.esc(action.label)}</button>` : ''}<button class="x" aria-label="Aizvērt">✕</button>`;
    if (action) el.querySelector('[data-act]').addEventListener('click', () => setTimeout(() => el.remove(), 50));
    el.querySelector('.x').onclick = () => el.remove();
    host.appendChild(el);
    while (host.children.length > 3) host.firstChild.remove();
    if (ms > 0) setTimeout(() => el.remove(), ms);   // 0 = paliek, līdz lietotājs aizver
  };

  ui.updateSaveState = () => {
    const lbl = U.$('rootLabel');
    const B = S.boot;
    if (lbl) lbl.innerHTML = S.root
      ? `<span class="dotstate ${S.conflict ? 'err' : S.dirty ? 'warn' : 'ok'}"></span>${U.esc(S.rootName)} · ${S.conflict ? 'konflikts' : S.dirty ? 'nesaglabāts' : B?.step === 'index' ? 'indeksē…' : 'saglabāts'}`
      : B && !B.error ? `<span class="spin"></span> Atver ${B.name ? '“' + U.esc(B.name) + '”' : 'datu mapi'}…`
      : B?.error ? '<span class="dotstate err"></span> Mape nav pieejama'
      : S.pendingRoot ? 'Jāapstiprina piekļuve' : 'Datu mape nav izvēlēta';
    U.qsa('[data-act="save"]').forEach(b => { b.classList.toggle('pending', S.dirty); });
  };

  /* --- Maršrutēšana --- */
  /* Atpakaļ: iekšējā vēsture + pārlūka/peles “atpakaļ” poga (history API, bez adreses maiņas) */
  const navStack = [];
  const PAGE_NAMES = { feedback: 'Ziņot', dashboard: 'Pārskats', people: 'Personas', comms: 'Saziņa', documents: 'Dokumenti', equipment: 'Ekipējums', alerts: 'Uzdevumi', settings: 'Iestatījumi', archive: 'Arhīvs', about: 'Par rīku', forms: 'Veidlapas', formEdit: 'Veidlapa', attendance: 'Apmeklējums', schedule: 'Grafiks' };
  const placeName = st => st.page === 'person' ? (U.full(D.person(st.person)) || 'Persona') : st.page === 'people' && st.archived ? 'Arhīvs' : (PAGE_NAMES[st.page] || 'Iepriekšējā lapa');
  ui.go = (page, opts = {}) => {
    const view = U.$('view');
    const same = S.page === page && (page !== 'person' || !opts.person || opts.person === S.selected);
    if (!opts.back && !same) {
      navStack.push({ page: S.page, person: S.selected, tab: S.tab, scroll: view ? view.scrollTop : 0, archived: S.list?.status === 'archived' });
      if (navStack.length > 40) navStack.shift();
      try { history.pushState({ cp: navStack.length }, ''); } catch (e) { /* nav būtiski */ }
    }
    S.page = page;
    if (opts.person) { S.selected = opts.person; S.tab = opts.tab || 'overview'; }
    CP.render();
    if (view) view.scrollTop = opts.scroll || 0;
  };
  function doBack() {
    const prev = navStack.pop(); if (!prev) return false;
    if (prev.page === 'people' && S.list) S.list.status = prev.archived ? 'archived' : (S.list.status === 'archived' ? 'current' : S.list.status);
    ui.go(prev.page, { back: true, person: prev.page === 'person' ? prev.person : '', tab: prev.tab, scroll: prev.scroll });
    return true;
  }
  ui.backBtn = () => {
    const prev = navStack[navStack.length - 1]; if (!prev) return '';
    return `<button type="button" class="ghost sm backbtn" data-act="goBack" title="Atpakaļ (Alt + ←)">← ${U.esc(placeName(prev))}</button>`;
  };
  CP.actions.goBack = () => { if (!navStack.length) return; try { history.back(); } catch (e) { doBack(); } };
  window.addEventListener('popstate', () => { if (!doBack()) { /* ārpus rīka vēstures — paliek, kur ir */ } });
  /* --- Bez datu mapes nevar strādāt: skaidrs paziņojums un aizliegtas darbības --- */
  const NOROOT_OK = /^(pickRoot|restoreRoot|retryRestore|bootNew|reloadApp|installApp|newsAll|setTheme|setAccent|watch\w*|break\w*|goBack|jCancel|needRootPick|encRestore\w*|fb\w*|copy)$/;
  CP.noRootOk = act => NOROOT_OK.test(act);
  const NOROOT_PAGES = new Set(['dashboard', 'about', 'feedback']);
  ui.rootSteps = () => `<ol class="root-steps">
      <li><b>Izveido datorā mapi</b> rīka datiem, piem., <i>Dokumenti\\CADET PERSONALS</i>, vai uz šifrētas zibatmiņas. Ja rīku jau lieto, izmanto to pašu mapi, kur ir dati.</li>
      <li>Spied <b>📁 Izvēlēties datu mapi</b> un izvēlies šo mapi. Mapi var arī ievilkt no File Explorer.</li>
      <li>Kad Chrome jautā, atļauj <b>rediģēt failus</b>. Nākamreiz rīks mapi atcerēsies.</li></ol>`;
  CP.needRoot = () => {
    let d = U.$('needRootDialog');
    if (!d) { d = document.createElement('dialog'); d.id = 'needRootDialog'; document.body.appendChild(d); }
    const pend = S.pendingRoot;
    d.innerHTML = `<header class="dlg-head"><h2>📁 Vispirms pievieno datu mapi</h2><button type="button" class="ghost" data-close="needRootDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><p>Rīks vēl nav pieslēgts datu mapei, tāpēc <b>neko nevar ievadīt un saglabāt</b>: personas, dokumenti un veidlapas glabājas tieši šajā mapē tavā datorā.</p>${ui.rootSteps()}</div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="needRootDialog">Vēlāk</button>${pend ? `<button type="button" class="mainbtn" data-act="needRootPick" data-arg="restore">🔓 Atļaut piekļuvi “${U.esc(pend.name)}”</button>` : `<button type="button" class="mainbtn" data-act="needRootPick">📁 Izvēlēties datu mapi</button>`}</footer>`;
    if (!d.open) d.showModal();
  };
  CP.actions.needRootPick = arg => { U.$('needRootDialog')?.close(); return arg === 'restore' ? CP.store.restoreRoot() : CP.store.pickRoot(); };
  const noRootPage = () => `<div class="page">${ui.pageHead(PAGE_NAMES[S.page] || 'Rīks', '')}<section class="card hero noroot"><h2>📁 Nav pievienota datu mape</h2>
      <p>Šī sadaļa strādā tikai ar pievienotu datu mapi. Rīks tajā glabā personu kartītes, dokumentus un veidlapas.</p>${ui.rootSteps()}
      <div class="actions">${S.pendingRoot ? `<button class="mainbtn" data-act="restoreRoot">🔓 Atļaut piekļuvi mapei “${U.esc(S.pendingRoot.name)}”</button><button data-act="pickRoot">Izvēlēties citu mapi</button>` : '<button class="mainbtn" data-act="pickRoot">📁 Izvēlēties datu mapi</button>'}</div>${ui.rootDrop()}</section></div>`;
  /** Ja zīmēšanas laikā kāds notikums (piem., lauka blur → change) prasa jaunu zīmēšanu, tā notiek uzreiz pēc tam, nevis iekšā */
  let rendering = false, again = false;
  CP.render = () => {
    if (rendering) { again = true; return; }
    rendering = true;
    try { renderNow(); } finally { rendering = false; }
    if (again) { again = false; queueMicrotask(CP.render); }
  };
  const renderNow = () => {
    if (CP.D2) CP.theme.apply();
    if (S.root && !CP._watchLoaded && CP.watchReload) { CP._watchLoaded = true; CP.watchReload(); }
    renderNav(); renderSide();
    const pg = CP.pages[S.page] || CP.pages.dashboard;
    document.documentElement.classList.toggle('noroot', !S.root);
    U.$('main').innerHTML = !S.root && !NOROOT_PAGES.has(S.page) && !S.boot ? noRootPage() : pg.render();
    pg.after?.();
    for (const f of CP.afterRender || []) { try { f(); } catch (e) { console.error(e); } }
    CP.years?.paint();
    ui.updateSaveState();
  };

  /** Lauks datu mapes ievilkšanai no File Explorer (rezerves veids, ja mapes dialogs nedarbojas). */
  ui.rootDrop = () => {
    const l = CP.store.diag?.last;
    const net = CP.store.netPath ? `<div class="netwarn">⚠ ${U.esc(CP.store.netPathMsg())}<br><span class="small muted">Pašreizējā adrese: ${U.esc(decodeURI(location.href))}</span></div>` : '';
    return net + `<div class="rootdrop" data-rootdrop="1"><b>⇩ Ievelc datu mapi šeit</b><span class="small muted">Atver File Explorer, satver mapi (piem. “CADET PERSONALS”) un ievelc to šajā laukā. Darbojas arī tad, ja mapes dialogs rāda kļūdu.</span></div>`
      + (l && l.error && !S.boot?.error ? `<p class="small err-text">Pēdējā kļūda (${U.esc(l.via)} → ${U.esc(l.step)}${l.ms != null ? ', ' + l.ms + ' ms' : ''}): ${U.esc(l.error)}</p>` : '');
  };

  function renderNav() {
    const nav = S.page === 'person' ? 'people' : S.page === 'formEdit' ? 'forms' : S.page;
    U.qsa('.nav [data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === nav));
    const n = D.alerts().filter(a => a.sev > 0).length, badge = U.$('alertBadge');
    if (badge) { badge.textContent = n; badge.classList.toggle('hidden', !n); }
  }

  function renderSide() {
    const extras = (S.roots || []).filter(r => r.id !== 'main' && !r.ok);
    U.$('restoreBox').innerHTML = (S.pendingRoot && !S.root
      ? `<button class="mainbtn sm block" data-act="restoreRoot">🔓 Atļaut piekļuvi “${U.esc(S.pendingRoot.name)}”</button>` : '')
      + extras.map(r => `<button class="sm block" data-act="reconnectSource" data-arg="${U.esc(r.id)}" style="margin-top:6px">🔓 Pieslēgt “${U.esc(r.name)}”</button>`).join('');
    const gs = D.groups(); if (S.groupFilter && !gs.includes(S.groupFilter)) S.groupFilter = '';
    U.$('groupFilter').innerHTML = `<option value="">Visas grupas</option>` + gs.map(g => `<option ${g === S.groupFilter ? 'selected' : ''}>${U.esc(g)}</option>`).join('');
    U.$('sideArchive').checked = S.sideArchive;
    const q = U.norm(U.$('search').value).replace(/ /g, '');
    const people = S.db.people.filter(p => D.inYear(p) && (S.sideArchive ? p.status === 'archived' : p.status !== 'archived') && (!S.groupFilter || D.groupOf(p) === S.groupFilter)
      && (!q || U.norm([U.full(p), U.sortName(p), D.groupOf(p), p.parentName, p.parent2Name, p.phone, p.parentPhone, p.email, p.parentEmail, p.school].join(' ')).replace(/ /g, '').includes(q)))
      .sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
    U.$('sideCount').textContent = people.length;
    U.$('sideList').innerHTML = people.map(p => {
      const miss = p.status !== 'archived' && D.missingDocs(p).length;
      return `<button class="person ${S.page === 'person' && S.selected === p.id ? 'active' : ''} ${p.status === 'archived' ? 'archived' : ''}" data-person="${p.id}">
        ${ui.avatar(p)}<span class="p-meta"><b>${U.esc(U.sortName(p))}</b><small>${U.esc(D.groupOf(p) || 'Bez grupas')}${D.partStatus(p) !== 'active' ? ' · ' + (CP.STATUSES[D.partStatus(p)] || '') : ''}</small></span>
        ${miss ? `<span class="dot" title="Trūkst dokumentu: ${miss}"></span>` : ''}</button>`;
    }).join('') || `<p class="muted small pad">${S.boot && !S.root ? (S.boot.error ? 'Datu mape nav pieejama' : 'Gaida datu mapi…') : S.db.people.length ? 'Šajā mācību gadā neviens nav atrasts' : 'Vēl nav personu'}</p>`;
  }
  ui.renderSide = renderSide;

  /* --- Komponenti --- */
  ui.avatar = (p, size = '') => `<span class="avatar ${size}" style="--h:${hue(p.id)}">${U.esc(U.initials(p))}</span>`;
  function hue(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
  ui.status = s => `<span class="status s-${s}">${CP.STATUSES[s] || s}</span>`;
  ui.pageHead = (title, sub = '', actions = '') =>
    `<header class="page-head"><div>${ui.backBtn()}<h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div><div class="actions">${actions}</div></header>`;
  ui.saveBtn = () => `<button data-act="save" class="mainbtn ${S.dirty ? 'pending' : ''}" title="Ctrl+S">${CP.ic('save', '💾')} Saglabāt</button>`;
  ui.empty = (text, action = '') => `<div class="empty"><p>${text}</p>${action}</div>`;
  /** Definīciju saraksts: etiķete pa kreisi, vērtība blakus (nevis ekrāna otrā malā) */
  ui.dl = rows => `<dl class="dl">${rows.filter(Boolean).map(([k, v, raw]) => `<dt>${U.esc(k)}</dt><dd>${raw ? (v || '<span class="muted">—</span>') : (v ? U.esc(v) : '<span class="muted">—</span>')}</dd>`).join('')}</dl>`;
  ui.chips = (items) => `<div class="chips">${items.join('')}</div>`;

  /** Formas lauki no CP.FIELDS — viena definīcija kartiņai un anketu ievadei */
  ui.fieldsHTML = ({ prefix = 'f_', filter = () => true, sectionIds = false } = {}) => {
    let h = '';
    for (const [sid, title] of CP.SECTIONS) {
      const fields = CP.FIELDS.filter(f => f.s === sid && filter(f)); if (!fields.length) continue;
      h += `<fieldset class="fs" ${sectionIds ? `id="${prefix}sec_${sid}"` : ''}><legend>${title}</legend><div class="fieldgrid">`;
      for (const f of fields) {
        const id = prefix + f.k, t = f.t || 'text'; let input;
        if (t === 'select') input = `<select id="${id}" name="${f.k}">${f.opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`;
        else if (t === 'textarea') input = `<textarea id="${id}" name="${f.k}" rows="2"></textarea>`;
        else input = `<input id="${id}" name="${f.k}" type="${t}" autocomplete="off" ${t === 'number' ? 'min="0" max="1200"' : ''} ${f.ph ? `placeholder="${U.esc(f.ph)}"` : ''} ${f.list ? `list="${f.list}"` : ''}>`;
        const pin = f.k === 'group' ? `<button type="button" class="pinbtn" data-act="pinGroup" title="Atcerēties grupu nākamajām personām" tabindex="-1">📌</button>` : '';
        if (f.k === 'group') input = `<div class="grp-field">${input.replace(/ list="[^"]*"/, '').replace('<input ', '<input data-grpinput aria-autocomplete="list" ')}<button type="button" class="grp-btn" data-grpbtn="${id}" title="Izvēlēties grupu no saraksta" aria-label="Izvēlēties grupu" aria-haspopup="listbox" tabindex="-1">▾</button></div>`;
        h += `<div class="field ${f.wide ? 'wide' : ''}" data-f="${f.k}"><label for="${id}">${f.l}${f.req ? ' <span class="reqmark">*</span>' : ''}${pin}<span class="fx"></span></label>${input}${f.k === 'group' ? '<div class="pinnote hidden"></div>' : ''}<div class="hint"></div></div>`;
      }
      h += `</div></fieldset>`;
    }
    return h;
  };
  ui.fillForm = (form, p) => {
    for (const f of CP.FIELDS) {
      const el = form.elements[f.k]; if (!el) continue;
      el.value = p?.[f.k] ?? (f.k === 'retentionMonths' ? String(S.db.settings.retentionDefault) : f.k === 'status' ? 'active' : f.k === 'group' && !p ? (S.db.settings.stickyGroup || '') : '');
      el.closest('.field')?.classList.remove('auto', 'warn', 'bad');
      const hint = el.closest('.field')?.querySelector('.hint'); if (hint) hint.innerHTML = '';
    }
    ui.syncPins();
  };
  /** Atcerētā grupa: jaunām personām ieliek automātiski, līdz to nomet */
  ui.syncPins = () => {
    const g = S.db.settings.stickyGroup || '';
    U.qsa('.pinbtn').forEach(b => { b.classList.toggle('on', !!g); b.title = g ? `Atcerēta grupa “${g}” — klikšķis nomet` : 'Atcerēties šo grupu nākamajām personām'; });
    U.qsa('.pinnote').forEach(n => { n.classList.toggle('hidden', !g); n.innerHTML = g ? `📌 Atcerēta: <b>${U.esc(g)}</b> <button type="button" class="sm ghost" data-act="pinGroup" data-arg="drop">✕ Nomest</button>` : ''; });
  };
  CP.actions.pinGroup = (arg, el) => {
    const s = S.db.settings, input = el?.closest('form')?.elements.group;
    if (arg === 'drop' || (s.stickyGroup && (!input || !input.value.trim() || input.value.trim() === s.stickyGroup))) { s.stickyGroup = ''; ui.toast('Grupa vairs netiek atcerēta', 'ok'); }
    else { const v = input?.value.trim(); if (!v) { ui.toast('Vispirms ieraksti grupu, ko atcerēties', 'warn'); input?.focus(); return; } s.stickyGroup = v; ui.toast(`Grupa “${v}” tiks ielikta katrai jaunai personai`, 'ok'); }
    CP.store.changed({ silent: true }); ui.syncPins();
  };
  /* Grupas izvēlne pie lauka (rīka stilā, zem lauka visā platumā): grupas ar personu skaitu, “bez grupas”, “jauna grupa”.
     Rakstot laukā, saraksts filtrējas; ↑↓ Enter izvēlas, Esc aizver. */
  const grpPop = {
    close() { U.qsa('.grp-pop').forEach(p => p.remove()); U.qsa('.grp-field.open').forEach(f => f.classList.remove('open')); },
    open(input, filter = '') {
      const field = input.closest('.grp-field'); if (!field) return;
      let pop = field.querySelector('.grp-pop');
      if (!pop) { grpPop.close(); pop = document.createElement('div'); pop.className = 'grp-pop'; pop.setAttribute('role', 'listbox'); field.appendChild(pop); field.classList.add('open'); }
      const q = U.norm(filter), cnt = g => D.peopleInYear().filter(D.isCurrent).filter(p => D.groupOf(p) === g).length;
      const gs = D.groups().filter(g => !q || U.norm(g).includes(q)), cur = input.value.trim();
      pop.innerHTML = `${gs.map(g => `<button type="button" class="grp-opt ${g === cur ? 'cur' : ''}" data-grpval="${U.esc(g)}" role="option"><span>${U.esc(g)}</span><small>${cnt(g)}</small></button>`).join('') || (q ? `<div class="grp-empty">Nav grupas “${U.esc(filter)}”</div>` : '<div class="grp-empty">Grupu vēl nav</div>')}
        <div class="grp-sep"></div>
        ${q && !D.groups().includes(filter.trim()) ? `<button type="button" class="grp-opt grp-add" data-grpnew="${U.esc(filter.trim())}"><span>＋ Izveidot grupu “${U.esc(filter.trim())}”</span></button>` : ''}
        <button type="button" class="grp-opt muted" data-grpval=""><span>— bez grupas —</span></button>
        <div class="grp-newrow"><input type="text" class="grp-newin" placeholder="＋ Jauna grupa…" aria-label="Jaunās grupas nosaukums"><button type="button" class="sm mainbtn" data-grpadd>Pievienot</button></div>`;
      pop._input = input; pop._i = -1;
    },
    pick(pop, v, isNew) {
      const input = pop._input; if (!input) return;
      v = String(v || '').trim();
      if (isNew && v) { if (D.addGroup(v)) CP.store.changed({ silent: true }); ui.datalists(); }
      input.value = v; grpPop.close(); input.focus();
      input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    move(pop, d) { const opts = [...pop.querySelectorAll('.grp-opt')]; if (!opts.length) return; pop._i = (pop._i + d + opts.length) % opts.length; opts.forEach((o, i) => o.classList.toggle('act', i === pop._i)); opts[pop._i].scrollIntoView({ block: 'nearest' }); }
  };
  ui.grpPop = grpPop;
  document.addEventListener('click', e => {
    const btn = e.target.closest?.('[data-grpbtn]');
    if (btn) { const input = U.$(btn.dataset.grpbtn), open = btn.closest('.grp-field').classList.contains('open'); if (open) grpPop.close(); else { grpPop.open(input); input.focus(); } return; }
    const pop = e.target.closest?.('.grp-pop');
    if (pop) {
      const o = e.target.closest('[data-grpval],[data-grpnew],[data-grpadd]'); if (!o) return;
      if (o.dataset.grpadd != null) { const v = pop.querySelector('.grp-newin').value.trim(); if (!v) { pop.querySelector('.grp-newin').focus(); return; } grpPop.pick(pop, v, true); }
      else if (o.dataset.grpnew != null) grpPop.pick(pop, o.dataset.grpnew, true);
      else grpPop.pick(pop, o.dataset.grpval);
      return;
    }
    if (!e.target.closest?.('.grp-field')) grpPop.close();
  });
  document.addEventListener('input', e => { if (e.target.matches?.('[data-grpinput]') && e.isTrusted) grpPop.open(e.target, e.target.value); });
  document.addEventListener('keydown', e => {
    const t = e.target, field = t.closest?.('.grp-field'), pop = field?.querySelector('.grp-pop');
    if (t.matches?.('.grp-newin')) { if (e.key === 'Enter') { e.preventDefault(); const v = t.value.trim(); if (v) grpPop.pick(pop, v, true); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); grpPop.close(); field.querySelector('[data-grpinput]').focus(); } return; }
    if (!t.matches?.('[data-grpinput]')) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!pop) grpPop.open(t); grpPop.move(field.querySelector('.grp-pop'), e.key === 'ArrowDown' ? 1 : -1); }
    else if (e.key === 'Enter' && pop && pop._i >= 0) { e.preventDefault(); pop.querySelectorAll('.grp-opt')[pop._i]?.click(); }
    else if (e.key === 'Escape' && pop) { e.preventDefault(); e.stopPropagation(); grpPop.close(); }
    else if (e.key === 'Tab') grpPop.close();
  }, true);
  document.addEventListener('close', () => grpPop.close(), true);
  // Ja grupa ir piesprausta un lietotājs to nomaina — atceras jauno vērtību
  document.addEventListener('change', e => {
    if (e.target.name === 'group' && S.db.settings.stickyGroup && e.target.value.trim() && e.target.closest('#personForm,#scanForm')) { S.db.settings.stickyGroup = e.target.value.trim(); CP.store.changed({ silent: true }); ui.syncPins(); }
  });
  ui.readForm = form => {
    const o = {};
    for (const f of CP.FIELDS) { const el = form.elements[f.k]; if (el) o[f.k] = String(el.value || '').trim(); }
    if ('retentionMonths' in o) o.retentionMonths = Number(o.retentionMonths || S.db.settings.retentionDefault);
    return o;
  };
  /** Pārbauda laukus; atgriež {errors, warnings}. Brīdinājumi neaptur saglabāšanu. */
  /** Rāda pie tālruņa laukiem, ja numurs jau ir kādam citam (nebloķē saglabāšanu) */
  ui.phoneHints = (form, selfId) => {
    let suspicious = 0;
    for (const f of Object.keys(D.PHONE_FIELDS)) {
      const el = form.elements[f]; if (!el) continue;
      const box = el.closest('.field'); box.querySelector('.duphint')?.remove();
      if (!U.normPhone(el.value)) continue;
      const others = D.phoneMatches(el.value, selfId, f).filter(e => e.p.id !== selfId || e.f !== f);
      // tas pats numurs šajā formā citā laukā
      const local = Object.keys(D.PHONE_FIELDS).filter(g => g !== f && form.elements[g] && U.normPhone(form.elements[g].value) === U.normPhone(el.value));
      const ext = others.filter(e => e.p.id !== selfId);
      if (!ext.length && !local.length) continue;
      // aizdomīgi, ja numura īpašnieks (vārds) atšķiras; viens vecāks vairākiem bērniem — normāli
      const ownerHere = U.norm(f === 'phone' ? `${form.elements.first?.value || ''} ${form.elements.last?.value || ''}` : form.elements[f.replace('Phone', 'Name')]?.value);
      const owners = new Set([ownerHere, ...ext.map(e => D.phoneOwner(e.p, e.f)), ...local.map(g => U.norm(g === 'phone' ? `${form.elements.first?.value || ''} ${form.elements.last?.value || ''}` : form.elements[g.replace('Phone', 'Name')]?.value))].filter(Boolean));
      const bad = owners.size > 1;
      if (bad) suspicious++;
      const fam = !bad && ext.length > 0;
      const d = document.createElement('div'); d.className = 'duphint ' + (bad ? 'bad' : 'info');
      d.innerHTML = `${bad ? '⚠' : 'ℹ'} Šis numurs jau ir: ${[...ext.map(e => e.f === 'phone' ? `<b>${U.esc(U.full(e.p))}</b> (jaunietis)` : `<b>${U.esc(e.p[e.f.replace('Phone', 'Name')] || '?')}</b> (${e.role}, ${U.esc(U.full(e.p))})`), ...local.map(g => `šajā kartiņā — ${D.PHONE_FIELDS[g]}`)].join(', ')}${fam ? ' — tas pats vecāks (brāļi/māsas)' : bad ? ' — <b>dažādi īpašnieki, pārbaudi</b>' : ''}`;
      box.appendChild(d);
    }
    return suspicious;
  };
  ui.checkForm = (form, o) => {
    let errors = 0, warnings = 0;
    for (const f of CP.FIELDS) {
      const el = form.elements[f.k]; if (!el) continue;
      const box = el.closest('.field'), hint = box.querySelector('.hint');
      box.classList.remove('bad', 'warn'); hint.textContent = '';
      if (f.req && !o[f.k]) { box.classList.add('bad'); hint.textContent = 'Obligāts lauks'; errors++; continue; }
      if (f.v && o[f.k]) {
        const r = U.validate(f.v, o[f.k]);
        if (!r.ok) { box.classList.add('warn'); hint.textContent = 'Pārbaudi: ' + r.msg; warnings++; }
        else if (['personalCode', 'phone', 'email'].includes(f.v)) { o[f.k] = r.value; el.value = r.value; }
      }
    }
    return { errors, warnings };
  };
  ui.datalists = () => {
    U.$('dl_groups').innerHTML = D.groups().map(g => `<option value="${U.esc(g)}">`).join('');
  };
  ui.personOptions = (sel, chosen, all = false) => {
    U.$(sel).innerHTML = S.db.people.filter(p => (all || D.isCurrent(p) || p.id === chosen) && (D.inYear(p) || p.id === chosen)).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)))
      .map(p => `<option value="${p.id}" ${p.id === chosen ? 'selected' : ''}>${U.esc(U.sortName(p))}${D.groupOf(p) ? ' · ' + U.esc(D.groupOf(p)) : ''}</option>`).join('');
  };
  ui.kindOptions = sel => S.db.settings.docKinds.map(k => `<option ${k === sel ? 'selected' : ''}>${U.esc(k)}</option>`).join('');

  CP.ui = ui;
})(window.CP);


/* ==== js/people.js ==== */
/* =====================================================================
   Personas: saraksts (tabula ar filtriem un masveida darbībām),
   personas kartiņa, rediģēšana, statusi, arhīvs, vēsture, saistības.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions;
  const esc = U.esc;

  /* =================== Saraksts =================== */
  const STATUS_FILTERS = [['current', 'Visi aktuālie'], ['active', 'Jaunsargi'], ['candidate', 'Kandidāti'], ['paused', 'Pārtrauktie'], ['archived', 'Arhīvs'], ['all', 'Visi ieraksti']];

  function listRows() {
    const L = S.list, q = U.norm(L.q).replace(/ /g, ''), last = D.lastContact();
    let rows = S.db.people.filter(p => D.inYear(p) &&
      (L.status === 'all' || (L.status === 'current' ? D.partStatus(p) !== 'archived' : D.partStatus(p) === L.status)) &&
      (!L.group || D.groupOf(p) === L.group) &&
      (!L.missing || (D.partStatus(p) !== 'archived' && D.missingDocs(p).length)) &&
      (!q || U.norm([U.full(p), U.sortName(p), D.groupOf(p), p.parentName, p.phone, p.parentPhone, p.email, p.parentEmail, p.school, p.schoolClass].join(' ')).replace(/ /g, '').includes(q)));
    const key = {
      name: p => U.sortName(p).toLocaleLowerCase('lv'), group: p => (D.groupOf(p) || '~').toLocaleLowerCase('lv'), age: p => p.birth || '9999',
      status: p => D.partStatus(p), docs: p => D.missingDocs(p).length, contact: p => last[p.id] || ''
    }[L.sort] || (p => U.sortName(p));
    rows.sort((a, b) => { const x = key(a), y = key(b); const c = typeof x === 'number' ? x - y : U.cmp(x, y); return (c || U.cmp(U.sortName(a), U.sortName(b))) * L.dir; });
    return { rows, last };
  }

  function listTable() {
    const { rows, last } = listRows(), L = S.list, req = S.db.settings.requiredDocs.length;
    for (const id of [...L.sel]) if (!rows.some(r => r.id === id)) L.sel.delete(id);
    const th = (k, t) => `<th class="sortable ${L.sort === k ? 'on' : ''}" data-act="listSort" data-arg="${k}">${t}${L.sort === k ? (L.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
    const all = rows.length && rows.every(r => L.sel.has(r.id));
    const bulk = L.sel.size ? `<div class="bulkbar"><b>Atlasītas ${L.sel.size}</b>
      <button class="sm" data-act="bulkMsg">✉ Ziņa</button>
      <button class="sm" data-act="bulkGroup">Mainīt grupu…</button>
      <select class="sm" data-bulk="status"><option value="">Mainīt statusu…</option><option value="active">Jaunsargs</option><option value="candidate">Kandidāts</option><option value="paused">Pārtraukts</option></select>
      <button class="sm" data-act="bulkReg" data-arg="dvs" title="Atzīmēt, ka atlasītajiem visi obligātie dokumenti reģistrēti DVS">✓ DVS (visi dok.)</button>
      <button class="sm" data-act="bulkReg" data-arg="eklase" title="Atzīmēt, ka atlasītie ievadīti e-klasē">✓ e-klase</button>
      <button class="sm" data-act="bulkCsv">⬇ CSV</button>
      <button class="sm" data-act="bulkVcard" title="Kontakti Google / telefonam">📇 vCard</button>
      <button class="sm" data-act="bulkArchive">Arhivēt</button>
      <button class="sm ghost" data-act="bulkClear">Notīrīt</button></div>` : '';
    return bulk + `<div class="tablewrap"><table class="table">
      <thead><tr><th class="chk"><input type="checkbox" data-act="listAll" ${all ? 'checked' : ''} aria-label="Atlasīt visus"></th>
      ${th('name', 'Persona')}${th('group', 'Grupa')}${th('age', 'Vecums')}${th('status', 'Statuss')}<th>Vecāks / kontakts</th>${th('docs', 'Dokumenti')}${th('contact', 'Pēdējā saziņa')}</tr></thead>
      <tbody>${rows.map(p => {
        const miss = D.missingDocs(p), c = D.contacts(p).find(c => c.kind === 'parent') || D.contacts(p)[0];
        return `<tr class="${L.sel.has(p.id) ? 'sel' : ''}" data-person="${p.id}">
          <td class="chk"><input type="checkbox" data-act="listSel" data-arg="${p.id}" ${L.sel.has(p.id) ? 'checked' : ''} aria-label="Atlasīt"></td>
          <td><div class="who">${ui.avatar(p, 'sm')}<span><b>${esc(U.sortName(p))}</b><small class="muted">${esc([p.school, p.schoolClass].filter(Boolean).join(', '))}</small></span></div></td>
          <td>${esc(D.groupOf(p) || '—')}</td>
          <td>${p.birth ? U.age(p.birth) : '—'}</td>
          <td>${ui.status(D.partStatus(p))}</td>
          <td>${c ? `<span>${esc(c.name || c.role)}</span><small class="muted">${esc(c.phone ? U.prettyPhone(c.phone) : c.email)}</small>` : '<span class="muted">—</span>'}</td>
          <td>${D.partStatus(p) === 'archived' ? '<span class="muted">—</span>' : miss.length ? `<span class="pill warn" title="Trūkst: ${esc(miss.join(', '))}">${req - miss.length}/${req}</span>` : `<span class="pill ok">${req}/${req}</span>`}</td>
          <td class="muted small">${last[p.id] ? U.fmtDate(last[p.id].slice(0, 10)) : '—'}</td></tr>`;
      }).join('')}</tbody></table>
      ${rows.length ? '' : ui.empty(S.db.people.length ? 'Šajā mācību gadā pēc šiem filtriem neviens netika atrasts.' : 'Šajā mācību gadā vēl nav personu.', `<div class="actions center"><button class="mainbtn" data-act="openMove">Pārcelt no cita gada</button><button data-act="addPerson">＋ Jauna persona</button><button data-act="scan">📷 Ievadīt no anketas</button></div>`)}</div>
      <p class="muted small">${rows.length} personas mācību gadā ${esc(U.yearLabel(D.activeYear()))}</p>`;
  }

  CP.pages.people = {
    render() {
      const L = S.list, gs = D.groups();
      return `<div class="page">` + ui.pageHead('Personas', `Mācību gads ${U.yearLabel(D.activeYear())}. Viena persona ir viens profils.`,
        `<button data-act="openMove">Pārcelt no cita gada</button><button data-act="scan">📷 Ievadīt no anketas</button><button data-act="import">⬆ Imports</button><button class="mainbtn" data-act="addPerson">＋ Jauna persona</button>`)
        + (CP.years?.banner() || '')
        + `<div class="filters card">
          <input id="listQ" type="search" placeholder="Meklēt vārdu, tālruni, vecāku, skolu…" value="${esc(L.q)}">
          <select data-list="status">${STATUS_FILTERS.map(([v, t]) => `<option value="${v}" ${L.status === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <select data-list="group"><option value="">Visas grupas</option>${gs.map(g => `<option ${g === L.group ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
          <label class="check"><input type="checkbox" data-list="missing" ${L.missing ? 'checked' : ''}> Tikai ar trūkstošiem dokumentiem</label>
        </div><div id="listBody">${listTable()}</div></div>`;
    }
  };
  CP.inputHandlers.push(e => { if (e.target.id !== 'listQ') return false; S.list.q = e.target.value; U.$('listBody').innerHTML = listTable(); return true; });
  CP.changeHandlers.push(e => {
    const k = e.target.dataset.list; if (k) { S.list[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; CP.render(); return true; }
    if (e.target.dataset.bulk === 'status' && e.target.value) {
      const st = e.target.value; for (const id of S.list.sel) { const p = D.person(id); if (p && p.status !== 'archived' && D.partStatus(p) !== st) { D.bindYear(p, { status: st, group: D.groupOf(p) }); D.audit(id, 'status', [CP.STATUSES[st]]); } }
      CP.store.changed(); ui.toast(`Statuss mainīts ${S.list.sel.size} personām`, 'ok'); return true;
    }
    return false;
  });
  A.listSort = k => { const L = S.list; if (L.sort === k) L.dir *= -1; else { L.sort = k; L.dir = 1; } U.$('listBody').innerHTML = listTable(); };
  A.listSel = id => { const s = S.list.sel; s.has(id) ? s.delete(id) : s.add(id); U.$('listBody').innerHTML = listTable(); };
  A.listAll = () => { const { rows } = listRows(), s = S.list.sel, all = rows.every(r => s.has(r.id)); rows.forEach(r => all ? s.delete(r.id) : s.add(r.id)); U.$('listBody').innerHTML = listTable(); };
  A.bulkClear = () => { S.list.sel.clear(); U.$('listBody').innerHTML = listTable(); };
  A.bulkMsg = () => { S.comms.ids = new Set(S.list.sel); S.comms.group = ''; S.comms.done.clear(); ui.go('comms'); };
  A.bulkCsv = () => CP.io.exportCsv(S.db.people.filter(p => S.list.sel.has(p.id)));
  A.bulkGroup = () => {
    const g = prompt(`Jaunā grupa ${S.list.sel.size} personām:`, S.list.group || ''); if (g === null) return;
    for (const id of S.list.sel) { const p = D.person(id); if (p && D.groupOf(p) !== g.trim()) { D.bindYear(p, { group: g.trim(), status: D.partStatus(p) === 'archived' ? 'archived' : (D.enroll(p.id)?.status || 'active') }); D.audit(id, 'update', ['Grupa']); } }
    CP.store.changed(); ui.toast('Grupa nomainīta', 'ok');
  };
  A.bulkArchive = () => {
    const ids = [...S.list.sel].filter(id => D.person(id)?.status !== 'archived'); if (!ids.length) return;
    if (!confirm(`Arhivēt ${ids.length} personas ar šodienas izstāšanās datumu? Dati netiek dzēsti.`)) return;
    for (const id of ids) archive(D.person(id), { left: U.iso(), reason: '', months: S.db.settings.retentionDefault });
    S.list.sel.clear(); CP.store.changed();
  };

  /* =================== Personas kartiņa =================== */
  const TABS = [['overview', 'Pārskats'], ['data', 'Visi dati'], ['docs', 'Dokumenti'], ['history', 'Vēsture'], ['relations', 'Saistības'], ['equipment', 'Ekipējums'], ['idcard', 'Apliecība']];
  const TAB_IC = { overview: 'layout', data: 'list', docs: 'file', history: 'clock', relations: 'link', equipment: 'backpack', idcard: 'idcard' };

  CP.pages.person = {
    render() {
      const p = D.person(S.selected);
      if (!p) { S.page = 'people'; return CP.pages.people.render(); }
      const miss = D.missingDocs(p), docs = D.docsOf(p), fam = D.family(p).length + S.db.relations.filter(r => r.a === p.id || r.b === p.id).length;
      const openTasks = S.db.tasks.filter(t => t.personId === p.id && !t.done).length, eq = D.openEquipment(p).length;
      const sub = [`<span class="tag">${esc(U.yearLabel(D.activeYear()))}</span>`, D.groupOf(p) && `<span class="tag">${esc(D.groupOf(p))}</span>`, p.birth && `${U.age(p.birth)} g.`, [p.school, p.schoolClass].filter(Boolean).map(esc).join(', ')].filter(Boolean).join(' · ');
      const head = `${ui.backBtn()}<header class="person-head">${ui.avatar(p, 'lg')}<div class="ph-main"><h1>${esc(U.full(p))} ${ui.status(D.partStatus(p))}</h1><p class="muted">${sub || 'Nav grupas'}</p></div>
        <div class="actions">
          <button data-act="msg" data-arg="${p.id}">✉ Ziņa</button>
          <button data-act="edit" data-arg="${p.id}">✎ Rediģēt</button>
          <details class="menu"><summary class="btn">⋯</summary><div class="menu-list">
            ${p.status === 'archived' ? `<button data-act="restore" data-arg="${p.id}">Atjaunot no arhīva</button>` : `<button data-act="archive" data-arg="${p.id}">Arhivēt (izstājies)</button>`}
            <button data-act="exportPerson" data-arg="${p.id}">Eksportēt personas datus (GDPR)</button>
            <button data-act="print">Drukāt kartiņu</button>
            ${p.status === 'archived' ? `<button class="danger" data-act="erase" data-arg="${p.id}">Dzēst neatgriezeniski…</button>` : ''}
          </div></details>
          ${ui.saveBtn()}</div></header>`;
      const counts = { docs: `${docs.length}${miss.length ? ' <span class="warn">⚠</span>' : ''}`, history: openTasks ? `<span class="count">${openTasks}</span>` : '', relations: fam || '', equipment: eq || '', idcard: D.idCardBadge ? D.idCardBadge(p) : '' };
      const tabs = `<nav class="tabs" role="tablist">${TABS.map(([k, t]) => `<button role="tab" data-tab="${k}" class="${S.tab === k ? 'active' : ''}">${CP.ic(TAB_IC[k])}${t}${counts[k] ? ` <small>${counts[k]}</small>` : ''}</button>`).join('')}</nav>`;
      let body = '';
      if (S.tab === 'overview') body = overview(p, miss);
      else if (S.tab === 'data') body = allData(p);
      else if (S.tab === 'docs') body = CP.docs.personTab(p);
      else if (S.tab === 'history') body = history(p);
      else if (S.tab === 'relations') body = relations(p);
      else if (S.tab === 'equipment') body = CP.equipment.personTab(p);
      else if (S.tab === 'idcard') body = CP.idcard.personTab(p);
      return `<div class="page">${head}<div class="person-layout"><div class="pl-main">${tabs}${body}</div><aside class="pl-side">${side(p, miss)}</aside></div></div>`;
    }
  };

  function codeView(p, key) {
    const v = p[key]; if (!v) return '';
    const shown = S.reveal.has(p.id + key);
    return `${esc(shown ? U.fmtCode(v) : U.maskCode(v))} <button class="ghost sm" data-act="reveal" data-arg="${p.id}|${key}" title="${shown ? 'Paslēpt' : 'Parādīt'}">${shown ? '🙈' : '👁'}</button>${U.checkCode(v) ? '' : ' <span class="warn small" title="Kontrolcipars neatbilst">⚠</span>'}`;
  }
  const photo = p => p.photoConsent === 'yes' ? 'Piekrīt' + (p.photoConsentDate ? ` (${U.fmtDate(p.photoConsentDate)})` : '') : p.photoConsent === 'no' ? 'Nepiekrīt' : 'Nav zināms';

  function side(p, miss) {
    const cs = D.contacts(p);
    const contacts = cs.map(c => {
      const n = U.normPhone(c.phone);
      return `<div class="contact"><div class="c-top"><span class="role">${esc(c.role)}</span></div><div class="c-name">${esc(c.name || '—')}</div>
        <div class="c-how">${n ? `<a href="tel:+${n}" data-act="call" data-arg="${p.id}|${c.idx}">${esc(U.prettyPhone(c.phone))}</a>` : ''}${c.email ? `<span>${esc(c.email)}</span>` : ''}</div>
        <div class="c-btns">${n ? `<button class="wabtn sm" data-act="msgTo" data-arg="${p.id}|${c.idx}|whatsapp">💬 WhatsApp</button><button class="sm" data-act="call" data-arg="${p.id}|${c.idx}" title="Zvanīt">📞</button><button class="sm" data-act="msgTo" data-arg="${p.id}|${c.idx}|sms">SMS</button>` : ''}${c.email ? `<button class="sm" data-act="msgTo" data-arg="${p.id}|${c.idx}|email">✉</button>` : ''}</div></div>`;
    }).join('') || `<p class="muted small">Nav ievadīts neviens tālrunis vai e-pasts.</p><button class="sm" data-act="edit" data-arg="${p.id}" data-sec="contact">＋ Pievienot kontaktus</button>`;
    const req = S.db.settings.requiredDocs;
    const reqRow = k => {
      const list = S.db.documents.filter(d => d.personId === p.id && d.kind === k).sort((a, b) => String(D.docDate(b) || b.addedAt).localeCompare(String(D.docDate(a) || a.addedAt)));
      const ok = !miss.includes(k), d = list.find(x => D.docValid(x)) || list[0];
      const exp = d && D.docExpiry(d), info = d ? [d.issued ? 'izsniegts ' + U.fmtDate(d.issued) : (D.docRule(k) && !d.expires ? '⚠ nav norādīts izsniegšanas datums' : ''), exp && 'līdz ' + U.fmtDate(exp), !ok && (D.docRule(k)?.schoolYear && !D.docForYear(d, D.activeYear()) ? 'cita mācību gada' : exp && exp < U.iso() ? 'beidzies derīgums' : '')].filter(Boolean).join(' · ') : '';
      return `<div class="reqdoc ${ok ? 'ok' : 'miss'}"><div class="grow"><b>${ok ? '✓' : '✗'} ${esc(k)}</b>${info ? `<div class="small muted">${esc(info)}</div>` : (d ? '' : '<div class="small muted">nav pievienots</div>')}</div>
        <div class="reqdoc-btns">${d ? `${d.path ? `<button class="sm ghost" data-act="view" data-arg="${esc((d.sourceId || 'main') + '|' + d.path)}" title="Atvērt">📄</button>` : ''}<button class="sm ghost" data-act="editDoc" data-arg="${d.id}" title="Labot datus">✎</button><button class="sm ghost" data-act="replaceDoc" data-arg="${d.id}" title="Aizstāt failu">⇄</button><button class="sm ghost danger" data-act="delDoc" data-arg="${d.id}" title="Dzēst ierakstu">✕</button>` : ''}
        ${!ok ? `<button class="sm" data-act="attach" data-arg="${p.id}|${esc(k)}" title="Pievienot failu">＋ Fails</button><button class="sm ghost" data-act="addDoc" data-arg="${p.id}|${esc(k)}" title="Reģistrēt papīra dokumentu">＋ Papīrs</button>` : ''}</div></div>`;
    };
    const docs = req.length ? `<div class="reqdocs">${req.map(reqRow).join('')}</div>
      ${miss.length && cs.length ? `<div class="actions" style="margin-top:10px"><button class="sm" data-act="remindDocs" data-arg="${p.id}">💬 Atgādināt pārstāvim par trūkstošajiem</button></div>` : ''}` : '<p class="muted small">Iestatījumos nav norādīti obligātie dokumenti.</p>';
    const tools = CP.comms.toolLinks(p);
    const tasks = S.db.tasks.filter(t => t.personId === p.id && !t.done).sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9')));
    const dups = Object.keys(D.PHONE_FIELDS).flatMap(f => D.phoneMatches(p[f], p.id, f).filter(e => e.p.id !== p.id).map(e => ({ f, e })));
    const dupCard = dups.length ? `<section class="card dupcard"><h3>☎ Sakrītoši tālruņi</h3>${dups.map(({ f, e }) => `<div class="small"><span class="${D.phoneOwner(p, f) !== D.phoneOwner(e.p, e.f) ? 'warn' : 'muted'}">${D.phoneOwner(p, f) !== D.phoneOwner(e.p, e.f) ? '⚠' : 'ℹ'} ${U.prettyPhone(p[f])}</span> (${D.PHONE_FIELDS[f]}) = ${e.f === 'phone' ? '' : esc(e.p[e.f.replace('Phone', 'Name')] || '?') + ', '}<a href="#" data-person="${e.p.id}">${esc(U.full(e.p))}</a> <span class="muted">(${e.role})</span></div>`).join('')}</section>` : '';
    return `<section class="card"><h3>Kontakti <button class="sm right" data-act="vcard" data-arg="${p.id}" title="Saglabāt telefonā / Google kontaktos">📇 Uz telefonu</button></h3>${contacts}</section>${dupCard}
      <section class="card"><h3>Obligātie dokumenti</h3>${docs}</section>
      ${tasks.length ? `<section class="card"><h3>Uzdevumi</h3>${tasks.map(taskRow).join('')}</section>` : ''}
      ${CP.attendance ? CP.attendance.attCard(p) : ''}
      ${CP.registry ? CP.registry.personCard(p) : ''}
      ${CP.contracts ? CP.contracts.personCard(p) : ''}
      ${CP.forms ? CP.forms.personCard(p) : ''}
      ${tools ? `<section class="card"><h3>Rīki</h3><div class="actions">${tools}</div></section>` : ''}`;
  }
  const taskRow = t => `<div class="task ${t.due && U.daysTo(t.due) < 0 ? 'late' : ''}"><input type="checkbox" data-act="taskDone" data-arg="${t.id}" ${t.done ? 'checked' : ''} aria-label="Izpildīts"><span>${esc(t.text)}${t.due ? `<small class="muted"> · ${U.fmtDate(t.due)}</small>` : ''}</span></div>`;

  function overview(p, miss) {
    const recent = timeline(p).slice(0, 6);
    const parent = D.contacts(p).find(c => c.kind === 'parent');
    return `<div class="cards2">
      <section class="card"><h3>Pamatdati <button class="ghost sm right" data-act="edit" data-arg="${p.id}" data-sec="basic">✎</button></h3>${ui.dl([
        ['Vārds, uzvārds', U.full(p)], ['Dzimšanas datums', p.birth ? `${U.fmtDate(p.birth)} (${U.age(p.birth)} g.)` : ''], ['Personas kods', codeView(p, 'personalCode'), 1],
        ['Tālrunis', p.phone && U.prettyPhone(p.phone)], ['E-pasts', p.email], ['Faktiskā adrese', p.addressActual || p.addressDeclared]])}</section>
      <section class="card"><h3>Dalība <button class="ghost sm right" data-act="edit" data-arg="${p.id}" data-sec="study">✎</button></h3>${ui.dl([
        ['Mācību gads', U.yearLabel(D.activeYear())], ['Statuss šajā gadā', ui.status(D.partStatus(p)), 1], ['Grupa šajā gadā', D.groupOf(p)], ['Iestājies', U.fmtDate(p.joined)], ['Mācību iestāde', p.school], ['Klase / kurss', p.schoolClass],
        ['Foto/video', photo(p)], p.status === 'archived' && ['Izstājies', `${U.fmtDate(p.left)}${p.reason ? ' · ' + p.reason : ''}`]])}</section>
      <section class="card"><h3>Likumiskais pārstāvis <button class="ghost sm right" data-act="edit" data-arg="${p.id}" data-sec="parent">✎</button></h3>${ui.dl([
        ['Vārds, uzvārds', p.parentName], ['Saistība', p.parentRelation], ['Tālrunis', p.parentPhone && U.prettyPhone(p.parentPhone)], ['E-pasts', p.parentEmail],
        p.parent2Name && ['Otrs vecāks', `${p.parent2Name}${p.parent2Phone ? ' · ' + U.prettyPhone(p.parent2Phone) : ''}`],
        ['Ārkārtas kontakts', [p.emergencyName, p.emergencyPhone && U.prettyPhone(p.emergencyPhone)].filter(Boolean).join(' · ')]])}
        ${!parent && U.age(p.birth) < 18 ? '<p class="warn small">Nepilngadīgam nav norādīts pārstāvja kontakts.</p>' : ''}</section>
      <section class="card"><h3>Pēdējā aktivitāte <button class="ghost sm right" data-tab="history">Viss →</button></h3>${recent.length ? recent.map(timelineRow).join('') : '<p class="muted small">Vēl nav ierakstu.</p>'}</section>
      <section class="card wide"><h3>Dalība pa mācību gadiem</h3>${D.enrollmentsOf(p.id).map(e => `<div class="row"><div class="grow"><b>${esc(U.yearLabel(e.yearId))}</b> <span class="tag">${esc(e.group || 'bez grupas')}</span> ${ui.status(e.status)}<div class="small muted">${e.at ? U.fmtDate(String(e.at).slice(0, 10)) : ''}${e.fromYearId ? ' · pārcelts no ' + esc(U.yearLabel(e.fromYearId)) : ''}</div>${journal('year', p.id, e.yearId, 'Piezīme par šo mācību gadu…')}</div></div>`).join('') || '<p class="muted small">Šai personai vēl nav dalības ierakstu.</p>'}</section>
      ${CP.attendance ? CP.attendance.historyCards(p) : ''}
      <section class="card wide"><h3>Piezīmes</h3>${journal('person', p.id, '', 'Jauna piezīme par personu (piem., veselība, īpaši norādījumi, vienošanās)…')}</section>
    </div>`;
  }

  function allData(p) {
    const val = f => {
      const v = p[f.k]; if (f.sens) return codeView(p, f.k);
      if (f.t === 'date') return esc(U.fmtDate(v)); if (f.t === 'tel') return esc(v ? U.prettyPhone(v) : '');
      if (f.k === 'photoConsent') return esc(photo(p)); if (f.k === 'status') return ui.status(D.partStatus(p)); if (f.k === 'group') return esc(D.groupOf(p));
      return esc(v ?? '');
    };
    return `<div class="cards2">${CP.SECTIONS.map(([sid, title]) => {
      const fields = CP.FIELDS.filter(f => f.s === sid);
      return `<section class="card ${sid === 'admin' ? 'wide' : ''}"><h3>${title} <button class="ghost sm right" data-act="edit" data-arg="${p.id}" data-sec="${sid}">✎</button></h3>${ui.dl(fields.map(f => [f.l, val(f), 1]))}</section>`;
    }).join('')}
    <section class="card wide"><h3>Ieraksts</h3>${ui.dl([['Izveidots', U.fmtDateTime(p.createdAt)], ['Pēdējās izmaiņas', U.fmtDateTime(p.updatedAt)], ['Glabāšana pēc izstāšanās', `${p.retentionMonths ?? S.db.settings.retentionDefault} mēn.`]])}</section></div>`;
  }

  /* --- Vēsture: saziņa, piezīmes, uzdevumi, izmaiņas vienā laika joslā --- */
  const TYPE = { whatsapp: ['💬', 'WhatsApp'], sms: ['✉', 'SMS'], email: ['✉', 'E-pasts'], call: ['📞', 'Zvans'], note: ['📝', 'Piezīme'], task: ['☐', 'Uzdevums'], audit: ['✎', 'Izmaiņas'] };
  const AUDIT = { create: 'Izveidota kartīte', update: 'Mainīti dati', status: 'Mainīts statuss', archive: 'Arhivēta', restore: 'Atjaunota no arhīva', scan: 'Ievadīta no anketas', 'doc-add': 'Pievienots dokuments', 'doc-remove': 'Noņemts dokumenta ieraksts', 'doc-relink': 'Atjaunota dokumenta sasaiste', 'eq-issue': 'Izsniegts ekipējums', 'eq-return': 'Atdots ekipējums', 'eq-edit': 'Labots ekipējuma ieraksts', 'eq-delete': 'Dzēsts ekipējuma ieraksts' , idcard: 'Jaunsarga apliecība', event: 'Pasākums'};
  function timeline(p) {
    const items = [];
    for (const l of S.db.log) if (l.personId === p.id) items.push({ at: l.at, type: l.type, text: l.detail, status: l.status, grp: l.type === 'note' ? 'notes' : 'comms' });
    for (const n of p.noteLog || []) items.push({ at: n.at, type: 'note', text: n.text, grp: 'notes' });
    for (const e of D.enrollmentsOf(p.id)) for (const n of e.noteLog || []) items.push({ at: n.at, type: 'note', text: `${U.yearLabel(e.yearId)}: ${n.text}`, grp: 'notes' });
    for (const a of S.db.audit) if (a.personId === p.id) items.push({ at: a.at, type: 'audit', text: (AUDIT[a.action] || a.action) + (a.fields?.length ? ': ' + a.fields.join(', ') : ''), grp: 'changes' });
    for (const t of S.db.tasks) if (t.personId === p.id) items.push({ at: t.createdAt, type: 'task', task: t, grp: 'tasks' });
    return items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }
  const timelineRow = i => {
    const [ic, name] = TYPE[i.type] || ['•', i.type];
    if (i.task) return `<div class="tl"><span class="tl-ic">${ic}</span><div class="tl-body"><div class="tl-meta">${name} · ${U.fmtDateTime(i.at)}</div>${taskRow(i.task)}</div></div>`;
    const st = i.status && CP.COMM_STATUS[i.status] ? ` · ${esc(CP.COMM_STATUS[i.status])}` : '';
    return `<div class="tl"><span class="tl-ic">${ic}</span><div class="tl-body"><div class="tl-meta">${name}${st} · ${U.fmtDateTime(i.at)}</div><div class="pre">${esc(i.text)}</div></div></div>`;
  };
  function history(p) {
    const f = S.historyFilter, all = timeline(p), items = f === 'all' ? all : all.filter(i => i.grp === f);
    const chip = (k, t) => `<button class="chipbtn ${f === k ? 'on' : ''}" data-act="histFilter" data-arg="${k}">${t}</button>`;
    return `<section class="card"><h3>Jauns ieraksts</h3><div class="composer"><textarea id="noteText" data-autogrow rows="2" placeholder="Piemēram: “Runāju ar mammu par nometni” vai uzdevums “Paņemt parakstītu līgumu”"></textarea>
        <div class="actions"><label class="inline">Atgādināt <input type="date" id="noteDue"></label><span class="muted small">Ar datumu ieraksts kļūst par uzdevumu. Enter — pievienot, Shift+Enter — jauna rinda.</span><span class="grow"></span><button class="mainbtn" data-act="addNote" data-arg="${p.id}">Pievienot</button></div></div></section>
      <section class="card"><div class="chips" style="margin-bottom:10px">${chip('all', 'Viss')}${chip('comms', 'Saziņa')}${chip('notes', 'Piezīmes')}${chip('tasks', 'Uzdevumi')}${chip('changes', 'Izmaiņas')}</div>
      ${items.map(timelineRow).join('') || '<p class="muted small">Nav ierakstu.</p>'}</section>`;
  }
  /* --- Piezīmju žurnāls: katrs saglabātais ieraksts ir atsevišķs, to var labot vai dzēst.
         Enter — saglabāt, Shift+Enter — jauna rinda, Esc — atcelt labošanu. Lauki izplešas pēc teksta. --- */
  const drafts = {};
  const jList = (kind, pid, yearId, create) => {
    const o = kind === 'year' ? (S.db.enrollments || []).find(x => x.personId === pid && x.yearId === yearId) : D.person(pid);
    if (!o) return null; if (create && !Array.isArray(o.noteLog)) o.noteLog = []; return o.noteLog || [];
  };
  function journal(kind, pid, yearId, ph) {
    const key = `${kind}|${pid}|${yearId || ''}`, list = [...(jList(kind, pid, yearId) || [])].sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const entry = n => S.jEdit === n.id
      ? `<div class="jentry editing" data-jid="${n.id}"><textarea data-autogrow data-jedit rows="2">${esc(n.text)}</textarea>
          <div class="notebox-bar"><small class="muted">Enter — saglabāt · Shift+Enter — jauna rinda · Esc — atcelt</small><span class="grow"></span><button type="button" class="sm ghost" data-act="jCancel">Atcelt</button><button type="button" class="sm mainbtn" data-act="jSave" data-arg="${n.id}">Saglabāt</button></div></div>`
      : `<div class="jentry" data-jid="${n.id}"><div class="jmeta small muted">${n.dateOnly ? esc(U.fmtDate(String(n.at).slice(0, 10))) + ' · agrāk ievadīta' : esc(U.fmtDateTime(n.at))}${n.editedAt ? ` · labots ${esc(U.fmtDateTime(n.editedAt))}` : ''}<span class="grow"></span>
          <button type="button" class="sm ghost" data-act="jEdit" data-arg="${n.id}" title="Labot">${CP.ic('edit', '✎')}</button><button type="button" class="sm ghost danger" data-act="jDel" data-arg="${n.id}" title="Dzēst">✕</button></div><div class="jtext pre">${esc(n.text)}</div></div>`;
    return `<div class="journal" data-j="${esc(key)}"><div class="notebox"><textarea data-autogrow data-jnew rows="1" placeholder="${esc(ph)}">${esc(drafts[key] || '')}</textarea>
        <div class="notebox-bar"><small class="muted">Enter — saglabāt · Shift+Enter — jauna rinda</small><span class="grow"></span><button type="button" class="sm mainbtn" data-act="jAdd">Pievienot</button></div></div>
      ${list.length ? `<div class="jlist">${list.map(entry).join('')}</div>` : ''}</div>`;
  }
  CP.journal = journal;
  const jKey = el => el.closest('.journal')?.dataset.j.split('|');
  let refocus = null;
  function jAdd(el) {
    const box = el.closest('.journal'), [kind, pid, yearId] = jKey(el), ta = box.querySelector('[data-jnew]'), t = ta.value.replace(/\s+$/, '').replace(/^\s+/, '');
    if (!t) { ta.focus(); return; }
    const list = jList(kind, pid, yearId, true); if (!list) return;
    list.push({ id: U.uid(), at: U.now(), text: t });
    delete drafts[box.dataset.j]; refocus = box.dataset.j;
    D.audit(pid, 'update', [kind === 'year' ? 'Piezīme par ' + U.yearLabel(yearId) : 'Piezīme']);
    CP.store.changed(); ui.toast('Piezīme saglabāta', 'ok', 2000);
  }
  function jSave(el, id) {
    const [kind, pid, yearId] = jKey(el), list = jList(kind, pid, yearId) || [], n = list.find(x => x.id === id), ta = el.closest('.jentry').querySelector('[data-jedit]');
    if (!n) return; const t = ta.value.trim(); if (!t) return jDel(el, id);
    if (t !== n.text) { n.text = t; n.editedAt = U.now(); D.audit(pid, 'update', ['Piezīme labota']); }
    S.jEdit = null; CP.store.changed();
  }
  function jDel(el, id) {
    const [kind, pid, yearId] = jKey(el), list = jList(kind, pid, yearId) || [], i = list.findIndex(x => x.id === id);
    if (i < 0 || !confirm('Dzēst šo piezīmi?')) return;
    list.splice(i, 1); S.jEdit = null; D.audit(pid, 'update', ['Piezīme dzēsta']); CP.store.changed();
  }
  A.jAdd = (arg, el) => jAdd(el);
  A.jEdit = id => { S.jEdit = id; CP.render(); const t = U.qs(`.jentry[data-jid="${id}"] [data-jedit]`); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); grow(t); } };
  A.jSave = (id, el) => jSave(el, id);
  A.jCancel = () => { S.jEdit = null; CP.render(); };
  A.jDel = (id, el) => jDel(el, id);
  CP.inputHandlers.push(e => {
    const t = e.target; if (!t.matches?.('[data-jnew],[data-jedit]')) return false;
    if (t.matches('[data-jnew]')) drafts[t.closest('.journal').dataset.j] = t.value;
    return true;
  });
  document.addEventListener('keydown', e => {
    const t = e.target; if (!t.matches?.('[data-jnew],[data-jedit]')) return;
    if (e.key === 'Escape' && t.matches('[data-jedit]')) { e.preventDefault(); A.jCancel(); return; }
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    if (t.matches('[data-jnew]')) jAdd(t); else jSave(t, t.closest('.jentry').dataset.jid);
  });
  /* Automātiski augoši teksta lauki */
  const NATIVE = typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content');
  function grow(t) { if (NATIVE || !t) return; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 2, window.innerHeight * 0.6) + 'px'; }
  document.addEventListener('input', e => { if (e.target.matches?.('textarea[data-autogrow], #noteText')) grow(e.target); }, true);
  CP.afterRender = CP.afterRender || [];
  CP.afterRender.push(() => {
    if (!NATIVE) U.qsa('textarea[data-autogrow], #noteText').forEach(grow);
    if (refocus) { const b = U.qs(`.journal[data-j="${CSS.escape(refocus)}"] [data-jnew]`); refocus = null; b?.focus(); }
  });

  A.histFilter = k => { S.historyFilter = k; CP.render(); };
  A.addNote = pid => {
    const t = U.$('noteText').value.trim(), due = U.$('noteDue').value; if (!t) return U.$('noteText').focus();
    if (due) S.db.tasks.push({ id: U.uid(), personId: pid, text: t, due, done: false, createdAt: U.now() });
    else { const p = D.person(pid); if (p) (p.noteLog = p.noteLog || []).push({ id: U.uid(), at: U.now(), text: t }); }
    CP.store.changed(); ui.toast(due ? 'Uzdevums pievienots' : 'Ieraksts pievienots', 'ok', 2500);
  };
  A.taskDone = id => { const t = S.db.tasks.find(x => x.id === id); if (t) { t.done = !t.done; t.doneAt = t.done ? U.now() : null; CP.store.changed(); } };

  /* --- Saistības --- */
  function relations(p) {
    const fam = D.family(p), manual = S.db.relations.filter(r => r.a === p.id || r.b === p.id);
    const same = D.groupOf(p) ? S.db.people.filter(o => o.id !== p.id && o.status !== 'archived' && D.inYear(o) && D.groupOf(o) === D.groupOf(p)).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b))) : [];
    const others = S.db.people.filter(o => o.id !== p.id).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
    const personRow = (o, extra = '') => `<div class="row"><div class="who">${ui.avatar(o, 'sm')}<span><b>${esc(U.full(o))}</b><small class="muted">${esc(D.groupOf(o) || o.group || '')}${o.status === 'archived' ? ' · arhīvā' : ''}</small></span></div>${extra}<button class="sm" data-person="${o.id}">Atvērt</button></div>`;
    return `<div class="cards2">
      <section class="card"><h3>Ģimene</h3><p class="muted small">Atrasti automātiski pēc kopīga vecāka tālruņa, e-pasta vai personas koda.</p>${fam.map(o => personRow(o)).join('') || '<p class="muted small">Nav atrasts.</p>'}</section>
      <section class="card"><h3>Citas saistības</h3>${manual.map(r => { const o = D.person(r.a === p.id ? r.b : r.a); return o ? personRow(o, `<span class="tag">${esc(r.type)}</span><button class="sm ghost" data-act="delRel" data-arg="${r.id}" title="Noņemt">✕</button>`) : ''; }).join('') || '<p class="muted small">Nav.</p>'}
        <div class="inline-form"><select id="relPerson">${others.map(o => `<option value="${o.id}">${esc(U.sortName(o))}</option>`).join('')}</select><input id="relType" placeholder="Brālis, draugs, komandas biedrs…" list="dl_rel"><button data-act="addRel" data-arg="${p.id}">＋</button></div></section>
      <section class="card wide"><h3>Grupa: ${esc(D.groupOf(p) || '—')} ${D.groupOf(p) ? `<button class="sm right" data-act="groupMsg" data-arg="${esc(D.groupOf(p))}">✉ Ziņa grupai</button>` : ''}</h3>
        ${same.length ? `<div class="namegrid">${same.map(o => `<button class="namechip" data-person="${o.id}">${esc(U.sortName(o))}</button>`).join('')}</div>` : '<p class="muted small">Grupā nav citu personu.</p>'}</section></div>`;
  }
  A.addRel = a => { const b = U.$('relPerson').value, type = U.$('relType').value.trim() || 'Saistīts'; if (!b) return; S.db.relations.push({ id: U.uid(), a, b, type }); CP.store.changed(); };
  A.delRel = id => { S.db.relations = S.db.relations.filter(r => r.id !== id); CP.store.changed(); };
  A.reveal = arg => { S.reveal.has(arg.replace('|', '')) ? S.reveal.delete(arg.replace('|', '')) : S.reveal.add(arg.replace('|', '')); CP.render(); };
  A.print = () => window.print();

  /* =================== Rediģēšana =================== */
  const form = U.$('personForm');
  U.$('personFields').innerHTML = ui.fieldsHTML({ prefix: 'pf_', sectionIds: true });
  let editing = null;

  A.addPerson = () => openPerson(null);
  A.edit = (pid, el) => openPerson(pid, el?.dataset.sec);
  function openPerson(pid, sec) {
    editing = pid || null; const p = pid ? D.person(pid) : null;
    U.$('personTitle').textContent = p ? 'Rediģēt: ' + U.full(p) : 'Jauna persona';
    ui.datalists(); ui.fillForm(form, p ? D.formPerson(p) : null); delete form.dataset.warned; U.qsa('.duphint', form).forEach(x => x.remove());
    const st = form.elements.status; st.disabled = p?.status === 'archived';
    if (p?.status === 'archived') st.innerHTML = '<option value="archived">Arhīvā</option>'; else st.innerHTML = CP.FIELD.status.opts.map(([v, l]) => `<option value="${v}" ${v === (p?.status || 'active') ? 'selected' : ''}>${l}</option>`).join('');
    if (!p) form.elements.joined.value = U.iso();
    U.$('personDialog').showModal();
    const target = sec ? U.$('pf_sec_' + sec) : null;
    (target || form).scrollIntoView?.({ block: 'start' });
    setTimeout(() => (target?.querySelector('input,select,textarea') || form.elements.first).focus(), 30);
  }
  form.addEventListener('change', e => {
    if (e.target.name in D.PHONE_FIELDS) ui.phoneHints(form, editing);
    if (e.target.name === 'personalCode' && !form.elements.birth.value) form.elements.birth.value = U.birthFromCode(e.target.value);
    if (e.target.name === 'parentCode' || e.target.name === 'personalCode') delete form.dataset.warned;
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const o = ui.readForm(form);
    if (!o.birth && o.personalCode) o.birth = U.birthFromCode(o.personalCode);
    const chk = ui.checkForm(form, o);
    if (chk.errors) { ui.toast('Aizpildi obligātos laukus', 'err'); U.qs('.field.bad input', form)?.focus(); return; }
    const dupPhones = ui.phoneHints(form, editing);
    if ((chk.warnings || dupPhones) && !form.dataset.warned) { form.dataset.warned = '1'; ui.toast(dupPhones ? 'Tālruņa numurs sakrīt ar citas personas numuru (skat. pie lauka). Pārbaudi vai spied “Saglabāt” vēlreiz.' : 'Dažas vērtības izskatās aizdomīgas (iezīmētas). Labo vai spied “Saglabāt” vēlreiz, lai saglabātu tāpat.', 'warn', 8000); (U.qs('.field.warn input', form) || U.qs('.duphint.bad', form)?.closest('.field').querySelector('input'))?.focus(); return; }
    if (!editing) {
      const dup = D.duplicates(o);
      if (dup.length && !confirm(`Iespējams dublikāts: ${dup.map(U.full).join(', ')}.\n\nVienalga izveidot jaunu personu?`)) return;
    }
    savePerson(o, editing, 'update');
    U.$('personDialog').close(); CP.store.changed();
    if (editing) ui.toast('Izmaiņas saglabātas', 'ok');
    else if (D.contacts(D.person(S.selected)).some(c => U.normPhone(c.phone))) ui.toast('Persona pievienota.', 'ok', 9000, { label: '📇 Saglabāt kontaktos', act: 'vcard', arg: S.selected });
    else ui.toast('Persona pievienota', 'ok');
  });
  /** Izveido vai atjaunina personu un ieraksta auditā mainīto lauku nosaukumus (ne vērtības) */
  function savePerson(o, id, action) {
    if (id) {
      const p = D.person(id), changed = [];
      for (const [k, v] of Object.entries(o)) if (k in CP.FIELD && String(p[k] ?? '') !== String(v ?? '') && !(k === 'status' && p.status === 'archived')) { changed.push(CP.FIELD[k].l); p[k] = v; }
      if (p.status === 'archived') p.status = 'archived';
      if (changed.length) { p.updatedAt = U.now(); D.audit(id, action, changed); }
      const yearPatch = {};
      if ('group' in o) yearPatch.group = o.group || '';
      if (p.status === 'archived') yearPatch.status = 'archived';
      else if ('status' in o) yearPatch.status = o.status || 'active';
      D.bindYear(p, yearPatch);
      S.selected = id; return p;
    }
    const p = { ...o, id: U.uid(), status: o.status || 'active', createdAt: U.now(), updatedAt: U.now() };
    CP.store.assignFolder(p);
    S.db.people.push(p); D.bindYear(p, { group: p.group || '', status: p.status || 'active' }); D.audit(p.id, action === 'scan' ? 'scan' : 'create');
    if (S.root) CP.store.ensurePersonYearFolder(p).catch(e => ui.toast('Personas dokumentu mapi neizdevās izveidot: ' + e.message, 'warn'));
    S.selected = p.id; S.page = 'person'; S.tab = 'overview'; return p;
  }
  CP.people = { savePerson, openPerson };

  /* --- Arhīvs, atjaunošana, dzēšana --- */
  function archive(p, o) {
    p.status = 'archived'; p.left = o.left; p.reason = o.reason || ''; p.retentionMonths = Number(o.months ?? S.db.settings.retentionDefault); p.updatedAt = U.now();
    p.archiveSnapshot = {
      at: U.now(), left: p.left, reason: p.reason, retentionMonths: p.retentionMonths,
      documents: D.docsOf(p).map(d => ({ id: d.id, kind: d.kind, path: d.path || '', sourceId: d.sourceId || '', format: d.format || '', expires: d.expires || '', received: d.received || '' })),
      equipment: S.db.equipment.filter(e => e.personId === p.id).map(e => ({ id: e.id, item: e.item, inventory: e.inventory || '', size: e.size || '', qty: e.qty, issued: e.issued || '', due: e.due || '', returned: e.returned || '', returnNote: e.returnNote || '', notes: e.notes || '' }))
    };
    D.audit(p.id, 'archive', o.reason ? [o.reason] : []);
  }
  A.archive = pid => {
    const f = U.$('archiveForm'); f.reset(); f.dataset.pid = pid; f.elements.left.value = U.iso();
    f.elements.months.value = D.person(pid)?.retentionMonths ?? S.db.settings.retentionDefault;
    const person = D.person(pid), eq = D.openEquipment(person);
    U.$('archiveWarn').innerHTML = eq.length ? `<p class="warn">⚠ Nav atdots ekipējums: ${esc(eq.map(e => e.item).join(', '))}. Arhivēšana to nedzēš un neatgriež.</p>` : '';
    U.$('archiveDialog').showModal();
  };
  U.$('archiveForm').addEventListener('submit', e => {
    e.preventDefault(); const f = e.currentTarget, p = D.person(f.dataset.pid); if (!p) return;
    archive(p, Object.fromEntries(new FormData(f))); U.$('archiveDialog').close(); CP.store.changed(); ui.toast('Persona pārvietota uz arhīvu', 'ok');
  });
  A.restore = pid => { const p = D.person(pid); if (!p || !confirm('Atjaunot personu no arhīva (statuss: Jaunsargs)?')) return; p.status = 'active'; p.updatedAt = U.now(); D.audit(pid, 'restore'); CP.store.changed(); };
  A.erase = pid => {
    const p = D.person(pid); if (!p) return;
    const db = S.db;
    const docs = db.documents.filter(d => d.personId === pid);
    const files = docs.filter(d => d.path);
    const eq = db.equipment.filter(e => e.personId === pid);
    U.$('eraseTitle').textContent = 'Dzēst reģistra ierakstu — ' + U.full(p);
    U.$('eraseBody').innerHTML = `<p>Tiks dzēsts <b>tikai ieraksts datubāzē</b>: kartīte, ${docs.length} dokumentu ieraksti, ${eq.length} ekipējuma ieraksti, vēsture, uzdevumi un saistības.</p>
      <p><b>Netiks dzēsts:</b></p>
      <ul class="small">
        <li>dokumentu faili mapēs (${files.length})</li>
        <li>JSON rezerves kopijas un datu arhīvi mapēs <b>_rezerves</b> un <b>_arhivi</b></li>
      </ul>
      ${files.length ? `<p class="small muted">Paliek faili:<br>${files.slice(0, 12).map(d => esc(d.path)).join('<br>')}${files.length > 12 ? '<br>…' : ''}</p>` : '<p class="small muted">Šai personai nav piesaistītu failu.</p>'}
      <p class="small">Rezerves kopijas jāpārskata pašam Iestatījumos. Sistēma tās nedzēš.</p>
      <div class="field"><label for="eraseLast">Apstiprinājumam ieraksti uzvārdu</label><input id="eraseLast" autocomplete="off"></div>`;
    U.$('eraseForm').dataset.pid = pid;
    U.$('eraseDialog').showModal();
    U.$('eraseLast').focus();
  };
  U.$('eraseForm').addEventListener('submit', e => {
    e.preventDefault();
    const pid = e.currentTarget.dataset.pid, p = D.person(pid); if (!p) return;
    if (U.norm(U.$('eraseLast').value) !== U.norm(p.last)) return ui.toast('Uzvārds nesakrīt — nekas netika dzēsts', 'warn');
    const db = S.db, nDocs = db.documents.filter(d => d.personId === pid).length, nFiles = db.documents.filter(d => d.personId === pid && d.path).length;
    db.people = db.people.filter(x => x.id !== pid); db.documents = db.documents.filter(d => d.personId !== pid);
    db.equipment = db.equipment.filter(x => x.personId !== pid); db.log = db.log.filter(x => x.personId !== pid);
    db.tasks = db.tasks.filter(x => x.personId !== pid); db.relations = db.relations.filter(r => r.a !== pid && r.b !== pid);
    db.audit = db.audit.filter(x => x.personId !== pid);
    db.audit.push({ id: U.uid(), personId: null, at: U.now(), action: 'erase', fields: [`dzēsts reģistra ieraksts un ${nDocs} dokumentu ieraksti; ${nFiles} faili un rezerves kopijas palika`] });
    U.$('eraseDialog').close();
    S.page = 'people'; CP.store.changed();
    ui.toast('Dzēsts tikai reģistra ieraksts. Faili un rezerves kopijas palika.', 'ok', 9000);
  });
  A.exportPerson = pid => {
    const p = D.person(pid), db = S.db;
    const out = { eksportēts: U.now(), persona: p, dokumenti: db.documents.filter(d => d.personId === pid), ekipējums: db.equipment.filter(e => e.personId === pid), vēsture: db.log.filter(l => l.personId === pid), uzdevumi: db.tasks.filter(t => t.personId === pid), izmaiņas: db.audit.filter(a => a.personId === pid) };
    U.download(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }), `Personas_dati_${p.last}_${p.first}_${U.iso()}.json`);
  };
})(window.CP);


/* ==== js/documents.js ==== */
/* =====================================================================
   Dokumenti: personas dokumentu cilne, dokumentu reģistrs, skatītājs,
   failu pievienošana un piesaiste. Oriģinālie faili netiek pārvietoti.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const docs = {};

  const FORMAT = { paper: '📄 Papīrs', edoc: '✍ eDoc', pdf: '💻 Elektronisks' };
  const REVIEW = { received: 'Saņemts', checked: 'Pārbaudīts', clarify: 'Jāprecizē', missing: 'Trūkst' };
  const fmtTag = f => `<span class="tag">${FORMAT[f] || FORMAT.pdf}</span>`;
  const keyOf = (sid, path) => `${esc(sid || 'main')}|${esc(path)}`;
  const PILL = { available: 'ok', noaccess: 'bad', missing: 'bad', check: 'warn' };
  docs.statusOf = d => d._live || (d.path ? { state: d.fileState || 'check', detail: d.fileDetail || '' } : null);
  docs.statusHtml = d => {
    const st = docs.statusOf(d); if (!st) return '';
    const label = CP.FILE_STATUS[st.state] || st.state;
    return `<span class="pill ${PILL[st.state] || 'warn'}" data-docstatus="${esc(d.id)}" title="${esc(st.detail || label)}">${esc(label)}</span>`;
  };

  function docRow(d, showPerson) {
    const exp = D.docExpiry(d) ? U.daysTo(D.docExpiry(d)) : null;
    const st = docs.statusOf(d);
    return `<div class="row doc">
      <div class="doc-ic">${/\.(jpe?g|png|webp|heic)$/i.test(d.path || '') ? '🖼' : /\.edoc$/i.test(d.path || '') ? '✍' : d.path ? '📄' : '🗂'}</div>
      <div class="grow">
        <div><b>${esc(d.kind)}</b> ${fmtTag(d.format)} ${docs.statusHtml(d)} ${showPerson ? `· <a href="#" data-person="${d.personId}" data-goto="docs">${esc(U.full(D.person(d.personId)))}</a>` : ''}</div>
        <div class="small muted">${d.yearId ? esc(U.yearLabel(d.yearId)) + ' · ' : ''}${REVIEW[d.review] ? esc(REVIEW[d.review]) + ' · ' : ''}${d.path ? esc(d.path) : 'Elektronisks fails nav piesaistīts'}${st?.detail && st.detail !== CP.FILE_STATUS[st.state] ? ' · ' + esc(st.detail) : ''}${d.received ? ' · saņemts ' + U.fmtDate(d.received) : ''}${d.issued ? ' · izsniegts ' + U.fmtDate(d.issued) : ''}${D.docExpiry(d) ? ` · <span class="${exp < 0 ? 'red' : exp <= 30 ? 'warn' : ''}">derīgs līdz ${U.fmtDate(D.docExpiry(d))}</span>` : (D.docRule(d.kind) ? ' · <span class="warn">nav norādīts izsniegšanas datums</span>' : '')}${D.docRule(d.kind)?.schoolYear && !D.docForYear(d, D.activeYear()) ? ' · <span class="warn">citam mācību gadam</span>' : ''}${d.notes ? ' · ' + esc(d.notes) : ''}</div>
      </div>
      ${d.path ? `<button class="sm mainbtn" data-act="view" data-arg="${keyOf(d.sourceId, d.path)}">Atvērt</button>` : ''}
      ${d.path ? `<button class="sm" data-act="checkDoc" data-arg="${d.id}">Pārbaudīt</button><button class="sm" data-act="relinkDoc" data-arg="${d.id}">Atjaunot sasaisti</button>` : ''}
      ${d.path && /\.(pdf|docx|edoc|asice|jpe?g|png)$/i.test(d.path) ? `<button class="sm" data-act="readDoc" data-arg="${d.id}" title="Nolasīt datus no šī dokumenta kartiņā">📥 Nolasīt</button>` : ''}
      <button class="sm" data-act="editDoc" data-arg="${d.id}" title="Labot dokumenta datus (veids, datumi, statuss)">✎ Labot</button>
      <button class="sm" data-act="replaceDoc" data-arg="${d.id}" title="Aizstāt failu ar jaunu (vecais paliek mapē)">⇄ Aizstāt failu</button>
      <button class="sm ghost danger" data-act="delDoc" data-arg="${d.id}" title="Dzēst ierakstu (fails mapē paliek)">✕ Dzēst</button></div>`;
  }

  /* --- Personas cilne --- */
  docs.personTab = p => {
    const list = D.docsOf(p).sort((a, b) => U.cmp(a.kind, b.kind)), miss = D.missingDocs(p);
    const linked = new Set(list.map(d => (d.sourceId || 'main') + '|' + d.path));
    const fn = U.norm(p.first), ln = U.norm(p.last);
    const sugg = fn && ln ? S.index.filter(f => f.n.includes(ln) && f.n.includes(fn) && !linked.has(f.sourceId + '|' + f.path)).slice(0, 40) : [];
    // Obligātie dokumenti (✓/✗, pievienot, labot, aizstāt, dzēst, atgādināt) ir sānjoslā — šeit netiek dublēti
    void miss;
    return `<section class="card docbrowser"><h3>Dokumentu mape <span class="tag">${esc(U.yearLabel(D.activeYear()))}</span><span class="right actions"><button class="sm" data-act="docMkdir" data-arg="${p.id}">Jauna mape</button><button class="sm mainbtn" data-act="docAddOpen" data-arg="${p.id}">Pievienot failu</button><button class="sm" data-act="docRefresh" data-arg="${p.id}">Atsvaidzināt</button></span></h3>
        <div class="crumbs" id="docCrumbs"></div>
        <input id="docTreeQ" type="search" placeholder="Meklēt dokumenta nosaukumā…" value="${esc(S.browse.q || '')}">
        <p class="muted small">Meklēšana skatās nosaukumus un ceļus, nevis failu saturu. Oriģināls datorā netiek dzēsts.</p>
        <div id="docTree" class="dropzone" data-drop="${p.id}"><p class="muted small">Ielādē mapi…</p></div></section>
      <section class="card"><h3>Visi dokumenti (${list.length})<span class="right actions"><button class="sm" data-act="addDoc" data-arg="${p.id}">＋ Papīra dokuments</button></span></h3>
        <div class="dropzone" data-drop="${p.id}">${list.map(d => docRow(d, false)).join('') || '<p class="muted small">Nav dokumentu. Ievelc failus šeit vai spied “Pievienot failu”.</p>'}</div></section>
      ${sugg.length ? `<section class="card"><h3>Mapē atrasti faili ar šo vārdu (${sugg.length})</h3><p class="muted small">Piesaisti ar vienu klikšķi — kategorija noteikta pēc faila nosaukuma.</p>
        ${sugg.map(f => `<div class="row"><div class="grow"><b>${esc(f.name)}</b><div class="small muted">${esc(f.sourceName)} / ${esc(f.path)}</div></div>
          <button class="sm" data-act="view" data-arg="${keyOf(f.sourceId, f.path)}">Skatīt</button>
          <button class="sm mainbtn" data-act="quickLink" data-arg="${keyOf(f.sourceId, f.path)}">＋ ${esc(D.guessKind(f.name))}</button>
          <button class="sm" data-act="associate" data-arg="${keyOf(f.sourceId, f.path)}">Cita…</button></div>`).join('')}</section>`
        : (S.root ? '' : '<p class="muted small">Izvēlies datu mapi, lai pievienotu failus un meklētu esošos.</p>')}`;
  };

  /* --- Dokumentu lapa --- */
  CP.pages.documents = {
    render() {
      const P = S.docsPage, q = U.norm(P.q);
      const head = ui.pageHead('Dokumenti', `${S.db.documents.length} reģistrēti dokumenti · ${S.index.length} faili ${S.roots.length} mapēs`,
        `<button data-act="checkDocs">Pārbaudīt pieejamību</button><button data-act="extra">＋ Papildu mape</button><button data-act="rescan">⟳ Pārskenēt</button>`);
      const tabs = `<nav class="tabs"><button class="${P.show === 'linked' ? 'active' : ''}" data-act="docsShow" data-arg="linked">Reģistrētie</button><button class="${P.show === 'missing' ? 'active' : ''}" data-act="docsShow" data-arg="missing">Trūkstošie</button><button class="${P.show === 'files' ? 'active' : ''}" data-act="docsShow" data-arg="files">Faili mapēs</button></nav>`;
      let body = '';
      if (P.show === 'linked') {
        const list = S.db.documents.filter(d => D.inYear(D.person(d.personId)) && (!P.kind || d.kind === P.kind) && (!q || U.norm(d.kind + ' ' + d.path + ' ' + U.full(D.person(d.personId))).includes(q)))
          .sort((a, b) => U.cmp(U.sortName(D.person(a.personId)), U.sortName(D.person(b.personId))));
        body = `<div class="filters card"><input id="docsQ" type="search" placeholder="Meklēt pēc personas, kategorijas, faila…" value="${esc(P.q)}"><select data-docs="kind"><option value="">Visas kategorijas</option>${ui.kindOptions(P.kind)}</select></div>
          <section class="card" id="docsBody">${list.map(d => docRow(d, true)).join('') || '<p class="muted">Nav dokumentu.</p>'}</section>`;
      } else if (P.show === 'missing') {
        const rows = D.peopleInYear().filter(p => p.status !== 'archived').map(p => ({ p, m: D.missingDocs(p) })).filter(x => x.m.length).sort((a, b) => U.cmp(U.sortName(a.p), U.sortName(b.p)));
        body = `<section class="card">${rows.map(x => `<div class="row"><div class="who">${ui.avatar(x.p, 'sm')}<span><b>${esc(U.sortName(x.p))}</b><small class="muted">${esc(D.groupOf(x.p) || '')}</small></span></div><div class="grow chips">${x.m.map(k => `<span class="chip miss">${esc(k)}</span>`).join('')}</div><button class="sm" data-person="${x.p.id}" data-goto="docs">Atvērt</button></div>`).join('') || '<p class="muted">Visiem ir visi obligātie dokumenti. 🎉</p>'}</section>`;
      } else {
        body = `<section class="card"><input id="fileSearch" type="search" placeholder="Meklēt faila nosaukumā vai ceļā…" value="${esc(P.q)}"><p class="muted small">Tiek lasīti tikai failu nosaukumi un ceļi, nevis saturs.</p><div id="fileResults">${fileResults()}</div></section>`;
      }
      return `<div class="page">${head}${tabs}${body}</div>`;
    }
  };
  function fileResults() {
    const q = U.norm(S.docsPage.q), arr = S.index.filter(x => x.n.includes(q)).slice(0, 150);
    if (!S.root) return '<p class="muted">Vispirms izvēlies datu mapi.</p>';
    return arr.map(x => `<div class="row"><div class="grow"><b>${esc(x.name)}</b><div class="small muted">${esc(x.sourceName)} / ${esc(x.path)}</div></div><button class="sm" data-act="view" data-arg="${keyOf(x.sourceId, x.path)}">Skatīt</button><button class="sm" data-act="associate" data-arg="${keyOf(x.sourceId, x.path)}">Piesaistīt</button></div>`).join('') || '<p class="muted">Nekas netika atrasts.</p>';
  }
  CP.inputHandlers.push(e => {
    if (e.target.id === 'fileSearch') { S.docsPage.q = e.target.value; U.$('fileResults').innerHTML = fileResults(); return true; }
    if (e.target.id === 'docsQ') { S.docsPage.q = e.target.value; const pos = e.target.selectionStart; CP.render(); const el = U.$('docsQ'); el.focus(); el.setSelectionRange(pos, pos); return true; }
    return false;
  });
  CP.changeHandlers.push(e => {
    if (e.target.dataset.docs) { S.docsPage[e.target.dataset.docs] = e.target.value; CP.render(); return true; }
    return false;
  });
  A.docsShow = k => { S.docsPage.show = k; S.docsPage.q = ''; CP.render(); };
  A.rescan = () => CP.store.scanAll();
  A.extra = () => CP.store.addExtra();

  /* --- Saites un ieraksti --- */
  docs.link = (personId, kind, format, path, sourceId, extra = {}) => {
    if (S.db.documents.some(x => x.personId === personId && x.path === path && (x.sourceId || 'main') === (sourceId || 'main'))) { ui.toast('Šis fails jau ir piesaistīts', 'warn'); return false; }
    const id = U.uid(); docs.lastLinked = id;
    S.db.documents.push({ id, personId, kind, format, path, sourceId: sourceId || 'main', received: U.iso(), addedAt: U.now(), yearId: D.activeYear(), ...extra });
    D.audit(personId, 'doc-add', [kind]); return true;
  };
  const splitKey = a => { const i = a.indexOf('|'); return [a.slice(0, i), a.slice(i + 1)]; };
  A.quickLink = a => {
    const [sid, path] = splitKey(a), f = S.index.find(x => x.sourceId === sid && x.path === path); if (!f) return;
    if (docs.link(S.selected, D.guessKind(f.name), f.ext === 'edoc' ? 'edoc' : 'pdf', f.path, f.sourceId)) { CP.store.changed(); ui.toast('Piesaistīts: ' + D.guessKind(f.name), 'ok'); }
  };
  let assoc = null;
  A.associate = a => {
    const [sid, path] = splitKey(a); assoc = S.index.find(f => f.sourceId === sid && f.path === path); if (!assoc) return;
    ui.personOptions('associatePerson', S.selected); U.$('associateKind').innerHTML = ui.kindOptions(D.guessKind(assoc.name));
    U.$('associateName').textContent = assoc.path; U.$('associateFormat').value = assoc.ext === 'edoc' ? 'edoc' : 'pdf'; U.$('associateDialog').showModal();
  };
  U.$('associateConfirm').onclick = () => {
    if (assoc && docs.link(U.$('associatePerson').value, U.$('associateKind').value, U.$('associateFormat').value, assoc.path, assoc.sourceId)) { CP.store.changed(); ui.toast('Fails piesaistīts', 'ok'); }
    U.$('associateDialog').close();
  };
  A.delDoc = id => {
    const d = S.db.documents.find(x => x.id === id); if (!d || !confirm(`Dzēst dokumenta ierakstu “${d.kind}”?\n\nIeraksts tiek noņemts no kartītes. Pats fails datu mapē netiek dzēsts.`)) return;
    S.db.documents = S.db.documents.filter(x => x.id !== id); D.audit(d.personId, 'doc-remove', [d.kind]); CP.store.changed();
  };

  /* --- Dokumenta dialogs (jauns papīra dokuments / rediģēšana) --- */
  const dform = U.$('documentForm');
  A.addDoc = arg => {
    if (!S.db.people.length) return ui.toast('Vispirms pievieno personu', 'warn');
    const [pid, kind] = String(arg || '').split('|');
    dform.reset(); dform.dataset.edit = ''; U.$('docTitle').textContent = 'Reģistrēt dokumentu';
    ui.personOptions('docPerson', pid || S.selected); U.$('docKind').innerHTML = ui.kindOptions(kind || '');
    dform.elements.received.value = U.iso(); dform.elements.format.value = 'paper'; dform.dataset.autoExp = '1'; docRuleUi(); U.$('documentDialog').showModal();
  };
  /** Ārsta izziņa u.c.: prasa izsniegšanas datumu, termiņu aprēķina pats (var labot) */
  function docRuleUi() {
    const kind = dform.elements.kind.value, r = D.docRule(kind), iss = dform.elements.issued, exp = dform.elements.expires;
    U.$('docIssuedLbl').innerHTML = r ? `${U.esc(kind)}: izsniegšanas datums <b class="red">*</b>` : 'Dokumenta datums (izsniegts)';
    iss.required = !!r;
    if (r && iss.value && (dform.dataset.autoExp || !exp.value)) { exp.value = D.docExpiry({ kind, issued: iss.value }); dform.dataset.autoExp = '1'; }
    U.$('docExpHint').textContent = r ? `Derīga ${r.months} mēn. no izsniegšanas${r.schoolYear ? ' un tikai savā mācību gadā — rīks atgādinās pirms termiņa, mācību gada beigās un jaunā gada sākumā' : ''}.` : '';
  }
  dform.addEventListener('change', e => { if (e.target.name === 'expires') dform.dataset.autoExp = ''; if (['kind', 'issued'].includes(e.target.name)) docRuleUi(); });
  A.editDoc = id => {
    const d = S.db.documents.find(x => x.id === id); if (!d) return;
    dform.reset(); dform.dataset.edit = id; U.$('docTitle').textContent = 'Rediģēt dokumentu';
    ui.personOptions('docPerson', d.personId, true); U.$('docKind').innerHTML = ui.kindOptions(d.kind);
    for (const k of ['format', 'received', 'issued', 'expires', 'notes', 'review']) if (dform.elements[k]) dform.elements[k].value = d[k] || '';
    dform.dataset.autoExp = d.expires && d.expires === D.docExpiry({ ...d, expires: '' }) ? '1' : '';
    docRuleUi(); U.$('documentDialog').showModal();
  };
  dform.addEventListener('submit', e => {
    e.preventDefault(); const o = Object.fromEntries(new FormData(dform));
    if (dform.dataset.edit) Object.assign(S.db.documents.find(x => x.id === dform.dataset.edit), o);
    else { S.db.documents.push({ ...o, id: U.uid(), path: '', sourceId: '', addedAt: U.now(), yearId: o.yearId || U.yearOfDate(o.received) || D.activeYear() }); D.audit(o.personId, 'doc-add', [o.kind]); }
    U.$('documentDialog').close(); CP.store.changed();
  });

  /* --- Failu pievienošana (iekopē personas mapē) --- */
  let attachCtx = null;
  A.attach = arg => {
    if (!S.root) return ui.toast('Vispirms izvēlies datu mapi', 'warn');
    const [pid, kind] = String(arg).split('|'); attachCtx = { pid, kind, sub: '' }; U.$('attachFile').click();
  };
  U.$('attachFile').addEventListener('change', async e => {
    const files = [...e.target.files]; e.target.value = ''; if (attachCtx) await docs.addFiles(attachCtx.pid, files, attachCtx.kind, attachCtx.sub || '');
  });
  docs.addFiles = async (pid, files, kind, subRel) => {
    const p = D.person(pid); if (!p || !files.length) return;
    if (!S.root) return ui.toast('Vispirms izvēlies datu mapi', 'warn');
    const rel = subRel != null ? subRel : '';
    let n = 0;
    try { await CP.store.ensurePersonYearFolder(p); }
    catch (err) { ui.toast('Personas mape nav pieejama: ' + err.message + '. Sasaistes paliek.', 'err'); return; }
    const parts = [...CP.store.yearPersonDir(p), ...String(rel || '').split('/').filter(Boolean)];
    for (const f of files) {
      try {
        const name = kind === D.MTL ? `${D.MTL} ${U.iso()}.${(f.name.split('.').pop() || 'pdf').toLowerCase()}` : f.name;
        const path = await CP.store.saveFile(parts, name, f, { confirmConflict: true });
        if (!path) continue;
        const format = /\.edoc$/i.test(name) ? 'edoc' : 'pdf';
        if (docs.link(p.id, kind || D.guessKind(f.name), format, path, 'main', { size: f.size, review: 'received' })) n++;
      } catch (err) { ui.toast('Neizdevās saglabāt ' + f.name + ': ' + err.message, 'err'); }
    }
    if (n) {
      CP.store.changed();
      const last = n === 1 && S.db.documents.find(x => x.id === docs.lastLinked);
      // dokumentam ar derīguma termiņu (ārsta izziņa) uzreiz jautā izsniegšanas datumu
      if (last && D.docRule(last.kind) && !last.issued) { A.editDoc(last.id); setTimeout(() => dform.elements.issued.focus(), 50); ui.toast(`${last.kind} pievienota. Norādi izsniegšanas datumu — rīks atgādinās, kad beidzas derīgums.`, 'ok', 8000); }
      else ui.toast(`Pievienoti ${n} faili personas mapē. Oriģināli nav dzēsti.`, 'ok', 7000, last ? { act: 'editDoc', arg: last.id, label: '✎ Labot datus' } : null);
    }
  };
  /** Aizstāt dokumenta failu ar jaunu (vecais fails paliek mapē, ierakstā saglabājas versiju vēsture) */
  let replaceId = null;
  A.replaceDoc = id => { if (!S.root) return CP.needRoot?.(); replaceId = id; U.$('replaceFile').click(); };
  U.$('replaceFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; const d = S.db.documents.find(x => x.id === replaceId); if (!f || !d) return;
    const p = D.person(d.personId);
    try {
      await CP.store.ensurePersonYearFolder(p);
      const path = await CP.store.saveFile(CP.store.yearPersonDir(p), f.name, f, { confirmConflict: true }); if (!path) return;
      if (d.path) (d.versions = d.versions || []).push({ path: d.path, sourceId: d.sourceId || 'main', at: d.replacedAt || d.addedAt });
      Object.assign(d, { path, sourceId: 'main', format: /\.edoc$/i.test(f.name) ? 'edoc' : (d.format === 'paper' ? 'pdf' : d.format || 'pdf'), size: f.size, replacedAt: U.now(), fileState: 'check', _live: null });
      D.audit(d.personId, 'update', [`Aizstāts fails: ${d.kind}`]); CP.store.changed();
      ui.toast('Fails aizstāts. Iepriekšējais fails paliek personas mapē.', 'ok', 7000, { act: 'editDoc', arg: d.id, label: '✎ Labot datus' });
    } catch (err) { ui.toast('Neizdevās aizstāt: ' + err.message, 'err', 9000); }
  });
  // Failu ievilkšana kartiņas dokumentu sarakstā
  document.addEventListener('dragover', e => { const z = e.target.closest?.('[data-drop]'); if (z) { e.preventDefault(); z.classList.add('over'); } });
  document.addEventListener('dragleave', e => { e.target.closest?.('[data-drop]')?.classList.remove('over'); });
  document.addEventListener('drop', e => { const z = e.target.closest?.('[data-drop]'); if (!z) return; e.preventDefault(); z.classList.remove('over'); docs.addFiles(z.dataset.drop, [...e.dataTransfer.files], '', S.browse.pid === z.dataset.drop ? (S.browse.rel || '') : ''); });

  /* --- Skatītājs --- */
  let view = null;
  A.view = async a => {
    const [sid, path] = splitKey(a), h = await CP.store.handleFor(path, sid);
    if (!h) return ui.toast('Fails nav atrasts. Pārbaudi datu mapi vai pārskenē.', 'warn');
    try {
      const f = await h.getFile(), ext = f.name.split('.').pop().toLowerCase();
      const type = f.type || ({ pdf: 'application/pdf', txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }[ext] || '');
      if (view) URL.revokeObjectURL(view.url);
      view = { url: URL.createObjectURL(type && type !== f.type ? new Blob([f], { type }) : f), name: f.name };
      U.$('viewBody').innerHTML = /^image\//.test(type) ? `<img class="viewimg" src="${view.url}" alt="">`
        : (type === 'application/pdf' || /^text\//.test(type)) ? `<iframe class="viewer" src="${view.url}" title="${esc(f.name)}"></iframe>`
        : ui.empty(`Šo faila tipu (.${esc(ext)}) pārlūks nevar parādīt.<br>Spied “Lejupielādēt” — .edoc failus atver ar eParakstītāju 3.0.`);
      U.$('viewName').textContent = f.name; U.$('viewDialog').showModal();
    } catch (err) { ui.toast('Neizdevās atvērt: ' + err.message, 'err'); }
  };
  /** Atver jau piesaistītu dokumentu anketas ievadē, lai papildinātu kartiņu */
  A.readDoc = async id => {
    const d = S.db.documents.find(x => x.id === id); if (!d) return;
    const h = await CP.store.handleFor(d.path, d.sourceId); if (!h) return ui.toast('Fails nav atrasts', 'warn');
    const f = await h.getFile(); f._linked = true;
    CP.scan.openWith(f, D.person(d.personId)?.status !== 'archived' ? d.personId : '');
  };
  /** Rāda sagatavotu failu (piem. veidlapas PDF) tajā pašā skatītājā */
  docs.showBlob = (blob, name) => {
    if (view) URL.revokeObjectURL(view.url);
    view = { url: URL.createObjectURL(blob), name };
    U.$('viewBody').innerHTML = `<iframe class="viewer" src="${view.url}" title="${esc(name)}"></iframe>`;
    U.$('viewName').textContent = name; U.$('viewDialog').showModal();
  };
  A.viewTab = () => view && window.open(view.url, '_blank');
  A.viewDownload = () => { if (!view) return; const a = document.createElement('a'); a.href = view.url; a.download = view.name; a.click(); };
  U.$('viewDialog').addEventListener('close', () => { if (view) { URL.revokeObjectURL(view.url); view = null; } U.$('viewBody').innerHTML = ''; });

  let probeGen = 0;
  docs.probeLinked = async () => {
    const gen = ++probeGen;
    for (const d of S.db.documents) {
      if (!d.path) continue;
      if (gen !== probeGen) return;
      d._live = await CP.store.probeDoc(d);
      const el = document.querySelector(`[data-docstatus="${CSS.escape(d.id)}"]`);
      if (el) el.outerHTML = docs.statusHtml(d);
      await new Promise(r => setTimeout(r, 0));
    }
  };
  function applyCheck(d, result) {
    if (!result) return;
    d._live = { state: result.state, detail: result.detail };
    d.fileState = result.state;
    d.fileDetail = result.detail;
    d.checkedAt = U.now();
    if (result.state === 'available' && result.sha256 && !result.changed) {
      d.sha256 = result.sha256; d.size = result.size; d.modified = result.modified;
    }
    const el = document.querySelector(`[data-docstatus="${CSS.escape(d.id)}"]`);
    if (el) el.outerHTML = docs.statusHtml(d);
  }
  A.checkDoc = async id => {
    const d = S.db.documents.find(x => x.id === id); if (!d) return;
    ui.toast('Pārbauda dokumentu…', 'ok', 2500);
    applyCheck(d, await CP.store.checkDoc(d));
    CP.store.changed({ silent: true });
    ui.toast(d.fileDetail || 'Pārbaude pabeigta', d.fileState === 'available' ? 'ok' : 'warn', 7000);
  };
  A.checkDocs = async () => {
    const list = S.db.documents.filter(d => d.path);
    if (!list.length) return ui.toast('Nav piesaistītu failu', 'warn');
    ui.toast(`Pārbauda ${list.length} dokumentus. Lieli faili tiek lasīti pa daļām.`, 'ok', 4000);
    for (const d of list) {
      applyCheck(d, await CP.store.checkDoc(d));
      await new Promise(r => setTimeout(r, 0));
    }
    CP.store.changed({ silent: true });
    const bad = list.filter(d => d.fileState && d.fileState !== 'available').length;
    ui.toast(bad ? `Pārbaude pabeigta. ${bad} dokumenti nav kārtībā.` : 'Visi pārbaudītie dokumenti ir pieejami.', bad ? 'warn' : 'ok', 8000);
  };
  let relinkId = null;
  A.relinkDoc = id => {
    const d = S.db.documents.find(x => x.id === id); if (!d) return;
    relinkId = id;
    U.$('relinkName').textContent = `${d.kind} — pašreiz: ${d.path || 'bez faila'}`;
    U.$('relinkQ').value = (d.path || '').split('/').pop();
    fillRelink();
    U.$('relinkDialog').showModal();
  };
  function fillRelink() {
    const q = U.norm(U.$('relinkQ').value);
    const rows = S.index.filter(f => !q || f.n.includes(q)).slice(0, 40);
    U.$('relinkList').innerHTML = rows.map(f => `<div class="row"><div class="grow"><b>${esc(f.name)}</b><div class="small muted">${esc(f.sourceName)} / ${esc(f.path)}</div></div><button class="sm mainbtn" data-act="relinkUse" data-arg="${keyOf(f.sourceId, f.path)}">Izvēlēties</button></div>`).join('') || '<p class="muted small">Šajās mapēs nekas netika atrasts. Vari izvēlēties failu datorā.</p>';
  }
  CP.inputHandlers.push(e => { if (e.target.id !== 'relinkQ') return false; fillRelink(); return true; });
  A.relinkUse = async key => {
    const d = S.db.documents.find(x => x.id === relinkId); if (!d) return;
    const [sid, path] = splitKey(key);
    const f = S.index.find(x => x.sourceId === sid && x.path === path); if (!f) return;
    d.previousPaths = [...(d.previousPaths || []), { path: d.path || '', sourceId: d.sourceId || '', at: U.now() }];
    d.path = f.path; d.sourceId = f.sourceId; d.sha256 = ''; d.fileState = 'check'; d.fileDetail = 'Sasaite mainīta — jāpārbauda'; d._live = null;
    try { const file = await f.handle.getFile(); d.size = file.size; d.modified = file.lastModified; } catch (e) { d.size = null; }
    D.audit(d.personId, 'doc-relink', [d.kind]);
    U.$('relinkDialog').close(); CP.store.changed(); ui.toast('Sasaite atjaunota. Iepriekšējais ceļš paliek ieraksta vēsturē. Fails netika pārvietots.', 'ok', 8000);
  };
  A.relinkPick = async () => {
    const d = S.db.documents.find(x => x.id === relinkId); if (!d) return;
    if (!window.showOpenFilePicker) return ui.toast('Šis pārlūks neļauj izvēlēties failu. Izvēlies to no pieslēgtās mapes saraksta.', 'warn');
    try {
      const [fh] = await showOpenFilePicker();
      const file = await fh.getFile();
      let found = null;
      for (const item of S.index.filter(x => x.name === file.name)) {
        try { if (await item.handle.isSameEntry(fh)) { found = item; break; } } catch (e) { /* turpina meklēt */ }
      }
      d.previousPaths = [...(d.previousPaths || []), { path: d.path || '', sourceId: d.sourceId || '', at: U.now() }];
      d.sha256 = ''; d.size = file.size; d.modified = file.lastModified; d.fileState = 'check'; d.fileDetail = 'Sasaite mainīta — jāpārbauda'; d._live = null;
      if (found) { d.path = found.path; d.sourceId = found.sourceId; }
      else {
        await CP.store.rememberDocHandle(d.id, fh);
        d.path = file.name; d.sourceId = 'fails:' + d.id;
      }
      D.audit(d.personId, 'doc-relink', [d.kind]);
      U.$('relinkDialog').close(); CP.store.changed();
      ui.toast(found ? 'Sasaite atjaunota uz failu pieslēgtajā mapē.' : 'Sasaite atjaunota uz izvēlēto failu. Pēc pārlūka aizvēršanas Chrome var prasīt atļauju vēlreiz.', 'ok', 9000);
    } catch (e) { if (e.name !== 'AbortError') ui.toast(e.message, 'err'); }
  };
  const personAfter = CP.pages.person.after;
  CP.pages.person.after = () => { personAfter?.(); if (S.tab === 'docs') { docs.syncBrowse(); docs.paintTree(); docs.probeLinked(); } };

  const enc = s => encodeURIComponent(s || '');
  const dec = s => { try { return decodeURIComponent(s || ''); } catch (e) { return s || ''; } };
  function fmtSize(n) {
    if (n == null) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  docs.syncBrowse = () => {
    const p = D.person(S.selected);
    if (!p) return;
    if (S.browse.pid !== p.id || S.browse.year !== D.activeYear()) S.browse = { pid: p.id, year: D.activeYear(), rel: '', q: '' };
  };
  let treeGen = 0;
  docs.paintTree = async () => {
    const box = U.$('docTree'), crumbs = U.$('docCrumbs');
    const gen = ++treeGen;
    const p = D.person(S.selected);
    if (!box || !p) return;
    if (!S.root) { box.innerHTML = '<p class="muted small">Izvēlies datu mapi, lai veidotu personas mapes un pievienotu failus.</p>'; if (crumbs) crumbs.innerHTML = ''; return; }
    let root;
    try { root = await CP.store.ensurePersonYearFolder(p); }
    catch (e) {
      if (gen !== treeGen) return;
      box.innerHTML = `<p class="warn">Neizdevās atvērt personas mapi: ${esc(e.message)}. Dokumentu sasaistes ir saglabātas.</p>`;
      return;
    }
    if (gen !== treeGen) return;
    const rel = S.browse.rel || '';
    const parts = [...root, ...rel.split('/').filter(Boolean)];
    const label = root[root.length - 1];
    if (crumbs) {
      const bits = rel ? rel.split('/').filter(Boolean) : [];
      crumbs.innerHTML = `<button type="button" class="sm" data-act="docOpen" data-arg="">${esc(label)}</button>` + bits.map((b, i) => `<span class="muted">/</span><button type="button" class="sm" data-act="docOpen" data-arg="${enc(bits.slice(0, i + 1).join('/'))}">${esc(b)}</button>`).join('');
    }
    try {
      const q = U.norm(S.browse.q || '');
      const rows = q ? await CP.store.searchNames(root, S.browse.q) : (await CP.store.listLevel(parts)).map(r => ({ ...r, rel: rel ? rel + '/' + r.name : r.name }));
      if (gen !== treeGen) return;
      const up = !q && rel ? `<div class="row"><button class="sm" data-act="docUp">↑ Augstāk</button><span class="muted small">${esc(rel)}</span></div>` : '';
      box.innerHTML = up + (rows.map(r => {
        const full = [...root, ...r.rel.split('/').filter(Boolean)].join('/');
        const linked = r.kind === 'file' ? S.db.documents.find(d => d.personId === p.id && d.path === full && (d.sourceId || 'main') === 'main') : null;
        const kind = r.kind === 'dir' ? 'mape' : (r.ext || 'fails').toUpperCase();
        if (r.kind === 'dir') return `<div class="row"><button class="sm" data-act="docOpen" data-arg="${enc(r.rel)}">📁 ${esc(r.name)}</button><span class="grow muted small">mape</span><button class="sm" data-act="docRename" data-arg="${enc(r.rel)}">Pārdēvēt</button></div>`;
        return `<div class="row"><div class="grow"><b>${esc(r.name)}</b> <span class="muted small">${esc(kind)} · ${fmtSize(r.size)}</span>${linked ? ` ${fmtTag(linked.format)} ${REVIEW[linked.review] ? `<span class="tag">${esc(REVIEW[linked.review])}</span>` : ''} ${docs.statusHtml(linked)}${linked.expires ? `<span class="muted small"> līdz ${esc(U.fmtDate(linked.expires))}</span>` : ''}` : ' <span class="muted small">nav piesaistīts</span>'}<div class="small muted">${esc(r.rel)}</div></div>
          <button class="sm mainbtn" data-act="view" data-arg="${keyOf('main', full)}">Atvērt</button>
          ${linked ? '' : `<button class="sm" data-act="docLinkHere" data-arg="${enc(r.rel)}">Piesaistīt</button>`}
          <button class="sm" data-act="docRename" data-arg="${enc(r.rel)}">Pārdēvēt</button>
          <button class="sm" data-act="docMoveOpen" data-arg="${enc(r.rel)}">Pārvietot</button></div>`;
      }).join('') || '<p class="muted small">Šajā mapē vēl nav dokumentu.</p>');
    } catch (e) {
      if (gen !== treeGen) return;
      box.innerHTML = `<p class="warn">Neizdevās nolasīt mapi: ${esc(e.message)}. Dokumentu sasaistes ir saglabātas.</p>`;
    }
  };
  function folderOptions(list, selected) {
    return list.map(f => `<option value="${esc(f)}" ${f === selected ? 'selected' : ''}>${esc(f || 'Personas mape')}</option>`).join('');
  }
  async function fillFolderSelect(id, selected) {
    const p = D.person(S.selected); if (!p || !S.root) return;
    const root = CP.store.yearPersonDir(p);
    const list = await CP.store.listFolders(root);
    U.$(id).innerHTML = folderOptions(list, selected || '');
  }
  A.docRefresh = () => docs.paintTree();
  A.docOpen = rel => { S.browse.rel = dec(rel); S.browse.q = ''; const q = U.$('docTreeQ'); if (q) q.value = ''; docs.paintTree(); };
  A.docUp = () => { S.browse.rel = (S.browse.rel || '').split('/').slice(0, -1).join('/'); docs.paintTree(); };
  A.docMkdir = async () => {
    if (!S.root) return ui.toast('Vispirms izvēlies datu mapi', 'warn');
    docs.syncBrowse();
    await fillFolderSelect('mkdirParent', S.browse.rel || '');
    U.$('mkdirName').value = '';
    U.$('mkdirDialog').showModal();
  };
  U.$('mkdirForm').addEventListener('submit', async e => {
    e.preventDefault();
    const p = D.person(S.selected); if (!p) return;
    try {
      const rel = await CP.store.makeSubdir(CP.store.yearPersonDir(p), U.$('mkdirParent').value, U.$('mkdirName').value);
      U.$('mkdirDialog').close();
      S.browse.rel = rel.split('/').slice(0, -1).join('/');
      await docs.paintTree();
      ui.toast('Mape ir izveidota', 'ok');
    } catch (err) { ui.toast(err.message, 'err'); }
  });
  A.docAddOpen = async () => {
    if (!S.root) return ui.toast('Vispirms izvēlies datu mapi', 'warn');
    docs.syncBrowse();
    await fillFolderSelect('addFileDir', S.browse.rel || '');
    U.$('addFileDialog').showModal();
  };
  U.$('addFileForm').addEventListener('submit', e => {
    e.preventDefault();
    attachCtx = { pid: S.selected, kind: '', sub: U.$('addFileDir').value };
    U.$('addFileDialog').close();
    U.$('attachFile').click();
  });
  let renameRel = '';
  A.docRename = rel => {
    renameRel = dec(rel);
    const name = renameRel.split('/').pop();
    U.$('renameEntryTitle').textContent = 'Pārdēvēt';
    U.$('renameEntryName').value = name;
    U.$('renameEntryDialog').showModal();
  };
  U.$('renameEntryForm').addEventListener('submit', async e => {
    e.preventDefault();
    const p = D.person(S.selected); if (!p) return;
    const root = CP.store.yearPersonDir(p);
    const next = U.$('renameEntryName').value.trim();
    if (!confirm(`Pārdēvēt “${renameRel.split('/').pop()}” uz “${next}”?`)) return;
    try {
      const moved = await CP.store.relocate(root, renameRel, renameRel.split('/').slice(0, -1).join('/'), next);
      docs.retargetPath(moved.from, moved.path, moved.kind === 'directory');
      await CP.store.reindexDir(root);
      U.$('renameEntryDialog').close();
      CP.store.changed();
      ui.toast('Nosaukums ir nomainīts un sasaistes atjaunotas', 'ok');
    } catch (err) { ui.toast(err.message, 'err'); }
  });
  let moveRel = '';
  A.docMoveOpen = async rel => {
    moveRel = dec(rel);
    U.$('moveFileLabel').textContent = moveRel;
    await fillFolderSelect('moveFileDir', moveRel.split('/').slice(0, -1).join('/'));
    U.$('moveFileDialog').showModal();
  };
  U.$('moveFileForm').addEventListener('submit', async e => {
    e.preventDefault();
    const p = D.person(S.selected); if (!p) return;
    const dest = U.$('moveFileDir').value;
    if (!confirm(`Pārvietot “${moveRel.split('/').pop()}” uz “${dest || 'personas mapi'}”?`)) return;
    try {
      const root = CP.store.yearPersonDir(p);
      const moved = await CP.store.relocate(root, moveRel, dest, moveRel.split('/').pop());
      docs.retargetPath(moved.from, moved.path, false);
      await CP.store.reindexDir(root);
      U.$('moveFileDialog').close();
      CP.store.changed();
      ui.toast('Fails ir pārvietots un sasaiste atjaunota', 'ok');
    } catch (err) { ui.toast(err.message, 'err'); }
  });
  A.docLinkHere = rel => {
    const p = D.person(S.selected); if (!p) return;
    const full = [...CP.store.yearPersonDir(p), ...dec(rel).split('/').filter(Boolean)].join('/');
    const name = full.split('/').pop();
    if (docs.link(p.id, D.guessKind(name), /\.edoc$/i.test(name) ? 'edoc' : 'pdf', full, 'main', { review: 'received' })) {
      CP.store.changed(); ui.toast('Dokuments piesaistīts kartītei', 'ok');
    }
  };
  docs.retargetPath = (from, to, isDir) => {
    for (const d of S.db.documents) {
      if ((d.sourceId || 'main') !== 'main' || !d.path) continue;
      const hit = isDir ? (d.path === from || d.path.startsWith(from + '/')) : d.path === from;
      if (!hit) continue;
      d.previousPaths = [...(d.previousPaths || []), { path: d.path, sourceId: d.sourceId || 'main', at: U.now() }];
      d.path = isDir ? to + d.path.slice(from.length) : to;
      d.fileState = 'check'; d.fileDetail = 'Ceļš atjaunots'; d._live = null;
      D.audit(d.personId, 'doc-relink', [d.kind]);
    }
  };
  CP.inputHandlers.push(e => {
    if (e.target.id !== 'docTreeQ') return false;
    S.browse.q = e.target.value;
    docs.paintTree();
    return true;
  });
  CP.pages.documents.after = () => docs.probeLinked();

  CP.docs = docs;
})(window.CP);


/* ==== js/comms.js ==== */
/* =====================================================================
   Saziņa: WhatsApp / SMS / e-pasts / zvans no kartiņas, ziņa grupai,
   ārējo rīku saites. Ziņa tiek atvērta lietotāja programmā — sūtīšanu
   apstiprina pats lietotājs. Katra saziņa tiek ierakstīta vēsturē.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const comms = {};

  function openExternal(url) {
    if (/^https?:/.test(url)) { window.open(url, '_blank', 'noopener'); return; }
    const a = document.createElement('a'); a.href = url; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
  }
  const waUrl = (num, text) => {
    const t = encodeURIComponent(text || '');
    return S.db.settings.waMode === 'app' ? `whatsapp://send?phone=${num}&text=${t}` : `https://wa.me/${num}${t ? '?text=' + t : ''}`;
  };
  function channelUrl(ch, c, text, subject) {
    const num = U.normPhone(c.phone);
    if (ch === 'whatsapp') { if (!num) throw Error('Saņēmējam nav tālruņa numura'); return waUrl(num, text); }
    if (ch === 'sms') { if (!num) throw Error('Saņēmējam nav tālruņa numura'); return `sms:+${num}?body=${encodeURIComponent(text || '')}`; }
    if (!c.email) throw Error('Saņēmējam nav e-pasta adreses');
    return `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(text || '')}`;
  }
  const CH = { whatsapp: 'WhatsApp', sms: 'SMS', email: 'E-pasts' };

  /* --- Ārējie rīki (iestatāmi) --- */
  comms.toolLinks = p => {
    const vals = { 'vārds': p.first, 'uzvārds': p.last, 'pilns': U.full(p), 'tālrunis': U.normPhone(p.phone), 'epasts': p.email, 'grupa': D.groupOf(p), 'klase': p.schoolClass, 'skola': p.school };
    return (S.db.settings.tools || []).filter(t => t.name && t.url).map(t => {
      let ok = true;
      const url = t.url.replace(/\{([^}]+)\}/g, (m, k) => { if (!(k in vals)) return m; if (!vals[k]) ok = false; return encodeURIComponent(vals[k] || ''); });
      return ok && /^(https?:|mailto:)/.test(url) ? `<a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener">↗ ${esc(t.name)}</a>` : '';
    }).join('');
  };

  /* --- Ziņa vienai personai --- */
  let ctx = null;
  function openMsg(pid, idx, channel, tplIdx) {
    const p = D.person(pid); if (!p) return;
    const cs = D.contacts(p); if (!cs.length) return ui.toast('Personai nav ievadīts neviens tālrunis vai e-pasts', 'warn');
    ctx = { pid };
    U.$('msgTitle').textContent = 'Ziņa — ' + U.full(p);
    U.$('msgTo').innerHTML = cs.map(c => `<option value="${c.idx}">${esc(c.role)}: ${esc(c.name || '—')}${c.phone ? ' · ' + esc(U.prettyPhone(c.phone)) : ''}</option>`).join('');
    const def = idx != null && cs.some(c => c.idx == idx) ? idx : (cs.find(c => c.kind === 'parent') || cs[0]).idx;
    U.$('msgTo').value = String(def);
    U.$('msgChannel').value = channel || 'whatsapp';
    U.$('msgTpl').innerHTML = S.db.settings.templates.map((t, i) => `<option value="${i}">${esc(t.name)}</option>`).join('');
    U.$('msgTpl').value = String(tplIdx ?? 0);
    U.$('msgSubj').value = ''; refill(); subj(); U.$('msgDialog').showModal(); U.$('msgText').focus();
  }
  const current = () => D.contacts(D.person(ctx.pid)).find(c => c.idx == U.$('msgTo').value);
  const refill = () => { const t = S.db.settings.templates[U.$('msgTpl').value]; U.$('msgText').value = D.fillTpl(t?.text || '', D.person(ctx.pid), current()); };
  const subj = () => U.$('msgSubjWrap').classList.toggle('hidden', U.$('msgChannel').value !== 'email');
  U.$('msgTpl').onchange = refill; U.$('msgTo').onchange = refill; U.$('msgChannel').onchange = subj;

  A.msg = pid => openMsg(pid, null, 'whatsapp');
  A.msgTo = a => { const [pid, idx, ch] = a.split('|'); openMsg(pid, idx, ch); };
  A.remindDocs = pid => {
    const p = D.person(pid), c = D.contacts(p).find(c => c.kind === 'parent') || D.contacts(p)[0];
    const ti = S.db.settings.templates.findIndex(t => t.text.includes('{trūkst}'));
    openMsg(pid, c?.idx, 'whatsapp', ti >= 0 ? ti : 0);
  };
  A.msgCopy = () => navigator.clipboard.writeText(U.$('msgText').value).then(() => ui.toast('Teksts nokopēts', 'ok'));
  function setMsgActions(opened) {
    U.$('msgOpen').classList.toggle('hidden', opened);
    U.$('msgConfirm').classList.toggle('hidden', !opened);
    U.$('msgCancelSend').classList.toggle('hidden', !opened);
  }
  A.msgSend = () => {
    const c = current(), ch = U.$('msgChannel').value, text = U.$('msgText').value;
    try {
      const url = channelUrl(ch, c, text, U.$('msgSubj').value);
      const id = U.uid();
      S.db.log.push({ id, personId: ctx.pid, at: U.now(), type: ch, detail: `→ ${c.role}: ${c.name || ''}\n${text}`, status: 'prepared' });
      openExternal(url);
      const row = S.db.log.find(x => x.id === id);
      row.status = 'opened';
      ctx.logId = id;
      setMsgActions(true);
      CP.store.changed({ silent: true });
      ui.toast('Atvērts ārējā lietotnē. Ziņa vēl nav nosūtīta — apstiprini tikai tad, ja pats to nosūtīji.', 'warn', 9000);
    } catch (e) { ui.toast(e.message, 'warn'); }
  };
  A.msgConfirm = () => {
    const row = ctx?.logId && S.db.log.find(x => x.id === ctx.logId);
    if (!row) return;
    row.status = 'confirmed'; row.at = U.now();
    ctx.logId = null;
    U.$('msgDialog').close();
    CP.store.changed();
    ui.toast('Atzīmēts: lietotājs apstiprinājis nosūtīšanu', 'ok');
  };
  A.msgCancelSend = () => {
    const row = ctx?.logId && S.db.log.find(x => x.id === ctx.logId);
    if (row && row.status !== 'confirmed') row.status = 'cancelled';
    if (ctx) ctx.logId = null;
    U.$('msgDialog').close();
    CP.store.changed();
    ui.toast('Sūtīšana atcelta. Ziņa nav atzīmēta kā nosūtīta.', 'ok');
  };
  U.$('msgDialog').addEventListener('close', () => {
    const row = ctx?.logId && S.db.log.find(x => x.id === ctx.logId);
    if (row && (row.status === 'prepared' || row.status === 'opened')) { row.status = 'cancelled'; CP.store.changed({ silent: true }); }
    setMsgActions(false);
    ctx = null;
  });
  A.call = a => {
    const [pid, idx] = a.split('|'), c = D.contacts(D.person(pid)).find(c => c.idx == idx); if (!c) return;
    D.log(pid, 'call', `${c.role}: ${c.name || ''} ${U.prettyPhone(c.phone)}`); CP.store.changed({ silent: true });
    openExternal('tel:+' + U.normPhone(c.phone));
  };
  A.copy = text => navigator.clipboard.writeText(text).then(() => ui.toast('Nokopēts', 'ok'), () => ui.toast(text, 'ok'));

  /* --- Ziņa grupai / atlasītajiem --- */
  const C = S.comms;
  function recipients() {
    const out = [];
    const people = S.db.people.filter(p => D.inYear(p) && p.status !== 'archived' && (C.ids ? C.ids.has(p.id) : (!C.group || D.groupOf(p) === C.group))).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
    for (const p of people) for (const c of D.contacts(p)) {
      if (c.kind === 'emergency') continue;
      if (C.audience === 'youth' && c.kind !== 'youth') continue;
      if (C.audience === 'parents' && c.kind === 'youth') continue;
      if (C.channel === 'email' ? c.email : U.normPhone(c.phone)) out.push({ p, c, key: p.id + '|' + c.idx });
    }
    return out;
  }
  CP.pages.comms = {
    render() {
      const tpls = S.db.settings.templates; if (C.text === null) C.text = tpls[C.tpl]?.text || '';
      const rec = recipients(), gs = D.groups(), done = rec.filter(r => C.done.has(r.key)).length;
      const sel = (k, opts) => `<select data-comms="${k}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(C[k]) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
      return `<div class="page">${ui.pageHead('Saziņa', 'Viena ziņa daudziem — katram tiek ievietots viņa vārds un dati.')}
        <div class="comms-layout"><section class="card">
          ${C.ids ? `<div class="notice">Atlasītas <b>${C.ids.size}</b> personas no saraksta <button class="sm" data-act="commsAll">Rādīt pēc grupas</button></div>` : ''}
          <div class="fieldgrid">
            ${C.ids ? '' : `<div class="field"><label>Grupa</label>${sel('group', [['', 'Visas aktīvās personas'], ...gs.map(g => [g, g])])}</div>`}
            <div class="field"><label>Kam</label>${sel('audience', [['parents', 'Vecākiem / pārstāvjiem'], ['youth', 'Jauniešiem'], ['both', 'Abiem']])}</div>
            <div class="field"><label>Kanāls</label>${sel('channel', [['whatsapp', 'WhatsApp'], ['sms', 'SMS'], ['email', 'E-pasts']])}</div>
            <div class="field"><label>Veidne</label>${sel('tpl', tpls.map((t, i) => [i, t.name]))}</div>
            <div class="field wide"><label>Teksts</label><textarea id="commsText" rows="7">${esc(C.text)}</textarea>
              <div class="hint muted">Vietturi katram tiek aizvietoti: {saņēmējs} {vārds} {uzvārds} {grupa} {trūkst} {ekipējums}</div></div>
          </div></section>
          <section class="card"><h3>Saņēmēji <small class="muted">${rec.length} · atvērti lietotnē ${done}</small></h3>
            <div class="actions" style="margin-bottom:10px">${C.channel === 'email' ? `<button class="mainbtn sm" data-act="commsBcc">✉ Viena vēstule visiem (BCC)</button>` : ''}
              <button class="sm" data-act="commsCopy">⧉ Kopēt ${C.channel === 'email' ? 'adreses' : 'numurus'}</button>${done ? `<button class="sm ghost" data-act="commsReset">Notīrīt atzīmes</button>` : ''}</div>
            <p class="muted small">${C.channel === 'email' ? 'BCC vēstulē personīgie vietturi netiek aizvietoti. Personalizētai ziņai sūti katram atsevišķi.' : 'WhatsApp neļauj sūtīt automātiski daudziem — katram spied “Atvērt”, pārbaudi ziņu un nospied “Sūtīt”. Lielai grupai izveido WhatsApp grupu ar nokopētajiem numuriem.'}</p>
            <div class="reclist">${rec.map(r => {
              const slot = C.open?.[r.key];
              const st = slot && slot.channel === C.channel ? slot.status : '';
              return `<div class="row"><div class="grow"><b>${esc(U.sortName(r.p))}</b> <small class="muted">${esc(D.groupOf(r.p) || '')} · ${esc(U.yearLabel(D.activeYear()))}</small><div class="small">${esc(r.c.role)}: ${esc(r.c.name || '—')} · ${esc(C.channel === 'email' ? r.c.email : U.prettyPhone(r.c.phone))}${st ? ' · ' + esc(CP.COMM_STATUS[st] || st) : ''}</div></div>
              <button class="sm ${C.channel === 'whatsapp' ? 'wabtn' : 'mainbtn'}" data-act="commsOpen" data-arg="${r.key}">${st ? 'Atvērt vēlreiz' : 'Atvērt'}</button>
              ${st === 'opened' ? `<button class="sm" data-act="commsMark" data-arg="${esc(r.key)}|confirmed">Nosūtīju</button><button class="sm ghost" data-act="commsMark" data-arg="${esc(r.key)}|cancelled">Atcelt</button>` : ''}</div>`;
            }).join('') || '<p class="muted">Nav saņēmēju ar šim kanālam derīgu kontaktu.</p>'}</div></section></div></div>`;
    }
  };
  CP.changeHandlers.push(e => {
    const k = e.target.dataset.comms; if (!k) return false;
    C[k] = k === 'tpl' ? Number(e.target.value) : e.target.value;
    if (k === 'tpl') C.text = S.db.settings.templates[C.tpl]?.text || ''; else C.done.clear();
    CP.render(); return true;
  });
  CP.inputHandlers.push(e => { if (e.target.id !== 'commsText') return false; C.text = e.target.value; return true; });
  A.groupMsg = g => { C.group = g; C.ids = null; C.done.clear(); ui.go('comms'); };
  A.commsAll = () => { C.ids = null; C.done.clear(); CP.render(); };
  A.commsReset = () => { C.done.clear(); CP.render(); };
  A.commsOpen = key => {
    const r = recipients().find(x => x.key === key); if (!r) return;
    const text = D.fillTpl(C.text, r.p, r.c);
    try {
      const url = channelUrl(C.channel, r.c, text, S.db.settings.templates[C.tpl]?.name);
      const id = U.uid();
      S.db.log.push({ id, personId: r.p.id, at: U.now(), type: C.channel, detail: `→ ${r.c.role}: ${r.c.name || ''} (grupas ziņa)\n${text}`, status: 'prepared' });
      openExternal(url);
      S.db.log.find(x => x.id === id).status = 'opened';
      C.open = C.open || {}; C.open[key] = { id, status: 'opened', channel: C.channel }; C.done.add(key);
      CP.store.changed();
      ui.toast('Atvērts ārējā lietotnē. Tas vēl nav nosūtīts.', 'warn', 7000);
    } catch (e) { ui.toast(e.message, 'warn'); }
  };
  A.commsMark = arg => {
    const i = String(arg).lastIndexOf('|'), key = String(arg).slice(0, i), status = String(arg).slice(i + 1);
    const slot = C.open?.[key]; if (!slot || slot.channel !== C.channel) return;
    const row = S.db.log.find(x => x.id === slot.id); if (!row || row.status === 'confirmed') return;
    row.status = status === 'confirmed' ? 'confirmed' : 'cancelled';
    if (status === 'confirmed') row.at = U.now();
    slot.status = row.status;
    CP.store.changed();
  };
  A.commsBcc = () => {
    const rec = recipients(), emails = [...new Set(rec.map(r => r.c.email))]; if (!emails.length) return;
    const body = C.text.replace(/\{(vārds|uzvārds|pilns|saņēmējs|trūkst|ekipējums|vecāks)\}/g, '').replace(/,\s*!/g, '!');
    C.open = C.open || {};
    for (const r of rec) {
      const id = U.uid();
      S.db.log.push({ id, personId: r.p.id, at: U.now(), type: 'email', detail: `→ ${r.c.name || ''} (BCC grupas vēstule)\n${body}`, status: 'opened' });
      C.open[r.key] = { id, status: 'opened', channel: 'email' }; C.done.add(r.key);
    }
    openExternal(`mailto:?bcc=${emails.map(encodeURIComponent).join(',')}&subject=${encodeURIComponent(S.db.settings.templates[C.tpl]?.name || '')}&body=${encodeURIComponent(body)}`);
    CP.store.changed();
    ui.toast('E-pasts atvērts. Katram saņēmējam statuss ir “Atvērts ārējā lietotnē”, kamēr neatzīmē “Nosūtīju”.', 'warn', 9000);
  };
  A.commsCopy = () => {
    const list = [...new Set(recipients().map(r => C.channel === 'email' ? r.c.email : '+' + U.normPhone(r.c.phone)))];
    navigator.clipboard.writeText(list.join(C.channel === 'email' ? '; ' : '\n')).then(() => ui.toast(`Nokopēti ${list.length} kontakti`, 'ok'));
  };

  CP.comms = comms;
})(window.CP);


/* ==== js/equipment.js ==== */
/* =====================================================================
   Ekipējuma izsniegšana un atdošana + MTL aprites lapa
   MTL lapa nav obligāta, kamēr personai nav izsniegts ekipējums.
   Ja ekipējums ir izsniegts — brīdina, ja MTL lapas nav, vai ja pēc pēdējām
   izmaiņām ekipējumā (izsniegts / atdots / labots) nav pievienota jauna lapa.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const eq = {};

  function table(arr, showPerson = true) {
    if (!arr.length) return '<p class="muted">Nav ierakstu.</p>';
    return `<div class="tablewrap"><table class="table eqtable"><thead><tr>${showPerson ? '<th>Persona</th>' : ''}<th>Ekipējums</th><th>Inv. nr.</th><th>Izmērs</th><th>Daudz.</th><th>Izsniegts</th><th>Atdot līdz</th><th>Statuss</th><th>Piezīmes</th><th></th></tr></thead><tbody>
      ${arr.map(e => {
        const p = D.person(e.personId), late = !e.returned && e.due && U.daysTo(e.due) < 0;
        return `<tr class="${e.returned ? 'done' : ''}">${showPerson ? `<td><a href="#" data-person="${e.personId}" data-goto="equipment">${esc(U.sortName(p))}</a>${mtlBadge(p)}</td>` : ''}
          <td><b>${esc(e.item)}</b></td><td>${esc(e.inventory || '—')}</td><td>${esc(e.size || '—')}</td><td>${esc(e.qty || 1)}</td>
          <td>${U.fmtDate(e.issued)}${e.yearId ? `<div class="muted small">${esc(U.yearLabel(e.yearId))}</div>` : ''}</td><td class="${late ? 'red' : ''}">${U.fmtDate(e.due) || '—'}</td>
          <td>${e.returned ? `<span class="pill ok">Atdots ${U.fmtDate(e.returned)}</span>` : `<span class="pill ${late ? 'bad' : 'warn'}">${late ? 'Kavēts' : 'Izsniegts'}</span>`}</td>
          <td class="small">${esc(e.notes || '')}${e.returnNote ? `<div class="muted">Atdodot: ${esc(e.returnNote)}</div>` : ''}</td>
          <td class="right nowrap"><button class="sm ghost" data-act="editEq" data-arg="${e.id}" title="Labot">✎</button>${e.returned ? '' : `<button class="sm" data-act="returnEq" data-arg="${e.id}">Atdots</button>`}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  }
  const mtlBadge = p => { const m = D.mtlStatus(p); return m.state === 'missing' ? ' <span class="pill bad" title="Nav MTL aprites lapas">MTL ✗</span>' : m.state === 'outdated' ? ' <span class="pill warn" title="MTL lapa nav atjaunota pēc izmaiņām">MTL ⟳</span>' : ''; };

  /** MTL aprites lapas kartīte personas ekipējuma cilnē */
  function mtlCard(p) {
    const m = D.mtlStatus(p), last = m.latest;
    const status = m.state === 'missing' ? `<p class="warn">⚠ Personai ir izsniegts ekipējums, bet nav pievienota MTL aprites lapa.</p>`
      : m.state === 'outdated' ? `<p class="warn">⚠ Ekipējumā ir izmaiņas (${U.fmtDateTime(m.lastChange)}), bet jauna MTL lapa nav pievienota. Pēdējā lapa: ${U.fmtDate(last.received)}.</p>`
      : m.state === 'ok' ? `<p class="good">✓ MTL lapa ir aktuāla (${U.fmtDate(last.received)}).</p>`
      : `<p class="muted small">Nav izsniegta ekipējuma — MTL lapa nav nepieciešama.</p>`;
    return `<section class="card ${m.state === 'missing' || m.state === 'outdated' ? 'dupcard' : ''}"><h3>${CP.ic('clipboard')}MTL aprites lapa
        <span class="right actions"><button class="sm mainbtn" data-act="attach" data-arg="${p.id}|${esc(D.MTL)}">📎 Pievienot ${last ? 'jaunu ' : ''}lapu</button><button class="sm" data-act="addDoc" data-arg="${p.id}|${esc(D.MTL)}">📄 Papīra</button></span></h3>
      ${status}
      ${m.all.length ? m.all.map((d, i) => `<div class="row doc"><div class="grow"><b>${i === 0 ? 'Pēdējā' : 'Iepriekšējā'}</b> · ${U.fmtDate(d.received)}<div class="small muted">${esc(d.path || 'papīrs (bez faila)')}</div></div>${d.path ? `<button class="sm ${i === 0 ? 'mainbtn' : ''}" data-act="view" data-arg="${esc(d.sourceId || 'main')}|${esc(d.path)}">Atvērt</button>` : ''}</div>`).join('') : ''}</section>`;
  }
  eq.mtlCard = mtlCard;

  eq.personTab = p => {
    const arr = S.db.equipment.filter(e => e.personId === p.id).sort((a, b) => (a.returned ? 1 : 0) - (b.returned ? 1 : 0) || String(b.issued).localeCompare(String(a.issued)));
    return mtlCard(p) + `<section class="card"><h3>${CP.ic('backpack')}Ekipējums <button class="sm mainbtn right" data-act="addEq" data-arg="${p.id}">＋ Izsniegt</button></h3>${table(arr, false)}</section>`;
  };
  CP.pages.equipment = {
    render() {
      const mine = e => D.inYear(D.person(e.personId));
      const out = S.db.equipment.filter(e => !e.returned && mine(e)), back = S.db.equipment.filter(e => e.returned && (e.yearId === D.activeYear() || (!e.yearId && mine(e))));
      const people = [...new Set(S.db.equipment.map(e => e.personId))].map(D.person).filter(p => p && p.status !== 'archived');
      const mtlIssues = people.map(p => ({ p, m: D.mtlStatus(p) })).filter(x => x.m.state === 'missing' || x.m.state === 'outdated');
      return `<div class="page">${ui.pageHead('Ekipējums', `${out.reduce((n, e) => n + Number(e.qty || 1), 0)} vienības izsniegtas ${new Set(out.map(e => e.personId)).size} personām`, `<button class="mainbtn" data-act="addEq">＋ Izsniegt</button>`)}
        ${mtlIssues.length ? `<section class="card dupcard"><h3>⚠ MTL aprites lapas (${mtlIssues.length})</h3>${mtlIssues.map(x => `<div class="row"><div class="grow"><a href="#" data-person="${x.p.id}" data-goto="equipment">${esc(U.full(x.p))}</a> — <span class="warn">${x.m.state === 'missing' ? 'nav MTL lapas' : 'MTL lapa nav atjaunota pēc izmaiņām'}</span></div><button class="sm" data-act="attach" data-arg="${x.p.id}|${esc(D.MTL)}">📎 Pievienot</button></div>`).join('')}</section>` : ''}
        <section class="card"><h3>Izsniegts</h3>${table(out.sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9'))))}</section>
        <details class="card"><summary><b>Atdotais (${back.length})</b></summary>${table(back.sort((a, b) => String(b.returned).localeCompare(String(a.returned))))}</details></div>`;
    }
  };

  /* --- Izsniegšana / labošana --- */
  const f = U.$('equipmentForm'), fld = n => f.querySelector(`[name="${n}"]`);   // ne f.elements.item — tas ir iebūvēts metodes nosaukums
  A.addEq = pid => {
    if (!S.db.people.length) return ui.toast('Vispirms pievieno personu', 'warn');
    f.reset(); f.dataset.edit = ''; U.$('eqTitle').textContent = 'Izsniegt ekipējumu'; U.$('eqDel').classList.add('hidden'); U.$('eqReturnedWrap').classList.add('hidden'); U.$('eqRetNoteWrap').classList.add('hidden');
    ui.personOptions('eqPerson', pid || S.selected); fld('issued').value = U.iso(); fld('qty').value = 1; U.$('equipmentDialog').showModal(); fld('item').focus();
  };
  A.editEq = id => {
    const e = S.db.equipment.find(x => x.id === id); if (!e) return;
    f.reset(); f.dataset.edit = id; U.$('eqTitle').textContent = 'Labot ekipējumu'; U.$('eqDel').classList.remove('hidden'); U.$('eqReturnedWrap').classList.remove('hidden'); U.$('eqRetNoteWrap').classList.remove('hidden');
    ui.personOptions('eqPerson', e.personId, true);
    for (const k of ['item', 'inventory', 'size', 'qty', 'issued', 'due', 'notes', 'returned', 'returnNote']) fld(k).value = e[k] ?? (k === 'qty' ? 1 : '');
    U.$('equipmentDialog').showModal();
  };
  f.addEventListener('submit', ev => {
    ev.preventDefault(); const o = Object.fromEntries(new FormData(f)); o.qty = Number(o.qty || 1);
    if (f.dataset.edit) {
      const e = S.db.equipment.find(x => x.id === f.dataset.edit), changed = Object.keys(o).filter(k => String(e[k] ?? '') !== String(o[k] ?? ''));
      if (changed.length) { Object.assign(e, o); e.changedAt = U.now(); D.audit(e.personId, 'eq-edit', [e.item]); }
    } else { S.db.equipment.push({ ...o, id: U.uid(), returned: '', changedAt: U.now(), yearId: D.activeYear() }); D.audit(o.personId, 'eq-issue', [`${o.item}${o.qty > 1 ? ' × ' + o.qty : ''}`]); }
    U.$('equipmentDialog').close(); CP.store.changed(); mtlReminder(o.personId);
  });
  A.delEq = () => {
    const e = S.db.equipment.find(x => x.id === f.dataset.edit); if (!e || !confirm(`Dzēst ierakstu “${e.item}”? (Ja ekipējums atdots — labāk atzīmē “Atdots”.)`)) return;
    S.db.equipment = S.db.equipment.filter(x => x !== e); D.audit(e.personId, 'eq-delete', [e.item]); U.$('equipmentDialog').close(); CP.store.changed();
  };
  A.returnEq = id => {
    const x = S.db.equipment.find(z => z.id === id); if (!x) return;
    const note = prompt(`“${x.item}” atdots. Piezīme par stāvokli (nav obligāta):`, ''); if (note === null) return;
    x.returned = U.iso(); x.returnNote = note.trim(); x.changedAt = U.now(); D.audit(x.personId, 'eq-return', [x.item]); CP.store.changed(); mtlReminder(x.personId);
  };
  /** Pēc izmaiņām ekipējumā atgādina pievienot jaunu MTL lapu */
  function mtlReminder(pid) {
    const p = D.person(pid), m = p && D.mtlStatus(p);
    if (m && (m.state === 'missing' || m.state === 'outdated')) ui.toast(m.state === 'missing' ? 'Ekipējums izsniegts — pievieno MTL aprites lapu.' : 'Ekipējumā izmaiņas — pievieno atjaunotu MTL aprites lapu.', 'warn', 10000, { label: '📎 Pievienot MTL', act: 'attach', arg: `${pid}|${D.MTL}` });
  }
  CP.equipment = eq;
})(window.CP);


/* ==== js/idcard.js ==== */
/* =====================================================================
   Jaunsarga apliecība — neobligāta, tāpat kā ekipējums.
   Glabājas personas ierakstā: p.idCard = { status, number, requested, issued, validUntil, notes, changedAt }
   Skenējums — parasts dokuments ar veidu “Jaunsarga apliecība”.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const KIND = D.IDCARD = 'Jaunsarga apliecība';
  const ST = D.IDCARD_STATUS = {
    none: { l: 'Nav pieprasīta', c: '' },
    requested: { l: 'Pieprasīta', c: 'warn' },
    ready: { l: 'Saņemta, jāpasniedz', c: 'warn' },
    issued: { l: 'Izdota', c: 'ok' },
    returned: { l: 'Nodota atpakaļ', c: '' },
    lost: { l: 'Nozaudēta', c: 'bad' }
  };
  const card = p => p?.idCard || null;
  const scans = p => S.db.documents.filter(d => d.personId === p.id && d.kind === KIND).sort((a, b) => String(b.received || b.addedAt || '').localeCompare(String(a.received || a.addedAt || '')));
  const numKey = n => String(n || '').replace(/\s+/g, '').toUpperCase();

  /** Cita persona ar to pašu numuru */
  D.idCardDuplicate = (num, selfId) => { const k = numKey(num); return k ? S.db.people.find(x => x.id !== selfId && numKey(x.idCard?.number) === k) : null; };

  /** Brīdinājumi (izsauc D.alerts pašreizējā mācību gadā) */
  D.idCardAlerts = roster => {
    const out = [];
    for (const p of roster) {
      const c = card(p); if (!c || !c.status || c.status === 'none') continue;
      const who = U.full(p);
      if ((c.status === 'issued' || c.status === 'ready') && !String(c.number || '').trim()) out.push({ kind: 'idcard', personId: p.id, sev: 1, msg: `${who}: apliecība ${c.status === 'issued' ? 'izdota' : 'saņemta'}, bet nav ievadīts numurs`, when: '' });
      if (c.status === 'issued' && c.validUntil) {
        const d = U.daysTo(c.validUntil);
        if (d < 0) out.push({ kind: 'idcard', personId: p.id, sev: 1, msg: `${who}: jaunsarga apliecībai beidzies derīgums`, when: c.validUntil });
        else if (d <= 30) out.push({ kind: 'idcard', personId: p.id, sev: 0, msg: `${who}: apliecība derīga vēl ${d} d.`, when: c.validUntil });
      }
      if (c.status === 'requested' && c.requested && U.daysTo(c.requested) < -60) out.push({ kind: 'idcard', personId: p.id, sev: 0, msg: `${who}: apliecība pieprasīta pirms ${-U.daysTo(c.requested)} dienām, vēl nav saņemta`, when: c.requested });
      if (c.status === 'ready') out.push({ kind: 'idcard', personId: p.id, sev: 0, msg: `${who}: apliecība saņemta — jāpasniedz jaunsargam`, when: '' });
      if (c.status === 'issued' && (p.status === 'archived' || p.status === 'paused')) out.push({ kind: 'idcard', personId: p.id, sev: 1, msg: `${who}: dalība beigusies, bet apliecība nav nodota atpakaļ`, when: '' });
      if (c.status === 'issued' && c.number && D.idCardDuplicate(c.number, p.id)) out.push({ kind: 'idcard', personId: p.id, sev: 1, msg: `${who}: apliecības nr. ${c.number} ievadīts arī citai personai`, when: '' });
    }
    return out;
  };

  /** Īss statuss (cilnes skaitītājam / sarakstiem) */
  D.idCardBadge = p => {
    const c = card(p); if (!c || !c.status || c.status === 'none') return '';
    const bad = D.idCardAlerts([p]).some(a => a.sev > 0);
    return bad ? '<span class="warn">⚠</span>' : c.status === 'issued' ? '✓' : '•';
  };

  /** Personas cilne “Apliecība” */
  CP.idcard = {
    personTab(p) {
      const c = card(p), st = ST[c?.status || 'none'] || ST.none, sc = scans(p), al = D.idCardAlerts([p]);
      const dup = c?.number ? D.idCardDuplicate(c.number, p.id) : null;
      const rows = c && c.status && c.status !== 'none' ? ui.dl([
        ['Statuss', `<span class="pill ${st.c}">${esc(st.l)}</span>`, true],
        ['Apliecības numurs', c.number ? `<b class="mono">${esc(c.number)}</b>${dup ? ` <span class="pill bad">sakrīt ar: ${esc(U.full(dup))}</span>` : ''}` : '<span class="muted">nav ievadīts</span>', true],
        ['Pieprasīta', U.fmtDate(c.requested)],
        ['Izdota', U.fmtDate(c.issued)],
        ['Derīga līdz', c.validUntil ? `${esc(U.fmtDate(c.validUntil))}${U.daysTo(c.validUntil) < 0 ? ' <span class="pill bad">beidzies</span>' : ''}` : '', true],
        ['Piezīmes', c.notes || '']
      ]) : `<p class="muted">Apliecības dati nav ievadīti.</p>`;
      return `<section class="card ${al.some(a => a.sev > 0) ? 'dupcard' : ''}"><h3>${CP.ic('idcard', '🪪')} Jaunsarga apliecība
          <span class="right actions"><button class="sm mainbtn" data-act="editIdCard" data-arg="${p.id}">${c && c.status && c.status !== 'none' ? '✎ Labot' : '＋ Ievadīt datus'}</button></span></h3>
        ${al.length ? al.map(a => `<p class="${a.sev ? 'warn' : 'muted'}">${a.sev ? '⚠' : 'ℹ'} ${esc(a.msg.replace(U.full(p) + ': ', ''))}</p>`).join('') : ''}
        ${rows}</section>
        <section class="card"><h3>Apliecības kopija
          <span class="right actions"><button class="sm" data-act="attach" data-arg="${p.id}|${esc(KIND)}">📎 Pievienot skenējumu</button><button class="sm" data-act="addDoc" data-arg="${p.id}|${esc(KIND)}">📄 Papīra</button></span></h3>
        ${sc.length ? sc.map((d, i) => `<div class="row doc"><div class="grow"><b>${i === 0 ? 'Pēdējā' : 'Iepriekšējā'}</b> · ${U.fmtDate(d.received)}<div class="small muted">${esc(d.path || 'papīrs (bez faila)')}</div></div>${d.path ? `<button class="sm ${i === 0 ? 'mainbtn' : ''}" data-act="view" data-arg="${esc(d.sourceId || 'main')}|${esc(d.path)}">Atvērt</button>` : ''}</div>`).join('') : '<p class="muted small">Nav pievienota.</p>'}</section>`;
    }
  };

  /* --- Labošanas logs --- */
  const f = U.$('idCardForm'), fld = n => f.querySelector(`[name="${n}"]`);
  function syncFields() {
    const s = fld('status').value;
    U.qsa('#idCardForm [data-when]').forEach(el => el.classList.toggle('hidden', !el.dataset.when.split(' ').includes(s)));
    const dup = D.idCardDuplicate(fld('number').value, f.dataset.pid);
    U.$('idCardHint').innerHTML = dup ? `<span class="warn">⚠ Šis numurs jau ievadīts: ${esc(U.full(dup))}</span>` : '';
  }
  A.editIdCard = pid => {
    const p = D.person(pid); if (!p) return;
    const c = card(p) || {};
    f.reset(); f.dataset.pid = pid;
    U.$('idCardTitle').textContent = 'Jaunsarga apliecība — ' + U.full(p);
    for (const k of ['status', 'number', 'requested', 'issued', 'validUntil', 'notes']) fld(k).value = c[k] || (k === 'status' ? 'none' : '');
    syncFields(); U.$('idCardDialog').showModal(); fld('status').focus();
  };
  f.addEventListener('change', e => {
    if (e.target.name === 'status') {   // ērtībai — šodienas datums, ja vēl nav
      const s = e.target.value;
      if (s === 'requested' && !fld('requested').value) fld('requested').value = U.iso();
      if (s === 'issued' && !fld('issued').value) fld('issued').value = U.iso();
    }
    syncFields();
  });
  f.addEventListener('input', e => { if (e.target.name === 'number') syncFields(); });
  f.addEventListener('submit', ev => {
    ev.preventDefault();
    const p = D.person(f.dataset.pid); if (!p) return;
    const o = Object.fromEntries(new FormData(f)); for (const k in o) o[k] = String(o[k] || '').trim();
    if ((o.status === 'issued' || o.status === 'ready') && !o.number && !confirm('Apliecības numurs nav ievadīts. Saglabāt tāpat?')) return;
    const dup = D.idCardDuplicate(o.number, p.id);
    if (dup && !confirm(`Numurs ${o.number} jau ievadīts personai ${U.full(dup)}. Saglabāt tāpat?`)) return;
    const prev = p.idCard || {}, changed = Object.keys(o).filter(k => String(prev[k] || '') !== o[k]);
    if (changed.length) {
      p.idCard = { ...prev, ...o, changedAt: U.now() };
      p.updatedAt = U.now();
      D.audit(p.id, 'idcard', [ST[o.status]?.l || o.status, ...(o.number && changed.includes('number') ? ['nr. ' + o.number] : [])]);
      CP.store.changed();
    }
    U.$('idCardDialog').close();
    if (changed.includes('status') && o.status === 'issued' && !scans(p).length) ui.toast('Apliecība atzīmēta kā izdota. Ja vēlies, pievieno tās kopiju.', 'ok', 9000, { act: 'attach', arg: `${p.id}|${KIND}`, label: '📎 Pievienot' });
  });
})(window.CP);


/* ==== js/registry.js ==== */
/* =====================================================================
   Reģistrācija ārējās sistēmās: DVS (pa dokumentiem) un e-klase.
   p.reg = { dvs: { docs: { 'Pieteikuma anketa': { done, date }, 'Līgums': {…}, … } },
             eklase: { done: true, date } }
   DVS dokumentu saraksts = obligātie dokumenti (Iestatījumi → Dokumenti).
   Katru dokumentu var reģistrēt citā datumā. Kamēr kāds nav atzīmēts — brīdinājums
   pārskatā un sadaļā Uzdevumi. Vecā vienotā DVS atzīme tiek nolasīta kā “visi dokumenti”.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, A = CP.actions, esc = U.esc;
  const REGS = [{ k: 'dvs', l: 'DVS', loc: 'DVS', long: 'Reģistrēts DVS sistēmā' }, { k: 'eklase', l: 'e-klase', loc: 'e-klasē', long: 'Ievadīts e-klasē' }];
  CP.REGS = REGS;
  const on = () => { const s = S.db.settings.registries; return REGS.filter(r => !Array.isArray(s) || s.includes(r.k)); };
  const dvsDocs = () => (S.db.settings.requiredDocs || []).filter(Boolean);
  const followed = p => !!p && p.status !== 'archived' && !['paused', 'archived'].includes(D.partStatus(p));
  /** DVS atzīme konkrētam dokumentam (ar vecās vienotās atzīmes atbalstu) */
  const dvsOf = (p, kind) => { const d = p.reg?.dvs; if (!d) return null; if (d.docs?.[kind]?.done) return d.docs[kind]; if (d.done && !d.docs) return { done: true, date: d.date }; return null; };
  D.dvsMissing = p => followed(p) && on().some(r => r.k === 'dvs') ? dvsDocs().filter(k => !dvsOf(p, k)) : [];
  /** Saderībai: sistēmas, kur kaut kas nav atzīmēts */
  D.regMissing = p => {
    if (!followed(p)) return [];
    return on().filter(r => r.k === 'dvs' ? D.dvsMissing(p).length : !p.reg?.[r.k]?.done);
  };
  D.regAlerts = roster => {
    const out = [];
    for (const p of roster) {
      if (!followed(p)) continue;
      const dm = D.dvsMissing(p), ek = on().some(r => r.k === 'eklase') && !p.reg?.eklase?.done;
      if (dm.length) {
        const inTool = dm.filter(k => !D.missingDocs(p).includes(k));
        out.push({ kind: 'registry', personId: p.id, sev: 1, when: '',
          msg: `${U.full(p)}: DVS nav reģistrēts — ${dm.join(', ')}${inTool.length ? ` (rīkā jau pievienots: ${inTool.join(', ')})` : ''}` });
      }
      if (ek) out.push({ kind: 'registry', personId: p.id, sev: 1, when: '', msg: `${U.full(p)}: nav atzīmēts, ka ievadīts e-klasē` });
    }
    return out;
  };

  function normDvs(p) {
    const d = p.reg?.dvs || {};
    if (d.done && !d.docs) return { docs: Object.fromEntries(dvsDocs().map(k => [k, { done: true, date: d.date }])) };   // vecā atzīme → visi
    return { docs: { ...(d.docs || {}) } };
  }
  function setDvs(p, kind, done, date) {
    p.reg = { ...(p.reg || {}) };
    const d = normDvs(p);
    if (done) d.docs[kind] = { done: true, date: date || d.docs[kind]?.date || U.iso() }; else delete d.docs[kind];
    p.reg.dvs = d; p.updatedAt = U.now();
  }
  function setReg(p, k, done) {
    if (k === 'dvs') { for (const kind of dvsDocs()) setDvs(p, kind, done); D.audit(p.id, 'update', [`DVS: ${done ? 'reģistrēti visi dokumenti' : 'atzīmes noņemtas'}`]); return; }
    p.reg = { ...(p.reg || {}) };
    if (done) p.reg[k] = { done: true, date: U.iso() }; else delete p.reg[k];
    p.updatedAt = U.now();
    D.audit(p.id, 'update', [`${REGS.find(r => r.k === k)?.l}: ${done ? 'ievadīts' : 'nav ievadīts'}`]);
  }
  A.regToggle = arg => {
    const [id, k] = String(arg).split('|'), p = D.person(id); if (!p) return;
    setReg(p, k, !p.reg?.[k]?.done); CP.store.changed();
  };
  A.dvsToggle = arg => {
    const [id, i] = String(arg).split('|'), p = D.person(id), kind = dvsDocs()[Number(i)]; if (!p || !kind) return;
    const was = !!dvsOf(p, kind); setDvs(p, kind, !was);
    D.audit(p.id, 'update', [`DVS — ${kind}: ${was ? 'atzīme noņemta' : 'reģistrēts'}`]); CP.store.changed();
  };
  /** Reģistrācijas datuma maiņa (dokuments var būt reģistrēts citā dienā) */
  CP.changeHandlers.push(e => {
    const t = e.target, v = t.dataset?.dvsdate; if (v == null) return false;
    const [id, i] = v.split('|'), p = D.person(id), kind = dvsDocs()[Number(i)]; if (!p || !kind || !t.value) return true;
    setDvs(p, kind, true, t.value); D.audit(p.id, 'update', [`DVS — ${kind}: datums ${U.fmtDate(t.value)}`]);
    setTimeout(() => CP.store.changed(), 0); return true;
  });
  A.bulkReg = k => {
    let n = 0;
    for (const id of S.list.sel) {
      const p = D.person(id); if (!p) continue;
      if (k === 'dvs' ? D.dvsMissing(p).length || !dvsDocs().every(x => dvsOf(p, x)) : !p.reg?.[k]?.done) { setReg(p, k, true); n++; }
    }
    CP.store.changed(); CP.ui.toast(k === 'dvs' ? `DVS: visi dokumenti atzīmēti kā reģistrēti ${n} personām` : `${REGS.find(r => r.k === k)?.l}: atzīmētas ${n} personas`, 'ok');
  };

  /** Kartītes sānu panelis */
  function personCard(p) {
    const list = on(); if (!list.length) return '';
    const fol = followed(p), missTool = D.missingDocs(p);
    const dvs = list.some(r => r.k === 'dvs') ? (() => {
      const docs = dvsDocs(), dm = D.dvsMissing(p), okN = docs.length - docs.filter(k => !dvsOf(p, k)).length;
      return `<div class="reg-group"><div class="reg-title"><b>DVS</b> <span class="pill ${okN === docs.length ? 'ok' : ''}">${okN}/${docs.length} reģistrēti</span></div>
        ${docs.map((kind, i) => {
          const v = dvsOf(p, kind), inTool = !missTool.includes(kind);
          return `<div class="reg-row ${v ? 'ok' : (fol ? 'miss' : '')}"><label class="check grow"><input type="checkbox" data-act="dvsToggle" data-arg="${p.id}|${i}" ${v ? 'checked' : ''}>
            <span><b>${esc(kind)}</b><br><small class="muted">rīkā: ${inTool ? '<span class="okc">✓ pievienots</span>' : '<span class="warn">✗ nav pievienots</span>'}${v ? '' : (fol ? ' · DVS: <span class="warn">nav reģistrēts</span>' : '')}</small></span></label>
            ${v ? `<input type="date" class="sm reg-date" data-dvsdate="${p.id}|${i}" value="${esc(v.date || '')}" title="Reģistrēšanas datums DVS">` : ''}</div>`;
        }).join('')}
        ${fol && dm.length ? `<p class="small warn" style="margin:4px 0 0">⚠ Atzīmē katru dokumentu, kad tas reģistrēts DVS. Datumu var nomainīt.</p>` : ''}</div>`;
    })() : '';
    const ek = list.some(r => r.k === 'eklase') ? (() => {
      const v = p.reg?.eklase, miss = fol && !v?.done;
      return `<div class="reg-group"><label class="reg-row ${v?.done ? 'ok' : (miss ? 'miss' : '')}"><input type="checkbox" data-act="regToggle" data-arg="${p.id}|eklase" ${v?.done ? 'checked' : ''}>
        <span class="grow"><b>e-klase</b> <small class="muted">${v?.done ? 'ievadīts ' + esc(U.fmtDate(v.date)) : (miss ? '— vēl nav ievadīts' : '')}</small></span></label></div>`;
    })() : '';
    return `<section class="card reg-card"><h3>${CP.ic('check', '✓')}Reģistrācija</h3>${dvs}${ek}</section>`;
  }
  CP.registry = { personCard, setReg, REGS, dvsOf };
})(window.CP);


/* ==== js/contacts.js ==== */
/* =====================================================================
   Kontakti uz telefonu / Google kontaktiem
   - QR kods: noskenē ar telefona kameru → kontakts tiek saglabāts telefonā
     (un Google kontaktos, ja telefons sinhronizējas ar Google kontu)
   - .vcf fails: importē contacts.google.com → Importēt (der arī daudziem)
   Tiešs savienojums ar Google no lokāla faila nav iespējams (Google neatļauj
   pieteikšanos no file:// lapām), tāpēc izmantots standarta vCard formāts.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const QR_URL = CP.VENDOR + 'qrcode/qrcode.min.js';

  /* --- vCard 3.0 --- */
  const ve = s => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const splitName = full => { const p = String(full || '').trim().split(/\s+/); return p.length > 1 ? [p.slice(0, -1).join(' '), p.at(-1)] : [p[0] || '', '']; };
  /** Visi personas kontakti kā vCard ieraksti (jaunietis, vecāki, ārkārtas).
      Katrā kartītē ir arī saistītie cilvēki: bērna kartītē — vecāku vārdi un numuri (zvanāmi tieši no kartītes),
      vecāka kartītē — bērna vārds, grupa un numurs. Etiķetes (Google “Labels”): “Jaunsardze – jaunsargi” / “Jaunsardze – vecāki”. */
  function entries(p) {
    const st = S.db.settings, org = st.contactOrg || 'Jaunsardze';
    const labYouth = st.labelYouth || `${org} – jaunsargi`, labParents = st.labelParents || `${org} – vecāki`;
    const child = U.full(p), all = D.contacts(p), out = [];
    const relWord = c => c.kind === 'youth' ? 'Bērns' : c.kind === 'emergency' ? 'Ārkārtas kontakts' + (p.emergencyRelation ? ` (${p.emergencyRelation})` : '') : (c.role || 'Vecāks');
    for (const c of all) {
      const n = U.normPhone(c.phone); if (!n && !c.email) continue;
      const isYouth = c.kind === 'youth';
      let first, last, suffix;
      if (isYouth) { first = p.first; last = p.last; suffix = D.groupOf(p) ? `(${D.groupOf(p)})` : ''; }
      else { [first, last] = splitName(c.name || c.role); suffix = `(${child}, ${c.kind === 'emergency' ? 'ārkārtas' : (c.role || 'vecāks').toLowerCase()})`; }
      const full = [first, last, suffix].filter(Boolean).join(' ');
      const others = all.filter(o => o !== c);
      // Saistīto cilvēku numuri ar nosaukumu — redzami un zvanāmi tieši no kontakta
      const rel = [];
      others.forEach((o, i) => {
        const on = U.normPhone(o.phone), who = `${relWord(o)}: ${o.kind === 'youth' ? child : o.name || ''}`.trim();
        if (on) rel.push(`item${i + 1}.TEL:+${on}`, `item${i + 1}.X-ABLabel:${ve(who)}`);
        if (o.name || o.kind === 'youth') rel.push(`item${i + 11}.X-ABRELATEDNAMES:${ve(o.kind === 'youth' ? child : o.name)}`, `item${i + 11}.X-ABLabel:${ve(relWord(o))}`);
      });
      const note = [
        isYouth ? `Jaunsargs${D.groupOf(p) ? ', grupa ' + D.groupOf(p) : ''}${p.school ? ', ' + p.school : ''}${p.schoolClass ? ' ' + p.schoolClass : ''}` : `${relWord(c)} — ${child}${D.groupOf(p) ? ' (' + D.groupOf(p) + ')' : ''}`,
        ...others.map(o => `${relWord(o)}: ${o.kind === 'youth' ? child : o.name || '—'}${U.normPhone(o.phone) ? ' ' + U.prettyPhone(o.phone) : ''}${o.email ? ' ' + o.email : ''}`)
      ].join('\n');
      out.push({ key: c.idx, kind: c.kind, label: `${c.role}: ${c.name || '—'}`, full, phone: n ? '+' + n : '', email: c.email || '', relCount: others.length,
        vcf: ['BEGIN:VCARD', 'VERSION:3.0', `N:${ve(last)};${ve(first)};;;${ve(suffix)}`, `FN:${ve(full)}`,
          n && `TEL;TYPE=CELL:+${n}`, c.email && `EMAIL;TYPE=INTERNET:${ve(c.email)}`, `ORG:${ve(org)}${D.groupOf(p) ? ';' + ve(D.groupOf(p)) : ''}`,
          isYouth ? '' : `TITLE:${ve(relWord(c))} — ${ve(child)}`, ...rel, `NOTE:${ve(note)}`,
          `CATEGORIES:${[org, isYouth ? labYouth : labParents].map(x => x.replace(/,/g, ' ')).join(',')}`,
          'END:VCARD'].filter(Boolean).join('\r\n') });
    }
    return out;
  }
  const download = (text, name) => U.download(new Blob([text + '\r\n'], { type: 'text/vcard;charset=utf-8' }), name.replace(/[\\/:*?"<>|]/g, '_'));

  /* --- Dialogs vienai personai --- */
  let cur = null;
  A.vcard = async pid => {
    const p = D.person(pid); if (!p) return;
    const list = entries(p); if (!list.length) return ui.toast('Personai nav tālruņa vai e-pasta', 'warn');
    cur = { p, list, sel: list[0].key };
    U.$('vcTitle').textContent = '📇 Uz telefonu — ' + U.full(p);
    U.$('vcList').innerHTML = list.map(e => `<label class="vcrow"><input type="radio" name="vcpick" value="${e.key}" ${e.key === cur.sel ? 'checked' : ''}><span><b>${esc(e.full)}</b><small class="muted">${esc([e.phone && U.prettyPhone(e.phone), e.email].filter(Boolean).join(' · '))}</small></span><input type="checkbox" class="vcchk" value="${e.key}" checked title="Iekļaut .vcf failā"></label>`).join('');
    U.$('vcDone').textContent = p.contactsSavedAt ? `Pēdējo reizi saglabāts: ${U.fmtDate(p.contactsSavedAt)}` : '';
    U.$('vcardDialog').showModal(); await drawQr();
  };
  U.$('vcList').addEventListener('change', e => { if (e.target.name === 'vcpick') { cur.sel = Number(e.target.value); drawQr(); } });
  async function drawQr() {
    const box = U.$('vcQr'), e = cur.list.find(x => x.key === cur.sel);
    box.innerHTML = '<p class="muted small">Sagatavo QR…</p>';
    try {
      await CP.reader.loadScript(QR_URL);
      const q = window.qrcode; q.stringToBytes = q.stringToBytesFuncs['UTF-8'];
      const qr = q(0, 'L'); qr.addData(e.vcf, 'Byte'); qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 3, scalable: true }) + `<p class="small"><b>${esc(e.full)}</b></p>`;
    } catch (err) { box.innerHTML = `<p class="warn small">QR kodu neizdevās izveidot no lokālās bibliotēkas. Lieto .vcf failu.</p>`; }
  }
  A.vcDownload = () => {
    const keys = U.qsa('.vcchk:checked', U.$('vcList')).map(c => Number(c.value)); if (!keys.length) return ui.toast('Atzīmē vismaz vienu kontaktu', 'warn');
    download(cur.list.filter(e => keys.includes(e.key)).map(e => e.vcf).join('\r\n'), `Kontakti ${U.full(cur.p)}.vcf`);
    markSaved(cur.p, `.vcf fails (${keys.length})`);
  };
  A.vcScanned = () => { markSaved(cur.p, 'QR kods'); U.$('vcardDialog').close(); ui.toast('Atzīmēts, ka kontakti saglabāti telefonā', 'ok'); };
  function markSaved(p, how) { p.contactsSavedAt = U.iso(); D.log(p.id, 'note', `Kontakti saglabāti telefonā / Google kontaktos (${how})`); CP.store.changed({ silent: true }); U.$('vcDone').textContent = `Pēdējo reizi saglabāts: ${U.fmtDate(p.contactsSavedAt)}`; }

  /* --- Vairākas personas vienā failā (importam Google Contacts) --- */
  A.bulkVcard = () => {
    const people = S.db.people.filter(p => S.list.sel.has(p.id)), all = people.flatMap(entries);
    if (!all.length) return ui.toast('Atlasītajiem nav tālruņu vai e-pastu', 'warn');
    download(all.map(e => e.vcf).join('\r\n'), `Kontakti ${people.length} personas ${U.iso()}.vcf`);
    for (const p of people) { p.contactsSavedAt = U.iso(); }
    CP.store.changed({ silent: true });
    ui.toast(`Sagatavoti ${all.length} kontakti. Google Contacts → Importēt → izvēlies lejupielādēto .vcf failu.`, 'ok', 12000, { label: 'Atvērt Google Contacts', act: 'openGoogleContacts' });
  };
  A.openGoogleContacts = () => window.open('https://contacts.google.com/', '_blank', 'noopener');
  CP.contacts = { entries };
})(window.CP);


/* ==== js/watch.js ==== */
/* =====================================================================
   Pārskata pulkstenis (taktiskā pulksteņa stilā)
   Ciparnīcas: taktiskā, analogā, lielie cipari, nakts (sarkana).
   Režīmi: laiks, hronometrs (ar apļiem), taimeris (nodarbībām, ar skaņas signālu).
   Taustiņi uz korpusa: LIGHT — lielais skats, UP·MENU — ciparnīca, DOWN — režīms,
   START·STOP — sākt/apturēt, BACK·LAP — aplis / atiestatīt.
   Darba laiks: skaita, kamēr rīks atvērts; pēc N min atgādina par pauzi.
   Bez darbības N min — pulkstenis lielā skatā virs rīka (paslēpj arī datus).
   ===================================================================== */
(function (CP) {
  'use strict';
  const S = CP.state, A = CP.actions;
  const pad = n => String(n).padStart(2, '0');
  const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
  const hmmss = ms => ms >= 3600000 ? `${Math.floor(ms / 3600000)}:${mmss(ms % 3600000)}` : mmss(ms);
  const swFmt = ms => { const cs = Math.floor(ms / 10) % 100; return `${hmmss(ms)}.${pad(cs)}`; };
  const DAYS = ['Svētdiena', 'Pirmdiena', 'Otrdiena', 'Trešdiena', 'Ceturtdiena', 'Piektdiena', 'Sestdiena'];
  const MONTHS = ['janv.', 'febr.', 'marts', 'apr.', 'maijs', 'jūn.', 'jūl.', 'aug.', 'sept.', 'okt.', 'nov.', 'dec.'];
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ērtībai */ } } };

  /* --- Iestatījumi (pārlūkā + datu failā, tāpat kā izskats) --- */
  const DEF = { face: 'tactical', mode: 'time', workMin: 40, breakMin: 5, snoozeMin: 10, remind: true, idle: true, idleMin: 5, sound: true };
  const FACES = [['tactical', 'Taktiskā'], ['analog', 'Analogā'], ['big', 'Lielie cipari'], ['night', 'Nakts']];
  const MODES = [['time', 'Laiks'], ['stopwatch', 'Hronometrs'], ['timer', 'Taimeris']];
  CP.WATCH_FACES = FACES; CP.WATCH_MODES = MODES;
  function prefs() {
    let p = {}; try { p = JSON.parse(ls.get('cp-watch') || 'null') || {}; } catch (e) { p = {}; }
    const fromDb = S.db?.settings?.look?.watch || {};
    return { ...DEF, ...fromDb, ...p };
  }
  let P = prefs();
  CP.watchPrefs = () => P;
  CP.setWatchPref = (k, v) => {
    P = { ...P, [k]: v };
    ls.set('cp-watch', JSON.stringify(P));
    const st = S.db?.settings; if (st) { st.look = { ...(st.look || {}), watch: { ...P } }; if (S.root) CP.store.changed({ silent: true }); }
    if (k === 'workMin') { ses.remindAt = ses.start + P.workMin * 60000; saveSes(); }
    rebuild();
    if (S.page === 'settings') CP.render();   // lai izvēlētā poga iezīmējas uzreiz
  };

  /* --- Darba sesija --- */
  const KEY = 'cp-session';
  const loadSes = () => { try { return JSON.parse(ls.get(KEY) || 'null'); } catch (e) { return null; } };
  const saveSes = () => ls.set(KEY, JSON.stringify(ses));
  let ses = loadSes(); const t0 = Date.now();
  if (!ses || t0 - (ses.last || 0) > 5 * 60000) ses = { start: t0, last: t0, remindAt: t0 + P.workMin * 60000, breakEnd: 0 };
  saveSes();
  function restart(t = Date.now()) { ses = { start: t, last: t, remindAt: t + P.workMin * 60000, breakEnd: 0 }; saveSes(); }
  A.breakStart = () => { ses.breakEnd = Date.now() + P.breakMin * 60000; saveSes(); paint(true); CP.ui.toast(`Pauze ${P.breakMin} min. Pastaigā, izstaipies, padzer ūdeni.`, 'ok', 8000); };
  A.breakEnd = () => { restart(); paint(true); };

  /* --- Hronometrs un taimeris (tikai šajā cilnē) --- */
  const sw = { run: false, t0: 0, acc: 0, laps: [] };
  const swNow = () => sw.acc + (sw.run ? Date.now() - sw.t0 : 0);
  const cd = { dur: 5 * 60000, end: 0, left: 5 * 60000, run: false, done: false };
  const cdLeft = () => cd.run ? Math.max(0, cd.end - Date.now()) : cd.left;

  A.watchMode = m => { CP.setWatchPref('mode', MODES.some(x => x[0] === m) ? m : MODES[(MODES.findIndex(x => x[0] === P.mode) + 1) % MODES.length][0]); };
  A.watchFace = f => { CP.setWatchPref('face', FACES.some(x => x[0] === f) ? f : FACES[(FACES.findIndex(x => x[0] === P.face) + 1) % FACES.length][0]); };
  A.watchStart = () => {
    if (P.mode === 'time') { P = { ...P, mode: 'stopwatch' }; ls.set('cp-watch', JSON.stringify(P)); }
    if (P.mode === 'stopwatch') { if (sw.run) { sw.acc += Date.now() - sw.t0; sw.run = false; } else { sw.t0 = Date.now(); sw.run = true; } }
    else if (P.mode === 'timer') {
      if (cd.done) { cd.done = false; cd.left = cd.dur; }
      if (cd.run) { cd.left = Math.max(0, cd.end - Date.now()); cd.run = false; } else if (cd.left > 0) { cd.end = Date.now() + cd.left; cd.run = true; }
    }
    rebuild();
  };
  A.watchLap = () => {
    if (P.mode === 'stopwatch') {
      if (sw.run) { const tot = swNow(), prev = sw.laps[0]?.tot || 0; sw.laps.unshift({ n: sw.laps.length + 1, tot, split: tot - prev }); }
      else { sw.acc = 0; sw.laps = []; }
    } else if (P.mode === 'timer') { cd.run = false; cd.done = false; cd.left = cd.dur; }
    rebuild();
  };
  A.watchSet = min => { const m = Math.max(0.25, Math.min(180, Number(min) || 0)); cd.dur = cd.left = Math.round(m * 60000); cd.run = false; cd.done = false; if (P.mode !== 'timer') CP.setWatchPref('mode', 'timer'); else rebuild(); };
  A.watchBig = () => showBig(true);

  /* --- Skaņa (WebAudio, bez failiem) --- */
  let actx = null;
  function beep(times = 3) {
    if (!P.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < times; i++) {
        const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * 0.32;
        o.type = 'square'; o.frequency.value = 1760; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.2);
      }
    } catch (e) { /* bez skaņas */ }
  }
  CP.watchBeep = beep;

  /* --- SVG ģeometrija --- */
  const C = 150, R_CASE = 142, R_BEZEL = 128, R_FACE = 104, R_ARC = 95;
  const pt = (deg, r) => { const a = deg * Math.PI / 180; return [C + r * Math.sin(a), C - r * Math.cos(a)]; };
  const f1 = n => n.toFixed(1);
  const arcPath = (from, to, r) => { const [x1, y1] = pt(from, r), [x2, y2] = pt(to, r); return `M${f1(x1)} ${f1(y1)} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${f1(x2)} ${f1(y2)}`; };
  const BTN = [[-60, 'LIGHT', 'watchBig', 'Liels pulkstenis'], [-110, 'UP · MENU', 'watchFace', 'Mainīt ciparnīcu'], [-145, 'DOWN', 'watchMode', 'Mainīt režīmu'], [60, 'START · STOP', 'watchStart', 'Sākt / apturēt'], [120, 'BACK · LAP', 'watchLap', 'Aplis / atiestatīt']];
  function ticks() {
    let s = '';
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0, [x1, y1] = pt(i * 6, R_BEZEL - (major ? 13 : 7)), [x2, y2] = pt(i * 6, R_BEZEL - 2);
      s += `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" class="${major ? 'tk-major' : 'tk'}"/>`;
    }
    return s;
  }
  let uid = 0;
  function caseSvg(inner, id) {
    const btns = BTN.map(([d, , act, title]) => { const [x, y] = pt(d, R_CASE + 4); return `<g class="w-btnhit" data-act="${act}" role="button" aria-label="${title}"><title>${title}</title><circle cx="${f1(x)}" cy="${f1(y)}" r="16" fill="transparent"/><rect class="w-btn" x="${f1(x - 9)}" y="${f1(y - 5)}" width="18" height="10" rx="3" transform="rotate(${d + 90} ${f1(x)} ${f1(y)})"/></g>`; }).join('');
    const txt = BTN.map(([d, t], i) => {
      const r = R_CASE - 7, [x1, y1] = pt(d - 15, r), [x2, y2] = pt(d + 15, r), bottom = Math.abs(d) > 90;
      const path = bottom ? `M${f1(x2)} ${f1(y2)} A${r} ${r} 0 0 0 ${f1(x1)} ${f1(y1)}` : `M${f1(x1)} ${f1(y1)} A${r} ${r} 0 0 1 ${f1(x2)} ${f1(y2)}`;
      return `<path id="${id}t${i}" d="${path}" fill="none"/><text class="w-engr"><textPath href="#${id}t${i}" startOffset="50%" text-anchor="middle">${t}</textPath></text>`;
    }).join('');
    return `<svg class="watch" viewBox="0 0 300 300" role="img" aria-label="Pulkstenis">
      <defs><linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="st-a"/><stop offset=".5" class="st-b"/><stop offset="1" class="st-c"/></linearGradient>
      <radialGradient id="${id}f" cx=".5" cy=".42" r=".65"><stop offset="0" class="fc-a"/><stop offset="1" class="fc-b"/></radialGradient></defs>
      ${btns}<circle cx="${C}" cy="${C}" r="${R_CASE}" class="w-case" fill="url(#${id}s)"/><circle cx="${C}" cy="${C}" r="${R_BEZEL + 1}" class="w-bezel"/>${txt}
      <g class="w-ticks">${ticks()}</g><circle cx="${C}" cy="${C}" r="${R_FACE}" class="w-face" fill="url(#${id}f)"/>${inner}</svg>`;
  }
  const arcs = () => `<path d="${arcPath(205, 335, R_ARC)}" class="w-track" pathLength="100"/><path data-w="arcA" d="${arcPath(205, 335, R_ARC)}" class="w-arc" pathLength="100" stroke-dasharray="0 100"/>
    <path d="${arcPath(25, 155, R_ARC)}" class="w-track" pathLength="100"/><path data-w="arcB" d="${arcPath(25, 155, R_ARC)}" class="w-arc w-arc2" pathLength="100" stroke-dasharray="0 100"/>`;
  /** Ciparnīcas iekšpuse atkarībā no ciparnīcas un režīma */
  function faceInner() {
    const f = P.face, m = P.mode;
    if (f === 'analog') {
      let nums = ''; for (const [h, n] of [[0, '12'], [90, '3'], [270, '9']]) { const [x, y] = pt(h, 82); nums += `<text x="${f1(x)}" y="${f1(y + 6)}" class="w-num">${n}</text>`; }
      return `${nums}<text x="${C}" y="114" class="w-date" data-w="date"></text>
        <text x="${C}" y="176" class="w-lbl" data-w="lbl"></text>
        <rect x="${C - 44}" y="184" width="88" height="28" rx="7" class="w-win"/><text x="${C}" y="204" class="w-winv" data-w="small"></text>
        <g data-w="hh"><line x1="${C}" y1="${C + 12}" x2="${C}" y2="${C - 52}" class="w-hand-h"/></g>
        <g data-w="mm"><line x1="${C}" y1="${C + 16}" x2="${C}" y2="${C - 80}" class="w-hand-m"/></g>
        <g data-w="ss"><line x1="${C}" y1="${C + 22}" x2="${C}" y2="${C - 88}" class="w-hand-s"/></g>
        <circle cx="${C}" cy="${C}" r="5" class="w-pin"/>`;
    }
    if (f === 'big') {
      return `<text x="${C}" y="104" class="w-date" data-w="date"></text>
        <text x="${C}" y="${m === 'time' ? 170 : 164}" class="w-huge ${m === 'stopwatch' ? 'sw' : ''}" data-w="main"></text>
        <text x="${C}" y="204" class="w-lbl" data-w="lbl"></text><text x="${C}" y="228" class="w-work" data-w="small"></text>`;
    }
    // taktiskā un nakts
    return `${arcs()}<text x="${C}" y="98" class="w-date" data-w="date"></text>
      <text x="${m === 'time' ? C - 10 : C}" y="160" class="w-time ${m === 'stopwatch' ? 'sw' : ''}" data-w="main"></text>
      ${m === 'time' ? `<text x="${C + 63}" y="160" class="w-sec" data-w="sec"></text>` : ''}
      <line x1="${C - 58}" y1="176" x2="${C + 58}" y2="176" class="w-rule"/>
      <text x="${C}" y="198" class="w-lbl" data-w="lbl"></text><text x="${C}" y="222" class="w-work" data-w="small"></text>`;
  }
  const modeTabs = () => `<div class="w-modes" role="tablist" aria-label="Pulksteņa režīms">${MODES.map(([k, l]) => `<button type="button" role="tab" aria-selected="${P.mode === k}" class="${P.mode === k ? 'on' : ''}" data-act="watchMode" data-arg="${k}">${l}</button>`).join('')}</div>`;
  function controls() {
    if (P.mode === 'stopwatch') return `<div class="w-ctl"><button type="button" class="mainbtn sm" data-act="watchStart">${sw.run ? 'Apturēt' : (swNow() ? 'Turpināt' : 'Sākt')}</button><button type="button" class="sm" data-act="watchLap">${sw.run ? 'Aplis' : 'Nulles'}</button></div>
      ${sw.laps.length ? `<ol class="w-laps">${sw.laps.slice(0, 6).map(l => `<li><span>${l.n}.</span><b>${swFmt(l.split)}</b><small>${swFmt(l.tot)}</small></li>`).join('')}</ol>` : ''}`;
    if (P.mode === 'timer') return `<div class="w-presets">${[1, 2, 3, 5, 10, 15].map(m => `<button type="button" class="sm ${cd.dur === m * 60000 ? 'on' : ''}" data-act="watchSet" data-arg="${m}">${m} min</button>`).join('')}<input type="number" min="0.25" max="180" step="0.5" id="wCustom" class="w-custom" placeholder="min" title="Savs laiks minūtēs" aria-label="Savs laiks minūtēs"></div>
      <div class="w-ctl"><button type="button" class="mainbtn sm" data-act="watchStart">${cd.run ? 'Pauze' : cd.done ? 'Vēlreiz' : (cd.left < cd.dur ? 'Turpināt' : 'Sākt')}</button><button type="button" class="sm" data-act="watchLap">Atiestatīt</button></div>`;
    return `<div class="w-foot" data-w="note"></div>`;
  }

  CP.watch = {
    html() {
      return `<section class="card watch-card" data-face="${P.face}" data-mode="${P.mode}">
        <div class="w-host">${caseSvg(faceInner(), 'w' + (++uid))}</div>
        ${modeTabs()}<div class="w-panel">${controls()}</div>
      </section>`;
    },
    paint: () => paint(true)
  };
  /** Pārzīmē pulksteņa kartīti (pēc režīma/ciparnīcas maiņas), nepārzīmējot visu lapu */
  function rebuild() {
    document.querySelectorAll('.watch-card').forEach(card => { const tmp = document.createElement('div'); tmp.innerHTML = CP.watch.html(); card.replaceWith(tmp.firstElementChild); });
    const ov = document.getElementById('watchBig'); if (ov) ov.querySelector('.wb-host').innerHTML = caseSvg(faceInner(), 'wb' + (++uid));
    paint(true);
  }

  /* --- Zīmēšana --- */
  const set = (root, k, v) => root.querySelectorAll(`[data-w="${k}"]`).forEach(el => { if (el.textContent !== v) el.textContent = v; });
  const attr = (root, k, a, v) => root.querySelectorAll(`[data-w="${k}"]`).forEach(el => el.setAttribute(a, v));
  function paint(full) {
    const roots = [...document.querySelectorAll('.watch-card, #watchBig')]; if (!roots.length) return;
    const d = new Date(), t = d.getTime(), work = t - ses.start, onBreak = !!ses.breakEnd;
    const workTxt = onBreak ? mmss(ses.breakEnd - t) : hmmss(work), workLbl = onBreak ? 'Pauze' : 'Darbā';
    const workPct = onBreak ? 100 - (ses.breakEnd - t) / (P.breakMin * 600) : Math.min(100, work / (P.workMin * 600));
    const over = !onBreak && work >= P.workMin * 60000;
    const h = d.getHours() % 12, mi = d.getMinutes(), s = d.getSeconds();
    for (const r of roots) {
      r.dataset.face = P.face; r.dataset.mode = P.mode;
      let state = onBreak ? 'break' : over ? 'over' : '';
      set(r, 'date', `${DAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`);
      attr(r, 'hh', 'transform', `rotate(${(h + mi / 60) * 30} ${C} ${C})`); attr(r, 'mm', 'transform', `rotate(${(mi + s / 60) * 6} ${C} ${C})`); attr(r, 'ss', 'transform', `rotate(${s * 6} ${C} ${C})`);
      if (P.mode === 'time') {
        set(r, 'main', `${pad(d.getHours())}:${pad(mi)}`); set(r, 'sec', pad(s));
        set(r, 'lbl', workLbl); set(r, 'small', workTxt);
        attr(r, 'arcA', 'stroke-dasharray', `${f1(workPct)} 100`); attr(r, 'arcB', 'stroke-dasharray', `${f1(s / 59 * 100)} 100`);
      } else if (P.mode === 'stopwatch') {
        const ms = swNow();
        set(r, 'main', P.face === 'analog' ? swFmt(ms) : swFmt(ms));
        set(r, 'lbl', sw.laps.length ? `Aplis ${sw.laps.length + 1}` : 'Hronometrs');
        set(r, 'small', P.face === 'analog' ? swFmt(ms) : sw.laps.length ? swFmt(ms - sw.laps[0].tot) : (sw.run ? 'iet…' : 'START — sākt'));
        attr(r, 'arcA', 'stroke-dasharray', `${f1((ms % 60000) / 600)} 100`); attr(r, 'arcB', 'stroke-dasharray', `${f1(workPct)} 100`);
        state = sw.run ? 'run' : state;
      } else {
        const left = cdLeft(), txt = hmmss(Math.ceil(left / 1000) * 1000);
        set(r, 'main', txt); set(r, 'lbl', cd.done ? 'Laiks beidzies!' : cd.run ? 'Taimeris' : 'Taimeris · gaida');
        set(r, 'small', P.face === 'analog' ? txt : `no ${hmmss(cd.dur)}`);
        attr(r, 'arcA', 'stroke-dasharray', `${f1(100 - left / cd.dur * 100)} 100`); attr(r, 'arcB', 'stroke-dasharray', `${f1(workPct)} 100`);
        state = cd.done ? 'alarm' : cd.run ? 'run' : state;
      }
      if (P.face === 'analog' && P.mode === 'time') set(r, 'small', workTxt);
      r.dataset.state = state;
      const note = r.querySelector('[data-w="note"]');
      if (note) {
        const key = onBreak ? 'b' : over ? 'o' : (P.remind ? 'w' + Math.ceil((P.workMin * 60000 - work) / 60000) : 'n' + Math.floor(work / 60000));
        if (full || note.dataset.k !== key) {
          note.dataset.k = key;
          note.innerHTML = onBreak ? `<span>Pauze līdz ${new Date(ses.breakEnd).toLocaleTimeString('lv-LV', { hour: '2-digit', minute: '2-digit' })}</span><button type="button" class="sm ghost" data-act="breakEnd">Turpināt darbu</button>`
            : over && P.remind ? `<span>Laiks pauzei</span><button type="button" class="sm" data-act="breakStart">Sākt pauzi</button>`
            : P.remind ? `<span>Pauze pēc ${Math.max(1, Math.ceil((P.workMin * 60000 - work) / 60000))} min</span>` : `<span>Darbā ${Math.floor(work / 60000)} min</span>`;
        }
      }
    }
  }

  /* --- Laika cikls --- */
  let lastIdleCheck = 0;
  function tick() {
    const t = Date.now();
    if (document.visibilityState === 'visible') { if (t - ses.last > 5 * 60000) restart(t); ses.last = t; }
    if (ses.breakEnd && t >= ses.breakEnd) { restart(t); beep(2); CP.ui.toast('Pauze beigusies. Labu darbu turpinot!', 'ok', 8000); }
    if (P.remind && !ses.breakEnd && t >= ses.remindAt && document.visibilityState === 'visible') {
      ses.remindAt = t + P.snoozeMin * 60000;
      CP.ui.toast(`Labs darbs! Tu strādā jau ${Math.round((t - ses.start) / 60000)} min. Laiks paņemt īsu pauzi — acīm un mugurai tas noder.`, 'ok', 60000, { act: 'breakStart', label: `Sākt pauzi (${P.breakMin} min)` });
    }
    if (cd.run && t >= cd.end) { cd.run = false; cd.left = 0; cd.done = true; beep(4); CP.ui.toast(`Taimeris: ${hmmss(cd.dur)} pagājis.`, 'warn', 15000); rebuild(); }
    if (t % 15000 < 260) saveSes();
    if (t - lastIdleCheck > 1000) { lastIdleCheck = t; idleCheck(t); }
    paint(false);
  }
  setInterval(tick, 250);   // 4× sekundē — hronometra simtdaļām pietiek, slodze niecīga
  document.addEventListener('visibilitychange', tick);

  /* --- Liels pulkstenis virs rīka (bez darbības N min vai ar LIGHT) --- */
  let lastAct = Date.now();
  ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, e => {
    lastAct = Date.now();
    const ov = document.getElementById('watchBig'); if (!ov) return;
    if (!ov.dataset.manual) { if (e.type !== 'pointermove' || Date.now() - Number(ov.dataset.shown || 0) > 600) hideBig(); }
    else if (e.type === 'keydown' && e.key === 'Escape') hideBig();
  }, { passive: true, capture: true }));
  function idleCheck(t) {
    if (!P.idle || document.getElementById('watchBig') || document.visibilityState !== 'visible') return;
    if (t - lastAct >= P.idleMin * 60000) showBig(false);
  }
  function showBig(manual) {
    if (document.getElementById('watchBig')) return;
    const ov = document.createElement('div'); ov.id = 'watchBig'; ov.className = 'watch-big'; ov.dataset.shown = String(Date.now()); if (manual) ov.dataset.manual = '1';
    ov.innerHTML = `<div class="wb-host">${caseSvg(faceInner(), 'wb' + (++uid))}</div><p class="wb-hint">${manual ? 'Klikšķis ārpus pulksteņa vai Esc — atpakaļ' : 'Pakustini peli vai nospied taustiņu, lai turpinātu'}</p>`;
    ov.addEventListener('click', e => { if (!e.target.closest('[data-act]')) hideBig(); });
    document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('on')); paint(true);
  }
  function hideBig() { document.getElementById('watchBig')?.remove(); }
  CP.watchShowBig = showBig;

  let customLast = '';
  CP.changeHandlers.push(e => {
    if (e.target.id !== 'wCustom') return false;
    const v = e.target.value; if (!v || !e.target.isConnected || v === customLast) return true;
    customLast = v; setTimeout(() => { A.watchSet(v); customLast = ''; }, 0);   // pēc notikuma — lai lauka aizvietošana netraucē fokusa notikumiem
    return true;
  });
  /** Pēc datu ielādes — iestatījumi no datu faila, ja šajā pārlūkā savu vēl nav */
  CP.watchReload = () => { if (!ls.get('cp-watch')) { P = prefs(); rebuild(); } };
})(window.CP);


/* ==== js/dashboard.js ==== */
/* =====================================================================
   Pārskats un uzdevumu / brīdinājumu lapa
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const SEV = ['info', 'warn', 'bad'], ICON = { mtl: CP.ic('clipboard', '▣'), phone: CP.ic('phone', '☎'), task: CP.ic('task', '☐'), retention: CP.ic('archive', '🗄'), birthday: CP.ic('cake', '🎂'), adult: CP.ic('adult', '🔞'), equipment: CP.ic('backpack', '▣'), document: CP.ic('file', '📄'), idcard: CP.ic('idcard', '🪪'), registry: CP.ic('check', '✓'), attendance: CP.ic('calendar', '📅'), backup: CP.ic('shield', '🔐') };

  const alertRow = a => `<div class="row alert ${SEV[a.sev]}"><span class="al-ic">${ICON[a.kind] || '•'}</span><div class="grow">${esc(a.msg)}${a.when ? `<small class="muted"> · ${U.fmtDate(a.when)}</small>` : ''}</div>
    ${a.year ? `<small class="muted">${esc(U.yearSlash(a.year))}</small>` : ''}${a.taskId ? `<button class="sm" data-act="taskDone" data-arg="${a.taskId}">✓ Izpildīts</button>` : ''}${a.personId ? `<button class="sm" data-person="${a.personId}">Atvērt</button>` : ''}</div>`;

  CP.pages.dashboard = {
    after() { CP.watch?.paint(); },
    render() {
      const cur = D.peopleInYear().filter(D.isCurrent), al = D.alerts();
      const miss = cur.map(p => ({ p, m: D.missingDocs(p) })).filter(x => x.m.length).sort((a, b) => b.m.length - a.m.length || U.cmp(U.sortName(a.p), U.sortName(b.p)));
      const cnt = s => cur.filter(p => D.partStatus(p) === s).length;
      const recent = [...S.db.audit].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 10);
      const B = S.boot;
      const start = B && !S.root && !B.error ? `<section class="card hero boot"><h2>Atver datu mapi${B.name ? ` “${esc(B.name)}”` : ''}</h2>
          <div class="bootbar"><span style="width:${Math.max(4, B.pct || 0)}%"></span></div>
          <p><b>${esc(B.msg || 'Lūdzu, uzgaidi…')}</b></p>
          <p class="muted small">${esc(B.detail || 'Pārbauda mapes pieejamību. Tīkla mapei vai zibatmiņai tas var aizņemt kādu brīdi — lūdzu, uzgaidi.')}</p></section>`
        : B && B.error && !S.root ? `<section class="card hero booterr"><h2>⚠ ${esc(B.title)}</h2>
          <ul class="hints">${B.hints.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          ${B.errText ? `<p class="small muted">Tehniski: ${esc(B.errText)}</p>` : ''}
          <div class="actions"><button class="mainbtn" data-act="retryRestore">↻ Mēģināt vēlreiz</button>${B.error === 'nodata' ? '<button data-act="bootNew">Sākt jaunu uzskaiti šeit</button>' : ''}<button data-act="pickRoot">📁 Izvēlēties citu mapi</button></div>
          ${ui.rootDrop()}</section>`
        : !S.root ? `<section class="card hero"><h2>Sāc darbu</h2><p>${S.pendingRoot ? `Mape <b>“${esc(S.pendingRoot.name)}”</b> ir atrasta. Chrome drošības dēļ pēc pārlūka restartēšanas lūdz apstiprināt piekļuvi — spied pogu zemāk.` : 'Pieslēdz datu mapi datorā — tajā glabāsies uzskaites fails un personu dokumenti. Pārlūks mapi atcerēsies.'}</p>
        <div class="actions">${S.pendingRoot ? `<button class="mainbtn" data-act="restoreRoot">🔓 Atļaut piekļuvi mapei “${esc(S.pendingRoot.name)}”</button><button data-act="pickRoot">Izvēlēties citu mapi</button>` : `<button class="mainbtn" data-act="pickRoot">📁 Izvēlēties datu mapi</button>`}<button class="ghost" data-act="encRestore" title="Jauns dators vai pazaudēta mape? Atjauno visu no šifrētās kopijas">🔐 Atjaunot no šifrētās kopijas</button></div>
        ${ui.rootDrop()}
        <div class="root-howto"><b>Kā sākt:</b>${ui.rootSteps()}</div>
        <p class="muted small">Kamēr mape nav pievienota, personas, dokumentus un veidlapas nevar ievadīt. Dati glabājas tikai tavā datorā, izvēlētajā mapē.</p></section>`
        : B?.step === 'index' ? `<div class="bootidx"><span class="spin"></span> Indeksē dokumentus mapē “${esc(B.name || '')}”… <b id="bootIdxN">${B.count || 0}</b> faili. Vari strādāt — dokumentu saraksti papildināsies.</div>` : '';
      const head = ui.pageHead('Pārskats', `${U.yearLabel(D.activeYear())} · ` + new Date().toLocaleDateString('lv-LV', { weekday: 'long', day: 'numeric', month: 'long' }), ui.saveBtn());
      if (!S.root) return `<div class="page">${head}${start}</div>`;   // bez mapes — tikai mapes pievienošana (statistika un darbības nav pieejamas)
      return `<div class="page">${ui.pageHead('Pārskats', `${U.yearLabel(D.activeYear())} · ` + new Date().toLocaleDateString('lv-LV', { weekday: 'long', day: 'numeric', month: 'long' }), ui.saveBtn())}
        ${start}
        ${CP.years?.banner() || ''}
        <div class="dash-top">${CP.watch ? CP.watch.html() : ''}
        <div class="stats">
          <button class="stat" data-tone="green" data-act="openList" data-arg="active">${CP.ic('userCheck')}<span>Jaunsargi</span><strong>${cnt('active')}</strong></button>
          <button class="stat" data-tone="blue" data-act="openList" data-arg="candidate">${CP.ic('userClock')}<span>Kandidāti</span><strong>${cnt('candidate')}</strong></button>
          <button class="stat" data-tone="amber" data-act="openList" data-arg="missing">${CP.ic('fileAlert')}<span>Trūkst dokumentu</span><strong class="${miss.length ? 'warn' : ''}">${miss.length}</strong></button>
          <button class="stat" data-tone="violet" data-page="documents">${CP.ic('files')}<span>Dokumenti šajā gadā</span><strong>${S.db.documents.filter(d => d.yearId === D.activeYear() || (!d.yearId && D.inYear(D.person(d.personId)))).length}</strong></button>
          <button class="stat" data-tone="olive" data-page="equipment">${CP.ic('backpack')}<span>Izsniegts ekipējums</span><strong>${S.db.equipment.filter(x => !x.returned && D.inYear(D.person(x.personId))).length}</strong></button>
          <button class="stat" data-tone="red" data-page="alerts">${CP.ic('bell')}<span>Uzdevumi un brīdinājumi</span><strong class="${al.some(a => a.sev > 1) ? 'red' : al.length ? 'warn' : ''}">${al.length}</strong></button>
        </div></div>
        <section class="card quick"><button class="mainbtn" data-act="scan">${CP.ic('scan', '📷')} Ievadīt no anketas</button><button data-act="addPerson">${CP.ic('userPlus', '＋')} Jauna persona</button><button data-page="comms">${CP.ic('megaphone', '✉')} Ziņa grupai</button><button data-act="import">${CP.ic('upload', '⬆')} Imports no Excel</button><button data-act="import" data-arg="eklase">${CP.ic('upload', '⬆')} No e-klases</button>${(S.db.settings.tools || []).filter(t => t.name && /^https?:/.test(t.url || '') && !/\{/.test(t.url)).map(t => `<a class="btn" href="${esc(t.url)}" target="_blank" rel="noopener">${CP.ic('external', '↗')} ${esc(t.name)}</a>`).join('')}</section>
        <div class="cards2">
          ${CP.schedule?.dashCard ? CP.schedule.dashCard() : ''}
          <section class="card" data-fill="5" data-mcol="1"><h3>Uzdevumi un brīdinājumi <button class="ghost sm right" data-page="alerts">Visi →</button></h3>${al.slice(0, 40).map(alertRow).join('') || '<p class="muted">Nekas nav jādara. ✓</p>'}${al.length ? `<div class="fill-more" data-total="${al.length}"><button class="sm ghost" data-page="alerts"></button></div>` : ''}</section>
          <section class="card" data-fill="5" data-mcol="2"><h3>Trūkstošie dokumenti <button class="ghost sm right" data-act="openList" data-arg="missing">Visi →</button></h3>${miss.slice(0, 40).map(x => `<div class="row"><div class="who">${ui.avatar(x.p, 'sm')}<span><b>${esc(U.sortName(x.p))}</b><small class="muted">${esc(D.groupOf(x.p) || '')}</small></span></div><div class="grow small warn">${esc(x.m.join(', '))}</div><button class="sm" data-person="${x.p.id}" data-goto="docs">Atvērt</button></div>`).join('') || '<p class="muted">Visiem ir obligātie dokumenti. ✓</p>'}${miss.length ? `<div class="fill-more" data-total="${miss.length}"><button class="sm ghost" data-act="openList" data-arg="missing"></button></div>` : ''}</section>
          <section class="card" data-mcol="0"><h3>Grupas <button class="ghost sm right" data-act="groupNew" title="Pievienot jaunu grupu">＋ Jauna grupa</button></h3>${D.groups().map(g => `<div class="row grp-row"><div class="grow"><b>${esc(g)}</b></div><span class="muted">${cur.filter(p => D.groupOf(p) === g).length}</span><span class="grp-btns"><button class="sm ghost" data-act="groupEdit" data-arg="${esc(g)}" title="Pārdēvēt vai apvienot ar citu grupu" aria-label="Pārdēvēt grupu ${esc(g)}">✎</button><button class="sm ghost danger" data-act="groupDel" data-arg="${esc(g)}" title="Dzēst grupu" aria-label="Dzēst grupu ${esc(g)}">✕</button></span></div>`).join('') || '<p class="muted">Šajā gadā grupas vēl nav.</p>'}</section>
          <section class="card wide"><h3>Pēdējās izmaiņas</h3><div class="recent-grid">${recent.map(a => { const p = D.person(a.personId); return `<div class="row"><span class="muted small nowrap">${U.fmtDateTime(a.at)}</span><div class="grow">${p ? `<a href="#" data-person="${p.id}">${esc(U.full(p))}</a> — ` : ''}${esc({ create: 'izveidota kartīte', update: 'mainīti dati', scan: 'ievadīta no anketas', archive: 'arhivēta', restore: 'atjaunota', status: 'mainīts statuss', 'doc-add': 'pievienots dokuments', 'doc-remove': 'noņemts dokuments', 'doc-relink': 'atjaunota dokumenta sasaiste', 'eq-issue': 'izsniegts ekipējums', 'eq-return': 'atdots ekipējums', 'eq-edit': 'labots ekipējums', 'eq-delete': 'dzēsts ekipējuma ieraksts', idcard: 'apliecība', event: 'pievienots pasākumam', erase: 'dzēsts reģistra ieraksts' }[a.action] || a.action)}${a.fields?.length ? ': ' + esc(a.fields.join(', ')) : ''}</div></div>`; }).join('') || '<p class="muted">Vēl nav izmaiņu.</p>'}</div></section>
        </div></div>`;
    }
  };
  /* --- Paziņojumi katru reizi, atverot rīku --- */
  CP.notices = async () => {
    // Pēdējās atvēršanas datums glabājas pārlūkā (IndexedDB), lai rīka atvēršana neradītu “nesaglabātas izmaiņas”
    const st = S.db.settings, today = U.iso(), key = 'lastVisit:' + (S.rootName || '');
    let last = '';
    try { last = (await CP.store.idbGet(key)) || st.lastVisit || ''; } catch (e) { last = st.lastVisit || ''; }
    const ages = [];
    if (last && last < today && D.activeYear() === U.schoolYear()) for (const p of D.peopleInYear().filter(D.isCurrent)) {
      if (!p.birth) continue;
      // vai dzimšanas diena bija starp pēdējo apmeklējumu un šodienu
      const ageNow = U.age(p.birth), lastD = new Date(last + 'T12:00:00'), b = new Date(p.birth + 'T12:00:00');
      const ageThen = lastD.getFullYear() - b.getFullYear() - ((lastD.getMonth() < b.getMonth() || (lastD.getMonth() === b.getMonth() && lastD.getDate() < b.getDate())) ? 1 : 0);
      if (ageNow > ageThen) ages.push({ p, age: ageNow });
    }
    const al = D.alerts(), urgent = al.filter(a => a.sev >= 1), soon = al.filter(a => a.sev === 0);
    try { await CP.store.idbSet(key, today); } catch (e) { /* tikai ērtībai */ }
    if (!ages.length && !urgent.length && !soon.length) return;
    const row = a => `<div class="row alert ${SEV[a.sev]}"><span class="al-ic">${ICON[a.kind] || '•'}</span><div class="grow">${esc(a.msg)}${a.when ? `<small class="muted"> · ${U.fmtDate(a.when)}</small>` : ''}</div>${a.personId ? `<button class="sm" data-person="${a.personId}" data-close="noticeDialog" data-goto="${a.kind === 'mtl' ? 'equipment' : a.kind === 'document' ? 'docs' : 'overview'}">Atvērt</button>` : ''}</div>`;
    U.$('noticeBody').innerHTML =
      (ages.length ? `<h4 style="margin-top:0">🎂 Vecuma izmaiņas kopš ${U.fmtDate(last)}</h4>${ages.map(x => `<div class="row"><div class="grow"><b>${esc(U.full(x.p))}</b> — tagad <b>${x.age} g.</b>${x.age === 18 ? ' <span class="pill warn">pilngadīgs — pārstāvja piekrišana vairs nav vajadzīga, pārbaudi kontaktus un līgumu</span>' : ''}</div><button class="sm" data-person="${x.p.id}" data-close="noticeDialog">Atvērt</button></div>`).join('')}` : '')
      + (urgent.length ? `<h4>⚠ Jāpievērš uzmanība (${urgent.length})</h4>${urgent.slice(0, 25).map(row).join('')}${urgent.length > 25 ? `<p class="muted small">… un vēl ${urgent.length - 25}</p>` : ''}` : '')
      + (soon.length ? `<h4>📅 Drīzumā</h4>${soon.slice(0, 15).map(row).join('')}` : '');
    U.$('noticeDialog').showModal();
  };
  A.noticeAlerts = () => { U.$('noticeDialog').close(); ui.go('alerts'); };

  A.openList = k => {
    S.list.sel.clear();
    if (k === 'missing') { S.list.status = 'current'; S.list.missing = true; } else { S.list.status = k; S.list.missing = false; }
    ui.go('people');
  };

  CP.pages.alerts = {
    render() {
      const al = D.alerts(), inY = t => D.inYear(D.person(t.personId)) || t.yearId === D.activeYear();
      const done = S.db.tasks.filter(t => t.done && inY(t)).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt))).slice(0, 15);
      const allTasks = S.db.tasks.filter(t => !t.done && inY(t) && !(t.due && U.daysTo(t.due) <= 7));
      return `<div class="page">${ui.pageHead('Uzdevumi un brīdinājumi', `${U.yearLabel(D.activeYear())} · termiņi, dokumenti, ekipējums, dzimšanas dienas`)}
        <section class="card">${al.map(alertRow).join('') || '<p class="muted">Nav aktīvu brīdinājumu.</p>'}</section>
        ${allTasks.length ? `<section class="card"><h3>Vēlāki uzdevumi</h3>${allTasks.map(t => alertRow({ kind: 'task', personId: t.personId, taskId: t.id, sev: 0, msg: `${U.full(D.person(t.personId))}: ${t.text}`, when: t.due })).join('')}</section>` : ''}
        ${(() => { if (D.activeYear() !== U.schoolYear()) return ''; const g = D.phoneConflicts().filter(x => x.entries.some(e => D.inYear(e.p))); return g.length ? `<section class="card"><h3>☎ Sakrītoši tālruņi (${g.length})</h3><p class="muted small">⚠ — viens numurs norādīts dažādām personām (iespējama kļūda). ℹ — tas pats vecāks vairākiem bērniem (brāļi/māsas).</p>${g.map(x => `<div class="row"><span class="${x.suspicious ? 'warn' : 'muted'}">${x.suspicious ? '⚠' : 'ℹ'} <b>${esc(U.prettyPhone(x.num))}</b></span><div class="grow small">${x.entries.map(e => e.f === 'phone' ? `<a href="#" data-person="${e.p.id}">${esc(U.full(e.p))}</a> <span class="muted">(jaunietis)</span>` : `${esc(e.p[e.f.replace('Phone', 'Name')] || '?')} <span class="muted">(${e.role},</span> <a href="#" data-person="${e.p.id}">${esc(U.full(e.p))}</a><span class="muted">)</span>`).join('; ')}</div></div>`).join('')}</section>` : ''; })()}
        ${done.length ? `<details class="card"><summary><b>Nesen izpildītie</b></summary>${done.map(t => `<div class="row done"><div class="grow">${esc(U.full(D.person(t.personId)))}: ${esc(t.text)}</div><button class="sm ghost" data-act="taskDone" data-arg="${t.id}">Atjaunot</button></div>`).join('')}</details>` : ''}</div>`;
    }
  };
})(window.CP);
/* --- Kartīšu “mūra” izkārtojums: .cards2 kolonnās kartītes saliekas cieši cita zem citas (bez tukšām starpām),
       secība pa rindām paliek tā pati. Augstums tiek pārrēķināts, mainoties saturam vai loga platumam. --- */
(function (CP) {
  'use strict';
  const GAP = 14, UNIT = 2;
  const ro = 'ResizeObserver' in window ? new ResizeObserver(entries => { const grids = new Set(entries.map(e => e.target.parentElement).filter(g => g && !g._laying)); grids.forEach(lay); }) : null;
  /** Kartīte ar data-fill: rāda tik rindu, cik ietilpst līdz garākās kolonnas apakšai (vismaz data-fill), pārējās — “… un vēl N” */
  const fillRows = c => [...c.children].filter(x => x.classList.contains('row'));
  function setFill(c, n) {
    const rows = fillRows(c); rows.forEach((r, i) => { r.hidden = i >= n; });
    const more = c.querySelector('.fill-more'), total = Number(more?.dataset.total || rows.length), shown = Math.min(n, rows.length);
    if (more) { more.hidden = total <= shown; const b = more.querySelector('button'); if (b) b.textContent = `… un vēl ${total - shown} →`; }
  }
  function place(grid, n) {
    const h = Array(n).fill(0), at = new Map();
    for (const c of grid.children) {
      const span = Math.max(1, Math.ceil((c.getBoundingClientRect().height + GAP) / UNIT));
      if (c.classList.contains('wide')) { const top = Math.max(...h); c.style.gridColumn = '1 / -1'; c.style.gridRow = `${top + 1} / span ${span}`; h.fill(top + span); continue; }
      const col = c.dataset.mcol != null ? Math.min(Number(c.dataset.mcol), n - 1) : h.indexOf(Math.min(...h));   // noteikta kolonna vai īsākā
      c.style.gridColumn = String(col + 1); c.style.gridRow = `${h[col] + 1} / span ${span}`; at.set(c, { col, top: h[col], span }); h[col] += span;
    }
    return at;
  }
  function lay(grid) {
    if (!grid?.isConnected) return;
    grid._laying = true; clearTimeout(grid._layT);
    for (const c of grid.children) c.classList.remove('mas-stretch');   // mēra dabisko augstumu
    const n = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length, kids = [...grid.children], fills = kids.filter(c => c.dataset.fill);
    if (n <= 1) { for (const c of kids) c.style.gridColumn = c.style.gridRow = ''; grid.classList.remove('masonry'); fills.forEach(c => setFill(c, Number(c.dataset.fill) + 2)); }
    else {
      grid.classList.add('masonry');
      const k = new Map(fills.map(c => [c, Number(c.dataset.fill)]));
      fills.forEach(c => setFill(c, k.get(c)));                    // sāk ar minimumu
      const bottoms = at => { const b = Array(n).fill(0); for (const [c, a] of at) b[a.col] = Math.max(b[a.col], a.top + a.span); return b; };
      const done = new Set();
      for (let it = 0; it < 120; it++) {
        const at = place(grid, n), b = bottoms(at), max = Math.max(...b);
        // īsākā kolonna, kurā ir kartīte, kas vēl var augt
        const cand = fills.filter(c => !done.has(c) && at.has(c) && k.get(c) < fillRows(c).length).sort((x, y) => b[at.get(x).col] - b[at.get(y).col])[0];
        if (!cand) break;
        const col = at.get(cand).col; setFill(cand, k.get(cand) + 1);
        const b2 = bottoms(place(grid, n));
        if (b2[col] > max || Math.max(...b2) > max) { setFill(cand, k.get(cand)); done.add(cand); } else k.set(cand, k.get(cand) + 1);
      }
      // katras kolonnas pēdējā kartīte tiek izstiepta līdz kopējai apakšai → vienāda atstarpe līdz nākamajai (platajai) kartītei
      const at = place(grid, n), wideTops = [...grid.children].filter(c => c.classList.contains('wide')).map(c => Number(/^(\d+)/.exec(c.style.gridRow)?.[1] || 1) - 1).sort((a, b) => a - b);
      const band = a => wideTops.filter(t => t <= a.top).length;          // josla = cik platās kartītes ir virs
      const last = new Map(), bottom = new Map();
      for (const [c, a] of at) {
        const k = `${band(a)}|${a.col}`, b = band(a);
        if (!last.has(k) || a.top > at.get(last.get(k)).top) last.set(k, c);
        bottom.set(b, Math.max(bottom.get(b) || 0, a.top + a.span));
      }
      for (const c of last.values()) { const a = at.get(c), end = bottom.get(band(a)); if (band(a) < wideTops.length && end > a.top + a.span) {   // tikai, ja zemāk seko platā kartīte
        c.style.gridRow = `${a.top + 1} / ${end + 1}`; c.classList.add('mas-stretch'); } }
    }
    grid._layT = setTimeout(() => { grid._laying = false; }, 150);
  }
  function apply() {
    document.querySelectorAll('#main .cards2').forEach(g => {
      if (!g._mas) { g._mas = true; for (const c of g.children) ro?.observe(c); }
      lay(g);
    });
  }
  (CP.afterRender = CP.afterRender || []).push(apply);
  window.addEventListener('resize', () => document.querySelectorAll('#main .cards2').forEach(lay));
  CP.masonry = { apply, lay };
})(window.CP);

/* --- Grupu pārdēvēšana / apvienošana / dzēšana (aktīvajā mācību gadā). Personas netiek dzēstas. --- */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const members = g => (S.db.enrollments || []).filter(e => e.yearId === D.activeYear() && e.group === g);
  function moveGroup(from, to) {
    const list = members(from);
    for (const e of list) { e.group = to; const p = D.person(e.personId); if (p) { p.updatedAt = U.now(); D.audit(p.id, 'update', [to ? `Grupa: ${from} → ${to}` : `Grupa “${from}” dzēsta — bez grupas`]); } }
    const st = S.db.settings;
    if (st.stickyGroup === from) st.stickyGroup = to;
    if (S.list?.group === from) S.list.group = to || '';
    if (st.groupDays?.[from]) { if (to && !st.groupDays[to]) st.groupDays[to] = st.groupDays[from]; delete st.groupDays[from]; }
    // apmeklējuma nodarbības: pārdēvējot / apvienojot pāriet uz jauno grupu (vēsture saglabājas); dzēšot paliek ar veco nosaukumu
    if (to) for (const s of S.db.sessions || []) if (s.group === from && s.yearId === D.activeYear() && !(S.db.sessions || []).some(x => x !== s && x.group === to && x.date === s.date)) s.group = to;
    if (S.att?.group === from) S.att.group = to || '';
    D.setDeclaredGroups([...D.declaredGroups().filter(x => x !== from), ...(to ? [to] : [])]);
    return list.length;
  }
  function dlg(html) { let d = U.$('groupDialog'); if (!d) { d = document.createElement('dialog'); d.id = 'groupDialog'; document.body.appendChild(d); } d.innerHTML = html; d.showModal(); return d; }
  A.groupEdit = g => {
    const others = D.groups().filter(x => x !== g), n = members(g).length;
    const d = dlg(`<form><header class="dlg-head"><h2>Pārdēvēt grupu “${esc(g)}”</h2><button type="button" class="ghost" data-close="groupDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><div class="field"><label>Jaunais nosaukums</label><input name="to" value="${esc(g)}" list="dl_grp" required><datalist id="dl_grp">${others.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <p class="small muted">${n} personām šajā mācību gadā. Ja ieraksti jau esošas grupas nosaukumu, grupas tiks apvienotas. Apmeklējuma atzīmes un nodarbību dienas pāriet līdzi.</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="groupDialog">Atcelt</button><button class="mainbtn" type="submit">Saglabāt</button></footer></form>`);
    d.querySelector('form').onsubmit = e => {
      e.preventDefault(); const to = e.target.to.value.trim(); if (!to || to === g) return d.close();
      const merge = D.groups().includes(to);
      if (merge && !confirm(`Grupa “${to}” jau ir. Apvienot “${g}” ar “${to}”?`)) return;
      const k = moveGroup(g, to); d.close(); CP.store.changed(); ui.toast(merge ? `Grupa “${g}” apvienota ar “${to}” (${k} personas)` : `Grupa pārdēvēta: “${g}” → “${to}”`, 'ok');
    };
  };
  A.groupNew = () => {
    const d = dlg(`<form><header class="dlg-head"><h2>Jauna grupa</h2><button type="button" class="ghost" data-close="groupDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><div class="field"><label>Grupas nosaukums</label><input name="name" required placeholder="piem., 2.4. vai J1"></div>
      <p class="small muted">Grupa uzreiz parādīsies visās izvēlnēs: personas kartītē, sarakstu filtrā, apmeklējumā, saziņā un importā (mācību gadam ${esc(U.yearLabel(D.activeYear()))}).</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="groupDialog">Atcelt</button><button class="mainbtn" type="submit">Pievienot</button></footer></form>`);
    d.querySelector('[name=name]').focus();
    d.querySelector('form').onsubmit = e => {
      e.preventDefault(); const n = e.target.name.value.trim(); if (!n) return;
      if (!D.addGroup(n)) { d.close(); return ui.toast(`Grupa “${n}” jau ir`, 'warn'); }
      d.close(); CP.store.changed(); ui.datalists(); ui.toast(`Grupa “${n}” pievienota`, 'ok');
    };
  };
  A.groupDel = g => {
    const others = D.groups().filter(x => x !== g), n = members(g).length;
    const d = dlg(`<form><header class="dlg-head"><h2>Dzēst grupu “${esc(g)}”</h2><button type="button" class="ghost" data-close="groupDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body">${!n ? `<p style="margin-top:0">Grupā nav personu. To var droši dzēst.</p>` : `<p style="margin-top:0">Grupā šajā mācību gadā ir <b>${n}</b> ${n === 1 ? 'persona' : 'personas'}. <b>Personas netiek dzēstas</b> — izvēlies, kur tās likt:</p>`}
        <div class="choice-list" ${n ? '' : 'hidden'}>
          ${others.length ? `<label class="choice"><input type="radio" name="how" value="move" checked><div class="grow"><b>Pārcelt uz citu grupu</b><select name="to" aria-label="Grupa, uz kuru pārcelt">${others.map(x => `<option>${esc(x)}</option>`).join('')}</select></div></label>` : ''}
          <label class="choice"><input type="radio" name="how" value="none" ${others.length ? '' : 'checked'}><div class="grow"><b>Atstāt bez grupas</b><div class="small muted">Personas paliek sarakstā, tikai bez grupas</div></div></label>
        </div>
        <p class="small muted">Iepriekšējo mācību gadu dalība netiek mainīta.</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="groupDialog">Atcelt</button><button class="mainbtn danger" type="submit">Dzēst grupu</button></footer></form>`);
    d.querySelector('[name=to]')?.addEventListener('focus', () => { d.querySelector('[name=how][value=move]').checked = true; });
    d.querySelector('form').onsubmit = e => {
      e.preventDefault(); const f = e.target, to = f.how.value === 'move' ? f.to.value : '';
      const k = moveGroup(g, to); d.close(); CP.store.changed();
      ui.toast(to ? `Grupa “${g}” dzēsta — ${k} personas pārceltas uz “${to}”` : `Grupa “${g}” dzēsta — ${k} personas bez grupas`, 'ok', 6000);
    };
  };
})(window.CP);


/* ==== js/eklase.js ==== */
/* =====================================================================
   E-klases personas lietu eksporta palīgs.
   Skripts tiek palaists lietotāja paša e-klases cilnē (F12 → Console).
   Tas nolasa tikai atvērtajā personas lietā redzamos laukus un saglabā CSV
   lietotāja datorā. Nekas netiek sūtīts internetā.
   Savāktie ieraksti glabājas šīs cilnes sessionStorage, tāpēc tie nepazūd,
   ja e-klase pārlādē lapu (skriptu vienkārši jāielīmē vēlreiz).
   ===================================================================== */
(function (CP) {
  'use strict';

  function eklaseExport() {
    "use strict";
    const ID = "cadet-eklase-export-panel", KEY = "cadet-eklase-export";
    if (document.getElementById(ID)) { alert("CADET PERSONĀLS panelis jau ir atvērts."); return; }

    const clean = v => String(v ?? "").replace(/\s+/g, " ").trim();
    const records = new Map();
    let saved = {};
    try { saved = JSON.parse(sessionStorage.getItem(KEY) || "{}"); } catch (e) { saved = {}; }
    for (const [k, v] of saved.records || []) records.set(k, v);
    const persist = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ records: [...records], group: group.value, school: school.value })); } catch (e) { /* */ } };

    function getFields() {
      return [...document.querySelectorAll("input, select, textarea, [role='combobox']")]
        .filter(el => el.getClientRects().length > 0 && !el.closest("#" + ID));
    }

    function capture() {
      const fields = getFields();
      if (fields.length !== 36 || !fields[4]?.classList.contains("InputText") || !fields[16]?.classList.contains("DateField__input")) {
        throw new Error("Neatpazīstu personas lietu. Atrasti " + fields.length + " lauki (sagaidāmi 36). Atver skolēna personas lietu un mēģini vēlreiz.");
      }
      const v = i => clean(fields[i]?.value);
      const name = (i, j) => [v(i), v(j)].filter(Boolean).join(" ");
      if (!v(4) || !v(6)) throw new Error("Nav atrasts skolēna vārds vai uzvārds.");
      const father = name(24, 25), mother = name(27, 28), other = name(30, 31);
      return {
        "Vārds": v(6), "Uzvārds": v(4), "Dzimšanas datums": v(16), "Personas kods": v(5),
        "Grupa": group.value.trim(), "Klase": "", "Skola": school.value.trim(),
        "Tālrunis": v(10), "E-pasts": v(35),
        "Vecāks": mother || father || other, "Vecāka tālrunis": mother ? v(29) : father ? v(26) : v(32), "Vecāka e-pasts": "",
        "Piezīmes": v(7),
        "Tēvs": father, "Tēva tālrunis": v(26), "Māte": mother, "Mātes tālrunis": v(29),
        "Cita atbildīgā persona": other, "Citas personas tālrunis": v(32),
        "Deklarētā adrese": v(33), "Faktiskā adrese": v(34),
        "Personas lietas numurs": v(9), "Ieskaitīšanas datums": v(14), "Izslēgšanas datums": v(15), "Dzimšanas apliecības numurs": v(19)
      };
    }

    const panel = document.createElement("div");
    panel.id = ID;
    Object.assign(panel.style, { position: "fixed", top: "65px", right: "15px", width: "300px", zIndex: "2147483647", background: "#172433", color: "white", padding: "16px", borderRadius: "12px", boxShadow: "0 8px 35px #0008", font: "14px Arial" });
    const inp = "width:100%;box-sizing:border-box;padding:8px;margin:5px 0 10px;color:#000";
    const btn = bg => "width:100%;padding:11px;margin-bottom:8px;background:" + bg + ";color:white;border:0;border-radius:6px;cursor:pointer";
    panel.innerHTML =
      '<h3 style="margin:0 0 8px">CADET PERSONĀLS</h3><p style="margin:0 0 10px">E-klases personas datu eksports</p>' +
      '<label>Grupa (nav obligāti)</label><input id="cp-group" style="' + inp + '">' +
      '<label>Skola (nav obligāti)</label><input id="cp-school" style="' + inp + '">' +
      '<p id="cp-count">Savāktas personas: 0</p>' +
      '<button id="cp-add" style="' + btn("#15866d") + '">+ Pievienot personu</button>' +
      '<button id="cp-save" style="' + btn("#345b79") + '">Lejupielādēt CSV</button>' +
      '<button id="cp-close" style="' + btn("#34404b") + '">Aizvērt paneli</button>' +
      '<p id="cp-status" style="font-size:12px;margin:4px 0 0"></p>';
    document.body.appendChild(panel);

    const group = panel.querySelector("#cp-group"), school = panel.querySelector("#cp-school");
    const count = panel.querySelector("#cp-count"), status = panel.querySelector("#cp-status");
    group.value = saved.group || ""; school.value = saved.school || "";
    group.oninput = school.oninput = persist;
    const showCount = () => { count.textContent = "Savāktas personas: " + records.size; };
    const update = (msg, err = false) => { status.textContent = msg; status.style.color = err ? "#ff9999" : "#a9e1c1"; };

    panel.querySelector("#cp-add").onclick = () => {
      try {
        const p = capture();
        const key = p["Personas kods"] || [p["Vārds"], p["Uzvārds"], p["Dzimšanas datums"]].join("|").toLocaleLowerCase("lv");
        if (records.has(key) && !confirm("Persona jau ir sarakstā. Atjaunināt?")) return;
        records.set(key, p); persist(); showCount();
        update(p["Vārds"] + " " + p["Uzvārds"] + " pievienots. Atver nākamo skolēnu.");
      } catch (err) { update(err.message, true); }
    };

    panel.querySelector("#cp-save").onclick = () => {
      if (!records.size) { update("Nav pievienota neviena persona.", true); return; }
      const data = [...records.values()], headers = Object.keys(data[0]);
      const cell = value => { let s = String(value ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
      const csv = "﻿" + [headers, ...data.map(p => headers.map(h => p[h] ?? ""))].map(r => r.map(cell).join(";")).join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url; a.download = "CADET_PERSONALS_EKLASE_" + new Date().toISOString().slice(0, 10) + ".csv";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      update("Lejupielādētas " + data.length + " personas. Tagad importē failu CADET PERSONĀLS.");
    };

    panel.querySelector("#cp-close").onclick = () => {
      if (records.size && !confirm("Aizverot panelis aizmirsīs savāktās personas. Vai CSV jau ir lejupielādēts?")) return;
      records.clear();
      try { sessionStorage.removeItem(KEY); } catch (e) { /* */ }
      panel.remove();
    };

    showCount();
    update(records.size ? "Atjaunotas iepriekš savāktās personas. Vari turpināt." : "Gatavs. Atver skolēna personas lietu un spied “+ Pievienot personu”.");
  }

  CP.EKLASE_SCRIPT = '(' + eklaseExport.toString() + ')();';
})(window.CP);


/* ==== js/importexport.js ==== */
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


/* ==== js/settings.js ==== */
/* =====================================================================
   Iestatījumi. Glabājas datu failā, tātad līdzi datu mapei.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, ui = CP.ui, A = CP.actions, esc = U.esc;

  CP.pages.settings = {
    render() {
      const s = S.db.settings, o = s.ocr;
      return `<div class="page narrow">${ui.pageHead('Iestatījumi', `CADET PERSONĀLS ${CP.VERSION}`, ui.saveBtn())}
      ${CP.D2 ? `<section class="card"><h3>${CP.ic('layout')}Izskats</h3><div class="lookrow">
        <span>Tēma</span><div class="actions"><span class="themepick" role="group" aria-label="Tēma">${[['dark', 'Tumšā'], ['light', 'Gaišā'], ['auto', 'Kā datorā']].map(([v, l]) => `<button type="button" data-act="setTheme" data-arg="${v}" class="${CP.theme.get() === v ? 'on' : ''}" aria-pressed="${CP.theme.get() === v}">${l}</button>`).join('')}</span></div>
        <span>Akcenta krāsa</span><div class="swatches" role="group" aria-label="Akcenta krāsa">${(() => { const cur = CP.theme.accent(), known = CP.ACCENTS.some(([c]) => c === cur); return CP.ACCENTS.map(([c, n]) => `<button type="button" class="swatch ${c === cur ? 'on' : ''}" style="--sw:${c}" data-act="setAccent" data-arg="${c}" title="${n}" aria-label="${n}" aria-pressed="${c === cur}"></button>`).join('') + `<label class="btn swatch custom ${known ? '' : 'on'}" title="Sava krāsa" ${known ? '' : `style="--sw:${cur};background:${cur}"`}><input type="color" id="accentPick" value="${cur}" aria-label="Sava krāsa"></label>`; })()}</div>
      </div><p class="small muted" style="margin:12px 0 0">Akcents nosaka pogas, izcēlumus, saites un vieglu fona toni. Izskats tiek saglabāts šajā pārlūkā un datu failā.</p></section>` : ''}
      ${CP.watchPrefs ? (() => { const w = CP.watchPrefs(); return `<section class="card"><h3>${CP.ic('clock')}Pulkstenis un pauzes</h3><div class="lookrow">
        <span>Ciparnīca</span><div class="actions"><span class="themepick" role="group" aria-label="Ciparnīca">${CP.WATCH_FACES.map(([k, l]) => `<button type="button" data-act="watchFace" data-arg="${k}" class="${w.face === k ? 'on' : ''}" aria-pressed="${w.face === k}">${l}</button>`).join('')}</span></div>
        <span>Atgādināt par pauzi</span><div class="actions"><label class="check"><input type="checkbox" data-watch="remind" ${w.remind ? 'checked' : ''}> pēc</label><input type="number" class="w-num-in" min="10" max="180" step="5" data-watch="workMin" value="${w.workMin}" aria-label="Minūtes līdz pauzei"> <span class="small muted">min darba, pauze</span><input type="number" class="w-num-in" min="1" max="30" data-watch="breakMin" value="${w.breakMin}" aria-label="Pauzes minūtes"> <span class="small muted">min, atkārtot pēc</span><input type="number" class="w-num-in" min="1" max="60" data-watch="snoozeMin" value="${w.snoozeMin}" aria-label="Atkārtot pēc minūtēm"> <span class="small muted">min</span></div>
        <span>Liels pulkstenis</span><div class="actions"><label class="check"><input type="checkbox" data-watch="idle" ${w.idle ? 'checked' : ''}> parādīt virs rīka, ja nav darbības</label><input type="number" class="w-num-in" min="1" max="60" data-watch="idleMin" value="${w.idleMin}" aria-label="Minūtes bez darbības"> <span class="small muted">min</span><button type="button" class="sm" data-act="watchBig">Parādīt tagad</button></div>
        <span>Skaņa</span><div class="actions"><label class="check"><input type="checkbox" data-watch="sound" ${w.sound ? 'checked' : ''}> signāls, kad beidzas taimeris vai pauze</label><button type="button" class="sm ghost" data-act="watchTestBeep">Pārbaudīt</button></div>
      </div><p class="small muted" style="margin:12px 0 0">Lielais pulkstenis paslēpj arī personu datus, kamēr dators stāv bez uzraudzības.</p></section>`; })() : ''}
      <section class="card"><h3>Datu glabāšana</h3>
        ${ui.dl([['Datu mape', S.rootName || 'nav izvēlēta'], ['Datu fails', CP.DATAFILE], ['JSON kopijas', 'mape _rezerves, ar datumu un laiku (netiek dzēstas)'], ['Pēdējā saglabāšana', U.fmtDateTime(S.db.updatedAt) || '—']])}
        <div class="actions" style="margin-top:12px"><button data-act="pickRoot">📁 Mainīt datu mapi</button><button data-act="backupNow">Izveidot JSON kopiju</button><button data-act="backup">⬇ Lejupielādēt JSON</button><button data-act="exportCsv">⬇ Personas CSV</button><button data-act="createYear">Izveidot ${U.schoolYear()} mapes</button></div>
        ${ui.rootDrop()}
        ${CP.WEB ? `<div class="actions" style="margin-top:10px">${CP.installPrompt ? '<button data-act="installApp">⬇ Instalēt kā lietotni</button>' : ''}<span class="small muted">Dati glabājas tikai tavā datu mapē.</span></div>` : ''}
        <details class="small" style="margin-top:8px"><summary>Mapes piekļuves diagnostika</summary>${(() => { const g = CP.store.diag || {}, l = g.last; return ui.dl([['Protokols', g.protocol], ['Programmas atrašanās', g.host === '(lokāls)' ? 'lokāls ceļš ✓' : 'tīkla ceļš \\\\' + g.host + ' ⚠'], ['Drošs konteksts', String(g.secure)], ['Mapes dialogs', g.picker === 'function' ? 'pieejams' : 'nav'], ['Ievilkšana', g.dropHandle === 'function' ? 'pieejama' : 'nav'], ['Pēdējais notikums', l ? `${l.at} · ${l.via} → ${l.step}${l.ms != null ? ' (' + l.ms + ' ms)' : ''}${l.error ? ' · ' + l.error : ''}` : '—']]); })()}</details>
        <label class="check" style="margin-top:12px"><input type="checkbox" data-set="autosave" ${s.autosave ? 'checked' : ''}> Saglabāt automātiski pēc katras izmaiņas</label>
        <p class="muted small">JSON kopija satur datubāzi, nevis dokumentu failus. Tā netiek saukta par pilnu arhīvu.</p>
        <h4>Rezerves kopijas</h4>
        <div id="backupList"><p class="muted small">Ielādē sarakstu…</p></div>
        <h4>Datu arhīvs</h4>
        <p class="small">Arhīvs mapē <b>_arhivi</b> ietver JSON un reģistrētos failus no pamatmapes. Ārējo mapju faili tiek kopēti tikai ar tavu piekrišanu. Ja kāds fails netiek iekļauts, arhīvs ir daļējs.</p>
        <div class="actions"><button data-act="makeArchive">Izveidot datu arhīvu</button></div>
        <div id="archiveList"></div>
        <h4>Papildu dokumentu mapes</h4>
        <div id="sourceList"></div></section>

      ${CP.encBackup ? CP.encBackup.card() : ''}
      <section class="card"><h3>Mācību gadi</h3>
        <p class="small">Aktīvais gads: <b>${esc(U.yearLabel(S.db.settings.activeYear))}</b>. Gadu maiņa nepārvieto personas, dokumentus un ekipējumu. Viena persona ir viens profils, un katram gadam ir savs dalības ieraksts.</p>
        ${(S.db.years || []).map(y => `<div class="row"><div class="grow"><b>${esc(U.yearLabel(y.id))}</b> <small class="muted">${(S.db.enrollments || []).filter(e => e.yearId === y.id).length} dalības</small>${y.id === S.db.settings.activeYear ? ' <span class="tag">izvēlēts</span>' : ''}${y.id === U.schoolYear() ? ' <span class="tag">pašreizējais</span>' : ''}</div><button class="sm" data-act="setYear" data-arg="${esc(y.id)}">Atvērt</button></div>`).join('')}
        <div class="actions" style="margin-top:10px"><button class="mainbtn sm" data-act="openAddYear">＋ Pievienot mācību gadu</button><button class="sm" data-act="openMove">Pārcelt personas</button><button class="sm" data-act="ensureFolders">Izveidot gada mapes</button></div>
        <p class="muted small">Mapē Macibu_gadi katram gadam ir Dokumenti, Pasakumi un Atskaites. Esošie personu dokumenti netiek pārvietoti.</p></section>

      <section class="card"><h3>Datu aizsardzība</h3>
        <p class="small">Dati glabājas tikai šajā datorā, vienkāršā JSON failā <b>bez šifrēšanas</b>. Aizsardzību nodrošina datora lietotāja konts un mapes tiesības — neglabā datu mapi publiski koplietotā vietā. Personas kodi saskarnē tiek maskēti, CSV eksportā netiek iekļauti, un saitēs uz ārējiem rīkiem netiek nodoti.</p>
        <div class="fieldgrid"><div class="field"><label>Noklusētais glabāšanas termiņš pēc izstāšanās (mēn.)</label><input type="number" min="0" max="1200" data-set="retentionDefault" value="${esc(s.retentionDefault)}"></div></div>
        <p class="muted small">Pēc termiņa beigām sistēma atgādina pārskatīt datus. Dzēšana notiek tikai manuāli (kartiņā → ⋯ → Dzēst neatgriezeniski).</p></section>

      <section class="card"><h3>Dokumenti</h3><div class="fieldgrid">
        <div class="field wide"><label>Dokumentu kategorijas (ar komatu)</label><input data-set="docKinds" value="${esc(s.docKinds.join(', '))}"></div>
        <div class="field wide"><label>Obligātie dokumenti katrai personai (ar komatu)</label><input data-set="requiredDocs" value="${esc(s.requiredDocs.join(', '))}"></div>
        <div class="field wide"><label>Atgādināt, ja persona nav atzīmēta kā ievadīta</label><div class="actions">${CP.REGS.map(r => `<label class="check"><input type="checkbox" data-reg-set="${r.k}" ${(s.registries || []).includes(r.k) ? 'checked' : ''}> ${esc(r.l)}</label>`).join('')}</div></div></div></section>

      <section class="card"><h3>Anketu nolasīšana</h3><div class="fieldgrid">
        <div class="field"><label>Atpazīšanas dzinējs</label><select data-ocr="engine">
          <option value="tesseract" ${o.engine === 'tesseract' ? 'selected' : ''}>Lokāli datorā (drukāts teksts)</option>
          <option value="google" ${o.engine === 'google' ? 'selected' : ''}>Google Cloud Vision (arī rokraksts)</option></select></div>
        <div class="field"><label>Atpazīšanas ticamības atzīme (%)</label><input type="number" min="30" max="95" data-ocr="minConf" value="${esc(o.minConf)}"><div class="hint muted">Zonas teksts nonāk pārbaudes logā un kartītē tikai pēc apstiprinājuma.</div></div>
        ${o.engine === 'google' ? `<div class="field wide"><label>Google Cloud Vision API atslēga</label><input type="password" data-ocr="googleKey" value="${esc(o.googleKey)}" autocomplete="off">
          <div class="hint warn">Izvēloties šo dzinēju, anketas attēls (ar personas datiem) tiek nosūtīts Google serverim. Pirms lietošanas pārliecinies, ka organizācijai ir tiesisks pamats un līgums ar Google par datu apstrādi.</div></div>` : ''}
        <label class="check wide"><input type="checkbox" data-ocr="enhance" ${o.enhance ? 'checked' : ''}> Uzlabot attēlu pirms atpazīšanas (kontrasts, ēnu izlīdzināšana)</label></div>
        <h4>Dokumentu nolasīšanas veidnes</h4>
        <div class="actions" style="margin:8px 0">
          <button type="button" class="mainbtn sm" data-act="tplCreate">＋ Jauna veidne</button>
          <button type="button" class="sm" data-act="tplExport">Eksportēt JSON</button>
          <label class="btn sm">Importēt JSON<input id="tplImport" type="file" accept="application/json,.json" hidden></label>
        </div>
        ${s.formTemplates.length ? s.formTemplates.map(t => `<div class="row"><div class="grow"><b>${esc(t.name)}</b> <small class="muted">${t.zones.length} zonas</small>${s.activeTemplate === t.id ? ' <span class="tag">pēdējā lietotā</span>' : ''}</div><button class="sm" data-act="tplEdit" data-arg="${t.id}">Rediģēt</button><button class="sm" data-act="tplDup" data-arg="${t.id}">Dublēt</button><button class="sm ghost" data-act="tplDelete" data-arg="${t.id}">Dzēst</button></div>`).join('') : '<p class="muted small">Nav veidņu. Izveido pirmo: augšupielādē skenētas anketas paraugu un iezīmē zonas.</p>'}
        <p class="muted small">Bez veidnes lauki tiek atrasti automātiski pēc anketas etiķetēm (Word, eDoc un PDF ar tekstu — precīzi; skenējumi — ar izvēlēto dzinēju). Veidne glabā tikai zonu vietas lapas daļās, nevis dokumenta attēlu vai personas datus.</p></section>

      <section class="card"><h3>Saziņa</h3><div class="fieldgrid">
        <div class="field"><label>Valsts kods 8 ciparu numuriem</label><input data-set="countryCode" value="${esc(s.countryCode)}"></div>
        <div class="field"><label>WhatsApp atvērt</label><select data-set="waMode"><option value="web" ${s.waMode === 'web' ? 'selected' : ''}>Caur wa.me (lietotne vai WhatsApp Web)</option><option value="app" ${s.waMode === 'app' ? 'selected' : ''}>Tieši WhatsApp Desktop lietotnē</option></select></div></div>
        <div class="fieldgrid" style="margin-top:10px"><div class="field"><label>Organizācija telefona kontaktos</label><input data-set="contactOrg" value="${esc(s.contactOrg || 'Jaunsardze')}"><div class="hint muted">Kontaktiem tiek pievienots “Uzņēmums” un grupa, lai tos telefonā var atrast.</div></div>
          <div class="field"><label>Google etiķete jaunsargiem</label><input data-set="labelYouth" value="${esc(s.labelYouth || 'Jaunsardze – jaunsargi')}"></div>
          <div class="field"><label>Google etiķete vecākiem</label><input data-set="labelParents" value="${esc(s.labelParents || 'Jaunsardze – vecāki')}"></div></div>
        <h4>Ziņu veidnes</h4>
        ${s.templates.map((t, i) => `<div class="tplrow"><input data-tpl="${i}:name" value="${esc(t.name)}"><textarea data-tpl="${i}:text" rows="3">${esc(t.text)}</textarea><button class="sm ghost" data-act="delTpl" data-arg="${i}" title="Dzēst">✕</button></div>`).join('')}
        <button class="sm" data-act="addTpl">＋ Jauna veidne</button>
        <p class="muted small">Vietturi: {saņēmējs} {vārds} {uzvārds} {pilns} {grupa} {vecāks} {datums} {trūkst} {ekipējums}</p></section>

      <section class="card"><h3>Ārējie rīki kartiņā</h3>
        <p class="muted small">Saites, kas parādās personas kartiņā. Saitē var izmantot {vārds} {uzvārds} {pilns} {tālrunis} {epasts} {grupa} {klase} {skola}. Personas kods un adrese netiek nodoti.</p>
        ${s.tools.map((t, i) => `<div class="inline-form"><input data-tool="${i}:name" value="${esc(t.name)}" placeholder="Nosaukums" style="max-width:180px"><input data-tool="${i}:url" value="${esc(t.url)}" placeholder="https://…"><button class="sm ghost" data-act="delTool" data-arg="${i}">✕</button></div>`).join('')}
        <button class="sm" data-act="addTool">＋ Pievienot rīku</button>
        <p class="muted small" style="margin-top:10px"><b>E-klase:</b> skolēnu personas datus var pārņemt ar e-klases eksporta palīgu: <b>⬆ Imports → No e-klases</b>. Tur ir soli pa solim instrukcija.</p></section></div>`;
    }
  };

  CP.changeHandlers.push(e => {
    const t = e.target, d = t.dataset, s = S.db.settings;
    if (d.set) {
      if (d.set === 'autosave') s.autosave = t.checked;
      else if (d.set === 'docKinds' || d.set === 'requiredDocs') { s[d.set] = t.value.split(',').map(x => x.trim()).filter(Boolean); if (!s.docKinds.length) s.docKinds = CP.defaultSettings().docKinds; }
      else if (d.set === 'retentionDefault') s.retentionDefault = Number(t.value || 12);
      else s[d.set] = t.value.trim();
      CP.store.changed(); return true;
    }
    if (d.regSet) { const set = new Set(s.registries || []); t.checked ? set.add(d.regSet) : set.delete(d.regSet); s.registries = CP.REGS.map(r => r.k).filter(k => set.has(k)); CP.store.changed(); return true; }
    if (d.ocr) { s.ocr[d.ocr] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) : t.value.trim(); CP.store.changed(); return true; }
    if (d.tpl) { const [i, k] = d.tpl.split(':'); s.templates[i][k] = t.value; CP.store.changed({ silent: true }); return true; }
    if (d.tool) { const [i, k] = d.tool.split(':'); s.tools[i][k] = t.value.trim(); CP.store.changed({ silent: true }); return true; }
    if (t.id === 'tplImport') {
      const file = t.files?.[0]; t.value = '';
      if (file) file.text().then(txt => {
        let data; try { data = JSON.parse(txt); } catch { ui.toast('JSON nav nolasāms', 'err'); return; }
        const arr = Array.isArray(data) ? data : data?.formTemplates;
        if (!Array.isArray(arr)) { ui.toast('Failā nav veidņu saraksta', 'warn'); return; }
        const clean = arr.map(x => CP.scan.normalizeTemplate(x)).filter(Boolean);
        if (!clean.length) { ui.toast('Nav derīgu veidņu. Jānorāda nosaukums, lauks un zonas koordinātas no 0 līdz 1.', 'warn'); return; }
        const have = new Set(s.formTemplates.map(x => x.id));
        for (const tpl of clean) { if (have.has(tpl.id)) tpl.id = U.uid(); s.formTemplates.push(tpl); }
        CP.store.changed(); ui.toast(`Importētas ${clean.length} veidnes`, 'ok');
      }).catch(e => ui.toast(e.message, 'err'));
      return true;
    }
    return false;
  });
  A.addTpl = () => { S.db.settings.templates.push({ name: 'Jauna veidne', text: 'Labdien, {saņēmējs}!\n' }); CP.store.changed(); };
  A.delTpl = i => { const t = S.db.settings.templates; if (t.length < 2) return ui.toast('Jāpaliek vismaz vienai veidnei', 'warn'); if (confirm('Dzēst ziņas veidni “' + t[i].name + '”?')) { t.splice(Number(i), 1); S.comms.tpl = 0; CP.store.changed(); } };
  A.addTool = () => { S.db.settings.tools.push({ name: '', url: 'https://' }); CP.store.changed(); };
  A.delTool = i => { S.db.settings.tools.splice(Number(i), 1); CP.store.changed(); };
  A.tplCreate = () => CP.scan.openEditor();
  A.tplEdit = id => CP.scan.openEditor(id);
  A.tplDup = id => {
    const s = S.db.settings, t = s.formTemplates.find(x => x.id === id); if (!t) return;
    const copy = CP.scan.normalizeTemplate({ ...JSON.parse(JSON.stringify(t)), id: U.uid(), name: t.name + ' (kopija)', createdAt: U.now() });
    if (!copy) return ui.toast('Veidni neizdevās dublēt', 'warn');
    copy.zones.forEach(z => { z.id = U.uid(); });
    s.formTemplates.push(copy); CP.store.changed();
  };
  A.tplExport = () => {
    const data = S.db.settings.formTemplates.map(t => CP.scan.normalizeTemplate(t)).filter(Boolean);
    if (!data.length) return ui.toast('Nav veidņu, ko eksportēt', 'warn');
    U.download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'dokumentu-veidnes.json');
  };
  A.tplDelete = id => {
    const s = S.db.settings, t = s.formTemplates.find(x => x.id === id); if (!t || !confirm(`Dzēst veidni “${t.name}”?`)) return;
    s.formTemplates = s.formTemplates.filter(x => x.id !== id); if (s.activeTemplate === id) s.activeTemplate = ''; CP.store.changed();
  };
  CP.pages.settings.after = async () => {
    const box = U.$('backupList'), arch = U.$('archiveList'), src = U.$('sourceList');
    if (!box) return;
    if (!S.root) {
      box.innerHTML = '<p class="muted small">Izvēlies datu mapi, lai redzētu kopijas.</p>';
      if (arch) arch.innerHTML = '';
      if (src) src.innerHTML = '<p class="muted small">Papildu mapes tiek saglabātas kopā ar datu failu.</p>';
      return;
    }
    try {
      const list = await CP.store.listBackups();
      box.innerHTML = list.length ? list.map(b => `<div class="row"><div class="grow"><b>${esc(b.name)}</b><div class="small muted">${U.fmtDateTime(new Date(b.modified).toISOString())} · ${Math.ceil(b.size / 1024)} KB · JSON, bez dokumentu failiem</div></div><button class="sm" data-act="verifyBackup" data-arg="${esc(b.name)}">Pārbaudīt</button><button class="sm" data-act="restoreBackup" data-arg="${esc(b.name)}">Atjaunot</button></div>`).join('') : '<p class="muted small">Vēl nav kopiju. Pirmā automātiskā kopija parādās līdz ar dienas pirmo saglabāšanu.</p>';
    } catch (e) { box.innerHTML = `<p class="warn">Kopiju sarakstu neizdevās nolasīt: ${esc(e.message)}</p>`; }
    try {
      const list = await CP.store.listArchives();
      if (arch) arch.innerHTML = list.length ? list.map(a => {
        const m = a.manifest;
        const full = m?.pilns === true;
        const label = !m ? 'Manifests nav nolasāms' : full ? 'Pilns reģistrēto dokumentu arhīvs' : 'Daļējs arhīvs — nav visi dokumenti';
        const left = m?.navIeklauti?.length ? `<div class="small warn">Nav iekļauti: ${m.navIeklauti.slice(0, 6).map(f => esc(f.path) + (f.reason ? ' (' + esc(f.reason) + ')' : '')).join('; ')}${m.navIeklauti.length > 6 ? '…' : ''}</div>` : '';
        return `<div class="row"><div class="grow"><b>${esc(a.name)}</b><div class="small">${esc(label)}</div>${a.error ? `<div class="small warn">${esc(a.error)}</div>` : ''}${left}</div></div>`;
      }).join('') : '<p class="muted small">Vēl nav datu arhīvu.</p>';
    } catch (e) { if (arch) arch.innerHTML = `<p class="warn">Arhīvu sarakstu neizdevās nolasīt: ${esc(e.message)}</p>`; }
    if (src) {
      const rows = S.db.sources || [];
      src.innerHTML = rows.length ? rows.map(s => {
        const r = S.roots.find(x => x.id === s.id);
        const ok = !!r?.ok;
        return `<div class="row"><div class="grow"><b>${esc(s.name)}</b><div class="small muted">${esc(s.id)}</div></div><span class="pill ${ok ? 'ok' : 'bad'}">${ok ? 'Pieslēgta' : 'Nav piekļuves'}</span><button class="sm" data-act="reconnectSource" data-arg="${esc(s.id)}">Pieslēgt atkārtoti</button></div>`;
      }).join('') : '<p class="muted small">Nav papildu mapju. Dokumentos spied “Papildu mape”.</p>';
    }
  };
  A.backupNow = () => CP.store.backupNow();
  A.verifyBackup = async name => {
    try {
      const r = await CP.store.verifyBackup(name);
      ui.toast(r.ok ? `Kopija derīga: ${r.people} personas, ${r.documents} dokumenti, datu versija ${r.version}.` : 'Kopija nav derīga: ' + r.error, r.ok ? 'ok' : 'err', 9000);
    } catch (e) { ui.toast('Pārbaudi neizdevās: ' + e.message, 'err'); }
  };
  A.restoreBackup = name => CP.store.restoreBackup(name);
  A.makeArchive = async () => {
    const ext = S.db.documents.filter(d => d.path && d.sourceId && d.sourceId !== 'main' && !String(d.sourceId).startsWith('fails:'));
    let copyExternal = false;
    if (ext.length) copyExternal = confirm(`Reģistrēti ${ext.length} dokumenti ārējās mapēs.\n\nIekopēt arī tos? Bez piekrišanas tie paliks tikai sarakstā, un arhīvs netiks saukts par pilnu.`);
    try { await CP.store.createArchive({ copyExternal }); CP.render(); }
    catch (e) { ui.toast('Arhīvu neizdevās izveidot: ' + e.message, 'err', 12000); }
  };
  A.reconnectSource = id => CP.store.reconnectSource(id);
  A.pickRoot = () => CP.store.pickRoot();
  A.setTheme = v => { CP.theme.set(v); CP.render(); };
  A.watchTestBeep = () => CP.watchBeep?.(2);
  CP.changeHandlers.push(e => {
    const k = e.target.dataset?.watch; if (!k) return false;
    if (!e.target.isConnected) return true;
    const v = e.target.type === 'checkbox' ? e.target.checked : Math.max(Number(e.target.min) || 1, Math.min(Number(e.target.max) || 999, Number(e.target.value) || 0));
    if (CP.watchPrefs()[k] === v) return true;
    setTimeout(() => { CP.setWatchPref(k, v); CP.render(); }, 0);   // pēc notikuma — lai lapas pārzīmēšana netraucē fokusa notikumiem
    return true;
  });
  A.setAccent = v => { CP.theme.setAccent(v); CP.render(); };
  CP.inputHandlers.push(e => { if (e.target.id !== 'accentPick') return false; CP.theme.setAccent(e.target.value); return true; });   // dzīvs priekšskatījums
  CP.changeHandlers.push(e => { if (e.target.id !== 'accentPick') return false; CP.theme.setAccent(e.target.value); CP.render(); return true; });
  A.restoreRoot = () => CP.store.restoreRoot();
  A.retryRestore = () => CP.store.retryRestore();
  A.bootNew = () => CP.store.bootNew();
  A.createYear = () => CP.store.createYear();
  A.save = () => CP.store.save(false);
})(window.CP);


/* ==== js/about.js ==== */
/* =====================================================================
   Par rīku — kam tas paredzēts, kā sākt, kur glabājas dati, izstrādātājs.
   ===================================================================== */
(function (CP) {
  'use strict';
  const S = CP.state, ui = CP.ui, esc = CP.util.esc;
  const ic = (n, f = '') => CP.ic(n, f);

  const STEPS = [
    ['Atver rīku', 'Google Chrome vai Microsoft Edge pārlūkā atver <b>cadet-tools.github.io/PSVS</b>. Ja vēlies, Chrome adreses joslā spied “Instalēt”. Tad rīkam būs savs logs un ikona, un tas strādās arī bez interneta.'],
    ['Izveido datu mapi', 'Datorā izveido tukšu mapi, piemēram, <i>Dokumenti\\CADET PERSONALS</i>, vai mapi uz šifrētas zibatmiņas. Tajā glabāsies uzskaites fails, personu dokumenti un rezerves kopijas.'],
    ['Pieslēdz mapi', 'Pārskatā spied <b>Izvēlēties datu mapi</b> vai ievelc mapi no File Explorer. Ja Chrome jautā, atļauj rediģēt failus. Nākamreiz rīks mapi atcerēsies pats.'],
    ['Iestati rīku', 'Iestatījumos pārbaudi mācību gadu, obligātos dokumentus, ziņu veidnes un valsts kodu tālruņiem. Tur var izvēlēties arī tēmu un akcenta krāsu.'],
    ['Pievieno jauniešus', 'Personas pievieno ar <b>Jauna persona</b>, no anketas (<b>Ievadīt no anketas</b>: Word, PDF, eDoc vai skenējums) ar <b>Imports</b> no Excel faila vai no e-klases ar eksporta palīgu (<b>Imports → No e-klases</b>, instrukcija ir turpat). Grupu var piespraust ar 📌, lai tā nebūtu jāraksta katru reizi.'],
    ['Pievieno dokumentus', 'Personas kartītē pievieno anketas, līgumus, ārsta izziņas un MTL aprites lapas. Faili tiek nokopēti personas mapē, un tos var atvērt tieši no kartītes.'],
    ['Strādā ikdienā', 'Ekipējuma izsniegšana un atdošana, jaunsarga apliecības, ziņas WhatsApp, SMS vai e-pastā (arī visai grupai) un kontakti telefonā ar vecāku numuriem. Viss, kas prasa uzmanību, parādās sadaļā <b>Uzdevumi</b> un paziņojumos, atverot rīku.'],
    ['Rūpējies par kopijām', 'Rīks pats veido ikdienas JSON kopijas mapē <i>_rezerves</i>. Turi datu mapes otru kopiju citā vietā (otrā zibatmiņā vai drošā mapē) un atjauno to regulāri.']
  ];
  const FEATURES = [
    ['users', 'Personu reģistrs', 'Kartītes ar visiem datiem, vecākiem, saistībām, statusiem un vēsturi pa mācību gadiem.'],
    ['scan', 'Anketu nolasīšana', 'Lauki tiek aizpildīti no Word, PDF un eDoc anketām, arī no skenējumiem un fotogrāfijām. Var izmantot savas veidnes.'],
    ['file', 'Dokumenti', 'Obligāto dokumentu kontrole, derīguma termiņi un faili personas mapē.'],
    ['backpack', 'Ekipējums un MTL', 'Izsniegts, atdots, izmēri, daudzums un atgādinājums atjaunot MTL aprites lapu.'],
    ['idcard', 'Jaunsarga apliecības', 'Numuri, statusi, derīgums un brīdinājumi par dublikātiem.'],
    ['message', 'Saziņa', 'WhatsApp, SMS, e-pasts un zvans no kartītes, ziņas grupai un kontakti uz telefonu ar QR kodu.'],
    ['bell', 'Atgādinājumi', 'Trūkstošie dokumenti, termiņi, vecuma izmaiņas, sakrītoši tālruņi un uzdevumi.'],
    ['shield', 'Dati pie tevis', 'Nekas netiek sūtīts uz serveri. Dati glabājas tikai tavā izvēlētajā mapē.']
  ];

  CP.pages.about = {
    render() {
      return `<div class="page narrow about">${ui.backBtn()}
        <section class="card about-hero">
          <img class="about-logo" src="PS_LOGO.png" alt="">
          <div><h1>CADET PERSONĀLS</h1>
            <p class="about-lead">Jaunsardzes instruktora darba rīks: jauniešu uzskaite, dokumenti, ekipējums un saziņa vienuviet, bez mapju meklēšanas.</p>
            <p class="muted small">Versija ${esc(CP.VERSION)}</p></div>
        </section>

        <div class="about-grid">
          <section class="card"><h3>${ic('users')}Kam paredzēts</h3>
            <p>Jaunsardzes instruktoriem un vienību vadītājiem, kuri strādā ar jauniešu grupām. Rīks palīdz:</p>
            <ul class="about-list"><li>uzturēt kārtībā jaunsargu un viņu vecāku datus;</li><li>redzēt, kuriem trūkst dokumentu vai jāatdod ekipējums;</li><li>ātri sazināties ar jaunieti vai vecākiem;</li><li>sagatavot jaunu mācību gadu, nepazaudējot vēsturi.</li></ul>
          </section>
          <section class="card"><h3>${ic('shield')}Kur glabājas dati</h3>
            <p>Tikai tavā datorā vai zibatmiņā, mapē, kuru izvēlies pats. Uz serveriem nekas netiek sūtīts, un citi lietotāji tavus datus neredz.</p>
            <p class="muted small">Izņēmums: ja Iestatījumos ieslēdz Google Vision rokraksta atpazīšanu, anketas attēls tiek nosūtīts Google. Pēc noklusējuma tā ir izslēgta.</p>
          </section>
        </div>

        <section class="card"><h3>${ic('task')}Kā sākt lietot</h3>
          <ol class="steps">${STEPS.map(([t, d]) => `<li><b>${t}</b><p>${d}</p></li>`).join('')}</ol>
          <div class="actions" style="margin-top:6px">${!S.root ? `<button class="mainbtn" data-act="pickRoot">${ic('folder', '📁')} Izvēlēties datu mapi</button>` : ''}<button data-page="settings">${ic('sliders')} Atvērt iestatījumus</button></div>
        </section>

        <section class="card"><h3>${ic('grid')}Ko rīks prot</h3>
          <div class="feat">${FEATURES.map(([i, t, d]) => `<div class="feat-item"><span class="feat-ic">${ic(i)}</span><div><b>${t}</b><p>${d}</p></div></div>`).join('')}</div>
        </section>

        <section class="card"><h3>${ic('bell')}Atjauninājumu žurnāls</h3><div class="news">${CP.news ? CP.news.list.slice(0, 3).map(n => `<section class="news-item"><h4>${CP.util.esc(n.title)} <small class="muted">${CP.util.esc(n.from ? n.from + '–' + n.v : n.v)} · ${CP.util.esc(CP.util.fmtDate(n.date))}</small></h4><ul>${n.items.map(i => `<li>${CP.util.esc(i).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</li>`).join('')}</ul></section>`).join('') : ''}</div>
          <div class="actions"><button class="sm" data-act="newsAll">Visi atjauninājumi</button></div></section>
        <section class="card about-dev"><h3>${ic('userCheck')}Izstrādātājs</h3><p><b>Jānis Eglis</b></p></section>
      </div>`;
    }
  };
})(window.CP);


/* ==== js/whatsnew.js ==== */
/* =====================================================================
   Jaunumi — atjauninājumu žurnāls lietotājam.
   Pēc atjauninājuma, pirmo reizi atverot rīku, tiek parādīti jaunumi kopš
   iepriekš redzētās versijas. Pilns saraksts: “Par rīku” → Atjauninājumu žurnāls.
   Jauns ieraksts → saraksta SĀKUMĀ (jaunākais pirmais).
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, esc = U.esc;
  /* Bloki pa lielām funkcijām (lietotāja skatījumā). v — jaunākā bloka versija, from — pirmā.
     Jaunumu logā tiek rādīti bloki, kuru v ir jaunāka par iepriekš redzēto versiju. */
  const NEWS = [
    { v: '1.30.0', date: '2026-10-16', title: 'Jauna sadaļa “Ziņot”', items: [
      'Kreisajā izvēlnē ir jauna sadaļa **“⚑ Ziņot”**. Tur var nosūtīt rīka izstrādātājam **kļūdu, ieteikumu, atsauksmi vai jautājumu**.',
      'Izvēlies tēmu, īsi uzraksti, par ko ir ziņojums, un apraksti situāciju. Teksts saglabājas, arī ja lapu aizver.',
      '**Ekrānuzņēmumi:** ievelc attēlu, ielīmē ar **Ctrl+V** (Windows: **Win+Shift+S** izgriež ekrāna daļu) vai spied **“📷 Uzņemt rīka ekrānu”**. Ar pēdējo atver vajadzīgo vietu rīkā un spied “Uzņemt” vai “Pēc 5 s”.',
      '🔒 **Personu datus attēlā var aizklāt:** spied **“✎ Aizklāt”** un ar peli pārvelc pāri vārdiem un personas kodiem. Nosūtīts tiek tikai aizklātais attēls. Ja attēlā nekas nav aizklāts, rīks pirms sūtīšanas pajautā.',
      'Pēc izvēles: tavs vārds un kontakts atbildei, kā arī tehniskā informācija (versija, pārlūks, lapa, pēdējās kļūdas), kas palīdz kļūdu atrast ātrāk.',
      'Ja nav interneta, ziņojumu var **saglabāt failā** un nosūtīt citādi.'
    ] },
    { v: '1.29.0', date: '2026-10-16', title: 'Rezerves kopija tieši Google Drive', items: [
      'Šifrēto rezerves kopiju tagad var glabāt **tieši Google Drive**: rīks pieslēdzas tavam Google kontam. **Nekas nav jāinstalē**, un datorā nav vajadzīga Google Drive programma vai papildu mape.',
      'Iestatīšana: **Iestatījumi → Šifrētā rezerves kopija → Iestatīt** → izvēlies **“☁ Google Drive”**. Vajag to pašu **Google Client ID**, kas kalendāram. Google projektā papildus jāieslēdz **Google Drive API** (palīgā “? Kā iegūt” tas ir 2. solis).',
      'Kopija tiek **šifrēta tavā datorā** un tikai tad nosūtīta. Google redz tikai nesalasāmus failus. Rīks Google Drive redz **tikai savu mapi CADET_rezerve**, nevis citus tavus failus.',
      'Google savienojums ir derīgs apmēram **1 stundu**. Kad tas beidzies un ir nenosūtītas izmaiņas, **augšā parādās josla** ar pogu **“Pieslēgties”**: viens klikšķis, un kopija aiziet uzreiz. Tā pati pieslēgšanās der arī **Google kalendāram**.',
      '**Jauns vai pazaudēts dators:** sākuma lapā **“🔐 Atjaunot no šifrētās kopijas” → “☁ Google Drive”**, ievadi Client ID (tas ir uz izdrukātās atkopšanas koda lapas), pieslēdzies Google, ievadi paroli vai atkopšanas kodu un izvēlies tukšu mapi.',
      'Kopija mapē datorā vai zibatmiņā strādā tāpat kā līdz šim. Tavi esošie iestatījumi netiek mainīti.'
    ] },
    { v: '1.28.0', date: '2026-10-16', title: 'Šifrētā rezerves kopija (piem., Google Drive)', items: [
      '**Iestatījumos** ir jauna sadaļa **“Šifrētā rezerves kopija”**. Viss datu mapes saturs (personas, dokumenti, veidlapas, veidnes, arī papildu mapju dokumenti) tiek saglabāts **šifrētā veidā** citā mapē, piem., **Google Drive** mapē datorā. Darba mapes faili netiek mainīti.',
      'Kopija tiek **papildināta automātiski**, kamēr rīks ir atvērts: tikai jaunie un mainītie faili. Pogu **“Izveidot kopiju tagad”** var spiest jebkurā brīdī. Ja kopija ilgi nav atjaunota, parādās brīdinājums.',
      'Ja aizmirsi paroli: **paroles mājiens**, **atkopšanas kods** (izdrukā un glabā drošā vietā) un iespēja **savā datorā nomainīt paroli bez vecās**.',
      '**Pazaudēts vai jauns dators:** sākuma lapā spied **“🔐 Atjaunot no šifrētās kopijas”**, ievadi paroli vai atkopšanas kodu un izvēlies tukšu mapi. Viss tiek atjaunots tieši tāds pats, katrs fails pārbaudīts ar kontrolsummu.',
      'Kopijas mapē ir arī **ATJAUNOT.html**: ar to var atšifrēt kopiju pat bez rīka.',
      'Google un citi neredz neko: ne vārdus, ne failu nosaukumus. Šifrēšana: AES-256.'
    ] },
    { v: '1.27.1', from: '1.27.0', date: '2026-10-16', title: 'Dalībnieki no citām vienībām', items: [
      'Instruktāžas lapā un nometnes žurnālā var iekļaut **jaunsargus no citām vienībām**. Pasākuma logā ir jauna sadaļa **“Dalībnieki no citām vienībām”**: ievelc tajā otra instruktora atsūtīto failu, un viņa jaunsargi (un nometnei arī darbinieki) nonāk tavā dokumentā kopā ar taviem.',
      '**Ja otrs instruktors lieto CADET PERSONĀLS:** viņš savā pasākumā izvēlas savus dalībniekus un spiež **“⇪ Nosūtīt savus dalībniekus citam instruktoram”**. Failu var **aizsargāt ar paroli** (paroli pasaka atsevišķi, piem., piezvanot).',
      '**Ja rīka nav:** nosūti viņam **“⇩ Excel veidni”**. Viņš to aizpilda un atsūta atpakaļ, bet tu to ievelc tāpat. Der arī cits Excel vai CSV saraksts ar kolonnām Vārds, Uzvārds, Personas kods…',
      'Citu vienību jaunsargi **glabājas tikai šajā pasākumā**. Tie neparādās tavā personu sarakstā, pārskatā vai brīdinājumos. Ja kāds jau ir tavā sarakstā (tas pats personas kods), rīks izvēlas tavu ierakstu, bet atkārtots fails datus atjauno, nevis dublē.',
      'Sadaļa atrodas pasākuma loga **kreisajā pusē** zem pasākuma datiem, nevis zem garā jaunsargu saraksta.',
      'Rīks neko nesūta internetā. Failu instruktori nodod paši.',
      'Personu importā tagad atpazīst arī kolonnas **“Otrs vecāks”** un **“Otra vecāka tālrunis”**.'
    ] },
    { v: '1.26.3', from: '1.26.0', date: '2026-10-16', title: 'Sakārtota grupas izvēle un dzēšanas logs', items: [
      'Personas formā pie lauka **Grupa** poga **▾** atver rīka stila sarakstu tieši zem lauka. Tajā redzamas grupas ar personu skaitu, **“— bez grupas —”** un lauks **jaunai grupai** turpat sarakstā.',
      'Rakstot grupas laukā, saraksts **filtrējas**. Ja tādas grupas vēl nav, var spiest **“＋ Izveidot grupu …”**. Darbojas arī ar tastatūru: ↑↓ un Enter izvēlas, Esc aizver.',
      '**Grupas dzēšanas logā** ir divas skaidras izvēles: **“Pārcelt uz citu grupu”** ar grupas sarakstu un **“Atstāt bez grupas”**.',
      'Jauns noklusējuma izskats: **tumšā tēma ar zilu akcentu**. Ja krāsu jau esi izvēlējies pats (Iestatījumi → Izskats), tā paliek nemainīta.'
    ] },
    { v: '1.26.1', from: '1.26.0', date: '2026-10-16', title: 'Notikuma kartīte kalendārā', items: [
      'Klikšķis uz notikuma kalendārā tagad atver **kartīti tikai skatīšanai**: datums, laiks un ilgums, vieta, piezīmes, atgādinājumi, atkārtošanās un vai notikums ir importēts vai Google kalendārā. Nejauši neko izmainīt vairs nevar.',
      'Labot var ar pogu **✎ Labot** kartītē vai ar **✎** sarakstā. Kartītē ir arī **⧉ Kopēt** uz nākamo nedēļu.',
      'Tāpat kartīte atveras no pārskata “Grafiks — tuvākās 7 dienas”, stundu kopsavilkuma un atgādinājuma paziņojuma.'
    ] },
    { v: '1.26.0', from: '1.25.0', date: '2026-10-16', title: 'Grupu pārvaldība un līdzenāks pārskats', items: [
      'Pārskata kartītē **Grupas** ir poga **＋ Jauna grupa**, bet pie katras grupas pogas **✎ pārdēvēt** un **✕ dzēst**. Jaunu grupu var izveidot arī tad, ja tajā vēl nav personu.',
      'Jaunā grupa uzreiz parādās **visās izvēlnēs**: personas kartītē, sarakstu filtrā, apmeklējumā, saziņā, importā un pārcelšanā uz citu gadu.',
      'Personas formā pie lauka **Grupa** ir izvēlne **▾**: tajā ir visas grupas, **“— bez grupas —”** un **“＋ Jauna grupa…”**. Grupu joprojām var arī ierakstīt.',
      '**Dzēšot grupu, personas netiek dzēstas.** Tās var pārcelt uz citu grupu vai atstāt bez grupas. Iepriekšējo mācību gadu dalība netiek mainīta.',
      '**Pārdēvējot** vai ierakstot jau esošas grupas nosaukumu, grupas tiek **apvienotas**. Apmeklējuma atzīmes un nodarbību dienas pāriet līdzi. Visas izmaiņas redzamas personu vēsturē.',
      'Pārskatā kartītēm ir noteiktas vietas: **Grafiks un Grupas** pa kreisi, **Uzdevumi** vidū, **Trūkstošie dokumenti** pa labi. Kolonnas beidzas vienā līmenī, un atstarpe līdz “Pēdējām izmaiņām” ir vienāda, lai cik grupu būtu.',
      'Salabots: lapā **Veidlapas** (un citās lapās, kur platā kartīte ir augšā) kartītes vairs neuzklājas cita citai.'
    ] },
    { v: '1.24.1', from: '1.24.0', date: '2026-10-16', title: 'Sakārtots pārskats un ērtāks grafika imports', items: [
      '**Pārskata** kartītes tagad saliekas cieši cita zem citas kolonnās, bez tukšām starpām. Katra nākamā kartīte nonāk īsākajā kolonnā. Tas pats izkārtojums darbojas arī citās lapās ar kartītēm.',
      '**“Trūkstošie dokumenti”** un **“Uzdevumi un brīdinājumi”** rāda tik ierakstu, cik ietilpst līdz garākās kolonnas apakšai, pārējie ir zem **“… un vēl N →”**. Tā visu kolonnu apakšas ir līdzenas.',
      '**“Pēdējās izmaiņas”** stiepjas pa visu platumu zem visām kartītēm, divās kolonnās.',
      'Grafika pogai **Imports** ir uznirstošais logs: ievelc **darba plānošanas matricu** (darba uzskaites .xlsm vai .xlsx) laukumā vai spied **“Izvēlēties failu…”**. Logā īsi paskaidrots, kas notiks.'
    ] },
    { v: '1.23.3', from: '1.23.0', date: '2026-10-15', title: 'Kontaktstundas un datumi no piezīmēm', items: [
      'Importējot “Nodarbību saraksts”, rīks nolasa arī **datumus piezīmju kolonnā**: e-VAM **kontaktstundas** (piem., “08.,27.OKT”), **aizvietošanas** (“02.11. aizvieto …”) un mentorēšanas dienas. Tām tiek izmantots tās pašas rindas laiks un vieta.',
      'Ja piezīmē rakstīts **“nenotiek”** (piem., “nenotiek 16.11”), šis datums netiek ielikts kalendārā vai tiek no tā noņemts.',
      'Katrai dienai tiek pievienota tieši tās piezīme, bet vispārīgās piezīmes visām rindas nodarbībām.',
      'Jaunsargu grupu nodarbības tagad sauc **“Jaunsardzes nodarbība 2.4.”**. Jau importētās tiks pārdēvētas nākamajā importā (kā “mainīts”, nevis no jauna).',
      'Stundu kopsavilkumā rādītājs **“Kontaktstundas (nodarbības + VAM)”**.',
      '**Google kalendāra savienošana** pārveidota par 5 skaidriem soļiem. Katrā solī ir poga **↗ Atvērt**, kas uzreiz atver vajadzīgo Google lapu, un adresēm ir pogas **⧉ Kopēt**. Pēc katra soļa vari atzīmēt **“Izdarīts”**.',
      'Pēdējā solī Client ID var ielīmēt tieši instrukcijā un spiest **“Saglabāt un sinhronizēt”**. Rīks brīdina, ja nejauši ielīmēts Client secret.'
    ] },
    { v: '1.23.0', date: '2026-10-15', title: 'Darba grafiks no Excel uzskaites tabulas', items: [
      'Sadaļā **Grafiks** var **ievilkt** instruktora darba uzskaites Excel failu (**.xlsm** / .xlsx) vai izvēlēties to ar pogu **Imports**. Rīks pats saliek kalendāru.',
      'Tiek nolasīta lapa **“Darba plāns_secīgi”** (pasākumi, semināri, metodiskais darbs, prombūtne ar datumiem un laikiem) un lapa **“Nodarbību saraksts”** (regulārās nodarbības no mēnešu kolonnām, ar laiku un vietu). Slēptās palīglapas un tukšās rindas ar “0” tiek izlaistas.',
      'Veidi tiek noteikti automātiski: nodarbība, VAM nodarbība, pasākums, nometne, novada pārvaldes darbs, metodiskais darbs, prombūtne. Piezīmēs tiek ielikta grupa, vadītājs, atbalsta personāls un dalībnieku skaits.',
      '**Atkārtots imports:** ievelc atjaunoto failu vēlreiz. Pirms izmaiņām rīks parāda, kas ir **jauns**, kas **mainīts** (piem., laiks 14:00 → 15:00) un kas **failā vairs nav**. Katru izmaiņu var atķeksēt. Rīkā paša izveidotie notikumi netiek aiztikti.',
      'Pēc noklusējuma tiek importēti tikai **šodienas un nākamie** notikumi, pagājušos var pievienot ar ķeksīti. Atvaļinājumus var neimportēt.',
      'Ja Google kalendārs ir savienots, importa izmaiņas aiziet arī uz to. Fails netiek saglabāts un nekur nosūtīts: tiek nolasīti tikai grafika lauki.'
    ] },
    { v: '1.22.0', date: '2026-10-15', title: 'Grafiks: darba kalendārs ar atgādinājumiem un Google kalendāru', items: [
      'Jauna sadaļa **Grafiks** (📅 kreisajā joslā). Tas ir instruktora darba kalendārs: **nodarbības, VAM nodarbības, pasākumi, nometnes, sacensības, sapulces** un administratīvais darbs, katram veidam sava krāsa.',
      'Skati: **Mēnesis**, **Nedēļa** (pa stundām, ar sarkanu līniju “tagad”) un **Saraksts**. Klikšķis uz dienas vai stundas izveido notikumu, klikšķis uz notikuma to atver labošanai.',
      'Notikumam ir **datums, laiks no–līdz** (vai visa diena, arī vairākas dienas, piem., nometnei), vieta un piezīmes. **Atkārtot katru nedēļu** izveido visu sēriju uzreiz, un izmaiņas var piemērot arī nākamajiem sērijas notikumiem.',
      '**Atgādinājumi** (piem., 1 h un 1 dienu iepriekš) parādās rīkā un, ja atļauj, arī **uz darbvirsmas**. Pēc izvēles uz darbvirsmas reizi dienā parādās arī jaunie brīdinājumi par dokumentiem un kavējumiem.',
      '**Google kalendārs:** poga “Sinhronizēt ar Google” izveido atsevišķu kalendāru “Jaunsardze — darba grafiks” un tālāk pati atjauno izmaiņas, tāpēc grafiks un atgādinājumi ir redzami arī **telefonā**. Vienreizējai iestatīšanai ir instrukcija. Uz Google tiek sūtīti tikai notikumi, nevis personu dati.',
      'Bez Google iestatīšanas grafiku var lejupielādēt kā **kalendāra failu (.ics)**.',
      '**Stundu kopsavilkums** par mēnesi: plānotās stundas pa veidiem.',
      'Pārskatā ir jauna kartīte **“Grafiks — tuvākās 7 dienas”**. Poga **Imports** (darba grafiks no Excel) jau ir vietā; pati funkcija tiks pielāgota instruktoru uzskaites veidnei.'
    ] },
    { v: '1.21.1', from: '1.21.0', date: '2026-10-15', title: 'Apmeklējuma atzīmēšana ar tastatūru', items: [
      'Mēneša tabulā atzīmes var ievadīt ar **tastatūru**. Uzklikšķini uz rūtiņas un raksti **+** (vai **B**), **N**, **K**, **A** vai **S**. Atzīme tiek ierakstīta, un fokuss pāriet uz nākamo rūtiņu.',
      'Izvēlies, kur pāriet pēc atzīmes: **↓ nākamā persona** (ērti, atzīmējot vienu nodarbību) vai **→ nākamais datums**. Izvēle tiek atcerēta.',
      '**Bultiņas** pārvietojas pa tabulu, **Del** notīra, **Atstarpe** strādā kā klikšķis, **Esc** beidz. Aktīvās rūtiņas rinda un datums tiek izgaismoti.',
      'Var strādāt arī jaukti: turpināt klikšķināt ar peli un, kad ērtāk, rakstīt ar tastatūru.'
    ] },
    { v: '1.21.0', date: '2026-10-15', title: 'Apmeklējums, rādītāji, kvalifikācijas un pārkāpumi', items: [
      'Jauna sadaļa **Apmeklējums** (📅 kreisajā joslā). **Mēneša tabulā** ir N.p.k., vārds, uzvārds un datumu kolonnas. Atzīmes liek ar klikšķi kā e-klasē: **+** bija → **n** nebija → **k** kavēja → **a** attaisnots → **s** slimības dēļ.',
      'Katrai grupai pats atzīmē **nodarbību dienas** (piem., O un C). Tabulā var rādīt tikai **jaunsardzes dienas** vai **visas mēneša dienas**.',
      'Klikšķis uz datuma atver nodarbību: **tēma, veids** (nodarbība, pasākums, nometne, sacensības), **piezīmes** un pogas **“Visi bija”** un **“Neatzīmētie — nebija”**.',
      '**Drukāšana:** “Tukša veidlapa” rūtiņām uz papīra vai “Ar atzīmēm”. Ja datumu ir daudz, lapa tiek pagriezta horizontāli.',
      '**Žurnāls** parāda mēneša nodarbības ar tēmu un apmeklējuma %.',
      '**Rādītāji:** vienības un grupu vidējais apmeklējums, dinamikas grafiks ar slīdošo vidējo (vērtība redzama, novietojot peli), grupu salīdzinājums un katras personas % ar tendenci ▲▼.',
      '**Brīdinājums**, ja persona nav apmeklējusi **3 nodarbības pēc kārtas** (skaitu var mainīt). Attaisnotie kavējumi neskaitās.',
      '**Kvalifikācijas:** pats nosaki, piem., “Pamatnometne”, un redzi, kam tā ir un kam nav. To var piešķirt atzīmētajiem vai visiem nometnes žurnāla dalībniekiem.',
      'Personas kartītē: **apmeklējums** (%, pēdējās nodarbības, grafiks), **dalība un kvalifikācijas** (pasākumi un nometnes) un **uzvedība un pārkāpumi**: datums, smagums, apraksts, veiktie pasākumi; ierakstus var labot un dzēst.'
    ] },
    { v: '1.20.1', from: '1.20.0', date: '2026-10-15', title: 'Ārsta izziņas termiņi un dokumentu labošana kartītē', items: [
      'Pievienojot **ārsta izziņu**, rīks prasa **izsniegšanas datumu** un pats aprēķina derīgumu uz **12 mēnešiem**. Termiņu var labot.',
      'Rīks atgādina: **30 dienas pirms** termiņa beigām, **mācību gada beigās** (izziņa der tikai savam mācību gadam) un **jaunā mācību gada sākumā**, ja jaunietis pārcelts, bet izziņa ir no iepriekšējā gada. Ja izziņai nav datuma, rīks lūdz to norādīt.',
      'Kartītes sadaļā **Obligātie dokumenti** pie katra dokumenta ir pogas: **📄 atvērt, ✎ labot, ⇄ aizstāt failu, ✕ dzēst**. Trūkstošajiem dokumentiem ir pogas **＋ Fails** un **＋ Papīrs**.',
      'Aizstājot failu, vecais paliek mapē. Dzēšot tiek noņemts tikai ieraksts, bet fails mapē paliek.',
      'Dokumentu cilnē vairs nav atsevišķas sadaļas “Obligātie dokumenti”, jo tā ir sānjoslā ar visām pogām.'
    ] },
    { v: '1.19.1', date: '2026-10-15', title: 'Skaidrs sākums: vispirms datu mape', items: [
      'Ja **datu mape nav pievienota**, pārskatā redzama tikai mapes pievienošana un 3 soļi, kā to izdarīt.',
      'Bez mapes nevar neko ievadīt: mēģinot pievienot personu, ievadīt anketu, importēt vai sagatavot veidlapu, rīks paskaidro, ka vispirms jāpievieno mape, un piedāvā pogu **Izvēlēties datu mapi**.',
      'Sadaļās, kurām vajag datus, ir paziņojums **“Nav pievienota datu mape”**. Sadaļa **Par rīku** ir pieejama vienmēr.'
    ] },
    { v: '1.19.0', date: '2026-10-15', title: 'DVS reģistrācija pa dokumentiem', items: [
      'Kartītes sadaļā **Reģistrācija** DVS ir sadalīts pa dokumentiem: **Pieteikuma anketa, Līgums, Ārsta izziņa**. Katru atzīmē atsevišķi, kad tas reģistrēts.',
      'Katram dokumentam ir savs **reģistrēšanas datums**, un to var nomainīt. Redzams arī, vai dokuments jau **pievienots rīkā**.',
      'Ja kāds dokuments nav reģistrēts DVS, pārskatā un sadaļā **Uzdevumi** redzams brīdinājums, kurā nosaukti trūkstošie dokumenti.',
      'Personu sarakstā **✓ DVS (visi dok.)** atzīmē visus dokumentus atlasītajām personām. Agrākā vienotā DVS atzīme tiek uzskatīta par “visi reģistrēti”.'
    ] },
    { v: '1.18.3', from: '1.18.2', date: '2026-10-15', title: 'Ērtāki atjauninājumi un sīki uzlabojumi', items: [
      'Atverot rīku, vairs netiek lūgts pārlādēt lapu: tu jau strādā ar jaunāko versiju.',
      'Ja jauna versija iznāk, kamēr strādā, rīks par to paziņo, un lapu var pārlādēt, kad tev ērti.',
      'Šis jaunumu saraksts ir sakārtots pa lielākām funkcijām.',
      'Nometnes žurnālā pie katra dalībnieka ir izvēle **Audzinātājs**. Noklusējumā tur redzams grupas audzinātāja vārds, un citu var izvēlēties tikai šim dalībniekam.'
    ] },
    { v: '1.18.1', from: '1.17.0', date: '2026-10-15', title: 'Jauna veidlapa: Līgums par dalību Jaunsardzē', items: [
      '**Aizpildās pats no kartītes**: jaunieša un pārstāvja vārds, personas kods pa cipariem, adreses, tālruņi un e-pasti. Rīks pats izvēlas līgumu ar pārstāvi (līdz 18 g.) vai ar jaunieti (no 18 g.). Formu (papīrs vai EDOC) izvēlies pats.',
      '**Līguma Nr.** no citas sistēmas ieraksti pats. Ja tā nav, rīks pajautā, vai turpināt. Pārstāvja statusu (māte, tēvs, likumiskais pārstāvis, cits) izvēlies pats.',
      '**Instruktora dati** un paraksta datums jāievada vienreiz, un tie tiek atcerēti. Dati, ko ievadi līgumā, papildina tukšos kartītes laukus.',
      '**Word fails**, ko var labot un pārsūtīt. Kopija tiek saglabāta personas mapē. Līgumu var arī **priekšskatīt un izdrukāt** rīkā.',
      '**✎ Labot** atver līgumu ar saglabātajiem datiem, un **⬆ Ielādēt labotu** ielādē Word programmā labotu failu. Katrs labojums ir jauna versija, un vecās versijas netiek pārrakstītas.',
      'Var izmantot arī **savu līguma veidni** ar atzīmēm.'
    ] },
    { v: '1.18.0', date: '2026-10-15', title: 'Visas veidlapas vienā sarakstā', items: [
      'Lapā **Veidlapas** ir instruktāžas lapas, nometņu žurnāli un līgumi kopā.',
      'Filtri: veids, datums no–līdz, mācību gads un meklēšana pēc personas, nosaukuma vai līguma numura.'
    ] },
    { v: '1.16.3', from: '1.16.2', date: '2026-10-15', title: 'Instruktāžas lapa un nometnes žurnāls: precīzākas veidlapas un drukāšana', items: [
      'Veidlapā ir **tieši tik rindu, cik dalībnieku**. Tukšās rindas norādi pats ar − / +, arī nometnes darbinieku tabulā.',
      'Tukšajās rindās datuma šūna ir tukša.',
      '**Drukāt** parāda priekšskatījumu ar visām lapām, un pārlūka drukas logā uzreiz redzamas veidlapas.'
    ] },
    { v: '1.16.1', from: '1.16.0', date: '2026-10-13', title: 'Piezīmju žurnāls un statuss “Jaunsargs”', items: [
      'Piezīmes kartītē un par mācību gadu ir **ierakstu žurnāls**: katrs ieraksts atsevišķi, ar datumu, un to var labot vai dzēst. Enter saglabā, Shift+Enter sāk jaunu rindu, un lauki izplešas paši.',
      'Statusi: **Kandidāts, Jaunsargs, Pārtraukts**. Jaunai personai statusu var izvēlēties uzreiz pie vārda.',
      'Pēc atjauninājuma tiek parādīts šis **jaunumu logs**. Visi jaunumi ir sadaļā Par rīku.'
    ] },
    { v: '1.15.0', date: '2026-10-13', title: 'Atzīmes “ievadīts DVS” un “ievadīts e-klasē”', items: [
      'Personas kartītē ir sadaļa **Reģistrācija**. Kamēr nav atzīmēts, ka persona ievadīta, redzams brīdinājums.',
      'Atzīmēt var arī vairākas personas uzreiz personu sarakstā. Iestatījumos sistēmu var izslēgt.'
    ] },
    { v: '1.14.4', from: '1.14.1', date: '2026-10-13', title: 'Imports no e-klases un no sava Excel saraksta', items: [
      'Importa logā ir cilne **No e-klases** ar instrukciju un eksporta palīgu.',
      'Excel failā kolonnu nosaukumiem nav jābūt pirmajā rindā. Rīks atrod pareizo darblapu un kolonnas, un tās var labot.',
      'Vecāka vārds un tālrunis vienā šūnā tiek sadalīti. Pārējās kolonnas (līgums, ārsta zīme, MTL) tiek ierakstītas piezīmēs. Esošajām personām var papildināt tukšos laukus.'
    ] },
    { v: '1.14.0', date: '2026-10-13', title: 'Veidlapas: instruktāžas lapa un nometnes žurnāls', items: [
      'Jauna sadaļa **Veidlapas**: izvēlies dalībniekus, un rīks sagatavo drukāšanai gatavu PDF.',
      'Ja dalībniekam trūkst anketas, līguma vai ārsta izziņas, rīkā tiek parādīts brīdinājums. Uz veidlapas tas netiek drukāts.',
      'Nometnes darbinieki un audzinātāji tiek saglabāti nākamajām reizēm. Var izmantot arī savu Word veidni.'
    ] },
    { v: '1.13.0', from: '1.12.0', date: '2026-10-13', title: 'Pulkstenis, taimeris un pauzes', items: [
      'Pārskatā ir pulkstenis ar četrām ciparnīcām, hronometru un taimeri nodarbībām.',
      'Pēc 40 min darba rīks atgādina paņemt pauzi.'
    ] },
    { v: '1.11.0', date: '2026-10-12', title: 'Jaunais izskats', items: [
      'Gaišā un tumšā tēma un akcenta krāsa: **Iestatījumi → Izskats**.',
      'Jaunsarga apliecības sadaļa personas kartītē.'
    ] }
  ];
  CP.NEWS = NEWS;
  const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
  const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const KEY = 'cp-news-seen';
  const getSeen = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const setSeen = v => { try { localStorage.setItem(KEY, v); } catch (e) { /* */ } };

  const block = n => `<section class="news-item"><h4>${esc(n.title)} <small class="muted">${esc(n.from ? n.from + '–' + n.v : n.v)} · ${esc(U.fmtDate(n.date))}</small></h4><ul>${n.items.map(i => `<li>${md(i)}</li>`).join('')}</ul></section>`;
  function show(list, title = 'Jaunumi rīkā') {
    let d = U.$('newsDialog');
    if (!d) { d = document.createElement('dialog'); d.id = 'newsDialog'; d.className = 'wide'; document.body.appendChild(d); }
    d.innerHTML = `<header class="dlg-head"><h2>${CP.ic('bell', '🔔')} ${esc(title)}</h2><button type="button" class="ghost" data-close="newsDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body news">${list.map(block).join('')}</div>
      <footer class="dlg-foot"><button type="button" class="ghost" data-act="newsAll">Visi atjauninājumi</button><span class="grow"></span><button type="button" class="mainbtn" data-close="newsDialog">Sapratu</button></footer>`;
    if (!d.open) d.showModal();
  }
  CP.actions.newsAll = () => show(NEWS, 'Atjauninājumu žurnāls');
  /** Pēc atjauninājuma — vienreiz, kad dati ielādēti */
  let checked = false;
  function check() {
    if (checked || !S.root || !S.db || U.qs('dialog[open]')) return;
    checked = true;
    let seen = getSeen();
    if (!seen) {
      if (!(S.db.people || []).length) { setSeen(CP.VERSION); return; }   // jauns lietotājs — nav ko rādīt
      seen = '1.13.1';
    }
    const fresh = NEWS.filter(n => cmp(n.v, seen) > 0 && cmp(n.v, CP.VERSION) <= 0);
    if (!fresh.length) { setSeen(CP.VERSION); return; }
    // gaida, kamēr citi logi (piem., paziņojumi) aizvērti; par redzētu atzīmē tikai pēc parādīšanas
    let tries = 0;
    const tick = () => {
      if (U.qs('dialog[open]')) { if (++tries < 600) setTimeout(tick, 1000); return; }
      show(fresh, fresh.length === 1 ? `Jaunumi — ${fresh[0].v}` : 'Jaunumi kopš pēdējās reizes'); setSeen(CP.VERSION);
    };
    setTimeout(tick, 600);
  }
  CP.afterRender = CP.afterRender || [];
  CP.afterRender.push(check);
  CP.news = { show, list: NEWS, html: () => NEWS.map(block).join('') };
})(window.CP);


/* ==== js/years.js ==== */
/* =====================================================================
   Mācību gadi: reģistrs, izvēlne, mapes, personu pārcelšana.
   Viena persona paliek viens profils. Gadam pieder tikai dalības ieraksts.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;

  function paint() {
    const btn = U.$('yearBtn'), menu = U.$('yearMenu');
    if (!btn || !menu) return;
    const id = D.activeYear();
    btn.textContent = `Mācību gads: ${U.yearSlash(id)} ▾`;
    const years = [...(S.db.years || [])].sort((a, b) => b.start - a.start);
    menu.innerHTML = years.map(y => `<button type="button" data-act="setYear" data-arg="${esc(y.id)}" class="${y.id === id ? 'on' : ''}">${esc(U.yearSlash(y.id))}${y.id === id ? ' · izvēlēts' : ''}${y.id === U.schoolYear() ? ' · pašreizējais' : ''}</button>`).join('')
      + `<button type="button" data-act="openAddYear">＋ Pievienot mācību gadu</button>`
      + `<button type="button" data-page="settings">Pārvaldīt mācību gadus</button>`;
  }
  CP.years = { paint };

  A.toggleYear = () => { const m = U.$('yearMenu'); if (m) m.classList.toggle('hidden'); };
  A.setYear = id => {
    if (!D.yearById(id) || id === D.activeYear()) { U.$('yearMenu')?.classList.add('hidden'); return; }
    S.db.settings.activeYear = id;
    S.list.sel.clear();
    U.$('yearMenu')?.classList.add('hidden');
    CP.store.changed();
    ui.toast(`Mācību gads: ${U.yearSlash(id)}. Dati nav pārvietoti.`, 'ok');
  };
  document.addEventListener('click', e => {
    const menu = U.$('yearMenu');
    if (!menu || menu.classList.contains('hidden')) return;
    if (e.target.closest('#yearPick')) return;
    menu.classList.add('hidden');
  });

  function banner() {
    const n = D.unassignedPeople().length;
    const loose = (S.db.documents || []).filter(d => !d.yearId).length + (S.db.equipment || []).filter(e => !e.yearId).length;
    if (!n && !loose) return '';
    return `<section class="card yearnote"><b>Nepiesaistīti ieraksti.</b> ${n ? n + ' personas nav nevienā mācību gadā. ' : ''}${loose ? loose + ' dokumenti vai ekipējuma ieraksti ir bez gada, jo tiem nav datuma. ' : ''}Gads netiek uzminēts.<div class="actions"><button class="mainbtn sm" data-act="openAssign">Piesaistīt gadam…</button></div></section>`;
  }
  CP.years.banner = banner;

  A.ensureFolders = async () => {
    if (!S.root) return ui.toast('Vispirms izvēlies datu mapi', 'warn');
    try { await CP.store.ensureYearFolders(); ui.toast('Mācību gadu mapes ir sagatavotas', 'ok'); }
    catch (e) { ui.toast(e.message, 'err'); }
  };
  A.openAddYear = () => {
    U.$('yearMenu')?.classList.add('hidden');
    const last = Math.max(...(S.db.years || []).map(y => y.start), U.schoolStart());
    U.$('addYearStart').value = last + 1;
    previewYear();
    U.$('addYearDialog').showModal();
  };
  function previewYear() {
    const start = Number(U.$('addYearStart').value);
    const el = U.$('addYearPreview');
    if (!el) return;
    if (!start || start < 1990 || start > 2500) { el.textContent = 'Ievadi sākuma gadu, piemēram, 2027.'; return; }
    const id = U.yearId(start);
    el.textContent = D.yearById(id) ? `${U.yearLabel(id)} jau ir reģistrā.` : `Tiks izveidots ${U.yearLabel(id)}.`;
  }
  CP.inputHandlers.push(e => { if (e.target.id !== 'addYearStart') return false; previewYear(); return true; });
  A.addYearOk = async () => {
    const start = Number(U.$('addYearStart').value);
    if (!start || start < 1990 || start > 2500) return ui.toast('Ievadi sākuma gadu', 'warn');
    const id = U.yearId(start);
    if (D.yearById(id)) return ui.toast(`${U.yearLabel(id)} jau ir`, 'warn');
    S.db.years.push({ id, start, createdAt: U.now() });
    S.db.years.sort((a, b) => a.start - b.start);
    if (U.$('addYearDialog').open) U.$('addYearDialog').close();
    CP.store.changed({ silent: true });
    let folders = '';
    if (S.root) {
      try { await CP.store.ensureYearFolders(); folders = ' Mapes ir izveidotas.'; }
      catch (e) { folders = ' Mapes neizdevās izveidot: ' + e.message; }
    } else folders = ' Mapes tiks izveidotas, kad būs izvēlēta datu mape.';
    const prev = U.yearId(start - 1);
    const go = confirm(`${U.yearLabel(id)} ir pievienots.${folders}\n\nPārslēgties uz šo gadu?`);
    if (go) A.setYear(id);
    else CP.render();
    if (D.yearById(prev) && D.peopleInYear(prev).length && confirm(`Pārcelt personas no ${U.yearLabel(prev)} uz ${U.yearLabel(id)}?`)) {
      if (D.activeYear() !== id) A.setYear(id);
      A.openMove(prev);
    }
  };

  A.openAssign = () => {
    const sel = U.$('assignYear');
    sel.innerHTML = (S.db.years || []).map(y => `<option value="${esc(y.id)}" ${y.id === D.activeYear() ? 'selected' : ''}>${esc(U.yearLabel(y.id))}</option>`).join('');
    U.$('assignInfo').textContent = `${D.unassignedPeople().length} personas un ${(S.db.documents || []).filter(d => !d.yearId).length + (S.db.equipment || []).filter(e => !e.yearId).length} ieraksti bez gada.`;
    U.$('assignDialog').showModal();
  };
  A.assignOk = () => {
    const yearId = U.$('assignYear').value;
    if (!D.yearById(yearId)) return;
    let n = 0;
    for (const p of D.unassignedPeople()) {
      D.bindYear(p, { yearId, group: p.group || '', status: p.status === 'archived' ? 'archived' : (p.status || 'active'), note: 'Piesaistīts manuāli' });
      n++;
    }
    if (U.$('assignLoose').checked) {
      for (const d of S.db.documents) if (!d.yearId) d.yearId = yearId;
      for (const e of S.db.equipment) if (!e.yearId) e.yearId = yearId;
    }
    U.$('assignDialog').close();
    CP.store.changed();
    ui.toast(n ? `Piesaistītas ${n} personas gadam ${U.yearLabel(yearId)}` : 'Personas jau bija piesaistītas', 'ok');
  };

  function movePeople() {
    const from = U.$('moveFrom').value, q = U.norm(U.$('moveQ').value).replace(/ /g, '');
    return D.peopleInYear(from).filter(p => !q || U.norm(U.full(p) + ' ' + U.sortName(p)).replace(/ /g, '').includes(q))
      .sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
  }
  function moveCount() {
    const n = U.qsa('#moveList input:checked').length;
    U.$('moveCount').textContent = `Atlasītas: ${n} personas`;
    U.$('moveDo').textContent = n ? `Pārcelt ${n} personas` : 'Pārcelt atlasītās personas';
  }
  function paintMove() {
    const dest = D.activeYear();
    U.$('moveDest').textContent = U.yearLabel(dest);
    const from = U.$('moveFrom').value;
    U.$('moveList').innerHTML = movePeople().map(p => {
      const en = D.enroll(p.id, from);
      const already = !!D.enroll(p.id, dest);
      return `<label class="moveitem ${already ? 'muted' : ''}"><input type="checkbox" value="${esc(p.id)}" ${already ? 'disabled' : ''}> <span><b>${esc(U.full(p))}</b> <small class="muted">${esc(en?.group || 'bez grupas')}${p.status === 'archived' ? ' · arhivēta' : ''}${already ? ' · jau šajā gadā' : ''}</small></span></label>`;
    }).join('') || '<p class="muted">Šajā gadā nav personu.</p>';
    moveCount();
  }
  A.openMove = fromId => {
    const dest = D.activeYear();
    U.$('moveDest').textContent = U.yearLabel(dest);
    const opts = (S.db.years || []).filter(y => y.id !== dest);
    U.$('moveFrom').innerHTML = opts.map(y => `<option value="${esc(y.id)}" ${y.id === fromId ? 'selected' : ''}>${esc(U.yearLabel(y.id))}</option>`).join('');
    if (!opts.length) return ui.toast('Nav cita mācību gada, no kura pārcelt', 'warn');
    U.$('moveQ').value = '';
    U.$('moveGroup').value = '';
    U.$('moveActivate').checked = false;
    paintMove();
    U.$('moveDialog').showModal();
  };
  CP.changeHandlers.push(e => { if (e.target.id !== 'moveFrom') return false; paintMove(); return true; });
  CP.inputHandlers.push(e => {
    if (e.target.id === 'moveQ') { paintMove(); return true; }
    if (e.target.closest?.('#moveList')) { moveCount(); return true; }
    return false;
  });
  document.addEventListener('click', e => {
    const menu = U.$('yearMenu');
    if (!menu || menu.classList.contains('hidden') || e.target.closest('#yearBtn')) return;
    if (e.target.closest('#yearPick')) menu.classList.add('hidden');
  });
  A.moveAll = () => { U.qsa('#moveList input:not(:disabled)').forEach(i => { i.checked = true; }); moveCount(); };
  A.moveNone = () => { U.qsa('#moveList input').forEach(i => { i.checked = false; }); moveCount(); };
  A.moveDo = async () => {
    const dest = D.activeYear(), from = U.$('moveFrom').value, group = U.$('moveGroup').value.trim();
    const ids = U.qsa('#moveList input:checked').map(i => i.value);
    if (!ids.length) return ui.toast('Atzīmē vismaz vienu personu', 'warn');
    const archived = ids.filter(id => D.person(id)?.status === 'archived');
    if (archived.length && !U.$('moveActivate').checked && !confirm(`${archived.length} atlasītās personas ir arhivētas. Tās tiks piesaistītas gadam, bet paliks arhivētas. Turpināt?`)) return;
    const skipped = [], added = [], made = [];
    for (const id of ids) {
      const p = D.person(id); if (!p) continue;
      if (D.enroll(id, dest)) { skipped.push(U.full(p)); continue; }
      const src = D.enroll(id, from);
      const activate = p.status === 'archived' && U.$('moveActivate').checked;
      if (activate) { p.status = 'active'; p.updatedAt = U.now(); D.audit(id, 'restore'); }
      D.bindYear(p, {
        yearId: dest,
        group,
        status: p.status === 'archived' ? 'archived' : (src?.status && src.status !== 'archived' ? src.status : 'active'),
        note: `Pārcelts no ${U.yearLabel(from)}`,
        fromYearId: from
      });
      added.push(U.full(p));
      made.push(p);
      D.audit(id, 'year-move', [U.yearLabel(from) + ' → ' + U.yearLabel(dest)]);
    }
    for (const p of made) {
      try { await CP.store.ensurePersonYearFolder(p, dest); }
      catch (err) { ui.toast('Jaunā gada mapi neizdevās izveidot ' + U.full(p) + ': ' + err.message + '. Dokumenti nav kopēti.', 'warn', 9000); }
    }
    U.$('moveDialog').close();
    CP.store.changed();
    ui.toast(`Pārceltas ${added.length} personas.${skipped.length ? ' Jau bija šajā gadā: ' + skipped.join(', ') : ''}`, skipped.length ? 'warn' : 'ok', 9000);
  };

})(window.CP);


/* ==== js/scan/reader.js ==== */
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
      { f: 'photoConsent', sec: 'parent', try: [{ m: 'checkbox', a: /foto video publicesan|foto video/ }] },
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


/* ==== js/scan/viewer.js ==== */
/* =====================================================================
   Dokumentu skatītājs — darbojas kā parasts PDF skatītājs:
   • ritenītis / skārienpaliktnis — ritina lapas
   • Ctrl + ritenītis (vai savilkšana) — tuvina pie kursora
   • Ctrl + / Ctrl − / Ctrl 0, pogas “−”, “+”, “Platums”, “Lapa”
   • lapas numurs un ātrā pāreja
   Lapas: <canvas> (PDF, attēls) vai HTML (DOCX).
   Virs lapām: atpazītās rindas (klikšķis ieliek tekstu laukā) un aktīvā lauka izcēlums.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, esc = U.esc;
  const DOCX_W = 794;   // A4 platums pikseļos pie 96 dpi

  class Viewer {
    constructor(host, cb = {}) {
      this.cb = cb; this.pages = []; this.scale = 1; this.fit = 'width';
      host.innerHTML = `<div class="vw-tools">
          <button type="button" data-vw="out" title="Tālināt (Ctrl −)">−</button>
          <button type="button" class="vw-zoom" data-vw="reset" title="100%">100%</button>
          <button type="button" data-vw="in" title="Tuvināt (Ctrl +)">＋</button>
          <span class="vw-sep"></span>
          <button type="button" data-vw="width" title="Pa platumu">↔ Platums</button>
          <button type="button" data-vw="page" title="Visa lapa">▯ Lapa</button>
          <button type="button" data-vw="rotate" title="Pagriezt 90°">⟳</button>
          <span class="grow"></span><span class="vw-page muted small"></span></div>
        <div class="vw-scroll" tabindex="0"><div class="vw-pages"></div>
          <div class="vw-empty"><div class="vw-drop">📄</div><p><b>Atver anketu</b></p><p class="muted small">PDF, Word (.docx), eDoc vai foto — vai ievelc failu šeit</p></div></div>`;
      this.sc = host.querySelector('.vw-scroll'); this.box = host.querySelector('.vw-pages');
      this.zoomLbl = host.querySelector('.vw-zoom'); this.pageLbl = host.querySelector('.vw-page');
      host.querySelector('.vw-tools').addEventListener('click', e => {
        const b = e.target.closest('[data-vw]'); if (!b) return;
        ({ in: () => this.step(1), out: () => this.step(-1), reset: () => this.setScale(this.base(), null, 'none'), width: () => this.fitWidth(), page: () => this.fitPage(), rotate: () => cb.onRotate?.() })[b.dataset.vw]?.();
      });
      this._events();
      new ResizeObserver(() => { if (this.fit === 'width') this.fitWidth(); else if (this.fit === 'page') this.fitPage(); }).observe(this.sc);
    }

    /* --- Saturs --- */
    clear() { this.box.innerHTML = ''; this.pages = []; this.sc.classList.remove('has-doc'); this.pageLbl.textContent = ''; }
    setCanvases(canvases) {
      this.clear();
      this.pages = canvases.map((c, i) => {
        const el = document.createElement('div'); el.className = 'vw-pg'; el.dataset.page = i;
        const ov = document.createElement('div'); ov.className = 'vw-ov';
        el.append(c, ov); this.box.appendChild(el);
        return { el, ov, w: c.width, h: c.height, kind: 'canvas' };
      });
      this._ready();
    }
    setHtml(html) {
      this.clear();
      const el = document.createElement('div'); el.className = 'vw-pg vw-html'; el.dataset.page = 0;
      el.innerHTML = `<div class="dx" style="width:${DOCX_W}px">${html}</div>`; this.box.appendChild(el);
      this.pages = [{ el, inner: el.firstChild, w: DOCX_W, h: 0, kind: 'html' }];
      this._ready();
    }
    _ready() { this.sc.classList.toggle('has-doc', this.pages.length > 0); this.fit = 'width'; this.fitWidth(); this.sc.scrollTop = 0; this.sc.focus({ preventScroll: true }); }
    get maxW() { return Math.max(1, ...this.pages.map(p => p.w)); }
    /** “100%”: lapa A4 platumā ~ 800 px */
    base() { return this.pages[0]?.kind === 'html' ? 1 : 820 / this.maxW; }

    /* --- Mērogs --- */
    layout() {
      for (const p of this.pages) {
        if (p.kind === 'html') { p.inner.style.zoom = this.scale; continue; }
        p.el.style.width = Math.round(p.w * this.scale) + 'px'; p.el.style.height = Math.round(p.h * this.scale) + 'px';
      }
      this.zoomLbl.textContent = Math.round(this.scale / this.base() * 100) + '%';
      this._pageInfo();
    }
    setScale(s, at, fit = 'none') {
      if (!this.pages.length) return;
      s = U.clamp(s, this.base() * 0.25, this.base() * 6); this.fit = fit;
      // punkts zem kursora (vai skata centrā) paliek vietā
      const r = this.sc.getBoundingClientRect(), cx = at ? at.x : r.left + r.width / 2, cy = at ? at.y : r.top + r.height / 2;
      const pg = this._pageAt(cx, cy), pr = pg?.el.getBoundingClientRect(), fx = pr ? (cx - pr.left) / pr.width : 0, fy = pr ? (cy - pr.top) / pr.height : 0;
      this.scale = s; this.layout();
      if (pg) { const nr = pg.el.getBoundingClientRect(); this.sc.scrollLeft += nr.left + fx * nr.width - cx; this.sc.scrollTop += nr.top + fy * nr.height - cy; }
    }
    step(dir) { const levels = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6].map(l => l * this.base()); const cur = this.scale;
      const next = dir > 0 ? levels.find(l => l > cur * 1.01) : [...levels].reverse().find(l => l < cur * 0.99); if (next) this.setScale(next); }
    fitWidth() { if (!this.pages.length) return; this.setScale((this.sc.clientWidth - 36) / this.maxW, null, 'width'); }
    fitPage() { if (!this.pages.length) return; const p = this.pages[this.curPage || 0]; const h = p.kind === 'html' ? p.inner.offsetHeight / this.scale : p.h;
      this.setScale(Math.min((this.sc.clientWidth - 36) / p.w, (this.sc.clientHeight - 30) / Math.max(h, 1)), null, 'page'); this.showPage(this.curPage || 0); }
    showPage(i) { const p = this.pages[i]; if (p) this.sc.scrollTo({ top: p.el.offsetTop - 12, behavior: 'smooth' }); }

    /* --- Pārklājumi --- */
    /** lines: [{i,p,x0,y0,x1,y1,text}], active: {page,x,y,w,h} vai null */
    /** zones: veidnes lauki [{f,label,page,x,y,w,h,on}]; editing — rāda dzēšanas pogas */
    overlay({ lines = [], active = null, zones = [], editing = false, fields = [] } = {}) {
      this.pages.forEach((pg, i) => {
        if (pg.kind === 'html') return;
        const pct = v => (v * 100).toFixed(3) + '%';
        const opts = z => `<select class="vw-zfield" data-zid="${esc(z.id || '')}"><option value="">Lauks…</option>${(fields || []).map(f => `<option value="${esc(f.k)}" ${f.k === z.f ? 'selected' : ''}>${esc(f.l)}</option>`).join('')}</select>`;
        pg.ov.innerHTML = (editing ? '' : lines.filter(l => l.p === i).map(l => `<div class="vw-line" data-line="${l.i}" style="left:${pct(l.x0)};top:${pct(l.y0)};width:${pct(l.x1 - l.x0)};height:${pct(l.y1 - l.y0)}" title="Klikšķis — ielikt laukā: ${esc(l.text)}"></div>`).join(''))
          + zones.filter(z => (z.page || 0) === i).map(z => `<div class="vw-zone ${z.on ? 'on' : ''}" data-zid="${esc(z.id || '')}" data-x="${z.x}" data-y="${z.y}" data-w="${z.w}" data-h="${z.h}" style="left:${pct(z.x)};top:${pct(z.y)};width:${pct(z.w)};height:${pct(z.h)}"><span>${editing ? opts(z) : esc(z.label)}${editing ? `<button type="button" class="vw-zdel" data-zid="${esc(z.id || '')}" title="Dzēst zonu">✕</button>` : ''}</span>${editing ? '<i class="vw-rs" data-rs="1"></i>' : ''}</div>`).join('')
          + (active && (active.page || 0) === i ? `<div class="vw-hl" style="left:${pct(active.x)};top:${pct(active.y)};width:${pct(active.w)};height:${pct(active.h)}"></div>` : '');
      });
    }
    /** 'view' — parasts skatīšanās režīms; 'draw' — vilkšana iezīmē taisnstūri */
    setMode(m) { this.mode = m; this.sc.dataset.mode = m; }
    /** DOCX: izceļ blokus (rindas) */
    markBlocks(ids = []) {
      const pg = this.pages[0]; if (pg?.kind !== 'html') return;
      U.qsa('.dx-blk.on', pg.el).forEach(e => e.classList.remove('on'));
      const els = ids.map(i => U.qs(`.dx-blk[data-blk="${i}"]`, pg.el)).filter(Boolean); els.forEach(e => e.classList.add('on'));
      if (els[0]) this._scrollToRect(els[0].getBoundingClientRect());
    }
    /** Parāda apgabalu: ritina līdz tam; ja teksts būtu par sīku, palielina mērogu */
    reveal(b) {
      const pg = this.pages[b.page || 0]; if (!pg || pg.kind === 'html') return;
      const textPx = b.h * pg.h * this.scale;
      if (textPx < 26) { const need = 30 / (b.h * pg.h); this.scale = U.clamp(Math.min(need, (this.sc.clientWidth - 36) / (Math.max(b.w, 0.3) * pg.w)), this.base() * 0.25, this.base() * 6); this.fit = 'none'; this.layout(); }
      const r = pg.el.getBoundingClientRect();
      this._scrollToRect({ left: r.left + b.x * r.width, top: r.top + b.y * r.height, width: b.w * r.width, height: b.h * r.height });
    }
    _scrollToRect(rc) {
      const s = this.sc.getBoundingClientRect();
      const dy = rc.top + rc.height / 2 - (s.top + s.height * 0.42), dx = rc.width > s.width * 0.9 ? rc.left - s.left - 20 : rc.left + rc.width / 2 - (s.left + s.width / 2);
      this.sc.scrollBy({ top: dy, left: dx, behavior: 'smooth' });
    }
    _pageAt(x, y) { return this.pages.find(p => { const r = p.el.getBoundingClientRect(); return y >= r.top - 12 && y <= r.bottom + 12; }) || this.pages[0]; }
    _pageInfo() {
      if (this.pages.length < 2) { this.pageLbl.textContent = this.pages.length ? '1 lapa' : ''; this.curPage = 0; return; }
      const s = this.sc.getBoundingClientRect(), mid = s.top + s.height / 3;
      const i = Math.max(0, this.pages.findIndex(p => p.el.getBoundingClientRect().bottom > mid)); this.curPage = i;
      this.pageLbl.innerHTML = this.pages.map((p, k) => `<button type="button" class="vw-pn ${k === i ? 'on' : ''}" data-pn="${k}">${k + 1}</button>`).join('') + ` <span>/ ${this.pages.length}</span>`;
    }

    _events() {
      const sc = this.sc;
      sc.addEventListener('wheel', e => {
        if (!this.pages.length || !(e.ctrlKey || e.metaKey)) return;   // bez Ctrl — parasta ritināšana
        e.preventDefault(); this.setScale(this.scale * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025)), { x: e.clientX, y: e.clientY });
      }, { passive: false });
      sc.addEventListener('scroll', () => { cancelAnimationFrame(this._raf); this._raf = requestAnimationFrame(() => this._pageInfo()); });
      this.pageLbl.addEventListener('click', e => { const b = e.target.closest('[data-pn]'); if (b) this.showPage(Number(b.dataset.pn)); });
      sc.closest('dialog')?.addEventListener('keydown', e => {
        if (!(e.ctrlKey || e.metaKey) || !this.pages.length) return;
        if (e.key === '+' || e.key === '=') { e.preventDefault(); this.step(1); } else if (e.key === '-') { e.preventDefault(); this.step(-1); } else if (e.key === '0') { e.preventDefault(); this.fitWidth(); }
      });
      // Iezīmēšana, pārvietošana un izmēra maiņa. Koordinātas ir lapas daļas (0..1).
      let drag = null;
      const at = (pgEl, ev) => {
        const r = pgEl.getBoundingClientRect();
        return { x: U.clamp((ev.clientX - r.left) / Math.max(r.width, 1), 0, 1), y: U.clamp((ev.clientY - r.top) / Math.max(r.height, 1), 0, 1) };
      };
      sc.addEventListener('pointerdown', e => {
        if (this.mode !== 'draw' || e.button !== 0) return;
        if (e.target.closest('.vw-zdel') || e.target.closest('select')) return;
        const zone = e.target.closest('.vw-zone');
        const pgEl = (zone || e.target).closest('.vw-pg');
        if (!pgEl || pgEl.classList.contains('vw-html')) return;
        e.preventDefault();
        try { sc.setPointerCapture(e.pointerId); } catch (err) { /* sintētisks notikums */ }
        const p = at(pgEl, e);
        if (zone) {
          drag = { kind: e.target.closest('.vw-rs') ? 'resize' : 'move', id: zone.dataset.zid, page: Number(pgEl.dataset.page), sx: p.x, sy: p.y, pgEl, start: { x: +zone.dataset.x, y: +zone.dataset.y, w: +zone.dataset.w, h: +zone.dataset.h } };
          return;
        }
        const box = document.createElement('div'); box.className = 'vw-draw'; pgEl.querySelector('.vw-ov').appendChild(box);
        drag = { kind: 'draw', page: Number(pgEl.dataset.page), s: p, box, pgEl };
      });
      sc.addEventListener('pointermove', e => {
        if (!drag) return;
        const p = at(drag.pgEl, e);
        if (drag.kind === 'draw') {
          const s = drag.s;
          drag.rect = { page: drag.page, x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) };
          Object.assign(drag.box.style, { left: drag.rect.x * 100 + '%', top: drag.rect.y * 100 + '%', width: drag.rect.w * 100 + '%', height: drag.rect.h * 100 + '%' });
          return;
        }
        let { x, y, w, h } = drag.start;
        const dx = p.x - drag.sx, dy = p.y - drag.sy;
        if (drag.kind === 'move') { x = U.clamp(x + dx, 0, 1 - w); y = U.clamp(y + dy, 0, 1 - h); }
        else { w = U.clamp(w + dx, 0.02, 1 - x); h = U.clamp(h + dy, 0.012, 1 - y); }
        drag.rect = { page: drag.page, x, y, w, h };
        const el = sc.querySelector('.vw-zone[data-zid="' + CSS.escape(drag.id) + '"]');
        if (el) Object.assign(el.style, { left: x * 100 + '%', top: y * 100 + '%', width: w * 100 + '%', height: h * 100 + '%' });
      });
      const end = () => {
        if (!drag) return;
        const d = drag; drag = null;
        if (d.kind === 'draw') { d.box.remove(); if (d.rect && d.rect.w > 0.01 && d.rect.h > 0.005) this.cb.onDraw?.(d.rect); return; }
        if (!d.rect) return;
        const a = d.start, b = d.rect;
        if (Math.abs(a.x - b.x) > 0.002 || Math.abs(a.y - b.y) > 0.002 || Math.abs(a.w - b.w) > 0.002 || Math.abs(a.h - b.h) > 0.002) this.cb.onZoneChange?.(d.id, b);
      };
      sc.addEventListener('pointerup', end); sc.addEventListener('pointercancel', end);
      sc.addEventListener('click', e => { const z = e.target.closest('.vw-zdel'); if (z) { e.stopPropagation(); e.preventDefault(); this.cb.onZoneDelete?.(z.dataset.zid); } }, true);
      sc.addEventListener('change', e => { const sel = e.target.closest('.vw-zfield'); if (sel) this.cb.onZoneField?.(sel.dataset.zid, sel.value); });
      sc.addEventListener('click', e => { if (this.mode === 'draw') return; const l = e.target.closest('.vw-line'); if (l && window.getSelection().isCollapsed) this.cb.onLineClick?.(Number(l.dataset.line), e); });
      sc.addEventListener('dragover', e => { e.preventDefault(); sc.classList.add('over'); });
      sc.addEventListener('dragleave', () => sc.classList.remove('over'));
      sc.addEventListener('drop', e => { e.preventDefault(); sc.classList.remove('over'); const f = e.dataTransfer.files?.[0]; if (f) this.cb.onFile?.(f); });
    }
  }
  CP.Viewer = Viewer;
})(window.CP);


/* ==== js/scan/ocr.js ==== */
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
  /** Biežākās Google kļūdas → ko darīt (Google Cloud konsolē, console.cloud.google.com/apis/credentials) */
  function googleHelp(m) {
    const t = String(m);
    if (/API key not valid|API_KEY_INVALID/i.test(t)) return 'atslēga nav derīga. Pārbaudi, vai Iestatījumos ielīmēta pilna atslēga bez atstarpēm. (' + t + ')';
    if (/method .* are blocked|API_KEY_SERVICE_BLOCKED/i.test(t)) return 'atslēgai nav atļauts izmantot Cloud Vision API. Google Cloud → APIs & Services → Credentials → atslēga → API restrictions → atzīmē “Cloud Vision API” → Save, pēc pāris minūtēm mēģini vēlreiz. (' + t + ')';
    if (/referer|referrer|API_KEY_HTTP_REFERRER_BLOCKED/i.test(t)) return 'atslēga nav atļauta šai adresei. Credentials → atslēga → Website restrictions → pievieno https://cadet-tools.github.io/* (' + t + ')';
    if (/has not been used|is disabled|SERVICE_DISABLED|not enabled/i.test(t)) return 'projektā nav ieslēgts Cloud Vision API. Atver console.cloud.google.com/apis/library/vision.googleapis.com → Enable. (' + t + ')';
    if (/billing/i.test(t)) return 'projektam nav pievienots norēķinu konts (Google to prasa arī bezmaksas apjomam). (' + t + ')';
    if (/quota|rate limit|RESOURCE_EXHAUSTED/i.test(t)) return 'pārsniegts pieprasījumu limits. Pagaidi vai pārbaudi kvotas. (' + t + ')';
    if (/Failed to fetch|NetworkError/i.test(t)) return 'nav savienojuma ar Google (internets vai tīkla ierobežojums). (' + t + ')';
    return t;
  }
  async function googleWords(c, p) {
    if (S.db.settings.ocr.engine !== 'google') throw Error('Google Vision nav ieslēgts');
    const key = S.db.settings.ocr.googleKey; if (!key) throw Error('Iestatījumos nav ievadīta Google Vision API atslēga');
    const k = Math.min(1, 3000 / Math.max(c.width, c.height)), sc = canvas(c.width * k, c.height * k); sc.getContext('2d').drawImage(c, 0, 0, sc.width, sc.height);
    const r = await fetch('https://vision.googleapis.com/v1/images:annotate?key=' + encodeURIComponent(key.trim()), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ image: { content: sc.toDataURL('image/jpeg', 0.9).split(',')[1] }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }], imageContext: { languageHints: ['lv', 'en'] } }] })
    });
    const j = await r.json().catch(() => ({})), err = j.error || j.responses?.[0]?.error;
    if (!r.ok || err) throw Error('Google Vision: ' + googleHelp(err?.message || String(r.status)));
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


/* ==== js/scan/scan.js ==== */
/* =====================================================================
   Anketas ievade: dokuments (kreisajā pusē) + pārbaude (labajā pusē).
   Lauki netiek minēti pēc atslēgvārdiem. Teksts tiek ņemts tikai no
   lietotāja iezīmētajām zonām. Kartītē dati nonāk pēc apstiprinājuma.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const SC = { doc: null, file: null, res: null, lines: [], cur: 'first', found: {}, edited: new Set(), busy: false, saved: true, tpl: null, editing: false, draft: null, shift: {} };
  let viewer = null, form = null, fieldOrder = [];
  const scan = {};

  /* --- Statusa josla --- */
  scan.msg = (text, type = 'info', prog) => {
    const el = U.$('scanMsg'); if (!el) return;
    el.className = 'scan-msg ' + type; el.querySelector('.txt').textContent = text;
    const bar = el.querySelector('.bar'); bar.classList.toggle('hidden', type !== 'busy');
    if (prog != null) bar.querySelector('i').style.width = Math.round(prog * 100) + '%';
  };
  const msg = scan.msg;

  function build() {
    if (viewer) return;
    form = U.$('scanForm');
    U.$('scanFields').innerHTML = ui.fieldsHTML({ prefix: 'sf_', filter: f => !f.noScan });
    fieldOrder = CP.FIELDS.filter(f => !f.noScan).map(f => f.k);
    U.qsa('.field', form).forEach(b => { b.querySelector('.fx').innerHTML += `<button type="button" class="zbtn" data-act="scanZoom" data-arg="${b.dataset.f}" title="Parādīt dokumentā" tabindex="-1">⌖</button>`; });
    viewer = new CP.Viewer(U.$('scanViewer'), { onFile: loadFile, onRotate: rotate, onLineClick: lineClick, onDraw: drawZone, onZoneDelete: deleteZone, onZoneChange: moveZone, onZoneField: assignZone });
    U.$('scanTpl').addEventListener('change', e => { selectTpl(e.target.value); S.db.settings.activeTemplate = e.target.value; CP.store.changed({ silent: true }); if (SC.doc && !SC.busy) A.scanRun(); });
    form.addEventListener('focusin', e => { const n = e.target.name; if (n) { SC.cur = n; focusField(n); } });
    form.addEventListener('input', e => {
      const n = e.target.name; if (!n) return; SC.edited.add(n); SC.saved = false; delete form.dataset.warned;
      e.target.closest('.field').classList.remove('auto', 'check', 'warn', 'bad');
    });
    form.addEventListener('change', e => {
      if (e.target.name === 'personalCode' && !form.elements.birth.value) form.elements.birth.value = U.birthFromCode(e.target.value);
      if (e.target.name in D.PHONE_FIELDS) ui.phoneHints(form, U.$('scanTarget').value);
    });
    for (const id of ['scanFile', 'scanCam']) U.$(id).addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });
    U.$('scanTarget').addEventListener('change', e => fillFromPerson(e.target.value));
    U.$('scanDialog').addEventListener('cancel', e => { e.preventDefault(); A.scanClose(); });
  }

  /* --- Atvēršana / aizvēršana --- */
  A.scan = (arg, el, e, opts = {}) => {
    build(); resetDoc(); ui.datalists();
    U.$('scanTarget').innerHTML = '<option value="">➕ Jauna persona</option>' + D.peopleInYear().filter(D.isCurrent).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b))).map(p => `<option value="${p.id}">Papildināt: ${esc(U.sortName(p))}</option>`).join('');
    const target = opts.target || (S.page === 'person' && D.person(S.selected) ? S.selected : '');
    U.$('scanTarget').value = target; fillFromPerson(target);
    tplOptions(); selectTpl(S.db.settings.activeTemplate);
    U.$('scanDialog').showModal();
    msg('Atver dokumentu. Lauki tiek atrasti automātiski pēc anketas etiķetēm; ar veidni — tikai iezīmētās zonas. Kartītē dati nonāk tikai pēc tavas pārbaudes un saglabāšanas.', 'info');
    if (opts.file) loadFile(opts.file);
  };
  scan.openWith = (file, target) => A.scan(null, null, null, { file, target });
  A.scanClose = () => {
    if (SC.busy) return msg('Notiek nolasīšana — uzgaidi', 'warn');
    if (SC.editing && !confirm('Veidne nav saglabāta. Aizvērt?')) return;
    if (SC.editing) endEdit();
    SC.pendingEdit = false;
    if (!SC.saved && hasValues() && !confirm('Ievadītie dati nav saglabāti. Aizvērt bez saglabāšanas?')) return;
    U.$('scanDialog').close(); CP.render();
  };
  const hasValues = () => fieldOrder.some(k => form.elements[k]?.value && form.elements[k].tagName !== 'SELECT');

  function resetDoc() {
    SC.doc = null; SC.file = null; SC.res = null; SC.lines = []; SC.found = {}; SC.edited.clear(); SC.saved = true; SC.pendingEdit = false;
    viewer.clear(); clearHints(); delete form.dataset.warned; buttons();
  }
  const clearHints = () => U.qsa('.field', form).forEach(b => { b.classList.remove('auto', 'check', 'warn', 'bad', 'has-zone'); b.querySelector('.hint').innerHTML = ''; b.querySelector('.duphint')?.remove(); });
  function fillFromPerson(pid) {
    ui.fillForm(form, pid ? D.formPerson(D.person(pid)) : null); SC.edited.clear();
    U.$('scanStatusWrap').classList.toggle('hidden', !!pid);
    if (SC.res?.values) applyZones(SC.res.values);
  }
  function buttons() {
    U.$('scanRunBtn').disabled = SC.busy || !SC.doc || SC.editing;
    U.$('scanTplBtn').disabled = SC.busy || SC.editing; U.$('scanTpl').disabled = SC.busy || SC.editing;
    U.$('scanTplBtn').textContent = SC.tpl ? '✎ Koriģēt zonas' : '✎ Jauna veidne';
    U.$('scanSource').textContent = !SC.doc ? '' : SC.doc.source === 'docx' ? 'Word dokuments' : SC.doc.source === 'text' ? 'PDF ar tekstu' : SC.doc.source === 'ocr' ? (CP.ocr.engine() === 'google' ? 'Atpazīts (Google)' : 'Atpazīts no attēla') : '';
    U.$('scanSource').className = 'tag ' + (SC.doc?.source === 'ocr' ? 'warn' : 'ok');
  }

  /* --- Faila ielāde --- */
  async function loadFile(file) {
    if (!file) return; if (SC.busy) return msg('Uzgaidi, kamēr beigsies nolasīšana', 'warn');
    SC.busy = true; buttons();
    try {
      msg('Atver ' + file.name + '…', 'busy', 0.05);
      const doc = await CP.reader.load(file, (t, p) => msg(t + '…', 'busy', p));
      SC.doc = doc; SC.file = file; SC.found = {}; SC.res = null; SC.lines = []; clearHints();
      if (doc.kind === 'docx') viewer.setHtml(doc.html); else viewer.setCanvases(doc.pages);
      if (SC.pendingEdit) {
        SC.pendingEdit = false; SC.busy = false;
        if (doc.kind === 'docx') msg('Word un eDoc paraugam zonas netiek zīmētas. Atver skenētu PDF vai attēlu.', 'info');
        else A.scanTplEdit();
        return;
      }
      SC.busy = false; await read();
    } catch (e) { msg('Neizdevās atvērt: ' + e.message, 'err'); }
    finally { SC.busy = false; buttons(); }
  }
  async function rotate() {
    const d = SC.doc; if (!d || d.kind === 'docx' || SC.busy) return;
    d.pages = d.pages.map(CP.ocr.rotate); d.words = []; d.source = 'none';
    viewer.setCanvases(d.pages); await read();
  }

  /* --- Nolasīšana tikai no veidnes zonām --- */
  const CAPTIONS = new Set(['vards', 'uzvards', 'vards un uzvards', 'vards uzvards', 'personas kods', 'dzimsanas datums', 'talrunis', 'telefons', 'e pasts', 'epasts', 'deklareta adrese', 'faktiska adrese', 'adrese', 'macibu iestade', 'klase', 'klase kurss', 'grupa', 'radnieciba', 'saistiba', 'aizpildiet', 'aizpildi', 'noradiet', 'ievadiet', 'obligati', 'paraugs', 'piemers', 'likumiskais parstavis', 'foto video publicesana']);
  const CAPTION_WORDS = new Set(['vards', 'uzvards', 'un', 'vai', 'kods', 'personas', 'dzimsanas', 'datums', 'talrunis', 'telefons', 'epasts', 'pasts', 'adrese', 'deklareta', 'faktiska', 'macibu', 'iestade', 'klase', 'kurss', 'grupa', 'radnieciba', 'saistiba', 'aizpildiet', 'aizpildi', 'noradiet', 'ievadiet', 'obligati', 'paraugs', 'piemers', 'ludzu', 'rakstiet']);
  function isInstruction(fieldKey, text) {
    const n = U.norm(text); if (!n) return true;
    const label = U.norm(CP.FIELD[fieldKey]?.l || '');
    if (label && n === label) return true;
    if (CAPTIONS.has(n)) return true;
    const words = n.split(' ').filter(Boolean);
    if (words.length && words.every(w => CAPTION_WORDS.has(w) || w.length <= 1)) return true;
    const kind = CP.FIELD[fieldKey]?.v;
    if ((kind === 'name' || kind === 'fullname') && words.length > 5) return true;
    return false;
  }
  function stripCaption(fieldKey, text) {
    let s = String(text || '').replace(/\s+/g, ' ').trim(); if (!s) return '';
    const labels = [...new Set([CP.FIELD[fieldKey]?.l, ...CP.FIELDS.filter(f => !f.noScan).map(f => f.l)].filter(Boolean))];
    let changed = true;
    while (changed) {
      changed = false;
      for (const l of labels) {
        const re = new RegExp('^' + l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[:\\-–]?\\s*', 'i');
        if (re.test(s)) { s = s.replace(re, '').trim(); changed = true; }
      }
    }
    // paskaidrojumi iekavās vai beigās, piem. “Kalniņš (vārds, uzvārds)”
    s = s.replace(/[(\[]([^)\]]*)[)\]]/g, (m, x) => isInstruction(fieldKey, x) ? ' ' : m).replace(/\s+/g, ' ').trim();
    let ws = s.split(' ');
    while (ws.length > 1 && CAPTION_WORDS.has(U.norm(ws[ws.length - 1]).replace(/[^a-z]/g, ''))) ws.pop();
    s = ws.join(' ').replace(/[,;:\-–]+$/, '').trim();
    return isInstruction(fieldKey, s) ? '' : s;
  }
  function consentValue(raw) {
    const n = U.norm(raw);
    if (/nepiekrit/.test(n)) return 'no';
    if (/piekrit/.test(n) || n === 'ja') return 'yes';
    return '';
  }
  function activeZones() {
    return ((SC.editing ? SC.draft : SC.tpl)?.zones || []).filter(z => CP.FIELD[z.f] && !CP.FIELD[z.f].noScan);
  }
  /** Vārdi no visas lapas: Word/PDF teksts — precīzi; skenējums — izvēlētais dzinējs (Tesseract vai Google Vision). */
  async function ensureWords(d) {
    if (d.kind === 'docx' || d.source === 'docx' || d.source === 'ocr' || !d.pages?.length) return;
    if (d.source === 'text' && (d.words || []).length > 15) return;
    const g = CP.ocr.engine() === 'google';
    d.words = await CP.ocr.pageWords(d.pages, (t, p) => msg((g ? t : t) + '…', 'busy', p));
    d.source = 'ocr';
  }
  /** 2. kārta: nedrošos laukus atpazīst vēlreiz tikai to apgabalā, ar atļautajiem simboliem */
  async function refine(ex) {
    const min = S.db.settings.ocr.minConf, V = ex.values;
    const REFINE = ['personalCode', 'phone', 'email', 'date', 'fullname', 'schoolClass'];   // adreses pirmajā kārtā parasti jau ir labākas
    const todo = Object.entries(V).filter(([k, v]) => REFINE.includes(CP.FIELD[k]?.v) && v.box && !v.zoned && (v.boxed || !(CP.ocr.clean(k, v.raw).ok && v.conf >= min)));
    // vārds un uzvārds parasti nāk no viena apgabala
    if (V.first?.box && V.first.box === V.last?.box && !V.first.zoned && !(CP.ocr.clean('first', V.first.raw).ok && CP.ocr.clean('last', V.last.raw).ok && V.first.conf >= min)) todo.push(['_name', V.first]);
    let i = 0;
    for (const [k, v] of todo) {
      msg(`Precizē laukus (${++i}/${todo.length})…`, 'busy', i / todo.length);
      const field = k === '_name' ? 'parentName' : k;
      if (v.boxed) {   // personas kods rūtiņās — vispirms katrs cipars atsevišķi
        const bd = await CP.ocr.boxedDigits(SC.doc.pages, v.box);
        if (bd && CP.ocr.clean(k, bd.text).ok) { Object.assign(v, { raw: bd.text, conf: 92 }); continue; }
      }
      const r = await CP.ocr.region(SC.doc.pages, v.box, field) || { text: '', conf: 0 };
      if (!r.text) continue;
      if (k === '_name') {
        const c = CP.ocr.clean('parentName', r.text); if (!c.ok || r.conf < v.conf) continue;
        const parts = c.value.split(' '); V.first = { ...V.first, raw: parts[0], conf: r.conf }; V.last = { ...V.last, raw: parts.slice(1).join(' '), conf: r.conf }; continue;
      }
      const c1 = CP.ocr.clean(k, v.raw), c2 = CP.ocr.clean(k, r.text), best = r;
      if (c2.ok && (v.raw || '').trim() && (!c1.ok || best.conf > v.conf)) Object.assign(v, { raw: best.text, conf: CP.FIELD[k].v === 'personalCode' ? Math.max(best.conf, 90) : best.conf });
      // tukšam laukam pieņem tikai stingri pārbaudāmu vērtību (kods, tālrunis, e-pasts, datums)
      else if (!(v.raw || '').trim() && c2.ok && ['personalCode', 'phone', 'email', 'date'].includes(CP.FIELD[k].v)) Object.assign(v, { raw: best.text, conf: CP.FIELD[k].v === 'personalCode' ? 90 : best.conf });
    }
  }

  const filledCount = ex => Object.values(ex?.values || {}).filter(v => (v?.raw || '').trim()).length;
  async function read() {
    const d = SC.doc; if (!d) return msg('Vispirms atver dokumentu', 'warn');
    if (SC.busy) return; SC.busy = true; buttons();
    try {
      if (SC.editing) { redraw(); msg('Iezīmē zonas un katrai izvēlies personas kartītes lauku.', 'info'); return; }
      const zones = d.kind === 'docx' || d.source === 'docx' ? [] : activeZones();
      if (CP.ocr.engine() === 'google' && d.kind !== 'docx' && d.source !== 'docx') msg('Sūta lapas attēlu uz Google Vision…', 'busy', 0.1);
      if (zones.length) {
        // Veidne: tikai iezīmētās zonas. Google gadījumā — no Google atpazītajiem vārdiem zonā.
        if (CP.ocr.engine() === 'google') await ensureWords(d);
        const values = {};
        let i = 0;
        for (const z of zones) {
          msg(`Nolasa zonu ${++i}/${zones.length}…`, 'busy', i / zones.length);
          values[z.f] = await readZone(z.f, z);
        }
        if (d.pages?.length && d.source !== 'text') d.source = 'ocr';
        SC.res = { values }; SC.lines = CP.reader.lines(d.words || []);
        applyZones(values);
        return;
      }
      // Bez veidnes: lasītājs pēc etiķetēm un izkārtojuma (Jaunsardzes anketa vai vispārīgs profils)
      await ensureWords(d);
      let ex = CP.reader.extract(d);
      if (d.source === 'text' && filledCount(ex) < 3 && d.pages?.length) {   // PDF teksta slānī nav aizpildījuma — droši vien skenējums
        d.words = []; d.source = 'none'; await ensureWords(d); ex = CP.reader.extract(d);
      }
      if (d.source === 'ocr') await refine(ex);   // Google gadījumā darbojas tikai rūtiņu cipari (lokāli)   // 2. kārta: rūtiņas pa cipariem, neskaidrie lauki atkārtoti
      SC.res = ex; SC.lines = d.kind === 'docx' ? [] : CP.reader.lines(d.words || []);
      if (!filledCount(ex)) {
        redraw();
        msg(`Dokuments atvērts, bet automātiski atrast laukus neizdevās${(d.words || []).length < 10 ? ' (dokumentā gandrīz nav atpazīta teksta)' : ''}. Klikšķini uz teksta dokumentā, lai ieliktu to aktīvajā laukā, vai izveido veidni (✎).`, 'warn');
        return;
      }
      applyZones(ex.values, true);
    } catch (e) { msg(e.message, 'err'); console.error(e); }
    finally { SC.busy = false; buttons(); }
  }
  A.scanRun = async () => { if (!SC.doc) return; clearHints(); SC.edited.clear(); ui.fillForm(form, D.person(U.$('scanTarget').value) || null); await read(); };

  function markZone(el, kind, html) {
    const box = el.closest('.field'), hint = box.querySelector('.hint');
    box.classList.add('has-zone'); box.classList.remove('auto', 'check');
    if (kind) box.classList.add(kind);
    hint.innerHTML = html || '';
  }
  /** Ieliek pārbaudes formā tikai zonas rezultātu, kas iztur lauka pārbaudi un nav anketas paskaidrojums. */
  /** “Vārds Uzvārds” vienā zonā/rindā → sadala vārdā un uzvārdā */
  function splitName(values, fk, lk) {
    const F = values[fk], L = values[lk];
    const rf = stripCaption(fk, F?.raw || ''), rl = stripCaption(lk, L?.raw || '');
    const same = rf && rl && U.norm(rf) === U.norm(rl);
    if (!rf || (rl && !same)) return;
    const parts = rf.split(/\s+/).filter(Boolean); if (parts.length < 2 || parts.length > 4) return;
    values[fk] = { ...F, raw: parts[0] };
    values[lk] = { ...(L || F), raw: parts.slice(1).join(' ') };
  }
  function applyZones(values, auto) {
    values = { ...(values || {}) };
    splitName(values, 'first', 'last');
    let filled = 0, missed = 0, check = 0;
    for (const [k, v] of Object.entries(values || {})) {
      const el = form.elements[k]; if (!el || !v) continue;
      const stripped = stripCaption(k, v.raw);
      if (k === 'photoConsent') {
        const val = stripped ? consentValue(stripped) : '';
        SC.found[k] = { ...v, ok: !!val, value: val, raw: stripped };
        if (!val) { missed++; markZone(el, 'check', '<div class="sugg"><span>Nav atpazīts</span></div>'); continue; }
        if (!SC.edited.has(k) && !el.value) { el.value = val; markZone(el, 'auto', ''); filled++; }
        else markZone(el, '', '');
        continue;
      }
      if (!stripped) {
        SC.found[k] = { ...v, ok: false, value: '', raw: '' };
        missed++; markZone(el, 'check', '<div class="sugg"><span>Nav atpazīts</span></div>'); continue;
      }
      const c = CP.ocr.clean(k, stripped);
      SC.found[k] = { ...v, ...c, raw: stripped };
      if (c.ok && c.value && !SC.edited.has(k) && !el.value) { el.value = c.value; markZone(el, 'auto', ''); filled++; }
      else if (el.value && c.ok && String(el.value) === String(c.value)) markZone(el, '', '');
      else if (c.ok && c.value && el.value) {
        check++;
        markZone(el, 'check', `<div class="sugg"><span>Dokumentā: <b>${esc(c.value)}</b></span><button type="button" class="sm" data-act="scanUse" data-arg="${esc(k)}">Lietot</button></div>`);
      } else {
        check++;
        markZone(el, 'check', `<div class="sugg"><span>Neskaidrs: <b>${esc(stripped)}</b> <small>${esc(c.msg || 'jāpārbauda')}</small></span></div>`);
      }
    }
    if (filled || check) SC.saved = false;
    redraw();
    const name = auto ? 'Atrasts automātiski. ' : SC.tpl ? `Veidne “${SC.tpl.name}”. ` : '';
    msg(`${name}${auto ? 'Aizpildīti' : 'No zonām'}: ${filled} lauki${check ? `, ${check} neskaidri un nav ievietoti` : ''}${missed ? `, ${missed} nav atpazīti` : ''}. Kartītē dati nonāk pēc apstiprinājuma.`, check || missed ? 'warn' : 'ok');
  }
  A.scanUse = k => {
    const f = SC.found[k], el = form.elements[k]; if (!f || !el) return;
    el.value = f.value; SC.edited.add(k); SC.saved = false; const box = el.closest('.field'); box.classList.remove('check'); box.classList.add('auto'); box.querySelector('.hint').innerHTML = '';
    if (k === 'personalCode' && !form.elements.birth.value) form.elements.birth.value = U.birthFromCode(f.value);
  };

  /* --- Lauks ↔ dokuments --- */
  function focusField(k) {
    const f = SC.found[k] || SC.res?.values?.[k]; if (!SC.doc) return;
    if (SC.doc.kind === 'docx') { viewer.markBlocks(f?.blks || []); return; }
    const src = SC.editing ? SC.draft : SC.tpl;
    const z = src?.zones?.find(z => z.f === k);
    SC.activeZone = z?.id || '';
    if (SC.editing) {
      redraw(); if (z) viewer.reveal(z);
      msg(`Zona laukam “${CP.FIELD[k]?.l}”.${z ? ' Velc, lai pārvietotu, stūris maina izmēru.' : ' Novelc taisnstūri vietā, kur rakstīta atbilde.'}`, 'info');
      return;
    }
    redraw(f?.box || z || null);
    const box = f?.box || z; if (box) viewer.reveal(box);
  }

  /* --- Veidnes: zonas proporcionāli lapai --- */
  const tpls = () => S.db.settings.formTemplates;
  function zoneFields() {
    const sec = Object.fromEntries(CP.SECTIONS);
    return CP.FIELDS.filter(f => !f.noScan).map(f => ({ k: f.k, l: (sec[f.s] ? sec[f.s] + ' — ' : '') + f.l }));
  }
  function tplOptions() {
    U.$('scanTpl').innerHTML = '<option value="">Automātiski (pēc etiķetēm)</option>' + tpls().map(t => `<option value="${t.id}">${esc(t.name)} · ${t.zones.length} zonas</option>`).join('');
  }
  function selectTpl(id) { SC.tpl = tpls().find(t => t.id === id) || null; U.$('scanTpl').value = SC.tpl?.id || ''; buttons(); if (SC.doc && !SC.editing) redraw(); }
  function zonesNow() {
    const t = SC.editing ? SC.draft : SC.tpl; if (!t) return [];
    return t.zones.map(z => ({ ...z, page: z.page || 0, label: CP.FIELD[z.f]?.l || 'Lauks…', on: z.f === SC.cur || (z.id && z.id === SC.activeZone) }));
  }
  function redraw(active = null) { if (SC.doc && SC.doc.kind !== 'docx') viewer.overlay({ lines: SC.editing ? [] : SC.lines, active, zones: zonesNow(), editing: SC.editing, fields: zoneFields() }); }
  let zoneJobs = 0;
  scan.zoneJobs = () => zoneJobs;
  /** Teksts tikai no šīs zonas. Tukša zona paliek tukša — visa dokumenta teksts netiek izmantots. */
  async function readZone(k, z) {
    zoneJobs++;
    try { return await readZoneNow(k, z); }
    finally { zoneJobs--; }
  }
  async function readZoneNow(k, z) {
    const d = SC.doc;
    const box = { page: z.page || 0, x: +z.x, y: +z.y, w: +z.w, h: +z.h };
    const fromWords = () => {
      const ws = (d.words || []).filter(w => w.p === box.page && (w.x0 + w.x1) / 2 >= box.x && (w.x0 + w.x1) / 2 <= box.x + box.w && (w.y0 + w.y1) / 2 >= box.y && (w.y0 + w.y1) / 2 <= box.y + box.h);
      return { raw: ws.map(w => w.t).join(' ').trim(), conf: ws.length ? Math.min(...ws.map(w => w.conf ?? 100)) : 0, box, zoned: true };
    };
    if (d.source === 'text') return fromWords();                       // PDF ar teksta slāni — precīzi
    if (!d.pages?.length) return { raw: '', conf: 0, box, zoned: true };
    if (CP.FIELD[k]?.v === 'personalCode') {                            // rūtiņas — pa cipariem, lokāli
      const bd = await CP.ocr.boxedDigits(d.pages, box);
      if (bd?.text && CP.ocr.clean(k, bd.text).ok) return { raw: bd.text, conf: 92, box, zoned: true };
    }
    if (CP.ocr.engine() === 'google') return fromWords();               // Google Vision vārdi zonā
    const r = await CP.ocr.region(d.pages, box, k) || { text: '', conf: 0 };
    return { raw: r.text || '', conf: r.conf || 0, box, zoned: true };
  }
  A.scanTplEdit = () => {
    if (!SC.doc) return msg('Vispirms atver dokumenta paraugu — skenētu PDF vai attēlu.', 'warn');
    if (SC.doc.kind === 'docx') return msg('Zonas ir skenētiem PDF un attēliem. Word un eDoc anketas tiek nolasītas precīzi automātiski.', 'info');
    SC.editing = true;
    SC.draft = SC.tpl ? JSON.parse(JSON.stringify(SC.tpl)) : { id: '', name: `Veidne ${tpls().length + 1}`, zones: [] };
    delete SC.draft.anchors;
    SC.draft.zones.forEach(z => { if (!z.id) z.id = U.uid(); });
    U.$('tplName').value = SC.draft.name; U.$('tplDelBtn').classList.toggle('hidden', !SC.draft.id); U.$('scanTplBar').classList.remove('hidden');
    viewer.setMode('draw'); buttons(); tplCount(); redraw();
    const first = fieldOrder.find(k => !SC.draft.zones.some(z => z.f === k)) || 'first';
    form.elements[first]?.focus();
  };
  async function drawZone(rect) {
    if (!SC.editing) return;
    const k = CP.FIELD[SC.cur] && !CP.FIELD[SC.cur].noScan ? SC.cur : '';
    if (k) SC.draft.zones = SC.draft.zones.filter(z => z.f !== k);
    const z = { id: U.uid(), f: k, page: rect.page || 0, x: rect.x, y: rect.y, w: rect.w, h: rect.h };
    SC.draft.zones.push(z);
    SC.activeZone = z.id; tplCount(); redraw();
    if (!k) { msg('Zona uzzīmēta. Izvēlies tai personas kartītes lauku.', 'info'); return; }
    const r = await readZone(k, z);
    applyZones({ [k]: r });
  }
  async function moveZone(id, rect) {
    if (!SC.editing || !SC.draft) return;
    const z = SC.draft.zones.find(z => z.id === id); if (!z) return;
    Object.assign(z, { page: rect.page || 0, x: rect.x, y: rect.y, w: rect.w, h: rect.h });
    redraw();
    if (!z.f) return;
    const r = await readZone(z.f, z);
    applyZones({ [z.f]: r });
  }
  async function assignZone(id, f) {
    if (!SC.editing || !SC.draft) return;
    const z = SC.draft.zones.find(z => z.id === id); if (!z) return;
    if (!CP.FIELD[f] || CP.FIELD[f].noScan) { z.f = ''; tplCount(); redraw(); return; }
    SC.draft.zones = SC.draft.zones.filter(o => o === z || o.f !== f);
    z.f = f; SC.cur = f; SC.activeZone = z.id;
    form.elements[f]?.focus(); tplCount(); redraw();
    const r = await readZone(f, z);
    applyZones({ [f]: r });
  }
  function deleteZone(id) { if (!SC.editing) return; SC.draft.zones = SC.draft.zones.filter(z => z.id !== id); tplCount(); redraw(); }
  const tplCount = () => { U.$('tplCount').textContent = SC.draft?.zones.length ? `Zonas: ${SC.draft.zones.length}. ${SC.draft.zones.map(z => CP.FIELD[z.f]?.l || 'bez lauka').join(', ')}` : 'Vēl neviena zona.'; };
  function endEdit() { SC.editing = false; SC.draft = null; SC.activeZone = ''; U.$('scanTplBar').classList.add('hidden'); viewer.setMode('view'); buttons(); redraw(); }
  function storedZone(z) {
    const x = +z.x, y = +z.y, w = +z.w, h = +z.h;
    if (![x, y, w, h].every(n => Number.isFinite(n) && n >= 0 && n <= 1) || w < 0.004 || h < 0.004) return null;
    if (!CP.FIELD[z.f] || CP.FIELD[z.f].noScan) return null;
    return { id: String(z.id || U.uid()), f: z.f, page: Math.max(0, Number(z.page) || 0), x, y, w, h };
  }
  scan.normalizeTemplate = raw => {
    if (!raw || typeof raw !== 'object') return null;
    const zones = (Array.isArray(raw.zones) ? raw.zones : []).map(storedZone).filter(Boolean);
    const name = String(raw.name || '').trim().slice(0, 80);
    if (!name || !zones.length) return null;
    return { id: String(raw.id || U.uid()), name, createdAt: raw.createdAt || U.now(), zones };
  };
  A.scanTplSave = () => {
    const name = U.$('tplName').value.trim(); if (!name) return msg('Ievadi veidnes nosaukumu', 'warn');
    if (!SC.draft.zones.length) return msg('Iezīmē vismaz vienu zonu', 'warn');
    if (SC.draft.zones.some(z => !CP.FIELD[z.f])) return msg('Katrai zonai izvēlies personas kartītes lauku', 'warn');
    const clean = scan.normalizeTemplate({ ...SC.draft, name }); if (!clean) return msg('Zonu koordinātas nav derīgas', 'warn');
    const s = S.db.settings;
    if (SC.draft.id) { clean.id = SC.draft.id; s.formTemplates = s.formTemplates.map(x => x.id === clean.id ? clean : x); }
    else s.formTemplates.push(clean);
    s.activeTemplate = clean.id; CP.store.changed({ silent: true });
    endEdit(); tplOptions(); selectTpl(clean.id);
    msg(`Veidne “${name}” saglabāta (${clean.zones.length} zonas) datu failā.`, 'ok');
    if (SC.doc) A.scanRun();
  };
  A.scanTplCancel = () => { endEdit(); msg('Zonu rediģēšana atcelta. Saglabātā veidne nav mainīta.', 'info'); };
  A.scanTplDelete = () => {
    const t = SC.draft; if (!t?.id || !confirm(`Dzēst veidni “${t.name}”?`)) return;
    const s = S.db.settings; s.formTemplates = s.formTemplates.filter(x => x.id !== t.id); if (s.activeTemplate === t.id) s.activeTemplate = '';
    CP.store.changed({ silent: true }); endEdit(); tplOptions(); selectTpl(''); msg('Veidne dzēsta', 'ok');
  };
  scan.openEditor = id => {
    A.scan();
    SC.pendingEdit = true;
    if (id) selectTpl(id);
    msg('Augšupielādē dokumenta paraugu — skenētu PDF vai attēlu. Pēc tam ar peli iezīmē zonas.', 'info');
  };
  A.scanZoom = k => { form.elements[k]?.focus(); if (!(SC.found[k] || SC.res?.values[k])) msg(`Laukam “${CP.FIELD[k]?.l}” vieta dokumentā netika atrasta.`, 'info'); };
  function lineClick(i, e) {
    const l = SC.lines[i], el = form.elements[SC.cur]; if (!l || !el || el.tagName === 'SELECT') return;
    let v = l.words.filter(w => !w.isLabel).map(w => w.t).join(' ') || l.text;
    const c = CP.ocr.clean(SC.cur, v), val = c.ok && c.value ? c.value : v;
    el.value = e.shiftKey && el.value ? el.value + ' ' + v : val;
    SC.edited.add(SC.cur); SC.saved = false; const box = el.closest('.field'); box.classList.remove('check'); box.classList.add('auto');
    msg(c.ok || e.shiftKey ? `Ielikts laukā “${CP.FIELD[SC.cur]?.l}”.` : `Ielikts laukā “${CP.FIELD[SC.cur]?.l}”, bet pārbaudi: ${c.msg}`, c.ok || e.shiftKey ? 'ok' : 'warn');
    el.focus();
  }

  /* --- Saglabāšana --- */
  A.scanSave = async arg => {
    if (SC.busy) return msg('Uzgaidi, kamēr beigsies nolasīšana', 'warn');
    const o = ui.readForm(form); delete o.status; delete o.retentionMonths;
    if (!o.birth && o.personalCode) o.birth = U.birthFromCode(o.personalCode);
    const chk = ui.checkForm(form, o);
    if (chk.errors) { msg('Aizpildi obligātos laukus (vārds un uzvārds)', 'err'); U.qs('.field.bad input', form)?.focus(); return; }
    const dupN = ui.phoneHints(form, U.$('scanTarget').value);
    if ((chk.warnings || dupN) && !form.dataset.warned) { form.dataset.warned = '1'; msg(dupN ? 'Tālruņa numurs sakrīt ar citas personas numuru (skat. pie lauka). Pārbaudi vai spied apstiprinājumu vēlreiz.' : 'Dažas vērtības izskatās aizdomīgas (iezīmētas). Labo tās vai spied apstiprinājumu vēlreiz, lai saglabātu tāpat.', 'warn'); (U.qs('.field.warn input', form) || U.qs('.duphint.bad', form)?.closest('.field').querySelector('input'))?.focus(); return; }
    const target = U.$('scanTarget').value; let p;
    if (target) p = CP.people.savePerson(Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null)), target, 'scan');
    else {
      const dup = D.duplicates(o);
      if (dup.length && !confirm(`Iespējams dublikāts: ${dup.map(U.full).join(', ')}.\nVienalga izveidot jaunu personu?\n\n(Lai papildinātu esošo, izvēlies to laukā “Kur ievadīt”.)`)) return;
      p = CP.people.savePerson({ ...o, status: U.$('scanStatus').value, joined: o.joined || U.iso(), retentionMonths: S.db.settings.retentionDefault }, null, 'scan');
    }
    let note = '';
    if (SC.file && !SC.file._linked) {
      if (S.root) {
        try {
          const ext = (SC.file.name.split('.').pop() || 'pdf').toLowerCase(), d = SC.doc;
          const format = d.container === 'edoc' || ext === 'edoc' ? 'edoc' : (d.source === 'docx' || d.source === 'text') ? 'pdf' : 'paper';
          await CP.store.ensurePersonYearFolder(p);
          const path = await CP.store.saveFile(CP.store.yearPersonDir(p), `Pieteikuma anketa ${U.iso()}.${ext}`, SC.file);
          CP.docs.link(p.id, S.db.settings.docKinds.includes('Pieteikuma anketa') ? 'Pieteikuma anketa' : D.guessKind('anketa'), format, path, 'main');
          note = ' Anketa pievienota kartiņas dokumentiem.';
        } catch (e) { note = ' Anketas failu neizdevās saglabāt: ' + e.message; }
      } else note = ' Anketas fails nav saglabāts — nav izvēlēta datu mape.';
    }
    SC.saved = true; CP.store.changed({ silent: true });
    if (arg === 'next') {
      resetDoc(); U.$('scanTarget').value = ''; fillFromPerson('');
      U.$('scanTarget').insertAdjacentHTML('beforeend', `<option value="${p.id}">Papildināt: ${esc(U.sortName(p))}</option>`);
      msg(`✓ Saglabāts: ${U.full(p)}.${note} Atver nākamo anketu.`, 'ok');
    } else {
      U.$('scanDialog').close(); S.page = 'person'; S.selected = p.id; S.tab = 'overview'; CP.render();
      ui.toast(`Saglabāts: ${U.full(p)}.${note}`, /neizdevās|nav saglabāts/.test(note) ? 'warn' : 'ok', 9000, D.contacts(p).some(c => U.normPhone(c.phone)) ? { label: '📇 Saglabāt kontaktos', act: 'vcard', arg: p.id } : null);
    }
  };

  scan.state = SC;   // diagnostikai (konsolē: CP.scan.state)
  CP.scan = scan;
})(window.CP);


/* ==== js/pdfgen.js ==== */
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
    // tieši tik rindu, cik dalībnieku + lietotāja norādītās tukšās rindas
    const blank = Math.max(0, Math.min(60, Number(ev.blankRows) || 0)), totalRows = rows.length + blank;
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
    const sTotal = sRows.length + Math.max(0, Math.min(30, Number(ev.staffBlankRows) || 0));   // izvēlētie + norādītās tukšās rindas
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
    const pTotal = pRows.length + Math.max(0, Math.min(60, Number(ev.blankRows) || 0));
    for (let i = pRows.length; i < pTotal; i++) pRows.push([`${i + 1}.`, '', '', '', '', '', '', '']);
    t = table(ctx, { page: p2, newPage: add, x: M, yTop: y, yMin: 16 * MM, cols: pCols, head: { h1: 26, h2: 34, groups: [{ from: 6, to: 7, title: 'Paraksts par iepazīšanos ar nometnes' }] }, rows: pRows, minH: 30, size: 9.5 });
    footer(t.page, t.y - 24);
    pageNumbers(ctx, W);
    return doc.save();
  }

  /* =================== Apmeklējuma veidlapa (mēnesis, grupa) =================== */
  /** o = { title, group, monthTitle ('Jūlijā'), dates:[iso], people:[p], marks: pid→{iso→kods} | null, legend, instructor } */
  async function attendance(o) {
    const ctx = await newDoc(`Apmeklējums — ${o.group || ''} ${o.monthTitle || ''}`), { doc, F, text } = ctx;
    const land = o.dates.length > 9;
    const W = land ? 841.89 : 595.28, H = land ? 595.28 : 841.89, M = 12 * MM, cw = W - 2 * M;
    const add = () => { const pg = doc.addPage([W, H]); pg.__top = H - 14 * MM; return pg; };
    const p1 = add(); let y = H - 16 * MM;
    text(p1, o.title || 'Nodarbību apmeklējums', W / 2, y, { font: F.b, size: 14, align: 'center' }); y -= 16;
    text(p1, [o.group && `Grupa: ${o.group}`, o.year].filter(Boolean).join(' · '), W / 2, y, { size: 10.5, align: 'center' }); y -= 14;
    const nW = 13 * MM, nameW = Math.min(55 * MM, Math.max(40 * MM, cw * 0.28)), dW = o.dates.length ? (cw - nW - nameW) / o.dates.length : 0;
    const cols = [{ title: 'N.P.K.', w: nW, align: 'center' }, { title: 'V. UZVĀRDS', w: nameW }, ...o.dates.map(d => ({ title: d.slice(8, 10) + '.', w: dW, align: 'center', bold: true }))];
    if (!o.dates.length) cols[1].w = cw - nW;
    const rows = o.people.map((pp, i) => [`${i + 1}.`, U.full(pp), ...o.dates.map(d => { const c = o.marks?.[pp.id]?.[d] || ''; return c === '+' ? '+' : c; })]);
    for (let i = 0; i < (o.blank || 0); i++) rows.push([`${rows.length + 1}.`, '', ...o.dates.map(() => '')]);
    const t = table(ctx, { page: p1, newPage: add, x: M, yTop: y, yMin: 18 * MM, cols, head: { h1: 16, h2: 16, groups: o.dates.length ? [{ from: 2, to: cols.length - 1, title: `Nodarbības ${o.monthTitle || ''}`.trim() }] : [] }, rows, minH: 17, size: 10 });
    let fy = t.y - 16;
    if (o.legend) { text(t.page, o.legend, M, fy, { size: 8.5, color: ctx.grey }); fy -= 16; }
    text(t.page, `${o.instructor ? o.instructor + ' ' : 'Instruktors '}_____________________`, W - M, fy, { size: 10, align: 'right' });
    pageNumbers(ctx, W);
    return doc.save();
  }

  CP.pdf = { load, instruction, camp, attendance };
})(window.CP);


/* ==== js/docxfill.js ==== */
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
  async function zip(entries) {
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
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
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

  CP.docxFill = { fill, data, FIELDS_HELP };
})(window.CP);


/* ==== js/forms.js ==== */
/* =====================================================================
   Veidlapas: drošības instruktāžas lapa un nometnes žurnāls.
   - Pasākums (S.db.events) glabā nosaukumu, laikus, dalībniekus, darbiniekus, audzinātājus.
   - Dalībnieku izvēle: meklēšana, grupa, “atzīmēt redzamos”, atsevišķi.
   - Brīdinājums (tikai rīkā): trūkst/nederīga anketa, līgums, ārsta izziņa. Pievienot drīkst.
   - Rezultāts: PDF (rīka veidne) vai aizpildīts Word (lietotāja veidne ar {atzīmēm}).
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const ic = (n, f = '') => CP.ic(n, f);
  const TYPES = { instr: { l: 'Drošības instruktāžas lapa', short: 'Instruktāža', icon: 'clipboard' }, camp: { l: 'Nometnes žurnāls', short: 'Nometne', icon: 'users' } };
  CP.FORM_TYPES = TYPES;
  const st = () => S.db.settings;
  const staffList = () => st().staff || [];
  const staffById = id => staffList().find(s => s.id === id);

  /** Dokumentu problēmas dalībai pasākumā (tikai rīkā, nevis uz veidlapas) */
  D.eventDocIssues = p => p?._ext ? [] : D.missingDocs(p);
  const MONTHS_GEN = ['janvāris', 'februāris', 'marts', 'aprīlis', 'maijs', 'jūnijs', 'jūlijs', 'augusts', 'septembris', 'oktobris', 'novembris', 'decembris'];
  /** “2026. gada 17.–18. oktobris” no datumiem */
  function whenText(from, to) {
    const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(from || ''); if (!a) return '';
    const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(to || '') || a;
    const [, y1, m1, d1] = a, [, y2, m2, d2] = b;
    if (from === to || !to) return `${y1}. gada ${+d1}. ${MONTHS_GEN[m1 - 1]}`;
    if (y1 === y2 && m1 === m2) return `${y1}. gada ${+d1}.–${+d2}. ${MONTHS_GEN[m1 - 1]}`;
    if (y1 === y2) return `${y1}. gada ${+d1}. ${MONTHS_GEN[m1 - 1]} – ${+d2}. ${MONTHS_GEN[m2 - 1]}`;
    return `${y1}. gada ${+d1}. ${MONTHS_GEN[m1 - 1]} – ${y2}. gada ${+d2}. ${MONTHS_GEN[m2 - 1]}`;
  }

  /* ---------------- Saraksts ---------------- */
  /** Dalībnieki: savējie (no personu saraksta) + citu vienību (glabājas tikai pasākumā: ev.external) */
  const extPerson = x => ({ ...x, _ext: true, _extGroup: x.group || '' });
  const evPeople = ev => [...(ev.participants || []).map(x => D.person(x.pid)).filter(Boolean), ...(ev.external || []).map(extPerson)];
  const evStaff = ev => [...staffList(), ...(ev.extStaff || [])];
  { const og = D.groupOf; D.groupOf = (p, y) => p?._ext ? (p._extGroup || '') : og(p, y); }
  /* Visas sagatavotās veidlapas vienā sarakstā: pasākumi (instruktāža, nometne) + līgumi no personu kartītēm */
  const KIND = { instr: { l: 'Instruktāža', icon: 'clipboard' }, camp: { l: 'Nometne', icon: 'users' }, contract: { l: 'Līgums', icon: 'file' } };
  const CVAR = { 'jaunietis-papirs': 'ar jaunieti, papīrs', 'parstavis-papirs': 'ar pārstāvi, papīrs', 'jaunietis-edoc': 'ar jaunieti, EDOC', 'parstavis-edoc': 'ar pārstāvi, EDOC' };
  function allItems() {
    const out = [];
    for (const ev of S.db.events || []) {
      const ps = evPeople(ev);
      out.push({ kind: ev.type === 'camp' ? 'camp' : 'instr', id: ev.id, date: String(ev.dateFrom || ev.instrDate || ev.createdAt || '').slice(0, 10), title: ev.title || '(bez nosaukuma)', ev, ps,
        hay: U.norm([ev.title, ev.when, ev.group, ...ps.map(U.full)].join(' ')) });
    }
    for (const p of S.db.people || []) for (const c of p.contracts || []) {
      out.push({ kind: 'contract', id: c.id, date: String(c.date || c.at || '').slice(0, 10), title: `Līgums ${c.no ? 'Nr. ' + c.no : '(bez numura)'}`, p, c,
        hay: U.norm([U.full(p), U.sortName(p), c.no, D.groupOf(p)].join(' ')) });
    }
    return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }
  let showN = 40;
  CP.pages.forms = {
    render() {
      const F = S.formFilter || (S.formFilter = { kind: '', q: '', from: '', to: '', year: '' });
      const all = allItems(), [yf, yt] = F.year ? U.yearSpan(F.year) : ['', ''];
      const base = all.filter(x => (!F.q || x.hay.includes(U.norm(F.q))) && (!F.from || x.date >= F.from) && (!F.to || x.date <= F.to) && (!F.year || (x.date >= yf && x.date <= yt)));
      const list = base.filter(x => !F.kind || x.kind === F.kind);
      const cnt = k => base.filter(x => x.kind === k).length;
      const chip = (k, l) => `<button class="chipbtn ${F.kind === k ? 'on' : ''}" data-act="ffKind" data-arg="${k}">${l} <small>${k ? cnt(k) : base.length}</small></button>`;
      const years = [...new Set(all.map(x => /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? U.schoolYear(x.date + 'T12:00:00') : '').filter(y => /^\d{4}-\d{4}$/.test(y)))].sort().reverse();
      const row = x => {
        const K = KIND[x.kind];
        if (x.kind === 'contract') {
          const { p, c } = x;
          return `<div class="row ev-row"><span class="feat-ic">${ic(K.icon)}</span><div class="grow"><b>${esc(x.title)}</b> <span class="tag">${K.l}</span>
            <div class="small muted"><a href="#" data-person="${p.id}">${esc(U.full(p))}</a> · ${esc(U.fmtDate(x.date))} · ${esc(CVAR[`${c.kind}-${c.form}`] || '')}${c.editedAt ? ` · labots ${esc(U.fmtDate(c.editedAt.slice(0, 10)))} (${(c.versions || []).length + 1}. versija)` : ''}</div></div>
            <button class="sm" data-act="contractEdit" data-arg="${p.id}|${c.id}" title="Atvērt līguma datus un sagatavot jaunu versiju">${ic('edit', '✎')} Labot</button>
            ${c.path ? `<button class="sm" data-act="contractView" data-arg="${p.id}|${c.id}">${ic('file', '📄')} Skatīt / drukāt</button><button class="sm ghost" data-act="contractOpen" data-arg="${p.id}|${c.id}" title="Lejupielādēt Word failu">${ic('download', '⬇')} Word</button>` : ''}
            <button class="sm ghost" data-act="contractUpload" data-arg="${p.id}|${c.id}" title="Ielādēt Word programmā labotu līgumu kā jaunu versiju">${ic('upload', '⬆')} Ielādēt labotu</button>
            <button class="sm ghost danger" data-act="contractDel" data-arg="${p.id}|${c.id}" title="Noņemt no saraksta">✕</button></div>`;
        }
        const ev = x.ev, ps = x.ps, warn = ps.filter(q => D.eventDocIssues(q).length).length;
        return `<div class="row ev-row"><span class="feat-ic">${ic(K.icon)}</span><div class="grow"><b>${esc(x.title)}</b> <span class="tag">${K.l}</span>
          <div class="small muted">${esc(ev.when || U.fmtDate(ev.instrDate) || '')} · ${ps.length} dalībnieki${warn ? ` · <span class="warn">⚠ ${warn} bez dokumentiem</span>` : ''}</div></div>
          <button class="sm" data-act="formOpen" data-arg="${ev.id}">${ic('edit', '✎')} Atvērt</button><button class="sm" data-act="formPdf" data-arg="${ev.id}">${ic('file', '📄')} PDF</button><button class="sm ghost" data-act="formPrint" data-arg="${ev.id}">Drukāt</button>
          <button class="sm ghost danger" data-act="formDelete" data-arg="${ev.id}" title="Dzēst pasākumu">✕</button></div>`;
      };
      const filtered = F.kind || F.q || F.from || F.to || F.year;
      const filters = `<div class="ff-bar">
          <input type="search" id="ffQ" placeholder="Meklēt: persona, nosaukums, līguma nr…" value="${esc(F.q)}" autocomplete="off">
          <label class="small muted">No <input type="date" data-ff="from" value="${esc(F.from)}"></label><label class="small muted">Līdz <input type="date" data-ff="to" value="${esc(F.to)}"></label>
          <select data-ff="year"><option value="">Visi mācību gadi</option>${years.map(y => `<option value="${y}" ${F.year === y ? 'selected' : ''}>${esc(U.yearLabel(y))}</option>`).join('')}</select>
          ${filtered ? `<button class="sm ghost" data-act="ffClear">Notīrīt filtrus</button>` : ''}</div>
        <div class="chips" style="margin:8px 0 4px">${chip('', 'Visi')}${chip('instr', 'Instruktāžas')}${chip('camp', 'Nometnes')}${chip('contract', 'Līgumi')}</div>`;
      const body = all.length ? (list.length ? list.slice(0, showN).map(row).join('') + (list.length > showN ? `<div class="actions" style="margin-top:8px"><button class="sm" data-act="ffMore">Rādīt vēl (${list.length - showN})</button></div>` : '') : '<p class="muted pad">Nekas neatbilst filtram.</p>')
        : ui.empty('Vēl nav sagatavotu veidlapu. Sāc ar “Instruktāžas lapa”, “Nometnes žurnāls” vai “Līgums”.');
      return `<div class="page">${ui.pageHead('Veidlapas', 'Instruktāžas lapas, nometņu žurnāli un līgumi no kartīšu datiem', `<button class="mainbtn" data-act="formNew" data-arg="instr">${ic('plus', '＋')} Instruktāžas lapa</button><button data-act="formNew" data-arg="camp">${ic('plus', '＋')} Nometnes žurnāls</button><button data-act="contractNew">${ic('plus', '＋')} Līgums</button>`)}
        <div class="cards2">
          <section class="card wide"><h3>${ic('clipboard')}Sagatavotās veidlapas <span class="pill">${list.length}${list.length !== all.length ? ' no ' + all.length : ''}</span></h3>${all.length ? filters : ''}<div class="ev-list-all">${body}</div></section>
          <section class="card"><h3>${ic('users')}Darbinieki un audzinātāji</h3>${staffCard()}</section>
          <section class="card"><h3>${ic('file')}Savas Word veidnes</h3>${tplCard()}</section>
        </div></div>`;
    }
  };
  A.ffKind = k => { S.formFilter.kind = k || ''; showN = 40; CP.render(); };
  A.ffClear = () => { S.formFilter = { kind: '', q: '', from: '', to: '', year: '' }; showN = 40; CP.render(); };
  A.ffMore = () => { showN += 40; renderKeepScroll(); };
  CP.inputHandlers.push(e => { if (e.target.id !== 'ffQ' || S.page !== 'forms') return false; S.formFilter.q = e.target.value; showN = 40; renderKeepFocus('ffQ'); return true; });
  CP.changeHandlers.push(e => { const k = e.target.dataset?.ff; if (!k || S.page !== 'forms') return false; S.formFilter[k] = e.target.value; showN = 40; setTimeout(() => CP.render(), 0); return true; });

  /* ---------------- Darbinieku saraksts (saglabājas, var dzēst) ---------------- */
  function staffCard() {
    const list = staffList();
    return `${list.length ? list.map(s => `<div class="row"><div class="grow"><b>${esc(s.name)}</b><div class="small muted">${esc([s.role, s.phone && U.prettyPhone(s.phone), s.counselor ? 'audzinātājs' : ''].filter(Boolean).join(' · '))}</div></div>
      <button class="sm ghost" data-act="staffEdit" data-arg="${s.id}">${ic('edit', '✎')}</button><button class="sm ghost danger" data-act="staffDelete" data-arg="${s.id}" title="Dzēst">✕</button></div>`).join('') : '<p class="muted small">Saraksts ir tukšs. Darbiniekus un audzinātājus ievadi vienreiz — nākamajās nometnēs tie būs izvēlami.</p>'}
      <div class="actions" style="margin-top:10px"><button class="sm" data-act="staffEdit">${ic('userPlus', '＋')} Pievienot</button></div>`;
  }
  A.staffEdit = id => {
    const s = staffById(id) || {}, f = U.$('staffForm');
    f.reset(); f.dataset.id = s.id || '';
    for (const k of ['name', 'personalCode', 'role', 'address', 'phone']) f.elements[k].value = s[k] || '';
    f.elements.counselor.checked = !!s.counselor;
    U.$('staffTitle').textContent = s.id ? 'Labot darbinieku' : 'Jauns darbinieks / audzinātājs';
    U.$('staffDialog').showModal(); f.elements.name.focus();
  };
  U.$('staffForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target, o = Object.fromEntries(new FormData(f)); for (const k in o) o[k] = String(o[k]).trim();
    o.counselor = f.elements.counselor.checked;
    if (!o.name) return;
    const list = st().staff = staffList();
    if (f.dataset.id) Object.assign(list.find(s => s.id === f.dataset.id), o);
    else { const ns = { id: U.uid(), ...o }; list.push(ns); if (S.formEdit && S.formEdit.type === 'camp') S.formEdit.staff = [...new Set([...(S.formEdit.staff || []), ns.id])]; }
    U.$('staffDialog').close(); CP.store.changed();
  });
  A.staffDelete = id => {
    const s = staffById(id); if (!s || !confirm(`Dzēst “${s.name}” no darbinieku saraksta?\n\nJau sagatavotos pasākumos vārds paliek tikai tad, ja PDF jau ir saglabāts.`)) return;
    st().staff = staffList().filter(x => x.id !== id);
    if (S.formEdit) { S.formEdit.staff = (S.formEdit.staff || []).filter(x => x !== id); if (S.formEdit.leaderId === id) S.formEdit.leaderId = ''; }
    CP.store.changed();
  };

  /* ---------------- Savas Word veidnes ---------------- */
  function tplCard() {
    const list = st().docTemplates || [];
    return `<p class="small muted" style="margin-top:0">Ielādē savu Word veidni ar atzīmēm, piem. <code>{nosaukums}</code>, <code>{datums}</code>, un tabulas rindu ar <code>{nr}</code> <code>{vards}</code>. Rīks to aizpildīs. Paraugus vari lejupielādēt un pielāgot.</p>
      ${list.map(t => `<div class="row"><div class="grow"><b>${esc(t.name)}</b><div class="small muted">${esc(t.type === 'contract' ? 'Līgums' : TYPES[t.type]?.l || '')}</div></div><button class="sm ghost danger" data-act="tplDocDelete" data-arg="${t.id}" title="Noņemt">✕</button></div>`).join('')}
      <div class="actions" style="margin-top:10px">
        <button class="sm" data-act="tplDocAdd" data-arg="instr">${ic('upload', '⬆')} Instruktāžas veidne</button><button class="sm" data-act="tplDocAdd" data-arg="camp">${ic('upload', '⬆')} Nometnes veidne</button><button class="sm" data-act="tplDocAdd" data-arg="contract">${ic('upload', '⬆')} Līguma veidne</button>
        <button class="sm ghost" data-act="tplDocSample" data-arg="instr">${ic('download', '⬇')} Paraugs: instruktāža</button><button class="sm ghost" data-act="tplDocSample" data-arg="camp">${ic('download', '⬇')} Paraugs: nometne</button><button class="sm ghost" data-act="tplDocSample" data-arg="contract">${ic('download', '⬇')} Paraugs: līgums</button></div>
      <details class="small" style="margin-top:10px"><summary>Pieejamās atzīmes</summary>${ui.dl(CP.docxFill ? CP.docxFill.FIELDS_HELP : [])}<p class="small"><b>Līgumam:</b></p>${ui.dl(CP.CONTRACT_FIELDS_HELP || [])}</details>`;
  }
  let tplType = 'instr';
  A.tplDocAdd = type => { if (!S.root) return ui.toast('Vispirms pieslēdz datu mapi', 'warn'); tplType = type; U.$('tplDocFile').click(); };
  U.$('tplDocFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (!/\.docx$/i.test(f.name)) return ui.toast('Veidnei jābūt Word .docx failam', 'warn');
    try {
      const path = await CP.store.saveFile(['Veidnes'], f.name, f);
      (st().docTemplates = st().docTemplates || []).push({ id: U.uid(), type: tplType, name: f.name.replace(/\.docx$/i, ''), path });
      CP.store.changed(); ui.toast('Veidne pievienota: ' + f.name, 'ok');
    } catch (err) { ui.toast('Veidni neizdevās saglabāt: ' + err.message, 'err'); }
  });
  A.tplDocDelete = id => {
    const t = (st().docTemplates || []).find(x => x.id === id); if (!t || !confirm(`Noņemt veidni “${t.name}” no saraksta? Fails mapē Veidnes paliek.`)) return;
    st().docTemplates = st().docTemplates.filter(x => x.id !== id); CP.store.changed();
  };
  A.tplDocSample = async type => {
    const file = type === 'camp' ? 'nometnes-zurnals' : type === 'contract' ? 'ligums-parstavis-papirs' : 'instruktaza';
    const nice = type === 'camp' ? 'Nometnes žurnāls (veidne).docx' : type === 'contract' ? 'Līgums ar likumisko pārstāvi (veidne).docx' : 'Instruktāžas lapa (veidne).docx';
    try { const r = await fetch(CP.VENDOR + `templates/${file}.docx?v=${CP.VERSION}`, { cache: "no-cache" }); if (!r.ok) throw Error(r.status); U.download(await r.blob(), nice); }
    catch (e) { ui.toast('Paraugu neizdevās ielādēt: ' + e.message, 'err'); }
  };

  /* ---------------- Redaktors ---------------- */
  function blank(type) {
    const fd = st().formDefaults || {};
    return { id: '', type, title: '', dateFrom: U.iso(), dateTo: '', when: '', whenAuto: true, instrDate: U.iso(), group: '', groupAuto: true, notes: '',
      instrPosition: fd.instrPosition || 'JSI', instrName: fd.instrName || '', fillDates: fd.fillDates !== false, blankRows: 0, staffBlankRows: 0,
      participants: [], staff: type === 'camp' ? staffList().filter(s => s.lastUsed).map(s => s.id) : [], leaderId: fd.leaderId || '', groupCounselors: {}, yearId: D.activeYear(), files: [] };
  }
  A.formNew = type => { S.formEdit = blank(type === 'camp' ? 'camp' : 'instr'); S.formPick = { q: '', group: '', onlySel: false }; ui.go('formEdit'); };
  A.formOpen = id => { const ev = (S.db.events || []).find(e => e.id === id); if (!ev) return; S.formEdit = JSON.parse(JSON.stringify(ev)); S.formPick = { q: '', group: '', onlySel: false }; ui.go('formEdit'); };
  A.formDelete = id => {
    const ev = (S.db.events || []).find(e => e.id === id); if (!ev || !confirm(`Dzēst pasākumu “${ev.title || ''}”?\n\nSaglabātie PDF faili mapē paliek.`)) return;
    S.db.events = S.db.events.filter(e => e.id !== id); CP.store.changed();
  };
  const sel = () => new Set((S.formEdit?.participants || []).map(x => x.pid));
  function autoFields(ev) {
    if (ev.whenAuto) ev.when = whenText(ev.dateFrom, ev.dateTo);
    if (ev.groupAuto) ev.group = [...new Set(evPeople(ev).map(p => D.groupOf(p, ev.yearId)).filter(Boolean))].sort(U.cmp).join(', ');
  }
  const stepper = (k, label, hint, warn) => `<div class="field"><label>${label}</label><div class="stepper"><button type="button" class="sm" data-act="formBlank" data-arg="${k}|-1" aria-label="Mazāk">−</button><input type="number" data-ev="${k}" min="0" max="60" value="${Number(S.formEdit?.[k]) || 0}" inputmode="numeric"><button type="button" class="sm" data-act="formBlank" data-arg="${k}|1" aria-label="Vairāk">+</button></div><small class="${warn ? 'warn' : 'muted'}">${hint}</small></div>`;
  CP.pages.formEdit = {
    render() {
      const ev = S.formEdit; if (!ev) return CP.pages.forms.render();
      autoFields(ev);
      const T = TYPES[ev.type], chosen = sel(), pick = S.formPick || (S.formPick = { q: '', group: '', onlySel: false });
      const pool = D.peopleInYear(ev.yearId).filter(p => p.status !== 'archived')
        .filter(p => !pick.group || D.groupOf(p, ev.yearId) === pick.group)
        .filter(p => !pick.onlySel || chosen.has(p.id))
        .filter(p => !pick.q || U.norm(`${U.full(p)} ${U.sortName(p)} ${D.groupOf(p, ev.yearId)}`).includes(U.norm(pick.q)))
        .sort((a, b) => U.cmp(D.groupOf(a, ev.yearId), D.groupOf(b, ev.yearId)) || U.cmp(U.sortName(a), U.sortName(b)));
      const ps = evPeople(ev), issues = ps.map(p => ({ p, m: D.eventDocIssues(p) })).filter(x => x.m.length);
      const groups = D.groups();
      const f = (k, label, type = 'text', extra = '') => `<div class="field"><label>${label}</label><input type="${type}" data-ev="${k}" value="${esc(ev[k] ?? '')}" ${extra}></div>`;
      /* Dalībnieka audzinātājs: noklusējumā — grupas audzinātājs (redzams vārds), vai cits darbinieks tikai šim dalībniekam */
      const personCoun = (p, part) => {
        if (!evStaff(ev).length) return `<small class="muted ev-coun">Audzinātāju sarakstā vēl nav — pievieno sadaļā “Darbinieki nometnē”</small>`;
        const g = D.groupOf(p, ev.yearId) || '(bez grupas)', gc = evStaff(ev).find(s => s.id === ev.groupCounselors?.[g]);
        const own = part?.counselorId || '';
        return `<label class="ev-coun small"><span class="muted">Audzinātājs:</span><select class="sm" data-evcoun="${p.id}" title="Šī dalībnieka audzinātājs nometnē">
          <option value="" ${own ? '' : 'selected'}>${gc ? `${esc(gc.name)} (grupas audzinātājs)` : 'Kā grupai — vēl nav izvēlēts'}</option>
          ${evStaff(ev).filter(s => s.id !== gc?.id).map(s => `<option value="${s.id}" ${own === s.id ? 'selected' : ''}>${esc(s.name)}${s.counselor ? '' : ' (darbinieks)'}</option>`).join('')}</select></label>`;
      };
      const counselorOpts = (cur, empty = '— nav —') => `<option value="">${empty}</option>` + evStaff(ev).map(s => `<option value="${s.id}" ${cur === s.id ? 'selected' : ''}>${esc(s.name)}${s.counselor ? '' : ' (darbinieks)'}</option>`).join('');
      const evGroups = [...new Set(ps.map(p => D.groupOf(p, ev.yearId) || '(bez grupas)'))].sort(U.cmp);

      const left = `<section class="card"><h3>${ic(T.icon)}${esc(T.l)}</h3><div class="fieldgrid">
          <div class="field wide"><label>${ev.type === 'camp' ? 'Nometnes nosaukums' : 'Nodarbības vai pasākuma nosaukums'}</label><input data-ev="title" value="${esc(ev.title)}" placeholder="${ev.type === 'camp' ? 'piem., Vasaras nometne “Ozols”' : 'piem., Orientēšanās nodarbība Siguldā'}"></div>
          ${f('dateFrom', 'Norises sākums', 'date')}${f('dateTo', 'Beigas (ja vairākas dienas)', 'date')}
          <div class="field wide"><label>Norises laiks (tā, kā rakstīts veidlapā)</label><input data-ev="when" value="${esc(ev.when)}" placeholder="piem., 2026. gada 17.–18. oktobris"><small class="muted">${ev.whenAuto ? 'Tiek veidots no datumiem — vari pārrakstīt.' : '<a href="#" data-act="formWhenAuto">Veidot no datumiem</a>'}</small></div>
          ${f('instrDate', 'Instruktāžas datums', 'date')}
          ${ev.type === 'instr' ? `<div class="field"><label>Grupa</label><input data-ev="group" value="${esc(ev.group)}" list="dl_groups"><small class="muted">${ev.groupAuto ? 'No izvēlētajiem dalībniekiem.' : '<a href="#" data-act="formGroupAuto">No dalībniekiem</a>'}</small></div>` : ''}
          ${ev.type === 'instr' ? `${f('instrPosition', 'Instruktāžas veicēja amats')}${f('instrName', 'Vārds, uzvārds')}` : ''}
          ${ev.type === 'camp' ? `<div class="field"><label>Nometnes vadītājs</label><select data-ev="leaderId">${counselorOpts(ev.leaderId, '— izvēlies —')}</select></div>` : ''}
          <div class="field wide"><label>Piezīmes</label><textarea data-ev="notes" rows="2">${esc(ev.notes)}</textarea></div>
          ${stepper('blankRows', 'Tukšas rindas veidlapas beigās', evPeople(ev).length ? (Number(ev.blankRows) || 0) ? `Veidlapā būs ${evPeople(ev).length} dalībnieki + ${Number(ev.blankRows)} tukšas rindas.` : `Veidlapā būs tieši ${evPeople(ev).length} rindas — bez tukšām.` : (Number(ev.blankRows) || 0) ? `Nav izvēlētu dalībnieku — veidlapā būs ${Number(ev.blankRows)} tukšas rindas.` : 'Nav izvēlētu dalībnieku — norādi, cik tukšu rindu vajag.', !evPeople(ev).length && !(Number(ev.blankRows) || 0))}
          ${ev.type === 'camp' ? stepper('staffBlankRows', 'Tukšas rindas darbinieku tabulā', `${(ev.staff || []).length} izvēlēti darbinieki${(Number(ev.staffBlankRows) || 0) ? ` + ${Number(ev.staffBlankRows)} tukšas rindas` : ''}.`) : ''}
          ${ev.type === 'instr' ? `<div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" data-ev="fillDates" ${ev.fillDates !== false ? 'checked' : ''}> Datumu ierakstīt katrā rindā</label></div>` : ''}
        </div></section>
        ${ev.type === 'camp' ? `<section class="card"><h3>${ic('users')}Darbinieki nometnē</h3>
          ${evStaff(ev).length ? evStaff(ev).map(s => `<label class="check ev-staff"><input type="checkbox" data-evstaff="${s.id}" ${(ev.staff || []).includes(s.id) ? 'checked' : ''}> <b>${esc(s.name)}</b> <span class="small muted">${esc([s.role, s.counselor ? 'audzinātājs' : '', s._ext ? 'cita vienība: ' + (s.unit || '') : ''].filter(Boolean).join(' · '))}</span></label>`).join('') : '<p class="muted small">Vēl nav neviena darbinieka.</p>'}
          <div class="actions" style="margin-top:8px"><button class="sm" data-act="staffEdit">${ic('userPlus', '＋')} Pievienot darbinieku vai audzinātāju</button></div></section>
          <section class="card"><h3>${ic('userCheck')}Audzinātāji</h3>
          ${evGroups.length ? evGroups.map(g => `<div class="inline-form"><span class="grow"><b>${esc(g)}</b> <span class="small muted">${ps.filter(p => (D.groupOf(p, ev.yearId) || '(bez grupas)') === g).length} dal.</span></span><select data-evgroup="${esc(g)}" style="max-width:240px">${counselorOpts(ev.groupCounselors?.[g])}</select></div>`).join('') : '<p class="muted small">Izvēlies dalībniekus — tad varēs piešķirt audzinātāju katrai grupai.</p>'}
          <p class="small muted">Katrs dalībnieks automātiski saņem savas grupas audzinātāju. Ja kādam jābūt citam, labajā pusē pie dalībnieka izvēlies “Audzinātājs”.</p></section>` : ''}`;

      const prow = p => {
        const on = chosen.has(p.id), m = D.eventDocIssues(p), part = (ev.participants || []).find(x => x.pid === p.id);
        return `<div class="row pick ${on ? 'on' : ''}"><label class="check grow"><input type="checkbox" data-evpick="${p.id}" ${on ? 'checked' : ''}> ${ui.avatar(p, 'sm')}<span><b>${esc(U.sortName(p))}</b><small class="muted"> ${esc(D.groupOf(p, ev.yearId) || '')}</small>
          ${m.length ? `<br><small class="warn" title="Bez šiem dokumentiem jaunsargs nedrīkst piedalīties pasākumā">⚠ Trūkst: ${esc(m.join(', '))}</small>` : ''}</span></label>
          ${on && ev.type === 'camp' ? personCoun(p, part) : ''}</div>`;
      };
      const ownN = ps.filter(p => !p._ext).length, extN = ps.length - ownN;
      const right = `<section class="card ev-pick"><h3>${ic('users')}Dalībnieki <span class="pill ${ps.length ? 'ok' : ''}">${ownN} izvēlēti${extN ? ` + ${extN} no citām vienībām` : ''}</span></h3>
          <div class="ev-pickbar"><input type="search" id="evQ" placeholder="Meklēt vārdu…" value="${esc(pick.q)}" autocomplete="off">
            <select id="evGroup"><option value="">Visas grupas</option>${groups.map(g => `<option ${g === pick.group ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
            <label class="check small"><input type="checkbox" id="evOnlySel" ${pick.onlySel ? 'checked' : ''}> Tikai izvēlētie</label></div>
          <div class="actions" style="margin:8px 0"><button class="sm" data-act="evPickAll">Atzīmēt redzamos (${pool.length})</button><button class="sm ghost" data-act="evPickNone">Noņemt visus</button></div>
          ${issues.length ? `<div class="notice">⚠ <b>${issues.length}</b> ${issues.length === 1 ? 'dalībniekam' : 'dalībniekiem'} trūkst obligāto dokumentu (anketa, līgums vai ārsta izziņa). Pasākumā bez tiem piedalīties nedrīkst — pārbaudi pirms pasākuma. Uz veidlapas šis brīdinājums netiek drukāts.</div>` : ''}
          <div class="ev-list">${pool.map(prow).join('') || '<p class="muted small pad">Neviens neatbilst filtram.</p>'}</div></section>`;

      const tpls = (st().docTemplates || []).filter(t => t.type === ev.type);
      const actions = `<button data-act="formSave">${ic('save', '💾')} Saglabāt</button><button class="mainbtn" data-act="formPdf">${ic('file', '📄')} Skatīt PDF</button><button data-act="formPrint">Drukāt</button><button data-act="formDownload">${ic('download', '⬇')} Lejupielādēt PDF</button>
        ${tpls.map(t => `<button data-act="formDocx" data-arg="${t.id}" title="Aizpildīt manu Word veidni">${ic('file', '📄')} Word: ${esc(t.name)}</button>`).join('')}`;
      return `<div class="page">${ui.pageHead(ev.title ? esc(ev.title) : (ev.id ? 'Pasākums' : 'Jauna ' + T.l.toLowerCase()), esc(T.l) + (ev.when ? ' · ' + esc(ev.when) : ''), actions)}
        <div class="ev-layout"><div>${left}${CP.extPeople ? CP.extPeople.card(ev) : ''}</div><div>${right}</div></div></div>`;
    }
  };

  /* --- Ievade redaktorā --- */
  const NUM = new Set(['blankRows', 'staffBlankRows']);
  CP.inputHandlers.push(e => {
    const t = e.target; if (!S.formEdit) return false;
    if (t.id === 'evQ') { S.formPick.q = t.value; renderKeepFocus('evQ'); return true; }
    const k = t.dataset?.ev; if (!k || t.type === 'checkbox' || t.tagName === 'SELECT') return false;
    S.formEdit[k] = NUM.has(k) ? Math.max(0, Math.min(60, Number(t.value) || 0)) : t.value;
    if (k === 'when') S.formEdit.whenAuto = false;
    if (k === 'group') S.formEdit.groupAuto = false;
    if (k === 'dateFrom' || k === 'dateTo') { if (S.formEdit.whenAuto) { autoFields(S.formEdit); const w = document.querySelector('[data-ev="when"]'); if (w) w.value = S.formEdit.when; } }
    return true;
  });
  CP.changeHandlers.push(e => {
    const t = e.target, ev = S.formEdit; if (!ev) return false;
    if (t.id === 'evGroup') { S.formPick.group = t.value; CP.render(); return true; }
    if (t.id === 'evOnlySel') { S.formPick.onlySel = t.checked; CP.render(); return true; }
    if (t.dataset.evpick) {
      const id = t.dataset.evpick;
      if (t.checked) { if (!sel().has(id)) ev.participants.push({ pid: id }); } else ev.participants = ev.participants.filter(x => x.pid !== id);
      renderKeepScroll(); return true;
    }
    if (t.dataset.evstaff) { const id = t.dataset.evstaff; ev.staff = t.checked ? [...new Set([...(ev.staff || []), id])] : (ev.staff || []).filter(x => x !== id); return true; }
    if (t.dataset.evgroup != null && t.dataset.evgroup !== undefined && t.hasAttribute('data-evgroup')) { ev.groupCounselors = { ...(ev.groupCounselors || {}), [t.dataset.evgroup]: t.value }; setTimeout(renderKeepScroll, 0); return true; }
    if (t.dataset.evcoun) { const x = ev.participants.find(x => x.pid === t.dataset.evcoun); if (x) x.counselorId = t.value; return true; }
    const k = t.dataset.ev; if (!k) return false;
    if (NUM.has(k)) { setTimeout(() => { if (S.page === 'formEdit') renderKeepScroll(); }, 0); return true; }
    if (t.type === 'checkbox') ev[k] = t.checked; else if (t.tagName === 'SELECT') ev[k] = t.value; else return false;
    return true;
  });
  function renderKeepScroll() { const l = document.querySelector('.ev-list'), top = l ? l.scrollTop : 0, v = U.$('view').scrollTop; CP.render(); const l2 = document.querySelector('.ev-list'); if (l2) l2.scrollTop = top; U.$('view').scrollTop = v; }
  function renderKeepFocus(id) { const el = U.$(id), pos = el?.selectionStart; renderKeepScroll(); const n = U.$(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* */ } } }
  A.evPickAll = () => {
    const ev = S.formEdit, pick = S.formPick, chosen = sel();
    const pool = D.peopleInYear(ev.yearId).filter(p => p.status !== 'archived').filter(p => !pick.group || D.groupOf(p, ev.yearId) === pick.group)
      .filter(p => !pick.q || U.norm(`${U.full(p)} ${U.sortName(p)} ${D.groupOf(p, ev.yearId)}`).includes(U.norm(pick.q)));
    for (const p of pool) if (!chosen.has(p.id)) ev.participants.push({ pid: p.id });
    renderKeepScroll();
  };
  A.evPickNone = () => { if (S.formEdit.participants.length && !confirm('Noņemt visus izvēlētos dalībniekus?')) return; S.formEdit.participants = []; renderKeepScroll(); };
  A.formBlank = arg => { const ev = S.formEdit; if (!ev) return; const [k, d] = String(arg).split('|'); ev[k] = Math.max(0, Math.min(60, (Number(ev[k]) || 0) + Number(d))); renderKeepScroll(); };
  A.formWhenAuto = () => { S.formEdit.whenAuto = true; CP.render(); };
  A.formGroupAuto = () => { S.formEdit.groupAuto = true; CP.render(); };

  /* --- Saglabāšana --- */
  function commit(quiet) {
    const ev = S.formEdit; if (!ev) return null;
    autoFields(ev);
    ev.updatedAt = U.now();
    if (!ev.id) { ev.id = U.uid(); ev.createdAt = ev.updatedAt; }
    const list = S.db.events = S.db.events || [], i = list.findIndex(x => x.id === ev.id);
    const before = new Set(i >= 0 ? (list[i].participants || []).map(x => x.pid) : []);
    const copy = JSON.parse(JSON.stringify(ev));
    if (i >= 0) list[i] = copy; else list.push(copy);
    // atceras instruktoru un vadītāju nākamajai reizei
    const fd = st().formDefaults = st().formDefaults || {};
    if (ev.type === 'instr') { fd.instrPosition = ev.instrPosition; fd.instrName = ev.instrName; fd.fillDates = ev.fillDates !== false; }
    if (ev.type === 'camp') { fd.leaderId = ev.leaderId; for (const s of staffList()) s.lastUsed = (ev.staff || []).includes(s.id) || undefined; }
    for (const p of evPeople(ev)) if (!p._ext && !before.has(p.id)) D.audit(p.id, 'event', [ev.title || TYPES[ev.type].short]);   // tikai jaunpievienotajiem
    CP.store.changed({ silent: true });
    if (!quiet) ui.toast('Pasākums saglabāts', 'ok');
    return copy;
  }
  A.formSave = () => { commit(false); CP.render(); };

  /* --- PDF --- */
  function counselorFor(ev) {
    return p => {
      const own = (ev.participants || []).find(x => x.pid === p.id)?.counselorId || (p._ext ? p.counselorId : '');
      const g = D.groupOf(p, ev.yearId) || '(bez grupas)', all = evStaff(ev), by = id => all.find(s => s.id === id);
      return by(own || ev.groupCounselors?.[g])?.name || '';
    };
  }
  async function buildPdf(ev) {
    const people = evPeople(ev).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
    ui.toast('Sagatavo PDF…', 'ok', 2500);
    const bytes = ev.type === 'camp'
      ? await CP.pdf.camp(ev, people, evStaff(ev), counselorFor(ev))
      : await CP.pdf.instruction(ev, people);
    return new Blob([bytes], { type: 'application/pdf' });
  }
  const fileBase = ev => `${(ev.dateFrom || ev.instrDate || U.iso()).slice(0, 10)} ${TYPES[ev.type].short} ${ev.title || ''}`.trim().replace(/\s+/g, ' ').slice(0, 90);
  async function savePdfCopy(ev, blob) {
    if (!S.root) return null;
    try {
      const dir = ['Macibu_gadi', ev.yearId || D.activeYear(), 'Pasakumi', fileBase(ev)];
      const path = await CP.store.saveFile(dir, `${TYPES[ev.type].l}.pdf`, blob);
      const list = S.db.events.find(x => x.id === ev.id); if (list) { (list.files = list.files || []).push({ path, at: U.now(), kind: 'pdf' }); CP.store.changed({ silent: true }); }
      return path;
    } catch (e) { ui.toast('PDF kopiju mapē neizdevās saglabāt: ' + e.message, 'warn', 9000); return null; }
  }
  const current = id => { if (id) { const ev = (S.db.events || []).find(e => e.id === id); return ev ? JSON.parse(JSON.stringify(ev)) : null; } return commit(true); };
  async function withPdf(id, fn) {
    const ev = current(id); if (!ev) return;
    if (!evPeople(ev).length && !(Number(ev.blankRows) || 0)) { ui.toast('Nav izvēlēts neviens dalībnieks. Izvēlies dalībniekus vai norādi, cik tukšu rindu vajag veidlapā.', 'warn', 8000); U.qs('[data-ev="blankRows"]')?.focus(); return; }
    try { const blob = await buildPdf(ev); await fn(blob, ev); }
    catch (e) { console.error(e); ui.toast('PDF neizdevās sagatavot: ' + e.message, 'err', 12000); }
  }
  A.formPdf = id => withPdf(id, async (blob, ev) => { const path = await savePdfCopy(ev, blob); CP.docs.showBlob(blob, `${fileBase(ev)}.pdf`); if (path) ui.toast('Kopija saglabāta: ' + path, 'ok', 7000); });
  A.formDownload = id => withPdf(id, async (blob, ev) => { U.download(blob, `${fileBase(ev)}.pdf`); await savePdfCopy(ev, blob); });
  /* --- Drukāšana: PDF lapas tiek pārvērstas attēlos un parādītas priekšskatījumā rīkā; “Drukāt” atver pārlūka drukas logu ar tām pašām lapām --- */
  async function renderPages(blob) {
    await CP.reader.loadScript(CP.VENDOR + 'pdfjs/pdf.min.js');
    const lib = window.pdfjsLib, data = new Uint8Array(await blob.arrayBuffer());
    let pdf;
    if (location.protocol === 'file:') pdf = await lib.getDocument({ data, disableWorker: true }).promise;
    else { lib.GlobalWorkerOptions.workerSrc = new URL(CP.VENDOR + 'pdfjs/pdf.worker.min.js', location.href).href; try { pdf = await lib.getDocument({ data: data.slice(0) }).promise; } catch (e) { pdf = await lib.getDocument({ data, disableWorker: true }).promise; } }
    const out = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const pg = await pdf.getPage(i), v1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: 2200 / Math.max(v1.width, v1.height) });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: ctx, viewport: vp }).promise;
      out.push({ src: c.toDataURL('image/png'), land: v1.width > v1.height });
    }
    return out;
  }
  let printPages = [], printBlob = null, printName = '', printSrc = { kind: 'img' };
  CP.setPrintSource = src => { printSrc = src; const dl = U.qs('#printDialog [data-act=printDownload]'); if (dl) dl.textContent = src.kind === 'html' ? 'Lejupielādēt Word' : 'Lejupielādēt PDF'; printBlob = src.blob || null; printName = src.name || ''; if (src.kind === 'img') printPages = src.pages || []; };
  A.formPrint = id => withPdf(id, async (blob, ev) => CP.printPdf(blob, `${fileBase(ev)}.pdf`));
  /** PDF priekšskatījums un drukāšana (lieto arī apmeklējuma veidlapa) */
  CP.printPdf = async (blob, name) => {
    const d = U.$('printDialog'); CP.setPrintSource({ kind: 'img', pages: [], blob, name }); U.$('printGo').disabled = true;
    U.$('printPages').innerHTML = '<p class="muted pad">Sagatavo priekšskatījumu…</p>'; U.$('printInfo').textContent = ''; d.showModal();
    try {
      printPages = await renderPages(blob); printSrc.pages = printPages;
      U.$('printInfo').textContent = `${printPages.length} ${printPages.length === 1 ? 'lapa' : 'lapas'} · A4 ${printPages[0]?.land ? 'ainava' : 'portrets'}`;
      U.$('printPages').innerHTML = printPages.map((p, i) => `<figure class="print-page ${p.land ? 'land' : ''}"><img src="${p.src}" alt="${i + 1}. lapa"><figcaption>${i + 1}. lapa</figcaption></figure>`).join('');
      U.$('printGo').disabled = false;
    } catch (e) { console.error(e); U.$('printPages').innerHTML = `<p class="red pad">Priekšskatījumu neizdevās sagatavot: ${esc(e.message)}. Vari lejupielādēt PDF un izdrukāt to.</p>`; }
  };
  /* Drukā pašu rīka lapu: drukas laikā redzamas tikai veidlapas lapas (bez iegultiem rāmjiem — Chrome priekšskatījums ielādējas uzreiz) */
  /* Drukā tieši no galvenā loga (bez iframe — Chrome drukas logs ar slēptu rāmi bieži “ielādējas” bezgalīgi):
     lapas tiek ieliktas #printSheet, @media print paslēpj visu pārējo. */
  A.printGo = async () => {
    const html = printSrc.kind === 'html';
    if (!html && !printPages.length) return;
    const land = !html && printPages[0].land;
    let sheet = U.$('printSheet'); if (!sheet) { sheet = document.createElement('div'); sheet.id = 'printSheet'; document.body.appendChild(sheet); }
    let st = U.$('printPageStyle'); if (!st) { st = document.createElement('style'); st.id = 'printPageStyle'; document.head.appendChild(st); }
    st.textContent = html ? '@page{size:A4 portrait;margin:0}' : `@page{size:A4 ${land ? 'landscape' : 'portrait'};margin:0}#printSheet img{width:${land ? '296mm' : '209mm'};height:${land ? '208mm' : '295mm'};margin:0 auto}`;
    sheet.className = html ? 'docx-print' : '';
    sheet.innerHTML = html ? printSrc.node.innerHTML : printPages.map(p => `<img src="${p.src}" alt="">`).join('');
    await Promise.all([...sheet.querySelectorAll('img')].map(i => i.decode ? i.decode().catch(() => {}) : null));
    const dlg = U.$('printDialog'); dlg.close();             // modālais logs netiek drukāts
    document.documentElement.classList.add('printing');
    const done = () => { document.documentElement.classList.remove('printing'); sheet.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    // lapas paliek #printSheet līdz drukas loga aizvēršanai (afterprint) — uz ekrāna tās nav redzamas
    setTimeout(() => { try { window.print(); } catch (e) { ui.toast('Drukas logu neizdevās atvērt: ' + e.message, 'err'); } }, 60);
  };
  A.printDownload = () => { if (printBlob) U.download(printBlob, printName); };

  /* --- Sava Word veidne --- */
  A.formDocx = async tid => {
    const t = (st().docTemplates || []).find(x => x.id === tid); if (!t) return;
    const ev = commit(true);
    try {
      const h = await CP.store.handleFor(t.path, 'main'); if (!h) throw Error('veidnes fails mapē Veidnes nav atrasts');
      const people = evPeople(ev).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
      const blob = await CP.docxFill.fill(await (await h.getFile()).arrayBuffer(), CP.docxFill.data(ev, people, evStaff(ev), counselorFor(ev)));
      U.download(blob, `${fileBase(ev)}.docx`);
      if (S.root) { const path = await CP.store.saveFile(['Macibu_gadi', ev.yearId || D.activeYear(), 'Pasakumi', fileBase(ev)], `${t.name}.docx`, blob); const x = S.db.events.find(e => e.id === ev.id); if (x) { (x.files = x.files || []).push({ path, at: U.now(), kind: 'docx' }); CP.store.changed({ silent: true }); } }
    } catch (e) { console.error(e); ui.toast('Word veidni neizdevās aizpildīt: ' + e.message, 'err', 12000); }
  };

  /* --- Personas kartītē: dalība pasākumos --- */
  CP.forms = {
    evPeople, evStaff, renderKeepScroll: () => renderKeepScroll(), commit: q => commit(q),
    personCard(p) {
      const evs = (S.db.events || []).filter(e => (e.participants || []).some(x => x.pid === p.id)).sort((a, b) => String(b.dateFrom || b.instrDate).localeCompare(String(a.dateFrom || a.instrDate)));
      if (!evs.length) return '';
      return `<section class="card"><h3>${ic('clipboard')}Pasākumi</h3>${evs.slice(0, 6).map(e => `<div class="row"><div class="grow"><b>${esc(e.title || TYPES[e.type].short)}</b><div class="small muted">${esc(TYPES[e.type].short)} · ${esc(e.when || U.fmtDate(e.instrDate))}</div></div><button class="sm ghost" data-act="formOpen" data-arg="${e.id}">Atvērt</button></div>`).join('')}${evs.length > 6 ? `<p class="small muted">… un vēl ${evs.length - 6}</p>` : ''}</section>`;
    },
    whenText
  };
})(window.CP);


/* ==== js/extpeople.js ==== */
/* =====================================================================
   Dalībnieki no citām vienībām (instruktāžas lapai / nometnes žurnālam).
   • Eksports: instruktors savam pasākumam izvēlētos dalībniekus (un, ja vajag, darbiniekus) saglabā
     failā “CADET dalībnieki … .json” — pēc izvēles šifrētu ar paroli (AES-GCM, PBKDF2-SHA-256).
   • Imports: pasākuma logā ievelk šādu failu vai Excel/CSV (arī no tiem, kam rīka nav — ir veidne).
     Dalībnieki glabājas TIKAI šajā pasākumā (ev.external), netiek pievienoti personu sarakstam.
   Rīks neko nesūta internetā — failu instruktori nodod paši (e-pasts, WhatsApp…).
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const ic = (n, f = '') => CP.ic(n, f);
  const FORMAT = 'cadet-dalibnieki';
  const PF = ['first', 'last', 'personalCode', 'birth', 'group', 'school', 'schoolClass', 'phone', 'email', 'addressDeclared', 'addressActual',
    'parentName', 'parentRelation', 'parentPhone', 'parentEmail', 'parent2Name', 'parent2Relation', 'parent2Phone', 'emergencyName', 'emergencyPhone'];
  const SF = ['name', 'role', 'personalCode', 'phone', 'address', 'counselor'];
  const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] != null && o[k] !== '').map(k => [k, o[k]]));
  const inst = () => S.db.settings.instructor || {};
  const ev = () => S.formEdit;

  /* --- Šifrēšana (pārlūka WebCrypto) --- */
  const b64 = u => btoa(String.fromCharCode(...new Uint8Array(u)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function key(pw, salt, iter) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encrypt(obj, pw) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iter = 250000;
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(pw, salt, iter), new TextEncoder().encode(JSON.stringify(obj)));
    return { format: FORMAT, v: 1, enc: { alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iter, salt: b64(salt), iv: b64(iv) }, data: b64(data) };
  }
  async function decrypt(file, pw) {
    const e = file.enc, k = await key(pw, unb64(e.salt), e.iter || 250000);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(e.iv) }, k, unb64(file.data));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  /* --- Sadaļa pasākuma logā --- */
  function card(e) {
    const ext = e.external || [], xs = e.extStaff || [], camp = e.type === 'camp';
    const staff = [...(S.db.settings.staff || []), ...xs];
    const units = [...new Set(ext.map(x => x.unit || 'Cita vienība'))];
    const coun = x => camp && staff.length ? `<select class="sm" data-extcoun="${x.id}" title="Audzinātājs nometnē"><option value="">${esc(x.group ? 'Kā grupai' : '— audzinātājs —')}</option>${staff.map(s => `<option value="${s.id}" ${x.counselorId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>` : '';
    return `<section class="card ext-card" data-extdrop><h3>${ic('users')}Dalībnieki no citām vienībām ${ext.length ? `<span class="pill">${ext.length}</span>` : ''}</h3>
      ${ext.length ? units.map(u => `<div class="ext-unit"><div class="small muted ext-uh">${esc(u)}</div>${ext.filter(x => (x.unit || 'Cita vienība') === u).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b))).map(x => `<div class="row ext-row"><div class="grow"><b>${esc(U.sortName(x))}</b> <small class="muted">${esc([x.group, x.birth && U.fmtDate(x.birth)].filter(Boolean).join(' · '))}</small>${!x.personalCode && !x.birth ? ' <small class="warn">nav personas koda</small>' : ''}</div>${coun(x)}<button class="sm ghost danger" data-act="extDel" data-arg="${x.id}" title="Noņemt no pasākuma">✕</button></div>`).join('')}</div>`).join('')
        : '<p class="small muted" style="margin-top:0">Ja pasākumā piedalās jaunsargi no citas vienības, ievelc šeit to instruktora atsūtīto failu. Dati glabāsies tikai šajā pasākumā, nevis tavā personu sarakstā.</p>'}
      ${xs.length ? `<div class="small muted" style="margin-top:6px">Darbinieki no citām vienībām: ${xs.map(s => esc(s.name)).join(', ')} <a href="#" data-act="extStaffClear">noņemt</a></div>` : ''}
      <div class="ext-drop" data-act="extImport" role="button" tabindex="0"><b>⬆ Ievelc failu vai spied šeit</b><span class="small muted">CADET dalībnieku fails (.json) vai Excel / CSV saraksts</span></div>
      <div class="actions"><button class="sm" data-act="extExport" title="Sagatavot failu ar taviem šī pasākuma dalībniekiem citam instruktoram">⇪ Nosūtīt savus dalībniekus citam instruktoram</button><button class="sm ghost" data-act="extTemplate" title="Excel veidne instruktoriem, kam nav CADET PERSONĀLS">⇩ Excel veidne</button></div></section>`;
  }
  CP.changeHandlers.push(e => {
    const id = e.target.dataset?.extcoun; if (!id || !ev()) return false;
    const x = (ev().external || []).find(y => y.id === id); if (x) x.counselorId = e.target.value; return true;
  });
  A.extDel = id => { const e = ev(), x = (e?.external || []).find(y => y.id === id); if (!x || !confirm(`Noņemt ${U.full(x)} no šī pasākuma?`)) return; e.external = e.external.filter(y => y !== x); CP.forms.renderKeepScroll(); };
  A.extStaffClear = () => { const e = ev(); if (!e || !confirm('Noņemt citu vienību darbiniekus no šī pasākuma?')) return; const ids = new Set((e.extStaff || []).map(s => s.id)); e.staff = (e.staff || []).filter(x => !ids.has(x)); e.extStaff = []; CP.forms.renderKeepScroll(); };

  /* --- Eksports --- */
  function dlg(id, html, cls = '') { let d = U.$(id); if (!d) { d = document.createElement('dialog'); d.id = id; document.body.appendChild(d); } d.className = cls; d.innerHTML = html; if (!d.open) d.showModal(); return d; }
  A.extExport = () => {
    const e = ev(); if (!e) return;
    const own = CP.forms.evPeople(e).filter(p => !p._ext);
    if (!own.length) return ui.toast('Vispirms izvēlies savus dalībniekus sarakstā augšā', 'warn', 6000);
    const st = (S.db.settings.staff || []).filter(s => (e.staff || []).includes(s.id));
    const d = dlg('extExpDialog', `<form><header class="dlg-head"><h2>Nosūtīt dalībniekus citam instruktoram</h2><button type="button" class="ghost" data-close="extExpDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><p style="margin-top:0">Failā būs <b>${own.length}</b> ${own.length === 1 ? 'dalībnieks' : 'dalībnieki'} ar datiem, kas vajadzīgi instruktāžas lapai un nometnes žurnālam (vārds, personas kods, dzimšanas datums, grupa, adrese, tālrunis, vecāki).</p>
        ${st.length ? `<label class="check"><input type="checkbox" name="staff" checked> Pievienot arī darbiniekus / audzinātājus (${st.length}): ${esc(st.map(s => s.name).join(', '))}</label>` : ''}
        <div class="choice-list">
          <label class="choice"><input type="radio" name="prot" value="pw" checked><div class="grow"><b>Aizsargāt ar paroli (ieteicams)</b><div class="small muted">Paroli pasaki otram instruktoram atsevišķi, piem., piezvanot. Bez paroles failu nevar atvērt.</div><input type="text" name="pw" placeholder="Parole (vismaz 6 zīmes)" autocomplete="off" style="margin-top:8px"></div></label>
          <label class="choice"><input type="radio" name="prot" value="none"><div class="grow"><b>Bez paroles</b><div class="small muted">Fails ir lasāms jebkuram, kas to saņem.</div></div></label>
        </div>
        <p class="small muted">Fails tiek saglabāts tavā datorā. Rīks to nekur nesūta — nodod to pats (e-pastā, WhatsApp…).</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="extExpDialog">Atcelt</button><button class="mainbtn" type="submit">⇩ Saglabāt failu</button></footer></form>`);
    const f = d.querySelector('form');
    f.pw.addEventListener('focus', () => { f.prot.value = 'pw'; });
    f.onsubmit = async x => {
      x.preventDefault();
      const pw = f.prot.value === 'pw' ? f.pw.value : '';
      if (f.prot.value === 'pw' && pw.length < 6) { ui.toast('Parolei jābūt vismaz 6 zīmes garai', 'warn'); f.pw.focus(); return; }
      const I = inst(), unit = [I.name, [I.parvalde, I.nodala].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      const body = { format: FORMAT, v: 1, created: U.now(), from: { instructor: I.name || '', unit, phone: I.phone || '' }, event: { title: e.title || '', when: e.when || '', dateFrom: e.dateFrom || '', type: e.type },
        people: own.map(p => ({ ...pick(p, PF), group: D.groupOf(p, e.yearId) || '' })), staff: f.staff?.checked ? st.map(s => pick(s, SF)) : [] };
      try {
        const out = pw ? await encrypt(body, pw) : body;
        const name = `CADET dalībnieki — ${(e.title || 'pasākums').slice(0, 40)} — ${(I.name || 'instruktors')}.json`.replace(/[\\/:*?"<>|]+/g, ' ');
        U.download(new Blob([JSON.stringify(out, null, pw ? 0 : 1)], { type: 'application/json' }), name);
        d.close(); ui.toast(pw ? 'Fails saglabāts. Paroli pasaki otram instruktoram atsevišķi.' : 'Fails saglabāts', 'ok', 8000);
      } catch (err) { console.error(err); ui.toast('Failu neizdevās sagatavot: ' + err.message, 'err', 9000); }
    };
  };
  A.extTemplate = async () => {
    try { const r = await fetch(CP.VENDOR + `templates/dalibnieku-veidne.xlsx?v=${CP.VERSION}`, { cache: 'no-cache' }); if (!r.ok) throw Error(r.status); U.download(await r.blob(), 'Dalībnieku saraksts (veidne).xlsx'); ui.toast('Nosūti šo veidni otram instruktoram — viņš aizpilda un atsūta atpakaļ, tu to ievelc pasākumā', 'ok', 9000); }
    catch (e) { ui.toast('Veidni neizdevās ielādēt: ' + e.message, 'err'); }
  };

  /* --- Imports --- */
  A.extImport = () => {
    let inp = U.$('extFile'); if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.id = 'extFile'; inp.hidden = true; inp.accept = '.json,.xlsx,.csv,.txt,application/json'; document.body.appendChild(inp); inp.onchange = () => { const f = inp.files[0]; inp.value = ''; if (f) take(f); }; }
    inp.click();
  };
  const askPw = (msg = '') => new Promise(res => {
    const d = dlg('extPwDialog', `<form><header class="dlg-head"><h2>🔒 Fails ir aizsargāts ar paroli</h2></header>
      <div class="dlg-body"><p style="margin-top:0">Ievadi paroli, ko tev pateica instruktors, kurš atsūtīja failu.</p>${msg ? `<p class="red small">${esc(msg)}</p>` : ''}<input type="password" name="pw" autocomplete="off" required autofocus></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-v="cancel">Atcelt</button><button class="mainbtn" type="submit">Atvērt</button></footer></form>`);
    const f = d.querySelector('form'); let done = false;
    const fin = v => { if (done) return; done = true; d.close(); res(v); };
    f.onsubmit = x => { x.preventDefault(); fin(f.pw.value); };
    f.querySelector('[data-v=cancel]').onclick = () => fin(null);
    d.addEventListener('close', () => fin(null), { once: true });
    setTimeout(() => f.pw.focus(), 30);
  });
  async function take(file) {
    if (!ev()) return;
    try {
      let people = [], staff = [], unit = '', src = file.name;
      if (/\.json$/i.test(file.name) || file.type === 'application/json') {
        let obj = JSON.parse(await file.text());
        if (obj.format !== FORMAT) throw Error('šis nav CADET dalībnieku fails');
        if (obj.enc) {
          let msg = '';
          for (;;) {
            const pw = await askPw(msg); if (pw == null) return;
            try { obj = await decrypt(obj, pw); break; } catch (e) { msg = 'Nepareiza parole. Mēģini vēlreiz.'; }
          }
        }
        people = (obj.people || []).map(p => pick(p, PF)); staff = (obj.staff || []).map(s => pick(s, SF));
        unit = obj.from?.unit || obj.from?.instructor || '';
        src = `${obj.from?.instructor || 'cits instruktors'}${obj.event?.title ? ' — ' + obj.event.title : ''}`;
      } else {
        const r = await CP.io.peopleFromFile(file);
        people = r.people.map(p => pick(p, PF));
        // veidnē: “Vienība / instruktors:” šūna virs tabulas
        for (const row of r.rows.slice(0, r.headerRow)) { const i = row.findIndex(c => /vien[īi]ba|instruktors/i.test(String(c))); if (i >= 0) { const v = row.slice(i + 1).find(c => String(c).trim()); if (v) { unit = String(v).trim(); break; } } }
      }
      if (!people.length && !staff.length) throw Error('failā nav neviena dalībnieka');
      preview(people, staff, unit, src);
    } catch (e) { console.error(e); ui.toast('Failu neizdevās nolasīt: ' + e.message, 'err', 10000); }
  }
  const code = p => U.codeDigits ? U.codeDigits(p.personalCode || '') : String(p.personalCode || '').replace(/\D/g, '');
  const same = (a, b) => (code(a).length === 11 && code(a) === code(b)) || (U.norm(U.full(a)) === U.norm(U.full(b)) && (a.birth || '') === (b.birth || '') && !!a.birth);
  function preview(people, staff, unit, src) {
    const e = ev(), ext = e.external || [], ownIds = new Set((e.participants || []).map(x => x.pid));
    const rows = people.map((p, i) => {
      const mine = D.peopleInYear(e.yearId).find(q => same(q, p)), dup = ext.find(x => same(x, p));
      return { i, p, mine, dup, on: !(mine && ownIds.has(mine.id)) };
    });
    const d = dlg('extImpDialog', `<form><header class="dlg-head"><h2>Dalībnieki no citas vienības</h2><button type="button" class="ghost" data-close="extImpDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><p class="small muted" style="margin-top:0">Fails: ${esc(src)}</p>
        <div class="field"><label>Vienība / instruktors (redzams tikai rīkā)</label><input name="unit" value="${esc(unit)}" placeholder="piem., 3. novada pārvalde, J. Bērziņš"></div>
        <div class="ext-prev">${rows.map(r => `<label class="check ext-prow"><input type="checkbox" name="r" value="${r.i}" ${r.on ? 'checked' : ''}><span class="grow"><b>${esc(U.sortName(r.p))}</b> <small class="muted">${esc([r.p.group, r.p.birth && U.fmtDate(r.p.birth), r.p.personalCode ? 'p.k. ' + String(r.p.personalCode).slice(0, 6) + '-…' : ''].filter(Boolean).join(' · '))}</small>
          ${r.mine ? `<br><small class="okc">ir tavā personu sarakstā — tiks izvēlēts no tava saraksta${ownIds.has(r.mine.id) ? ' (jau izvēlēts)' : ''}</small>` : r.dup ? '<br><small class="warn">jau ir pasākumā — dati tiks atjaunoti</small>' : ''}${!r.p.personalCode && !r.p.birth ? '<br><small class="warn">nav personas koda un dzimšanas datuma</small>' : ''}</span></label>`).join('')}</div>
        ${staff.length && e.type === 'camp' ? `<label class="check" style="margin-top:8px"><input type="checkbox" name="staff" checked> Pievienot darbiniekus / audzinātājus: ${esc(staff.map(s => s.name).join(', '))}</label>` : ''}
        <p class="small muted">Dati glabājas tikai šajā pasākumā un nonāk instruktāžas lapā / nometnes žurnālā kopā ar taviem dalībniekiem.</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="extImpDialog">Atcelt</button><button class="mainbtn" type="submit">Pievienot pasākumam</button></footer></form>`, 'wide');
    const f = d.querySelector('form');
    f.onsubmit = x => {
      x.preventDefault();
      const u = f.unit.value.trim(), chosen = new Set([...f.querySelectorAll('[name=r]:checked')].map(c => Number(c.value)));
      let add = 0, upd = 0, own = 0;
      e.external = e.external || []; e.participants = e.participants || [];
      for (const r of rows) {
        if (!chosen.has(r.i)) continue;
        if (r.mine) { if (!e.participants.some(y => y.pid === r.mine.id)) { e.participants.push({ pid: r.mine.id }); own++; } continue; }
        if (r.dup) { Object.assign(r.dup, r.p, { unit: u || r.dup.unit, updatedAt: U.now() }); upd++; continue; }
        e.external.push({ id: 'x' + U.uid(), ...r.p, unit: u, addedAt: U.now() }); add++;
      }
      if (f.staff?.checked) {
        e.extStaff = e.extStaff || []; e.staff = e.staff || [];
        for (const s of staff) { let y = e.extStaff.find(z => U.norm(z.name) === U.norm(s.name)); if (!y) { y = { id: 'xs' + U.uid(), ...s, _ext: true, unit: u }; e.extStaff.push(y); } else Object.assign(y, s); if (!e.staff.includes(y.id)) e.staff.push(y.id); }
      }
      d.close(); CP.forms.renderKeepScroll();
      ui.toast([add && `pievienoti ${add}`, upd && `atjaunoti ${upd}`, own && `${own} izvēlēti no tava saraksta`].filter(Boolean).join(', ') || 'Nekas netika mainīts', 'ok', 6000);
    };
  }

  /* --- Ievilkšana pasākuma logā --- */
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  const zone = e => S.page === 'formEdit' && !U.qs('dialog[open]') ? e.target.closest?.('[data-extdrop]') : null;
  document.addEventListener('dragover', e => { if (!hasFiles(e) || !zone(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; zone(e).classList.add('over'); });
  document.addEventListener('dragleave', e => { if (!e.relatedTarget?.closest?.('[data-extdrop]')) document.querySelectorAll('[data-extdrop].over').forEach(x => x.classList.remove('over')); });
  document.addEventListener('drop', e => { if (!hasFiles(e) || !zone(e)) return; e.preventDefault(); zone(e).classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) take(f); });
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.ext-drop')) { e.preventDefault(); A.extImport(); } });

  CP.extPeople = { card, encrypt, decrypt, take, FORMAT };
})(window.CP);


/* ==== js/google.js ==== */
/* =====================================================================
   Google savienojums (kalendāram un rezerves kopijai Google Drive).
   • Bez servera: OAuth “token” plūsma uznirstošā logā (oauth.html → BroadcastChannel 'cp-oauth').
   • Atļauja derīga ~1 h. Tā glabājas tikai šīs cilnes sesijā (sessionStorage), lai pēc lapas pārlādes nav jāpieslēdzas no jauna.
   • Kad atļauja beigusies un ir ko sūtīt, augšā parādās josla ar pogu “Pieslēgties” (uznirstošo logu pārlūks atļauj tikai pēc klikšķa).
   • Drive: tvērums drive.file — rīks redz tikai paša izveidotos failus, nevis visu Drive.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, ui = CP.ui, A = CP.actions;
  const SC = { cal: 'https://www.googleapis.com/auth/calendar.app.created', drive: 'https://www.googleapis.com/auth/drive.file' };
  const TKEY = 'cp.gtok', CKEY = 'cp.gClientId';
  const redirectUri = () => new URL('oauth.html', location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '')).href;
  let tok = null;   // { t, exp, scopes: [] }
  try { const o = JSON.parse(sessionStorage.getItem(TKEY) || 'null'); if (o && o.exp > Date.now()) tok = o; } catch (e) { }
  const saveTok = () => { try { tok ? sessionStorage.setItem(TKEY, JSON.stringify(tok)) : sessionStorage.removeItem(TKEY); } catch (e) { } };

  const clientId = () => (S.db?.settings?.gcal?.clientId || (() => { try { return localStorage.getItem(CKEY) || ''; } catch (e) { return ''; } })()).trim();
  const rememberClient = id => { try { if (id) localStorage.setItem(CKEY, id); } catch (e) { } };
  const valid = () => !!tok && Date.now() < tok.exp - 60000;
  const has = scope => valid() && tok.scopes.includes(SC[scope] || scope);
  const listeners = [];
  const changed = () => { for (const f of listeners) { try { f(); } catch (e) { console.error(e); } } paintBanner(); };

  /** Atļaujas iegūšana. scopes: ['cal'] / ['drive'] / abi. interactive=false → tikai, ja jau ir derīga. */
  function token(scopes, interactive = true, cid = '') {
    scopes = [].concat(scopes).map(s => SC[s] || s);
    if (valid() && scopes.every(s => tok.scopes.includes(s))) return Promise.resolve(tok.t);
    if (!interactive) return Promise.resolve(null);
    cid = (cid || clientId()).trim();
    if (!cid) { ui.toast('Vispirms ievadi Google OAuth Client ID (Grafiks → “Atgādinājumi un Google” vai rezerves kopijas iestatījumos)', 'warn', 9000); return Promise.resolve(null); }
    const want = [...new Set([...scopes, ...(tok?.scopes || [])])];
    const state = U.uid();
    const q = { client_id: cid, redirect_uri: redirectUri(), response_type: 'token', scope: want.join(' '), include_granted_scopes: 'true', state };
    if (!tok) q.prompt = 'select_account';
    const w = window.open('https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams(q), 'cp-google', 'width=520,height=680');
    if (!w) { ui.toast('Pārlūks bloķēja Google pieteikšanās logu. Atļauj uznirstošos logus šai lapai (adreses joslas labajā pusē) un mēģini vēlreiz.', 'warn', 10000); return Promise.resolve(null); }
    return new Promise(res => {
      const bc = new BroadcastChannel('cp-oauth'); let done = false;
      const finish = v => { if (done) return; done = true; bc.close(); clearInterval(t); res(v); };
      bc.onmessage = ev => {
        const p = new URLSearchParams(String(ev.data || '').replace(/^#/, ''));
        if (p.get('state') !== state) return;
        if (p.get('error')) { ui.toast('Google: ' + (p.get('error') === 'access_denied' ? 'piekļuve netika atļauta' : p.get('error')), 'warn', 8000); return finish(null); }
        const granted = (p.get('scope') || want.join(' ')).split(/\s+/).filter(Boolean);
        tok = { t: p.get('access_token'), exp: Date.now() + Number(p.get('expires_in') || 3600) * 1000, scopes: granted };
        saveTok(); rememberClient(cid);
        if (!scopes.every(s => granted.includes(s))) ui.toast('Google logā netika atzīmēta visa vajadzīgā piekļuve. Pieslēdzies vēlreiz un atzīmē visas izvēles rūtiņas.', 'warn', 10000);
        finish(scopes.every(s => granted.includes(s)) ? tok.t : null);
        setTimeout(changed, 0);
      };
      const t = setInterval(() => { if (w.closed) setTimeout(() => finish(null), 800); }, 700);
      setTimeout(() => finish(null), 5 * 60000);
    });
  }
  const forget = () => { tok = null; saveTok(); paintBanner(); };
  const authErr = () => { forget(); return Object.assign(Error('Google savienojums beidzies — pieslēdzies vēlreiz'), { auth: true }); };

  /* ---------- Google Drive (tikai rīka izveidotie faili) ---------- */
  const DAPI = 'https://www.googleapis.com/drive/v3', UAPI = 'https://www.googleapis.com/upload/drive/v3';
  const FOLDER = 'application/vnd.google-apps.folder';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function dfetch(url, opt = {}, tries = 4) {
    for (let i = 0; ; i++) {
      if (!valid()) throw authErr();
      let r;
      try { r = await fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + tok.t, ...(opt.headers || {}) } }); }
      catch (e) { if (i < tries) { await sleep(800 * 2 ** i); continue; } throw Error('Nav savienojuma ar Google Drive (internets?)'); }
      if (r.status === 401) throw authErr();
      if ((r.status === 429 || r.status >= 500) && i < tries) { await sleep(800 * 2 ** i); continue; }
      if (r.status === 403) {
        let j = {}; try { j = await r.clone().json(); } catch (e) { }
        const reason = j.error?.errors?.[0]?.reason || j.error?.status || '';
        if (/rateLimit|userRateLimit/i.test(reason) && i < tries) { await sleep(1500 * 2 ** i); continue; }
        if (/accessNotConfigured|SERVICE_DISABLED/i.test(reason) || /has not been used|is disabled/i.test(j.error?.message || ''))
          throw Object.assign(Error('Google projektā nav ieslēgts Google Drive API. Atver “? Kā iegūt Client ID” un izpildi 2. soli “Ieslēdz Google Drive API”, tad mēģini vēlreiz.'), { api: true });
        if (/insufficient/i.test(reason + (j.error?.message || ''))) throw authErr();
        throw Error('Google Drive: ' + (j.error?.message || 'piekļuve liegta'));
      }
      if (r.status === 404) return null;
      if (!r.ok) { let m = r.status + ''; try { m = (await r.json()).error?.message || m; } catch (e) { } throw Error('Google Drive: ' + m); }
      return r;
    }
  }
  const qs = o => new URLSearchParams(o).toString();
  const esc1 = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const drive = {
    async list(q, fields = 'id,name,modifiedTime,size') {
      const out = []; let pageToken = '';
      do {
        const r = await dfetch(`${DAPI}/files?${qs({ q, fields: `nextPageToken,files(${fields})`, pageSize: 1000, spaces: 'drive', ...(pageToken ? { pageToken } : {}) })}`);
        const j = r ? await r.json() : {}; out.push(...(j.files || [])); pageToken = j.nextPageToken || '';
      } while (pageToken);
      return out;
    },
    children: (parent, extra = '') => drive.list(`'${esc1(parent)}' in parents and trashed=false${extra}`),
    async findFolders(name, parent = '') { return drive.list(`name='${esc1(name)}' and mimeType='${FOLDER}' and trashed=false${parent ? ` and '${esc1(parent)}' in parents` : ''}`); },
    async mkdir(name, parent = '') {
      const r = await dfetch(`${DAPI}/files?fields=id,name`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: FOLDER, ...(parent ? { parents: [parent] } : {}), description: 'CADET PERSONĀLS šifrētā rezerves kopija' }) });
      return (await r.json()).id;
    },
    async folder(name, parent) { const f = await drive.findFolders(name, parent); return f[0]?.id || drive.mkdir(name, parent); },
    /** Augšupielāde: jauns fails (id nav) vai esoša satura aizstāšana (id ir). Atgriež faila id. */
    async put(name, parent, data, type = 'application/octet-stream', id = '') {
      const blob = data instanceof Blob ? data : new Blob([data], { type });
      if (id) {
        if (blob.size <= 4.5e6) { const r = await dfetch(`${UAPI}/files/${encodeURIComponent(id)}?uploadType=media&fields=id`, { method: 'PATCH', headers: { 'Content-Type': type }, body: blob }); if (r) return (await r.json()).id; }
        else { const r = await resumable(`${UAPI}/files/${encodeURIComponent(id)}?uploadType=resumable&fields=id`, 'PATCH', {}, blob, type); if (r) return r; }
        // fails Drive vairs nav (izdzēsts rokām) → izveido no jauna
      }
      if (blob.size > 4.5e6) return resumable(`${UAPI}/files?uploadType=resumable&fields=id`, 'POST', { name, parents: [parent] }, blob, type);
      const b = 'cpb' + U.uid().replace(/\W/g, '');
      const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [parent] })}\r\n--${b}\r\nContent-Type: ${type}\r\n\r\n`, blob, `\r\n--${b}--`]);
      const r = await dfetch(`${UAPI}/files?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body });
      return (await r.json()).id;
    },
    async meta(id) { const r = await dfetch(`${DAPI}/files/${encodeURIComponent(id)}?fields=id,name,trashed`); return r ? r.json() : null; },
    async get(id) { const r = await dfetch(`${DAPI}/files/${encodeURIComponent(id)}?alt=media`); if (!r) throw Error('fails Google Drive nav atrasts'); return r.arrayBuffer(); },
    async text(id) { return new TextDecoder().decode(await drive.get(id)); },
    async del(id) { await dfetch(`${DAPI}/files/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
  };
  async function resumable(url, method, meta, blob, type) {
    const r = await dfetch(url, { method, headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': type, 'X-Upload-Content-Length': String(blob.size) }, body: JSON.stringify(meta) });
    if (!r) return null;
    const loc = r.headers.get('Location'); if (!loc) throw Error('Google Drive neatgrieza augšupielādes adresi');
    const r2 = await dfetch(loc, { method: 'PUT', headers: { 'Content-Type': type }, body: blob });
    return (await r2.json()).id;
  }

  /* ---------- Josla “Google savienojums beidzies” ---------- */
  // moduļi reģistrē funkciju, kas atgriež { what: 'rezerves kopija', scope: 'drive' }, ja tiem vajag savienojumu
  const needs = [];
  let hideUntil = 0;
  const wanted = () => needs.map(f => { try { return f(); } catch (e) { return null; } }).filter(n => n && !has(n.scope));
  function paintBanner() {
    let b = document.getElementById('gBanner');
    const w = S.root && Date.now() > hideUntil ? wanted() : [];
    if (!w.length) { b?.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'gBanner'; b.className = 'gbanner'; b.setAttribute('role', 'status'); document.body.prepend(b); }
    b.classList.toggle('below-test', !!document.querySelector('.testbanner'));
    const what = [...new Set(w.map(n => n.what))];
    const html = `<span>☁ Google savienojums beidzies — ${U.esc(what.join(' un '))} ${what.length > 1 ? 'netiek sūtīti' : 'netiek sūtīta'} uz Google</span><button type="button" data-act="gConnect">Pieslēgties</button><button type="button" class="gb-x" data-act="gBannerHide" title="Paslēpt uz 30 minūtēm" aria-label="Paslēpt">✕</button>`;
    if (b.dataset.h !== html) { b.innerHTML = html; b.dataset.h = html; }
  }
  A.gConnect = async () => {
    const w = wanted(); if (!w.length) return paintBanner();
    const t = await token([...new Set(w.map(n => n.scope))], true);
    if (t) ui.toast('✓ Pieslēgts Google', 'ok', 3000);
  };
  A.gBannerHide = () => { hideUntil = Date.now() + 30 * 60000; paintBanner(); };
  setInterval(paintBanner, 30000);
  { const oc = CP.store.changed; let t = 0; CP.store.changed = (...a) => { const r = oc.apply(CP.store, a); clearTimeout(t); t = setTimeout(paintBanner, 1600); return r; }; }   // pēc saglabāšanas (revīzija mainās)
  CP.afterRender = CP.afterRender || []; CP.afterRender.push(paintBanner);
  CP.afterRootLoad = CP.afterRootLoad || []; CP.afterRootLoad.push(() => setTimeout(paintBanner, 500));

  CP.google = { SC, token, has, valid, forget, clientId, rememberClient, drive, needs, onToken: f => listeners.push(f), paintBanner, redirectUri, expiresAt: () => tok?.exp || 0 };
})(window.CP);


/* ==== js/encbackup.js ==== */
/* =====================================================================
   Šifrētā rezerves kopija — tieši Google Drive (caur Google kontu, bez programmas) vai mapē datorā.
   • Kopijā ir VISS datu mapes saturs (datu fails, dokumenti, veidlapas, veidnes) + ārējo mapju dokumenti.
     Darba mapes faili netiek mainīti — šifrēta ir tikai kopija.
   • Visi faili šifrēti ar vienu nejaušu galveno atslēgu (AES-GCM 256). Galvenā atslēga “ietīta” divreiz:
     ar paroli un ar atkopšanas kodu (PBKDF2-SHA-256, 600 000 iterācijas). Jebkurš no tiem atver kopiju.
   • Paroles mājiens glabājas atklāti (nedrīkst saturēt paroli). Savā datorā paroli var nomainīt bez vecās.
   • Papildu kopijas: tikai jaunie / mainītie faili. Kopijas mapē ir ATJAUNOT.html — atšifrē arī bez rīka.
   Kopijas struktūra (abos gadījumos):  CADET_rezerve/KOPIJA.json  +  CADET_rezerve/dati/<id>.bin  +  CADET_rezerve/ATJAUNOT.html
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc, store = CP.store;
  const ic = (n, f = '') => CP.ic(n, f);
  const FORMAT = 'cadet-rezerve', DIRNAME = 'CADET_rezerve', ITER = 600000;
  const SKIP = n => /^(_arhivi|_rezerves|\..*|~\$.*|desktop\.ini|thumbs\.db)$/i.test(n) || /\.crswap$/i.test(n);
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = u => { u = new Uint8Array(u); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  const hex = u => [...u].map(x => x.toString(16).padStart(2, '0')).join('');

  /* --- Kriptogrāfija --- */
  const CROCK = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const newRecovery = () => { const b = rnd(25); return [...b].map(x => CROCK[x & 31]).join('').match(/.{5}/g).join('-'); };
  const normRecovery = s => String(s || '').toUpperCase().replace(/[IL]/g, '1').replace(/O/g, '0').replace(/[^0-9A-Z]/g, '');
  async function kek(secret, salt, iter = ITER) {
    const base = await crypto.subtle.importKey('raw', te.encode(secret), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
  }
  async function wrap(master, secret) {
    const salt = rnd(16), iv = rnd(12), k = await kek(secret, salt);
    return { salt: b64(salt), iv: b64(iv), iter: ITER, key: b64(await crypto.subtle.wrapKey('raw', master, k, { name: 'AES-GCM', iv })) };
  }
  async function unwrap(w, secret) {
    const k = await kek(secret, unb64(w.salt), w.iter || ITER);
    return crypto.subtle.unwrapKey('raw', unb64(w.key), k, { name: 'AES-GCM', iv: unb64(w.iv) }, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  }
  async function encBytes(master, bytes) { const iv = rnd(12), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, master, bytes)); const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out; }
  async function decBytes(master, buf) { const u = new Uint8Array(buf); return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12) }, master, u.subarray(12))); }
  const encJson = async (m, o) => b64(await encBytes(m, te.encode(JSON.stringify(o))));
  const decJson = async (m, s) => JSON.parse(td.decode(await decBytes(m, unb64(s))));
  const sha = async bytes => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));


  /* --- Iestatījumi pārlūkā (IndexedDB): glabātuve (mape vai Google Drive), galvenā atslēga, pēdējās kopijas stāvoklis --- */
  const cfgGet = () => store.idbGet('encbak').catch(() => null);
  const cfgSet = v => store.idbSet('encbak', v);
  const G = () => CP.google;
  const isDrive = c => c?.kind === 'drive';
  const enabled = c => !!(c?.master && (c.dir || c.folderId));
  let CFG = null, running = false, status = '';
  (async () => { CFG = await cfgGet(); paint(); G()?.paintBanner(); })();

  /* --- Failu sistēma --- */
  async function sub(dir, name, create) { return dir.getDirectoryHandle(name, { create }); }
  async function readText(dir, name) { try { return await (await (await dir.getFileHandle(name)).getFile()).text(); } catch (e) { return null; } }
  async function writeBytes(dir, name, data) { const fh = await dir.getFileHandle(name, { create: true }), w = await fh.createWritable(); await w.write(data); await w.close(); return fh; }
  async function* walk(dir, pre = '', dirs = null) {
    for await (const [n, h] of dir.entries()) {
      if (SKIP(n)) continue;
      if (h.kind === 'directory') { dirs?.push(pre + n); yield* walk(h, pre + n + '/', dirs); } else yield [pre + n, h];
    }
  }
  async function perm(h, mode = 'readwrite', ask = false) {
    try { if ((await h.queryPermission({ mode })) === 'granted') return true; if (ask) return (await h.requestPermission({ mode })) === 'granted'; } catch (e) { }
    return false;
  }
  async function backupDirOf(h) {   // izvēlēta mape: pati CADET_rezerve vai tās vecākmape
    if (await readText(h, 'KOPIJA.json')) return h;
    try { const d = await h.getDirectoryHandle(DIRNAME); if (await readText(d, 'KOPIJA.json')) return d; } catch (e) { }
    return null;
  }
  /** Paralēli (n vienlaikus); pirmā kļūda aptur pārējos */
  async function pool(items, n, fn) {
    let i = 0, err = null;
    const w = async () => { while (i < items.length && !err) { const it = items[i++]; try { await fn(it); } catch (e) { err = err || e; } } };
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, w));
    if (err) throw err;
  }

  /* --- Glabātuves: mape datorā vai Google Drive. Abām viena struktūra: KOPIJA.json, ATJAUNOT.html, dati/<id>.bin --- */
  function localStore(bdir) {
    let ddir = null;
    return {
      kind: 'local', label: bdir.name,
      async open(create = true) { ddir = await sub(bdir, 'dati', create); return this; },
      readTop: n => readText(bdir, n),
      writeTop: (n, t) => writeBytes(bdir, n, t),
      hasTop: async n => (await readText(bdir, n)) !== null,
      async blobIds() { const s = new Set(); for await (const [n] of ddir.entries()) if (/\.bin$/.test(n)) s.add(n.slice(0, -4)); return s; },
      put: (id, bytes) => writeBytes(ddir, id + '.bin', bytes),
      async del(id) { try { await ddir.removeEntry(id + '.bin'); } catch (e) { } },
      async get(id) { return (await (await ddir.getFileHandle(id + '.bin')).getFile()).arrayBuffer(); },
      async wipe() { try { await bdir.removeEntry('dati', { recursive: true }); } catch (e) { } ddir = await sub(bdir, 'dati', true); }
    };
  }
  function driveStore(folderId) {
    const dr = G().drive; let did = '', top = new Map(), blobs = new Map();
    return {
      kind: 'drive', label: 'Google Drive', folderId,
      async open() {
        top = new Map(); blobs = new Map();
        for (const f of await dr.children(folderId)) top.set(f.name, f.id);
        did = top.get('dati') || await dr.mkdir('dati', folderId); top.set('dati', did);
        for (const f of await dr.children(did)) if (/\.bin$/.test(f.name)) blobs.set(f.name.slice(0, -4), f.id);
        return this;
      },
      async readTop(n) { const id = top.get(n); return id ? dr.text(id) : null; },
      async writeTop(n, t) { top.set(n, await dr.put(n, folderId, t, n.endsWith('.html') ? 'text/html' : 'application/json', top.get(n))); },
      hasTop: async n => top.has(n),
      async blobIds() { return new Set(blobs.keys()); },
      async put(id, bytes) { blobs.set(id, await dr.put(id + '.bin', did, bytes, 'application/octet-stream', blobs.get(id))); },
      async del(id) { const g = blobs.get(id); if (g) { await dr.del(g); blobs.delete(id); } },
      async get(id) { const g = blobs.get(id); if (!g) throw Error('fails nav atrasts Google Drive'); return dr.get(g); },
      async wipe() { if (did) await dr.del(did); did = await dr.mkdir('dati', folderId); top.set('dati', did); blobs = new Map(); }
    };
  }
  /** Piekļuve kopijas glabātuvei. ask=true → drīkst atvērt Google logu / prasīt mapes atļauju (tikai pēc klikšķa). */
  async function access(ask) {
    if (isDrive(CFG)) {
      if (!await G().token(['drive'], ask)) { status = 'auth'; paint(); G().paintBanner(); return null; }
      const m = await G().drive.meta(CFG.folderId);
      if (!m || m.trashed) throw Error(`Google Drive mape ${DIRNAME} nav atrasta (izdzēsta vai atkritnē). Atjauno to no Drive atkritnes vai iestati kopiju no jauna`);
      return driveStore(CFG.folderId).open();
    }
    if (!(await perm(CFG.dir, 'readwrite', ask))) { status = 'perm'; paint(); return null; }
    return localStore(await sub(CFG.dir, DIRNAME, true)).open(true);
  }

  /* --- Kopijas izveide / papildināšana --- */
  async function run({ ask = false, quiet = false } = {}) {
    if (running) return; if (!S.root) return;
    CFG = CFG || await cfgGet(); if (!enabled(CFG)) return;
    running = true; status = 'run'; paint();
    const t0 = Date.now(); let added = 0, kept = 0, removed = 0, bytes = 0, ext = 0, done = 0; const failed = [];
    try {
      const bs = await access(ask);
      if (!bs) { if (!quiet) ui.toast(status === 'auth' ? 'Pieslēdzies Google, lai nosūtītu rezerves kopiju — spied “Pieslēgties” joslā augšā vai “Izveidot kopiju tagad”.' : 'Rezerves kopijas mapei vajag atļauju — Iestatījumos spied “Izveidot kopiju tagad”.', 'warn', 9000); return; }
      status = 'run'; paint();
      if (S.dirty && !S.conflict) await store.save(true);
      const head = JSON.parse(await bs.readTop('KOPIJA.json') || 'null');
      if (!head || head.set !== CFG.set) throw Error('kopijas vietā ir citas kopijas fails — iestati kopiju no jauna');
      const idx = head.index ? await decJson(CFG.master, head.index) : { files: {} };
      const before = await bs.blobIds();
      // 1) visa datu mape, 2) dokumenti no ārējām (papildu) mapēm — ja tās pieslēgtas
      const jobs = [], dirs = [];
      for await (const [rel, fh] of walk(S.root, '', dirs)) jobs.push(['main/' + rel, fh, {}, rel]);
      idx.dirs = dirs;
      for (const d of S.db.documents || []) {
        const sid = d.sourceId || 'main'; if (sid === 'main' || !d.path || String(sid).startsWith('fails:')) continue;
        const h = await store.handleFor(d.path, sid); if (!h) { failed.push(`(ārējā mape) ${d.path}`); continue; }
        const src = (S.db.sources || []).find(s => s.id === sid);
        jobs.push([`ext/${sid}/${d.path}`, h, { src: src?.name || sid }, d.path]); ext++;
      }
      const seen = new Set();
      await pool(jobs, isDrive(CFG) ? 4 : 1, async ([key, fh, meta, label]) => {
        seen.add(key);
        try {
          const f = await fh.getFile(), old = idx.files[key];
          if (old && old.size === f.size && old.lm === f.lastModified) kept++;
          else {
            // mainīts fails vienmēr iet jaunā blobā; vecais tiek dzēsts tikai pēc tam, kad KOPIJA.json saglabāts → pārtraukta kopija nekad nesabojā iepriekšējo
            const data = new Uint8Array(await f.arrayBuffer()), id = hex(rnd(12));
            await bs.put(id, await encBytes(CFG.master, data));
            idx.files[key] = { id, size: f.size, lm: f.lastModified, sha: await sha(data), ...meta }; added++; bytes += f.size;
          }
        } catch (e) { if (e.auth || e.api) throw e; console.error(key, e); failed.push(label); }
        if (++done % 10 === 0) { status = `run:${done}/${jobs.length}`; paint(); await new Promise(r => setTimeout(r, 0)); }
      });
      // 3) dzēstie faili → noņem no kopijas
      for (const k of Object.keys(idx.files)) if (!seen.has(k)) { delete idx.files[k]; removed++; }
      head.index = await encJson(CFG.master, idx); head.updated = U.now(); head.version = CP.VERSION;
      head.stats = { files: Object.keys(idx.files).length, bytes: Object.values(idx.files).reduce((a, f) => a + f.size, 0) };
      head.root = S.rootName; head.store = isDrive(CFG) ? 'drive' : 'local';
      await bs.writeTop('KOPIJA.json', JSON.stringify(head, null, 1));
      const rh = await sha(te.encode(RESTORE_HTML));
      if (CFG.rh !== rh || !(await bs.hasTop('ATJAUNOT.html'))) { await bs.writeTop('ATJAUNOT.html', RESTORE_HTML); CFG.rh = rh; }
      // 4) vecās versijas un pārtraukto kopiju atliekas
      const keep = new Set(Object.values(idx.files).map(f => f.id));
      await pool([...before].filter(id => !keep.has(id)), isDrive(CFG) ? 4 : 1, id => bs.del(id).catch(() => { }));
      CFG.last = { at: U.now(), rev: S.db.revision, files: head.stats.files, bytes: head.stats.bytes, added, removed, failed: failed.length, ms: Date.now() - t0 };
      delete CFG.lastErr; await cfgSet(CFG); status = failed.length ? 'partial' : 'ok';
      if (!quiet || failed.length) ui.toast(failed.length ? `Rezerves kopija izveidota, bet ${failed.length} faili netika iekļauti (piem., ${failed[0]})` : `🔐 Rezerves kopija${isDrive(CFG) ? ' Google Drive' : ''} atjaunināta: ${faili(head.stats.files)} (${added} jauni/mainīti${removed ? `, ${removed} noņemti` : ''})`, failed.length ? 'warn' : 'ok', 7000);
    } catch (e) {
      console.error(e);
      if (e.auth) { status = 'auth'; G().paintBanner(); if (!quiet) ui.toast(e.message, 'warn', 9000); }
      else { status = 'err'; CFG.lastErr = { at: U.now(), msg: e.message }; await cfgSet(CFG); ui.toast('Rezerves kopiju neizdevās izveidot: ' + e.message, 'err', 12000); }
    }
    finally { running = false; paint(); G()?.paintBanner(); }
  }
  const pending = () => !!(S.db && enabled(CFG) && (!CFG.last || S.db.revision !== CFG.last.rev));
  // automātiski: ik 10 min pārbauda; ja datos ir izmaiņas un kopija vecāka par 30 min
  setInterval(() => { if (CFG?.last && S.root && !running && pending() && Date.now() - new Date(CFG.last.at) > 30 * 60000) run({ quiet: true }); }, 10 * 60000);
  CP.afterRootLoad = (CP.afterRootLoad || []); CP.afterRootLoad.push(() => setTimeout(async () => { CFG = await cfgGet(); G()?.paintBanner(); if (CFG?.last && pending() && Date.now() - new Date(CFG.last.at) > 6 * 3600000) run({ quiet: true }); }, 8000));
  // Google josla: kopija Google Drive, ir nenosūtītas izmaiņas, savienojums beidzies
  G()?.needs.push(() => isDrive(CFG) && S.root && pending() ? { what: 'rezerves kopija', scope: 'drive' } : null);
  // tikko pieslēdzās Google (josla “Pieslēgties”) → nosūta uzreiz
  G()?.onToken(() => { if (isDrive(CFG) && S.root && G().has('drive') && !running && (pending() || status === 'auth')) run({ quiet: false }); });

  /* --- Iestatījumu kartīte --- */
  const faili = n => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'fails' : 'faili'}`;
  const fmtB = n => n > 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' kB';
  const hhmm = t => new Date(t).toTimeString().slice(0, 5);
  function card() {
    const c = CFG, L = c?.last, drv = isDrive(c);
    const st = running ? `<span class="spin"></span> ${drv ? 'Sūta uz Google Drive' : 'Veido kopiju'}…${status.startsWith('run:') ? ` ${status.slice(4)} faili` : ''}`
      : status === 'perm' ? '<span class="warn">Kopijas mapei vajag atļauju — spied “Izveidot kopiju tagad”.</span>'
      : status === 'auth' ? '<span class="warn">Google savienojums beidzies — spied “Izveidot kopiju tagad” vai “Pieslēgties” joslā augšā.</span>'
      : L ? `<span class="${L.failed ? 'warn' : 'okc'}">✓ Pēdējā kopija: ${esc(U.fmtDateTime(L.at))} · ${faili(L.files)} · ${fmtB(L.bytes)}${L.failed ? ` · ${L.failed} nav iekļauti` : ''}</span>` : '<span class="muted">Kopija vēl nav izveidota.</span>';
    const where = drv ? `☁ Google Drive / ${DIRNAME} <a class="small" href="https://drive.google.com/drive/folders/${encodeURIComponent(c.folderId)}" target="_blank" rel="noopener noreferrer">↗ atvērt</a>` : c?.dir ? `📁 ${esc(c.dir.name)} / ${DIRNAME}` : '';
    const gstate = drv ? (G().has('drive') ? `<span class="okc">✓ pieslēgts līdz ${hhmm(G().expiresAt())}</span>` : '<span class="muted">nav pieslēgts — pieslēgsies, spiežot “Izveidot kopiju tagad”</span>') : '';
    return `<section class="card" id="encCard"><h3>${ic('shield', '🔐')}Šifrētā rezerves kopija</h3>
      <p class="small" style="margin-top:0">Viss datu mapes saturs (personas, dokumenti, veidlapas) šifrētā veidā <b>Google Drive</b> vai citā mapē. Darba mapes faili netiek mainīti. Pazaudējot datoru, visu var atjaunot ar paroli vai atkopšanas kodu.</p>
      ${enabled(c) ? `${ui.dl([['Kopijas vieta', where, 1], ...(drv ? [['Google', gstate, 1]] : []), ['Stāvoklis', st, 1], ['Paroles mājiens', c.hint ? esc(c.hint) : '<span class="muted">nav</span>', 1]])}
        <div class="actions" style="margin-top:10px"><button class="mainbtn" data-act="encRun" ${running ? 'disabled' : ''}>↻ Izveidot kopiju tagad</button><button data-act="encPw">Mainīt paroli</button><button data-act="encNewCode">Jauns atkopšanas kods</button><button class="ghost" data-act="encRestore">Atjaunot no kopijas…</button><button class="ghost danger" data-act="encOff">Atslēgt</button></div>
        <p class="small muted">${drv ? 'Kamēr rīks ir atvērts un esi pieslēdzies Google, kopija tiek papildināta automātiski: tikai jaunie un mainītie faili. Google savienojums ir derīgs apmēram 1 stundu; kad tas beidzas un ir ko sūtīt, augšā parādās josla ar pogu “Pieslēgties”.' : 'Kopija tiek papildināta automātiski, kamēr rīks ir atvērts: tikai jaunie un mainītie faili. Google Drive tos sinhronizē pats.'}</p>`
      : `<div class="actions"><button class="mainbtn" data-act="encSetup">🔐 Iestatīt šifrēto kopiju</button><button class="ghost" data-act="encRestore">Atjaunot no kopijas…</button></div>`}</section>`;
  }
  const paint = () => { const el = U.$('encCard'); if (el) el.outerHTML = card(); };
  CP.encBackup = { card, run, paint };
  // brīdinājums pārskatā: kopija sen nav atjaunota vai gaida atļauju
  { const orig = D.alerts; D.alerts = () => { const out = orig(); if (enabled(CFG) && S.root) { const age = CFG.last ? (Date.now() - new Date(CFG.last.at)) / 864e5 : 99; if (status === 'perm' || age > 7) out.push({ kind: 'backup', sev: 1, when: CFG.last?.at?.slice(0, 10) || '', msg: status === 'perm' ? 'Šifrētajai rezerves kopijai vajag atļauju — Iestatījumos spied “Izveidot kopiju tagad”' : `Šifrētā rezerves kopija nav atjaunota ${CFG.last ? Math.floor(age) + ' dienas' : 'ne reizi'} — Iestatījumos spied “Izveidot kopiju tagad”` }); } return out; }; }

  /* --- Iestatīšana --- */
  function dlg(id, html, cls = '') { let d = U.$(id); if (!d) { d = document.createElement('dialog'); d.id = id; document.body.appendChild(d); } d.className = cls; d.innerHTML = html; if (!d.open) d.showModal(); return d; }
  const pwOk = (pw, hint) => pw.length < 8 ? 'Parolei jābūt vismaz 8 zīmes garai' : hint && U.norm(hint).includes(U.norm(pw)) ? 'Mājiens nedrīkst saturēt pašu paroli' : '';
  const CID_RE = /\.apps\.googleusercontent\.com$/;
  const cidField = (id, v) => `<div class="enc-cid"><label class="small">Google OAuth Client ID <button type="button" class="sm ghost" data-act="gcalHelp" data-arg="drive">? Kā iegūt</button></label>
    <input id="${id}" value="${esc(v)}" placeholder="xxxxxxxx-xxxx.apps.googleusercontent.com" spellcheck="false" autocomplete="off"></div>`;
  let setupDir = null;
  A.encSetup = () => {
    if (!S.root) return CP.needRoot?.();
    setupDir = null;
    const cid = G().clientId();
    const d = dlg('encDialog', `<form><header class="dlg-head"><h2>🔐 Šifrētās rezerves kopijas iestatīšana</h2><button type="button" class="ghost" data-close="encDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body">
        <div class="field"><label>1. Kur glabāt kopiju</label>
          <div class="choice-list">
            <label class="choice"><input type="radio" name="where" value="drive" checked><div class="grow"><b>☁ Google Drive — tieši no rīka</b><div class="small muted">Nekas nav jāinstalē. Rīks pieslēdzas tavam Google kontam un Drive izveido mapi ${DIRNAME}. Rīks redz tikai savus failus, nevis visu tavu Drive.</div>
              ${cid ? `<div class="small okc" id="encCidOk">✓ Google Client ID jau iestatīts (tas pats, kas kalendāram). Ja kalendāram Drive API vēl nav ieslēgts: <a href="#" data-act="gcalHelp" data-arg="drive">2. solis</a>.</div><input type="hidden" id="encCid" value="${esc(cid)}">` : cidField('encCid', '')}</div></label>
            <label class="choice"><input type="radio" name="where" value="local"><div class="grow"><b>📁 Mape datorā / zibatmiņā</b><div class="small muted">Mape, ko sinhronizē Google Drive programma, ārējs disks vai zibatmiņa (ne pati datu mape).</div>
              <div class="inline-form" style="margin:6px 0 0"><button type="button" data-act="encPickDir">📁 Izvēlēties mapi</button><span id="encDirName" class="muted small"></span></div></div></label>
          </div></div>
        <div class="fieldgrid"><div class="field"><label>2. Parole (vismaz 8 zīmes)</label><input type="password" name="pw" autocomplete="new-password" required></div>
          <div class="field"><label>Parole vēlreiz</label><input type="password" name="pw2" autocomplete="new-password" required></div>
          <div class="field wide"><label>Paroles mājiens (nav obligāts, redzams visiem, kam ir kopijas fails)</label><input name="hint" placeholder="piem., pirmā suņa vārds + gads" autocomplete="off"></div></div>
        <p class="small muted">Nākamajā solī rīks parādīs <b>atkopšanas kodu</b> — ar to kopiju var atvērt arī tad, ja aizmirsti paroli.</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="encDialog">Atcelt</button><button class="mainbtn" type="submit">Tālāk →</button></footer></form>`);
    const f = d.querySelector('form');
    d.querySelector('.dlg-body').addEventListener('focusin', e => { if (e.target.id === 'encCid') f.where.value = 'drive'; });
    f.onsubmit = async e => {
      e.preventDefault();
      const drv = f.where.value === 'drive', cid = (U.$('encCid')?.value || '').trim();
      if (!drv && !setupDir) return ui.toast('Izvēlies mapi kopijai', 'warn');
      if (drv && !CID_RE.test(cid)) return ui.toast('Ielīmē Google Client ID (beidzas ar .apps.googleusercontent.com). Kā to iegūt — spied “? Kā iegūt”.', 'warn', 9000);
      if (f.pw.value !== f.pw2.value) return ui.toast('Paroles nesakrīt', 'warn');
      const bad = pwOk(f.pw.value, f.hint.value.trim()); if (bad) return ui.toast(bad, 'warn');
      let existing = null;
      if (drv) {
        const gcs = S.db.settings.gcal = S.db.settings.gcal || { clientId: '', calendarId: '', lastSync: '' };
        if (!gcs.clientId) { gcs.clientId = cid; store.changed({ silent: true }); }
        if (!await G().token(['drive'], true, cid)) return;
        try {
          for (const fo of await G().drive.findFolders(DIRNAME, 'root')) { const k = await G().drive.children(fo.id, " and name='KOPIJA.json'"); if (k.length) { existing = fo.id; break; } }
        } catch (x) { return ui.toast(x.message, 'err', 12000); }
        if (existing && !confirm(`Tavā Google Drive jau ir CADET rezerves kopija (mape ${DIRNAME}). Izveidot jaunu? Vecā kopija tiks aizstāta.`)) return;
      } else {
        existing = await backupDirOf(setupDir);
        if (existing && !confirm('Šajā mapē jau ir CADET rezerves kopija. Izveidot jaunu? Vecā kopija šajā mapē tiks aizstāta.')) return;
      }
      try {
        const master = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']), code = newRecovery();
        const head = { format: FORMAT, v: 1, set: hex(rnd(8)), created: U.now(), updated: '', root: S.rootName, hint: f.hint.value.trim(), store: drv ? 'drive' : 'local', wraps: { pw: await wrap(master, f.pw.value), rc: await wrap(master, normRecovery(code)) }, index: '' };
        showCode(code, async () => {
          try {
            if (drv) {
              if (!await G().token(['drive'], true, cid)) return ui.toast('Bez Google savienojuma kopiju nevar izveidot. Mēģini vēlreiz.', 'warn');
              const fid = existing || await G().drive.mkdir(DIRNAME);
              const bs = await driveStore(fid).open(); if (existing) await bs.wipe();
              await bs.writeTop('KOPIJA.json', JSON.stringify(head, null, 1));
              CFG = { kind: 'drive', folderId: fid, master, set: head.set, hint: head.hint, created: head.created };
            } else {
              const bdir = await sub(setupDir, DIRNAME, true);
              if (existing) await localStore(bdir).wipe();
              await writeBytes(bdir, 'KOPIJA.json', JSON.stringify(head, null, 1));
              CFG = { dir: setupDir, master, set: head.set, hint: head.hint, created: head.created };
            }
            await cfgSet(CFG); U.$('encDialog').close(); status = ''; paint(); run({ ask: true });
          } catch (x) { console.error(x); ui.toast('Neizdevās: ' + x.message, 'err', 12000); }
        }, drv ? cid : '');
      } catch (x) { console.error(x); ui.toast('Neizdevās: ' + x.message, 'err'); }
    };
  };
  // Client ID saglabāts palīga logā → ieliek iestatīšanas logā
  CP.encBackup.clientSaved = v => { const i = U.$('encCid'); if (i) i.value = v; const f = U.$('encDialog')?.querySelector('form'); if (f?.where) f.where.value = 'drive'; const r = U.$('encResCid'); if (r) r.value = v; ui.toast('✓ Client ID saglabāts', 'ok', 3000); };
  A.encPickDir = async () => {
    const f = U.$('encDialog')?.querySelector('form'); if (f?.where) f.where.value = 'local';
    try {
      const h = await showDirectoryPicker({ id: 'cadet-encbak', mode: 'readwrite' });
      if (S.root && await S.root.resolve(h) !== null) return ui.toast('Šī mape ir datu mapē. Izvēlies citu vietu.', 'warn', 8000);
      if (S.root && await h.resolve(S.root) !== null) return ui.toast('Datu mape atrodas šajā mapē. Izvēlies atsevišķu mapi kopijai.', 'warn', 8000);
      setupDir = h; const el = U.$('encDirName'); if (el) { el.textContent = '✓ ' + h.name; el.className = 'okc small'; }
    } catch (e) { if (e.name !== 'AbortError') ui.toast('Mapi neizdevās izvēlēties: ' + e.message, 'err'); }
  };
  function codeSheet(code, cid) {
    return `<div style="font:14px/1.5 Arial;padding:24mm;color:#000"><h1 style="font-size:20px">CADET PERSONĀLS — rezerves kopijas atkopšanas kods</h1>
      <p>Datu mape: <b>${esc(S.rootName || '')}</b> · Izveidots: ${esc(U.fmtDate(U.iso()))}</p>
      <p style="font:700 24px/1.6 monospace;letter-spacing:2px;border:2px solid #000;padding:12px 16px;display:inline-block">${esc(code)}</p>
      <p>Ar šo kodu var atvērt šifrēto rezerves kopiju, ja aizmirsta parole. Glabā drošā vietā (piem., aizslēgtā atvilktnē), atsevišķi no datora. Nefotografē un nesūti to.</p>
      ${cid ? `<p><b>Kopija glabājas Google Drive</b> (mape ${DIRNAME}). Atjaunojot citā datorā, vajadzēs šo Google Client ID (tas nav slepens):<br><span style="font:12px monospace;word-break:break-all">${esc(cid)}</span><br>To var atrast arī console.cloud.google.com → Google Auth Platform → Clients.</p>` : ''}
      <p>Atjaunošana: rīkā “Atjaunot no šifrētās kopijas” vai kopijas mapē atver failu ATJAUNOT.html.</p></div>`;
  }
  function showCode(code, onDone, cid = '') {
    const d = dlg('encCodeDialog', `<form><header class="dlg-head"><h2>Atkopšanas kods</h2></header>
      <div class="dlg-body"><p style="margin-top:0">Ar šo kodu kopiju var atvērt, <b>ja aizmirsti paroli</b>. Tas tiek parādīts <b>tikai tagad</b>.</p>
        <div class="enc-code">${esc(code)}</div>
        <div class="actions"><button type="button" data-act="copy" data-arg="${esc(code)}">⧉ Kopēt</button><button type="button" id="encPrint">🖨 Izdrukāt / saglabāt PDF</button></div>
        <p class="small muted">Izdrukā vai pieraksti un glabā drošā vietā atsevišķi no datora. Nesūti to e-pastā un neliec Google Drive.${cid ? ' Izdrukā ir arī Google Client ID, kas vajadzīgs atjaunošanai citā datorā.' : ''}</p>
        <label class="check" style="margin-top:10px"><input type="checkbox" name="ok"> Esmu kodu saglabājis drošā vietā</label></div>
      <footer class="dlg-foot"><span class="grow"></span><button class="mainbtn" type="submit" disabled>Pabeigt un izveidot kopiju</button></footer></form>`);
    const f = d.querySelector('form');
    f.ok.onchange = () => { f.querySelector('[type=submit]').disabled = !f.ok.checked; };
    d.addEventListener('cancel', e => e.preventDefault());
    U.$('encPrint').onclick = () => { const n = document.createElement('div'); n.innerHTML = codeSheet(code, cid); CP.setPrintSource({ kind: 'html', node: n }); d.close(); A.printGo(); setTimeout(() => { if (!d.open) d.showModal(); }, 800); };
    f.onsubmit = async e => { e.preventDefault(); d.close(); await onDone(); };
  }
  async function editHead(fn) {
    CFG = CFG || await cfgGet();
    const bs = await access(true); if (!bs) throw Error(isDrive(CFG) ? 'nav Google savienojuma' : 'kopijas mapei nav atļaujas');
    const head = JSON.parse(await bs.readTop('KOPIJA.json'));
    await fn(head); await bs.writeTop('KOPIJA.json', JSON.stringify(head, null, 1)); await cfgSet(CFG); status = ''; paint();
  }
  A.encPw = () => {
    const d = dlg('encPwDialog', `<form><header class="dlg-head"><h2>Mainīt paroli</h2><button type="button" class="ghost" data-close="encPwDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><p class="small muted" style="margin-top:0">Šajā datorā vecā parole nav vajadzīga. Atkopšanas kods paliek tas pats.</p><div class="fieldgrid">
        <div class="field"><label>Jaunā parole</label><input type="password" name="pw" autocomplete="new-password" required></div><div class="field"><label>Vēlreiz</label><input type="password" name="pw2" autocomplete="new-password" required></div>
        <div class="field wide"><label>Paroles mājiens (nav obligāts)</label><input name="hint" value="${esc(CFG?.hint || '')}" autocomplete="off"></div></div></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="encPwDialog">Atcelt</button><button class="mainbtn" type="submit">Saglabāt</button></footer></form>`);
    d.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const f = e.target; if (f.pw.value !== f.pw2.value) return ui.toast('Paroles nesakrīt', 'warn');
      const bad = pwOk(f.pw.value, f.hint.value.trim()); if (bad) return ui.toast(bad, 'warn');
      try { await editHead(async h => { h.wraps.pw = await wrap(CFG.master, f.pw.value); h.hint = f.hint.value.trim(); CFG.hint = h.hint; }); d.close(); ui.toast('Parole nomainīta', 'ok'); } catch (x) { ui.toast('Neizdevās: ' + x.message, 'err'); }
    };
  };
  A.encNewCode = () => {
    if (!confirm('Izveidot jaunu atkopšanas kodu? Vecais kods vairs nederēs.')) return;
    const code = newRecovery();
    showCode(code, async () => { try { await editHead(async h => { h.wraps.rc = await wrap(CFG.master, normRecovery(code)); }); ui.toast('Jaunais atkopšanas kods saglabāts', 'ok'); } catch (x) { ui.toast('Neizdevās: ' + x.message, 'err'); } }, isDrive(CFG) ? G().clientId() : '');
  };
  A.encRun = () => run({ ask: true });
  A.encOff = async () => { if (!confirm(`Atslēgt šifrēto rezerves kopiju šajā datorā? Jau izveidotā kopija ${isDrive(CFG) ? 'Google Drive' : 'mapē'} paliek, un to var atjaunot ar paroli vai atkopšanas kodu.`)) return; CFG = null; status = ''; await store.idbSet('encbak', null); paint(); G()?.paintBanner(); };

  /* --- Atjaunošana (arī bez datu mapes — no sākuma lapas) --- */
  let R = null;
  A.encRestore = () => {
    const cid = G()?.clientId() || '';
    dlg('encResDialog', `<header class="dlg-head"><h2>Atjaunot no šifrētās kopijas</h2><button type="button" class="ghost" data-close="encResDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><p style="margin-top:0">Kur ir kopija?</p>
        <div class="choice-list">
          <div class="choice"><div class="grow"><b>☁ Google Drive</b><div class="small muted">Kopija, ko rīks sūtīja tieši uz Google Drive. Vajag to pašu Google Client ID (tas ir uz izdrukātās atkopšanas koda lapas).</div>
            <div class="enc-cid"><label class="small">Google OAuth Client ID</label><input id="encResCid" value="${esc(cid)}" placeholder="xxxxxxxx-xxxx.apps.googleusercontent.com" spellcheck="false" autocomplete="off"></div>
            <div class="actions" style="margin-top:8px"><button type="button" class="mainbtn" data-act="encRestoreDrive">☁ Pieslēgties Google un atrast kopiju</button></div></div></div>
          <div class="choice"><div class="grow"><b>📁 Mape datorā / zibatmiņā</b><div class="small muted">Mape ${DIRNAME} — arī tāda, kas lejupielādēta no Google Drive un atarhivēta.</div>
            <div class="actions" style="margin-top:8px"><button type="button" data-act="encRestoreLocal">📁 Izvēlēties kopijas mapi</button></div></div></div>
        </div></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="encResDialog">Atcelt</button></footer>`);
  };
  A.encRestoreLocal = async () => {
    let h; try { h = await showDirectoryPicker({ id: 'cadet-encbak', mode: 'read' }); } catch (e) { return; }
    const bdir = await backupDirOf(h); if (!bdir) return ui.toast(`Šajā mapē nav CADET rezerves kopijas (meklē mapi ${DIRNAME} ar failu KOPIJA.json)`, 'warn', 9000);
    const head = JSON.parse(await readText(bdir, 'KOPIJA.json'));
    if (head.format !== FORMAT) return ui.toast('Neatpazīts kopijas formāts', 'err');
    pwDialog(() => localStore(bdir).open(false), head);
  };
  A.encRestoreDrive = async (arg, el) => {
    const cid = (U.$('encResCid')?.value || '').trim();
    if (!CID_RE.test(cid)) return ui.toast('Ielīmē Google Client ID (beidzas ar .apps.googleusercontent.com)', 'warn', 8000);
    if (!await G().token(['drive'], true, cid)) return;
    if (el) { el.disabled = true; el.innerHTML = '<span class="spin"></span> Meklē Google Drive…'; }
    const found = [];
    try {
      for (const fo of await G().drive.findFolders(DIRNAME)) {
        const k = await G().drive.children(fo.id, " and name='KOPIJA.json'"); if (!k.length) continue;
        try { const head = JSON.parse(await G().drive.text(k[0].id)); if (head.format === FORMAT && head.index) found.push({ id: fo.id, head }); } catch (e) { }
      }
    } catch (x) { if (el) { el.disabled = false; el.textContent = '☁ Pieslēgties Google un atrast kopiju'; } return ui.toast(x.message, 'err', 12000); }
    if (el) { el.disabled = false; el.textContent = '☁ Pieslēgties Google un atrast kopiju'; }
    if (!found.length) return ui.toast(`Šajā Google kontā nav atrasta CADET rezerves kopija, ko izveidojis rīks ar šo Client ID. Pārbaudi kontu un Client ID; ja kopiju lejupielādēji, izvēlies “Mape datorā”.`, 'warn', 12000);
    found.sort((a, b) => String(b.head.updated || b.head.created).localeCompare(String(a.head.updated || a.head.created)));
    if (found.length === 1) return pwDialog(() => driveStore(found[0].id).open(), found[0].head);
    // vairākas kopijas → izvēle
    const d = dlg('encResDialog', `<form><header class="dlg-head"><h2>Kuru kopiju atjaunot?</h2><button type="button" class="ghost" data-close="encResDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><div class="choice-list">${found.map((x, i) => `<label class="choice"><input type="radio" name="k" value="${i}" ${i ? '' : 'checked'}><div class="grow"><b>${esc(x.head.root || 'Datu mape')}</b><div class="small muted">Pēdējā kopija: ${esc(U.fmtDateTime(x.head.updated || x.head.created))} · ${x.head.stats ? faili(x.head.stats.files) + ' · ' + fmtB(x.head.stats.bytes) : ''}</div></div></label>`).join('')}</div></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="encResDialog">Atcelt</button><button class="mainbtn" type="submit">Tālāk →</button></footer></form>`);
    d.querySelector('form').onsubmit = e => { e.preventDefault(); const x = found[+e.target.k.value]; pwDialog(() => driveStore(x.id).open(), x.head); };
  };
  function pwDialog(open, head) {
    R = { open, head, master: null };
    const d = dlg('encResDialog', `<form><header class="dlg-head"><h2>Atjaunot no šifrētās kopijas</h2><button type="button" class="ghost" data-close="encResDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body">${ui.dl([['Kopija', head.store === 'drive' ? '☁ Google Drive' : '📁 Mape', 1], ['Datu mape kopijā', esc(head.root || '—'), 1], ['Pēdējā kopija', esc(U.fmtDateTime(head.updated || head.created)), 1], ['Faili', `${head.stats?.files ?? '—'}${head.stats ? ' · ' + fmtB(head.stats.bytes) : ''}`, 1]])}
        <div class="choice-list"><label class="choice"><input type="radio" name="how" value="pw" checked><div class="grow"><b>Parole</b>${head.hint ? `<div class="small muted">Mājiens: ${esc(head.hint)}</div>` : ''}<input type="password" name="pw" autocomplete="current-password" style="margin-top:8px"></div></label>
          <label class="choice"><input type="radio" name="how" value="rc"><div class="grow"><b>Aizmirsi paroli? Atkopšanas kods</b><input name="rc" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" autocomplete="off" spellcheck="false" style="margin-top:8px;font-family:monospace"></div></label></div>
        <p class="small muted">Nākamajā solī izvēlies <b>tukšu mapi</b>, kur atjaunot. Esošie faili netiek pārrakstīti.</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="encResDialog">Atcelt</button><button class="mainbtn" type="submit">Pārbaudīt un izvēlēties mapi →</button></footer></form>`);
    const f = d.querySelector('form');
    f.pw.addEventListener('focus', () => { f.how.value = 'pw'; }); f.rc.addEventListener('focus', () => { f.how.value = 'rc'; });
    f.onsubmit = async e => {
      e.preventDefault();
      const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Pārbauda…';
      try { R.master = f.how.value === 'rc' ? await unwrap(head.wraps.rc, normRecovery(f.rc.value)) : await unwrap(head.wraps.pw, f.pw.value); }
      catch (x) { btn.disabled = false; btn.textContent = 'Pārbaudīt un izvēlēties mapi →'; return ui.toast(f.how.value === 'rc' ? 'Nepareizs atkopšanas kods' : 'Nepareiza parole', 'err', 6000); }
      btn.disabled = false; btn.textContent = '📁 Izvēlēties mapi, kur atjaunot'; btn.dataset.ready = '1';
      f.onsubmit = ev => { ev.preventDefault(); A.encRestoreTo(); };
      ui.toast('✓ Kopija atvērta. Tagad izvēlies tukšu mapi, kur atjaunot.', 'ok', 6000);
    };
  }
  A.encRestoreTo = async () => {
    let t; try { t = await showDirectoryPicker({ id: 'cadet-restore', mode: 'readwrite' }); } catch (e) { return; }
    for await (const [n] of t.entries()) if (!SKIP(n)) { return ui.toast('Izvēlētā mape nav tukša. Izveido jaunu, tukšu mapi un izvēlies to.', 'warn', 9000); }
    const d = U.$('encResDialog'), body = d.querySelector('.dlg-body'), foot = d.querySelector('.dlg-foot');
    foot.innerHTML = ''; body.innerHTML = `<p><span class="spin"></span> Atjauno${R.head.store === 'drive' ? ' no Google Drive' : ''}… <b id="encResN">0</b> faili</p>`;
    try {
      const n = await restoreInto(await R.open(), R.head, R.master, t, k => { const el = U.$('encResN'); if (el) el.textContent = k; });
      body.innerHTML = `<p class="okc"><b>✓ Atjaunoti ${n.ok} faili</b>${n.bad ? ` · <span class="red">${n.bad} ar kļūdu</span>` : ''}. Visi pārbaudīti ar kontrolsummu.</p><p>Mape “${esc(t.name)}” tagad tiks pieslēgta kā datu mape.</p>${R.head.store === 'drive' ? '<p class="small muted">Lai kopija arī turpmāk ietu uz Google Drive, Iestatījumos → “Šifrētā rezerves kopija” iestati to no jauna (vecā kopija tiks aizstāta).</p>' : ''}`;
      foot.innerHTML = '<span class="grow"></span><button class="mainbtn" data-close="encResDialog">Gatavs</button>';
      await store.connectRoot(t, 'atjaunots no šifrētās kopijas');
    } catch (x) { console.error(x); body.innerHTML = `<p class="red">Atjaunošana neizdevās: ${esc(x.message)}</p>`; foot.innerHTML = '<span class="grow"></span><button data-close="encResDialog">Aizvērt</button>'; }
  };
  /** Kopijas atšifrēšana mapē. src: glabātuve (localStore/driveStore) vai kopijas mapes rokturis.
      Ārējo mapju dokumenti → _atjaunoti_no_arejam_mapem/<mape>/…, datu failā sasaiste pārlikta uz pamatmapi. */
  async function restoreInto(src, head, master, target, onProg) {
    const bs = src.kind ? src : await localStore(src).open(false);
    const idx = await decJson(master, head.index);
    let ok = 0, bad = 0; const moved = {};
    for (const d of idx.dirs || []) { let dir = target; for (const p of d.split('/')) dir = await dir.getDirectoryHandle(p, { create: true }); }
    const mkdirs = async parts => { let dir = target; for (const p of parts) dir = await dir.getDirectoryHandle(p, { create: true }); return dir; };
    await pool(Object.entries(idx.files), bs.kind === 'drive' ? 4 : 1, async ([key, v]) => {
      try {
        const data = await decBytes(master, await bs.get(v.id));
        if (await sha(data) !== v.sha) throw Error('kontrolsumma nesakrīt');
        let rel = key.replace(/^main\//, '');
        if (key.startsWith('ext/')) { const [, sid, ...p] = key.split('/'); rel = `_atjaunoti_no_arejam_mapem/${String(v.src || sid).replace(/[\\/:*?"<>|]/g, '_')}/${p.join('/')}`; moved[sid + '|' + p.join('/')] = rel; }
        const parts = rel.split('/');
        await writeBytes(await mkdirs(parts.slice(0, -1)), parts.at(-1), data);
        ok++; if (ok % 10 === 0) { onProg?.(ok); await new Promise(r => setTimeout(r, 0)); }
      } catch (e) { if (e.auth) throw e; console.error(key, e); bad++; }
    });
    // datu fails: ārējo dokumentu sasaiste uz atjaunotajām kopijām pamatmapē
    if (Object.keys(moved).length) {
      const v = idx.files['main/' + CP.DATAFILE];
      if (v) {
        const db = JSON.parse(td.decode(await decBytes(master, await bs.get(v.id))));
        for (const d of db.documents || []) { const m = moved[(d.sourceId || 'main') + '|' + d.path]; if (m) { d.sourceId = 'main'; d.path = m; } }
        await writeBytes(target, CP.DATAFILE, JSON.stringify(db, null, 2));
      }
    }
    onProg?.(ok);
    return { ok, bad };
  }
  CP.encBackup.restoreInto = restoreInto;
  CP.encBackup._stores = { localStore, driveStore };


  /* --- Atjaunošanas lapa bez rīka (ATJAUNOT.html kopijas mapē) --- */
  const RESTORE_HTML = `<!doctype html><html lang="lv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CADET rezerves kopijas atjaunošana</title>
<style>body{font:15px/1.5 system-ui,Segoe UI,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;background:#0f1418;color:#e8eef2}h1{font-size:22px}button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #3a5668;background:#1f3a4d;color:#fff;cursor:pointer}input{font:inherit;padding:8px;border-radius:8px;border:1px solid #3a5668;background:#0b1219;color:#fff;width:100%;box-sizing:border-box}.box{border:1px solid #2b3f4c;border-radius:12px;padding:14px 16px;margin:12px 0}.muted{color:#9fb3c3}.ok{color:#7fe0aa}.err{color:#f08a8a}</style></head><body>
<h1>CADET PERSONĀLS — šifrētās rezerves kopijas atjaunošana</h1>
<p class="muted">Šī lapa atšifrē kopiju arī bez rīka. Darbojas Chrome vai Edge pārlūkā. Nekas netiek sūtīts internetā.</p>
<div class="box"><b>1.</b> <button id="b1">Izvēlēties kopijas mapi (${DIRNAME})</button> <span id="s1" class="muted"></span></div>
<div class="box"><b>2.</b> Parole <span id="hint" class="muted"></span><input type="password" id="pw"><p class="muted">… vai atkopšanas kods (ja aizmirsi paroli):</p><input id="rc" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"></div>
<div class="box"><b>3.</b> <button id="b3">Izvēlēties tukšu mapi un atjaunot</button> <p id="s3"></p></div>
<script>
(function(){var te=new TextEncoder(),td=new TextDecoder(),bdir=null,head=null;
function unb64(s){return Uint8Array.from(atob(s),function(c){return c.charCodeAt(0)})}
function hex(u){return Array.prototype.map.call(u,function(x){return x.toString(16).padStart(2,'0')}).join('')}
async function kek(s,salt,it){var b=await crypto.subtle.importKey('raw',te.encode(s),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:it,hash:'SHA-256'},b,{name:'AES-GCM',length:256},false,['unwrapKey'])}
async function unwrap(w,s){var k=await kek(s,unb64(w.salt),w.iter);return crypto.subtle.unwrapKey('raw',unb64(w.key),k,{name:'AES-GCM',iv:unb64(w.iv)},{name:'AES-GCM'},false,['decrypt'])}
async function dec(m,buf){var u=new Uint8Array(buf);return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:u.subarray(0,12)},m,u.subarray(12)))}
function norm(s){return String(s||'').toUpperCase().replace(/[IL]/g,'1').replace(/O/g,'0').replace(/[^0-9A-Z]/g,'')}
async function txt(d,n){try{return await (await (await d.getFileHandle(n)).getFile()).text()}catch(e){return null}}
document.getElementById('b1').onclick=async function(){try{var h=await showDirectoryPicker();var t=await txt(h,'KOPIJA.json');if(!t){try{h=await h.getDirectoryHandle('${DIRNAME}');t=await txt(h,'KOPIJA.json')}catch(e){}}if(!t)throw Error('mapē nav KOPIJA.json');bdir=h;head=JSON.parse(t);document.getElementById('s1').innerHTML='<span class=ok>✓ '+(head.root||'')+' · '+(head.stats?head.stats.files+' faili':'')+'</span>';if(head.hint)document.getElementById('hint').textContent='(mājiens: '+head.hint+')'}catch(e){document.getElementById('s1').innerHTML='<span class=err>'+e.message+'</span>'}};
document.getElementById('b3').onclick=async function(){var s=document.getElementById('s3');try{if(!head)throw Error('vispirms izvēlies kopijas mapi');var pw=document.getElementById('pw').value,rc=document.getElementById('rc').value,m;
try{m=rc?await unwrap(head.wraps.rc,norm(rc)):await unwrap(head.wraps.pw,pw)}catch(e){throw Error(rc?'nepareizs atkopšanas kods':'nepareiza parole')}
var out=await showDirectoryPicker({mode:'readwrite'});for await(var e of out.entries()){throw Error('izvēlētā mape nav tukša')}
var idx=JSON.parse(td.decode(await dec(m,unb64(head.index)))),dd=await bdir.getDirectoryHandle('dati'),ok=0,bad=0,moved={};
for(var di=0;di<(idx.dirs||[]).length;di++){var dp=idx.dirs[di].split('/'),dh=out;for(var j=0;j<dp.length;j++)dh=await dh.getDirectoryHandle(dp[j],{create:true})}
for(var key in idx.files){var v=idx.files[key];try{var data=await dec(m,await (await (await dd.getFileHandle(v.id+'.bin')).getFile()).arrayBuffer());var h=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',data)));if(h!==v.sha)throw Error('kontrolsumma');
var rel=key.indexOf('main/')===0?key.slice(5):'_atjaunoti_no_arejam_mapem/'+String(v.src||key.split('/')[1]).replace(/[\\\\/:*?"<>|]/g,'_')+'/'+key.split('/').slice(2).join('/');if(key.indexOf('ext/')===0)moved[key.split('/')[1]+'|'+key.split('/').slice(2).join('/')]=rel;var p=rel.split('/'),d=out;for(var i=0;i<p.length-1;i++)d=await d.getDirectoryHandle(p[i],{create:true});
var fh=await d.getFileHandle(p[p.length-1],{create:true}),w=await fh.createWritable();await w.write(data);await w.close();ok++;s.textContent='Atjaunoti '+ok+' faili…'}catch(x){bad++}}
if(Object.keys(moved).length){try{var dfh=await out.getFileHandle('CADET_PERSONALS_DATI.json'),db=JSON.parse(await (await dfh.getFile()).text());(db.documents||[]).forEach(function(d){var k=(d.sourceId||'main')+'|'+d.path;if(moved[k]){d.sourceId='main';d.path=moved[k]}});var ww=await dfh.createWritable();await ww.write(JSON.stringify(db,null,2));await ww.close()}catch(x){}}
s.innerHTML='<span class=ok>✓ Atjaunoti '+ok+' faili'+(bad?'</span> <span class=err>('+bad+' ar kļūdu)':'')+'</span>. Atver rīku un izvēlies šo mapi kā datu mapi.'}catch(e){s.innerHTML='<span class=err>'+e.message+'</span>'}};})();
</script></body></html>`;
  CP.encBackup.RESTORE_HTML = RESTORE_HTML;
})(window.CP);


/* ==== js/contracts.js ==== */
/* =====================================================================
   Līgums par dalību Jaunsardzē — automātiska aizpildīšana no personas kartītes.
   4 standarta veidnes (jaunietis 18+ / likumiskais pārstāvis × papīrs / EDOC)
   vai lietotāja Word veidne ar {atzīmēm}. Rezultāts — rediģējams Word fails
   (kopija personas mapē) + priekšskatījums un drukāšana rīkā.
   Līguma numuru piešķir cita sistēma — to ieraksta lietotājs.
   Instruktora dati glabājas settings.instructor, līdz instruktors tos maina.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const MONTHS_LOC = ['janvārī', 'februārī', 'martā', 'aprīlī', 'maijā', 'jūnijā', 'jūlijā', 'augustā', 'septembrī', 'oktobrī', 'novembrī', 'decembrī'];
  const STD = { 'jaunietis-papirs': 'Jaunietis 18+, papīra forma', 'parstavis-papirs': 'Likumiskais pārstāvis, papīra forma', 'jaunietis-edoc': 'Jaunietis 18+, EDOC', 'parstavis-edoc': 'Likumiskais pārstāvis, EDOC' };
  const FIELDS_HELP = [
    ['{liguma_nr}', 'līguma numurs'], ['{liguma_datums}', 'piem. 2026.gada 15.oktobrī'], ['{vieta}', 'līguma vieta'],
    ['{i_parvalde} {i_nodala}', 'novada pārvaldes un nodaļas nr.'], ['{i_vards_gen}', 'instruktora vārds ģenitīvā (Jāņa Egļa)'], ['{i_vards} {i_amats} {i_talrunis} {i_epasts}', 'instruktora dati'], ['{i_paraksta_datums}', 'piem. 2026. gada 15. oktobrī'],
    ['{j_vards} {j_statuss_vards} {j_vards_pk}', 'jaunietis'], ['{j_pk1} … {j_pk11}', 'jaunieša personas koda cipari pa vienam'], ['{j_personas_kods} {j_adrese_dekl} {j_adrese_fakt} {j_talrunis} {j_epasts}', 'jaunieša dati'],
    ['{p_vards} {p_statuss_vards} {p_vards_pk} {p_pk1} … {p_pk11}', 'likumiskais pārstāvis'], ['{p_personas_kods} {p_adrese_dekl} {p_adrese_fakt} {p_talrunis} {p_epasts}', 'pārstāvja dati']
  ];
  CP.CONTRACT_FIELDS_HELP = FIELDS_HELP;
  const inst = () => (S.db.settings.instructor = S.db.settings.instructor || { parvalde: '', nodala: '', name: '', nameGen: '', position: 'Jaunsargu instruktors', phone: '', email: '', place: '' });

  /** Vārda ģenitīva ieteikums (Jānis Eglis → Jāņa Egļa). Tikai ieteikums — lietotājs var labot. */
  function genitive(full) {
    return String(full || '').trim().split(/\s+/).map(w => {
      const l = w.toLowerCase();
      if (/nis$/.test(l)) return w.slice(0, -3) + 'ņa';
      if (/lis$/.test(l)) return w.slice(0, -3) + 'ļa';
      if (/[vpbm]is$/.test(l)) return w.slice(0, -2) + 'ja';
      if (/sis$/.test(l) || /tis$/.test(l)) return w.slice(0, -3) + 'ša';
      if (/zis$/.test(l) || /dis$/.test(l)) return w.slice(0, -3) + 'ža';
      if (/cis$/.test(l)) return w.slice(0, -3) + 'ča';
      if (/is$/.test(l)) return w.slice(0, -2) + 'a';
      if (/us$/.test(l)) return w + 'a';
      if (/[sš]$/.test(l)) return w.slice(0, -1) + 'a';
      if (/[ae]$/.test(l)) return w + 's';
      return w;
    }).join(' ');
  }
  const dateLv = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[1]}.gada ${+m[3]}.${MONTHS_LOC[m[2] - 1]}` : ''; };
  const phone = n => n ? (U.prettyPhone ? U.prettyPhone(n) : n) : '';
  const STATUS_WORD = { candidate: 'jaunsarga kandidāts', active: 'jaunsargs', paused: 'jaunsargs' };
  const relWord = r => String(r || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('lv');

  /** Pārstāvja statuss: māte / tēvs / likumiskais pārstāvis / cits (jāizvēlas, nav noklusējuma) */
  const REL = [['māte', 'Māte'], ['tēvs', 'Tēvs'], ['likumiskais pārstāvis', 'Likumiskais pārstāvis'], ['cits', 'Cits — norādīt pats']];
  function relPick(rel) {
    const r = relWord(rel); if (!r) return { p_rel: '', p_rel_other: '' };
    if (/^m[aā]te|^mamma/.test(r)) return { p_rel: 'māte', p_rel_other: '' };
    if (/^t[eē]vs|^t[eē]tis/.test(r)) return { p_rel: 'tēvs', p_rel_other: '' };
    if (/likumisk/.test(r)) return { p_rel: 'likumiskais pārstāvis', p_rel_other: '' };
    return { p_rel: 'cits', p_rel_other: r };
  }
  const relText = f => f.p_rel === 'cits' ? (f.p_rel_other || '').trim() : (f.p_rel || '');
  const dateLvSp = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[1]}. gada ${+m[3]}. ${MONTHS_LOC[m[2] - 1]}` : ''; };

  const findC = arg => { const [pid, cid] = String(arg).split('|'), p = D.person(pid); return { p, c: (p?.contracts || []).find(x => x.id === cid) }; };
  /* --- Dialogs --- */
  let cur = null;   // { pid, kind, form, tpl, parent, no, date, place, fields:{} }
  function personData(p, parentIdx) {
    const two = parentIdx === 2;
    const pn = two ? p.parent2Name : p.parentName, rel = two ? p.parent2Relation : p.parentRelation;
    return {
      j_vards: U.full(p), j_status: STATUS_WORD[D.partStatus(p)] || 'jaunsargs', j_pk: p.personalCode || '',
      j_adrese_dekl: p.addressDeclared || '', j_adrese_fakt: p.addressActual && U.norm(p.addressActual) !== U.norm(p.addressDeclared || '') ? p.addressActual : '',
      j_talrunis: phone(p.phone), j_epasts: p.email || '',
      p_vards: pn || '', ...relPick(rel), p_pk: two ? '' : (p.parentCode || ''),
      p_adrese_dekl: (two ? '' : p.parentAddressDeclared) || '', p_adrese_fakt: (two ? '' : p.parentAddressActual) || '',
      p_talrunis: phone(two ? p.parent2Phone : p.parentPhone), p_epasts: (two ? p.parent2Email : p.parentEmail) || ''
    };
  }
  A.contractNew = pid => {
    const p = pid && D.person(pid);
    const age = p ? U.age(p.birth) : null;
    cur = { pid: p ? p.id : '', kind: age != null && age < 18 ? 'parstavis' : (age == null ? 'parstavis' : 'jaunietis'), form: S.db.settings.contractForm || 'papirs', tpl: '',
      parent: 1, no: p?.contractNo || '', date: U.iso(), place: inst().place || '', signMode: inst().signMode || 'same', signDate: '', fields: p ? personData(p, 1) : {} };
    openDlg();
  };
  const PARAMS = ['kind', 'form', 'tpl', 'parent', 'no', 'date', 'place', 'signMode', 'signDate'];
  const snapshot = () => ({ ...Object.fromEntries(PARAMS.map(k => [k, cur[k]])), fields: { ...cur.fields } });
  function openDlg() {
    const ed = !!cur.editId;
    U.$('contractTitle').textContent = ed ? 'Labot līgumu' : 'Līgums par dalību Jaunsardzē';
    U.$('contractWordBtn').textContent = ed ? 'Saglabāt izmaiņas (jauna versija)' : 'Sagatavot Word failu';
    renderDialog(); U.$('contractDialog').showModal();
  }
  /** Labot: atver logu ar iepriekš ievadītajiem datiem; saglabājot rodas jauna versija (vecais fails netiek pārrakstīts) */
  A.contractEdit = arg => {
    const { p, c } = findC(arg); if (!c) return;
    const base = personData(p, c.params?.parent || 1);
    cur = { pid: p.id, kind: c.kind, form: c.form, tpl: '', parent: 1, no: c.no || p.contractNo || '', date: c.date || U.iso(), place: inst().place || '', signMode: inst().signMode || 'same', signDate: '',
      ...(c.params || {}), fields: { ...base, ...(c.params?.fields || {}) }, editId: c.id };
    if (U.$('printDialog').open) U.$('printDialog').close();
    openDlg();
  };
  /** Ielādēt Word programmā labotu līgumu kā jaunu versiju */
  let upTarget = null;
  A.contractUpload = arg => { if (!S.root) return ui.toast('Vispirms pieslēdz datu mapi', 'warn'); upTarget = arg; U.$('ctUpload').click(); };
  U.$('ctUpload').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f || !upTarget) return;
    if (!/\.docx$/i.test(f.name)) return ui.toast('Ielādē Word .docx failu', 'warn');
    const { p, c } = findC(upTarget); if (!c) return;
    try {
      const base = (c.path ? c.path.split('/').pop() : `Līgums ${U.full(p)}.docx`).replace(/( \(labots [^)]*\))*(\s\(\d+\))?\.docx$/i, '');
      const path = await CP.store.saveFile(CP.store.yearPersonDir(p), `${base} (labots ${U.fmtDate(U.iso())}).docx`, f);
      newVersion(c, path, 'ielādēts labots fails');
      D.audit(p.id, 'update', ['Ielādēts labots līgums' + (c.no ? ' Nr. ' + c.no : '')]);
      CP.store.changed(); ui.toast('Labotais līgums saglabāts kā jauna versija. Iepriekšējā versija paliek mapē.', 'ok', 7000);
    } catch (err) { ui.toast('Neizdevās saglabāt: ' + err.message, 'err', 9000); }
  });
  function newVersion(c, path, how) {
    (c.versions = c.versions || []).push({ path: c.path, at: c.editedAt || c.at });
    c.path = path; c.editedAt = U.now(); c.editHow = how;
  }
  function renderDialog() {
    const c = cur, p = D.person(c.pid), I = inst(), age = p ? U.age(p.birth) : null, f = c.fields;
    const own = (S.db.settings.docTemplates || []).filter(t => t.type === 'contract');
    const opt = (v, l, curV) => `<option value="${esc(v)}" ${v === curV ? 'selected' : ''}>${esc(l)}</option>`;
    const people = D.peopleInYear().filter(x => x.status !== 'archived').sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
    const inp = (k, label, val, extra = '') => `<div class="field ${extra}"><label>${label}</label><input data-ct="${k}" value="${esc(val ?? '')}"></div>`;
    const iinp = (k, label, ph = '', extra = '') => `<div class="field ${extra}"><label>${label}</label><input data-ci="${k}" value="${esc(I[k] ?? '')}" placeholder="${esc(ph)}"></div>`;
    const warn = [];
    if (p && !f.j_pk) warn.push('jaunietim nav personas koda');
    if (c.kind === 'parstavis' && !f.p_vards) warn.push('nav norādīts likumiskais pārstāvis');
    if (c.kind === 'parstavis' && !f.p_pk) warn.push('nav pārstāvja personas koda');
    if (c.kind === 'parstavis' && p && !relText(f)) warn.push('izvēlies pārstāvja statusu (māte, tēvs, likumiskais pārstāvis vai cits)');
    if (!c.no) warn.push('nav ievadīts līguma numurs (vietā paliks tukša līnija)');
    if (!I.name || !I.parvalde || !I.nodala) warn.push('aizpildi instruktora datus');
    U.$('contractBody').innerHTML = `
      <div class="fieldgrid">
        <div class="field wide"><label>Persona</label><select id="ctPerson" ${c.editId ? "disabled title=\"Labojot personu mainīt nevar\"" : ""}><option value="">— izvēlies —</option>${people.map(x => opt(x.id, `${U.sortName(x)}${D.groupOf(x) ? ' · ' + D.groupOf(x) : ''}`, c.pid)).join('')}</select>
          ${p ? `<small class="muted">${age != null ? `${age} g.` : 'dzimšanas datums nav zināms'} — ${age != null && age >= 18 ? 'pilngadīgs: līgums ar jaunieti' : 'nepilngadīgs: līgums ar likumisko pārstāvi'}</small>` : ''}</div>
        <div class="field"><label>Līguma veids</label><select data-cc="kind">${opt('parstavis', 'Ar likumisko pārstāvi (līdz 18 g.)', c.kind)}${opt('jaunietis', 'Ar jaunieti (no 18 g.)', c.kind)}</select></div>
        <div class="field"><label>Forma</label><select data-cc="form">${opt('papirs', 'Papīra forma (parakstīt ar roku)', c.form)}${opt('edoc', 'EDOC (e-paraksts)', c.form)}</select></div>
        <div class="field"><label>Veidne</label><select data-cc="tpl">${opt('', 'Standarta veidne', c.tpl)}${own.map(t => opt(t.id, 'Mana: ' + t.name, c.tpl)).join('')}</select></div>
        <div class="field"><label>Līguma Nr. <small class="muted">(no citas sistēmas)</small></label><input data-cc="no" value="${esc(c.no)}" placeholder="piem. 124/JS-2026/8"></div>
        <div class="field"><label>Datums</label><input type="date" data-cc="date" value="${esc(c.date)}"></div>
        <div class="field"><label>Vieta</label><input data-cc="place" value="${esc(c.place)}" placeholder="piem. Rīga"></div>
        ${c.form === 'papirs' ? `<div class="field"><label>Instruktora paraksta datums</label><select data-cc="signMode">${opt('same', 'Tāds pats kā līguma datums', c.signMode)}${opt('custom', 'Cits datums…', c.signMode)}${opt('blank', 'Tukšs — rakstīšu ar roku', c.signMode)}</select>${c.signMode === 'custom' ? `<input type="date" data-cc="signDate" value="${esc(c.signDate || c.date)}" style="margin-top:6px">` : ''}</div>` : ''}
        ${c.kind === 'parstavis' && p && p.parent2Name ? `<div class="field wide"><label>Likumiskais pārstāvis</label><div class="actions"><label class="check"><input type="radio" name="ctParent" data-cc="parent" value="1" ${c.parent === 1 ? 'checked' : ''}> ${esc(p.parentName || '1. pārstāvis')}</label><label class="check"><input type="radio" name="ctParent" data-cc="parent" value="2" ${c.parent === 2 ? 'checked' : ''}> ${esc(p.parent2Name)}</label></div></div>` : ''}
      </div>
      ${warn.length ? `<div class="notice">⚠ ${esc(warn.join('; '))}.</div>` : ''}
      ${p ? `<details class="ct-box" open><summary><b>Dati līgumā</b> <small class="muted">— no kartītes; šeit labotais attiecas tikai uz šo līgumu</small></summary><div class="fieldgrid">
        ${inp('j_status', 'Jaunieša statuss', f.j_status)}${inp('j_vards', 'Jaunieša vārds, uzvārds', f.j_vards)}${inp('j_pk', 'Jaunieša personas kods', f.j_pk)}
        ${inp('j_talrunis', 'Jaunieša tālrunis', f.j_talrunis)}${inp('j_epasts', 'Jaunieša e-pasts', f.j_epasts)}
        ${c.kind === 'jaunietis' ? `${inp('j_adrese_dekl', 'Deklarētā adrese', f.j_adrese_dekl, 'wide')}${inp('j_adrese_fakt', 'Faktiskā adrese (ja atšķiras)', f.j_adrese_fakt, 'wide')}` : `
        <div class="field"><label>Pārstāvja statuss <b class="red">*</b></label><select data-ct="p_rel" class="${f.p_rel ? '' : 'need'}"><option value="">— izvēlies —</option>${REL.map(([v, l]) => `<option value="${v}" ${f.p_rel === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        ${f.p_rel === 'cits' ? `<div class="field"><label>Statuss (ieraksti) <b class="red">*</b></label><input data-ct="p_rel_other" value="${esc(f.p_rel_other || '')}" list="dl_ctrel" placeholder="piem. aizbildnis, vecmāmiņa"><datalist id="dl_ctrel">${(S.db.settings.contractRelations || []).map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>` : ''}${inp('p_vards', 'Pārstāvja vārds, uzvārds', f.p_vards)}${inp('p_pk', 'Pārstāvja personas kods', f.p_pk)}
        ${inp('p_talrunis', 'Pārstāvja tālrunis', f.p_talrunis)}${inp('p_epasts', 'Pārstāvja e-pasts', f.p_epasts)}
        ${inp('p_adrese_dekl', 'Pārstāvja deklarētā adrese', f.p_adrese_dekl, 'wide')}${inp('p_adrese_fakt', 'Pārstāvja faktiskā adrese (ja atšķiras)', f.p_adrese_fakt, 'wide')}`}
      </div></details>` : ''}
      <details class="ct-box" ${!I.name ? 'open' : ''}><summary><b>Instruktora dati</b> <small class="muted">— saglabājas nākamajiem līgumiem</small></summary><div class="fieldgrid">
        ${iinp('parvalde', 'Novada pārvaldes nr.', 'piem. 3')}${iinp('nodala', 'Nodaļas nr.', 'piem. 1')}
        ${iinp('name', 'Vārds, uzvārds', 'Jānis Paraugs')}<div class="field"><label>Vārds ģenitīvā <small class="muted">(“…instruktora <i>Jāņa Parauga</i> personā”)</small></label><input data-ci="nameGen" value="${esc(I.nameGen || genitive(I.name))}"></div>
        ${iinp('position', 'Amats', 'Jaunsargu instruktors')}${iinp('place', 'Vieta pēc noklusējuma', 'piem. Rīga')}${iinp('phone', 'Tālrunis')}${iinp('email', 'E-pasts')}
      </div></details>`;
  }
  const ctDlg = () => U.$('contractDialog');
  document.addEventListener('change', e => {
    const t = e.target; if (!ctDlg()?.contains(t) || !cur) return;
    if (t.id === 'ctPerson') { const p = D.person(t.value); cur.pid = t.value; if (p) { const age = U.age(p.birth); cur.kind = age != null && age >= 18 ? 'jaunietis' : 'parstavis'; cur.no = p.contractNo || cur.no; cur.parent = 1; cur.fields = personData(p, 1); } renderDialog(); return; }
    const k = t.dataset.cc;
    if (k) {
      if (k === 'parent') { cur.parent = Number(t.value); const p = D.person(cur.pid); if (p) Object.assign(cur.fields, Object.fromEntries(Object.entries(personData(p, cur.parent)).filter(([x]) => x.startsWith('p_')))); }
      else cur[k] = t.value;
      if (k === 'kind' || k === 'parent' || k === 'form' || k === 'signMode') renderDialog();
      return;
    }
    if (t.dataset.ci) {
      const I = inst(); I[t.dataset.ci] = t.value.trim();
      if (t.dataset.ci === 'name') { I.nameGen = genitive(I.name); const g = ctDlg().querySelector('[data-ci="nameGen"]'); if (g) g.value = I.nameGen; }
      CP.store.changed({ silent: true }); return;
    }
  });
  document.addEventListener('input', e => {
    const t = e.target; if (!ctDlg()?.contains(t) || !cur) return;
    if (t.dataset.ct) { cur.fields[t.dataset.ct] = t.value; if (t.dataset.ct === 'p_rel') renderDialog(); }
    if (t.dataset.cc && t.dataset.cc !== 'parent') cur[t.dataset.cc] = t.value;
    if (t.dataset.ci) { inst()[t.dataset.ci] = t.value.trim(); CP.store.changed({ silent: true }); }
  });

  /* --- Aizpildīšana --- */
  function fillData() {
    const c = cur, f = c.fields, I = inst(), L = s => s || '';
    const digits = (pk, pre) => { const d = U.codeDigits(pk || ''); const o = {}; for (let i = 0; i < 11; i++) o[`${pre}_pk${i + 1}`] = d.length === 11 ? d[i] : ''; return o; };
    const line = (v, n = 25) => v ? v : '_'.repeat(n);
    const pkFmt = pk => U.codeDigits(pk || '').length === 11 ? U.fmtCode(pk) : (pk || '');
    const g = {
      liguma_nr: line(c.no, 18), liguma_datums: c.date ? dateLv(c.date) : '20___.gada ___.___________', vieta: line(c.place, 12),
      i_parvalde: line(I.parvalde, 4), i_nodala: line(I.nodala, 3), i_vards_gen: line(I.nameGen || genitive(I.name), 30), i_vards: L(I.name), i_amats: L(I.position),
      i_talrunis: line(phone(I.phone)), i_epasts: line(I.email),
      j_vards: L(f.j_vards), j_statuss_vards: [f.j_status, f.j_vards].filter(Boolean).join(' '), j_personas_kods: pkFmt(f.j_pk), j_vards_pk: [f.j_vards, pkFmt(f.j_pk)].filter(Boolean).join(', '),
      j_adrese_dekl: L(f.j_adrese_dekl), j_adrese_fakt: L(f.j_adrese_fakt), j_talrunis: line(f.j_talrunis), j_epasts: line(f.j_epasts),
      p_vards: L(f.p_vards), p_statuss_vards: [relText(f), f.p_vards].filter(Boolean).join(' '), p_statuss: relText(f), p_personas_kods: pkFmt(f.p_pk), p_vards_pk: [f.p_vards, pkFmt(f.p_pk)].filter(Boolean).join(', '),
      p_adrese_dekl: L(f.p_adrese_dekl), p_adrese_fakt: L(f.p_adrese_fakt), p_talrunis: line(f.p_talrunis), p_epasts: line(f.p_epasts),
      i_paraksta_datums: c.signMode === 'blank' ? '_____.\u00a0gada ____.\u00a0________________' : dateLvSp(c.signMode === 'custom' ? (c.signDate || c.date) : c.date) || '_____.\u00a0gada ____.\u00a0________________',
      ...digits(f.j_pk, 'j'), ...digits(f.p_pk, 'p')
    };
    return { global: g, rows: [], staff: [], blankRows: 0, staffBlank: 0 };
  }
  async function templateBuf() {
    if (cur.tpl) {
      const t = (S.db.settings.docTemplates || []).find(x => x.id === cur.tpl); if (!t) throw Error('veidne nav atrasta');
      const h = await CP.store.handleFor(t.path, 'main'); if (!h) throw Error('veidnes fails mapē Veidnes nav atrasts');
      return (await h.getFile()).arrayBuffer();
    }
    const r = await fetch(CP.VENDOR + `templates/ligums-${cur.kind}-${cur.form}.docx?v=${CP.VERSION}`, { cache: "no-cache" }); if (!r.ok) throw Error('standarta veidne nav ielādējama (' + r.status + ')');
    return r.arrayBuffer();
  }
  /** Pirms sagatavošanas: obligātais pārstāvja statuss, jautājums par trūkstošu līguma numuru */
  function ready() {
    if (!cur?.pid) { ui.toast('Izvēlies personu', 'warn'); return false; }
    if (cur.kind === 'parstavis' && !relText(cur.fields)) { ui.toast('Izvēlies likumiskā pārstāvja statusu: māte, tēvs, likumiskais pārstāvis vai cits.', 'warn', 8000); ctDlg().querySelector('[data-ct="p_rel"],[data-ct="p_rel_other"]')?.focus(); return false; }
    if (!String(cur.no || '').trim() && !confirm('Līguma numurs nav ievadīts.\n\nLīgumā numura vietā paliks tukša līnija, ko varēs aizpildīt vēlāk.\n\nVai turpināt bez līguma numura?')) { ctDlg().querySelector('[data-cc="no"]')?.focus(); return false; }
    return true;
  }
  async function build() {
    if (!cur?.pid) throw Error('izvēlies personu');
    return CP.docxFill.fill(await templateBuf(), fillData());
  }
  const fileName = () => { const p = D.person(cur.pid); return `Līgums ${cur.no ? cur.no.replace(/[\\/:*?"<>|]/g, '_') + ' ' : ''}${U.full(p)} ${cur.date || U.iso()}.docx`.replace(/\s+/g, ' '); };
  /** Saglabā atkārtoti noderīgo: formu, vietu, paraksta datuma izvēli, statusus — un kartītē tukšos laukus */
  function remember() {
    const p = D.person(cur.pid); if (!p) return;
    const S2 = S.db.settings, I = inst(), f = cur.fields;
    S2.contractForm = cur.form; if (cur.place) I.place = cur.place.trim(); I.signMode = cur.signMode;
    if (cur.no && p.contractNo !== cur.no) { p.contractNo = cur.no.trim(); D.audit(p.id, 'update', ['Līguma Nr.']); }
    if (f.p_rel === 'cits' && f.p_rel_other) S2.contractRelations = [...new Set([f.p_rel_other.trim(), ...(S2.contractRelations || [])])].slice(0, 12);
    // kartītē papildina tikai tukšos laukus (esošie dati netiek pārrakstīti)
    const two = cur.parent === 2, put = [], set = (k, v) => { v = String(v || '').trim(); if (v && !String(p[k] || '').trim()) { p[k] = v; put.push(CP.FIELD[k]?.l || k); } };
    set('personalCode', U.codeDigits(f.j_pk).length === 11 ? U.fmtCode(f.j_pk) : f.j_pk); set('phone', f.j_talrunis); set('email', f.j_epasts);
    if (cur.kind === 'jaunietis') { set('addressDeclared', f.j_adrese_dekl); set('addressActual', f.j_adrese_fakt); }
    if (cur.kind === 'parstavis') {
      set(two ? 'parent2Name' : 'parentName', f.p_vards); set(two ? 'parent2Relation' : 'parentRelation', relText(f));
      set(two ? 'parent2Phone' : 'parentPhone', f.p_talrunis); set(two ? 'parent2Email' : 'parentEmail', f.p_epasts);
      if (!two) { set('parentCode', U.codeDigits(f.p_pk).length === 11 ? U.fmtCode(f.p_pk) : f.p_pk); set('parentAddressDeclared', f.p_adrese_dekl); set('parentAddressActual', f.p_adrese_fakt); }
    }
    if (put.length) { p.updatedAt = U.now(); D.audit(p.id, 'update', put); ui.toast('Kartītē papildināts: ' + put.join(', '), 'ok', 6000); }
  }
  /** Word fails: lejupielāde + kopija personas mapē + ieraksts kartītē */
  A.contractWord = async () => {
    if (!ready()) return;
    try {
      const blob = await build(), p = D.person(cur.pid), name = fileName();
      U.download(blob, name); remember();
      if (S.root) {
        const path = await CP.store.saveFile(CP.store.yearPersonDir(p), name, blob);
        const old = cur.editId && (p.contracts || []).find(x => x.id === cur.editId);
        if (old) {
          newVersion(old, path, 'labots rīkā'); Object.assign(old, { no: cur.no || '', date: cur.date, kind: cur.kind, form: cur.form, params: snapshot() });
          D.audit(p.id, 'update', ['Labots līgums' + (cur.no ? ' Nr. ' + cur.no : '')]);
          ui.toast('Izmaiņas saglabātas kā jauna līguma versija. Iepriekšējā versija paliek personas mapē.', 'ok', 8000);
          U.$('contractDialog').close();
        } else {
          (p.contracts = p.contracts || []).push({ id: U.uid(), no: cur.no || '', date: cur.date, kind: cur.kind, form: cur.form, path, at: U.now(), params: snapshot() });
          D.audit(p.id, 'update', ['Sagatavots līgums' + (cur.no ? ' Nr. ' + cur.no : '')]);
          ui.toast('Līgums sagatavots. Kopija saglabāta personas mapē — to var atvērt un labot Word programmā.', 'ok', 8000);
        }
      }
      CP.store.changed();
    } catch (e) { console.error(e); ui.toast('Līgumu neizdevās sagatavot: ' + e.message, 'err', 10000); }
  };
  /** Priekšskatījums un drukāšana rīkā (Word → HTML ar docx-preview) */
  A.contractPreview = async () => {
    if (!ready()) return;
    try {
      const blob = await build(); remember(); CP.store.changed({ silent: true });
      await CP.printDocx(blob, fileName());
    } catch (e) { console.error(e); ui.toast('Priekšskatījumu neizdevās sagatavot: ' + e.message, 'err', 10000); }
  };
  CP.printDocx = async (blob, name) => {
    await CP.reader.loadScript(CP.VENDOR + 'docx/jszip.min.js');
    await CP.reader.loadScript(CP.VENDOR + 'docx/docx-preview.min.js');
    const d = U.$('printDialog'), box = U.$('printPages');
    box.innerHTML = '<p class="muted pad">Sagatavo priekšskatījumu…</p>'; U.$('printInfo').textContent = ''; if (!d.open) d.showModal();
    const holder = document.createElement('div'); holder.className = 'docx-holder';
    await window.docx.renderAsync(blob, holder, null, { inWrapper: false, breakPages: true, ignoreLastRenderedPageBreak: false, experimental: false, useBase64URL: true, renderHeaders: true, renderFooters: true });
    box.innerHTML = ''; box.appendChild(holder);
    const pages = holder.querySelectorAll('section.docx').length;
    U.$('printInfo').textContent = `${pages} ${pages === 1 ? 'lapa' : 'lapas'} · priekšskatījums var nedaudz atšķirties no Word`;
    CP.setPrintSource({ kind: 'html', node: holder, blob, name: name.replace(/\.docx$/i, '') + '.docx' });
    U.$('printGo').disabled = false;
  };

  /* --- Kartītē: sagatavotie līgumi --- */
  CP.contracts = {
    personCard(p) {
      const list = [...(p.contracts || [])].sort((a, b) => String(b.at).localeCompare(String(a.at)));
      return `<section class="card"><h3>${CP.ic('file', '📄')}Līgums</h3>
        ${p.contractNo ? `<p class="small" style="margin:0 0 6px">Līguma Nr.: <b>${esc(p.contractNo)}</b></p>` : ''}
        ${list.slice(0, 4).map(c => `<div class="row"><div class="grow small">${esc(c.no ? 'Nr. ' + c.no : 'bez numura')} · ${esc(U.fmtDate(c.date))}<div class="muted">${esc(STD[`${c.kind}-${c.form}`] || '')}</div></div><button class="sm ghost" data-act="contractEdit" data-arg="${p.id}|${c.id}" title="Labot">✎</button>${c.path ? `<button class="sm ghost" data-act="contractOpen" data-arg="${p.id}|${c.id}" title="Lejupielādēt Word failu">⬇</button>` : ''}</div>`).join('')}
        <div class="actions" style="margin-top:8px"><button class="sm mainbtn" data-act="contractNew" data-arg="${p.id}">${CP.ic('file', '📄')} Sagatavot līgumu</button></div></section>`;
    },
    FIELDS_HELP
  };
  A.contractView = async arg => {
    const { c } = findC(arg); if (!c?.path) return;
    try { const h = await CP.store.handleFor(c.path, 'main'); if (!h) return ui.toast('Fails personas mapē nav atrasts: ' + c.path, 'warn', 8000); await CP.printDocx(await h.getFile(), c.path.split('/').pop()); }
    catch (e) { ui.toast('Neizdevās atvērt: ' + e.message, 'err', 9000); }
  };
  A.contractDel = arg => {
    const { p, c } = findC(arg); if (!c || !confirm(`Noņemt “Līgums ${c.no ? 'Nr. ' + c.no : '(bez numura)'}” no saraksta?\n\nWord fails personas mapē paliek.`)) return;
    p.contracts = p.contracts.filter(x => x.id !== c.id); D.audit(p.id, 'update', ['Noņemts līguma ieraksts']); CP.store.changed();
  };
  A.contractOpen = async arg => {
    const [pid, cid] = String(arg).split('|'), p = D.person(pid), c = (p?.contracts || []).find(x => x.id === cid); if (!c) return;
    const h = await CP.store.handleFor(c.path, 'main'); if (!h) return ui.toast('Fails personas mapē nav atrasts: ' + c.path, 'warn', 8000);
    U.download(await h.getFile(), c.path.split('/').pop());
  };
})(window.CP);


/* ==== js/attendance.js ==== */
/* =====================================================================
   Apmeklējums: nodarbību žurnāls (kā e-klasē), mēneša veidlapa, rādītāji,
   brīdinājumi par kavējumiem; personām — pārkāpumi, dalība un kvalifikācijas.

   Dati:
   S.db.sessions = [{ id, date, group ('*' = visa vienība), yearId, type, topic, notes, att: { pid: kods } }]
   settings.groupDays = { grupa: [1..7] }   (1 = pirmdiena)
   settings.absenceStreak = 3
   settings.quals = [{ id, name, note }]           p.quals = [{ qid, date, note, src }]
   settings.incidentTypes = [...]                   p.incidents = [{ id, date, type, severity, text, action, at }]
   Kodi: + bija, n nebija, k kavēja (ieradās vēlāk), a attaisnots, s slimības dēļ
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const ic = (n, f = '') => CP.ic(n, f);
  const CODES = [['+', 'Bija', 'ok'], ['n', 'Nebija', 'bad'], ['k', 'Kavēja (ieradās vēlāk)', 'warn'], ['a', 'Attaisnots', 'exc'], ['s', 'Slimības dēļ', 'exc']];
  const CYCLE = ['', '+', 'n', 'k', 'a', 's'];
  const PRESENT = new Set(['+', 'k']), ABSENT = new Set(['n']), EXCUSED = new Set(['a', 's']);
  const TYPES = ['Nodarbība', 'Pasākums', 'Nometne', 'Sacensības', 'Cits'];
  const WD = ['P', 'O', 'T', 'C', 'Pk', 'S', 'Sv'], WDL = ['pirmdiena', 'otrdiena', 'trešdiena', 'ceturtdiena', 'piektdiena', 'sestdiena', 'svētdiena'];
  const MON = ['janvāris', 'februāris', 'marts', 'aprīlis', 'maijs', 'jūnijs', 'jūlijs', 'augusts', 'septembris', 'oktobris', 'novembris', 'decembris'];
  const MON_LOC = ['Janvārī', 'Februārī', 'Martā', 'Aprīlī', 'Maijā', 'Jūnijā', 'Jūlijā', 'Augustā', 'Septembrī', 'Oktobrī', 'Novembrī', 'Decembrī'];
  const LEGEND = 'Apzīmējumi: + bija, n nebija, k kavēja (ieradās vēlāk), a attaisnots, s slimības dēļ';
  CP.ATT_CODES = CODES;

  const st = () => S.db.settings;
  const sessions = () => (S.db.sessions = S.db.sessions || []);
  const wdOf = iso => (new Date(iso + 'T12:00:00').getDay() + 6) % 7 + 1;
  const daysOf = g => g === '*' ? [...new Set(Object.values(st().groupDays || {}).flat())].sort() : ((st().groupDays || {})[g] || []);
  const monthDates = ym => { const [y, m] = ym.split('-').map(Number), n = new Date(y, m, 0).getDate(); return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`); };
  const shiftMonth = (ym, d) => { const [y, m] = ym.split('-').map(Number), x = new Date(y, m - 1 + d, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };
  const roster = (g, yearId = D.activeYear()) => D.peopleInYear(yearId).filter(p => p.status !== 'archived' && !['archived', 'paused'].includes(D.partStatus(p, yearId)) && (g === '*' || D.groupOf(p, yearId) === g))
    .sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
  const sessFor = (g, date) => sessions().find(s => s.group === g && s.date === date);
  /** Personai attiecināmās nodarbības: savas grupas un visas vienības, līdz šodienai */
  const personSessions = (p, yearId = D.activeYear()) => { const g = D.groupOf(p, yearId), today = U.iso(); return sessions().filter(s => (s.group === g || s.group === '*') && s.date <= today && (!yearId || s.yearId === yearId)).sort((a, b) => a.date.localeCompare(b.date)); };

  /* --- Rādītāji --- */
  function rateOf(pid, list) {
    let pr = 0, ab = 0, ex = 0;
    for (const s of list) { const c = s.att?.[pid] || ''; if (PRESENT.has(c)) pr++; else if (ABSENT.has(c)) ab++; else if (EXCUSED.has(c)) ex++; }
    return { present: pr, absent: ab, excused: ex, marked: pr + ab + ex, pct: pr + ab ? Math.round(pr / (pr + ab) * 100) : null };
  }
  const sessionPct = s => { let pr = 0, ab = 0; for (const c of Object.values(s.att || {})) { if (PRESENT.has(c)) pr++; else if (ABSENT.has(c)) ab++; } return pr + ab ? Math.round(pr / (pr + ab) * 100) : null; };
  /** Kavējumi pēc kārtas (attaisnotie un neatzīmētie neskaitās un nepārtrauc) */
  function streak(p) {
    const list = personSessions(p).reverse(); let n = 0, last = '';
    for (const s of list) { const c = s.att?.[p.id] || ''; if (ABSENT.has(c)) { n++; if (!last) last = s.date; } else if (PRESENT.has(c)) break; }
    return { n, last };
  }
  D.attRate = p => rateOf(p.id, personSessions(p));
  D.attStreak = streak;
  D.attAlerts = list => {
    const lim = Number(st().absenceStreak) || 3, out = [];
    for (const p of list) {
      if (p.status === 'archived' || D.partStatus(p) === 'paused') continue;
      const s = streak(p);
      if (s.n >= lim) out.push({ kind: 'attendance', personId: p.id, sev: s.n >= lim * 2 ? 2 : 1, when: s.last, msg: `${U.full(p)}: nav apmeklējis ${s.n} nodarbības pēc kārtas (pēdējā: ${U.fmtDate(s.last)})` });
    }
    return out;
  };
  /** Tendence: pēdējo 4 atzīmēto nodarbību % pret iepriekšējām 4 */
  function trend(p) {
    const list = personSessions(p).filter(s => { const c = s.att?.[p.id]; return PRESENT.has(c) || ABSENT.has(c); });
    const a = rateOf(p.id, list.slice(-4)).pct, b = rateOf(p.id, list.slice(-8, -4)).pct;
    return a == null || b == null ? 0 : a - b;
  }
  /** Personas sērija: slīdošais % pa nodarbībām (ar 4 nodarbību logu) */
  function personSeries(p) {
    const list = personSessions(p).filter(s => { const c = s.att?.[p.id]; return PRESENT.has(c) || ABSENT.has(c); });
    return list.map((s, i) => ({ x: s.date, y: rateOf(p.id, list.slice(Math.max(0, i - 3), i + 1)).pct }));
  }

  /* --- “Trading” stila līnijgrafiks (SVG): laukums ar gradientu, slīdošā vidējā, krustiņš un vērtība pie peles --- */
  let chartN = 0;
  function tchart(points, o = {}) {
    const W = o.w || 1000, H = o.h || 250, P = { l: 34, r: 10, t: 12, b: 22 }, id = 'tc' + (++chartN);
    const pts = points.filter(p => p.y != null);
    if (pts.length < 2) return `<div class="tchart-empty muted small">${esc(o.empty || 'Vēl nav pietiekami daudz datu grafikam (vajag vismaz 2 nodarbības ar atzīmēm).')}</div>`;
    const xs = i => P.l + (W - P.l - P.r) * (pts.length === 1 ? 0.5 : i / (pts.length - 1)), ys = v => P.t + (H - P.t - P.b) * (1 - v / 100);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.y).toFixed(1)}`).join('');
    const area = `${line}L${xs(pts.length - 1).toFixed(1)},${ys(0)}L${xs(0).toFixed(1)},${ys(0)}Z`;
    const k = o.ma || 4, ma = pts.map((p, i) => { const w = pts.slice(Math.max(0, i - k + 1), i + 1); return w.reduce((a, b) => a + b.y, 0) / w.length; });
    const maLine = ma.map((v, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join('');
    const last = pts.at(-1).y, first = pts[0].y, up = last >= (pts.at(-2)?.y ?? first);
    const grid = [0, 25, 50, 75, 100].map(v => `<line x1="${P.l}" x2="${W - P.r}" y1="${ys(v)}" y2="${ys(v)}" class="tc-grid"/><text x="${P.l - 6}" y="${ys(v) + 3}" class="tc-ax" text-anchor="end">${v}%</text>`).join('');
    const ticks = pts.map((p, i) => ({ i, p })).filter(({ i }) => pts.length <= 8 || i % Math.ceil(pts.length / 8) === 0 || i === pts.length - 1)
      .map(({ i, p }) => `<text x="${xs(i)}" y="${H - 6}" class="tc-ax" text-anchor="${i === pts.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'}">${esc(U.fmtDate(p.x).slice(0, 5))}</text>`).join('');
    const data = esc(JSON.stringify(pts.map((p, i) => [xs(i), ys(p.y), p.x, p.y, Math.round(ma[i]), p.label || ''])));
    return `<div class="tchart" data-tc="${data}"><div class="tc-head"><b class="tc-val ${up ? 'up' : 'down'}">${last}%</b> <span class="small ${up ? 'okc' : 'warn'}">${up ? '▲' : '▼'} ${Math.abs(last - (pts.at(-2)?.y ?? last))} p.p.</span><span class="small muted"> · vidēji ${Math.round(pts.reduce((a, b) => a + b.y, 0) / pts.length)}% · slīdošā vidējā ${k} nod.</span></div>
      <svg viewBox="0 0 ${W} ${H}" class="tc-svg" role="img" aria-label="${esc(o.title || 'Apmeklējuma grafiks')}">
        <defs><linearGradient id="${id}g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--teal);stop-opacity:.38"/><stop offset="1" style="stop-color:var(--teal);stop-opacity:0"/></linearGradient></defs>
        ${grid}<path d="${area}" fill="url(#${id}g)"/><path d="${line}" class="tc-line"/><path d="${maLine}" class="tc-ma"/>${ticks}
        <line class="tc-x" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" style="display:none"/><circle class="tc-dot" r="4" style="display:none"/>
      </svg><div class="tc-tip" style="display:none"></div></div>`;
  }
  document.addEventListener('mousemove', e => {
    const box = e.target.closest?.('.tchart'); document.querySelectorAll('.tchart.hover').forEach(b => { if (b !== box) { b.classList.remove('hover'); b.querySelector('.tc-x').style.display = b.querySelector('.tc-dot').style.display = b.querySelector('.tc-tip').style.display = 'none'; } });
    if (!box) return;
    const svg = box.querySelector('svg'), r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, x = (e.clientX - r.left) * vb.width / r.width;
    const pts = JSON.parse(box.dataset.tc); let best = pts[0]; for (const p of pts) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
    const xl = box.querySelector('.tc-x'), dot = box.querySelector('.tc-dot'), tip = box.querySelector('.tc-tip');
    xl.setAttribute('x1', best[0]); xl.setAttribute('x2', best[0]); dot.setAttribute('cx', best[0]); dot.setAttribute('cy', best[1]);
    xl.style.display = dot.style.display = tip.style.display = ''; box.classList.add('hover');
    tip.innerHTML = `<b>${esc(U.fmtDate(best[2]))}</b> · ${best[3]}%<br><span class="muted">vidējā: ${best[4]}%</span>${best[5] ? `<br>${esc(best[5])}` : ''}`;
    const px = best[0] * r.width / vb.width; tip.style.left = Math.min(r.width - 150, Math.max(0, px - 70)) + 'px';
  });
  const spark = (vals, w = 90, h = 22) => {
    const v = vals.filter(x => x != null); if (v.length < 2) return '<span class="muted small">—</span>';
    const d = v.map((y, i) => `${i ? 'L' : 'M'}${(i / (v.length - 1) * w).toFixed(1)},${(h - 2 - y / 100 * (h - 4)).toFixed(1)}`).join('');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><path d="${d}"/></svg>`;
  };
  const dots = (p, n = 10) => personSessions(p).slice(-n).map(s => { const c = s.att?.[p.id] || ''; return `<span class="adot c${c === '+' ? 'p' : c || 'x'}" title="${esc(U.fmtDate(s.date) + ' · ' + (CODES.find(x => x[0] === c)?.[1] || 'nav atzīmēts') + (s.topic ? ' · ' + s.topic : ''))}">${c === '+' ? '' : esc(c)}</span>`; }).join('');
  const pctTag = v => v == null ? '<span class="muted">—</span>' : `<b class="${v >= 75 ? 'okc' : v >= 50 ? 'warn' : 'red'}">${v}%</b>`;

  /* ================== Lapa ================== */
  const view = () => S.att || (S.att = { tab: 'grid', group: '', month: U.iso().slice(0, 7), all: false, statG: '*', qual: '', dir: (() => { try { return localStorage.getItem('cp.attDir') || 'down'; } catch (e) { return 'down'; } })() });
  CP.pages.attendance = {
    render() {
      const v = view(), groups = D.groups();
      if (!v.group || (v.group !== '*' && !groups.includes(v.group))) v.group = groups[0] || '*';
      const tab = (k, l, i) => `<button role="tab" data-act="attTab" data-arg="${k}" class="${v.tab === k ? 'active' : ''}">${ic(i)}${l}</button>`;
      const body = v.tab === 'journal' ? journal(v) : v.tab === 'stats' ? stats(v) : v.tab === 'quals' ? quals(v) : grid(v);
      return `<div class="page">${ui.pageHead('Apmeklējums', 'Nodarbību žurnāls, mēneša veidlapa, rādītāji un kvalifikācijas', `<button class="mainbtn" data-act="sessNew">${ic('plus', '＋')} Nodarbība</button>`)}
        <nav class="tabs" role="tablist">${tab('grid', 'Mēneša tabula', 'calendar')}${tab('journal', 'Žurnāls', 'list')}${tab('stats', 'Rādītāji', 'chart')}${tab('quals', 'Kvalifikācijas un dalība', 'award')}</nav>${body}</div>`;
    }
  };
  A.attTab = k => { view().tab = k; CP.render(); };
  const groupSel = (v, id = 'attGroup', withAll = true) => `<select id="${id}">${withAll ? `<option value="*" ${v === '*' ? 'selected' : ''}>Visa vienība</option>` : ''}${D.groups().map(g => `<option ${g === v ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>`;
  function gridDates(v) {
    const all = monthDates(v.month), days = daysOf(v.group);
    const sess = sessions().filter(s => s.group === v.group && s.date.startsWith(v.month)).map(s => s.date);
    return v.all || !days.length ? all : [...new Set([...all.filter(d => days.includes(wdOf(d))), ...sess])].sort();
  }

  /* --- Mēneša tabula --- */
  function grid(v) {
    const dates = gridDates(v), ppl = roster(v.group), days = daysOf(v.group), [y, m] = v.month.split('-').map(Number);
    const daysPick = v.group === '*' ? `<span class="small muted">Visas vienības dienas = grupu dienu apvienojums.</span>` : `<span class="small muted">Nodarbību dienas:</span> ${WD.map((w, i) => `<label class="wd ${days.includes(i + 1) ? 'on' : ''}" title="${WDL[i]}"><input type="checkbox" data-gday="${i + 1}" ${days.includes(i + 1) ? 'checked' : ''}>${w}</label>`).join('')}`;
    const head = dates.map(d => { const s = sessFor(v.group, d), wd = wdOf(d), today = d === U.iso(); return `<th class="ad-h ${s ? 'has' : ''} ${today ? 'today' : ''} ${days.includes(wd) ? 'jd' : ''}"><button class="ad-hb" data-act="sessOpen" data-arg="${esc(v.group)}|${d}" title="${esc((s?.topic ? s.topic + ' · ' : '') + WDL[wd - 1] + ' — klikšķis: tēma, piezīmes, “visi bija”')}">${d.slice(8)}.<small>${WD[wd - 1]}</small>${s?.topic ? '<i>●</i>' : ''}</button></th>`; }).join('');
    const rows = ppl.map((p, i) => {
      const mSess = sessions().filter(s => (s.group === v.group || (v.group !== '*' && s.group === '*')) && s.date.startsWith(v.month));
      const r = rateOf(p.id, mSess), sk = streak(p), lim = Number(st().absenceStreak) || 3;
      return `<tr><td class="ad-n">${i + 1}.</td><td class="ad-name"><a href="#" data-person="${p.id}">${esc(U.sortName(p))}</a>${sk.n >= lim ? ` <span class="warn" title="${sk.n} kavējumi pēc kārtas">⚠${sk.n}</span>` : ''}</td>
        ${dates.map(d => { const s = sessFor(v.group, d), c = s?.att?.[p.id] || ''; return `<td class="ad-c"><button class="acell c${c === '+' ? 'p' : c || 'x'}" data-act="attCell" data-arg="${p.id}|${d}" title="${esc(U.full(p) + ' · ' + U.fmtDate(d) + ' — klikšķis vai + n k a s')}">${esc(c)}</button></td>`; }).join('')}
        <td class="ad-pct">${pctTag(r.pct)}</td></tr>`;
    }).join('');
    const foot = dates.map(d => { const s = sessFor(v.group, d), n = s ? Object.values(s.att || {}).filter(c => PRESENT.has(c)).length : ''; return `<td class="ad-c small">${n === '' ? '' : n}</td>`; }).join('');
    return `<section class="card"><div class="att-bar">
        ${groupSel(v.group)}
        <span class="att-month"><button class="sm ghost" data-act="attMonth" data-arg="-1" title="Iepriekšējais mēnesis">◀</button><input type="month" id="attMonth" value="${esc(v.month)}"><button class="sm ghost" data-act="attMonth" data-arg="1" title="Nākamais mēnesis">▶</button></span>
        <span class="seg"><button class="sm ${!v.all ? 'on' : ''}" data-act="attAll" data-arg="0">Jaunsardzes dienas</button><button class="sm ${v.all ? 'on' : ''}" data-act="attAll" data-arg="1">Visas mēneša dienas</button></span>
        <span class="grow"></span>
        <button class="sm" data-act="attPdf" data-arg="blank">${ic('file', '📄')} Tukša veidlapa</button><button class="sm" data-act="attPdf" data-arg="filled">${ic('file', '📄')} Ar atzīmēm</button></div>
      <div class="att-days">${daysPick}${!days.length && v.group !== '*' && !v.all ? ' <span class="warn small">— atzīmē grupas nodarbību dienas, vai izvēlies “Visas mēneša dienas”.</span>' : ''}</div>
      <p class="small muted" style="margin:6px 0">${esc(MON[m - 1])} ${y}. <b>Ar peli:</b> klikšķis maina atzīmi: <b>+</b> bija → <b>n</b> nebija → <b>k</b> kavēja → <b>a</b> attaisnots → <b>s</b> slimības dēļ → tukšs. Klikšķis uz datuma — tēma, piezīmes, “visi bija”.</p>
      <div class="att-keys" id="attKeyHint"><span class="small"><b>Ar tastatūru:</b> uzklikšķini uz rūtiņas un raksti <kbd>+</kbd> (vai <kbd>B</kbd>) <kbd>N</kbd> <kbd>K</kbd> <kbd>A</kbd> <kbd>S</kbd> — atzīme tiek ierakstīta un fokuss pāriet tālāk. <kbd>Del</kbd> notīra, <kbd>Atstarpe</kbd> = klikšķis, bultiņas pārvietojas, <kbd>Esc</kbd> beidz.</span>
        <span class="seg"><span class="small muted" style="padding:0 6px">Pēc atzīmes:</span><button class="sm ${(v.dir || 'down') === 'down' ? 'on' : ''}" data-act="attDir" data-arg="down" title="Nākamā persona tajā pašā datumā (atzīmē vienu nodarbību)">↓ nākamā persona</button><button class="sm ${v.dir === 'right' ? 'on' : ''}" data-act="attDir" data-arg="right" title="Nākamais datums tai pašai personai">→ nākamais datums</button></span></div>
      ${ppl.length ? `<div class="att-wrap"><table class="att-grid"><thead><tr><th class="ad-n">N.p.k.</th><th class="ad-name">Vārds, uzvārds</th>${head}<th class="ad-pct">Mēn.</th></tr></thead><tbody>${rows}</tbody>
        <tfoot><tr><td></td><td class="small muted">Klātesošie</td>${foot}<td></td></tr></tfoot></table></div>` : ui.empty('Šajā grupā nav personu.')}
      <p class="small muted">${esc(LEGEND)}. Procentos neskaita attaisnotos (a, s).</p></section>`;
  }
  A.attMonth = d => { const v = view(); v.month = shiftMonth(v.month, Number(d)); CP.render(); };
  A.attAll = x => { view().all = x === '1'; CP.render(); };
  CP.changeHandlers.push(e => {
    const t = e.target, v = view();
    if (t.id === 'attGroup') { v.group = t.value; CP.render(); return true; }
    if (t.id === 'attStatG') { v.statG = t.value; CP.render(); return true; }
    if (t.id === 'attMonth') { if (t.value) v.month = t.value; CP.render(); return true; }
    if (t.dataset?.gday) { const set = new Set(daysOf(v.group)), d = Number(t.dataset.gday); t.checked ? set.add(d) : set.delete(d); st().groupDays = { ...(st().groupDays || {}), [v.group]: [...set].sort() }; CP.store.changed(); return true; }
    if (t.id === 'attLimit') { st().absenceStreak = Math.max(1, Math.min(20, Number(t.value) || 3)); CP.store.changed(); return true; }
    if (t.id === 'attQual') { v.qual = t.value; CP.render(); return true; }
    return false;
  });
  function ensureSess(g, date) {
    let s = sessFor(g, date);
    if (!s) { s = { id: U.uid(), date, group: g, yearId: U.yearOfDate(date) || D.activeYear(), type: 'Nodarbība', topic: '', notes: '', att: {}, createdAt: U.now() }; sessions().push(s); }
    return s;
  }
  /** Atzīmes ierakstīšana vienā rūtiņā (pele vai tastatūra) */
  function setCode(arg, code) {
    const [pid, date] = String(arg).split('|'), v = view(), s = ensureSess(v.group, date);
    if (code) s.att[pid] = code; else delete s.att[pid];
    s.updatedAt = U.now();
    const btn = document.querySelector(`[data-act="attCell"][data-arg="${CSS.escape(arg)}"]`);
    if (btn) { btn.textContent = code; btn.className = 'acell c' + (code === '+' ? 'p' : code || 'x'); }
    CP.store.changed({ silent: true });
    // tabulas kopsavilkumi (%, klātesošie) tiek pārzīmēti, kad atzīmēšana apstājas; fokuss un ritinājums paliek
    clearTimeout(A._attT); A._attT = setTimeout(() => {
      if (S.page !== 'attendance' || view().tab !== 'grid') return;
      const w = document.querySelector('.att-wrap'), sl = w?.scrollLeft, st0 = window.scrollY, f = document.activeElement?.closest?.('.acell')?.dataset.arg;
      CP.render(); const w2 = document.querySelector('.att-wrap'); if (w2) w2.scrollLeft = sl; window.scrollTo(0, st0);
      if (f) document.querySelector(`.acell[data-arg="${CSS.escape(f)}"]`)?.focus({ preventScroll: true });
    }, 1500);
  }
  A.attCell = (arg, el) => {
    const [pid, date] = String(arg).split('|'), c = sessFor(view().group, date)?.att?.[pid] || '';
    setCode(arg, CYCLE[(CYCLE.indexOf(c) + 1) % CYCLE.length]);
    el?.focus?.({ preventScroll: true });
  };
  A.attDir = d => { view().dir = d; try { localStorage.setItem('cp.attDir', d); } catch (e) { } document.querySelectorAll('[data-act="attDir"]').forEach(b => b.classList.toggle('on', b.dataset.arg === d)); document.querySelector('.att-grid')?.querySelector('.acell:focus')?.focus(); };
  /** Tastatūra: + n k a s ieraksta atzīmi un pāriet uz nākamo rūtiņu; bultiņas pārvietojas; Delete notīra; atstarpe = kā klikšķis */
  const KEYMAP = { '+': '+', '=': '+', 'b': '+', '1': '+', 'p': '+', 'n': 'n', 'k': 'k', 'a': 'a', 's': 's', 'delete': '', 'backspace': '', '0': '', '-': '' };
  function moveFrom(btn, dr, dc) {
    const td = btn.closest('td'), tr = td.parentElement, ci = [...tr.children].indexOf(td), rows = [...tr.parentElement.children];
    let ri = rows.indexOf(tr) + dr, cj = ci + dc;
    const cells = r => [...r.querySelectorAll('.acell')], first = [...tr.children].findIndex(x => x.querySelector('.acell'));
    const nCols = cells(tr).length;
    if (cj < first) { cj = first + nCols - 1; ri--; } else if (cj >= first + nCols) { cj = first; ri++; }
    const row = rows[ri]; const nx = row?.children[cj]?.querySelector('.acell');
    if (nx) { nx.focus(); nx.scrollIntoView({ block: 'nearest', inline: 'nearest' }); return true; }
    return false;
  }
  document.addEventListener('keydown', e => {
    const btn = e.target.closest?.('.acell'); if (!btn || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase(), dir = view().dir || 'down';
    const nav = { arrowdown: [1, 0], arrowup: [-1, 0], arrowright: [0, 1], arrowleft: [0, -1], enter: dir === 'right' ? [0, 1] : [1, 0], tab: e.shiftKey ? [0, -1] : [0, 1] }[k];
    if (nav) { if (moveFrom(btn, ...nav) || k !== 'tab') e.preventDefault(); return; }
    if (k === 'home' || k === 'end') { e.preventDefault(); const c = [...btn.closest('tr').querySelectorAll('.acell')]; (k === 'home' ? c[0] : c.at(-1))?.focus(); return; }
    if (k === 'escape') { btn.blur(); return; }
    if (k in KEYMAP) {
      e.preventDefault(); setCode(btn.dataset.arg, KEYMAP[k]);
      if (k !== 'delete' && k !== 'backspace') moveFrom(btn, ...(dir === 'right' ? [0, 1] : [1, 0]));
    }
  });
  /** Fokusētās rūtiņas rinda un kolonna tiek izgaismotas */
  document.addEventListener('focusin', e => {
    document.querySelectorAll('.att-grid .hl').forEach(x => x.classList.remove('hl'));
    const btn = e.target.closest?.('.acell'); if (!btn) return;
    const td = btn.closest('td'), tr = td.parentElement, ci = [...tr.children].indexOf(td), tb = tr.closest('table');
    tr.classList.add('hl'); tb.querySelector('thead tr')?.children[ci]?.classList.add('hl');
    const hint = document.getElementById('attKeyHint'); if (hint) hint.classList.add('on');
  });

  /* --- Nodarbības logs --- */
  let edit = null;
  A.sessOpen = arg => { const [g, date] = String(arg).split('|'); edit = { g, date }; sessDialog(); };
  A.sessNew = () => { const v = view(); edit = { g: v.group || '*', date: U.iso(), isNew: true }; sessDialog(); };
  function sessDialog() {
    let d = U.$('sessDialog'); if (!d) { d = document.createElement('dialog'); d.id = 'sessDialog'; d.className = 'wide'; document.body.appendChild(d); }
    const s = sessFor(edit.g, edit.date) || {}, topics = [...new Set(sessions().map(x => x.topic).filter(Boolean))].slice(-60);
    const ppl = roster(edit.g), cnt = c => ppl.filter(p => (s.att || {})[p.id] === c).length;
    d.innerHTML = `<form id="sessForm"><header class="dlg-head"><h2>${s.id ? 'Nodarbība' : 'Jauna nodarbība'}</h2><button type="button" class="ghost" data-close="sessDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><div class="fieldgrid">
        <div class="field"><label>Datums</label><input type="date" name="date" value="${esc(edit.date)}" required ${s.id ? '' : ''}></div>
        <div class="field"><label>Grupa</label>${groupSel(edit.g, 'sessGroup').replace('<select id="sessGroup">', '<select id="sessGroup" name="group">')}</div>
        <div class="field"><label>Veids</label><select name="type">${TYPES.map(t => `<option ${t === (s.type || 'Nodarbība') ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field wide"><label>Tēma</label><input name="topic" value="${esc(s.topic || '')}" list="dl_topics" placeholder="piem., Orientēšanās ar karti"><datalist id="dl_topics">${topics.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
        <div class="field wide"><label>Piezīmes</label><textarea name="notes" rows="2" data-autogrow>${esc(s.notes || '')}</textarea></div>
      </div>
      ${s.id ? `<p class="small">Atzīmes: <b>${cnt('+') + cnt('k')}</b> klātesoši · <b>${cnt('n')}</b> nebija · <b>${cnt('a') + cnt('s')}</b> attaisnoti · ${ppl.length - Object.keys(s.att || {}).filter(k => ppl.some(p => p.id === k)).length} neatzīmēti</p>` : ''}
      <div class="actions"><button type="button" class="sm" data-act="sessFill" data-arg="all">Visi bija (+)</button><button type="button" class="sm" data-act="sessFill" data-arg="rest">Neatzīmētie — nebija (n)</button><button type="button" class="sm ghost" data-act="sessFill" data-arg="clear">Notīrīt atzīmes</button></div></div>
      <footer class="dlg-foot">${s.id ? `<button type="button" class="ghost danger" data-act="sessDel">Dzēst nodarbību</button>` : ''}<span class="grow"></span><button type="button" data-close="sessDialog">Atcelt</button><button class="mainbtn" type="submit">Saglabāt</button></footer></form>`;
    d.querySelector('form').onsubmit = e => {
      e.preventDefault(); const f = e.target, o = Object.fromEntries(new FormData(f));
      let s2 = sessFor(edit.g, edit.date);
      if (s2 && (o.date !== edit.date || o.group !== edit.g)) { if (sessFor(o.group, o.date)) return ui.toast('Šai grupai šajā datumā nodarbība jau ir', 'warn'); s2.date = o.date; s2.group = o.group; s2.yearId = U.yearOfDate(o.date) || s2.yearId; }
      if (!s2) s2 = ensureSess(o.group, o.date);
      Object.assign(s2, { type: o.type, topic: o.topic.trim(), notes: o.notes.trim(), updatedAt: U.now() });
      d.close(); const v = view(); if (edit.isNew) { v.group = o.group; v.month = o.date.slice(0, 7); }
      CP.store.changed(); ui.toast('Nodarbība saglabāta', 'ok', 2500);
    };
    if (!d.open) d.showModal();
  }
  A.sessFill = how => {
    const s = ensureSess(edit.g, edit.date), ppl = roster(edit.g);
    if (how === 'all') for (const p of ppl) s.att[p.id] = '+';
    if (how === 'rest') for (const p of ppl) if (!s.att[p.id]) s.att[p.id] = 'n';
    if (how === 'clear') s.att = {};
    CP.store.changed(); sessDialog();
  };
  A.sessDel = () => {
    const s = sessFor(edit.g, edit.date); if (!s || !confirm(`Dzēst nodarbību ${U.fmtDate(s.date)}${s.topic ? ' “' + s.topic + '”' : ''} un visas tās atzīmes?`)) return;
    S.db.sessions = sessions().filter(x => x !== s); U.$('sessDialog').close(); CP.store.changed();
  };

  /* --- PDF veidlapa --- */
  A.attPdf = async how => {
    const v = view(), dates = gridDates(v), ppl = roster(v.group), [y, m] = v.month.split('-').map(Number);
    if (!dates.length) return ui.toast('Nav datumu: atzīmē nodarbību dienas vai izvēlies “Visas mēneša dienas”.', 'warn', 7000);
    const marks = how === 'filled' ? Object.fromEntries(ppl.map(p => [p.id, Object.fromEntries(dates.map(d => [d, sessFor(v.group, d)?.att?.[p.id] || '']))])) : null;
    try {
      ui.toast('Sagatavo veidlapu…', 'ok', 2000);
      const bytes = await CP.pdf.attendance({ title: 'Nodarbību apmeklējums', group: v.group === '*' ? 'visa vienība' : v.group, year: `${y}. gads`, monthTitle: MON_LOC[m - 1], dates, people: ppl, marks, legend: LEGEND, instructor: st().instructor?.name ? `${st().instructor.position || 'Instruktors'} ${st().instructor.name}` : '' });
      await CP.printPdf(new Blob([bytes], { type: 'application/pdf' }), `Apmeklējums ${v.group === '*' ? 'vienība' : v.group} ${v.month}.pdf`);
    } catch (e) { console.error(e); ui.toast('Veidlapu neizdevās sagatavot: ' + e.message, 'err', 9000); }
  };

  /* --- Žurnāls (saraksts kā e-klasē) --- */
  function journal(v) {
    const list = sessions().filter(s => (v.group === '*' || s.group === v.group || s.group === '*') && s.date.startsWith(v.month)).sort((a, b) => b.date.localeCompare(a.date));
    return `<section class="card"><div class="att-bar">${groupSel(v.group)}<span class="att-month"><button class="sm ghost" data-act="attMonth" data-arg="-1">◀</button><input type="month" id="attMonth" value="${esc(v.month)}"><button class="sm ghost" data-act="attMonth" data-arg="1">▶</button></span><span class="grow"></span><button class="sm mainbtn" data-act="sessNew">${ic('plus', '＋')} Jauna nodarbība</button></div>
      ${list.length ? `<table class="table"><thead><tr><th>Datums</th><th>Grupa</th><th>Veids</th><th>Tēma</th><th>Klātesoši</th><th>%</th><th></th></tr></thead><tbody>${list.map(s => {
        const ppl = roster(s.group), pr = ppl.filter(p => PRESENT.has(s.att?.[p.id])).length;
        return `<tr><td class="nowrap">${esc(U.fmtDate(s.date))} <small class="muted">${WD[wdOf(s.date) - 1]}</small></td><td>${esc(s.group === '*' ? 'Visa vienība' : s.group)}</td><td><span class="tag">${esc(s.type || 'Nodarbība')}</span></td><td>${esc(s.topic || '—')}${s.notes ? `<div class="small muted">${esc(s.notes)}</div>` : ''}</td><td>${pr} / ${ppl.length}</td><td>${pctTag(sessionPct(s))}</td>
          <td><button class="sm" data-act="sessOpen" data-arg="${esc(s.group)}|${s.date}">✎ Atvērt</button></td></tr>`;
      }).join('')}</tbody></table>` : ui.empty('Šajā mēnesī vēl nav nodarbību. Atzīmē apmeklējumu mēneša tabulā vai spied “Jauna nodarbība”.')}</section>`;
  }

  /* --- Rādītāji --- */
  function stats(v) {
    const g = v.statG || '*', today = U.iso(), yearId = D.activeYear();
    const ss = sessions().filter(s => s.yearId === yearId && s.date <= today && (g === '*' || s.group === g || s.group === '*')).sort((a, b) => a.date.localeCompare(b.date));
    const ppl = roster(g), pts = ss.map(s => ({ x: s.date, y: sessionPct(s), label: [s.group === '*' ? 'Visa vienība' : s.group, s.topic].filter(Boolean).join(' · ') }));
    const yearR = (() => { let pr = 0, ab = 0; for (const s of ss) for (const [pid, c] of Object.entries(s.att || {})) { if (g !== '*' && !ppl.some(p => p.id === pid)) continue; if (PRESENT.has(c)) pr++; else if (ABSENT.has(c)) ab++; } return pr + ab ? Math.round(pr / (pr + ab) * 100) : null; })();
    const month = ss.filter(s => s.date.startsWith(today.slice(0, 7))), mR = month.length ? Math.round(month.map(sessionPct).filter(x => x != null).reduce((a, b) => a + b, 0) / Math.max(1, month.map(sessionPct).filter(x => x != null).length)) : null;
    const lim = Number(st().absenceStreak) || 3, warn = ppl.filter(p => streak(p).n >= lim);
    const groupsCmp = D.groups().map(gr => { const gs = sessions().filter(s => s.yearId === yearId && s.date <= today && s.group === gr); const vals = gs.map(sessionPct).filter(x => x != null); return { gr, n: gs.length, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null }; });
    const rows = ppl.map(p => ({ p, r: D.attRate(p), t: trend(p), s: personSeries(p) })).sort((a, b) => (a.r.pct ?? 101) - (b.r.pct ?? 101));
    return `<section class="card"><div class="att-bar"><select id="attStatG"><option value="*" ${g === '*' ? 'selected' : ''}>Visa vienība</option>${D.groups().map(x => `<option ${x === g ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <span class="grow"></span><label class="small">Brīdināt pēc <input type="number" id="attLimit" min="1" max="20" value="${lim}" style="width:64px"> kavējumiem pēc kārtas</label></div>
      <div class="kpis"><div class="kpi"><small>Mācību gadā</small>${pctTag(yearR)}</div><div class="kpi"><small>Šajā mēnesī</small>${pctTag(mR)}</div><div class="kpi"><small>Nodarbības</small><b>${ss.length}</b></div><div class="kpi ${warn.length ? 'bad' : ''}"><small>Ilgstoši neapmeklē</small><b>${warn.length}</b></div></div>
      <h4 style="margin:14px 0 4px">Apmeklējuma dinamika ${g === '*' ? '— visa vienība' : '— ' + esc(g)}</h4>${tchart(pts, { title: 'Apmeklējuma dinamika' })}</section>
      ${D.groups().length > 1 ? `<section class="card"><h3>${ic('users')}Grupu salīdzinājums</h3>${groupsCmp.map(x => `<div class="gbar"><span class="gname">${esc(x.gr)}</span><span class="gtrack"><span style="width:${x.avg ?? 0}%"></span></span>${pctTag(x.avg)}<small class="muted">${x.n} nod.</small></div>`).join('')}</section>` : ''}
      <section class="card"><h3>${ic('user')}Personu apmeklējums un tendence</h3>${rows.length ? `<table class="table"><thead><tr><th>Persona</th><th>Grupa</th><th>Gadā</th><th>Pēdējās nodarbības</th><th>Tendence</th><th>Dinamika</th></tr></thead><tbody>${rows.map(({ p, r, t, s }) => {
        const sk = streak(p);
        return `<tr><td><a href="#" data-person="${p.id}">${esc(U.sortName(p))}</a>${sk.n >= lim ? ` <span class="warn">⚠ ${sk.n} pēc kārtas</span>` : ''}</td><td>${esc(D.groupOf(p))}</td><td>${pctTag(r.pct)} <small class="muted">${r.present}/${r.present + r.absent}</small></td><td class="nowrap">${dots(p, 8)}</td>
          <td>${t > 0 ? `<span class="okc">▲ ${t}</span>` : t < 0 ? `<span class="red">▼ ${-t}</span>` : '<span class="muted">—</span>'}</td><td>${spark(s.map(x => x.y))}</td></tr>`;
      }).join('')}</tbody></table>` : ui.empty('Nav personu.')}</section>`;
  }

  /* --- Kvalifikācijas un dalība --- */
  const qualList = () => (st().quals = st().quals || []);
  function quals(v) {
    const Q = qualList(), q = Q.find(x => x.id === v.qual) || Q[0]; if (q) v.qual = q.id;
    const ppl = D.peopleInYear().filter(p => p.status !== 'archived').sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
    const has = q ? ppl.filter(p => (p.quals || []).some(x => x.qid === q.id)) : [], not = q ? ppl.filter(p => !has.includes(p)) : [];
    const camps = (S.db.events || []).filter(e => e.type === 'camp');
    return `<div class="cards2"><section class="card"><h3>${ic('award')}Kvalifikācijas</h3>
        <p class="small muted" style="margin-top:0">Pats nosaki, kas ir kvalifikācija, piem., “Pamatnometne”, “1. līmenis”, “Ziemas nometne”. Tad redzams, kam tā ir un kam vēl nav, piem., piesakot uz retām nometnēm.</p>
        ${Q.map(x => `<div class="row ${q && x.id === q.id ? 'sel' : ''}"><div class="grow"><a href="#" data-act="qualPick" data-arg="${x.id}"><b>${esc(x.name)}</b></a>${x.note ? `<div class="small muted">${esc(x.note)}</div>` : ''}</div><span class="pill">${ppl.filter(p => (p.quals || []).some(y => y.qid === x.id)).length}</span><button class="sm ghost danger" data-act="qualDel" data-arg="${x.id}" title="Dzēst kvalifikāciju">✕</button></div>`).join('') || '<p class="muted small">Vēl nav nevienas kvalifikācijas.</p>'}
        <form class="inline-form" id="qualForm" style="margin-top:10px"><input name="name" placeholder="Jauna kvalifikācija, piem., Pamatnometne" required><input name="note" placeholder="Piezīme (nav obligāti)"><button class="sm mainbtn">＋ Pievienot</button></form></section>
      ${q ? `<section class="card"><h3>${esc(q.name)}</h3>
        ${camps.length ? `<div class="inline-form"><select id="qualCamp"><option value="">Piešķirt nometnes dalībniekiem…</option>${camps.map(e => `<option value="${e.id}">${esc(e.title || 'Nometne')} · ${esc(U.fmtDate(e.dateFrom || e.instrDate))}</option>`).join('')}</select><button class="sm" data-act="qualFromCamp" data-arg="${q.id}">Piešķirt</button></div>` : ''}
        <h4>Ir (${has.length})</h4>${has.map(p => { const x = p.quals.find(y => y.qid === q.id); return `<div class="row"><div class="grow"><a href="#" data-person="${p.id}">${esc(U.sortName(p))}</a> <small class="muted">${esc(D.groupOf(p))} · ${esc(U.fmtDate(x.date))}${x.src ? ' · ' + esc(x.src) : ''}</small></div><button class="sm ghost danger" data-act="qualRemove" data-arg="${p.id}|${q.id}" title="Noņemt">✕</button></div>`; }).join('') || '<p class="muted small">Nevienam.</p>'}
        <h4>Vēl nav (${not.length})</h4><div class="inline-form"><input type="date" id="qualDate" value="${U.iso()}"><button class="sm mainbtn" data-act="qualGive" data-arg="${q.id}">Piešķirt atzīmētajiem</button></div>
        <div class="qual-not">${not.map(p => `<label class="check"><input type="checkbox" data-qualp="${p.id}"> ${esc(U.sortName(p))} <small class="muted">${esc(D.groupOf(p))} · apmeklējums ${D.attRate(p).pct ?? '—'}${D.attRate(p).pct != null ? '%' : ''}</small></label>`).join('') || '<p class="muted small">Visiem ir.</p>'}</div></section>` : ''}</div>`;
  }
  document.addEventListener('submit', e => {
    if (e.target.id !== 'qualForm') return; e.preventDefault();
    const o = Object.fromEntries(new FormData(e.target)); if (!o.name.trim()) return;
    qualList().push({ id: U.uid(), name: o.name.trim(), note: o.note.trim() }); view().qual = qualList().at(-1).id; CP.store.changed();
  });
  A.qualPick = id => { view().qual = id; CP.render(); };
  A.qualDel = id => { const q = qualList().find(x => x.id === id); if (!q || !confirm(`Dzēst kvalifikāciju “${q.name}”? Tā tiks noņemta arī visām personām.`)) return; st().quals = qualList().filter(x => x.id !== id); for (const p of S.db.people) if (p.quals) p.quals = p.quals.filter(x => x.qid !== id); CP.store.changed(); };
  const giveQual = (p, qid, date, src) => { p.quals = p.quals || []; if (p.quals.some(x => x.qid === qid)) return false; p.quals.push({ qid, date, src: src || '' }); D.audit(p.id, 'update', ['Kvalifikācija: ' + (qualList().find(x => x.id === qid)?.name || '')]); return true; };
  A.qualGive = qid => { const date = U.$('qualDate')?.value || U.iso(); let n = 0; document.querySelectorAll('[data-qualp]:checked').forEach(c => { const p = D.person(c.dataset.qualp); if (p && giveQual(p, qid, date)) n++; }); if (!n) return ui.toast('Atzīmē personas sarakstā “Vēl nav”', 'warn'); CP.store.changed(); ui.toast(`Kvalifikācija piešķirta ${n} personām`, 'ok'); };
  A.qualFromCamp = qid => { const ev = (S.db.events || []).find(e => e.id === U.$('qualCamp')?.value); if (!ev) return ui.toast('Izvēlies nometni', 'warn'); let n = 0; for (const x of ev.participants || []) { const p = D.person(x.pid); if (p && giveQual(p, qid, ev.dateTo || ev.dateFrom || ev.instrDate || U.iso(), ev.title || 'nometne')) n++; } CP.store.changed(); ui.toast(`Piešķirta ${n} nometnes dalībniekiem`, 'ok'); };
  A.qualRemove = arg => { const [pid, qid] = String(arg).split('|'), p = D.person(pid); if (!p || !confirm('Noņemt kvalifikāciju šai personai?')) return; p.quals = (p.quals || []).filter(x => x.qid !== qid); D.audit(p.id, 'update', ['Noņemta kvalifikācija']); CP.store.changed(); };

  /* ================== Personas kartītē ================== */
  /** Sānjosla: apmeklējums */
  function attCard(p) {
    const r = D.attRate(p), sk = streak(p), lim = Number(st().absenceStreak) || 3, ser = personSeries(p);
    if (!personSessions(p).length) return '';
    return `<section class="card"><h3>${ic('calendar')}Apmeklējums</h3>
      <div class="att-mini"><div>${pctTag(r.pct)} <small class="muted">mācību gadā · ${r.present} no ${r.present + r.absent}${r.excused ? ` · ${r.excused} attaisnoti` : ''}</small></div>${spark(ser.map(x => x.y), 110, 26)}</div>
      <div style="margin:6px 0">${dots(p, 12)}</div>
      ${sk.n >= lim ? `<p class="small warn" style="margin:0">⚠ Nav apmeklējis ${sk.n} nodarbības pēc kārtas</p>` : ''}
      <div class="actions" style="margin-top:6px"><button class="sm ghost" data-page="attendance">Apmeklējuma žurnāls →</button></div></section>`;
  }
  /** Galvenā kolonna: dalība, kvalifikācijas, pārkāpumi */
  const SEV = { note: ['Piezīme', ''], warn: ['Brīdinājums', 'warn'], serious: ['Nopietns', 'red'] };
  function historyCards(p) {
    const Q = qualList(), myQ = (p.quals || []).map(x => ({ ...x, q: Q.find(q => q.id === x.qid) })).filter(x => x.q);
    const evs = (S.db.events || []).filter(e => (e.participants || []).some(x => x.pid === p.id)).map(e => ({ date: e.dateFrom || e.instrDate, t: e.type === 'camp' ? 'Nometne' : 'Pasākums (instruktāža)', title: e.title }));
    const ses = sessions().filter(s => s.type && s.type !== 'Nodarbība' && PRESENT.has(s.att?.[p.id])).map(s => ({ date: s.date, t: s.type, title: s.topic }));
    const part = [...evs, ...ses].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const inc = [...(p.incidents || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const nodN = personSessions(p).filter(s => PRESENT.has(s.att?.[p.id])).length;
    return `<section class="card wide"><h3>${ic('award')}Dalība un kvalifikācijas</h3>
        <div class="chips">${myQ.map(x => `<span class="chip ok" title="${esc(U.fmtDate(x.date) + (x.src ? ' · ' + x.src : ''))}">🏅 ${esc(x.q.name)} <small>${esc(U.fmtDate(x.date))}</small></span>`).join('') || '<span class="muted small">Kvalifikāciju vēl nav.</span>'}
          ${Q.filter(q => !myQ.some(x => x.qid === q.id)).length ? `<select class="sm" data-qualadd="${p.id}"><option value="">＋ Piešķirt…</option>${Q.filter(q => !myQ.some(x => x.qid === q.id)).map(q => `<option value="${q.id}">${esc(q.name)}</option>`).join('')}</select>` : ''}</div>
        <p class="small muted" style="margin:8px 0 4px">Apmeklētas nodarbības šajā mācību gadā: <b>${nodN}</b>. Dalība pasākumos un nometnēs:</p>
        ${part.slice(0, 12).map(x => `<div class="row small"><span class="muted nowrap">${esc(U.fmtDate(x.date))}</span><span class="tag">${esc(x.t)}</span><span class="grow">${esc(x.title || '')}</span></div>`).join('') || '<p class="muted small">Vēl nav reģistrēta dalība pasākumos vai nometnēs.</p>'}</section>
      <section class="card wide"><h3>${ic('alert', '⚠')}Uzvedība un pārkāpumi <button class="sm right" data-act="incEdit" data-arg="${p.id}|">＋ Ieraksts</button></h3>
        ${inc.map(x => `<div class="inc sev-${esc(x.severity || 'note')}"><div class="grow"><b>${esc(U.fmtDate(x.date))}</b> <span class="tag ${SEV[x.severity]?.[1] || ''}">${esc(SEV[x.severity]?.[0] || 'Piezīme')}</span> <span class="tag">${esc(x.type || '')}</span>
          <div>${esc(x.text || '')}</div>${x.action ? `<div class="small muted">Veiktie pasākumi: ${esc(x.action)}</div>` : ''}</div><button class="sm ghost" data-act="incEdit" data-arg="${p.id}|${x.id}" title="Labot">✎</button><button class="sm ghost danger" data-act="incDel" data-arg="${p.id}|${x.id}" title="Dzēst">✕</button></div>`).join('') || '<p class="muted small">Nav ierakstu. Šeit vari pierakstīt pārkāpumus un svarīgus gadījumus, lai vēlāk atcerētos, kas ar personu bijis.</p>'}</section>`;
  }
  CP.changeHandlers.push(e => {
    const pid = e.target.dataset?.qualadd; if (!pid || !e.target.value) return false;
    const p = D.person(pid); if (p && giveQual(p, e.target.value, U.iso())) { CP.store.changed(); ui.toast('Kvalifikācija piešķirta', 'ok'); } return true;
  });
  A.incEdit = arg => {
    const [pid, id] = String(arg).split('|'), p = D.person(pid); if (!p) return;
    const x = (p.incidents || []).find(i => i.id === id) || {}, types = st().incidentTypes || ['Disciplīna', 'Forma un izskats', 'Drošība', 'Kavējumi', 'Uzvedība pret citiem', 'Cits'];
    let d = U.$('incDialog'); if (!d) { d = document.createElement('dialog'); d.id = 'incDialog'; document.body.appendChild(d); }
    d.innerHTML = `<form><header class="dlg-head"><h2>${x.id ? 'Labot ierakstu' : 'Jauns ieraksts'} — ${esc(U.full(p))}</h2><button type="button" class="ghost" data-close="incDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><div class="fieldgrid">
        <div class="field"><label>Datums</label><input type="date" name="date" value="${esc(x.date || U.iso())}" required></div>
        <div class="field"><label>Smagums</label><select name="severity">${Object.entries(SEV).map(([k, [l]]) => `<option value="${k}" ${(x.severity || 'note') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field wide"><label>Veids</label><input name="type" list="dl_inc" value="${esc(x.type || '')}" placeholder="piem., Disciplīna"><datalist id="dl_inc">${types.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
        <div class="field wide"><label>Kas notika</label><textarea name="text" rows="3" data-autogrow required>${esc(x.text || '')}</textarea></div>
        <div class="field wide"><label>Veiktie pasākumi (nav obligāti)</label><textarea name="action" rows="2" data-autogrow placeholder="piem., pārrunas, informēti vecāki">${esc(x.action || '')}</textarea></div>
      </div><p class="small muted">Ieraksti redzami tikai rīkā, personas kartītē.</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="incDialog">Atcelt</button><button class="mainbtn" type="submit">Saglabāt</button></footer></form>`;
    d.querySelector('form').onsubmit = e => {
      e.preventDefault(); const o = Object.fromEntries(new FormData(e.target)); for (const k in o) o[k] = String(o[k]).trim();
      p.incidents = p.incidents || [];
      if (x.id) Object.assign(p.incidents.find(i => i.id === x.id), o, { editedAt: U.now() }); else p.incidents.push({ id: U.uid(), ...o, at: U.now() });
      D.audit(p.id, 'update', [x.id ? 'Labots uzvedības ieraksts' : 'Jauns uzvedības ieraksts']); d.close(); CP.store.changed();
    };
    d.showModal();
  };
  A.incDel = arg => { const [pid, id] = String(arg).split('|'), p = D.person(pid); if (!p || !confirm('Dzēst šo ierakstu?')) return; p.incidents = (p.incidents || []).filter(i => i.id !== id); D.audit(p.id, 'update', ['Dzēsts uzvedības ieraksts']); CP.store.changed(); };

  CP.attendance = { attCard, historyCards, tchart, streak, rateOf };
})(window.CP);


/* ==== js/schedule.js ==== */
/* =====================================================================
   Grafiks: instruktora darba kalendārs (nodarbības, pasākumi, VAM, nometnes …).
   Nav saistīts ar jaunsargu datiem — tikai notikumi, laiki, vieta, piezīmes.

   S.db.schedule = [{ id, title, type, date, endDate, allDay, start 'HH:MM', end 'HH:MM', place, notes,
                      remind: [minūtes], seriesId, gcalId, gsig, createdAt, updatedAt }]
   S.db.scheduleDel = [gcalId]  — Google kalendārā vēl jānodzēš
   settings.gcal = { clientId, calendarId, lastSync }   settings.notify = { events: true, alerts: true }
   Atgādinājumi: rīkā (paziņojums) un uz darbvirsmas (Notification API), kamēr rīks ir atvērts.
   Google Calendar: OAuth (pārlūkā, bez servera) → atsevišķs kalendārs; tiek sūtīti tikai notikumi.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const ic = (n, f = '') => CP.ic(n, f);
  const TYPES = [
    ['Nodarbība', '#3fa98f'], ['VAM nodarbība', '#5b8def'], ['Pasākums', '#e6a23c'], ['Nometne', '#d9663f'], ['Sacensības', '#b46fd8'],
    ['Sapulce / apmācības', '#4fb3c9'], ['Novada pārvaldes darbs', '#6f8fc9'], ['Metodiskais darbs', '#7fae7a'], ['Administratīvais darbs', '#8a9aa8'], ['Prombūtne', '#a3a7ad'], ['Cits', '#c2a55a']
  ];
  const color = t => (TYPES.find(x => x[0] === t) || TYPES.at(-1))[1];
  const REMIND = [[0, 'sākumā'], [15, '15 min'], [30, '30 min'], [60, '1 h'], [120, '2 h'], [1440, '1 dienu'], [2880, '2 dienas'], [10080, '1 nedēļu']];
  const remLabel = m => (REMIND.find(x => x[0] === m) || [m, m + ' min'])[1];
  const WD = ['P', 'O', 'T', 'C', 'Pk', 'S', 'Sv'], WDL = ['Pirmdiena', 'Otrdiena', 'Trešdiena', 'Ceturtdiena', 'Piektdiena', 'Sestdiena', 'Svētdiena'];
  const MON = ['janvāris', 'februāris', 'marts', 'aprīlis', 'maijs', 'jūnijs', 'jūlijs', 'augusts', 'septembris', 'oktobris', 'novembris', 'decembris'];
  const H0 = 7, H1 = 22;   // nedēļas skata stundas

  const st = () => S.db.settings;
  const list = () => (S.db.schedule = S.db.schedule || []);
  const delQ = () => (S.db.scheduleDel = S.db.scheduleDel || []);
  const gc = () => (st().gcal = st().gcal || { clientId: '', calendarId: '', lastSync: '' });
  const nt = () => (st().notify = st().notify || { events: true, alerts: true });
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return U.iso(d); };
  const wd = iso => (new Date(iso + 'T12:00:00').getDay() + 6) % 7;   // 0 = pirmdiena
  const monday = iso => addDays(iso, -wd(iso));
  const endDay = e => e.endDate && e.endDate > e.date ? e.endDate : e.date;
  const onDay = (e, iso) => e.date <= iso && endDay(e) >= iso;
  const startAt = e => new Date(`${e.date}T${e.allDay ? '00:00' : (e.start || '00:00')}:00`);
  const endAt = e => e.allDay ? new Date(`${addDays(endDay(e), 1)}T00:00:00`) : new Date(`${endDay(e)}T${e.end || e.start || '23:59'}:00`);
  const mins = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
  const hours = e => e.allDay ? 0 : Math.max(0, (endAt(e) - startAt(e)) / 3600000);
  const timeTxt = e => e.allDay ? (e.endDate && e.endDate > e.date ? `visu dienu līdz ${U.fmtDate(e.endDate)}` : 'visu dienu') : `${e.start || ''}${e.end ? '–' + e.end : ''}${e.endDate && e.endDate > e.date ? ` (līdz ${U.fmtDate(e.endDate)})` : ''}`;
  const sorted = arr => [...arr].sort((a, b) => (a.date + (a.allDay ? '00:00' : a.start)).localeCompare(b.date + (b.allDay ? '00:00' : b.start)));
  const dayEvents = iso => sorted(list().filter(e => onDay(e, iso)));
  const chip = (e, cls = '') => `<button class="sch-chip ${cls}" style="--c:${color(e.type)}" data-act="schView" data-arg="${e.id}" title="${esc(`${e.title} · ${timeTxt(e)}${e.place ? ' · ' + e.place : ''}`)}">${e.allDay ? '' : `<b>${esc(e.start || '')}</b> `}${esc(e.title)}</button>`;

  /* ================== Lapa ================== */
  const view = () => S.sch || (S.sch = { mode: (() => { try { return localStorage.getItem('cp.schMode') || 'month'; } catch (e) { return 'month'; } })(), date: U.iso(), tab: 'cal' });
  CP.pages.schedule = {
    render() {
      const v = view();
      const tab = (k, l, i) => `<button role="tab" data-act="schTab" data-arg="${k}" class="${v.tab === k ? 'active' : ''}">${ic(i)}${l}</button>`;
      const body = v.tab === 'hours' ? hoursTab(v) : v.tab === 'sync' ? syncTab() : calTab(v);
      return `<div class="page">${ui.pageHead('Grafiks', 'Darba kalendārs: nodarbības, pasākumi, VAM, nometnes — ar atgādinājumiem un Google kalendāru',
        `<button data-act="schImport" title="Darba grafika imports no Excel">${ic('upload', '⬆')} Imports</button><button class="mainbtn" data-act="schNew">${ic('plus', '＋')} Notikums</button>`)}
        <nav class="tabs" role="tablist">${tab('cal', 'Kalendārs', 'calendar')}${tab('hours', 'Stundu kopsavilkums', 'clock')}${tab('sync', 'Atgādinājumi un Google', 'bell')}</nav>${body}</div>`;
    },
    after() { const n = document.querySelector('.sch-week .sch-now'); if (n && !view()._scrolled) { view()._scrolled = true; n.closest('.sch-wscroll')?.scrollTo({ top: Math.max(0, n.offsetTop - 120) }); } }
  };
  A.schTab = k => { view().tab = k; CP.render(); };
  A.schMode = m => { const v = view(); v.mode = m; v._scrolled = false; try { localStorage.setItem('cp.schMode', m); } catch (e) { } CP.render(); };
  A.schNav = d => {
    const v = view(); if (d === '0') v.date = U.iso();
    else if (v.mode === 'month') { const x = new Date(v.date + 'T12:00:00'); x.setDate(1); x.setMonth(x.getMonth() + Number(d)); v.date = U.iso(x); }
    else v.date = addDays(v.date, (v.mode === 'week' ? 7 : 30) * Number(d));
    v._scrolled = false; CP.render();
  };
  CP.changeHandlers.push(e => {
    const t = e.target;
    if (t.id === 'schJump' && t.value) { view().date = t.value; CP.render(); return true; }
    if (t.id === 'schHoursM' && t.value) { view().hm = t.value; CP.render(); return true; }
    if (t.dataset?.notify) { nt()[t.dataset.notify] = t.checked; CP.store.changed(); if (t.checked) askPermission(); return true; }
    if (t.id === 'gcalClient') { gc().clientId = t.value.trim(); CP.google.rememberClient(gc().clientId); CP.store.changed({ silent: true }); const b = document.querySelector('[data-act=gcalSync]'); if (b) b.disabled = !gc().clientId; return true; }
    if (t.id === 'schDefRem') { st().schDefaultRemind = [...document.querySelectorAll('[data-defrem]:checked')].map(x => Number(x.value)); CP.store.changed({ silent: true }); return true; }
    if (t.dataset?.defrem != null) { st().schDefaultRemind = [...document.querySelectorAll('[data-defrem]:checked')].map(x => Number(x.value)); CP.store.changed({ silent: true }); return true; }
    return false;
  });

  function calTab(v) {
    const today = U.iso(), d = new Date(v.date + 'T12:00:00');
    const title = v.mode === 'month' ? `${MON[d.getMonth()]} ${d.getFullYear()}` : v.mode === 'week' ? (() => { const m = monday(v.date), s = addDays(m, 6); return `${U.fmtDate(m).slice(0, 5)}–${U.fmtDate(s)} · ${isoWeek(m)}. nedēļa`; })() : `no ${U.fmtDate(v.date)}`;
    const seg = (k, l) => `<button class="sm ${v.mode === k ? 'on' : ''}" data-act="schMode" data-arg="${k}">${l}</button>`;
    const upcoming = sorted(list().filter(e => endDay(e) >= today)).slice(0, 4);
    const imp = st().schImport;
    return `${imp ? `<p class="small muted sch-impinfo">⬆ Pēdējais imports: <b>${esc(imp.name)}</b> · ${esc(U.fmtDateTime(imp.at))} · ${imp.n} notikumi no Excel. Atjaunots fails? Ievelc to šeit vai spied “Imports”.</p>` : ''}<section class="card" data-schdrop><div class="att-bar">
        <span class="att-month"><button class="sm ghost" data-act="schNav" data-arg="-1" title="Atpakaļ">◀</button><button class="sm" data-act="schNav" data-arg="0">Šodien</button><button class="sm ghost" data-act="schNav" data-arg="1" title="Uz priekšu">▶</button></span>
        <b class="sch-title">${esc(title)}</b><input type="date" id="schJump" value="${esc(v.date)}" title="Pāriet uz datumu" style="width:auto">
        <span class="grow"></span><span class="seg">${seg('month', 'Mēnesis')}${seg('week', 'Nedēļa')}${seg('list', 'Saraksts')}</span></div>
        ${v.mode === 'week' ? week(v) : v.mode === 'list' ? agenda(v) : month(v)}
        <div class="sch-legend">${TYPES.map(([t, c]) => `<span><i style="background:${c}"></i>${esc(t)}</span>`).join('')}</div></section>
      ${upcoming.length && v.mode !== 'list' ? `<section class="card"><h3>${ic('clock')}Tuvākie notikumi</h3>${upcoming.map(row).join('')}</section>` : ''}`;
  }
  const isoWeek = iso => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + 3 - wd(iso)); const y = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - y) / 86400000 - 3 + (y.getDay() + 6) % 7) / 7); };
  const row = e => `<div class="row sch-row" style="--c:${color(e.type)}"><span class="sch-bar"></span><div class="sch-when"><b>${esc(U.fmtDate(e.date).slice(0, 5))}</b> <small class="muted">${WD[wd(e.date)]}</small><div class="small">${esc(timeTxt(e))}</div></div>
    <div class="grow"><a href="#" class="sch-open" data-act="schView" data-arg="${e.id}"><b>${esc(e.title)}</b></a> <span class="tag">${esc(e.type)}</span>${e.place ? `<div class="small muted">📍 ${esc(e.place)}</div>` : ''}${e.notes ? `<div class="small muted">${esc(e.notes)}</div>` : ''}</div>
    <span class="small muted nowrap" title="Atgādinājumi">${(e.remind || []).length ? '🔔 ' + e.remind.map(remLabel).join(', ') : ''}${e.gcalId ? ' · <span title="Ir Google kalendārā">G✓</span>' : ''}</span><button class="sm ghost" data-act="schEdit" data-arg="${e.id}" title="Labot">✎</button></div>`;

  function month(v) {
    const d = new Date(v.date + 'T12:00:00'), first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, start = monday(first), today = U.iso(), mo = first.slice(0, 7);
    const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
    const weeks = cells[35].slice(0, 7) !== mo ? 5 : 6;
    return `<div class="sch-month"><div class="sch-mh">${WD.map(w => `<span>${w}</span>`).join('')}</div><div class="sch-mg">${cells.slice(0, weeks * 7).map(iso => {
      const ev = dayEvents(iso);
      return `<div class="sch-day ${iso.slice(0, 7) !== mo ? 'out' : ''} ${iso === today ? 'today' : ''} ${wd(iso) > 4 ? 'we' : ''}" data-act="schNew" data-arg="${iso}" title="Klikšķis — jauns notikums šajā dienā">
        <span class="sch-dn">${Number(iso.slice(8))}</span>${ev.slice(0, 4).map(e => chip(e)).join('')}${ev.length > 4 ? `<button class="sch-more" data-act="schDay" data-arg="${iso}">+${ev.length - 4} vēl</button>` : ''}</div>`;
    }).join('')}</div></div>`;
  }
  A.schDay = iso => { const v = view(); v.date = iso; v.mode = 'week'; CP.render(); };
  function week(v) {
    const m = monday(v.date), days = Array.from({ length: 7 }, (_, i) => addDays(m, i)), today = U.iso(), px = 44, now = new Date();
    const allDay = days.map(iso => `<div class="sch-ad">${dayEvents(iso).filter(e => e.allDay || e.endDate > e.date).map(e => chip(e)).join('')}</div>`).join('');
    const cols = days.map(iso => {
      const ev = dayEvents(iso).filter(e => !e.allDay && !(e.endDate > e.date));
      // pārklāšanās: vienkāršas joslas
      const lanes = []; const place = ev.map(e => { const s = mins(e.start), en = Math.max(s + 30, mins(e.end || e.start) || s + 60); let l = lanes.findIndex(x => x <= s); if (l < 0) { l = lanes.length; lanes.push(en); } else lanes[l] = en; return { e, s, en, l }; });
      const n = Math.max(1, lanes.length);
      const blocks = place.map(({ e, s, en, l }) => `<button class="sch-blk" data-act="schView" data-arg="${e.id}" style="--c:${color(e.type)};top:${(Math.max(s, H0 * 60) - H0 * 60) / 60 * px}px;height:${Math.max(22, (Math.min(en, H1 * 60) - Math.max(s, H0 * 60)) / 60 * px - 2)}px;left:${l / n * 100}%;width:${100 / n}%" title="${esc(e.title + ' · ' + timeTxt(e))}"><b>${esc(e.start)}–${esc(e.end || '')}</b> ${esc(e.title)}${e.place ? `<small>${esc(e.place)}</small>` : ''}</button>`).join('');
      const nowLine = iso === today && now.getHours() >= H0 && now.getHours() < H1 ? `<div class="sch-now" style="top:${(now.getHours() * 60 + now.getMinutes() - H0 * 60) / 60 * px}px"></div>` : '';
      return `<div class="sch-col ${iso === today ? 'today' : ''}" data-day="${iso}">${Array.from({ length: H1 - H0 }, (_, h) => `<div class="sch-slot" data-act="schNew" data-arg="${iso}|${String(H0 + h).padStart(2, '0')}:00" style="height:${px}px"></div>`).join('')}${blocks}${nowLine}</div>`;
    }).join('');
    return `<div class="sch-week"><div class="sch-wh"><span></span>${days.map(iso => `<span class="${iso === today ? 'today' : ''}"><b>${WD[wd(iso)]}</b> ${esc(U.fmtDate(iso).slice(0, 5))}</span>`).join('')}</div>
      <div class="sch-wad"><span class="small muted">visu dienu</span>${allDay}</div>
      <div class="sch-wscroll"><div class="sch-wbody"><div class="sch-hours">${Array.from({ length: H1 - H0 }, (_, h) => `<span style="height:${px}px">${H0 + h}:00</span>`).join('')}</div>${cols}</div></div></div>`;
  }
  function agenda(v) {
    const from = v.date, to = addDays(from, 60), ev = sorted(list().filter(e => endDay(e) >= from && e.date <= to));
    if (!ev.length) return ui.empty('Nākamajās 60 dienās nav notikumu.', `<button class="mainbtn" data-act="schNew">＋ Jauns notikums</button>`);
    let last = '', out = '';
    for (const e of ev) { const day = e.date < from ? from : e.date; if (day !== last) { out += `<h4 class="sch-agh ${day === U.iso() ? 'today' : ''}">${WDL[wd(day)]}, ${esc(U.fmtDate(day))}</h4>`; last = day; } out += row(e); }
    return `<div class="sch-agenda">${out}</div>`;
  }

  /* --- Stundu kopsavilkums --- */
  function hoursTab(v) {
    const m = v.hm || U.iso().slice(0, 7), ev = sorted(list().filter(e => e.date.startsWith(m)));
    const byType = TYPES.map(([t, c]) => { const x = ev.filter(e => e.type === t); return { t, c, n: x.length, h: x.reduce((a, e) => a + hours(e), 0) }; }).filter(x => x.n);
    const total = byType.reduce((a, b) => a + b.h, 0), max = Math.max(1, ...byType.map(x => x.h));
    const f = h => (Math.round(h * 100) / 100).toLocaleString('lv-LV');
    return `<section class="card"><div class="att-bar"><input type="month" id="schHoursM" value="${esc(m)}" style="width:auto"><span class="grow"></span><span class="small muted">Plānotās stundas pēc grafika (visu dienu notikumi netiek skaitīti stundās).</span></div>
      <div class="kpis"><div class="kpi"><small>Stundas kopā</small><b>${f(total)}</b></div><div class="kpi"><small>Notikumi</small><b>${ev.length}</b></div><div class="kpi"><small>Kontaktstundas (nodarbības + VAM)</small><b>${f(byType.filter(x => /Nodarbība/.test(x.t)).reduce((a, b) => a + b.h, 0))} h</b></div></div>
      ${byType.map(x => `<div class="gbar"><span class="gname"><i class="sch-dot" style="background:${x.c}"></i>${esc(x.t)}</span><span class="gtrack"><span style="width:${x.h / max * 100}%;background:${x.c}"></span></span><b>${f(x.h)} h</b><small class="muted">${x.n}×</small></div>`).join('') || ui.empty('Šajā mēnesī nav notikumu.')}</section>
      ${ev.length ? `<section class="card"><h3>${ic('list')}Notikumi</h3><table class="table"><thead><tr><th>Datums</th><th>Laiks</th><th>Notikums</th><th>Veids</th><th>Stundas</th></tr></thead><tbody>${ev.map(e => `<tr><td class="nowrap">${esc(U.fmtDate(e.date))} <small class="muted">${WD[wd(e.date)]}</small></td><td class="nowrap">${esc(timeTxt(e))}</td><td><a href="#" data-act="schView" data-arg="${e.id}">${esc(e.title)}</a>${e.place ? ` <small class="muted">· ${esc(e.place)}</small>` : ''}</td><td><span class="tag">${esc(e.type)}</span></td><td>${e.allDay ? '—' : f(hours(e))}</td></tr>`).join('')}</tbody></table></section>` : ''}`;
  }

  /* --- Notikuma logs --- */
  let cur = null;
  A.schNew = (arg, el, ev) => {
    if (ev && ev.target.closest('.sch-chip,.sch-more')) return;    // klikšķis uz notikuma dienas šūnā
    const [date, start] = String(arg || '').split('|');
    const st0 = start || '18:00', [h, m] = st0.split(':').map(Number);
    cur = { id: '', title: '', type: 'Nodarbība', date: date || view().date || U.iso(), endDate: '', allDay: false, start: st0, end: `${String(Math.min(23, h + 2)).padStart(2, '0')}:${String(m).padStart(2, '0')}`, place: '', notes: '', remind: st().schDefaultRemind || [60, 1440] };
    dialog();
  };
  A.schEdit = id => { const e = list().find(x => x.id === id); if (!e) return; U.$('schView')?.close(); cur = JSON.parse(JSON.stringify(e)); dialog(); };
  /** Notikuma kartīte (tikai skatīšanai): klikšķis kalendārā vairs neatver labošanu, to dara ✎ */
  A.schView = id => {
    const e = list().find(x => x.id === id); if (!e) return;
    let d = U.$('schView'); if (!d) { d = document.createElement('dialog'); d.id = 'schView'; d.className = 'sch-view'; document.body.appendChild(d); }
    const days = U.daysTo(e.date), rel = days === 0 ? 'šodien' : days === 1 ? 'rīt' : days === -1 ? 'vakar' : days > 0 ? `pēc ${days} d.` : `pirms ${-days} d.`;
    const multi = e.endDate && e.endDate > e.date, h = hours(e), series = e.seriesId ? list().filter(x => x.seriesId === e.seriesId) : [];
    const fmtH = v => (Math.round(v * 100) / 100).toLocaleString('lv-LV');
    const line = (icon, html) => html ? `<div class="sv-line"><span class="sv-ic">${icon}</span><div>${html}</div></div>` : '';
    d.innerHTML = `<div class="sv-band" style="--c:${color(e.type)}"></div>
      <header class="dlg-head"><div><span class="tag" style="background:color-mix(in srgb, ${color(e.type)} 25%, transparent)">${esc(e.type)}</span><h2 style="margin:6px 0 0">${esc(e.title)}</h2></div><button type="button" class="ghost" data-close="schView" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body">
        ${line('📅', `<b>${WDL[wd(e.date)]}, ${esc(U.fmtDate(e.date))}</b>${multi ? ` – ${WDL[wd(e.endDate)].toLowerCase()}, ${esc(U.fmtDate(e.endDate))}` : ''} <span class="muted small">(${rel})</span>`)}
        ${line('🕘', e.allDay ? (multi ? 'Visas dienas' : 'Visu dienu') : `<b>${esc(e.start || '')}${e.end ? '–' + esc(e.end) : ''}</b>${h ? ` <span class="muted small">· ${fmtH(h)} h</span>` : ''}`)}
        ${line('📍', e.place ? esc(e.place) : '')}
        ${line('📝', e.notes ? `<div class="sv-notes">${esc(e.notes)}</div>` : '')}
        ${line('🔔', (e.remind || []).length ? 'Atgādināt: ' + e.remind.map(m => m ? remLabel(m) + ' iepriekš' : 'sākumā').join(', ') : '<span class="muted">Bez atgādinājuma</span>')}
        ${series.length > 1 ? line('↻', `Atkārtojas katru nedēļu <span class="muted small">(${series.length} notikumi, līdz ${esc(U.fmtDate(series.map(x => x.date).sort().at(-1)))})</span>`) : ''}
        ${e.ikey || e.gcalId ? `<div class="sv-meta small muted">${e.ikey ? '⬆ Importēts no darba plānošanas matricas. Ja to labosi rīkā, nākamais imports to var pārrakstīt.' : ''}${e.ikey && e.gcalId ? '<br>' : ''}${e.gcalId ? 'G✓ Ir Google kalendārā' : ''}</div>` : ''}
      </div>
      <footer class="dlg-foot"><button type="button" class="ghost" data-act="schViewDup" data-arg="${e.id}" title="Izveidot kopiju nākamajai nedēļai">⧉ Kopēt</button><span class="grow"></span><button type="button" data-close="schView">Aizvērt</button><button type="button" class="mainbtn" data-act="schEdit" data-arg="${e.id}">✎ Labot</button></footer>`;
    if (!d.open) d.showModal();
  };
  A.schViewDup = id => { A.schEdit(id); A.schDup(); };
  function dialog() {
    let d = U.$('schDialog'); if (!d) { d = document.createElement('dialog'); d.id = 'schDialog'; d.className = 'wide'; document.body.appendChild(d); }
    const e = cur, titles = [...new Set(list().map(x => x.title).filter(Boolean))].slice(-80), places = [...new Set(list().map(x => x.place).filter(Boolean))].slice(-40);
    const series = e.seriesId ? list().filter(x => x.seriesId === e.seriesId && x.date >= e.date).length : 0;
    d.innerHTML = `<form id="schForm"><header class="dlg-head"><h2>${e.id ? 'Labot notikumu' : 'Jauns notikums'}</h2><button type="button" class="ghost" data-close="schDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><div class="fieldgrid">
        <div class="field wide"><label>Nosaukums</label><input name="title" value="${esc(e.title)}" list="dl_schT" required placeholder="piem., Nodarbība J1 grupai, VAM 10.b klasei, Rudens nometne"><datalist id="dl_schT">${titles.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
        <div class="field"><label>Veids</label><select name="type">${TYPES.map(([t]) => `<option ${t === e.type ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label>Vieta</label><input name="place" value="${esc(e.place || '')}" list="dl_schP" placeholder="piem., skolas sporta zāle"><datalist id="dl_schP">${places.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
        <div class="field"><label>Datums</label><input type="date" name="date" value="${esc(e.date)}" required></div>
        <div class="field"><label>Beigu datums <small class="muted">(vairāku dienu notikumam)</small></label><input type="date" name="endDate" value="${esc(e.endDate || '')}"></div>
        <div class="field"><label class="check"><input type="checkbox" name="allDay" ${e.allDay ? 'checked' : ''}> Visu dienu</label></div>
        <div class="field sch-times"><label>Laiks</label><span><input type="time" name="start" value="${esc(e.start || '')}" ${e.allDay ? 'disabled' : ''}> – <input type="time" name="end" value="${esc(e.end || '')}" ${e.allDay ? 'disabled' : ''}></span></div>
        <div class="field wide"><label>Atgādināt</label><div class="chips">${REMIND.map(([m, l]) => `<label class="wd ${(e.remind || []).includes(m) ? 'on' : ''}"><input type="checkbox" name="rem" value="${m}" ${(e.remind || []).includes(m) ? 'checked' : ''}>${m ? l + ' iepriekš' : 'notikuma sākumā'}</label>`).join('')}</div></div>
        <div class="field wide"><label>Piezīmes</label><textarea name="notes" rows="2" data-autogrow placeholder="piem., līdzi ņemt kartes un kompasus">${esc(e.notes || '')}</textarea></div>
        ${!e.id ? `<div class="field wide sch-rep"><label class="check"><input type="checkbox" name="repeat"> Atkārtot katru nedēļu</label> <span>līdz <input type="date" name="until" value="${esc(addDays(e.date, 7 * 12))}"></span> <span class="small muted">— katra reize būs atsevišķs notikums, ko var labot</span></div>` : ''}
        ${series > 1 ? `<div class="field wide"><label class="check"><input type="checkbox" name="applySeries"> Piemērot izmaiņas arī nākamajiem ${series - 1} šīs sērijas notikumiem (nosaukums, veids, laiks, vieta, atgādinājumi, piezīmes)</label></div>` : ''}
      </div><p class="small muted">Grafiks ir instruktora darba kalendārs. Ja izmanto Google sinhronizāciju, neraksti nosaukumā vai piezīmēs jauniešu personas datus.</p></div>
      <footer class="dlg-foot">${e.id ? `<button type="button" class="ghost danger" data-act="schDel">Dzēst</button>${series > 1 ? `<button type="button" class="ghost danger" data-act="schDel" data-arg="series">Dzēst šo un nākamos (${series})</button>` : ''}<button type="button" class="ghost" data-act="schDup">⧉ Kopēt</button>` : ''}<span class="grow"></span><button type="button" data-close="schDialog">Atcelt</button><button class="mainbtn" type="submit">Saglabāt</button></footer></form>`;
    const f = d.querySelector('form');
    f.allDay.onchange = () => { f.start.disabled = f.end.disabled = f.allDay.checked; };
    f.querySelectorAll('[name=rem]').forEach(c => c.onchange = () => c.parentElement.classList.toggle('on', c.checked));
    f.onsubmit = ev => {
      ev.preventDefault();
      const o = { title: f.title.value.trim(), type: f.type.value, place: f.place.value.trim(), date: f.date.value, endDate: f.endDate.value && f.endDate.value > f.date.value ? f.endDate.value : '', allDay: f.allDay.checked,
        start: f.allDay.checked ? '' : f.start.value, end: f.allDay.checked ? '' : f.end.value, notes: f.notes.value.trim(), remind: [...f.querySelectorAll('[name=rem]:checked')].map(c => Number(c.value)).sort((a, b) => a - b) };
      if (!o.title) return ui.toast('Ieraksti nosaukumu', 'warn');
      if (!o.allDay && !o.start) return ui.toast('Norādi sākuma laiku vai atzīmē “Visu dienu”', 'warn');
      if (!o.allDay && o.end && !o.endDate && o.end <= o.start) return ui.toast('Beigu laikam jābūt vēlākam par sākuma laiku', 'warn');
      const now = U.now();
      if (e.id) {
        const x = list().find(y => y.id === e.id); Object.assign(x, o, { updatedAt: now });
        if (f.applySeries?.checked) for (const y of list()) if (y.seriesId === e.seriesId && y.date > e.date) { const span = o.endDate ? U.daysTo(o.endDate) - U.daysTo(o.date) : 0; Object.assign(y, { title: o.title, type: o.type, place: o.place, allDay: o.allDay, start: o.start, end: o.end, notes: o.notes, remind: o.remind, endDate: span ? addDays(y.date, span) : '', updatedAt: now }); }
      } else {
        const rep = f.repeat?.checked, until = f.until?.value, sid = rep ? U.uid() : '', span = o.endDate ? U.daysTo(o.endDate) - U.daysTo(o.date) : 0;
        let dd = o.date, n = 0;
        do { list().push({ id: U.uid(), ...o, date: dd, endDate: span ? addDays(dd, span) : '', seriesId: sid, createdAt: now, updatedAt: now }); n++; dd = addDays(dd, 7); } while (rep && until && dd <= until && n < 200);
        if (n > 1) ui.toast(`Izveidoti ${n} notikumi (katru nedēļu līdz ${U.fmtDate(until)})`, 'ok');
      }
      d.close(); view().date = o.date; CP.store.changed(); autoSync();
    };
    if (!d.open) d.showModal();
    if (!e.id) f.title.focus();
  }
  A.schDel = how => {
    const e = list().find(x => x.id === cur?.id); if (!e) return;
    const victims = how === 'series' ? list().filter(x => x.seriesId === e.seriesId && x.date >= e.date) : [e];
    if (!confirm(victims.length > 1 ? `Dzēst ${victims.length} notikumus “${e.title}” (no ${U.fmtDate(e.date)})?` : `Dzēst notikumu “${e.title}” ${U.fmtDate(e.date)}?`)) return;
    for (const x of victims) if (x.gcalId) delQ().push(x.gcalId);
    S.db.schedule = list().filter(x => !victims.includes(x)); U.$('schDialog').close(); CP.store.changed(); autoSync();
  };
  A.schDup = () => { const { id, gcalId, gsig, seriesId, createdAt, updatedAt, ...rest } = cur; cur = { ...rest, id: '', date: addDays(rest.date, 7), endDate: rest.endDate ? addDays(rest.endDate, 7) : '' }; dialog(); ui.toast('Kopija nākamajai nedēļai — pārbaudi datumu un saglabā', 'ok', 4000); };
  /* ================== Atgādinājumi ================== */
  const NKEY = 'cp.schNotified';
  const getN = () => { try { return JSON.parse(localStorage.getItem(NKEY) || '{}'); } catch (e) { return {}; } };
  const setN = o => { try { localStorage.setItem(NKEY, JSON.stringify(o)); } catch (e) { } };
  const canDesk = () => 'Notification' in window && Notification.permission === 'granted';
  async function askPermission() {
    if (!('Notification' in window)) return ui.toast('Šis pārlūks neatbalsta paziņojumus uz darbvirsmas', 'warn');
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') { ui.toast('Paziņojumi šim rīkam ir bloķēti. Atļauj tos pārlūka adreses joslā (🔒 → Paziņojumi → Atļaut).', 'warn', 12000); return false; }
    const r = await Notification.requestPermission(); if (CP.state.page === 'schedule') CP.render();
    return r === 'granted';
  }
  A.schPerm = async () => { if (await askPermission()) desk('CADET PERSONĀLS', 'Paziņojumi ieslēgti. Šādi izskatīsies atgādinājumi.', 'perm-test', 'schedule'); };
  async function desk(title, body, tag, page) {
    if (!canDesk()) return false;
    const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { page } };
    try { const reg = CP._swReg || await navigator.serviceWorker?.getRegistration(); if (reg?.showNotification) { await reg.showNotification(title, opts); return true; } } catch (e) { }
    try { const n = new Notification(title, opts); n.onclick = () => { window.focus(); ui.go(page); n.close(); }; return true; } catch (e) { return false; }
  }
  navigator.serviceWorker?.addEventListener('message', e => { if (e.data?.type === 'cp-open' && e.data.page) ui.go(e.data.page); });
  const inTxt = m => m >= 1440 ? `pēc ${Math.round(m / 1440)} d.` : m >= 60 ? `pēc ${Math.round(m / 60)} h` : m > 0 ? `pēc ${m} min` : 'tagad';
  function tick() {
    if (!S.db || !S.root) return;
    const now = Date.now(), seen = getN(); let changed = false;
    for (const e of list()) for (const m of e.remind || []) {
      const at = startAt(e).getTime() - m * 60000, key = `ev|${e.id}|${m}|${e.date}${e.start || ''}`;
      if (seen[key] || now < at || now > startAt(e).getTime() + 5 * 60000) continue;
      seen[key] = now; changed = true;
      const left = Math.round((startAt(e).getTime() - now) / 60000), when = `${U.fmtDate(e.date)} ${e.allDay ? '' : e.start}`.trim();
      if (nt().events !== false) {
        ui.toast(`🔔 ${e.title} — ${inTxt(left)} (${when}${e.place ? ', ' + e.place : ''})`, 'ok', 0, { act: 'schView', arg: e.id, label: 'Atvērt' });
        desk(`🔔 ${e.title}`, `${inTxt(left)} · ${when}${e.allDay ? '' : (e.end ? '–' + e.end : '')}${e.place ? '\n📍 ' + e.place : ''}`, 'ev-' + e.id, 'schedule');
      }
    }
    // brīdinājumi (dokumenti, kavējumi …) — vienu reizi dienā kopsavilkums par jaunajiem
    if (nt().alerts !== false && canDesk() && D.alerts) {
      const day = U.iso(), al = D.alerts().filter(a => a.sev >= 1), fresh = al.filter(a => !seen['al|' + a.msg]);
      if (fresh.length && seen['al-day'] !== day) {
        seen['al-day'] = day; for (const a of fresh) seen['al|' + a.msg] = now; changed = true;
        desk(`Uzdevumi un brīdinājumi: ${fresh.length} jauni`, fresh.slice(0, 3).map(a => '• ' + a.msg).join('\n') + (fresh.length > 3 ? `\n… un vēl ${fresh.length - 3}` : ''), 'alerts', 'alerts');
      }
    }
    if (changed) { for (const k of Object.keys(seen)) if (k.startsWith('ev|') && now - seen[k] > 30 * 864e5) delete seen[k]; setN(seen); }
  }
  setInterval(tick, 30000); setTimeout(tick, 4000);
  CP.schedule = { tick };

  /* ================== .ics fails ================== */
  const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const icsDT = (iso, t) => iso.replace(/-/g, '') + (t ? 'T' + t.replace(':', '') + '00' : '');
  const fold = l => { const out = []; let s = l; while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); } out.push(s); return out.join('\r\n'); };
  function ics(events) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CADET PERSONALS//Grafiks//LV', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Jaunsardze — darba grafiks', 'X-WR-TIMEZONE:Europe/Riga',
      'BEGIN:VTIMEZONE', 'TZID:Europe/Riga', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0300', 'TZNAME:EEST', 'DTSTART:19700329T030000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
      'BEGIN:STANDARD', 'TZOFFSETFROM:+0300', 'TZOFFSETTO:+0200', 'TZNAME:EET', 'DTSTART:19701025T040000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'END:VTIMEZONE'];
    for (const e of events) {
      L.push('BEGIN:VEVENT', `UID:${e.id}@cadet-personals`, `DTSTAMP:${stamp}`, `SEQUENCE:${Math.floor(new Date(e.updatedAt || e.createdAt || Date.now()).getTime() / 1000) % 2147483647}`);
      if (e.allDay) L.push(`DTSTART;VALUE=DATE:${icsDT(e.date)}`, `DTEND;VALUE=DATE:${icsDT(addDays(endDay(e), 1))}`);
      else L.push(`DTSTART;TZID=Europe/Riga:${icsDT(e.date, e.start)}`, `DTEND;TZID=Europe/Riga:${icsDT(endDay(e), e.end || e.start)}`);
      L.push(`SUMMARY:${icsEsc(e.title)}`, `CATEGORIES:${icsEsc(e.type)}`);
      if (e.place) L.push(`LOCATION:${icsEsc(e.place)}`);
      if (e.notes) L.push(`DESCRIPTION:${icsEsc(e.notes)}`);
      for (const m of e.remind || []) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(e.title)}`, `TRIGGER:-PT${m}M`, 'END:VALARM');
      L.push('END:VEVENT');
    }
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }
  A.schIcs = how => {
    const from = how === 'all' ? '' : addDays(U.iso(), -30), ev = sorted(list().filter(e => !from || endDay(e) >= from));
    if (!ev.length) return ui.toast('Nav notikumu, ko eksportēt', 'warn');
    U.download(new Blob([ics(ev)], { type: 'text/calendar;charset=utf-8' }), `Jaunsardze grafiks ${U.iso()}.ics`);
    ui.toast(`Kalendāra fails ar ${ev.length} notikumiem lejupielādēts. Google kalendārā: Iestatījumi → Importēt un eksportēt → Importēt.`, 'ok', 10000);
  };

  /* ================== Google Calendar ================== */
  const API = 'https://www.googleapis.com/calendar/v3';
  const redirectUri = () => CP.google.redirectUri();
  let token = null, syncing = false;
  async function getToken(interactive = true) { token = await CP.google.token(['cal'], interactive); return token; }
  async function api(method, path, body) {
    const r = await fetch(API + path, { method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401) { token = null; CP.google.forget(); throw Object.assign(Error('Google pieteikšanās beigusies — sinhronizē vēlreiz'), { auth: true }); }
    if (!r.ok && r.status !== 404 && r.status !== 410) { let m = r.status + ''; try { m = (await r.json()).error?.message || m; } catch (e) { } throw Error('Google: ' + m); }
    return r.status === 204 ? {} : { status: r.status, ...(await r.json().catch(() => ({}))) };
  }
  const gEvent = e => ({
    summary: e.title, location: e.place || undefined, description: [e.notes, `Veids: ${e.type}`].filter(Boolean).join('\n\n'),
    start: e.allDay ? { date: e.date } : { dateTime: `${e.date}T${e.start}:00`, timeZone: 'Europe/Riga' },
    end: e.allDay ? { date: addDays(endDay(e), 1) } : { dateTime: `${endDay(e)}T${e.end || e.start}:00`, timeZone: 'Europe/Riga' },
    reminders: { useDefault: false, overrides: (e.remind || []).slice(0, 5).map(m => ({ method: 'popup', minutes: m })) },
    colorId: { 'Nodarbība': '2', 'VAM nodarbība': '9', 'Pasākums': '5', 'Nometne': '6', 'Sacensības': '3', 'Sapulce / apmācības': '7', 'Administratīvais darbs': '8', 'Novada pārvaldes darbs': '1', 'Metodiskais darbs': '10', 'Prombūtne': '8' }[e.type] || '10',
    extendedProperties: { private: { cpId: e.id } }
  });
  const sig = e => JSON.stringify(gEvent(e));
  async function sync(interactive = true) {
    if (syncing) return; if (!await getToken(interactive)) return;
    syncing = true; const g = gc(); let up = 0, del = 0;
    const bar = document.getElementById('gcalState'); if (bar) bar.textContent = 'Sinhronizē…';
    try {
      if (g.calendarId) { const c = await api('GET', `/calendars/${encodeURIComponent(g.calendarId)}`); if (c.status === 404 || c.status === 410) { g.calendarId = ''; for (const e of list()) { delete e.gcalId; delete e.gsig; } } }
      if (!g.calendarId) { const c = await api('POST', '/calendars', { summary: 'Jaunsardze — darba grafiks', description: 'Izveidots ar CADET PERSONĀLS', timeZone: 'Europe/Riga' }); g.calendarId = c.id; }
      const cal = `/calendars/${encodeURIComponent(g.calendarId)}/events`;
      for (const id of [...delQ()]) { await api('DELETE', `${cal}/${encodeURIComponent(id)}`); S.db.scheduleDel = delQ().filter(x => x !== id); del++; }
      const from = addDays(U.iso(), -60);
      for (const e of list()) {
        if (endDay(e) < from && e.gcalId) continue;
        const s = sig(e); if (e.gcalId && e.gsig === s) continue;
        let r = e.gcalId ? await api('PUT', `${cal}/${encodeURIComponent(e.gcalId)}`, gEvent(e)) : null;
        if (!r || r.status === 404 || r.status === 410) r = await api('POST', cal, gEvent(e));
        e.gcalId = r.id; e.gsig = s; up++;
      }
      g.lastSync = U.now(); CP.store.changed({ silent: S.page !== 'schedule' });
      ui.toast(up || del ? `Google kalendārs atjaunināts: ${up} notikumi${del ? `, dzēsti ${del}` : ''}` : 'Google kalendārs jau ir aktuāls', 'ok', 5000);
    } catch (err) { console.error(err); ui.toast(err.message, 'err', 10000); if (S.page === 'schedule') CP.render(); }
    finally { syncing = false; }
  }
  const autoSync = U.debounce(() => { if (CP.google.has('cal') && gc().calendarId) sync(false); }, 3000);
  const pendingCal = () => list().filter(e => (!e.gcalId || e.gsig !== sig(e)) && endDay(e) >= addDays(U.iso(), -60)).length + delQ().length;
  CP.google.needs.push(() => S.db && gc().calendarId && gc().clientId && pendingCal() ? { what: 'kalendārs', scope: 'cal' } : null);
  CP.google.onToken(() => { if (CP.google.has('cal')) autoSync(); });
  A.gcalSync = () => sync(true);
  /* Google savienošanas palīgs: soļi ar tiešajām saitēm, kopēšanas pogām un atzīmēm “izdarīts” */
  const HKEY = 'cp.gcalSteps';
  const doneSteps = () => { try { return JSON.parse(localStorage.getItem(HKEY) || '{}'); } catch (e) { return {}; } };
  A.gcalStep = k => { const o = doneSteps(); o[k] = !o[k]; try { localStorage.setItem(HKEY, JSON.stringify(o)); } catch (e) { } const b = document.querySelector('#gcalHelp .dlg-body'), y = b?.scrollTop || 0, v = U.$('gcalHelpId')?.value; A.gcalHelp('='); const b2 = document.querySelector('#gcalHelp .dlg-body'); if (b2) b2.scrollTop = y; if (v != null && U.$('gcalHelpId')) U.$('gcalHelpId').value = v; };
  A.gcalCopy = (v, el) => navigator.clipboard.writeText(v).then(() => { if (el) { const t = el.textContent; el.textContent = '✓ Nokopēts'; setTimeout(() => { el.textContent = t; }, 1500); } }, () => ui.toast(v, 'ok', 10000));
  A.gcalSave = async () => {
    const v = (U.$('gcalHelpId')?.value || '').trim();
    if (!/\.apps\.googleusercontent\.com$/.test(v)) return ui.toast('Ielīmē Client ID — tam jābeidzas ar .apps.googleusercontent.com (Client secret nav vajadzīgs)', 'warn', 8000);
    gc().clientId = v; CP.google.rememberClient(v); CP.store.changed({ silent: true }); U.$('gcalHelp').close();
    if (U.$('gcalHelp').dataset.ctx === 'drive') { CP.encBackup?.clientSaved?.(v); return; }
    CP.render(); sync(true);
  };
  A.gcalHelp = arg => {
    let d = U.$('gcalHelp'); if (!d) { d = document.createElement('dialog'); d.id = 'gcalHelp'; d.className = 'wide'; document.body.appendChild(d); }
    if (arg !== '=') d.dataset.ctx = arg === 'drive' ? 'drive' : '';
    const drv = d.dataset.ctx === 'drive';
    const origin = location.origin, R1 = new URL('PSVS/oauth.html', origin + '/').href, R2 = new URL('PSVS/test/oauth.html', origin + '/').href, own = redirectUri();
    const redirs = [...new Set([R1, R2, own])].filter(u => /oauth\.html$/.test(u) && (u === own || /\/PSVS\//.test(own)));
    const ok = doneSteps(), GC = 'https://console.cloud.google.com';
    const copy = v => `<span class="gh-copy"><code>${esc(v)}</code><button type="button" class="sm" data-act="gcalCopy" data-arg="${esc(v)}">⧉ Kopēt</button></span>`;
    const link = (href, label) => `<a class="btn sm" href="${href}" target="_blank" rel="noopener noreferrer">↗ ${label}</a>`;
    const step = (k, n, title, body) => `<section class="gh-step ${ok[k] ? 'done' : ''}"><div class="gh-num">${ok[k] ? '✓' : n}</div><div class="grow"><h3>${title}</h3>${body}
      <label class="check gh-done"><input type="checkbox" data-act="gcalStep" data-arg="${k}" ${ok[k] ? 'checked' : ''}> Izdarīts</label></div></section>`;
    d.innerHTML = `<header class="dlg-head"><h2>${drv ? 'Google savienošana rezerves kopijai' : 'Google kalendāra savienošana'}</h2><button type="button" class="ghost" data-close="gcalHelp" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body gcal-help">
        <div class="gh-intro"><b>Vienu reizi, apmēram 10 minūtes.</b> Bezmaksas. Vajag tikai Google kontu. Rīks redzēs tikai savu kalendāru “Jaunsardze — darba grafiks” un savas izveidotās rezerves kopijas failus Google Drive, nevis citus tavus kalendārus vai failus.
          <div class="small muted">Viens un tas pats Client ID der gan kalendāram, gan rezerves kopijai. Ja kalendāru jau esi savienojis, vajag tikai <b>2. soli</b> un pēc tam ielīmēt to pašu Client ID.</div>
          <div class="small muted">Katrs solis atver vajadzīgo Google lapu jaunā cilnē. Pēc katra soļa atzīmē “Izdarīts”, lai redzētu, kur esi.</div></div>
        ${step('api', 1, drv ? 'Ieslēdz Google Calendar API (ja lieto arī kalendāru)' : 'Ieslēdz Google Calendar API', `<ol class="gh-list"><li>${link(GC + '/apis/library/calendar-json.googleapis.com', 'Atvērt Google Calendar API')} un piesakies ar savu Google kontu.</li>
          <li>Ja augšā prasa izvēlēties projektu: izvēlies esošo (der arī <i>My First Project</i>) vai izveido jaunu.</li>
          <li>Spied zilo pogu <b>Enable</b>. Ja redzi pogu <b>Manage</b>, API jau ir ieslēgts, un nekas vairāk nav jādara.</li></ol>`)}
        ${step('drive', 2, 'Ieslēdz Google Drive API (rezerves kopijai)', `<ol class="gh-list"><li>${link(GC + '/apis/library/drive.googleapis.com', 'Atvērt Google Drive API')} — tajā pašā projektā kā 1. solī.</li>
          <li>Spied zilo pogu <b>Enable</b>. Ja redzi <b>Manage</b>, tas jau ir ieslēgts.</li>
          <li class="muted">Ja rezerves kopiju Google Drive neizmanto, šo soli var izlaist.</li></ol>`)}
        ${step('start', 3, 'Izveido lietotnes aprakstu (ja vēl nav)', `<ol class="gh-list"><li>${link(GC + '/auth/overview', 'Atvērt Google Auth Platform')}</li>
          <li><b>Ja redzi lapu “OAuth Overview” ar grafikiem, šis solis jau ir izdarīts.</b> Atzīmē “Izdarīts” un ej tālāk.</li>
          <li>Ja redzi pogu <b>Get started</b>, spied to un aizpildi:
            <ul><li><b>App name:</b> piem., <i>CADET grafiks</i></li><li><b>User support email:</b> tavs e-pasts</li><li><b>Audience:</b> <b>External</b></li><li><b>Contact information:</b> tavs e-pasts</li><li>Atzīmē piekrišanu → <b>Create</b></li></ul></li></ol>`)}
        ${step('users', 4, 'Pievieno sevi kā testa lietotāju', `<ol class="gh-list"><li>${link(GC + '/auth/audience', 'Atvērt Audience')}</li>
          <li>Ritini uz leju līdz sadaļai <b>Test users</b> → <b>+ Add users</b>.</li>
          <li>Ieraksti savu <b>Gmail adresi</b>, ar kuru pieteiksies (citi instruktori, kas lietos šo pašu Client ID, jāpievieno arī šeit) → <b>Save</b>.</li></ol>`)}
        ${step('client', 5, 'Izveido Client ID', `<ol class="gh-list"><li>${link(GC + '/auth/clients', 'Atvērt Clients')} → spied <b>+ Create client</b>.</li>
          <li><b>Application type:</b> izvēlies <b>Web application</b>. <b>Name:</b> piem., <i>CADET grafiks</i>.</li>
          <li>Sadaļā <b>Authorized JavaScript origins</b> spied <b>+ Add URI</b> un ielīmē:${copy(origin)}</li>
          <li>Sadaļā <b>Authorized redirect URIs</b> spied <b>+ Add URI</b> ${redirs.length > 1 ? `${redirs.length} reizes un ielīmē katru adresi` : 'un ielīmē'}:${redirs.map(copy).join('')}</li>
          <li>Spied <b>Create</b>. Atvērsies logs <b>“OAuth client created”</b>.</li>
          <li>Pie <b>Client ID</b> (beidzas ar <i>.apps.googleusercontent.com</i>) spied kopēšanas ikonu ⧉.</li></ol>
          <p class="gh-warn">🔒 <b>Client secret nav vajadzīgs.</b> To neievadi rīkā un nevienam nerādi.</p>`)}
        ${step('tool', 6, drv ? 'Ielīmē Client ID rīkā' : 'Ielīmē Client ID rīkā un sinhronizē', `<div class="gh-paste"><input id="gcalHelpId" value="${esc(gc().clientId || '')}" placeholder="xxxxxxxx-xxxx.apps.googleusercontent.com" spellcheck="false"><button type="button" class="mainbtn" data-act="gcalSave">${drv ? '✓ Saglabāt' : '↻ Saglabāt un sinhronizēt'}</button></div>
          <ol class="gh-list"><li>Atvērsies Google logs. Izvēlies kontu, ko pievienoji 4. solī.</li>
          <li>Ja redzi <b>“Google hasn’t verified this app”</b>, spied <b>Continue</b>. Tā ir tava paša lietotne.</li>
          <li>${drv ? 'Atzīmē piekļuvi Google Drive failiem' : 'Atļauj piekļuvi kalendāram'} → <b>Continue</b>. Logs aizvērsies pats${drv ? '' : ', un rīks parādīs “Google kalendārs atjaunināts”'}.</li>
          <li>Ja logs neatveras, pārlūks bloķēja uznirstošo logu. Atļauj to adreses joslas labajā pusē un spied vēlreiz.</li></ol>`)}
        <div class="gh-foot small"><p><b>Telefonā:</b> Google Calendar lietotnē parādīsies kalendārs “Jaunsardze — darba grafiks”. Ja to neredzi, atver izvēlni ☰ un ieslēdz to kalendāru sarakstā.</p>
          <p class="muted">Uz Google tiek sūtīti tikai grafika notikumi: nosaukums, laiks, vieta, piezīmes un veids. Personu dati uz kalendāru netiek sūtīti. Rezerves kopija uz Google Drive tiek sūtīta tikai šifrētā veidā. Josla “Free trial” Google Cloud lapā uz šo neattiecas.</p></div></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="gcalHelp">Aizvērt</button></footer>`;
    if (!d.open) d.showModal();
  };
  A.gcalForget = () => { if (!confirm('Atvienot Google kalendāru? Rīkā notikumi paliek. Google kalendārā tie paliek, kā ir; nākamreiz rīks izveidos jaunu kalendāru.')) return; const g = gc(); g.calendarId = ''; g.lastSync = ''; for (const e of list()) { delete e.gcalId; delete e.gsig; } S.db.scheduleDel = []; CP.store.changed(); };

  function syncTab() {
    const perm = 'Notification' in window ? Notification.permission : 'unsupported', g = gc(), n = nt(), def = st().schDefaultRemind || [60, 1440];
    const pending = list().filter(e => !e.gcalId || e.gsig !== sig(e)).length + delQ().length;
    return `<div class="cards2"><section class="card"><h3>${ic('bell')}Atgādinājumi</h3>
        <div class="row"><div class="grow"><b>Paziņojumi uz darbvirsmas</b><div class="small muted">${perm === 'granted' ? '<span class="okc">✓ atļauti</span>' : perm === 'denied' ? '<span class="red">bloķēti pārlūkā</span> — atļauj adreses joslā: 🔒 → Paziņojumi → Atļaut' : perm === 'unsupported' ? 'pārlūks neatbalsta' : 'vēl nav atļauti'}</div></div>
          ${perm !== 'granted' && perm !== 'unsupported' ? '<button class="sm mainbtn" data-act="schPerm">Atļaut paziņojumus</button>' : perm === 'granted' ? '<button class="sm" data-act="schPerm">Izmēģināt</button>' : ''}</div>
        <label class="check"><input type="checkbox" data-notify="events" ${n.events !== false ? 'checked' : ''}> Grafika notikumu atgādinājumi</label>
        <label class="check"><input type="checkbox" data-notify="alerts" ${n.alerts !== false ? 'checked' : ''}> Jauni brīdinājumi (dokumenti, kavējumi, termiņi) — reizi dienā</label>
        <p class="small" style="margin:10px 0 4px">Noklusējuma atgādinājumi jauniem notikumiem:</p><div class="chips">${REMIND.map(([m, l]) => `<label class="wd ${def.includes(m) ? 'on' : ''}"><input type="checkbox" data-defrem value="${m}" ${def.includes(m) ? 'checked' : ''}>${m ? l : 'sākumā'}</label>`).join('')}</div>
        <p class="small muted">Paziņojumi tiek parādīti, kamēr rīks ir atvērts kādā pārlūka cilnē vai instalēts kā lietotne. Kad dators ir izslēgts, atgādinās Google kalendārs telefonā.</p></section>
      <section class="card"><h3>${ic('calendar')}Google kalendārs</h3>
        <div class="field"><label>Google OAuth Client ID <button class="sm ghost" data-act="gcalHelp" type="button">? Kā iegūt</button></label><input id="gcalClient" value="${esc(g.clientId || '')}" placeholder="xxxxxxxx.apps.googleusercontent.com" spellcheck="false"></div>
        <p class="small" id="gcalState">${g.calendarId ? `Savienots ar kalendāru “Jaunsardze — darba grafiks”. Pēdējā sinhronizācija: ${g.lastSync ? esc(U.fmtDateTime(g.lastSync)) : '—'}. ${pending ? `<span class="warn">Nesinhronizēti: ${pending}</span>` : '<span class="okc">✓ viss aktuāls</span>'}` : '<span class="muted">Vēl nav savienots.</span>'}</p>
        <div class="actions"><button class="mainbtn" data-act="gcalSync" ${g.clientId ? '' : 'disabled'}>↻ Sinhronizēt ar Google</button>${g.calendarId ? '<button class="ghost danger sm" data-act="gcalForget">Atvienot</button>' : ''}</div>
        <p class="small muted">Pēc pirmās sinhronizācijas, kamēr rīks atvērts, izmaiņas tiek nosūtītas automātiski. Uz Google iet tikai notikumi, nevis personu dati.</p>
        <h4 style="margin:14px 0 4px">Bez Google iestatīšanas</h4>
        <div class="actions"><button class="sm" data-act="schIcs">⇩ Kalendāra fails (.ics)</button><button class="sm ghost" data-act="schIcs" data-arg="all">⇩ Visi notikumi</button></div>
        <p class="small muted">.ics failu var importēt Google, Outlook vai telefona kalendārā. Izmaiņas pēc tam automātiski neatjaunojas.</p></section></div>`;
  }

  /* --- Pārskata kartīte --- */
  CP.schedule.dashCard = () => {
    const today = U.iso(), ev = sorted(list().filter(e => endDay(e) >= today && e.date <= addDays(today, 7)));
    return `<section class="card" data-mcol="0"><h3>${ic('calendar')}Grafiks — tuvākās 7 dienas <button class="ghost sm right" data-page="schedule">Viss →</button></h3>
      ${ev.slice(0, 6).map(e => `<div class="row sch-row" style="--c:${color(e.type)}"><span class="sch-bar"></span><div class="sch-when"><b>${e.date <= today ? 'Šodien' : e.date === addDays(today, 1) ? 'Rīt' : esc(WD[wd(e.date)] + ' ' + U.fmtDate(e.date).slice(0, 5))}</b><div class="small">${esc(timeTxt(e))}</div></div><div class="grow"><a href="#" data-act="schView" data-arg="${e.id}"><b>${esc(e.title)}</b></a>${e.place ? `<div class="small muted">📍 ${esc(e.place)}</div>` : ''}</div></div>`).join('') || `<p class="muted small">Tuvākajās dienās nav notikumu. <a href="#" data-act="schNew">＋ Pievienot</a></p>`}</section>`;
  };
  Object.assign(CP.schedule, { ics, sync, gEvent, askPermission, list, delQ, autoSync, TYPES, sorted, timeTxt, render: () => CP.render() });
})(window.CP);


/* ==== js/schedimport.js ==== */
/* =====================================================================
   Grafika imports no instruktoru darba uzskaites Excel (.xlsm / .xlsx).
   Lasa tikai divas lapas (pēc virsrakstiem, nevis pēc pozīcijas):
   • “Darba plāns_secīgi” — Datums no | Laiks no | Datums līdz | Laiks līdz | Mācību grupa | Pasākuma veids |
     Obligātais pasākums | Pasākuma nosaukums | Norises vieta | Vadītājs | Atbalsta personāls | Dalībnieki
   • “Nodarbību saraksts” — grupas līmenis, nosaukums, vieta, adrese, mēnešu kolonnas ar dienām (“16.\n23.”),
     laiks no / līdz, piezīmes. Mācību gads no virsraksta “2026./2027.”
   Slēptās palīglapas un rindas ar “0” tiek izlaistas. Atkārtots imports: katram notikumam ir atslēga
   (ikey) → jauns / mainīts / failā vairs nav / bez izmaiņām. Rīkā izveidotie notikumi netiek aiztikti.
   Fails netiek saglabāts un nekur sūtīts — tiek nolasīti tikai grafika lauki.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, ui = CP.ui, A = CP.actions, esc = U.esc;
  const SC = () => CP.schedule;
  const st = () => S.db.settings;

  /* --- Excel lasīšana (tikai vajadzīgās lapas) --- */
  const xml = raw => { const x = new DOMParser().parseFromString(raw, 'application/xml'); if (x.querySelector('parsererror')) throw Error('Excel XML nav nolasāms'); return x; };
  const tags = (n, t) => [...n.getElementsByTagNameNS('*', t)];
  const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  async function readBook(buf) {
    const z = await U.unzip(buf, n => n === 'xl/sharedStrings.xml' || n === 'xl/workbook.xml' || n === 'xl/_rels/workbook.xml.rels' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n)), dec = new TextDecoder();
    const txt = async n => z.has(n) ? dec.decode(await z.get(n)()) : '';
    if (!z.has('xl/workbook.xml')) throw Error('fails nav Excel darbgrāmata');
    const strings = z.has('xl/sharedStrings.xml') ? tags(xml(await txt('xl/sharedStrings.xml')), 'si').map(si => tags(si, 't').map(t => t.textContent).join('')) : [];
    const rm = {}; for (const r of tags(xml(await txt('xl/_rels/workbook.xml.rels')), 'Relationship')) rm[r.getAttribute('Id')] = r.getAttribute('Target') || '';
    const sheets = tags(xml(await txt('xl/workbook.xml')), 'sheet').map(sh => ({ name: sh.getAttribute('name') || '', hidden: (sh.getAttribute('state') || 'visible') !== 'visible',
      path: 'xl/' + (rm[sh.getAttributeNS(RNS, 'id') || sh.getAttribute('r:id')] || '').replace(/^\/?(xl\/)?/, '') }));
    const rowsOf = async sh => {
      const rows = [];
      for (const row of tags(xml(await txt(sh.path)), 'row')) {
        const rn = Number(row.getAttribute('r')) || rows.length + 1, arr = [];
        for (const c of tags(row, 'c')) {
          const L = (c.getAttribute('r') || 'A').match(/^[A-Z]+/i)?.[0] || 'A'; let i = 0; for (const ch of L.toUpperCase()) i = i * 26 + ch.charCodeAt(0) - 64; i--; if (i < 0 || i > 200) continue;
          let v = tags(c, 'v')[0]?.textContent ?? ''; const t = c.getAttribute('t');
          if (t === 's') v = strings[Number(v)] ?? ''; else if (t === 'inlineStr') v = tags(c, 't').map(e => e.textContent).join('');
          arr[i] = v;
        }
        while (rows.length < rn - 1 && rows.length < 3000) rows.push([]);
        rows.push(Array.from(arr, v => v ?? '')); if (rows.length >= 3000) break;
      }
      return rows;
    };
    return { sheets, rowsOf, has: sh => z.has(sh.path) };
  }

  /* --- Palīgi --- */
  const clean = v => { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); return s === '0' ? '' : s; };
  const norm = s => clean(s).toLocaleLowerCase('lv').replace(/[^\p{L}\p{N}]+/gu, '');
  const isoOf = serial => { const n = Number(serial); if (!(n > 20000 && n < 80000)) return ''; const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 864e5); return d.toISOString().slice(0, 10); };
  const timeOf = v => {
    if (v === '' || v == null) return ''; const s = String(v).trim();
    const m = /^(\d{1,2}):(\d{2})/.exec(s); if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
    const n = Number(s); if (!isFinite(n) || n <= 0) return ''; const mins = Math.round((n - Math.floor(n)) * 1440); if (!mins) return '';
    return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  };
  const findHead = (rows, need) => { for (let r = 0; r < Math.min(rows.length, 30); r++) { const low = (rows[r] || []).map(c => norm(c)); if (need.every(n => low.some(c => c.startsWith(norm(n))))) return r; } return -1; };
  const col = (row, ...names) => { const low = (row || []).map(c => norm(c)); for (const n of names) { const i = low.findIndex(c => c.startsWith(norm(n))); if (i >= 0) return i; } return -1; };
  const MONTHS = ['janvāris', 'februāris', 'marts', 'aprīlis', 'maijs', 'jūnijs', 'jūlijs', 'augusts', 'septembris', 'oktobris', 'novembris', 'decembris'];

  /** Veida noteikšana no tabulas “Pasākuma veids” / grupas līmeņa */
  function typeOf(kind, sub, title) {
    const k = norm(kind) + ' ' + norm(sub) + ' ' + norm(title);
    if (/prombūtn|atvaļinā|slimīb/.test(k)) return 'Prombūtne';
    if (/nometn/.test(k)) return 'Nometne';
    if (/sacens/.test(k)) return 'Sacensības';
    if (/^evam|^vam| vam/.test(k)) return 'VAM nodarbība';
    if (/novadapārvald/.test(k)) return 'Novada pārvaldes darbs';
    if (/metodisk|studij|mentor|noliktav|dokument/.test(k)) return 'Metodiskais darbs';
    if (/seminār|sapulc|apmācīb/.test(k)) return 'Sapulce / apmācības';
    if (/pasākum/.test(k)) return 'Pasākums';
    return 'Cits';
  }

  /* --- Lapa “Darba plāns_secīgi” --- */
  function parsePlan(rows) {
    const h = findHead(rows, ['Datums no', 'Laiks no']); if (h < 0) return null;
    const top = rows[h - 1] || [], H = rows[h];
    const c = { d1: col(H, 'Datums no'), t1: col(H, 'Laiks no'), d2: col(H, 'Datums līdz'), t2: col(H, 'Laiks līdz'),
      grp: col(top, 'Mācību grupa'), kind: col(top, 'Pasākuma veids'), sub: col(top, 'Obligātais'), title: col(top, 'Pasākuma nosaukums'), place: col(top, 'Norises vieta'),
      lead: col(top, 'Nodarbības vai pasākuma vadītājs', 'Vadītājs'), sup: col(top, 'Atbalsta personāls'), js: col(H, 'jaunsargi'), oth: col(H, 'citi') };
    const out = [], skipped = [];
    for (let r = h + 1; r < rows.length; r++) {
      const R = rows[r] || [], g = i => i >= 0 ? R[i] : '';
      const date = isoOf(g(c.d1)); if (!date) { if (clean(g(c.title)) || clean(g(c.kind))) skipped.push({ row: r + 1, why: 'nav datuma', text: clean(g(c.title)) || clean(g(c.kind)) }); continue; }
      const kind = clean(g(c.kind)).replace(/_/g, ' '), sub = clean(g(c.sub)), title = clean(g(c.title)) || sub || kind;
      if (!title) continue;
      const type = typeOf(kind, sub, title), end = isoOf(g(c.d2)), start = timeOf(g(c.t1)), et = timeOf(g(c.t2));
      const grp = clean(g(c.grp)).split('/').map(x => x.trim()).filter(Boolean).slice(1).join(' · ');
      const lead = clean(g(c.lead)), sup = clean(g(c.sup)), js = Number(g(c.js)) || 0, oth = Number(g(c.oth)) || 0;
      const notes = [kind && kind !== title ? kind + (sub && sub !== title ? ' — ' + sub : '') : (sub && sub !== title ? sub : ''), grp && 'Grupa: ' + grp,
        lead && lead !== 'Dalība' ? 'Vada: ' + lead : lead === 'Dalība' ? 'Dalība' : '', sup && 'Atbalsts: ' + sup, js || oth ? `Dalībnieki: ${js ? js + ' jaunsargi' : ''}${js && oth ? ', ' : ''}${oth ? oth + ' citi' : ''}` : ''].filter(Boolean).join('\n');
      const allDay = type === 'Prombūtne' || !start;
      out.push({ src: 'plan', title, type, date, endDate: end && end > date ? end : '', allDay, start: allDay ? '' : start, end: allDay ? '' : (et && (end > date || et > start) ? et : ''), place: clean(g(c.place)), notes, row: r + 1 });
    }
    return { events: out, skipped };
  }

  /* Datumi piezīmē: “13.11.”, “04.11”, “08.,27.OKT”, “8. un 27. oktobrī” → [[mēnesis 0–11, diena]] */
  const MAB = { jan: 0, feb: 1, mar: 2, apr: 3, mai: 4, maij: 4, jūn: 5, jun: 5, jūl: 6, jul: 6, aug: 7, sep: 8, okt: 9, nov: 10, dec: 11 };
  function noteDates(seg) {
    const out = [], t = seg.replace(/LV-\d{4}/gi, '');
    for (const m of t.matchAll(/(?<![\d.])(\d{1,2})\.(\d{1,2})\.?(?![\d])/g)) { const d = +m[1], mo = +m[2]; if (m[1].length === 2 || m[2].length === 2) if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) out.push([mo - 1, d]); }
    for (const m of t.matchAll(/((?:\d{1,2}\.?\s*(?:,|un|un\.)\s*)*\d{1,2})\.?\s*(jan|feb|mar|apr|maij|mai|jūn|jun|jūl|jul|aug|sep|okt|nov|dec)\p{L}*/giu)) {
      const mo = MAB[m[2].toLowerCase()]; for (const d of (m[1].match(/\d{1,2}/g) || []).map(Number)) if (d >= 1 && d <= 31) out.push([mo, d]);
    }
    return out;
  }

  /* --- Lapa “Nodarbību saraksts” --- */
  function parseLessons(rows) {
    const h = findHead(rows, ['Septembris', 'laiks no']); if (h < 0) return null;
    const H = rows[h];
    let y1 = 0; for (let r = 0; r < h; r++) { const m = /(\d{4})\.?\s*\/\s*(\d{4})/.exec((rows[r] || []).join(' ')); if (m) { y1 = Number(m[1]); break; } }
    if (!y1) y1 = Number(String(CP.data.activeYear()).slice(0, 4)) || new Date().getFullYear();
    const months = MONTHS.map((m, i) => ({ i, c: col(H, m) })).filter(x => x.c >= 0);
    const c = { lvl: col(H, 'Mācību grupas līmenis'), name: col(H, 'Mācību grupas nosaukums'), place: col(H, 'Mācību vietas nosaukums'), addr: col(H, 'Mācību vietas, adrese', 'Mācību vietas adrese'),
      t1: col(H, 'laiks no'), t2: col(H, 'laiks līdz'), note: col(H, 'Piezīmes') };
    const out = [], skipped = [];
    for (let r = h + 1; r < rows.length; r++) {
      const R = rows[r] || [], g = i => i >= 0 ? R[i] : '';
      const lvl = clean(g(c.lvl)), name = clean(g(c.name)); if (!lvl && !name) continue;
      const t0 = typeOf(lvl, '', name), type = t0 === 'Cits' ? 'Nodarbība' : t0, start = timeOf(g(c.t1)), end = timeOf(g(c.t2));
      const title = type === 'VAM nodarbība' ? [lvl, name].filter(Boolean).join(' ') : type === 'Metodiskais darbs' ? [lvl, name].filter(Boolean).join(' — ') : `Jaunsardzes nodarbība ${lvl}${name ? ' ' + name : ''}`;
      // atslēga paliek kā 1.23.0 (“Nodarbība 2.4.”), lai atkārtotā importā pārdēvēšana būtu “mainīts”, nevis “dzēsts + jauns”
      const keyTitle = type === 'Nodarbība' ? `Nodarbība ${lvl}${name ? ' ' + name : ''}` : title;
      const place = [clean(g(c.place)), clean(g(c.addr))].filter(Boolean).join(', ');
      const iso = (mi, d) => { const x = `${mi >= 8 ? y1 : y1 + 1}-${String(mi + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; return new Date(x + 'T12:00:00').getMonth() === mi ? x : ''; };
      const dates = new Map();                      // datums → piezīme konkrētajai dienai
      for (const m of months) {
        const cell = String(g(m.c) ?? '').trim(); if (!cell || cell === '0') continue;
        const days = /^\d+(\.\d+)?$/.test(cell) && Number(cell) > 31 ? [] : (cell.match(/\d{1,2}/g) || []).map(Number).filter(d => d >= 1 && d <= 31);
        for (const d of days) { const x = iso(m.i, d); if (x) dates.set(x, ''); }
      }
      // Piezīmes: papildu datumi (kontaktstundas, aizvietošana) un “nenotiek” — pa rindām / “;”
      const general = [], fromCols = dates.size;
      for (const seg of String(g(c.note) ?? '').split(/[;\n]+/).map(x => x.replace(/\s+/g, ' ').trim()).filter(x => x && x !== '0')) {
        const found = noteDates(seg).map(([mi, d]) => iso(mi, d)).filter(Boolean);
        if (!found.length) { general.push(seg); continue; }
        if (/nenotiek|atcel|nebūs|pārcelt/i.test(seg)) { for (const x of found) dates.delete(x); continue; }
        for (const x of found) dates.set(x, [dates.get(x), seg].filter(Boolean).join('; '));
      }
      for (const [d, own] of [...dates].sort()) out.push({ src: 'les', title, type, date: d, endDate: '', allDay: !start, start, end: start && end > start ? end : '', place, notes: [own, ...general].filter(Boolean).join('\n'), row: r + 1, keyTitle, fromNote: !!own && fromCols === 0 });
      const n = dates.size;
      if (!n) skipped.push({ row: r + 1, why: 'nav datumu ne mēnešu kolonnās, ne piezīmēs', text: title });
    }
    return { events: out, skipped, year: `${y1}./${y1 + 1}.` };
  }

  async function parseFile(file) {
    if (/\.xls$/i.test(file.name)) throw Error('vecais .xls formāts netiek atbalstīts — saglabā failu kā .xlsx vai .xlsm');
    const bk = await readBook(await file.arrayBuffer());
    const vis = bk.sheets.filter(s => !s.hidden && bk.has(s));
    const pick = (pref, test) => [...vis.filter(s => norm(s.name) === norm(pref)), ...vis.filter(s => norm(s.name) !== norm(pref))];
    let plan = null, les = null, planSheet = '', lesSheet = '';
    for (const sh of pick('Darba plāns_secīgi')) { if (plan) break; if (/matric/i.test(sh.name)) continue; const p = parsePlan(await bk.rowsOf(sh)); if (p) { plan = p; planSheet = sh.name; } }
    for (const sh of pick('Nodarbību saraksts')) { if (les) break; const p = parseLessons(await bk.rowsOf(sh)); if (p) { les = p; lesSheet = sh.name; } }
    if (!plan && !les) throw Error('failā netika atrastas lapas “Darba plāns_secīgi” vai “Nodarbību saraksts” ar gaidītajiem virsrakstiem');
    // atslēgas: avots + datums + nosaukums (+ kārtas nr., ja vienā dienā vairāki vienādi)
    const all = [...(plan?.events || []), ...(les?.events || [])], seen = {};
    for (const e of all) { const k = `${e.src}|${e.date}|${norm(e.keyTitle || e.title)}`; seen[k] = (seen[k] || 0) + 1; e.ikey = seen[k] > 1 ? `${k}#${seen[k]}` : k; }
    return { name: file.name, events: all, skipped: [...(plan?.skipped || []), ...(les?.skipped || [])], planSheet, lesSheet, year: les?.year || '' };
  }

  /* --- Salīdzināšana ar esošo grafiku --- */
  const FIELDS = ['title', 'type', 'date', 'endDate', 'allDay', 'start', 'end', 'place', 'notes'];
  const FL = { title: 'nosaukums', type: 'veids', date: 'datums', endDate: 'beigu datums', allDay: 'visu dienu', start: 'sākums', end: 'beigas', place: 'vieta', notes: 'piezīmes' };
  function diff(parsed, opt) {
    const today = U.iso(), keep = e => (opt.past || (e.endDate || e.date) >= today) && (opt.absent || e.type !== 'Prombūtne') && (opt[e.src] !== false);
    const wanted = parsed.events.filter(keep), pastN = parsed.events.filter(e => !opt.past && (e.endDate || e.date) < today).length;
    const cur = new Map(SC().list().filter(e => e.ikey).map(e => [e.ikey, e]));
    const add = [], chg = [], same = [], del = [];
    for (const e of wanted) {
      const x = cur.get(e.ikey);
      if (!x) add.push({ e, on: true });
      else { const ch = FIELDS.filter(f => String(x[f] ?? '') !== String(e[f] ?? '')); if (ch.length) chg.push({ e, x, ch, edited: x.updatedAt && x.importedAt && x.updatedAt > x.importedAt, on: true }); else same.push(e); }
    }
    const keys = new Set(parsed.events.map(e => e.ikey));
    const srcIn = new Set([parsed.planSheet && 'plan', parsed.lesSheet && 'les'].filter(Boolean));
    for (const x of cur.values()) {
      const s = x.ikey.split('|')[0]; if (!srcIn.has(s)) continue;
      if ((x.endDate || x.date) < today && !opt.past) continue;          // pagātni neaiztiek
      if (!keys.has(x.ikey)) del.push({ x, edited: x.updatedAt && x.importedAt && x.updatedAt > x.importedAt, on: true });
    }
    return { add, chg, same, del, pastN };
  }

  /* --- Dialogs --- */
  let P = null, OPT = { past: false, absent: true, plan: true, les: true }, D = null;
  async function open(file) {
    if (!S.root) return CP.needRoot?.();
    try { ui.toast('Nolasa failu…', 'ok', 1500); P = await parseFile(file); }
    catch (e) { console.error(e); return ui.toast('Neizdevās nolasīt failu: ' + e.message, 'err', 10000); }
    draw();
  }
  const when = e => `${U.fmtDate(e.date)}${e.endDate ? '–' + U.fmtDate(e.endDate) : ''} ${SC().timeTxt(e).replace(/^visu dienu.*/, 'visu dienu')}`;
  function draw() {
    D = diff(P, OPT);
    let d = U.$('schImpDialog'); if (!d) { d = document.createElement('dialog'); d.id = 'schImpDialog'; d.className = 'wide'; document.body.appendChild(d); }
    const n = D.add.filter(x => x.on).length + D.chg.filter(x => x.on).length + D.del.filter(x => x.on).length;
    const row = (k, i, it, body) => `<label class="imp-row ${k}"><input type="checkbox" data-imp="${k}|${i}" ${it.on ? 'checked' : ''}><span class="nowrap imp-when">${esc(when(it.e || it.x))}</span><span class="grow">${body}</span></label>`;
    const tag = e => `<span class="tag" style="--c:${(SC().TYPES.find(t => t[0] === e.type) || [])[1]}">${esc(e.type)}</span>`;
    const sec = (title, cls, arr, render, note = '') => arr.length ? `<details class="imp-sec" ${cls !== 'same' ? 'open' : ''}><summary><b class="${cls}">${title} (${arr.length})</b>${note}</summary>${arr.map(render).join('')}</details>` : '';
    d.innerHTML = `<header class="dlg-head"><h2>Darba grafika imports — ${esc(P.name)}</h2><button type="button" class="ghost" data-close="schImpDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body">
        <p class="small muted" style="margin-top:0">Nolasītas lapas: ${[P.planSheet && `<b>${esc(P.planSheet)}</b>`, P.lesSheet && `<b>${esc(P.lesSheet)}</b>${P.year ? ` (${esc(P.year)} m. g.)` : ''}`].filter(Boolean).join(' un ')}. Failā atrasti ${P.events.length} notikumi. Rīkā paša izveidotie notikumi netiek mainīti.</p>
        <div class="imp-opts">
          ${P.planSheet ? `<label class="check"><input type="checkbox" data-impopt="plan" ${OPT.plan ? 'checked' : ''}> Darba plāns (pasākumi, semināri, metodiskais darbs)</label>` : ''}
          ${P.lesSheet ? `<label class="check"><input type="checkbox" data-impopt="les" ${OPT.les ? 'checked' : ''}> Nodarbību saraksts (regulārās nodarbības)</label>` : ''}
          <label class="check"><input type="checkbox" data-impopt="absent" ${OPT.absent ? 'checked' : ''}> Prombūtne (atvaļinājumi)</label>
          <label class="check"><input type="checkbox" data-impopt="past" ${OPT.past ? 'checked' : ''}> Arī pagājušie notikumi${D.pastN && !OPT.past ? ` <span class="muted">(${D.pastN} netiek importēti)</span>` : ''}</label></div>
        <div class="imp-sum"><span class="pill ok">＋ ${D.add.length} jauni</span><span class="pill warn">✎ ${D.chg.length} mainīti</span><span class="pill bad">✕ ${D.del.length} failā vairs nav</span><span class="pill">= ${D.same.length} bez izmaiņām</span></div>
        ${sec('Jauni', 'okc', D.add, (it, i) => row('add', i, it, `<b>${esc(it.e.title)}</b> ${tag(it.e)}${it.e.place ? ` <small class="muted">· ${esc(it.e.place)}</small>` : ''}`))}
        ${sec('Mainīti', 'warn', D.chg, (it, i) => row('chg', i, it, `<b>${esc(it.e.title)}</b> ${tag(it.e)} <small>${it.ch.map(f => `${FL[f]}: <s class="muted">${esc(String(it.x[f] ?? '') || '—').slice(0, 40)}</s> → ${esc(String(it.e[f] ?? '') || '—').slice(0, 40)}`).join('; ')}</small>${it.edited ? ' <span class="warn small">⚠ labots rīkā — tiks pārrakstīts</span>' : ''}`))}
        ${sec('Failā vairs nav — tiks noņemti no grafika', 'red', D.del, (it, i) => row('del', i, it, `<b>${esc(it.x.title)}</b> ${tag(it.x)}${it.edited ? ' <span class="warn small">⚠ labots rīkā</span>' : ''}`), ' <small class="muted">(piem., pārcelts uz citu datumu vai izdzēsts tabulā)</small>')}
        ${sec('Bez izmaiņām', 'same', D.same, e => `<div class="imp-row same"><span></span><span class="nowrap imp-when">${esc(when(e))}</span><span class="grow muted">${esc(e.title)}</span></div>`)}
        ${P.skipped.length ? `<details class="imp-sec"><summary><span class="muted">Izlaistas rindas (${P.skipped.length})</span></summary>${P.skipped.map(s => `<div class="small muted">rinda ${s.row}: ${esc(s.text)} — ${esc(s.why)}</div>`).join('')}</details>` : ''}
        ${!n ? `<p class="okc">✓ Grafiks jau atbilst failam — nekas nav jāmaina.</p>` : ''}
      </div>
      <footer class="dlg-foot"><span class="small muted">Pēc importa izmaiņas aiziet arī uz Google kalendāru, ja tas ir savienots.</span><span class="grow"></span><button type="button" data-close="schImpDialog">Atcelt</button><button class="mainbtn" data-act="schImpGo" ${n ? '' : 'disabled'}>Importēt (${n})</button></footer>`;
    if (!d.open) d.showModal();
  }
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset?.impopt) { OPT[t.dataset.impopt] = t.checked; draw(); }
    else if (t.dataset?.imp) { const [k, i] = t.dataset.imp.split('|'); D[k][Number(i)].on = t.checked; const n = ['add', 'chg', 'del'].reduce((a, k2) => a + D[k2].filter(x => x.on).length, 0); const b = document.querySelector('[data-act=schImpGo]'); if (b) { b.textContent = `Importēt (${n})`; b.disabled = !n; } }
  });
  A.schImpGo = () => {
    const now = U.now(), L = SC().list(), def = st().schDefaultRemind || [60, 1440]; let a = 0, c = 0, r = 0;
    const pick = e => Object.fromEntries(FIELDS.map(f => [f, e[f]]));
    for (const it of D.add) if (it.on) { L.push({ id: U.uid(), ...pick(it.e), remind: it.e.type === 'Prombūtne' ? [] : [...def], ikey: it.e.ikey, importedAt: now, createdAt: now, updatedAt: now }); a++; }
    for (const it of D.chg) if (it.on) { Object.assign(it.x, pick(it.e), { importedAt: now, updatedAt: now }); c++; }
    const gone = new Set(D.del.filter(x => x.on).map(x => x.x));
    for (const x of gone) if (x.gcalId) SC().delQ().push(x.gcalId);
    if (gone.size) { S.db.schedule = L.filter(x => !gone.has(x)); r = gone.size; }
    st().schImport = { name: P.name, at: now, n: SC().list().filter(e => e.ikey).length };
    U.$('schImpDialog').close();
    CP.store.changed(); SC().autoSync();
    ui.toast(`Grafiks atjaunināts no Excel: ${a} jauni, ${c} mainīti, ${r} noņemti`, 'ok', 7000);
  };

  /* --- Faila izvēle un ievilkšana --- */
  /* Imports: uznirstošais logs ar ievilkšanas laukumu */
  const take = f => { if (!isXl(f)) return ui.toast('Ievelc Excel failu (.xlsm vai .xlsx) ar darba plānošanas matricu', 'warn', 6000); U.$('schImpPick')?.close(); open(f); };
  A.schImport = () => {
    if (!S.root) return CP.needRoot?.();
    let d = U.$('schImpPick'); if (!d) { d = document.createElement('dialog'); d.id = 'schImpPick'; document.body.appendChild(d); }
    const imp = st().schImport;
    d.innerHTML = `<header class="dlg-head"><h2>Importēt darba grafiku</h2><button type="button" class="ghost" data-close="schImpPick" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body">
        <p style="margin-top:0">Šeit var importēt <b>darba plānošanas matricu</b>, t. i., instruktora darba uzskaites Excel failu (<b>.xlsm</b> vai .xlsx). Rīks pats saliks kalendāru no lapām <b>“Darba plāns_secīgi”</b> un <b>“Nodarbību saraksts”</b>.</p>
        <div class="imp-drop" data-impdrop tabindex="0" role="button" data-act="schImpPickFile" aria-label="Ievilkt vai izvēlēties failu">
          <div class="imp-drop-ic">⬆</div><b>Ievelc failu šeit</b><span class="muted small">vai</span><span class="btn mainbtn sm">Izvēlēties failu…</span>
          <span class="muted small">.xlsm vai .xlsx</span></div>
        <ul class="small imp-hints">
          <li>Pirms izmaiņām parādīsies saraksts: <b>jauni</b>, <b>mainīti</b> un <b>failā vairs nav</b>. Katru izmaiņu vari atķeksēt.</li>
          <li>Atjaunotu failu var ievilkt atkārtoti. Notikumi tiks papildināti un pārrakstīti, bet ne dubultoti.</li>
          <li>Pašā rīkā izveidotie notikumi netiek aiztikti. Fails netiek saglabāts un nekur sūtīts.</li></ul>
        ${imp ? `<p class="small muted">Pēdējais imports: <b>${esc(imp.name)}</b> · ${esc(U.fmtDateTime(imp.at))} · ${imp.n} notikumi.</p>` : ''}</div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="schImpPick">Aizvērt</button></footer>`;
    d.showModal();
  };
  A.schImpPickFile = () => {
    let inp = U.$('schImpFile'); if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.id = 'schImpFile'; inp.accept = '.xlsx,.xlsm,application/vnd.ms-excel.sheet.macroEnabled.12,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; inp.hidden = true; document.body.appendChild(inp); inp.onchange = () => { const f = inp.files[0]; inp.value = ''; if (f) take(f); }; }
    inp.click();
  };
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-impdrop]')) { e.preventDefault(); A.schImpPickFile(); } });
  const isXl = f => /\.(xlsx|xlsm)$/i.test(f?.name || '');
  const zone = e => { if (!S.root) return null; const pick = e.target.closest?.('#schImpPick'); if (pick) return pick.querySelector('[data-impdrop]'); return S.page === 'schedule' && !U.qs('dialog[open]') ? e.target.closest?.('.page') : null; };
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  document.addEventListener('dragover', e => { if (!hasFiles(e) || !zone(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; zone(e).classList.add('sch-over'); });
  document.addEventListener('dragleave', e => { if (!e.relatedTarget || !e.relatedTarget.closest?.('.page,[data-impdrop]')) document.querySelectorAll('.sch-over').forEach(x => x.classList.remove('sch-over')); });
  document.addEventListener('drop', e => {
    if (!hasFiles(e) || !zone(e)) return; e.preventDefault(); document.querySelectorAll('.sch-over').forEach(x => x.classList.remove('sch-over'));
    const f = [...e.dataTransfer.files].find(isXl); take(f || e.dataTransfer.files[0]);
  });
  CP.schedImport = { parseFile, diff, open };
})(window.CP);


/* ==== js/feedback.js ==== */
/* =====================================================================
   Ziņot — kļūdas, ieteikumi, atsauksmes izstrādātājam.
   • Ziņojums (tēma, virsraksts, apraksts, ekrānuzņēmumi, kontakts, tehniskā informācija) tiek nosūtīts
     uz izstrādātāja Google Apps Script tīmekļa lietotni → Google tabula + attēli Drive mapē + e-pasts.
   • Ekrānuzņēmumus pirms sūtīšanas var aizklāt (melni taisnstūri). Aizklātais tiek “iededzināts” attēlā —
     oriģināls netiek sūtīts.
   • Uzņemt ekrānu: pārlūka ekrāna kopīgošana (getDisplayMedia) → peldoša josla, lai pārietu uz vajadzīgo vietu rīkā.
   • Ja sūtīšana nav iestatīta vai nav interneta: ziņojumu var saglabāt failā (HTML ar attēliem) un nodot citādi.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, ui = CP.ui, A = CP.actions, esc = U.esc;
  const ic = (n, f = '') => CP.ic(n, f);
  const DKEY = 'cp.fbDraft', HKEY = 'cp.fbSent', CKEY = 'cp.fbContact';
  const MAXIMG = 5, MAXW = 1600;
  const TYPES = [['bug', '🐞', 'Kļūda'], ['idea', '💡', 'Ieteikums'], ['review', '💬', 'Atsauksme'], ['question', '❓', 'Jautājums']];
  const PH = {
    bug: 'Kas notika? Ko tieši darīji pirms tam (soļi)? Ko gaidīji, ka notiks?',
    idea: 'Ko vajadzētu uzlabot vai pievienot? Kā tas palīdzētu darbā?',
    review: 'Kas patīk, kas traucē, kā rīks noder ikdienā?',
    question: 'Ko gribi uzzināt?'
  };
  const sendUrl = () => { try { return localStorage.getItem('cp.fbUrl') || CP.FEEDBACK_URL || ''; } catch (e) { return CP.FEEDBACK_URL || ''; } };
  const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

  /* --- Pēdējās kļūdas (tehniskajai informācijai) --- */
  const ERRS = [];
  const pushErr = m => { m = String(m || '').slice(0, 300); if (!m) return; ERRS.push(`${new Date().toTimeString().slice(0, 8)} ${m}`); if (ERRS.length > 10) ERRS.shift(); };
  window.addEventListener('error', e => pushErr(e.message + (e.filename ? ` (${String(e.filename).split('/').pop()}:${e.lineno})` : '')));
  window.addEventListener('unhandledrejection', e => pushErr('Promise: ' + (e.reason?.message || e.reason)));

  /* --- Melnraksts --- */
  const blank = () => ({ type: 'bug', title: '', text: '', name: '', contact: '', tech: true, page: '' });
  let F = Object.assign(blank(), lsGet(DKEY, {}), lsGet(CKEY, {}));
  let shots = [];          // { id, src (dataURL), w, h, boxes: [{x,y,w,h} 0..1] }
  let sending = false;
  const saveDraft = U.debounce(() => { lsSet(DKEY, { type: F.type, title: F.title, text: F.text, tech: F.tech }); lsSet(CKEY, { name: F.name, contact: F.contact }); }, 400);

  function tech() {
    return {
      version: CP.VERSION, channel: CP.CHANNEL, page: F.page || S.page,
      browser: navigator.userAgent, lang: navigator.language,
      screen: `${screen.width}×${screen.height}, logs ${innerWidth}×${innerHeight}, mērogs ${devicePixelRatio}`,
      theme: document.documentElement.dataset.theme || '', dataFolder: S.root ? 'pieslēgta' : 'nav',
      online: navigator.onLine, errors: ERRS.slice()
    };
  }
  const placeLabel = p => ({ dashboard: 'Pārskats', people: 'Personas', person: 'Personas kartīte', comms: 'Saziņa', schedule: 'Grafiks', attendance: 'Apmeklējums', forms: 'Veidlapas', formEdit: 'Veidlapa', documents: 'Dokumenti', equipment: 'Ekipējums', alerts: 'Uzdevumi', archive: 'Arhīvs', about: 'Par rīku', settings: 'Iestatījumi' }[p] || p || '—');

  /* --- Lapa --- */
  CP.pages.feedback = {
    render() {
      const url = sendUrl(), hist = lsGet(HKEY, []);
      const t = tech();
      return `<div class="page narrow fb">${ui.backBtn()}
        <section class="card fb-card" id="fbForm"><h3>${ic('flag', '⚑')}Ziņot izstrādātājam</h3>
          <p class="small muted" style="margin-top:0">Pamanīji kļūdu, ir ideja vai vienkārši gribi pateikt, kā rīks noder? Uzraksti — ziņojums nonāks pie rīka izstrādātāja. Ja gribi atbildi, norādi savu kontaktu.</p>
          <div class="field"><label>Tēma</label><div class="fb-types">${TYPES.map(([k, e, l]) => `<label class="fb-type ${F.type === k ? 'on' : ''}"><input type="radio" name="fbType" value="${k}" ${F.type === k ? 'checked' : ''}><span class="fb-emo">${e}</span>${l}</label>`).join('')}</div></div>
          <div class="field"><label for="fbTitle">Īsi — par ko ir ziņojums</label><input id="fbTitle" maxlength="140" value="${esc(F.title)}" placeholder="${F.type === 'bug' ? 'piem., Neatveras veidlapa “Instruktāža”' : 'piem., Grafikā pievienot krāsu katrai grupai'}"></div>
          <div class="field"><label for="fbText">Apraksts</label><textarea id="fbText" rows="7" placeholder="${esc(PH[F.type])}">${esc(F.text)}</textarea></div>
          <div class="field"><label>Ekrānuzņēmumi <span class="muted small">(nav obligāti, līdz ${MAXIMG})</span></label>
            <div class="fb-drop" id="fbDrop" tabindex="0"><span class="fb-drop-ic">🖼</span><b>Ievelc attēlu šeit vai ielīmē ar Ctrl+V</b>
              <span class="small muted">Windows: Win+Shift+S izgriež ekrāna daļu, pēc tam šeit Ctrl+V</span>
              <div class="actions" style="justify-content:center;margin-top:6px"><button type="button" class="sm" data-act="fbCapture">📷 Uzņemt rīka ekrānu</button><button type="button" class="sm ghost" data-act="fbPick">Izvēlēties failu…</button></div></div>
            <div class="fb-shots" id="fbShots">${shotsHtml()}</div>
            <p class="fb-warn small">🔒 <b>Pirms sūtīšanas aizklāj jaunsargu datus</b> — vārdus, personas kodus, tālruņus, adreses. Spied <b>✎ Aizklāt</b> pie attēla un ar peli pārvelc pāri melnu taisnstūri.</p></div>
          <div class="fieldgrid"><div class="field"><label for="fbName">Tavs vārds <span class="muted small">(nav obligāti)</span></label><input id="fbName" value="${esc(F.name)}" autocomplete="name"></div>
            <div class="field"><label for="fbContact">E-pasts vai tālrunis atbildei <span class="muted small">(nav obligāti)</span></label><input id="fbContact" value="${esc(F.contact)}" autocomplete="email"></div></div>
          <label class="check"><input type="checkbox" id="fbTech" ${F.tech ? 'checked' : ''}> Pievienot tehnisko informāciju (versija, pārlūks, lapa, pēdējās kļūdas)</label>
          <details class="fb-tech small"><summary>Ko tieši pievieno?</summary><pre>${esc(techText(t))}</pre><p class="muted">Personu dati te netiek iekļauti.</p></details>
          <div class="actions" style="margin-top:12px">
            <button class="mainbtn" data-act="fbSend" ${sending ? 'disabled' : ''}>${sending ? '<span class="spin"></span> Sūta…' : '➤ Nosūtīt'}</button>
            <button class="ghost" data-act="fbSaveFile" title="Saglabā ziņojumu ar attēliem vienā failā, ko var nosūtīt citā veidā">⇩ Saglabāt failā</button>
            <span class="grow"></span><button class="ghost sm" data-act="fbClear">Notīrīt</button></div>
          ${url ? '' : '<p class="small warn">Sūtīšana šajā versijā vēl nav ieslēgta. Ziņojumu var saglabāt failā un nosūtīt izstrādātājam citā veidā.</p>'}
        </section>
        ${hist.length ? `<section class="card"><h3>${ic('clock', '◷')}Mani nosūtītie ziņojumi <span class="muted small">(šajā datorā)</span></h3>
          ${hist.slice(0, 15).map(h => `<div class="row"><span class="fb-emo">${(TYPES.find(x => x[0] === h.type) || TYPES[0])[1]}</span><div class="grow"><b>${esc(h.title || '(bez virsraksta)')}</b><div class="small muted">${esc(U.fmtDateTime(h.at))}${h.shots ? ` · ${h.shots} attēli` : ''}</div></div><span class="small ${h.ok ? 'okc' : 'muted'}">${h.ok ? '✓ nosūtīts' : 'saglabāts failā'}</span></div>`).join('')}</section>` : ''}
      </div>`;
    }
  };
  const techText = t => [`Versija: ${t.version} (${t.channel})`, `Lapa: ${placeLabel(t.page)}`, `Pārlūks: ${t.browser}`, `Ekrāns: ${t.screen}`, `Datu mape: ${t.dataFolder}`, `Kļūdas: ${t.errors.length ? '\n  ' + t.errors.join('\n  ') : 'nav'}`].join('\n');
  function shotsHtml() {
    return shots.map((s, i) => `<figure class="fb-shot"><img src="${s.src}" alt="Ekrānuzņēmums ${i + 1}">${s.boxes.map(b => `<i class="fb-box" style="left:${b.x * 100}%;top:${b.y * 100}%;width:${b.w * 100}%;height:${b.h * 100}%"></i>`).join('')}
      <figcaption><span class="small ${s.boxes.length ? 'okc' : 'muted'}">${s.boxes.length ? `✓ aizklāti ${s.boxes.length}` : 'nav aizklāts'}</span><span class="grow"></span><button type="button" class="sm" data-act="fbMask" data-arg="${s.id}">✎ Aizklāt</button><button type="button" class="sm ghost" data-act="fbDel" data-arg="${s.id}" aria-label="Noņemt">✕</button></figcaption></figure>`).join('');
  }
  const paintShots = () => { const el = U.$('fbShots'); if (el) el.innerHTML = shotsHtml(); };

  /* --- Ievade --- */
  document.addEventListener('input', e => {
    const t = e.target; if (!t.closest?.('#fbForm')) return;
    if (t.id === 'fbTitle') F.title = t.value; else if (t.id === 'fbText') F.text = t.value; else if (t.id === 'fbName') F.name = t.value; else if (t.id === 'fbContact') F.contact = t.value; else return;
    saveDraft();
  });
  document.addEventListener('change', e => {
    const t = e.target; if (!t.closest?.('#fbForm')) return;
    if (t.name === 'fbType') { F.type = t.value; document.querySelectorAll('.fb-type').forEach(l => l.classList.toggle('on', l.querySelector('input').checked)); const x = U.$('fbText'); if (x) x.placeholder = PH[F.type]; saveDraft(); }
    if (t.id === 'fbTech') { F.tech = t.checked; saveDraft(); }
  });
  // attēli: ievilkt / ielīmēt
  document.addEventListener('dragover', e => { const d = e.target.closest?.('#fbDrop'); if (d) { e.preventDefault(); d.classList.add('over'); } });
  document.addEventListener('dragleave', e => { const d = e.target.closest?.('#fbDrop'); if (d) d.classList.remove('over'); });
  document.addEventListener('drop', e => { const d = e.target.closest?.('#fbDrop'); if (!d) return; e.preventDefault(); e.stopPropagation(); d.classList.remove('over'); addFiles(e.dataTransfer.files); }, true);
  document.addEventListener('paste', e => {
    if (S.page !== 'feedback' || !U.$('fbForm')) return;
    const imgs = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
    if (!imgs.length) return;
    e.preventDefault(); addFiles(imgs);
  });
  A.fbPick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true; i.onchange = () => addFiles(i.files); i.click(); };
  async function addFiles(list) {
    for (const f of [...list || []]) {
      if (!f.type.startsWith('image/')) { ui.toast(`“${f.name}” nav attēls`, 'warn'); continue; }
      await addImage(await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); }));
    }
  }
  async function addImage(src) {
    if (shots.length >= MAXIMG) return ui.toast(`Var pievienot ne vairāk kā ${MAXIMG} attēlus`, 'warn');
    const img = await loadImg(src);
    // samazina lielus attēlus jau uzreiz (mazāk atmiņas, ātrāka sūtīšana)
    const k = Math.min(1, MAXW / img.naturalWidth), w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
    const s = { id: U.uid(), src: c.toDataURL('image/png'), w, h, boxes: [] };
    shots.push(s); paintShots();
    return s;
  }
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(Error('attēlu neizdevās nolasīt')); i.src = src; });
  A.fbDel = id => { shots = shots.filter(s => s.id !== id); paintShots(); };

  /* --- Ekrāna uzņemšana: kopīgo šo cilni, pāriet uz vajadzīgo vietu, “Uzņemt” --- */
  let cap = null;
  A.fbCapture = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) return ui.toast('Šis pārlūks neatbalsta ekrāna uzņemšanu. Lieto Win+Shift+S un ielīmē ar Ctrl+V.', 'warn', 9000);
    if (shots.length >= MAXIMG) return ui.toast(`Var pievienot ne vairāk kā ${MAXIMG} attēlus`, 'warn');
    let stream;
    try { stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude' }); }
    catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') ui.toast('Ekrānu neizdevās uzņemt: ' + e.message, 'err'); return; }
    const v = document.createElement('video'); v.muted = true; v.srcObject = stream; await v.play().catch(() => { });
    cap = { stream, v };
    stream.getVideoTracks()[0].addEventListener('ended', () => endCapture());
    // atpakaļ uz lapu, kur bija problēma; peldoša josla ļauj pāriet uz jebkuru vietu
    const back = F.page && F.page !== 'feedback' ? F.page : 'dashboard';
    ui.go(back);
    const bar = document.createElement('div'); bar.id = 'fbCapBar'; bar.className = 'fb-capbar';
    bar.innerHTML = `<span>📷 Atver vietu, ko gribi parādīt, tad spied</span><button type="button" id="fbCapNow">Uzņemt</button><button type="button" id="fbCap5" title="Noder, ja jāatver logs vai izvēlne">Pēc 5 s</button><button type="button" id="fbCapX" class="x">Atcelt</button>`;
    document.body.appendChild(bar);
    bar.querySelector('#fbCapNow').onclick = () => grab();
    bar.querySelector('#fbCap5').onclick = e => { let n = 5; const b = e.currentTarget; b.disabled = true; const t = setInterval(() => { n--; b.textContent = n + ' s…'; if (n <= 0) { clearInterval(t); grab(); } }, 1000); b.textContent = '5 s…'; };
    bar.querySelector('#fbCapX').onclick = () => { endCapture(); ui.go('feedback'); };
  };
  async function grab() {
    if (!cap) return;
    const bar = U.$('fbCapBar'); if (bar) bar.style.visibility = 'hidden';
    await new Promise(r => setTimeout(r, 350));   // lai josla nepaliek attēlā
    const { v } = cap, c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    endCapture();
    if (!c.width) { ui.go('feedback'); return ui.toast('Attēlu neizdevās uzņemt. Mēģini ar Win+Shift+S un Ctrl+V.', 'warn', 8000); }
    const s = await addImage(c.toDataURL('image/png'));
    ui.go('feedback');
    if (s) setTimeout(() => A.fbMask(s.id), 200);   // uzreiz piedāvā aizklāt
  }
  function endCapture() { if (!cap) return; cap.stream.getTracks().forEach(t => t.stop()); cap = null; U.$('fbCapBar')?.remove(); }

  /* --- Aizklāšana: melni taisnstūri, ko pārvelk ar peli --- */
  A.fbMask = id => {
    const s = shots.find(x => x.id === id); if (!s) return;
    let d = U.$('fbMaskDlg'); if (!d) { d = document.createElement('dialog'); d.id = 'fbMaskDlg'; d.className = 'wide fb-maskdlg'; document.body.appendChild(d); }
    const boxes = s.boxes.map(b => ({ ...b }));
    d.innerHTML = `<header class="dlg-head"><h2>Aizklāt personu datus</h2><button type="button" class="ghost" data-close="fbMaskDlg" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><p class="small muted" style="margin-top:0">Ar peli pārvelc pāri vārdiem, personas kodiem, tālruņiem u.c. — tie kļūs melni. Nosūtīts tiks tikai aizklātais attēls.</p>
        <div class="fb-maskwrap"><canvas id="fbMaskCv"></canvas></div></div>
      <footer class="dlg-foot"><button type="button" id="fbMaskUndo">↶ Atsaukt</button><button type="button" class="ghost" id="fbMaskClear">Notīrīt visu</button><span class="grow"></span><button type="button" data-close="fbMaskDlg">Atcelt</button><button type="button" class="mainbtn" id="fbMaskOk">✓ Gatavs</button></footer>`;
    if (!d.open) d.showModal();
    const cv = U.$('fbMaskCv'), ctx = cv.getContext('2d');
    loadImg(s.src).then(img => {
      cv.width = s.w; cv.height = s.h;
      const draw = (tmp) => { ctx.drawImage(img, 0, 0, s.w, s.h); ctx.fillStyle = '#000'; for (const b of boxes) ctx.fillRect(b.x * s.w, b.y * s.h, b.w * s.w, b.h * s.h); if (tmp) { ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(tmp.x * s.w, tmp.y * s.h, tmp.w * s.w, tmp.h * s.h); ctx.strokeStyle = '#f0a35e'; ctx.lineWidth = Math.max(2, s.w / 500); ctx.strokeRect(tmp.x * s.w, tmp.y * s.h, tmp.w * s.w, tmp.h * s.h); } };
      draw();
      const pos = e => { const r = cv.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
      let st = null;
      const rect = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
      cv.onpointerdown = e => { st = pos(e); cv.setPointerCapture(e.pointerId); };
      cv.onpointermove = e => { if (st) draw(rect(st, pos(e))); };
      cv.onpointerup = e => { if (!st) return; const r = rect(st, pos(e)); st = null; if (r.w * s.w > 3 && r.h * s.h > 3) boxes.push(r); draw(); };
      U.$('fbMaskUndo').onclick = () => { boxes.pop(); draw(); };
      U.$('fbMaskClear').onclick = () => { boxes.length = 0; draw(); };
      U.$('fbMaskOk').onclick = () => { s.boxes = boxes; d.close(); paintShots(); };
    });
  };
  /** Gala attēls: aizklātais iededzināts, JPEG */
  async function finalImage(s) {
    const img = await loadImg(s.src), c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, s.w, s.h); x.fillStyle = '#000';
    for (const b of s.boxes) x.fillRect(Math.floor(b.x * s.w), Math.floor(b.y * s.h), Math.ceil(b.w * s.w) + 1, Math.ceil(b.h * s.h) + 1);
    return c.toDataURL('image/jpeg', 0.86);
  }

  /* --- Sūtīšana --- */
  function check() {
    if (!F.title.trim() && !F.text.trim()) { ui.toast('Uzraksti, par ko ir ziņojums', 'warn'); U.$('fbTitle')?.focus(); return false; }
    const unmasked = shots.filter(s => !s.boxes.length).length;
    if (unmasked && !confirm(`${unmasked === 1 ? 'Vienā attēlā' : unmasked + ' attēlos'} nekas nav aizklāts. Vai tur tiešām nav redzami jaunsargu vārdi, personas kodi vai citi personu dati?\n\nOK — sūtīt, Atcelt — atgriezties un aizklāt.`)) return false;
    return true;
  }
  async function payload() {
    return {
      k: 'cadet-zinot-v1', id: U.uid(), at: U.now(),
      type: F.type, typeLabel: (TYPES.find(t => t[0] === F.type) || TYPES[0])[2],
      title: F.title.trim(), text: F.text.trim(), name: F.name.trim(), contact: F.contact.trim(),
      tech: F.tech ? tech() : { version: CP.VERSION, channel: CP.CHANNEL },
      images: await Promise.all(shots.map(async (s, i) => ({ name: `attels_${i + 1}.jpg`, data: (await finalImage(s)).split(',')[1] })))
    };
  }
  function done(p, ok) {
    const h = lsGet(HKEY, []); h.unshift({ id: p.id, at: p.at, type: p.type, title: p.title, shots: p.images.length, ok }); lsSet(HKEY, h.slice(0, 30));
    if (ok) { shots = []; F = Object.assign(blank(), { name: F.name, contact: F.contact, page: F.page }); try { localStorage.removeItem(DKEY); } catch (e) { } }
    CP.render();
  }
  A.fbSend = async () => {
    if (sending || !check()) return;
    const url = sendUrl();
    if (!url) return ui.toast('Sūtīšana šajā versijā vēl nav ieslēgta. Spied “⇩ Saglabāt failā” un nosūti failu izstrādātājam.', 'warn', 9000);
    if (!navigator.onLine) return ui.toast('Nav interneta. Mēģini vēlāk vai saglabā ziņojumu failā.', 'warn', 8000);
    sending = true; CP.render();
    let p;
    try {
      p = await payload();
      const r = await fetch(url, { method: 'POST', body: JSON.stringify(p), redirect: 'follow' });   // text/plain → bez CORS priekšpieprasījuma
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw Error(j.error || ('serveris atbildēja ' + r.status));
      sending = false; done(p, true);
      ui.toast('✓ Paldies! Ziņojums nosūtīts izstrādātājam.', 'ok', 6000);
    } catch (e) {
      console.error(e); sending = false; CP.render();
      ui.toast('Ziņojumu neizdevās nosūtīt: ' + e.message + '. Teksts un attēli saglabājušies — mēģini vēlreiz vai “⇩ Saglabāt failā”.', 'err', 12000);
    }
  };
  A.fbSaveFile = async () => {
    if (!check()) return;
    const p = await payload(), t = p.tech;
    const html = `<!doctype html><html lang="lv"><head><meta charset="utf-8"><title>CADET ziņojums — ${esc(p.title)}</title><style>body{font:15px/1.5 system-ui,Segoe UI,sans-serif;max-width:900px;margin:30px auto;padding:0 16px}img{max-width:100%;border:1px solid #ccc;border-radius:8px;margin:8px 0}pre{background:#f4f4f4;padding:10px;border-radius:8px;white-space:pre-wrap}</style></head><body>
      <h1>${esc(p.typeLabel)}: ${esc(p.title || '(bez virsraksta)')}</h1><p>${esc(U.fmtDateTime(p.at))}${p.name ? ' · ' + esc(p.name) : ''}${p.contact ? ' · ' + esc(p.contact) : ''}</p>
      <pre>${esc(p.text)}</pre>${p.images.map(i => `<img src="data:image/jpeg;base64,${i.data}" alt="">`).join('')}<h3>Tehniskā informācija</h3><pre>${esc(JSON.stringify(t, null, 1))}</pre></body></html>`;
    U.download(new Blob([html], { type: 'text/html' }), `CADET zinojums ${U.iso()}.html`);
    done(p, false);
    ui.toast('Ziņojums saglabāts failā. Nosūti to izstrādātājam (piem., e-pastā vai WhatsApp).', 'ok', 8000);
  };
  A.fbClear = () => { if ((F.title || F.text || shots.length) && !confirm('Notīrīt ziņojumu?')) return; shots = []; F = Object.assign(blank(), { name: F.name, contact: F.contact, page: F.page }); try { localStorage.removeItem(DKEY); } catch (e) { } CP.render(); };

  // atceras, no kuras lapas atnāca (tehniskajai informācijai un ekrāna uzņemšanai)
  { const og = ui.go; ui.go = (page, opts) => { if (page === 'feedback' && S.page !== 'feedback' && !cap) F.page = S.page; return og(page, opts); }; }
  CP.feedback = { tech, shots: () => shots, addImage, TYPES };
})(window.CP);


/* ==== js/app.js ==== */
/* =====================================================================
   Lietotnes palaišana un notikumu sadalīšana.
   Visas pogas izmanto data-act="nosaukums" (un data-arg) → CP.actions[nosaukums].
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, ui = CP.ui, A = CP.actions;

  document.addEventListener('click', async e => {
    // aizver atvērtās izvēlnes, ja klikšķis ārpus tām
    U.qsa('details.menu[open]').forEach(m => { if (!m.contains(e.target) || e.target.closest('.menu-list button')) m.removeAttribute('open'); });
    const el = e.target.closest('[data-act],[data-page],[data-person],[data-tab],[data-close]'); if (!el) return;
    const d = el.dataset;
    if (el.tagName === 'A') e.preventDefault();
    if (d.close) { U.$(d.close).close(); if (!d.person) return; }
    if (d.act) {
      const fn = A[d.act]; if (!fn) return console.warn('Nav darbības', d.act);
      if (!S.root && !CP.noRootOk(d.act)) { CP.needRoot(); return; }
      try { await fn(d.arg, el, e); } catch (err) { console.error(err); ui.toast('Kļūda: ' + err.message, 'err'); }
      return;
    }
    if (d.page) {
      if (d.page === 'archive') { S.list.status = 'archived'; S.list.missing = false; S.list.sel.clear(); ui.go('people'); return; }
      if (d.page === 'people' && S.list.status === 'archived') S.list.status = 'current';
      ui.go(d.page); return;
    }
    if (d.person) { if (U.$('viewDialog').open) U.$('viewDialog').close(); ui.go('person', { person: d.person, tab: d.goto || 'overview' }); return; }
    if (d.tab) { S.tab = d.tab; CP.render(); }
  });
  document.addEventListener('change', e => { for (const h of CP.changeHandlers) if (h(e)) return; });
  document.addEventListener('input', e => { for (const h of CP.inputHandlers) if (h(e)) return; });

  // Sānjosla
  U.$('search').addEventListener('input', () => ui.renderSide());
  U.$('search').addEventListener('keydown', e => { if (e.key === 'Enter') { const first = U.qs('#sideList .person'); if (first) first.click(); } });
  U.$('groupFilter').addEventListener('change', e => { S.groupFilter = e.target.value; ui.renderSide(); });
  U.$('sideArchive').addEventListener('change', e => { S.sideArchive = e.target.checked; ui.renderSide(); });

  // Īsinājumtaustiņi
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); CP.store.save(false); return; }
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing && !U.qs('dialog[open]'))) { e.preventDefault(); U.$('search').focus(); U.$('search').select(); return; }
    if (e.key === 'Enter' && e.target.id === 'noteText' && !e.shiftKey && !e.isComposing) { e.preventDefault(); A.addNote(S.selected); }
  });
  /* Datu mapes ievilkšana no File Explorer. Reģistrēts pēc documents.js / viewer.js — ja tie notikumu
     jau apstrādāja (defaultPrevented), šeit to neaiztiek. Bez datu mapes mapi var ievilkt jebkur logā.
     Citur ievilkts fails netiek atvērts pārlūkā (citādi Chrome aizietu prom no programmas). */
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  const rootZone = e => e.target.closest?.('[data-rootdrop]') || (!S.root && !U.qs('dialog[open]') ? U.qs('.hero [data-rootdrop]') || document.body : null);
  let overEl = null;
  const setOver = el => { if (overEl === el) return; overEl?.classList.remove('over'); overEl = el; el?.classList.add('over'); };
  document.addEventListener('dragover', e => {
    if (e.defaultPrevented || !hasFiles(e)) return;
    e.preventDefault();
    const z = rootZone(e);
    e.dataTransfer.dropEffect = z ? 'link' : 'none';
    setOver(z && z !== document.body ? z : null);
  });
  document.addEventListener('dragleave', e => { if (!e.relatedTarget) setOver(null); });
  document.addEventListener('drop', e => {
    setOver(null);
    if (e.defaultPrevented || !hasFiles(e)) return;
    e.preventDefault();
    if (!rootZone(e)) { ui.toast('Lai mainītu datu mapi, ievelc to laukā “Datu mape” (Iestatījumos vai sānjoslā pie 📁).', 'warn', 8000); return; }
    const items = [...e.dataTransfer.items].filter(i => i.kind === 'file');
    // getAsFileSystemHandle jāizsauc sinhroni — pēc pirmā await dataTransfer vairs nav pieejams
    const pr = items[0] && items[0].getAsFileSystemHandle ? items[0].getAsFileSystemHandle() : null;
    CP.store.dropRoot(pr, items.length).catch(err => { console.error(err); ui.toast('Mapes pieslēgšanas kļūda: ' + err.message, 'err', 15000); });
  });
  window.addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  // Palaišana
  ui.datalists();
  CP.render();
  if (!window.FileSystemHandle) ui.toast('Šis pārlūks neatbalsta darbu ar mapēm. Lieto Google Chrome vai Microsoft Edge.', 'err', 20000);
  else CP.store.tryRestore();

  /* --- Tīmekļa versija: bezsaistes kešs, atjauninājumi, instalēšana, testa kanāls --- */
  if (CP.CHANNEL === 'test') {
    document.title = 'TESTS · ' + document.title;
    const b = document.createElement('div'); b.className = 'testbanner';
    b.textContent = 'TESTA VERSIJA — izmanto tikai testa datu mapi ar izdomātiem datiem';
    document.body.prepend(b);
  }
  if (CP.WEB && 'serviceWorker' in navigator) {
    const swUrl = new URL('sw.js', location.href).href, cur = navigator.serviceWorker.controller;
    const hadController = !!cur && cur.scriptURL === swUrl;   // tikai savs kanāls (stabilais kešs kontrolē arī /test/ pirmajā reizē)
    // Bezsaistes kešs atjaunojas fonā. Lapa jau ielādē jaunāko kodu (tīkls vispirms), tāpēc kešs pats par sevi nav iemesls pārlādēt.
    navigator.serviceWorker.register('sw.js').then(reg => { CP._swReg = reg; }).catch(e => console.warn('Bezsaistes kešs nav pieejams:', e));
    void hadController;
    /* Jauna versija, kamēr lietotājs strādā: salīdzina publicēto version.json ar ielādēto kodu */
    let told = '';
    const check = async () => {
      if (!navigator.onLine) return;
      try {
        const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
        const v = String((await r.json()).version || '');
        if (v && v !== CP.VERSION && v !== told && newer(v, CP.VERSION)) {
          told = v; CP._swReg?.update?.().catch(() => {});
          ui.toast(`Ir pieejama jauna versija ${v}. Kad ērti — saglabā darbu un pārlādē lapu, lai to izmantotu.`, 'ok', 0, { act: 'reloadApp', label: '↻ Pārlādēt' });
        }
      } catch (e) { /* bezsaistē — nekas */ }
    };
    const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
    setTimeout(check, 5 * 60 * 1000);
    setInterval(check, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    CP.checkUpdate = check;
  }
  A.reloadApp = () => { if (S.dirty) CP.store.save(false).then(ok => ok !== false && location.reload()); else location.reload(); };
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); CP.installPrompt = e; if (S.page === 'settings') CP.render(); });
  A.installApp = async () => { const p = CP.installPrompt; if (!p) return ui.toast('Chrome adreses joslā spied ikonu “Instalēt” (⊕) vai izvēlni ⋮ → “Instalēt lapu kā lietotni”.', 'ok', 10000); p.prompt(); await p.userChoice; CP.installPrompt = null; CP.render(); };
})(window.CP);
