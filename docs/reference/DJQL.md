---
title: DJQL
category: Reference
---

# DJQL

## Examples

* Search node by name (contains, case insensitive):
  `.elements[] | select(.type == "node") | select(.name | test("lorem"; "i"))`
* Search edges with unresolved comments:
  `.elements[] | select(.type == "edge") | select(.comments[] | select(.state == "unresolved") | length > 0)`
* Search node with a specific color:
  `.elements[] | select(.type == "node") | select(.props.fill.color == "white" )`
* Search edge with a specific tag:
  `.elements[] | select(.type == "edge" and (.tags | contains(["component"])))`
