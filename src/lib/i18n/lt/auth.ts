const auth = {
  knownErrors: {
    invalidCredentials: "Neteisingas el. paštas arba slaptažodis.",
    userAlreadyRegistered: "Paskyra su šiuo el. paštu jau egzistuoja.",
    emailNotConfirmed: "Prieš prisijungdami patvirtinkite savo el. paštą.",
    weakPassword: "Slaptažodis per trumpas.",
  },
  login: {
    imageAlt: "Prižiūrimas šuo",
    heroTitle: "Jūsų augintinis patikimose rankose.",
    heroSubtitle: "Prisijunkite ir tvarkykite savo augintinius, užsakymus bei globėjo profilį.",
    title: "Sveiki sugrįžę",
    subtitle: "Prisijunkite prie savo paskyros, kad tęstumėte.",
    form: {
      emailLabel: "El. pašto adresas",
      emailPlaceholder: "jus@pastas.lt",
      passwordLabel: "Slaptažodis",
      passwordPlaceholder: "Įveskite slaptažodį",
    },
    errorFallback: "Prisijungti nepavyko",
    noAccount: "Neturite paskyros?",
    createOneFree: "Susikurkite nemokamai",
    termsAgreementPrefix: "Prisijungdami sutinkate, kad galioja mūsų",
  },
  signup: {
    imageAlt: "Jaukiai įsitaisęs augintinis",
    heroTitle: "Priežiūra, kurios nusipelno jūsų augintinis.",
    heroSubtitle: "Prisijunkite prie PetBnB ir raskite patikimą globėją savo apylinkėje arba patys pradėkite globoti.",
    perks: {
      browse: "Naršykite patikimus vietos globėjus",
      book: "Užsisakykite vedžiojimą, apgyvendinimą, dienos priežiūrą ir kirpimą",
      manage: "Tvarkykite visus augintinius vienoje vietoje",
      track: "Sekite visus užsakymus viename skydelyje",
    },
    title: "Susikurkite paskyrą",
    subtitle: "Registracija nemokama. Užtrunka mažiau nei minutę.",
    form: {
      emailLabel: "El. pašto adresas",
      emailPlaceholder: "jus@pastas.lt",
      passwordLabel: "Slaptažodis",
      passwordPlaceholder: "Bent 8 simboliai",
      confirmLabel: "Pakartokite slaptažodį",
      confirmPlaceholder: "Įveskite slaptažodį dar kartą",
    },
    passwordMismatch: "Slaptažodžiai nesutampa",
    errorFallback: "Registracija nepavyko",
    alreadyHaveAccount: "Jau turite paskyrą?",
    termsAgreementPrefix: "Sukurdami paskyrą jums galioja mūsų",
  },
};

export default auth;
