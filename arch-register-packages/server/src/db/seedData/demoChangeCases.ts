import { DEMO_ARCHITECTURE_IDS, USER_IDS } from './constants';

const DE = DEMO_ARCHITECTURE_IDS.dataEntities;

const DAY_MS = 24 * 60 * 60 * 1000;

export type DemoChangeCaseOutcome = 'open' | 'approved' | 'rejected' | 'withdrawn';

export type DemoChangeCase = {
  entityId: string;
  initiatorUserId: string;
  message: string;
  /** Applied on top of the entity's current state to form the proposed state. */
  propose: (current: {
    description: string;
    data: Record<string, unknown>;
  }) => { description?: string; data?: Record<string, unknown> };
  outcome: DemoChangeCaseOutcome;
  /** Days relative to seeding when the case was raised (negative = in the past). */
  raisedDaysAgo: number;
  /** Days relative to seeding when the case is due (negative = already overdue); null = no deadline. */
  dueInDays: number | null;
};

/**
 * Representative `entity.change-case` proposals against the demo Data Entities, so Data
 * Stewardship's Change cases screen has open (on time and overdue), approved, rejected and
 * withdrawn cases to show. Ordered so a withdrawn proposal precedes the open one on the same
 * entity (an entity can only have one open proposal at a time).
 */
export const demoChangeCases: DemoChangeCase[] = [
  {
    entityId: DE.productCatalogData,
    initiatorUserId: USER_IDS.designteamadmin,
    message: 'Superseded by a more precise description.',
    propose: current => ({
      description: `${current.description} Includes pricing history.`
    }),
    outcome: 'withdrawn',
    raisedDaysAgo: 30,
    dueInDays: null
  },
  {
    entityId: DE.productCatalogData,
    initiatorUserId: USER_IDS.workspaceeditor,
    message: 'Clarify that pricing history is part of the dataset.',
    propose: current => ({
      description: `${current.description} Includes pricing history and promotions.`
    }),
    outcome: 'open',
    raisedDaysAgo: 2,
    dueInDays: 7
  },
  {
    entityId: DE.orderRecords,
    initiatorUserId: USER_IDS.platformteameditor,
    message: 'Order records are also processed for GDPR data-subject requests.',
    propose: current => ({
      data: {
        ...current.data,
        regulatory_tags: [
          ...((current.data['regulatory_tags'] as string[] | undefined) ?? []),
          'gdpr'
        ]
      }
    }),
    outcome: 'open',
    raisedDaysAgo: 14,
    dueInDays: -4
  },
  {
    entityId: DE.inventoryLevels,
    initiatorUserId: USER_IDS.platformteameditor,
    message: 'Align the description with the warehouse integration.',
    propose: current => ({
      description: `${current.description} Refreshed hourly from the warehouse system.`
    }),
    outcome: 'approved',
    raisedDaysAgo: 21,
    dueInDays: -14
  },
  {
    entityId: DE.marketingConsentRecords,
    initiatorUserId: USER_IDS.securityteamadmin,
    message: 'Reclassify consent records as non-sensitive.',
    propose: current => ({
      data: { ...current.data, classification: 'non-sensitive' }
    }),
    outcome: 'rejected',
    raisedDaysAgo: 10,
    dueInDays: -3
  }
];

export const changeCaseDate = (daysFromNow: number, from: Date = new Date()) =>
  new Date(from.getTime() + daysFromNow * DAY_MS);
