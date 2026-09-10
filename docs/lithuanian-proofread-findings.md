# Lithuanian proofread — findings

**Date:** 2026-09-10
**Reviewer:** Claude (not a native speaker — see "How to use this")
**Corpus:** `src/lib/i18n/lt/`, 8 files, ~548 strings

## How to use this

I wrote most of this copy, so I am the last person who should sign it off. The
findings are split by how much you need to trust my judgement:

- **A. Factual** — the copy says something the code or the database does not do. I can
  assert these: each one was checked against production. Fix regardless of language.
- **B. Localisation and typography** — objective conventions, checked mechanically.
- **C. Consistency** — a string disagreeing with a convention already used elsewhere in
  this codebase. Objective.
- **D. Style and register** — my opinion. These need your ear, and I have marked what I
  am unsure about rather than quietly "fixing" it.

**Nothing in the copy has been changed.** This is a list, not a diff.

**Terminology sweep (thread A3) came back clean.** `globėjas` is used 91 times with zero
competing `prižiūrėtojas` or `auklė`; `užsakymas` 38 times with zero `rezervacija`;
`šeimininkas` with zero `savininkas`. The `gyvūnas`/`augintinis` split is natural usage
(`augintinis` = the pet you keep, `gyvūnas` = the animal) and not drift. The 14 apparent
English "sitter" hits are all JavaScript object keys, which correctly stay English.

---

## A. Factual — copy contradicts the system

### A1. The FAQ understates the price floor · `home.ts:125` — FIXED 2026-09-10

> „…valandinį įkainį, prasidedantį nuo maždaug **€10**/val."

**The actual minimum rate in production is €13** (`min(rate_per_hour)` across sitters;
the range is €13–26). "About €10" is not a fair description of €13, and it is the kind of
claim a visitor could reasonably feel misled by.

Two options: correct the number, or stop quoting one so it cannot go stale again —
e.g. „Kiekvienas globėjas nusistato savo valandinį įkainį." with no figure. I would drop
the number. The same claim exists in `en/home.ts` and needs the same fix.

### A2. The privacy policy understates what is public · `legal.ts`, privacy §7

> „**Globėjų** profiliai yra vieši, nes visa esmė — kad juos būtų galima rasti."

This reads as though only sitters' profiles are public. The single SELECT policy on
`profiles` is `Users can view any profile` / `using (true)` for **all** roles, so every
profile — owners included — is readable by a signed-out visitor: name, city, about_me,
avatar.

Proposed (needs your ear):

> „Profiliai yra vieši: vardą, miestą, nuotrauką ir aprašymą gali matyti bet kas, nes
> globėjus turi būti galima rasti."

### A3. The privacy policy is silent on phone numbers · `legal.ts`, privacy §7

Since 2026-09-10 a signed-out visitor cannot read `phone`. **Any signed-in user still
can, for every other user.** The policy says nothing either way.

You chose to fix the code rather than document this, so this entry closes when the
public-profile view lands. Until then the policy is accurate only by omission.

### A4. Not an error, but load-bearing and worth knowing

These were checked and are **correct** — recorded so nobody re-litigates them:

| Claim | Where | Verified |
|---|---|---|
| Data in `eu-central-1`, Frankfurt | privacy §5 | Matches the Supabase project region |
| Browser stores `petbnb-locale` | privacy §6 | Matches `STORAGE_KEY` in `LanguageContext` |
| Pets are not public | privacy §7 | `pets` genuinely has no public SELECT policy |
| No analytics or tracking | privacy §8, `home.ts` honest.data | Still true — the Vercel analytics branch was deleted, not merged |
| Five cities named | `home.ts:127` | Exactly matches the cities that have sitters |
| No card details requested | terms §5, `home.ts` honest.fees | True |

---

## A5. The documented plural bug — FIXED 2026-09-10

`project-notes.md` §5 records this as known and unfixed: the app stores two count forms
and branches on `n !== 1`, so 2–9 renders the genitive plural where the nominative plural
belongs. `home.ts` and `sitters.ts` already avoid it with `{one, few, other}` through
`pluralForm`. **These five keys do not**, and each is visibly wrong on a real screen.

Lithuanian needs three forms, and the participle agrees as well as the noun:

| count | form | example |
|---|---|---|
| 1, 21, 31… | nominative singular | Rast**as** 1 globėj**as** |
| 2–9, 22–29… | nominative plural | Rast**i** 5 globėj**ai** |
| 0, 10–20, 30… | genitive plural | Rast**a** 12 globėj**ų** |

| Key | Current 2-form | Wrong at |
|---|---|---|
| `appPages.browse.resultsCount*` | „Rastas {n} globėjas" / „Rasta {n} globėjų" | 2–9 → shows „Rasta 5 globėjų", should be „Rasti 5 globėjai" |
| `appPages.bookings.count*` | „Iš viso {n} užsakymas" / „…užsakymų" | 2–9 → „Iš viso 5 užsakymai" |
| `appPages.pets.count*` | „Užregistruotas {n} augintinis" / „…augintinių" | 2–9 → „Užregistruoti 5 augintiniai" |
| `appPages` `routeNotEnough*` | „{n} taškas" / „{n} taškai" | **10+** → shows „10 taškai", should be „10 taškų" |
| `appShell.pendingPlural` | „Turite {n} laukiančių užsakymų." | 2–9 → „Turite 5 laukiančius užsakymus." |

Note `routeNotEnough*` fails at the *other* end: its plural form is the nominative, so it
reads correctly for 2–9 and wrongly for 10 and above.

The machinery to fix all five already exists — `pluralForm` in `src/lib/i18n/plural.ts`,
using `Intl.PluralRules`. This is a code change as well as a copy change, so it is not
something to apply inside a proofread pass, but it is the largest single defect in the
Lithuanian.

**Three more `Singular`/`Plural` pairs are NOT bugs** and should be left alone:
`browse.experience*`, and both `experience*` pairs in `sitters.ts`. All three hold
identical values (`"{years} m."`, `"{years} m. patirties"`) because `m.` is an invariant
abbreviation and the noun after a numeral stays genitive. They are redundant keys, not
wrong ones.

---

## B. Localisation and typography

### B1. The euro sign is on the wrong side · 4 strings

Lithuanian convention places the symbol **after** the amount, with a space
(`13 €/val.`), not before it (`€13/val.`) — the latter is the English convention.

| File | Line | Current |
|---|---|---|
| `appPages.ts` | 12 | `"Maks. įkainis: €{rate}/val."` |
| `appPages.ts` | 13 | `"Iki €{rate}/val."` |
| `home.ts` | 125 | `"…nuo maždaug €10/val."` |

**FIXED 2026-09-10** for the two strings carrying an amount. `appPages.ts:148`
(`"Įkainis (€/val.)"`) was left alone on reflection: it is a unit label with no amount
in front of it, so the symbol-after-number rule does not apply. My original finding
listed it in error.

The English file correctly keeps `€10`.

### B2. One unmatched quotation mark · `legal.ts:7`

The corpus uses 8 opening `„` and only 7 closing `“`. The odd one out is in the file
header comment: `„train anything"` closes with an ASCII straight quote. Comment only, so
invisible to users, but the body text gets `„nieko“` right, which makes this a slip
rather than a habit.

**Otherwise the typography is clean**: no ASCII quotes inside any Lithuanian string, no
`...` where `…` belongs, no hyphen standing in for a dash, and `30–60` correctly uses an
en dash.

---

## C. Consistency

### C1. Gender-neutral forms are used inconsistently · `sitters.ts:34`

`appPages.ts:126` already establishes the convention: `"Globėjas(-a) ir šeimininkas(-ė)"`.
But `sitters.ts` has `anonymousAuthor: "Augintinio šeimininkas"` — masculine only, for a
string that stands in for any reviewer.

Either follow the convention here (`"Augintinio šeimininkas(-ė)"`) or decide the
convention is not worth keeping and drop it in `appPages.ts` too. Currently the app does
both. **My string, my inconsistency.**

### C2. The star scale is hardcoded in one place and interpolated in another · `sitters.ts:35,49`

- `starsAriaLabel: "Įvertinimas {rating} iš {max}"` — max interpolated
- `starLabel: "{count} iš 5"` — max hardcoded

Both describe the same five-star scale. Harmless today; wrong the day the scale changes
in one place. Also mine.

---

## D. Style and register — your call

### D1. Legal text describes the UI layout · `legal.ts`, terms §9

> „**Gretimame skirtuke** esančioje privatumo politikoje tiksliai nurodyta…"

A legal document asserting where something sits on screen becomes false when the layout
changes, and the legal nav already stacks at narrow widths. Suggest dropping the tab
reference: „Privatumo politikoje tiksliai nurodyta…".

### D2. Two unrelated clauses joined by `o` · `legal.ts`, terms §9

> „Kai naudojatės svetaine, mes saugome jūsų paskyrą, **o** veiksmai su užsakymais
> reiškia, kad svetainė siunčia tikrus laiškus tikrais adresais."

`o` implies contrast, and these two facts are not contrasting. Reads clumsy. Two
sentences would be cleaner. Low confidence — this is exactly the sort of thing I would
rather you judged.

### D3. `handover: "Perdavimas"` · `sitters.ts:60`

A one-word dimension label for "was the handover on time and prepared". Accurate but
bare next to its neighbours. Possibly `"Perdavimas ir pasiėmimas"`. Mine, and I am
unsure.

---

## Not a copy issue, but found while checking A1 — FIXED 2026-09-10

**`profiles.city` is stored with inconsistent casing.** Production holds both `kaunas`
and `Kaunas` as distinct values, so the city filter and the city list treat them as two
different cities. The sitter profile page renders the raw value, so one sitter's page
reads "kaunas". The `/sitters/[id]` title capitalises it as a display fix; the underlying
data is still split. Worth a one-line normalising migration.

---

## Coverage

| File | Strings | Reviewed |
|---|---|---|
| `legal.ts` | ~40 | **Line by line** — highest stakes, live legal text |
| `home.ts` | ~70 | **Line by line** |
| `sitters.ts` | ~60 | **Line by line** (includes the reviews keys added 2026-09-10) |
| `appPages.ts` | ~150 | **Partially line by line** (browse, bookings, bookingsNew read; pets, profile, collars scanned) |
| `appShell.ts` | ~50 | Mechanical scan + plural audit |
| `auth.ts` | ~35 | Mechanical scan only |
| `messages.ts` | ~35 | Mechanical scan only |
| `tips.ts` | ~10 | Mechanical scan only |

Mechanical scan = terminology census, typography, quotation marks, currency, placeholder
integrity. It catches B and C class findings across all eight files; it does not catch
grammar or register in the five not yet read line by line.

**Next:** line-by-line on `appPages.ts` (the largest, and the one carrying the booking
and profile flows users act on).
