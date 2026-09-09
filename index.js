require("dotenv").config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const P = require("pino");
const qrcode = require("qrcode-terminal");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";
const BOT_NAME = process.env.BOT_NAME || "Asisten AI";
let AI_ENABLED = String(process.env.AI_ENABLED || "true").toLowerCase() === "true";
const AI_PREFIX = process.env.AI_PREFIX || "";
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ||
  "Kamu adalah asisten WhatsApp yang ramah, sopan, singkat, dan membantu. Balas dalam bahasa yang digunakan pengguna.";

if (!OPENAI_API_KEY || OPENAI_API_KEY === "ISI_API_KEY_DI_SINI") {
  console.error("OPENAI_API_KEY belum diisi di file .env");
  process.exit(1);
}

const conversations = new Map();

function getConversation(jid) {
  if (!conversations.has(jid)) conversations.set(jid, []);
  return conversations.get(jid);
}

function getMessageText(msg) {
  const m = msg?.message;
  if (!m) return "";
  return (m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    "").trim();
}

async function askAI(jid, userMessage) {
  const history = getConversation(jid);
  history.push({ role: "user", content: userMessage });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.slice(-12)
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const answer = data?.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("AI tidak memberikan jawaban.");

  history.push({ role: "assistant", content: answer });
  return answer;
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");
  const { version } = await fetchLatestBaileysVersion();

  console.log(`\n${BOT_NAME} sedang dijalankan...`);
  console.log(`AI: ${AI_ENABLED ? "ON" : "OFF"}`);
  console.log(`Prefix: ${AI_PREFIX || "(semua pesan)"}`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
    browser: [BOT_NAME, "Chrome", "1.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("\nScan QR ini dari WhatsApp > Perangkat tertaut:\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("\nWhatsApp berhasil terhubung. Bot aktif.");
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      const reconnect = code !== DisconnectReason.loggedOut;
      console.log(`Koneksi terputus. Reconnect: ${reconnect}`);
      if (reconnect) setTimeout(startBot, 3000);
      else console.log("Session logout. Hapus folder session/ untuk login ulang.");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue;

        const jid = msg.key.remoteJid;
        if (!jid || jid === "status@broadcast") continue;

        const text = getMessageText(msg);
        if (!text) continue;

        console.log(`Pesan dari ${jid}: ${text}`);

        const command = text.toLowerCase();

        if (command === "/help") {
          await sock.sendMessage(jid, {
            text: `*${BOT_NAME}*\n\n/ai on - aktifkan AI\n/ai off - matikan AI\n/reset - reset percakapan\n/help - bantuan`
          });
          continue;
        }

        if (command === "/ai on") {
          AI_ENABLED = true;
          await sock.sendMessage(jid, { text: "AI auto-reply aktif." });
          continue;
        }

        if (command === "/ai off") {
          AI_ENABLED = false;
          await sock.sendMessage(jid, { text: "AI auto-reply nonaktif." });
          continue;
        }

        if (command === "/reset") {
          conversations.delete(jid);
          await sock.sendMessage(jid, { text: "Riwayat percakapan direset." });
          continue;
        }

        if (!AI_ENABLED) continue;

        let prompt = text;
        if (AI_PREFIX) {
          if (!text.toLowerCase().startsWith(AI_PREFIX.toLowerCase())) continue;
          prompt = text.slice(AI_PREFIX.length).trim();
          if (!prompt) continue;
        }

        await sock.sendPresenceUpdate("composing", jid);
        const answer = await askAI(jid, prompt);
        await sock.sendMessage(jid, { text: answer });
        await sock.sendPresenceUpdate("paused", jid);
      } catch (err) {
        console.error("Error:", err.message);
      }
    }
  });
}

process.on("uncaughtException", err => console.error("Uncaught:", err));
process.on("unhandledRejection", err => console.error("Unhandled:", err));

startBot();
