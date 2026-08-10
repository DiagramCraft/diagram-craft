import type { ArtifactStatus, ArtifactType } from '@arch-register/api-types/artifactContract';
import type { DatabaseAdapter } from '../../db/database';
import type { ArtifactDiagnosticDb } from './db/artifactDatabase';

export type ArtifactRevisionProcessorInput = {
  revisionId: string;
  content: string;
  mediaType: string | null;
  timestamp: Date;
};

export type ArtifactRevisionProcessing = {
  status: Extract<ArtifactStatus, 'current' | 'invalid' | 'unsupported'>;
  diagnostic: ArtifactDiagnosticDb | null;
  persist: (
    tx: DatabaseAdapter,
    input: { workspace: string; revisionId: string; timestamp: Date }
  ) => Promise<void>;
};

export type ArtifactRevisionProcessor = {
  artifactType: ArtifactType;
  processRevision: (input: ArtifactRevisionProcessorInput) => Promise<ArtifactRevisionProcessing>;
};

export type ArtifactProcessorRegistry = {
  get: (artifactType: ArtifactType) => ArtifactRevisionProcessor | null;
};

export const createArtifactProcessorRegistry = (
  processors: readonly ArtifactRevisionProcessor[]
): ArtifactProcessorRegistry => {
  const byArtifactType = new Map(processors.map(processor => [processor.artifactType, processor]));
  return {
    get: artifactType => byArtifactType.get(artifactType) ?? null
  };
};
