import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnitOfWork } from './unitOfWork';
import { AnchorEndpoint, FreeEndpoint, PointInNodeEndpoint } from './endpoint';
import { TestModel } from './test-support/builder';
import {
  resetListeners,
  standardTestModel,
  type StandardTestModel
} from './test-support/collaborationModelTestUtils';
import { DiagramEdge } from './diagramEdge';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';

describe.each(Backends.all())('DiagramEdge [%s]', (_name, backend) => {
  let edge1: DiagramEdge;
  let edge2: DiagramEdge | undefined;
  let model: StandardTestModel;

  beforeEach(() => {
    backend.beforeEach();
    model = standardTestModel(backend);
    edge1 = model.layer1.addEdge();
    edge2 = model.diagram2?.lookup(edge1.id) as DiagramEdge | undefined;
  });
  afterEach(backend.afterEach);

  const resetUow = () => (model.uow = UnitOfWork.immediate(model.diagram1));

  describe('start/end', () => {
    it('should set start/end to FreeEndpoint', () => {
      // **** Act
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.setStart(new FreeEndpoint({ x: 0, y: 0 }), uow)
      );
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.setEnd(new FreeEndpoint({ x: 10, y: 10 }), uow)
      );

      // **** Verify
      expect(edge1.start).toBeInstanceOf(FreeEndpoint);
      expect(edge1.start.serialize()).toStrictEqual({ position: { x: 0, y: 0 } });
      expect(edge1.end).toBeInstanceOf(FreeEndpoint);
      expect(edge1.end.serialize()).toStrictEqual({ position: { x: 10, y: 10 } });
      expect(model.elementChange[0]).toHaveBeenCalledTimes(2);
      if (model.doc2) {
        expect(edge2?.start).toBeInstanceOf(FreeEndpoint);
        expect(edge2?.start.serialize()).toStrictEqual({ position: { x: 0, y: 0 } });
        expect(edge2?.end).toBeInstanceOf(FreeEndpoint);
        expect(edge2?.end.serialize()).toStrictEqual({ position: { x: 10, y: 10 } });
        expect(model.elementChange[1]).toHaveBeenCalledTimes(2);
      }
    });

    it('should set start/end to PointInNodeEndpoint', () => {
      // ***** Setup
      const node1 = model.layer1.addNode();
      const node2 = model.layer1.addNode();
      node2.setBounds({ x: 200, y: 200, w: 10, h: 10, r: 0 }, model.uow);

      // **** Act
      model.reset();
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.setStart(
          new PointInNodeEndpoint(node1, undefined, { x: 0.5, y: 0.5 }, 'relative'),
          uow
        )
      );
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.setEnd(
          new PointInNodeEndpoint(node2, { x: 1, y: 1 }, { x: 10, y: 10 }, 'absolute'),
          uow
        )
      );

      // **** Verify
      const expectedStart = {
        node: {
          id: node1.id
        },
        offset: { x: 0.5, y: 0.5 },
        offsetType: 'relative',
        position: { x: 5, y: 5 },
        ref: undefined
      };

      const expectedEnd = {
        node: {
          id: node2.id
        },
        offset: { x: 10, y: 10 },
        offsetType: 'absolute',
        position: { x: 220, y: 220 },
        ref: {
          x: 1,
          y: 1
        }
      };

      expect(edge1.start).toBeInstanceOf(PointInNodeEndpoint);
      expect(edge1.start.serialize()).toStrictEqual(expectedStart);
      expect(edge1.end).toBeInstanceOf(PointInNodeEndpoint);
      expect(edge1.end.serialize()).toStrictEqual(expectedEnd);
      expect(edge1.isConnected()).toBe(true);
      expect(edge1.isConnected()).toBe(true);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(4);
      if (model.doc2) {
        expect(edge2?.start).toBeInstanceOf(PointInNodeEndpoint);
        expect(edge2?.start.serialize()).toStrictEqual(expectedStart);
        expect(edge2?.end).toBeInstanceOf(PointInNodeEndpoint);
        expect(edge2?.end.serialize()).toStrictEqual(expectedEnd);
        expect(edge2?.isConnected()).toBe(true);
        expect(edge2?.isConnected()).toBe(true);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(4);
      }
    });

    it('should set start/end to AnchorEndpoint', () => {
      // ***** Setup
      const node1 = model.layer1.addNode();
      const node2 = model.layer1.addNode();
      node2.setBounds({ x: 200, y: 200, w: 10, h: 10, r: 0 }, model.uow);

      // **** Act
      model.reset();
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.setStart(new AnchorEndpoint(node1, 'c'), uow)
      );
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.setEnd(new AnchorEndpoint(node2, 'c', { x: 0.25, y: 0.25 }), uow)
      );

      // **** Verify
      const expectedStart = {
        anchor: 'c',
        node: {
          id: node1.id
        },
        offset: { x: 0, y: 0 },
        position: { x: 5, y: 5 }
      };

      const expectedEnd = {
        anchor: 'c',
        node: {
          id: node2.id
        },
        offset: { x: 0.25, y: 0.25 },
        position: { x: 207.5, y: 207.5 }
      };

      expect(edge1.start).toBeInstanceOf(AnchorEndpoint);
      expect(edge1.start.serialize()).toStrictEqual(expectedStart);
      expect(edge1.end).toBeInstanceOf(AnchorEndpoint);
      expect(edge1.end.serialize()).toStrictEqual(expectedEnd);
      expect(edge1.isConnected()).toBe(true);
      expect(edge1.isConnected()).toBe(true);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(4);
      if (model.doc2) {
        expect(edge2?.start).toBeInstanceOf(AnchorEndpoint);
        expect(edge2?.start.serialize()).toStrictEqual(expectedStart);
        expect(edge2?.end).toBeInstanceOf(AnchorEndpoint);
        expect(edge2?.end.serialize()).toStrictEqual(expectedEnd);
        expect(edge2?.isConnected()).toBe(true);
        expect(edge2?.isConnected()).toBe(true);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(4);
      }
    });
  });

  describe('name', () => {
    it('should return the name from the first label node if label nodes exist', () => {
      // **** Act
      const node = model.layer1.addNode();
      UnitOfWork.execute(model.diagram1, uow => node.setText('LabelNodeName', uow));

      // **** Verify
      expect(node.getText()).toBe('LabelNodeName');
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      if (model.doc2) {
        expect(model.diagram2!.nodeLookup.get(node.id)?.getText()).toBe('LabelNodeName');
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }

      // Setup
      model.reset();

      // **** Act
      const labelNode = node.asLabelNode();
      UnitOfWork.execute(model.diagram1, uow => edge1.setLabelNodes([labelNode], uow));

      // **** Verify
      expect(edge1.name).toBe('LabelNodeName');
      expect(model.elementChange[0]).toHaveBeenCalledTimes(2);
      if (model.doc2) {
        expect(edge2?.name).toBe('LabelNodeName');
        expect(model.elementChange[1]).toHaveBeenCalledTimes(2);
      }
    });

    it('should return the metadata name if no label nodes and metadata name is set', () => {
      // **** Act
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.updateMetadata(props => {
          props.name = 'MetadataName';
          return props;
        }, uow)
      );

      // **** Verify
      expect(edge1.name).toBe('MetadataName');
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      if (model.doc2) {
        expect(edge2?.name).toBe('MetadataName');
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should return the concatenated names of connected nodes if no label nodes or metadata name', () => {
      const start = model.layer1.addNode();
      start.setText('StartNode', model.uow);

      const end = model.layer1.addNode();
      end.setText('EndNode', model.uow);

      // **** Act
      model.reset();
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.setStart(new AnchorEndpoint(start, 'c'), uow)
      );
      UnitOfWork.execute(model.diagram1, uow => edge1.setEnd(new AnchorEndpoint(end, 'c'), uow));

      // **** Verify
      expect(edge1.name).toBe('StartNode - EndNode');
      expect(model.elementChange[0]).toHaveBeenCalledTimes(4);
      if (model.doc2) {
        expect(edge2?.name).toBe('StartNode - EndNode');
        expect(model.elementChange[1]).toHaveBeenCalledTimes(4);
      }
    });

    it('should return the edge id if no label nodes, metadata name, or connected node names', () => {
      // **** Verify
      expect(edge1.name).toBe(edge1.id);
      if (model.doc2) expect(edge2?.name).toBe(edge1.id);
    });
  });

  describe('bounds', () => {
    it('should return a box defined by the start and end positions', () => {
      // **** Setup
      const startNode = model.layer1.addNode();
      startNode.setBounds({ x: 10, y: 20, w: 10, h: 10, r: 0 }, model.uow);

      const endNode = model.layer1.addNode();
      endNode.setBounds({ x: 100, y: 200, w: 10, h: 10, r: 0 }, model.uow);

      // **** Act
      model.reset();
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.setStart(new AnchorEndpoint(startNode, 'c'), uow)
      );
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.setEnd(new AnchorEndpoint(endNode, 'c'), uow)
      );

      // **** Verify
      const bounds = edge1.bounds;
      expect(bounds).toStrictEqual({ x: 15, y: 25, w: 90, h: 180, r: 0 });
      expect(model.elementChange[0]).toHaveBeenCalledTimes(4);
      if (model.doc2) {
        expect(edge2!.bounds!).toStrictEqual({ x: 15, y: 25, w: 90, h: 180, r: 0 });
        expect(model.elementChange[1]).toHaveBeenCalledTimes(4);
      }
    });

    it('should trigger an elementChange event', () => {
      // **** Setup
      edge1.setStart(new FreeEndpoint({ x: 0, y: 0 }), model.uow);
      edge1.setEnd(new FreeEndpoint({ x: 10, y: 10 }), model.uow);

      // **** Act
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.setBounds({ x: 15, y: 25, w: 90, h: 180, r: 0 }, uow)
      );

      // **** Verify
      const bounds = edge1.bounds;
      expect(bounds).toStrictEqual({ x: 15, y: 25, w: 10, h: 10, r: 0 });
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      if (model.doc2) {
        expect(edge2!.bounds!).toStrictEqual({ x: 15, y: 25, w: 10, h: 10, r: 0 });

        // TODO: Why is there 4 events here
        expect(model.elementChange[1]).toHaveBeenCalledTimes(4);
      }
    });
  });

  describe('labelNodes', () => {
    it('should return empty array when no label nodes are set', () => {
      // **** Verify
      expect(edge1.labelNodes).toEqual([]);
      if (model.doc2) expect(edge2!.labelNodes).toEqual([]);
    });

    it('should return correct label nodes after setting them', () => {
      // **** Setup
      const labelNode = model.layer1.addNode().asLabelNode();

      // **** Act
      UnitOfWork.execute(model.diagram1, uow => edge1.setLabelNodes([labelNode], uow));

      // **** Verify
      expect(edge1.labelNodes).toEqual([labelNode]);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(2);
      if (model.doc2) {
        expect(edge2!.labelNodes).toHaveLength(1);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(2);
      }
    });
  });

  describe('addChild', () => {
    it('should set the parent of the child correctly', () => {
      // **** Act
      const child = model.layer1.createNode();
      UnitOfWork.execute(model.diagram1, uow => edge1.addChild(child, uow));

      expect(child.parent!.id).toBe(edge1.id);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(2);
      if (model.doc2) {
        expect(model.diagram2!.lookup(child.id)!.parent).toBe(edge2);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(2);
      }
    });

    it('should append the child to the children array if no relation is provided', () => {
      // **** Act
      const child = model.layer1.createNode();
      edge1.addChild(child, model.uow);

      // **** Verify
      expect(edge1.children[edge1.children.length - 1]).toBe(child);
      if (model.doc2) expect(edge2!.children[edge2!.children.length - 1]!.id).toBe(child.id);
    });

    it('should update both parent and child in UnitOfWork', () => {
      // **** Act
      const child = model.layer1.createNode();
      edge1.addChild(child, model.uow);

      // **** Verify
      expect(model.uow.contains(edge1, 'update')).toBe(true);
      expect(model.uow.contains(child, 'update')).toBe(true);
    });

    it('should be added to the diagram if it is not already present', () => {
      // **** Act
      const child = model.layer1.createNode();
      edge1.addChild(child, model.uow);

      // **** Verify
      expect(model.diagram1.lookup(child.id)).toBe(child);
      if (model.doc2) expect(model.diagram2!.lookup(child.id)?.id).toBe(child.id);
    });

    it('should be added to labelNodes if it is a label node', () => {
      // **** Act
      const child = model.layer1.createNode();
      edge1.addChild(child, model.uow);

      // **** Verify
      expect(edge1.labelNodes?.length).toBe(1);
      expect(edge1.labelNodes?.[0]!.node().id).toBe(child.id);
      if (model.doc2) {
        expect(edge2?.labelNodes).toHaveLength(1);
        expect(edge2?.labelNodes?.[0]!.node().id).toBe(child.id);
      }
    });

    it('should not add the child if it is already present', () => {
      // **** Act
      const child = model.layer1.createNode();
      edge1.addChild(child, model.uow);

      // **** Verify
      expect(() => edge1.addChild(child, model.uow)).toThrow();
    });

    it('should not add the child if it is already present in a different diagram', () => {
      // **** Act
      const child = model.layer1.createNode();
      const otherDiagram = TestModel.newDiagram();
      const otherEdge = otherDiagram.newLayer().addEdge();

      // **** Verify
      expect(() => otherEdge.addChild(child, model.uow)).toThrow();
    });

    it('should fail is the child is an edge', () => {
      // **** Act
      const child = model.layer1.addEdge();

      // **** Verify
      expect(() => edge1.addChild(child, model.uow)).toThrow();
    });
  });

  describe('removeChild', () => {
    it('should remove the child from the children array', () => {
      // **** Setup
      const elementRemove = [vi.fn(), vi.fn()];
      model.diagram1.on('elementRemove', elementRemove[0]!);
      if (model.diagram2) model.diagram2.on('elementRemove', elementRemove[1]!);

      const child = model.layer1.createNode();
      edge1.addChild(child, model.uow);

      resetListeners(model.elementChange);

      // **** Act
      UnitOfWork.execute(model.diagram1, uow => edge1.removeChild(child, uow));

      // **** Verify
      expect(edge1.children.length).toBe(0);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      expect(elementRemove[0]).toHaveBeenCalledTimes(1);
      if (model.doc2) {
        expect(edge2!.children.length).toBe(0);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
        expect(elementRemove[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should remove the child from the labelNodes array if it is a label node', () => {
      // **** Setup
      const child = model.layer1.createNode();
      edge1.addChild(child, model.uow);

      // **** Act
      edge1.removeChild(child, model.uow);

      // **** Verify
      expect(edge1.labelNodes?.length).toBe(0);
      if (model.doc2) expect(edge2?.labelNodes?.length).toBe(0);
    });

    it('should fail if the child is not present', () => {
      // **** Verify
      const child = model.layer1.createNode();
      expect(() => edge1.removeChild(child, model.uow)).toThrow();
    });

    it('should update both parent and child in UnitOfWork', () => {
      // **** Setup
      const child = model.layer1.createNode();
      edge1.addChild(child, model.uow);

      // **** Act
      resetUow();
      edge1.removeChild(child, model.uow);

      // **** Verify
      expect(model.uow.contains(edge1, 'update')).toBe(true);
      expect(model.uow.contains(child, 'remove')).toBe(true);
    });
  });

  describe('setChildren', () => {
    it('should set the children correctly', () => {
      // **** Setup
      const child1 = model.layer1.createNode();
      const child2 = model.layer1.createNode();

      // **** Act
      UnitOfWork.execute(model.diagram1, uow => edge1.setChildren([child1, child2], uow));

      // **** Verify
      expect(edge1.children).toEqual([child1, child2]);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(3);
      if (model.doc2) {
        expect(edge2?.children).toHaveLength(2);

        // TODO: Why 4 times and not 3
        expect(model.elementChange[1]).toHaveBeenCalledTimes(4);
      }
    });

    it('should remove all children from the previous set', () => {
      // **** Setup
      const child1 = model.layer1.createNode();
      const child2 = model.layer1.createNode();
      edge1.addChild(child1, model.uow);
      edge1.addChild(child2, model.uow);

      // **** Act
      resetUow();
      edge1.setChildren([child1], model.uow);

      // **** Verify
      expect(edge1.children).toEqual([child1]);
      if (model.doc2) expect(edge2?.children).toHaveLength(1);

      expect(model.uow.contains(edge1, 'update')).toBe(true);
      expect(model.uow.contains(child1, 'update')).toBe(true);
      expect(model.uow.contains(child2, 'remove')).toBe(true);
    });
  });

  describe('setLabelNodes', () => {
    it('should set the label nodes correctly', () => {
      // **** Setup
      const labelNode = model.layer1.createNode().asLabelNode();

      // **** Act
      UnitOfWork.execute(model.diagram1, uow => edge1.setLabelNodes([labelNode], uow));

      // **** Verify
      expect(edge1.labelNodes).toEqual([labelNode]);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(2);
      if (model.doc2) {
        expect(edge2?.labelNodes).toHaveLength(1);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(2);
      }
    });

    it('should remove all label nodes from the previous set', () => {
      // **** Setup
      const labelNode1 = model.layer1.createNode().asLabelNode();
      const labelNode2 = model.layer1.createNode().asLabelNode();

      // **** Act
      edge1.setLabelNodes([labelNode1, labelNode2], model.uow);

      // **** Verify
      expect(edge1.labelNodes).toEqual([labelNode1, labelNode2]);
      expect(edge1.labelNodes?.length).toBe(2);
      if (model.doc2) expect(edge2?.labelNodes).toHaveLength(2);

      // **** Act
      edge1.setLabelNodes([labelNode1], model.uow);

      // **** Verify
      expect(edge1.labelNodes).toEqual([labelNode1]);
      expect(edge1.labelNodes?.length).toBe(1);
      if (model.doc2) expect(edge2?.labelNodes).toHaveLength(1);
    });

    it('should remove update children', () => {
      // **** Setup
      const labelNode1 = model.layer1.createNode().asLabelNode();
      const labelNode2 = model.layer1.createNode().asLabelNode();

      // **** Act
      edge1.setLabelNodes([labelNode1, labelNode2], model.uow);

      // **** Verify
      expect(edge1.children).toEqual([labelNode1.node(), labelNode2.node()]);
      expect(edge1.children?.length).toBe(2);
      if (model.doc2) expect(edge2?.children).toHaveLength(2);

      // **** Act
      edge1.setLabelNodes([labelNode1], model.uow);

      // **** Verify
      expect(edge1.children).toEqual([labelNode1.node()]);
      expect(edge1.children?.length).toBe(1);
      if (model.doc2) expect(edge2?.children).toHaveLength(1);
    });
  });

  describe('addLabelNode', () => {
    it('should add the label node to the label nodes array', () => {
      // **** Setup
      const labelNode = model.layer1.createNode().asLabelNode();

      // **** Act
      UnitOfWork.execute(model.diagram1, uow => edge1.addLabelNode(labelNode, uow));

      // **** Verify
      expect(edge1.labelNodes).toEqual([labelNode]);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(2);
      if (model.doc2) {
        expect(edge2?.labelNodes).toHaveLength(1);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(2);
      }
    });

    it('should update the label node in the UnitOfWork', () => {
      // **** Setup
      const labelNode = model.layer1.createNode().asLabelNode();

      // **** Act
      edge1.addLabelNode(labelNode, model.uow);

      // **** Verify
      expect(model.uow.contains(edge1, 'update')).toBe(true);
      expect(model.uow.contains(labelNode.node(), 'update')).toBe(true);
    });

    it('should fail if the label node is already present', () => {
      // **** Setup
      const labelNode = model.layer1.createNode().asLabelNode();

      // **** Act
      edge1.addLabelNode(labelNode, model.uow);

      // **** Verify
      expect(() => edge1.addLabelNode(labelNode, model.uow)).toThrow();
    });

    it('should update children', () => {
      // **** Setup
      const labelNode = model.layer1.createNode().asLabelNode();

      // **** Act
      edge1.addChild(labelNode.node(), model.uow);

      // **** Verify
      expect(edge1.children).toEqual([labelNode.node()]);
      if (model.doc2) expect(edge2?.children).toHaveLength(1);
    });
  });

  describe('removeLabelNode', () => {
    it('should remove the label node from the label nodes array', () => {
      // **** Setup
      const labelNode = model.layer1.createNode().asLabelNode();
      edge1.addLabelNode(labelNode, model.uow);

      const elementChange = [vi.fn(), vi.fn()];
      model.diagram1.on('elementChange', elementChange[0]!);
      if (model.diagram2) model.diagram2.on('elementChange', elementChange[1]!);

      // **** Act
      UnitOfWork.execute(model.diagram1, uow => edge1.removeLabelNode(labelNode, uow));

      // **** Verify
      expect(edge1.labelNodes).toHaveLength(0);
      expect(edge1.children).toHaveLength(0);
      expect(elementChange[0]).toHaveBeenCalledTimes(1);
      if (model.doc2) {
        expect(edge2?.labelNodes).toHaveLength(0);
        expect(edge2?.children).toHaveLength(0);
        expect(elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should fail if the label node is not present', () => {
      // **** Setup
      const labelNode = model.layer1.createNode().asLabelNode();

      // **** Act
      // **** Verify
      expect(() => edge1.removeLabelNode(labelNode, model.uow)).toThrow();
    });
  });

  describe('addWaypoint', () => {
    it('should add waypoint to straight edge', () => {
      // Act
      model.reset();
      UnitOfWork.execute(model.diagram1, uow => edge1.addWaypoint({ point: { x: 5, y: 5 } }, uow));

      // Verify
      expect(edge1.waypoints).toHaveLength(1);
      expect(edge1.waypoints[0]!.point).toEqual({ x: 5, y: 5 });
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      if (edge2) {
        expect(edge2.waypoints).toHaveLength(1);
        expect(edge2.waypoints[0]!.point).toEqual({ x: 5, y: 5 });
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should add waypoint to straight edge in an ordered way', () => {
      // Act
      edge1.addWaypoint({ point: { x: 75, y: 75 } }, model.uow);
      edge1.addWaypoint({ point: { x: 5, y: 5 } }, model.uow);

      // Verify
      expect(edge1.waypoints).toHaveLength(2);
      expect(edge1.waypoints[0]!.point).toEqual({ x: 5, y: 5 });
      expect(edge1.waypoints[1]!.point).toEqual({ x: 75, y: 75 });
      if (edge2) {
        expect(edge2.waypoints).toHaveLength(2);
        expect(edge2.waypoints[0]!.point).toEqual({ x: 5, y: 5 });
        expect(edge2.waypoints[1]!.point).toEqual({ x: 75, y: 75 });
      }
    });
  });

  describe('removeWaypoint', () => {
    it('should remove waypoint', () => {
      // Setup
      edge1.addWaypoint({ point: { x: 75, y: 75 } }, model.uow);
      edge1.addWaypoint({ point: { x: 5, y: 5 } }, model.uow);

      // Act
      model.reset();
      UnitOfWork.execute(model.diagram1, uow => edge1.removeWaypoint(edge1.waypoints[0]!, uow));

      // Verify
      expect(edge1.waypoints).toHaveLength(1);
      expect(edge1.waypoints[0]!.point).toEqual({ x: 75, y: 75 });
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      if (edge2) {
        expect(edge2.waypoints).toHaveLength(1);
        expect(edge2.waypoints[0]!.point).toEqual({ x: 75, y: 75 });
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('moveWaypoint', () => {
    it('should move waypoint', () => {
      // Setup
      edge1.addWaypoint({ point: { x: 75, y: 75 } }, model.uow);
      edge1.addWaypoint({ point: { x: 5, y: 5 } }, model.uow);

      // Act
      model.reset();
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.moveWaypoint(edge1.waypoints[0]!, { x: 50, y: 50 }, uow)
      );

      // Verify
      expect(edge1.waypoints[0]!.point).toEqual({ x: 50, y: 50 });
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      if (edge2) {
        expect(edge2.waypoints[0]!.point).toEqual({ x: 50, y: 50 });
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('replaceWaypoint', () => {
    it('should replace waypoint', () => {
      // Setup
      edge1.addWaypoint({ point: { x: 75, y: 75 } }, model.uow);
      edge1.addWaypoint({ point: { x: 5, y: 5 } }, model.uow);

      // Act
      model.reset();
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.replaceWaypoint(1, { point: { x: 50, y: 50 } }, uow)
      );

      // Verify
      expect(edge1.waypoints[1]!.point).toEqual({ x: 50, y: 50 });
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      if (edge2) {
        expect(edge2.waypoints[1]!.point).toEqual({ x: 50, y: 50 });
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('updateProps', () => {
    it('should update simple props', () => {
      // Act
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.updateProps(p => {
          p.stroke ??= {};
          p.stroke.color = 'red';
        }, uow)
      );

      // Verify
      expect(edge1.storedProps.stroke!.color).toBe('red');
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      if (edge2) {
        expect(edge2.storedProps.stroke!.color).toBe('red');
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('updateCustomProps', () => {
    it('should update custom props', () => {
      // Act
      UnitOfWork.execute(model.diagram1, uow =>
        edge1.updateCustomProps(
          'blockArrow',
          p => {
            p.width = 20;
          },
          uow
        )
      );

      // Verify
      expect(edge1.storedProps.custom!.blockArrow!.width).toBe(20);
      expect(model.elementChange[0]).toHaveBeenCalledTimes(1);
      if (edge2) {
        expect(edge2.storedProps.custom!.blockArrow!.width).toBe(20);
        expect(model.elementChange[1]).toHaveBeenCalledTimes(1);
      }
    });
  });
});
