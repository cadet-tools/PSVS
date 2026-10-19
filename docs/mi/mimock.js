// MI starpnieka imitācija testiem un izstrādei: izpilda īsto docs/mi/Kods.gs ar Apps Script imitāciju
// un pasniedz rīka failus no repozitorija, lai testa versiju var atvērt tajā pašā adresē (CSP 'self').
//   GROQ_KEY=gsk_… node docs/mi/mimock.js [port] [repo]
//   → http://127.0.0.1:<port>/test/   (starpnieks: /__mi; rīkā localStorage cp.miUrl = "/__mi")
// Bez GROQ_KEY Groq netiek saukts: atbild imitēts modelis (FAKE=1 to ieslēdz arī ar atslēgu).
// Testiem: POST /__mi/props {…} — maina skripta rekvizītus; POST /__mi/reset — notīra skaitītājus.
const fs = require('fs'), vm = require('vm'), http = require('http'), path = require('path'), { execFileSync } = require('child_process');
const PORT = +(process.argv[2] || 47613), REPO = path.resolve(process.argv[3] || path.join(__dirname, '..', '..'));
const GS = path.join(__dirname, 'Kods.gs');
const props = {}, cache = {}, logs = [];
if (process.env.GROQ_KEY) props.GROQ_KEY = process.env.GROQ_KEY;
const FAKE = !process.env.GROQ_KEY || process.env.FAKE === '1';
let fakeCalls = 0, fake429 = new Set();

function fetchSync(url, o) {
  if (FAKE) {
    fakeCalls++;
    const body = JSON.parse(o.payload);
    if (fake429.has(body.model)) return resp(429, '{"error":{"message":"rate limit"}}', { 'retry-after': '3600' });
    if (fake429.has(body.model + ':busy')) return resp(429, '{"error":{"message":"rate limit"}}', { 'retry-after': '7' });
    const q = body.messages.at(-1).content;
    const off = /laikapstāk|eseju|recept|python/i.test(q);
    return resp(200, JSON.stringify({ choices: [{ message: { content: JSON.stringify(off ? { answer: 'Es varu palīdzēt tikai ar CADET PERSONĀLS lietošanu.', guide: [], page: '', offtopic: true }
      : { answer: 'Imitēta atbilde (' + body.model + '): 1. Sānjoslā spied “＋”. 2. Aizpildi laukus. 3. Spied “Saglabāt”.', guide: [0], page: 'people', offtopic: false }) } }] }));
  }
  const hf = path.join(require('os').tmpdir(), 'mimock-h-' + process.pid);
  const args = ['-s', '-o', '-', '-D', hf, '-w', '\n%{http_code}', '-X', 'POST', url, '-H', 'Content-Type: ' + o.contentType];
  for (const [k, v] of Object.entries(o.headers || {})) args.push('-H', k + ': ' + v);
  args.push('--data-binary', '@-');
  const outp = execFileSync('curl', args, { input: o.payload, maxBuffer: 1 << 24 }).toString();
  const i = outp.lastIndexOf('\n'), hd = {};
  for (const l of fs.readFileSync(hf, 'utf8').split(/\r?\n/)) { const m = /^([\w-]+):\s*(.*)$/.exec(l); if (m) hd[m[1].toLowerCase()] = m[2]; }
  return resp(+outp.slice(i + 1), outp.slice(0, i), hd);
}
function resp(code, text, headers = {}) { return { getResponseCode: () => code, getContentText: () => text, getHeaders: () => headers }; }

const ctx = {
  UrlFetchApp: { fetch: fetchSync },
  CacheService: { getScriptCache: () => ({ get: k => { const c = cache[k]; return c && c.exp > Date.now() ? c.v : null; }, put: (k, v, ttl) => { cache[k] = { v, exp: Date.now() + (ttl || 600) * 1000 }; } }) },
  LockService: { getScriptLock: () => ({ waitLock() { }, releaseLock() { } }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getProperties: () => ({ ...props }) }) },
  Logger: { log: m => { logs.push(m); console.log('[gs]', m); } },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, s }) },
  JSON, Date, Math, Number, String, Object, Array, RegExp
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(GS, 'utf8') + '\n;this.__f={doPost,doGet,uzstadit,RULES};', ctx);

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json', '.gz': 'application/gzip', '.ttf': 'font/ttf', '.docx': 'application/octet-stream', '.xlsx': 'application/octet-stream' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const json = (o, st = 200) => { res.writeHead(st, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(typeof o === 'string' ? o : JSON.stringify(o)); };
  if (u.pathname.startsWith('/__mi')) {
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      if (u.pathname === '/__mi/props') { Object.assign(props, JSON.parse(b || '{}')); for (const k of Object.keys(props)) if (props[k] === null) delete props[k]; return json({ ok: true }); }
      if (u.pathname === '/__mi/reset') { for (const k of Object.keys(cache)) delete cache[k]; for (const k of Object.keys(props)) if (k.startsWith('day:')) delete props[k]; fake429 = new Set(JSON.parse(b || '[]')); fakeCalls = 0; return json({ ok: true }); }
      if (u.pathname === '/__mi/stats') return json({ fakeCalls, fake: FAKE, props: Object.keys(props).filter(k => k !== 'GROQ_KEY') });
      if (u.pathname === '/__mi/rules') return json({ rules: ctx.__f.RULES });
      if (req.method === 'POST') return json(ctx.__f.doPost({ postData: { contents: b } }).s);
      json(ctx.__f.doGet({ parameter: Object.fromEntries(u.searchParams) }).s);
    });
    return;
  }
  let p = path.join(REPO, decodeURIComponent(u.pathname));
  if (!p.startsWith(REPO)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end('nav'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(p).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`mimock http://127.0.0.1:${PORT}/test/ (${FAKE ? 'imitēts modelis' : 'īsts Groq'})`));
