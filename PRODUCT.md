# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two-sided marketplace. Pet owners in Lithuania (Vilnius, Kaunas, Klaipėda, Šiauliai, Panevėžys) looking for a trusted local sitter for walking, boarding, daycare, or grooming — they browse by city/service/rate and send a booking request. Sitters list themselves (toggle "Sitter mode" in Profile), set their own services/rate/bio, appear in browse results, and confirm or decline incoming booking requests.

## Product Purpose

A full-stack demo marketplace connecting pet owners with local sitters, showing how the booking experience works end to end: browse → send request → sitter confirms. Success is a smooth, credible two-sided flow, not real transaction volume.

## Positioning

The IoT collar (custom Raspberry Pi + GPS hardware, paired via BLE to an owner account) is the headline differentiator: it puts a real-time walk-route/location view on the owner's Profile page, which template-listing marketplaces like Rover/Wag don't offer. Secondary positioning: transparent mechanics over trust badges — sitters set their own rates, PetBnB takes no booking fee, and nothing is booked until the sitter explicitly confirms.

## Operating Context

Next.js/Supabase web app. Owners: browse sitters, view a sitter profile, send a booking request for dates/service/pet, manage their pets and bookings, save favorite sitters, and (if they own a collar) see their pet's walk routes on their Profile page. Sitters: switch on Sitter mode, set services/rate/bio, appear in browse results, accept/decline requests. Collar hardware pairs to an owner's account (not a specific pet) over BLE, then uplinks location to Supabase over WiFi — optional, not required for the core marketplace flow.

## Capabilities and Constraints

Services: dog walking, boarding, daycare, grooming. Geographic scope: five Lithuanian cities (Vilnius, Kaunas, Klaipėda, Šiauliai, Panevėžys). Sitters set their own hourly rate (listed as starting around €10/hr); no platform booking fee. Every booking requires explicit sitter confirmation before it's committed — never auto-booked. IoT collar tracking is optional hardware, separate from the core booking flow.

## Brand Commitments

Name is "PetBnB" (Pet + Airbnb). Trust voice deliberately avoids verification-badge theater ("no badges, just mechanics") — leans on real bios, real self-set rates, and confirm-before-commit as the actual trust mechanism.

## Evidence on Hand

Real Supabase-backed sitter/profile data loads live on the homepage (no fabricated listings). No testimonials, press, or case studies exist, and the homepage FAQ is explicit that this is a university/portfolio project ("a full-stack demo marketplace built to show how the experience could work end to end"), not a real company. Future work must not invent customer testimonials, press mentions, user counts, or claims of a real operating business.

## Product Principles

- The IoT collar is the proof-of-technical-ambition centerpiece — treat it as a first-class feature on the owner's Profile page, not a bolt-on gimmick.
- Trust is earned through visible mechanics (confirm-before-commit, real self-set rates, no fees), not badges or marketing claims — don't add trust theater.
- It's a portfolio/coursework project, not a live business — design should read as production-real and polished, but content must stay honest (no fake testimonials, press, or user counts).
- Two-sided by design — every surface decision should account for both the owner and the sitter side of the marketplace, not just the browsing/booking owner flow.
