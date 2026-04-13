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

INSERT INTO entity_schema (id, name, fields) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'Domain',
  '[
    {"id": "description", "name": "Description", "type": "longtext"}
  ]'
),
(
  '00000000-0000-0000-0000-000000000002',
  'System',
  '[
    {"id": "description",  "name": "Description",  "type": "longtext"},
    {"id": "domain",       "name": "Domain",        "type": "containment",
     "schemaId": "00000000-0000-0000-0000-000000000001", "minCount": 1, "maxCount": 1}
  ]'
),
(
  '00000000-0000-0000-0000-000000000003',
  'Component',
  '[
    {"id": "description",  "name": "Description",  "type": "longtext"},
    {"id": "technology",   "name": "Technology",   "type": "text"},
    {"id": "system",       "name": "System",        "type": "containment",
     "schemaId": "00000000-0000-0000-0000-000000000002", "minCount": 1, "maxCount": 1},
    {"id": "provides_apis","name": "Provided APIs", "type": "reference",
     "schemaId": "00000000-0000-0000-0000-000000000004", "minCount": 0, "maxCount": -1},
    {"id": "consumes_apis","name": "Consumed APIs", "type": "reference",
     "schemaId": "00000000-0000-0000-0000-000000000004", "minCount": 0, "maxCount": -1},
    {"id": "depends_on",   "name": "Depends On",   "type": "reference",
     "schemaId": "00000000-0000-0000-0000-000000000003", "minCount": 0, "maxCount": -1}
  ]'
),
(
  '00000000-0000-0000-0000-000000000004',
  'API',
  '[
    {"id": "description",  "name": "Description",  "type": "longtext"},
    {"id": "api_type",     "name": "Type",          "type": "select",
     "options": [
       {"value": "openapi",  "label": "OpenAPI"},
       {"value": "grpc",     "label": "gRPC"},
       {"value": "graphql",  "label": "GraphQL"},
       {"value": "asyncapi", "label": "AsyncAPI"}
     ]},
    {"id": "system",       "name": "System",        "type": "containment",
     "schemaId": "00000000-0000-0000-0000-000000000002", "minCount": 1, "maxCount": 1}
  ]'
),
(
  '00000000-0000-0000-0000-000000000005',
  'Resource',
  '[
    {"id": "description",  "name": "Description",  "type": "longtext"},
    {"id": "resource_type","name": "Type",          "type": "text"},
    {"id": "system",       "name": "System",        "type": "containment",
     "schemaId": "00000000-0000-0000-0000-000000000002", "minCount": 0, "maxCount": 1}
  ]'
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
INSERT INTO entity (id, slug, namespace, name, owner, lifecycle, schema_id, data) VALUES
(
  '00000000-0000-0000-0001-000000000001',
  'engineering', 'default', 'Engineering', 'platform-team', 'production',
  '00000000-0000-0000-0000-000000000001',
  '{"description": "The core engineering domain covering all customer-facing products and infrastructure."}'
);

-- Systems (containment: domain → Engineering)
INSERT INTO entity (id, slug, namespace, name, owner, lifecycle, schema_id, data) VALUES
(
  '00000000-0000-0000-0002-000000000001',
  'customer-portal', 'default', 'Customer Portal', 'ux-team', 'production',
  '00000000-0000-0000-0000-000000000002',
  '{"description": "Public-facing portal for customer self-service.", "domain": "00000000-0000-0000-0001-000000000001"}'
),
(
  '00000000-0000-0000-0002-000000000002',
  'identity-platform', 'default', 'Identity Platform', 'security-team', 'production',
  '00000000-0000-0000-0000-000000000002',
  '{"description": "Centralised authentication and authorisation service.", "domain": "00000000-0000-0000-0001-000000000001"}'
);

-- APIs (containment: system; inserted before Components so Component refs are valid)
INSERT INTO entity (id, slug, namespace, name, owner, lifecycle, schema_id, data) VALUES
(
  '00000000-0000-0000-0004-000000000001',
  'customer-api', 'default', 'Customer API', 'platform-team', 'production',
  '00000000-0000-0000-0000-000000000004',
  '{"description": "REST API exposing customer data to the portal frontend.", "api_type": "openapi", "system": "00000000-0000-0000-0002-000000000001"}'
),
(
  '00000000-0000-0000-0004-000000000002',
  'auth-api', 'default', 'Auth API', 'security-team', 'production',
  '00000000-0000-0000-0000-000000000004',
  '{"description": "gRPC API for token issuance and validation.", "api_type": "grpc", "system": "00000000-0000-0000-0002-000000000002"}'
);

-- Components (containment: system; reference: provides_apis, consumes_apis, depends_on)
INSERT INTO entity (id, slug, namespace, name, owner, lifecycle, schema_id, data) VALUES
(
  '00000000-0000-0000-0003-000000000001',
  'api-gateway', 'default', 'API Gateway', 'platform-team', 'production',
  '00000000-0000-0000-0000-000000000003',
  '{
    "description": "Edge gateway that routes requests and enforces rate limits.",
    "technology": "Node.js",
    "system": "00000000-0000-0000-0002-000000000001",
    "provides_apis": "00000000-0000-0000-0004-000000000001",
    "consumes_apis": "00000000-0000-0000-0004-000000000002"
  }'
),
(
  '00000000-0000-0000-0003-000000000002',
  'frontend-app', 'default', 'Frontend App', 'ux-team', 'production',
  '00000000-0000-0000-0000-000000000003',
  '{
    "description": "React single-page application served to end users.",
    "technology": "React",
    "system": "00000000-0000-0000-0002-000000000001",
    "consumes_apis": "00000000-0000-0000-0004-000000000001",
    "depends_on": "00000000-0000-0000-0003-000000000001"
  }'
),
(
  '00000000-0000-0000-0003-000000000003',
  'auth-service', 'default', 'Auth Service', 'security-team', 'production',
  '00000000-0000-0000-0000-000000000003',
  '{
    "description": "Issues and validates JWTs; integrates with the identity platform.",
    "technology": "Go",
    "system": "00000000-0000-0000-0002-000000000002",
    "provides_apis": "00000000-0000-0000-0004-000000000002"
  }'
);

-- Resource (containment: system; optional)
INSERT INTO entity (id, slug, namespace, name, owner, lifecycle, schema_id, data) VALUES
(
  '00000000-0000-0000-0005-000000000001',
  'postgres-main', 'default', 'Postgres Main', 'platform-team', 'production',
  '00000000-0000-0000-0000-000000000005',
  '{"description": "Primary PostgreSQL cluster used by the Customer Portal system.", "resource_type": "database", "system": "00000000-0000-0000-0002-000000000001"}'
);
