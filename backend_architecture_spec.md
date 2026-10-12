# BINTH.IN — Production Backend Architecture Specification & PostgreSQL Design
> **Phase 1: Customer Acquisition, 48-Hour QR Giveaway & Boutique Attribution**  
> Brand: BINTH.IN (Kerala Handmade Boutique Girlswear, Ages 5–16)  
> Version: 1.0.0 (Production Architecture Ready)

---

## 1. System Overview & Architectural Topology

BINTH.IN operates a **decoupled architecture** where the frontend is delivered as a 100% static, framework-less HTML5/CSS3/Vanilla JS application, communicating with a stateless REST API layer backed by **PostgreSQL 15+**.

```mermaid
graph TD
    subgraph Public Ingestion
        QR[Physical Posters at 15 Kerala Boutiques] -->|Scan QR| Landing[index.html?source=CODE]
        Landing -->|POST /api/giveaway/visit| VisitTracker[Attribution Engine]
        Landing -->|POST /api/giveaway/start| StartTracker[Form Interaction Tracker]
        Landing -->|POST /api/giveaway/entries| EntryValidator[Entry Ingestion & Deduplication]
    end

    subgraph Staff Portal
        Admin[Staff Portal admin/*.html] -->|Bearer JWT| AdminRouter[Admin API Router]
    end

    subgraph Core Backend Services
        VisitTracker --> EventsTable[(source_events)]
        StartTracker --> EventsTable
        EntryValidator --> CustomerEngine[Customer Identity Engine]
        CustomerEngine --> CustomersTable[(customers)]
        EntryValidator --> EntriesTable[(entries)]
        AdminRouter --> WinnerEngine[Cryptographic Winner Engine]
        AdminRouter --> ReportingEngine[Aggregated Intelligence Views]
        WinnerEngine --> WinnersTable[(winners)]
        AdminRouter --> AuditEngine[Audit Ledger]
        AuditEngine --> AuditTable[(audit_logs)]
    end

    subgraph PostgreSQL Database
        CustomersTable
        EntriesTable
        EventsTable
        WinnersTable
        AuditTable
        CampaignsTable[(campaigns)]
        SourcesTable[(sources)]
    end
```

---

## 2. Customer Identity Hierarchy & Child Privacy Mandate

### 2.1 The Identity Distinction Rule
A customer profile represents a household/parent entity. Marketing consent and giveaway participation are **independent activities**, not the defining characteristics of a customer:
- **Customer**: Identified uniquely by their verified WhatsApp number (`whatsapp_phone`).
- **Entry**: A single participant record for an active 48-hour campaign.
- **Consent**: Explicit opt-in checkbox (`has_marketing_consent`) recorded with timestamp. Opting out of marketing **never disqualifies** a participant from winning the giveaway.
- **Purchaser**: Customer tier badge upgraded upon verified e-commerce or boutique transaction (`is_purchaser = true`).

### 2.2 Strict Child Privacy Commitment (COPPA / DPDP India Compliance)
Under no circumstances may the backend schema or ingestion endpoints accept or store:
- ❌ Child's full name or nickname
- ❌ Child's exact date of birth or birth certificate details
- ❌ Child photographs or video media
- ❌ School name or institutional affiliation
- ❌ Residential street address

**Permitted Data Points**:
- Parent/Guardian contact name (`parent_name`)
- WhatsApp mobile number (`whatsapp_phone`)
- Girl's age tier category strictly within approved enum ranges (`5-7`, `8-10`, `11-13`, `14-16`)
- Clothing styling preferences (`clothing_interests`)

---

## 3. PostgreSQL Database Schema Specification

The full DDL is stored at [`database/schema.sql`](file:///d:/binth/database/schema.sql). Below is the comprehensive data dictionary:

### 3.1 Tables & Entity Definitions

#### `campaigns`
Stores 48-hour giveaway campaign cycles.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK, `gen_random_uuid()` | Immutable primary key |
| `title` | `VARCHAR(255)` | NOT NULL | e.g., "Onam & Festive Little Princess Giveaway" |
| `prize_name` | `VARCHAR(255)` | NOT NULL | Prize description (e.g., Handmade Kurti Set) |
| `description` | `TEXT` | NULL | Narrative description |
| `duration_hours`| `INT` | NOT NULL, DEFAULT 48 | Standard boutique cycle duration |
| `start_time` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Campaign open window |
| `end_time` | `TIMESTAMPTZ` | NOT NULL | Auto-calculated `start_time + INTERVAL '48 hours'` |
| `status` | `campaign_status`| NOT NULL, DEFAULT 'active' | `'draft'`, `'active'`, `'paused'`, `'closed'`, `'archived'` |
| `created_by` | `UUID` | FK `admin_users(id)` | Staff creator |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Timestamp |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Timestamp |

#### `sources`
Directory of the 15 physical boutique QR partner locations across Kerala.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK, `gen_random_uuid()` | Primary key |
| `code` | `VARCHAR(35)` | UNIQUE, NOT NULL | Standard code: e.g. `MCH-SHOP-001` |
| `name` | `VARCHAR(255)` | NOT NULL | e.g. "Mananchira Boutique Partner" |
| `establishment`| `VARCHAR(255)` | NULL | Venue: e.g. "Crafts Council Pavilion" |
| `area` | `VARCHAR(255)` | NOT NULL | Area: e.g. "Mananchira, Kozhikode" |
| `district` | `VARCHAR(100)` | NULL | Kerala District: "Kozhikode", "Ernakulam", etc. |
| `type` | `source_type` | NOT NULL, DEFAULT 'Boutique'| `'Boutique'`, `'Concept Store'`, `'Kids Studio'`, `'Artisan Hub'` |
| `partner_name` | `VARCHAR(255)` | NULL | Guild/partner organization name |
| `is_active` | `BOOLEAN` | NOT NULL, DEFAULT true | QR link active routing state |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Timestamp |

#### `customers`
Master directory of acquired parent contacts.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK, `gen_random_uuid()` | Primary key |
| `parent_name` | `VARCHAR(150)` | NOT NULL | Parent / guardian name |
| `whatsapp_phone`| `VARCHAR(20)`| UNIQUE, NOT NULL | Sanitized 10-digit / E.164 mobile |
| `location_district`| `VARCHAR(100)`| DEFAULT 'Kerala' | Approximate district location |
| `has_marketing_consent`| `BOOLEAN`| NOT NULL, DEFAULT false | Explicit WhatsApp opt-in state |
| `marketing_consent_at` | `TIMESTAMPTZ`| NULL | Timestamp when consent was checked |
| `is_purchaser` | `BOOLEAN` | NOT NULL, DEFAULT false | Whether customer has placed commercial orders |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Timestamp |

#### `entries`
The master ledger of giveaway participation.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK, `gen_random_uuid()` | Primary key |
| `entry_code` | `VARCHAR(50)` | UNIQUE, NOT NULL | Human-facing reference: e.g. `ENT-KCH92A` |
| `campaign_id` | `UUID` | FK `campaigns(id)`, NOT NULL | Target campaign |
| `customer_id` | `UUID` | FK `customers(id)`, NOT NULL | Customer participant |
| `source_code` | `VARCHAR(35)` | FK `sources(code)`, NULL | Preserved QR attribution source |
| `girl_age_range`| `VARCHAR(20)` | NOT NULL | Whitelisted: `'5-7'`, `'8-10'`, `'11-13'`, `'14-16'` |
| `clothing_interests`| `JSONB` | NOT NULL, DEFAULT '[]' | Selected design preferences |
| `is_eligible` | `BOOLEAN` | NOT NULL, DEFAULT true | Winner pool eligibility flag |
| `ineligibility_reason`| `TEXT` | NULL | Reason if flagged ineligible |
| `marketing_consent`| `BOOLEAN` | NOT NULL, DEFAULT false | Opt-in submitted with entry |
| `client_ip_hash` | `VARCHAR(64)` | NULL | SHA-256 salted hash of IP (anti-fraud) |
| `user_agent` | `TEXT` | NULL | Client browser string |
| `submitted_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Server timestamp |
| **Constraint** | `UNIQUE` | `(campaign_id, customer_id)` | **1 entry per participant per campaign** |

#### `winners`
Immutable audit log of official server-side winner selections.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK, `gen_random_uuid()` | Primary key |
| `campaign_id` | `UUID` | FK `campaigns(id)`, NOT NULL | Target campaign |
| `entry_id` | `UUID` | FK `entries(id)`, NOT NULL | Selected winning entry |
| `customer_id` | `UUID` | FK `customers(id)`, NOT NULL | Selected customer winner |
| `selection_reason`| `TEXT` | NOT NULL | Audit reason / reroll explanation |
| `drawn_by_user_id`| `UUID` | FK `admin_users(id)`, NULL | Staff member initiating draw |
| `selection_hash` | `VARCHAR(64)` | NOT NULL | SHA-256 proof of CSPRNG entropy seed |
| `audit_metadata` | `JSONB` | DEFAULT '{}' | Candidate pool size, timestamp, verification |
| `drawn_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Timestamp |

---

## 4. REST API Endpoint Specifications

All endpoints match the contract defined in [`assets/js/api.js`](file:///d:/binth/assets/js/api.js).

### 4.1 Public Endpoints

#### `GET /api/health`
- **Auth**: Public
- **Response `200 OK`**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "database": "connected",
  "timestamp": "2026-10-11T20:30:00Z"
}
```

#### `GET /api/campaigns/active?source=:sourceCode`
- **Auth**: Public
- **Query Params**: `source` (Optional string)
- **Response `200 OK`**:
```json
{
  "id": "7b3c2e1f-49b8-4d56-a192-3a5f8e91234a",
  "title": "Onam & Festive Little Princess Giveaway",
  "prize": "Handmade Pure Cotton Festive Kurti Set",
  "description": "Exclusive 48-hour boutique giveaway welcoming Kerala families.",
  "durationHours": 48,
  "startTime": "2026-10-10T12:00:00Z",
  "endTime": "2026-10-12T12:00:00Z",
  "status": "active",
  "sourceValid": true
}
```

#### `POST /api/giveaway/visit`
- **Auth**: Public (Rate-limited: 60/min per IP)
- **Payload**:
```json
{
  "sourceCode": "MCH-SHOP-001",
  "timestamp": "2026-10-11T20:30:00.000Z"
}
```
- **Response `200 OK`**:
```json
{ "ok": true, "recorded": true }
```

#### `POST /api/giveaway/start`
- **Auth**: Public (Rate-limited: 60/min per IP)
- **Payload**:
```json
{
  "sourceCode": "MCH-SHOP-001",
  "timestamp": "2026-10-11T20:30:05.000Z"
}
```
- **Response `200 OK`**:
```json
{ "ok": true, "recorded": true }
```

#### `POST /api/giveaway/entries`
- **Auth**: Public (Rate-limited: 5 attempts per 10 mins per IP)
- **Payload**:
```json
{
  "parentName": "Anjali Nair",
  "whatsappPhone": "9847012345",
  "ageRange": "8-10",
  "clothingInterests": ["traditional", "casual_cotton"],
  "marketingConsent": true,
  "sourceCode": "MCH-SHOP-001",
  "submittedAt": "2026-10-11T20:30:15.000Z"
}
```
- **Validation Rules**:
  1. `parentName`: Trimmed, 2–100 characters.
  2. `whatsappPhone`: Regex `^[6-9]\d{9}$` (India 10-digit). Normalized to `+919847012345`.
  3. `ageRange`: Must be in `['5-7', '8-10', '11-13', '14-16']`.
  4. `clothingInterests`: Array containing at least 1 valid style key.
  5. Check `campaigns WHERE status = 'active' AND NOW() BETWEEN start_time AND end_time`. If closed, return `400 Bad Request` ("This giveaway campaign has closed").
  6. Upsert into `customers`: Update `parent_name`, update `has_marketing_consent` if checked.
  7. Check `entries WHERE campaign_id = :id AND customer_id = :customerId`. If exists, return `409 Conflict`:
     ```json
     {
       "ok": false,
       "error": "This WhatsApp number has already been entered into this giveaway campaign. Limited to one entry per participant."
     }
     ```
  8. Generate cryptographically distinct `entryCode`: Format `ENT-` + 6 uppercase base32 alphanumeric characters.
- **Response `201 Created`**:
```json
{
  "ok": true,
  "entryCode": "ENT-9X4KM2",
  "message": "Giveaway entry successfully registered."
}
```

---

### 4.2 Admin Endpoints (Requires `Bearer JWT`)

#### `GET /api/admin/metrics`
- **Role**: All Staff (`viewer`, `campaign_manager`, `super_admin`)
- **Query Source**: Reads directly from `v_dashboard_metrics` view.
- **Response `200 OK`**:
```json
{
  "activeCampaigns": 1,
  "totalCustomers": 142,
  "totalEntries": 142,
  "qrVisits": 480,
  "formStarts": 210,
  "conversionRate": 29.6
}
```

#### `GET /api/admin/campaigns`
- **Role**: All Staff
- **Response `200 OK`**:
```json
[
  {
    "id": "7b3c2e1f-49b8-4d56-a192-3a5f8e91234a",
    "title": "Onam & Festive Little Princess Giveaway",
    "prize": "Handmade Pure Cotton Festive Kurti Set",
    "status": "active",
    "startTime": "2026-10-10T12:00:00Z",
    "endTime": "2026-10-12T12:00:00Z",
    "totalEntries": 142,
    "qrVisits": 480,
    "conversionRate": 29.6
  }
]
```

#### `POST /api/admin/campaigns`
- **Role**: `campaign_manager`, `super_admin`
- **Payload**:
```json
{
  "title": "Vishu Little Princess Boutique Giveaway",
  "prize": "Traditional Kasavu Handloom Frock Set",
  "description": "Celebrating Kerala New Year with artisanal cotton wear.",
  "durationHours": 48,
  "status": "active"
}
```
- **Response `201 Created`**

#### `POST /api/admin/campaigns/:id/select-winner`
- **Role**: `campaign_manager`, `super_admin`
- **Payload**:
```json
{
  "reason": "Official campaign close random draw"
}
```
- **Execution Workflow**:
  1. Fetch campaign. If status is `active`, verify explicit override or return `400 Bad Request` ("Campaign is currently live. Close before drawing").
  2. Query eligible candidates:
     ```sql
     SELECT e.id AS entry_id, e.entry_code, c.id AS customer_id, c.parent_name, c.whatsapp_phone
     FROM entries e
     JOIN customers c ON e.customer_id = c.id
     WHERE e.campaign_id = $1 AND e.is_eligible = true;
     ```
  3. If candidate count = 0, return `422 Unprocessable Entity` ("No eligible entries available for draw").
  4. Cryptographic Selection (CSPRNG):
     ```python
     # Python CSPRNG selection:
     import secrets, hashlib
     selected_index = secrets.randbelow(len(candidates))
     winner = candidates[selected_index]
     seed_entropy = secrets.token_hex(32)
     audit_hash = hashlib.sha256(f"{campaign_id}:{winner['entry_id']}:{seed_entropy}".encode()).hexdigest()
     ```
  5. Insert record into `winners` table.
  6. Return sanitized summary to client.
- **Response `200 OK`**:
```json
{
  "ok": true,
  "winnerName": "Anjali Nair",
  "entryCode": "ENT-9X4KM2",
  "drawnAt": "2026-10-11T20:35:00Z",
  "auditHash": "d8f3e1a90c2b..."
}
```

#### `GET /api/admin/entries`
- **Role**: All Staff
- **Query Params**: `q` (search name/phone), `eligible` (boolean filter)
- **Response `200 OK`**:
```json
[
  {
    "id": "18c21a4f-...",
    "entryCode": "ENT-9X4KM2",
    "parentName": "Anjali Nair",
    "phoneMasked": "98470*****",
    "whatsappPhone": "+919847012345",
    "ageRange": "8-10",
    "sourceCode": "MCH-SHOP-001",
    "isEligible": true,
    "marketingConsent": true,
    "submittedAt": "2026-10-11T20:30:15Z"
  }
]
```

#### `GET /api/admin/sources`
- **Role**: All Staff
- **Response `200 OK`**: Returns array of all 15 Kerala boutique locations with live scan, entry, and conversion counts.

#### `GET /api/admin/reports`
- **Role**: All Staff
- **Query Source**: Reads from `v_source_performance` view.
- **Response `200 OK`**:
```json
[
  {
    "locationName": "Mananchira Boutique Partner",
    "sourceCode": "MCH-SHOP-001",
    "visits": 120,
    "starts": 48,
    "entries": 36,
    "eligible": 36,
    "conversionRate": "30.0%"
  }
]
```

#### `GET /api/admin/export?type=source_performance`
- **Role**: `super_admin` only
- **Response `200 OK`**: `Content-Type: text/csv`, streaming CSV data with headers `Content-Disposition: attachment; filename="BINTH_Report_2026-10-11.csv"`.

---

## 5. Security Architecture & Threat Modeling

| Threat Vector | Mitigation Strategy |
|---|---|
| **Contest Ballot Stuffing (Botting)** | Sliding-window IP rate limiting (Redis/Memory: max 5 submissions / 10 min), unique `(campaign_id, customer_id)` PostgreSQL constraint, normalized WhatsApp phone verification. |
| **Source Spoofing** | Foreign key verification against `sources(code)`. If a non-existent source is submitted, entry is attributed to `DIRECT` without crashing. |
| **Privilege Escalation** | JWT role claim validation (`super_admin`, `campaign_manager`, `viewer`) on backend routes. Viewer role has HTTP `403 Forbidden` on all `POST`, `PUT`, `PATCH`, `DELETE` operations. |
| **Child Data Leaks** | Strict schema whitelist. Payloads containing unexpected keys like `child_name`, `dob`, `address` are stripped or rejected with `400 Bad Request`. |
| **Contest Tampering / Rigged Draws** | Browser `Math.random()` forbidden. All draws require authenticated session, CSPRNG entropy seed, cryptographic hash persistence in `winners`, and write to `audit_logs`. |

---

## 6. Implementation Reference Architecture (Recommended Node.js / Python Runtime)

When bootstrapping the microservice to run `database/schema.sql`:

1. **Database Connection Pool**:
   - Connection pool size: 10–20 connections (`pg` for Node.js, `asyncpg` or `psycopg3` for Python).
   - Set statement timeout: `SET statement_timeout = '5000'`.
2. **Environment Variables**:
   ```ini
   PORT=8000
   DATABASE_URL=postgresql://binth_admin:secure_password@localhost:5432/binth_db
   JWT_SECRET=super_secret_cryptographic_key_min_32_bytes
   CORS_ORIGIN=http://localhost:8080
   RATE_LIMIT_MAX_ENTRIES=5
   RATE_LIMIT_WINDOW_MS=600000
   ```
3. **Execution Verification**:
   Execute the migration against PostgreSQL:
   ```bash
   psql -U binth_admin -d binth_db -f database/schema.sql
   ```
