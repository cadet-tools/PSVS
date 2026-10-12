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
    accent() { const v = ls.get('cp-accent') || look().accent || CP.ACCENTS[0][0]; return HEX.test(v) ? v : CP.ACCENTS[0][0]; },
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
