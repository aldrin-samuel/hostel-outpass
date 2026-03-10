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
