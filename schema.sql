-- 1. Enable UUID Extension (usually enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Custom Types for Enums
CREATE TYPE user_role AS ENUM ('student', 'adviser', 'hod', 'warden', 'security');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
CREATE TYPE user_status AS ENUM ('pending', 'approved');

-- 3. Create Tables

-- users: Extends Supabase Auth (auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL,
    status user_status DEFAULT 'pending',
    department_id UUID -- Only relevant for HOD, Adviser, Student
);

-- departments
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    hod_id UUID REFERENCES public.users(id) ON DELETE SET NULL -- Assigned later
);

-- hostels
CREATE TABLE public.hostels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL
);

-- advisers
CREATE TABLE public.advisers (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL
);

-- students
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    register_number TEXT UNIQUE NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    adviser_id UUID REFERENCES public.advisers(id) ON DELETE SET NULL,
    hostel_id UUID REFERENCES public.hostels(id) ON DELETE SET NULL,
    room_number TEXT NOT NULL,
    phone TEXT NOT NULL
);

-- outpass_requests
CREATE TABLE public.outpass_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL,
    out_time TIMESTAMP WITH TIME ZONE NOT NULL,
    in_time TIMESTAMP WITH TIME ZONE NOT NULL,
    
    adviser_status request_status DEFAULT 'pending',
    hod_status request_status DEFAULT 'pending',
    warden_status request_status DEFAULT 'pending',
    final_status request_status DEFAULT 'pending',
    
    is_outside BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Set Up Row Level Security (RLS)
-- To keep things simple for this MVP, we will enable RLS but allow all authenticated users to read/write for now.
-- In a production environment, you MUST restrict these policies based on user_role.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outpass_requests ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read and write (For Development Purpose Only)
CREATE POLICY "Enable read access for all authenticated users" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write access for all authenticated users" ON public.users FOR ALL TO authenticated USING (true);

CREATE POLICY "Enable read access for all authenticated users" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable read access for all authenticated users" ON public.hostels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable read access for all authenticated users" ON public.advisers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write access for all authenticated users" ON public.advisers FOR ALL TO authenticated USING (true);

CREATE POLICY "Enable read access for all authenticated users" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write access for all authenticated users" ON public.students FOR ALL TO authenticated USING (true);

CREATE POLICY "Enable read access for all authenticated users" ON public.outpass_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write access for all authenticated users" ON public.outpass_requests FOR ALL TO authenticated USING (true);

-- 5. Seed Data (Optional, but highly recommended for testing)
INSERT INTO public.hostels (name) VALUES 
    ('Men''s Hostel Block A'), 
    ('Men''s Hostel Block B'),
    ('Women''s Hostel Block A');

INSERT INTO public.departments (name) VALUES 
    ('Computer Science Engineering'), 
    ('Information Technology'),
    ('Electronics and Communication');

-- Note: You'll need to create user accounts via Supabase Auth first, 
-- then link them here as HODs and Advisers.

-- =====================================================
-- MIGRATION: Outpass Feature Extensions
-- Run the following in Supabase SQL Editor if updating an existing DB
-- =====================================================

-- 0. Ensure 'completed' exists in request_status enum (may be missing on older DBs)
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'completed';

-- 1. Add warden_id to students
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS warden_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 1b. Add name to users table for display purposes (wardens, advisers, etc.)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS name TEXT;

-- 2. Add adviser_id, warden_id, returned_to_campus to outpass_requests
ALTER TABLE public.outpass_requests
  ADD COLUMN IF NOT EXISTS adviser_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS warden_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS returned_to_campus BOOLEAN DEFAULT false;

-- 3. Create alerts table for late-return notifications
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID,  -- not a FK since request may be deleted
    student_name TEXT,
    message TEXT,
    adviser_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    warden_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_read BOOLEAN DEFAULT false
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Enable all for authenticated" ON public.alerts FOR ALL TO authenticated USING (true);

-- 4. Enable pg_cron extension (may need superuser — enable via Dashboard > Extensions)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 5. Postgres function to check late returns and trigger alerts
CREATE OR REPLACE FUNCTION check_late_returns()
RETURNS void AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT 
            o.id, o.adviser_id, o.warden_id,
            s.name as student_name, o.in_time
        FROM outpass_requests o
        JOIN students s ON s.id = o.student_id
        WHERE o.in_time < NOW()
          AND o.returned_to_campus = false
          AND o.final_status = 'approved'
    LOOP
        -- Insert an alert for the adviser and warden
        INSERT INTO public.alerts (request_id, student_name, message, adviser_id, warden_id)
        VALUES (
            r.id,
            r.student_name,
            'LATE RETURN: ' || r.student_name || ' has NOT returned. Expected at ' || to_char(r.in_time AT TIME ZONE 'UTC', 'DD Mon YYYY HH24:MI'),
            r.adviser_id,
            r.warden_id
        );

        -- Delete the outpass request
        DELETE FROM public.outpass_requests WHERE id = r.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Schedule cron job (run after enabling pg_cron)
-- SELECT cron.schedule('check-late-returns', '*/5 * * * *', 'SELECT check_late_returns()');

-- =====================================================
-- 7. Auto-link HOD to Department on Approval
-- When a user with role='hod' is approved, automatically
-- set departments.hod_id to that user's UUID for their department.
-- =====================================================

CREATE OR REPLACE FUNCTION link_hod_to_department()
RETURNS TRIGGER AS $$
BEGIN
    -- Fire when status changes TO 'approved' for an HOD
    IF NEW.role = 'hod' AND NEW.status = 'approved' AND 
       (OLD.status IS DISTINCT FROM 'approved') THEN
        
        -- Update the matching department's hod_id
        UPDATE public.departments
        SET hod_id = NEW.id
        WHERE id = NEW.department_id;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on public.users table
DROP TRIGGER IF EXISTS on_hod_approved ON public.users;
CREATE TRIGGER on_hod_approved
    AFTER UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION link_hod_to_department();
