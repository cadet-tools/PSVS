// Google Apps Script imitācija testiem: izpilda īsto tools/analitika/Kods.gs ar atmiņas tabulu.
// node gasmock.js <Kods.gs> <Panelis.html> <port>
const fs = require('fs'), vm = require('vm'), http = require('http'), crypto = require('crypto');
const [, , GS, HTML, PORT] = process.argv;
const sheets = {}, props = {}, cache = {}, triggers = [], logs = [];
function Sheet() {
  const d = [];
  const rng = (r, c, nr = 1, nc = 1) => ({
    getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (d[r - 1 + i] || [])[c - 1 + j] ?? '')),
    setValues: v => v.forEach((row, i) => { d[r - 1 + i] = d[r - 1 + i] || []; row.forEach((x, j) => { d[r - 1 + i][c - 1 + j] = x; }); }),
    setFontWeight: () => { }
  });
  return { d, appendRow: r => d.push(r.slice()), setFrozenRows: () => { }, getLastRow: () => d.length, getRange: rng, deleteRow: i => d.splice(i - 1, 1) };
}
const ctx = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = Sheet()) }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, v) => { cache[k] = v; } }) },
  LockService: { getScriptLock: () => ({ waitLock() { }, releaseLock() { } }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
  Utilities: { getUuid: () => crypto.randomUUID() },
  ScriptApp: { getProjectTriggers: () => triggers, newTrigger: h => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create: () => triggers.push({ getHandlerFunction: () => h }) }) }) }) }) },
  Logger: { log: m => logs.push(m) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, s, type: 'json' }) },
  HtmlService: {
    createTemplateFromFile: () => ({
      evaluate() { const h = fs.readFileSync(HTML, 'utf8').replace('<?!= data ?>', () => this.data); return { setTitle() { return this; }, addMetaTag() { return this; }, s: h, type: 'html' }; }
    })
  },
  JSON, Date, Math, Number, String, Object, Array
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(GS, 'utf8') + '\n;this.__f={doPost,doGet,uzstadit,tirit};', ctx);
ctx.__f.uzstadit();
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = o => { res.writeHead(200, { 'Content-Type': o.type === 'html' ? 'text/html; charset=utf-8' : 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(o.s); };
  if (u.pathname === '/key') return send({ s: props.PANEL_KEY });
  if (u.pathname === '/dump') return send({ s: JSON.stringify((sheets['Sesijas']?.d || [])) });
  if (u.pathname === '/tirit') { ctx.__f.tirit(); return send({ s: '{"ok":true}' }); }
  if (req.method === 'POST') { let b = ''; req.on('data', c => b += c); req.on('end', () => send(ctx.__f.doPost({ postData: { contents: b } }))); return; }
  send(ctx.__f.doGet({ parameter: Object.fromEntries(u.searchParams) }));
}).listen(+PORT, () => console.log('gasmock', PORT));
