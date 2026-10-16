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
    if (!b) { b = document.createElement('div'); b.id = 'gBanner'; b.className = 'gbanner'; b.setAttribute('role', 'status'); ui.topHost().prepend(b); }
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
