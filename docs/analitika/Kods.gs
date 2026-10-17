/**
 * CADET PERSONĀLS — lietošanas analītikas saņēmējs un panelis (Google Apps Script, bezmaksas).
 * Uzstādīšana: docs/ANALYTICS.md. Īsumā:
 *   1. Jauna Google tabula “CADET analītika” → Paplašinājumi → Apps Script.
 *   2. Ielīmē šo failu (Kods.gs) un izveido HTML failu “Panelis” ar Panelis.html saturu.
 *   3. Palaid funkciju uzstadit (▶ Run) → atļauj → žurnālā (Execution log) būs paneļa atslēga.
 *   4. Izvieto → Jauna izvietošana → Tīmekļa lietotne: Izpildīt kā “Es”, Piekļuve “Ikviens”.
 *   5. …/exec adresi ieraksta rīkā (CP.ANALYTICS_URL). Panelis: …/exec?k=ATSLĒGA (tikai tev).
 *
 * Saņem tikai anonīmas sesijas (formāts cadet-an-v1); visas vērtības tiek pārbaudītas un apgrieztas.
 * Personu datus rīks nesūta; šis skripts arī nepieņemtu brīva teksta laukus.
 * Apps Script neredz sūtītāja IP adresi — tā netiek glabāta.
 */
const FORMAT = 'cadet-an-v1';
const SHEET = 'Sesijas';
const KEEP_DAYS = 400;            // ~13 mēneši; vecākas rindas dzēš funkcija tirit (katru nakti)
const MAX_PER_HOUR = 3000;        // aizsardzība pret pārāk daudziem pieprasījumiem
const COLS = ['Sesija', 'Lietotājs', 'Sākums', 'Pēdējā darbība', 'Aktīvs (s)', 'Versija', 'Kanāls', 'Veids', 'OS', 'Pārlūks', 'Ekrāns',
  'Valoda', 'Laika josla', 'Pārvalde', 'Nodaļa', 'Personas', 'Datu mape', 'Sadaļas', 'Darbības', 'Kļūdas', 'Saņemts'];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (!d || d.k !== FORMAT || !Array.isArray(d.items)) return out({ ok: false, error: 'nepareizs formāts' });
    const cache = CacheService.getScriptCache(), n = Number(cache.get('n') || 0);
    if (n >= MAX_PER_HOUR) return out({ ok: false, error: 'pārāk daudz pieprasījumu' });
    cache.put('n', String(n + 1), 3600);
    const items = d.items.slice(0, 50).map(clean).filter(Boolean);
    if (!items.length) return out({ ok: true, n: 0 });
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = sheet(), last = sh.getLastRow();
      const ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0])) : [];
      const at = {}; ids.forEach((id, i) => { at[id] = i + 2; });
      const now = new Date(), add = [], inAdd = {};
      items.forEach(it => {
        const row = toRow(it, now);
        if (at[it.s]) sh.getRange(at[it.s], 1, 1, COLS.length).setValues([row]);   // tā pati sesija vēlreiz → atjauno (nav dublikātu)
        else if (it.s in inAdd) add[inAdd[it.s]] = row;
        else { inAdd[it.s] = add.length; add.push(row); }
      });
      if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, COLS.length).setValues(add);
    } finally { lock.releaseLock(); }
    return out({ ok: true, n: items.length });
  } catch (err) {
    return out({ ok: false, error: 'kļūda' });
  }
}

/** Panelis: …/exec?k=ATSLĒGA. Bez pareizas atslēgas — tikai statuss, nekādu datu. */
function doGet(e) {
  const key = PropertiesService.getScriptProperties().getProperty('PANEL_KEY');
  if (!key || !e || !e.parameter || e.parameter.k !== key) return out({ ok: true, info: 'CADET analītikas saņēmējs darbojas' });
  const t = HtmlService.createTemplateFromFile('Panelis');
  t.data = JSON.stringify(rows()).replace(/</g, '\\u003c');
  return t.evaluate().setTitle('CADET PERSONĀLS — lietošana').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ---------- palīgfunkcijas ---------- */
function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET); sh.appendRow(COLS); sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, COLS.length).setFontWeight('bold');
  }
  return sh;
}
const RX = {
  id: /^[0-9a-f]{8,32}$/, v: /^[\w.\-]{1,20}$/, short: /^[\w .+\-<]{0,20}$/, lg: /^[A-Za-z\-]{0,10}$/,
  tz: /^[\w\/\-+]{0,40}$/, num: /^\d{0,3}$/, pc: /^[\d+\-]{0,7}$/, key: /^[\w.:@\-]{1,60}$/
};
function str(v, rx) { v = String(v == null ? '' : v); return rx.test(v) ? v : ''; }
function map(m) {
  const o = {}; if (!m || typeof m !== 'object') return o;
  Object.keys(m).slice(0, 80).forEach(k => { const n = Math.floor(Number(m[k])); if (RX.key.test(k) && n > 0 && n < 100000) o[k] = n; });
  return o;
}
function clean(x) {
  if (!x || typeof x !== 'object' || !RX.id.test(String(x.s)) || !RX.id.test(String(x.u))) return null;
  const now = Date.now(), t0 = Number(x.t0), t1 = Number(x.t1);
  if (!(t0 > now - KEEP_DAYS * 864e5) || !(t1 >= t0) || t1 > now + 864e5) return null;
  return {
    s: String(x.s), u: String(x.u), t0, t1, a: Math.max(0, Math.min(86400, Math.floor(Number(x.a) || 0))),
    v: str(x.v, RX.v), ch: x.ch === 'test' ? 'test' : 'stable', m: x.m === 'app' ? 'app' : 'web',
    os: str(x.os, RX.short), br: str(x.br, RX.short), sc: str(x.sc, RX.short), lg: str(x.lg, RX.lg), tz: str(x.tz, RX.tz),
    p: str(x.p, RX.num), n: str(x.n, RX.num), pc: str(x.pc, RX.pc), df: x.df ? 1 : 0,
    pg: map(x.pg), f: map(x.f), e: map(x.e)
  };
}
function toRow(it, now) {
  return [it.s, it.u, new Date(it.t0), new Date(it.t1), it.a, it.v, it.ch, it.m, it.os, it.br, it.sc, it.lg, it.tz,
    it.p, it.n, it.pc, it.df, JSON.stringify(it.pg), JSON.stringify(it.f), JSON.stringify(it.e), now];
}
/** Dati panelim: kompakti masīvi (bez sesijas ID) */
function rows() {
  const sh = sheet(), last = sh.getLastRow(); if (last < 2) return [];
  const j = s => { try { return JSON.parse(s || '{}'); } catch (e) { return {}; } };
  return sh.getRange(2, 1, last - 1, COLS.length).getValues().map(r => [
    r[1], +new Date(r[2]), +new Date(r[3]), Number(r[4]) || 0, String(r[5]), String(r[6]), String(r[7]), String(r[8]), String(r[9]), String(r[10]),
    String(r[13]), String(r[14]), String(r[15]), j(r[17]), j(r[18]), j(r[19])]);
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** Dzēš sesijas, kas vecākas par KEEP_DAYS (palaižas katru nakti) */
function tirit() {
  const sh = sheet(), last = sh.getLastRow(); if (last < 2) return;
  const lim = Date.now() - KEEP_DAYS * 864e5, v = sh.getRange(2, 4, last - 1, 1).getValues();
  for (let i = v.length - 1; i >= 0; i--) if (+new Date(v[i][0]) < lim) sh.deleteRow(i + 2);
}

/** Palaid vienreiz (▶ Run): izveido lapu, paneļa atslēgu un nakts tīrīšanu. Žurnālā parāda atslēgu. */
function uzstadit() {
  sheet();
  const P = PropertiesService.getScriptProperties();
  let key = P.getProperty('PANEL_KEY');
  if (!key) { key = Utilities.getUuid().replace(/-/g, ''); P.setProperty('PANEL_KEY', key); }
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'tirit'))
    ScriptApp.newTrigger('tirit').timeBased().everyDays(1).atHour(3).create();
  Logger.log('Gatavs. Paneļa atslēga: ' + key);
  Logger.log('Pēc izvietošanas panelis būs: <tīmekļa lietotnes adrese>?k=' + key);
}
/** Ja atslēga nonākusi svešās rokās — palaid šo, un vecā saite vairs nedarbosies. */
function jaunaAtslega() {
  const key = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('PANEL_KEY', key);
  Logger.log('Jaunā paneļa atslēga: ' + key);
}
