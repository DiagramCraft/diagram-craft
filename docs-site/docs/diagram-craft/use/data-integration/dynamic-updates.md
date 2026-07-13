---
sidebar_position: 4
related_reading:
  - label: Data Sources
    to: /diagram-craft/diagram-craft/use/data-integration/data-sources
  - label: Data Binding
    to: /diagram-craft/diagram-craft/use/data-integration/data-binding
  - label: Query Language (DJQL)
    to: /diagram-craft/diagram-craft/use/data-integration/query-language
---

# Dynamic Updates

Dynamic updates in Diagram Craft come from the combination of provider refresh, linked element metadata, and data-aware diagram features such as rules and queries. The important mental model is that the diagram reacts to changed data, but only within the limits of the configured provider and the features that consume that data.

## Start With A Realistic Update Model

There is no single “live mode” switch that makes every diagram behave like a streaming dashboard.

Instead, dynamic behavior usually comes from:

- refreshing data from a provider
- keeping element links tied to shared external records
- using rule logic or queries that evaluate against current data
- applying document overrides before committing them back to a mutable provider

This is flexible, but it means you should document your team’s refresh expectations clearly.

## What Actually Changes When Data Changes

After a provider refresh or a linked-record update, the parts of the diagram that depend on that data can change in meaningful ways:

- linked elements can show updated field values
- template-based data shapes can continue representing the same record
- queries can return different results
- rule-driven visibility or styling can react differently

The diagram layout itself is not automatically redesigned just because upstream data changed.

## Use Refresh Deliberately

For most external data workflows, refresh is the boundary between “source changed” and “diagram sees the change”.

Use refresh when:

- the upstream dataset changed
- the upstream schema changed
- another editor updated shared records
- a REST-backed setup needs the latest server state

If a diagram appears stale, refresh the relevant provider before assuming the binding is broken.

## Document Overrides Are Part Of The Story

Some schemas can use **document overrides**. That lets the document stage add, update, or delete operations locally before applying them back to the provider.

This is useful when:

- you want reviewable edits before committing shared data changes
- different diagrams need temporary local variations
- the diagram is acting as a working surface for provider-backed records

Treat overrides as intentional local state, not as a silent sync mechanism.

## Features That Use Refreshed Data

The current feature set works well for:

- inventories and architecture maps that refresh from a shared catalog
- diagrams that use data fields in labels and reviews
- rule-driven views that expose subsets of a larger model
- curated operational views where users refresh before presenting or exporting

These are “data-aware” diagrams first. Some can feel live in practice, but only if the underlying provider and refresh cadence support that workflow.

## Handle Change Without Surprises

When upstream data evolves, the biggest risks are usually structural, not visual.

Plan for:

- renamed or removed fields breaking expected labels or queries
- records disappearing and leaving links that need review
- schema edits changing what users can enter locally
- refreshes surfacing data changes that make saved searches or rules behave differently

A small validation pass after significant schema changes is worth the time.

## Limits To Call Out

- “real-time” depends on the provider and deployment setup; not every data source pushes changes automatically
- provider refresh updates data availability, not presentation quality
- diagram behavior can be data-driven without being continuously synchronized every second
