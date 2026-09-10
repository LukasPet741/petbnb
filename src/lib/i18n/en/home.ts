const home = {
  hero: {
    eyebrow: "Pet sitting in Lithuania",
    titleLine1: "Care from people",
    titleLine2: "who live nearby.",
    subtitle:
      "Walking, boarding, daycare and grooming, arranged directly with a sitter in your own city.",
    searchButton: "Find sitters",
    cityPlaceholder: "Your city",
    photoAlt: "A dog being looked after by a sitter in Lithuania",
  },
  services: {
    railLabel: "Browse by service",
    title: "Four things a sitter can do",
    subtitle: "Every card opens the sitters offering it, filtered to your city.",
    items: {
      walking: {
        desc: "A sitter comes to you and takes your dog out, usually for 30 to 60 minutes around your own streets and parks. The most common booking here, and the easiest place to start with someone new.",
      },
      boarding: {
        desc: "Your pet stays overnight at the sitter's home while you are away. You agree drop-off and pick-up directly, and most sitters ask to meet the animal once before the first night.",
      },
      daycare: {
        desc: "Daytime care at the sitter's place while you work, then home in the evening. Suited to animals that do not settle on their own, and to long days you cannot break up.",
      },
      grooming: {
        desc: "Washing, brushing, nail trimming and coat work. The most skill-dependent service on the site, so read the bio and ask what breeds and coats the sitter has handled before.",
      },
    },
  },

  honest: {
    title: "What this site does, and what it doesn't",
    subtitle: "Most marketplaces bury this in a terms page. Ours is short enough to read here.",
    points: {
      fees: {
        title: "No fees, no payments",
        body: "PetBnB takes no commission and processes no money. Sitters set their own rate and you settle it between yourselves, away from the platform. Nothing here ever asks for card details.",
      },
      vetting: {
        title: "We do not vet sitters",
        body: "No background checks, no interviews, no verified badges. Everything on a profile was written by that sitter. Meet before you book, and ask what you would ask anyone minding your animal.",
      },
      insurance: {
        title: "No insurance, no guarantee",
        body: "If something goes wrong there is no cover behind it and no claims process. Bigger platforms offer one. This is a student project and does not, so the risk stays with you and the sitter.",
      },
      data: {
        title: "Your data stays in the EU",
        body: "Accounts, pets and messages live in a Postgres database in Frankfurt. There is no analytics package, no tracking pixel and nobody measuring your visit.",
      },
    },
    termsLink: "Read the full terms",
    privacyLink: "Read the privacy policy",
  },
  cities: {
    title: "Start with your city",
    subtitle:
      "Every sitter below signed up on their own. We are early, so some cities are still small.",
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
    subtitle: "Every line here was written by the sitter who signed it.",
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
        desc: "Your sitter accepts the request and takes it from there.",
        note: "Sitters keep what they charge. PetBnB adds nothing on top.",
      },
    },
  },
  becomeSitter: {
    titleLine1: "Love animals?",
    titleLine2: "Earn doing it.",
    subtitle:
      "PetBnB is a small Lithuanian project, still finding its first regulars. List yourself, set your own rate, and keep everything you charge.",
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
        a: "Browse local sitters, open a profile, and send a booking request for the dates and service you need. The sitter reviews it and either confirms or declines, and you can message each other here while you sort out the details. Nothing is charged and nothing is binding until you both agree.",
      },
      cost: {
        q: "How much does it cost?",
        a: "Each sitter sets their own hourly rate, starting from €13/hr. PetBnB adds nothing on top: no booking fee, no service charge, no commission. You pay the sitter directly, however the two of you arrange it.",
      },
      areas: {
        q: "Which areas are covered?",
        a: "Sitters are active across Vilnius, Kaunas, Klaipėda, Šiauliai and Panevėžys. Coverage is uneven and we would rather say so: some cities have a handful of people, not a full roster. If yours looks empty, it means nobody has signed up there yet.",
      },
      becomeSitter: {
        q: "How do I become a sitter?",
        a: "Create an account, open your Profile, switch on Sitter mode, then add your services, your rate and a short bio. You appear in browse results straight away — there is no application to submit and no approval to wait for.",
      },
      realCompany: {
        q: "Is this a real company?",
        a: "No. PetBnB is a university project, a full-stack demonstration marketplace built to show how the experience could work end to end. There is no company behind it, and most sitters you see are seeded example accounts rather than people working today.",
      },
    },
  },
};

export default home;
