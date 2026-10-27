import type { BrowserView } from '@arch-register/api-types/viewContract';

export const BROWSER_VIEW_HELP: Record<BrowserView, string> = {
  table:
    'A sortable table of the entities matching the current search and filter, with one row per entity. Choose the columns with Manage fields and click a row to open the entity.',
  cards:
    'The matching entities as cards, for quickly scanning each record’s summary. Click a card to open the entity.',
  tree: 'The matching entities arranged by their containment hierarchy, so parents show the entities nested under them.',
  radar:
    'Compares entities on a radar chart. Pick the fields to use as axes; it needs fields with the right kind of data to draw.',
  timeline:
    'Shows date-driven entity history and planned changes on a timeline. Group rows by owner, type or containment parent, and use the Historical, Now, Next and Later bands to see what is coming.',
  matrix:
    'A grid of the relationships between entities, showing how dense and how complete the coverage is. Choose which relation field to plot; filled cells mark a relationship.',
  explore:
    'An exploration view with columns side by side. Start from the matching entities and follow relations column by column, filtering each column to a schema to narrow what is traversed.',
  bubble:
    'Plots entities as bubbles. Map fields to the X axis, Y axis, bubble size and colour, and optionally split the axes into labelled quadrants.',
  heatmap:
    'An N×N grid, for example likelihood against impact. Each cell counts the entities in that band; click a cell to list them.',
  map: 'A nested map of a containment hierarchy, such as capabilities. Box colour shows a metric rolled up from the entities inside it, for example a count, average or the worst value.',
  diff: 'Pick a future date to see what changes by then: entities added, removed or changed once planned changes are applied. Click a changed entity for a field-level diff.',
  graph:
    'A graph of the matching entities and the entities linked to them, traversed up to a chosen number of relationship levels. Click a relation to see its details.',
  traceability:
    'Follows configured relationship paths from the matching entities, to show what each one traces to and where coverage has gaps.',
  'path-walker':
    'Walk a chain of relations one column at a time. Select an entity, choose a relation on the arrow, and the next column lists the entities it leads to.'
};
