import type { Diagram } from './diagram';
import { parseAndQuery } from 'embeddable-jq';
import { assert, notImplemented } from '@diagram-craft/utils/assert';
import { RegularLayer } from './diagramLayerRegular';
import { DiagramElement, isNode } from './diagramElement';
import { isSubsequence } from '@diagram-craft/utils/strings';
import { QueryElement } from './queryModel';

/**
 * Search helpers for evaluating rule-layer element search clauses.
 *
 * Supports free-form DJQL queries, property comparisons, tag matching,
 * comment-state filtering, and simple text search over node labels.
 *
 * @example
 * ```ts
 * import {
 *   searchByElementSearchClauses,
 *   searchByText,
 *   type ElementSearchClause
 * } from '@diagram-craft/model/diagramElementSearch';
 *
 * const clauses: ElementSearchClause[] = [
 *   { id: 'name', type: 'props', path: 'metadata.name', relation: 'contains', value: 'api' }
 * ];
 *
 * const matches = searchByElementSearchClauses(diagram, clauses);
 * const textMatches = searchByText(diagram.elements, 'api');
 * ```
 *
 * @module
 */

/**
 * Describes a single clause in the rule-layer element search DSL.
 *
 * Clauses can either be evaluated directly against diagram elements or grouped
 * into nested `any` expressions that union multiple child clause results.
 */
export type ElementSearchClause = { id: string } & (
  | {
      type: 'query';
      query: string;
    }
  | {
      type: 'any';
      clauses: ElementSearchClause[];
    }
  | {
      type: 'props';
      path: string;
      relation: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'matches' | 'set';
      value: string;
    }
  | {
      type: 'tags';
      tags: string[];
    }
  | {
      type: 'comment';
      state?: 'unresolved' | 'resolved';
    }
);

/**
 * Converts search clauses into a compact human-readable label.
 *
 * This is primarily used for display purposes in rule editors and search UIs.
 *
 * @param clauses - The clauses to serialize into a readable summary.
 * @returns A semicolon-separated label describing the provided clauses.
 *
 * @example
 * ```ts
 * clausesToString([
 *   { id: '1', type: 'tags', tags: ['important', 'backend'] },
 *   { id: '2', type: 'comment', state: 'unresolved' }
 * ]);
 * // "tags important,backend; comment unresolved"
 * ```
 */
export const clausesToString = (clauses: ElementSearchClause[]): string => {
  const dest: string[] = [];

  for (const clause of clauses) {
    switch (clause.type) {
      case 'query':
        dest.push(clause.query);
        break;
      case 'any':
        dest.push(`ANY(${clausesToString(clause.clauses)})`);
        break;
      case 'props':
        dest.push(`${clause.path} ${clause.relation} ${clause.value}`);

        break;
      case 'tags':
        dest.push(`tags ${clause.tags.join(',')}`);
        break;
      case 'comment':
        if (clause.state) {
          dest.push(`comment ${clause.state}`);
        } else {
          dest.push('comment any');
        }
        break;
    }
  }

  return dest.join('; ');
};

// `embeddable-jq` has returned both flat id lists and nested one-or-more-id arrays.
const normalizeQueryResult = (queryResult: unknown): Set<string> => {
  const ids = Array.isArray(queryResult)
    ? queryResult.flatMap(entry => {
        if (typeof entry === 'string') return [entry];
        if (Array.isArray(entry)) return entry.filter((value): value is string => typeof value === 'string');
        return [];
      })
    : [];

  return new Set(ids);
};

// Missing intermediate objects should behave like "no match", not crash rule evaluation.
const getNestedValue = (value: unknown, path: string): unknown => {
  return path.split('.').reduce<unknown>((parent, key) => {
    if (parent == null || typeof parent !== 'object') return undefined;
    return (parent as Record<string, unknown>)[key];
  }, value);
};

/**
 * Evaluates each clause against the diagram's visible regular-layer elements.
 *
 * Each input clause produces one result set in the returned array. Callers can
 * then combine those sets using intersection or union semantics depending on
 * the surrounding rule logic.
 *
 * Query clauses are evaluated through DJQL, property clauses walk nested paths
 * safely, tag clauses match case-insensitively, and comment clauses inspect the
 * diagram comment manager for element-linked comments.
 *
 * @param diagram - The diagram whose visible regular-layer elements should be searched.
 * @param clauses - The clauses to evaluate.
 * @returns An array containing one `Set` of matching element ids per clause.
 */
export const searchByElementSearchClauses = (
  diagram: Diagram,
  clauses: ElementSearchClause[]
): Set<string>[] => {
  const results: Set<string>[] = [];
  for (const clause of clauses) {
    notImplemented.true(
      ['query', 'any', 'props', 'tags', 'comment'].includes(clause.type),
      'Not implemented yet'
    );
    if (clause.type === 'query') {
      const r = parseAndQuery(
        clause.query,
        diagram.layers.visible
          .flatMap(l => (l instanceof RegularLayer ? l.elements : []))
          .map(e => QueryElement.fromElement(e))
      );
      results.push(normalizeQueryResult(r));
    } else if (clause.type === 'any') {
      const anyResult = searchByElementSearchClauses(diagram, clause.clauses);
      results.push(
        anyResult.length === 0 ? new Set<string>() : anyResult.reduce((p, c) => p.union(c))
      );
    } else if (clause.type === 'props') {
      const re = clause.relation === 'matches' ? new RegExp(clause.value) : undefined;

      const result = new Set<string>();
      for (const layer of diagram.layers.visible) {
        if (layer instanceof RegularLayer) {
          for (const element of layer.elements) {
            const value = getNestedValue(element, clause.path);

            switch (clause.relation) {
              case 'eq':
                if (typeof value === 'string') {
                  if (value.toLowerCase() === clause.value.toLowerCase()) result.add(element.id);
                } else if (
                  typeof value === 'boolean' &&
                  (clause.value === 'true' || clause.value === 'false')
                ) {
                  if (value.toString() === clause.value) result.add(element.id);
                } else if (typeof value === 'number' && !Number.isNaN(Number(clause.value))) {
                  if (value === Number(clause.value)) result.add(element.id);
                } else if (value === clause.value) {
                  result.add(element.id);
                }
                break;
              case 'neq':
                if (typeof value === 'string') {
                  if (value.toLowerCase() !== clause.value.toLowerCase()) result.add(element.id);
                } else if (
                  typeof value === 'boolean' &&
                  (clause.value === 'true' || clause.value === 'false')
                ) {
                  if (value.toString() !== clause.value) result.add(element.id);
                } else if (typeof value === 'number' && !Number.isNaN(Number(clause.value))) {
                  if (value !== Number(clause.value)) result.add(element.id);
                } else if (value !== clause.value) {
                  result.add(element.id);
                }
                break;
              case 'gt':
                if (
                  value != null &&
                  typeof value === 'number' &&
                  !Number.isNaN(Number(clause.value))
                ) {
                  if (value > Number(clause.value)) result.add(element.id);
                } else if (value != null && value > clause.value) {
                  result.add(element.id);
                }
                break;
              case 'lt':
                if (
                  value != null &&
                  typeof value === 'number' &&
                  !Number.isNaN(Number(clause.value))
                ) {
                  if (value < Number(clause.value)) result.add(element.id);
                } else if (value != null && value < clause.value) {
                  result.add(element.id);
                }
                break;
              case 'contains':
                if (
                  value != null &&
                  typeof value === 'string' &&
                  value.toLowerCase().includes(clause.value.toLowerCase())
                )
                  result.add(element.id);
                break;
              case 'matches':
                assert.present(re);
                if (value != null && re.test(String(value))) result.add(element.id);
                break;
              case 'set':
                if (value != null) result.add(element.id);
                break;
            }
          }
        }
      }
      results.push(result);
    } else if (clause.type === 'tags') {
      const result = new Set<string>();
      for (const layer of diagram.layers.visible) {
        if (layer instanceof RegularLayer) {
          for (const element of layer.elements) {
            const elementTags = element.tags;
            const hasMatchingTag = clause.tags.some(ruleTag =>
              elementTags.some(elementTag => elementTag.toLowerCase() === ruleTag.toLowerCase())
            );

            if (hasMatchingTag) {
              result.add(element.id);
            }
          }
        }
      }
      results.push(result);
    } else if (clause.type === 'comment') {
      const allComments = diagram.commentManager.getAll();

      const matchingElements = new Set<string>();
      for (const comment of allComments) {
        if (comment.type === 'element' && comment.element) {
          if (
            (clause.state === 'unresolved' && comment.state === 'unresolved') ||
            (clause.state === 'resolved' && comment.state === 'resolved') ||
            clause.state === undefined
          ) {
            matchingElements.add(comment.element.id);
          }
        }
      }

      const result = new Set<string>();
      for (const layer of diagram.layers.visible) {
        if (layer instanceof RegularLayer) {
          for (const element of layer.elements) {
            if (matchingElements.has(element.id)) {
              result.add(element.id);
            }
          }
        }
      }
      results.push(result);
    }
  }
  return results;
};

/**
 * Performs case-insensitive subsequence matching against node text content.
 *
 * Unlike substring search, subsequence matching allows characters to appear
 * with gaps as long as they remain in order.
 *
 * @param elements - The elements to search.
 * @param searchQuery - The user-entered search query.
 * @returns The matching node elements in their original order.
 *
 * @example
 * ```ts
 * const matches = searchByText(elements, 'hlo');
 * // Matches node text such as "hello"
 * ```
 */
export const searchByText = (elements: DiagramElement[], searchQuery: string): DiagramElement[] => {
  if (!searchQuery.trim()) return [];

  const results: DiagramElement[] = [];
  const searchLower = searchQuery.toLowerCase();

  elements.forEach(element => {
    if (isNode(element)) {
      const text = element.getText();
      if (text && isSubsequence(searchLower, text.toLowerCase())) {
        results.push(element);
      }
    }
  });

  return results;
};
