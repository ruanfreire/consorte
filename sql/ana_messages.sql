-- Rode no SQL Editor do Supabase (projeto → SQL → New query).
-- Depois: Settings → API → copie Project URL e anon public key para .env / GitHub Secrets.

create table if not exists public.ana_messages (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) <= 300),
  photo text not null check (char_length(photo) <= 200000),
  at bigint not null
);

alter table public.ana_messages enable row level security;

-- Leitura pública (site estático).
create policy "ana_messages_select"
  on public.ana_messages for select
  using (true);

-- Qualquer visitante pode enviar uma mensagem (aniversário).
create policy "ana_messages_insert"
  on public.ana_messages for insert
  with check (true);

-- Sem política de DELETE → ninguém apaga via API anon.
-- Sem política de UPDATE → ninguém altera via API anon.
-- (Explícito abaixo para documentar intenção “append-only”.)

drop policy if exists "ana_messages_no_delete" on public.ana_messages;
create policy "ana_messages_no_delete"
  on public.ana_messages for delete
  using (false);

drop policy if exists "ana_messages_no_update" on public.ana_messages;
create policy "ana_messages_no_update"
  on public.ana_messages for update
  using (false);
