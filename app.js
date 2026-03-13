// --- Supabase Configuration ---
console.log("App.js: Loading configuration...");
const SUPABASE_URL = 'https://xlorfxaknfntevtcmovd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsb3JmeGFrbmZudGV2dGNtb3ZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxOTUxMTMsImV4cCI6MjA4NTc3MTExM30.Hu6n9i8viKsOooAJBYTX6Ytu8upg4J0hTzfFk2lcUaM';

let db;
try {
    const { createClient } = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
    db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("App.js: Supabase client initialized.");
} catch (err) {
    console.error("App.js: Initialization error:", err.message);
}

// --- Global Auth Initialization ---
async function initAuth() {
    console.log("App.js: initAuth running...");
    try {
        const { data: { session } } = await db.auth.getSession();

        if (session) {
            console.log("App.js: User logged in:", session.user.email);

            // 1. Remove token from URL if present
            if (window.location.hash.includes('access_token')) {
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            // 2. Redirect after login based on role
            await checkAuthStateAndRedirect();
        } else {
            console.log("App.js: No session found on load.");
            // Force redirect if unauthenticated on protected pages
            const isProtectedPage = !window.location.pathname.includes('index.html') && 
                                    window.location.pathname !== '/' && 
                                    window.location.pathname !== '/index.html';
            
            if (isProtectedPage) {
                window.location.href = 'index.html';
            }
        }

        // Listen for future auth state changes
        db.auth.onAuthStateChange((event, session) => {
            console.log("App.js: Auth event:", event);
            if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
                if (window.location.hash.includes('access_token')) {
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
                checkAuthStateAndRedirect();
            }
        });

    } catch (err) {
        console.error("App.js: Auth init error:", err);
    }
}

// Start auth check
initAuth();

// --- Auth Helpers ---

async function signInWithGoogle() {
    const { error } = await db.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });
    if (error) {
        console.error('Error logging in:', error.message);
        alert('Login failed: ' + error.message);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('google-login-btn').classList.remove('hidden');
    }
}

async function signOut() {
    await db.auth.signOut();
    window.location.href = 'index.html';
}

async function getCurrentUser() {
    const { data: { session }, error } = await db.auth.getSession();
    if (error || !session) return null;
    return session.user;
}

// Redirects user based on their role setup
async function checkAuthStateAndRedirect() {
    const user = await getCurrentUser();
    if (!user) {
        // Not logged in, stay on index.html (or redirect to index.html if elsewhere)
        if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
            window.location.href = 'index.html';
        }
        return;
    }

    // Check if user exists in the 'users' table
    const { data: userData, error: userError } = await db
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    if (userError && userError.code === 'PGRST116') {
        const path = window.location.pathname;
        if (!path.includes('role_selection.html') && 
            !path.includes('register.html') && 
            !path.includes('register_staff.html')) {
            window.location.href = 'role_selection.html';
        }
        return;
    }

    // If user exists, check their role and status
    if (userData) {
        if (userData.status === 'pending') {
            const path = window.location.pathname;
            if (!path.includes('pending.html')) {
                window.location.href = 'pending.html';
            }
            return;
        }
        let targetPage = '';
        switch (userData.role) {
            case 'student':
                // Verify they finished registration (exist in students table)
                const { data: studentData } = await db
                    .from('students')
                    .select('id')
                    .eq('user_id', user.id)
                    .single();

                if (!studentData) {
                    targetPage = 'register.html';
                } else {
                    targetPage = 'student.html';
                }
                break;
            case 'adviser':
                // Verify they exist in the advisers table (auto-create if admin approved them but didn't link)
                const { data: adviserData } = await db
                    .from('advisers')
                    .select('id')
                    .eq('id', user.id)
                    .single();

                if (!adviserData) {
                    const { error: insertErr } = await db.from('advisers').insert([{
                        id: user.id,
                        name: user.user_metadata?.full_name || user.email || 'Advisor',
                        department_id: userData.department_id
                    }]);
                    if (insertErr) {
                        console.error('Failed to auto-create adviser record', insertErr);
                    }
                }
                targetPage = 'adviser.html';
                break;
            case 'hod':
                targetPage = 'hod.html';
                break;
            case 'warden':
                targetPage = 'warden.html';
                break;
            case 'security':
                targetPage = 'security.html';
                break;
            case 'admin':
                targetPage = 'admin.html';
                break;
        }

        if (targetPage && !window.location.pathname.includes(targetPage)) {
            window.location.href = targetPage;
        }
    }
}

// --- Registration Helpers ---

async function loadRegistrationDropdowns() {
    // Load Departments
    const { data: depts } = await db.from('departments').select('id, name');
    const deptSelect = document.getElementById('department');
    if (depts && deptSelect) {
        depts.forEach(d => {
            const option = document.createElement('option');
            option.value = d.id;
            option.textContent = d.name;
            deptSelect.appendChild(option);
        });
    }

    // Load Hostels
    const { data: hostels } = await db.from('hostels').select('id, name');
    const hostelSelect = document.getElementById('hostel');
    if (hostels && hostelSelect) {
        hostels.forEach(h => {
            const option = document.createElement('option');
            option.value = h.id;
            option.textContent = h.name;
            hostelSelect.appendChild(option);
        });
    }
}

async function loadAdvisersForDepartment(departmentId) {
    const adviserSelect = document.getElementById('adviser');
    if (!adviserSelect) return;

    adviserSelect.innerHTML = '<option value="" disabled selected>Select Class Adviser</option>';
    adviserSelect.disabled = true;

    if (!departmentId) return;

    // Fetch advisers filtered by department. 
    // The advisers table stores id = users.id, so we join to get name and user UUID together.
    const { data: advisers } = await db
        .from('advisers')
        .select('id, name, department_id')
        .eq('department_id', departmentId);

    if (advisers && advisers.length > 0) {
        advisers.forEach(a => {
            const option = document.createElement('option');
            option.value = a.id;   // advisers.id === users.id (UUID)
            option.textContent = a.name;
            adviserSelect.appendChild(option);
        });
        adviserSelect.disabled = false;
    } else {
        adviserSelect.innerHTML = '<option value="" disabled selected>No Advisers found for this Dept</option>';
    }
}

async function registerStudent(studentData) {
    const user = await getCurrentUser();
    if(!user) return { error: { message: "Not authenticated" } };

    // 1. Insert into users table
    const { error: userError } = await db.from('users').insert([{
        id: studentData.user_id,
        email: user.email,
        name: studentData.name,
        role: 'student',
        status: 'approved',
        department_id: studentData.department_id
    }]);

    if (userError) return { error: userError };

    // 2. Insert into students table (now includes warden_id)
    return await db.from('students').insert([studentData]);
}

async function loadWardens() {
    // Fetch approved wardens from users table
    const { data: wardens } = await db
        .from('users')
        .select('id, name, email')
        .eq('role', 'warden')
        .eq('status', 'approved');

    const wardenSelect = document.getElementById('warden');
    if (!wardens || !wardenSelect) return;

    if (wardens.length === 0) {
        wardenSelect.innerHTML = '<option value="" disabled selected>No Wardens available</option>';
        return;
    }

    wardens.forEach(w => {
        const option = document.createElement('option');
        option.value = w.id;  // user UUID
        option.textContent = w.name || w.email;  // show name, fallback to email
        wardenSelect.appendChild(option);
    });
}

async function loadAlerts(targetId, role) {
    // role: 'adviser' | 'warden'
    const column = role === 'adviser' ? 'adviser_id' : 'warden_id';
    const { data: alerts } = await db
        .from('alerts')
        .select('*')
        .eq(column, targetId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

    return alerts || [];
}

async function registerStaff(staffData) {
    const user = await getCurrentUser();
    if(!user) return { error: { message: "Not authenticated" } };

    // Insert into users table with pending status, including display name
    return await db.from('users').insert([{
        id: staffData.user_id,
        email: user.email,
        name: staffData.name || user.user_metadata?.full_name || user.email,
        role: staffData.role,
        status: 'pending',
        department_id: staffData.department_id || null
    }]);
}

