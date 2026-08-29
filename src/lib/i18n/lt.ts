import home from "./lt/home";
import auth from "./lt/auth";
import sitters from "./lt/sitters";
import appShell from "./lt/appShell";
import appPages from "./lt/appPages";
import tips from "./lt/tips";

const lt = {
  common: {
    meta: {
      title: "PetBnB: gyvūnų globėjai netoliese, visoje Lietuvoje",
      description:
        "Suraskite patikimą vietos globėją vedžiojimui, apgyvendinimui, dienos priežiūrai ar kirpimui. Užsisakykite per kelias minutes.",
    },
    signIn: "Prisijungti",
    getStarted: "Pradėti",
    createAccount: "Sukurti paskyrą",
    terms: "Taisyklės ir sąlygos",
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
};

export default lt;
