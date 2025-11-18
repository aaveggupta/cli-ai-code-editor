import { initDatabase, closeDatabase } from './index';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  try {
    console.log('Running database migrations...');
    initDatabase();
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

migrate();
