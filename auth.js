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

  switch (user.role) {
    case "student":
      window.location.href = "student.html";
      break;
    case "adviser":
      window.location.href = "adviser.html";
      break;
    case "hod":
      window.location.href = "hod.html";
      break;
    case "warden":
      window.location.href = "warden.html";
      break;
    case "security":
      window.location.href = "security.html";
      break;
    default:
      alert("Unknown role");
  }
}
