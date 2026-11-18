-- Réussir PASS : comptes, progression synchronisée, demandes personnalisées.
-- À exécuter une fois dans Supabase (SQL Editor). Rejouable sans risque.

-- 1) Profils (prénom, nom, e-mail), créés automatiquement à l'inscription
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  prenom text not null default '',
  nom text not null default '',
  email text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profil : lecture perso" on public.profiles;
create policy "profil : lecture perso" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profil : modif perso" on public.profiles;
create policy "profil : modif perso" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.nouveau_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, prenom, nom, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'prenom', ''), coalesce(new.raw_user_meta_data->>'nom', ''), new.email)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.nouveau_profil();

-- 2) Progression (copie des clés ue4:* du navigateur + épreuves importées)
create table if not exists public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.progress enable row level security;
drop policy if exists "progression : perso" on public.progress;
create policy "progression : perso" on public.progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) Demandes personnalisées : visibles seulement par leur auteur ; le résultat est écrit par l'administrateur (clé de service)
create table if not exists public.demandes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  type text not null,
  ue text,
  titre text,
  fichier text,
  consigne text not null,
  texte text,
  image_path text,
  status text not null default 'envoyée',
  result jsonb,
  created_at timestamptz not null default now(),
  ready_at timestamptz
);
alter table public.demandes enable row level security;
drop policy if exists "demandes : lecture perso" on public.demandes;
create policy "demandes : lecture perso" on public.demandes for select using (auth.uid() = user_id);
drop policy if exists "demandes : envoi perso" on public.demandes;
create policy "demandes : envoi perso" on public.demandes for insert with check (auth.uid() = user_id and status = 'envoyée' and result is null);
drop policy if exists "demandes : retrait perso" on public.demandes;
create policy "demandes : retrait perso" on public.demandes for delete using (auth.uid() = user_id);

-- 4) Photos jointes aux demandes : dossier privé par utilisateur (<user_id>/<fichier>)
insert into storage.buckets (id, name, public) values ('demandes', 'demandes', false) on conflict (id) do nothing;
drop policy if exists "photos : envoi perso" on storage.objects;
create policy "photos : envoi perso" on storage.objects for insert to authenticated with check (bucket_id = 'demandes' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos : lecture perso" on storage.objects;
create policy "photos : lecture perso" on storage.objects for select to authenticated using (bucket_id = 'demandes' and (storage.foldername(name))[1] = auth.uid()::text);
