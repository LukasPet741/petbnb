# Next Session

## Project
PetBnB — pet sitter marketplace. Next.js 14, Tailwind, Supabase, Framer Motion.
`C:\Users\lkspe\petbnb` — run with `npm run dev` (starts on port 3000).

## Supabase
Project: `jktykrbvwgagcjyuxypo` (eu-central-1, active)
Tables: `profiles`, `pets`, `bookings` — all with RLS. Auth trigger auto-creates profile on signup.
Credentials in `.env.local` (not committed).

## Auth
Email + password only. `lkspet@gmail.com` is the test account (password was reset to `PetBnB2026!`).
New signups must confirm email unless disabled in Supabase Dashboard → Auth → Providers → Email.

## What's done
- Landing page with hero, services, how-it-works, reviews, FAQ, footer
- Login / signup pages
- Auth guard + profile-completion redirect
- Dashboard, Browse (+ sitter profile), Pets, Bookings, Profile — all wired to Supabase
- Framer Motion animations throughout
- Git repo initialised at `C:\Users\lkspe\petbnb` (1 commit). Not yet pushed to GitHub — install `gh` and run `gh auth login` then `gh repo create petbnb --public --source=. --remote=origin --push`

## What's next (suggested)
- Push to GitHub
- Disable email confirmation in Supabase
- Avatar / pet photo uploads (Supabase Storage)
- Resend email notifications on new bookings (`/api/bookings/notify`)
- Map view on browse page (Leaflet)
- Reviews & ratings system
