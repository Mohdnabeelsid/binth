# BINTH.IN — Production Deployment Guide (Single-Platform: Render + Supabase)

> **Chosen Architecture**: **Single Unified Web Service on Render** (serves landing page, admin portal, and REST API) + **Managed PostgreSQL on Supabase**.  
> **Brand**: BINTH.IN (Kerala Handmade Boutique Girlswear, Ages 5–16)

---

## 🏛 System Architecture Overview

```mermaid
graph LR
    User[Kerala Parents / QR Posters] -->|Scan QR / Direct Visit| Render[BINTH.IN Unified Platform\nExpress + Vanilla Web on Render]
    Staff[Admin Staff] -->|Browse /admin| Render
    
    Render -->|Same-Origin /api/*| RenderAPI[Internal REST Routes\nPublic & Admin API]
    RenderAPI -->|SSL Transaction Pooler :6543| Supabase[(Managed PostgreSQL 15+\nSupabase in Mumbai/Singapore)]
```

### Why this is simpler and safer:
1. **Zero CORS Issues**: Frontend and backend share the exact same origin (`https://binth.in`).
2. **One Dashboard**: Only one Render Web Service to deploy and monitor.
3. **Protected Source Code**: Sensitive directories (`/server`, `/database`, `/.env`) are blocked from static web requests.
4. **Instant API Calls**: Relative `/api/...` calls go straight to the local Express router with zero external proxy latency.

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

## Step 2: Deploy Unified Web Service (Render)

1. In [render.com](https://render.com), click **New + > Web Service**.
2. Connect your GitHub repository (`Mohdnabeelsid/binth`).
3. Configure the service:
   - **Name**: `binth-platform`
   - **Region**: **Singapore** (closest region to Kerala users)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
4. Add the following **Environment Variables**:
   | Variable | Value | Notes |
   |---|---|---|
   | `NODE_ENV` | `production` | Enables production security & caching |
   | `PORT` | `10000` | Standard Render web port |
   | `DATABASE_URL` | `postgresql://...:6543/postgres?sslmode=require` | Your Supabase transaction pooler URI |
   | `JWT_SECRET` | *(64-character random hex string)* | Staff authentication signing key |
   | `IP_HASH_SALT` | *(32-character random string)* | Salts participant IP hashes for privacy |
   | `CORS_ORIGIN` | `https://binth.in,https://www.binth.in` | Your custom production domain(s) |
   | `RATE_LIMIT_MAX_ENTRIES` | `5` | Maximum entry submissions per 10 mins per IP |
   | `RATE_LIMIT_WINDOW_MS` | `600000` | 10 minutes window |

---

## Step 3: Initialize the Administrator Account

To avoid hardcoded credentials in production, run the initialization command with your private credentials:

### Option A: From Render Web Shell
Open **Shell** in your Render dashboard and execute:
```bash
ADMIN_DEFAULT_EMAIL="admin@binth.in" ADMIN_DEFAULT_PASSWORD="<YourSecurePasswordMin12Chars>" npm run db:init
```

### Option B: From your Local Machine (against Supabase)
```bash
DATABASE_URL="postgresql://...:6543/postgres?sslmode=require" \
ADMIN_DEFAULT_EMAIL="admin@binth.in" \
ADMIN_DEFAULT_PASSWORD="<YourSecurePasswordMin12Chars>" \
npm run db:init
```

---

## Step 4: Point Custom Domain (`binth.in`)

1. In Render Dashboard > **Settings > Custom Domains**, add:
   - `binth.in`
   - `www.binth.in`
2. Update your DNS registrar (GoDaddy / Cloudflare / Namecheap):
   - **CNAME** or **A** record pointing to Render's provided target.
3. Render automatically provisions free managed SSL certificates.

---

## Step 5: Production Verification Checklist

- [x] Landing page loads at `/` with 48-hour countdown and giveaway entry form.
- [x] QR code parameter tracking resolves active boutiques (e.g. `/?source=MCH-SHOP-001`).
- [x] Sensitive backend files (`/server/*`, `/database/*`, `/.env`) return `404 Not Found`.
- [x] Campaign boundary timing uses half-open interval `now >= start_time AND now < end_time`.
- [x] Winner draw is blocked while campaign is active.
- [x] Winner draw uses server-side `crypto.randomInt` and row-level locking.
- [x] Rerolls require explicit reason and `super_admin` authorization.
- [x] Participant WhatsApp numbers are masked in all staff and reporting views.
- [x] Phone number and name inputs are validated both client-side and server-side.
- [x] CSV exports are sanitized against formula injection.
- [x] Staff members must authenticate with JWT to view or modify admin records at `/admin/`.
