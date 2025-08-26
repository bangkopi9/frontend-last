window.FunnelEngine = (function(){
  const API = (typeof CONFIG!=='undefined' && CONFIG.BASE_API_URL) ? CONFIG.BASE_API_URL : "";
  async function next(product, answers){
    const res = await fetch(API + "/funnel/next",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ product, answers_so_far: answers||{}, session_id: (localStorage.getItem('chat_session')||'') })});
    if(!res.ok) throw new Error("funnel/next failed");
    return await res.json();
  }
  return { next };
})();