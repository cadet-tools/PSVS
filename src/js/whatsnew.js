/* =====================================================================
   Jaunumi — atjauninājumu žurnāls lietotājam.
   Pēc atjauninājuma, pirmo reizi atverot rīku, tiek parādīti jaunumi kopš
   iepriekš redzētās versijas. Pilns saraksts: “Par rīku” → Atjauninājumu žurnāls.
   Jauns ieraksts → saraksta SĀKUMĀ (jaunākais pirmais).
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, esc = U.esc;
  /* Bloki pa lielām funkcijām (lietotāja skatījumā). v — jaunākā bloka versija, from — pirmā.
     Jaunumu logā tiek rādīti bloki, kuru v ir jaunāka par iepriekš redzēto versiju. */
  const NEWS = [
    { v: '1.20.1', from: '1.20.0', date: '2026-10-15', title: 'Ārsta izziņas termiņi un dokumentu labošana kartītē', items: [
      'Pievienojot **ārsta izziņu**, rīks prasa **izsniegšanas datumu** un pats aprēķina derīgumu uz **12 mēnešiem**. Termiņu var labot.',
      'Rīks atgādina: **30 dienas pirms** termiņa beigām, **mācību gada beigās** (izziņa der tikai savam mācību gadam) un **jaunā mācību gada sākumā**, ja jaunietis pārcelts, bet izziņa ir no iepriekšējā gada. Ja izziņai nav datuma, rīks lūdz to norādīt.',
      'Kartītes sadaļā **Obligātie dokumenti** pie katra dokumenta ir pogas: **📄 atvērt, ✎ labot, ⇄ aizstāt failu, ✕ dzēst**. Trūkstošajiem dokumentiem ir pogas **＋ Fails** un **＋ Papīrs**.',
      'Aizstājot failu, vecais paliek mapē. Dzēšot tiek noņemts tikai ieraksts, bet fails mapē paliek.',
      'Dokumentu cilnē vairs nav atsevišķas sadaļas “Obligātie dokumenti”, jo tā ir sānjoslā ar visām pogām.'
    ] },
    { v: '1.19.1', date: '2026-10-15', title: 'Skaidrs sākums: vispirms datu mape', items: [
      'Ja **datu mape nav pievienota**, pārskatā redzama tikai mapes pievienošana un 3 soļi, kā to izdarīt.',
      'Bez mapes nevar neko ievadīt: mēģinot pievienot personu, ievadīt anketu, importēt vai sagatavot veidlapu, rīks paskaidro, ka vispirms jāpievieno mape, un piedāvā pogu **Izvēlēties datu mapi**.',
      'Sadaļās, kurām vajag datus, ir paziņojums **“Nav pievienota datu mape”**. Sadaļa **Par rīku** ir pieejama vienmēr.'
    ] },
    { v: '1.19.0', date: '2026-10-15', title: 'DVS reģistrācija pa dokumentiem', items: [
      'Kartītes sadaļā **Reģistrācija** DVS ir sadalīts pa dokumentiem: **Pieteikuma anketa, Līgums, Ārsta izziņa**. Katru atzīmē atsevišķi, kad tas reģistrēts.',
      'Katram dokumentam ir savs **reģistrēšanas datums**, un to var nomainīt. Redzams arī, vai dokuments jau **pievienots rīkā**.',
      'Ja kāds dokuments nav reģistrēts DVS, pārskatā un sadaļā **Uzdevumi** redzams brīdinājums, kurā nosaukti trūkstošie dokumenti.',
      'Personu sarakstā **✓ DVS (visi dok.)** atzīmē visus dokumentus atlasītajām personām. Agrākā vienotā DVS atzīme tiek uzskatīta par “visi reģistrēti”.'
    ] },
    { v: '1.18.3', from: '1.18.2', date: '2026-10-15', title: 'Ērtāki atjauninājumi un sīki uzlabojumi', items: [
      'Atverot rīku, vairs netiek lūgts pārlādēt lapu: tu jau strādā ar jaunāko versiju.',
      'Ja jauna versija iznāk, kamēr strādā, rīks par to paziņo, un lapu var pārlādēt, kad tev ērti.',
      'Šis jaunumu saraksts ir sakārtots pa lielākām funkcijām.',
      'Nometnes žurnālā pie katra dalībnieka ir izvēle **Audzinātājs**. Noklusējumā tur redzams grupas audzinātāja vārds, un citu var izvēlēties tikai šim dalībniekam.'
    ] },
    { v: '1.18.1', from: '1.17.0', date: '2026-10-15', title: 'Jauna veidlapa: Līgums par dalību Jaunsardzē', items: [
      '**Aizpildās pats no kartītes**: jaunieša un pārstāvja vārds, personas kods pa cipariem, adreses, tālruņi un e-pasti. Rīks pats izvēlas līgumu ar pārstāvi (līdz 18 g.) vai ar jaunieti (no 18 g.). Formu (papīrs vai EDOC) izvēlies pats.',
      '**Līguma Nr.** no citas sistēmas ieraksti pats. Ja tā nav, rīks pajautā, vai turpināt. Pārstāvja statusu (māte, tēvs, likumiskais pārstāvis, cits) izvēlies pats.',
      '**Instruktora dati** un paraksta datums jāievada vienreiz, un tie tiek atcerēti. Dati, ko ievadi līgumā, papildina tukšos kartītes laukus.',
      '**Word fails**, ko var labot un pārsūtīt. Kopija tiek saglabāta personas mapē. Līgumu var arī **priekšskatīt un izdrukāt** rīkā.',
      '**✎ Labot** atver līgumu ar saglabātajiem datiem, un **⬆ Ielādēt labotu** ielādē Word programmā labotu failu. Katrs labojums ir jauna versija, un vecās versijas netiek pārrakstītas.',
      'Var izmantot arī **savu līguma veidni** ar atzīmēm.'
    ] },
    { v: '1.18.0', date: '2026-10-15', title: 'Visas veidlapas vienā sarakstā', items: [
      'Lapā **Veidlapas** ir instruktāžas lapas, nometņu žurnāli un līgumi kopā.',
      'Filtri: veids, datums no–līdz, mācību gads un meklēšana pēc personas, nosaukuma vai līguma numura.'
    ] },
    { v: '1.16.3', from: '1.16.2', date: '2026-10-15', title: 'Instruktāžas lapa un nometnes žurnāls: precīzākas veidlapas un drukāšana', items: [
      'Veidlapā ir **tieši tik rindu, cik dalībnieku**. Tukšās rindas norādi pats ar − / +, arī nometnes darbinieku tabulā.',
      'Tukšajās rindās datuma šūna ir tukša.',
      '**Drukāt** parāda priekšskatījumu ar visām lapām, un pārlūka drukas logā uzreiz redzamas veidlapas.'
    ] },
    { v: '1.16.1', from: '1.16.0', date: '2026-10-13', title: 'Piezīmju žurnāls un statuss “Jaunsargs”', items: [
      'Piezīmes kartītē un par mācību gadu ir **ierakstu žurnāls**: katrs ieraksts atsevišķi, ar datumu, un to var labot vai dzēst. Enter saglabā, Shift+Enter sāk jaunu rindu, un lauki izplešas paši.',
      'Statusi: **Kandidāts, Jaunsargs, Pārtraukts**. Jaunai personai statusu var izvēlēties uzreiz pie vārda.',
      'Pēc atjauninājuma tiek parādīts šis **jaunumu logs**. Visi jaunumi ir sadaļā Par rīku.'
    ] },
    { v: '1.15.0', date: '2026-10-13', title: 'Atzīmes “ievadīts DVS” un “ievadīts e-klasē”', items: [
      'Personas kartītē ir sadaļa **Reģistrācija**. Kamēr nav atzīmēts, ka persona ievadīta, redzams brīdinājums.',
      'Atzīmēt var arī vairākas personas uzreiz personu sarakstā. Iestatījumos sistēmu var izslēgt.'
    ] },
    { v: '1.14.4', from: '1.14.1', date: '2026-10-13', title: 'Imports no e-klases un no sava Excel saraksta', items: [
      'Importa logā ir cilne **No e-klases** ar instrukciju un eksporta palīgu.',
      'Excel failā kolonnu nosaukumiem nav jābūt pirmajā rindā. Rīks atrod pareizo darblapu un kolonnas, un tās var labot.',
      'Vecāka vārds un tālrunis vienā šūnā tiek sadalīti. Pārējās kolonnas (līgums, ārsta zīme, MTL) tiek ierakstītas piezīmēs. Esošajām personām var papildināt tukšos laukus.'
    ] },
    { v: '1.14.0', date: '2026-10-13', title: 'Veidlapas: instruktāžas lapa un nometnes žurnāls', items: [
      'Jauna sadaļa **Veidlapas**: izvēlies dalībniekus, un rīks sagatavo drukāšanai gatavu PDF.',
      'Ja dalībniekam trūkst anketas, līguma vai ārsta izziņas, rīkā tiek parādīts brīdinājums. Uz veidlapas tas netiek drukāts.',
      'Nometnes darbinieki un audzinātāji tiek saglabāti nākamajām reizēm. Var izmantot arī savu Word veidni.'
    ] },
    { v: '1.13.0', from: '1.12.0', date: '2026-10-13', title: 'Pulkstenis, taimeris un pauzes', items: [
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

  const block = n => `<section class="news-item"><h4>${esc(n.title)} <small class="muted">${esc(n.from ? n.from + '–' + n.v : n.v)} · ${esc(U.fmtDate(n.date))}</small></h4><ul>${n.items.map(i => `<li>${md(i)}</li>`).join('')}</ul></section>`;
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
