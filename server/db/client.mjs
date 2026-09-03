import pg from 'pg';
export function createDatabase(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) return null;
  const url = new URL(connectionString);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname))
    url.searchParams.set('sslmode', 'verify-full');
  const pool = new pg.Pool({
    connectionString: url.toString(),
    max: 8,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
    statement_timeout: 15000,
  });
  pool.on('error', () => console.error('database_pool_unavailable'));
  return {
    query: (sql, values) => pool.query(sql, values),
    transaction: async (operation) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const value = await operation(client);
        await client.query('COMMIT');
        return value;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
