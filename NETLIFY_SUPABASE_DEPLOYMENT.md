# BINTH.IN — Netlify + Supabase Production Deployment Guide
> **Stack**: Netlify (Frontend) + Supabase (PostgreSQL Database) + Node.js API Service  
> **Brand**: BINTH.IN (Kerala Handmade Boutique Girlswear, Ages 5–16)

---

## 🏛 Topology

```mermaid
graph LR
    User[Visitors / Kerala QR Posters] -->|Scan QR| Netlify[Netlify CDN\nStatic Frontend & Admin]
    Admin[Admin Staff] -->|Browse /admin| Netlify
    Netlify -->|API Proxy /api/*| API[Backend Node.js API\nRender / Railway / VPS]
    API -->|Pooled SSL Queries :5432 / :6543| Supabase[(Supabase PostgreSQL 15+\nTables, Views, Audit Ledger)]
```

---

## Part 1: Setup Supabase Database (Takes 3 Minutes)

1. Go to [**supabase.com**](https://supabase.com) and create an account (or log in).
2. Click **New Project**:
   - **Name**: `binth-production`
   - **Database Password**: *(Create a strong password and save it in a safe place)*
   - **Region**: Select **South Asia (Mumbai)** (`ap-south-1`) or **Singapore** (`ap-southeast-1`) for best latency in Kerala.
   - Click **Create new project**.

3. Once the database is ready, click **SQL Editor** on the left navigation bar.
4. Click **New Query**, open [`database/schema.sql`](file:///d:/binth/database/schema.sql), copy its entire contents, and paste it into the editor.
5. Click **Run** (or `Ctrl+Enter`).
   > ✅ **What this creates automatically**:
   > - All tables (`campaigns`, `sources`, `customers`, `entries`, `winners`, `audit_logs`, `admin_users`)
   > - Intelligence views (`v_source_performance`, `v_dashboard_metrics`)
   > - All **15 Kerala boutique partner QR locations** (from Kozhikode to Thiruvananthapuram)
   > - The initial active **48-Hour Giveaway Campaign**
   > - The default **Super Admin** account (`admin@binth.in` / `BinthAdmin2026!`)

6. Get your Connection String:
   - Go to **Project Settings** (gear icon) → **Database**.
   - Scroll down to **Connection String** → choose **URI**.
   - Select **Mode: Session** (Port `5432`) or **Transaction** (Port `6543`).
   - Copy the string. It will look like:
     ```text
     postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
     ```
   - Replace `[YOUR-PASSWORD]` with your actual database password.

---

## Part 2: Deploy Backend API Service (Takes 3 Minutes)

The Node.js Express server (`server/`) handles participant submissions, IP hashing, rate limiting, cryptographic winner selection, and admin APIs.

### Free & Fast Option: Render.com
1. Push your repository to GitHub.
2. Sign in to [**render.com**](https://render.com) → click **New +** → **Web Service**.
3. Select your GitHub repository (`binth`).
4. Configure the service:
   - **Name**: `binth-api`
   - **Region**: Singapore
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | *(Paste your Supabase URI from Part 1)* |
   | `JWT_SECRET` | *(Generate any random 64-character string)* |
   | `CORS_ORIGIN` | `*` |
   | `ADMIN_DEFAULT_EMAIL` | `admin@binth.in` |
   | `ADMIN_DEFAULT_PASSWORD` | `BinthAdmin2026!` |
6. Click **Deploy Web Service**.
7. Once deployed, note your service URL (e.g., `https://binth-api.onrender.com`).
8. Test health: `https://binth-api.onrender.com/api/health` → should return:
   ```json
   { "status": "healthy", "version": "1.0.0", "database": "connected" }
   ```

---

## Part 3: Deploy Frontend on Netlify (Takes 2 Minutes)

1. Sign in to [**netlify.com**](https://netlify.com).
2. Click **Add new site** → **Import an existing project** → select your GitHub repository (`binth`).
3. Set your build configuration:
   - **Base directory**: `.` *(leave blank / root)*
   - **Build command**: *(leave blank — 100% static HTML/CSS/JS)*
   - **Publish directory**: `.` *(root)*
4. Connect Netlify to your API backend:
   Open [`netlify.toml`](file:///d:/binth/netlify.toml) and add a proxy rule pointing to your live Render API:
   ```toml
   [[redirects]]
     from = "/api/*"
     to = "https://binth-api.onrender.com/api/:splat"
     status = 200
     force = true
   ```
   *(Replace `https://binth-api.onrender.com` with your actual Render API URL)*
5. Click **Deploy Site**.
   > 🎉 Netlify will now proxy all `/api/*` traffic transparently to your backend with zero CORS issues!

---

## Part 4: Custom Domain (`binth.in`) Configuration

1. In Netlify Dashboard, navigate to **Site configuration** → **Domain management** → **Add domain**.
2. Add `binth.in` and `www.binth.in`.
3. In your Domain Registrar DNS settings (GoDaddy, Namecheap, Cloudflare, etc.):
   - **Apex domain (`@`)**: Add an `A` record pointing to Netlify's load balancer IP: `75.2.60.5`
   - **Subdomain (`www`)**: Add a `CNAME` record pointing to `[your-site-name].netlify.app`.
4. Netlify will automatically provision a free Let's Encrypt SSL certificate within a few minutes.

---

## Part 5: Verification Checklist

1. **Public Giveaway Page**:
   Open `https://binth.in/?source=MCH-SHOP-001`
   - Verify page loads cleanly with Kerala boutique styling.
   - Verify the location badge is NOT displayed to the user (hidden attribution).
2. **Submit a Test Entry**:
   - Enter guardian name, valid 10-digit WhatsApp number, girl's age tier, and interests.
   - Click **Submit Free Entry**.
   - Verify redirect to `success.html` with generated entry code (e.g. `ENT-K7B92M`).
3. **Admin Portal**:
   - Open `https://binth.in/admin/index.html`.
   - Log in with `admin@binth.in` / `BinthAdmin2026!`.
   - Check **Overview**: verify real count increased.
   - Check **Entries**: verify test entry appears with masked phone number (`9847******`).
   - Check **QR Sources**: verify the 15 boutique partners display visit and entry stats.
4. **Security Action**:
   - Open **Settings** and update the default admin password to a new private password.
