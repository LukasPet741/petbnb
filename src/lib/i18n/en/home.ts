const home = {
  hero: {
    eyebrow: "Pet sitting in Lithuania",
    titleLine1: "Care from people",
    titleLine2: "who live nearby.",
    subtitle:
      "Dog walking, boarding, daycare and grooming, arranged directly with someone in your own city.",
    searchButton: "Find sitters",
    cityPlaceholder: "Your city",
    photoAlt: "A dog being looked after by a sitter in Lithuania",
  },
  services: {
    railLabel: "Browse by service",
    eyebrow: "Services",
    title: "What does your pet need?",
    items: {
      walking: {
        line: "30–60 min around your neighbourhood",
        point1: "The walker comes to you",
        point2: "30 to 60 minutes on your own streets",
        point3: "Short, so a good first meeting",
        cta: "Find a dog walker",
      },
      boarding: {
        line: "While you're away",
        point1: "Overnight at the sitter's home",
        point2: "You arrange drop-off together",
        point3: "Meet them first",
        cta: "Find a sitter",
      },
      daycare: {
        line: "Days at the sitter's, home by evening",
        point1: "While you're at work or away for the day",
        point2: "For pets who don't like being alone",
        point3: "Back home the same evening",
        cta: "Find a sitter",
      },
      grooming: {
        line: "Bathing, trimming, nails",
        point1: "Coat care suited to the breed",
        point2: "Ask which breeds they have groomed",
        point3: "Only a few offer it so far",
        cta: "Find a groomer",
      },
    },
  },

  honest: {
    title: "What we do, and what we don't",
    points: {
      fees: {
        title: "PetBnB charges nothing",
        body: "No commission, and the site never handles money. You pay whoever does the job, directly.",
      },
      vetting: {
        title: "We don't check profiles",
        body: "Everything on a profile was written by that person. Meet before you book.",
      },
      insurance: {
        title: "No insurance",
        body: "This is a university project: if something goes wrong, there is no cover behind it.",
      },
      data: {
        title: "Database in the EU",
        body: "Accounts, pets and messages are stored in Frankfurt. No analytics, no tracking pixels.",
      },
    },
    termsLink: "Read the full terms",
    privacyLink: "Read the privacy policy",
  },
  cities: {
    title: "Start with your city",
    subtitle:
      "We are early, so some cities are still small.",
    seeAll: "All cities",
    sitterCount: {
      one: "{count} sitter",
      few: "{count} sitters",
      other: "{count} sitters",
    },
    errorTitle: "Couldn't load cities right now",
    errorDesc: "Please refresh the page in a moment.",
    emptyTitle: "No sitters listed yet",
    emptyDesc: "Be the first to list yourself, and your city appears here.",
  },
  voices: {
    title: "In their own words",
    subtitle: "Lines taken from sitter profiles.",
    seeAll: "See all sitters",
    openProfile: "Open {name}'s profile",
    errorTitle: "Couldn't load sitters right now",
    errorDesc: "Please refresh the page in a moment.",
    emptyTitle: "No sitters yet",
    emptyDesc: "Check back soon, or be the first to list yourself as a sitter.",
  },
  how: {
    title: "How a booking happens",
    subtitle: "Three steps, and what protects you at each one.",
    steps: {
      find: {
        title: "Find a sitter",
        desc: "Browse local sitters and filter by city, service and rate.",
        note: "Every sitter writes their own bio and sets their own hourly rate.",
      },
      request: {
        title: "Send a request",
        desc: "Pick a date, choose your pet, and send a booking request in under a minute.",
        note: "Nothing is booked until the sitter accepts. You are never committed before that.",
      },
      confirm: {
        title: "They confirm",
        desc: "The sitter accepts, and you agree the details in messages.",
        note: "Sitters keep what they charge. PetBnB adds nothing on top.",
      },
    },
  },
  becomeSitter: {
    titleLine1: "Love animals?",
    titleLine2: "Earn doing it.",
    subtitle:
      "PetBnB is a university project, not a company. List yourself, set your own rate, and keep everything you charge.",
    perks: {
      ownRate: "Set your own rate",
      chooseServices: "Choose your services",
      ownHours: "Work your own hours",
      free: "Free to list",
    },
    cta: "Become a sitter",
    imageAlt: "A happy dog with its sitter",
  },
  faq: {
    title: "Frequently asked questions",
    items: {
      howItWorks: {
        q: "How does PetBnB work?",
        a: "Browse local sitters, open a profile, and send a booking request for the dates and service you need. The sitter reviews it and either confirms or declines, and you can message each other here while you sort out the details. PetBnB never charges anything, and a request binds nobody until you both agree.",
      },
      cost: {
        q: "How much does it cost?",
        a: "Each sitter sets their own price for a day, a few days, a week or longer, and you can make an offer when you send a request. PetBnB adds nothing on top: no booking fee, no service charge, no commission. You pay the sitter directly, however the two of you arrange it.",
      },
      areas: {
        q: "Which areas are covered?",
        a: "Sitters are active across Vilnius, Kaunas, Klaipėda, Šiauliai and Panevėžys. Coverage is uneven and we would rather say so: some cities have a handful of people, not a full roster. If yours looks empty, it means nobody has signed up there yet.",
      },
      becomeSitter: {
        q: "How do I become a sitter?",
        a: "Create an account, open your Profile, switch on Sitter mode, then add your services, your prices and a short bio. You appear in browse results straight away. Before anyone can book you, confirm your identity once with the Smart-ID demo linked from your Profile; it takes about a minute.",
      },
      realCompany: {
        q: "Is this a real company?",
        a: "No. PetBnB is a university project, a full-stack demonstration marketplace built to show how the experience could work end to end. There is no company behind it, and most sitters you see are seeded example accounts rather than people working today.",
      },
    },
  },
};

export default home;
