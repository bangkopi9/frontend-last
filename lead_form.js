(function(){
  // Base API (ambil dari public/config.js). Pastikan CONFIG.BASE_API_URL sudah di-set ke URL backend Railway.
  const API = (typeof CONFIG!=="undefined" && CONFIG.BASE_API_URL) ? CONFIG.BASE_API_URL : "";

  // Bahasa otomatis (fallback ke <html lang="...">)
  const getLang = () => (typeof getCurrentLang==="function" ? getCurrentLang()
                  : (document.documentElement.lang||"de").toLowerCase().startsWith("en")?"en":"de");

  // Kalau cuma mau auto-open di akhir funnel, set false (tombol melayang dimatikan)
  const SHOW_FLOATING_BUTTON = false;

  // Teks DE/EN
  const I18N = {
    de: {
      open: "Direkt anfragen",
      title: "Kontaktdaten",
      name: "Vollständiger Name",
      email: "E-Mail",
      phone: "Telefon (optional)",
      product: "Produkt",
      plz: "PLZ",
      msg: "Nachricht (optional)",
      consent: "Ich stimme der Kontaktaufnahme und Verarbeitung meiner Daten gemäß Datenschutzerklärung zu.",
      submit: "Absenden",
      success: "Danke! Wir melden uns in Kürze.",
      error: "Ups, das hat nicht geklappt. Bitte später erneut versuchen."
    },
    en: {
      open: "Request now",
      title: "Contact details",
      name: "Full name",
      email: "Email",
      phone: "Phone (optional)",
      product: "Product",
      plz: "ZIP code",
      msg: "Message (optional)",
      consent: "I agree to be contacted and for my data to be processed per the privacy policy.",
      submit: "Send",
      success: "Thanks! We’ll get back to you shortly.",
      error: "Oops, something went wrong. Please try again later."
    }
  };

  // Opsi produk
  const PRODUCTS = {
    de: ["Photovoltaik","Dachsanierung","Wärmepumpe","Mieterstrom"],
    en: ["Photovoltaics","Roofing","Heat pump","Tenant electricity"]
  };

  // Helper
  function el(tag, attrs={}, html=""){
    const e = document.createElement(tag);
    Object.assign(e, attrs);
    if (html) e.innerHTML = html;
    return e;
  }

  // Modal overlay
  function overlay(lang){
    const t = I18N[lang];
    const wrap = el("div");
    Object.assign(wrap.style, {
      position:"fixed", inset:"0", background:"rgba(0,0,0,.5)", zIndex:100000
    });
    wrap.innerHTML = `
      <div style="max-width:560px;margin:6% auto;background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #eee">
          <div style="font-weight:700">${t.title}</div>
          <button type="button" id="lead-close" aria-label="Close" style="border:none;background:transparent;font-size:20px;line-height:1;cursor:pointer">×</button>
        </div>
        <form id="lead-form" style="padding:16px 18px;display:grid;gap:10px">
          <input name="name" required placeholder="${t.name}" style="padding:10px;border:1px solid #ccc;border-radius:8px"/>
          <input type="email" name="email" required placeholder="${t.email}" style="padding:10px;border:1px solid #ccc;border-radius:8px"/>
          <input name="phone" placeholder="${t.phone}" style="padding:10px;border:1px solid #ccc;border-radius:8px"/>
          <select name="product" required style="padding:10px;border:1px solid #ccc;border-radius:8px"></select>
          <input name="plz" required pattern="\\d{5}" inputmode="numeric" placeholder="${t.plz}" style="padding:10px;border:1px solid #ccc;border-radius:8px"/>
          <textarea name="message" rows="3" placeholder="${t.msg}" style="padding:10px;border:1px solid #ccc;border-radius:8px"></textarea>
          <label style="display:flex;gap:10px;align-items:flex-start;font-size:12px;line-height:1.3">
            <input type="checkbox" required name="consent" style="margin-top:3px"/>
            <span>${t.consent}</span>
          </label>
          <button type="submit" style="padding:10px 14px;border:none;border-radius:10px;background:#111;color:#fff">${t.submit}</button>
        </form>
      </div>`;
    const sel = wrap.querySelector('select[name="product"]');
    PRODUCTS[lang].forEach(p => { const o = el("option"); o.value = p; o.textContent = p; sel.appendChild(o); });

    // close handlers
    wrap.addEventListener("click", (e)=>{ if (e.target===wrap) wrap.remove(); });
    wrap.querySelector("#lead-close").addEventListener("click", ()=> wrap.remove());
    return wrap;
  }

  // Kirim lead ke backend
  async function submitLead(data, lang){
    const productNorm = (data.product||"").toLowerCase();
    const type = productNorm.includes("dach") ? "dach"
               : productNorm.includes("mieter") ? "mieterstrom"
               : (productNorm.includes("wärme") || productNorm.includes("heat")) ? "wp"
               : "pv";

    const payload = {
      source: "chatbot",
      product: type,
      qualification: { plz: data.plz },
      contact: { name: data.name, email: data.email, phone: data.phone||"" },
      score: 50,
      disqualified: false,
      meta: { lang, session_id: localStorage.getItem("chat_session")||"" }
    };

    const res = await fetch(API + "/lead", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  // Expose: bisa dipanggil dari funnel hook
  window.openLeadForm = function(prefill={}){
    const lang = getLang();
    const ov = overlay(lang);
    document.body.appendChild(ov);

    // Track open (kalau consent analytics OK)
    if (window.CONSENT?.analytics) {
      try {
        fetch(API + "/track", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({event:"contact_open", source:"in_chat_form"})
        }).catch(()=>{});
      } catch(_) {}
    }

    const form = ov.querySelector("#lead-form");

    // Prefill
    if (prefill.name)  form.elements.name.value  = prefill.name;
    if (prefill.email) form.elements.email.value = prefill.email;
    if (prefill.phone) form.elements.phone.value = prefill.phone;
    if (prefill.plz)   form.elements.plz.value   = prefill.plz;
    if (prefill.product){
      const sel = form.elements.product;
      [...sel.options].forEach(o => {
        if (o.value.toLowerCase().includes((prefill.product||"").toLowerCase())) sel.value = o.value;
      });
    }

    form.addEventListener("submit", async (e)=>{
      e.preventDefault();

      // Front validation sederhana
      if (!form.reportValidity()) return;

      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());

      try{
        const out = await submitLead(data, lang);

        // Track submit
        if (window.CONSENT?.analytics) {
          try {
            fetch(API + "/track", {
              method:"POST",
              headers:{"Content-Type":"application/json"},
              body: JSON.stringify({event:"contact_submit", source:"in_chat_form", status: out.status||"unknown"})
            }).catch(()=>{});
          } catch(_) {}
        }

        const ok = (out.status==="ok" || out.status==="accepted");
        alert(ok ? I18N[lang].success : I18N[lang].error);
        if (ok) ov.remove();
      }catch(err){
        alert(I18N[lang].error);
      }
    });
  }

  // (Opsional) tombol melayang
  if (SHOW_FLOATING_BUTTON){
    document.addEventListener("DOMContentLoaded", ()=>{
      const lang = getLang();
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = lang==='de' ? I18N.de.open : I18N.en.open;
      Object.assign(btn.style, {
        position:"fixed", right:"16px", bottom:"82px", zIndex:99999,
        padding:"10px 12px", borderRadius:"999px", border:"1px solid #ddd",
        background:"#fff", cursor:"pointer", boxShadow:"0 4px 12px rgba(0,0,0,.1)"
      });
      btn.addEventListener("click", ()=> window.openLeadForm({}));
      document.body.appendChild(btn);
    });
  }
})();
