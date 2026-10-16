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
    { v: '1.31.1', from: '1.31.0', date: '2026-10-16', title: 'Ekrāna bloķēšana ar PIN kodu', items: [
      'Ja rīku kādu laiku nelieto, ekrānu aizsedz rīka **lielais pulkstenis**, un jaunsargu dati nav redzami. Noklusēti tas notiek pēc **5 minūtēm**. Laiku var mainīt **Iestatījumos → Pulkstenis un pauzes → Liels pulkstenis**.',
      '**PIN kods** (4–8 cipari): to prasa, izejot no pulksteņa un atverot rīku. Iestatīt, mainīt vai noņemt var Iestatījumos. PIN glabājas tikai tavā datorā šifrētā veidā.',
      '**Aizmirsi PIN?** Rīks nosūta 6 ciparu kodu uz tavu **atkopšanas e-pastu**, kas iestatīšanas laikā tiek apstiprināts ar kodu. Ja e-pasta nav, bloķēšanu var atiestatīt, no jauna izvēloties datu mapi. Dati netiek dzēsti.',
      'Bloķēt uzreiz: **Ctrl+Shift+L** vai poga “Bloķēt tagad”. Pēc 5 nepareiziem PIN mēģinājumiem ievade uz laiku tiek atslēgta.'
    ] },
    { v: '1.30.1', from: '1.30.0', date: '2026-10-16', title: 'Jauna sadaļa “Ziņot”', items: [
      'Kreisajā izvēlnē ir jauna sadaļa **“⚑ Ziņot”**. Tur var nosūtīt rīka izstrādātājam **kļūdu, ieteikumu, atsauksmi vai jautājumu**.',
      'Izvēlies tēmu, īsi uzraksti, par ko ir ziņojums, un apraksti situāciju. Teksts saglabājas, arī ja lapu aizver.',
      '**Ekrānuzņēmumi:** ievelc attēlu, ielīmē ar **Ctrl+V** (Windows: **Win+Shift+S** izgriež ekrāna daļu) vai spied **“📷 Uzņemt rīka ekrānu”**. Ar pēdējo atver vajadzīgo vietu rīkā un spied “Uzņemt” vai “Pēc 5 s”.',
      '🔒 **Personu datus attēlā var aizklāt:** spied **“✎ Aizklāt”** un ar peli pārvelc pāri vārdiem un personas kodiem. Nosūtīts tiek tikai aizklātais attēls. Ja attēlā nekas nav aizklāts, rīks pirms sūtīšanas pajautā.',
      'Pēc izvēles: tavs vārds un kontakts atbildei, kā arī tehniskā informācija (versija, pārlūks, lapa, pēdējās kļūdas), kas palīdz kļūdu atrast ātrāk.',
      'Ziņojums ar vienu klikšķi **“➤ Nosūtīt”** aiziet tieši izstrādātājam. Ja nav interneta, to var **saglabāt failā** un nosūtīt citādi.'
    ] },
    { v: '1.29.0', date: '2026-10-16', title: 'Rezerves kopija tieši Google Drive', items: [
      'Šifrēto rezerves kopiju tagad var glabāt **tieši Google Drive**: rīks pieslēdzas tavam Google kontam. **Nekas nav jāinstalē**, un datorā nav vajadzīga Google Drive programma vai papildu mape.',
      'Iestatīšana: **Iestatījumi → Šifrētā rezerves kopija → Iestatīt** → izvēlies **“☁ Google Drive”**. Vajag to pašu **Google Client ID**, kas kalendāram. Google projektā papildus jāieslēdz **Google Drive API** (palīgā “? Kā iegūt” tas ir 2. solis).',
      'Kopija tiek **šifrēta tavā datorā** un tikai tad nosūtīta. Google redz tikai nesalasāmus failus. Rīks Google Drive redz **tikai savu mapi CADET_rezerve**, nevis citus tavus failus.',
      'Google savienojums ir derīgs apmēram **1 stundu**. Kad tas beidzies un ir nenosūtītas izmaiņas, **augšā parādās josla** ar pogu **“Pieslēgties”**: viens klikšķis, un kopija aiziet uzreiz. Tā pati pieslēgšanās der arī **Google kalendāram**.',
      '**Jauns vai pazaudēts dators:** sākuma lapā **“🔐 Atjaunot no šifrētās kopijas” → “☁ Google Drive”**, ievadi Client ID (tas ir uz izdrukātās atkopšanas koda lapas), pieslēdzies Google, ievadi paroli vai atkopšanas kodu un izvēlies tukšu mapi.',
      'Kopija mapē datorā vai zibatmiņā strādā tāpat kā līdz šim. Tavi esošie iestatījumi netiek mainīti.'
    ] },
    { v: '1.28.0', date: '2026-10-16', title: 'Šifrētā rezerves kopija (piem., Google Drive)', items: [
      '**Iestatījumos** ir jauna sadaļa **“Šifrētā rezerves kopija”**. Viss datu mapes saturs (personas, dokumenti, veidlapas, veidnes, arī papildu mapju dokumenti) tiek saglabāts **šifrētā veidā** citā mapē, piem., **Google Drive** mapē datorā. Darba mapes faili netiek mainīti.',
      'Kopija tiek **papildināta automātiski**, kamēr rīks ir atvērts: tikai jaunie un mainītie faili. Pogu **“Izveidot kopiju tagad”** var spiest jebkurā brīdī. Ja kopija ilgi nav atjaunota, parādās brīdinājums.',
      'Ja aizmirsi paroli: **paroles mājiens**, **atkopšanas kods** (izdrukā un glabā drošā vietā) un iespēja **savā datorā nomainīt paroli bez vecās**.',
      '**Pazaudēts vai jauns dators:** sākuma lapā spied **“🔐 Atjaunot no šifrētās kopijas”**, ievadi paroli vai atkopšanas kodu un izvēlies tukšu mapi. Viss tiek atjaunots tieši tāds pats, katrs fails pārbaudīts ar kontrolsummu.',
      'Kopijas mapē ir arī **ATJAUNOT.html**: ar to var atšifrēt kopiju pat bez rīka.',
      'Google un citi neredz neko: ne vārdus, ne failu nosaukumus. Šifrēšana: AES-256.'
    ] },
    { v: '1.27.1', from: '1.27.0', date: '2026-10-16', title: 'Dalībnieki no citām vienībām', items: [
      'Instruktāžas lapā un nometnes žurnālā var iekļaut **jaunsargus no citām vienībām**. Pasākuma logā ir jauna sadaļa **“Dalībnieki no citām vienībām”**: ievelc tajā otra instruktora atsūtīto failu, un viņa jaunsargi (un nometnei arī darbinieki) nonāk tavā dokumentā kopā ar taviem.',
      '**Ja otrs instruktors lieto CADET PERSONĀLS:** viņš savā pasākumā izvēlas savus dalībniekus un spiež **“⇪ Nosūtīt savus dalībniekus citam instruktoram”**. Failu var **aizsargāt ar paroli** (paroli pasaka atsevišķi, piem., piezvanot).',
      '**Ja rīka nav:** nosūti viņam **“⇩ Excel veidni”**. Viņš to aizpilda un atsūta atpakaļ, bet tu to ievelc tāpat. Der arī cits Excel vai CSV saraksts ar kolonnām Vārds, Uzvārds, Personas kods…',
      'Citu vienību jaunsargi **glabājas tikai šajā pasākumā**. Tie neparādās tavā personu sarakstā, pārskatā vai brīdinājumos. Ja kāds jau ir tavā sarakstā (tas pats personas kods), rīks izvēlas tavu ierakstu, bet atkārtots fails datus atjauno, nevis dublē.',
      'Sadaļa atrodas pasākuma loga **kreisajā pusē** zem pasākuma datiem, nevis zem garā jaunsargu saraksta.',
      'Rīks neko nesūta internetā. Failu instruktori nodod paši.',
      'Personu importā tagad atpazīst arī kolonnas **“Otrs vecāks”** un **“Otra vecāka tālrunis”**.'
    ] },
    { v: '1.26.3', from: '1.26.0', date: '2026-10-16', title: 'Sakārtota grupas izvēle un dzēšanas logs', items: [
      'Personas formā pie lauka **Grupa** poga **▾** atver rīka stila sarakstu tieši zem lauka. Tajā redzamas grupas ar personu skaitu, **“— bez grupas —”** un lauks **jaunai grupai** turpat sarakstā.',
      'Rakstot grupas laukā, saraksts **filtrējas**. Ja tādas grupas vēl nav, var spiest **“＋ Izveidot grupu …”**. Darbojas arī ar tastatūru: ↑↓ un Enter izvēlas, Esc aizver.',
      '**Grupas dzēšanas logā** ir divas skaidras izvēles: **“Pārcelt uz citu grupu”** ar grupas sarakstu un **“Atstāt bez grupas”**.',
      'Jauns noklusējuma izskats: **tumšā tēma ar zilu akcentu**. Ja krāsu jau esi izvēlējies pats (Iestatījumi → Izskats), tā paliek nemainīta.'
    ] },
    { v: '1.26.1', from: '1.26.0', date: '2026-10-16', title: 'Notikuma kartīte kalendārā', items: [
      'Klikšķis uz notikuma kalendārā tagad atver **kartīti tikai skatīšanai**: datums, laiks un ilgums, vieta, piezīmes, atgādinājumi, atkārtošanās un vai notikums ir importēts vai Google kalendārā. Nejauši neko izmainīt vairs nevar.',
      'Labot var ar pogu **✎ Labot** kartītē vai ar **✎** sarakstā. Kartītē ir arī **⧉ Kopēt** uz nākamo nedēļu.',
      'Tāpat kartīte atveras no pārskata “Grafiks — tuvākās 7 dienas”, stundu kopsavilkuma un atgādinājuma paziņojuma.'
    ] },
    { v: '1.26.0', from: '1.25.0', date: '2026-10-16', title: 'Grupu pārvaldība un līdzenāks pārskats', items: [
      'Pārskata kartītē **Grupas** ir poga **＋ Jauna grupa**, bet pie katras grupas pogas **✎ pārdēvēt** un **✕ dzēst**. Jaunu grupu var izveidot arī tad, ja tajā vēl nav personu.',
      'Jaunā grupa uzreiz parādās **visās izvēlnēs**: personas kartītē, sarakstu filtrā, apmeklējumā, saziņā, importā un pārcelšanā uz citu gadu.',
      'Personas formā pie lauka **Grupa** ir izvēlne **▾**: tajā ir visas grupas, **“— bez grupas —”** un **“＋ Jauna grupa…”**. Grupu joprojām var arī ierakstīt.',
      '**Dzēšot grupu, personas netiek dzēstas.** Tās var pārcelt uz citu grupu vai atstāt bez grupas. Iepriekšējo mācību gadu dalība netiek mainīta.',
      '**Pārdēvējot** vai ierakstot jau esošas grupas nosaukumu, grupas tiek **apvienotas**. Apmeklējuma atzīmes un nodarbību dienas pāriet līdzi. Visas izmaiņas redzamas personu vēsturē.',
      'Pārskatā kartītēm ir noteiktas vietas: **Grafiks un Grupas** pa kreisi, **Uzdevumi** vidū, **Trūkstošie dokumenti** pa labi. Kolonnas beidzas vienā līmenī, un atstarpe līdz “Pēdējām izmaiņām” ir vienāda, lai cik grupu būtu.',
      'Salabots: lapā **Veidlapas** (un citās lapās, kur platā kartīte ir augšā) kartītes vairs neuzklājas cita citai.'
    ] },
    { v: '1.24.1', from: '1.24.0', date: '2026-10-16', title: 'Sakārtots pārskats un ērtāks grafika imports', items: [
      '**Pārskata** kartītes tagad saliekas cieši cita zem citas kolonnās, bez tukšām starpām. Katra nākamā kartīte nonāk īsākajā kolonnā. Tas pats izkārtojums darbojas arī citās lapās ar kartītēm.',
      '**“Trūkstošie dokumenti”** un **“Uzdevumi un brīdinājumi”** rāda tik ierakstu, cik ietilpst līdz garākās kolonnas apakšai, pārējie ir zem **“… un vēl N →”**. Tā visu kolonnu apakšas ir līdzenas.',
      '**“Pēdējās izmaiņas”** stiepjas pa visu platumu zem visām kartītēm, divās kolonnās.',
      'Grafika pogai **Imports** ir uznirstošais logs: ievelc **darba plānošanas matricu** (darba uzskaites .xlsm vai .xlsx) laukumā vai spied **“Izvēlēties failu…”**. Logā īsi paskaidrots, kas notiks.'
    ] },
    { v: '1.23.3', from: '1.23.0', date: '2026-10-15', title: 'Kontaktstundas un datumi no piezīmēm', items: [
      'Importējot “Nodarbību saraksts”, rīks nolasa arī **datumus piezīmju kolonnā**: e-VAM **kontaktstundas** (piem., “08.,27.OKT”), **aizvietošanas** (“02.11. aizvieto …”) un mentorēšanas dienas. Tām tiek izmantots tās pašas rindas laiks un vieta.',
      'Ja piezīmē rakstīts **“nenotiek”** (piem., “nenotiek 16.11”), šis datums netiek ielikts kalendārā vai tiek no tā noņemts.',
      'Katrai dienai tiek pievienota tieši tās piezīme, bet vispārīgās piezīmes visām rindas nodarbībām.',
      'Jaunsargu grupu nodarbības tagad sauc **“Jaunsardzes nodarbība 2.4.”**. Jau importētās tiks pārdēvētas nākamajā importā (kā “mainīts”, nevis no jauna).',
      'Stundu kopsavilkumā rādītājs **“Kontaktstundas (nodarbības + VAM)”**.',
      '**Google kalendāra savienošana** pārveidota par 5 skaidriem soļiem. Katrā solī ir poga **↗ Atvērt**, kas uzreiz atver vajadzīgo Google lapu, un adresēm ir pogas **⧉ Kopēt**. Pēc katra soļa vari atzīmēt **“Izdarīts”**.',
      'Pēdējā solī Client ID var ielīmēt tieši instrukcijā un spiest **“Saglabāt un sinhronizēt”**. Rīks brīdina, ja nejauši ielīmēts Client secret.'
    ] },
    { v: '1.23.0', date: '2026-10-15', title: 'Darba grafiks no Excel uzskaites tabulas', items: [
      'Sadaļā **Grafiks** var **ievilkt** instruktora darba uzskaites Excel failu (**.xlsm** / .xlsx) vai izvēlēties to ar pogu **Imports**. Rīks pats saliek kalendāru.',
      'Tiek nolasīta lapa **“Darba plāns_secīgi”** (pasākumi, semināri, metodiskais darbs, prombūtne ar datumiem un laikiem) un lapa **“Nodarbību saraksts”** (regulārās nodarbības no mēnešu kolonnām, ar laiku un vietu). Slēptās palīglapas un tukšās rindas ar “0” tiek izlaistas.',
      'Veidi tiek noteikti automātiski: nodarbība, VAM nodarbība, pasākums, nometne, novada pārvaldes darbs, metodiskais darbs, prombūtne. Piezīmēs tiek ielikta grupa, vadītājs, atbalsta personāls un dalībnieku skaits.',
      '**Atkārtots imports:** ievelc atjaunoto failu vēlreiz. Pirms izmaiņām rīks parāda, kas ir **jauns**, kas **mainīts** (piem., laiks 14:00 → 15:00) un kas **failā vairs nav**. Katru izmaiņu var atķeksēt. Rīkā paša izveidotie notikumi netiek aiztikti.',
      'Pēc noklusējuma tiek importēti tikai **šodienas un nākamie** notikumi, pagājušos var pievienot ar ķeksīti. Atvaļinājumus var neimportēt.',
      'Ja Google kalendārs ir savienots, importa izmaiņas aiziet arī uz to. Fails netiek saglabāts un nekur nosūtīts: tiek nolasīti tikai grafika lauki.'
    ] },
    { v: '1.22.0', date: '2026-10-15', title: 'Grafiks: darba kalendārs ar atgādinājumiem un Google kalendāru', items: [
      'Jauna sadaļa **Grafiks** (📅 kreisajā joslā). Tas ir instruktora darba kalendārs: **nodarbības, VAM nodarbības, pasākumi, nometnes, sacensības, sapulces** un administratīvais darbs, katram veidam sava krāsa.',
      'Skati: **Mēnesis**, **Nedēļa** (pa stundām, ar sarkanu līniju “tagad”) un **Saraksts**. Klikšķis uz dienas vai stundas izveido notikumu, klikšķis uz notikuma to atver labošanai.',
      'Notikumam ir **datums, laiks no–līdz** (vai visa diena, arī vairākas dienas, piem., nometnei), vieta un piezīmes. **Atkārtot katru nedēļu** izveido visu sēriju uzreiz, un izmaiņas var piemērot arī nākamajiem sērijas notikumiem.',
      '**Atgādinājumi** (piem., 1 h un 1 dienu iepriekš) parādās rīkā un, ja atļauj, arī **uz darbvirsmas**. Pēc izvēles uz darbvirsmas reizi dienā parādās arī jaunie brīdinājumi par dokumentiem un kavējumiem.',
      '**Google kalendārs:** poga “Sinhronizēt ar Google” izveido atsevišķu kalendāru “Jaunsardze — darba grafiks” un tālāk pati atjauno izmaiņas, tāpēc grafiks un atgādinājumi ir redzami arī **telefonā**. Vienreizējai iestatīšanai ir instrukcija. Uz Google tiek sūtīti tikai notikumi, nevis personu dati.',
      'Bez Google iestatīšanas grafiku var lejupielādēt kā **kalendāra failu (.ics)**.',
      '**Stundu kopsavilkums** par mēnesi: plānotās stundas pa veidiem.',
      'Pārskatā ir jauna kartīte **“Grafiks — tuvākās 7 dienas”**. Poga **Imports** (darba grafiks no Excel) jau ir vietā; pati funkcija tiks pielāgota instruktoru uzskaites veidnei.'
    ] },
    { v: '1.21.1', from: '1.21.0', date: '2026-10-15', title: 'Apmeklējuma atzīmēšana ar tastatūru', items: [
      'Mēneša tabulā atzīmes var ievadīt ar **tastatūru**. Uzklikšķini uz rūtiņas un raksti **+** (vai **B**), **N**, **K**, **A** vai **S**. Atzīme tiek ierakstīta, un fokuss pāriet uz nākamo rūtiņu.',
      'Izvēlies, kur pāriet pēc atzīmes: **↓ nākamā persona** (ērti, atzīmējot vienu nodarbību) vai **→ nākamais datums**. Izvēle tiek atcerēta.',
      '**Bultiņas** pārvietojas pa tabulu, **Del** notīra, **Atstarpe** strādā kā klikšķis, **Esc** beidz. Aktīvās rūtiņas rinda un datums tiek izgaismoti.',
      'Var strādāt arī jaukti: turpināt klikšķināt ar peli un, kad ērtāk, rakstīt ar tastatūru.'
    ] },
    { v: '1.21.0', date: '2026-10-15', title: 'Apmeklējums, rādītāji, kvalifikācijas un pārkāpumi', items: [
      'Jauna sadaļa **Apmeklējums** (📅 kreisajā joslā). **Mēneša tabulā** ir N.p.k., vārds, uzvārds un datumu kolonnas. Atzīmes liek ar klikšķi kā e-klasē: **+** bija → **n** nebija → **k** kavēja → **a** attaisnots → **s** slimības dēļ.',
      'Katrai grupai pats atzīmē **nodarbību dienas** (piem., O un C). Tabulā var rādīt tikai **jaunsardzes dienas** vai **visas mēneša dienas**.',
      'Klikšķis uz datuma atver nodarbību: **tēma, veids** (nodarbība, pasākums, nometne, sacensības), **piezīmes** un pogas **“Visi bija”** un **“Neatzīmētie — nebija”**.',
      '**Drukāšana:** “Tukša veidlapa” rūtiņām uz papīra vai “Ar atzīmēm”. Ja datumu ir daudz, lapa tiek pagriezta horizontāli.',
      '**Žurnāls** parāda mēneša nodarbības ar tēmu un apmeklējuma %.',
      '**Rādītāji:** vienības un grupu vidējais apmeklējums, dinamikas grafiks ar slīdošo vidējo (vērtība redzama, novietojot peli), grupu salīdzinājums un katras personas % ar tendenci ▲▼.',
      '**Brīdinājums**, ja persona nav apmeklējusi **3 nodarbības pēc kārtas** (skaitu var mainīt). Attaisnotie kavējumi neskaitās.',
      '**Kvalifikācijas:** pats nosaki, piem., “Pamatnometne”, un redzi, kam tā ir un kam nav. To var piešķirt atzīmētajiem vai visiem nometnes žurnāla dalībniekiem.',
      'Personas kartītē: **apmeklējums** (%, pēdējās nodarbības, grafiks), **dalība un kvalifikācijas** (pasākumi un nometnes) un **uzvedība un pārkāpumi**: datums, smagums, apraksts, veiktie pasākumi; ierakstus var labot un dzēst.'
    ] },
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
