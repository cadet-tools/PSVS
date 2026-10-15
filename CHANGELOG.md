# Izmaiņu vēsture

## 1.17.2 — 2026-10-15
- Labojums: līguma rekvizītos Centra tālrunis “Tālrunis: 67335388” vairs netiek aizstāts ar instruktora tālruni. Tālruņi un e-pasti tiek ierakstīti tikai rindās ar tukšu līniju. Pārbaudīts visās četrās standarta veidnēs.
- Standarta Word veidnes vairs netiek ņemtas no bezsaistes keša: adresē ir versija (`?v=`), un pakalpojuma darbinieks tās ielādē no tīkla. Iepriekš pēc atjauninājuma varēja tikt izmantota vecā veidne.
- Instruktora dati tiek saglabāti jau rakstīšanas laikā.
- Ja līgums sagatavots ar 1.17.0 vai 1.17.1, Centra tālrunis tajā jāizlabo ar roku vai līgums jāsagatavo no jauna.

## 1.17.1 — 2026-10-15 — Līguma labojumi
- Datu lauki standarta veidnēs (vārdi, personas koda cipari, adreses, amats, instruktora vārds, vieta) ir centrēti un rakstīti Times New Roman 12,5 pt taisnā šriftā, kā dokumenta teksts.
- Instruktora paraksta datums (papīra līgumos), piem., “2026. gada 15. oktobrī”: tāds pats kā līguma datums, cits datums vai tukšs. Izvēle tiek atcerēta.
- Pārstāvja statusam nav noklusējuma, tas jāizvēlas (Māte / Tēvs / Likumiskais pārstāvis / Cits + paša teksts, ko rīks atceras ieteikumiem). Bez statusa līgumu sagatavot nevar.
- Ja nav līguma numura, rīks pirms priekšskatījuma vai Word faila skaidri jautā, vai turpināt.
- Līguma logā ievadītie dati papildina tukšos kartītes laukus (pārstāvja vārds, statuss, personas kods, adreses, tālrunis, e-pasts; jaunieša kontakti). Esošie dati netiek pārrakstīti. Vieta un forma tiek atcerētas.
- Teikumā “uz ____ (____) lapām” ir garākas līnijas visās četrās veidnēs.

## 1.17.0 — 2026-10-15 — Veidlapa “Līgums”
- Četras standarta veidnes no Jaunsardzes centra paraugiem (24.10.2024): jaunietis 18+ un likumiskais pārstāvis, katrs papīra formā un EDOC.
- Automātiski tiek aizpildīts: līguma Nr. (ievada lietotājs), vieta un datums (“2026.gada 15.oktobrī”), novada pārvaldes un nodaļas nr., instruktora vārds ģenitīvā (ar ieteikumu, ko var labot), jaunieša un pārstāvja statuss, vārds, personas koda cipari pa šūnām, adreses, tālruņi un e-pasti, kā arī Centra pārstāvja amats un kontakti.
- Pirms sagatavošanas visus datus var pārbaudīt un labot. Labotais attiecas tikai uz šo līgumu, un kartītes dati netiek mainīti.
- Līguma veids tiek izvēlēts pēc vecuma, formu atceras rīks, un pārstāvi var izvēlēties no diviem vecākiem.
- Rīks brīdina, ja trūkst personas koda, pārstāvja, līguma numura vai instruktora datu.
- Word fails tiek lejupielādēts, un kopija saglabāta `Macibu_gadi/<gads>/Personas/<persona>/`. Kartītē ir sagatavoto līgumu saraksts, un līguma Nr. tiek saglabāts kartītē.
- Līgumu var priekšskatīt un izdrukāt rīkā. Priekšskatījums tiek veidots no Word faila ar bibliotēku docx-preview 0.3.7, un izkārtojums var nedaudz atšķirties no Word.
- Savu līguma veidni var izmantot ar atzīmēm `{liguma_nr}`, `{j_vards}`, `{j_pk1}`…`{j_pk11}`, `{p_statuss_vards}` u.c. Ir pieejams lejupielādējams paraugs.
- Word aizpildīšana tagad atbalsta atzīmes ar cipariem, piem., `{j_pk1}`.

## 1.16.3 — 2026-10-15
- Drukāšana notiek tieši no rīka loga, bez slēpta rāmja. Chrome drukas logs uzreiz rāda veidlapas lapas: A4 portrets instruktāžas lapai, ainava nometnes žurnālam. Ja ir printeris, tās var izdrukāt, vai arī saglabāt kā PDF. Pārbaudīts ar pārlūka drukas dzinēju: izdrukā ir tikai veidlapa, 1 lapa.
- Tukšās rindas vienmēr nosaka lietotājs: bez dalībniekiem veidlapā ir tieši norādītais rindu skaits (agrāk vismaz 10). Ja dalībnieku nav un rindu skaits ir 0, rīks lūdz norādīt rindu skaitu.
- Nometnes žurnālā ir atsevišķa izvēle tukšajām rindām darbinieku tabulā (agrāk 3 rindas, ja darbinieki nebija izvēlēti).
- Ievadot skaitli tukšo rindu laukā, paskaidrojums zem tā atjaunojas uzreiz.

## 1.16.2 — 2026-10-15 — Veidlapu labojumi
- Instruktāžas lapā un nometnes žurnālā vairs nav obligāti 26 vai 11 rindu. Rindu skaits ir dalībnieku skaits plus norādītās tukšās rindas (noklusējumā 0). Tukšai veidlapai bez dalībniekiem ir 10 rindas. Darbinieku tabulā ir tik rindu, cik izvēlēto darbinieku, bet, ja neviens nav izvēlēts, 3 tukšas rindas.
- Tukšajās rindās datuma šūna ir tukša. Ja izvēlēts neierakstīt datumu katrā rindā, arī dalībnieku rindās datuma šūna ir tukša.
- Tukšo rindu izvēle darbojas: skaitlis ar pogām − / + un paskaidrojums par rindu skaitu. Tas pats attiecas uz savām Word veidnēm.
- Drukāšana: rīkā tiek atvērts priekšskatījums ar visām lapām (A4 portrets vai ainava) un pogām Drukāt un Lejupielādēt PDF. Iepriekšējais veids pārlūkā varēja ielādēties bezgalīgi.

## 1.16.1 — 2026-10-13
- Statusa “Aktīvs” nosaukums tagad ir **Jaunsargs** visur rīkā: kartītē, sarakstā, filtros, pārskatā, importā un anketu ievadē. Iespējamie statusi: Kandidāts, Jaunsargs, Pārtraukts.
- Personas logā statusa izvēle ir sadaļā Pamatdati, uzreiz aiz vārda un uzvārda.

## 1.16.0 — 2026-10-13 — Piezīmju žurnāls un jaunumu logs
- Personas piezīmes un piezīmes par mācību gadu tagad ir ierakstu žurnāls. Katrs ieraksts ir atsevišķs, ar datumu, un to var labot (✎) vai dzēst (✕). Ja ieraksts labots, redzams arī labošanas datums. Piezīmes redzamas arī cilnē Vēsture.
- Teksta lauki izplešas vertikāli, kamēr raksti. Enter saglabā, Shift+Enter sāk jaunu rindu, un Esc atceļ labošanu.
- Teksts, kas nonāk piezīmēs no Excel importa, anketas vai rediģēšanas loga, tiek pievienots žurnālam kā jauns ieraksts.
- Datu faila versija 7. Esošās piezīmes tiek automātiski pārnestas uz žurnālu, un pirms tam tiek saglabāta rezerves kopija `_rezerves/DATI_pirms_atjauninasanas_v6-v7_….json`.
- **Jaunumi**: pirmo reizi pēc atjauninājuma tiek parādīts īss apraksts par jaunumiem. Pilns atjauninājumu žurnāls ir sadaļā Par rīku.

## 1.15.1 — 2026-10-13 — Piezīmes ar pogu “Saglabāt”
- Personas kartītē vienmēr ir lauks **Piezīmes**. Piezīmi par mācību gadu un piezīmi par personu tagad var rakstīt vairākās rindās.
- Pie katra lauka ir poga **Saglabāt**. **Enter** saglabā, un **Shift+Enter** sāk jaunu rindu. Tiek parādīts statuss “Nav saglabāts” vai “Saglabāts ✓”. Ja iziet no lauka, piezīme arī tiek saglabāta.
- Vēstures ierakstā **Enter** pievieno ierakstu, un **Shift+Enter** sāk jaunu rindu. Pēc pievienošanas parādās apstiprinājums.

## 1.15.0 — 2026-10-13 — Atzīmes “ievadīts DVS” un “ievadīts e-klasē”
- Personas kartītē ir jauna sadaļa **Reģistrācija** ar atzīmēm DVS un e-klase. Kopā ar atzīmi tiek saglabāts datums.
- Kamēr persona nav atzīmēta, pārskatā un uzdevumos redzams brīdinājums. Tas attiecas uz aktīvajiem un kandidātiem, bet ne uz pārtrauktajiem un arhivētajiem.
- Personu sarakstā atlasītajām personām var atzīmēt **✓ DVS** vai **✓ e-klase** uzreiz visām.
- Personas, kas importētas ar e-klases eksporta palīgu, automātiski tiek atzīmētas kā ievadītas e-klasē.
- Iestatījumi → Dokumenti: var izvēlēties, par kurām sistēmām atgādināt.

## 1.14.4 — 2026-10-13 — Imports no instruktoru Excel tabulām
- Vecāka vārds un tālrunis vienā šūnā (“Vecāku vārds, uzvārds, tel.Nr.”) tiek sadalīts. Ja šūnā ir divi vecāki, otrs kļūst par 2. pārstāvi.
- Jaunas atpazītās kolonnas: vecāka personas kods, “e-adrese” (e-pasts), statuss (Jaunsargs/Kandidāts) un jaunsarga apliecības numurs.
- Pārējās kolonnas, piem., Līgums, Līguma NR., Ārsta zīme, MTL un Solījums, tiek ierakstītas personas piezīmēs. To var izslēgt. Aprēķinu kolonnas (vecums, “Šodienas…”) tiek izlaistas.
- Ja kolonnā “Vārds, Uzvārds” ir divi vārdi un uzvārds, uzvārds ir pēdējais vārds. Teksts iekavās pie vārda nonāk piezīmēs.
- Tālruņi Excel zinātniskajā pierakstā (2.9E7) un ar “.0” tiek nolasīti pareizi. “NAV DATI” tiek uzskatīts par tukšu lauku. No aizklāta personas koda (piem., 010312-*****) tiek paņemts tikai dzimšanas datums.
- Izvēle **Statuss importētajiem**: darblapai ar nosaukumu “neaktīvi” automātiski tiek iestatīts statuss “Pārtraukts”.
- Ir redzams, cik rindu izlaists, jo tajās trūkst vārda vai uzvārda, un kuras tās ir.

## 1.14.3 — 2026-10-13 — Elastīgāks Excel imports
- Kolonnu nosaukumi vairs nav jāliek pirmajā rindā. Rīks pats atrod darblapu un rindu ar nosaukumiem pirmajās 30 rindās, tostarp divu rindu virsrakstu, piem., “Vecāks” virs “Vārds, uzvārds” un “Tālrunis”.
- Atpazīst arī līdzīgus nosaukumus, piem., “Jaunsarga vārds”, “Pers. kods”, “Dzim. dat.”, “Tālr.” un “Dzīvesvieta”.
- Importa logā redzams, kura darblapa, rinda un kolonnas ir atpazītas. Katru no tām var nomainīt ar roku.
- Excel datumi (šūnas ar datuma formātu) tiek nolasīti pareizi. Ja Excel personas kodam nogriezis sākuma nulli, tā tiek atjaunota. Atkārtota virsrakstu rinda tabulas vidū tiek izlaista.
- Vecajam .xls formātam ir skaidrs paziņojums, kā failu saglabāt kā .xlsx.

## 1.14.2 — 2026-10-13
- Pēc atjauninājuma lapa un programma vienmēr ielādējas kopā. Iepriekš pārlūks dažas minūtes varēja lietot iepriekšējo programmu, un jaunās pogas (piem., cilne “No e-klases”) nereaģēja.

## 1.14.1 — 2026-10-13 — Imports no e-klases
- Importa logā ir jauna cilne **No e-klases** ar soli pa solim instrukciju un pogu **Kopēt eksporta palīgu**. Palīgu ielīmē e-klases cilnē, un tas savāc atvērto skolēnu personas lietas CSV failā tavā datorā.
- Ja e-klase pārlādē lapu, jau savāktās personas nepazūd. Palīgu ielīmē vēlreiz, un saraksts atjaunojas.
- Imports saprot e-klases kolonnas: deklarētā un faktiskā adrese; māte, tēvs vai cita atbildīgā persona (kļūst par 1. un 2. pārstāvi kopā ar saistību un tālruņiem).
- Personām, kas jau ir uzskaitē, var papildināt tukšos laukus. Esošie dati netiek mainīti.
- Pārskatā ir poga **No e-klases**.

## 1.14.0 — 2026-10-13 — Veidlapas: instruktāžas lapa un nometnes žurnāls
- Jauna sadaļa **Veidlapas**. Tajā ir pasākumu saraksts, darbinieku un audzinātāju saraksts un savas Word veidnes.
- **Drošības instruktāžas lapa**: nosaukums, norises datumi (teksts “2026. gada 17.–18. oktobris” veidojas pats), instruktāžas datums, grupa, amats un vārds. Dalībniekus var izvēlēties pa vienam, visus, ar meklēšanu vai pēc grupas. Datums tiek ierakstīts katrā rindā.
- **Nometnes žurnāls**: darbinieku lapa un dalībnieku lapa. Dzimšanas datums, adrese, tālrunis un vecāku kontakti tiek ņemti no kartītēm. Audzinātāju var norādīt grupai, un atsevišķam dalībniekam to var nomainīt. Var norādīt arī nometnes vadītāju.
- Darbinieki un audzinātāji tiek saglabāti nākamajām reizēm, un neaktuālos var dzēst. Jaunā nometnē automātiski ir atzīmēti iepriekšējās nometnes darbinieki.
- **Brīdinājums tikai rīkā**: ja dalībniekam trūkst anketas, līguma vai ārsta izziņas. Dalībnieku tik un tā var pievienot, un uz veidlapas brīdinājums netiek drukāts.
- Gatavs **PDF**, ko var apskatīt, izdrukāt vai lejupielādēt. Kopija tiek saglabāta mapē `Macibu_gadi/<gads>/Pasakumi/`. Personas kartītē ir redzams, kuros pasākumos persona piedalījusies.
- **Sava Word veidne**: Word dokumentā ieraksti atzīmes, piem., `{nosaukums}` un `{vards}`, un rīks to aizpildīs. Ir pieejami lejupielādējami paraugi.

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
