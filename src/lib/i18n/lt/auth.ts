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
    termsAgreementPrefix: "Prisijungdami sutinkate su mūsų",
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
    termsAgreementPrefix: "Sukurdami paskyrą sutinkate su mūsų",
  },
  terms: {
    backLink: "Atgal",
    lastUpdated: "Paskutinį kartą atnaujinta: 2026 m. birželis",
    sections: {
      aboutProject: {
        heading: "1. Apie šį projektą",
        body: "PetBnB yra universiteto projektas, demonstracinė prekyvietė, jungianti augintinių šeimininkus su nepriklausomais globėjais. Tai nėra komercinė paslauga, o šios taisyklės yra iliustracinės.",
      },
      acceptance: {
        heading: "2. Taisyklių priėmimas",
        body: "Naudodamiesi PetBnB, jūs sutinkate ir įsipareigojate laikytis šių Taisyklių ir sąlygų. Jei nesutinkate, prašome nesinaudoti paslauga.",
      },
      userAccounts: {
        heading: "3. Naudotojo paskyra",
        body: "Kurdami paskyrą privalote pateikti tikslią informaciją. Jūs atsakote už savo paskyros duomenų konfidencialumą ir visą veiklą, vykdomą jūsų paskyroje.",
      },
      bookings: {
        heading: "4. Užsakymai",
        body: "Visi užsakymai priklauso nuo globėjo laisvo laiko ir sutikimo. PetBnB tik palengvina susisiekimą, bet nėra susitarimo tarp šeimininko ir globėjo šalis.",
      },
      payments: {
        heading: "5. Mokėjimai",
        body: "PetBnB nevykdo mokėjimų ir netaiko užsakymo mokesčių. Visi finansiniai susitarimai vyksta tiesiogiai tarp šeimininko ir globėjo.",
      },
      sitters: {
        heading: "6. Globėjai",
        body: "PetBnB netikrina globėjų ir neatlieka jų patikros. Profilio informaciją pateikia patys globėjai. Prieš užsisakydami visada vadovaukitės savo nuožiūra ir būkite atidūs.",
      },
      liability: {
        heading: "7. Atsakomybė",
        body: "PetBnB neatsako už jokius nuostolius, sužalojimus ar žalą augintiniams, žmonėms ar turtui, galinčius atsirasti užsakymo metu. Šeimininkai ir globėjai prisiima visą su tuo susijusią riziką.",
      },
      privacy: {
        heading: "8. Privatumas",
        body: "Jūsų asmens duomenys naudojami tik PetBnB demonstracinei versijai palaikyti ir nėra parduodami trečiosioms šalims.",
      },
    },
    questionsPrefix: "Kilo klausimų?",
    contactUs: "Susisiekite su mumis",
  },
};

export default auth;
