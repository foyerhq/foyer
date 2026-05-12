# Foyer — Build Document (v2)

> **Status:** Pre-development, infrastructure provisioned
> **Last updated:** May 12, 2026
> **Owner:** Ryan Malone (ryan@foyer.so)
> **Repo:** github.com/foyerhq/foyer

This document is the source of truth for building Foyer. It captures architectural decisions, technical specifications, account references, and the build plan. Read this first before writing any code. Update it as decisions evolve.

**This is v2** — significantly revised from v1 after strategic decisions about positioning, scope, and the Foyer-built renderer (now removed from the roadmap).

---

## Table of Contents

1. [What Foyer Is](#1-what-foyer-is)
2. [Strategic Positioning](#2-strategic-positioning)
3. [V1 Scope](#3-v1-scope)
4. [Apple Compliance](#4-apple-compliance)
5. [Architecture Overview](#5-architecture-overview)
6. [Tech Stack](#6-tech-stack)
7. [Account References](#7-account-references)
8. [Repository Structure](#8-repository-structure)
9. [The Flow Schema](#9-the-flow-schema)
10. [Remote Config](#10-remote-config)
11. [Database Schema](#11-database-schema)
12. [Variant Assignment Algorithm](#12-variant-assignment-algorithm)
13. [The Swift SDK](#13-the-swift-sdk)
14. [Screen Lifecycle Management](#14-screen-lifecycle-management)
15. [Backend API](#15-backend-api)
16. [Dashboard](#16-dashboard)
17. [Analytics](#17-analytics)
18. [Attribution & Targeting](#18-attribution--targeting)
19. [RevenueCat Integration](#19-revenuecat-integration)
20. [How Customers Use Foyer](#20-how-customers-use-foyer)
21. [Brand & Design](#21-brand--design)
22. [Pricing Model](#22-pricing-model)
23. [Complexity Assessment](#23-complexity-assessment)
24. [Build Plan](#24-build-plan)
25. [First Commits](#25-first-commits)
26. [Open Questions](#26-open-questions)
27. [Startup Programs](#27-startup-programs)
28. [Glossary](#28-glossary)

---

## 1. What Foyer Is

Foyer is the A/B testing platform for iOS subscription app onboarding flows.

Subscription apps invest heavily in user acquisition. The first few minutes a user spends in the app determine whether that acquisition spend pays back. Onboarding is the highest-leverage surface in the entire product — but most teams test it rarely or not at all, because the operational cost of running each test is too high.

Foyer makes onboarding A/B testing operationally cheap. Customers register their existing SwiftUI onboarding screens with Foyer once. From then on, they compose variants in our dashboard — different screen orders, different copy, different images, different content per acquisition source. They run as many concurrent tests as they want. They measure per-step conversion. They scale winners and kill losers without engineering involvement.

The product is built on a simple observation: **the technical capability of remote configuration is already free and widely available (Firebase Remote Config, etc.). What's missing is the workflow.** Most teams don't run extensive onboarding tests because building the workflow to do so on top of generic infrastructure is expensive engineering work. Foyer is that workflow, assembled and specialized for one use case.

### The Pitch

> **A/B test your iOS onboarding 10x more than you do today.**
>
> Wire your existing SwiftUI screens to Foyer in an afternoon. Compose variants from our dashboard — change copy, swap images, reorder steps, hide screens for some users. Target each variant by acquisition source, geo, device, or any user property. Measure per-step conversion. Find winners. Scale them.

### What Foyer Does Not Do

To be clear about scope: Foyer does not render any UI. The customer's app is always responsible for drawing pixels. Foyer delivers configuration data — screen ordering, remote config values (strings, image URLs, button labels) — that the customer's own code reads and acts on.

Foyer is not a design tool. It is not a no-code onboarding builder. New screens require the customer to design, build, ship, and pass Apple review themselves. Once a screen exists in the customer's app binary, Foyer can include it in variants.

This boundary is deliberate. It keeps Foyer firmly on the safe side of Apple's guidelines, it keeps the product scope tight enough to execute well, and it focuses customer mindshare on the operational unlock — running more tests, more often, with more sophistication.

---

## 2. Strategic Positioning

### The Category

A/B testing platform for iOS subscription app onboarding. Not feature flags. Not remote config. Not a design tool. A purpose-built testing platform for a specific surface.

### The Unlock

Each individual capability Foyer offers is already available elsewhere:

| Capability | Available in | Cost |
|------------|--------------|------|
| Change content remotely | Firebase Remote Config | Free |
| Run A/B tests on mobile | Firebase A/B Testing | Free |
| Personalize by audience | Firebase Remote Config conditions | Free |
| Measure conversion funnels | Firebase Analytics + BigQuery | Free (with engineering time) |
| Reorder screens dynamically | Firebase Remote Config + custom code | Free (with engineering time) |

The capabilities are free. Composing them into a coherent testing program is not free. It requires:

- Engineering investment to map parameters to views
- Engineering investment to coordinate variants with conditions
- Engineering investment to build funnel queries
- Engineering investment to build a dashboard non-engineers can use
- Discipline to run experiments rigorously
- Organizational bias toward operational sophistication that most teams lack

Foyer ships all of this assembled and specialized for onboarding. Subscription apps that want to run a serious testing program don't have to build the infrastructure first. They just start testing.

### The Mundane-to-Powerful Compounding

This is the core insight of Foyer's positioning:

**Changing a headline remotely is mundane.** Any developer can do this. It's not worth paying for.

**Running 8 variants of that headline against each other across 3 acquisition sources, measuring per-step conversion, killing losers in one click, and running another 8 variants next week — that's operationally different.** That's what teams pay for.

The same mundane capability compounded across variants, sources, and a continuous testing program becomes a fundamentally different product.

### Target Customer (ICP)

**Subscription app developers with existing hardcoded onboarding flows** who:

- Ship to iOS App Store
- Have onboarding flows of roughly 10-40 screens
- Run paid user acquisition on at least one channel (Facebook, TikTok, Google, etc.)
- Use RevenueCat or similar for paywalls
- Sit at $50K-$500K MRR — past survival, with real acquisition spend to optimize
- Currently testing onboarding rarely or not at all, but want to test more

The buyer is typically a growth lead, head of product, or technical founder who recognizes that onboarding optimization is a missed opportunity but doesn't want to build testing infrastructure from scratch.

**Not the V1 ICP:**
- Pre-launch indies (build something first)
- Enterprise apps with custom infrastructure
- Non-subscription apps where onboarding matters less
- Teams that update onboarding twice a year (Foyer isn't worth $199/month for them)

### Competitive Landscape

| Competitor | What they do | Why Foyer wins |
|------------|--------------|----------------|
| Firebase Remote Config + A/B Testing | Generic remote config + experimentation | The mechanism is the same. Foyer composes the workflow specifically for onboarding, with onboarding-specific analytics, typed forms for non-engineers, and source-targeted variants out of the box. Teams using Firebase for onboarding tests are doing the work Foyer has built. |
| Statsig | Modern feature flags + experimentation | General-purpose, B2B-priced. Foyer is onboarding-specialized and priced for the subscription app market. |
| Amplitude Experiment | Experimentation + analytics | Enterprise pricing, complex setup, not onboarding-specialized. |
| Superwall / RevenueCat Paywalls | Remote paywall config + A/B testing | Adjacent surface — paywalls, not onboarding. Foyer hands off to these at flow completion. |
| RevenueCat | Subscription infrastructure | Adjacent. Foyer's variant ID becomes a RevenueCat subscriber attribute. |
| In-house custom solutions | Teams who've built this themselves | Eventually expensive to maintain. Foyer is the off-the-shelf version. |

### The Honest Pricing Comparison

Firebase Remote Config is free. Foyer is not. The pitch has to address this directly:

> Yes, Firebase Remote Config is free. So is editing a config file by hand. The reason teams pay for Foyer is the same reason they pay for Linear instead of using Jira's free tier, or Notion instead of using Google Docs. The underlying capability is similar; the workflow is dramatically different. If your marketing team does one onboarding update a month, Firebase is fine. If they want to do one a week, run A/B tests by source, and measure conversion lift — without filing engineering tickets — you need a tool built for that workflow. Foyer pays for itself the first time you avoid an engineering bottleneck on a test that ships a 0.5% conversion lift.

---

## 3. V1 Scope

### In Scope

**Core capabilities:**
- Swift SDK distributed via SPM
- Screen registration API for customer's SwiftUI views
- Remote config: per-step, per-variant typed key-value content, declared via field schemas in Swift
- Flow configuration with linear step sequences and multiple variants
- Sticky, hash-based variant assignment per user
- Per-step drop-off analytics
- Variant comparison analytics with per-variant funnels
- Source-based and attribute-based targeting (V1 P0)
- Screen lifecycle management (TestFlight vs production awareness)
- Fallback to cached or developer-specified local flow when API unreachable
- RevenueCat handoff via subscriber attribute
- Dashboard with thumbnail-based flow editor, variant management, remote config form editor, analytics
- Manual thumbnail upload during initial integration
- Free tier (1 flow, 2 variants) + paid tiers

### Explicitly Out of Scope

**No renderer.** Foyer does not render any UI in V1, nor in any future version. The customer's app is always responsible for drawing screens. If a customer wants new screens, they design, build, ship through Apple review, and register them with Foyer.

**No design tools.** No layout library. No template system. No theme editor. Foyer is not a design platform.

**No React Native or Android in V1.** Swift only. Other platforms are V2 territory based on customer demand.

**No conditional flow logic within a single variant.** Customers branch by creating multiple variants with targeting rules, not by mid-flow branching. May be added in V2.

**No live preview of changes.** Customers verify changes in their own dev/TestFlight builds. Foyer's SDK supports a dev-mode cache bypass to make this workflow fast.

### V1 Success Criteria

V1 is successful if:

- 5+ paying customers within 60 days of launch
- Average customer runs 3+ concurrent variants per active flow
- Average customer runs 5+ experiments in their first 90 days
- Net negative churn after month 3 (expansion revenue from upgrades exceeds churn)
- At least one customer reports measurable conversion lift attributable to Foyer testing within 90 days

### Why the Tight Scope

V1 is the entire product, not a stepping stone. Cutting the renderer (originally planned as V1.5) does three things:

1. **Sharpens the category.** "A/B testing platform" is a clearer position than "remote config + builder."
2. **Removes Apple compliance gray area.** Every screen Foyer can show is reviewed by Apple, period.
3. **Focuses engineering.** 8 weeks to V1 instead of 14-16 weeks to V1 + V1.5.

What customers asked for "in the renderer" they can solve by building flexible screens in their own code that read from remote config. Customer owns rendering. Foyer owns the testing workflow. Clean lines.

---

## 4. Apple Compliance

Foyer's design sits firmly on the safe side of Apple's App Review Guidelines, specifically sections 2.5.2 (code download/execution) and 2.3.1 (hidden features). This section documents the compliance posture so it's defensible to customers and to Apple if questions arise.

### What 2.5.2 and 2.3.1 Prohibit

**2.5.2:** Apps may not download, install, or execute code that introduces or changes features or functionality post-review.

**2.3.1:** Apps may not contain hidden, dormant, or undocumented features. All functionality must be clear and accessible during review.

The line Apple draws is between:
- **Code** — executable instructions that change what the app can do (prohibited)
- **Configuration data** — values, content, structure that existing reviewed code reads and acts on (allowed)

### How Foyer Stays on the Safe Side

**Foyer ships configuration data, not code.** The customer's iOS app contains all the executable code at review time. Foyer's API delivers JSON: which screen keys to show, in what order, with what remote config values (strings, image URLs, button labels). The customer's existing reviewed code reads these values.

**Every screen Foyer can show exists in the binary at review time.** Customers register screens in their app code. Apple reviews those screens. Foyer reorders or hides them, changes their content via remote config — but never introduces a screen Apple hasn't seen.

**No new permissions, no new system behaviors.** Foyer cannot trigger permission dialogs, payment flows, network calls, or system interactions that weren't in the reviewed binary. The customer's code does all of this; Foyer just decides which screens to show.

**No hidden features.** Every variant Foyer can deliver to a user is composed of screens that were reviewed and visible in the original onboarding flow. Apple, walking through the app at review, sees every screen Foyer can show.

### Precedent

This pattern is established and widely used:

- Firebase Remote Config (millions of apps, including Google's own)
- Superwall (paywall configuration, Y Combinator backed, used by major subscription apps)
- RevenueCat Paywalls (similar pattern, no widespread bans)
- Optimizely, LaunchDarkly, Statsig (feature flag systems)
- OneSignal, Braze (in-app message templates)

Apple has had a decade to act against this pattern. They haven't, because it's configuration data, not code.

### What Apps Actually Get Banned For

Researched precedent of bans under 2.5.2/2.3.1 falls into three categories, none of which describe Foyer:

1. **Apps using dynamic code execution frameworks** (JSPatch, RollOut.io) that actually download and run native code. Apple cracked down on these around 2017.
2. **Apps that hide features to deceive review** — shipping a benign app and flipping a flag post-approval to enable gambling, adult content, or other rejectable categories.
3. **Apps that change permissions or system behavior post-review** — apps that suddenly request new permissions or change fundamental purpose.

Foyer doesn't enable any of these patterns.

### Customer Guidance

Foyer customers should include the following in their App Store review notes:

> This app integrates Foyer (foyer.so) for onboarding A/B testing. Foyer delivers configuration data (string content, image URLs, screen ordering) to the app's existing reviewed onboarding screens. No code is downloaded or executed. No features are enabled that weren't present in this submitted build.

This is a precautionary tactic — most reviewers won't ask, but having the note creates a clear paper trail and removes friction if any reviewer is unfamiliar with the pattern.

### What Foyer Customers Cannot Do Through Foyer

To be explicit about the line:
- Cannot add new screens to the app via Foyer (must ship through review)
- Cannot trigger new permission requests via Foyer (must be in reviewed code)
- Cannot change the app's fundamental purpose via Foyer
- Cannot enable features hidden at review (everything must be visible in the submitted build)
- Cannot introduce regulated content (medical claims, financial advice, gambling) that wasn't in the reviewed app

These boundaries are documented on foyer.so/compliance and reinforced in the dashboard when customers create variants.

### Legal Review

Before public launch, Foyer should commission a written legal opinion confirming compliance with Apple guidelines. This opinion is shared with enterprise customers who require it. Approximate cost: $2-5K. Defer until two weeks before launch.

---

## 5. Architecture Overview

### System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     Customer's iOS App                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Foyer SDK (Swift Package)                          │    │
│  │  - Screen registry                                  │    │
│  │  - Flow controller                                  │    │
│  │  - Event logger                                     │    │
│  │  - Variant cache                                    │    │
│  │  - Remote config delivery                           │    │
│  │  - Fallback handler                                 │    │
│  │  - Build awareness (debug/release/version)          │    │
│  └─────────────────────────────────────────────────────┘    │
│         │                                    ▲                │
│         │ HTTPS                              │                │
└─────────┼────────────────────────────────────┼────────────────┘
          │                                    │
          ▼                                    │
┌──────────────────────────────────────────────┴───────────────┐
│                  Foyer Backend (Vercel)                      │
│  - API routes (/api/v1/*)                                    │
│  - Dashboard (Next.js App Router)                            │
│  - Marketing pages                                           │
│  - Asset storage (Supabase Storage)                          │
└─────────┬────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────┐
│                    Supabase (Postgres)                       │
│  - projects, flows, variants                                 │
│  - registered_screens (with field schemas, build version)    │
│  - flow_assignments                                          │
│  - events                                                    │
│  - users (via Supabase Auth)                                 │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow: First App Open

1. App calls `Foyer.configure(apiKey: "...")`
2. SDK generates anonymous user ID, stores in UserDefaults
3. App registers screens (with field schemas) at startup
4. SDK reports registered screens + build version to backend
5. App calls `Foyer.flow(flowId: "main_onboarding")`
6. SDK fetches: `GET /api/v1/flows/main_onboarding?userId=anon_xyz`
7. Backend resolves variant assignment (sticky, hash-based, targeted)
8. Backend returns ResolvedFlow with steps + remote config per step
9. SDK caches response, renders first screen via registered closure
10. Customer's view reads from `context.remoteConfig` for any wired content
11. User completes step → SDK fires event, advances
12. Loop until completion
13. SDK calls `onComplete(result)` with variant ID
14. Customer hands off to RevenueCat with variant ID as attribute

### Data Flow: Network Unavailable

1. SDK times out network call (2s)
2. Falls back to cached flow if available
3. Falls back to developer-specified local fallback flow if no cache
4. Logs `fallback_used` event for analytics

### Why This Architecture

- **Customer owns rendering.** Their app draws pixels, always. Foyer is data delivery.
- **Stateless backend.** API routes are pure functions over Postgres state. Easy to scale horizontally on Vercel.
- **Postgres scales for V1+V2.** Event volume in the millions/month range is well within Postgres comfort. OLAP migration (ClickHouse/Tinybird) deferred until Year 2.
- **Sticky variant assignment.** Same user → same variant forever. Critical for clean experiments.
- **Fallback always works.** SDK never hard-fails. Onboarding always runs.

---

## 6. Tech Stack

### SDK
- **Language:** Swift 5.9+
- **UI:** SwiftUI (customer screens are SwiftUI views)
- **Distribution:** Swift Package Manager
- **Minimum iOS:** 15.0
- **Repo:** `packages/sdk-swift/` in monorepo

### Backend & Dashboard
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript 5.x (strict mode)
- **Runtime:** Node.js on Vercel serverless
- **Domain:** foyer.so

### Database
- **Provider:** Supabase
- **Engine:** Postgres 15
- **ORM:** Drizzle
- **Migrations:** Drizzle Kit
- **Region:** us-west-2

### Auth
- **Provider:** Supabase Auth
- **Methods:** Email + Google OAuth + GitHub OAuth

### UI Layer (Dashboard)
- **Components:** shadcn/ui + Tailwind CSS
- **Forms:** React Hook Form + Zod resolvers
- **Charts:** Recharts
- **Drag-and-drop:** dnd-kit (flow editor with thumbnail tiles)
- **Icons:** Lucide React
- **Image uploads:** Supabase Storage for thumbnails and remote config images

### Shared Code
- **Schema:** Zod (single source of truth across SDK contract, backend validation, dashboard forms)

### Monorepo
- **Tool:** Turborepo + pnpm workspaces

### CI/CD
- **GitHub Actions:** lint, type-check, test on every PR
- **Vercel:** auto-deploy on push to main
- **Swift Package:** versioned via Git tags, semantic versioning

### Observability
- **Error tracking:** Sentry (dashboard + SDK)
- **Foyer's own analytics:** PostHog

---

## 7. Account References

### Production Accounts

| Service | Account / Identifier | Plan | Purpose |
|---------|---------------------|------|---------|
| Domain | foyer.so (Namecheap) | $64.98/yr | Primary domain |
| Email | ryan@foyer.so (Google Workspace) | $6/mo | Company email |
| GitHub | github.com/foyerhq | Free | Code hosting |
| Vercel | personal (ryanmalone1041) | Hobby | Hosting |
| Supabase | foyer-prod | Free → Pro before launch | Database + auth + storage |
| Anthropic | personal | Pay-as-you-go ($20/mo cap) | Future AI features |
| npm | @foyerhq | Free | Reserved |
| Apple Developer | (existing) | $99/yr | iOS app signing for example apps |

### Environment Variables

`apps/dashboard/.env.local` (gitignored):

```bash
# === App URL ===
NEXT_PUBLIC_APP_URL=https://foyer.so

# === Supabase ===
NEXT_PUBLIC_SUPABASE_URL=https://bspbvvmcduvqvfmpqyiw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # SECRET
DATABASE_URL=postgresql://...

# === Anthropic ===
ANTHROPIC_API_KEY=sk-ant-api03-...  # SECRET

# === Sentry (when added) ===
SENTRY_DSN=https://...

# === Internal API secret ===
FOYER_API_SECRET=...  # generated; rotate periodically
```

### Brand Assets

Logo files in `apps/dashboard/public/` and `packages/shared/assets/`:
- `foyer-favicon.svg` (64×64)
- `foyer-icon.svg` (80×100)
- `foyer-logo.svg` (full lockup)
- `FoyerLogo.tsx` (React component)

### Outstanding Setup
- [ ] Sentry account (defer until first deployment)
- [ ] PostHog account (defer until first 10 customers)
- [ ] Anthropic Startup Program (defer until production)
- [ ] Open Graph image (1200×630)
- [ ] Legal opinion on Apple compliance (defer until 2 weeks pre-launch)

---

## 8. Repository Structure

```
foyer/                              # github.com/foyerhq/foyer
├── apps/
│   └── dashboard/                  # Next.js app
│       ├── app/
│       │   ├── (marketing)/        # Landing pages
│       │   ├── (app)/              # Dashboard (authenticated)
│       │   ├── api/
│       │   │   ├── v1/             # SDK-facing API
│       │   │   └── internal/       # Dashboard-only API
│       │   └── layout.tsx
│       ├── components/
│       │   ├── ui/                 # shadcn
│       │   ├── flow-editor/        # Variant management
│       │   ├── remote-config-form/ # Typed forms for editing remote config
│       │   ├── analytics/          # Funnel and variant comparison
│       │   └── FoyerLogo.tsx
│       ├── lib/
│       │   ├── db/
│       │   ├── supabase/
│       │   ├── variant-assignment.ts
│       │   ├── targeting.ts
│       │   └── auth.ts
│       ├── public/
│       └── drizzle/
│
├── packages/
│   ├── shared/                     # Zod schemas, types
│   │   └── src/
│   │       ├── schema/
│   │       │   ├── flow.ts
│   │       │   ├── variant.ts
│   │       │   ├── step.ts
│   │       │   ├── remote-config.ts
│   │       │   ├── targeting.ts
│   │       │   ├── screen-registry.ts
│   │       │   └── event.ts
│   │       └── index.ts
│   │
│   └── sdk-swift/
│       ├── Sources/Foyer/
│       │   ├── Foyer.swift         # Public API
│       │   ├── FlowController.swift
│       │   ├── ScreenRegistry.swift
│       │   ├── RemoteConfig.swift
│       │   ├── VariantCache.swift
│       │   ├── EventLogger.swift
│       │   ├── NetworkClient.swift
│       │   ├── BuildEnvironment.swift  # Detects debug/release/version
│       │   └── Models/
│       ├── Tests/
│       └── Package.swift
│
├── docs/
│   ├── BUILD.md                    # This file
│   ├── SDK_API.md
│   ├── INTEGRATION_GUIDE.md
│   ├── COMPLIANCE.md
│   └── CONTRIBUTING.md
│
├── .github/workflows/
├── .gitignore
├── .env.example
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## 9. The Flow Schema

The schema is the central artifact. Everything in Foyer hangs off it.

### Design Principles

1. **Platform-agnostic.** No Swift-specific concepts in the schema.
2. **Stable IDs.** Server-assigned, never change. Analytics depend on this.
3. **Schema versioned from day one.** Top-level `schemaVersion` field.
4. **Variants are first-class.** A flow has 1+ variants; weights must sum to 100.
5. **No content directly in flow schema.** Steps reference screen keys + per-variant remote config payloads.
6. **Forward compatibility via optional fields.** New fields default to safe values.

### Mental Model

```
Project
└── Flow ("main_onboarding")
    └── Variant "control" (weight: 34, targeting: none)
        └── Step 1: screenKey="welcome", remoteConfig={headline: "Welcome to Pulse", ...}
        └── Step 2: screenKey="goal_select", remoteConfig={...}
        └── ...
    └── Variant "facebook_test" (weight: 33, targeting: source=facebook)
        └── Step 1: screenKey="welcome", remoteConfig={headline: "Get fit in 30 days", ...}
        └── Step 2: screenKey="social_proof", remoteConfig={...}
        └── Step 3: screenKey="goal_select", remoteConfig={...}
        └── ...
    └── Variant "tiktok_test" (weight: 33, targeting: source=tiktok)
        └── ...
```

A step references a screen by key AND carries its own remote config values for that variant. Two variants can use the same screen with different copy/images.

### Zod Schema

Lives at `packages/shared/src/schema/flow.ts`.

```typescript
import { z } from "zod";

// PRIMITIVES
const IdSchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/);
const SchemaVersionSchema = z.literal("1.0");

// REMOTE CONFIG VALUE (per step per variant)
const RemoteConfigValueSchema = z.record(
  z.string(),
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.null(),
  ])
);

// STEP
const StepSchema = z.object({
  id: IdSchema,
  screenKey: z.string().min(1),
  name: z.string().optional(),
  remoteConfig: RemoteConfigValueSchema.optional(),
});

// TARGETING
const AttributionRuleSchema = z.object({
  field: z.string(),
  op: z.enum(["eq", "neq", "in", "nin"]),
  value: z.union([z.string(), z.array(z.string())]),
});

const TargetingSchema = z.object({
  rules: z.array(AttributionRuleSchema).default([]),
});

// VARIANT
const VariantSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(100),
  weight: z.number().int().min(0).max(100),
  steps: z.array(StepSchema).min(1).max(60),
  targeting: TargetingSchema.optional(),
  status: z.enum(["draft", "live", "paused", "archived"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// FLOW
export const FlowSchema = z.object({
  schemaVersion: SchemaVersionSchema,
  id: IdSchema,
  projectId: IdSchema,
  name: z.string().min(1).max(100),
  status: z.enum(["draft", "live", "archived"]),
  variants: z.array(VariantSchema).min(1).max(20).refine(
    (variants) => {
      const liveVariants = variants.filter(v => v.status === "live");
      if (liveVariants.length === 0) return true;
      return liveVariants.reduce((sum, v) => sum + v.weight, 0) === 100;
    },
    "Live variant weights must sum to exactly 100"
  ),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// RESOLVED FLOW (what SDK receives)
export const ResolvedFlowSchema = z.object({
  schemaVersion: SchemaVersionSchema,
  flowId: IdSchema,
  variantId: IdSchema,
  variantName: z.string(),
  steps: z.array(StepSchema),
});

export type Flow = z.infer<typeof FlowSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type Step = z.infer<typeof StepSchema>;
export type ResolvedFlow = z.infer<typeof ResolvedFlowSchema>;
```

### Screen Registry Schema

Separate from flows: each project has a registry of screens, with field schemas and lifecycle awareness.

```typescript
const FieldTypeSchema = z.enum([
  "text",
  "longText",
  "image",
  "video",
  "color",
  "number",
  "boolean",
  "url",
]);

const FieldSchemaSchema = z.object({
  key: z.string().min(1).max(64),
  type: FieldTypeSchema,
  label: z.string().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  required: z.boolean().default(false),
});

const BuildEnvironmentSchema = z.enum(["debug", "testflight", "production"]);

export const RegisteredScreenSchema = z.object({
  projectId: IdSchema,
  screenKey: z.string().min(1).max(64),
  displayName: z.string().optional(),
  thumbnailURL: z.string().url().optional(),
  fields: z.array(FieldSchemaSchema).default([]),
  // Build awareness: which environments have reported this screen
  seenInEnvironments: z.array(BuildEnvironmentSchema).default([]),
  productionFirstSeenAt: z.string().datetime().optional(),
  productionAppVersion: z.string().optional(),
  registeredVia: z.enum(["dashboard", "sdk"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type RegisteredScreen = z.infer<typeof RegisteredScreenSchema>;
```

---

## 10. Remote Config

The mechanism that makes V1 useful for ongoing content changes within existing screens.

### The Idea

Each step within each variant carries a JSON payload of typed values. The customer's view code reads these values via the SDK and displays them. Customer can change these values from the dashboard without an app build, as long as the view was originally written to read from remote config.

### Field Schemas Declared in Swift

When a customer registers a screen, they declare its expected fields:

```swift
Foyer.register(
    "welcome",
    fields: [
        .text("headline", default: "Welcome to Pulse"),
        .longText("body", default: "Get fit in 30 days"),
        .image("backgroundImage"),
        .text("buttonText", default: "Get Started"),
    ]
) { context, advance in
    AnyView(WelcomeView(context: context, onContinue: advance))
}
```

The SDK ships this declaration to the backend on first launch. The dashboard auto-builds a typed form per screen for editing remote config values.

### Field Types

- **text:** single-line string
- **longText:** multi-line string with optional Markdown
- **image:** URL to an image (customer uploads to dashboard, stored in Supabase Storage)
- **video:** URL to a video
- **color:** hex color string
- **number:** numeric value
- **boolean:** true/false
- **url:** general URL

### How the Customer Reads Values

```swift
struct WelcomeView: View {
    let context: FoyerStepContext
    var onContinue: () -> Void

    var body: some View {
        ZStack {
            AsyncImage(url: context.remoteConfig.imageURL("backgroundImage"))

            VStack(spacing: 20) {
                Text(context.remoteConfig.string("headline"))
                    .font(.largeTitle)

                Text(context.remoteConfig.longText("body"))
                    .font(.body)

                Button(context.remoteConfig.string("buttonText")) {
                    onContinue()
                }
            }
        }
    }
}
```

Every accessor returns the field value if set, otherwise the declared default, otherwise the type's zero value. Views never crash on missing remote config.

### Variable Interpolation

String values support `{{user.fieldname}}` interpolation. Foyer substitutes from the user's flow answers at render time.

Example: `"Hey {{user.name}}, you're {{user.daysLeft}} days from your goal!"`

### Dashboard UX

For each screen in each variant, the dashboard shows a form auto-built from the registered field schema:

```
Step: welcome — Variant: Facebook Test
────────────────────────────────────

Headline (text)
[Get fit in 30 days                         ]
21 / 30 characters

Body (long text)
[Personalized plans designed for women      ]
[who train at home with minimal equipment   ]
58 / 120 characters

Background image (image)
[🖼️ welcome-bg-women.jpg]  [Replace]

Button text (text)
[Start free trial                            ]
17 / 20 characters

[Save draft]  [Save & publish]
```

Non-developers can edit safely. No JSON, no syntax errors. Character counters and validation prevent layout-breaking content.

### Schema Evolution

When a customer adds a new field in code and ships an update, the dashboard shows the new field on next SDK ping. Old variants without the new field get the field's default value. Customers can update existing variants to include the new field's content.

If a customer removes a field, existing variants keep their values for that field (they're ignored). No data loss.

If a customer changes a field's type, the SDK falls back to default. Dashboard warns about the change.

### Draft vs Published

Each variant has both a draft state and a published state. Changes save to draft by default. Customers verify drafts in their dev/TestFlight builds (with SDK dev-mode cache bypass enabled), then publish when ready. Only published variants serve to production users.

---

## 11. Database Schema

Postgres tables in Supabase. Managed via Drizzle Kit migrations.

```sql
-- PROJECTS
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  api_key_hash TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'growth')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_projects_api_key_hash ON projects(api_key_hash);
CREATE INDEX idx_projects_owner ON projects(owner_user_id);

-- REGISTERED SCREENS (per project)
CREATE TABLE registered_screens (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  screen_key TEXT NOT NULL,
  display_name TEXT,
  thumbnail_url TEXT,
  field_schema JSONB NOT NULL DEFAULT '[]',
  seen_in_environments TEXT[] DEFAULT ARRAY[]::TEXT[],
  production_first_seen_at TIMESTAMPTZ,
  production_app_version TEXT,
  registered_via TEXT NOT NULL CHECK (registered_via IN ('dashboard', 'sdk')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, screen_key)
);
CREATE INDEX idx_screens_project ON registered_screens(project_id);

-- FLOWS
CREATE TABLE flows (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'archived')),
  schema_version TEXT NOT NULL DEFAULT '1.0',
  flow_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_flows_project ON flows(project_id);
CREATE INDEX idx_flows_status ON flows(status);

-- FLOW ASSIGNMENTS (sticky variant assignment per user)
CREATE TABLE flow_assignments (
  user_id TEXT NOT NULL,
  flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL,
  attribution JSONB,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, flow_id)
);
CREATE INDEX idx_assignments_flow ON flow_assignments(flow_id);
CREATE INDEX idx_assignments_variant ON flow_assignments(variant_id);

-- USER IDENTITIES (anonymous → real user upgrades)
CREATE TABLE user_identities (
  anonymous_id TEXT PRIMARY KEY,
  real_user_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  identified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_identities_real ON user_identities(real_user_id);
CREATE INDEX idx_identities_project ON user_identities(project_id);

-- EVENTS
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  flow_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  step_id TEXT,
  step_index INTEGER,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'flow_started',
    'step_viewed',
    'step_completed',
    'step_skipped',
    'flow_completed',
    'flow_abandoned',
    'fallback_used'
  )),
  answers JSONB,
  attribution JSONB,
  client_timestamp TIMESTAMPTZ NOT NULL,
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);
CREATE INDEX idx_events_project_time ON events(project_id, server_timestamp DESC);
CREATE INDEX idx_events_flow_variant ON events(flow_id, variant_id, event_type);
CREATE INDEX idx_events_user ON events(user_id, flow_id);
CREATE INDEX idx_events_step ON events(flow_id, variant_id, step_id);

-- ROW LEVEL SECURITY
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE registered_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own projects" ON projects
  FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE USING (owner_user_id = auth.uid());

CREATE POLICY "Users can read their screens" ON registered_screens
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE owner_user_id = auth.uid())
  );
CREATE POLICY "Users can write their screens" ON registered_screens
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "Users can read their flows" ON flows
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE owner_user_id = auth.uid())
  );
CREATE POLICY "Users can write their flows" ON flows
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "Users can read their events" ON events
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE owner_user_id = auth.uid())
  );

-- SDK access uses service_role bypass — no RLS for backend operations
```

---

## 12. Variant Assignment Algorithm

### Goals

1. Sticky per user — same user → same variant forever
2. Deterministic — pure function of inputs, no coin flips at runtime
3. Even distribution — actual traffic matches configured weights at scale
4. Targeting-aware — respects attribution rules
5. Fast — sub-10ms

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
    if (variant && variant.status === "live") {
      return { variantId: existing.variantId, variant };
    }
    // If variant was paused/archived, fall through to reassign
  }

  // 2. Filter to live variants only
  const liveVariants = flow.variants.filter(v => v.status === "live");
  if (liveVariants.length === 0) {
    throw new Error("No live variants for flow");
  }

  // 3. Filter by targeting rules
  const eligibleVariants = liveVariants.filter(v => {
    if (!v.targeting?.rules?.length) return true;
    return v.targeting.rules.every(rule => evaluateRule(rule, attribution));
  });

  if (eligibleVariants.length === 0) {
    // No targeted variant matches; fall back to untargeted variants
    const untargeted = liveVariants.filter(v => !v.targeting?.rules?.length);
    if (untargeted.length === 0) {
      throw new Error("No eligible variants for user");
    }
    eligibleVariants.push(...untargeted);
  }

  // 4. Deterministic hash
  const hash = sha256Hash(`${userId}:${flow.id}`);
  const bucket = (hashToUInt32(hash) / 0xFFFFFFFF) * 100;

  // 5. Walk variants, accumulate weight
  let cumulative = 0;
  let chosenVariant: Variant | null = null;
  for (const variant of eligibleVariants) {
    cumulative += variant.weight;
    if (bucket < cumulative) {
      chosenVariant = variant;
      break;
    }
  }

  if (!chosenVariant) {
    chosenVariant = eligibleVariants[eligibleVariants.length - 1];
  }

  // 6. Persist
  await db.flowAssignments.upsert({
    userId,
    flowId: flow.id,
    variantId: chosenVariant.id,
    attribution: attribution ?? null,
  });

  return { variantId: chosenVariant.id, variant: chosenVariant };
}
```

### Identity Upgrades

When a user is anonymous during onboarding and later signs up:

```typescript
async function identify(anonymousId: string, realUserId: string, projectId: string) {
  await db.userIdentities.upsert({ anonymousId, realUserId, projectId });
  await db.flowAssignments.updateMany({
    where: { userId: anonymousId },
    set: { userId: realUserId },
  });
}
```

This preserves sticky variant assignment across the auth event.

---

## 13. The Swift SDK

### Public API Surface

```swift
import SwiftUI

// MARK: - Configuration

extension Foyer {
    public static func configure(
        apiKey: String,
        environment: Environment = .production,
        fallbackFlow: LocalFlow? = nil
    )
}

public enum Environment {
    case production
    case staging
    case development  // disables variant cache, always fetches latest
    case custom(baseURL: URL)
}

// MARK: - Screen Registration

extension Foyer {
    public static func register(
        _ screenKey: String,
        fields: [FoyerField] = [],
        view: @escaping (FoyerStepContext, @escaping () -> Void) -> AnyView
    )
}

public enum FoyerField {
    case text(String, default: String? = nil)
    case longText(String, default: String? = nil)
    case image(String)
    case video(String)
    case color(String, default: String? = nil)
    case number(String, default: Double? = nil)
    case boolean(String, default: Bool? = nil)
    case url(String, default: String? = nil)
}

// MARK: - Step Context

public struct FoyerStepContext {
    public let priorAnswers: [String: Any]
    public let flowId: String
    public let variantId: String
    public let stepIndex: Int
    public let totalSteps: Int
    public let remoteConfig: FoyerRemoteConfig
    public let onAbandon: () -> Void
}

public struct FoyerRemoteConfig {
    public func string(_ key: String) -> String
    public func longText(_ key: String) -> String
    public func imageURL(_ key: String) -> URL?
    public func videoURL(_ key: String) -> URL?
    public func color(_ key: String) -> Color?
    public func number(_ key: String) -> Double
    public func bool(_ key: String) -> Bool
    public func url(_ key: String) -> URL?
}

public struct StepResult {
    public let answers: [String: Any]
    public init(answers: [String: Any] = [:])
}

// MARK: - Flow Start

extension Foyer {
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
    public static func identify(userId: String)
    public static func reset()
}

// MARK: - Attribution

extension Foyer {
    public static func setAttribution(_ attribution: [String: String])
    public static func attachAppsFlyer()
    public static func attachAdjust()
}
```

### Usage Example

```swift
import SwiftUI
import Foyer
import RevenueCat

@main
struct PulseFitnessApp: App {
    init() {
        // Configure Foyer
        #if DEBUG
        Foyer.configure(
            apiKey: "fyr_test_xxx",
            environment: .development,
            fallbackFlow: LocalFlow.pulseOriginal
        )
        #else
        Foyer.configure(
            apiKey: "fyr_live_xxx",
            fallbackFlow: LocalFlow.pulseOriginal
        )
        #endif

        // Register screens with field schemas
        registerOnboardingScreens()

        // RevenueCat
        Purchases.configure(withAPIKey: "appl_xxx")
    }

    private func registerOnboardingScreens() {
        Foyer.register(
            "welcome",
            fields: [
                .text("headline", default: "Welcome to Pulse"),
                .longText("body", default: "Get fit in 30 days"),
                .image("backgroundImage"),
                .text("buttonText", default: "Get Started"),
            ]
        ) { context, advance in
            AnyView(WelcomeView(context: context, onContinue: advance))
        }

        Foyer.register(
            "goal_select",
            fields: [
                .text("headline", default: "What's your goal?"),
                .text("optionLoseWeight", default: "Lose weight"),
                .text("optionBuildMuscle", default: "Build muscle"),
                .text("optionImproveFitness", default: "Improve fitness"),
                .text("buttonText", default: "Continue"),
            ]
        ) { context, advance in
            AnyView(GoalSelectView(context: context, onContinue: advance))
        }

        // ... register remaining screens
    }

    var body: some Scene {
        WindowGroup {
            Foyer.flow("main_onboarding") { result in
                Purchases.shared.setAttributes([
                    "foyer_variant": result.variantId,
                    "foyer_flow": result.flowId,
                ])
                // proceed to main app or paywall
            }
        }
    }
}
```

### Internal Architecture

```
Foyer (public API)
  ├── FoyerCore (singleton state)
  │   ├── Configuration
  │   ├── BuildEnvironment (detects debug/testflight/release, reads bundle version)
  │   ├── ScreenRegistry (screenKey → field schema + view closure)
  │   ├── VariantCache (last successful flow per flowId)
  │   ├── UserIdentity (anonymous UUID + optional real ID)
  │   └── AttributionStore
  ├── FlowController (per active flow)
  │   ├── Loads ResolvedFlow from API/cache/fallback
  │   ├── Tracks current step index
  │   ├── For each step: looks up screen registration, builds context with remote config values, renders
  │   └── Fires events on transitions
  ├── NetworkClient
  │   ├── GET /api/v1/flows/{id}
  │   ├── POST /api/v1/events (batched)
  │   ├── POST /api/v1/identify
  │   └── POST /api/v1/screens/register (reports field schemas + build environment)
  └── EventLogger (local queue, batched upload, retry)
```

### Build Environment Detection

The SDK detects which environment it's running in and reports this on screen registration:

```swift
enum BuildEnvironment {
    case debug         // running from Xcode
    case testflight    // installed via TestFlight
    case production    // installed from App Store
}

func detectBuildEnvironment() -> BuildEnvironment {
    #if DEBUG
    return .debug
    #else
    let receiptURL = Bundle.main.appStoreReceiptURL?.path ?? ""
    if receiptURL.contains("sandboxReceipt") {
        return .testflight
    }
    return .production
    #endif
}
```

This enables the screen lifecycle management feature in Section 14.

### Fallback Behavior

```swift
func loadFlow(_ flowId: String) async -> ResolvedFlow {
    do {
        let flow = try await withTimeout(2.0) {
            try await networkClient.fetchFlow(flowId)
        }
        await variantCache.store(flow)
        return flow
    } catch {
        if let cached = await variantCache.load(flowId) {
            logEvent(.fallbackUsed, reason: "cache")
            return cached
        }
        if let fallback = configuration.fallbackFlow {
            logEvent(.fallbackUsed, reason: "local")
            return fallback.toResolvedFlow(flowId: flowId)
        }
        fatalError("No flow available and no fallback configured")
    }
}
```

### Performance Budget

- SDK initialization: <100ms
- Flow fetch (cached): <50ms
- Flow fetch (network): <2s before fallback
- Event log (queued): <5ms
- Bundle size: <500KB uncompressed

---

## 14. Screen Lifecycle Management

A V1 feature that prevents a real failure mode: customers creating variants with screens that don't exist in their production binary, leading to user crashes or fallback behavior.

### The Problem

Customer registers a new screen in their development build. The dashboard sees the new screen and shows it as available. Customer creates a variant including the new screen and publishes it to production. But the new screen isn't in the production binary yet — production users hit fallback or crash.

### The Solution

The SDK reports its build environment (debug/testflight/production) along with screen registrations. The dashboard knows which screens are "in production" and which are "in testing only."

### Dashboard Behavior

**Screen registry shows lifecycle status:**

```
Registered Screens
─────────────────

✓ welcome              In production (v2.4.0)
✓ name_input           In production (v2.4.0)
✓ goal_select          In production (v2.4.0)
✓ social_proof         In production (v2.4.0)
⚠ morning_evening      In TestFlight only (v2.5.0)
⚠ commitment_screen    In Debug only — never shipped
```

**Variants warn when including non-production screens:**

When a customer tries to add an "In TestFlight only" or "Debug only" screen to a live variant, the dashboard shows a warning:

```
⚠️ This screen isn't in your production app yet.

"morning_evening" was first seen in TestFlight v2.5.0 on May 10, 2026.
It hasn't been seen in a production build.

If you publish this variant, users on production builds will hit your
fallback flow when they reach this step.

[Cancel]  [Add anyway — variant won't auto-publish]
```

**Variants with non-production screens can be drafted but not published:**

The publish button is disabled with a clear explanation: "Cannot publish — variant contains screens not in production. Ship your latest build to App Store and confirm the screen is in production, then return to publish."

### Auto-Promotion

Once the SDK reports a screen has been seen in a production build, the dashboard updates automatically:
- Screen lifecycle changes to "In production"
- Records the production app version where it first appeared
- Any draft variants using the screen become eligible to publish

### Why This Matters

Without this feature, the failure mode is silent and confusing — variants look like they should work, but production users get fallback behavior. With this feature, the dashboard prevents the misconfiguration before it happens, and customers always know exactly which screens are safe to include in live variants.

---

## 15. Backend API

REST API. All endpoints under `/api/v1/`.

### Authentication

- **SDK requests:** `Authorization: Bearer fyr_live_<api_key>`
- **Dashboard requests:** Supabase session cookie

### SDK-Facing Endpoints

#### `GET /api/v1/flows/:flowId`

Get the resolved flow for a user (with variant assigned + remote config values).

**Query params:**
- `userId` (required)
- `attribution` (optional, base64 JSON)

**Response:**
```json
{
  "schemaVersion": "1.0",
  "flowId": "flow_main_onboarding",
  "variantId": "v_facebook_test",
  "variantName": "Facebook Test",
  "steps": [
    {
      "id": "s1",
      "screenKey": "welcome",
      "remoteConfig": {
        "headline": "Get fit in 30 days",
        "body": "Personalized plans...",
        "backgroundImage": "https://cdn.foyer.so/...",
        "buttonText": "Start free trial"
      }
    }
  ]
}
```

#### `POST /api/v1/events`

Batched event logging.

#### `POST /api/v1/identify`

Upgrade anonymous → real user.

#### `POST /api/v1/screens/register`

SDK reports its registered screens, field schemas, and build environment to backend on launch. Backend creates or updates `registered_screens` rows. Dashboard auto-populates and updates lifecycle status.

**Body:**
```json
{
  "buildEnvironment": "production",
  "appVersion": "2.4.0",
  "screens": [
    {
      "screenKey": "welcome",
      "fields": [
        { "key": "headline", "type": "text", "default": "Welcome to Pulse" },
        { "key": "backgroundImage", "type": "image" }
      ]
    }
  ]
}
```

### Dashboard-Facing Endpoints (`/api/internal/`)

- `GET /api/internal/projects` — list user's projects
- `POST /api/internal/projects` — create project
- `GET /api/internal/projects/:id/screens` — list registered screens
- `PATCH /api/internal/projects/:id/screens/:screenKey` — update thumbnail, display name
- `GET /api/internal/flows?projectId=...` — list flows
- `POST /api/internal/flows` — create flow
- `PATCH /api/internal/flows/:id` — update flow (variants, weights, remote config)
- `POST /api/internal/flows/:id/variants` — create variant
- `POST /api/internal/flows/:id/variants/:variantId/duplicate` — duplicate variant
- `PATCH /api/internal/flows/:id/variants/:variantId/status` — change variant status (live/paused/archived)
- `GET /api/internal/analytics/funnel?flowId=...&variantId=...` — per-step drop-off
- `GET /api/internal/analytics/variants?flowId=...` — variant comparison
- `GET /api/internal/analytics/sources?flowId=...` — segment by acquisition source

### Rate Limiting

- SDK endpoints: 100 req/sec per API key
- Event endpoint: 1000 events/sec per API key
- Dashboard endpoints: 60 req/min per user

### Error Envelope

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

## 16. Dashboard

### Pages

```
/                           Marketing landing
/pricing                    Pricing
/docs                       Documentation
/compliance                 Apple compliance page (customer reference)
/login                      Auth
/signup                     Auth

/app                        Dashboard (authenticated)
  /app/projects             List of projects
  /app/projects/:id         Project overview
    /screens                Registered screens (thumbnails, field schemas, lifecycle)
    /flows                  List of flows
    /flows/:id              Flow editor
      /editor               Variant editor (thumbnail tiles, drag-to-order, targeting)
      /content              Per-step remote config editor
      /analytics            Funnel, variant comparison, source segmentation
      /settings             Flow settings
    /settings               Project settings (API key, billing)
```

### Flow Editor

The primary work surface. Shows all variants for a flow at a glance with their status, traffic weights, and targeting:

```
┌──────────────────────────────────────────────────────────────┐
│ Main Onboarding                              [Publish]       │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ Variants                                  [+ Add Variant]     │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ● Control                            LIVE • 34%          │ │
│ │ No targeting                                              │ │
│ │ [📷][📷][📷][📷][📷][📷][📷][📷][📷][📷][📷][📷]         │ │
│ │ 1,247 users • 41.2% completion                            │ │
│ │ [Edit]  [Duplicate]  [Pause]  [Archive]                  │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ● Facebook test                      LIVE • 33%          │ │
│ │ Target: source = facebook                                 │ │
│ │ [📷][📷][📷][📷][📷][📷][📷][📷][📷][📷][📷][📷]         │ │
│ │ 412 users • 47.8% completion (+6.6% vs control)          │ │
│ │ [Edit]  [Duplicate]  [Pause]  [Archive]                  │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ● TikTok test                        LIVE • 33%          │ │
│ │ Target: source = tiktok                                   │ │
│ │ [📷][📷][📷][📷][📷][📷][📷][📷][📷][📷][📷][📷]         │ │
│ │ 389 users • 52.4% completion (+11.2% vs control)         │ │
│ │ [Edit]  [Duplicate]  [Pause]  [Archive]                  │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                                │
│ Total live weight: 100% ✓                                     │
└──────────────────────────────────────────────────────────────┘
```

Each variant shows traffic share, status, targeting, current performance vs control, and quick actions.

### Variant Editor (when you click Edit on a variant)

```
┌──────────────────────────────────────────────────────────────┐
│ Variant: Facebook Test                              [Save]   │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ Targeting                                                      │
│ Source equals [facebook ▼]                       [+ Add rule] │
│                                                                │
│ Weight: 33% [────────●──]                                     │
│                                                                │
│ Steps  (drag to reorder, click to edit content)              │
│ ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                       │
│ │ [📷] │→ │ [📷] │→ │ [📷] │→ │ [📷] │ ...                   │
│ │welcm │  │name  │  │social│  │goal  │                       │
│ └──────┘  └──────┘  └──────┘  └──────┘                       │
│                                                                │
│ Available registered screens (drag to add):                  │
│ ┌──────┐  ┌──────┐  ┌──────┐                                 │
│ │ [📷] │  │ [📷] │  │ [📷] │                                 │
│ │paywl2│  │premim│  │feat1 │                                 │
│ └──────┘  └──────┘  └──────┘                                 │
│                                                                │
│ ⚠ morning_evening (in TestFlight only — cannot publish yet)  │
└──────────────────────────────────────────────────────────────┘
```

### Remote Config Editor

Click a screen tile to edit its remote config values for this variant (see Section 10 for the form UX).

### Analytics View

```
┌──────────────────────────────────────────────────────────────┐
│ Main Onboarding — Analytics              Last 30 days  ▼     │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│ VARIANT COMPARISON                                            │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │                Control    Facebook     TikTok            │ │
│ │ Users           1,247        412          389            │ │
│ │ Completion      41.2%       47.8%       52.4%           │ │
│ │ Avg time        4:32         3:58         4:11          │ │
│ │ vs Control       —          +6.6%       +11.2% 🏆       │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                                │
│ FUNNEL (Control vs Facebook vs TikTok)                        │
│ Step 1: welcome              98% / 98% / 99%                  │
│ Step 2: name_input           94% / 96% / 95%                  │
│ Step 3: social_proof          —  / 91% / 90%                  │
│ Step 4: goal_select          89% / 87% / 88%                  │
│ ...                                                            │
│                                                                │
│ BY ACQUISITION SOURCE                                         │
│ [chart segmenting all variants by source]                     │
└──────────────────────────────────────────────────────────────┘
```

### Implementation Notes

- Drag-and-drop: `dnd-kit`
- Weight inputs: sliders + numeric, auto-normalize to 100 across live variants
- Thumbnail upload: drag-drop or bulk folder upload (match files to keys by filename)
- Saving: optimistic UI with rollback on error
- Publishing: explicit action, scoped to one variant or one flow
- Duplicate variant: one-click action, copies all steps and remote config

---

## 17. Analytics

### V1 Metrics

**1. Variant comparison**

```
Variant         | Users | Completed | Rate   | vs Control
Control         | 1,247 |   513     | 41.2%  |    —
Facebook test   |   412 |   197     | 47.8%  | +6.6%
TikTok test     |   389 |   204     | 52.4%  | +11.2%
```

**2. Per-step funnel**

Per variant: step viewed % → step completed % → drop rate.

**3. Source segmentation**

Each variant's performance broken down by acquisition source.

**4. Time-to-completion**

Average and median per variant.

### Computing the Funnel

```sql
WITH step_views AS (
  SELECT step_id, step_index, COUNT(DISTINCT user_id) AS viewers
  FROM events
  WHERE flow_id = $1 AND variant_id = $2 AND event_type = 'step_viewed'
  GROUP BY step_id, step_index
),
step_completions AS (
  SELECT step_id, COUNT(DISTINCT user_id) AS completers
  FROM events
  WHERE flow_id = $1 AND variant_id = $2 AND event_type = 'step_completed'
  GROUP BY step_id
)
SELECT
  sv.step_id, sv.step_index, sv.viewers,
  COALESCE(sc.completers, 0) AS completers,
  ROUND(100.0 * COALESCE(sc.completers, 0) / NULLIF(sv.viewers, 0), 2) AS completion_rate
FROM step_views sv
LEFT JOIN step_completions sc ON sv.step_id = sc.step_id
ORDER BY sv.step_index;
```

### V2 Metrics (Deferred)

- Statistical significance indicators
- Cohort retention
- Revenue attribution (RevenueCat webhook integration)
- Cross-customer benchmarks ("apps like yours convert at X%")

---

## 18. Attribution & Targeting

### Model

```typescript
{
  source: "facebook",
  campaign: "winter_sale_2026",
  ad_set: "ad_123",
  medium: "paid_social",
  geo: "US",
  device: "iphone",
  app_version: "2.4.0"
}
```

### How Customers Pass Attribution

```swift
// Manual
Foyer.setAttribution([
    "source": "facebook",
    "campaign": "winter_sale_2026"
])

// Or via integrations
Foyer.attachAppsFlyer()
Foyer.attachAdjust()
```

### Variant Targeting

```json
{
  "id": "v_facebook_users",
  "name": "Facebook users — extra social proof",
  "weight": 100,
  "status": "live",
  "steps": [...],
  "targeting": {
    "rules": [
      { "field": "source", "op": "eq", "value": "facebook" }
    ]
  }
}
```

Multi-rule targeting (AND logic):

```json
{
  "targeting": {
    "rules": [
      { "field": "source", "op": "eq", "value": "facebook" },
      { "field": "geo", "op": "in", "value": ["US", "CA", "UK"] }
    ]
  }
}
```

### Edge Cases

- **No attribution data:** only untargeted variants are eligible. If none exist, error.
- **Attribution arrives mid-flow:** logged with subsequent events but doesn't change assignment.
- **No matching variant:** SDK uses fallback flow.
- **Multiple matching variants:** weight-based distribution among them.

---

## 19. RevenueCat Integration

### Pass-Through Pattern

Foyer doesn't integrate with RevenueCat's API. Foyer gives customer the variant ID; customer passes it to RevenueCat as a subscriber attribute.

```swift
Foyer.flow("main_onboarding") { result in
    Purchases.shared.setAttributes([
        "foyer_variant": result.variantId,
        "foyer_flow": result.flowId,
    ])
}
```

Customer sees in RevenueCat dashboard:
- "Trials started by foyer_variant = control: 234 ($1,170 ARR)"
- "Trials started by foyer_variant = facebook_test: 287 ($1,435 ARR)"
- "Trials started by foyer_variant = tiktok_test: 312 ($1,560 ARR)"

### Why This Works

- RevenueCat owns subscription analytics
- Foyer shows "onboarding behavior"; RC shows "revenue outcomes"
- Customers correlate the two themselves (or via warehouse export)

### V2

Pull revenue data from RevenueCat via webhook, surface in Foyer's dashboard for end-to-end variant ROI.

---

## 20. How Customers Use Foyer

Concrete scenario showing what a 90-day testing program looks like for a typical Foyer customer.

### Customer: Pulse Fitness, $180K MRR

Pulse spends $40K/month on Facebook and TikTok user acquisition. They have a 12-step onboarding flow shipped 18 months ago. They've never A/B tested it.

### Day 1: Integration (4 hours)

- Add Foyer SPM package to Xcode
- Register 12 screens in App.swift with field schemas (~30 min)
- Upload thumbnails for each screen via dashboard bulk upload (~15 min)
- Create a "control" variant matching current production order (~5 min)
- Set up RevenueCat handoff
- Ship app build with Foyer integrated, test in TestFlight
- Once verified in TestFlight, ship to App Store, wait 1-2 days for review

### Week 2: First Tests

After production approval, screens auto-promote to "in production" status. Pulse creates first experiments:

**Test 1:** Social proof position. Three variants:
- Control: social proof at step 8
- Variant B: social proof at step 3
- Variant C: no social proof

All untargeted, 33/33/34 split.

**Test 2 (after Test 1 settles, week 4):** Source-based personalization. Three variants:
- Control: original copy
- Facebook variant: urgency-focused headlines, women-focused imagery
- TikTok variant: shorter copy, energetic imagery

Targeted by acquisition source.

### Week 6: Iteration

Pulse sees clear winners. Social proof at step 3 outperforms by 8%. Source-based variants outperform control by 7-14%. They:

- Archive losing variants
- Promote winning variants to control status
- Start Test 3: testing different price-anchor language on step 11
- Start Test 4: testing whether to remove step 9 entirely

### Week 12: Operational Rhythm

By month 3, Pulse runs 4-6 concurrent variants across 2-3 active experiments at any time. Marketing manager spends ~2 hours/week in Foyer dashboard:
- Reviewing previous week's analytics
- Creating new variants for next test
- Adjusting traffic weights based on results
- Archiving losers

Total experiments run in 90 days: 14

Net impact: +18% trial-start rate across full traffic. At $40K/month UA spend converting better, that's ~$7,200/month in additional trial-driven revenue. Annualized: ~$86K.

Foyer Growth tier cost: $199/month, or $2,388/year. ROI: 36x.

### What Makes This Possible

Every test is dashboard-only after initial integration. No engineering involvement. No app builds. No App Store review delays. Marketing manager self-serves the entire program.

This is the operational shift Foyer enables. The capability isn't new — Pulse could have done this with Firebase Remote Config and 200 hours of engineering work. The workflow is what's new.

---

## 21. Brand & Design

### Brand Colors

- **Primary:** Indigo `#6366F1`
- **Secondary:** Violet `#8B5CF6`
- **Gradient:** primary → secondary (top to bottom)

Use Tailwind slate/gray for everything else.

### Logo

- Stylized arched doorway with doorknob
- Concept: Foyer = entrance hall, the room before the room
- Files in `apps/dashboard/public/`

### Voice & Tone

- Direct, growth-team vocabulary ("lift," "conversion," "winners," "experiments")
- Confident but not hyperbolic
- Linear / Vercel territory for design feel
- Numbers and outcomes over adjectives

### Dashboard Design Principles

- Minimal chrome, content-first
- Brand indigo as primary data color in charts
- Empty states are friendly but not chatty
- Forms validate inline, never on submit
- Confirmations for destructive actions only

### Typography

- **Family:** Inter (via `next/font/google`)
- **Headings:** Inter Medium, tight tracking
- **Body:** Inter Regular
- **Code/IDs:** JetBrains Mono

---

## 22. Pricing Model

### Tiers

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | $0/mo | 1 flow, 2 variants, full analytics, fallback, thumbnail upload, screen lifecycle |
| **Starter** | $49/mo | Unlimited flows, up to 5 concurrent variants per flow, basic targeting, email support |
| **Growth** | $199/mo | Unlimited variants, advanced multi-attribute targeting, priority support, integration help |
| **Enterprise** | Custom | Volume, SLAs, dedicated support, custom integrations |

### Tier Design Philosophy

Tiers reflect testing maturity:
- **Free:** trying out the workflow on one flow
- **Starter:** active testing program, small team
- **Growth:** serious testing operation with source-based personalization
- **Enterprise:** large teams with custom needs

### The Free → Paid Trigger

The Free tier allows 1 flow and 2 variants — enough to run a single A/B test end-to-end. The moment a customer wants a third variant (e.g., adding a third source-targeted variant), or a second flow (e.g., a reactivation flow), they hit the upgrade trigger.

This is intentional: customers who only run one test are not the ICP. Customers who want to run multiple tests in parallel will gladly pay.

### Pricing Position vs Firebase

Firebase Remote Config is free. Foyer's pricing reflects workflow value, not capability value:

> "Firebase gives you the bricks for free. Foyer gives you the assembled testing program. The first time you avoid a week of engineering on a test, Foyer has paid for a year."

### Billing

- V1: manual invoicing for first 10-20 customers (build the relationship)
- After V1 traction: Stripe Checkout + Customer Portal

---

## 23. Complexity Assessment

### Ranked by Risk

**1. Swift SDK reliability and ergonomics (highest risk)**

The SDK is in customer apps. Bugs there cause user-facing crashes that damage Foyer's reputation.

Mitigations:
- Tiny public API surface
- Aggressive timeouts (2s)
- Comprehensive fallback (cache → local → safe error)
- Local event queue persists across crashes
- TestFlight dogfood with existing app before public SDK release
- Swift strict concurrency from day one
- Comprehensive test suite

**2. Dashboard UX for variant management (medium-high risk)**

The dashboard is the workspace. If it's not fast, intuitive, and reliable, customers don't use it.

Mitigations:
- shadcn/ui for consistency
- React Hook Form + Zod resolvers
- Iterate with first 3-5 customers before public launch
- One-click variant duplication is P0
- Drag-and-drop must work flawlessly on long screen lists

**3. Apple compliance perception (medium risk)**

Customers may be wary of integrating "something that changes the app post-review."

Mitigations:
- Compliance page on foyer.so addresses 2.5.2/2.3.1 directly
- App Store review notes template provided to customers
- Legal opinion before public launch
- Conservative architecture: every screen Foyer shows is reviewed
- Screen lifecycle management prevents accidental misconfiguration

**4. Attribution timing (medium risk)**

AppsFlyer/Adjust attribution arrives async after launch.

Mitigations:
- SDK supports delayed `setAttribution`
- Customer can defer `Foyer.flow(...)` until attribution callback fires
- Document clearly with examples

**5. Variant weight invariants (low risk)**

Mitigations:
- Zod enforces live variant weights sum to 100
- Dashboard auto-normalizes when customer adjusts
- Backend rejects invalid flows

**6. Analytics query performance at scale (medium risk later)**

Mitigations:
- Index strategy covers main query patterns
- Cache analytics responses for 5 min per project
- Evaluate ClickHouse/Tinybird when event volume exceeds ~10M/month

**7. Schema versioning (low risk in V1)**

V1 ships with `schemaVersion: "1.0"`. Future versions require migration logic in the SDK to handle older schemas gracefully.

Mitigations:
- SDK validates `schemaVersion` on fetch
- Falls back to cached/local on mismatch
- Plan for `schemaVersion: "2.0"` migration path documented before V2 ships

---

## 24. Build Plan

8 weeks to V1 launch. Solo development with focused weekly milestones.

### Week 0 — Infrastructure (COMPLETE)

- ✅ Domain (foyer.so) purchased and DNS configured
- ✅ GitHub org (foyerhq) and repo created
- ✅ Vercel project deployed
- ✅ Supabase project provisioned
- ✅ Monorepo scaffolded with Turborepo
- ✅ Brand assets in place

### Week 1 — Schema + Database

- Set up Drizzle, connect to Supabase
- Write Zod schemas in `packages/shared/src/schema/`
- Generate Drizzle table definitions
- Run migrations, set up RLS policies
- Set up Supabase Auth (Email + Google + GitHub OAuth)
- Build login/signup pages + protected routes
- Health check route at `/api/health`

### Week 2 — Backend API + Dashboard Shell

- Implement `/api/v1/flows/:flowId` endpoint
- Implement variant assignment algorithm
- Implement `/api/v1/events` endpoint
- Implement `/api/v1/screens/register` endpoint
- Build dashboard navigation (projects list, project overview, flows list)
- Build flows list and create flow flow

### Week 3 — Dashboard MVP

- Flow editor: variants list, status, weights, targeting display
- Variant editor: drag-to-reorder, add/remove screens
- Remote config form editor (auto-built from field schemas)
- Variant duplication, archive, pause
- Screen registry view with lifecycle status
- Thumbnail upload (single + bulk)

### Week 4 — Swift SDK MVP

- Public API surface (`Foyer.configure`, `Foyer.register`, `Foyer.flow`)
- Screen registry with field schemas
- Build environment detection
- Network client with timeouts and retries
- Variant cache (UserDefaults-backed)
- Flow controller with step transitions
- Event logger with batched upload
- Remote config delivery to step contexts
- Fallback flow handling
- Local test app for development

### Week 5 — Integration & Dogfooding

- Dogfood SDK against existing iOS app
- Build canonical example iOS app demonstrating common patterns
- Write `docs/INTEGRATION_GUIDE.md`
- Write `docs/SDK_API.md`
- Fix issues found during dogfooding
- Add unit tests for SDK
- Add integration tests for backend

### Week 6 — Analytics

- Implement funnel query
- Implement variant comparison query
- Implement source segmentation query
- Build analytics dashboard pages
- Add Recharts visualizations
- Test with seeded data

### Week 7 — Polish + Compliance

- Marketing landing page
- Pricing page
- Compliance page (Apple 2.5.2/2.3.1 framing)
- Documentation site
- Commission legal opinion
- Set up Sentry
- Onboarding flow for new customers
- Email templates (welcome, billing, etc.)

### Week 8 — Beta Launch

- Invite 5-10 hand-picked beta customers
- Manual billing setup
- Live support via Slack/email
- Iterate based on feedback
- Public launch preparation

### After Week 8

- Public launch
- Continuous iteration based on customer feedback
- No V1.5 planned — the product is V1
- V2 priorities determined by 60-day customer signal

---

## 25. First Commits

When development starts in Week 1, the first commits will look like:

```bash
# Week 1, Day 1
feat: add Zod schemas for flow, variant, step
feat: add Drizzle table definitions
feat: connect dashboard to Supabase
feat: add initial migrations

# Week 1, Day 2
feat: set up Supabase Auth with Email provider
feat: add login and signup pages
feat: add protected route middleware

# Week 1, Day 3-5
feat: add Google OAuth provider
feat: add GitHub OAuth provider
feat: add API key generation for new projects
test: add tests for variant assignment algorithm
```

Each commit is atomic, well-described, and pushed to main with passing CI.

---

## 26. Open Questions

Resolved during this session:
- ~~V1 vs V1.5 phasing~~ → V1.5 removed entirely
- ~~Theme system in V1~~ → No theme system, no renderer ever
- ~~Live preview~~ → Customers use their own dev/TestFlight builds
- ~~Thumbnail capture mechanism~~ → Manual upload
- ~~Remote config UX~~ → Typed form with field schemas declared in Swift
- ~~Adapty positioning~~ → Drop Adapty comparisons, focus on Firebase comparison

Still open:

**1. Screen lifecycle promotion behavior.** Should screens auto-promote to "in production" on first production sighting, or require manual confirmation? Lean toward auto-promote with audit log.

**2. Multi-flow projects vs single-flow projects.** V1 supports unlimited flows per project. Should the free tier allow 1 flow only? Lean toward yes — drives Starter upgrade.

**3. CLI tooling.** Should V1 ship with a `foyer` CLI for bulk operations (variant export/import, screenshot upload, schema validation)? Lean toward V1.5 — wait for signal.

**4. Customer-facing variant labels.** Should variants have customer-facing names (visible in URLs, exports) separate from internal IDs? Probably yes for human-readability.

**5. Statistical significance indicators in analytics.** When do we add "winner" labels with p-value? V2 territory, but customers may ask early.

**6. Webhooks for variant events.** Should Foyer send webhooks when variants are published, paused, or significantly diverge in performance? Useful for customer automation. V2.

**7. Cross-customer benchmarks.** Foyer could eventually surface "apps in your category convert at X%" — a moat Firebase structurally can't build. V2+ direction.

**8. AppsFlyer/Adjust integration depth.** Should `attachAppsFlyer()` etc. be full implementations or stubs in V1? Lean toward stubs in V1, full implementations as customer demand surfaces.

---

## 27. Startup Programs

Programs to apply to once Foyer has minimal traction (3-5 paying customers):

- **Y Combinator** — Spring 2027 batch if relevant
- **AWS Activate** — credits for any future AWS usage
- **Anthropic Startup Program** — when Anthropic API usage matters
- **Vercel for Startups** — discounted Pro plan
- **Supabase Startup Program** — credits and dedicated support
- **Stripe Atlas** — only if Delaware C-corp incorporation needed

Don't apply before having customer traction. Programs reward early signal.

---

## 28. Glossary

- **Flow** — a named onboarding sequence (e.g., "main_onboarding")
- **Variant** — one version of a flow, composed of an ordered list of steps with remote config values
- **Step** — a single screen within a variant, referencing a screenKey with remote config values
- **Screen** — a registered SwiftUI view in the customer's app, identified by a screenKey
- **Screen key** — stable string identifier for a screen ("welcome", "goal_select", etc.)
- **Field schema** — declared types of remote config values a screen reads (text, image, etc.)
- **Remote config** — per-step, per-variant content values the SDK delivers and the customer's view reads
- **Targeting** — rules that determine which users see which variants (by source, geo, device, etc.)
- **Attribution** — data about user acquisition (source, campaign, ad set, etc.)
- **Assignment** — the variant a specific user is assigned to; sticky once made
- **Funnel** — sequence of step-completion rates within a variant
- **Build environment** — debug, testflight, or production; reported by SDK on screen registration
- **Screen lifecycle** — tracking which screens are in which build environments to prevent variant misconfiguration

---

**End of BUILD.md v2.**

Decisions made in v2 (May 12, 2026):
- Removed V1.5 renderer entirely; Foyer is permanently a configuration platform, never a design tool
- Repositioned as "A/B testing platform for iOS subscription onboarding" (sharper than "remote config")
- Added Section 4 (Apple Compliance) to address concerns directly
- Added Section 14 (Screen Lifecycle Management) to prevent variant misconfiguration
- Added Section 20 (How Customers Use Foyer) with concrete usage scenario
- Dropped Adapty comparisons throughout
- Sharpened Firebase Remote Config comparison as primary competitive positioning
