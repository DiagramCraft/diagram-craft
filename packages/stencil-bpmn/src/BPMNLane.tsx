import {
  SwimlaneComponent,
  SwimlaneNodeDefinition
} from '@diagram-craft/canvas/node-types/Swimlane.nodeType';

export class BPMNLane extends SwimlaneNodeDefinition {
  constructor() {
    super('bpmnLane', 'BPMN Lane', BPMNLane.Shape);
  }

  static Shape = class extends SwimlaneComponent {};
}
