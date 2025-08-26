/* =========================
   Planville Chatbot (frontend)
   - AIGuard.answer / SSE
   - Funnel integration (FunnelEngine.next)
   - Lead form auto-open by engine/hook
========================= */

const productLabels = {
  heatpump: { en: "Heat Pump 🔥", de: "Wärmepumpe 🔥" },
  aircon:   { en: "Air Conditioner ❄️", de: "Klimaanlage ❄️" },
  pv:       { en: "Photovoltaic System ☀️", de: "Photovoltaikanlage ☀️" },
  roof:     { en: "Roof Renovation 🛠️", de: "Dachsanierung 🛠️" },
  tenant:   { en: "Tenant Power 🏠", de: "Mieterstrom 🏠" },
};

// ------- CONFIG HELPERS -------
function _baseURL() {
  try {
    const b = (typeof CONFIG !== "undefined" && CONFIG.BASE_API_URL) ? CONFIG.BASE_API_URL : "";
    return b.endsWith("/") ? b.slice(0, -1) : b;
  } catch (e) { return ""; }
}
function getCurrentLang(){
  const el = document.getElementById("langSwitcher");
  return el ? el.value : (window.CONFIG?.LANG_DEFAULT || "de");
}
window.getCurrentLang = getCurrentLang; // expose global untuk lead_form.js, dll

// ========================
// 📚 FAQ Multilingual Data
// ========================
const faqTexts = {
  en: [
    "How much does photovoltaics service cost?",
    "What areas does Planville serve?",
    "Can I book a consultation?"
  ],
  de: [
    "Wie viel kostet eine Photovoltaikanlage?",
    "Welche Regionen deckt Planville ab?",
    "Kann ich eine Beratung buchen?"
  ]
};

// ========================
// 🎯 Element Selectors
// ========================
const chatLog       = document.getElementById("chatbot-log");
const form          = document.getElementById("chatbot-form");
const input         = document.getElementById("chatbot-input");
const toggle        = document.getElementById("modeToggle");
const typingBubble  = document.getElementById("typing-bubble");
const langSwitcher  = document.getElementById("langSwitcher");

// ========================
// 🧠 Chat History
// ========================
let chatHistory = JSON.parse(localStorage.getItem("chatHistory") || "[]");

function loadChatHistory() {
  chatHistory.forEach(entry => {
    appendMessage(entry.message, entry.sender, false);
  });
}
function saveToHistory(sender, message) {
  chatHistory.push({ sender, message });
  localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
}
function resetChat() {
  localStorage.removeItem("chatHistory");
  chatHistory = [];
  chatLog.innerHTML = "";
  const productBlock = document.getElementById("product-options-block");
  if (productBlock) productBlock.remove();
}

// ========================
// 🧭 App State (Funnel)
// ========================
const state = {
  inFunnel: false,
  currentProductKey: null, // "pv","aircon","heatpump","tenant","roof"
  currentProduct: "pv",    // normalisasi untuk backend (pv|dach|wp|mieterstrom)
  answers: {},
  awaitingSlot: null
};

function mapProductKeyToBackend(key){
  switch ((key||"").toLowerCase()){
    case "roof": return "dach";
    case "tenant": return "mieterstrom";
    case "heatpump": return "wp";
    // aircon belum ada flow di backend → biar engine normalisasi ke "pv"
    case "aircon": return "pv";
    case "pv":
    default: return "pv";
  }
}

// ========================
// 🚀 On load
// ========================
window.onload = () => {
  const selectedLang = localStorage.getItem("selectedLang") || (window.CONFIG?.LANG_DEFAULT || "de");
  langSwitcher.value = selectedLang;
  updateFAQ(selectedLang);
  updateUITexts(selectedLang); // greet + product options
  loadChatHistory();

  // Cookie banner/GA
  const consent = localStorage.getItem("cookieConsent");
  if (!consent) {
    const bn = document.getElementById("cookie-banner");
    if (bn) bn.style.display = "block";
  } else if (consent === "accepted") {
    if (typeof enableGTM === "function") enableGTM();
  }
};

// ========================
// 🌗 Mode Switcher
// ========================
toggle.addEventListener("change", () => {
  document.body.style.background = toggle.checked ? "var(--bg-light)" : "var(--bg-dark)";
  document.body.style.color = toggle.checked ? "var(--text-light)" : "var(--text-dark)";
});

// ========================
// 🌐 Language Switcher
// ========================
langSwitcher.addEventListener("change", () => {
  const lang = langSwitcher.value;
  localStorage.setItem("selectedLang", lang);
  updateFAQ(lang);
  updateUITexts(lang);

  if (typeof gtag !== "undefined") {
    gtag('event', 'language_switch', { event_category: 'chatbot', event_label: lang });
  }
});

// ========================
/* 🤖 Ask bot (AIGuard / SSE streaming) */
// ========================
async function askBot(text){
  const lang = getCurrentLang();
  // tampilkan user message
  appendMessage(text, "user");
  saveToHistory("user", text);

  // typing on
  typingBubble.style.display = "block";

  // intent quick-reply (harga / interested)
  if (detectIntent(text)){
    typingBubble.style.display = "none";
    return;
  }

  // jika sedang di funnel & menunggu jawaban slot
  if (state.inFunnel && state.awaitingSlot){
    typingBubble.style.display = "none";
    // simpan jawaban untuk slot saat ini
    state.answers[state.awaitingSlot] = text;
    saveToHistory("user", text);
    await promptNextStep(); // lanjutkan flow funnel
    return;
  }

  try{
    if (window.CONFIG?.STREAMING){
      await askBotStream(text, lang);
    } else {
      const { answer } = await AIGuard.answer(text, lang);
      typingBubble.style.display = "none";
      appendMessage(answer || "…", "bot");
      saveToHistory("bot", answer || "…");
    }
  }catch(err){
    typingBubble.style.display = "none";
    appendMessage(
      lang==="de"
        ? "Ups, da ist etwas schiefgelaufen. Kontakt: <a href='"+(CONFIG?.CTA_URL||"https://planville.de/kontakt")+"' target='_blank'>Planville</a>"
        : "Oops, something went wrong. Contact: <a href='"+(CONFIG?.CTA_URL||"https://planville.de/kontakt")+"' target='_blank'>Planville</a>",
      "bot"
    );
  }
}

async function askBotStream(text, lang){
  // siapkan container pesan bot yang akan di-stream
  const botDiv = document.createElement("div");
  botDiv.className = "chatbot-message bot-message";
  botDiv.innerHTML = "";
  chatLog.appendChild(botDiv);
  chatLog.scrollTop = chatLog.scrollHeight;

  try{
    const streamResp = (window.api && window.api.chatStream)
      ? await window.api.chatStream({ message: text, lang })
      : await fetch(`${_baseURL()}/chat/sse?message=${encodeURIComponent(text)}&lang=${encodeURIComponent(lang)}`, { headers:{ "Accept":"text/event-stream" } });

    const reader = streamResp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buf = "";
    while(true){
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, {stream:true});
      const chunks = buf.split("\n\n");
      buf = chunks.pop();
      for (const ch of chunks){
        if (ch.startsWith("data: ")){
          const payload = ch.slice(6).replace(/\\n/g, "\n");
          botDiv.innerText += payload;
          chatLog.scrollTop = chatLog.scrollHeight;
        }
      }
    }
    typingBubble.style.display = "none";
    saveToHistory("bot", botDiv.innerText || "");
  }catch(err){
    typingBubble.style.display = "none";
    appendMessage(
      lang==="de"
        ? "Ups, da ist etwas schiefgelaufen. Kontakt: <a href='"+(CONFIG?.CTA_URL||"https://planville.de/kontakt")+"' target='_blank'>Planville</a>"
        : "Oops, something went wrong. Contact: <a href='"+(CONFIG?.CTA_URL||"https://planville.de/kontakt")+"' target='_blank'>Planville</a>",
      "bot"
    );
  }
}

// ========================
// 📩 Form Submit Handler
// ========================
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const question = (input.value || "").trim();
  if (!question) return;
  input.value = "";
  askBot(question);
});

// ========================
// 💬 Append Message
// ========================
function appendMessage(msg, sender, scroll = true) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `chatbot-message ${sender}-message`;
  msgDiv.innerHTML = msg;

  if (sender === "bot") {
    const feedback = document.createElement("div");
    feedback.className = "feedback-btns";
    feedback.innerHTML = `
      <button onclick="feedbackClick('up')">👍</button>
      <button onclick="feedbackClick('down')">👎</button>
    `;
    msgDiv.appendChild(feedback);

    if ((msg||"").replace(/<[^>]*>/g,"").length > 100) {
      const lang = getCurrentLang();
      const cta = document.createElement("a");
      cta.href = (window.CONFIG && CONFIG.CTA_URL) ? CONFIG.CTA_URL : "https://planville.de/kontakt";
      cta.target = "_blank";
      cta.className = "cta-button";
      cta.innerText = lang === "de" ? "Jetzt Beratung buchen 👉" : "Book a consultation 👉";
      msgDiv.appendChild(cta);
    }
  }

  chatLog.appendChild(msgDiv);
  if (scroll) chatLog.scrollTop = chatLog.scrollHeight;
}

// ========================
// 📌 FAQ Updater
// ========================
function updateFAQ(lang) {
  const faqList = document.getElementById("faq-list");
  if (!faqList) return;
  faqList.innerHTML = "";

  (faqTexts[lang] || faqTexts.de).forEach((text) => {
    const li = document.createElement("li");
    li.innerText = text;
    li.onclick = () => sendFAQ(text);
    faqList.appendChild(li);
  });
}

// ========================
// 📤 FAQ Click → Input
// ========================
function sendFAQ(text) {
  input.value = text;
  form.dispatchEvent(new Event("submit"));

  if (typeof trackFAQClick === "function") {
    trackFAQClick(text);
  }
}

// ========================
// 👍👎 Feedback
// ========================
function feedbackClick(type) {
  alert(type === "up" ? "Thanks for your feedback! 👍" : "We'll improve. 👎");

  if (typeof gtag !== "undefined") {
    gtag('event', 'chat_feedback', {
      event_category: 'chatbot',
      event_label: type,
    });
  }
}

// ========================
// 🌐 Update Header & Greeting
// ========================
function updateUITexts(lang) {
  const h1 = document.querySelector('.chatbot-header h1');
  if (h1) h1.innerText = lang === "de" ? "Chatte mit Planville AI 🤖" : "Chat with Planville AI 🤖";

  resetChat();

  const greeting = lang === "de"
    ? "Hallo! 👋 Was kann ich für Sie tun?<br>Bitte wählen Sie ein Thema:"
    : "Hello! 👋 What can I do for you?<br>Please choose a topic:";

  appendMessage(greeting, "bot");
  showProductOptions();
}

// ========================
// 🔘 Show Product Bubble
// ========================
function showProductOptions() {
  const lang = getCurrentLang();
  const keys = ["pv", "aircon", "heatpump", "tenant", "roof"];

  const existing = document.getElementById("product-options-block");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.className = "product-options";
  container.id = "product-options-block";

  keys.forEach((key) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerText = productLabels[key][lang];
    button.className = "product-button";
    button.dataset.key = key;
    button.onclick = () => handleProductSelection(key);
    container.appendChild(button);
  });

  chatLog.appendChild(container);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// ========================
// 🧩 Product Click → Start Funnel
// ========================
async function handleProductSelection(key) {
  const lang = getCurrentLang();
  const label = productLabels[key][lang];

  appendMessage(label, "user");
  saveToHistory("user", label);

  if (typeof gtag !== "undefined") {
    gtag('event', 'select_product', {
      event_category: 'chatbot_interaction',
      event_label: key,
      language: lang
    });
  }

  // Set funnel state
  state.inFunnel = true;
  state.currentProductKey = key;
  state.currentProduct = mapProductKeyToBackend(key);
  state.answers = {};
  state.awaitingSlot = null;

  setTimeout(async () => {
    const followUp = lang === "de"
      ? `Was möchten Sie genau zu <b>${label}</b> wissen oder erreichen?`
      : `What exactly would you like to know or achieve about <b>${label}</b>?`;
    appendMessage(followUp, "bot");

    // mulai funnel pertanyaan terstruktur
    await promptNextStep();
  }, 300);
}

// ========================
// 🔄 Funnel stepper
// ========================
async function promptNextStep(){
  const lang = getCurrentLang();
  try{
    if (!window.FunnelEngine || typeof window.FunnelEngine.next !== "function"){
      // fallback kalau engine belum ter-load
      appendMessage(
        lang==="de" ? "Ich verbinde dich gerne mit unserem Team." : "I’ll connect you with our team.",
        "bot"
      );
      return;
    }
    const out = await window.FunnelEngine.next(state.currentProduct, state.answers);

    if (out.disqualified){
      const msg = lang==="de"
        ? "Danke für dein Interesse! Aufgrund deiner Antworten, können wir Dir leider keine passende Dienstleistung anbieten. Schau aber gerne mal auf unserer Webseite vorbei!"
        : "Thanks for your interest! Based on your answers, we unfortunately can’t offer a suitable service. Feel free to check our website!";
      appendMessage(msg, "bot");
      state.inFunnel = false;
      state.awaitingSlot = null;
      return;
    }

    if (!out.next_slot){
      // funnel selesai; engine/hook akan auto-open lead form sesuai config
      const doneMsg = lang==="de"
        ? "Super, ich habe genug Informationen. Unten kannst du uns direkt kontaktieren 👇"
        : "Great, I have enough info. You can contact us directly below 👇";
      appendMessage(doneMsg, "bot");

      // Tambah CTA juga
      const btn = document.createElement("a");
      btn.href = (window.CONFIG && CONFIG.CTA_URL) ? CONFIG.CTA_URL : "https://planville.de/kontakt";
      btn.target = "_blank";
      btn.className = "cta-button";
      btn.innerText = lang === "de" ? "💬 Jetzt Kontakt aufnehmen" : "💬 Contact us";
      chatLog.appendChild(btn);

      state.inFunnel = false;
      state.awaitingSlot = null;
      return;
    }

    // masih ada pertanyaan berikutnya
    state.awaitingSlot = out.next_slot;
    const q = out.question || out.next_slot;
    appendMessage(q, "bot");
    // user berikutnya menjawab via input → di-handle pada askBot()
  }catch(err){
    appendMessage(
      lang==="de" ? "Ups, da ist etwas schiefgelaufen. Bitte versuche es später erneut." :
                    "Oops, something went wrong. Please try again later.",
      "bot"
    );
  }
}

// ========================
// 🎯 Intent Detection (quick replies)
// ========================
function detectIntent(text) {
  const lower = (text||"").toLowerCase();

  // Harga/biaya
  if (lower.includes("harga") || lower.includes("kosten") || lower.includes("cost")) {
    const lang = getCurrentLang();
    const msg = lang === "de"
      ? "Die Preise für Photovoltaik beginnen bei etwa 7.000€ bis 15.000€, abhängig von Größe & Standort. Für ein genaues Angebot:"
      : "Prices for photovoltaics typically range from €7,000 to €15,000 depending on size & location. For an exact quote:";
    appendMessage(msg, "bot");

    const cta = document.createElement("a");
    cta.href = (window.CONFIG && CONFIG.CTA_URL) ? CONFIG.CTA_URL : "https://planville.de/kontakt";
    cta.target = "_blank";
    cta.className = "cta-button";
    cta.innerText = lang === "de" ? "Jetzt Preis anfragen 👉" : "Request Price 👉";
    chatLog.appendChild(cta);

    if (typeof gtag !== "undefined") {
      gtag('event', 'intent_preisinfo', { event_category: 'intent', event_label: text, language: lang });
    }
    window.api?.track?.({event:"intent_preisinfo", text, lang}).catch(()=>{});
    return true;
  }

  // Tertarik
  if (lower.includes("tertarik") || lower.includes("interested")) {
    const lang = getCurrentLang();
    const msg = lang === "de" ? "Super! Bitte füllen Sie dieses kurze Formular aus:" : "Great! Please fill out this short form:";
    appendMessage(msg, "bot");
    injectLeadMiniForm();
    return true;
  }

  return false;
}

// ========================
// 🧾 Mini Lead Form (inline)
// ========================
function injectLeadMiniForm() {
  const lang = getCurrentLang();
  const container = document.createElement("div");
  container.className = "chatbot-message bot-message";

  container.innerHTML = `
    <form id="lead-mini-form">
      <label>👤 ${lang === "de" ? "Name" : "Name"}:</label><br>
      <input type="text" id="leadName" required style="margin-bottom:6px; width:100%;" /><br>
      <label>📧 ${lang === "de" ? "E-Mail" : "Email"}:</label><br>
      <input type="email" id="leadEmail" required style="margin-bottom:6px; width:100%;" /><br>
      <button type="submit" style="padding:6px 14px; margin-top:4px;">
        ${lang === "de" ? "Absenden" : "Submit"}
      </button>
    </form>
  `;

  chatLog.appendChild(container);

  document.getElementById("lead-mini-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name  = document.getElementById("leadName").value.trim();
    const email = document.getElementById("leadEmail").value.trim();

    // Validasi Email sederhana
    if (!email.includes("@") || !email.includes(".")) {
      alert(lang === "de" ? "Bitte geben Sie eine gültige E-Mail-Adresse ein." : "Please enter a valid email address.");
      return;
    }

    appendMessage(
      lang === "de"
        ? `Vielen Dank ${name}! Unser Team wird Sie bald unter ${email} kontaktieren 🙌`
        : `Thank you ${name}! Our team will contact you soon at ${email} 🙌`,
      "bot"
    );

    if (typeof gtag !== "undefined") {
      gtag('event', 'mini_form_submit', { event_category: 'leadform', event_label: email });
    }
    window.api?.track?.({event:"mini_form_submit", email}).catch(()=>{});
  });
}

// (export kecil untuk test manual di console)
window.__chatState = state;
