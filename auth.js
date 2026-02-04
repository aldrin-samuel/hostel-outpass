async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert(error.message);
    return;
  }

  const userId = data.user.id;

  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();

  if (!user) {
    alert("User role not found");
    return;
  }

  if (user.role === "student") window.location.href = "student.html";
  if (user.role === "adviser") window.location.href = "adviser.html";
  if (user.role === "hod") window.location.href = "hod.html";
  if (user.role === "warden") window.location.href = "warden.html";
  if (user.role === "security") window.location.href = "security.html";
}
