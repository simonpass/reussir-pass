-- Corrections de réponses proposées par les élèves → tickets validés par l'administrateur (Simon).
-- Rejouable sans risque.

-- administrateurs (Simon) : seuls eux voient les tickets et valident
create table if not exists public.admins (user_id uuid primary key references auth.users (id) on delete cascade);
alter table public.admins enable row level security;
drop policy if exists "admins : lecture perso" on public.admins;
create policy "admins : lecture perso" on public.admins for select using (auth.uid() = user_id);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

-- propositions : une par élève et par question (qkey = "<id épreuve>#<index>")
create table if not exists public.corrections (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  qkey text not null,
  answer text[] not null,
  original text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, qkey)
);
alter table public.corrections enable row level security;
drop policy if exists "corrections : perso" on public.corrections;
create policy "corrections : perso" on public.corrections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "corrections : admin lit tout" on public.corrections;
create policy "corrections : admin lit tout" on public.corrections for select using (public.is_admin());

-- décisions : validée = appliquée pour tout le monde ; rejetée = ticket fermé
create table if not exists public.corrections_validees (
  qkey text primary key,
  statut text not null check (statut in ('validée', 'rejetée')),
  answer text[],
  original text[],
  decided_at timestamptz not null default now()
);
alter table public.corrections_validees enable row level security;
drop policy if exists "décisions : lecture publique" on public.corrections_validees;
create policy "décisions : lecture publique" on public.corrections_validees for select using (true);
drop policy if exists "décisions : admin écrit" on public.corrections_validees;
create policy "décisions : admin écrit" on public.corrections_validees for all using (public.is_admin()) with check (public.is_admin());
