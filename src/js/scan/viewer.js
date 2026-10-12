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
