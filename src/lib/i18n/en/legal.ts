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
  nav: {
    terms: "Terms",
    privacy: "Privacy",
  },

  terms: {
    title: "Terms & Conditions",
    lastUpdated: "Last updated: September 2026",
    intro:
      "PetBnB is a university project, not a company. These terms describe how the demonstration works and what it deliberately does not do. They are written to be honest rather than exhaustive, and they are not legal advice.",
    sections: {
      aboutProject: {
        heading: "1. About this project",
        body: "PetBnB is a student-built demonstration marketplace that connects pet owners with independent pet sitters in Lithuania. It is not a commercial service, there is no company behind it, and no legal entity is offering you a service here. Treat everything on the site as a working prototype.",
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
        body: "PetBnB processes no payments, holds no money and charges no fees. Nothing on this site takes card details. Owners and sitters settle up between themselves, entirely outside the platform, and any dispute about money is between them.",
      },
      sitters: {
        heading: "6. Sitters",
        body: "We do not vet, verify, interview or background-check sitters, and we do not check insurance, qualifications or references. Everything on a sitter profile is written by that sitter. Use your own judgement, meet before you book, and ask the questions you would ask anyone you were leaving an animal with.",
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
    lastUpdated: "Last updated: September 2026",
    intro:
      "This policy describes what PetBnB actually stores, where it sits and who can read it. Where the honest answer is 'nothing', it says so — this is a student project, and it collects far less than a commercial marketplace would.",
    sections: {
      whoWeAre: {
        heading: "1. Who is behind this",
        body: "PetBnB is a university project run by a student, not a registered company. That matters for your expectations: there is no data protection officer, no support desk and no legal department. Questions go to a single mailbox, answered by a person.",
      },
      whatWeCollect: {
        heading: "2. What we collect",
        body: "Only what the site needs to work: your name, email address and password credentials for the account; your city and phone number if you fill them in; a profile photo if you upload one; details of the pets you add, including species, age and care notes; your bookings; and the messages you exchange with other users. There is nothing else — no hidden profiling, no data bought from anywhere.",
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
        body: "In a Postgres database and file storage operated by Supabase, hosted in the European Union — the eu-central-1 region, in Frankfurt, Germany. Your data does not leave the EU as part of normal operation. Passwords are handled by Supabase Auth and are never stored by us in a readable form.",
      },
      browserStorage: {
        heading: "6. What your browser keeps",
        body: "Two things. Your chosen language sits in local storage under the key petbnb-locale, so the site opens in the right language next time. Your login session is held by Supabase Auth so you stay signed in. There are no advertising cookies and no third-party trackers, which is why you have not been asked to dismiss a cookie banner.",
      },
      whoCanSee: {
        heading: "7. Who can see your data",
        body: "Access is enforced by the database itself, not just by the interface. Every profile is public, owners' as well as sitters': anyone, signed in or not, can read the name, city, photo and description on it, plus a sitter's rate, services and experience. Being findable is the point. Your phone number is not public — you are the only person who can read it. Your pets are not public either: only you, and a sitter with an actual booking for that pet, can read them. Messages are readable only by the two people in the conversation.",
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
};

export default legal;
