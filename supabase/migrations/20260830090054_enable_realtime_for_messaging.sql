-- First realtime feature in the project: the publication was empty.
-- REPLICA IDENTITY FULL so DELETE/UPDATE payloads carry enough for RLS to
-- evaluate; INSERT is what we actually subscribe to.
alter table public.messages replica identity full;
alter table public.notifications replica identity full;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
