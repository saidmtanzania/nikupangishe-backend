import dataSource from './data-source';

async function startProduction() {
  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }

  await import('../main.js');
}

void startProduction().catch((error: unknown) => {
  console.error('Production startup failed', error);
  process.exitCode = 1;
});
