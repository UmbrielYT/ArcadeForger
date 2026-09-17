-- ArcadeForge Community Platform upgrade
-- Run this after the original ArcadeForge Community SQL, or use this file as the new setup script.
create extension if not exists pgcrypto;

-- Existing tables are kept; these upgrades add the new economy systems.
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists vip boolean not null default false;
alter table public.profiles add column if not exists battle_pass boolean not null default false;
alter table public.profiles add column if not exists battle_xp integer not null default 0;
alter table public.profiles add column if not exists last_daily_claim date;
alter table public.profiles add column if not exists daily_streak integer not null default 0;

create table if not exists public.battle_rewards (
  tier integer primary key check (tier between 1 and 10),
  reward_type text not null check (reward_type in ('coins','item')),
  reward_value text not null
);
create table if not exists public.battle_reward_claims (
  user_id uuid references public.profiles(id) on delete cascade,
  tier integer references public.battle_rewards(tier),
  claimed_at timestamptz not null default now(),
  primary key(user_id,tier)
);

insert into public.battle_rewards(tier,reward_type,reward_value) values
(1,'coins','300'),(2,'item','cap'),(3,'coins','500'),(4,'item','cyber'),(5,'coins','750'),
(6,'item','star'),(7,'coins','1000'),(8,'item','wizard'),(9,'coins','1500'),(10,'item','crown')
on conflict(tier) do update set reward_type=excluded.reward_type,reward_value=excluded.reward_value;

alter table public.battle_rewards enable row level security;
alter table public.battle_reward_claims enable row level security;
drop policy if exists "battle rewards readable" on public.battle_rewards;
create policy "battle rewards readable" on public.battle_rewards for select using (true);
drop policy if exists "own battle claims readable" on public.battle_reward_claims;
create policy "own battle claims readable" on public.battle_reward_claims for select using (user_id=auth.uid());

-- Only this server-side function can create a paid game. It charges 1,000 coins.
create or replace function public.create_game_paid(p_title text,p_description text,p_template text,p_icon text)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid; admin boolean; current_coins integer;
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  if char_length(trim(p_title)) < 1 or char_length(p_title) > 40 then raise exception 'Game name must be 1-40 characters'; end if;
  if char_length(p_description) > 160 then raise exception 'Description is too long'; end if;
  if p_template not in ('clicker','reaction','memory','dodger','snake') then raise exception 'Invalid game template'; end if;
  select is_admin,coins into admin,current_coins from public.profiles where id=auth.uid() for update;
  if not admin and current_coins < 1000 then raise exception 'You need 1,000 Forger Coins to create a game'; end if;
  if not admin then update public.profiles set coins=coins-1000 where id=auth.uid(); end if;
  insert into public.games(creator_id,title,description,template,icon,published) values(auth.uid(),trim(p_title),trim(p_description),p_template,coalesce(nullif(trim(p_icon),''),'🎮'),true) returning id into new_id;
  update public.profiles set games_created=games_created+1 where id=auth.uid();
  return new_id;
end; $$;

-- Revoke direct game insertion so players cannot bypass the 1,000-coin fee.
drop policy if exists "own games insert" on public.games;
create policy "own games insert blocked" on public.games for insert with check (false);

grant execute on function public.create_game_paid(text,text,text,text) to authenticated;

-- Playing a game awards coins and Battle XP. Admins have infinite coin purchasing power.
create or replace function public.award_game_coins(amount integer)
returns json language plpgsql security definer set search_path=public as $$
declare admin boolean; earned integer; xp integer;
begin
  select is_admin into admin from public.profiles where id=auth.uid();
  earned:=least(greatest(coalesce(amount,0),0),50);
  xp:=least(greatest(earned,5),50);
  if admin then update public.profiles set battle_xp=battle_xp+xp where id=auth.uid();
  else update public.profiles set coins=coins+earned,battle_xp=battle_xp+xp where id=auth.uid(); end if;
  return json_build_object('coins',earned,'xp',xp,'admin',coalesce(admin,false));
end; $$;

-- Creator reward: publishing is already charged by create_game_paid; this function is retained only for compatibility.
create or replace function public.award_creator_coins()
returns void language plpgsql security definer set search_path=public as $$
begin
  null;
end; $$;

grant execute on function public.award_game_coins(integer) to authenticated;
grant execute on function public.award_creator_coins() to authenticated;

-- Daily login reward: 150 coins + 50 Battle XP once per calendar day.
create or replace function public.claim_daily_reward()
returns json language plpgsql security definer set search_path=public as $$
declare p record; streak integer;
begin
  select * into p from public.profiles where id=auth.uid() for update;
  if p.last_daily_claim=current_date then return json_build_object('claimed',false,'coins',0,'xp',0,'streak',p.daily_streak); end if;
  if p.last_daily_claim=current_date-1 then streak:=p.daily_streak+1; else streak:=1; end if;
  if p.is_admin then update public.profiles set last_daily_claim=current_date,daily_streak=streak,battle_xp=battle_xp+50 where id=auth.uid();
  else update public.profiles set coins=coins+150,last_daily_claim=current_date,daily_streak=streak,battle_xp=battle_xp+50 where id=auth.uid(); end if;
  return json_build_object('claimed',true,'coins',case when p.is_admin then 0 else 150 end,'xp',50,'streak',streak);
end; $$;
grant execute on function public.claim_daily_reward() to authenticated;

create or replace function public.buy_vip()
returns void language plpgsql security definer set search_path=public as $$
declare admin boolean; current_coins integer;
begin
  select is_admin,coins into admin,current_coins from public.profiles where id=auth.uid() for update;
  if (select vip from public.profiles where id=auth.uid()) then raise exception 'VIP already owned'; end if;
  if not admin and current_coins < 5000 then raise exception 'You need 5,000 Forger Coins for VIP'; end if;
  if not admin then update public.profiles set coins=coins-5000,vip=true where id=auth.uid(); else update public.profiles set vip=true where id=auth.uid(); end if;
end; $$;
grant execute on function public.buy_vip() to authenticated;

create or replace function public.buy_battle_pass()
returns void language plpgsql security definer set search_path=public as $$
declare admin boolean; current_coins integer;
begin
  select is_admin,coins into admin,current_coins from public.profiles where id=auth.uid() for update;
  if (select battle_pass from public.profiles where id=auth.uid()) then raise exception 'Battle Pass already owned'; end if;
  if not admin and current_coins < 2500 then raise exception 'You need 2,500 Forger Coins for the Battle Pass'; end if;
  if not admin then update public.profiles set coins=coins-2500,battle_pass=true where id=auth.uid(); else update public.profiles set battle_pass=true where id=auth.uid(); end if;
end; $$;
grant execute on function public.buy_battle_pass() to authenticated;

create or replace function public.claim_battle_reward(p_tier integer)
returns void language plpgsql security definer set search_path=public as $$
declare r public.battle_rewards%rowtype; admin boolean; current_xp integer;
begin
  select * into r from public.battle_rewards where tier=p_tier;
  if not found then raise exception 'Invalid Battle Pass tier'; end if;
  select is_admin,battle_xp into admin,current_xp from public.profiles where id=auth.uid() for update;
  if not (select battle_pass from public.profiles where id=auth.uid()) then raise exception 'Buy the Battle Pass first'; end if;
  if current_xp < p_tier*100 and not admin then raise exception 'Not enough Battle XP'; end if;
  if exists(select 1 from public.battle_reward_claims where user_id=auth.uid() and tier=p_tier) then raise exception 'Reward already claimed'; end if;
  if r.reward_type='coins' then
    if not admin then update public.profiles set coins=coins+(r.reward_value::integer) where id=auth.uid(); end if;
  else
    insert into public.inventory(user_id,item_id) values(auth.uid(),r.reward_value) on conflict do nothing;
  end if;
  insert into public.battle_reward_claims(user_id,tier) values(auth.uid(),p_tier);
end; $$;
grant execute on function public.claim_battle_reward(integer) to authenticated;

-- Make the shop admin-safe: admins can buy without losing coins.
create or replace function public.buy_cosmetic(item_id text)
returns void language plpgsql security definer set search_path=public as $$
declare cost integer; admin boolean; current_coins integer;
begin
  cost:=case item_id
    when 'hoodie' then 100 when 'cyber' then 250 when 'gold' then 700
    when 'ruby' then 150 when 'ocean' then 150 when 'green' then 150
    when 'cap' then 200 when 'crown' then 1000 when 'wizard' then 750
    when 'glasses' then 300 when 'star' then 400 when 'sparkles' then 800
    else -1 end;
  if cost<0 then raise exception 'Unknown shop item'; end if;
  if exists(select 1 from public.inventory where user_id=auth.uid() and inventory.item_id=buy_cosmetic.item_id) then raise exception 'Already owned'; end if;
  select is_admin,coins into admin,current_coins from public.profiles where id=auth.uid() for update;
  if not admin and current_coins<cost then raise exception 'Not enough Forger Coins'; end if;
  if not admin then update public.profiles set coins=coins-cost where id=auth.uid(); end if;
  insert into public.inventory(user_id,item_id) values(auth.uid(),item_id);
end; $$;
grant execute on function public.buy_cosmetic(text) to authenticated;

-- IMPORTANT: Make trusted creator/admin accounts admin manually after they sign up.
-- Replace the email below with the creator's real account email and run this line in SQL Editor:
-- update public.profiles set is_admin=true where id=(select id from auth.users where email='YOUR-ADMIN-EMAIL');
-- Admin status is stored server-side; never let the browser decide who is an admin.
