window.Scheduler = (function(){
  const API = (typeof CONFIG!=='undefined' && CONFIG.BASE_API_URL) ? CONFIG.BASE_API_URL : "";
  async function suggest(plz){
    const res = await fetch(API + "/schedule/suggest?plz=" + encodeURIComponent(plz||''));
    if(!res.ok) throw new Error("schedule/suggest failed");
    return await res.json();
  }
  return { suggest };
})();