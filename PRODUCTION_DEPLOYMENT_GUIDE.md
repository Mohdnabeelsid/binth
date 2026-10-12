# BINTH.IN — Production Deployment Guide
> **Architecture**: Separated Deployment (Vercel/Netlify Frontend + Managed PostgreSQL + Node.js API Service)  
> **Brand**: BINTH.IN (Kerala Handmade Boutique Girlswear, Ages 5–16)

---

## 🏛 Architecture Overview

```mermaid
graph LR
    User[Kerala Parents / QR Posters] -->|Scan QR| Vercel[Vercel / Netlify CDN\nStatic Frontend: index.html]
    Staff[Admin Staff] -->|Browse| AdminPortal[Admin Portal: /admin/*.html]
    
    Vercel -->|REST API Requests /api/*| Render[Backend API Service\nNode.js + Express on Render/Railway]
    AdminPortal -->|Bearer JWT| Render
    
    Render -->|Pooled SSL Queries| Postgres[(Managed PostgreSQL 15+\nSupabase or Neon)]
```

---

## Step 1: Provision Managed PostgreSQL (Supabase or Neon)

You need a managed PostgreSQL instance with SSL enabled. Both Supabase and Neon provide free production-grade tiers.

### Option A: Supabase (Recommended)
1. Go to [supabase.com](https://supabase.com) and create a free project (e.g. `binth-production`).
2. Choose a region close to your users (e.g., **South Asia / Mumbai - ap-south-1** or **Singapore**).
3. Navigate to **Project Settings** → **Database** → **Connection String** → select **URI** (Session Pooler or Direct).
4. Copy the connection string. It will look like:
   ```text
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
   ```

### Option B: Neon
1. Go to [neon.tech](https://neon.tech) and create a project (`binth-production`).
2. Select the **Asia Pacific (Singapore / Mumbai)** region.
3. Copy the pooled connection string with `sslmode=require`.

---

## Step 2: Deploy Backend REST API (Render or Railway)

Deploy the `server/` directory as an independent web service.

### Deploying on Render (Free / Starter)
1. Push your code to GitHub.
2. Sign in to [render.com](https://render.com) and click **New +** → **Web Service**.
3. Connect your GitHub repository (`binth`).
4. Set the following settings:
   - **Name**: `binth-api`
   - **Region**: Singapore (closest to Kerala)
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. In **Environment Variables**, add:
   | Key | Value | Description |
   |---|---|---|
   | `NODE_ENV` | `production` | Enables production optimizations |
   | `DATABASE_URL` | `postgresql://...` | Connection string from Step 1 |
   | `JWT_SECRET` | *(generate random 64-character string)* | Secret for signing staff JWTs |
   | `CORS_ORIGIN` | `https://binth.in,https://www.binth.in,https://*.vercel.app` | Allowed origins |
   | `ADMIN_DEFAULT_EMAIL` | `admin@binth.in` | Initial super admin email |
   | `ADMIN_DEFAULT_PASSWORD` | `YourStrongPasswordHere2026!` | Initial super admin password |
6. Click **Deploy Web Service**.
   > **Note**: On the first deploy, `npm start` automatically executes `node scripts/init-db.js`, which applies all database tables, views, the 15 boutique locations, and seeds the initial super admin user!
7. Once deployed, test your API health:
   ```text
   https://binth-api.onrender.com/api/health
   ```
   Expected response:
   ```json
   { "status": "healthy", "version": "1.0.0", "database": "connected" }
   ```

---

## Step 3: Deploy Frontend on Vercel (or Netlify)

### Deploying on Vercel
1. Go to [vercel.com](https://vercel.com) and click **Add New...** → **Project**.
2. Import your GitHub repository (`binth`).
3. Set the project configuration:
   - **Framework Preset**: `Other`
   - **Root Directory**: `./` (Root directory of the repo)
   - **Build & Output Settings**: Leave defaults (no build command needed, static files).
4. Configure the API proxy in [`vercel.json`](file:///d:/binth/vercel.json):
   Update the `rewrites` section so that any call to `/api/*` is transparently forwarded to your Render API without CORS:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:match*",
         "destination": "https://binth-api.onrender.com/api/:match*"
       },
       {
         "source": "/admin",
         "destination": "/admin/index.html"
       },
       {
         "source": "/admin/",
         "destination": "/admin/index.html"
       }
     ]
   }
   ```
5. Click **Deploy**.
6. Your site is now live at `https://binth.vercel.app`!

---

## Step 4: Custom Domain Setup (`binth.in`)

1. In your Vercel Dashboard, go to **Settings** → **Domains**.
2. Add `binth.in` and `www.binth.in`.
3. Update your DNS records at your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):
   - `A` Record: `@` → `76.76.21.21` (Vercel IP)
   - `CNAME` Record: `www` → `cname.vercel-dns.com`
4. If you want a dedicated API subdomain:
   - In Render, add custom domain `api.binth.in`.
   - In DNS, add `CNAME` record: `api` → `binth-api.onrender.com`.

---

## Step 5: Post-Deployment Verification Checklist

| # | Check | How to Verify | Expected Result |
|---|---|---|---|
| 1 | **Database Connected** | Visit `https://api.binth.in/api/health` | Status is `"healthy"` and database is `"connected"`. |
| 2 | **Public Giveaway Page** | Visit `https://binth.in/` | Hero loads with Kerala boutique styling; form validation active. |
| 3 | **QR Attribution** | Visit `https://binth.in/?source=MCH-SHOP-001` | Page loads without showing source badge to user, but records visit in backend. |
| 4 | **Admin Login** | Visit `https://binth.in/admin/index.html` | Log in with `admin@binth.in` and your configured password. |
| 5 | **Sources Directory** | Open **QR Sources** in admin | 15 boutique partner locations across Kerala displayed with live statistics. |
| 6 | **Password Security** | Open **Settings** in admin | Change the default admin password to a unique production password. |

---

## 🔒 Production Security Guarantees
- **Child Privacy**: Zero child PII stored. Only guardian name, sanitized WhatsApp number, and approved age tier (`5-7`, `8-10`, `11-13`, `14-16`).
- **Fraud Prevention**: IP-salted rate limiting (5 submissions per 10 mins) and strict database constraints (`UNIQUE(campaign_id, customer_id)`).
- **Audit Logging**: All admin actions (source edits, exports, winner draws) are permanently recorded in `audit_logs`.
- **CSPRNG Draws**: Winner selection uses Node.js `crypto.randomInt` server-side — client-side selection is strictly impossible.
