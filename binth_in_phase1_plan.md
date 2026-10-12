# BINTH.IN Phase 1 — Strict HTML, CSS & Vanilla JavaScript Implementation

## 1. Your Role

Act as a senior frontend architect, UI/UX designer, JavaScript engineer, accessibility specialist, and application security-conscious developer.

Build the frontend for BINTH.IN Phase 1: a customer acquisition and 48-hour QR giveaway management platform.

The project owner understands HTML, CSS, and JavaScript. Keep the implementation readable, maintainable, and easy to learn from.

## 2. Non-Negotiable Technology Restrictions

Use ONLY:

- HTML5
- CSS3
- Vanilla JavaScript (ES6+)

Do NOT use:

- React
- Next.js
- Vue
- Angular
- TypeScript
- jQuery
- Bootstrap
- Tailwind CSS
- Alpine.js
- PHP or Laravel
- Node.js
- Filament
- Frontend frameworks
- UI component libraries
- Build tools that require a compilation step
- Framework-dependent routing

Do not introduce dependencies merely to simplify basic UI tasks.

Use native browser features and semantic HTML.

The application must run as static frontend files through a local development server.

## 3. Existing Repository — Inspect Before Editing

The project has already undergone an initial implementation attempt. Inspect all existing files before making changes.

1. Identify the current project structure.
2. Identify existing HTML, CSS, JavaScript, API integrations, and configuration files.
3. Reuse useful existing work where appropriate.
4. Do not delete working code without explaining why.
5. Do not silently replace the entire repository.
6. Preserve useful business rules, terminology, and data structures from the existing project.
7. Provide a short implementation plan before substantial changes.

If the existing project contains Laravel-specific files, do not pretend those files can execute as a static frontend. Clearly separate frontend files from any legacy backend files and document the intended integration boundary.

## 4. Project Objective

BINTH.IN is a Kerala-based handmade girlswear brand targeting girls aged 5–16.

Brand tagline:

**Handmade with care. Made for little ones.**

The first business objective is to acquire local customers through physical QR-code giveaway campaigns.

The system must support a future customer database, campaign management, consent records, customer segmentation, reporting, and eventual e-commerce integration.

Phase 1 is NOT an e-commerce store.

## 5. Brand Identity and Design Direction

Use these official brand colours:

- Warm Cream: `#F7F1EA`
- Soft Ivory: `#FFFDF8`
- Dusty Rose: `#C7A3A3`
- Sage Green: `#A8B5A2`
- Muted Terracotta: `#B8795D`
- Deep Maroon: `#5A2D2D`

The visual experience should feel like a premium handmade boutique rooted in Kerala.

Design principles:

- Warm, thoughtful and authentic.
- Editorial rather than corporate.
- Minimal, spacious and elegant.
- Soft borders, restrained shadows and refined typography.
- Clear information hierarchy.
- Natural, calm visual language.
- Excellent mobile usability.

Avoid neon colours, excessive gradients, clutter, generic SaaS aesthetics, oversized dashboard cards, unnecessary animations and cheap e-commerce styling.

Use CSS custom properties for colours, spacing, typography, radii and shadows.

Use system fonts or suitable system font stacks. Do not make the experience dependent on externally hosted assets.

## 6. Required Project Structure

Create a simple static project:

```text
binth-phase1/
├── index.html
├── giveaway.html
├── success.html
├── admin/
│   ├── index.html
│   ├── campaigns.html
│   ├── entries.html
│   ├── customers.html
│   ├── sources.html
│   ├── reports.html
│   └── settings.html
├── assets/
│   ├── css/
│   │   ├── main.css
│   │   ├── components.css
│   │   ├── giveaway.css
│   │   └── admin.css
│   ├── js/
│   │   ├── app.js
│   │   ├── giveaway.js
│   │   ├── admin.js
│   │   ├── validation.js
│   │   └── api.js
│   └── images/
├── mock-data/
│   └── development-data.js
└── README.md
```

You may adjust this structure if there is a clear reason, but retain the strict HTML/CSS/JavaScript requirement.

Do not duplicate large blocks of markup unnecessarily.

## 7. Public Giveaway Experience

Build a mobile-first giveaway page for visitors arriving from physical QR posters.

Example campaign URL:

`/giveaway.html?source=MCH-SHOP-001`

In production, the backend should resolve the source code to its associated campaign. The frontend must not trust arbitrary campaign IDs supplied by the visitor.

### Page content

Hero heading:

**A Little Surprise for Her 🤍**

Supporting text:

“Tell us a little about what you look for when choosing clothes for her, and enter our BINTH.IN giveaway.”

Show:

- Campaign prize.
- Campaign description.
- Campaign status.
- Countdown when campaign timing is available from a trusted API.
- Clear entry button.
- Brief explanation of how the giveaway works.

### Giveaway steps

1. Answer a few simple questions.
2. Submit your details.
3. Wait for the campaign to close.
4. An eligible participant is selected randomly.

### Form fields

- Parent/guardian name.
- WhatsApp number.
- Girl's age range: 5–7, 8–10, 11–13, or 14–16.
- Clothing interests: everyday wear, kurtis, dresses, festive wear, casual outings.
- Optional marketing consent.
- Any campaign-specific questions returned by the backend.

Keep the form short and aim for completion within 90 seconds.

Do not collect a child's full name, date of birth, school, photographs or address.

### Consent

The giveaway entry and marketing consent must be separate.

Use a clearly labelled, unchecked optional checkbox:

“I'd like to receive BINTH.IN updates and future giveaway announcements on WhatsApp.”

Declining marketing consent must not prevent giveaway participation.

Record consent only through the backend. Do not treat a frontend checkbox or browser storage as authoritative proof of consent.

### Form behaviour

Implement:

- Client-side validation.
- Accessible field labels.
- Clear inline errors.
- Loading state during submission.
- Duplicate-entry feedback.
- Submission success state.
- Network-error handling.
- Keyboard accessibility.
- Mobile-friendly input controls.

Client-side validation improves usability but does not replace server-side validation.

## 8. Countdown and Campaign Timing

Implement the countdown in vanilla JavaScript.

Requirements:

- Read the campaign's start and end timestamps from trusted configuration or API data.
- Display the remaining time clearly.
- Update the countdown without reloading the page.
- Show an appropriate message for scheduled, active, closed and cancelled campaigns.
- Stop the countdown at zero.
- Never allow the browser countdown to determine eligibility.

The backend must enforce the actual 48-hour campaign window. If no trusted campaign timing is available, display a clear unavailable state rather than inventing a deadline.

## 9. Admin Dashboard

Build a complete frontend dashboard with a persistent sidebar on desktop and a usable navigation pattern on mobile.

Navigation:

- Overview
- Campaigns
- Entries
- Customers
- QR Sources
- Reports
- Settings

Dashboard metrics:

- Active campaigns.
- Total customers.
- Total campaign entries.
- Total QR visits.
- Form starts.
- Entry conversion rate.

Use responsive layouts and clear visual hierarchy.

Add campaign summaries containing:

- Campaign name.
- Status.
- Start time.
- End time.
- QR visits.
- Entries.
- Eligible entries.
- Conversion rate.

Metrics must come from an API in production. Development mock data must be clearly identified and must never be presented as live business data.

Do not hardcode changing statistics directly into page markup.

## 10. Campaign Management

Build the campaign listing and detail interfaces.

Include:

- Search and filtering.
- Campaign status indicators.
- Campaign creation form.
- Campaign editing form.
- Prize and description.
- Start and end dates.
- Associated QR sources.
- Entry totals.
- Campaign activity.

Display state-changing controls only when appropriate.

The frontend must request privileged actions from a protected backend. Hiding a button does not provide authorization.

Do not allow the browser alone to close a campaign or determine the official campaign status.

## 11. Entry Management

Create an entries page containing:

- Participant name.
- Masked WhatsApp number where appropriate.
- Age range.
- Clothing interests.
- Campaign.
- QR source.
- Submission time.
- Eligibility status.
- Marketing consent status.

Include search, filtering, sorting and pagination controls.

Provide an entry-detail view that presents the available information clearly.

Never expose participant information through public routes.

The viewer role must not be able to modify entries or perform privileged operations.

## 12. Customer Management

Create a customer directory and customer profile interface.

Include:

- Search by name or phone.
- Location filters.
- Age-range filters.
- Clothing-interest filters.
- Campaign history.
- QR source history.
- Consent history.
- Activity timeline.

A customer is the central identity. Giveaway participation is a customer activity, not a separate permanent customer identity.

The UI must distinguish between:

- A person who entered a giveaway.
- A person who consented to marketing.
- A person who eventually becomes a purchaser.

Do not infer marketing permission or purchase history from participation.

## 13. QR Source Management

Create a source-management page.

Each physical location should have its own source code, such as:

- `MCH-SHOP-001`
- `ALP-STORE-001`

Show:

- Source code.
- Source name.
- Location.
- Partner name.
- Campaign.
- QR destination URL.
- Visit count.
- Entry count.
- Conversion rate.

Provide an interface for generating or downloading a QR code only if a suitable QR-generation implementation is available and approved.

Do not invent QR performance data.

A recorded destination-page visit must be labelled as a QR visit or landing-page visit, not proof that a physical QR scan occurred.

## 14. Reports

Create a responsive source-performance report with:

- Source.
- Location.
- QR visits.
- Form starts.
- Entries.
- Conversion rate.

Use the formula:

`Conversion rate = entries / visits × 100`

Define how repeat visits are counted and ensure the backend and frontend use consistent definitions.

Provide date-range and campaign filters.

Include a CSV export interface, but actual customer-data exports must come from an authorized backend endpoint. Do not assume frontend-only access control is secure.

## 15. Winner Selection Interface

Build the administrative winner-selection interface.

Show:

- Campaign status.
- Total entries.
- Eligible entries.
- Previous selection history, if available.
- Winner-selection availability.
- Confirmation dialog.
- Selection result.
- Audit-history details.

The winner must be selected by a secure server-side operation from eligible entries only, after the campaign closes.

Do not select the production winner in browser JavaScript.

Do not use `Math.random()` for official winner selection.

If no backend exists, implement a clearly labelled demonstration mode using synthetic participants only. Never imply that a mock winner is official or fair.

Rerolls must require authorization, confirmation and a reason. Previous selections must remain preserved in the backend audit history.

## 16. Authentication and Roles

Support the UI states for:

- `super_admin`
- `campaign_manager`
- `viewer`

Intended permissions:

**Super admin:** full authorized access.

**Campaign manager:** campaign operations, source management, entry monitoring and winner selection according to backend permissions.

**Viewer:** read-only access.

Create appropriate login, logout and access-denied screens.

Do not implement fake authentication by simply checking a username or password in JavaScript.

Do not store privileged credentials or authoritative role assignments in localStorage.

Until a secure authentication backend is connected, show the admin interface only as a development demonstration and label it clearly.

## 17. Data and API Architecture

The frontend must remain independent of the backend implementation.

Use `assets/js/api.js` as the single location for API calls.

Create a small, documented API interface for operations such as:

- Fetch campaign.
- Fetch dashboard metrics.
- Submit giveaway entry.
- Fetch customers.
- Fetch entries.
- Fetch QR sources.
- Fetch reports.
- Close campaign.
- Select winner.
- Export authorized data.

Use relative API paths configurable from one location.

Handle HTTP errors, validation responses, loading states and unavailable services.

Do not fabricate successful server responses.

Do not silently fall back to mock data when production API requests fail.

Development mock mode must be explicitly enabled and visually labelled.

### Persistent data

Do not use localStorage, sessionStorage, JSON files or in-memory JavaScript arrays as the authoritative production customer database.

Browser storage may hold harmless UI preferences, but not sensitive participant records, privileged credentials or authoritative campaign states.

Document the backend requirements for PostgreSQL persistence, unique constraints, server-side validation, role-based authorization, rate limiting, consent records, secure winner selection and audit logging.

## 18. Accessibility and Responsive Design

Support:

- 320px mobile.
- 375px mobile.
- 390px mobile.
- 414px mobile.
- Tablet.
- Desktop.

Requirements:

- Semantic HTML.
- Visible keyboard focus.
- Accessible labels.
- Sufficient contrast.
- Proper heading hierarchy.
- Keyboard-operable navigation and dialogs.
- Reduced-motion support.
- Clear success and error messages.
- No horizontal overflow on small screens.

Use responsive CSS media queries. Avoid relying on JavaScript for layout.

## 19. Code Quality

Write understandable code.

Use:

- Semantic HTML.
- CSS custom properties.
- Small, focused JavaScript functions.
- ES modules where supported by the development setup.
- Event delegation where appropriate.
- Consistent naming.
- Basic comments for important business rules.
- Reusable UI components implemented with native HTML and JavaScript.

Avoid:

- One enormous JavaScript file.
- Inline event handlers throughout HTML.
- Repeated CSS overrides.
- Global variables unnecessarily.
- Excessive abstractions.
- Unexplained magic numbers.
- Fake buttons that do nothing.
- Console errors.

## 20. Development Workflow

Work in these stages:

**Stage 1:** Inspect existing files and report the plan.

**Stage 2:** Establish design tokens, navigation and responsive layout.

**Stage 3:** Build the public giveaway page and form interactions.

**Stage 4:** Build the admin dashboard and navigation.

**Stage 5:** Build campaigns, entries, customers and QR sources pages.

**Stage 6:** Build reports and winner-selection interfaces.

**Stage 7:** Implement the API integration layer and documented development mock mode.

**Stage 8:** Verify responsive behaviour, accessibility, navigation and error states.

After each stage, summarize the files changed, test the result and explain any remaining limitations.

## 21. Final Deliverables

Provide:

1. Complete HTML, CSS and JavaScript files.
2. A working responsive public giveaway interface.
3. A working navigable admin frontend.
4. Campaign, entry, customer and source interfaces.
5. Reporting and winner-selection interfaces.
6. A documented API integration boundary.
7. Clearly labelled synthetic development data, if needed.
8. README with setup and usage instructions.
9. A list of backend endpoints and security requirements.
10. A list of functionality that cannot operate securely without a backend.
11. A manual testing checklist.

## Final Acceptance Rule

The deliverable must be a real, usable **HTML + CSS + vanilla JavaScript frontend**, not a React application, framework-based prototype or screenshot.

Every visible control must work within the supported frontend scope. If a feature requires a backend, show a clear and honest unavailable or demonstration state rather than pretending it works.

Keep the code beginner-friendly and preserve BINTH.IN's warm, minimal, handmade brand identity.