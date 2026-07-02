---
sidebar_position: 1
---

# Data Sources

Diagram Craft separates **where data comes from** from **how diagram elements use it**. Start here when you need to bring structured data into a document, refresh it, or choose between document-local and external providers.

## Understand The Provider Types

The **Model Center** works with providers. A provider supplies schemas and data records that the document can use.

The current built-in options are:

- **Document** for data stored directly in the diagram document
- **URL** for schemas and data loaded from explicit JSON URLs
- **REST API** for schemas and data loaded from a server endpoint

Use the **Document** provider when you want the diagram file to contain its own working data. Use **URL** or **REST API** when the diagram should reflect a source that lives outside the file.

## Manage Providers In Model Center

Open **Model Center** and use the **Model Providers** tab to:

- review the providers already attached to the document
- add a new URL or REST provider
- edit provider settings
- delete a provider
- refresh schemas and data after the source changes

Provider configuration is document-specific. If two diagrams need different backends or datasets, configure them separately.

## Know The Difference Between Schemas And Data

Each provider contributes two related pieces:

- **Schemas** define the structure of records, such as fields, field types, and relationships
- **Data** contains the actual records that elements can link to

That split matters in practice:

- a provider can be reachable but still missing the schema you expected
- changing a schema can affect which fields are available for bindings and templates
- refreshing data does not replace the need to refresh schemas when the structure changed

## Use Document Data For Self-Contained Diagrams

The **Document** provider is the simplest starting point for examples, workshops, and diagrams you want to keep portable.

Typical workflow:

1. open **Model Center**
2. define or review a schema in **Schemas**
3. add records in **Data**
4. link elements to those records from the canvas

This is the best option when the diagram itself is the system of record for a small dataset.

## Use URL Or REST Providers For Shared Data

External providers are better when the data already exists elsewhere or should be refreshed independently from the diagram file.

- **URL providers** are useful for static JSON hosted at known paths
- **REST providers** are useful when you need CRUD-style schema/data endpoints and repeatable refreshes

In the current repo, the standalone server in `packages/server-main` exposes the expected `/api/schemas` and `/api/data` endpoints for REST-backed setups.

## Refresh Behavior Matters

Diagram Craft does not assume that every external source is pushing live changes into the editor at all times. In normal use, you should expect to:

- refresh providers after changing upstream data
- refresh again after changing upstream schemas
- verify affected linked elements if fields were renamed or removed

If you need continuously current views, document that operational expectation for your team instead of assuming all external providers are live by default.

## Practical Example

A common architecture workflow looks like this:

1. create a REST provider that points at a shared service catalog
2. import the service schema into the document
3. review records in **Model Center > Data**
4. drag or link records onto the canvas
5. refresh the provider when the source catalog changes

That keeps the diagram tied to shared data without forcing all edits to happen inside the diagram file.

## Prerequisites And Limits

- REST-backed workflows require a server that exposes compatible schema and data endpoints
- URL-backed workflows depend on the data being reachable from the client environment
- authentication and deployment details are handled by the provider/server setup, not by the page-level diagram workflow itself
- provider refresh updates available data, but it does not automatically redesign the diagram for you when the source structure changes

## Related Reading

- [Data Binding](data-binding)
- [Query Language (DJQL)](query-language)
- [Dynamic Updates](dynamic-updates)
