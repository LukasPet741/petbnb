const messages = {
  title: "Žinutės",
  subtitle: "Kiekvienas pokalbis susietas su konkrečiu užsakymu.",
  emptyTitle: "Pokalbių dar nėra",
  emptyDescription:
    "Išsiuntus arba gavus užsakymo užklausą, pokalbis čia atsiras automatiškai.",
  findASitter: "Rasti globėją",

  threadListUnread: "{count} neskaityta",
  threadListNoMessages: "Žinučių dar nėra",
  threadListYouPrefix: "Jūs: ",
  threadListLoadFailed: "Nepavyko įkelti pokalbių.",

  back: "Atgal į žinutes",
  threadHeaderWith: "Pokalbis su {name}",
  threadAboutPet: "Dėl {pet} · {service}",
  unknownPerson: "Nežinomas",
  loadFailed: "Nepavyko įkelti pokalbio.",
  notAParty: "Šis pokalbis jums neprieinamas.",

  composerPlaceholder: "Rašykite žinutę…",
  send: "Siųsti",
  sendFailed: "Žinutė neišsiųsta. Patikrinkite ryšį ir bandykite dar kartą.",
  today: "Šiandien",
  yesterday: "Vakar",
  threadListOffer: "Pasiūlymas: {price}",

  offer: {
    title: "Pasiūlymas",
    yours: "Jūsų pasiūlymas",
    replaced: "Pakeista",
    acceptFor: "Sutikti už {price}",
    counter: "Siūlyti kitą kainą",
    makeOffer: "Pasiūlyti kainą",
    submit: "Siųsti pasiūlymą",
    cancel: "Atšaukti",
    amountLabel: "Jūsų kaina, €",
    range: "Nuo {min} iki {max}",
    noteLabel: "Žinutė (neprivaloma)",
    failed: "Pasiūlymas neišsiųstas. Bandykite dar kartą.",
    priceChanged: "Kaina ką tik pasikeitė.",
    acceptFailed: "Nepavyko priimti kainos. Bandykite dar kartą.",
  },

  priceBar: {
    asking: "Prašoma {price}",
    onTable: "Siūloma {price} · {name}",
    agreed: "Sutarta kaina {price}",
    fixed: "Fiksuota kaina {price}",
    offersLeft: {
      one: "Jums liko {count} pasiūlymas",
      few: "Jums liko {count} pasiūlymai",
      other: "Jums liko {count} pasiūlymų",
    },
  },

  systemEvent: {
    requested: "{actor} išsiuntė šią užsakymo užklausą",
    accepted: "{actor} patvirtino užsakymą",
    declined: "{actor} atmetė užklausą",
    cancelled: "{actor} atšaukė užklausą",
    completed: "{actor} pažymėjo užsakymą kaip įvykdytą",
    agreed: "{actor} sutiko su kaina, užsakymas patvirtintas",
  },

  notifications: {
    title: "Pranešimai",
    bellAriaLabel: "Pranešimai",
    bellAriaLabelUnread: "Pranešimai, {count} neskaityti",
    empty: "Naujų pranešimų nėra.",
    emptyHint: "Čia matysite užsakymų atnaujinimus ir naujas žinutes.",
    markAllRead: "Žymėti visus skaitytais",
    viewAll: "Žiūrėti visas žinutes",
    booking_requested: "{actor} atsiuntė jums užklausą",
    booking_accepted: "{actor} patvirtino jūsų užsakymą",
    booking_declined: "{actor} atmetė jūsų užklausą",
    booking_cancelled: "{actor} atšaukė užsakymą",
    booking_completed: "{actor} pažymėjo užsakymą kaip įvykdytą",
    message_received: "{actor} atsiuntė jums žinutę",
    offer_received: "{actor} atsiuntė kainos pasiūlymą",
    price_agreed: "{actor} sutiko su jūsų kaina",
    fallbackPet: "jūsų augintinis",
  },
};

export default messages;
