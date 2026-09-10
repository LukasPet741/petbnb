const home = {
  hero: {
    eyebrow: "Augintinių priežiūra Lietuvoje",
    titleLine1: "Priežiūra iš žmonių,",
    titleLine2: "kurie gyvena šalia.",
    subtitle:
      "Vedžiojimas, apgyvendinimas, dienos priežiūra ir kirpimas, sutariama tiesiogiai su globėju jūsų mieste.",
    searchButton: "Ieškoti globėjų",
    cityPlaceholder: "Jūsų miestas",
    photoAlt: "Šuo, kurį Lietuvoje prižiūri globėjas",
  },
  services: {
    railLabel: "Naršyti pagal paslaugą",
    title: "Keturi dalykai, kuriuos gali atlikti globėjas",
    subtitle: "Kiekviena kortelė atveria tą paslaugą siūlančius globėjus jūsų mieste.",
    items: {
      walking: {
        desc: "Globėjas atvyksta pas jus ir išveda šunį — paprastai 30–60 minučių jūsų pačių gatvėmis ir parkais. Dažniausias užsakymas čia ir paprasčiausias būdas išbandyti naują globėją.",
      },
      boarding: {
        desc: "Jums išvykus, augintinis nakvoja globėjo namuose. Dėl atvežimo ir pasiėmimo tariatės tiesiogiai, o dauguma globėjų prašo bent kartą susipažinti su gyvūnu prieš pirmą naktį.",
      },
      daycare: {
        desc: "Dienos priežiūra pas globėją, kol dirbate, o vakare — namo. Tinka gyvūnams, kurie sunkiai lieka vieni, ir ilgoms dienoms, kurių niekaip nepertrauksite.",
      },
      grooming: {
        desc: "Maudymas, šukavimas, nagų kirpimas ir kailio priežiūra. Labiausiai nuo įgūdžių priklausanti paslauga svetainėje, tad perskaitykite aprašymą ir pasiteiraukite, su kokiomis veislėmis globėjas jau dirbo.",
      },
    },
  },

  honest: {
    title: "Ką ši svetainė daro ir ko nedaro",
    subtitle: "Daugelis platformų tai paslepia taisyklėse. Mūsų sąrašas pakankamai trumpas, kad perskaitytumėte čia pat.",
    points: {
      fees: {
        title: "Jokių mokesčių, jokių mokėjimų",
        body: "PetBnB neima komisinių ir netvarko pinigų. Globėjai patys nustato įkainį, o jūs atsiskaitote tarpusavyje, už platformos ribų. Niekur čia neprašoma kortelės duomenų.",
      },
      vetting: {
        title: "Globėjų netikriname",
        body: "Jokių patikrų dėl praeities, jokių pokalbių, jokių patvirtinimo ženklelių. Viską profilyje parašė pats globėjas. Susitikite prieš užsakydami ir klauskite visko, ko klaustumėte bet kuriam žmogui, kuriam paliekate gyvūną.",
      },
      insurance: {
        title: "Jokio draudimo, jokios garantijos",
        body: "Jei kas nors nutiktų, už to nestovi jokia apsauga ir nėra žalos atlyginimo tvarkos. Didesnės platformos tai siūlo. Ši svetainė yra studento projektas ir to nesiūlo, tad rizika lieka jums ir globėjui.",
      },
      data: {
        title: "Jūsų duomenys lieka ES",
        body: "Paskyros, augintiniai ir žinutės saugomi „Postgres“ duomenų bazėje Frankfurte. Nėra jokios analitikos, jokio sekimo pikselio ir niekas nematuoja jūsų apsilankymo.",
      },
    },
    termsLink: "Skaityti visas taisykles",
    privacyLink: "Skaityti privatumo politiką",
  },
  cities: {
    title: "Pradėkite nuo savo miesto",
    subtitle:
      "Kiekvienas žemiau esantis globėjas užsiregistravo pats. Esame tik pradžioje, todėl kai kuriuose miestuose jų dar nedaug.",
    seeAll: "Visi miestai",
    sitterCount: {
      one: "{count} globėjas",
      few: "{count} globėjai",
      other: "{count} globėjų",
    },
    errorTitle: "Nepavyko įkelti miestų",
    errorDesc: "Perkraukite puslapį po kelių akimirkų.",
    emptyTitle: "Kol kas nėra nė vieno globėjo",
    emptyDesc: "Užsiregistruokite pirmas ir jūsų miestas atsiras čia.",
  },
  voices: {
    title: "Jų pačių žodžiais",
    subtitle: "Kiekvieną čia esančią eilutę parašė ją pasirašęs globėjas.",
    seeAll: "Žiūrėti visus globėjus",
    openProfile: "Atidaryti {name} profilį",
    errorTitle: "Nepavyko įkelti globėjų",
    errorDesc: "Perkraukite puslapį po kelių akimirkų.",
    emptyTitle: "Kol kas nėra globėjų",
    emptyDesc: "Užsukite vėliau arba tapkite pirmuoju globėju.",
  },
  how: {
    title: "Kaip vyksta užsakymas",
    subtitle: "Trys žingsniai ir tai, kas jus apsaugo kiekviename iš jų.",
    steps: {
      find: {
        title: "Raskite globėją",
        desc: "Naršykite vietos globėjus ir filtruokite pagal miestą, paslaugą bei įkainį.",
        note: "Kiekvienas globėjas pats parašo savo aprašymą ir nusistato valandinį įkainį.",
      },
      request: {
        title: "Išsiųskite užklausą",
        desc: "Pasirinkite datą, augintinį ir per minutę išsiųskite užsakymo užklausą.",
        note: "Niekas nėra užsakyta, kol globėjas nepriima užklausos. Iki tol niekuo neįsipareigojate.",
      },
      confirm: {
        title: "Globėjas patvirtina",
        desc: "Globėjas priima užklausą ir toliau viskuo pasirūpina.",
        note: "Globėjai pasilieka viską, ką uždirba. PetBnB nieko neprideda.",
      },
    },
  },
  becomeSitter: {
    titleLine1: "Mylite gyvūnus?",
    titleLine2: "Uždirbkite tai darydami.",
    subtitle:
      "PetBnB yra nedidelis lietuviškas projektas, dar tik ieškantis pirmųjų nuolatinių klientų. Užsiregistruokite, nusistatykite savo įkainį ir pasilikite viską, ką uždirbate.",
    perks: {
      ownRate: "Nustatykite savo įkainį",
      chooseServices: "Pasirinkite paslaugas",
      ownHours: "Dirbkite jums patogiu laiku",
      free: "Registracija nemokama",
    },
    cta: "Tapti globėju",
    imageAlt: "Laimingas šuo su savo globėju",
  },
  faq: {
    title: "Dažnai užduodami klausimai",
    items: {
      howItWorks: {
        q: "Kaip veikia PetBnB?",
        a: "Naršykite vietos globėjus, atsidarykite profilį ir išsiųskite užsakymo užklausą reikiamoms datoms bei paslaugai. Globėjas ją peržiūri ir arba patvirtina, arba atmeta, o detales galite aptarti susirašinėdami čia pat. Niekas neapmokestinama ir niekas neįpareigoja, kol abu nesutariate.",
      },
      cost: {
        q: "Kiek tai kainuoja?",
        a: "Kiekvienas globėjas nustato savo valandinį įkainį, prasidedantį nuo maždaug 10 €/val. PetBnB nieko neprideda: jokio užsakymo mokesčio, jokio aptarnavimo mokesčio, jokių komisinių. Globėjui sumokate tiesiogiai, kaip patys susitariate.",
      },
      areas: {
        q: "Kurie miestai aptarnaujami?",
        a: "Globėjai dirba Vilniuje, Kaune, Klaipėdoje, Šiauliuose ir Panevėžyje. Aprėptis netolygi, ir mes verčiau tai pasakome: kai kuriuose miestuose yra vos keli žmonės, o ne visas sąrašas. Jei jūsiškis atrodo tuščias, vadinasi, ten dar niekas neužsiregistravo.",
      },
      becomeSitter: {
        q: "Kaip tapti globėju?",
        a: "Susikurkite paskyrą, atsidarykite Profilį, įjunkite Globėjo režimą ir pridėkite paslaugas, įkainį bei trumpą aprašymą. Paieškos rezultatuose atsirasite iškart — nereikia nei teikti paraiškos, nei laukti patvirtinimo.",
      },
      realCompany: {
        q: "Ar tai tikra įmonė?",
        a: "Ne. PetBnB yra universiteto projektas, pilnavertė demonstracinė prekyvietė, sukurta parodyti, kaip visas procesas galėtų veikti nuo pradžios iki pabaigos. Už jos nestovi jokia įmonė, o dauguma matomų globėjų yra pavyzdiniai profiliai, o ne šiandien dirbantys žmonės.",
      },
    },
  },
};

export default home;
