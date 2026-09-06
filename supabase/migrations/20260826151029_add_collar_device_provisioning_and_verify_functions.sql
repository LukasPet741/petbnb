-- Called by the app (as the pet's owner) to pair a new collar: hashes the secret
-- server-side so the plaintext value is only ever seen once, in the response.
create function public.register_collar_device(p_pet_id uuid, p_secret text, p_label text default null)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  insert into public.collar_devices (pet_id, device_secret_hash, label)
  values (p_pet_id, crypt(p_secret, gen_salt('bf')), p_label)
  returning id into new_id;
  return new_id;
end;
$$;

grant execute on function public.register_collar_device(uuid, text, text) to authenticated;

-- Called by the collar-ingest Edge Function (service role) to resolve a device_id +
-- plaintext secret to the pet it belongs to, without the secret leaving the database.
create function public.verify_collar_device(p_device_id uuid, p_secret text)
returns table (pet_id uuid)
language sql
security definer
set search_path = public, extensions
as $$
  select pet_id from public.collar_devices
  where id = p_device_id
    and device_secret_hash = crypt(p_secret, device_secret_hash);
$$;

revoke all on function public.verify_collar_device(uuid, text) from public, anon, authenticated;
