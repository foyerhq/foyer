# Foyer — Build Document (v1)

> **Status:** Pre-development, infrastructure provisioned
> **Last updated:** May 11, 2026
> **Owner:** Ryan Malone (ryan@foyer.so)
> **Repo:** github.com/foyerhq/foyer

This document is the source of truth for building Foyer v1. It captures architectural decisions, technical specifications, account references, and the build plan. Read this first before writing any code. Update it as decisions evolve.

---

## Table of Contents

1. [What Foyer Is](#1-what-foyer-is)
2. [Strategic Positioning](#2-strategic-positioning)
3. [V1 Scope](#3-v1-scope)
4. [Architecture Overview](#4-architecture-overview)
5. [Tech Stack](#5-tech-stack)
6. [Account References](#6-account-references)
7. [Repository Structure](#7-repository-structure)
8. [The Flow Schema](#8-the-flow-schema)
9. [Database Schema](#9-database-schema)
10. [Variant Assignment Algorithm](#10-variant-assignment-algorithm)
11. [The Swift SDK](#11-the-swift-sdk)
12. [Backend API](#12-backend-api)
13. [Dashboard](#13-dashboard)
14. [Analytics](#14-analytics)
15. [RevenueCat Integration](#15-revenuecat-integration)
16. [Attribution & Targeting](#16-attribution--targeting)
17. [Brand & Design](#17-brand--design)
18. [Pricing Model](#18-pricing-model)
19. [Complexity Assessment](#19-complexity-assessment)
20. [Build Plan](#20-build-plan)
21. [First Commits](#21-first-commits)
22. [Open Questions](#22-open-questions)
23. [Startup Programs](#23-startup-programs)
24. [Glossary](#24-glossary)

---

## 1. What Foyer Is

Foyer is a server-side onboarding orchestration and A/B testing platform for mobile apps. It lets subscription app developers test their onboarding flows without shipping a new app build for every change.

### The Problem

Mobile app developers — especially indie founders and small teams shipping subscription apps — face a structural problem with onboarding optimization:

1. **Onboarding screens are hardcoded** in their Swift/Kotlin/React Native code
2. Changing the order of screens, adding a new step, or testing a variant requires shipping a new app build
3. App Store review adds 1-3 days minimum to every test cycle
4. Existing A/B testing tools (Firebase, Statsig, Amplitude) are general-purpose and require devs to build their own onboarding-specific abstractions on top
5. Most devs give up and ship one onboarding flow they never test

### The Solution

Foyer provides:

- **A Swift SDK** that wraps the developer's existing onboarding screens, making the flow remotely configurable
- **A dashboard** to configure flows, create variants, and allocate traffic
- **Server-side variant assignment** so changes propagate instantly without a new app build
- **Analytics** that show per-step drop-off and per-variant conversion
- **A fallback system** so the customer's onboarding never breaks if Foyer's API is unreachable

### The Pitch

> "Test your mobile onboarding without shipping a new build."

That single sentence captures the value. Every other detail of the product flows from this promise.

---

## 2. Strategic Positioning

### Target Customer (V1 ICP)

**Subscription app developers with an existing hardcoded onboarding flow** who:
- Ship to iOS App Store
- Use RevenueCat or similar for paywalls
- Have shipped v1 of their app and are now trying to optimize conversion
- Don't currently A/B test their onboarding (or do so poorly via Firebase Remote Config)
- Have $10k-$500k MRR range — past survival but not enterprise scale

**Not targeted in v1:** Pre-launch indies building their first app (they need a template builder, which is v2), large enterprises with custom infrastructure, non-subscription apps.

### Competitive Landscape

**Foyer's real competition is inertia.** Most target customers aren't using *any* A/B testing tool for onboarding — they're shipping one flow and living with it. The pitch isn't "switch from Statsig to Foyer," it's "you're not testing because it's too much work. We make it easy."

**Adjacent competitors and how Foyer differs:**

| Competitor | What they do | Why Foyer wins for onboarding |
|------------|--------------|-------------------------------|
| Firebase A/B Testing | Remote Config + basic testing | Requires customer to rebuild screens as config-driven; analytics are shallow |
| Statsig | Modern feature flags + A/B testing | General-purpose; customer builds their own onboarding orchestration on top |
| Amplitude Experiment | Experimentation + analytics | Enterprise pricing; complex setup; not onboarding-specialized |
| Optimizely / AB Tasty | Enterprise experimentation | Expensive, complex, not designed for indie/SMB |
| RevenueCat | Paywall infrastructure | Adjacent — covers the paywall, not onboarding (Foyer hands off to RevenueCat) |
| Superwall | Paywall optimization | Same as RevenueCat — adjacent, not competitive |

**Foyer is the "RevenueCat for onboarding"** — specialized for one specific surface, complete with templates (v2) and testing infrastructure (v1).

### V1 Wedge

The acquisition pitch:

> "Drop in our Swift SDK. Register your existing onboarding screens. Now every change to the flow — reordering steps, adding steps, removing steps, A/B testing — happens in our dashboard. No new app builds. No App Store review."

This sells itself to anyone who's ever sat through a 48-hour App Store review wait for a one-line onboarding copy change.

### Future Roadmap

- **v1 (this doc):** Import-and-test for existing flows. Swift only.
- **v1.5 (Q3-Q4 2026):** React Native SDK. Same backend, same dashboard, same schema.
- **v2 (2027):** Template library — pre-built screen types so new apps can build onboarding from scratch in Foyer. Native Android (Kotlin/Compose).
- **v2.5+:** Conditional flow logic, multi-step variant configuration, AI-generated variant suggestions.

---

## 3. V1 Scope

### In Scope

- Swift SDK (iOS only) distributed via Swift Package Manager
- Screen registration API — customer registers their existing SwiftUI views with Foyer
- Server-side flow configuration with linear (non-conditional) step sequences
- Variants — multiple complete versions of a flow with traffic allocation
- Sticky variant assignment per user (hash-based, deterministic)
- Per-step drop-off analytics
- Variant comparison analytics
- Fallback to cached or default flow if API is unreachable
- Attribution-agnostic targeting API (customer passes their own attribution data)
- RevenueCat handoff via subscriber attribute
- Dashboard with flow editor (ordering registered screens), variant management, analytics
- Free tier (1 flow, no variants, analytics) and paid tier (variants + targeting)

### Explicitly Out of Scope for V1

- **No template library.** Customers bring their own screens.
- **No content editing in the dashboard.** No WYSIWYG editor, no "edit this slide" UI.
- **No conditional flow logic within a single flow.** Branching is handled by customer chaining multiple flows in code.
- **No React Native SDK** (v1.5)
- **No Android SDK** (v2)
- **No template-based screen rendering.** The SDK never renders content — it tells the customer's app which screen to show next.
- **No data storage on behalf of customers.** Customers save user data to their own backends. Foyer logs answers as analytics metadata only.
- **No conditional logic builders, no expression evaluators, no rule engines.**
- **No revenue-share pricing.** Flat tiers based on usage.
- **No multi-step variant content overrides.** A variant is an ordered list of step keys; if you want different content for a step in variant B, register a new screen with a different key.

### Why the Tight Scope

- **Faster time to first customer.** 6-8 weeks vs 3-4 months.
- **Less design risk.** No template library means no high-effort visual design work that might not land.
- **Sharper positioning.** "Test without shipping" is clearer than "build and test onboarding."
- **Real customer pain.** Existing apps have active pain from App Store review cycles. Pre-launch apps have hypothetical pain about future testing.

---

## 4. Architecture Overview

### System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     Customer's iOS App                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Foyer SDK (Swift Package)                          │    │
│  │  - Screen registry                                  │    │
│  │  - Flow controller                                  │    │
│  │  - Event logger                                     │    │
│  │  - Variant assignment cache                         │    │
│  │  - Fallback handler                                 │    │
│  └─────────────────────────────────────────────────────┘    │
│         │                                    ▲                │
│         │ HTTPS                              │                │
└─────────┼────────────────────────────────────┼────────────────┘
          │                                    │
          ▼                                    │
┌──────────────────────────────────────────────┴───────────────┐
│                  Foyer Backend (Vercel)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Next.js App Router                                  │   │
│  │  - API routes (/api/v1/*)                            │   │
│  │  - Dashboard (server components)                     │   │
│  │  - Marketing pages                                   │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                     │
└─────────┼─────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────┐
│                    Supabase (Postgres)                       │
│  - projects                                                  │
│  - flows                                                     │
│  - variants                                                  │
│  - flow_assignments                                          │
│  - events                                                    │
│  - users (via Supabase Auth)                                 │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

**Customer's user opens app for the first time:**

1. App initializes Foyer SDK: `Foyer.configure(apiKey: "...")`
2. SDK generates anonymous user ID, stores in UserDefaults
3. App registers screens: `Foyer.register("welcome") { WelcomeView() }` etc.
4. App calls `Foyer.start(flowId: "main_onboarding")`
5. SDK calls backend: `GET /api/v1/flows/main_onboarding?userId=anon_xyz&apiKey=...`
6. Backend checks `flow_assignments` table for this user — none exists
7. Backend runs variant assignment algorithm (hash-based, sticky)
8. Backend writes assignment to `flow_assignments`
9. Backend returns resolved flow JSON: `{ variantId: "v_a", steps: ["welcome", "goal_select", ...] }`
10. SDK caches the response locally (for fallback)
11. SDK renders first screen: looks up "welcome" in registry, instantiates `WelcomeView`, displays it
12. User taps Continue → SDK fires `step_completed` event (async POST to backend)
13. SDK renders next step
14. Loop until last step
15. SDK calls completion handler with collected answers and variant ID
16. Customer's code shows RevenueCat paywall with variant ID as subscriber attribute

**Subsequent app opens (same user):**

1. SDK calls backend, backend returns cached assignment → same variant
2. (Or: if SDK has cached response and it's fresh, skip backend call entirely)

**Backend down / no network:**

1. SDK times out backend call after 2 seconds
2. SDK loads cached flow from previous successful fetch
3. If no cached flow exists, SDK loads developer-specified fallback flow from app config
4. Onboarding proceeds normally with cached/fallback flow
5. Events queue locally and sync when network returns

---

## 5. Tech Stack

### SDK
- **Language:** Swift 5.9+
- **UI framework:** SwiftUI (customer's screens are SwiftUI views, the SDK is SwiftUI-aware)
- **Distribution:** Swift Package Manager
- **Minimum iOS:** 15.0 (matches RevenueCat's minimum)
- **Repo location:** `packages/sdk-swift/` (subdirectory of main monorepo for development) OR separate repo `github.com/foyerhq/foyer-swift` (decide before first SDK release; see Open Questions)

### Backend & Dashboard
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript 5.x (strict mode)
- **Runtime:** Node.js on Vercel serverless
- **Hosting:** Vercel (Hobby tier for now, Pro when needed)
- **Domain:** foyer.so

### Database
- **Provider:** Supabase
- **Engine:** Postgres 15
- **ORM:** Drizzle (TypeScript-native, lightweight, modern)
- **Migrations:** Drizzle Kit
- **Region:** us-west-2 (West US Oregon)

### Auth
- **Provider:** Supabase Auth
- **Methods:** Email + Google OAuth + GitHub OAuth
- **Session management:** Supabase SSR helpers in Next.js

### UI Layer (Dashboard)
- **Components:** shadcn/ui (copied into project, not a runtime dep)
- **Styling:** Tailwind CSS
- **Forms:** React Hook Form + Zod resolvers
- **Charts:** Recharts (per-step drop-off, variant comparison)
- **Drag-and-drop:** dnd-kit (for flow editor)
- **Icons:** Lucide React

### Shared Code
- **Schema definitions:** Zod (single source of truth, shared between SDK contract, backend validation, and dashboard forms)
- **Type generation:** TypeScript inference from Zod

### Validation & Quality
- **Linting:** Biome (faster than ESLint, single tool for lint+format)
- **Type checking:** TypeScript strict mode
- **Testing:** Vitest for unit tests, Playwright for dashboard E2E

### Monorepo
- **Tool:** Turborepo
- **Package manager:** pnpm workspaces
- **Structure:** apps/dashboard, packages/shared, packages/sdk-swift

### CI/CD
- **GitHub Actions:** lint, type-check, test on every PR
- **Vercel:** auto-deploy on push to main
- **Swift Package:** versioned via Git tags

### Observability
- **Error tracking:** Sentry (dashboard + SDK)
- **Analytics for Foyer itself:** PostHog (separate from customer analytics)
- **Logs:** Vercel native + Supabase native

---

## 6. Account References

All credentials live in 1Password (or your password manager of choice). Never commit secrets to git. Use `.env.example` to document required env vars without values.

### Production Accounts

| Service | Account / Identifier | Plan | Purpose |
|---------|---------------------|------|---------|
| Domain | foyer.so (Namecheap) | $64.98/yr | Primary domain |
| Email | ryan@foyer.so (Google Workspace) | $6/mo | Company email |
| GitHub | github.com/foyerhq | Free | Code hosting |
| Vercel | personal account (ryanmalone1041) | Hobby | Hosting |
| Supabase | foyer-prod | Free | Database + auth |
| Anthropic | personal | Pay-as-you-go ($20/mo cap) | API access for future AI features |
| npm | @foyerhq | Free | Reserved for future React Native SDK |
| Apple Developer | (existing) | $99/yr | iOS app signing |

### Environment Variables

Required env vars for the dashboard / backend (`apps/dashboard/.env.local`):

```bash
# === App URL ===
NEXT_PUBLIC_APP_URL=https://foyer.so

# === Supabase ===
NEXT_PUBLIC_SUPABASE_URL=https://bspbvvmcduvqvfmpqyiw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # SECRET — server-only
DATABASE_URL=postgresql://postgres.bspbvvmcduvqvfmpqyiw:[password]@aws-0-us-west-2.pooler.supabase.com:6543/postgres

# === Anthropic (future AI features) ===
ANTHROPIC_API_KEY=sk-ant-api03-...  # SECRET

# === Sentry (when added) ===
SENTRY_DSN=https://...

# === Internal API secret (for SDK -> backend auth) ===
FOYER_API_SECRET=...  # generated; rotate periodically
```

`.env.local` is gitignored. Use `.env.example` with placeholder values for documentation.

### Brand Assets

Logo files live in `apps/dashboard/public/` and a copy in `packages/shared/assets/`:
- `foyer-favicon.svg` — 64×64 favicon
- `foyer-icon.svg` — 80×100 icon-only
- `foyer-logo.svg` — full lockup
- `FoyerLogo.tsx` — React component in `apps/dashboard/components/`

### Outstanding Setup

- [ ] Sentry account (defer until first deployment)
- [ ] PostHog account (defer until first 10 customers)
- [ ] Apply to Anthropic Startup Program (defer until production)
- [ ] Open Graph image (1200×630) for social previews

---

## 7. Repository Structure

```
foyer/                              # github.com/foyerhq/foyer
├── apps/
│   └── dashboard/                  # Next.js app: dashboard + API + marketing
│       ├── app/                    # App Router pages
│       │   ├── (marketing)/        # Public pages
│       │   ├── (app)/              # Authenticated dashboard
│       │   ├── api/                # API routes
│       │   │   ├── v1/             # SDK-facing API (versioned)
│       │   │   │   ├── flows/
│       │   │   │   └── events/
│       │   │   └── internal/       # Dashboard-only API
│       │   └── layout.tsx
│       ├── components/             # React components
│       │   ├── ui/                 # shadcn components
│       │   ├── flow-editor/        # Flow editing UI
│       │   └── FoyerLogo.tsx
│       ├── lib/
│       │   ├── db/                 # Drizzle setup + queries
│       │   ├── supabase/           # Supabase client
│       │   ├── variant-assignment.ts
│       │   └── auth.ts
│       ├── public/                 # Static assets including logos
│       ├── drizzle/                # Migration files
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared/                     # Cross-package shared code
│   │   ├── src/
│   │   │   ├── schema/             # Zod schemas (the source of truth)
│   │   │   │   ├── flow.ts
│   │   │   │   ├── variant.ts
│   │   │   │   ├── step.ts
│   │   │   │   └── event.ts
│   │   │   ├── types/              # TS types inferred from schemas
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── sdk-swift/                  # Swift Package (developed here, distributed via SPM)
│       ├── Sources/
│       │   └── Foyer/
│       │       ├── Foyer.swift     # Public API surface
│       │       ├── FlowController.swift
│       │       ├── ScreenRegistry.swift
│       │       ├── VariantCache.swift
│       │       ├── EventLogger.swift
│       │       ├── NetworkClient.swift
│       │       └── Models/
│       ├── Tests/
│       │   └── FoyerTests/
│       ├── Package.swift
│       └── README.md
│
├── docs/                           # Documentation
│   ├── BUILD.md                    # This file
│   ├── SDK_API.md                  # Swift SDK reference
│   ├── SCHEMA.md                   # Flow schema reference
│   └── CONTRIBUTING.md
│
├── .github/
│   └── workflows/                  # CI/CD
│       ├── ci.yml
│       └── release-sdk.yml
│
├── .gitignore
├── .env.example
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

### Decision: Monorepo or Separate Swift Repo?

Two options for the Swift SDK:

**A) Stays in monorepo at `packages/sdk-swift/`** — easier development, shared CI, single source of truth
**B) Lives in separate repo `github.com/foyerhq/foyer-swift`** — cleaner Swift Package Manager distribution, separate versioning

**V1 decision:** Develop in monorepo for speed. Move to separate repo before first public release if SPM consumption is awkward. (See Open Questions.)

---

## 8. The Flow Schema

The flow schema is the central artifact of the entire system. Everything — SDK, dashboard, backend, analytics — hangs off this schema. Get this right first.

### Design Principles

1. **Platform-agnostic.** No Swift-specific or RN-specific concepts. The schema describes "what to do" not "how to render."
2. **Stable IDs.** Every entity (flow, variant, step reference) has a server-assigned ID that never changes. Analytics depend on this.
3. **Schema versioning from day one.** Top-level `schemaVersion` field. Old SDKs gracefully refuse incompatible versions.
4. **Variants are first-class.** A flow has 1+ variants; variants split traffic by weight.
5. **No content in the schema.** The schema references *registered screen keys*, not screen content. Customers own their screen content in their app code.
6. **Forward compatibility via optional fields.** Add new optional properties; don't remove or change required ones without a version bump.

### Mental Model

```
Project (customer account)
└── Flow ("main_onboarding")
    ├── Variant "original" (weight: 50)
    │   └── Steps: [welcome, gender, goal, social_proof, trial]
    └── Variant "social_first" (weight: 50)
        └── Steps: [welcome, social_proof, gender, goal, trial]
```

A flow has one or more variants. Each variant is a complete ordered list of step references. Variants' weights must sum to exactly 100.

### Zod Schema (TypeScript)

This is the source of truth. Lives at `packages/shared/src/schema/flow.ts`. Import from anywhere in the monorepo.

```typescript
import { z } from "zod";

// ============================================================
// PRIMITIVES
// ============================================================

const IdSchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/);

const SchemaVersionSchema = z.literal("1.0");

// ============================================================
// STEP
// ============================================================

/**
 * A step in a variant. Just a reference to a registered screen key.
 * No content, no config — the customer's app owns rendering.
 */
const StepSchema = z.object({
  id: IdSchema,                    // unique within the variant
  screenKey: z.string().min(1),    // the key the customer registered with Foyer.register()
  name: z.string().optional(),     // human-readable for dashboard
});

// ============================================================
// TARGETING RULES
// ============================================================

/**
 * Attribution-based targeting. Customer passes their own attribution data via
 * Foyer.setAttribution([...]) and variants can be targeted to match.
 */
const AttributionRuleSchema = z.object({
  field: z.string(),               // e.g. "source", "campaign"
  op: z.enum(["eq", "neq", "in", "nin"]),
  value: z.union([
    z.string(),
    z.array(z.string()),
  ]),
});

const TargetingSchema = z.object({
  rules: z.array(AttributionRuleSchema).default([]),
  // All rules must match (AND logic). OR logic deferred to v2.
});

// ============================================================
// VARIANT
// ============================================================

const VariantSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(100),
  weight: z.number().int().min(0).max(100),
  steps: z.array(StepSchema).min(1).max(50),
  targeting: TargetingSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ============================================================
// FLOW
// ============================================================

export const FlowSchema = z.object({
  schemaVersion: SchemaVersionSchema,
  id: IdSchema,
  projectId: IdSchema,
  name: z.string().min(1).max(100),
  status: z.enum(["draft", "live", "archived"]),
  variants: z.array(VariantSchema).min(1).max(20).refine(
    (variants) => variants.reduce((sum, v) => sum + v.weight, 0) === 100,
    "Variant weights must sum to exactly 100"
  ),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Flow = z.infer<typeof FlowSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type Step = z.infer<typeof StepSchema>;
export type AttributionRule = z.infer<typeof AttributionRuleSchema>;

// ============================================================
// RESOLVED FLOW (what the SDK receives)
// ============================================================

/**
 * After variant assignment, the SDK receives this — a single resolved variant
 * with metadata, not the full flow definition. Smaller payload, simpler client.
 */
export const ResolvedFlowSchema = z.object({
  schemaVersion: SchemaVersionSchema,
  flowId: IdSchema,
  variantId: IdSchema,
  variantName: z.string(),
  steps: z.array(StepSchema),
});

export type ResolvedFlow = z.infer<typeof ResolvedFlowSchema>;
```

### Example Flow (JSON)

```json
{
  "schemaVersion": "1.0",
  "id": "flow_main_onboarding",
  "projectId": "proj_acme_fitness",
  "name": "Main Onboarding",
  "status": "live",
  "variants": [
    {
      "id": "v_original",
      "name": "Original (control)",
      "weight": 50,
      "steps": [
        { "id": "s1", "screenKey": "welcome" },
        { "id": "s2", "screenKey": "gender_select" },
        { "id": "s3", "screenKey": "goal_select" },
        { "id": "s4", "screenKey": "social_proof" },
        { "id": "s5", "screenKey": "trial_pitch" }
      ],
      "createdAt": "2026-05-01T10:00:00Z",
      "updatedAt": "2026-05-01T10:00:00Z"
    },
    {
      "id": "v_social_first",
      "name": "Social proof first",
      "weight": 50,
      "steps": [
        { "id": "s1", "screenKey": "welcome" },
        { "id": "s2", "screenKey": "social_proof" },
        { "id": "s3", "screenKey": "gender_select" },
        { "id": "s4", "screenKey": "goal_select" },
        { "id": "s5", "screenKey": "trial_pitch" }
      ],
      "createdAt": "2026-05-05T14:00:00Z",
      "updatedAt": "2026-05-05T14:00:00Z"
    }
  ],
  "createdAt": "2026-05-01T10:00:00Z",
  "updatedAt": "2026-05-05T14:00:00Z"
}
```

### Swift Mirror Types

The Swift SDK uses `Codable` structs that mirror this schema. Lives at `packages/sdk-swift/Sources/Foyer/Models/Flow.swift`:

```swift
public struct ResolvedFlow: Codable {
    public let schemaVersion: String
    public let flowId: String
    public let variantId: String
    public let variantName: String
    public let steps: [FlowStep]
}

public struct FlowStep: Codable {
    public let id: String
    public let screenKey: String
    public let name: String?
}
```

**Note:** Swift types must be kept manually in sync with the Zod schema. Add a CI check that fails if they drift. (See Open Questions.)

---

## 9. Database Schema

Postgres tables in Supabase. Managed via Drizzle Kit migrations.

```sql
-- ============================================================
-- PROJECTS (customer accounts / apps)
-- ============================================================
CREATE TABLE projects (
  id TEXT PRIMARY KEY,                    -- e.g. "proj_abc123"
  name TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,           -- SDK uses this to authenticate
  api_key_hash TEXT NOT NULL,             -- for fast lookup; store hashed key
  owner_user_id UUID NOT NULL REFERENCES auth.users(id),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'growth')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_api_key_hash ON projects(api_key_hash);
CREATE INDEX idx_projects_owner ON projects(owner_user_id);

-- ============================================================
-- FLOWS
-- ============================================================
CREATE TABLE flows (
  id TEXT PRIMARY KEY,                    -- e.g. "flow_abc123"
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'archived')),
  schema_version TEXT NOT NULL DEFAULT '1.0',
  flow_data JSONB NOT NULL,               -- full Flow JSON (variants, steps, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_flows_project ON flows(project_id);
CREATE INDEX idx_flows_status ON flows(status);

-- ============================================================
-- FLOW ASSIGNMENTS (sticky variant assignment per user)
-- ============================================================
CREATE TABLE flow_assignments (
  user_id TEXT NOT NULL,                  -- anonymous UUID or customer's real user ID
  flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL,
  attribution JSONB,                      -- snapshot of attribution data at assignment time
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, flow_id)
);

CREATE INDEX idx_assignments_flow ON flow_assignments(flow_id);
CREATE INDEX idx_assignments_variant ON flow_assignments(variant_id);

-- ============================================================
-- USER IDENTITY MAPPING (for upgrading anonymous to real IDs)
-- ============================================================
CREATE TABLE user_identities (
  anonymous_id TEXT PRIMARY KEY,
  real_user_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  identified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_identities_real ON user_identities(real_user_id);
CREATE INDEX idx_identities_project ON user_identities(project_id);

-- ============================================================
-- EVENTS (analytics)
-- ============================================================
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  flow_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  step_id TEXT,                           -- null for flow-level events
  step_index INTEGER,                     -- 0-based position in variant
  event_type TEXT NOT NULL CHECK (event_type IN (
    'flow_started',
    'step_viewed',
    'step_completed',
    'step_skipped',
    'flow_completed',
    'flow_abandoned',
    'fallback_used'
  )),
  answers JSONB,                          -- key-value pairs of user's answers
  attribution JSONB,                      -- attribution data at event time
  client_timestamp TIMESTAMPTZ NOT NULL,  -- timestamp from device
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB                          -- catch-all for extra context
);

CREATE INDEX idx_events_project_time ON events(project_id, server_timestamp DESC);
CREATE INDEX idx_events_flow_variant ON events(flow_id, variant_id, event_type);
CREATE INDEX idx_events_user ON events(user_id, flow_id);
CREATE INDEX idx_events_step ON events(flow_id, variant_id, step_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Owners can read/write their own projects
CREATE POLICY "Users can read their own projects" ON projects
  FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE USING (owner_user_id = auth.uid());

-- Flows: accessible only via parent project ownership
CREATE POLICY "Users can read flows in their projects" ON flows
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE owner_user_id = auth.uid())
  );
CREATE POLICY "Users can write flows in their projects" ON flows
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE owner_user_id = auth.uid())
  );

-- Events: read-only via project ownership
CREATE POLICY "Users can read events for their projects" ON events
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE owner_user_id = auth.uid())
  );

-- SDK access uses service_role bypass — no RLS for backend operations
```

### Indexing Strategy

The analytics queries are the most performance-sensitive. Indexes are designed for:
- "Show drop-off for flow X" → `idx_events_flow_variant`
- "Compare variant A vs B" → same index, filter by variant_id
- "Show user's journey through a flow" → `idx_events_user`
- "Last 24 hours of events for project" → `idx_events_project_time`

For v1, Postgres handles this fine. When event volume exceeds ~10M rows, evaluate moving events to ClickHouse or Tinybird (see Complexity Assessment).

---

## 10. Variant Assignment Algorithm

### Goals

1. **Sticky per user.** Same user → same variant, forever, regardless of weight changes
2. **Deterministic.** No coin flips at runtime; pure function of inputs
3. **Even distribution.** Across many users, actual traffic matches configured weights
4. **Targeting-aware.** Users matching attribution rules get eligible variants only
5. **Fast.** Sub-10ms for the assignment logic; database write is the slow part

### Pseudocode

```typescript
async function assignVariant(
  userId: string,
  flow: Flow,
  attribution: AttributionData | null,
): Promise<{ variantId: string; variant: Variant }> {
  // 1. Check for existing sticky assignment
  const existing = await db.flowAssignments.findFirst({
    where: { userId, flowId: flow.id },
  });
  if (existing) {
    const variant = flow.variants.find(v => v.id === existing.variantId);
    if (variant) return { variantId: existing.variantId, variant };
    // Variant was deleted; fall through to re-assign
  }

  // 2. Filter variants by targeting rules
  const eligibleVariants = flow.variants.filter(v => {
    if (!v.targeting?.rules?.length) return true;
    return v.targeting.rules.every(rule =>
      evaluateRule(rule, attribution)
    );
  });

  if (eligibleVariants.length === 0) {
    throw new Error("No eligible variants for user");
  }

  // 3. Compute deterministic hash from (userId, flowId)
  const hash = sha256Hash(`${userId}:${flow.id}`);
  const bucket = (hashToUInt32(hash) / 0xFFFFFFFF) * 100; // 0-100

  // 4. Walk variants in order, accumulating weight
  let cumulative = 0;
  let chosenVariant: Variant | null = null;
  for (const variant of eligibleVariants) {
    cumulative += variant.weight;
    if (bucket < cumulative) {
      chosenVariant = variant;
      break;
    }
  }

  // Edge case: if eligible variants don't sum to 100 (because some were filtered),
  // pick the last eligible variant as a safety net.
  if (!chosenVariant) {
    chosenVariant = eligibleVariants[eligibleVariants.length - 1];
  }

  // 5. Persist assignment
  await db.flowAssignments.create({
    userId,
    flowId: flow.id,
    variantId: chosenVariant.id,
    attribution: attribution ?? null,
  });

  return { variantId: chosenVariant.id, variant: chosenVariant };
}

function evaluateRule(rule: AttributionRule, attribution: AttributionData | null): boolean {
  if (!attribution) return false;
  const value = attribution[rule.field];
  if (value === undefined) return false;

  switch (rule.op) {
    case "eq": return value === rule.value;
    case "neq": return value !== rule.value;
    case "in": return Array.isArray(rule.value) && rule.value.includes(value);
    case "nin": return Array.isArray(rule.value) && !rule.value.includes(value);
  }
}
```

### Identity Upgrades

When a user is anonymous during onboarding and later signs up:

```typescript
async function identify(anonymousId: string, realUserId: string, projectId: string) {
  // 1. Record the identity mapping
  await db.userIdentities.upsert({
    anonymousId,
    realUserId,
    projectId,
  });

  // 2. Migrate existing assignments to the real ID
  // (so future lookups by realUserId find the same variant)
  await db.flowAssignments.updateMany({
    where: { userId: anonymousId },
    set: { userId: realUserId },
  });

  // 3. Future events use realUserId
}
```

### Weight Validation

Enforced at schema level: variant weights must sum to exactly 100. The dashboard validates before saving; the backend validates on every flow read; the SDK is defensive (uses last variant as fallback if math is off).

---

## 11. The Swift SDK

### Public API Surface

This is what customers write in their Swift code. Keep it minimal — every method here is a commitment to backward compatibility forever.

```swift
import SwiftUI

// MARK: - Configuration

extension Foyer {
    /// Configure the SDK. Call once at app launch.
    public static func configure(
        apiKey: String,
        environment: Environment = .production,
        fallbackFlow: LocalFlow? = nil
    )
}

public enum Environment {
    case production
    case staging
    case custom(baseURL: URL)
}

// MARK: - Screen Registration

extension Foyer {
    /// Register a screen view by key. The key is referenced in the dashboard flow config.
    ///
    /// Closure-based registration allows full SwiftUI flexibility:
    /// the customer's screen can capture data, call APIs, do whatever it needs.
    public static func register(
        _ screenKey: String,
        view: @escaping (FoyerStepContext) -> AnyView
    )
}

// MARK: - Step Context (passed to registered screens)

public struct FoyerStepContext {
    /// All answers collected in this flow so far
    public let priorAnswers: [String: Any]

    /// Current flow ID
    public let flowId: String

    /// Current variant ID (so customer can log to their own analytics)
    public let variantId: String

    /// Call this when the step is complete to advance the flow
    public let onComplete: (StepResult) -> Void

    /// Call this to abandon the flow entirely
    public let onAbandon: () -> Void
}

public struct StepResult {
    /// Answers captured in this step. Logged to Foyer for analytics.
    public let answers: [String: Any]

    public init(answers: [String: Any] = [:]) {
        self.answers = answers
    }
}

// MARK: - Flow Start

extension Foyer {
    /// Start a flow. Returns a SwiftUI view that orchestrates the registered screens.
    public static func flow(
        _ flowId: String,
        onComplete: @escaping (FlowResult) -> Void,
        onAbandon: (() -> Void)? = nil
    ) -> some View
}

public struct FlowResult {
    public let flowId: String
    public let variantId: String
    public let answers: [String: Any]
    public let completedAt: Date
}

// MARK: - User Identity

extension Foyer {
    /// Upgrade the anonymous user ID to a real user ID after signup.
    public static func identify(userId: String)

    /// Reset the user identity (e.g., on logout).
    public static func reset()
}

// MARK: - Attribution

extension Foyer {
    /// Set attribution data for the current user. Used for variant targeting.
    /// Call this once attribution data is available (e.g., after AppsFlyer callback).
    public static func setAttribution(_ attribution: [String: String])
}

// MARK: - Helpers (separate package or subspec)

/// AppsFlyer integration helper. Imports AppsFlyer SDK.
extension Foyer {
    public static func attachAppsFlyer() {
        // Listens for AppsFlyer conversion data, calls setAttribution automatically
    }
}
```

### Usage Example (Customer's App)

```swift
import SwiftUI
import Foyer
import RevenueCat

@main
struct AcmeFitnessApp: App {
    @State private var onboardingComplete = UserDefaults.standard.bool(forKey: "onboardingComplete")

    init() {
        // 1. Configure Foyer
        Foyer.configure(
            apiKey: "fyr_live_abc123",
            fallbackFlow: LocalFlow.acmeOriginal
        )

        // 2. Register all onboarding screens
        Foyer.register("welcome") { context in
            AnyView(WelcomeView(context: context))
        }
        Foyer.register("gender_select") { context in
            AnyView(GenderSelectView(context: context))
        }
        Foyer.register("goal_select") { context in
            AnyView(GoalSelectView(context: context))
        }
        Foyer.register("social_proof") { context in
            AnyView(SocialProofView(context: context))
        }
        Foyer.register("trial_pitch") { context in
            AnyView(TrialPitchView(context: context))
        }

        // 3. Configure RevenueCat
        Purchases.configure(withAPIKey: "appl_xxx")
    }

    var body: some Scene {
        WindowGroup {
            if onboardingComplete {
                MainAppView()
            } else {
                Foyer.flow("main_onboarding") { result in
                    // Onboarding finished — pass variant to RevenueCat for attribution
                    Purchases.shared.setAttributes([
                        "foyer_variant": result.variantId,
                        "foyer_flow": result.flowId,
                    ])

                    UserDefaults.standard.set(true, forKey: "onboardingComplete")
                    onboardingComplete = true

                    // The customer's app can show RevenueCat paywall here
                    // or transition to main app — their choice
                }
            }
        }
    }
}

// Customer's screen example
struct WelcomeView: View {
    let context: FoyerStepContext
    @State private var name = ""

    var body: some View {
        VStack(spacing: 20) {
            Text("Welcome to Acme Fitness")
                .font(.largeTitle)

            TextField("Your name", text: $name)
                .textFieldStyle(.roundedBorder)

            Button("Continue") {
                // Save to customer's own backend
                Task {
                    await SupabaseClient.shared.saveName(name)
                }

                // Tell Foyer this step is done
                context.onComplete(StepResult(answers: ["name": name]))
            }
            .disabled(name.isEmpty)
        }
        .padding()
    }
}
```

### Internal Architecture

```
Foyer (public API)
  ├── FoyerCore (singleton state)
  │   ├── Configuration
  │   ├── ScreenRegistry      // [screenKey: () -> AnyView]
  │   ├── VariantCache        // last successful flow fetch per flowId
  │   ├── UserIdentity        // anonymous UUID + optional real ID
  │   └── AttributionStore    // current attribution data
  ├── FlowController (per active flow)
  │   ├── Loads resolved flow from API (or cache, or fallback)
  │   ├── Tracks current step index
  │   ├── Renders current step's registered view
  │   └── Fires events on step transitions
  ├── NetworkClient
  │   ├── GET /api/v1/flows/{id}
  │   ├── POST /api/v1/events (batched, async)
  │   └── POST /api/v1/identify
  └── EventLogger
      ├── Local queue (persists across app restarts)
      ├── Batched upload
      └── Retry with exponential backoff
```

### Fallback Behavior

Critical for trust. The customer's onboarding must NEVER break because of Foyer.

```swift
func loadFlow(_ flowId: String) async -> ResolvedFlow {
    do {
        // Try network with 2s timeout
        let flow = try await withTimeout(2.0) {
            try await networkClient.fetchFlow(flowId)
        }
        await variantCache.store(flow)
        return flow
    } catch {
        // Network failed; try cache
        if let cached = await variantCache.load(flowId) {
            logEvent(.fallbackUsed, reason: "cache")
            return cached
        }
        // No cache; use developer-specified fallback
        if let fallback = configuration.fallbackFlow {
            logEvent(.fallbackUsed, reason: "local")
            return fallback.toResolvedFlow(flowId: flowId)
        }
        // Last resort: no onboarding (customer's responsibility to handle this)
        fatalError("No flow available and no fallback configured")
    }
}
```

### Event Logging

Events are fire-and-forget from the SDK's perspective:

1. Step transition occurs
2. SDK creates event, writes to local queue
3. Queue background-syncs to backend in batches
4. Persists across app launches if network unavailable
5. Never blocks UI

### Performance Budget

- SDK initialization: <100ms
- Flow fetch (cached): <50ms
- Flow fetch (network): <2s before fallback
- Event log (queued): <5ms
- Bundle size: target <500KB (uncompressed)

---

## 12. Backend API

REST API. All endpoints under `/api/v1/`. Versioned to allow breaking changes later.

### Authentication

- **SDK requests** authenticate via `Authorization: Bearer fyr_live_<api_key>` header
- **Dashboard requests** authenticate via Supabase session cookie

### Endpoints (SDK-facing)

#### `GET /api/v1/flows/:flowId`

Get the resolved flow (with variant already assigned) for a user.

**Query params:**
- `userId` (required) — anonymous or real user ID
- `attribution` (optional) — base64-encoded JSON of attribution data

**Response:**
```json
{
  "schemaVersion": "1.0",
  "flowId": "flow_main_onboarding",
  "variantId": "v_original",
  "variantName": "Original (control)",
  "steps": [
    { "id": "s1", "screenKey": "welcome" },
    { "id": "s2", "screenKey": "gender_select" }
  ]
}
```

**Errors:**
- `404` if flow doesn't exist or isn't live
- `401` if API key invalid
- `429` if rate limited

#### `POST /api/v1/events`

Log events. Batched.

**Body:**
```json
{
  "events": [
    {
      "userId": "anon_xyz",
      "flowId": "flow_main_onboarding",
      "variantId": "v_original",
      "stepId": "s1",
      "stepIndex": 0,
      "eventType": "step_completed",
      "answers": { "name": "Alex" },
      "clientTimestamp": "2026-05-11T14:23:00Z"
    }
  ]
}
```

**Response:**
```json
{ "accepted": 1 }
```

#### `POST /api/v1/identify`

Upgrade anonymous user to real user.

**Body:**
```json
{
  "anonymousId": "anon_xyz",
  "realUserId": "user_real_123"
}
```

### Endpoints (Dashboard-facing)

Under `/api/internal/` — uses Supabase session, not API key.

- `GET /api/internal/projects` — list user's projects
- `POST /api/internal/projects` — create project (generates API key)
- `GET /api/internal/flows?projectId=...` — list flows
- `POST /api/internal/flows` — create flow
- `PATCH /api/internal/flows/:id` — update flow (variants, weights, etc.)
- `GET /api/internal/analytics/funnel?flowId=...` — per-step drop-off
- `GET /api/internal/analytics/variants?flowId=...` — variant comparison

### Rate Limiting

- SDK endpoints: 100 req/sec per API key (Vercel KV-based)
- Event endpoint: 1000 events/sec per API key
- Dashboard endpoints: 60 req/min per user

### Error Handling

Standard error envelope:
```json
{
  "error": {
    "code": "FLOW_NOT_FOUND",
    "message": "Flow with ID flow_xyz not found",
    "requestId": "req_abc"
  }
}
```

---

## 13. Dashboard

### Pages

```
/                           Marketing landing page
/pricing                    Pricing page
/docs                       Documentation (Mintlify or self-hosted)
/login                      Auth (Supabase)
/signup                     Auth

/app                        Dashboard (authenticated)
  /app/projects             List of projects
  /app/projects/:id         Project overview
    /flows                  List of flows
    /flows/:id              Flow editor
      /editor               Variant editor (drag-to-order steps)
      /analytics            Per-step drop-off, variant comparison
      /settings             Flow settings
    /settings               Project settings (API key, billing)
```

### Flow Editor

This is the core dashboard UX. Customer manages variants and step ordering here.

**UI sketch:**

```
┌──────────────────────────────────────────────────────────┐
│ Flow: Main Onboarding                          [Publish] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Variants                              [+ Add Variant]   │
│  ┌─────────────────────────────────────────────────┐    │
│  │ ● Original           50%   [████████████____]   │    │
│  │   welcome → gender_select → goal_select → ...   │    │
│  │   [Edit]  [Duplicate]  [Delete]                 │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ ● Social first       50%   [████████████____]   │    │
│  │   welcome → social_proof → gender_select → ...  │    │
│  │   [Edit]  [Duplicate]  [Delete]                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  Total weight: 100% ✓                                   │
└──────────────────────────────────────────────────────────┘
```

**Variant editor (when you click Edit):**

```
┌──────────────────────────────────────────────────────────┐
│ Variant: Original                              [Save]   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Steps (drag to reorder)                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │ ≡ 1. welcome                          [×]       │    │
│  │ ≡ 2. gender_select                    [×]       │    │
│  │ ≡ 3. goal_select                      [×]       │    │
│  │ ≡ 4. social_proof                     [×]       │    │
│  │ ≡ 5. trial_pitch                      [×]       │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  [+ Add Step]                                            │
│                                                          │
│  Available screens (from your SDK):                     │
│  • welcome                                              │
│  • gender_select                                        │
│  • goal_select                                          │
│  • social_proof                                         │
│  • trial_pitch                                          │
│  • [paywall_v2]                                         │
└──────────────────────────────────────────────────────────┘
```

### Step Discovery

The dashboard needs to know what screen keys the customer has registered in their app. Two options:

**A) Customer manually adds keys in the dashboard.** Simple, no SDK coupling.
**B) SDK reports registered keys to backend on first launch.** Auto-populates dashboard.

**V1 decision:** Option A for simplicity. Customer types the screen keys they've registered. (See Open Questions for v1.5 evolution.)

### Implementation Notes

- Drag-and-drop: use `dnd-kit` (modern, accessible, well-maintained)
- Weight inputs: range sliders + numeric input, auto-normalize to sum to 100
- Saving: optimistic UI with rollback on error
- Publishing: status: draft → live transition is explicit and irreversible (must create new draft to edit further)

---

## 14. Analytics

### V1 Metrics

For each flow, customer can see:

**1. Per-step drop-off (funnel view)**

For each variant, show:
- Step 1: 100% viewed → 89% completed (11% drop)
- Step 2: 89% viewed → 78% completed (12% drop)
- ...

Compute on the fly from events table. Cache results for 5 minutes.

**2. Variant comparison**

Side-by-side conversion rate per variant. "Conversion" = `flow_completed` event fired.

```
Variant         | Users | Completed | Rate
Original        | 1,234 | 567       | 45.9%
Social first    | 1,201 | 612       | 51.0%
```

**3. Time-to-completion**

Average and median time from `flow_started` to `flow_completed` per variant.

### Computing Drop-Off

```sql
-- Per-step drop-off for a specific variant
WITH step_views AS (
  SELECT step_id, step_index, COUNT(DISTINCT user_id) AS viewers
  FROM events
  WHERE flow_id = $1
    AND variant_id = $2
    AND event_type = 'step_viewed'
  GROUP BY step_id, step_index
),
step_completions AS (
  SELECT step_id, COUNT(DISTINCT user_id) AS completers
  FROM events
  WHERE flow_id = $1
    AND variant_id = $2
    AND event_type = 'step_completed'
  GROUP BY step_id
)
SELECT
  sv.step_id,
  sv.step_index,
  sv.viewers,
  COALESCE(sc.completers, 0) AS completers,
  ROUND(100.0 * COALESCE(sc.completers, 0) / NULLIF(sv.viewers, 0), 2) AS completion_rate
FROM step_views sv
LEFT JOIN step_completions sc ON sv.step_id = sc.step_id
ORDER BY sv.step_index;
```

### V2 Metrics (Not in V1)

- Cohort retention (requires longer-term tracking)
- Funnel breakdown by attribution source
- Statistical significance indicators
- Revenue attribution (requires deeper RevenueCat integration)

---

## 15. RevenueCat Integration

### Pattern: Pass-Through Attribution

Foyer doesn't integrate with RevenueCat's API directly. Instead, it gives the customer the variant ID so they can pass it to RevenueCat as a subscriber attribute. RevenueCat then handles all revenue tracking.

```swift
// Customer's code after onboarding completes
Foyer.flow("main_onboarding") { result in
    Purchases.shared.setAttributes([
        "foyer_variant": result.variantId,
        "foyer_flow": result.flowId,
    ])
    // Now show RevenueCat paywall, or transition to main app
}
```

Customer sees in their RevenueCat dashboard:
- "Trials started by foyer_variant = original: 234 ($1,170 ARR)"
- "Trials started by foyer_variant = social_first: 287 ($1,435 ARR)"

This closes the loop without Foyer having to build revenue tracking infrastructure.

### Why This Works

- RevenueCat already has best-in-class subscription analytics
- Customer's revenue dashboard stays in one place (RevenueCat)
- Foyer's analytics show "onboarding behavior"; RevenueCat shows "revenue outcomes"
- Customers correlate the two in their head (or via export to a warehouse)

### Future Integration

V2 could pull revenue data from RevenueCat via webhook (RevenueCat fires events on trial start, conversion, etc.) and surface it in Foyer's dashboard. Not in v1 scope.

---

## 16. Attribution & Targeting

### Attribution Data Model

Attribution is a flat key-value dictionary:

```typescript
{
  source: "facebook",
  campaign: "winter_sale_2026",
  ad_set: "ad_123",
  medium: "paid_social",
  // Customer can add any keys they want
}
```

### How Customers Pass Attribution

```swift
// Option 1: Manual (customer assembles attribution)
Foyer.setAttribution([
    "source": "facebook",
    "campaign": "winter_sale"
])

// Option 2: AppsFlyer helper (auto-pulls from AppsFlyer SDK)
Foyer.attachAppsFlyer()
// SDK listens for AppsFlyer conversion data, calls setAttribution automatically

// Option 3: Adjust helper (similar)
Foyer.attachAdjust()
```

The SDK is attribution-source-agnostic. AppsFlyer and Adjust are just convenience wrappers.

### Targeting Variants

In the dashboard, variant can have targeting rules:

```json
{
  "id": "v_facebook_users",
  "name": "Facebook users — extra social proof",
  "weight": 100,
  "steps": [...],
  "targeting": {
    "rules": [
      { "field": "source", "op": "eq", "value": "facebook" }
    ]
  }
}
```

This variant only applies to users with `source == "facebook"`. Other users get other variants (those without targeting rules, or with matching rules).

### Edge Cases

- **No attribution data:** User can only be assigned to variants without targeting rules
- **Attribution arrives mid-flow:** Variant assignment already happened; new attribution is logged with subsequent events but doesn't change assignment
- **Targeting rules don't match any variant:** Throws error; SDK uses fallback

---

## 17. Brand & Design

### Brand Colors

- **Primary:** Indigo `#6366F1`
- **Secondary:** Violet `#8B5CF6`
- **Gradient:** Linear, top-to-bottom, primary → secondary

These are the only two brand colors. Use Tailwind's slate/gray scale for everything else (text, backgrounds, borders).

### Logo

- Stylized arched doorway with small doorknob detail
- Concept: Foyer = entrance hall = the room you walk through before the main space
- Available in: full lockup (icon + wordmark), icon-only, favicon
- Files in `apps/dashboard/public/` and `packages/shared/assets/`
- React component: `apps/dashboard/components/FoyerLogo.tsx`

### Voice & Tone

- Clear, direct, slightly understated
- Closer to Linear and Vercel than to Mailchimp or Slack
- Avoid: superlatives, marketing-speak, AI-trend language
- Use: concrete benefits, specific outcomes, technical accuracy

### Dashboard Design Principles

- Minimal chrome, content-first
- Charts use brand indigo as the primary data color
- Empty states are friendly but not chatty
- Forms validate inline, never on submit
- Confirmations for destructive actions only

### Typography

- **Font family:** Inter (load via `next/font/google`)
- **Headings:** Inter Medium (500), tight letter-spacing
- **Body:** Inter Regular (400)
- **Code/IDs:** JetBrains Mono or system mono

---

## 18. Pricing Model

### Tier Structure

| Tier | Price | What's Included |
|------|-------|-----------------|
| **Free** | $0/month | 1 flow, 1 variant (no testing), analytics, fallback handling |
| **Starter** | $49/month | Unlimited flows, unlimited variants, A/B testing, basic analytics, email support |
| **Growth** | $199/month | Everything in Starter + attribution targeting, priority support, custom onboarding setup help |
| **Enterprise** | Custom | Volume discounts, SLAs, dedicated support |

**V1 launch pricing:** Start with these prices. Adjust based on first 10 customer conversations. Pricing is the most adjustable lever — don't agonize.

### The Free → Paid Trigger

The free tier exists to:
1. Let customers experience the value of orchestration without commitment
2. Show drop-off analytics (which is genuinely useful even without testing)
3. Establish the integration so switching costs are low

The paid trigger is **creating a second variant**. The moment a customer wants to A/B test, they hit the paywall. This is a natural, observable line.

### What Free Tier Looks Like in Dashboard

- Limit: 1 flow active at a time
- "Create Variant" button disabled with tooltip: "Upgrade to test variants →"
- All other dashboard features work normally
- Analytics work (per-step drop-off on the 1 variant they have)

### Billing Implementation

V1: manual invoicing for first 10-20 customers. Don't build Stripe integration until you have repeatable conversions.

V1.5: Stripe Checkout + Customer Portal. Simple subscription, monthly billing, no usage-based metering yet.

---

## 19. Complexity Assessment

### Ranked by Risk

**1. Swift SDK reliability and ergonomics (highest risk)**

The SDK lives in customers' apps. If it crashes, their app crashes. If the API is confusing, they don't adopt. If it's hard to integrate, they bounce.

Mitigations:
- Public API surface is intentionally tiny (configure, register, flow, identify, setAttribution)
- Comprehensive fallback behavior
- Aggressive timeouts on network calls (2s max)
- Local event queue persists across app crashes
- TestFlight builds with your existing app before publishing the SDK
- Use Swift's strict concurrency model from day one

**2. Dashboard UX (medium-high risk)**

The flow editor is where customers spend their time. If reordering variants is awkward, the product feels broken even if the SDK is flawless.

Mitigations:
- Use dnd-kit (battle-tested drag-and-drop)
- Start with a minimal editor (drag-and-drop step ordering only); add features as customers ask
- Heavy use of shadcn/ui components for consistency
- Test with 3+ real customers before public launch

**3. Analytics query performance (medium risk at scale)**

Postgres handles per-step drop-off queries fine for v1, but as event volume grows, queries get slow. Cache aggressively.

Mitigations:
- Index strategy defined above
- Cache analytics responses for 5 minutes per project
- When events exceed 10M rows, evaluate Tinybird or ClickHouse migration

**4. Attribution timing (medium risk)**

AppsFlyer/Adjust attribution arrives asynchronously after app launch. If variant assignment happens before attribution arrives, the user is assigned to a non-targeted variant.

Mitigations:
- SDK supports delayed `setAttribution` calls
- If attribution is critical for targeting, customer can defer `Foyer.flow(...)` until attribution callback fires
- Document this clearly in SDK docs

**5. Variant weight invariants (low risk but easy to get wrong)**

Variant weights must sum to exactly 100. Off-by-one errors are easy.

Mitigations:
- Zod schema enforces sum === 100
- Dashboard auto-normalizes when adjusting weights
- Backend rejects invalid flows at save time

**6. Schema versioning (low risk if disciplined)**

The schema will evolve. Need a clean migration path.

Mitigations:
- Versioning baked in from day one
- Additive changes don't require version bumps
- Breaking changes get a new major version with parallel API
- SDK declares supported schema versions and fails gracefully on mismatch

### What I'm Specifically NOT Worried About

- **Tech stack maturity:** Next.js, Supabase, Vercel are all rock-solid for this use case
- **Auth complexity:** Supabase Auth handles 99% of what you need
- **Database scaling:** Postgres handles way more than you'll need for v1
- **Hosting costs:** $0-50/month until you have meaningful customers

---

## 20. Build Plan

### Week 0: Foundation (this week)

- [x] Domain purchased (foyer.so)
- [x] Email setup (ryan@foyer.so via Google Workspace)
- [x] GitHub org and repo created (foyerhq/foyer, public)
- [x] Vercel account ready
- [x] Supabase project provisioned (foyer-prod, us-west-2)
- [x] Credentials saved to password manager
- [x] Logo assets created
- [ ] Write this BUILD.md doc (you're reading it)
- [ ] Scaffold monorepo (`pnpm create turbo`)
- [ ] First commit: README + this BUILD.md
- [ ] First deploy: empty Next.js app to Vercel, point foyer.so at it

### Week 1: Schema + Database

- [ ] Set up Drizzle with Supabase Postgres
- [ ] Write Zod schemas in `packages/shared/src/schema/`
- [ ] Generate Drizzle table definitions
- [ ] Run initial migration (create all tables)
- [ ] Set up Row Level Security policies
- [ ] Write seed script (create demo project + flow)
- [ ] Set up Supabase Auth (Email + Google)
- [ ] Build basic auth flow (login, signup, protected routes)

### Week 2: Backend API

- [ ] Implement `GET /api/v1/flows/:flowId` with variant assignment
- [ ] Implement variant assignment algorithm (hash-based sticky)
- [ ] Implement `POST /api/v1/events` (batched)
- [ ] Implement `POST /api/v1/identify`
- [ ] Add rate limiting (Vercel KV)
- [ ] Add Sentry for error tracking
- [ ] Write integration tests for variant assignment
- [ ] Dogfood: hit the API with curl, validate responses

### Week 3: Dashboard MVP

- [ ] Project CRUD (create, list, view, settings)
- [ ] Flow CRUD (create, list, view)
- [ ] Generate API keys on project creation
- [ ] Flow editor: list variants, edit variant (drag-to-order steps)
- [ ] Variant editor: add/remove steps, change order, set weights
- [ ] Publish flow (status: draft → live)
- [ ] Basic analytics page (per-step drop-off chart)

### Week 4: Swift SDK MVP

- [ ] Set up Swift Package in `packages/sdk-swift/`
- [ ] Implement `Foyer.configure`, `Foyer.register`
- [ ] Implement `Foyer.flow(...)` view
- [ ] Implement screen registry and flow controller
- [ ] Implement network client with timeouts
- [ ] Implement local cache (file-based)
- [ ] Implement event logger (batched, queued)
- [ ] Implement identity (`Foyer.identify`, anonymous IDs)
- [ ] Write unit tests

### Week 5: Integration & Dogfooding

- [ ] Integrate Foyer SDK into your existing iOS app behind a feature flag
- [ ] Run real onboarding via Foyer in TestFlight
- [ ] Fix bugs found from real usage
- [ ] Iterate on SDK API based on integration friction
- [ ] Polish dashboard UX based on actual use

### Week 6: Polish + Soft Launch

- [ ] Marketing landing page
- [ ] Pricing page
- [ ] Documentation (SDK reference, getting started guide)
- [ ] Set up Stripe (or defer manual invoicing)
- [ ] Email signup form for waitlist
- [ ] First 3-5 friendly customer integrations
- [ ] Gather feedback, fix critical bugs

### Week 7-8: Public Launch Prep

- [ ] Publish Swift Package to public SPM
- [ ] Polish docs
- [ ] Set up support email (support@foyer.so)
- [ ] Write launch announcement
- [ ] Identify 20 outbound prospects (subscription iOS apps with hardcoded onboarding)
- [ ] Soft launch: post on Indie Hackers, X, relevant Discord/Slack communities
- [ ] Onboard first paying customers

### V1 Done Criteria

- [ ] 5+ apps have integrated the SDK and are running flows in production
- [ ] Dashboard supports flow CRUD, variant management, basic analytics
- [ ] Pricing tiers are live (manual billing OK)
- [ ] Docs are complete enough that a developer can integrate without help
- [ ] SDK has handled real production traffic without major incidents for 2+ weeks

### What's Explicitly Deferred to V1.5+

- React Native SDK
- Template library
- Conditional flow logic
- AI-generated variant suggestions
- Native Android SDK
- Multi-step content overrides
- Webhook integrations
- Team accounts / collaboration features

---

## 21. First Commits

Specific PRs to make in order. Each should be small and shippable.

### Commit 1: Scaffolding

```bash
pnpm create turbo@latest foyer
# Pick: Next.js, pnpm, TypeScript
```

- Add `packages/shared/` workspace
- Add `packages/sdk-swift/` workspace (just structure, no Swift code yet)
- Configure `turbo.json` for build/lint/test
- Add `.env.example`
- Add comprehensive `.gitignore`

### Commit 2: Vercel deployment

- Connect repo to Vercel
- Deploy default Next.js app
- Point foyer.so DNS at Vercel
- Verify HTTPS works

### Commit 3: Supabase connection

- Install `@supabase/supabase-js` and `drizzle-orm`
- Set up `lib/db/index.ts` with Drizzle client
- Set up `lib/supabase/client.ts` for auth
- Verify connection in a health check route

### Commit 4: Schema package

- `packages/shared/src/schema/flow.ts` — Zod schemas from this doc
- `packages/shared/src/schema/event.ts`
- Export types from `packages/shared/src/index.ts`
- Test: import from dashboard, validate a fixture flow

### Commit 5: Database migrations

- Drizzle table definitions matching SQL above
- Initial migration creating all tables
- Run against foyer-prod Supabase

### Commit 6: Auth

- Login/signup pages using Supabase Auth
- Protected route wrapper
- User profile route (`/app/settings`)

### Commit 7-N: continue per build plan

---

## 22. Open Questions

Things to resolve as you go. Don't block on these — make a call, document it here, revise if wrong.

1. **Monorepo vs separate Swift repo?** Currently planning monorepo with `packages/sdk-swift/`. May need to extract before first public release for cleaner SPM consumption.

2. **Step discovery: manual or auto?** V1 says manual (customer types screen keys in dashboard). V1.5 may add auto-discovery (SDK reports registered keys to backend).

3. **Schema sync between TS and Swift?** Currently manual. Consider codegen (e.g., `zod-to-swift` if it exists, or custom script) before SDK ships.

4. **Pricing calibration:** $49/$199 starter/growth are first guesses. Adjust based on conversion conversations.

5. **Free tier limits:** 1 flow + 1 variant is restrictive. Test if "1 flow with unlimited variants but rate-limited at 1k MAU" is more compelling.

6. **AppsFlyer helper packaging:** Bundle into main SDK or separate sub-package? Probably separate so non-AppsFlyer users don't pay the bundle cost.

7. **iOS minimum version:** Currently 15.0 to match RevenueCat. Could go lower for broader compatibility, but SwiftUI maturity at 15+ is significantly better.

8. **Dashboard "live preview" of flow:** Show what users will see as they edit? Nice-to-have, not v1.

9. **Soft delete vs hard delete for flows/variants?** Soft delete (status: archived) is safer for analytics continuity. Hard delete is simpler. Lean soft delete.

10. **API key rotation:** No UI for this in v1. Add when first customer requests it.

11. **Multi-tenant isolation in events table:** Currently uses `project_id` + RLS. At scale, consider per-tenant partitioning.

12. **CDN for SDK fetches:** Vercel handles this for routes. If flow fetches become a bottleneck, evaluate Cloudflare in front.

---

## 23. Startup Programs

Apply to these as opportunities. Most can stack.

### Priority (apply during v1 development)

- **Anthropic Startup Program** — $5K-$25K in API credits, 12-month period. Apply at anthropic.com/startups once you have a working product. Defer until post-launch.
- **Vercel for Startups** — Pro credits, depending on funding. Apply at vercel.com/startups when needed.

### Lower Priority

- **AWS Activate** — Useful if you eventually move infra. Not relevant for v1.
- **Google for Startups Cloud Program** — Same.
- **Microsoft for Startups** — Same.
- **Supabase startup credits** — Informal; reach out to them if you need more than free tier supports.

### Not Worth It

- "Credit aggregator" SaaS subscriptions that claim to bundle these programs. Apply directly to each — it's free.

---

## 24. Glossary

**Flow** — A named onboarding sequence. Has an ID like `main_onboarding` that the customer's app code references. Contains one or more variants.

**Variant** — A specific ordered list of step references within a flow. Each variant has a weight (% of traffic). Users are sticky-assigned to one variant per flow.

**Step** — A single screen position in a variant. References a registered screen key. The customer's app provides the actual rendering.

**Screen key** — A string identifier the customer uses to register a SwiftUI view with Foyer. Example: `"welcome"`, `"goal_select"`.

**Registered screen** — A SwiftUI view the customer has passed to `Foyer.register(key:)`. Foyer can route flows through this view by key.

**Resolved flow** — What the SDK receives from the backend: a flow with the variant already chosen. Includes step list, no variant alternatives.

**Sticky assignment** — Variant assignment that persists across app launches. Once a user is assigned to a variant, they stay in that variant forever (unless weights change and assignment is reset, which is rare).

**Attribution** — Key-value data describing where a user came from (ad source, campaign, etc.). Used for variant targeting.

**Fallback flow** — A flow definition the customer specifies in code, used if Foyer's API is unreachable and no cached flow exists.

**Anonymous user ID** — A UUID generated by the SDK on first launch, stored in UserDefaults. Used for variant assignment before the user signs up.

**Real user ID** — The customer's own user ID (from their auth system). After `Foyer.identify(userId:)`, the anonymous ID is mapped to the real ID and used for future analytics.

**Project** — A customer's Foyer account / app. Has an API key. Contains flows. Owned by a Supabase Auth user.

---

## Last Words

This doc is the operating system for Foyer's first 60-90 days. Update it as you make decisions. If something here turns out to be wrong, fix the doc *first*, then change the code.

The goal of v1 isn't to be perfect — it's to be in production with 5-10 paying customers who are getting real value. Build the minimum that earns trust. Iterate from real usage.

Ship something embarrassingly simple. Talk to customers. Fix what they tell you matters. Repeat.

---

**Next action:** Scaffold the monorepo (Week 0, Step 1). Open Cursor, point at the empty repo, and start.
