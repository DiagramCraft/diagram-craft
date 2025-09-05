import type { Diagram } from './diagram';
import { parseAndQuery } from 'embeddable-jq';
import { assert, notImplemented } from '@diagram-craft/utils/assert';
import { RegularLayer } from './diagramLayerRegular';

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

export const searchByElementSearchClauses = (
  diagram: Diagram,
  clauses: ElementSearchClause[]
): Set<string>[] => {
  const results: Set<string>[] = [];
  for (const clause of clauses) {
    notImplemented.true(
      clause.type === 'query' ||
        clause.type === 'any' ||
        clause.type === 'props' ||
        clause.type === 'tags' ||
        clause.type === 'comment',
      'Not implemented yet'
    );
    if (clause.type === 'query') {
      const r = parseAndQuery(
        clause.query,
        diagram.layers.visible.flatMap(l => (l instanceof RegularLayer ? l.elements : []))
      );
      results.push(new Set(...(r as string[])));
    } else if (clause.type === 'any') {
      const anyResult = searchByElementSearchClauses(diagram, clause.clauses);
      const result = anyResult.reduce((p, c) => p.union(c), anyResult[0]);
      results.push(result);
    } else if (clause.type === 'props') {
      const re = clause.relation === 'matches' ? new RegExp(clause.value) : undefined;

      const result = new Set<string>();
      for (const layer of diagram.layers.visible) {
        if (layer instanceof RegularLayer) {
          for (const element of (layer as RegularLayer).elements) {
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const value: any = clause.path.split('.').reduce((p, c) => p[c], element);

            switch (clause.relation) {
              case 'eq':
                if (value === clause.value) result.add(element.id);
                break;
              case 'neq':
                if (value !== clause.value) result.add(element.id);
                break;
              case 'gt':
                if (value > clause.value) result.add(element.id);
                break;
              case 'lt':
                if (value < clause.value) result.add(element.id);
                break;
              case 'contains':
                if (value.includes(clause.value)) result.add(element.id);
                break;
              case 'matches':
                assert.present(re);
                if (re.test(value)) result.add(element.id);
                break;
              case 'set':
                if (value) result.add(element.id);
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
          for (const element of (layer as RegularLayer).elements) {
            const elementTags = element.tags ?? [];
            const hasMatchingTag = clause.tags.some(ruleTag => elementTags.includes(ruleTag));

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
          for (const element of (layer as RegularLayer).elements) {
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
