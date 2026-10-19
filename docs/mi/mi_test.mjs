// MI palīga pārbaude (bez Groq atslēgas, ar imitētu modeli): node docs/mi/mi_test.mjs
// 1) RULES teksts docs/mi/Kods.gs un src/js/ai.js ir vienāds.
// 2) Starpnieks (īstais Kods.gs imitācijā mimock.js): formāts, iestatīšana, limiti, modeļu maiņa, 429 veidi, statuss.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(here, '..', '..');
const rulesOf = file => {
  const s = readFileSync(file, 'utf8'), m = /\/\/ RULES:BEGIN[^\n]*\n([\s\S]*?)\/\/ RULES:END/.exec(s);
  assert.ok(m, 'RULES bloks nav atrasts: ' + file);
  return vm.runInNewContext(m[1].replace(/^\s*const RULES =/, 'RULES =') + ';RULES', {});
};
const okc = (name, fn) => fn().then(() => console.log('✓', name), e => { console.error('✗', name, '\n ', e.message); process.exitCode = 1; });

await okc('RULES vienādi Kods.gs un ai.js', async () => {
  const a = rulesOf(path.join(here, 'Kods.gs')), b = rulesOf(path.join(repo, 'src/js/ai.js'));
  assert.ok(a.length > 500); assert.equal(a, b);
});

const PORT = 47000 + Math.floor(Math.random() * 900);
const env = { ...process.env }; delete env.GROQ_KEY;
const srv = spawn(process.execPath, [path.join(here, 'mimock.js'), String(PORT), repo], { env, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res, rej) => { srv.stdout.on('data', d => { if (/mimock/.test(d)) res(); }); srv.on('exit', c => rej(Error('mimock beidzās ' + c))); });
const B = `http://127.0.0.1:${PORT}/__mi`;
const post = async (p, body) => (await fetch(B + p, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })).json();
const q = (extra = {}) => post('', { k: 'cadet-mi-v1', u: 'a1b2c3d4e5f6a7b8c9d0e1f2', v: '1.58.0', ch: 'test', q: 'Kā pievienot personu?', kb: '#0 Kā pievienot jaunu personu?', page: 'people', hist: [], ...extra });
const reset = (m429 = []) => post('/reset', m429);

try {
  await okc('bez GROQ_KEY → setup; statuss ready=false', async () => {
    assert.equal((await q()).code, 'setup');
    const g = await (await fetch(B)).json(); assert.equal(g.ok, true); assert.equal(g.ready, false);
    await post('/props', { GROQ_KEY: 'fake' });
    assert.equal((await (await fetch(B)).json()).ready, true);
  });
  await okc('nepareizs formāts un lietotāja ID', async () => {
    assert.equal((await post('', 'nav json')).code, 'error');
    assert.equal((await post('', { k: 'cits' })).code, 'format');
    assert.equal((await q({ u: 'nav-hex' })).code, 'format');
    assert.equal((await q({ q: '   ' })).code, 'format');
  });
  await okc('atbilde: ok, JSON teksts, atlikušais skaits', async () => {
    await reset();
    const r = await q(); assert.equal(r.ok, true); assert.equal(r.model, 'openai/gpt-oss-120b'); assert.equal(r.left, 19);
    const o = JSON.parse(r.text); assert.ok(o.answer); assert.deepEqual(o.guide, [0]);
  });
  await okc('lietotāja limits → limit ar resetMin; cits lietotājs var', async () => {
    await reset(); await post('/props', { USER_LIMIT: '2' });
    assert.ok((await q()).ok); assert.ok((await q()).ok);
    const r = await q(); assert.equal(r.code, 'limit'); assert.ok(r.resetMin > 300 && r.resetMin <= 360, 'resetMin ' + r.resetMin);
    assert.ok((await q({ u: 'ffffffffffffffffffffffff' })).ok);
    await post('/props', { USER_LIMIT: null });
  });
  await okc('dienas limits visiem → limit_all', async () => {
    await reset(); await post('/props', { DAY_LIMIT: '1' });
    assert.ok((await q()).ok); assert.equal((await q({ u: 'eeeeeeeeeeeeeeeeeeeeeeee' })).code, 'limit_all');
    await post('/props', { DAY_LIMIT: null });
  });
  await okc('minūtes limits → busy', async () => {
    await reset(); await post('/props', { MINUTE_LIMIT: '1' });
    assert.ok((await q()).ok); assert.equal((await q()).code, 'busy');
    await post('/props', { MINUTE_LIMIT: null });
  });
  await okc('modeļa 429 → nākamais modelis; visi 429 → limit_all / busy', async () => {
    await reset(['openai/gpt-oss-120b']);
    assert.equal((await q()).model, 'openai/gpt-oss-20b');
    await reset(['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b']);
    assert.equal((await q()).code, 'limit_all');
    await reset(['openai/gpt-oss-120b:busy', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b']);
    assert.equal((await q()).code, 'busy');
  });
  await okc('neveiksmīgs jautājums netiek skaitīts limitā', async () => {
    await reset(['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b']); await post('/props', { USER_LIMIT: '1' });
    assert.equal((await q()).code, 'limit_all');
    await reset(); assert.ok((await q()).ok);
    await post('/props', { USER_LIMIT: null });
  });
  await okc('ārpus tēmas → offtopic atbilde', async () => {
    await reset();
    const o = JSON.parse((await q({ q: 'Kādi rīt būs laikapstākļi?' })).text); assert.equal(o.offtopic, true);
  });
  await okc('starpnieks nesaglabā jautājumus (rekvizītos tikai skaitītāji)', async () => {
    const s = await (await fetch(B + '/stats')).json();
    assert.ok(s.props.every(k => /^(day:\d{4}-\d{2}-\d{2}|USER_LIMIT|DAY_LIMIT|MINUTE_LIMIT|MODELS)$/.test(k)), s.props.join(','));
  });
} finally { srv.kill(); }
