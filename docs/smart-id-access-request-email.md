# Smart-ID access request — email draft

**Status:** draft, not sent. Written 2026-09-12.

**Send to:** `sales@skidsolutions.eu` (pricing and agreements)
**Consider copying:** `support@smart-id.com` (integration questions)

**Why this email exists.** The demo environment is free, open and needs no agreement, so nothing
blocks building and demonstrating the flow. Production is a different matter: the cheapest of the
eleven price tiers is €0.109 per transaction with a **550-transaction monthly minimum — about €60
a month excluding VAT — payable whether or not anybody logs in**. For a university project with
no revenue, that is the whole question, so it is worth asking before assuming the answer is no.

**Before sending, fill in:** your full name, your university and course, and — if you are willing
to state one — a realistic monthly volume. Everything else is accurate as written.

---

**Subject:** Smart-ID production access for a non-commercial university project

Hello,

I am a student in Lithuania, and I have built a pet-sitting marketplace called PetBnB
(https://petbnb.lt) as a university project. It is a real, deployed application, but it is
non-commercial: it processes no payments, takes no commission, and has no revenue of any kind.

Sitters on the site list their own name, city and experience, and owners leave their animals with
them. Identity is the one thing the platform cannot honestly claim to know, so I would like to
offer Smart-ID authentication as a way for a sitter to prove who they are, and to show that
verification on their profile.

I have integrated against your demo environment and the flow works end to end, including the
refusal, timeout and wrong-verification-code paths, using the Lithuanian test identities from
your documentation.

My question is about moving to production. I understand from the price list that the smallest
package carries a minimum monthly volume of 550 transactions, which is far beyond anything this
project would generate — realistically it would be a handful of verifications per month, if
that. Paying the monthly minimum is not something a student project can sustain.

So, three questions:

1. Do you offer any non-commercial, academic or low-volume arrangement for a project like this —
   for instance pay-per-transaction with no monthly minimum?
2. If not, is there a supported way to keep using the demo environment in a publicly reachable
   application, provided the interface states plainly that verification is a demonstration and
   proves nothing about a real person? That is how the site behaves today.
3. If neither is possible, I would rather remove the feature than mislead anyone about what it
   proves. Is there anything else you would suggest for a project at this stage?

I am happy to share the source, the integration, or a demonstration if that is useful.

Thank you for your time,

[your full name]
[your university and course]
https://petbnb.lt

---

## If they say no

The fallback is already the current design, and it needs no new work: `SMART_ID_METHOD` stays
`smart_id_demo`, and every badge says so on its face. The only change worth making in that case
is to the terms, so that "identity may be verified" never reads as a promise the demo build
cannot keep.

## If they say yes

What they will need from us, per their integration process: a public service name, and either an
IP address to allowlist or confirmation that we use HTTPS pinning. **We cannot give them a fixed
IP** — neither Vercel nor Supabase Edge Functions offer a static egress address — so the answer
is pinning, which they recommend anyway. Once they issue the relying-party UUID, going live is a
configuration change: `SMART_ID_HOST`, `SMART_ID_RP_UUID`, `SMART_ID_RP_NAME` and
`SMART_ID_METHOD` move from the demo values to the real ones, and no code changes.
