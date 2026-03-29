-- Executar no Supabase: SQL Editor → New query → Run
-- Depois: Database → Replication → ativar a tabela `ana_messages` para Realtime (INSERT).

create table if not exists public.ana_messages (
  id text primary key default gen_random_uuid()::text,
  message_text text not null,
  image_base64 text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ana_messages_created_at on public.ana_messages (created_at desc);

-- Se `id` já existir sem default: alter table public.ana_messages
--   alter column id set default gen_random_uuid()::text;

-- Se a tabela já existia com `created_at bigint` (obrigatório no insert), podes migrar para o servidor preencher:
-- alter table public.ana_messages
--   alter column created_at type timestamptz using to_timestamp(created_at / 1000.0);
-- alter table public.ana_messages
--   alter column created_at set default now();

alter table public.ana_messages enable row level security;

-- Ajuste conforme a tua política de segurança (anon = chave pública do browser).
drop policy if exists "Permitir leitura pública das mensagens" on public.ana_messages;
create policy "Permitir leitura pública das mensagens"
  on public.ana_messages for select
  to anon, authenticated
  using (true);

drop policy if exists "Permitir inserção pública de mensagens" on public.ana_messages;
create policy "Permitir inserção pública de mensagens"
  on public.ana_messages for insert
  to anon, authenticated
  with check (true);

-- Sem isto, o PostgREST pode devolver 401/42501 no INSERT mesmo com políticas (papel `anon` = chave publicável no browser).
grant usage on schema public to anon, authenticated;
grant select, insert on table public.ana_messages to anon, authenticated;
