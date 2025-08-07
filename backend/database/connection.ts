import { Pool, PoolClient } from "pg";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { dbPool } from "../config/database";
import { logger } from "../utils/logger";

export async function connectDatabase(): Promise<void> {
  try {
    const client = await dbPool.connect();
    await client.query("SELECT NOW()");
    client.release();
    logger.info("Database connected successfully");
  } catch (error) {
    logger.error("Database connection failed:", error);
    throw error;
  }
}

export async function runMigrations(): Promise<void> {
  const client = await dbPool.connect();

  try {
    // CREATE MIGRATIONS TABLE IF IT DOESNT EXIST
    await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

    // GET LIST OF MIGRATION FILES
    const migrationsDir = join(__dirname, "migrations");
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    // GET EXECUTED MIGRATIONS
    const { rows: executedMigrations } = await client.query(
      "SELECT filename FROM migrations ORDER BY id"
    );
    const executedFilenames = executedMigrations.map((row) => row.filename);

    // RUN PENDING MIGRATIONS
    for (const filename of migrationFiles) {
      if (!executedFilenames.includes(filename)) {
        logger.info(`Running migration: ${filename}`);

        const migrationSQL = readFileSync(
          join(migrationsDir, filename),
          "utf8"
        );

        await client.query("BEGIN");
        try {
          await client.query(migrationSQL);
          await client.query("INSERT INTO migrations (filename) VALUES ($1)", [
            filename,
          ]);
          await client.query("COMMIT");
          logger.info(`Migration ${filename} completed successfully`);
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
    }
  } finally {
    client.release();
  }
}

export { dbPool };
