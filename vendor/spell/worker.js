/* CADET PERSONĀLS — latviešu pareizrakstības pārbaude (Hunspell WebAssembly, vārdnīca lv_LV, LGPL 2.1).
   Darbojas atsevišķā pavedienā datorā; teksts nekur netiek sūtīts.
   Ziņas: { id, op: 'init' } · { id, op: 'check', words: [] } → { bad: [] } · { id, op: 'suggest', word } → { list: [] } */
'use strict';
importScripts('hunspell.min.js');
let H = null, loading = null;
async function init() {
  if (H) return;
  if (!loading) loading = (async () => {
    const f = await self.HunspellAsm.loadModule();
    const get = async n => new Uint8Array(await (await fetch(n)).arrayBuffer());
    const [aff, dic] = await Promise.all([get('lv.aff'), get('lv.dic')]);
    H = f.create(f.mountBuffer(aff, 'lv.aff'), f.mountBuffer(dic, 'lv.dic'));
  })();
  await loading;
}
self.onmessage = async e => {
  const { id, op } = e.data || {};
  try {
    await init();
    if (op === 'init') return postMessage({ id, ok: true });
    if (op === 'check') {
      const bad = [];
      for (const w of e.data.words || []) {
        let ok = H.spell(w);
        if (!ok && /^\p{Lu}/u.test(w)) ok = H.spell(w.toLocaleLowerCase('lv'));   // teikuma sākums
        if (!ok) bad.push(w);
      }
      return postMessage({ id, ok: true, bad });
    }
    if (op === 'suggest') return postMessage({ id, ok: true, list: H.suggest(e.data.word).slice(0, 8) });
    postMessage({ id, ok: false, error: 'nezināma darbība' });
  } catch (err) { postMessage({ id, ok: false, error: String(err && err.message || err) }); }
};
