import { NodeDefinitionRegistry, Registry } from '@diagram-craft/model/elementDefinitionRegistry';
import { getStencilSubPackage, StencilPackage } from '@diagram-craft/model/stencilRegistry';
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
import { UMLArtifactNodeDefinition } from '@diagram-craft/stencil-uml/deployment/UMLArtifact.nodeType';
import { UMLNodeNodeDefinition } from '@diagram-craft/stencil-uml/deployment/UMLNode.nodeType';
import {
  UMLLifelineContainerNodeDefinition,
  UMLLifelineNodeDefinition
} from '@diagram-craft/stencil-uml/sequence/UMLLifeline.nodeType';
import { UMLLifelineExecutionNodeDefinition } from '@diagram-craft/stencil-uml/sequence/UMLLifelineExecution.nodeType';
import { UMLDestroyNodeDefinition } from '@diagram-craft/stencil-uml/sequence/UMLDestroy.nodeType';
import { UMLDurationConstraintNodeDefinition } from '@diagram-craft/stencil-uml/sequence/UMLDurationConstraint.nodeType';
import { loadStencilsFromYaml } from '@diagram-craft/model/elementDefinitionLoader';
import classStencils from './class/uml-class-stencils.yaml';
import componentStencils from './component/uml-component-stencils.yaml';
import compositeStencils from './composite/uml-composite-stencils.yaml';
import commonStencils from './common/uml-common-stencils.yaml';
import packageStencils from './package/uml-package-stencils.yaml';
import useCaseStencils from './use-case/uml-use-case-stencils.yaml';
import deploymentStencils from './deployment/uml-deployment-stencils.yaml';
import sequenceStencils from './sequence/uml-sequence-stencils.yaml';

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
  nodes.register(new UMLArtifactNodeDefinition());
  nodes.register(new UMLNodeNodeDefinition());
  nodes.register(new UMLLifelineContainerNodeDefinition());
  nodes.register(new UMLLifelineNodeDefinition());
  nodes.register(new UMLLifelineExecutionNodeDefinition());
  nodes.register(new UMLDestroyNodeDefinition());
  nodes.register(new UMLDurationConstraintNodeDefinition());
};

export const loadUMLStencils = async (registry: Registry) => {
  await registerUMLNodes(registry.nodes);

  const umlStencils: StencilPackage = {
    id: 'uml',
    stencils: [],
    type: 'default',

    subPackages: [
      { id: 'common', name: 'Common', stencils: [] },
      { id: 'class', name: 'Class Diagrams', stencils: [] },
      { id: 'component', name: 'Component Diagrams', stencils: [] },
      { id: 'composite', name: 'Composite Diagrams', stencils: [] },
      { id: 'deployment', name: 'Deployment Diagrams', stencils: [] },
      { id: 'sequence', name: 'Sequence Diagrams', stencils: [] },
      { id: 'use-case', name: 'Use-Case Diagrams', stencils: [] },
      { id: 'package', name: 'Package Diagrams', stencils: [] }
    ]
  };

  /* *********************************************************************** */
  /* COMMON PACKAGE                                                          */
  /* *********************************************************************** */

  loadStencilsFromYaml(commonStencils, umlStencils, getStencilSubPackage(umlStencils, 'common'));

  /* *********************************************************************** */
  /* CLASS PACKAGE                                                           */
  /* *********************************************************************** */

  //  addStencilToSubpackage('class', umlStencils, new UMLClassNodeDefinition());

  loadStencilsFromYaml(classStencils, umlStencils, getStencilSubPackage(umlStencils, 'class'));

  /* *********************************************************************** */
  /* COMPONENT PACKAGE                                                       */
  /* *********************************************************************** */

  loadStencilsFromYaml(componentStencils, umlStencils, getStencilSubPackage(umlStencils, 'component'));

  /* *********************************************************************** */
  /* COMPOSITE PACKAGE                                                       */
  /* *********************************************************************** */

  loadStencilsFromYaml(compositeStencils, umlStencils, getStencilSubPackage(umlStencils, 'composite'));

  /* *********************************************************************** */
  /* PACKAGE PACKAGE                                                         */
  /* *********************************************************************** */

  loadStencilsFromYaml(packageStencils, umlStencils, getStencilSubPackage(umlStencils, 'package'));

  /* *********************************************************************** */
  /* USE CASE PACKAGE                                                        */
  /* *********************************************************************** */

  loadStencilsFromYaml(useCaseStencils, umlStencils, getStencilSubPackage(umlStencils, 'use-case'));

  /* *********************************************************************** */
  /* DEPLOYMENT PACKAGE                                                      */
  /* *********************************************************************** */

  loadStencilsFromYaml(deploymentStencils, umlStencils, getStencilSubPackage(umlStencils, 'deployment'));

  /* *********************************************************************** */
  /* SEQUENCE PACKAGE                                                        */
  /* *********************************************************************** */

  loadStencilsFromYaml(sequenceStencils, umlStencils, getStencilSubPackage(umlStencils, 'sequence'));

  return umlStencils;
};
