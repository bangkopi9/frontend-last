(function(){
  const OPEN_ON_COMPLETE   = true;   // auto-open saat funnel selesai
  const OPEN_ON_DISQUALIFY = false;  // kalau mau tetap tawarkan kontak saat disqualify → set true

  function getPLZ(answers){
    if (!answers) return "";
    return answers.plz || answers.PLZ || answers.zip || answers.postal || "";
  }

  // Pastikan FunnelEngine ada
  if (!window.FunnelEngine || typeof window.FunnelEngine.next !== "function") return;

  const _origNext = window.FunnelEngine.next;
  window.FunnelEngine.next = async function(product, answers){
    const res = await _origNext(product, answers);
    try{
      // Selesai normal → buka form (prefill PLZ + product)
      if (OPEN_ON_COMPLETE && res && res.next_slot == null && res.disqualified === false){
        if (typeof window.openLeadForm === "function"){
          const prefill = { product: product || "pv", plz: getPLZ(answers) };
          setTimeout(()=> window.openLeadForm(prefill), 500);
        }
      }
      // Disqualify (opsional)
      if (OPEN_ON_DISQUALIFY && res && res.disqualified === true){
        if (typeof window.openLeadForm === "function"){
          setTimeout(()=> window.openLeadForm({ product: product || "pv", plz: getPLZ(answers) }), 600);
        }
      }
    }catch(e){}
    return res;
  };
})();
