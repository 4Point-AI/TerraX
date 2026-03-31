-- STEP 3: Backfill Profiles for Existing Users
INSERT INTO public.profiles (id, name)
SELECT id, COALESCE(raw_user_meta_data->>'name', email)
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);