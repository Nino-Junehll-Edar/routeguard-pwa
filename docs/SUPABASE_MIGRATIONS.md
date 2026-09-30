# Supabase Migrations

This directory contains SQL migration files for the RouteGuard Supabase project.

## Migration Files

- [`001_init_schema.sql`](../supabase/migrations/001_init_schema.sql): Initial database schema setup including:
  - PostGIS extension
  - Custom types (hazard_status, user_role, agency_request_status)
  - Tables: user_profiles, hazards, agency_requests, agency_advisories, hazard_confirmations, hazard_comments, hazard_votes, notifications
  - Row Level Security (RLS) policies
  - Triggers and functions for updated_at columns
  - Supplementary functions for hazard management (check_hazard_verification, verify_hazard [initial version], expire_hazards, check_and_expire_hazards_on_update)

- [`002_add_reputation_to_verify_hazard.sql`](../supabase/migrations/002_add_reputation_to_verify_hazard.sql): Update to the verify_hazard function to award +5 reputation points to the hazard reporter when confirming a hazard as active.

- [`003_add_reputation_to_votes.sql`](../supabase/optional-migrations/003_add_reputation_to_votes.sql): Optional vote-based reputation alternative (not included in the default migration push):
  - -2 points per downvote by others on a hazard report
  - Additional -10 penalty when a hazard receives 3 or more downvotes (total -12 on the 3rd+ downvote)

- [`004_update_verify_hazard_reputation.sql`](../supabase/migrations/004_update_verify_hazard_reputation.sql): Update to the verify_hazard function to include complete reputation effects for verifications:
  - +5 points for confirming a hazard as active (hazard_active)
  - -2 points for confirming a hazard as cleared (hazard_cleared)
  - Additional -10 penalty when 3+ users have confirmed the same hazard as cleared (total -12 on the 3rd+ hazard_cleared confirmation)

- [`005_add_spatial_indexes.sql`](../supabase/migrations/005_add_spatial_indexes.sql): Add spatial indexes; enables `btree_gist` for mixed-column GiST indexes.
- [`006_secure_notifications_and_spatial_api.sql`](../supabase/migrations/006_secure_notifications_and_spatial_api.sql): Apply owner-scoped notification policies, authenticated verification, profile privilege protection, and PostGIS RPCs for spatial search/counts.

## Application Order

Apply migrations in numerical order:

1. [`001_init_schema.sql`](../supabase/migrations/001_init_schema.sql)
2. [`002_add_reputation_to_verify_hazard.sql`](../supabase/migrations/002_add_reputation_to_verify_hazard.sql)
3. [`004_update_verify_hazard_reputation.sql`](../supabase/migrations/004_update_verify_hazard_reputation.sql) for the default verification-based reputation.
4. [`005_add_spatial_indexes.sql`](../supabase/migrations/005_add_spatial_indexes.sql)
5. [`006_secure_notifications_and_spatial_api.sql`](../supabase/migrations/006_secure_notifications_and_spatial_api.sql)

The vote-based reputation alternative in `supabase/optional-migrations` must not be applied with migration 004. To use it instead, choose it explicitly in place of 004 before pushing migrations.

Apply `006` after the selected reputation migration. When using [`schema.sql`](../supabase/schema.sql) as a bootstrap instead of migration `001`, apply `006` afterward to create the RPCs and additional security policies.

## Reputation System Implementation Notes

The reputation system implements the following items from the checklist:

1. **[+5 points for approved hazard reports]**
   - Implemented in migrations 002 and 004: +5 reputation when verifying a hazard as `hazard_active`
   - Interpretation: When a hazard is verified/confirmed as active, it's considered "approved"

2. **[-2 points per "Hazard Cleared" vote by others]**
   - Implemented in migration 003: -2 reputation per downvote on a hazard report
   - Alternative interpretation: When users vote down on a hazard report (indicating they believe it's incorrect/spam/etc.)

3. **[-10 points if 3+ users mark as "Hazard Cleared"]**
   - Implemented in migration 004: Additional -10 reputation when 3+ users verify a hazard as `hazard_cleared` (total -12 on 3rd+)
   - Alternative interpretation: In migration 003, additional -10 when 3+ downvotes are received on a hazard report

4. **[No minimum/maximum limits]**
   - Note: Reputation can go negative or positive without bounds

## Important Notes

- Only ONE of the vote-based (003) OR verification-based (004) reputation implementations should be applied, not both, as they represent different interpretations of the checklist items.
- Migration 002 (base +5 for active hazard verification) is required for both interpretation paths.
- To implement vote-based reputation effects: apply 001 → 002 → 003
- To implement verification-based reputation effects: apply 001 → 002 → 004
- The verification-based approach (004) is likely the intended interpretation as it directly references the verification confirmation actions in the system.

## Apply Through Supabase Dashboard

For a new, empty Supabase project, open **SQL Editor** and run each file as a separate query, in this order:

1. `supabase/migrations/001_init_schema.sql`
2. `supabase/migrations/002_add_reputation_to_verify_hazard.sql`
3. `supabase/migrations/004_update_verify_hazard_reputation.sql`
4. `supabase/migrations/005_add_spatial_indexes.sql`
5. `supabase/migrations/006_secure_notifications_and_spatial_api.sql`

Do not run the optional vote-based migration with migration 004. Finish the full sequence before allowing users to access the project; the later security migration tightens policies created by the initial bootstrap.

Migration 001 is a bootstrap for an empty project, not a repair script. It creates enum types, tables, policies, and triggers without making every statement conditional. If objects already exist, stop and inspect the schema rather than adding `IF NOT EXISTS` everywhere: that can silently leave existing tables without required columns, constraints, or policies.

The connected RouteGuard project is partially initialized: `hazard_status` already exists, and the existing `hazards` and `user_profiles` columns match the definitions in `schema.sql`; other expected tables were missing in earlier API checks. Do not run migration 001 against that project as-is. First inspect the existing enum labels and constraints with the read-only queries below. The known `hazards_lifetime_minutes_positive` constraint is intentionally dropped by `schema.sql`, because cleared hazards use a zero lifetime. If any other unexpected constraint appears, stop and reconcile it before applying changes. If the enum labels match the expected definitions, use `schema.sql` as the idempotent bootstrap for missing tables and policies, then run migrations 005 and 006. Do not run 002 or 004 in this path because 006 installs the final two-argument `verify_hazard` function with the selected verification-based reputation behavior.

```sql
SELECT n.nspname AS type_schema, t.typname AS enum_type,
   e.enumlabel, e.enumsortorder
FROM pg_type AS t
JOIN pg_namespace AS n ON n.oid = t.typnamespace
JOIN pg_enum AS e ON e.enumtypid = t.oid
WHERE n.nspname = 'public'
   AND t.typname IN ('hazard_status', 'user_role', 'agency_request_status')
ORDER BY t.typname, e.enumsortorder;
```

```sql
SELECT tbl.relname AS table_name, con.conname AS constraint_name,
   pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint AS con
JOIN pg_class AS tbl ON tbl.oid = con.conrelid
JOIN pg_namespace AS ns ON ns.oid = tbl.relnamespace
WHERE ns.nspname = 'public'
   AND tbl.relname IN ('hazards', 'user_profiles')
ORDER BY tbl.relname, con.conname;
```

Running SQL in the Dashboard does not record these files in the CLI migration history; keep an explicit record of what you apply so a later `supabase db push` does not replay the bootstrap.

For a project whose schema is already managed by the Supabase CLI, use `supabase db push` instead of manually replaying files. Never use `db reset` against a project containing data you need to keep.
