-- KerjaKita: perbaiki nilai job_type agar cocok dengan formulir dashboard.
-- Jalankan sekali di Supabase Dashboard > SQL Editor pada project KerjaKita.
-- Constraint lama dibuang lalu diganti dengan daftar nilai yang menerima format lama
-- dan format standar yang dikirim oleh dashboard.js.

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_job_type_check;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_job_type_check
  CHECK (
    lower(trim(job_type)) IN (
      'full-time', 'full time', 'full_time',
      'part-time', 'part time', 'part_time',
      'contract', 'kontrak',
      'internship', 'magang',
      'freelance'
    )
  );

-- Verifikasi constraint aktif:
SELECT conname, pg_get_constraintdef(oid) AS aturan
FROM pg_constraint
WHERE conname = 'jobs_job_type_check';
