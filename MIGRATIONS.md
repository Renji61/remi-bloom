# Database Migrations

Committed Drizzle migrations are the source of truth for REMI Bloom deployments.

Run migrations before starting the application:

```sh
npm run db:migrate
```

The Docker image does not generate migrations during build. Generate new migrations during development, commit them under `src/db/migrations`, then run `npm run db:migrate` against the target database before app start.

For Docker Compose and Dockhand deployments, run migrations as a deliberate deployment step using the production `DATABASE_URL` before starting or upgrading the app. This avoids hidden startup side effects and keeps failed migrations visible to the operator.
