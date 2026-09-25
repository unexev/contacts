-- Scope organizations per user. Previously `organizations` was one global
-- catalog shared by every user (see 001_init.sql): any user could see and
-- reuse organizations created by other users, a cross-tenant data leak.
--
-- Rule (also implemented and unit tested as pure logic in
-- backend/pkg/orgscope.Plan): for every organization referenced by more than
-- one user via contact_organizations, the user with the smallest user_id
-- (deterministic) keeps the original organization row; every other user
-- referencing it gets their own copy (same name, new id), and their
-- contact_organizations links are remapped to that copy. Organizations
-- referenced by nobody are dropped.
--
-- Idempotent: safe to run more than once. Each step only touches rows a
-- previous run would have left in a "not yet migrated" state.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Drop the old global UNIQUE(name) constraint up front: step 2 below
-- deliberately creates several organizations with the same name (the
-- original plus one copy per non-keeper user), which the old constraint
-- would reject.
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_name_key;

-- 1) Backfill the keeper: the smallest user_id among the users referencing
--    each still-unassigned organization.
UPDATE organizations o
SET user_id = keeper.user_id
FROM (
    SELECT organization_id, MIN(user_id) AS user_id
    FROM contact_organizations
    GROUP BY organization_id
) keeper
WHERE o.organization_id = keeper.organization_id
  AND o.user_id IS NULL;

-- 2) For every (user, organization) pair that is not the keeper, create a
--    per-user copy of the organization and remap that user's links to it.
--    Using a temp table (dropped at the end) instead of a single UPDATE with
--    a join because the same organization_id may need several distinct new
--    ids, one per non-keeper user.
CREATE TEMP TABLE IF NOT EXISTS org_copy_plan (
    old_organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    new_organization_id TEXT NOT NULL,
    PRIMARY KEY (old_organization_id, user_id)
) ON COMMIT DROP;

INSERT INTO org_copy_plan (old_organization_id, user_id, new_organization_id)
SELECT DISTINCT co.organization_id, co.user_id,
       'org_' || substr(md5(random()::text || clock_timestamp()::text || co.user_id || co.organization_id), 1, 16)
FROM contact_organizations co
JOIN organizations o ON o.organization_id = co.organization_id
WHERE co.user_id <> o.user_id;

INSERT INTO organizations (organization_id, user_id, name)
SELECT p.new_organization_id, p.user_id, o.name
FROM org_copy_plan p
JOIN organizations o ON o.organization_id = p.old_organization_id
ON CONFLICT (organization_id) DO NOTHING;

UPDATE contact_organizations co
SET organization_id = p.new_organization_id
FROM org_copy_plan p
WHERE co.organization_id = p.old_organization_id
  AND co.user_id = p.user_id;

-- 3) Drop organizations nobody ended up referencing (never linked to any
--    contact, so they never got a user_id assigned above).
DELETE FROM organizations WHERE user_id IS NULL;

ALTER TABLE organizations ALTER COLUMN user_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_user_id_name_key ON organizations (user_id, name);
CREATE INDEX IF NOT EXISTS idx_organizations_user ON organizations (user_id);
