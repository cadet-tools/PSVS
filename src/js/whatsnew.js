/* =====================================================================
   Jaunumi — atjauninājumu žurnāls lietotājam.
   Pēc atjauninājuma, pirmo reizi atverot rīku, tiek parādīti jaunumi kopš
   iepriekš redzētās versijas. Pilns saraksts: “Par rīku” → Atjauninājumu žurnāls.
   Jauns ieraksts → saraksta SĀKUMĀ (jaunākais pirmais).
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, esc = U.esc;
  const NEWS = [
    { v: '1.16.1', date: '2026-10-13', title: 'Statuss: Kandidāts / Jaunsargs', items: [
      'Statusa “Aktīvs” nosaukums tagad ir **Jaunsargs**. Iespējamie statusi: Kandidāts, Jaunsargs, Pārtraukts.',
      'Pievienojot jaunu personu, statusu var izvēlēties uzreiz pie vārda un uzvārda.'
    ] },
    { v: '1.16.0', date: '2026-10-13', title: 'Piezīmju žurnāls un jaunumi', items: [
      'Piezīmes kartītē un piezīmes par mācību gadu tagad ir **ierakstu žurnāls**. Katra saglabātā piezīme parādās atsevišķi ar datumu, un to var **labot ✎** vai **dzēst ✕**.',
      'Teksta lauki izplešas paši, kamēr raksti. **Enter** saglabā, **Shift+Enter** sāk jaunu rindu.',
      'Agrāk ievadītās piezīmes, arī piezīmes no Excel importa, ir pārnestas uz žurnālu. Pirms pārnešanas rīks pats saglabāja datu rezerves kopiju.',
      'Šis logs: pēc katra atjauninājuma šeit būs īss jaunumu apraksts. Visi jaunumi ir sadaļā **Par rīku**.'
    ] },
    { v: '1.15.0', date: '2026-10-13', title: 'Atzīmes “ievadīts DVS” un “ievadīts e-klasē”', items: [
      'Personas kartītē ir sadaļa **Reģistrācija**. Kamēr nav atzīmēts, ka persona ievadīta DVS un e-klasē, pārskatā redzams brīdinājums.',
      'Personu sarakstā atlasītajām personām var atzīmēt **✓ DVS** vai **✓ e-klase** uzreiz visām.',
      'Iestatījumos var izslēgt sistēmu, kurai nav jāseko.'
    ] },
    { v: '1.14.4', date: '2026-10-13', title: 'Imports no tava Excel saraksta', items: [
      'Kolonnu nosaukumiem nav jābūt pirmajā rindā. Rīks pats atrod pareizo darblapu un rindu, un kolonnas var pārbaudīt un labot.',
      'Vecāka vārds un tālrunis vienā šūnā tiek sadalīti. Tiek nolasīts arī vecāka personas kods, apliecības numurs un statuss.',
      'Kolonnas, piem., Līgums, Ārsta zīme un MTL, tiek ierakstītas piezīmēs, lai nekas nepazustu.'
    ] },
    { v: '1.14.1', date: '2026-10-13', title: 'Imports no e-klases', items: [
      'Importa logā ir cilne **No e-klases** ar soli pa solim instrukciju un eksporta palīgu.',
      'Personām, kas jau ir uzskaitē, imports var papildināt tukšos laukus. Esošie dati netiek mainīti.'
    ] },
    { v: '1.14.0', date: '2026-10-13', title: 'Veidlapas: instruktāžas lapa un nometnes žurnāls', items: [
      'Jauna sadaļa **Veidlapas**: izvēlies dalībniekus, un rīks sagatavo drukāšanai gatavu PDF.',
      'Ja dalībniekam trūkst anketas, līguma vai ārsta izziņas, rīkā tiek parādīts brīdinājums. Uz veidlapas tas netiek drukāts.',
      'Nometnes darbinieki un audzinātāji tiek saglabāti nākamajām reizēm. Var izmantot arī savu Word veidni.'
    ] },
    { v: '1.13.0', date: '2026-10-13', title: 'Pulkstenis, hronometrs un taimeris', items: [
      'Pārskatā ir pulkstenis ar četrām ciparnīcām, hronometru un taimeri nodarbībām.',
      'Pēc 40 min darba rīks atgādina paņemt pauzi.'
    ] },
    { v: '1.11.0', date: '2026-10-12', title: 'Jaunais izskats', items: [
      'Gaišā un tumšā tēma un akcenta krāsa: **Iestatījumi → Izskats**.',
      'Jaunsarga apliecības sadaļa personas kartītē.'
    ] }
  ];
  CP.NEWS = NEWS;
  const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
  const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const KEY = 'cp-news-seen';
  const getSeen = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const setSeen = v => { try { localStorage.setItem(KEY, v); } catch (e) { /* */ } };

  const block = n => `<section class="news-item"><h4>${esc(n.title)} <small class="muted">${esc(n.v)} · ${esc(U.fmtDate(n.date))}</small></h4><ul>${n.items.map(i => `<li>${md(i)}</li>`).join('')}</ul></section>`;
  function show(list, title = 'Jaunumi rīkā') {
    let d = U.$('newsDialog');
    if (!d) { d = document.createElement('dialog'); d.id = 'newsDialog'; d.className = 'wide'; document.body.appendChild(d); }
    d.innerHTML = `<header class="dlg-head"><h2>${CP.ic('bell', '🔔')} ${esc(title)}</h2><button type="button" class="ghost" data-close="newsDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body news">${list.map(block).join('')}</div>
      <footer class="dlg-foot"><button type="button" class="ghost" data-act="newsAll">Visi atjauninājumi</button><span class="grow"></span><button type="button" class="mainbtn" data-close="newsDialog">Sapratu</button></footer>`;
    if (!d.open) d.showModal();
  }
  CP.actions.newsAll = () => show(NEWS, 'Atjauninājumu žurnāls');
  /** Pēc atjauninājuma — vienreiz, kad dati ielādēti */
  let checked = false;
  function check() {
    if (checked || !S.root || !S.db || U.qs('dialog[open]')) return;
    checked = true;
    let seen = getSeen();
    if (!seen) {
      if (!(S.db.people || []).length) { setSeen(CP.VERSION); return; }   // jauns lietotājs — nav ko rādīt
      seen = '1.13.1';
    }
    const fresh = NEWS.filter(n => cmp(n.v, seen) > 0 && cmp(n.v, CP.VERSION) <= 0);
    if (!fresh.length) { setSeen(CP.VERSION); return; }
    // gaida, kamēr citi logi (piem., paziņojumi) aizvērti; par redzētu atzīmē tikai pēc parādīšanas
    let tries = 0;
    const tick = () => {
      if (U.qs('dialog[open]')) { if (++tries < 600) setTimeout(tick, 1000); return; }
      show(fresh, fresh.length === 1 ? `Jaunumi — ${fresh[0].v}` : 'Jaunumi kopš pēdējās reizes'); setSeen(CP.VERSION);
    };
    setTimeout(tick, 600);
  }
  CP.afterRender = CP.afterRender || [];
  CP.afterRender.push(check);
  CP.news = { show, list: NEWS, html: () => NEWS.map(block).join('') };
})(window.CP);
