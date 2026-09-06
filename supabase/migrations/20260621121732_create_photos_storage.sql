
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Public read of photos.
create policy "Public can view photos"
  on storage.objects for select
  using (bucket_id = 'photos');

-- Authenticated users may write only within their own uid folder: <uid>/<file>.
create policy "Users can upload their own photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
