# ArcadeForge Community Plus — setup

## 1. Supabase
Create a Supabase project.

## 2. Database
Open **SQL Editor → New query**, paste the entire `supabase.sql`, and Run it.

## 3. Email/password sign-in
In Supabase open **Authentication → Providers → Email** and make sure Email is enabled.
If **Confirm email** is enabled, a new user must click the confirmation email before their first sign-in. For a simple test site, you can disable confirmation in the Auth email settings; for a public site, keep confirmation enabled.

## 4. Connect the website
Open `app.js` and replace:

```js
const SB_URL="YOUR_SUPABASE_URL";
const SB_KEY="YOUR_SUPABASE_PUBLISHABLE_KEY";
```

with your Supabase **Project URL** and **Publishable key**. Never put a secret/service-role key in this file.

## 5. Upload to GitHub Pages
Replace your existing `index.html`, `style.css`, and `app.js` in your GitHub repository. Keep `supabase.sql` and this setup file if you want.

## 6. Admin account
First create/sign up for the creator account. Then in Supabase SQL Editor run:

```sql
update public.profiles
set is_admin=true
where id=(select id from auth.users where email='YOUR-ADMIN-EMAIL');
```

Only the database decides who is an admin. Admins get infinite coin purchasing/earning power and the ADMIN tag.

## 7. What is included
- Email/password sign up and sign in
- Community games
- AI Forge using free built-in templates
- 1,000-coin game creation cost
- Coins for playing
- Daily login reward
- Store with costumes, colours, hats and accessories
- VIP for 5,000 coins
- Battle Pass for 2,500 coins
- Battle Pass XP and rewards
- Online inventory
- Profile character designer
- Equip only items that the player owns
- Equipped character shown in games
- Server-side coin/payment rules with Supabase RPCs
