let currentRequestId = null;

function onScanSuccess(decodedText) {
  currentRequestId = decodedText;
  checkOutpass(decodedText);
}

async function checkOutpass(id) {
  const { data, error } = await supabase
    .from("outpass_requests")
    .select("*")
    .eq("id", id)
    .single();

  const result = document.getElementById("result");

  if (error || !data) {
    result.innerText = "❌ Invalid QR Code";
    return;
  }

  result.innerHTML = `
    <p><b>Purpose:</b> ${data.purpose}</p>
    <p>Final Status: ${data.final_status}</p>
    <p>Outside: ${data.is_outside}</p>
  `;
}

async function markOut() {
  if (!currentRequestId) return alert("Scan QR first!");

  await supabase
    .from("outpass_requests")
    .update({ is_outside: true })
    .eq("id", currentRequestId);

  alert("Student marked OUT");
}

async function markIn() {
  if (!currentRequestId) return alert("Scan QR first!");

  await supabase
    .from("outpass_requests")
    .update({ is_outside: false })
    .eq("id", currentRequestId);

  alert("Student marked IN");
}

new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 })
  .render(onScanSuccess);
