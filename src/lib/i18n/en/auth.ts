const auth = {
  knownErrors: {
    invalidCredentials: "Incorrect email or password.",
    userAlreadyRegistered: "An account with this email already exists.",
    emailNotConfirmed: "Please confirm your email before signing in.",
    weakPassword: "Password is too short.",
  },
  login: {
    imageAlt: "A dog being cared for",
    heroTitle: "Your pet is in good hands.",
    heroSubtitle: "Sign in to manage your pets, bookings and sitter profile.",
    title: "Welcome back",
    subtitle: "Sign in to your account to continue.",
    form: {
      emailLabel: "Email address",
      emailPlaceholder: "you@example.com",
      passwordLabel: "Password",
      passwordPlaceholder: "Enter your password",
    },
    errorFallback: "Sign in failed",
    noAccount: "Don't have an account?",
    createOneFree: "Create one free",
    termsAgreementPrefix: "By signing in you agree to our",
  },
  signup: {
    imageAlt: "A cozy pet",
    heroTitle: "Care your pet deserves.",
    heroSubtitle: "Join PetBnB and find a reliable sitter in your neighbourhood, or start sitting yourself.",
    perks: {
      browse: "Browse trusted local sitters",
      book: "Book walking, boarding, daycare & grooming",
      manage: "Manage all your pets in one place",
      track: "Track every booking in one dashboard",
    },
    title: "Create your account",
    subtitle: "Free to join. Takes less than a minute.",
    form: {
      emailLabel: "Email address",
      emailPlaceholder: "you@example.com",
      passwordLabel: "Password",
      passwordPlaceholder: "At least 8 characters",
      confirmLabel: "Confirm password",
      confirmPlaceholder: "Repeat your password",
    },
    passwordMismatch: "Passwords do not match",
    errorFallback: "Sign up failed",
    alreadyHaveAccount: "Already have an account?",
    termsAgreementPrefix: "By creating an account you agree to our",
  },
  terms: {
    backLink: "Back",
    lastUpdated: "Last updated: June 2026",
    sections: {
      aboutProject: {
        heading: "1. About this project",
        body: "PetBnB is a university project, a demonstration marketplace that connects pet owners with independent pet sitters. It is not a commercial service, and these terms are illustrative.",
      },
      acceptance: {
        heading: "2. Acceptance of Terms",
        body: "By accessing and using PetBnB, you accept and agree to be bound by these Terms and Conditions. If you do not agree, please do not use the service.",
      },
      userAccounts: {
        heading: "3. User Accounts",
        body: "You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account.",
      },
      bookings: {
        heading: "4. Bookings",
        body: "All bookings are subject to sitter availability and acceptance. PetBnB facilitates the connection but is not a party to any agreement made between owners and sitters.",
      },
      payments: {
        heading: "5. Payments",
        body: "PetBnB does not process payments and does not charge booking fees. Any financial arrangements are made directly between owners and sitters.",
      },
      sitters: {
        heading: "6. Sitters",
        body: "PetBnB does not vet, verify or background-check sitters. Profile information is self-reported. Always use your own judgement and exercise due diligence before booking.",
      },
      liability: {
        heading: "7. Liability",
        body: "PetBnB is not liable for any loss, injury or damage to pets, people or property that may occur during bookings. Owners and sitters assume all associated risks.",
      },
      privacy: {
        heading: "8. Privacy",
        body: "Your personal data is used solely to operate the PetBnB demo and is not sold to third parties.",
      },
    },
    questionsPrefix: "Questions?",
    contactUs: "Contact us",
  },
};

export default auth;
