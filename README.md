# Team Fitness - Accountability Challenge

52-week fitness accountability tracker for 6 warriors + 2 moderators.

## Quick Deploy

### 1. Supabase Setup
1. Create project at [supabase.com](https://supabase.com)
2. Go to SQL Editor, paste contents of `supabase_schema.sql`, click Run
3. Go to Project Settings > API, copy your **Project URL** and **anon key**

### 2. Environment Variables
1. Copy `.env.local.example` to `.env.local`
2. Fill in your Supabase URL and anon key

### 3. Deploy to Vercel
1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com), import the repo
3. Add environment variables (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY)
4. Click Deploy

### 4. Share
Send the Vercel URL to your team. They can add it to their home screen as a PWA.

## Tech Stack
- Next.js 14
- Tailwind CSS
- Supabase (Postgres + API)
- PWA (installable on mobile)

## PINs (default)
Warriors: 1111-6666 (alphabetical order)
Moderators: 7777-8888
