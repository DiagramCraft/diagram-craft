import {
  createError,
  createRouter,
  defineEventHandler,
  EventHandlerRequest,
  H3Event,
  readBody
} from 'h3';
import { FileSystemDataStore } from './dataStore';

// Constants
const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB limit for data requests
const CONTENT_TYPE_JSON = 'application/json';
const API_DATA_PATH = '/api/data';
const API_SCHEMAS_PATH = '/api/schemas';

export function createDataRoutes(dataStore: FileSystemDataStore) {
  const router = createRouter();

  // Helper function to validate content type and size
  const validateRequest = (event: H3Event<EventHandlerRequest>) => {
    const contentType = event.node.req.headers['content-type'];
    const contentTypeStr = Array.isArray(contentType) ? contentType[0] : contentType;
    if (contentTypeStr && !contentTypeStr.startsWith(CONTENT_TYPE_JSON)) {
      throw createError({
        status: 415,
        statusMessage: 'Unsupported Media Type',
        data: { message: `Content-Type must be ${CONTENT_TYPE_JSON}` }
      });
    }

    const contentLengthHeader = event.node.req.headers['content-length'];
    const contentLengthStr = Array.isArray(contentLengthHeader)
      ? contentLengthHeader[0]
      : contentLengthHeader;
    const contentLength = parseInt(contentLengthStr ?? '0');
    if (contentLength > MAX_REQUEST_SIZE) {
      throw createError({
        status: 413,
        statusMessage: 'Payload Too Large',
        data: { message: `Request size exceeds limit of ${MAX_REQUEST_SIZE} bytes` }
      });
    }
  };

  // Helper function to handle errors consistently
  const handleError = (error: unknown, fallbackMessage: string) => {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string' &&
      error.message.includes('already exists')
    ) {
      throw createError({
        status: 409,
        statusMessage: 'Conflict',
        data: { message: error.message }
      });
    }
    throw createError({
      status: 500,
      statusMessage: 'Internal Server Error',
      data: { message: fallbackMessage }
    });
  };

  // GET /api/data - Get all data
  router.get(
    API_DATA_PATH,
    defineEventHandler(async _event => {
      try {
        return dataStore.getAllData();
      } catch (error) {
        throw createError({
          status: 500,
          statusMessage: 'Internal Server Error',
          data: { message: 'Failed to retrieve data' }
        });
      }
    })
  );

  // GET /api/data/:id - Get data by ID
  router.get(
    `${API_DATA_PATH}/:id`,
    defineEventHandler(async event => {
      const id = event.context.params?.id;
      if (!id) {
        throw createError({
          status: 400,
          statusMessage: 'Bad Request',
          data: { message: 'ID parameter is required' }
        });
      }

      try {
        const data = dataStore.getDataById(id);
        if (!data) {
          throw createError({
            status: 404,
            statusMessage: 'Not Found',
            data: { message: `Data with ID '${id}' not found` }
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
    defineEventHandler(async event => {
      validateRequest(event);
      try {
        const body = await readBody(event);

        if (!body || typeof body !== 'object') {
          throw createError({
            status: 400,
            statusMessage: 'Bad Request',
            data: { message: 'Request body must be a valid JSON object' }
          });
        }

        if (!body._schemaId) {
          throw createError({
            status: 400,
            statusMessage: 'Bad Request',
            data: { message: '_schemaId is required' }
          });
        }

        return dataStore.addData(body);
      } catch (error: unknown) {
        handleError(error, 'Failed to create data');
      }
    })
  );

  // PUT /api/data/:id - Update data
  router.put(
    `${API_DATA_PATH}/:id`,
    defineEventHandler(async event => {
      validateRequest(event);
      const id = event.context.params?.id;
      if (!id) {
        throw createError({
          status: 400,
          statusMessage: 'Bad Request',
          data: { message: 'ID parameter is required' }
        });
      }

      try {
        const body = await readBody(event);

        if (!body || typeof body !== 'object') {
          throw createError({
            status: 400,
            statusMessage: 'Bad Request',
            data: { message: 'Request body must be a valid JSON object' }
          });
        }

        if (!body._schemaId) {
          throw createError({
            status: 400,
            statusMessage: 'Bad Request',
            data: { message: '_schemaId is required' }
          });
        }

        const updatedData = dataStore.updateData(id, body);
        if (!updatedData) {
          throw createError({
            status: 404,
            statusMessage: 'Not Found',
            data: { message: `Data with ID '${id}' not found` }
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
    defineEventHandler(async event => {
      const id = event.context.params?.id;
      if (!id) {
        throw createError({
          status: 400,
          statusMessage: 'Bad Request',
          data: { message: 'ID parameter is required' }
        });
      }

      try {
        const deleted = dataStore.deleteData(id);
        if (!deleted) {
          throw createError({
            status: 404,
            statusMessage: 'Not Found',
            data: { message: `Data with ID '${id}' not found` }
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
    defineEventHandler(async _event => {
      try {
        return dataStore.getAllSchemas();
      } catch (error: unknown) {
        handleError(error, 'Failed to retrieve schemas');
      }
    })
  );

  // GET /api/schemas/:id - Get schema by ID
  router.get(
    `${API_SCHEMAS_PATH}/:id`,
    defineEventHandler(async event => {
      const id = event.context.params?.id;
      if (!id) {
        throw createError({
          status: 400,
          statusMessage: 'Bad Request',
          data: { message: 'ID parameter is required' }
        });
      }

      try {
        const schema = dataStore.getSchemaById(id);
        if (!schema) {
          throw createError({
            status: 404,
            statusMessage: 'Not Found',
            data: { message: `Schema with ID '${id}' not found` }
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
    defineEventHandler(async event => {
      try {
        const body = await readBody(event);

        if (!body || typeof body !== 'object') {
          throw createError({
            status: 400,
            statusMessage: 'Bad Request',
            data: { message: 'Request body must be a valid JSON object' }
          });
        }

        if (!body.id || !body.name) {
          throw createError({
            status: 400,
            statusMessage: 'Bad Request',
            data: { message: 'Schema must have id and name fields' }
          });
        }

        const createdSchema = dataStore.addSchema(body);
        return createdSchema;
      } catch (error: unknown) {
        handleError(error, 'Failed to create schema');
      }
    })
  );

  // PUT /api/schemas/:id - Update schema
  router.put(
    `${API_SCHEMAS_PATH}/:id`,
    defineEventHandler(async event => {
      const id = event.context.params?.id;
      if (!id) {
        throw createError({
          status: 400,
          statusMessage: 'Bad Request',
          data: { message: 'ID parameter is required' }
        });
      }

      try {
        const body = await readBody(event);

        if (!body || typeof body !== 'object') {
          throw createError({
            status: 400,
            statusMessage: 'Bad Request',
            data: { message: 'Request body must be a valid JSON object' }
          });
        }

        if (!body.name) {
          throw createError({
            status: 400,
            statusMessage: 'Bad Request',
            data: { message: 'Schema must have a name field' }
          });
        }

        const updatedSchema = dataStore.updateSchema(id, body);
        if (!updatedSchema) {
          throw createError({
            status: 404,
            statusMessage: 'Not Found',
            data: { message: `Schema with ID '${id}' not found` }
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
    defineEventHandler(async event => {
      const id = event.context.params?.id;
      if (!id) {
        throw createError({
          status: 400,
          statusMessage: 'Bad Request',
          data: { message: 'ID parameter is required' }
        });
      }

      try {
        const deleted = dataStore.deleteSchema(id);
        if (!deleted) {
          throw createError({
            status: 404,
            statusMessage: 'Not Found',
            data: { message: `Schema with ID '${id}' not found` }
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
