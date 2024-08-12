import {
  appendResponseHeader,
  createApp,
  createError,
  createRouter,
  defineEventHandler,
  H3Event,
  handleCors,
  readRawBody,
  serveStatic
} from 'h3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { readFile } from 'node:fs/promises';

const OK = { status: 'ok' };

export const app = createApp();
app.use(
  defineEventHandler(event => {
    const didHandleCors = handleCors(event, {
      origin: '*',
      preflight: {
        statusCode: 204
      },
      methods: '*'
    });
    if (didHandleCors) {
      return;
    }
  })
);

const router = createRouter();
app.use(router);

const ROOT = '../main/public';
const ROOT_RESOLVED = path.resolve(ROOT);

const badRequest = (message: string) => {
  throw createError({
    status: 400,
    statusMessage: 'Bad Request',
    data: { message }
  });
};

const getFullPath = (relPath: string) => {
  if (relPath !== '' && (!/^[a-z0-9\\./]+$/.test(relPath) || relPath.includes('..'))) {
    throw badRequest('Invalid path');
  }

  const normalizedPath = path.normalize(relPath);
  const fullPath = path.resolve(relPath === '' ? ROOT : path.join(ROOT, normalizedPath));

  if (!fullPath.startsWith(ROOT_RESOLVED)) {
    throw badRequest('Invalid path');
  }

  return fullPath;
};

const get = async (relPath: string, event: H3Event) => {
  const p = getFullPath(relPath);

  const stat = fs.statSync(p);
  if (stat.isFile()) {
    if (p.endsWith('.json')) {
      appendResponseHeader(event, 'Content-Type', 'application/json');
    } else {
      appendResponseHeader(event, 'Content-Type', 'application/octet-stream');
    }
    return serveStatic(event, {
      getContents: () => readFile(p),
      getMeta: () => {
        return {
          size: stat.size,
          mtime: stat.mtimeMs
        };
      }
    });
  }

  return {
    entries: fs
      .readdirSync(p)
      .filter(f => !f.startsWith('.'))
      .map(f => {
        const stats = fs.statSync(path.join(p, f));
        return {
          name: f,
          isDirectory: stats.isDirectory()
        };
      })
  };
};

const put = async (relPath: string, event: H3Event) => {
  const p = getFullPath(relPath);

  if (relPath !== '') {
    const parent = path.dirname(p);
    if (!fs.existsSync(parent)) {
      throw badRequest('Parent directory does not exist');
    }

    if (fs.statSync(parent).isFile()) {
      throw badRequest('Parent path is a file');
    }
  }

  const body = await readRawBody(event, false);

  if (body === undefined) {
    // Create directory
    if (fs.existsSync(p)) {
      throw badRequest('Directory already exists');
    }

    fs.mkdirSync(p);
    return OK;
  } else {
    // Write file
    if (fs.existsSync(p)) {
      if (fs.statSync(p).isDirectory()) {
        throw badRequest('Path is a directory');
      }

      if (fs.statSync(p).isFile()) {
        fs.writeFileSync(p, body);
      }
    } else {
      fs.writeFileSync(p, body);
    }

    return OK;
  }
};

/*
const move = async (relPath: string, _event: H3Event) => {
  const p = getFullPath(relPath);
  return { tbc: 'move', p };
};

const post = async (relPath: string, event: H3Event) => {
  const action = getQuery(event)['action'];

  switch (action) {
    case 'move':
      return move(relPath, event);
    default:
      throw badRequest('Invalid action');
  }
};
 */

// Add a new route that matches GET requests to / path
router.get(
  '/api/fs',
  defineEventHandler(event => get('', event))
);
router.get(
  '/api/fs/**',
  defineEventHandler(event => get(event.context.params!._, event))
);

router.put(
  '/api/fs/**',
  defineEventHandler(event => put(event.context.params!._, event))
);

/*
router.post(
  '/api/fs',
  defineEventHandler(event => post('', event))
);
router.post(
  '/api/fs/**',
  defineEventHandler(event => post(event.context.params!._, event))
);
 */
