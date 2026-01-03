-- Allow reading visitor emails (for traffic page)
CREATE POLICY "Anyone can read visitor emails"
ON public.visitor_emails
FOR SELECT
USING (true);