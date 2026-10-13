/* =====================================================================
   E-klases personas lietu eksporta palīgs.
   Skripts tiek palaists lietotāja paša e-klases cilnē (F12 → Console).
   Tas nolasa tikai atvērtajā personas lietā redzamos laukus un saglabā CSV
   lietotāja datorā. Nekas netiek sūtīts internetā.
   Savāktie ieraksti glabājas šīs cilnes sessionStorage, tāpēc tie nepazūd,
   ja e-klase pārlādē lapu (skriptu vienkārši jāielīmē vēlreiz).
   ===================================================================== */
(function (CP) {
  'use strict';

  function eklaseExport() {
    "use strict";
    const ID = "cadet-eklase-export-panel", KEY = "cadet-eklase-export";
    if (document.getElementById(ID)) { alert("CADET PERSONĀLS panelis jau ir atvērts."); return; }

    const clean = v => String(v ?? "").replace(/\s+/g, " ").trim();
    const records = new Map();
    let saved = {};
    try { saved = JSON.parse(sessionStorage.getItem(KEY) || "{}"); } catch (e) { saved = {}; }
    for (const [k, v] of saved.records || []) records.set(k, v);
    const persist = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ records: [...records], group: group.value, school: school.value })); } catch (e) { /* */ } };

    function getFields() {
      return [...document.querySelectorAll("input, select, textarea, [role='combobox']")]
        .filter(el => el.getClientRects().length > 0 && !el.closest("#" + ID));
    }

    function capture() {
      const fields = getFields();
      if (fields.length !== 36 || !fields[4]?.classList.contains("InputText") || !fields[16]?.classList.contains("DateField__input")) {
        throw new Error("Neatpazīstu personas lietu. Atrasti " + fields.length + " lauki (sagaidāmi 36). Atver skolēna personas lietu un mēģini vēlreiz.");
      }
      const v = i => clean(fields[i]?.value);
      const name = (i, j) => [v(i), v(j)].filter(Boolean).join(" ");
      if (!v(4) || !v(6)) throw new Error("Nav atrasts skolēna vārds vai uzvārds.");
      const father = name(24, 25), mother = name(27, 28), other = name(30, 31);
      return {
        "Vārds": v(6), "Uzvārds": v(4), "Dzimšanas datums": v(16), "Personas kods": v(5),
        "Grupa": group.value.trim(), "Klase": "", "Skola": school.value.trim(),
        "Tālrunis": v(10), "E-pasts": v(35),
        "Vecāks": mother || father || other, "Vecāka tālrunis": mother ? v(29) : father ? v(26) : v(32), "Vecāka e-pasts": "",
        "Piezīmes": v(7),
        "Tēvs": father, "Tēva tālrunis": v(26), "Māte": mother, "Mātes tālrunis": v(29),
        "Cita atbildīgā persona": other, "Citas personas tālrunis": v(32),
        "Deklarētā adrese": v(33), "Faktiskā adrese": v(34),
        "Personas lietas numurs": v(9), "Ieskaitīšanas datums": v(14), "Izslēgšanas datums": v(15), "Dzimšanas apliecības numurs": v(19)
      };
    }

    const panel = document.createElement("div");
    panel.id = ID;
    Object.assign(panel.style, { position: "fixed", top: "65px", right: "15px", width: "300px", zIndex: "2147483647", background: "#172433", color: "white", padding: "16px", borderRadius: "12px", boxShadow: "0 8px 35px #0008", font: "14px Arial" });
    const inp = "width:100%;box-sizing:border-box;padding:8px;margin:5px 0 10px;color:#000";
    const btn = bg => "width:100%;padding:11px;margin-bottom:8px;background:" + bg + ";color:white;border:0;border-radius:6px;cursor:pointer";
    panel.innerHTML =
      '<h3 style="margin:0 0 8px">CADET PERSONĀLS</h3><p style="margin:0 0 10px">E-klases personas datu eksports</p>' +
      '<label>Grupa (nav obligāti)</label><input id="cp-group" style="' + inp + '">' +
      '<label>Skola (nav obligāti)</label><input id="cp-school" style="' + inp + '">' +
      '<p id="cp-count">Savāktas personas: 0</p>' +
      '<button id="cp-add" style="' + btn("#15866d") + '">+ Pievienot personu</button>' +
      '<button id="cp-save" style="' + btn("#345b79") + '">Lejupielādēt CSV</button>' +
      '<button id="cp-close" style="' + btn("#34404b") + '">Aizvērt paneli</button>' +
      '<p id="cp-status" style="font-size:12px;margin:4px 0 0"></p>';
    document.body.appendChild(panel);

    const group = panel.querySelector("#cp-group"), school = panel.querySelector("#cp-school");
    const count = panel.querySelector("#cp-count"), status = panel.querySelector("#cp-status");
    group.value = saved.group || ""; school.value = saved.school || "";
    group.oninput = school.oninput = persist;
    const showCount = () => { count.textContent = "Savāktas personas: " + records.size; };
    const update = (msg, err = false) => { status.textContent = msg; status.style.color = err ? "#ff9999" : "#a9e1c1"; };

    panel.querySelector("#cp-add").onclick = () => {
      try {
        const p = capture();
        const key = p["Personas kods"] || [p["Vārds"], p["Uzvārds"], p["Dzimšanas datums"]].join("|").toLocaleLowerCase("lv");
        if (records.has(key) && !confirm("Persona jau ir sarakstā. Atjaunināt?")) return;
        records.set(key, p); persist(); showCount();
        update(p["Vārds"] + " " + p["Uzvārds"] + " pievienots. Atver nākamo skolēnu.");
      } catch (err) { update(err.message, true); }
    };

    panel.querySelector("#cp-save").onclick = () => {
      if (!records.size) { update("Nav pievienota neviena persona.", true); return; }
      const data = [...records.values()], headers = Object.keys(data[0]);
      const cell = value => { let s = String(value ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
      const csv = "﻿" + [headers, ...data.map(p => headers.map(h => p[h] ?? ""))].map(r => r.map(cell).join(";")).join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url; a.download = "CADET_PERSONALS_EKLASE_" + new Date().toISOString().slice(0, 10) + ".csv";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      update("Lejupielādētas " + data.length + " personas. Tagad importē failu CADET PERSONĀLS.");
    };

    panel.querySelector("#cp-close").onclick = () => {
      if (records.size && !confirm("Aizverot panelis aizmirsīs savāktās personas. Vai CSV jau ir lejupielādēts?")) return;
      records.clear();
      try { sessionStorage.removeItem(KEY); } catch (e) { /* */ }
      panel.remove();
    };

    showCount();
    update(records.size ? "Atjaunotas iepriekš savāktās personas. Vari turpināt." : "Gatavs. Atver skolēna personas lietu un spied “+ Pievienot personu”.");
  }

  CP.EKLASE_SCRIPT = '(' + eklaseExport.toString() + ')();';
})(window.CP);
