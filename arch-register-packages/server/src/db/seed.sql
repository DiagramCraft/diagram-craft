-- ============================================================
-- Starter metamodel: Backstage-style hierarchy
-- Domain > System > Component / API / Resource
-- ============================================================

-- Schema IDs
--   Domain    : 00000000-0000-0000-0000-000000000001
--   System    : 00000000-0000-0000-0000-000000000002
--   Component : 00000000-0000-0000-0000-000000000003
--   API       : 00000000-0000-0000-0000-000000000004
--   Resource  : 00000000-0000-0000-0000-000000000005

INSERT INTO workspace (id, name, url_slug, short_code, description) VALUES
(
  'default',
  'Default Workspace',
  'default',
  'DW',
  'The default workspace'
);

INSERT INTO workspace_lifecycle_state (id, workspace, label, color, sort_order) VALUES
  ('proposed',     'default', 'Proposed',     'var(--accent)', 0),
  ('experimental', 'default', 'Experimental', 'var(--accent)', 1),
  ('production',   'default', 'Production',   'var(--ok)',     2),
  ('deprecated',   'default', 'Deprecated',   'var(--warn)',   3);

INSERT INTO workspace_owner (id, workspace, sort_order) VALUES
  ('platform-team', 'default', 0),
  ('ux-team',       'default', 1),
  ('security-team', 'default', 2);

INSERT INTO entity_schema (id, workspace, name, fields, color, icon) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'default',
  'Domain',
  '[]',
  'var(--tag-system)', 'globe'
),
(
  '00000000-0000-0000-0000-000000000002',
  'default',
  'System',
  '[
    {"id": "domain",       "name": "Domain",        "type": "containment",
     "schemaId": "00000000-0000-0000-0000-000000000001", "minCount": 1, "maxCount": 1}
  ]',
  'var(--tag-database)', 'layers'
),
(
  '00000000-0000-0000-0000-000000000003',
  'default',
  'Component',
  '[
    {"id": "technology",   "name": "Technology",   "type": "text"},
    {"id": "system",       "name": "System",        "type": "containment",
     "schemaId": "00000000-0000-0000-0000-000000000002", "minCount": 1, "maxCount": 1},
    {"id": "provides_apis","name": "Provided APIs", "type": "reference",
     "schemaId": "00000000-0000-0000-0000-000000000004", "minCount": 0, "maxCount": -1},
    {"id": "consumes_apis","name": "Consumed APIs", "type": "reference",
     "schemaId": "00000000-0000-0000-0000-000000000004", "minCount": 0, "maxCount": -1},
    {"id": "depends_on",   "name": "Depends On",   "type": "reference",
     "schemaId": "00000000-0000-0000-0000-000000000003", "minCount": 0, "maxCount": -1}
  ]',
  'var(--tag-component)', 'box'
),
(
  '00000000-0000-0000-0000-000000000004',
  'default',
  'API',
  '[
    {"id": "api_type",     "name": "Type",          "type": "select",
     "options": [
       {"value": "openapi",  "label": "OpenAPI"},
       {"value": "grpc",     "label": "gRPC"},
       {"value": "graphql",  "label": "GraphQL"},
       {"value": "asyncapi", "label": "AsyncAPI"}
     ]},
    {"id": "system",       "name": "System",        "type": "containment",
     "schemaId": "00000000-0000-0000-0000-000000000002", "minCount": 1, "maxCount": 1}
  ]',
  'var(--tag-api)', 'api'
),
(
  '00000000-0000-0000-0000-000000000005',
  'default',
  'Resource',
  '[
    {"id": "resource_type","name": "Type",          "type": "text"},
    {"id": "system",       "name": "System",        "type": "containment",
     "schemaId": "00000000-0000-0000-0000-000000000002", "minCount": 0, "maxCount": 1}
  ]',
  'var(--tag-service)', 'database'
);


-- ============================================================
-- Seed entities
-- ============================================================

-- Entity IDs
--   Domain  "engineering"       : 00000000-0000-0000-0001-000000000001
--   System  "customer-portal"   : 00000000-0000-0000-0002-000000000001
--   System  "identity-platform" : 00000000-0000-0000-0002-000000000002
--   Comp    "api-gateway"       : 00000000-0000-0000-0003-000000000001
--   Comp    "frontend-app"      : 00000000-0000-0000-0003-000000000002
--   Comp    "auth-service"      : 00000000-0000-0000-0003-000000000003
--   API     "customer-api"      : 00000000-0000-0000-0004-000000000001
--   API     "auth-api"          : 00000000-0000-0000-0004-000000000002
--   Resource "postgres-main"    : 00000000-0000-0000-0005-000000000001

-- Domain
INSERT INTO entity (id, workspace, slug, namespace, name, description, owner, lifecycle, tags, links, schema_id, data) VALUES
(
  '00000000-0000-0000-0001-000000000001',
  'default',
  'engineering', 'default', 'Engineering',
  'The core engineering domain covering all customer-facing products and infrastructure.',
  'platform-team', 'production',
  '{"core", "customer-facing"}',
  '[]',
  '00000000-0000-0000-0000-000000000001',
  '{}'
);

-- Systems (containment: domain → Engineering)
INSERT INTO entity (id, workspace, slug, namespace, name, description, owner, lifecycle, tags, links, schema_id, data) VALUES
(
  '00000000-0000-0000-0002-000000000001',
  'default',
  'customer-portal', 'default', 'Customer Portal',
  'Public-facing portal for customer self-service.',
  'ux-team', 'production',
  '{"tier-0", "customer-facing"}',
  '[{"url": "https://wiki.example.com/customer-portal", "title": "Wiki", "type": "docs"}]',
  '00000000-0000-0000-0000-000000000002',
  '{"domain": "00000000-0000-0000-0001-000000000001"}'
),
(
  '00000000-0000-0000-0002-000000000002',
  'default',
  'identity-platform', 'default', 'Identity Platform',
  'Centralised authentication and authorisation service.',
  'security-team', 'production',
  '{"tier-0", "security"}',
  '[]',
  '00000000-0000-0000-0000-000000000002',
  '{"domain": "00000000-0000-0000-0001-000000000001"}'
);

-- APIs (containment: system; inserted before Components so Component refs are valid)
INSERT INTO entity (id, workspace, slug, namespace, name, description, owner, lifecycle, tags, links, schema_id, data) VALUES
(
  '00000000-0000-0000-0004-000000000001',
  'default',
  'customer-api', 'default', 'Customer API',
  'REST API exposing customer data to the portal frontend.',
  'platform-team', 'production',
  '{"rest", "public"}',
  '[{"url": "https://api.example.com/docs/customer", "title": "API Docs", "type": "docs"}]',
  '00000000-0000-0000-0000-000000000004',
  '{"api_type": "openapi", "system": "00000000-0000-0000-0002-000000000001"}'
),
(
  '00000000-0000-0000-0004-000000000002',
  'default',
  'auth-api', 'default', 'Auth API',
  'gRPC API for token issuance and validation.',
  'security-team', 'production',
  '{"grpc", "internal"}',
  '[]',
  '00000000-0000-0000-0000-000000000004',
  '{"api_type": "grpc", "system": "00000000-0000-0000-0002-000000000002"}'
);

-- Components (containment: system; reference: provides_apis, consumes_apis, depends_on)
INSERT INTO entity (id, workspace, slug, namespace, name, description, owner, lifecycle, tags, links, schema_id, data) VALUES
(
  '00000000-0000-0000-0003-000000000001',
  'default',
  'api-gateway', 'default', 'API Gateway',
  'Edge gateway that routes requests and enforces rate limits.',
  'platform-team', 'production',
  '{"nodejs", "tier-0"}',
  '[{"url": "https://github.com/example/api-gateway", "title": "Source", "type": "source"}]',
  '00000000-0000-0000-0000-000000000003',
  '{
    "technology": "Node.js",
    "system": "00000000-0000-0000-0002-000000000001",
    "provides_apis": "00000000-0000-0000-0004-000000000001",
    "consumes_apis": "00000000-0000-0000-0004-000000000002"
  }'
),
(
  '00000000-0000-0000-0003-000000000002',
  'default',
  'frontend-app', 'default', 'Frontend App',
  'React single-page application served to end users.',
  'ux-team', 'production',
  '{"react", "frontend"}',
  '[]',
  '00000000-0000-0000-0000-000000000003',
  '{
    "technology": "React",
    "system": "00000000-0000-0000-0002-000000000001",
    "consumes_apis": "00000000-0000-0000-0004-000000000001",
    "depends_on": "00000000-0000-0000-0003-000000000001"
  }'
),
(
  '00000000-0000-0000-0003-000000000003',
  'default',
  'auth-service', 'default', 'Auth Service',
  'Issues and validates JWTs; integrates with the identity platform.',
  'security-team', 'production',
  '{"go", "security"}',
  '[]',
  '00000000-0000-0000-0000-000000000003',
  '{
    "technology": "Go",
    "system": "00000000-0000-0000-0002-000000000002",
    "provides_apis": "00000000-0000-0000-0004-000000000002"
  }'
);

-- Resource (containment: system; optional)
INSERT INTO entity (id, workspace, slug, namespace, name, description, owner, lifecycle, tags, links, schema_id, data) VALUES
(
  '00000000-0000-0000-0005-000000000001',
  'default',
  'postgres-main', 'default', 'Postgres Main',
  'Primary PostgreSQL cluster used by the Customer Portal system.',
  'platform-team', 'production',
  '{"postgres", "managed"}',
  '[{"url": "https://grafana.example.com/d/postgres-main", "title": "Dashboard", "type": "dashboard"}]',
  '00000000-0000-0000-0000-000000000005',
  '{"resource_type": "database", "system": "00000000-0000-0000-0002-000000000001"}'
);
