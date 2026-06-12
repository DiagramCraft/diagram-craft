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

INSERT INTO workspace (id, name, url_slug, short_code, description)
VALUES ('default',
        'Default Workspace',
        'default',
        'DW',
        'The default workspace');

INSERT INTO workspace_ai_config (workspace, provider, api_key_enc, base_url, model, temperature, system_prompt, enabled, created_at, updated_at)
VALUES ('default', 'openrouter', NULL, NULL, NULL, NULL, NULL, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

INSERT INTO workspace_lifecycle_state (id, workspace, label, color, sort_order)
VALUES ('proposed', 'default', 'Proposed', 'var(--accent)', 0),
       ('experimental', 'default', 'Experimental', 'var(--accent)', 1),
       ('production', 'default', 'Production', 'var(--ok)', 2),
       ('deprecated', 'default', 'Deprecated', 'var(--warn)', 3);

INSERT INTO workspace_owner (id, workspace, sort_order)
VALUES ('platform-team', 'default', 0),
       ('ux-team', 'default', 1),
       ('security-team', 'default', 2);

INSERT INTO entity_schema (id, workspace, name, fields, color, icon)
VALUES ('00000000-0000-0000-0000-000000000001',
        'default',
        'Domain',
        '[]',
        'oklch(0.66 0.14 80)', 'globe'),
       ('00000000-0000-0000-0000-000000000002',
        'default',
        'System',
        '[
          {"id": "domain",       "name": "Domain",        "type": "containment",
           "schemaId": "00000000-0000-0000-0000-000000000001", "minCount": 1, "maxCount": 1}
        ]',
        'oklch(0.62 0.14 295)', 'layers'),
       ('00000000-0000-0000-0000-000000000003',
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
        'oklch(0.62 0.13 145)', 'box'),
       ('00000000-0000-0000-0000-000000000004',
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
        'oklch(0.66 0.16 258)', 'api'),
       ('00000000-0000-0000-0000-000000000005',
        'default',
        'Resource',
        '[
          {"id": "resource_type","name": "Type",          "type": "text"},
          {"id": "system",       "name": "System",        "type": "containment",
           "schemaId": "00000000-0000-0000-0000-000000000002", "minCount": 0, "maxCount": 1}
        ]',
        'oklch(0.66 0.14 35)', 'database');


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
INSERT INTO entity (id, workspace, slug, namespace, name, description, owner, lifecycle, tags, links, schema_id, data)
VALUES ('00000000-0000-0000-0001-000000000001',
        'default',
        'engineering', 'default', 'Engineering',
        'The core engineering domain covering all customer-facing products and infrastructure.',
        'platform-team', 'production',
        '{"core", "customer-facing"}',
        '[]',
        '00000000-0000-0000-0000-000000000001',
        '{}');

-- Systems (containment: domain → Engineering)
INSERT INTO entity (id, workspace, slug, namespace, name, description, owner, lifecycle, tags, links, schema_id, data)
VALUES ('00000000-0000-0000-0002-000000000001',
        'default',
        'customer-portal', 'default', 'Customer Portal',
        'Public-facing portal for customer self-service.',
        'ux-team', 'production',
        '{"tier-0", "customer-facing"}',
        '[{"url": "https://wiki.example.com/customer-portal", "title": "Wiki", "type": "docs"}]',
        '00000000-0000-0000-0000-000000000002',
        '{"domain": "00000000-0000-0000-0001-000000000001"}'),
       ('00000000-0000-0000-0002-000000000002',
        'default',
        'identity-platform', 'default', 'Identity Platform',
        'Centralised authentication and authorisation service.',
        'security-team', 'production',
        '{"tier-0", "security"}',
        '[]',
        '00000000-0000-0000-0000-000000000002',
        '{"domain": "00000000-0000-0000-0001-000000000001"}');

-- APIs (containment: system; inserted before Components so Component refs are valid)
INSERT INTO entity (id, workspace, slug, namespace, name, description, owner, lifecycle, tags, links, schema_id, data)
VALUES ('00000000-0000-0000-0004-000000000001',
        'default',
        'customer-api', 'default', 'Customer API',
        'REST API exposing customer data to the portal frontend.',
        'platform-team', 'production',
        '{"rest", "public"}',
        '[{"url": "https://api.example.com/docs/customer", "title": "API Docs", "type": "docs"}]',
        '00000000-0000-0000-0000-000000000004',
        '{"api_type": "openapi", "system": "00000000-0000-0000-0002-000000000001"}'),
       ('00000000-0000-0000-0004-000000000002',
        'default',
        'auth-api', 'default', 'Auth API',
        'gRPC API for token issuance and validation.',
        'security-team', 'production',
        '{"grpc", "internal"}',
        '[]',
        '00000000-0000-0000-0000-000000000004',
        '{"api_type": "grpc", "system": "00000000-0000-0000-0002-000000000002"}');

-- Components (containment: system; reference: provides_apis, consumes_apis, depends_on)
INSERT INTO entity (id, workspace, slug, namespace, name, description, owner, lifecycle, tags, links, schema_id, data)
VALUES ('00000000-0000-0000-0003-000000000001',
        'default',
        'api-gateway', 'default', 'API Gateway',
        'Edge gateway that routes requests and enforces rate limits.',
        'platform-team', 'production',
        '{"nodejs", "tier-0"}',
        '[{"url": "https://github.com/example/api-gateway", "title": "Source", "type": "source"}]',
        '00000000-0000-0000-0000-000000000003',
        '{
          "technology": "Node",
          "system": "00000000-0000-0000-0002-000000000001",
          "provides_apis": "00000000-0000-0000-0004-000000000001",
          "consumes_apis": "00000000-0000-0000-0004-000000000002"
        }'),
       ('00000000-0000-0000-0003-000000000002',
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
        }'),
       ('00000000-0000-0000-0003-000000000003',
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
        }');

-- Resource (containment: system; optional)
INSERT INTO entity (id, workspace, slug, namespace, name, description, owner, lifecycle, tags, links, schema_id, data)
VALUES ('00000000-0000-0000-0005-000000000001',
        'default',
        'postgres-main', 'default', 'Postgres Main',
        'Primary PostgreSQL cluster used by the Customer Portal system.',
        'platform-team', 'production',
        '{"postgres", "managed"}',
        '[{"url": "https://grafana.example.com/d/postgres-main", "title": "Dashboard", "type": "dashboard"}]',
        '00000000-0000-0000-0000-000000000005',
        '{"resource_type": "database", "system": "00000000-0000-0000-0002-000000000001"}');

-- ============================================================
-- Seed projects and files
-- Folders are represented by `.keep` marker files.
-- ============================================================

-- Project IDs
--   "Customer Portal Modernisation" : 10000000-0000-0000-0000-000000000001
--   "Identity Hardening"            : 10000000-0000-0000-0000-000000000002
--   "Architecture Reviews"          : 10000000-0000-0000-0000-000000000003

INSERT INTO project (id, workspace, name, description, owner, status)
VALUES ('10000000-0000-0000-0000-000000000001',
        'default',
        'Customer Portal Modernisation',
        'Current-state and target-state diagrams for the customer portal platform.',
        'ux-team',
        'pinned'),
       ('10000000-0000-0000-0000-000000000002',
        'default',
        'Identity Hardening',
        'Security-focused diagrams for authentication, token flows, and boundary reviews.',
        'security-team',
        'active'),
       ('10000000-0000-0000-0000-000000000003',
        'default',
        'Architecture Reviews',
        'Archived review packs and historical diagrams from earlier architecture forums.',
        'archived');

-- Project file IDs
--   Root and folder marker files for seeded project trees
INSERT INTO content_node (id, workspace, project_id, path, name, size_bytes)
VALUES ('11000000-0000-0000-0000-000000000001',
        'default',
        '10000000-0000-0000-0000-000000000001',
        'overview.dgc',
        'overview.dgc',
        32768),
       ('11000000-0000-0000-0000-000000000002',
        'default',
        '10000000-0000-0000-0000-000000000001',
        'current-state/.keep',
        '.keep',
        0),
       ('11000000-0000-0000-0000-000000000003',
        'default',
        '10000000-0000-0000-0000-000000000001',
        'current-state/container-view.dgc',
        'container-view.dgc',
        58312),
       ('11000000-0000-0000-0000-000000000004',
        'default',
        '10000000-0000-0000-0000-000000000001',
        'target-state/.keep',
        '.keep',
        0),
       ('11000000-0000-0000-0000-000000000005',
        'default',
        '10000000-0000-0000-0000-000000000001',
        'target-state/domain-alignment.dgc',
        'domain-alignment.dgc',
        44190),
       ('11000000-0000-0000-0000-000000000006',
        'default',
        '10000000-0000-0000-0000-000000000002',
        'auth-boundaries/.keep',
        '.keep',
        0),
       ('11000000-0000-0000-0000-000000000007',
        'default',
        '10000000-0000-0000-0000-000000000002',
        'auth-boundaries/trust-zones.dgc',
        'trust-zones.dgc',
        28640),
       ('11000000-0000-0000-0000-000000000008',
        'default',
        '10000000-0000-0000-0000-000000000002',
        'flows/.keep',
        '.keep',
        0),
       ('11000000-0000-0000-0000-000000000009',
        'default',
        '10000000-0000-0000-0000-000000000002',
        'flows/login-sequence.dgc',
        'login-sequence.dgc',
        39112),
       ('11000000-0000-0000-0000-000000000010',
        'default',
        '10000000-0000-0000-0000-000000000003',
        '2024-q4-review.dgc',
        '2024-q4-review.dgc',
        21504),
       ('11000000-0000-0000-0000-000000000011',
        'default',
        '10000000-0000-0000-0000-000000000003',
        'review-pack/.keep',
        '.keep',
        0),
       ('11000000-0000-0000-0000-000000000012',
        'default',
        '10000000-0000-0000-0000-000000000003',
        'review-pack/decision-summary.dgc',
        'decision-summary.dgc',
        19456);

-- ============================================================
-- Seed audit log
-- ============================================================

INSERT INTO audit_log (id,
                       workspace,
                       timestamp,
                       user_id,
                       operation,
                       entity_type,
                       entity_id,
                       entity_name,
                       entity_slug,
                       schema_id,
                       changes,
                       metadata)
VALUES ('12000000-0000-0000-0000-000000000001',
        'default',
        '2026-05-10T09:00:00Z',
        'system',
        'create',
        'project',
        '10000000-0000-0000-0000-000000000001',
        'Customer Portal Modernisation',
        NULL,
        NULL,
        '{"new":{"name":"Customer Portal Modernisation","description":"Current-state and target-state diagrams for the customer portal platform.","status":"pinned"}}',
        '{}'),
       ('12000000-0000-0000-0000-000000000002',
        'default',
        '2026-05-10T09:05:00Z',
        'system',
        'create',
        'content_node',
        '11000000-0000-0000-0000-000000000002',
        'current-state',
        NULL,
        NULL,
        '{"new":{"path":"current-state","type":"folder"}}',
        '{"project_id":"10000000-0000-0000-0000-000000000001","path":"current-state","is_folder":true}'),
       ('12000000-0000-0000-0000-000000000003',
        'default',
        '2026-05-10T09:12:00Z',
        'system',
        'create',
        'content_node',
        '11000000-0000-0000-0000-000000000003',
        'container-view.dgc',
        NULL,
        NULL,
        '{"new":{"path":"current-state/container-view.dgc","name":"container-view.dgc","size_bytes":58312}}',
        '{"project_id":"10000000-0000-0000-0000-000000000001","path":"current-state/container-view.dgc"}'),
       ('12000000-0000-0000-0000-000000000004',
        'default',
        '2026-05-11T13:45:00Z',
        'system',
        'update',
        'entity',
        '00000000-0000-0000-0002-000000000001',
        'Customer Portal',
        'customer-portal',
        '00000000-0000-0000-0000-000000000002',
        '{"old":{"description":"Public-facing portal for customer self-service."},"new":{"description":"Public-facing portal for customer self-service and account management."}}',
        '{}'),
       ('12000000-0000-0000-0000-000000000005',
        'default',
        '2026-05-12T08:30:00Z',
        'system',
        'create',
        'project',
        '10000000-0000-0000-0000-000000000002',
        'Identity Hardening',
        NULL,
        NULL,
        '{"new":{"name":"Identity Hardening","description":"Security-focused diagrams for authentication, token flows, and boundary reviews.","status":"active"}}',
        '{}'),
       ('12000000-0000-0000-0000-000000000006',
        'default',
        '2026-05-12T08:34:00Z',
        'system',
        'create',
        'content_node',
        '11000000-0000-0000-0000-000000000006',
        'auth-boundaries',
        NULL,
        NULL,
        '{"new":{"path":"auth-boundaries","type":"folder"}}',
        '{"project_id":"10000000-0000-0000-0000-000000000002","path":"auth-boundaries","is_folder":true}'),
       ('12000000-0000-0000-0000-000000000007',
        'default',
        '2026-05-12T08:41:00Z',
        'system',
        'create',
        'content_node',
        '11000000-0000-0000-0000-000000000009',
        'login-sequence.dgc',
        NULL,
        NULL,
        '{"new":{"path":"flows/login-sequence.dgc","name":"login-sequence.dgc","size_bytes":39112}}',
        '{"project_id":"10000000-0000-0000-0000-000000000002","path":"flows/login-sequence.dgc"}'),
       ('12000000-0000-0000-0000-000000000008',
        'default',
        '2026-05-15T16:20:00Z',
        'system',
        'create',
        'project',
        '10000000-0000-0000-0000-000000000003',
        'Architecture Reviews',
        NULL,
        NULL,
        '{"new":{"name":"Architecture Reviews","description":"Archived review packs and historical diagrams from earlier architecture forums.","status":"archived"}}',
        '{}'),
       ('12000000-0000-0000-0000-000000000009',
        'default',
        '2026-05-18T11:10:00Z',
        'system',
        'update',
        'project',
        '10000000-0000-0000-0000-000000000003',
        'Architecture Reviews',
        NULL,
        NULL,
        '{"old":{"status":"active"},"new":{"status":"archived"}}',
        '{}'),
       ('12000000-0000-0000-0000-000000000010',
        'default',
        '2026-05-20T07:55:00Z',
        'system',
        'update',
        'entity',
        '00000000-0000-0000-0003-000000000003',
        'Auth Service',
        'auth-service',
        '00000000-0000-0000-0000-000000000003',
        '{"old":{"lifecycle":"experimental"},"new":{"lifecycle":"production"}}',
        '{}');
