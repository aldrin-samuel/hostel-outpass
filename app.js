console.log("App.js loading...");

const SUPABASE_URL = "https://xlorfxaknfntevtcmovd.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ---------- AUTH INITIALIZATION ----------

async function initAuth() {

    console.log("Initializing auth...");

    // This processes OAuth tokens if they exist in URL
    const { data: { session } } = await db.auth.getSession();

    if (session) {
        console.log("Session found:", session.user.email);
        await checkAuthStateAndRedirect();
    } else {
        console.log("No active session");

        const protectedPages = [
            "student.html",
            "adviser.html",
            "hod.html",
            "warden.html",
            "security.html"
        ];

        const currentPage = window.location.pathname.split("/").pop();

        if (protectedPages.includes(currentPage)) {
            window.location.href = "index.html";
        }
    }

}

// Listen for auth events
db.auth.onAuthStateChange(async (event, session) => {

    console.log("Auth event:", event);

    if (event === "SIGNED_IN") {

        if (window.location.hash.includes("access_token")) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        await checkAuthStateAndRedirect();
    }

});


// ---------- LOGIN ----------

async function signInWithGoogle() {

    const { error } = await db.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: window.location.origin
        }
    });

    if (error) {
        alert("Login failed: " + error.message);
    }

}


// ---------- LOGOUT ----------

async function signOut() {
    await db.auth.signOut();
    window.location.href = "index.html";
}


// ---------- USER ----------

async function getCurrentUser() {

    const { data: { session } } = await db.auth.getSession();

    if (!session) return null;

    return session.user;

}


// ---------- ROLE REDIRECT ----------

async function checkAuthStateAndRedirect() {

    const user = await getCurrentUser();

    if (!user) return;

    const { data: userData, error } = await db
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

    // User not registered yet
    if (error) {
        window.location.href = "role_selection.html";
        return;
    }

    if (userData.status === "pending") {
        window.location.href = "pending.html";
        return;
    }

    let target = "";

    switch (userData.role) {

        case "student":
            target = "student.html";
            break;

        case "adviser":
            target = "adviser.html";
            break;

        case "hod":
            target = "hod.html";
            break;

        case "warden":
            target = "warden.html";
            break;

        case "security":
            target = "security.html";
            break;
    }

    const currentPage = window.location.pathname.split("/").pop();

    if (target && currentPage !== target) {
        window.location.href = target;
    }

}


// ---------- START AUTH ----------

initAuth();
