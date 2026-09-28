# Panel decoupling pattern (#3459)

This is the template #3471 rolls out to the other five bespoke apps (Business Glossary, Data
Stewardship, Risk & Compliance, Strategy & Capability Model, Vendor Management).

**Decision: explicit props, no context provider.** The panels extracted in #3458
(`ApiIntegrationCatalogStatTiles`, `ApiIntegrationCatalogNeedsAttentionPanel`,
`ApiIntegrationCatalogMostConsumedPanel`, `ApiIntegrationCatalogAtRiskPanel`, plus
`ApiBlastRadiusPanel` from #3320) never import `useParams`/`useSearch`/`useNavigate` or any other
router hook, directly or transitively through the hooks they call. Each `*Screen.tsx` file is the
router boundary: it's the only place that reads `useParams`/`useSearch`, and it resolves that into
plain ids/strings/callbacks passed down as props (see `ApiIntegrationCatalogOverviewScreen.tsx`).
Panels are pure prop-consumers with their own React Query data-fetching.

This was chosen over a `WorkspaceContext`/`MdxContext`-style context provider
(`web/src/layouts/WorkspaceContext.ts`, `web/src/sections/markdown/MdxContext.ts`) because those
exist to serve dashboard **widgets**, which are dynamically selected at render time by a
config-driven registry (`mdxRegistry.tsx`) — the renderer can't statically type-check per-widget
props, so ambient context is the only way to give every widget the data it needs. App panels are
the opposite: each Screen statically imports and renders a small, known set of panels one level
deep (Screen → Panel, no intermediate layers), so there's no prop-drilling problem to solve, and
keeping props keeps each panel's full input surface visible in its own `Props` type — which is what
makes `*.stories.tsx` files for these panels straightforward (see e.g.
`ApiBlastRadiusPanel.stories.tsx`): a plain prop object plus seeded React Query data, no router or
context faking required.

If a later app's panel tree grows deep enough for this to become real prop-drilling pain, that app
can introduce its own context then, following `WorkspaceLayout.tsx` → `WorkspaceContext` as the
template (read the router once at the top, provide a typed context) — but none of the six apps need
that today.
