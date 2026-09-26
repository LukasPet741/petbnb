-- Showcase (spec 2026-09-26-showcase-collar-smartid-design.md), part 2 of 2. Apply only after the
-- web release that pairs collars by sticker code is live: the old Profile panel called
-- register_collar_device and deleted rows directly.
-- Owners may now only rename a collar directly; pairing, unpairing, the demo collar and replays go
-- through claim_collar / unpair_collar / create_demo_collar / replay_collar_point.

drop function if exists public.register_collar_device(text, text);

drop policy if exists "Owners manage their own collar devices" on public.collar_devices;

create policy "Owners read their collars" on public.collar_devices
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "Owners rename their collars" on public.collar_devices
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

revoke insert, update, delete on public.collar_devices from anon, authenticated;
grant update (label) on public.collar_devices to authenticated;
revoke select on public.collar_devices from anon;
