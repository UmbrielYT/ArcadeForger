# ArcadeForge Community Edition

This edition adds a real online backend using Supabase:
- accounts and sign-in
- online profiles
- community-published games
- likes
- play counts
- server-side Forger Coin rewards
- online cosmetic inventory
- shop purchases
- creator rewards

## Setup

1. Create a Supabase project.
2. Open its SQL Editor.
3. Paste all of `supabase.sql` and run it.
4. In Supabase, get your Project URL and Publishable Key.
5. Open `app.js`.
6. Replace:
   `YOUR_SUPABASE_URL`
   `YOUR_SUPABASE_PUBLISHABLE_KEY`
   with your project values.
7. Upload `index.html`, `style.css`, `app.js`, and `supabase.sql` to your GitHub repository.
8. Keep `index.html` in the repository root.
9. Commit the changes. GitHub Pages will redeploy.

Supabase's browser client can be initialized with the project URL and publishable key, and its Auth system supports email/password accounts. The SQL in this package uses Row Level Security and database functions so important coin operations aren't trusted to a normal browser-only balance update.

## Important

The publish system currently uses safe built-in game templates. A future version can add a visual level editor where creators assemble their own levels from blocks/sprites.

Do not put a Supabase secret/service-role key into `app.js`. The browser should only use the publishable/anon client key with RLS enabled.
