-- ArcadeForge Community database
-- Run this whole script in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  coins integer not null default 500 check (coins >= 0),
  games_created integer not null default 0,
  plays integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  description text not null default '' check (char_length(description) <= 160),
  template text not null check (template in ('clicker','reaction','memory','dodger','snake')),
  icon text not null default '🎮',
  published boolean not null default true,
  plays integer not null default 0,
  likes integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.game_likes (
  game_id uuid references public.games(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key(game_id,user_id)
);

create table if not exists public.inventory (
  user_id uuid references public.profiles(id) on delete cascade,
  item_id text not null,
  purchased_at timestamptz not null default now(),
  primary key(user_id,item_id)
);

create or replace function public.new_profile()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,username)
  values(new.id, coalesce(nullif(new.raw_user_meta_data->>'username',''),'Player'||substr(new.id::text,1,6)));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.new_profile();

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_likes enable row level security;
alter table public.inventory enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select using (true);
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using (auth.uid()=id) with check (auth.uid()=id);

drop policy if exists "published games readable" on public.games;
create policy "published games readable" on public.games for select using (published=true or creator_id=auth.uid());
drop policy if exists "own games insert" on public.games;
create policy "own games insert" on public.games for insert with check (creator_id=auth.uid());
drop policy if exists "own games update" on public.games;
create policy "own games update" on public.games for update using (creator_id=auth.uid()) with check (creator_id=auth.uid());
drop policy if exists "own games delete" on public.games;
create policy "own games delete" on public.games for delete using (creator_id=auth.uid());

drop policy if exists "likes readable" on public.game_likes;
create policy "likes readable" on public.game_likes for select using (true);
drop policy if exists "own likes insert" on public.game_likes;
create policy "own likes insert" on public.game_likes for insert with check (user_id=auth.uid());
drop policy if exists "own likes delete" on public.game_likes;
create policy "own likes delete" on public.game_likes for delete using (user_id=auth.uid());

drop policy if exists "own inventory readable" on public.inventory;
create policy "own inventory readable" on public.inventory for select using (user_id=auth.uid());

create or replace function public.record_play(game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.games set plays=plays+1 where id=game_id and published=true;
  update public.profiles set plays=plays+1 where id=auth.uid();
end; $$;

create or replace function public.toggle_game_like(game_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare liked boolean;
begin
  if exists(select 1 from public.game_likes where game_id=toggle_game_like.game_id and user_id=auth.uid()) then
    delete from public.game_likes where game_id=toggle_game_like.game_id and user_id=auth.uid();
    update public.games set likes=greatest(likes-1,0) where id=toggle_game_like.game_id;
    liked:=false;
  else
    insert into public.game_likes(game_id,user_id) values(toggle_game_like.game_id,auth.uid());
    update public.games set likes=likes+1 where id=toggle_game_like.game_id;
    liked:=true;
  end if;
  return liked;
end; $$;

create or replace function public.award_game_coins(amount integer)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.profiles set coins=coins+least(greatest(amount,0),50) where id=auth.uid();
end; $$;

create or replace function public.award_creator_coins()
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.profiles set coins=coins+50,games_created=games_created+1 where id=auth.uid();
end; $$;

create or replace function public.buy_cosmetic(item_id text)
returns void language plpgsql security definer set search_path=public as $$
declare cost integer;
begin
  cost:=case item_id
    when 'hoodie' then 100 when 'cyber' then 250 when 'gold' then 700
    when 'ruby' then 150 when 'ocean' then 150 when 'green' then 150
    when 'cap' then 200 when 'crown' then 1000 when 'wizard' then 750
    when 'glasses' then 300 when 'star' then 400 when 'sparkles' then 800
    else -1 end;
  if cost<0 then raise exception 'Unknown shop item'; end if;
  if exists(select 1 from public.inventory where user_id=auth.uid() and inventory.item_id=buy_cosmetic.item_id) then raise exception 'Already owned'; end if;
  update public.profiles set coins=coins-cost where id=auth.uid() and coins>=cost;
  if not found then raise exception 'Not enough Forger Coins'; end if;
  insert into public.inventory(user_id,item_id) values(auth.uid(),item_id);
end; $$;

grant execute on function public.record_play(uuid) to authenticated;
grant execute on function public.toggle_game_like(uuid) to authenticated;
grant execute on function public.award_game_coins(integer) to authenticated;
grant execute on function public.award_creator_coins() to authenticated;
grant execute on function public.buy_cosmetic(text) to authenticated;
