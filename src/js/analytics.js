/* =====================================================================
   Lietošanas analītika (anonīma) — PASTĀVĪGA RĪKA DAĻA, nedzēst pārbūvējot.
   Apraksts: docs/ANALYTICS.md. Saņēmējs: tools/analitika/Kods.gs (Google Apps Script).

   • Viena “sesija” = viens darba posms (pārtraukums > 30 min → jauna sesija).
     Sesijā tiek skaitīts: aktīvais laiks, atvērtās sadaļas, nospiesto pogu (darbību)
     nosaukumi, kļūdu veidi (tikai veids@fails:rinda, bez teksta).
   • Vide: versija, kanāls, lietotne/pārlūks, OS, pārlūka veids, ekrāna grupa, valoda,
     laika josla, instruktora novada pārvaldes un nodaļas NUMURS, personu skaita grupa.
   • ID: nejaušs skaitlis šajā pārlūkā (cp.anId) — tikai atgriešanās skaitīšanai.
   • NEKAD netiek sūtīts: vārdi, personas kodi, kartīšu saturs, dokumenti, failu un mapju
     nosaukumi, kontakti, piezīmes, kļūdu teksti, data-arg vērtības.
   • Bezsaistē: sesijas krājas rindā (cp.anQ, līdz 300 sesijām / 60 dienām) un tiek
     nosūtītas vēlāk ar sākotnējo laiku; sesijas ID novērš dublēšanos.
   • Izslēgt: Iestatījumi → Atļaujas → “Lietošanas statistika”.
   ===================================================================== */
(function (CP) {
  'use strict';
  const S = CP.state, ui = CP.ui, A = CP.actions;
  const K = { id: 'cp.anId', q: 'cp.anQ', cur: 'cp.anCur', off: 'cp.anOff', seen: 'cp.anSeen', url: 'cp.anUrl' };
  const FORMAT = 'cadet-an-v1', GAP = 30 * 60e3, IDLE = 5 * 60e3, TICK = 30e3, MAXQ = 300, MAXAGE = 60 * 864e5, EVERY = 15 * 60e3, MAXKEYS = 80;
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } }
  };
  /** Kanāli, kuros analītika darbojas (stabilajā — tikai kad CP.ANALYTICS_STABLE = true) */
  const allowed = () => !!CP.WEB && (CP.CHANNEL === 'test' || !!CP.ANALYTICS_STABLE);
  const enabled = () => allowed() && !ls.get(K.off, false);
  const url = () => ls.get(K.url, '') || CP.ANALYTICS_URL || '';
  const rnd = n => { const b = new Uint8Array(n); crypto.getRandomValues(b); return [...b].map(x => x.toString(16).padStart(2, '0')).join(''); };
  const uid = () => { let id = ls.get(K.id, ''); if (!/^[0-9a-f]{16,32}$/.test(id)) { id = rnd(12); ls.set(K.id, id); } return id; };
  const safeKey = k => String(k || '').replace(/[^\w.:@\-]/g, '').slice(0, 60);
  const inc = (m, k, n = 1) => { k = safeKey(k); if (!k) return; if (!(k in m) && Object.keys(m).length >= MAXKEYS) return; m[k] = (m[k] || 0) + n; };

  /* --- Vide (bez “pirkstu nospieduma”: tikai rupjas grupas) --- */
  function env() {
    const ua = navigator.userAgent;
    const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'cits';
    const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'cits';
    const w = screen.width || innerWidth;
    const sc = w < 900 ? '<900' : w < 1400 ? '900-1399' : w < 1920 ? '1400-1919' : '1920+';
    let m = 'web'; try { if (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches) m = 'app'; } catch (e) { }
    let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { }
    return { v: CP.VERSION, ch: CP.CHANNEL, m, os, br, sc, lg: String(navigator.language || '').slice(0, 10), tz: tz.slice(0, 40) };
  }
  /** Instruktora vienība (tikai numuri) un personu skaita grupa — no ielādētajiem datiem */
  function unit() {
    const I = S.db?.settings?.instructor || {}, num = v => String(v ?? '').replace(/\D/g, '').slice(0, 3);
    let pc = '';
    if (Array.isArray(S.db?.people)) {
      const n = S.db.people.filter(p => p.status !== 'archived').length;
      pc = n === 0 ? '0' : n <= 10 ? '1-10' : n <= 25 ? '11-25' : n <= 50 ? '26-50' : n <= 100 ? '51-100' : '100+';
    }
    return { p: num(I.parvalde), n: num(I.nodala), pc, df: S.root ? 1 : 0 };
  }

  /* --- Rinda --- */
  const loadQ = () => { const q = ls.get(K.q, {}); return q && typeof q === 'object' ? q : {}; };
  function saveQ(q) {
    const now = Date.now(), all = Object.values(q).filter(x => x && now - (x.t1 || 0) < MAXAGE).sort((a, b) => b.t1 - a.t1).slice(0, MAXQ);
    ls.set(K.q, Object.fromEntries(all.map(x => [x.s, x])));
  }
  let cur = null, lastInput = Date.now(), dirty = false;
  function persist() {
    if (!cur) return;
    Object.assign(cur, unit()); cur.rev = (cur.rev || 0) + (dirty ? 1 : 0); dirty = false;
    const q = loadQ(); q[cur.s] = { ...cur, sent: q[cur.s]?.sent || 0 }; saveQ(q); ls.set(K.cur, { s: cur.s, t1: cur.t1, v: cur.v });
  }
  function start() {
    if (!enabled()) return;
    const prev = ls.get(K.cur, null), q = loadQ(), now = Date.now();
    if (prev && q[prev.s] && prev.v === CP.VERSION && now - prev.t1 < GAP) { cur = { ...q[prev.s] }; delete cur.sent; }
    else { cur = { s: rnd(10), u: uid(), t0: now, t1: now, a: 0, pg: {}, f: {}, e: {}, rev: 1, ...env() }; dirty = true; }
    persist();
  }
  const touch = () => { if (!cur) return; const now = Date.now(); if (now - cur.t1 > GAP) { persist(); start(); } else cur.t1 = now; dirty = true; };

  /* --- Uzskaite --- */
  function page(p) { if (!enabled() || !cur) return; touch(); inc(cur.pg, p); persist(); }
  function act(name) { if (!enabled() || !cur) return; touch(); inc(cur.f, name); persist(); }
  function err(e, where) {
    if (!enabled() || !cur) return;
    const name = safeKey(e?.name || 'Error').slice(0, 30) || 'Error';
    touch(); inc(cur.e, `${name}@${safeKey(where || 'nezin').slice(0, 28)}`);
  }
  window.addEventListener('error', e => { const f = String(e.filename || '').split('/').pop().split('?')[0]; err(e.error || { name: 'Error' }, f ? `${f}:${e.lineno || 0}` : 'nezin'); });
  window.addEventListener('unhandledrejection', e => err(e.reason instanceof Error ? e.reason : { name: 'Rejection' }, 'promise'));
  ['pointerdown', 'keydown', 'wheel'].forEach(t => addEventListener(t, () => { lastInput = Date.now(); }, { passive: true, capture: true }));
  setInterval(() => {
    if (!enabled() || !cur || document.hidden || Date.now() - lastInput > IDLE) return;
    touch(); cur.a += TICK / 1000; persist();
  }, TICK);

  /* --- Sūtīšana --- */
  let busy = false, lastFlush = 0;
  const pack = x => { const { sent, rev, ...o } = x; return o; };
  async function flush(force) {
    if (!enabled() || !url() || busy || !navigator.onLine) return false;
    if (!force && Date.now() - lastFlush < 5 * 60e3) return false;
    if (cur) persist();
    const q = loadQ(), items = Object.values(q).filter(x => x.rev !== x.sent).sort((a, b) => a.t0 - b.t0).slice(0, 50);
    if (!items.length) return true;
    busy = true; lastFlush = Date.now();
    try {
      const body = JSON.stringify({ k: FORMAT, items: items.map(pack) });
      const r = await fetch(url(), { method: 'POST', body, redirect: 'follow', keepalive: body.length < 60000, credentials: 'omit' });   // text/plain → bez CORS priekšpieprasījuma
      const j = await r.json().catch(() => ({}));
      if (!j.ok) return false;
      const q2 = loadQ();
      for (const it of items) { const x = q2[it.s]; if (!x) continue; if (cur && x.s === cur.s) x.sent = it.rev; else if (x.rev === it.rev) delete q2[x.s]; else x.sent = it.rev; }
      saveQ(q2); return true;
    } catch (e) { return false; }   // nav savienojuma / saņēmējs nav pieejams — mēģinās vēlāk, rīks strādā tālāk
    finally { busy = false; }
  }
  addEventListener('online', () => setTimeout(() => flush(true), 8000));
  document.addEventListener('visibilitychange', () => { if (document.hidden && cur) { persist(); flush(true); } });
  setInterval(() => flush(false), EVERY);

  /* --- Ieslēgt / izslēgt (Iestatījumi → Atļaujas) --- */
  A.anToggle = () => {
    if (ls.get(K.off, false)) { ls.del(K.off); start(); ui.toast('Lietošanas statistika ieslēgta', 'ok'); }
    else { ls.set(K.off, true); ls.del(K.q); ls.del(K.cur); ls.del(K.id); cur = null; ui.toast('Lietošanas statistika izslēgta. Šajā pārlūkā uzkrātā statistika un ID izdzēsti.', 'ok', 6000); }
    CP.perms?.paint?.();
  };
  A.anSettings = () => { S.setTab = 'perm'; ui.go('settings'); };
  CP.noRootOk && (() => { const o = CP.noRootOk; CP.noRootOk = a => a === 'anToggle' || a === 'anSettings' || o(a); })();

  /* --- Sākums --- */
  { const og = ui.go; ui.go = (p, opts) => { const r = og(p, opts); page(p); return r; }; }
  setTimeout(() => {
    if (!enabled()) return;
    start(); page(S.page);
    if (!ls.get(K.seen, false)) {
      ls.set(K.seen, true);
      ui.toast('Rīks izmanto sīkdatnes (pārlūka atmiņu) un apkopo anonīmu lietošanas statistiku — bez personu datiem. Izslēgt var Iestatījumos → Atļaujas.', '', 12000, { act: 'anSettings', label: 'Iestatījumi' });
    }
    setTimeout(() => flush(true), 10000);
  }, 3000);

  CP.analytics = {
    allowed, enabled, url, act, err, page, flush,
    state: () => ({ on: enabled(), allowed: allowed(), configured: !!url(), queued: Object.values(loadQ()).filter(x => x.rev !== x.sent).length, session: cur ? pack(cur) : null }),
    queue: () => Object.values(loadQ()).map(pack)
  };
})(window.CP);
