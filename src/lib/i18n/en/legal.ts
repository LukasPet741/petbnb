/**
 * Terms and privacy copy. Lifted out of the `auth` namespace, where it lived only
 * because signup happened to be the page that first needed the link.
 *
 * These documents describe what this project actually does — a student build with
 * no company behind it, no payments, and no sitter vetting — rather than borrowing
 * marketplace boilerplate that would claim otherwise. Section order and numbering
 * are pinned by src/lib/i18n/__tests__/legal.test.ts against src/lib/legal.ts.
 */

const legal = {
  backLink: "Back to home",
  backToDashboard: "Back to dashboard",
  nav: {
    terms: "Terms",
    privacy: "Privacy",
    advertising: "Advertisers",
  },

  terms: {
    title: "Terms & Conditions",
    lastUpdated: "Last updated: November 2026",
    intro:
      "PetBnB is a university project, not a company. These terms describe how the demonstration works and what it deliberately does not do. They are written to be honest rather than exhaustive, and they are not legal advice.",
    sections: {
      aboutProject: {
        heading: "1. About this project",
        body: "PetBnB is a student-built marketplace that connects pet owners with independent pet sitters and pet businesses in Lithuania. It is run by one person, not a company. Pet owners and sitters use it for free; the one thing it sells is optional Promoted placement for businesses, under the advertiser terms, and the seller's details are on every Stripe receipt. Treat the rest of the site as a working prototype.",
      },
      acceptance: {
        heading: "2. Accepting these terms",
        body: "By creating an account or using the site, you agree to these terms. If you do not agree with them, please do not use the service. You can stop at any time by asking us to delete your account.",
      },
      userAccounts: {
        heading: "3. Your account",
        body: "You need an account to request a booking or message a sitter. Give accurate information when you create one, keep your password to yourself, and treat everything done through your account as done by you. Tell us if you think someone else has access to it.",
      },
      bookings: {
        heading: "4. Bookings",
        body: "A booking request is an introduction, not a contract with us. Sitters choose which requests to accept, and any agreement about dates, care or money is between you and the sitter directly. PetBnB is never a party to it and cannot enforce it.",
      },
      payments: {
        heading: "5. Payments",
        body: "Pet owners and sitters pay PetBnB nothing: there are no booking fees, and PetBnB holds no money for either side. Owners and sitters settle up between themselves, outside the platform, and any dispute about money is between them. The one thing PetBnB sells is optional Promoted placement for businesses on the places map, where it is offered: it is paid by card through Stripe under the advertiser terms, and PetBnB never sees card details.",
      },
      sitters: {
        heading: "6. Sitters",
        body: "We do not vet, verify, interview or background-check sitters, and we do not check insurance, qualifications or references. Everything on a sitter profile is written by that sitter. Use your own judgement, meet before you book, and ask the questions you would ask anyone you were leaving an animal with. The one exception is the Smart-ID badge, and on this prototype it is a demonstration: it is earned by completing SK ID Solutions' demo check with a test identity, and it proves nothing about who a sitter really is.",
      },
      conduct: {
        heading: "7. Acceptable use",
        body: "Use the site honestly: your own identity, accurate pet information, and messages you would be comfortable having read back to you. Do not harass other users, misrepresent an animal's health or temperament, or use the site to advertise anything unrelated. We may remove content or accounts that break this.",
      },
      liability: {
        heading: "8. Liability",
        body: "The site is provided as-is, with no guarantee that it works, stays available or keeps your data safe from every possible failure. PetBnB accepts no liability for loss, injury, illness or damage to pets, people or property arising from a booking. Owners and sitters carry that risk themselves.",
      },
      dataAndPrivacy: {
        heading: "9. Your data",
        body: "Using the site means we store an account for you, and booking activity means the site sends real email to real addresses. The privacy policy on the next tab sets out exactly what is collected, where it is stored and who can read it.",
      },
      changes: {
        heading: "10. Changes to these terms",
        body: "These terms can change as the project changes. The date at the top tells you when they were last revised. Continuing to use the site after a change means the revised terms apply to you.",
      },
    },
    contactPrefix: "Questions about these terms?",
    contactCta: "Email us",
  },

  privacy: {
    title: "Privacy Policy",
    lastUpdated: "Last updated: November 2026",
    intro:
      "This policy describes what PetBnB actually stores, where it sits and who can read it. Where the honest answer is 'nothing', it says so — this is a student project, and it collects far less than a commercial marketplace would.",
    sections: {
      whoWeAre: {
        heading: "1. Who is behind this",
        body: "PetBnB is a university project run by a student, not a registered company. That matters for your expectations: there is no data protection officer, no support desk and no legal department. Questions go to a single mailbox, answered by a person.",
      },
      whatWeCollect: {
        heading: "2. What we collect",
        body: "Only what the site needs to work: your name, email address and password credentials for the account; your city and phone number if you fill them in; a profile photo if you upload one; details of the pets you add, including species, age and care notes; your bookings; and the messages you exchange with other users. If you complete the Smart-ID demo, we also store that you did, when, and the demo session's identifier, but nothing from the certificate. For a business that pays for Promoted placement, we also keep Stripe's identifiers for its subscription and that subscription's status. There is nothing else — no hidden profiling, no data bought from anywhere.",
      },
      howWeUse: {
        heading: "3. What we use it for",
        body: "Running the service, and nothing besides. Your profile is shown to the sitters and owners you interact with, your pet details go to the sitter you book, and your messages are delivered to the person you sent them to. We do not sell your data, share it with advertisers, or use it to train anything.",
      },
      email: {
        heading: "4. Email we send you",
        body: "This is real, not simulated: when a booking is requested, accepted, declined, cancelled or completed, the site sends a genuine email to the address on your account. Your language preference is stored on your profile so that email arrives in Lithuanian or English to match. These are service messages tied to your own bookings — there is no marketing list and no newsletter.",
      },
      whereItLives: {
        heading: "5. Where your data is stored",
        body: "In a Postgres database and file storage operated by Supabase, hosted in the European Union — the eu-central-1 region, in Frankfurt, Germany. Your data does not leave the EU as part of normal operation. Passwords are handled by Supabase Auth and are never stored by us in a readable form. If a business pays for Promoted placement, Stripe handles the payment and the billing details entered at checkout, under its own privacy policy. PetBnB passes the account's email to fill in the checkout and gets back only Stripe's identifiers for the subscription and the customer, and the subscription's status.",
      },
      browserStorage: {
        heading: "6. What your browser keeps",
        body: "Two things. Your chosen language sits in local storage under the key petbnb-locale, so the site opens in the right language next time. Your login session is held by Supabase Auth so you stay signed in. There are no advertising cookies and no third-party trackers, which is why you have not been asked to dismiss a cookie banner.",
      },
      whoCanSee: {
        heading: "7. Who can see your data",
        body: "Access is enforced by the database itself, not just by the interface. Every profile is public, owners' as well as sitters': anyone, signed in or not, can read the name, city, photo and description on it, plus a sitter's prices, services and experience, and whether a Smart-ID demo badge was earned. Being findable is the point. Your phone number is not public — you are the only person who can read it. Your pets are not public either: only you, and a sitter with an actual booking for that pet, can read them. Messages are readable only by the two people in the conversation.",
      },
      noTracking: {
        heading: "8. What we deliberately do not do",
        body: "There is no analytics package on this site, no error-monitoring service, no advertising pixel, no session recording and no third-party script watching what you click. Nobody is measuring your visit. This is a deliberate choice, and it is also why we cannot tell you how many people read this page.",
      },
      yourRights: {
        heading: "9. Your choices",
        body: "You can edit your profile and pet details at any time from your account, and delete anything you have added. If you want your account and everything attached to it removed entirely, email us and we will delete it. Since this is a demonstration project rather than a live service, the safest assumption is to put nothing here you would mind losing.",
      },
    },
    contactPrefix: "Questions about your data?",
    contactCta: "Email us",
  },
  advertising: {
    title: "Advertiser terms",
    lastUpdated: "Last updated: November 2026",
    intro:
      "These terms apply to businesses that pay for Promoted placement on the PetBnB places map. They cover a business purchase, not a consumer one, and promotion is on sale only where My business offers it. They are written plainly and are not legal advice.",
    sections: {
      whatItIs: {
        heading: "1. What Promoted placement is",
        body: "Your page comes first in the places list and stands out on the places map. Nothing else changes: not your reviews, not your rating, not what the community writes about you, and not which sitters appear in search.",
      },
      whoCanBuy: {
        heading: "2. Who can buy it",
        body: "A business whose page on the places map it has claimed and PetBnB has approved, buying for the business rather than as a private consumer. Whoever pays confirms they may act for the business.",
      },
      price: {
        heading: "3. Price and billing",
        body: "€19 a month, charged in advance by card through Stripe and renewed every month until you cancel. Stripe sends a receipt for every payment, with the seller's details on it. PetBnB never sees or stores card details.",
      },
      startEnd: {
        heading: "4. When it starts and stops",
        body: "Promotion starts once Stripe confirms the payment. You can cancel at any time from the link in your Stripe receipt; promotion then runs to the end of the month already paid. If a renewal fails, it stays on while Stripe retries the card and stops if the payment cannot be collected.",
      },
      labelling: {
        heading: "5. Always labelled as an ad",
        body: "A promoted page is always marked “Ad” (“Reklama” in Lithuanian), with a note that the business pays PetBnB to be shown first, so pet owners can tell which places are paid. The label cannot be removed. This is how PetBnB follows the EU Digital Services Act's rule that advertising is marked as such.",
      },
      content: {
        heading: "6. What your page may say",
        body: "The page shows only what you write about your own business. It must be true, services, prices and hours included, and must not mislead pet owners or put animals at risk. PetBnB may stop promoting a page that breaks this or the general terms; if we stop it for any other reason, we refund the unused part of the month.",
      },
      results: {
        heading: "7. No promise of results",
        body: "Promotion buys visibility. PetBnB makes no promise of views, booking requests or customers, and is not liable for business you expected and did not get.",
      },
      changes: {
        heading: "8. Changes to the price or these terms",
        body: "We announce a price change at least 30 days before it applies, by email to the address on the subscription, and it applies from the next billing month. You can cancel before then.",
      },
    },
    contactPrefix: "Questions about advertising?",
    contactCta: "Email us",
  },
};

export default legal;
