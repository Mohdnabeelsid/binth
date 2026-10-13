# BINTH.IN — Production Deployment Guide

> **Architecture**: Netlify (Static Frontend & Admin) + Render (Node.js API) + Supabase (PostgreSQL Database)  
> **Brand**: BINTH.IN (Kerala Handmade Boutique Girlswear, Ages 5–16)

---

## 🏛 System Architecture Overview

```mermaid
graph LR
    User[Kerala Parents / QR Posters] -->|Scan QR / Direct Visit| Netlify[Netlify CDN\nStatic Frontend & Admin Portal]
    Staff[Admin Staff] -->|Browse /admin| Netlify
    
    Netlify -->|Reverse-Proxy /api/*| Render[Backend REST API Service\nNode.js + Express on Render]
    
    Render -->|SSL Transaction Pooler :6543| Supabase[(Managed PostgreSQL 15+\nSupabase)]
```

---

## Step 1: Provision Managed Database (Supabase)

1. Sign up or log in to [supabase.com](https://supabase.com).
2. Create a project named `binth-production` in **South Asia (Mumbai - ap-south-1)** or **Singapore (ap-southeast-1)**.
3. In Supabase **SQL Editor**, execute `database/schema.sql`.
4. Copy the connection URI in **Project Settings > Database > Connection String > URI (Mode: Transaction, Port 6543)**:
   ```text
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
   ```

---

## Step 2: Deploy Backend REST API (Render)

1. In [render.com](https://render.com), click **New + > Web Service**.
2. Connect your repository.
3. Configure settings:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add the following environment variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `DATABASE_URL`: *(Your Supabase connection string)*
   - `JWT_SECRET`: *(64-character random string from crypto.randomBytes(32).toString('hex'))*
   - `IP_HASH_SALT`: *(32-character random string)*
   - `CORS_ORIGIN`: `https://binth.in,https://www.binth.in,https://binth.netlify.app`
   - `RATE_LIMIT_MAX_ENTRIES`: `5`
   - `RATE_LIMIT_WINDOW_MS`: `600000`
5. Deploy service and verify `GET /api/health` returns status healthy.

---

## Step 3: Initialize the Administrator Account

To avoid hardcoded passwords in production, run the initialization with your private credentials:

```bash
ADMIN_DEFAULT_EMAIL="admin@binth.in" \
ADMIN_DEFAULT_PASSWORD="<YourSecurePasswordMin12Chars>" \
npm run db:init
```

---

## Step 4: Deploy Frontend (Netlify)

1. Connect the repository in Netlify.
2. Publish directory: `.`
3. In `netlify.toml`, configure the proxy rule pointing to your Render backend service:
   ```toml
   [[redirects]]
     from = "/api/*"
     to = "https://[your-api-service].onrender.com/api/:splat"
     status = 200
     force = true
   ```
4. Deploy and verify.

---

## Step 5: Verification Checklist

- [x] Campaign boundary timing uses half-open interval `now >= start_time AND now < end_time`.
- [x] Winner draw is blocked while campaign is active.
- [x] Winner draw uses server-side `crypto.randomInt` and row-level locking.
- [x] Rerolls require explicit reason and `super_admin` authorization.
- [x] Participant WhatsApp numbers are masked in all staff and reporting views.
- [x] Phone number and name inputs are validated both client-side and server-side.
- [x] All 15 QR locations are registered and attribute entries without exposing codes to participants.
- [x] CSV exports are sanitized against formula injection.
- [x] Unauthenticated admin visitors must authenticate via JWT login.
