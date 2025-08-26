window.AIGuard = (function(){
  const API = (typeof CONFIG!=='undefined' && CONFIG.BASE_API_URL) ? CONFIG.BASE_API_URL : "";
  async function answer(message, lang, context_ids){
    const res = await fetch(API + "/ai/answer",{method:"POST",headers:{"Content-Type":"application/json"},body: JSON.stringify({ message, lang: lang||'de', context_pack_ids: context_ids||[] })});
    if(!res.ok) throw new Error("ai/answer failed");
    return await res.json();
  }
  return { answer };
})();