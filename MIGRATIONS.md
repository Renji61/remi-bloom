# Database Migrations

Committed SQL migrations are the source of truth for REMI Bloom deployments.

For local development, generate and run migrations with:

```sh
npm run db:generate
npm run db:migrate
```

The Docker image does not generate migrations during build. Generate new migrations during development, commit them under `src/db/migrations`, then validate them locally.

For Docker Compose and Dockhand deployments, the app container runs bundled SQL migrations automatically before starting `server.js`. Applied filenames are tracked in `__remi_bloom_migrations`; an existing initialized database without tracking rows is baselined so already-created tables are not recreated.
