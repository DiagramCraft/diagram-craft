# Entity Query Language — Design Spec (#2317)

Status: v1 implemented. This document describes the grammar and intermediate representation (IR) for relation-traversal
entity queries in Arch Register, grounded in the seeded workspace data model. The implementation is wired into entity
listing, counting, saved views, the text-query API, and the Advanced query UI.

## 1. Problem recap

Today's saved-view filtering (`filterConditionSchema` in
`arch-register-packages/api-types/src/viewContract.ts`) is a flat, implicitly-AND-ed array of
`{ fieldId, op, value }` conditions on a single entity. It cannot express:

- "entities related to entities matching some other condition" (relation traversal)
- OR / NOT / grouping
- rollups through a containment hierarchy (#2315)
- filtering on a field carried by a linked entity rather than the entity itself (#2300)

This spec defines a small query language — field predicates + boolean grouping + relation traversal — with a textual
syntax and a structured IR that the same grammar compiles to/from, per the issue's two-representations requirement.

## 2. Grounding in the seeded data model

Schema fields (`SchemaField` in `schemaContract.ts`) relevant to traversal:

- `type: 'reference'` — a named, directional link to another schema, cardinality `minCount`/`maxCount`. Example:
  `Component.technology_releases` (`predicate: 'uses'`) → `Technology Release`.
- `type: 'containment'` — a parent-child link, always singular on the child side (`maxCount` typically `1`). Example:
  `Component.system` (`predicate: 'belongs to'`) → `System`; `System.domain` → `Domain`;
  `Technology Release.technology` → `Technology`.
- `type: 'select'` — enum-backed scalar (`Technology.category`, `Technology Release.radar_status`, ...).
- `type: 'text' | 'date'` — plain scalars (`Technology Release.eol_date`, `.active_support_until`, ...).

Seeded containment/reference chain used in examples below:

```
Domain ← (containment: system.domain) ← System ← (containment: component.system) ← Component
Component ── (reference: component.technology_releases, "uses") ──▶ Technology Release
Technology Release ── (containment: technology_release.technology, "belongs to") ──▶ Technology
Resource behaves like Component: has technology_releases (reference) and system (containment, optional)
```

Assessment fields are not schema fields — they come from a single *joined* assessment
(`EntityQuery.assessmentId` in `entityQueryIR.ts`), addressed today as pseudo-field-ids
`_assessment` (presence) and `_assessment:<fieldId>` (`ASSESSMENT_FIELD_PREFIX` in
`api-types/src/assessmentFilter.ts`). The grammar keeps this addressing scheme rather than inventing a new one.

`matchesFilterCondition` (`dataHelpers.ts`) also already special-cases a handful of underscore pseudo-fields
(`_schemaId`, `_lifecycle`, `_owner`, `_name`, `_slug`, `_description`, `_namespace`, `_completeness`,
`_updatedAt`, `_tags`) alongside real schema fields — but notably **not** an entity-identity field. That gap matters for
this grammar: #2315 (below) is phrased as "given an entity, find..." — anchoring a traversal at one specific instance,
not at a value predicate like `_slug = "go"`. The grammar adds `_id` to this same underscore family
(`_id = <entity-id>`, reusing `equals`/`not_equals`) to cover that; it doesn't exist in
`filterConditionSchema` today and would need to land there too (or be handled by the query executor directly), but it's
a small, precedented addition alongside the existing underscore fields.

## 3. Design goals / non-goals

Goals: field predicates (reuse existing `op` set), boolean grouping (`AND`/`OR`/`NOT`), bounded relation traversal
(named forward/backward single hops, chained), one grammar with two representations (text ⇄ structured IR), assessment
fields addressable at any traversal depth.

Non-goals (per issue): arbitrary joins outside the entity graph, user-defined functions, aggregates beyond simple
counts, replacing the flat `filterConditionSchema` in one pass.

## 4. Textual grammar

Qualifier-style syntax, similar in spirit to GitHub/Jira search (`field:value`), extended with dotted paths for
traversal and explicit boolean operators for grouping (unlike GitHub's implicit-AND, since grouping needs `()`).

### 4.1 EBNF

```ebnf
query           := or_expr
or_expr         := and_expr ( "OR" and_expr )*
and_expr        := unary_expr ( ["AND"] unary_expr )*      (* juxtaposition = implicit AND *)
unary_expr      := "NOT" unary_expr
                 | "(" or_expr ")"
                 | predicate

predicate       := free_text
                 | path comparator value
                 | path                                     (* shorthand for path:not_empty *)

free_text       := "text" ( ":" | "=" ) quoted_string       (* starting entity list only *)

path            := segment ( "." segment )*
segment         := step [ "[" or_expr "]" ]                  (* optional scoped sub-condition, see 4.3 *)
step            := field_id
                 | "<-" [ schema_ref "." ] field_id            (* reverse traversal; schema_ref required if ambiguous, see 4.2 *)

field_id        := identifier                                (* schema field id, e.g. eol_date, technology_releases *)
                 | "_assessment"
                 | "_assessment:" identifier
                 | "_id"                                      (* anchor to one specific entity instance, see §2 *)
                 | "_schemaId" | "_lifecycle" | "_owner" | "_name" | "_slug"
                 | "_description" | "_namespace" | "_completeness" | "_updatedAt" | "_tags"

comparator      := ":" | "=" | "!=" | "~" | "^=" | "$="
                 | ">" | ">=" | "<" | "<="
value           := quoted_string
                 | number
                 | "date" "(" quoted_string ")"
                 | "enumValue" "(" quoted_string ")"
                 | "enumLabel" "(" quoted_string ")"
                 | "empty" | "not_empty"                  (* bare keyword literals, not quoted_string — see below *)

quoted_string   := '"' ( any character except unescaped " or \ ) * '"'
                                                          (* the only two valid escapes are \" and \\; any other
                                                             backslash sequence is a parse error — resolves the
                                                             open question this line used to flag, see §10 *)
schema_ref      := identifier | quoted_string            (* bare identifier only when the schema name has no
                                                             spaces or other identifier-breaking characters *)
```

- `path` resolves left-to-right: every segment except the last is a traversal step; the last segment is the field the
  predicate applies to, evaluated on whatever entity the path has traversed to.
- `field:value` (`:` / `=`) → `equals`; `!=` → `not_equals`; `~` → `contains`; `^=`/`$=` → `starts_with`/`ends_with`;
  `>`,`>=`,`<`,`<=` map to date `after`/`gte`-ish and numeric comparisons already in `filterConditionSchema`'s `op`
  enum (`before`/`after`/`gt`/`lt`/`gte`/`lte`); a bare `path` with no comparator means `not_empty`.
- `text:"needle"` is a dedicated free-text clause for the starting entity list. It matches `_name`, `_slug`, or
  `_description` using case-insensitive contains semantics. It may participate in the root boolean tree, but it is
  invalid inside a forward/backward relation scope (`[...]`); relation predicates remain field-specific. Empty or
  whitespace-only values are invalid, while an empty browser search omits the clause.
- **`empty`/`not_empty`/`on` comparator gap, resolved:** `empty` and `not_empty` are bare keyword *values*, not a new
  comparator token — `field:empty` / `field = empty` compiles straight to `{ op: 'empty', value: null }`
  (`not_empty` likewise), reusing the existing `:`/`=` comparator rather than inventing a new symbol. Any other
  comparator paired with these keywords (`field != empty`) is a compile-time error, not a silent reinterpretation.
  `on` needs no new token either — it's resolved from the terminal field's type, the same way `<`/`>` already
  resolve to `before`/`after` for dates vs. `lt`/`gt` for numbers (line 112 above): when the terminal field is a
  `date` field and the comparator is `:`/`=`, the op is `on` (exact-date match) instead of `equals`; for every other
  field type `:`/`=` still means `equals` (or the `enumValue` sugar for `select` fields, below).
- `schema:<schema_ref>` is a reserved pseudo-field (not a schema field) constraining the entity type at the *current*
  traversal position — needed because paths can cross schemas and predicates otherwise have no way to disambiguate which
  schema's field they mean when field ids collide (e.g. `category` exists on both `Technology`
  and `Technology Release`). It takes a `schema_ref`, not a general `value` — a deliberate, narrow exception to the
  quoting rule below: `schema:Component` stays bare (schema names come from a small, admin-defined, identifier-like set,
  closer to a keyword than arbitrary data), but a schema name containing a space, like
  `Technology Release`, must be quoted — `schema:"Technology Release"` — since a bare identifier can't contain one. The
  same `schema_ref` production, and the same bare-unless-it-needs-quoting rule, also covers the owner qualifier in
  `<-Schema.field_id` (§4.2) — `<-Component.system` stays bare, but a backward step disambiguated against a
  space-containing schema would need `<-"Technology Release".field_id`.
- **All ordinary string and id `value`s must be double-quoted; there is no unquoted `bare_token` form for them.**
  (`schema_ref`, above, is the one deliberate exception, not a counterexample to this rule — it's a different grammar
  category, not a `value`.) Earlier drafts of this doc used bare, unquoted tokens for ordinary values
  (`technology._slug = go`, `_id = 00000000-0000-0000-0007-000000000003`) — that's gone. Every value that isn't a bare
  number or one of the wrapped forms below must be `"..."`, including slugs (`_slug = "go"`) and entity ids
  (`_id = "00000000-0000-0000-0007-000000000003"`). Two reasons: it removes a whole class of keyword-collision bugs for
  free (searching for a `Technology` literally named `or`, `and`, or `not` would break an unquoted grammar, since those
  are reserved words at the `and_expr`/`or_expr` level), and ids/dates both contain `-`, which is now a meaningful
  character elsewhere in the grammar (`<-`, and unary minus on numbers) — quoting sidesteps any tokenizer ambiguity
  between "a hyphen inside a literal" and "a hyphen that's part of the grammar" entirely, rather than relying on
  lookahead to tell them apart. This is a deliberate trade of a little ad hoc-search terseness for a simpler,
  harder-to-misparse grammar (real quoting-detail specifics — escaping a literal `"` inside a value — are still open,
  see §10).
- **`field_id` is never quoted; `schema_ref` is quoted only when it needs to be; ordinary `value`s are always quoted.**
  Three different rules, not one, and the distinction is grammatical position, not "is this a name":
  `field_id`/`schema_ref` name a *slot* in the grammar (which field, which schema to disambiguate against) and are part
  of the query's structure, resolved against the schema at compile time, whereas a `value` is *data* being compared
  against, opaque to the grammar itself. `field_id`s never contain spaces (they're code-facing ids like
  `technology_releases`, not display names), so they never need quoting either way. `schema_ref`s are display names and
  occasionally do contain spaces (`Technology Release`), so they get the conditional rule described above rather than
  either extreme. An ordinary `value` — `_slug = "go"`, `radar_status = "hold"` — is always quoted regardless of whether
  it happens to contain a space, since it's arbitrary data with no schema-defined shape to lean on the way `schema_ref`
  can.
- **Dates are wrapped in `date(...)`, not bare.** `eol_date < date("2026-06-30")`, not
  `eol_date < 2026-06-30` — a bare ISO date is exactly the kind of hyphen-bearing bare token the quoting rule above
  rules out. The compiler resolves `date(...)` away at compile time into a plain typed value in the IR (§5) — it's a
  text-syntax disambiguation aid, not something the executor or the IR ever needs to know about.
- **Enum-backed (`select`) fields have two literal forms, resolved at compile time against the field's enum
  `options: { value, label }[]`** (`WorkspaceEnumDbResult` in `catalogDatabase.ts`) — there's no separate "option id"
  beyond `value`, so the names below map directly onto that shape rather than inventing "id" terminology that doesn't
  exist in the data model:
    - `enumValue("openapi")` matches the stored `value` directly — what a visual filter builder would always emit (it
      already has the concrete option selected, so it knows the `value`), and what execution already does today for
      `equals`/`not_equals` against a `select` field.
    - `enumLabel("OpenAPI")` matches the human-readable `label` instead, resolved to the corresponding `value` at
      compile time — for a person typing ad hoc text search who thinks in terms of what's shown in the UI, not the
      internal slug. An unrecognized label is a compile-time error (naming a specific unknown-label diagnostic is more
      useful than silently matching nothing).
    - A bare quoted string against a `select` field (`radar_status = "hold"`) is sugar for `enumValue("hold")` — the
      common case stays terse; `enumLabel(...)` only needs to be written out when that's genuinely what's meant.
    - Only `equals`/`not_equals` make sense against either form — enum options aren't ordered, so `enumValue(...)`/
      `enumLabel(...)` combined with `<`/`>`/`<=`/`>=` has no defined meaning and should be rejected at compile time.

### 4.2 Traversal segments in detail

- **Forward, single hop** — `field_id` where the field is `reference` or `containment` on the current schema. Moves to
  the related entity (ies). Example: `technology_releases.eol_date`.
- **Backward, single hop** — `<-field_id` where `field_id` is a reference/containment field defined on *some other*
  schema that points at the current schema. Moves to entities that reference/contain the current one via that field.

  Unlike a forward hop, the current entity doesn't own this field — some other schema does, and there can be more than
  one such schema. `<-technology.eol_date` from a `Technology` is unambiguous: only `Technology Release` owns a
  `technology` containment field pointing at `Technology`, so there's exactly one candidate to resolve to, and the bare
  form is fine. But `<-technology_releases` is genuinely ambiguous in the seed data — both `Component` and
  `Resource` define a `technology_releases` reference field pointing at `Technology Release` — so **the bare, unscoped
  form is a compile-time error whenever more than one owning schema resolves**, not a silent union across them. The
  query must disambiguate with `<-Schema.field_id`:

  ```
  <-Component.technology_releases[...]
  <-Resource.technology_releases[...]
  ```

  Two consequences worth calling out:
    - There's no way to write "either Component or Resource, whichever" as a single backward step; it has to be an
      explicit `<-Component.technology_releases[...] OR <-Resource.technology_releases[...]`, or — often simpler — avoid
      `<-` altogether and traverse forward from the desired output schema instead, the way the identity-anchored example
      for issue #2315 in §6 already does (`technology_releases.technology._id = ...`, starting from `Component`/
      `Resource` and reaching `Technology`
      forward, sidestepping backward resolution entirely).
    - This ambiguity check runs against the schema graph, so it can flip from unambiguous to ambiguous (or vice versa)
      purely from a schema edit elsewhere in the workspace — e.g. adding a third schema with its own
      `technology_releases` reference field would turn today's hypothetical bare form into a compile error the next time
      the query is parsed or re-validated. A saved view storing the IR is unaffected once compiled (§5's
      `ownerSchemaId` is resolved once, at save/parse time, not re-resolved on every read) — but re-editing that view's
      text later would surface the new ambiguity.

There is deliberately no recursive or depth-bounded traversal primitive (no `ancestors`/`descendants`, no generic
undirected relation walk) in this version — every rollup this doc's worked examples need turns out to be a short,
fixed-length chain of named forward/backward hops once written out (§6), given how shallow the seeded containment
hierarchy actually is (2–3 levels, nowhere unbounded). Both were considered and dropped; see §11 for what they would
have looked like and when they'd be worth reintroducing.

### 4.3 Multiple values per relation, and scoping conditions to the same instance

A reference/containment field can have `maxCount > 1` or `-1` (unbounded), e.g. `Component.technology_releases`. A
predicate through such a field is existentially quantified by default:
`technology_releases.eol_date < date("2026-01-01")` means "at least one linked Technology Release has
`eol_date < date("2026-01-01")`". Universal quantification is out of scope for v1 (non-goal-adjacent — no `ALL(...)`
operator), consistent with keeping this a small, purpose-built language.

This existential quantification is scoped **per segment, independently**, unless conditions are explicitly grouped with
`[...]`. That distinction matters as soon as you need two conditions to hold of the *same* related entity rather than
being satisfiable by two different ones. For example, these two queries look similar but say different things:

```
schema:Component technology_releases.release_cycle < 2.0 AND technology_releases.technology._slug = "go"
schema:Component technology_releases[release_cycle < 2.0 AND technology._slug = "go"]
```

The first is two independent top-level predicates, each with its own existential: it matches a Component that uses
*some* release with `release_cycle < 2.0` (of any technology) **and** *some* release (possibly a different one)
whose technology is Go — e.g. it would wrongly match a Component using `Python 3.12` and, separately, `Go 1.22`, neither
of which alone satisfies both conditions. The second uses `[...]` to bind both conditions to one existential witness:
"at least one linked Technology Release for which `release_cycle < 2.0` **and** `technology._slug = "go"`
both hold" — the correct reading of "uses a Go release below version 2.0".

A bare trailing predicate at the end of an unscoped path is sugar for a single-condition `[...]` at each segment along
the way: `a.b.c op val` ≡ `a[b[c op val]]`. Conditions inside `[...]` are evaluated relative to the entity reached by
that segment, and may themselves contain further dotted paths, traversal steps, and nested `[...]`
groups. This sugar only applies when the final segment (`c`) is a scalar field; when a path ends at a relation field
with a bracket and nothing past it — `technology_releases[release_cycle < 2.0 AND technology._slug = "go"]`
used as the whole predicate, no trailing `.field` — it compiles to a distinct IR shape (`relationExists`, §5), not to an
ordinary field predicate, since there's no scalar field left to name.

### 4.4 Is `schema:` required?

No. `schema:<name>` is an ordinary predicate, not a syntactic entry point — every worked example so far happens to lead
with one for readability, but nothing in the grammar requires it. A predicate is evaluated per-candidate using *that
candidate's own* schema's field definitions; an entity whose schema doesn't define the leading field (or the traversal
field) simply doesn't match, the same way `technology_releases.eol_date < date("2026-06-30")` with no leading `schema:`
would run against both `Component` and `Resource` (both define a `technology_releases` field in the seed data) and just
as easily exclude a `Domain`, `System`, or `API`, which don't. This mirrors GitHub search without a `repo:` qualifier —
narrower is faster and less ambiguous, but omission is a valid "search everything"
query, not an error.

`schema:` still earns its keep for **disambiguating field-id collisions**: if two schemas each define a same-named field
with different meaning (e.g., a hypothetical second `category` enum with a different `enumId`),
`schema:` at that traversal position pins down which definition applies. Seed data doesn't currently have such a
collision, but schema authors aren't prevented from creating one.

The legacy browser request's `schemaId` (top-level and separate from the query tree) is a separate, coarser mechanism —
"which schema is this browser view showing" — and stays independent of whether the query text happens to mention
`schema:` anywhere. Saved views now carry that restriction in `EntityQuery.schemaId`, while ad hoc browser requests may
still supply the legacy request field when being normalized.

### 4.5 Assessment selection: query execution context, not query syntax

`_assessment:<fieldId>` (and the presence pseudo-field `_assessment`) resolve against whichever assessment the **query
execution context** supplies — there is no `assessment:` qualifier in the grammar, in either representation. This is a
v1 scope decision, not an oversight: unlike `schema:`, which is a genuine filter that narrows the candidate set and can
be dropped or repeated (§4.4), "which assessment" doesn't affect matching semantics so much as which data source
`_assessment:` fields read from, and that source is already supplied out-of-band today via
the legacy request's `assessmentId` (`viewContract.ts`) — supplied separately from flat conditions and resolved once
per request by `resolveJoinedAssessment` in `entityQueryOperations.ts` ("never per-entity", per its own comment). The
IR keeps that shape, and saved views now persist it as `EntityQuery.assessmentId`:

```
schema:Component technology_releases.eol_date < date("2026-06-30") AND technology_releases._assessment:riskLevel >= 3
```

is only a valid, meaningful query when the surrounding `EntityQuery.assessmentId` (§5) is set — same as today,
`_assessment:` conditions require `assessmentId` to be present or the request 400s (`httpAssert.present` in
`resolveJoinedAssessment`). A single joined assessment can still back `_assessment:` predicates at multiple traversal
depths/schemas in one query, since an assessment's own `scope: string[]` (`assessmentContract.ts`)
covers whichever schemas it applies to and its responses are keyed by bare `entity_id` regardless of schema — there's no
per-hop reselection to design for.

If a future surface needs a fully self-contained text query with no accompanying context (e.g. a global search bar with
no assessment picker), that would motivate reopening this — noted as an open question in §10 — but nothing in scope for
#2317, #2300, or #2315 requires it, and adding `assessment:` now would mean supporting parse-time name resolution,
quoting, and a "one assessment per query" uniqueness constraint in the grammar for a need that doesn't yet exist.

### 4.6 Projection: returning traversed data, not just matching entities

Everything so far (§4.1–4.5) answers one question: does this entity match? Nothing in it says which fields come back for
entities that do — which is exactly what reporting needs beyond a bare list of matches. Today's only
"which fields" mechanisms are flat and single-hop-at-most: `fieldIds: string[]` (table/cards/tree view configs,
`viewContract.ts`) is a plain list of the entity's *own* field ids, and CSV export's columns (`entityCsvOperations.ts`'s
`commonColumns`/`dynamicColumns`) are the same idea plus a flattened display string for the entity's own relation
fields — neither can reach *into* a related entity the way filtering already can (e.g. there's no way to add a "linked
Technology Release's EOL date" column today). This section closes that gap by letting a projected field be a `path` too,
reusing the same traversal machinery as filtering rather than inventing a second one.

**Deliberately not part of the filter grammar itself.** The issue scoped this language to filtering — field predicates,
boolean grouping, relation traversal — and a `SELECT`-style clause folded into the same qualifier-style search-box
syntax would grow it well past "small, purpose-built" for a capability the ad hoc search box doesn't obviously need
(GitHub/Jira-style search boxes don't have projection syntax either — which columns show is a separate UI concern there
too). Projection lives alongside a query as its own field, the natural generalization of today's `fieldIds: string[]` to
paths instead of bare ids — reusing the parser/validator/bounding already built for filter paths (§4.1, §4.2, §7), not a
new syntax to design from scratch. Whether the *text* grammar should express projection at all, vs. it being purely a
structured-IR/UI (columns picker) concern, is an open question (§10).

**The behavior that actually motivates this section: reuse the join, don't repeat it.** A projected field's `path`
is structurally the same shape as a filter predicate's `path` — a chain of `PathStep`s (§5). When a projection's path is
equal to, or a prefix of, a path some predicate in `root` already walks, the compiler binds the projection to *that*
existing join rather than adding a new one — one query, not a filter pass followed by a second lookup. Concretely:

```
schema:Component technology_releases.eol_date < date("2026-06-30")
```

projecting `technology_releases.eol_date` and `technology_releases.latest_version` costs **zero additional joins**:
`technology_releases` is already joined for the filter condition, `eol_date` reads straight off that row, and
`latest_version` reuses the identical join to read a different column off it. A projection is not restricted to paths
the filter already walks, though — projecting `radar_status` (never mentioned in the filter) is equally valid, it just
adds its own join (s) as needed, counted against the same hop cap as any other path (§7).

**A real subtlety, not glossed over:** join reuse is unambiguous when the shared relation is single-valued
(`maxCount: 1`, e.g. `technology_releases.technology` — only one `Technology` per release) or when only one predicate in
the whole query walks that path. It gets genuinely ambiguous when a *multi-valued* relation is constrained by more than
one *independent* existential in the filter tree — per §4.3, `technology_releases[eol_date
< date(...)]` and a separate top-level `technology_releases.release_cycle < "2.0"` are free to pick *different*
witnessing Technology Releases, since each is its own independently-quantified existential. A bare "reuse the join for
this path" rule doesn't say which witness a projection should read from in that case — they might not be the same row.
Recommend: for v1, join reuse only applies when there's exactly one predicate location in `root` walking that path (the
common case, including every worked example in §6); when a path is walked from more than one place independently,
projecting it requires picking a specific `[...]`-scoped predicate to bind to explicitly (syntax not designed here)
rather than guessing — silently picking one would make results position-dependent on the filter's exact tree shape,
which is worse than requiring the caller to disambiguate.

**IR sketch** (extends §5's `EntityQuery`):

```ts
type ProjectionField = {
  path: PathStep[];  // same PathStep as a filter predicate's path — forward/backward hops, no `[...]` brackets
  // (nothing to match here, just a value to read)
  fieldId: string;   // terminal scalar field (or _name/_slug/etc., or _assessment:<fieldId>)
  alias?: string;    // display column label; defaults to a path-derived name, e.g. "technology_releases.eol_date"
};
```

`EntityQuery.projections?: ProjectionField[]` sits alongside `root`, not inside it — orthogonal to matching, absent
meaning "today's default field set" for whatever's rendering the result.

**Multi-valued output shape.** When a projected path passes through a `maxCount > 1` relation, a matched root entity can
have more than one value at that path. Aggregate into an array per root entity by default (`value: unknown[]`), rather
than exploding into one result row per traversal branch — row-exploding would break the "one row per entity" assumption
table/cards/CSV already rely on. A reducer (first/min/max/count — e.g.
"earliest EOL date across all releases") is a real, useful follow-up but not designed here; see §11.

Bounding (§7) and permission handling (§8) both need to account for projection paths, not just `root` — a wide-open
dotted chain in a columns list is exactly as much a query-cost and visibility concern as one in a filter.

## 5. Structured IR

The text grammar compiles to/from this IR; saved views store the IR (mirrors today's `conditions:
FilterCondition[]`, but as a tree). Sketch (not final field names):

```ts
type EntityQuery = {
  schemaId?: string; // top-level entity-type filter; independent of any 'schema:' predicate in `root` (§4.4)
  assessmentId?: string; // supplied by query execution context, not query syntax — required if any '_assessment:' predicate appears in `root` (§4.5)
  root: QueryNode;
  projections?: ProjectionField[]; // orthogonal to `root` — which fields to return, not which entities match (§4.6)
};

type ProjectionField = {
  path: PathStep[]; // same PathStep as a predicate's path; reused (not re-joined) when it matches a path in `root`
  fieldId: string;
  alias?: string;
};

type QueryNode =
  | { kind: 'and'; children: QueryNode[] }
  | { kind: 'or'; children: QueryNode[] }
  | { kind: 'not'; child: QueryNode }
  | { kind: 'freeText'; value: string } // root starting-entity search only
  | { kind: 'predicate'; path: PathStep[]; fieldId: string; op: FilterOp; value: unknown }
  | { kind: 'relationExists'; path: PathStep[] };

type PathStep =
  | { kind: 'forward'; fieldId: string; filter?: QueryNode }
  | { kind: 'backward'; fieldId: string; ownerSchemaId: string; filter?: QueryNode };

// No recursive step kind (no 'ancestors'/'descendants', no generic undirected walk) — every PathStep is a single
// named hop, so a `path: PathStep[]` is a finite, statically-known-length chain of ordinary joins, never a
// recursive CTE. See §4.2 and §11 for what a recursive kind would have looked like and why it's deferred, not
// designed here.

// `ownerSchemaId` is required, not optional: a valid IR never contains an unresolved backward step. The text
// compiler resolves it at parse time — either from an explicit `<-Schema.field` qualifier, or, for the bare
// `<-field` form, by finding the single schema that owns a matching reference/containment field (§4.2); if more
// than one schema qualifies, parsing fails rather than emitting an IR node with a guessed or missing owner. The
// visual filter builder always has this available directly (the author picks a relation from a concrete schema's
// field list), so it never faces the ambiguity the text form has to resolve.

// `filter`, when present, is evaluated against the entity reached by this step and must hold for the SAME
// existential witness that satisfies the rest of the path through this step (the `[...]` grouping in §4.3).
// It composes recursively: a QueryNode inside `filter` can itself be a 'predicate' or 'relationExists' with its
// own `path` rooted at this step's target schema.

// FilterOp reuses filterConditionSchema's existing op enum (equals, contains, before, gte, ...).
// fieldId reuses the existing '_assessment' / '_assessment:<fieldId>' addressing for joined-assessment predicates,
// at whatever schema the path has traversed to.

// `value: unknown` is always a plain, already-resolved literal — never one of the text grammar's wrapped forms.
// `date("2026-06-30")` and `enumValue("openapi")`/`enumLabel("OpenAPI")` (§4.1) are text-syntax-only conveniences:
// the compiler resolves them at parse time into a plain string (`enumLabel` via a lookup against the field's
// `options: { value, label }[]`, erroring on an unrecognized label) before they ever reach the IR. The executor
// and the visual filter builder never see or need to distinguish "originally written as a label" from "originally
// written as a value" — by the time it's IR, it's just a value.
```

`predicate` and `relationExists` are two distinct terminal shapes, not one — `path: PathStep[]` in `predicate`
never includes the field being compared as a step; it's always a *scalar* field named separately (`fieldId`). That works
cleanly when a dotted path ends at a scalar field (`technology_releases.eol_date`, `technology._slug`), but a query like
`technology_releases[release_cycle < 2.0 AND technology._slug = "go"]` used as a *whole* predicate (no further trailing
scalar after the bracket) doesn't end at a scalar at all — it ends at a *relation* field (`technology_releases` itself),
asking "does at least one such related entity exist, matching this filter?" There is no `fieldId` to name in that case,
and forcing one (e.g. treating it as `not_empty` on the relation field itself, the same sugar bare paths use in §4.3)
would silently drop the bracket's condition, since
`{ kind: 'predicate', ... }` has nowhere to attach it. `relationExists` is that missing terminal: its `path`'s *last*
step is the relation being tested, and that step's own `filter` (already defined above) supplies the condition witnesses
must satisfy; `relationExists` with no `filter` on its last step is plain "at least one related entity exists at all"
(the bare-path sugar case). The compiler distinguishes `predicate` vs
`relationExists` from the schema, not new syntax: whether the path's final identifier names a scalar field or a
`reference`/`containment` field is already known statically.

`{ kind: 'predicate', path: [], fieldId, op, value }` (empty path) is exactly today's flat `FilterCondition` — i.e.
today's `filterConditionSchema` is the degenerate case of this IR with `path: []` and an implicit top-level
`and`. This gives a direct, mechanical migration: the legacy flat browser filter shape maps to
`{ schemaId, assessmentId, root: { kind: 'and', children: conditions.map(c => ({ kind: 'predicate', path: [], ...c })) } }`
— `schemaId` and `assessmentId` carry straight across as the same top-level, non-tree fields they already are.

## 6. Worked examples against seeded data

**#2300 — Components at EOL risk via their linked Technology Release:**

```
schema:Component technology_releases.eol_date < date("2026-06-30")
```

Seeded data: a Component using the `Node.js 20` release (`eol_date: 2026-04-30`) matches.

Two caveats worth being explicit about, both surfaced by re-checking the issue text directly rather than assuming:

- **This example expresses only one of #2300's three named strategies.** The issue leaves the choice open between
  "query-time relationship traversal, a derived risk field, or another maintainable approach based on scale and
  freshness requirements" — it does not decide this. The traversal query above is the *query-time* option; a *derived
  field* option (e.g. a precomputed `eol_risk_level` stored on the Component) would instead be an ordinary scalar
  predicate with no traversal at all (`schema:Component eol_risk_level = "high"`) and needs no new grammar. This spec is
  compatible with either — it doesn't presuppose which #2300 ends up choosing, and the two aren't mutually exclusive (a
  derived field can be backfilled *from* the traversal query as its source of truth).
- **`Component` stands in for "applications" here, not the seeded `Application` schema.** The issue says
  "applications, components, services, and other entities" generically, but the actual seeded `Application` schema
  (workspace2, `seedData.ts`) has only a `platform` select field — no `technology_releases` reference, no containment
  link to anything — so it has zero relation to Technology Release in the current seed data. `Component`
  (workspace1) is used as the closest seeded analog to whatever entity type ends up playing this role; if a real
  "Application" schema gains a `technology_releases`-style field later, the same query shape applies unchanged.

**#2300, combined with an assessment field joined on the query (`_assessment:` addressing unchanged by traversal depth —
it always addresses the assessment response of the entity at the *current* path position):**

```
schema:Component technology_releases.eol_date < date("2026-06-30") AND technology_releases._assessment:riskLevel >= 3
```

**#2315 — who uses any release of Technology "Go" (rollup through containment):**

(`_slug`/`_name` here — not `slug`/`name` — since those are entity pseudo-fields resolved off the entity row itself
(`entity.slug`/`entity.name` in `matchesFilterCondition`, `dataHelpers.ts`), not fields defined in
`Technology`'s schema `fields` array; bare `slug`/`name` would look up `entity.data.slug`/`entity.data.name`, which
don't exist. Real schema field ids stay unprefixed, as in the rest of this doc's examples.)

```
schema:Component technology_releases.technology._slug = "go"
```

Direct reference hop (`technology_releases`) then containment hop (`technology`) — no rollup needed since
`Component` references `Technology Release` directly. The "roll up through a containment hierarchy" part of #2315 is the
*reverse* case — e.g. "which Domains have any Component using Go" — expressed as a chain of named backward hops, since
going down the containment tree from `Domain` means reversing the forward fields that point up from child to parent:

```
schema:Domain <-domain.<-Component.system.technology_releases.technology._slug = "go"
```

Read left to right: `<-domain` reaches `System` entities whose `domain` field points at this `Domain` (unambiguous —
only `System` owns a `domain` containment field). `<-system` would be ambiguous from there (`Component`, `API`, and
`Resource` all own a `system` field pointing at `System`), so it's written scoped as `<-Component.system` to pick out
Components specifically. From there, forward through `technology_releases.technology._slug = "go"` as before. Four named
hops, no recursion — this is exactly the "walk down, then reference at the boundary" shape that issue #2315 describes,
just spelled out rather than expressed via a dedicated rollup operator (§4.2, §11).

**#2315, in the issue's own direction and wording** — the issue frames this as "given an entity [a Technology], find all
entities with a `reference` relation targeting it or any of its containment descendants," i.e. a kind-scoped
"containment down, then reference at the boundary" traversal, anchored at one specific Technology instance rather than a
value predicate:

```
technology_releases.technology._id = "00000000-0000-0000-0007-000000000003"
```

(`"00000000-0000-0000-0007-000000000003"` is the seeded `TECHNOLOGY_IDS.go`.) This is deliberately **forward**
reference then forward containment, not the descendants-then-backward shape the issue's prose might first suggest —
because in this grammar a query's root is always the entity returned as a match, and #2315 wants Components and
Resources back, not the Technology. So the traversal has to be read from the output entity's point of view: "does this
Component/Resource have a `technology_releases` link whose containment parent (one hop up) is the anchor Technology?"
That's the mirror image of the issue's anchor-centric API framing ("given Technology X, who points at it or its
descendants") but produces the identical result set — the API endpoint #2315 asks for would supply the anchor id and run
exactly this pattern, with the id substituted in. No `schema:` root restriction (§4.4), matching "all entities" in the
issue's wording rather than the narrower `schema:Component` used in the example above — both `Component` and `Resource`
match in seed data, since both define `technology_releases`.
`_id` is used here rather than `technology._slug = "go"` specifically to demonstrate the identity-anchored form an API
caller would use (a given entity, not a typed value) — the `slug`-based examples above remain the right shape for ad hoc
text search.

**Backward-traversal ambiguity, and why the example above avoids it** — a more literal transcription of #2315's own
wording would start at `Technology` and traverse backward: "given this Technology, walk down to its releases, then find
whoever references them":

```
schema:Technology _id = "00000000-0000-0000-0007-000000000003"
  AND <-technology.<-technology_releases
```

This is rejected at compile time as written: `<-technology_releases` has two owning schemas in the seed data
(`Component` and `Resource` both define a `technology_releases` reference field targeting `Technology Release`), and per
§4.2 the bare unscoped form requires exactly one candidate to resolve to. It has to be written as one of:

```
<-technology.<-Component.technology_releases
<-technology.<-Resource.technology_releases
<-technology.<-Component.technology_releases OR <-technology.<-Resource.technology_releases
```

— and even then, this whole query's *root* is `Technology` (because that's what `schema:Technology` pins it to), so it
answers "does this Technology have any referencing descendant" (a yes/no fact about the Technology), not
"which entities reference it" (a list of Components/Resources) — the latter is what #2315 actually wants returned, which
is exactly why the identity-anchored example above is written forward-from-the-output-schema instead of
backward-from-the-anchor: it sidesteps both the ambiguity and the root-schema mismatch in one move.

**Domains with a descendant Component using a Go release below version 2.0** (your question) — combines the
backward-chain rollup from #2315 with the same-instance scoping from §4.3, since "using Go" and "below version 2.0" must
both be true of the *same* linked Technology Release:

```
schema:Domain <-domain.<-Component.system.technology_releases[technology._slug = "go" AND release_cycle < 2.0]
```

Without the `[...]` grouping, `<-domain.<-Component.system.technology_releases.technology._slug = "go" AND
<-domain.<-Component.system.technology_releases.release_cycle < 2.0` would also match a Domain where one descendant
Component uses Go 3.0 and an unrelated descendant Component (or even the same one) separately uses Python 1.x — not what
"using a Go release below version 2.0" means.

Field choice matters here: use `release_cycle` (seeded as `"1.22"`, `"3.7"`, ...), not `latest_version` (seeded as
`"1.22.12"`, `"3.7.2"`, ...). Per `matchesFilterCondition` in
`arch-register-packages/server/src/domain/catalog/dataHelpers.ts`, `gt`/`lt`/`gte`/`lte` today do `Number(value)`
coercion, not semantic-version comparison — `Number("1.22")` is `1.22`, which happens to compare correctly against
`2.0`, but `Number("1.22.12")` is `NaN` and would never satisfy any numeric comparator. This grammar reuses that op
semantics as-is (§4.1), so a future semver-aware comparator (e.g. a dedicated `version_lt`) is a separate, later
proposal, not assumed here — worth flagging as an open question in §10 if multi-part version filtering becomes a real
requirement.

**Components that roll up (through System) into the "Platform Engineering"-owned Domain:**

```
schema:Component system.domain._name = "Platform Engineering"
```

`Component → System → Domain` is two named forward containment hops (`system`, then `domain`); no rollup operator needed
since the chain is short and fixed. Combine with a forward hop to answer "EOL-risk releases used anywhere under a given
Domain":

```
schema:Component system.domain._name = "Platform Engineering" AND technology_releases.eol_date < date("2026-06-30")
```

Note this reads as *two separate paths sharing the same starting Component* (an implicit `AND` of two predicates), not
one path that goes up and then back down — forward and backward hops compose within a single
`and_expr`, but a single dotted `path` only ever walks in one direction.

**Saved-view style OR/NOT grouping (not expressible flat today):**

```
schema:Technology (radar_status = "hold" OR radar_status = enumLabel("Assess")) AND NOT category = "library"
```

Matches seeded `Apache Kafka`/`Elasticsearch` (`assess`) while excluding anything categorized `library`. Also
demonstrates both enum literal forms side by side: `radar_status = "hold"` is the terse, common form (sugar for
`enumValue("hold")` — the field's stored value, `"hold"`, happens to just be the lowercased label here), while
`radar_status = enumLabel("Assess")` explicitly matches by the human-readable label instead, resolved to the stored
value `"assess"` at compile time (§4.1) — both reach the same seeded entities either way in this case, since
`Technology Radar Status`'s options only differ by case, but the two forms mean different things in general.

## 7. Bounding traversal

The issue's DoS concern was "unbounded recursive CTEs" — with `ancestors`/`descendants`/`related` dropped (§4.2, §11),
there's no recursion left to be unbounded. Every `PathStep` is a single named hop (§5), so a `path` compiles to a
fixed-length chain of ordinary joins, known statically at compile time from the query text/IR alone — no
`WITH RECURSIVE`, no question of whether the containment graph is acyclic, no visited-node tracking needed.

What's still worth bounding, and why it's a much smaller concern than before:

- **Hop count.** A path may contain at most `MAX_PATH_HOPS` segments (proposed: 6), enforced at compile time (reject
  before it reaches SQL). This isn't defending against runaway recursion anymore — it's capping query-plan size and join
  fan-out, since each hop through a `maxCount > 1` relation can widen the candidate set, and hops can nest inside
  `[...]` filters (§4.3), which themselves can contain further hops. A shallow, fixed cap is enough; there's no cyclic
  worst case to defend against the way a recursive primitive would have had. This cap applies to every
  `ProjectionField.path` (§4.6) exactly as it does to a predicate's `path` — a columns list is just as capable of
  requesting a deep, expensive join chain as a filter is, and join reuse between the two (§4.6)
  doesn't change the cost of a path that isn't actually shared with anything in `root`.

This is a compile-time constant shared between the text parser and the structured-IR validator, so a hand-built IR (from
the visual filter builder) can't bypass a limit only enforced in the text parser.

## 8. Tenant isolation and permissions

The requirement is unchanged from the first draft: a traversal step through an entity the requesting user cannot see
must terminate that branch (treated as "no match"), not surface the related entity's fields or leak its existence via a
boolean result, timing, or partial-result shape. Projection (§4.6) adds a second version of the same requirement: an
entity that already matched (so its *existence* is known to be visible) can still traverse, mid-projection-path, through
an entity the requester can't see — that projected value must come back absent/null, not surface the hidden entity's
data, even though the row itself is legitimately part of the result set. What was wrong in the first draft was the
proposed mechanism — "inject the permission predicate into every recursive CTE term" implies permission checks are an
ordinary SQL `WHERE` fragment, and checked against the actual implementation, they aren't. (The "recursive"
part of that phrase is now moot regardless, since §7 dropped recursion from the traversal layer entirely — but the
underlying mismatch between `PermissionChecker` and a SQL predicate holds regardless of whether the join it needs
injecting into is recursive or not.)

**This section described the pre-#2333 permission model, where it was accurate. Following #2333's simplification
(`content.view` as the sole workspace-wide view gate, `visibility_mode` retired, `entity.project_id` replacing it as a
query-scope column), most of the traversal-vs-SQL mismatch this section warned about no longer exists — see the
revised analysis below.**

`PermissionChecker` (`arch-register-packages/permissions/src/PermissionChecker.ts`) now resolves `view_entity` through
one of three paths: (1) the requester has the workspace-wide `content.view` capability (or `ent.edit`/`ent.propose`,
or is a global admin) — a single boolean check via `hasWorkspaceWideEntityView`, no traversal, no per-entity state; (2)
owner-team role, direct or via containment-ancestor descendant permissions; (3) an explicit `entity_grant` row, direct
or `subtree`-scoped. Path (1) covers the overwhelming majority of real access (every built-in workspace role has
`content.view`) and is exactly as SQL-predicate-friendly as `_schemaId = ?` — it's a single fact about the requester,
not a fact about the entity, so it either gates the whole query or it doesn't. Project scoping (`entity.project_id`)
is now a plain column predicate too: `WHERE entity.project_id IS NULL` for global queries, or a project-id/`project_entity`
join-table check for project-scoped ones — see `postgresCatalog.ts`/`sqliteCatalog.ts` `listEntitiesPaginated`, which
already does this.

Only paths (2) and (3) still require graph-shaped reasoning — containment-ancestor traversal for descendant team
permissions and `subtree` grants — and even those reduce to a joinable `entity_grant`/ownership lookup rather than the
old ancestor-walk-for-*visibility* (`resolveEntityVisibility`, which no longer exists). For a requester with
`content.view` (the common case), the traversal layer needs no permission-aware behavior at all beyond the
`project_id` predicate. For a requester *without* `content.view` (a narrowly-scoped API token or custom role), the
two directions the original draft proposed still apply, narrowed to just the ownership/grant case:

- **Precompute a visible-entity-id set from ownership + grants, then constrain the traversal to it** (`WHERE id IN
  (...)` / a semi-join), following the same shape `filterVisibleEntities` already falls back to.
- **A permission-aware traversal layer for `subtree` grants whose scope depends on where in the traversal you are** —
  post-filter each hop's candidate ids before letting the next hop consume them.

The "hidden intermediate entity" test coverage this section originally called for is still needed for the no-`content.view`
case (a *filter* traversal path where some middle hop is invisible must terminate that branch; a *projection* path
through a hidden hop must return absent/null, not error or leak data) — it's just no longer the *default* path every
query takes.

## 9. Implementation status

The v1 design described here is implemented in the repository:

- The structured IR, validator, hop bound, projections, and legacy flat-filter mapping are implemented.
- Forward and backward relation paths compile to SQL for both PostgreSQL and SQLite, with permission and project-scope
  handling covered by contract tests.
- The text compiler supports parsing and canonical printing, and is exposed through the entity-query API.
- Entity list/count endpoints, saved views, and the Advanced query UI use the same `EntityQuery` representation.

This implementation subsumes the original use cases in #2300 and #2315. #2300 uses a linked Technology Release EOL
predicate, while #2315 uses the identity-anchored forward-then-containment pattern described in §6. Neither issue
requires a separate endpoint or bespoke traversal implementation.

Generic recursive `ancestors(...)`/`descendants(...)` traversal remains deliberately deferred as described in §11; v1
uses bounded, explicitly named relation hops.

## 10. Open questions (carried over from the issue, not resolved here)

Unresolved ambiguities this spec doesn't settle — as opposed to §11, which is deliberately-deferred *features*
with a clear reason they're out of v1.

- ~~Exact escaping rules for the text grammar, plus the `empty`/`not_empty`/`on` comparator gap~~ — resolved in §4.1:
  only `\"`/`\\` are valid escapes; `empty`/`not_empty` are bare keyword values under the existing `:`/`=`
  comparator; `on` is resolved from the terminal field's type, the same way `<`/`>` already resolve per field type.
- UI round-trip fidelity: does every structured-IR tree the visual builder can produce have a canonical textual form, or
  only a useful subset (analogous to how not every SQL query has a "nice" ORM equivalent)?
- Whether projection (§4.6) needs any *text* grammar syntax at all, or stays a structured-IR/UI-only concern (the
  generalization of today's `fieldIds: string[]` to paths). Leaning toward the latter — an ad hoc search box is
  answering "which entities," not "which columns," and that's already a separate UI control today — but this hasn't been
  decided, only proposed.
- Exactly how a projection path gets bound to a specific witness when the same multi-valued relation is constrained by
  more than one independent existential in `root` (§4.6's "real subtlety") — v1's answer is "reject and require explicit
  disambiguation," but the disambiguation syntax itself isn't designed.

## 11. Potential v2 extensions

Features considered during design and deliberately left out of v1, with enough detail to revisit if a concrete need
shows up — none of them are required by #2317, #2300, or #2315 as currently written, and adding them speculatively would
cost real complexity (see each item) for no driving case.

- **Reducers for multi-valued projected paths** (`first`, `min`, `max`, `count` — e.g. "earliest EOL date across all
  releases" instead of the full array §4.6 returns by default). Deferred because the array default already answers the
  reporting need directly, and picking the right reducer per field is a real design surface (does
  `min`/`max` need a defined ordering per field type, does `first` mean "first by what order") that doesn't need solving
  until a concrete report wants a scalar summary rather than a list.
- **Recursive containment rollup (`ancestors(...)`/`descendants(...)`).** Walks the `containment` tree up/down, bounded
  by either a stopping schema or a hop count, without the query needing to name every intermediate field. Dropped
  because every worked example in §6 turned out to be a short, fixed-length chain of named forward/`<-`
  hops once written out — the seeded containment hierarchy is only 2–3 levels deep everywhere, so there's no case today
  where the hop count is genuinely unknown at query-write time. Dropping it also removed recursion from the traversal
  layer entirely (§7, §8) — a real simplification, not just fewer keywords. Revisit if a schema gains a hierarchy whose
  depth genuinely varies by branch (e.g. an optional intermediate level that exists for some entities and not others),
  where naming every hop stops being practical.
- **Generic undirected relation walk (`related(depth:n, fields:[...])`).** An N-hop walk over *any*
  `reference`-or-`containment` field, either direction, mirroring the already-shipped Explore view
  (`exploreViewConfigSchema`, `ExploreView.helpers.ts`'s `leftDepth`/`rightDepth`/`relationFieldNames` over
  `incoming`+`outgoing` relations of any `kind`). Dropped because Explore already solves this well with its own bespoke,
  non-recursive-CTE, in-memory graph-building logic — it answers "render the graph around this entity for a UI," not
  "does this entity match a boolean predicate," and there's no requirement forcing those two problems to share one
  grammar. Revisit only if a *filtering* (not rendering) need for an undirected, kind-mixed walk shows up concretely;
  until then it would just be the least tree-shaped, least safe primitive in the language (§7 flagged this) for a case
  nothing here actually needs.
- **Wildcard union for ambiguous backward steps (e.g. `<-*.field_id`).** §4.2 makes bare, unscoped `<-field_id` a
  compile-time error whenever more than one schema owns a matching field, rather than silently unioning them. The
  workaround — spelling out an `OR` of each `<-Schema.field_id` variant by hand — is fine while the set of owning
  schemas is small and stable, but gets tedious if a field id ends up legitimately shared by many schemas with the same
  intended meaning. A deliberate opt-in wildcard could restore that convenience without bringing back silent, unintended
  unions as the default.
- **Semver-aware comparator for version-like text fields** (`release_cycle`, `latest_version`). Today's
  `gt`/`lt`/`gte`/`lte` do plain `Number()` coercion (`dataHelpers.ts`), which silently degrades to `NaN` (never
  matches) for multi-part strings like `"1.22.12"` — see §6. This grammar deliberately reuses existing op semantics
  rather than fixing that here; a dedicated `version_lt`-style operator is a separate, later proposal if multi-part
  version filtering becomes a real requirement.
- **Cross-assessment queries** — referencing two *different* named assessments within one query (§4.5) is deliberately
  unsupported. If a real use case shows up (e.g. comparing a Component's own assessment against a linked Technology
  Release's separate assessment), it needs its own design pass: multiple bulk
  `listAssessmentResponses` fetches, disjoint field-id namespacing, and per-assessment permission checks all get more
  involved than the single-join model this spec assumes.
- **`assessment:<name>` as real query syntax** (§4.5) — deferred because every surface in scope today supplies the
  assessment via surrounding UI/API context, but a fully self-contained text query (e.g. a global search bar with no
  assessment picker) would motivate revisiting this, and adding it later means solving parse-time name resolution,
  quoting, and a "one assessment per query" uniqueness constraint that v1 doesn't need.
