  console.log('✅ All migrations complete — 17 tables created');
}

module.exports = migrate;

// Only auto-run-and-exit when invoked directly (`npm run migrate` / `node src/models/migrate.js`).
// When required as a module (see src/index.js, which runs this on every boot so schema
// changes take effect without needing Render shell access), the caller controls the lifecycle.
if (require.main === module) {
  migrate().then(() => process.exit(0)).catch(err => { console.error('Migration failed:', err); process.exit(1); });
}
