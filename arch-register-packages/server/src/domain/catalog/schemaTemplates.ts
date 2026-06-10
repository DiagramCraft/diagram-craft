import {
  AR_COLOR_GREEN,
  AR_COLOR_BLUE,
  AR_COLOR_ORANGE,
  AR_COLOR_PURPLE,
  AR_COLOR_YELLOW,
  AR_COLOR_RED
} from '@arch-register/api-types/colors';
import { randomUUID } from 'node:crypto';
import type { SchemaDbCreate } from '../../db/database';
import { SchemaField } from '@arch-register/api-types/schemas';

type SymbolicField =
  | { id: string; name: string; type: 'text' | 'longtext' | 'boolean' | 'date' }
  | { id: string; name: string; type: 'select'; enumId: string }
  | {
      id: string;
      name: string;
      type: 'reference' | 'containment';
      symSchemaId: string;
      minCount: number;
      maxCount: number;
    };

type TemplateSchema = {
  symId: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  fields: SymbolicField[];
};

type SchemaTemplate = {
  id: string;
  name: string;
  description: string;
  schemas: TemplateSchema[];
};

export const SCHEMA_TEMPLATES: SchemaTemplate[] = [
  {
    id: 'backstage',
    name: 'Backstage',
    description: 'CNCF Backstage Software Catalog — Domain, System, Component, API, Resource',
    schemas: [
      {
        symId: 'domain',
        name: 'Domain',
        description: 'A high-level grouping that owns one or more Systems.',
        color: AR_COLOR_YELLOW,
        icon: 'globe',
        fields: []
      },
      {
        symId: 'system',
        name: 'System',
        description:
          'A collection of resources that exposes one or more APIs to users and other Systems.',
        color: AR_COLOR_PURPLE,
        icon: 'layers',
        fields: [
          {
            id: 'domain',
            name: 'Domain',
            type: 'containment',
            symSchemaId: 'domain',
            minCount: 1,
            maxCount: 1
          }
        ]
      },
      {
        symId: 'api',
        name: 'API',
        description: 'A machine-readable interface definition (OpenAPI, gRPC, GraphQL, AsyncAPI).',
        color: AR_COLOR_BLUE,
        icon: 'api',
        fields: [
          { id: 'api_type', name: 'Type', type: 'select', enumId: '' },
          {
            id: 'system',
            name: 'System',
            type: 'containment',
            symSchemaId: 'system',
            minCount: 1,
            maxCount: 1
          }
        ]
      },
      {
        symId: 'component',
        name: 'Component',
        description: 'A deployable unit of code within a System (service, library, website, etc.).',
        color: AR_COLOR_GREEN,
        icon: 'box',
        fields: [
          { id: 'kind', name: 'Kind', type: 'select', enumId: '' },
          { id: 'technology', name: 'Technology', type: 'text' },
          { id: 'go_live_date', name: 'Go Live Date', type: 'date' },
          {
            id: 'system',
            name: 'System',
            type: 'containment',
            symSchemaId: 'system',
            minCount: 1,
            maxCount: 1
          },
          {
            id: 'provides_apis',
            name: 'Provided APIs',
            type: 'reference',
            symSchemaId: 'api',
            minCount: 0,
            maxCount: -1
          },
          {
            id: 'consumes_apis',
            name: 'Consumed APIs',
            type: 'reference',
            symSchemaId: 'api',
            minCount: 0,
            maxCount: -1
          }
        ]
      },
      {
        symId: 'resource',
        name: 'Resource',
        description:
          'Infrastructure a System depends on (database, cache, queue, blob storage, etc.).',
        color: AR_COLOR_ORANGE,
        icon: 'database',
        fields: [
          { id: 'kind', name: 'Kind', type: 'select', enumId: '' },
          { id: 'planned_decommission', name: 'Planned Decommission', type: 'date' },
          {
            id: 'system',
            name: 'System',
            type: 'containment',
            symSchemaId: 'system',
            minCount: 0,
            maxCount: 1
          }
        ]
      }
    ]
  },
  {
    id: 'c4',
    name: 'C4 Model',
    description: 'C4 Model by Simon Brown — Person, Software System, Container, Component',
    schemas: [
      {
        symId: 'person',
        name: 'Person',
        description: 'A user or actor that interacts with one or more Software Systems.',
        color: AR_COLOR_YELLOW,
        icon: 'user',
        fields: [{ id: 'description', name: 'Description', type: 'longtext' }]
      },
      {
        symId: 'software_system',
        name: 'Software System',
        description: 'The highest level of abstraction — something that delivers value to users.',
        color: AR_COLOR_PURPLE,
        icon: 'layers',
        fields: [{ id: 'description', name: 'Description', type: 'longtext' }]
      },
      {
        symId: 'container',
        name: 'Container',
        description:
          'A separately deployable/runnable unit within a Software System (app, service, DB, etc.).',
        color: AR_COLOR_GREEN,
        icon: 'box',
        fields: [
          { id: 'technology', name: 'Technology', type: 'text' },
          { id: 'description', name: 'Description', type: 'longtext' },
          {
            id: 'system',
            name: 'Software System',
            type: 'containment',
            symSchemaId: 'software_system',
            minCount: 1,
            maxCount: 1
          }
        ]
      },
      {
        symId: 'component',
        name: 'Component',
        description: 'A grouping of related functionality within a Container.',
        color: AR_COLOR_BLUE,
        icon: 'settings',
        fields: [
          { id: 'technology', name: 'Technology', type: 'text' },
          {
            id: 'container',
            name: 'Container',
            type: 'containment',
            symSchemaId: 'container',
            minCount: 1,
            maxCount: 1
          },
          {
            id: 'depends_on',
            name: 'Depends On',
            type: 'reference',
            symSchemaId: 'component',
            minCount: 0,
            maxCount: -1
          }
        ]
      }
    ]
  },
  {
    id: 'itil',
    name: 'CMDB / ITIL',
    description:
      'IT Service Management — Organization, Business Service, Application, Database, Host',
    schemas: [
      {
        symId: 'organization',
        name: 'Organization',
        description: 'A business unit or department that owns one or more Business Services.',
        color: AR_COLOR_YELLOW,
        icon: 'globe',
        fields: []
      },
      {
        symId: 'business_service',
        name: 'Business Service',
        description:
          'An IT-enabled capability delivered to the business by one or more Applications.',
        color: AR_COLOR_PURPLE,
        icon: 'layers',
        fields: [
          {
            id: 'organization',
            name: 'Organization',
            type: 'containment',
            symSchemaId: 'organization',
            minCount: 0,
            maxCount: 1
          }
        ]
      },
      {
        symId: 'application',
        name: 'Application',
        description: 'A software application that supports a Business Service.',
        color: AR_COLOR_GREEN,
        icon: 'box',
        fields: [
          { id: 'technology', name: 'Technology', type: 'text' },
          { id: 'tier', name: 'Tier', type: 'select', enumId: '' },
          { id: 'sunset_date', name: 'Sunset Date', type: 'date' },
          {
            id: 'service',
            name: 'Business Service',
            type: 'containment',
            symSchemaId: 'business_service',
            minCount: 0,
            maxCount: 1
          }
        ]
      },
      {
        symId: 'database',
        name: 'Database',
        description: 'A data store used by one or more Applications.',
        color: AR_COLOR_PURPLE,
        icon: 'database',
        fields: [
          { id: 'technology', name: 'Technology', type: 'text' },
          {
            id: 'application',
            name: 'Application',
            type: 'reference',
            symSchemaId: 'application',
            minCount: 0,
            maxCount: -1
          }
        ]
      },
      {
        symId: 'host',
        name: 'Host',
        description: 'A physical or virtual machine that runs Applications and Databases.',
        color: AR_COLOR_ORANGE,
        icon: 'server',
        fields: [
          { id: 'host_type', name: 'Type', type: 'select', enumId: '' },
          { id: 'environment', name: 'Environment', type: 'select', enumId: '' },
          { id: 'patch_deadline', name: 'Patch Deadline', type: 'date' }
        ]
      }
    ]
  },
  {
    id: 'ddd',
    name: 'Domain-Driven',
    description: 'Simple DDD-inspired model — Domain, Team, Service, Event',
    schemas: [
      {
        symId: 'domain',
        name: 'Domain',
        description: 'A bounded context representing a distinct area of business knowledge.',
        color: AR_COLOR_YELLOW,
        icon: 'globe',
        fields: []
      },
      {
        symId: 'team',
        name: 'Team',
        description: 'An engineering team that owns one or more Services.',
        color: AR_COLOR_ORANGE,
        icon: 'users',
        fields: []
      },
      {
        symId: 'service',
        name: 'Service',
        description: 'A deployable unit that implements domain logic within a bounded context.',
        color: AR_COLOR_GREEN,
        icon: 'box',
        fields: [
          { id: 'kind', name: 'Kind', type: 'select', enumId: '' },
          { id: 'technology', name: 'Technology', type: 'text' },
          {
            id: 'domain',
            name: 'Domain',
            type: 'containment',
            symSchemaId: 'domain',
            minCount: 0,
            maxCount: 1
          },
          {
            id: 'depends_on',
            name: 'Depends On',
            type: 'reference',
            symSchemaId: 'service',
            minCount: 0,
            maxCount: -1
          }
        ]
      },
      {
        symId: 'event',
        name: 'Event',
        description:
          'An asynchronous message (command, event, or query) exchanged between Services.',
        color: AR_COLOR_BLUE,
        icon: 'zap',
        fields: [
          { id: 'event_type', name: 'Type', type: 'select', enumId: '' },
          {
            id: 'producer',
            name: 'Producer',
            type: 'reference',
            symSchemaId: 'service',
            minCount: 0,
            maxCount: 1
          },
          {
            id: 'consumers',
            name: 'Consumers',
            type: 'reference',
            symSchemaId: 'service',
            minCount: 0,
            maxCount: -1
          }
        ]
      }
    ]
  },
  {
    id: 'team-topologies',
    name: 'Team Topologies',
    description: "Conway's Law model — Team, System, API (interaction modes)",
    schemas: [
      {
        symId: 'team',
        name: 'Team',
        description:
          'An engineering team classified by its topology type (stream-aligned, platform, enabling, complicated-subsystem).',
        color: AR_COLOR_YELLOW,
        icon: 'users',
        fields: [
          { id: 'team_type', name: 'Type', type: 'select', enumId: '' },
          { id: 'cognitive_load', name: 'Cognitive Load Notes', type: 'longtext' }
        ]
      },
      {
        symId: 'system',
        name: 'System',
        description: 'A software system owned by a Team.',
        color: AR_COLOR_PURPLE,
        icon: 'layers',
        fields: [
          {
            id: 'owning_team',
            name: 'Owning Team',
            type: 'containment',
            symSchemaId: 'team',
            minCount: 0,
            maxCount: 1
          },
          { id: 'description', name: 'Description', type: 'longtext' }
        ]
      },
      {
        symId: 'interaction',
        name: 'Team Interaction',
        description:
          'A defined collaboration mode between two Teams (collaboration, X-as-a-Service, facilitating).',
        color: AR_COLOR_BLUE,
        icon: 'arrow-right',
        fields: [
          { id: 'mode', name: 'Mode', type: 'select', enumId: '' },
          {
            id: 'from_team',
            name: 'From Team',
            type: 'reference',
            symSchemaId: 'team',
            minCount: 1,
            maxCount: 1
          },
          {
            id: 'to_team',
            name: 'To Team',
            type: 'reference',
            symSchemaId: 'team',
            minCount: 1,
            maxCount: 1
          },
          { id: 'expected_duration', name: 'Expected Duration', type: 'text' }
        ]
      }
    ]
  },
  {
    id: 'data-mesh',
    name: 'Data Mesh',
    description:
      'Data Mesh by Zhamak Dehghani — Domain, Data Product, Dataset, Pipeline, Source System',
    schemas: [
      {
        symId: 'domain',
        name: 'Domain',
        description: 'A business domain that owns one or more Data Products.',
        color: AR_COLOR_YELLOW,
        icon: 'globe',
        fields: []
      },
      {
        symId: 'source_system',
        name: 'Source System',
        description: 'An operational system that produces raw data consumed by Data Products.',
        color: AR_COLOR_PURPLE,
        icon: 'database',
        fields: [
          { id: 'technology', name: 'Technology', type: 'text' },
          {
            id: 'domain',
            name: 'Domain',
            type: 'containment',
            symSchemaId: 'domain',
            minCount: 0,
            maxCount: 1
          }
        ]
      },
      {
        symId: 'data_product',
        name: 'Data Product',
        description: 'A self-contained, domain-owned data asset with defined SLOs.',
        color: AR_COLOR_GREEN,
        icon: 'box',
        fields: [
          { id: 'dp_type', name: 'Type', type: 'select', enumId: '' },
          { id: 'slo', name: 'SLOs', type: 'longtext' },
          { id: 'review_date', name: 'Review Date', type: 'date' },
          {
            id: 'domain',
            name: 'Domain',
            type: 'containment',
            symSchemaId: 'domain',
            minCount: 1,
            maxCount: 1
          },
          {
            id: 'source_systems',
            name: 'Source Systems',
            type: 'reference',
            symSchemaId: 'source_system',
            minCount: 0,
            maxCount: -1
          }
        ]
      },
      {
        symId: 'dataset',
        name: 'Dataset',
        description: 'A versioned, schema-defined output port of a Data Product.',
        color: AR_COLOR_BLUE,
        icon: 'table',
        fields: [
          { id: 'format', name: 'Format', type: 'select', enumId: '' },
          { id: 'schema_url', name: 'Schema URL', type: 'text' },
          { id: 'deprecation_date', name: 'Deprecation Date', type: 'date' },
          {
            id: 'data_product',
            name: 'Data Product',
            type: 'containment',
            symSchemaId: 'data_product',
            minCount: 1,
            maxCount: 1
          }
        ]
      },
      {
        symId: 'pipeline',
        name: 'Pipeline',
        description: 'A data transformation job that consumes and produces Datasets.',
        color: AR_COLOR_ORANGE,
        icon: 'git-branch',
        fields: [
          { id: 'technology', name: 'Technology', type: 'text' },
          {
            id: 'inputs',
            name: 'Inputs',
            type: 'reference',
            symSchemaId: 'dataset',
            minCount: 0,
            maxCount: -1
          },
          {
            id: 'outputs',
            name: 'Outputs',
            type: 'reference',
            symSchemaId: 'dataset',
            minCount: 0,
            maxCount: -1
          }
        ]
      }
    ]
  },
  {
    id: 'archimate',
    name: 'ArchiMate / TOGAF',
    description: 'The Open Group EA framework — Business, Application, and Technology layers',
    schemas: [
      {
        symId: 'business_capability',
        name: 'Business Capability',
        description: 'A high-level ability the organisation needs to execute its strategy.',
        color: AR_COLOR_YELLOW,
        icon: 'globe',
        fields: [
          {
            id: 'parent',
            name: 'Parent Capability',
            type: 'containment',
            symSchemaId: 'business_capability',
            minCount: 0,
            maxCount: 1
          },
          { id: 'target_date', name: 'Target Date', type: 'date' }
        ]
      },
      {
        symId: 'business_process',
        name: 'Business Process',
        description: 'A sequence of activities that realises a Business Capability.',
        color: AR_COLOR_ORANGE,
        icon: 'git-merge',
        fields: [
          {
            id: 'capability',
            name: 'Capability',
            type: 'containment',
            symSchemaId: 'business_capability',
            minCount: 0,
            maxCount: 1
          }
        ]
      },
      {
        symId: 'application_component',
        name: 'Application Component',
        description: 'A modular part of the application layer that realises a Business Process.',
        color: AR_COLOR_GREEN,
        icon: 'box',
        fields: [
          { id: 'technology', name: 'Technology', type: 'text' },
          { id: 'layer', name: 'Layer', type: 'select', enumId: '' },
          { id: 'retirement_date', name: 'Retirement Date', type: 'date' },
          {
            id: 'realises',
            name: 'Realises Process',
            type: 'reference',
            symSchemaId: 'business_process',
            minCount: 0,
            maxCount: -1
          }
        ]
      },
      {
        symId: 'application_service',
        name: 'Application Service',
        description: 'An externally visible function exposed by an Application Component.',
        color: AR_COLOR_BLUE,
        icon: 'api',
        fields: [
          {
            id: 'component',
            name: 'Component',
            type: 'containment',
            symSchemaId: 'application_component',
            minCount: 0,
            maxCount: 1
          }
        ]
      },
      {
        symId: 'technology_component',
        name: 'Technology Component',
        description:
          'Infrastructure that hosts and runs Application Components (device, system software, artifact).',
        color: AR_COLOR_PURPLE,
        icon: 'server',
        fields: [
          { id: 'technology', name: 'Technology', type: 'text' },
          { id: 'kind', name: 'Kind', type: 'select', enumId: '' },
          { id: 'end_of_support', name: 'End of Support', type: 'date' },
          {
            id: 'hosts',
            name: 'Hosts',
            type: 'reference',
            symSchemaId: 'application_component',
            minCount: 0,
            maxCount: -1
          }
        ]
      }
    ]
  },
  {
    id: 'security',
    name: 'Security / Threat Model',
    description: 'STRIDE-adjacent model — Asset, Control, Threat, Risk',
    schemas: [
      {
        symId: 'asset',
        name: 'Asset',
        description:
          'A data, service, infrastructure, or credential item that requires protection.',
        color: AR_COLOR_YELLOW,
        icon: 'shield',
        fields: [
          { id: 'classification', name: 'Classification', type: 'select', enumId: '' },
          { id: 'asset_type', name: 'Type', type: 'select', enumId: '' }
        ]
      },
      {
        symId: 'threat',
        name: 'Threat',
        description: 'A potential adverse action classified by STRIDE category.',
        color: AR_COLOR_RED,
        icon: 'alert-triangle',
        fields: [
          { id: 'stride_category', name: 'STRIDE Category', type: 'select', enumId: '' },
          { id: 'discovered_on', name: 'Discovered On', type: 'date' },
          {
            id: 'affected_assets',
            name: 'Affected Assets',
            type: 'reference',
            symSchemaId: 'asset',
            minCount: 0,
            maxCount: -1
          },
          { id: 'description', name: 'Description', type: 'longtext' }
        ]
      },
      {
        symId: 'control',
        name: 'Control',
        description: 'A safeguard or countermeasure that mitigates one or more Threats.',
        color: AR_COLOR_GREEN,
        icon: 'check-circle',
        fields: [
          { id: 'control_type', name: 'Type', type: 'select', enumId: '' },
          { id: 'last_verified', name: 'Last Verified', type: 'date' },
          {
            id: 'mitigates',
            name: 'Mitigates',
            type: 'reference',
            symSchemaId: 'threat',
            minCount: 0,
            maxCount: -1
          },
          {
            id: 'protects',
            name: 'Protects',
            type: 'reference',
            symSchemaId: 'asset',
            minCount: 0,
            maxCount: -1
          }
        ]
      },
      {
        symId: 'risk',
        name: 'Risk',
        description:
          'The combination of a Threat and its potential impact, rated by likelihood and severity.',
        color: AR_COLOR_YELLOW,
        icon: 'zap',
        fields: [
          { id: 'likelihood', name: 'Likelihood', type: 'select', enumId: '' },
          { id: 'impact', name: 'Impact', type: 'select', enumId: '' },
          { id: 'review_due', name: 'Review Due', type: 'date' },
          {
            id: 'threat',
            name: 'Threat',
            type: 'reference',
            symSchemaId: 'threat',
            minCount: 0,
            maxCount: -1
          },
          {
            id: 'controls',
            name: 'Controls',
            type: 'reference',
            symSchemaId: 'control',
            minCount: 0,
            maxCount: -1
          }
        ]
      }
    ]
  }
];

export const instantiateTemplate = (workspaceId: string, templateId: string): SchemaDbCreate[] => {
  const template = SCHEMA_TEMPLATES.find(t => t.id === templateId);
  if (!template) return [];

  const now = new Date();
  const idMap = new Map<string, string>();
  for (const schema of template.schemas) {
    idMap.set(schema.symId, randomUUID());
  }

  return template.schemas.map(schema => {
    const resolvedFields: SchemaField[] = schema.fields.map(field => {
      if (field.type === 'reference' || field.type === 'containment') {
        const resolvedId = idMap.get(field.symSchemaId) ?? field.symSchemaId;
        return {
          id: field.id,
          name: field.name,
          type: field.type,
          schemaId: resolvedId,
          minCount: field.minCount,
          maxCount: field.maxCount
        };
      }
      if (field.type === 'select') {
        return { id: field.id, name: field.name, type: field.type, enumId: field.enumId };
      }
      return { id: field.id, name: field.name, type: field.type };
    });

    return {
      id: idMap.get(schema.symId)!,
      workspace: workspaceId,
      name: schema.name,
      description: schema.description,
      color: schema.color,
      icon: schema.icon,
      fields: resolvedFields,
      default_owner: null,
      created_at: now,
      updated_at: now
    };
  });
};
