(function(){
  function getLang(){
    try{
      if (typeof getCurrentLang === "function") return getCurrentLang();
    }catch(e){}
    return (document.documentElement.lang||'de').toLowerCase().startsWith('en')?'en':'de';
  }
  function addCTA(){
    const lang = getLang();
    const btn = document.createElement("a");
    btn.href = "https://planville.de/kontakt/";
    btn.target = "_blank";
    btn.className = "cta-button";
    btn.innerText = lang === 'de' ? "Jetzt buchen" : "Contact us";
    const wrap = document.getElementById("chatbot-log") || document.body;
    wrap.appendChild(btn);
  }
  window.addEventListener("DOMContentLoaded", function(){
    // Append CTA once at start; further calls can add more in flow as needed
    addCTA();
  });
})();