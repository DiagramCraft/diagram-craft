-- Seed entity schema types
INSERT INTO entity_schema (id, name, fields) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'Component',
  '[
    {"id": "name",       "name": "Name",       "type": "text",     "description": "Display name of the component"},
    {"id": "technology", "name": "Technology", "type": "text",     "description": "Primary language or framework"},
    {"id": "version",    "name": "Version",    "type": "text",     "description": "Current deployed version"},
    {"id": "team",       "name": "Team",       "type": "text",     "description": "Owning team"},
    {"id": "repo_url",   "name": "Repo URL",   "type": "text",     "description": "Source repository URL"},
    {"id": "tier",       "name": "Tier",       "type": "text",     "description": "Architecture tier (frontend/backend/infra)"},
    {"id": "notes",      "name": "Notes",      "type": "longtext", "description": "Additional notes"}
  ]'
),
(
  '00000000-0000-0000-0000-000000000002',
  'System',
  '[
    {"id": "name",        "name": "Name",        "type": "text",     "description": "Display name of the system"},
    {"id": "owner",       "name": "Owner",       "type": "text",     "description": "Team or person responsible"},
    {"id": "criticality", "name": "Criticality", "type": "text",     "description": "Business criticality (low/medium/high/critical)"},
    {"id": "domain",      "name": "Domain",      "type": "text",     "description": "Business domain"},
    {"id": "docs_url",    "name": "Docs URL",    "type": "text",     "description": "Link to system documentation"},
    {"id": "notes",       "name": "Notes",       "type": "longtext", "description": "Additional notes"}
  ]'
),
(
  '00000000-0000-0000-0000-000000000003',
  'Server',
  '[
    {"id": "name",        "name": "Name",        "type": "text",     "description": "Display name of the server"},
    {"id": "hostname",    "name": "Hostname",    "type": "text",     "description": "Fully qualified hostname"},
    {"id": "ip_address",  "name": "IP Address",  "type": "text",     "description": "Primary IP address"},
    {"id": "os",          "name": "OS",          "type": "text",     "description": "Operating system"},
    {"id": "environment", "name": "Environment", "type": "text",     "description": "Environment (dev/staging/prod)"},
    {"id": "region",      "name": "Region",      "type": "text",     "description": "Cloud or datacenter region"},
    {"id": "notes",       "name": "Notes",       "type": "longtext", "description": "Additional notes"}
  ]'
);

-- Example Component entities
INSERT INTO entity (name, schema_id, data) VALUES
(
  'api-gateway',
  '00000000-0000-0000-0000-000000000001',
  '{"technology": "Node.js", "version": "2.1.0", "team": "Platform", "repo_url": "https://github.com/example/api-gateway", "tier": "backend"}'
),
(
  'frontend-app',
  '00000000-0000-0000-0000-000000000001',
  '{"technology": "React", "version": "1.4.2", "team": "UX", "repo_url": "https://github.com/example/frontend-app", "tier": "frontend"}'
),
(
  'auth-service',
  '00000000-0000-0000-0000-000000000001',
  '{"technology": "Go", "version": "3.0.1", "team": "Security", "repo_url": "https://github.com/example/auth-service", "tier": "backend"}'
);

-- Example System entities
INSERT INTO entity (name, schema_id, data) VALUES
(
  'Customer Portal',
  '00000000-0000-0000-0000-000000000002',
  '{"owner": "UX Team", "criticality": "high", "domain": "Customer Experience", "docs_url": "https://wiki.example.com/customer-portal"}'
),
(
  'Identity Platform',
  '00000000-0000-0000-0000-000000000002',
  '{"owner": "Security Team", "criticality": "critical", "domain": "Security", "docs_url": "https://wiki.example.com/identity"}'
);

-- Example Server entities
INSERT INTO entity (name, schema_id, data) VALUES
(
  'prod-web-01',
  '00000000-0000-0000-0000-000000000003',
  '{"hostname": "prod-web-01.example.com", "ip_address": "10.0.1.10", "os": "Ubuntu 22.04", "environment": "prod", "region": "eu-west-1"}'
),
(
  'prod-api-01',
  '00000000-0000-0000-0000-000000000003',
  '{"hostname": "prod-api-01.example.com", "ip_address": "10.0.1.11", "os": "Ubuntu 22.04", "environment": "prod", "region": "eu-west-1"}'
),
(
  'dev-app-01',
  '00000000-0000-0000-0000-000000000003',
  '{"hostname": "dev-app-01.example.com", "ip_address": "10.0.2.20", "os": "Debian 12", "environment": "dev", "region": "eu-west-1"}'
);
