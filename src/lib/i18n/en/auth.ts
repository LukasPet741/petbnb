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
};

export default auth;
