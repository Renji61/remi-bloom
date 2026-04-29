#!/bin/sh
# Run migrations then start the Next.js server
# Used in the Docker CMD when you want to run migrations first

echo "Running database migrations..."
npx tsx scripts/migrate.ts || echo "Migration failed, continuing..."

echo "Starting Next.js..."
node server.js
