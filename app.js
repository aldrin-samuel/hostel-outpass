console.log("App.js starting...")

// ---------- SUPABASE CONFIG ----------

const SUPABASE_URL = "https://xlorfxaknfntevtcmovd.supabase.co"
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY"

const { createClient } = supabase

const db = createClient(
SUPABASE_URL,
SUPABASE_ANON_KEY
)

console.log("Supabase client created")


// ---------- GOOGLE LOGIN ----------

async function signInWithGoogle(){

console.log("Starting Google login")

const { error } = await db.auth.signInWithOAuth({

provider:"google",

options:{
redirectTo:window.location.origin
}

})

if(error){

console.error("Login error:",error)

alert("Login failed")

}

}



// ---------- AUTH STATE LISTENER ----------

db.auth.onAuthStateChange((event,session)=>{

console.log("Auth event:",event)

if(event==="SIGNED_IN"){

console.log("User signed in:",session.user.email)

cleanUrl()

redirectUser()

}

})



// ---------- SESSION CHECK ----------

async function checkSession(){

console.log("Checking session")

const { data:{ session } } = await db.auth.getSession()

if(session){

console.log("Existing session:",session.user.email)

cleanUrl()

redirectUser()

}else{

console.log("No session found")

}

}



// ---------- CLEAN OAUTH TOKEN ----------

function cleanUrl(){

if(window.location.hash.includes("access_token")){

window.history.replaceState({},document.title,window.location.pathname)

}

}



// ---------- REDIRECT ----------

function redirectUser(){

console.log("Redirecting user")

// TEMPORARY redirect for testing
window.location.href="student.html"

}



// ---------- INIT ----------

checkSession()
