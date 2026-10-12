/* =====================================================================
   Par rīku — kam tas paredzēts, kā sākt, kur glabājas dati, izstrādātājs.
   ===================================================================== */
(function (CP) {
  'use strict';
  const S = CP.state, ui = CP.ui, esc = CP.util.esc;
  const ic = (n, f = '') => CP.ic(n, f);

  const STEPS = [
    ['Atver rīku', 'Google Chrome vai Microsoft Edge pārlūkā atver <b>cadet-tools.github.io/PSVS</b>. Ja vēlies, Chrome adreses joslā spied “Instalēt”. Tad rīkam būs savs logs un ikona, un tas strādās arī bez interneta.'],
    ['Izveido datu mapi', 'Datorā izveido tukšu mapi, piemēram, <i>Dokumenti\\CADET PERSONALS</i>, vai mapi uz šifrētas zibatmiņas. Tajā glabāsies uzskaites fails, personu dokumenti un rezerves kopijas.'],
    ['Pieslēdz mapi', 'Pārskatā spied <b>Izvēlēties datu mapi</b> vai ievelc mapi no File Explorer. Ja Chrome jautā, atļauj rediģēt failus. Nākamreiz rīks mapi atcerēsies pats.'],
    ['Iestati rīku', 'Iestatījumos pārbaudi mācību gadu, obligātos dokumentus, ziņu veidnes un valsts kodu tālruņiem. Tur var izvēlēties arī tēmu un akcenta krāsu.'],
    ['Pievieno jauniešus', 'Personas pievieno ar <b>Jauna persona</b>, no anketas (<b>Ievadīt no anketas</b>: Word, PDF, eDoc vai skenējums) vai ar <b>Imports</b> no Excel vai e-klases saraksta. Grupu var piespraust ar 📌, lai tā nebūtu jāraksta katru reizi.'],
    ['Pievieno dokumentus', 'Personas kartītē pievieno anketas, līgumus, ārsta izziņas un MTL aprites lapas. Faili tiek nokopēti personas mapē, un tos var atvērt tieši no kartītes.'],
    ['Strādā ikdienā', 'Ekipējuma izsniegšana un atdošana, jaunsarga apliecības, ziņas WhatsApp, SMS vai e-pastā (arī visai grupai) un kontakti telefonā ar vecāku numuriem. Viss, kas prasa uzmanību, parādās sadaļā <b>Uzdevumi</b> un paziņojumos, atverot rīku.'],
    ['Rūpējies par kopijām', 'Rīks pats veido ikdienas JSON kopijas mapē <i>_rezerves</i>. Turi datu mapes otru kopiju citā vietā (otrā zibatmiņā vai drošā mapē) un atjauno to regulāri.']
  ];
  const FEATURES = [
    ['users', 'Personu reģistrs', 'Kartītes ar visiem datiem, vecākiem, saistībām, statusiem un vēsturi pa mācību gadiem.'],
    ['scan', 'Anketu nolasīšana', 'Lauki tiek aizpildīti no Word, PDF un eDoc anketām, arī no skenējumiem un fotogrāfijām. Var izmantot savas veidnes.'],
    ['file', 'Dokumenti', 'Obligāto dokumentu kontrole, derīguma termiņi un faili personas mapē.'],
    ['backpack', 'Ekipējums un MTL', 'Izsniegts, atdots, izmēri, daudzums un atgādinājums atjaunot MTL aprites lapu.'],
    ['idcard', 'Jaunsarga apliecības', 'Numuri, statusi, derīgums un brīdinājumi par dublikātiem.'],
    ['message', 'Saziņa', 'WhatsApp, SMS, e-pasts un zvans no kartītes, ziņas grupai un kontakti uz telefonu ar QR kodu.'],
    ['bell', 'Atgādinājumi', 'Trūkstošie dokumenti, termiņi, vecuma izmaiņas, sakrītoši tālruņi un uzdevumi.'],
    ['shield', 'Dati pie tevis', 'Nekas netiek sūtīts uz serveri. Dati glabājas tikai tavā izvēlētajā mapē.']
  ];

  CP.pages.about = {
    render() {
      const web = CP.WEB, ch = CP.CHANNEL === 'test';
      return `<div class="page narrow about">${ui.backBtn()}
        <section class="card about-hero">
          <img class="about-logo" src="PS_LOGO.png" alt="">
          <div><h1>CADET PERSONĀLS</h1>
            <p class="about-lead">Jaunsardzes instruktora darba rīks: jauniešu uzskaite, dokumenti, ekipējums un saziņa vienuviet, bez mapju meklēšanas.</p>
            <p class="muted small">Versija ${esc(CP.VERSION)}${ch ? ' · testa versija' : ''} · datu shēma v${CP.SCHEMA}${web ? ' · tīmekļa versija' : ' · lokālā versija'}</p></div>
        </section>

        <div class="about-grid">
          <section class="card"><h3>${ic('users')}Kam paredzēts</h3>
            <p>Jaunsardzes instruktoriem un vienību vadītājiem, kuri strādā ar jauniešu grupām. Rīks palīdz:</p>
            <ul class="about-list"><li>uzturēt kārtībā jaunsargu un viņu vecāku datus;</li><li>redzēt, kuriem trūkst dokumentu vai jāatdod ekipējums;</li><li>ātri sazināties ar jaunieti vai vecākiem;</li><li>sagatavot jaunu mācību gadu, nepazaudējot vēsturi.</li></ul>
          </section>
          <section class="card"><h3>${ic('shield')}Kur glabājas dati</h3>
            <p>Tikai tavā datorā vai zibatmiņā, mapē, kuru izvēlies pats. Rīks darbojas pārlūkā un uz serveriem neko nesūta. Citi lietotāji tavus datus neredz.</p>
            <p class="muted small">Izņēmums: ja Iestatījumos ieslēdz Google Vision rokraksta atpazīšanu, anketas attēls tiek nosūtīts Google. Pēc noklusējuma tā ir izslēgta.</p>
          </section>
        </div>

        <section class="card"><h3>${ic('task')}Kā sākt lietot</h3>
          <ol class="steps">${STEPS.map(([t, d]) => `<li><b>${t}</b><p>${d}</p></li>`).join('')}</ol>
          <div class="actions" style="margin-top:6px">${!S.root ? `<button class="mainbtn" data-act="pickRoot">${ic('folder', '📁')} Izvēlēties datu mapi</button>` : ''}<button data-page="settings">${ic('sliders')} Atvērt iestatījumus</button></div>
        </section>

        <section class="card"><h3>${ic('grid')}Ko rīks prot</h3>
          <div class="feat">${FEATURES.map(([i, t, d]) => `<div class="feat-item"><span class="feat-ic">${ic(i)}</span><div><b>${t}</b><p>${d}</p></div></div>`).join('')}</div>
        </section>

        <section class="card about-dev"><h3>${ic('userCheck')}Izstrādātājs</h3>
          <p><b>Jānis Eglis</b> — Jaunsardzes instruktors un skolotājs. Rīks radīts paša ikdienas darbam un tiek pilnveidots, lai atvieglotu arī citu instruktoru darbu.</p>
          <p class="muted small">Atjauninājumi ielādējas automātiski. Jaunas iespējas vispirms tiek pārbaudītas testa versijā, un tikai tad nonāk šeit. Datu fails pirms atjaunināšanas tiek saglabāts kopijā.${web ? ' Avota kods: <a href="https://github.com/cadet-tools/PSVS" target="_blank" rel="noopener">github.com/cadet-tools/PSVS</a>.' : ''}</p>
        </section>
      </div>`;
    }
  };
})(window.CP);
