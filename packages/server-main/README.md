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

## Usage

### Start the server

```bash
cd packages/server-main
pnpm dev
```

### Start with custom data directory

```bash
node src/main.ts --data-dir ./my-data
```

### Bootstrap with initial data

```bash
node src/main.ts \
  --data-dir ./storage \
  --bootstrap-data ../main/public/data/dataset1/data.json \
  --bootstrap-schemas ../main/public/data/dataset1/schemas.json
```

### CLI Options

- `--data-dir <path>` - Directory to store data files (default: `./data`)
- `--bootstrap-data <path>` - JSON file to bootstrap initial data from
- `--bootstrap-schemas <path>` - JSON file to bootstrap initial schemas from
- `--help` - Show help message

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