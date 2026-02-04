let ROLE = ""; // adviser / hod / warden

function setRole(role) {
  ROLE = role;
  loadRequests();
}

async function loadRequests() {
  let column = ROLE + "_status";

  const { data } = await supabase
    .from("outpass_requests")
    .select("*")
    .eq(column, "pending");

  const div = document.getElementById("requests");
  div.innerHTML = "";

  data.forEach(req => {
    div.innerHTML += `
      <div style="border:1px solid black; padding:10px; margin:5px;">
        <p><b>Purpose:</b> ${req.purpose}</p>
        <p>Out: ${req.out_time}</p>
        <p>In: ${req.in_time}</p>
        <button onclick="approve('${req.id}')">Approve</button>
        <button onclick="reject('${req.id}')">Reject</button>
      </div>
    `;
  });
}

async function approve(id) {
  let updateData = {};
  updateData[ROLE + "_status"] = "approved";

  // If warden approves → final approved
  if (ROLE === "warden") {
    updateData.final_status = "approved";
  }

  await supabase
    .from("outpass_requests")
    .update(updateData)
    .eq("id", id);

  alert("Approved!");
  loadRequests();
}

async function reject(id) {
  let updateData = {};
  updateData[ROLE + "_status"] = "rejected";
  updateData.final_status = "rejected";

  await supabase
    .from("outpass_requests")
    .update(updateData)
    .eq("id", id);

  alert("Rejected!");
  loadRequests();
}
