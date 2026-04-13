import 'dotenv/config';
import postgres from 'postgres';

const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Module-level singleton — postgres.js manages the connection pool internally.
// For Supabase Transaction Mode (port 6543), add: { prepare: false }
const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10
});

export default sql;
