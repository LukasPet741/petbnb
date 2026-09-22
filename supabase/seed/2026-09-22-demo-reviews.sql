-- Demo reviews for the thesis defence (2026-09-22). Touches ONLY @petbnb.test seed accounts:
-- 10 seed sitters each get one completed two-day booking in the past with a seed owner's pet,
-- and that owner's review of them.
--
-- Run as postgres (Supabase MCP execute_sql), with Lukas's yes. Running as postgres skips
-- enforce_booking_rules, which would refuse a booking inserted as 'completed'.
--
-- NO EMAIL: every bookings INSERT fires booking_event_notify -> notifications -> booking-notify,
-- which sends real mail. The trigger is disabled for the duration and re-enabled before commit.
--
-- Every seeded booking carries notes = '[demo seed 2026-09-22]'; reviews cascade with their
-- booking, so the rollback at the bottom removes everything this script adds.
begin;

alter table public.bookings disable trigger booking_event_notify;

do $$
declare
  bodies text[] := array[
    'Rudis grįžo laimingas ir pavargęs, gavau nuotraukų kiekvieną dieną. Tikrai kreipsimės vėl.',
    'Very calm with our anxious cat. Sent updates without being asked. Highly recommend.',
    'Puikus bendravimas, viskas kaip sutarta. Šuo net nenorėjo eiti namo.',
    'Reliable and kind. Our dog came back clean, fed and happy.',
    'Labai atsakinga globėja, atsiuntė vaizdo įrašą iš pasivaikščiojimo parke.',
    'Arrived on time every day, followed the feeding schedule to the minute.',
    'Katinas priprato per vieną dieną. Ačiū už kantrybę!',
    'Great with a puppy full of energy. Long walks, lots of patience.',
    'Viskas buvo gerai, tik norėčiau šiek tiek daugiau nuotraukų. Vis tiek rekomenduoju.',
    'Second booking with this sitter and just as good as the first.'
  ];
  ratings int[] := array[5, 5, 5, 5, 5, 5, 4, 5, 4, 5];
  s record;
  p record;
  i int := 0;
  v_booking uuid;
  v_service text;
  v_start timestamptz;
begin
  for s in
    select pr.id, pr.services
    from public.profiles pr
    join auth.users u on u.id = pr.id
    where pr.is_sitter and pr.verification_method = 'seed' and u.email like '%@petbnb.test'
    order by pr.id
    limit 10
  loop
    i := i + 1;

    select pe.id, pe.owner_id into p
    from public.pets pe
    join auth.users u on u.id = pe.owner_id
    where u.email like '%@petbnb.test' and pe.owner_id <> s.id
    order by md5(pe.id::text || s.id::text)
    limit 1;

    if p.id is null then
      raise exception 'no seed pet found for sitter %', s.id;
    end if;

    v_service := coalesce(
      (select e.key from jsonb_each_text(s.services) e
       where e.value = 'true' and e.key <> 'grooming' order by e.key limit 1),
      'walking');
    v_start := date_trunc('day', now()) - make_interval(days => 8 + i * 5) + interval '9 hours';

    insert into public.bookings (owner_id, sitter_id, pet_id, service, start_at, end_at, status, days, notes)
    values (p.owner_id, s.id, p.id, v_service, v_start, v_start + interval '2 days', 'completed', 2,
            '[demo seed 2026-09-22]')
    returning id into v_booking;

    insert into public.reviews (booking_id, author_id, subject_id, direction, rating, body,
                                communication, pet_wellbeing, reliability, created_at)
    values (v_booking, p.owner_id, s.id, 'owner_to_sitter', ratings[i], bodies[i],
            ratings[i], 5, ratings[i], v_start + interval '3 days');
  end loop;
end $$;

alter table public.bookings enable trigger booking_event_notify;

-- Check before committing: expect 10 | 10 | 0.
select
  (select count(*) from public.bookings where notes = '[demo seed 2026-09-22]') as seeded_bookings,
  (select count(*) from public.reviews r join public.bookings b on b.id = r.booking_id
    where b.notes = '[demo seed 2026-09-22]') as seeded_reviews,
  (select count(*) from public.notifications where created_at > now() - interval '5 minutes') as new_notifications;

commit;

-- ROLLBACK (only to remove the demo data; reviews cascade with their booking):
-- begin;
-- alter table public.bookings disable trigger booking_event_notify;
-- delete from public.bookings where notes = '[demo seed 2026-09-22]';
-- alter table public.bookings enable trigger booking_event_notify;
-- commit;
