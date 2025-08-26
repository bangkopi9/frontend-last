const productLabels = {
  heatpump: { en: "Heat Pump 🔥", de: "Wärmepumpe 🔥" },
  aircon: { en: "Air Conditioner ❄️", de: "Klimaanlage ❄️" },
  pv: { en: "Photovoltaic System ☀️", de: "Photovoltaikanlage ☀️" },
  roof: { en: "Roof Renovation 🛠️", de: "Dachsanierung 🛠️" },
  tenant: { en: "Tenant Power 🏠", de: "Mieterstrom 🏠" },
};

// Helper: normalize base URL
function _baseURL() {
  try {
    const b = (typeof CONFIG !== "undefined" && CONFIG.BASE_API_URL) ? CONFIG.BASE_API_URL : "";
    return b.endsWith("/") ? b.slice(0, -1) : b;
  } catch(e) { return ""; }
}

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
const chatLog = document.getElementById("chatbot-log");
const form = document.getElementById("chatbot-form");
const input = document.getElementById("chatbot-input");
const toggle = document.getElementById("modeToggle");
const typingBubble = document.getElementById("typing-bubble");
const langSwitcher = document.getElementById("langSwitcher");

// ========================
// 🧠 Load Chat History from localStorage
// ========================
let chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || [];

function loadChatHistory() {
  chatHistory.forEach(entry => {
    appendMessage(entry.message, entry.sender, false);
  });
}

window.onload = () => {
  const selectedLang = localStorage.getItem("selectedLang") || "de";
  langSwitcher.value = selectedLang;
  updateFAQ(selectedLang);
  updateUITexts("de");
  loadChatHistory();
  
  const consent = localStorage.getItem("cookieConsent");
  if (!consent) {
    document.getElementById("cookie-banner").style.display = "block";
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
    gtag('event', 'language_switch', {
      event_category: 'chatbot',
      event_label: lang
    });
  }
});

// ========================
// 📩 Form Submit Handler
// ========================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = input.value.trim();
  const selectedLang = langSwitcher.value;

  if (!question) return;

  appendMessage(question, "user");
  saveToHistory("user", question);
  input.value = "";
  typingBubble.style.display = "block";

  // Intent detection
  if (detectIntent(question)) {
    typingBubble.style.display = "none";
    return;
  }

  try {
    const res = await fetch(`${_baseURL()}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, lang: selectedLang })
    });

    const data = await res.json();
    typingBubble.style.display = "none";

    const replyRaw = data.answer ?? data.reply;
    const reply = (typeof replyRaw === "string" ? replyRaw.trim() : "");
    const fallbackMsg = selectedLang === "de"
      ? `Ich bin mir nicht sicher. Bitte <a href="https://planville.de/kontakt" target="_blank">📞 kontaktieren Sie unser Team hier</a>.`
      : `I'm not sure about that. Please <a href="https://planville.de/kontakt" target="_blank">📞 contact our team here</a>.`;

    const finalReply = reply && reply !== "" ? reply : fallbackMsg;
    appendMessage(finalReply, "bot");
    saveToHistory("bot", finalReply);

    if (typeof trackChatEvent === "function") {
      trackChatEvent(question, selectedLang);
    }
  } catch (err) {
    typingBubble.style.display = "none";
    appendMessage("Error while connecting to GPT API.", "bot");
  }
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

    if (msg.length > 100) {
      const lang = langSwitcher.value;
      const cta = document.createElement("a");
      cta.href = "https://planville.de/kontakt/";
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
// 🧠 Save Chat to localStorage
// ========================
function saveToHistory(sender, message) {
  chatHistory.push({ sender, message });
  localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
}

// ========================
// 🗑️ Reset Chat
// ========================
function resetChat() {
  localStorage.removeItem("chatHistory");
  chatHistory = [];
  chatLog.innerHTML = "";
  const productBlock = document.getElementById("product-options-block");
if (productBlock) productBlock.remove();
}

// ========================
// 📌 FAQ Updater
// ========================
function updateFAQ(lang) {
  const faqList = document.getElementById("faq-list");
  faqList.innerHTML = "";

  faqTexts[lang].forEach((text) => {
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
  document.querySelector('.chatbot-header h1').innerText =
    lang === "de" ? "Chatte mit Planville AI 🤖" : "Chat with Planville AI 🤖";

  resetChat();

  const greeting = lang === "de"
    ? "Hallo! 👋 Was kann ich für Sie tun?<br>Bitte wählen Sie ein Thema:"
    : "Hello! 👋 What can I do for you?<br>Please choose a topic:";

  appendMessage(greeting, "bot");
  
  showProductOptions(); // 
}

// ========================
// 🔘 Show Product Bubble
// ========================
function showProductOptions() {
  const lang = langSwitcher.value;
  const keys = ["pv", "aircon", "heatpump", "tenant", "roof"];

  const existing = document.getElementById("product-options-block");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.className = "product-options";
  container.id = "product-options-block";

  keys.forEach((key) => {
    const button = document.createElement("button");
    button.innerText = productLabels[key][lang];
    button.className = "product-button";
    button.dataset.key = key; // ✅ gunakan key
    button.onclick = () => handleProductSelection(key);
    container.appendChild(button);
  });

  chatLog.appendChild(container);
  chatLog.scrollTop = chatLog.scrollHeight;
}


// ========================
// 🧩 Product Click
// ========================
function handleProductSelection(key) {
  const lang = langSwitcher.value;
  const label = productLabels[key][lang];

  appendMessage(label, "user");

  if (typeof gtag !== "undefined") {
    gtag('event', 'select_product', {
      event_category: 'chatbot_interaction',
      event_label: key,
      language: lang
    });
  }

  setTimeout(() => {
    const followUp = lang === "de"
      ? `Was möchten Sie genau zu <b>${label}</b> wissen oder erreichen?`
      : `What exactly would you like to know or achieve about <b>${label}</b>?`;
    appendMessage(followUp, "bot");
  }, 500);
}

// ========================
// 🎯 Intent Detection
// ========================
function detectIntent(text) {
  const lower = text.toLowerCase();

  // Intent: Harga
  if (lower.includes("harga") || lower.includes("kosten") || lower.includes("cost")) {
    const lang = langSwitcher.value;
    const msg = lang === "de"
      ? "Die Preise für Photovoltaik beginnen bei etwa 7.000€ bis 15.000€, abhängig von Größe & Standort. Für ein genaues Angebot:"
      : "Prices for photovoltaics typically range from €7,000 to €15,000 depending on size & location. For an exact quote:";

    appendMessage(msg, "bot");

    const cta = document.createElement("a");
    cta.href = "https://planville.de/kontakt/";
    cta.target = "_blank";
    cta.className = "cta-button";
    cta.innerText = lang === "de" ? "Jetzt Preis anfragen 👉" : "Request Price 👉";
    chatLog.appendChild(cta);

    if (typeof gtag !== "undefined") {
      gtag('event', 'intent_preisinfo', {
        event_category: 'intent',
        event_label: text,
        language: lang
      });
    }
    return true;
  }

  // Intent: Tertarik
  if (lower.includes("tertarik") || lower.includes("interested")) {
    const lang = langSwitcher.value;
    const msg = lang === "de"
      ? "Super! Bitte füllen Sie dieses kurze Formular aus:"
      : "Great! Please fill out this short form:";

    appendMessage(msg, "bot");
    injectLeadMiniForm();
    return true;
  }

  return false;
}

// ========================
// 🧾 Form Mini Wizard
// ========================
function injectLeadMiniForm() {
  const lang = langSwitcher.value;
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
    const name = document.getElementById("leadName").value;
    const email = document.getElementById("leadEmail").value;

    // ✅ Validasi Email Sederhana
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
      gtag('event', 'mini_form_submit', {
        event_category: 'leadform',
        event_label: email
      });
    }
  });
}
