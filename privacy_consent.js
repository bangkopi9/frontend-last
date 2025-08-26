
(function(){
  const KEY = "consent_v1";
  function getLang(){
    try{
      if (typeof getCurrentLang === "function") return getCurrentLang();
      if (typeof CONFIG !== "undefined" && CONFIG.LANG_DEFAULT) return CONFIG.LANG_DEFAULT;
    }catch(e){}
    return (document.documentElement.lang || "de").toLowerCase().startsWith("en") ? "en" : "de";
  }
  function load(){
    try{ return JSON.parse(localStorage.getItem(KEY) || "null"); }catch(e){ return null; }
  }
  function save(state){
    localStorage.setItem(KEY, JSON.stringify(state));
    try {
      fetch((_baseURL? _baseURL(): (typeof CONFIG!=='undefined'?CONFIG.BASE_API_URL:'')) + "/track", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ event:"consent_given", consent: state })
      }).catch(()=>{});
    } catch(e){}
  }
  function buildBanner(lang){
    const wrap = document.createElement("div");
    wrap.id = "consent-banner";
    wrap.style.position="fixed"; wrap.style.bottom="0"; wrap.style.left="0"; wrap.style.right="0";
    wrap.style.background="#111"; wrap.style.color="#fff"; wrap.style.padding="12px 16px";
    wrap.style.zIndex="99999"; wrap.style.boxShadow="0 -2px 12px rgba(0,0,0,0.3)";
    wrap.innerHTML = `
      <div style="display:flex; gap:12px; align-items:center; justify-content:space-between; max-width:980px; margin:0 auto;">
        <div style="font-size:14px; line-height:1.4;">${window.I18N_PRIVACY.banner[lang]}</div>
        <div style="white-space:nowrap;">
          <button id="consent-accept" style="margin-right:8px; padding:8px 12px;">${window.I18N_PRIVACY.buttons[lang].accept}</button>
          <button id="consent-settings" style="padding:8px 12px; background:#333; color:#fff; border:1px solid #444;">${window.I18N_PRIVACY.buttons[lang].settings}</button>
        </div>
      </div>`;
    return wrap;
  }
  function buildSettings(lang){
    const modal = document.createElement("div");
    modal.id="consent-settings-modal";
    Object.assign(modal.style,{position:"fixed", inset:"0", background:"rgba(0,0,0,0.5)", zIndex:"100000"});
    modal.innerHTML = `
      <div style="background:#fff; color:#111; max-width:560px; margin:8% auto; padding:18px 20px; border-radius:10px;">
        <div style="font-size:18px; font-weight:700; margin-bottom:6px;">${window.I18N_PRIVACY.settingsTitle[lang]}</div>
        <div style="font-size:14px; margin-bottom:12px;">${window.I18N_PRIVACY.settingsIntro[lang]}</div>
        <label style="display:block; margin:8px 0; opacity:0.7;">
          <input type="checkbox" checked disabled /> Essential — always on
        </label>
        <label style="display:block; margin:8px 0;">
          <input id="consent-analytics" type="checkbox" /> ${window.I18N_PRIVACY.categories[lang].analytics}
        </label>
        <label style="display:block; margin:8px 0;">
          <input id="consent-marketing" type="checkbox" /> ${window.I18N_PRIVACY.categories[lang].marketing}
        </label>
        <label style="display:block; margin:8px 0;">
          <input id="consent-personalization" type="checkbox" /> ${window.I18N_PRIVACY.categories[lang].personalization}
        </label>
        <div style="margin-top:12px; text-align:right;">
          <button id="consent-save" style="padding:8px 12px;">${window.I18N_PRIVACY.buttons[lang].save}</button>
        </div>
      </div>`;
    return modal;
  }
  function init(){
    const state = load();
    const lang = getLang();
    if (state){
      window.CONSENT = state;
      return;
    }
    const banner = buildBanner(lang);
    document.body.appendChild(banner);
    document.getElementById("consent-accept").onclick = () => {
      const s = { essential:true, analytics:true, marketing:true, personalization:true, ts: Date.now() };
      window.CONSENT = s; save(s);
      banner.remove();
    };
    document.getElementById("consent-settings").onclick = () => {
      const modal = buildSettings(lang);
      document.body.appendChild(modal);
      document.getElementById("consent-save").onclick = () => {
        const s = {
          essential:true,
          analytics: document.getElementById("consent-analytics").checked,
          marketing: document.getElementById("consent-marketing").checked,
          personalization: document.getElementById("consent-personalization").checked,
          ts: Date.now()
        };
        window.CONSENT = s; save(s);
        modal.remove(); banner.remove();
      };
      modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    };
  }
  document.addEventListener("DOMContentLoaded", init);
  // Manage link
  window.openConsentSettings = function(){
    const lang = getLang();
    const modal = buildSettings(lang);
    document.body.appendChild(modal);
    const s = load() || { essential:true, analytics:false, marketing:false, personalization:false };
    document.getElementById("consent-analytics").checked = !!s.analytics;
    document.getElementById("consent-marketing").checked = !!s.marketing;
    document.getElementById("consent-personalization").checked = !!s.personalization;
    document.getElementById("consent-save").onclick = () => {
      const n = {
        essential:true,
        analytics: document.getElementById("consent-analytics").checked,
        marketing: document.getElementById("consent-marketing").checked,
        personalization: document.getElementById("consent-personalization").checked,
        ts: Date.now()
      };
      window.CONSENT = n; save(n); modal.remove();
    };
  }
})();