import { NodeDefinitionRegistry, Registry } from '@diagram-craft/model/elementDefinitionRegistry';
import { StencilPackage } from '@diagram-craft/model/stencilRegistry';
import { UMLClassNodeDefinition } from '@diagram-craft/stencil-uml/class/UMLClass.nodeType';
import { UMLClassTemplateNodeDefinition } from '@diagram-craft/stencil-uml/class/UMLClassTemplate.nodeType';
import { UMLProvidedInterfaceNodeDefinition } from '@diagram-craft/stencil-uml/component/UMLProvidedInterface.nodeType';
import { UMLRequiredInterfaceNodeDefinition } from '@diagram-craft/stencil-uml/component/UMLRequiredInterface.nodeType';
import { UMLStructuredClassifierNodeDefinition } from '@diagram-craft/stencil-uml/composite/UMLStructuredClassifier.nodeType';
import { UMLFrameNodeDefinition } from '@diagram-craft/stencil-uml/common/UMLFrame.nodeType';
import { UMLPortNodeDefinition } from '@diagram-craft/stencil-uml/common/UMLPort.nodeType';
import { UMLRectNodeDefinition } from '@diagram-craft/stencil-uml/common/UMLRect.nodeType';
import { UMLUseCaseNodeDefinition } from '@diagram-craft/stencil-uml/use-case/UMLUseCase.nodeType';
import { UMLPackageNodeDefinition } from '@diagram-craft/stencil-uml/package/UMLPackage.nodeType';
import { UMLPackageTemplateNodeDefinition } from '@diagram-craft/stencil-uml/package/UMLPackageTemplate.nodeType';
import { UMLActorNodeDefinition } from '@diagram-craft/stencil-uml/use-case/UMLActor.nodeType';
import { loadStencilsFromYaml } from '@diagram-craft/model/elementDefinitionLoader';
import classStencils from './class/uml-class-stencils.yaml';
import componentStencils from './component/uml-component-stencils.yaml';
import compositeStencils from './composite/uml-composite-stencils.yaml';
import commonStencils from './common/uml-common-stencils.yaml';
import packageStencils from './package/uml-package-stencils.yaml';
import useCaseStencils from './use-case/uml-use-case-stencils.yaml';

export const registerUMLNodes = async (nodes: NodeDefinitionRegistry) => {
  nodes.register(new UMLClassNodeDefinition());
  nodes.register(new UMLClassTemplateNodeDefinition());
  nodes.register(new UMLStructuredClassifierNodeDefinition());
  nodes.register(new UMLFrameNodeDefinition());
  nodes.register(new UMLPortNodeDefinition());
  nodes.register(new UMLRectNodeDefinition());
  nodes.register(new UMLUseCaseNodeDefinition());
  nodes.register(new UMLActorNodeDefinition());
  nodes.register(new UMLPackageNodeDefinition());
  nodes.register(new UMLPackageTemplateNodeDefinition());
  nodes.register(new UMLProvidedInterfaceNodeDefinition());
  nodes.register(new UMLRequiredInterfaceNodeDefinition());
};

export const loadUMLStencils = async (registry: Registry) => {
  await registerUMLNodes(registry.nodes);

  const umlStencils: StencilPackage = {
    stencils: [],
    type: 'default',

    subPackages: [
      { id: 'common', name: 'Common', stencils: [] },
      { id: 'class', name: 'Class Diagrams', stencils: [] },
      { id: 'component', name: 'Component Diagrams', stencils: [] },
      { id: 'composite', name: 'Composite Diagrams', stencils: [] },
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
  /* COMPONENT PACKAGE                                                       */
  /* *********************************************************************** */

  loadStencilsFromYaml(componentStencils).forEach(s => {
    umlStencils.stencils.push(s);
    umlStencils.subPackages!.find(p => p.id === 'component')?.stencils.push(s);
  });

  /* *********************************************************************** */
  /* COMPOSITE PACKAGE                                                       */
  /* *********************************************************************** */

  loadStencilsFromYaml(compositeStencils).forEach(s => {
    umlStencils.stencils.push(s);
    umlStencils.subPackages!.find(p => p.id === 'composite')?.stencils.push(s);
  });

  /* *********************************************************************** */
  /* PACKAGE PACKAGE                                                         */
  /* *********************************************************************** */

  loadStencilsFromYaml(packageStencils).forEach(s => {
    umlStencils.stencils.push(s);
    umlStencils.subPackages!.find(p => p.id === 'package')?.stencils.push(s);
  });

  /* *********************************************************************** */
  /* USE CASE PACKAGE                                                        */
  /* *********************************************************************** */

  loadStencilsFromYaml(useCaseStencils).forEach(s => {
    umlStencils.stencils.push(s);
    umlStencils.subPackages!.find(p => p.id === 'use-case')?.stencils.push(s);
  });

  return umlStencils;
};
