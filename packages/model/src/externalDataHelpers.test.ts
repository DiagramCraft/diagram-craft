import { describe, expect, it } from 'vitest';
import { getExternalDataStatus } from './externalDataHelpers';
import { TestModel } from './test-support/testModel';
import { UnitOfWork } from './unitOfWork';

describe('getExternalDataStatus()', () => {
  it('should return "none" if no metadata data exists', () => {
    const element = TestModel.newDiagram().newLayer().createNode();
    const schemaId = 'testSchema';
    const result = getExternalDataStatus(element, schemaId);
    expect(result).toBe('none');
  });

  it('should return "none" if data array does not contain schemaId', () => {
    const diagram = TestModel.newDiagram();
    const element = diagram.newLayer().createNode();
    element.updateMetadata(p => {
      p.data = { data: [{ schema: 'otherSchema', type: 'external', data: {} }] };
    }, UnitOfWork.immediate(diagram));

    const result = getExternalDataStatus(element, 'testSchema');
    expect(result).toBe('none');
  });

  it('should return "linked" if an external item with matching schemaId exists', () => {
    const diagram = TestModel.newDiagram();
    const element = diagram.newLayer().createNode();
    element.updateMetadata(p => {
      p.data = { data: [{ schema: 'testSchema', type: 'external', data: {} }] };
    }, UnitOfWork.immediate(diagram));

    const result = getExternalDataStatus(element, 'testSchema');
    expect(result).toBe('linked');
  });

  it('should return "unlinked" if a non-external item with matching schemaId exists', () => {
    const diagram = TestModel.newDiagram();
    const element = diagram.newLayer().createNode();
    element.updateMetadata(p => {
      p.data = { data: [{ schema: 'testSchema', type: 'schema', data: {} }] };
    }, UnitOfWork.immediate(diagram));

    const result = getExternalDataStatus(element, 'testSchema');
    expect(result).toBe('unlinked');
  });
});
