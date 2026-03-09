import { NodeDefinitionRegistry, Registry } from '@diagram-craft/model/elementDefinitionRegistry';
import { StencilPackage } from '@diagram-craft/model/stencilRegistry';
import { UMLClassNodeDefinition } from '@diagram-craft/stencil-uml/class/UMLClass.nodeType';
import { UMLClassTemplateNodeDefinition } from '@diagram-craft/stencil-uml/class/UMLClassTemplate.nodeType';
import { UMLFrameNodeDefinition } from '@diagram-craft/stencil-uml/common/UMLFrame.nodeType';
import { UMLPackageNodeDefinition } from '@diagram-craft/stencil-uml/package/UMLPackage.nodeType';
import { UMLPackageTemplateNodeDefinition } from '@diagram-craft/stencil-uml/package/UMLPackageTemplate.nodeType';
import { loadStencilsFromYaml } from '@diagram-craft/model/elementDefinitionLoader';
import classStencils from './class/uml-class-stencils.yaml';
import commonStencils from './common/uml-common-stencils.yaml';
import packageStencils from './package/uml-package-stencils.yaml';

export const registerUMLNodes = async (nodes: NodeDefinitionRegistry) => {
  nodes.register(new UMLClassNodeDefinition());
  nodes.register(new UMLClassTemplateNodeDefinition());
  nodes.register(new UMLFrameNodeDefinition());
  nodes.register(new UMLPackageNodeDefinition());
  nodes.register(new UMLPackageTemplateNodeDefinition());
};

export const loadUMLStencils = async (registry: Registry) => {
  await registerUMLNodes(registry.nodes);

  const umlStencils: StencilPackage = {
    stencils: [],
    type: 'default',

    subPackages: [
      { id: 'common', name: 'Common', stencils: [] },
      { id: 'class', name: 'Class Diagrams', stencils: [] },
      { id: 'use-case', name: 'Use-Case Diagrams', stencils: [] },
      { id: 'package', name: 'Package Diagrams', stencils: [] }
    ]
  };

  /* *********************************************************************** */
  /* COMMON PACKAGE                                                          */
  /* *********************************************************************** */

  loadStencilsFromYaml(commonStencils).forEach(s => {
    umlStencils.stencils.push(s);
    umlStencils.subPackages!.find(p => p.id === 'common')?.stencils.push(s);
  });

  /* *********************************************************************** */
  /* CLASS PACKAGE                                                           */
  /* *********************************************************************** */

  //  addStencilToSubpackage('class', umlStencils, new UMLClassNodeDefinition());

  loadStencilsFromYaml(classStencils).forEach(s => {
    umlStencils.stencils.push(s);
    umlStencils.subPackages!.find(p => p.id === 'class')?.stencils.push(s);
  });

  /* *********************************************************************** */
  /* PACKAGE PACKAGE                                                         */
  /* *********************************************************************** */

  loadStencilsFromYaml(packageStencils).forEach(s => {
    umlStencils.stencils.push(s);
    umlStencils.subPackages!.find(p => p.id === 'package')?.stencils.push(s);
  });

  return umlStencils;
};
