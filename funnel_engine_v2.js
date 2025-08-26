// public/funnel_engine_v2.js
(function(){
  "use strict";

  const API = (typeof CONFIG !== "undefined" && CONFIG.BASE_API_URL) ? CONFIG.BASE_API_URL : "";
  const CFG = window.CONFIG || {};
  const FEATURES = CFG.FEATURES || { AUTO_OPEN_LEAD_FORM: true, OPEN_ON_DISQUALIFY: false };

  const getLang = () =>
    (typeof window.getCurrentLang === "function")
      ? window.getCurrentLang()
      : (CFG.LANG_DEFAULT || "de");

  // --- session id (persist) ---
  function sessionId(){
    let s = "";
    try { s = localStorage.getItem("chat_session") || ""; } catch(_) {}
    if (!s) {
      s = "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { localStorage.setItem("chat_session", s); } catch(_) {}
    }
    return s;
  }

  // --- prevent double open lead form (if hooks also open) ---
  function recentlyOpened(){
    try {
      const t = parseInt(localStorage.getItem("__lead_open_guard") || "0", 10);
      return (Date.now() - t) < 3000; // 3s guard
    } catch(_) { return false; }
  }
  function markOpened(){
    try { localStorage.setItem("__lead_open_guard", String(Date.now())); } catch(_) {}
  }
  function maybeOpenLeadForm(prefill){
    if (typeof window.openLeadForm !== "function") return;
    if (recentlyOpened()) return;
    markOpened();
    setTimeout(()=> window.openLeadForm(prefill || {}), 400);
  }

  // --- product normalization (selaras backend) ---
  function normalizeProduct(p=""){
    const s = (p||"").toLowerCase();
    if (s.includes("dach")) return "dach";
    if (s.includes("mieter")) return "mieterstrom";
    if (s.includes("wärme") || s === "wp" || s.includes("heat")) return "wp";
    return s.includes("pv") || s.includes("photo") || s.includes("solar") ? "pv" : "pv";
  }

  // --- answers normalization (coerce boolean-ish) ---
  function normalizeAnswers(a){
    const ans = {...(a||{})};
    const yes = new Set(["ja","yes","y","true","1","✓"]);
    const no  = new Set(["nein","no","n","false","0","✗"]);
    ["eigentumer","bewohner","batterie","verschattung"].forEach(k=>{
      if (k in ans) {
        const v = (ans[k] + "").trim().toLowerCase();
        if (yes.has(v)) ans[k] = true;
        else if (no.has(v)) ans[k] = false;
      }
    });
    // number-ish
    ["dachflache_m2","neigung_deg","verbrauch_kwh","wohnflaeche","einheiten","zaehler","baujahr"]
      .forEach(k => { if (k in ans) { const n = Number(ans[k]); if (!Number.isNaN(n)) ans[k] = n; } });
    return ans;
  }

  // --- Slot → human question (DE/EN) ---
  const Q = {
    de: {
      immobilientyp: "Was für ein Immobilientyp ist es? (Einfamilienhaus, Mehrfamilienhaus, …)",
      eigentumer: "Bist du Eigentümer:in der Immobilie?",
      bewohner: "Bewohnst du die Immobilie selbst?",
      plz: "Wie ist deine PLZ?",
      dachform: "Welche Dachform? (Satteldach, Flachdach, …)",
      dachflache_m2: "Wie groß ist die Dachfläche (m²)?",
      ausrichtung: "Ausrichtung des Dachs? (S, SW, SO, …)",
      neigung_deg: "Wie groß ist die Dachneigung (°)?",
      verschattung: "Gibt es Verschattung? (ja/nein/teilweise)",
      verbrauch_kwh: "Wie hoch ist der jährliche Stromverbrauch (kWh)?",
      batterie: "Batteriespeicher gewünscht? (ja/nein)",
      zeitrahmen: "In welchem Zeitraum planst du die Umsetzung?",
      material: "Welches Dachmaterial?",
      baujahr: "Baujahr des Gebäudes?",
      zustand: "Wie ist der Zustand des Daches?",
      flaeche: "Wie groß ist die Dachfläche (m²)?",
      neigung: "Wie groß ist die Dachneigung (°)?",
      daemmung: "Ist eine Dämmung vorhanden?",
      gebaeudetyp: "Welcher Gebäudetyp?",
      wohnflaeche: "Wie groß ist die Wohnfläche (m²)?",
      heizung: "Welche Heizung ist aktuell im Einsatz?",
      isolierung: "Wie gut ist die Isolierung?",
      aussenbereich: "Gibt es Außenaufstellfläche?",
      objekttyp: "Welcher Objekttyp?",
      einheiten: "Wie viele Wohneinheiten?",
      zaehler: "Wie viele Stromzähler?"
    },
    en: {
      immobilientyp: "What type of property is it? (single-family, multi-family, …)",
      eigentumer: "Are you the owner of the property?",
      bewohner: "Do you live in the property yourself?",
      plz: "What's your ZIP code?",
      dachform: "What is the roof type? (gable, flat, …)",
      dachflache_m2: "Approx. roof area (m²)?",
      ausrichtung: "Roof orientation? (S, SW, SE, …)",
      neigung_deg: "Roof pitch (°)?",
      verschattung: "Any shading? (yes/no/partially)",
      verbrauch_kwh: "Annual electricity consumption (kWh)?",
      batterie: "Do you want a battery storage? (yes/no)",
      zeitrahmen: "Desired timeframe?",
      material: "Roof material?",
      baujahr: "Building year?",
      zustand: "Roof condition?",
      flaeche: "Roof area (m²)?",
      neigung: "Roof pitch (°)?",
      daemmung: "Is there insulation?",
      gebaeudetyp: "Building type?",
      wohnflaeche: "Living area (m²)?",
      heizung: "Current heating system?",
      isolierung: "How good is the insulation?",
      aussenbereich: "Is there outdoor installation space?",
      objekttyp: "Object type?",
      einheiten: "How many units?",
      zaehler: "How many meters?"
    }
  };
  function questionFor(slot, lang){ const L = (Q[lang] || Q.de); return L[slot] || slot; }

  // --- Core: call backend /funnel/next ---
  async function next(product, answers){
    const body = {
      product: normalizeProduct(product),
      answers_so_far: normalizeAnswers(answers || {}),
      session_id: sessionId()
    };

    const res = await fetch(API + "/funnel/next", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("funnel/next failed: " + res.status);
    const out = await res.json();

    // enrich for convenience
    out.product = out.product || body.product;
    out.percentLabel = `${out.percent || 0}%`;
    if (out.next_slot) out.question = questionFor(out.next_slot, getLang());

    // broadcast events
    try { window.dispatchEvent(new CustomEvent("funnel:step", { detail: { body, result: out } })); } catch(_) {}

    // Handle completion / disqualify
    const prefill = { product: body.product, plz: body.answers_so_far.plz || "" };

    if (out.disqualified === true) {
      try { window.dispatchEvent(new CustomEvent("funnel:disqualified", { detail: out })); } catch(_) {}
      if (FEATURES.OPEN_ON_DISQUALIFY) maybeOpenLeadForm(prefill);
      return out;
    }

    if (!out.next_slot) {
      try { window.dispatchEvent(new CustomEvent("funnel:complete", { detail: out })); } catch(_) {}
      if (FEATURES.AUTO_OPEN_LEAD_FORM) maybeOpenLeadForm(prefill);
      return out;
    }

    return out;
  }

  // expose
  window.FunnelEngine = { next, questionFor };
})();
