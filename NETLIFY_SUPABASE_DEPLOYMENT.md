# BINTH.IN — Netlify + Render + Supabase Production Deployment Guide

> **Architecture**: Netlify (Static Frontend & Admin Portal) + Render (Node.js REST API) + Supabase (PostgreSQL Database)  
> **Brand**: BINTH.IN (Kerala Handmade Boutique Girlswear, Ages 5–16)

---

## 🏛 System Architecture

```mermaid
graph LR
    User[Visitors / Kerala QR Posters] -->|Scan QR / Web Visit| Netlify[Netlify CDN\nStatic HTML5/CSS3/JS Frontend]
    Admin[Admin Staff] -->|Browse /admin| Netlify
    Netlify -->|Proxy /api/*| Render[Render Web Service\nNode.js Express REST API]
    Render -->|SSL Transaction Pooler :6543| Supabase[(Supabase PostgreSQL\nTables, Indexes, Ledger)]
```

---

## Part 1: Provision Supabase Database

1. Sign in to [**supabase.com**](https://supabase.com).
2. Click **New Project**:
   - **Name**: `binth-production`
   - **Database Password**: Generate and securely store a strong random password.
   - **Region**: Choose **South Asia (Mumbai - ap-south-1)** or **Singapore (ap-southeast-1)** for lowest latency to Kerala.
3. Open **SQL Editor** in the Supabase Dashboard:
   - Create a **New query**.
   - Copy the schema from `database/schema.sql` and run it.
   - This sets up the custom enum types, tables (`campaigns`, `sources`, `customers`, `entries`, `winners`, `audit_logs`, `admin_users`), indexes, analytics views, and the 15 registered Kerala boutique QR locations.
4. Obtain the Database Connection URI:
   - Go to **Project Settings** (gear icon) → **Database**.
   - Scroll to **Connection String** → choose **URI**.
   - Select **Mode: Transaction** (Port `6543`) or **Session** (Port `5432`).
   - Copy the URI:
     ```text
     postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
     ```

---

## Part 2: Deploy Backend API Service on Render

1. Sign in to [**render.com**](https://render.com) and click **New +** → **Web Service**.
2. Connect your GitHub repository (`binth`).
3. Configure service settings:
   - **Name**: `binth-api`
   - **Region**: Singapore
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Set Environment Variables:
   | Key | Example Value | Description |
   |---|---|---|
   | `NODE_ENV` | `production` | Enables production optimizations and security checks |
   | `PORT` | `10000` | Service listening port |
   | `DATABASE_URL` | `postgresql://...` | Supabase URI from Part 1 |
   | `JWT_SECRET` | *(64-character random hex)* | Token signing secret (generate with `crypto.randomBytes(32).toString('hex')`) |
   | `IP_HASH_SALT` | *(32-character random hex)* | Salt for visitor IP pseudonymization |
   | `CORS_ORIGIN` | `https://binth.in,https://www.binth.in,https://binth.netlify.app` | Explicit trusted origin allowlist (comma-separated) |
   | `RATE_LIMIT_MAX_ENTRIES` | `5` | Maximum participant submissions per 10 minutes |
   | `RATE_LIMIT_WINDOW_MS` | `600000` | 10-minute rate limit window |
5. Click **Deploy Web Service**.
6. Verify deployment health at: `https://[your-service].onrender.com/api/health`
   Expected response:
   ```json
   { "status": "healthy", "version": "1.0.0", "database": "connected" }
   ```

---

## Part 3: Provision the Initial Super Administrator

Do not use hardcoded passwords. Bootstrap the initial administrator securely:

1. In Render Dashboard, go to your `binth-api` service → **Shell** tab (or run locally with your production `DATABASE_URL`):
2. Run:
   ```bash
   ADMIN_DEFAULT_EMAIL=admin@binth.in ADMIN_DEFAULT_PASSWORD="<YOUR-STRONG-PRIVATE-PASSWORD>" npm run db:init
   ```
3. The script will securely hash the password using bcrypt (12 rounds) and insert the administrator. The password is never printed in plaintext to logs.

---

## Part 4: Deploy Static Frontend on Netlify

1. Sign in to [**netlify.com**](https://netlify.com) and click **Add new site** → **Import an existing project**.
2. Select your repository.
3. Configure build settings:
   - **Base directory**: `.`
   - **Build command**: *(leave blank — 100% static HTML/CSS/JS)*
   - **Publish directory**: `.`
4. In `netlify.toml`, verify the proxy rule points to your Render service:
   ```toml
   [[redirects]]
     from = "/api/*"
     to = "https://[your-render-service-name].onrender.com/api/:splat"
     status = 200
     force = true
   ```
5. Click **Deploy Site**.
   Netlify will serve the static files and forward all `/api/*` traffic transparently to Render with proper security headers.

---

## Part 5: Production Verification Checklist

1. **Public Giveaway Landing:**
   - Browse to `https://binth.in/?source=MCH-SHOP-001`.
   - Ensure the page renders without errors and the QR source attribution remains completely invisible to the participant.
2. **Submit Participant Entry:**
   - Fill in parent name, valid 10-digit Indian WhatsApp number, daughter's age tier, and clothing style preference.
   - Confirm successful registration and redirect to `success.html` with generated entry code (`ENT-XXXXXX`).
3. **Staff Authentication:**
   - Navigate to `/admin/`.
   - Verify unauthenticated visitors are presented with the Staff Authentication modal.
   - Sign in with your bootstrapped admin credentials.
   - Verify sidebar displays your authenticated name, email, and `Super Admin` role badge.
4. **Campaign & Winner Management:**
   - Verify campaigns are listed with correctly scoped entry and visit metrics.
   - Confirm winner draw is disabled while a campaign is active.
   - Close campaign and execute server-side random selection. Verify phone numbers are masked (`9847******`) and audit record is recorded atomically.
