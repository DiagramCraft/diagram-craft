import { NodeDefinitionRegistry, Registry } from '@diagram-craft/model/elementDefinitionRegistry';
import { StencilPackage } from '@diagram-craft/model/stencilRegistry';
import { UMLClassNodeDefinition } from '@diagram-craft/stencil-uml/class/UMLClass.nodeType';
import { UMLClassTemplateNodeDefinition } from '@diagram-craft/stencil-uml/class/UMLClassTemplate.nodeType';
import { loadStencilsFromYaml } from '@diagram-craft/model/elementDefinitionLoader';
import classStencils from './class/uml-class-stencils.yaml';

export const registerUMLNodes = async (nodes: NodeDefinitionRegistry) => {
  nodes.register(new UMLClassNodeDefinition());
  nodes.register(new UMLClassTemplateNodeDefinition());
};

export const loadUMLStencils = async (registry: Registry) => {
  await registerUMLNodes(registry.nodes);

  const umlStencils: StencilPackage = {
    stencils: [],
    type: 'default',

    subPackages: [
      { id: 'class', name: 'Class Diagrams', stencils: [] },
      { id: 'use-case', name: 'Use-Case Diagrams', stencils: [] }
    ]
  };

  /* *********************************************************************** */
  /* CLASS PACKAGE                                                           */
  /* *********************************************************************** */

  //  addStencilToSubpackage('class', umlStencils, new UMLClassNodeDefinition());

  loadStencilsFromYaml(classStencils).forEach(s => {
    umlStencils.stencils.push(s);
    umlStencils.subPackages!.find(p => p.id === 'class')?.stencils.push(s);
  });

  return umlStencils;
};
