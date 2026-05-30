const { Client } = require('pg');

const client = new Client({
  host: 'db.ojuuzojwnyxdsavdosif.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Zi1rA2kOmFOQnj3s',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'apontamentos'
      ORDER BY ordinal_position
    `);
    console.log('Colunas de apontamentos:');
    res.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
    await client.end();
  } catch (e) {
    console.error('Erro:', e.message);
    process.exit(1);
  }
})();
