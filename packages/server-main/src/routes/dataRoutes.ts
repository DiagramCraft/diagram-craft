import {
  defineHandler,
  EventHandlerRequest,
  H3,
  H3Event,
  HTTPError
} from 'h3';
import type { ModelServer } from '../modelServer';
import type { DataSchema, DataWithSchema } from '../types';

// Constants
const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB limit for data requests
const CONTENT_TYPE_JSON = 'application/json';
const API_DATA_PATH = '/api/data';
const API_SCHEMAS_PATH = '/api/schemas';

export function createDataRoutes(modelServer: ModelServer) {
  const router = new H3();

  // Helper function to validate content type and size
  const validateRequest = (event: H3Event<EventHandlerRequest>) => {
    const contentTypeStr = event.req.headers.get('content-type');
    if (contentTypeStr && !contentTypeStr.startsWith(CONTENT_TYPE_JSON)) {
      throw new HTTPError({
        status: 415,
        statusText: 'Unsupported Media Type',
        message: `Content-Type must be ${CONTENT_TYPE_JSON}`
      });
    }

    const contentLengthStr = event.req.headers.get('content-length');
    const contentLength = parseInt(contentLengthStr ?? '0', 10);
    if (contentLength > MAX_REQUEST_SIZE) {
      throw new HTTPError({
        status: 413,
        statusText: 'Payload Too Large',
        message: `Request size exceeds limit of ${MAX_REQUEST_SIZE} bytes`
      });
    }
  };

  const isDataWithSchema = (body: unknown): body is DataWithSchema => {
    return (
      !!body &&
      typeof body === 'object' &&
      '_schemaId' in body &&
      typeof body._schemaId === 'string'
    );
  };

  const isDataSchema = (body: unknown): body is DataSchema => {
    return (
      !!body &&
      typeof body === 'object' &&
      'id' in body &&
      typeof body.id === 'string' &&
      'name' in body &&
      typeof body.name === 'string'
    );
  };

  // Helper function to handle errors consistently
  const handleError = (error: unknown, fallbackMessage: string) => {
    if (HTTPError.isError(error)) {
      throw error;
    }
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string' &&
      error.message.includes('already exists')
    ) {
      throw new HTTPError({
        status: 409,
        statusText: 'Conflict',
        message: error.message
      });
    }
    throw new HTTPError({
      status: 500,
      statusText: 'Internal Server Error',
      message: fallbackMessage
    });
  };

  // GET /api/data - Get all data
  router.get(
    API_DATA_PATH,
    defineHandler(async () => {
      try {
        return modelServer.getAllData();
      } catch (_error) {
        throw new HTTPError({
          status: 500,
          statusText: 'Internal Server Error',
          message: 'Failed to retrieve data'
        });
      }
    })
  );

  // GET /api/data/:id - Get data by ID
  router.get(
    `${API_DATA_PATH}/:id`,
    defineHandler(async event => {
      const id = event.context.params?.id;
      if (!id) {
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'ID parameter is required'
        });
      }

      try {
        const data = modelServer.getDataById(id);
        if (!data) {
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Data with ID '${id}' not found`
          });
        }
        return data;
      } catch (error: unknown) {
        handleError(error, 'Failed to retrieve data');
      }
    })
  );

  // POST /api/data - Create new data
  router.post(
    API_DATA_PATH,
    defineHandler(async event => {
      validateRequest(event);
      try {
        const body = await event.req.json().catch(() => undefined);

        if (!isDataWithSchema(body)) {
          throw new HTTPError({
            status: 400,
            statusText: 'Bad Request',
            message: 'Request body must be a valid JSON object with _schemaId'
          });
        }

        return modelServer.addData(body);
      } catch (error: unknown) {
        handleError(error, 'Failed to create data');
      }
    })
  );

  // PUT /api/data/:id - Update data
  router.put(
    `${API_DATA_PATH}/:id`,
    defineHandler(async event => {
      validateRequest(event);
      const id = event.context.params?.id;
      if (!id) {
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'ID parameter is required'
        });
      }

      try {
        const body = await event.req.json().catch(() => undefined);

        if (!isDataWithSchema(body)) {
          throw new HTTPError({
            status: 400,
            statusText: 'Bad Request',
            message: 'Request body must be a valid JSON object with _schemaId'
          });
        }

        const updatedData = modelServer.updateData(id, body);
        if (!updatedData) {
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Data with ID '${id}' not found`
          });
        }

        return updatedData;
      } catch (error: unknown) {
        handleError(error, 'Failed to update data');
      }
    })
  );

  // DELETE /api/data/:id - Delete data
  router.delete(
    `${API_DATA_PATH}/:id`,
    defineHandler(async event => {
      const id = event.context.params?.id;
      if (!id) {
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'ID parameter is required'
        });
      }

      try {
        const deleted = modelServer.deleteData(id);
        if (!deleted) {
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Data with ID '${id}' not found`
          });
        }

        return { success: true, message: `Data with ID '${id}' deleted successfully` };
      } catch (error: unknown) {
        handleError(error, 'Failed to delete data');
      }
    })
  );

  // GET /api/schemas - Get all schemas
  router.get(
    API_SCHEMAS_PATH,
    defineHandler(async () => {
      try {
        return modelServer.getAllSchemas();
      } catch (error: unknown) {
        handleError(error, 'Failed to retrieve schemas');
      }
    })
  );

  // GET /api/schemas/:id - Get schema by ID
  router.get(
    `${API_SCHEMAS_PATH}/:id`,
    defineHandler(async event => {
      const id = event.context.params?.id;
      if (!id) {
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'ID parameter is required'
        });
      }

      try {
        const schema = modelServer.getSchemaById(id);
        if (!schema) {
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Schema with ID '${id}' not found`
          });
        }
        return schema;
      } catch (error: unknown) {
        handleError(error, 'Failed to retrieve schema');
      }
    })
  );

  // POST /api/schemas - Create new schema
  router.post(
    API_SCHEMAS_PATH,
    defineHandler(async event => {
      try {
        const body = await event.req.json().catch(() => undefined);

        if (!isDataSchema(body)) {
          throw new HTTPError({
            status: 400,
            statusText: 'Bad Request',
            message: 'Schema must have id and name fields'
          });
        }

        const createdSchema = modelServer.addSchema(body);
        return createdSchema;
      } catch (error: unknown) {
        handleError(error, 'Failed to create schema');
      }
    })
  );

  // PUT /api/schemas/:id - Update schema
  router.put(
    `${API_SCHEMAS_PATH}/:id`,
    defineHandler(async event => {
      const id = event.context.params?.id;
      if (!id) {
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'ID parameter is required'
        });
      }

      try {
        const body = await event.req.json().catch(() => undefined);

        if (!isDataSchema(body)) {
          throw new HTTPError({
            status: 400,
            statusText: 'Bad Request',
            message: 'Schema must have id and name fields'
          });
        }

        const updatedSchema = modelServer.updateSchema(id, body);
        if (!updatedSchema) {
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Schema with ID '${id}' not found`
          });
        }

        return updatedSchema;
      } catch (error: unknown) {
        handleError(error, 'Failed to update schema');
      }
    })
  );

  // DELETE /api/schemas/:id - Delete schema
  router.delete(
    `${API_SCHEMAS_PATH}/:id`,
    defineHandler(async event => {
      const id = event.context.params?.id;
      if (!id) {
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'ID parameter is required'
        });
      }

      try {
        const deleted = modelServer.deleteSchema(id);
        if (!deleted) {
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Schema with ID '${id}' not found`
          });
        }

        return { success: true, message: `Schema with ID '${id}' deleted successfully` };
      } catch (error: unknown) {
        handleError(error, 'Failed to delete schema');
      }
    })
  );

  return router;
}
