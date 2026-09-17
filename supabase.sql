-- Run this entire file in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique not null,
 coins integer not null default 1000 check(coins>=0),
 is_admin boolean not null default false,
 vip boolean not null default false,
 battle_pass boolean not null default false,
 battle_xp integer not null default 0 check(battle_xp>=0),
 last_daily_claim date,
 daily_streak integer not null default 0,
 games_created integer not null default 0,
 plays integer not null default 0,
 created_at timestamptz not null default now()
);
create table if not exists public.games(
 id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.profiles(id) on delete cascade,
 title text not null, description text not null default '', template text not null check(template in ('clicker','reaction','memory','dodger','snake')),
 icon text default '🎮', plays integer not null default 0, likes integer not null default 0, published boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.game_likes(user_id uuid references public.profiles(id) on delete cascade,game_id uuid references public.games(id) on delete cascade,created_at timestamptz not null default now(),primary key(user_id,game_id));
create table if not exists public.inventory(user_id uuid references public.profiles(id) on delete cascade,item_id text not null,equipped boolean not null default false,created_at timestamptz not null default now(),primary key(user_id,item_id));
create table if not exists public.battle_rewards(tier integer primary key check(tier between 1 and 10),reward_type text not null check(reward_type in('coins','item')),reward_value text not null);
create table if not exists public.battle_reward_claims(user_id uuid references public.profiles(id) on delete cascade,tier integer references public.battle_rewards(tier),claimed_at timestamptz not null default now(),primary key(user_id,tier));

insert into public.battle_rewards(tier,reward_type,reward_value) values
(1,'coins','300'),(2,'item','cap'),(3,'coins','500'),(4,'item','cyber'),(5,'coins','750'),(6,'item','star'),(7,'coins','1000'),(8,'item','wizard'),(9,'coins','1500'),(10,'item','crown')
on conflict(tier) do update set reward_type=excluded.reward_type,reward_value=excluded.reward_value;

-- Create a profile automatically after email signup.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare base_name text;
begin
 base_name:=coalesce(nullif(trim(new.raw_user_meta_data->>'username'),''),split_part(new.email,'@',1),'Player');
 base_name:=left(base_name,24);
 insert into public.profiles(id,username) values(new.id,base_name)
 on conflict(id) do nothing;
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_likes enable row level security;
alter table public.inventory enable row level security;
alter table public.battle_rewards enable row level security;
alter table public.battle_reward_claims enable row level security;

drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read" on public.profiles for select using(true);
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
drop policy if exists "games public read" on public.games;
create policy "games public read" on public.games for select using(published=true or creator_id=auth.uid());
drop policy if exists "game likes own read" on public.game_likes;
create policy "game likes own read" on public.game_likes for select using(user_id=auth.uid());
drop policy if exists "inventory own read" on public.inventory;
create policy "inventory own read" on public.inventory for select using(user_id=auth.uid());
drop policy if exists "battle rewards read" on public.battle_rewards;
create policy "battle rewards read" on public.battle_rewards for select using(true);
drop policy if exists "battle claims own read" on public.battle_reward_claims;
create policy "battle claims own read" on public.battle_reward_claims for select using(user_id=auth.uid());
drop policy if exists "game insert blocked" on public.games;
create policy "game insert blocked" on public.games for insert with check(false);
drop policy if exists "inventory insert blocked" on public.inventory;
create policy "inventory insert blocked" on public.inventory for insert with check(false);

create or replace function public.record_play(game_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 update public.games set plays=plays+1 where id=game_id and published=true;
 if auth.uid() is not null then update public.profiles set plays=plays+1 where id=auth.uid(); end if;
end; $$;
grant execute on function public.record_play(uuid) to anon,authenticated;

create or replace function public.toggle_game_like(game_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare liked boolean;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if exists(select 1 from public.game_likes where user_id=auth.uid() and game_id=toggle_game_like.game_id) then
  delete from public.game_likes where user_id=auth.uid() and game_id=toggle_game_like.game_id; update public.games set likes=greatest(0,likes-1) where id=game_id; liked=false;
 else
  insert into public.game_likes(user_id,game_id) values(auth.uid(),game_id); update public.games set likes=likes+1 where id=game_id; liked=true;
 end if;
 return liked;
end; $$;
grant execute on function public.toggle_game_like(uuid) to authenticated;

create or replace function public.award_game_coins(amount integer) returns json language plpgsql security definer set search_path=public as $$
declare admin boolean; earned integer; xp integer;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select is_admin into admin from public.profiles where id=auth.uid();
 earned:=least(greatest(coalesce(amount,0),0),50); xp:=least(greatest(earned,5),50);
 if admin then update public.profiles set battle_xp=battle_xp+xp where id=auth.uid(); else update public.profiles set coins=coins+earned,battle_xp=battle_xp+xp where id=auth.uid(); end if;
 return json_build_object('coins',earned,'xp',xp,'admin',coalesce(admin,false));
end; $$;
grant execute on function public.award_game_coins(integer) to authenticated;

create or replace function public.claim_daily_reward() returns json language plpgsql security definer set search_path=public as $$
declare p record; streak integer;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into p from public.profiles where id=auth.uid() for update;
 if p.last_daily_claim=current_date then return json_build_object('claimed',false,'coins',0,'xp',0,'streak',p.daily_streak); end if;
 if p.last_daily_claim=current_date-1 then streak:=p.daily_streak+1; else streak:=1; end if;
 if p.is_admin then update public.profiles set last_daily_claim=current_date,daily_streak=streak,battle_xp=battle_xp+50 where id=auth.uid(); else update public.profiles set coins=coins+150,last_daily_claim=current_date,daily_streak=streak,battle_xp=battle_xp+50 where id=auth.uid(); end if;
 return json_build_object('claimed',true,'coins',case when p.is_admin then 0 else 150 end,'xp',50,'streak',streak);
end; $$;
grant execute on function public.claim_daily_reward() to authenticated;

create or replace function public.create_game_paid(p_title text,p_description text,p_template text,p_icon text) returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid; admin boolean; current_coins integer;
begin
 if auth.uid() is null then raise exception 'You must be signed in'; end if;
 if char_length(trim(p_title))<1 or char_length(p_title)>40 then raise exception 'Game name must be 1-40 characters'; end if;
 if char_length(p_description)>160 then raise exception 'Description is too long'; end if;
 if p_template not in('clicker','reaction','memory','dodger','snake') then raise exception 'Invalid game template'; end if;
 select is_admin,coins into admin,current_coins from public.profiles where id=auth.uid() for update;
 if not admin and current_coins<1000 then raise exception 'You need 1,000 Forger Coins to create a game'; end if;
 if not admin then update public.profiles set coins=coins-1000 where id=auth.uid(); end if;
 insert into public.games(creator_id,title,description,template,icon,published) values(auth.uid(),trim(p_title),trim(p_description),p_template,coalesce(nullif(trim(p_icon),''),'🎮'),true) returning id into new_id;
 update public.profiles set games_created=games_created+1 where id=auth.uid();
 return new_id;
end; $$;
grant execute on function public.create_game_paid(text,text,text,text) to authenticated;

create or replace function public.buy_vip() returns void language plpgsql security definer set search_path=public as $$
declare p record;
begin
 select * into p from public.profiles where id=auth.uid() for update;
 if p.vip then raise exception 'VIP already owned'; end if;
 if not p.is_admin and p.coins<5000 then raise exception 'You need 5,000 Forger Coins for VIP'; end if;
 if p.is_admin then update public.profiles set vip=true where id=auth.uid(); else update public.profiles set coins=coins-5000,vip=true where id=auth.uid(); end if;
end; $$;
grant execute on function public.buy_vip() to authenticated;

create or replace function public.buy_battle_pass() returns void language plpgsql security definer set search_path=public as $$
declare p record;
begin
 select * into p from public.profiles where id=auth.uid() for update;
 if p.battle_pass then raise exception 'Battle Pass already owned'; end if;
 if not p.is_admin and p.coins<2500 then raise exception 'You need 2,500 Forger Coins for the Battle Pass'; end if;
 if p.is_admin then update public.profiles set battle_pass=true where id=auth.uid(); else update public.profiles set coins=coins-2500,battle_pass=true where id=auth.uid(); end if;
end; $$;
grant execute on function public.buy_battle_pass() to authenticated;

create or replace function public.buy_cosmetic(item_id text) returns void language plpgsql security definer set search_path=public as $$
declare cost integer; admin boolean; current_coins integer;
begin
 cost:=case item_id when 'hoodie' then 100 when 'cyber' then 250 when 'gold' then 700 when 'ruby' then 150 when 'ocean' then 150 when 'green' then 150 when 'cap' then 200 when 'crown' then 1000 when 'wizard' then 750 when 'glasses' then 300 when 'star' then 400 when 'sparkles' then 800 else -1 end;
 if cost<0 then raise exception 'Unknown shop item'; end if;
 if exists(select 1 from public.inventory where user_id=auth.uid() and inventory.item_id=buy_cosmetic.item_id) then raise exception 'Already owned'; end if;
 select is_admin,coins into admin,current_coins from public.profiles where id=auth.uid() for update;
 if not admin and current_coins<cost then raise exception 'Not enough Forger Coins'; end if;
 if not admin then update public.profiles set coins=coins-cost where id=auth.uid(); end if;
 insert into public.inventory(user_id,item_id) values(auth.uid(),item_id);
end; $$;
grant execute on function public.buy_cosmetic(text) to authenticated;

create or replace function public.claim_battle_reward(p_tier integer) returns void language plpgsql security definer set search_path=public as $$
declare r public.battle_rewards%rowtype; p record;
begin
 select * into r from public.battle_rewards where tier=p_tier; if not found then raise exception 'Invalid Battle Pass tier'; end if;
 select * into p from public.profiles where id=auth.uid() for update;
 if not p.battle_pass then raise exception 'Buy the Battle Pass first'; end if;
 if p.battle_xp<p_tier*100 and not p.is_admin then raise exception 'Not enough Battle XP'; end if;
 if exists(select 1 from public.battle_reward_claims where user_id=auth.uid() and tier=p_tier) then raise exception 'Reward already claimed'; end if;
 if r.reward_type='coins' then if not p.is_admin then update public.profiles set coins=coins+(r.reward_value::integer) where id=auth.uid(); end if; else insert into public.inventory(user_id,item_id) values(auth.uid(),r.reward_value) on conflict do nothing; end if;
 insert into public.battle_reward_claims(user_id,tier) values(auth.uid(),p_tier);
end; $$;
grant execute on function public.claim_battle_reward(integer) to authenticated;

-- Equip exactly one item per cosmetic type. The browser cannot change ownership.
create or replace function public.equip_cosmetic(item_id text) returns void language plpgsql security definer set search_path=public as $$
declare typ text;
begin
 if not exists(select 1 from public.inventory where user_id=auth.uid() and inventory.item_id=equip_cosmetic.item_id) then raise exception 'You do not own this item'; end if;
 typ:=case item_id when 'hoodie' then 'Outfit' when 'cyber' then 'Outfit' when 'gold' then 'Outfit' when 'ruby' then 'Colour' when 'ocean' then 'Colour' when 'green' then 'Colour' when 'cap' then 'Hat' when 'crown' then 'Hat' when 'wizard' then 'Hat' when 'glasses' then 'Accessory' when 'star' then 'Accessory' when 'sparkles' then 'Accessory' else '' end;
 if typ='' then raise exception 'Unknown cosmetic'; end if;
 update public.inventory set equipped=false where user_id=auth.uid() and item_id in (select item_id from public.inventory where user_id=auth.uid() and item_id in ('hoodie','cyber','gold','ruby','ocean','green','cap','crown','wizard','glasses','star','sparkles')) and item_id<>equip_cosmetic.item_id and item_id in (select item_id from (values('hoodie','Outfit'),('cyber','Outfit'),('gold','Outfit'),('ruby','Colour'),('ocean','Colour'),('green','Colour'),('cap','Hat'),('crown','Hat'),('wizard','Hat'),('glasses','Accessory'),('star','Accessory'),('sparkles','Accessory')) v(item_id,typ2) where typ2=typ);
 update public.inventory set equipped=true where user_id=auth.uid() and inventory.item_id=equip_cosmetic.item_id;
end; $$;
grant execute on function public.equip_cosmetic(text) to authenticated;

-- Make this account an admin after it has signed up. Replace the email.
-- update public.profiles set is_admin=true where id=(select id from auth.users where email='YOUR-ADMIN-EMAIL');
