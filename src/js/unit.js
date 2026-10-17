/* =====================================================================
   Vienības logo un nosaukums.
   • Iestatījumi → Pamata → “Vienība”: nosaukums un logo (attēla fails → PNG ≤ 512 px, glabājas datu failā:
     settings.unit = { name, logo: 'data:image/png;base64,…' }).
   • Rīkā: galvenes kreisajā pusē (logo + nosaukums).
   • Neoficiālos rīka failos (piem., jaunsarga kopsavilkums) — pēc izvēles; tad vienmēr arī CADET.LV logo
     ar uzrakstu “CADET PERSONĀLS”. Oficiālajās veidlapās (instruktāžas lapa, nometnes žurnāls, līgumi,
     VFS protokols, apmeklējuma žurnāls) logo un uzraksti NETIEK likti.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, ui = CP.ui, A = CP.actions, esc = U.esc;
  const get = () => { const u = S.db?.settings?.unit || {}; return { name: String(u.name || '').trim(), logo: /^data:image\/png;base64,/.test(u.logo || '') ? u.logo : '' }; };
  const set = o => { const s = S.db.settings; s.unit = { ...(s.unit || {}), ...o }; CP.store.changed({ silent: true }); paint(); };

  function card() {
    const u = get();
    return `<section class="card" id="unitCard"><h3>${CP.ic('flag')}Vienība</h3>
      <div class="unit-set">
        <div class="unit-prev">${u.logo ? `<img src="${u.logo}" alt="Vienības logo">` : '<span class="muted small">Nav logo</span>'}</div>
        <div class="grow">
          <div class="field"><label for="unitName">Vienības nosaukums</label><input id="unitName" data-unit="name" maxlength="80" value="${esc(u.name)}" placeholder="piem., Rīgas 1. jaunsargu vienība" autocomplete="off"></div>
          <div class="actions"><label class="btn sm">${CP.ic('upload', '⬆')} ${u.logo ? 'Mainīt logo' : 'Pievienot logo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-unit="logo" hidden></label>
            ${u.logo ? '<button type="button" class="sm ghost danger" data-act="unitLogoDel">Noņemt logo</button>' : ''}</div>
        </div>
      </div>
      <p class="small muted">Redzams rīka augšējā joslā un — ja izvēlas — rīka neoficiālajos failos, piemēram, jaunsarga kopsavilkumā (tad tur ir arī CADET.LV logo ar “CADET PERSONĀLS”). Oficiālajās veidlapās (instruktāžas lapas, nometņu žurnāli, līgumi, protokoli) logo netiek likts. Ieteicams PNG ar caurspīdīgu fonu.</p></section>`;
  }
  /** Galvenes josla: logo + nosaukums kreisajā pusē */
  function paint() {
    const bar = document.querySelector('.yearbar'); if (!bar) return;
    let b = U.$('unitBadge'); const u = S.db ? get() : { name: '', logo: '' };
    if (!u.name && !u.logo) { b?.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'unitBadge'; b.className = 'unit-badge'; bar.insertBefore(b, bar.firstChild); }
    const h = `${u.logo ? `<img src="${u.logo}" alt="">` : ''}${u.name ? `<span>${esc(u.name)}</span>` : ''}`;
    if (b.dataset.h !== h) { b.innerHTML = h; b.dataset.h = h; b.title = u.name || 'Vienības logo'; }
    CP.years?.centerLogo?.(); fit();
  }
  /** Nosaukums nedrīkst pārklāt centrēto CADET.LV logo */
  function fit() {
    const b = U.$('unitBadge'), bar = document.querySelector('.yearbar'), l = bar?.querySelector('.hdr-logo'); if (!b || !bar) return;
    const bl = b.getBoundingClientRect().left, ll = l && l.offsetParent ? l.getBoundingClientRect().left : bar.getBoundingClientRect().right - 260;
    b.style.maxWidth = Math.max(40, Math.round(ll - bl - 18)) + 'px';
  }
  addEventListener('resize', () => requestAnimationFrame(fit));
  async function toPng(file) {
    if (file.size > 8 * 1024 * 1024) throw Error('fails ir lielāks par 8 MB');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(Error('attēlu neizdevās atvērt')); i.src = url; });
      const w0 = img.naturalWidth || 512, h0 = img.naturalHeight || 512, k = Math.min(1, 512 / Math.max(w0, h0));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/png');
    } finally { URL.revokeObjectURL(url); }
  }
  CP.changeHandlers.push(e => {
    const t = e.target, k = t.dataset?.unit; if (!k) return false;
    if (k === 'name') { set({ name: t.value.trim() }); return true; }
    if (k === 'logo' && t.files?.[0]) {
      toPng(t.files[0]).then(logo => { set({ logo }); CP.render(); ui.toast('Vienības logo pievienots', 'ok'); }).catch(err => ui.toast('Logo neizdevās pievienot: ' + err.message, 'err', 8000));
      return true;
    }
    return false;
  });
  A.unitLogoDel = () => { if (!confirm('Noņemt vienības logo?')) return; set({ logo: '' }); CP.render(); };
  CP.afterRender = CP.afterRender || []; CP.afterRender.push(paint);
  /** Logo baitos PDF iegulšanai (vai null) */
  const logoBytes = () => { const l = get().logo; if (!l) return null; const b = atob(l.split(',')[1]); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  CP.unit = { get, card, paint, logoBytes, has: () => { const u = get(); return !!(u.name || u.logo); } };
})(window.CP);
