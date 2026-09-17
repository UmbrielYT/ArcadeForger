# ArcadeForge Community Platform — Setup

This version adds:
- Sign in / sign up with Supabase Auth
- Online community games
- AI Forge: describe a game and generate a playable built-in template
- Game creation cost: 1,000 Forger Coins
- Playing games: earns Forger Coins + Battle XP
- Daily login reward: 150 coins + 50 Battle XP once per day
- VIP: 5,000 coins
- Battle Pass: 2,500 coins with 10 tiers of coins/cosmetics
- Online cosmetic shop
- Admin tag with infinite purchasing power

## 1. Create Supabase
Create a project at https://supabase.com/.

## 2. Run the database upgrade
Open **SQL Editor → New query**.
Paste the complete `supabase.sql` file and click **Run**.

If you already ran the previous ArcadeForge SQL, this file is designed as an upgrade and uses `alter table ... add column if not exists` plus `create or replace function` for the new systems.

## 3. Get your browser keys
In your Supabase project, find the project URL and **Publishable key**.
Do NOT use the secret/service-role key in a public website.

## 4. Edit app.js
At the top of `app.js`, replace:

    const SB_URL="YOUR_SUPABASE_URL";
    const SB_KEY="YOUR_SUPABASE_PUBLISHABLE_KEY";

with your real Supabase project URL and Publishable key.

## 5. Make the site creator an admin
First create/sign up for the creator account on ArcadeForge.
Then in Supabase SQL Editor run:

    update public.profiles
    set is_admin=true
    where id=(select id from auth.users where email='YOUR-ADMIN-EMAIL');

Only do this for trusted creator/admin accounts. Admin status is checked by database functions, so normal players cannot give themselves infinite coins from the website.

## 6. Upload to GitHub Pages
Replace these files in your GitHub repository:
- index.html
- style.css
- app.js
- supabase.sql
- SETUP.md

Commit the changes. GitHub Pages will redeploy the site.

## About the AI Forge
This free GitHub Pages version does not send your prompt to an external AI API. Instead, the browser's built-in generator detects the game idea and maps it to one of ArcadeForge's playable templates. This keeps the site free and avoids exposing an AI API key.

If you later want a true LLM that writes new game code from scratch, add a secure server/edge function and keep the AI provider key off the browser.
