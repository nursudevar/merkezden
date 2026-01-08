-- Enable RLS on tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individual_profiles ENABLE ROW LEVEL SECURITY;

-- Policy for public.users: Allow SELECT where auth.uid() = auth_user_id
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

-- Policy for public.individual_profiles: Allow SELECT for matching user via join
CREATE POLICY "individual_profiles_select_own" ON public.individual_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = individual_profiles.user_id
        AND users.auth_user_id = auth.uid()
    )
  );

