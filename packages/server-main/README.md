# REST Data Server

A standalone REST API server that provides data and schema endpoints for the RESTDataProvider. The server is completely decoupled from the frontend code and can be deployed independently.

## Features

- **Standalone deployment**: No dependencies on frontend code
- **REST API endpoints**: `/api/data` and `/api/schemas`
- **Full CRUD operations**: Create, Read, Update, Delete for both data and schemas
- **Filesystem persistence**: Data stored in JSON files
- **CLI bootstrap**: Initialize with existing data files
- **CORS enabled**: Works with web clients
- **Type safety**: Local type definitions ensure data consistency
- **AI-powered generation**: OpenRouter proxy for AI-powered diagram generation (optional)

## API Endpoints

### Data Endpoints

- `GET /api/data` - Get all data
- `GET /api/data/:id` - Get data by ID
- `POST /api/data` - Create new data
- `PUT /api/data/:id` - Update data
- `DELETE /api/data/:id` - Delete data

### Schema Endpoints

- `GET /api/schemas` - Get all schemas  
- `GET /api/schemas/:id` - Get schema by ID
- `POST /api/schemas` - Create new schema
- `PUT /api/schemas/:id` - Update schema
- `DELETE /api/schemas/:id` - Delete schema

### Filesystem Endpoints

- `GET /api/fs` - List files in root directory
- `GET /api/fs/**` - Get file content or list directory
- `PUT /api/fs/**` - Create directory or write file

### AI Endpoints

- `POST /api/ai/generate` - Generate AI responses via OpenRouter (requires API key)

## Usage

### Start the server

```bash
cd packages/server-main
pnpm dev
```

### Start with custom directories

```bash
node src/main.ts --data-dir ./my-data --fs-root ./public-files
```

### Bootstrap with initial data

```bash
node src/main.ts \
  --data-dir ./storage \
  --fs-root ./public \
  --bootstrap-data ../main/public/data/dataset1/data.json \
  --bootstrap-schemas ../main/public/data/dataset1/schemas.json
```

### CLI Options

- `--data-dir <path>` - Directory to store data files (default: `./data`)
- `--fs-root <path>` - Root directory for filesystem API (default: `../main/public`)
- `--bootstrap-data <path>` - JSON file to bootstrap initial data from
- `--bootstrap-schemas <path>` - JSON file to bootstrap initial schemas from
- `--openrouter-api-key <key>` - OpenRouter API key (can also use `OPENROUTER_API_KEY` env var)
- `--openrouter-model <model>` - Default model to use (default: `anthropic/claude-3.5-sonnet`)
- `--openrouter-site-url <url>` - Site URL for OpenRouter analytics
- `--openrouter-app-name <name>` - App name for OpenRouter analytics
- `--help` - Show help message

## AI Configuration

The server includes AI-powered diagram generation capabilities via OpenRouter. To enable AI features:

### Set up OpenRouter API Key

**Option 1: Environment Variable (Recommended)**

```bash
export OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
pnpm dev
```

**Option 2: CLI Argument**

```bash
node src/main.ts --openrouter-api-key sk-or-v1-your-api-key-here
```

### Configure Model (Optional)

By default, the server uses `anthropic/claude-3.5-sonnet`. To use a different model:

```bash
export OPENROUTER_DEFAULT_MODEL=openai/gpt-4-turbo
pnpm dev
```

Or:

```bash
node src/main.ts --openrouter-model openai/gpt-4-turbo
```

### OpenRouter Analytics (Optional)

For usage tracking on the OpenRouter dashboard:

```bash
export OPENROUTER_SITE_URL=https://your-site.com
export OPENROUTER_APP_NAME=DiagramCraft
pnpm dev
```

### Example: Full AI Configuration

```bash
export OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
export OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-sonnet
export OPENROUTER_SITE_URL=https://diagram-craft.app
export OPENROUTER_APP_NAME=DiagramCraft
pnpm dev
```

### Using the AI API

**Generate AI Response:**

```bash
curl -X POST http://localhost:3000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "system",
        "content": "You are a helpful assistant that generates diagram specifications."
      },
      {
        "role": "user",
        "content": "Create a simple flowchart with 3 steps"
      }
    ],
    "stream": true
  }'
```

### Response Format

The `/api/ai/generate` endpoint supports both streaming (default) and non-streaming responses:

**Streaming Response** (default):
- Returns `text/event-stream` with server-sent events
- Each chunk contains a portion of the AI response
- Suitable for real-time updates in UI

**Non-Streaming Response**:
- Set `"stream": false` in the request body
- Returns complete response as JSON
- Suitable for simple request/response patterns

## Data Format

### Data Items

```json
{
  "_uid": "unique-id",
  "_schemaId": "schema-id", 
  "field1": "value1",
  "field2": "value2"
}
```

### Schema Items

```json
{
  "id": "schema-id",
  "name": "Schema Name",
  "source": "external",
  "fields": [
    {
      "id": "field1",
      "name": "Field 1",
      "type": "text"
    }
  ]
}
```

## Storage

Data is persisted to the filesystem in JSON format:

- `data.json` - Contains all data items
- `schemas.json` - Contains all schema definitions

Files are automatically created in the specified data directory and updated on any changes.

## Error Handling

The API returns appropriate HTTP status codes:

- `200` - Success
- `400` - Bad Request (invalid data)
- `404` - Not Found  
- `409` - Conflict (duplicate ID)
- `500` - Internal Server Error

Error responses include a JSON message:

```json
{
  "message": "Error description"
}
```

## Integration with RESTDataProvider

Configure the RESTDataProvider to point to this server:

```typescript
const provider = new RESTDataProvider(JSON.stringify({
  baseUrl: 'http://localhost:3000'
}));
```