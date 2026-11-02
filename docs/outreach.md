# Outreach — getting businesses to claim their page

Every Promoted sale starts with a claim. The 63 listed places come from OpenStreetMap and do not
know they are on PetBnB. This is the kit for telling them; sending is yours to do.

## The list

```bash
npm run business outreach > outreach.csv
```

One row per published, listed place (from OpenStreetMap; partners are left out) nobody has claimed yet: name, city, categories, website, and its
**claim link** (`https://petbnb.lt/partners?p=<slug>&claim=1`). The link opens the place with
its claim form already open, and brings the visitor back to it after signing in.

## How to reach them (not legal advice)

- Best: the business's own contact form, phone, or a visit. 26 of the 63 listed places have a
  website in the list; it carries no email addresses.
- Email: Lithuania's Law on Electronic Communications (ŽEKĮ, Art. 69) restricts unsolicited
  direct-marketing email. Check it applies to you before emailing a business cold; a reply to
  a business that wrote to you first is fine.
- Always offer removal, and honour it: unpublish the place (`status = 'hidden'`).
- Never claim users, bookings or partners PetBnB does not have (`PRODUCT.md`).

## Message — Lithuanian

> Sveiki,
>
> esu Lukas, kuriu PetBnB (petbnb.lt): gyvūnų prižiūrėtojų ir gyvūnų verslų žemėlapį Lietuvoje.
> **{pavadinimas}** jau rodomas žemėlapyje pagal viešus „OpenStreetMap“ duomenis.
>
> Perėmę puslapį nemokamai galite patys įrašyti aprašymą, darbo laiką ir paslaugas su kainomis:
> {nuoroda}
>
> Jei norite būti rodomi pirmi, puslapį galima reklamuoti už 19 € per mėnesį, visada su žyma
> „Reklama“. Jei nenorite būti žemėlapyje, tiesiog atsakykite, ir puslapį pašalinsiu.
>
> Pagarbiai,
> Lukas

## Message — English

> Hello,
>
> I'm Lukas, and I build PetBnB (petbnb.lt): a map of pet sitters and pet businesses in
> Lithuania. **{name}** is already on the map, from public OpenStreetMap data.
>
> Claim the page for free to write your own description, hours and services with prices:
> {link}
>
> If you'd like to be shown first, the page can be promoted for €19 a month, always marked
> "Ad". If you'd rather not be on the map, just reply and I'll take the page down.
>
> Best,
> Lukas

## After they claim

`npm run business` lists the claim with their email and message; `npm run business approve <id>`
gives them the page, and the Promote card appears on their My business.
