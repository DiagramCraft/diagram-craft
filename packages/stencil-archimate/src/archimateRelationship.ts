export type ArchimateRelationship =
  | 'composition'
  | 'aggregation'
  | 'assignment'
  | 'realization'
  | 'serving'
  | 'access'
  | 'influence'
  | 'triggering'
  | 'flow'
  | 'specialization'
  | 'association';

export type ArchimateAccessMode = 'access' | 'read' | 'write' | 'read-write';
export type ArchimateInfluenceModifier = '+' | '-';

export type ArchimateEdgeProps = {
  relationship?: ArchimateRelationship;
  accessMode?: ArchimateAccessMode;
  influenceModifier?: ArchimateInfluenceModifier;
};

declare global {
  namespace DiagramCraft {
    interface CustomEdgePropsExtensions {
      archimate?: ArchimateEdgeProps;
    }
  }
}

export {};
