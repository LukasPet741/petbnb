/**
 * Lietuviška teisinių dokumentų versija. Struktūra privalo sutapti su
 * src/lib/i18n/en/legal.ts — raktų paritetą tikrina parity.test.ts, o skyrių
 * numeraciją ir jų egzistavimą — legal.test.ts.
 *
 * NB: šį tekstą parašė ne gimtakalbis. Antra redakcija atlikta 2026-09-07 (ištaisyta
 * padalyvio nesiderinimo klaida, klaidingas „train anything" vertimas ir keli anglicizmai),
 * bet gimtakalbio peržiūros tai NEPAKEIČIA — tai teisinis tekstas viešoje svetainėje.
 */

const legal = {
  backLink: "Grįžti į pradžią",
  backToDashboard: "Grįžti į skydelį",
  nav: {
    terms: "Taisyklės",
    privacy: "Privatumas",
    advertising: "Reklamuotojams",
  },

  terms: {
    title: "Taisyklės ir sąlygos",
    lastUpdated: "Paskutinį kartą atnaujinta: 2026 m. lapkričio mėn.",
    intro:
      "PetBnB yra universiteto projektas, o ne įmonė. Šiose taisyklėse aprašoma, kaip veikia ši demonstracinė versija ir ko ji sąmoningai nedaro. Jos parašytos siekiant sąžiningumo, o ne išsamumo, ir nėra teisinė konsultacija.",
    sections: {
      aboutProject: {
        heading: "1. Apie šį projektą",
        body: "PetBnB — studento sukurta platforma, jungianti augintinių šeimininkus su nepriklausomais globėjais ir gyvūnų verslais Lietuvoje. Ją valdo vienas asmuo, o ne įmonė. Augintinių šeimininkams ir globėjams ji nemokama; vienintelis dalykas, kurį ji parduoda, yra neprivaloma reklamuojama vieta verslams pagal taisykles reklamuotojams, o pardavėjo duomenys nurodyti kiekviename „Stripe“ kvite. Kitką svetainėje vertinkite kaip veikiantį prototipą.",
      },
      acceptance: {
        heading: "2. Taisyklių priėmimas",
        body: "Sukurdami paskyrą arba naudodamiesi svetaine sutinkate su šiomis taisyklėmis. Jei su jomis nesutinkate, prašome paslauga nesinaudoti. Bet kada galite nustoti naudotis — tiesiog paprašykite ištrinti paskyrą.",
      },
      userAccounts: {
        heading: "3. Jūsų paskyra",
        body: "Paskyra reikalinga norint pateikti užsakymą ar parašyti globėjui. Kurdami ją pateikite tikslią informaciją, saugokite slaptažodį ir laikykite viską, kas atliekama per jūsų paskyrą, savo veiksmais. Praneškite mums, jei įtariate, kad prie jos prieina kas nors kitas.",
      },
      bookings: {
        heading: "4. Užsakymai",
        body: "Užsakymo užklausa yra tik susipažinimas, o ne sutartis su mumis. Globėjai patys pasirenka, kurias užklausas priimti, o bet koks susitarimas dėl datų, priežiūros ar pinigų sudaromas tiesiogiai tarp jūsų ir globėjo. PetBnB niekada nėra jo šalis ir negali užtikrinti jo vykdymo.",
      },
      payments: {
        heading: "5. Mokėjimai",
        body: "Gyvūnų šeimininkai ir globėjai PetBnB nieko nemoka: užsakymo mokesčių nėra, o PetBnB nelaiko nė vienos pusės pinigų. Šeimininkai ir globėjai atsiskaito tarpusavyje, už platformos ribų, ir bet koks ginčas dėl pinigų sprendžiamas tarp jų. Vienintelis dalykas, kurį PetBnB parduoda, yra neprivaloma reklamuojama vieta verslams vietų žemėlapyje, kur ji siūloma: už ją mokama kortele per „Stripe“ pagal taisykles reklamuotojams, o PetBnB kortelės duomenų nemato.",
      },
      sitters: {
        heading: "6. Globėjai",
        body: "Mes netikriname globėjų, nerengiame pokalbių, nerenkame duomenų apie jų praeitį ir netikriname nei draudimo, nei kvalifikacijos, nei rekomendacijų. Viskas globėjo profilyje parašyta paties globėjo. Pasikliaukite savo nuovoka, susitikite prieš užsakydami ir užduokite tuos klausimus, kuriuos užduotumėte bet kam, kam paliekate gyvūną. Vienintelė išimtis — Smart-ID ženklelis, tačiau šiame prototipe jis demonstracinis: gaunamas atlikus SK ID Solutions demo patikrą su testiniu asmeniu ir nieko neįrodo apie tikrąją globėjo tapatybę.",
      },
      conduct: {
        heading: "7. Tinkamas naudojimasis",
        body: "Naudokitės svetaine sąžiningai: savo tikruoju vardu, teisinga informacija apie augintinį ir tokiomis žinutėmis, kurių nesigėdytumėte perskaityti balsu. Nepriekabiaukite prie kitų naudotojų, neslėpkite gyvūno sveikatos ar būdo ypatumų ir nenaudokite svetainės nesusijusiai reklamai. Šias taisykles pažeidžiantį turinį ar paskyras galime pašalinti.",
      },
      liability: {
        heading: "8. Atsakomybė",
        body: "Svetainė teikiama tokia, kokia yra, negarantuojant, kad ji veiks, bus pasiekiama ar apsaugos jūsų duomenis nuo bet kokio gedimo. PetBnB neprisiima atsakomybės už augintinių, žmonių ar turto praradimą, sužalojimą, ligą ar žalą, kilusią dėl užsakymo. Šią riziką prisiima patys šeimininkai ir globėjai.",
      },
      dataAndPrivacy: {
        heading: "9. Jūsų duomenys",
        body: "Kai naudojatės svetaine, mes saugome jūsų paskyrą, o veiksmai su užsakymais reiškia, kad svetainė siunčia tikrus laiškus tikrais adresais. Gretimame skirtuke esančioje privatumo politikoje tiksliai nurodyta, kas renkama, kur tai saugoma ir kas gali tai skaityti.",
      },
      changes: {
        heading: "10. Taisyklių pakeitimai",
        body: "Šios taisyklės gali keistis kartu su projektu. Data viršuje rodo, kada jos paskutinį kartą peržiūrėtos. Toliau naudodamiesi svetaine po pakeitimo, sutinkate su atnaujinta jų redakcija.",
      },
    },
    contactPrefix: "Turite klausimų dėl šių taisyklių?",
    contactCta: "Parašykite mums",
  },

  privacy: {
    title: "Privatumo politika",
    lastUpdated: "Paskutinį kartą atnaujinta: 2026 m. lapkričio mėn.",
    intro:
      "Šioje politikoje aprašoma, ką PetBnB iš tikrųjų saugo, kur tai laikoma ir kas gali tai skaityti. Ten, kur sąžiningas atsakymas yra „nieko“, taip ir parašyta — tai studento projektas, renkantis kur kas mažiau duomenų nei komercinė platforma.",
    sections: {
      whoWeAre: {
        heading: "1. Kas už viso to stovi",
        body: "PetBnB yra universiteto projektas, kurį vykdo studentas, o ne registruota įmonė. Tai svarbu jūsų lūkesčiams: čia nėra nei duomenų apsaugos pareigūno, nei klientų aptarnavimo skyriaus, nei teisininkų. Klausimai keliauja į vieną pašto dėžutę, į kurią atsako žmogus.",
      },
      whatWeCollect: {
        heading: "2. Ką renkame",
        body: "Tik tai, ko reikia svetainės veikimui: jūsų vardą, el. pašto adresą ir prisijungimo duomenis; miestą bei telefono numerį, jei juos nurodote; profilio nuotrauką, jei ją įkeliate; informaciją apie pridėtus augintinius, įskaitant rūšį, amžių ir priežiūros pastabas; jūsų užsakymus; ir žinutes, kuriomis susirašinėjate su kitais naudotojais. Jei atliekate Smart-ID demo patikrą, dar išsaugome, kad ją atlikote, kada ir demo sesijos identifikatorių, bet nieko iš sertifikato. Verslui, kuris moka už reklamuojamą vietą, dar saugome „Stripe“ jo prenumeratos identifikatorių ir tos prenumeratos būseną. Daugiau nieko — jokio slapto profiliavimo, jokių iš kitur nupirktų duomenų.",
      },
      howWeUse: {
        heading: "3. Kam tai naudojame",
        body: "Paslaugos veikimui ir niekam daugiau. Jūsų profilis rodomas tiems globėjams ir šeimininkams, su kuriais bendraujate, augintinio duomenys keliauja pas jūsų užsakytą globėją, o žinutės pristatomos tam, kam jas parašėte. Mes neparduodame jūsų duomenų, nedaliname jų reklamuotojams ir nenaudojame jų dirbtiniam intelektui mokyti.",
      },
      email: {
        heading: "4. Laiškai, kuriuos jums siunčiame",
        body: "Tai tikra, o ne imituota: kai užsakymas pateikiamas, priimamas, atmetamas, atšaukiamas ar užbaigiamas, svetainė išsiunčia tikrą laišką jūsų paskyros adresu. Kalbos nuostata saugoma jūsų profilyje, kad laiškas ateitų lietuviškai arba angliškai. Tai su jūsų pačių užsakymais susijusios tarnybinės žinutės — jokio reklamos sąrašo ir jokio naujienlaiškio nėra.",
      },
      whereItLives: {
        heading: "5. Kur saugomi jūsų duomenys",
        body: "„Supabase“ valdomoje „Postgres“ duomenų bazėje ir failų saugykloje, Europos Sąjungoje — eu-central-1 regione, Frankfurte, Vokietijoje. Įprastai veikiant, jūsų duomenys ES ribų neperžengia. Slaptažodžius tvarko „Supabase Auth“, ir mes jų niekada nesaugome skaitomu pavidalu. Jei verslas moka už reklamuojamą vietą, mokėjimą ir atsiskaitymo duomenis tvarko „Stripe“ pagal savo privatumo politiką. PetBnB perduoda paskyros el. pašto adresą, kad jis būtų įrašytas mokėjimo formoje, ir gauna atgal tik „Stripe“ prenumeratos ir kliento identifikatorius bei prenumeratos būseną.",
      },
      browserStorage: {
        heading: "6. Ką išsaugo jūsų naršyklė",
        body: "Du dalykus. Pasirinkta kalba laikoma vietinėje saugykloje raktu petbnb-locale, kad kitą kartą svetainė atsivertų tinkama kalba. Prisijungimo sesiją tvarko „Supabase Auth“, kad liktumėte prisijungę. Jokių reklaminių slapukų ir jokių trečiųjų šalių sekiklių nėra — todėl jūsų niekas ir neprašė uždaryti slapukų pranešimo.",
      },
      whoCanSee: {
        heading: "7. Kas gali matyti jūsų duomenis",
        body: "Prieigą riboja pati duomenų bazė, o ne vien naudotojo sąsaja. Vieši yra visi profiliai — ne tik globėjų, bet ir šeimininkų: bet kas, prisijungęs ar ne, gali matyti juose nurodytą vardą, miestą, nuotrauką ir aprašymą, o globėjų profiliuose — dar ir kainas, paslaugas bei patirtį, taip pat ar gautas Smart-ID demo ženklelis. Tokia ir esmė: kad jus būtų galima rasti. Jūsų telefono numeris nėra viešas — jį matote tik jūs. Jūsų augintiniai taip pat nėra vieši: juos skaityti gali tik jūs ir globėjas, turintis tikrą to augintinio užsakymą. Žinutes mato tik du pokalbio dalyviai.",
      },
      noTracking: {
        heading: "8. Ko sąmoningai nedarome",
        body: "Šioje svetainėje nėra jokios analitikos, jokios klaidų stebėjimo paslaugos, jokio reklaminio pikselio, jokio seansų įrašymo ir jokio trečiosios šalies scenarijaus, sekančio jūsų paspaudimus. Niekas nematuoja jūsų apsilankymo. Tai sąmoningas pasirinkimas — ir būtent todėl negalime pasakyti, kiek žmonių perskaitė šį puslapį.",
      },
      yourRights: {
        heading: "9. Jūsų pasirinkimai",
        body: "Savo profilį ir augintinių duomenis galite bet kada redaguoti paskyroje ir ištrinti viską, ką esate pridėję. Jei norite, kad paskyra ir visa, kas su ja susiję, būtų visiškai pašalinta, parašykite mums ir mes ją ištrinsime. Kadangi tai demonstracinis projektas, o ne veikianti paslauga, saugiausia čia nekelti nieko, ko nenorėtumėte prarasti.",
      },
    },
    contactPrefix: "Turite klausimų dėl savo duomenų?",
    contactCta: "Parašykite mums",
  },
  advertising: {
    title: "Taisyklės reklamuotojams",
    lastUpdated: "Paskutinį kartą atnaujinta: 2026 m. lapkričio mėn.",
    intro:
      "Šios taisyklės taikomos verslams, kurie moka už reklamuojamą vietą PetBnB vietų žemėlapyje. Tai verslo, o ne vartotojo pirkimas, o reklama parduodama tik ten, kur ją siūlo „Mano verslas“. Taisyklės parašytos paprastai ir nėra teisinė konsultacija.",
    sections: {
      whatItIs: {
        heading: "1. Kas yra reklamuojama vieta",
        body: "Jūsų puslapis rodomas pirmas vietų sąraše ir išsiskiria vietų žemėlapyje. Daugiau niekas nesikeičia: nei jūsų atsiliepimai, nei įvertinimas, nei tai, ką apie jus rašo bendruomenė, nei tai, kurie globėjai rodomi paieškoje.",
      },
      whoCanBuy: {
        heading: "2. Kas gali ją pirkti",
        body: "Verslas, kurio puslapį vietų žemėlapyje jis perėmė ir PetBnB patvirtino, perkantis verslo, o ne asmeniniams poreikiams. Mokantis asmuo patvirtina, kad gali veikti verslo vardu.",
      },
      price: {
        heading: "3. Kaina ir atsiskaitymas",
        body: "19 € per mėnesį, mokama iš anksto kortele per „Stripe“ ir pratęsiama kas mėnesį, kol atsisakysite. Už kiekvieną mokėjimą „Stripe“ atsiunčia kvitą su pardavėjo duomenimis. PetBnB kortelės duomenų niekada nemato ir nesaugo.",
      },
      startEnd: {
        heading: "4. Kada ji prasideda ir baigiasi",
        body: "Reklama įjungiama, kai „Stripe“ patvirtina mokėjimą. Atsisakyti galite bet kada per nuorodą „Stripe“ kvite; tada reklama rodoma iki jau apmokėto mėnesio pabaigos. Jei pratęsimo mokėjimas nepavyksta, reklama lieka, kol „Stripe“ bando nuskaityti kortelę, ir išjungiama, jei mokėjimo gauti nepavyksta.",
      },
      labelling: {
        heading: "5. Visada pažymėta kaip reklama",
        body: "Reklamuojamas puslapis visada pažymėtas „Reklama“ (anglų kalba „Ad“) su paaiškinimu, kad verslas moka PetBnB, kad būtų rodomas pirmas, todėl gyvūnų šeimininkai mato, kurios vietos mokamos. Žymos pašalinti negalima. Taip PetBnB laikosi ES skaitmeninių paslaugų akto reikalavimo reklamą žymėti kaip reklamą.",
      },
      content: {
        heading: "6. Ką gali skelbti jūsų puslapis",
        body: "Puslapyje rodoma tik tai, ką rašote apie savo verslą. Tai turi būti tiesa, įskaitant paslaugas, kainas ir darbo laiką, ir negali klaidinti gyvūnų šeimininkų ar kelti pavojaus gyvūnams. PetBnB gali nustoti reklamuoti puslapį, kuris pažeidžia šias ar bendrąsias taisykles; jei nustojame dėl kitos priežasties, grąžiname pinigus už nepanaudotą mėnesio dalį.",
      },
      results: {
        heading: "7. Rezultatų nežadame",
        body: "Reklama suteikia matomumą. PetBnB nežada peržiūrų, užsakymų užklausų ar klientų ir neatsako už lauktus, bet negautus užsakymus.",
      },
      changes: {
        heading: "8. Kainos ar šių taisyklių pakeitimai",
        body: "Apie kainos pakeitimą pranešame bent prieš 30 dienų el. paštu, nurodytu prenumeratoje, ir jis taikomas nuo kito atsiskaitymo mėnesio. Iki tol galite atsisakyti.",
      },
    },
    contactPrefix: "Turite klausimų dėl reklamos?",
    contactCta: "Parašykite mums",
  },
};

export default legal;
