import home from "./en/home";
import auth from "./en/auth";
import sitters from "./en/sitters";
import appShell from "./en/appShell";
import appPages from "./en/appPages";
import tips from "./en/tips";
import messages from "./en/messages";
import legal from "./en/legal";

const en = {
  common: {
    meta: {
      title: "PetBnB: Pet sitters near you in Lithuania",
      description:
        "Find a local pet sitter for walking, boarding, daycare and grooming. Book in minutes.",
    },
    signIn: "Sign in",
    getStarted: "Get started",
    createAccount: "Create account",
    terms: "Terms & Conditions",
    privacy: "Privacy Policy",
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
    timeAgo: {
      justNow: "just now",
      minutesAgo: "{minutes}m ago",
      hoursAgo: "{hours}h ago",
      daysAgo: "{days}d ago",
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
  messages,
  legal,
};

export default en;
