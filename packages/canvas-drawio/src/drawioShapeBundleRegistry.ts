import type { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { type ShapeParser, shapeParsers } from './drawioShapeParserRegistry';
import { registerAzureShapes } from './shapes/azure';
import {
  registerOfficeCloudsShapes,
  registerOfficeCommunicationsShapes,
  registerOfficeConceptShapes,
  registerOfficeDatabasesShapes,
  registerOfficeDevicesShapes,
  registerOfficeSecurityShapes,
  registerOfficeServersShapes,
  registerOfficeServicesShapes,
  registerOfficeSitesShapes,
  registerOfficeUsersShapes
} from './shapes/office';
import { registerCitrixShapes } from './shapes/citrix';
import { registerVeeamShapes } from './shapes/veeam';
import { registerVeeam2dShapes } from './shapes/veeam2d';
import { registerVeeam3dShapes } from './shapes/veeam3d';
import { registerCisco19Shapes } from './shapes/cisco19';
import { registerAWS4Shapes } from './shapes/aws4';
import { registerGCP2Shapes } from './shapes/gcp2/gcp2';
import { registerC4Shapes } from './shapes/c4';
import { registerSalesforceShapes } from './shapes/salesforce';
import { registerAndroidShapes } from './shapes/android/android';
import { registerUMLShapes } from './shapes/uml/canvas-drawio-stencil-uml-loader';

type ShapeBundle = (
  registry: NodeDefinitionRegistry,
  parsers: Record<string, ShapeParser>
) => Promise<void>;

const shapeBundles: Array<[RegExp, ShapeBundle]> = [
  [/^mxgraph\.azure/, registerAzureShapes],
  [/^mxgraph\.office\.communications/, registerOfficeCommunicationsShapes],
  [/^mxgraph\.office\.concepts/, registerOfficeConceptShapes],
  [/^mxgraph\.office\.clouds/, registerOfficeCloudsShapes],
  [/^mxgraph\.office\.databases/, registerOfficeDatabasesShapes],
  [/^mxgraph\.office\.devices/, registerOfficeDevicesShapes],
  [/^mxgraph\.office\.security/, registerOfficeSecurityShapes],
  [/^mxgraph\.office\.servers/, registerOfficeServersShapes],
  [/^mxgraph\.office\.services/, registerOfficeServicesShapes],
  [/^mxgraph\.office\.sites/, registerOfficeSitesShapes],
  [/^mxgraph\.office\.users/, registerOfficeUsersShapes],
  [/^mxgraph\.citrix/, registerCitrixShapes],
  [/^mxgraph\.veeam2/, registerVeeamShapes],
  [/^mxgraph\.veeam\.2d/, registerVeeam2dShapes],
  [/^mxgraph\.veeam\.3d/, registerVeeam3dShapes],
  [/^mxgraph\.cisco19/, registerCisco19Shapes],
  [/^mxgraph\.aws4/, registerAWS4Shapes],
  [/^mxgraph\.gcp2/, registerGCP2Shapes],
  [/^mxgraph\.c4/, registerC4Shapes],
  [/^mxgraph\.salesforce/, registerSalesforceShapes],
  [/^mxgraph\.android/, registerAndroidShapes],
  [
    /^(module|folder|providedRequiredInterface|requiredInterface|uml[A-Z][a-z]+)$/,
    registerUMLShapes
  ]
];

export const getShapeBundle = (shape: string | undefined): ShapeBundle | undefined => {
  if (!shape) return undefined;
  return shapeBundles.find(([r]) => shape.match(r))?.[1];
};

const alreadyLoaded = new Set<ShapeBundle>();

export const loadShapeBundle = async (loader: ShapeBundle, registry: NodeDefinitionRegistry) => {
  if (alreadyLoaded.has(loader)) return;
  await loader(registry, shapeParsers);
  alreadyLoaded.add(loader);
};
