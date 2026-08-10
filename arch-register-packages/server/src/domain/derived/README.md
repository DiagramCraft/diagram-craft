# Derived fields

Derived fields are read-only schema fields whose values are calculated from other fields on the
same entity (or assessment response). They use the sandboxed [`bonsai-js`](https://github.com/danfry1/bonsai-js)
expression engine and are materialized when the owning record is created or updated.

Entity expressions also receive a bounded graph context: `entity` is the current entity and
`dependents` contains its direct neighbors through reference, containment, or typed-relation
edges. Traversal stops at that one-hop boundary. The server recalculates affected entities
synchronously after entity, relation, schema, and field-group mutations. Source entity visibility
is administrator-trusted for this calculation; output field-group access is still enforced when
values are returned to users.

## Schema setup

A derived field has the following shape:

```json
{
  "id": "inherent_risk_score",
  "name": "Inherent Risk Score",
  "type": "derived",
  "requirementLevel": "optional",
  "expression": "field('likelihood') * field('impact')",
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

Use `field()` with a string literal containing the source field ID. Bare identifiers are not
allowed:

```text
field('likelihood') * field('impact')
```

`field()` is deliberately a string-based accessor rather than a direct variable lookup. Field IDs
are user-defined strings and are not necessarily valid expression identifiers. Requiring a literal
also lets the server validate referenced fields and determine derived-field dependencies before
evaluation.

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
    "expression": "field('amount') * 1.25",
    "resultType": "number"
  },
  {
    "id": "rounded_total",
    "name": "Rounded total",
    "type": "derived",
    "requirementLevel": "optional",
    "expression": "field('with_tax') + 1",
    "resultType": "number"
  }
]
```

For entity fields, direct neighbors can be aggregated with Bonsai's array helpers. Each graph node
has `id`, `schemaId`, and `values`; relation metadata is available under `edge`:

```text
dependents
  .filter(.schemaId == 'contract')
  .map(.values['annual_cost'].amount)
  |> sum
```

To return a currency value, combine the aggregate with an explicit currency code:

```text
{
  amount: dependents.map(.values['annual_cost'].amount) |> sum,
  currency: 'USD'
}
```

Use `entity.values['field_id']` when the current entity must be addressed through the graph
context. The `field('field_id')` function remains available for sibling fields and is preferred
when the field is part of the same schema definition.

The expression engine supports Bonsai's normal operators, conditionals, and safe built-ins. For
example, a residual risk score can reduce the impact according to the selected mitigation level:

```text
field('likelihood') * (
  field('mitigation_effectiveness') == 'full'
    ? 0
    : field('mitigation_effectiveness') == 'substantial'
      ? (field('impact') - 2 < 1 ? 1 : field('impact') - 2)
      : field('mitigation_effectiveness') == 'partial'
        ? (field('impact') - 1 < 1 ? 1 : field('impact') - 1)
        : field('impact')
)
```

For a text result, the expression can combine sibling values:

```text
field('vendor') + ' — ' + field('contract_number')
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
      "expression": "field('likelihood') * field('impact')",
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
  "expression": "dependents.filter(.schemaId == 'contract').map(.values['annual_cost'].amount) |> sum",
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
  "expression": "field('inherent_risk_score') >= 15 ? 'high' : 'normal'",
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
