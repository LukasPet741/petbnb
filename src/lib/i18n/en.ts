import home from "./en/home";
import auth from "./en/auth";
import sitters from "./en/sitters";
import appShell from "./en/appShell";
import appPages from "./en/appPages";
import tips from "./en/tips";

const en = {
  common: {
    signIn: "Sign in",
    getStarted: "Get started",
    createAccount: "Create account",
    terms: "Terms & Conditions",
    footerNote: "A student project connecting pet owners with local sitters.",
    sitterWord: "sitter",
    languageLabel: "Language",
    experienceSuffix: "{years} yr experience",
    experienceSuffixPlural: "{years} yrs experience",
    services: {
      walking: "Dog Walking",
      boarding: "Boarding",
      daycare: "Daycare",
      grooming: "Grooming",
    },
    petTypes: {
      dog: "Dog",
      cat: "Cat",
      bird: "Bird",
      reptile: "Reptile",
      small_mammal: "Small Mammal",
      fish: "Fish",
      other: "Other",
    },
    bookingStatus: {
      pending: "Pending",
      signed: "Confirmed",
      declined: "Declined",
      cancelled: "Cancelled",
      completed: "Completed",
    },
    // Adjectival form agreeing with a plural noun (e.g. "No {x} bookings") — distinct from
    // bookingStatus's chip labels since Lithuanian requires case agreement here.
    bookingStatusGenitive: {
      pending: "pending",
      signed: "confirmed",
      declined: "declined",
      cancelled: "cancelled",
      completed: "completed",
    },
    petSex: {
      male: "male",
      female: "female",
      unknown: "unknown",
    },
  },
  home,
  auth,
  sitters,
  appShell,
  appPages,
  tips,
};

export default en;
