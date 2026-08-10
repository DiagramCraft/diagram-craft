# Derived fields

Derived fields are read-only schema fields whose values are calculated from other fields on the
same entity (or assessment response). They use the sandboxed [`bonsai-js`](https://github.com/danfry1/bonsai-js)
expression engine and are materialized when the owning record is created or updated.

Entity expressions receive a bounded JSON context under `entity`. It contains the current entity
and expands direct neighbors through reference, containment, or typed-relation edges. Traversal
stops at that one-hop boundary. The server recalculates affected entities
synchronously after entity, relation, schema, and field-group mutations. Source entity visibility
is administrator-trusted for this calculation; output field-group access is still enforced when
values are returned to users.

Assessment response expressions use `assessment` instead. The assessment object contains the
response fields for that assessment only; it does not expose catalog relations:

```text
assessment.business_fit >= 6 && assessment.technical_fit >= 6 ? 'invest' : 'review'
```

## Schema setup

A derived field has the following shape:

```json
{
  "id": "inherent_risk_score",
  "name": "Inherent Risk Score",
  "type": "derived",
  "requirementLevel": "optional",
  "expression": "entity.likelihood * entity.impact",
  "resultType": "number"
}
```

The available result types are:

- `text`
- `number` — an integer
- `currency` — an object with a finite `amount` and three-letter uppercase `currency`
- `select` — also requires an `enumId`
- `boolean`
- `rating` — an integer from 1 to 5

Derived fields are always optional and cannot be written directly by entity or assessment
mutations. The server recalculates them from the submitted source values.

## Expressions

Entity expressions receive an `entity` JSON object. Current-entity fields are available at the top
level of that object, together with `metadata` and direct relation targets. Assessment expressions
receive response values under `assessment`:

```text
entity.likelihood * entity.impact

assessment.business_fit >= 6 ? 'strong' : 'review'
```

Field IDs that are not valid Bonsai identifiers use bracket notation, for example
`entity['annual-cost']`. Derived fields always receive a depth-1 projection: direct references,
containment targets, and typed-relation targets are expanded once; nested targets remain at depth 0.

Derived fields may depend on other derived fields. The server evaluates them in dependency order:

```json
[
  {
    "id": "amount",
    "name": "Amount",
    "type": "number"
  },
  {
    "id": "with_tax",
    "name": "With tax",
    "type": "derived",
    "requirementLevel": "optional",
    "expression": "entity.amount * 1.25",
    "resultType": "number"
  },
  {
    "id": "rounded_total",
    "name": "Rounded total",
    "type": "derived",
    "requirementLevel": "optional",
    "expression": "entity.with_tax + 1",
    "resultType": "number"
  }
]
```

For entity fields, direct relation targets can be aggregated with Bonsai's array helpers. Each
expanded target has the same JSON shape, with nested relations left at depth 0:

```text
entity.dataFlowsIn
  .filter(.entity.metadata.schemaId == 'system')
  .map(.entity.annual_cost.amount)
  |> sum
```

To return a currency value, combine the aggregate with an explicit currency code:

```text
{
  amount: entity.contracts.map(.entity.annual_cost.amount) |> sum,
  currency: 'USD'
}
```

The expression engine supports Bonsai's normal operators, conditionals, and safe built-ins. For
example, a residual risk score can reduce the impact according to the selected mitigation level:

```text
entity.likelihood * (
  entity.mitigation_effectiveness == 'full'
    ? 0
    : entity.mitigation_effectiveness == 'substantial'
      ? (entity.impact - 2 < 1 ? 1 : entity.impact - 2)
      : entity.mitigation_effectiveness == 'partial'
        ? (entity.impact - 1 < 1 ? 1 : entity.impact - 1)
        : entity.impact
)
```

For a text result, the expression can combine sibling values:

```text
entity.vendor + ' — ' + entity.contract_number
```

## Evaluation behavior

- Missing, empty, or `null` dependencies cause the derived value to be omitted.
- Results that do not match the declared `resultType` are omitted and logged.
- Invalid expressions are rejected when the schema is validated.
- Unknown sibling field IDs are rejected during schema validation.
- Cyclic derived-field dependencies are rejected.
- A failed derived calculation does not prevent the underlying entity or response from being
  stored; the invalid derived value is omitted.
- Existing stale derived values are removed when a dependency becomes unavailable.

Derived fields also participate in field-group access validation. A derived field cannot be placed
in a broader field group than a restricted field it reads, including transitive derived-field
dependencies. Missing field groups fail closed.

## Examples

### Risk score

Define numeric inputs and a calculated score on a Risk schema:

```json
{
  "fields": [
    { "id": "likelihood", "name": "Likelihood", "type": "number", "min": 1, "max": 5 },
    { "id": "impact", "name": "Impact", "type": "number", "min": 1, "max": 5 },
    {
      "id": "inherent_risk_score",
      "name": "Inherent Risk Score",
      "type": "derived",
      "requirementLevel": "optional",
      "expression": "entity.likelihood * entity.impact",
      "resultType": "number"
    }
  ]
}
```

An entity with `likelihood: 4` and `impact: 3` receives
`inherent_risk_score: 12`. The score is recalculated when either input changes.

### Relation-aware contract total

On a System schema, a derived number can total the annual costs of directly related Contract
entities:

```json
{
  "id": "annual_contract_cost",
  "name": "Annual contract cost",
  "type": "derived",
  "requirementLevel": "optional",
  "expression": "entity.contracts.map(.entity.annual_cost.amount) |> sum",
  "resultType": "number"
}
```

When a contract's `annual_cost`, relation, or relevant schema definition changes, the connected
entities are recalculated synchronously.

### Derived select value

A derived select can classify a numeric score. It must reference an existing workspace enum:

```json
{
  "id": "risk_band",
  "name": "Risk band",
  "type": "derived",
  "requirementLevel": "optional",
  "expression": "entity.inherent_risk_score >= 15 ? 'high' : 'normal'",
  "resultType": "select",
  "enumId": "risk-band"
}
```

The expression result must be one of the values defined by the selected enum.

## Implementation and tests

The evaluator lives in [`derivedFields.ts`](./derivedFields.ts). Its unit tests cover dependency
ordering, type coercion, invalid references, cycles, and field-group access:

```bash
pnpm exec vitest run arch-register-packages/server/src/domain/derived/derivedFields.test.ts
```

Schema validation and API-level behavior are covered by the Arch Register schema and entity tests.
