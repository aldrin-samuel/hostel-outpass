async function requestOutpass() {
  const purpose = document.getElementById("purpose").value;
  const out_time = document.getElementById("out_time").value;
  const in_time = document.getElementById("in_time").value;

  const { data: userData } = await supabase.auth.getUser();
  const studentId = userData.user.id;

  const { error } = await supabase
    .from("outpass_requests")
    .insert([{
      student_id: studentId,
      purpose,
      out_time,
      in_time
    }]);

  if (error) {
    alert(error.message);
  } else {
    alert("Outpass requested successfully!");
    loadMyRequests();
  }
}

async function loadMyRequests() {
  const { data: userData } = await supabase.auth.getUser();
  const studentId = userData.user.id;

  const { data } = await supabase
    .from("outpass_requests")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  const div = document.getElementById("myRequests");
  div.innerHTML = "";

  data.forEach(req => {
    div.innerHTML += `
      <div style="border:1px solid #ccc; padding:10px; margin:5px;">
        <p><b>Purpose:</b> ${req.purpose}</p>
        <p>Adviser: ${req.adviser_status}</p>
        <p>HOD: ${req.hod_status}</p>
        <p>Warden: ${req.warden_status}</p>
        <p>Final: ${req.final_status}</p>
      </div>
    `;
  });
}

loadMyRequests();
