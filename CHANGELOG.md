# Izmaiņu vēsture

## 1.13.1 — 2026-10-13
- Iestatījumos izvēlētā ciparnīca iezīmējas uzreiz.
- Pārskata kartītes ir sakārtotas: ikona augšā, cipars un nosaukums kopā apakšā.

## 1.13.0 — 2026-10-13 — Pulkstenis: ciparnīcas, hronometrs, taimeris
- Četras ciparnīcas: taktiskā, analogā, lielie cipari un nakts (sarkana uz melna).
- Režīmi: **Laiks**, **Hronometrs** ar apļiem un starplaikiem, **Taimeris** nodarbībām (1–15 min vai savs laiks) ar skaņas signālu un mirgojošu ciparnīcu.
- Pulksteņa taustiņi darbojas: START·STOP (sākt / apturēt), BACK·LAP (aplis / atiestatīt), UP·MENU (ciparnīca), DOWN (režīms), LIGHT (liels pulkstenis).
- **Liels pulkstenis virs rīka**, ja N min nav darbības (noklusējumā 5). Tas paslēpj arī personu datus. Jebkura kustība vai taustiņš to aizver.
- Iestatījumi → **Pulkstenis un pauzes**: ciparnīca, darba laiks līdz pauzei, pauzes garums, atkārtojums, lielais pulkstenis, skaņa.
- Anketas zonu iezīmēšanā krusta kursors tagad ir sarkans.

## 1.12.0 — 2026-10-12 — Pulkstenis un pauzes
- Pārskatā ir taktiskā pulksteņa stila ciparnīca. Tā rāda laiku, sekundes, datumu, darba laiku un divus progresa lokus, un tās krāsa pielāgojas tēmai un akcentam.
- Darba laika taimeris: laiks tiek skaitīts, kamēr rīks ir atvērts. Pēc 40 min parādās paziņojums “Labs darbs! … Laiks paņemt īsu pauzi”. Poga “Sākt pauzi” skaita 5 min, un pēc tam sākas jauns posms. Ja rīks bijis aizvērts ilgāk par 5 min, tas tiek uzskatīts par pauzi.
- Lietotāja skatā noņemti tehniski un “aizkulišu” paskaidrojumi (datu shēmas versijas, testa kanāls, izstrādes process).

## 1.11.0 — 2026-10-12 — Jaunais izskats visiem; “Par rīku”
- Dizains v2 tagad ir arī stabilajā un lokālajā versijā: ikonas, krāsu flīzes, tumšā un gaišā tēma, akcenta krāsa (Iestatījumi → Izskats).
- Jauna sadaļa **Par rīku** (navigācijā ⓘ): kam rīks paredzēts, kur glabājas dati, 8 soļi, kā sākt lietot, ko rīks prot, izstrādātājs Jānis Eglis.

## 1.10.1 — 2026-10-12
- **Atpakaļ:** katrā lapā ir poga “← <iepriekšējā lapa>”. Darbojas arī pārlūka un peles “atpakaļ” poga, kā arī Alt + ←.
- Navigācijas joslā vairs nav liekas horizontālās ritjoslas.
- Apliecības sadaļā noņemti paskaidrojumi par neobligātumu.
- **Dizains v2** (`/test/`): Iestatījumi → Izskats. Tēma: tumšā / gaišā / kā datorā. **Akcenta krāsa:** 11 gatavas krāsas un sava krāsa. No akcenta tiek atvasinātas pogas, izcēlumi, saites un viegls fona tonis. Teksta krāsa uz pogām tiek izvēlēta automātiski pēc kontrasta. Izskats glabājas pārlūkā un datu failā, tāpēc citā datorā tas ir tāds pats.
- Kartītes cilnes ietilpst vienā rindā.

## 1.10.0 — 2026-10-12 — Jaunsarga apliecība; jauns izskats (testa versijā)
- **Jaunsarga apliecība** personas kartītē (cilne “Apliecība”), neobligāta kā ekipējums. Tajā ir statuss (nav pieprasīta / pieprasīta / saņemta, jāpasniedz / izdota / nodota atpakaļ / nozaudēta), numurs, datumi (pieprasīta, izdota, derīga līdz), piezīmes un apliecības kopija (skenējums vai papīrs).
- Brīdinājumi: izdota bez numura; derīgums beidzies vai beigsies 30 dienās; pieprasīta pirms vairāk nekā 60 dienām; saņemta, bet nav pasniegta; dalība beigusies, bet apliecība nav nodota; vienāds numurs divām personām. Izmaiņas redzamas vēsturē.
- Dokumentu veidos pievienots “Jaunsarga apliecība”.
- **Dizains v2** (pagaidām tikai `/test/`): vienots līniju ikonu komplekts, statistika krāsu flīzēs, Manrope burti (iekļauti rīkā), gaišā un tumšā tēma (Iestatījumi → Izskats). Tīmekļa versijai bez ārējiem serveriem.

## 1.9.7 — 2026-10-12 — Droši atjauninājumi
- Pirms datu faila pārveidošanas uz jaunāku datu shēmu `_rezerves` mapē automātiski tiek saglabāta oriģināla kopija (`DATI_pirms_atjauninasanas_vX-vY_….json`).
- Ja datu failu saglabājusi jaunāka rīka versija, bet atvērta vecāka (piem. no keša vai zibatmiņas), dati tiek atvērti tikai apskatei un saglabāšana ir atslēgta, lai tos nesabojātu.
- Lauki, ko šī versija nepazīst, datu failā tiek saglabāti neskarti.

## 1.9.6 — 2026-10-12
- Google Vision kļūdas tiek skaidrotas latviski ar konkrētu rīcību: atslēga nederīga, atslēgai nav atļauts Vision API, adreses ierobežojums, API nav ieslēgts, nav norēķinu konta, limits, nav savienojuma. Atslēgai tiek noņemtas nejaušas atstarpes.

## 1.9.5 — 2026-10-12 — Anketu nolasīšana atkal darbojas
- **Bez veidnes** lauki atkal tiek atrasti automātiski pēc anketas etiķetēm. Iepriekšējā darba versijā tas bija izslēgts, un ar Google Vision dokuments netika pat nosūtīts. Word, eDoc un PDF ar tekstu nolasa precīzi, skenējumus atpazīst izvēlētais dzinējs.
- **Google Vision** tagad tiešām tiek izmantots gan bez veidnes, gan ar veidni (zonu teksts no Google atpazītajiem vārdiem). Google kļūdas, piem. nederīga atslēga, API nav ieslēgts vai nav norēķinu konta, tiek parādītas ievades logā.
- Personas kods rūtiņās vienmēr tiek nolasīts pa cipariem lokāli, arī ar Google. Tas ir izturīgs pret plašāk vai šaurāk iezīmētu zonu. Labots gadījums, kad kļūdains nolasījums nejauši izturēja kontrolcipara pārbaudi.
- Otrā kārta neskaidrajiem laukiem (Tesseract): kods, tālrunis, e-pasts un datums tiek atpazīti vēlreiz savā apgabalā.
- “Vārds Uzvārds” vienā rindā vai zonā tiek sadalīts vārdā un uzvārdā. Anketas paskaidrojumi, piem. “(vārds, uzvārds)”, vērtībās neiekļūst.
- Kā iepriekš, viss nolasītais vispirms nonāk pārbaudes formā, un kartītē tikai pēc saglabāšanas.

## 1.9.4 — 2026-10-12 — Mierīgs starts
- Rīka atvēršana vairs nerada “nesaglabātas izmaiņas” un nepārraksta datu failu. Pēdējās atvēršanas datums (vecuma izmaiņu paziņojumiem) tagad glabājas pārlūkā.
- Startā vairs nerāda “Pieslēdz datu mapi”, ja mape jau ir atcerēta. Tā vietā redzams **“Atver datu mapi”** ar progresa joslu un soļiem: meklē mapi, pārbauda piekļuvi, pārbauda pieejamību, nolasa datu failu, mācību gadu mapes. Ja mape atbild lēni, parādās “uzgaidi”.
- Ja mapi neizdodas atvērt, tiek parādīts konkrēts iemesls un ieteikumi: mape nav atrasta, mapē nav datu faila vai mape neatbild. Pieejamās pogas ir **↻ Mēģināt vēlreiz**, **Izvēlēties citu mapi** un ievilkšana. Ja trūkst datu faila, tukša uzskaite automātiski vairs netiek izveidota.
- Pēc ielādes dokumentu indeksēšana notiek fonā ar skaitītāju, un ar personām var strādāt uzreiz.
- Jaunai mapei datu fails tiek izveidots uzreiz pēc pieslēgšanas.

## 1.9.3 — 2026-10-12 — Tīmekļa versija (GitHub Pages)
- Programmu var atvērt no `https://cadet-tools.github.io/PSVS/`. Dati paliek datora mapē, ko izvēlas katrs lietotājs. Tīkla ceļa (`\\jicfs01`) problēma šai versijai neattiecas.
- Teksta atpazīšana (Tesseract 7, latviešu + angļu) ir iekļauta pašā rīkā. Tīmekļa versija nesazinās ar ārējiem serveriem; to nodrošina drošības politika (CSP). Izņēmums ir Google Vision, ja to ieslēdz ar savu atslēgu.
- Bezsaistes kešs: pēc pirmās atvēršanas programma un atpazīšana strādā bez interneta. Jauna versija tiek ielādēta automātiski, un parādās paziņojums “↻ Pārlādēt”.
- Iespēja instalēt kā lietotni (Chrome “Instalēt”), bez administratora tiesībām.
- Testa kanāls `/test/` ar atsevišķu atmiņu (atcerēto mapi), lai jaunas versijas pārbaudītu ar testa datiem.
- Lokālā `file://` versija strādā kā līdz šim.

## 1.9.2 — 2026-10-12 — Programmas atrašanās vieta
- Programma atpazīst, ka `index.html` atvērts no tīkla ceļa (`file://jicfs01/…`), un uzreiz parāda brīdinājumu. No šādas vietas Chrome nepiešķir rakstīšanas atļauju: dialogs atgriež `AbortError`, poga “Atļaut piekļuvi” atgriež `SecurityError … in this context`. Risinājums: atvērt programmu no lokālas mapes vai caur diska burtu.
- Kļūdai “Not allowed to request permissions in this context” tagad ir precīzs skaidrojums. Diagnostikā redzama programmas atrašanās vieta.

## 1.9.1 — 2026-10-12 — Datu mapes pieslēgšana darba datorā
- **Mapes ievilkšana no File Explorer** kā pilnvērtīgs pieslēgšanas veids: lauks “⇩ Ievelc datu mapi šeit” pārskatā un Iestatījumos, kā arī sānjoslas rinda “Datu mape”. Kamēr mape nav pieslēgta, to var ievilkt jebkur logā. Pēc ievilkšanas spied “🔓 Atļaut piekļuvi”, un Chrome atļauj rakstīšanu.
- Pirms ielādes tiek pārbaudīts, vai mapē var rakstīt. Pārbaudei tiek izveidots un izdzēsts īslaicīgs fails; esošie faili netiek skarti. Ievilktā mape tiek atcerēta tāpat kā izvēlētā, arī pēc pārlūka restartēšanas.
- Mapes dialogs tiek atvērts klikšķī kā pirmā darbība, bez iepriekšēja apstiprinājuma un bez `id`. Jautājums par nesaglabātām izmaiņām tiek uzdots pēc mapes izvēles. Dubultklikšķis neatver divus dialogus.
- Precīzi kļūdu ziņojumi. Agrāk `AbortError` tika paslēpts; tagad ziņojums paskaidro sistēmas mapes bloķēšanu (tīkla profils) un piedāvā ievilkšanu. Iestatījumos ir “Mapes piekļuves diagnostika”: protokols, API, pēdējais solis, kļūda un laiks ms.
- Ievilkts fails, nevis mape, vai fails, kas ievilkts ārpus laukiem, vairs neatver failu pārlūkā un neaizved prom no programmas.
- Ātrā ielāde saglabāta: `app.bundle.js` (17 faili vienā), CSS iekļauts `index.html`, logo 6 KB.

## 1.9 — 2026-10-12 — Dokumentu mapes kartītē
- Katram mācību gadam un personai ir mape `Macibu_gadi/<gads>/Personas/<ID>_<uzvārds>_<vārds>/`. Jauna persona to izveido automātiski. Pārcelšana izveido nākamā gada mapi un nekopē vecos failus.
- Kartītes sadaļā Dokumenti var izveidot apakšmapes, pievienot faila kopiju izvēlētajā mapē, pārlūkot, meklēt pēc nosaukuma, atvērt, pārdēvēt un pārvietot. Oriģināls datorā netiek dzēsts. Esošs fails netiek pārrakstīts bez apstiprinājuma.
- Pārdēvēšana un pārvietošana izmanto pārlūka `move()` un pēc tam pārbauda galamērķi. Ja to nevar izdarīt droši, dokuments paliek savā vietā. Sasaite kartītē tiek atjaunota.
- Dokumenta veids un statuss (papīrs, eDoc, elektronisks, saņemts, pārbaudīts, jāprecizē, trūkst, derīgums) glabājas datu failā.

## 1.8 — 2026-10-12 — Mācību gadi
- Mācību gadu reģistrs no 2017–2018 līdz 2026–2027. Pašreizējais gads ir no 1. septembra līdz 31. augustam. Nākamos gadus pievieno bez pēdējā gada ierobežojuma, un vienāds gads netiek veidots otrreiz.
- Augšējā labajā stūrī ir izvēlne **Mācību gads**. Izvēle paliek iestatījumos. Gada maiņa nedzēš un nepārvieto datus.
- Viena persona ir viens profils. Grupu un dalības statusu katram gadam glabā dalības ieraksts. Pārcelšana pievieno jaunu gada dalību un atstāj iepriekšējo gadu.
- Personu sarakstā ir **Pārcelt no cita gada**: avota gads, meklēšana, atzīmes, grupa galamērķī un brīdinājums, ja persona jau ir gadā vai ir arhivēta.
- Datu mapē tiek sagatavotas `Dokumenti`, `Macibu_gadi/<gads>/{Dokumenti,Pasakumi,Atskaites}` un `Rezerves_kopijas`. Esošās mapes un personu dokumenti netiek pārvietoti.
- Migrācija uz shēmu v6 ir atkārtoti droša. Personas bez droši nosakāma gada netiek uzminētas. Pirms migrācijas tiek veidota JSON kopija, ja datu mape ir atvērta.
- OCR veidnes, dokumentu saites, ekipējuma vēsture un arhīvs paliek. Neatdotais ekipējums seko personai arī nākamajā gadā.

## 1.7 — 2026-10-11 — Stabilitāte
- Datu saglabāšana ir secīga, ar struktūras pārbaudi pirms un pēc rakstīšanas. Ārēji mainīts fails netiek klusi pārrakstīts. Neveiksmes gadījumā paliek nesaglabāto izmaiņu indikators, un rezerves kopijas kļūda vairs netiek paslēpta.
- JSON kopijas ar datumu un laiku mapē `_rezerves`: saraksts, pārbaude, manuāla kopija un atjaunošana. Pirms atjaunošanas tiek saglabāta pašreizējā versija. Kopija bez dokumentu failiem netiek saukta par pilnu.
- Datu arhīvs mapē `_arhivi`: JSON, manifests ar ceļiem, izmēriem un SHA-256, pamatmapes reģistrētie faili. Ārējās mapes tikai ar piekrišanu. Ja fails nav iekļauts, arhīvs ir daļējs.
- Papildu mapēm ir stabils ID. Rokturi tiek atcerēti. Pēc palaišanas var pieslēgt atkārtoti. Vienāds nosaukums neapvieno divas mapes. Dokumentu saites paliek, ja mape nav pieejama.
- Dokumentu statusi: Pieejams, Nav piekļuves, Nav atrasts, Jāpārbauda. Var atjaunot sasaisti, nepārvietojot failu un neizdzēšot vēsturi.
- Jaunām personām mapes nosaukumā ir nemainīgs ID (`P000001_Uzvards_Vards`). Esošās mapes netiek pārdēvētas. Uzvārda maiņa neveido otru profilu.
- Arhivējot tiek saglabāts dokumentu un ekipējuma stāvoklis. Dzēšana izņem tikai reģistra ierakstu un pirms tam parāda, kas paliek. Glabāšanas termiņš tikai brīdina.
- WhatsApp, SMS un e-pasts: statusi Sagatavots, Atvērts ārējā lietotnē, Lietotājs apstiprinājis nosūtīšanu, Atcelts. Loga atvēršana vairs netiek uzskatīta par nosūtīšanu.
- PDF.js, QR un Tesseract ir mapē `vendor/`. Google Vision paliek izslēgts, kamēr to neieslēdz. OCR darbinieks no `file://` var nedarboties — manuālā ievade paliek.
- Datu shēma v5. Vecie lauki un v2–v4 dati tiek pārņemti.

## 1.6 — 2026-10-11
- Rīkos pievienots **DVS portāls** (dvs.mod.gov.lv) — personas kartiņā un pārskata ātrajās darbībās. Rīkus bez personas datiem saitē (E-klase, DVS) var atvērt tieši no pārskata.

## 1.5 — 2026-10-11
- **Ekipējums:** jauni lauki — izmērs, daudzums; tabulā redzams viss (inv. nr., izmērs, daudzums, datumi, statuss, piezīmes, piezīme atdodot); ierakstus var labot un dzēst; atdodot var ierakstīt stāvokli.
- **MTL aprites lapa:** redzama personas cilnē “Ekipējums” (pēdējā un iepriekšējās) un dokumentos. Nav obligāta, kamēr nav izsniegts ekipējums. Brīdina, ja ekipējums izsniegts bez MTL lapas vai ja pēc izsniegšanas/atdošanas/labošanas nav pievienota jauna lapa. MTL faili tiek nosaukti ar datumu.
- **Paziņojumi, atverot rīku:** vecuma izmaiņas kopš pēdējās reizes (t.sk. kļuvis pilngadīgs), viss, kas jāpārbauda (MTL, dokumenti, tālruņi, ekipējums, uzdevumi), un tuvākie notikumi.

## 1.4 — 2026-10-11
- Telefona kontaktos ir saistītie cilvēki: bērna kontaktā — vecāku un ārkārtas kontakta vārdi un numuri (zvanāmi tieši no kontakta), vecāka kontaktā — bērna vārds, grupa, numurs. Tas pats arī piezīmē (redzams jebkurā telefonā).
- Google etiķetes: “Jaunsardze – jaunsargi” un “Jaunsardze – vecāki” (maināmas Iestatījumos).

## 1.3 — 2026-10-11
- **Tālruņu salīdzināšana:** katrs numurs (jaunieša, vecāku, ārkārtas) tiek salīdzināts ar visiem uzskaitē. Ja viens numurs pieder dažādiem cilvēkiem — brīdinājums pie lauka, pirms saglabāšanas, kartiņā un “Uzdevumos”. Viens vecāks vairākiem bērniem tiek uzskatīts par normālu (ℹ).
- **Kontakti uz telefonu / Google:** kartiņā “📇 Uz telefonu” — QR kods katram kontaktam (noskenē ar kameru) un .vcf fails importam Google Contacts. Pēc jaunas personas saglabāšanas tiek piedāvāts “📇 Saglabāt kontaktos”. Sarakstā atlasītajiem — “📇 vCard”.

## 1.2 — 2026-10-11
- **Lauku iezīmēšana (veidnes):** ievades logā “✎ Iezīmēt laukus” → klikšķis uz lauka formā → dokumentā novelk taisnstūri ap atbildi. Vērtība tiek nolasīta uzreiz; veidni saglabā (“Veidne 1”…) un nākamreiz izvēlas sarakstā “Veidne”.
- Veidne automātiski izlīdzina nelielu skenējuma nobīdi pēc etiķetēm; neiezīmētie lauki joprojām tiek lasīti pēc etiķetēm.
- Ja “Vārds” vietā rakstīts vārds un uzvārds kopā — tie tiek sadalīti.
- **Grupas atcerēšanās:** 📌 pie lauka “Grupa” — piesprausta grupa tiek ielikta katrai jaunai personai (arī anketu ievadē un importā), “✕ Nomest” to atceļ.

## 1.1 — 2026-10-11
- **Dokumentu lasītājs** aizstāj anketu veidnes ar zonām. Lauki tiek atrasti pēc etiķetēm un izkārtojuma, tāpēc veidlapu versijas drīkst atšķirties.
- Precīza nolasīšana bez atpazīšanas no **Word (.docx)**, **PDF ar teksta slāni** un **eDoc**.
- Jaunsardzes "Iesniegums – anketa" profils: jaunietis, likumiskais pārstāvis, ārkārtas kontaktpersona un foto piekrišana.
- Skenējumiem atpazīšana notiek divās kārtās. Personas koda rūtiņas tiek nolasītas pa vienai, un izvēles rūtiņas tiek noteiktas pēc tintes daudzuma.
- **Skatītājs darbojas kā PDF skatītājs:** ritināšana, Ctrl + ritenītis, pogas, lapu numuri. Vilkšana kā attēlam vairs netiek izmantota.
- Klikšķis uz lauka iezīmē tā vietu dokumentā arī DOCX failos.
- Kartiņas dokumentos ir poga "📥 Nolasīt", kas atkārtoti nolasa piesaistītu anketu.

## 1.0 — 2026-10-11
**Pārbūve uz moduļiem** (HTML, CSS un JS atsevišķos failos). Datu shēma v4. Dati no 0.2 un 0.3 tiek pārņemti automātiski.

### Anketu ievade (pārstrādāta no jauna)
- Pilnekrāna logs ar dokumentu un formu blakus. Dokumentu var tuvināt ar ritenīti un pārvietot, velkot, arī bez teksta atpazīšanas.
- Anketu veidnes: zonas katram laukam. Klikšķis uz lauka pietuvina tā vietu dokumentā.
- Atpazīšana pa zonām ar ierobežotām simbolu kopām. Attēla priekšapstrāde: kontrasts, ēnu izlīdzināšana, līniju un rāmju noņemšana.
- Vērtību validācija: personas koda kontrolcipars, tālrunis, e-pasts, datums, vārds. Aizdomīgas vērtības laukā netiek ieliktas, bet tiek piedāvātas kā ieteikums.
- Klikšķis uz atpazītas rindas dokumentā ieliek tekstu aktīvajā laukā.
- Iespēja izmantot Google Cloud Vision rokrakstam. Pēc noklusējuma izslēgta.
- Režīms "Saglabāt un nākamā". Salāgošana nobīdītiem skenējumiem.
- Visi ziņojumi tiek rādīti loga statusa joslā.

### Personas
- Saraksts tabulā ar filtriem, kārtošanu un masveida darbībām.
- Kartiņas izkārtojums platiem ekrāniem: etiķete un vērtība atrodas blakus, kontakti ir sānjoslā.
- Statusi: kandidāts, aktīvs, pārtraukts, arhīvā.
- Vēstures laika josla: saziņa, piezīmes, uzdevumi ar termiņu, izmaiņu audits.
- Dublikātu pārbaude. Personas koda maskēšana. Datu eksports pēc pieprasījuma. Neatgriezeniska dzēšana ar apstiprinājumu.

### Citas izmaiņas
- Noņemta poga "Karte" (Google Maps).
- Ziņojumi parādās aktīvajā logā, nevis aiz tā.
- Konflikta aizsardzība: datu fails mainīts citur vai programma atvērta vairākās cilnēs.
- Dokumenti: rediģēšana (derīguma termiņš, piezīmes), failu ievilkšana kartiņā, trūkstošo dokumentu skats.
- Imports: dublikātu atpazīšana, grupas piešķiršana, vairāk kolonnu nosaukumu (arī e-klases eksports).

## 0.3
WhatsApp un e-pasts no kartiņas, pirmā teksta atpazīšanas versija, dokumentu ieteikumi.

## 0.2
Lokālā uzskaite JSON failā, dokumentu indekss, ekipējums, arhīvs.
