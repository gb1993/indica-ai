-- One-time production reset requested before onboarding the definitive groups.
-- Authentication users, profiles and avatar objects are intentionally preserved.
truncate table public.groups cascade;
