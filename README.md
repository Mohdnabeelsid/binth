# BINTH.IN — Phase 1 (Single Giveaway Landing Page + 15 QR Locations)

> **Handmade with care. Made for little ones.**  
> Customer Acquisition & 48-Hour Boutique Giveaway Platform for Kerala Handmade Girlswear (Ages 5–16).

---

## 1. Core Architecture & Change Request Overview

- **Single Giveaway Landing Page**: `index.html` is the **only** public landing page. Its sole purpose is introducing the 48-hour giveaway and capturing survey responses. There are no product catalogues, shopping sections, prices, or admin links.
- **15 Physical QR Locations**: Visitors scanning any of the 15 physical boutique QR posters are directed to `index.html?source=LOCATION_CODE`.
- **Hidden Source Attribution**: The source code is **never visibly displayed** to participants (no labels, no badges, no location dropdowns, and no source code in the confirmation message). The source parameter is validated, preserved in memory, and transmitted with the submission payload.
- **Subtle Instagram Link**: Secondary link to `https://instagram.com/binth.in` with text **Follow BINTH.IN on Instagram** (`target="_blank" rel="noopener noreferrer"`).
- **Strict Stack Compliance**: Built with 100% **HTML5, CSS3, and Vanilla JavaScript (ES6+)**. Zero frameworks, zero build steps, and zero mock data.

---

## 2. The 15 Target Campaign Locations

All 15 physical posters encode the same page path with their respective unique `source` parameter:

| # | Source Code | Location / Boutique | Establishment / Venue | District / Area | Type |
|---|---|---|---|---|---|
| 1 | `MCH-SHOP-001` | Mananchira Boutique Partner | Crafts Council Pavilion | Kozhikode | Boutique |
| 2 | `MCH-STORE-002` | SM Street Traditional Atelier | Mittai Theruvu Heritage Arcade | Kozhikode | Concept Store |
| 3 | `ALP-BOUTIQUE-003` | Mullakkal Handloom Corner | Mullakkal Central Atelier | Alappuzha | Boutique |
| 4 | `ALP-STORE-004` | Backwater Artisan Hub | Punnamada Craft Studio | Alappuzha | Artisan Hub |
| 5 | `KCH-MALL-005` | Marine Drive Concept Atelier | Marine Walkway Centre | Kochi | Concept Store |
| 6 | `KCH-STUDIO-006` | Panampilly Kids Space | Little Atelier Hub | Kochi | Kids Studio |
| 7 | `TVM-STUDIO-007` | Kowdiar Craft Pavilion | Royal Heritage Arcade | Thiruvananthapuram | Kids Studio |
| 8 | `TVM-SHOP-008` | Statue Handloom House | MG Road Boutique Corner | Thiruvananthapuram | Boutique |
| 9 | `TCR-STORE-009` | Round North Heritage Hub | Swaraj Heritage Space | Thrissur | Concept Store |
| 10 | `TCR-STUDIO-010` | Guruvayur Traditional Pavilion | East Nada Craft Centre | Guruvayur / Thrissur | Artisan Hub |
| 11 | `KNR-SHOP-011` | Payyambalam Weavers Point | Coastal Weaves Atelier | Kannur | Boutique |
| 12 | `KTY-STORE-012` | Baker Junction Little Atelier | Baker Craft Arcade | Kottayam | Concept Store |
| 13 | `PLK-STUDIO-013` | Fort Maidan Heritage Studio | Tipu Fort View Hub | Palakkad | Kids Studio |
| 14 | `KLM-BOUTIQUE-014` | Asramam Craft Gallery | Asramam Link Boutique | Kollam | Boutique |
| 15 | `MLP-HUB-015` | Kottakkal Traditional Centre | Arya Vaidya Heritage Arcade | Malappuram | Artisan Hub |

---

---

## 3. How to Run Locally

### Option A: Complete Unified Server (Frontend + Backend API + Database)
The Node.js backend serves both the static frontend and the complete REST API from a single process.

```powershell
# 1. Navigate to the backend server directory
cd server

# 2. Install dependencies (already installed)
npm install

# 3. Configure environment variables
# Copy .env.example to .env and set your DATABASE_URL
cp .env.example .env

# 4. Initialize PostgreSQL database (creates tables, views, initial sources & super admin)
npm run db:init

# 5. Start the server
npm start
# or for live reloading during development:
npm run dev
```

Once running:
- **Public Giveaway Landing Page**: `http://localhost:3000/`
- **Staff Admin Portal**: `http://localhost:3000/admin/`
- **API Health Check**: `http://localhost:3000/api/health`

---

### Option B: Static Frontend Only (Testing UI / Forms)
Run the static files via any local server (e.g. `npx http-server` on port 8080):

```powershell
npx http-server -p 8080
```

### URLs to Access:
- **Public Giveaway Landing Page (Untracked / Direct)**: `http://localhost:8080/index.html`
- **Testing All 15 QR Codes**:
  1. `http://localhost:8080/index.html?source=MCH-SHOP-001`
  2. `http://localhost:8080/index.html?source=MCH-STORE-002`
  3. `http://localhost:8080/index.html?source=ALP-BOUTIQUE-003`
  4. `http://localhost:8080/index.html?source=ALP-STORE-004`
  5. `http://localhost:8080/index.html?source=KCH-MALL-005`
  6. `http://localhost:8080/index.html?source=KCH-STUDIO-006`
  7. `http://localhost:8080/index.html?source=TVM-STUDIO-007`
  8. `http://localhost:8080/index.html?source=TVM-SHOP-008`
  9. `http://localhost:8080/index.html?source=TCR-STORE-009`
  10. `http://localhost:8080/index.html?source=TCR-STUDIO-010`
  11. `http://localhost:8080/index.html?source=KNR-SHOP-011`
  12. `http://localhost:8080/index.html?source=KTY-STORE-012`
  13. `http://localhost:8080/index.html?source=PLK-STUDIO-013`
  14. `http://localhost:8080/index.html?source=KLM-BOUTIQUE-014`
  15. `http://localhost:8080/index.html?source=MLP-HUB-015`
- **Staff Admin Portal**: `http://localhost:8080/admin/index.html`
- **QR Locations Management**: `http://localhost:8080/admin/sources.html`
- **Location Performance Reports**: `http://localhost:8080/admin/reports.html`

---

## 4. Location Management & QR Generation

Inside `admin/sources.html`:
- **Progress Indicator**: Shows `X of 15 locations configured` with a dynamic visual progress bar.
- **Quick Populate**: Button `⚡ Populate Initial 15 Locations` instantly preloads the 15 standard campaign locations across Kerala.
- **Duplicate Prevention**: Rejects any attempt to register duplicate location codes.
- **One-Click URL Copy**: Copies the full destination link `http://<host>/index.html?source=CODE` directly to the clipboard.
- **Built-in Pure Vanilla QR Generator**: Clicking **🔲 QR Code** renders an SVG QR code modal and provides a high-resolution PNG download with zero external dependencies.

---

## 5. Source Analytics & Reporting Formula

Inside `admin/reports.html`:
- **Formula**: `Conversion Rate = (Successful Submissions Attributed to Source ÷ Recorded Landing Visits) × 100`
- Safe zero-visit handling: Outputs `0.0%` when visits equal zero.
- Clarification: Visits are accurately documented as **landing-page or QR visits**, avoiding false claims of physical hardware scans.
- Form starts are tracked upon first interaction on the survey form (`POST /api/giveaway/start`).

---

## 6. Manual Testing Checklist

| Test Item | Steps | Expected Outcome |
|---|---|---|
| **Single Public Landing** | Navigate to `index.html` | Directly presents giveaway survey; contains no catalog, no e-commerce items, no admin links. |
| **Legacy Giveaway URL** | Open `giveaway.html?source=MCH-SHOP-001` | Seamlessly redirects to `index.html?source=MCH-SHOP-001`. |
| **Hidden Source Attribution** | Inspect page with `?source=MCH-SHOP-001` | Source code is **nowhere visible** on the public interface. |
| **Source Preservation** | Complete survey and click Submit | Payload sent to `POST /api/giveaway/entries` contains `sourceCode: "MCH-SHOP-001"`. |
| **Confirmation State** | Submit entry | Renders confirmation view with entry code and next steps. No source code is exposed. |
| **Subtle Instagram Link** | Click "Follow BINTH.IN on Instagram" | Opens `https://instagram.com/binth.in` in a new tab with `rel="noopener noreferrer"`. |
| **15 Locations Admin** | Open `admin/sources.html` and click "⚡ Populate Initial 15 Locations" | Populates all 15 locations; progress updates to `15 of 15 locations configured`. |
| **QR Code Generation** | Click "🔲 QR Code" on any location row | Displays generated SVG QR code; "Download PNG" downloads valid PNG barcode image. |
| **Duplicate Prevention** | Attempt to add an existing code (e.g. `MCH-SHOP-001`) | Form displays error: "A location with code ... is already registered." |
| **Reports Calculation** | Open `admin/reports.html` | Correctly displays Landing Visits, Form Starts, Completed Entries, and `(Entries ÷ Visits) × 100`. |
