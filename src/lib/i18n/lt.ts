import home from "./lt/home";
import auth from "./lt/auth";
import sitters from "./lt/sitters";
import appShell from "./lt/appShell";
import appPages from "./lt/appPages";
import tips from "./lt/tips";
import messages from "./lt/messages";
import legal from "./lt/legal";

const lt = {
  common: {
    meta: {
      title: "PetBnB: gyvūnų globėjai netoliese, visoje Lietuvoje",
      description:
        "Suraskite patikimą vietos globėją vedžiojimui, apgyvendinimui, dienos priežiūrai ar kirpimui. Užsisakykite per kelias minutes.",
    },
    signIn: "Prisijungti",
    getStarted: "Pradėti",
    dashboard: "Skydelis",
    createAccount: "Sukurti paskyrą",
    terms: "Taisyklės ir sąlygos",
    privacy: "Privatumo politika",
    footerNote: "Studentų projektas, jungiantis augintinių šeimininkus su vietos globėjais.",
    sitterWord: "globėjas",
    languageLabel: "Kalba",
    experienceSuffix: "{years} m. patirties",
    experienceSuffixPlural: "{years} m. patirties",
    services: {
      walking: "Šunų vedžiojimas",
      boarding: "Apgyvendinimas",
      daycare: "Dienos priežiūra",
      grooming: "Kirpimas",
    },
    // Kainos: laikotarpio kaina yra mažiausia; ilgesnė viešnagė skaičiuojama proporcingai.
    pricing: {
      from: "nuo",
      perDay: "/ d.",
      perDays: "/ {count} d.",
      perVisit: "/ vizitas",
      approxPerDay: "≈ {price} / d.",
      noPrice: "Kaina nenurodyta",
      // Galininkas po „už“: 75 € už 3 dienas.
      periods: {
        "1": "1 dieną",
        "3": "3 dienas",
        "7": "1 savaitę",
        "10": "10 dienų",
        "14": "2 savaites",
        "30": "1 mėnesį",
      },
      days: {
        one: "{count} diena",
        few: "{count} dienos",
        other: "{count} dienų",
      },
      asking: "Prašoma {price}",
      offered: "Siūloma {price}",
      agreed: "Sutarta {price}",
    },
    verification: {
      sealDemo: "Tapatybė patvirtinta per Smart-ID (demo)",
      seal: "Tapatybė patvirtinta per Smart-ID",
      rowTitle: "Tapatybė patvirtinta per Smart-ID",
      demoTag: "DEMO",
      demoNote: "Demonstracinė patikra: tikro asmens tapatybė nepatvirtinta.",
    },
    notFound: {
      title: "Tokio puslapio nėra",
      body: "Nuoroda gali būti pasenusi arba adrese yra klaida.",
      home: "Į pradžios puslapį",
    },
    error: {
      title: "Kažkas nepavyko",
      body: "Puslapio įkelti nepavyko. Bandykite dar kartą, o jei klaida kartojasi, sugrįžkite po kelių minučių.",
      retry: "Bandyti dar kartą",
      home: "Į pradžios puslapį",
    },
    petTypes: {
      dog: "Šuo",
      cat: "Katė",
      bird: "Paukštis",
      reptile: "Roplys",
      small_mammal: "Smulkus žinduolis",
      fish: "Žuvis",
      other: "Kita",
    },
    bookingStatus: {
      pending: "Laukiama",
      signed: "Patvirtinta",
      declined: "Atmesta",
      cancelled: "Atšaukta",
      completed: "Įvykdyta",
    },
    // Genitive-plural adjective form agreeing with "užsakymų" in "Nėra {x} užsakymų".
    bookingStatusGenitive: {
      pending: "laukiančių",
      signed: "patvirtintų",
      declined: "atmestų",
      cancelled: "atšauktų",
      completed: "įvykdytų",
    },
    timeAgo: {
      justNow: "ką tik",
      minutesAgo: "prieš {minutes} min.",
      hoursAgo: "prieš {hours} val.",
      daysAgo: "prieš {days} d.",
    },
    petSex: {
      male: "patinas",
      female: "patelė",
      unknown: "nežinoma",
    },
  },
  home,
  auth,
  sitters,
  appShell,
  appPages,
  tips,
  messages,
  legal,
};

export default lt;
