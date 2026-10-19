# CADET PERSONĀLS

Jaunsardzes instruktora rīks jauniešu uzskaitei. Tajā ir personu kartītes, dokumenti, anketu nolasīšana, ekipējums un MTL lapas, saziņa (WhatsApp, SMS, e-pasts), kontakti telefonā un atgādinājumi.

**Atvērt:** https://cadet-tools.github.io/PSVS/
**Testa versija** (tikai ar izdomātiem datiem): https://cadet-tools.github.io/PSVS/test/

## Kur glabājas dati

**Tikai tavā datorā,** mapē, kuru izvēlies pats. Programma ielādējas no GitHub, bet darbojas tavā pārlūkā un lasa un raksta failus tieši tavā mapē. Uz GitHub vai citiem serveriem netiek sūtīti ne personu dati, ne dokumenti, ne anketu attēli. To nodrošina arī lapas drošības politika (Content-Security-Policy), kas aizliedz savienojumus ar citām adresēm.

**Lietošanas statistika:** rīks izmanto sīkdatnes (pārlūka atmiņu) un izstrādātājam sūta anonīmu statistiku — cik bieži rīks tiek lietots, kuras sadaļas un pogas, versiju, kļūdu veidus un novada pārvaldes / nodaļas numuru. Bez vārdiem, dokumentiem un failu nosaukumiem. Izslēgt: Iestatījumi → Atļaujas. Sīkāk: [docs/ANALYTICS.md](docs/ANALYTICS.md).

Vienīgais izņēmums ir **Google Vision** rokraksta atpazīšana. Tā pēc noklusējuma ir izslēgta, un to ieslēdz tikai ar savu API atslēgu Iestatījumos. Tad anketas attēls tiek nosūtīts Google.

Katram instruktoram ir sava datu mape. Instruktori cits cita datus neredz.

## Sākt darbu

1. Atver saiti **Google Chrome** vai **Microsoft Edge** pārlūkā datorā. Firefox, Safari un telefoni neatbalsta darbu ar mapēm.
2. Izveido tukšu mapi, piemēram, `Dokumenti\CADET PERSONALS` vai uz šifrētas zibatmiņas.
3. Spied **📁 Izvēlēties datu mapi** vai ievelc mapi no File Explorer laukā **⇩ Ievelc datu mapi šeit**. Ja Chrome prasa, spied **🔓 Atļaut piekļuvi** un izvēlies **Rediģēt failus**.
4. Programma pati izveido `CADET_PERSONALS_DATI.json`, mācību gadu mapes un mapi `_rezerves` ar ikdienas kopijām.

Nākamreiz Chrome mapi atcerēsies. Ja tas prasa atļauju vēlreiz, pietiek ar vienu klikšķi.

**Instalēt kā lietotni:** Chrome adreses joslā ⊕ “Instalēt” vai Iestatījumos **⬇ Instalēt kā lietotni**. Administratora tiesības nav vajadzīgas. Pēc pirmās atvēršanas rīks strādā arī bez interneta.

## Drošība — lūdzu, ievēro

- Datu mapē ir nepilngadīgo personas dati. Turi to datorā ar paroli vai uz **šifrētas** zibatmiņas (BitLocker To Go).
- Uztaisi otru kopiju (otra zibatmiņa vai droša mape) un atjauno to regulāri.
- Datu mapi un JSON failu neliec šajā repozitorijā, e-pastā vai publiskos mākoņos.
- Testa versijā izmanto tikai izdomātus datus.

## Atjauninājumi

Jauna versija ielādējas automātiski. Kad tā pienāk, programma parāda **↻ Pārlādēt**. Datu fails tiek automātiski pārveidots jaunajai versijai, un pirms tam tiek saglabāta kopija.

## Uzturētājam

- `index.html`, `app.bundle.js`, `sw.js` — stabilā versija. `test/` — testa kanāls. `vendor/` — bibliotēkas (pdf.js, Tesseract, QR).
- **Analītika ir pastāvīga rīka daļa** — `src/js/analytics.js`, saņēmējs un panelis `docs/analitika/` (Google Apps Script). Pārbūvējot to nedzēš; apraksts un pārbaude: [docs/ANALYTICS.md](docs/ANALYTICS.md).
- `src/` — avota kods (moduļi `src/js`, `src/css`). Būvēšana: `python3 src/_buvesana/build_web.py <avots> <repo> <node_modules>`. Tikai testa kanāls no repozitorija `src/`: `python3 src/_buvesana/build_test.py`.
- **MI palīgs** (tikai testa kanālā) — `src/js/ai.js`, starpnieks `docs/mi/` (Google Apps Script → Groq). Uzstādīšana un kas tiek sūtīts: [docs/MI.md](docs/MI.md).
- Jaunu versiju vispirms ieliek `test/`, pārbauda, un tikai tad saknē.
- **Datu saglabāšanas noteikumi atjauninot:** datu shēmu (`CP.SCHEMA`) palielina tikai tad, kad mainās datu struktūra; `CP.migrate()` drīkst laukus tikai pievienot vai pārveidot, nekad nedzēst; nezināmi lauki paliek neskarti. Pirms migrācijas rīks pats saglabā kopiju `_rezerves`. Vecāka versija jaunāka faila datus neatļauj saglabāt.
- Organizācijas `cadet-tools` GitHub Pages lapām ir kopīga adrese (`cadet-tools.github.io`), tātad arī kopīga pārlūka atmiņa. Citas, neuzticamas lapas šajā organizācijā nepublicē. GitHub kontam ieslēdz divpakāpju pieteikšanos.

Licences: `vendor/LICENCES.txt`.
