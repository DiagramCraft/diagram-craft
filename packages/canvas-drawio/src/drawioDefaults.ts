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
import type { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import type { ShapeParser } from './drawioShapeParsers';
import { registerAzureShapes } from './shapes/azure';
import { registerUMLShapes } from './shapes/uml/uml';
import { registerVeeamShapes } from './shapes/veeam';
import { registerCitrixShapes } from './shapes/citrix';
import { registerVeeam2dShapes } from './shapes/veeam2d';
import { registerVeeam3dShapes } from './shapes/veeam3d';
import { registerCisco19Shapes } from './shapes/cisco19';
import { registerAWS4Shapes } from './shapes/aws4';
import { registerGCP2Shapes } from './shapes/gcp2/gcp2';
import { registerC4Shapes } from './shapes/c4';
import { registerSalesforceShapes } from './shapes/salesforce';
import { registerAndroidShapes } from './shapes/android/android';
import type { ARROW_SHAPES } from '@diagram-craft/canvas/arrowShapes';
import { shapeParsers } from './drawioShapeParsers';

export const drawioBuiltinShapes: Partial<Record<string, string>> = {
  actor:
    'stencil(tZPtDoIgFIavhv8IZv1tVveBSsm0cPjZ3QeCNlBytbU5tvc8x8N74ABwXOekogDBHOATQCiAUK5S944mdUXTRgc7IhhJSqpJ3Qhe0J5ljanBHjkVrFEUnwE8yhz14TghaXETvH1kDgDo4mVXLugKmHBF1LYLMOE771R3g3Zmenk6vcntP5RIW6FrBHYRIyOjB2RjI8MJY613E8c2/85DsLdNhI6JmdumfCZ+8nDAtgfHwoz/exAQbpwEdC4kcny8E9zAhpOS19SbNc60ZzblTLOy1M9mpcD462Lqx6h+rGPgBQ==)'
};

type Loader = (
  registry: NodeDefinitionRegistry,
  parsers: Record<string, ShapeParser>
) => Promise<void>;

const loaders: Array<[RegExp, Loader]> = [
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

export const getLoader = (shape: string | undefined): Loader | undefined => {
  if (!shape) return undefined;
  return loaders.find(([r]) => shape.match(r))?.[1];
};

const alreadyLoaded = new Set<Loader>();

export const load = async (loader: Loader, registry: NodeDefinitionRegistry) => {
  if (alreadyLoaded.has(loader)) return;
  await loader(registry, shapeParsers);
  alreadyLoaded.add(loader);
};

export const arrows: Record<string, keyof typeof ARROW_SHAPES> = {
  'open': 'SQUARE_STICK_ARROW',
  'classic': 'SHARP_ARROW_FILLED',
  'classicThin': 'SHARP_ARROW_THIN_FILLED',
  'oval': 'BALL_FILLED',
  'doubleBlock': 'SQUARE_DOUBLE_ARROW_FILLED',
  'doubleBlock-outline': 'SQUARE_DOUBLE_ARROW_OUTLINE',
  'ERzeroToMany-outline': 'CROWS_FEET_BALL',
  'ERzeroToOne-outline': 'BAR_BALL',
  'ERoneToMany-outline': 'CROWS_FEET_BAR',
  'ERmandOne-outline': 'BAR_DOUBLE',
  'ERone-outline': 'BAR',
  'baseDash-outline': 'BAR_END',
  'halfCircle-outline': 'SOCKET',
  'box-outline': 'BOX_OUTLINE',
  'diamond-outline': 'DIAMOND_OUTLINE',
  'diamondThin-outline': 'DIAMOND_THIN_OUTLINE',
  'diamond': 'DIAMOND_FILLED',
  'diamondThin': 'DIAMOND_THIN_FILLED',
  'circle': 'BALL_FILLED',
  'circle-outline': 'BALL_OUTLINE',
  'circlePlus-outline': 'BALL_PLUS_OUTLINE',
  'oval-outline': 'BALL_OUTLINE',
  'block': 'SQUARE_ARROW_FILLED',
  'blockThin': 'SQUARE_ARROW_THIN_FILLED',
  'block-outline': 'SQUARE_ARROW_OUTLINE',
  'open-outline': 'SQUARE_STICK_ARROW',
  'openAsync-outline': 'SQUARE_STICK_ARROW_HALF_LEFT',
  'async': 'SQUARE_STICK_ARROW_HALF_LEFT_THIN_FILLED',
  'classic-outline': 'SHARP_ARROW_OUTLINE',
  'blockThin-outline': 'SQUARE_ARROW_THIN_OUTLINE',
  'async-outline': 'SQUARE_STICK_ARROW_HALF_LEFT_THIN_OUTLINE',
  'dash-outline': 'SLASH',
  'cross-outline': 'CROSS',
  'openThin-outline': 'SQUARE_STICK_ARROW',
  'manyOptional': 'CROWS_FEET_BALL_FILLED',
  'manyOptional-outline': 'CROWS_FEET_BALL'
};
