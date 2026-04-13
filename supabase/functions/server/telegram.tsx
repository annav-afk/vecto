import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

const telegram = new Hono();

// ── Helpers ───────────────────────────────────────────────────────────────────
function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function requireUser(authHeader: string | undefined) {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

const TG_API = "https://api.telegram.org/bot";

function getTelegramToken(): string {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) throw { message: "TELEGRAM_BOT_TOKEN not configured", code: "telegram_not_configured" };
  return token;
}

async function tgCall(method: string, body: object) {
  const token = getTelegramToken();
  const res = await fetch(`${TG_API}${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    console.log(`Telegram API error [${method}]: ${JSON.stringify(data)}`);
    throw { message: `Telegram ${method} failed: ${data.description}`, code: "telegram_error" };
  }
  return data.result;
}

// ── Generate link code ────────────────────────────────────────────────────────
telegram.post("/telegram/link", async (c) => {
  try {
    const user = await requireUser(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await kv.set(`tg_link_code:${code}`, JSON.stringify({ userId: user.id, createdAt: Date.now() }));
    await kv.set(`tg_pending:${user.id}`, code);

    console.log(`Telegram link code generated for user ${user.id}: ${code}`);
    return c.json({ code });
  } catch (err: any) {
    console.log(`Telegram link error: ${err}`);
    return c.json({ error: `Failed to generate link code: ${err.message || err}` }, 500);
  }
});

// ── Check link status ─────────────────────────────────────────────────────────
telegram.get("/telegram/status", async (c) => {
  try {
    const user = await requireUser(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const raw = await kv.get(`tg_user:${user.id}`);
    if (!raw) return c.json({ linked: false });

    const info = JSON.parse(raw);
    return c.json({ linked: true, chatId: info.chatId, username: info.username || null, firstName: info.firstName || null, linkedAt: info.linkedAt });
  } catch (err: any) {
    console.log(`Telegram status error: ${err}`);
    return c.json({ error: `${err.message || err}` }, 500);
  }
});

// ── Unlink ────────────────────────────────────────────────────────────────────
telegram.post("/telegram/unlink", async (c) => {
  try {
    const user = await requireUser(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    await kv.del(`tg_user:${user.id}`);
    console.log(`Telegram unlinked for user ${user.id}`);
    return c.json({ ok: true });
  } catch (err: any) {
    console.log(`Telegram unlink error: ${err}`);
    return c.json({ error: `${err.message || err}` }, 500);
  }
});

// ── Webhook ───────────────────────────────────────────────────────────────────
telegram.post("/telegram/webhook", async (c) => {
  try {
    const update = await c.req.json();
    const msg = update?.message;
    if (!msg?.text || !msg?.chat?.id) return c.json({ ok: true });

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const firstName = msg.from?.first_name || "";
    const username = msg.from?.username || "";

    console.log(`Telegram webhook: chatId=${chatId}, text="${text}", from=${username}`);

    if (text === "/start") {
      await tgCall("sendMessage", {
        chat_id: chatId,
        text: `Привет${firstName ? `, ${firstName}` : ""}! Я Томи — твой AI-ассистент из Vecto.\n\nЧтобы привязать аккаунт, отправь мне 6-значный код из настроек профиля.\n\nПосле привязки я буду отправлять уведомления о рисках и важных событиях прямо сюда.`,
        parse_mode: "HTML",
      });
      return c.json({ ok: true });
    }

    if (text === "/status") {
      const users = await kv.getByPrefix("tg_user:");
      const linked = users.find((u: any) => { try { return JSON.parse(u).chatId === chatId; } catch { return false; } });
      await tgCall("sendMessage", {
        chat_id: chatId,
        text: linked ? "Аккаунт привязан. Уведомления активны." : "Аккаунт не привязан. Отправь 6-значный код из настроек профиля Vecto.",
      });
      return c.json({ ok: true });
    }

    if (text === "/help") {
      await tgCall("sendMessage", { chat_id: chatId, text: "Команды:\n/start — Начало\n/status — Статус привязки\n/help — Помощь\n\nОтправь 6-значный код для привязки аккаунта." });
      return c.json({ ok: true });
    }

    if (/^\d{6}$/.test(text)) {
      const codeData = await kv.get(`tg_link_code:${text}`);
      if (!codeData) {
        await tgCall("sendMessage", { chat_id: chatId, text: "Код не найден или истёк. Сгенерируй новый в настройках профиля Vecto." });
        return c.json({ ok: true });
      }

      const { userId, createdAt } = JSON.parse(codeData);
      if (Date.now() - createdAt > 10 * 60 * 1000) {
        await kv.del(`tg_link_code:${text}`);
        await tgCall("sendMessage", { chat_id: chatId, text: "Код истёк (10 минут). Сгенерируй новый в настройках профиля Vecto." });
        return c.json({ ok: true });
      }

      await kv.set(`tg_user:${userId}`, JSON.stringify({ chatId, username, firstName, linkedAt: new Date().toISOString() }));
      await kv.del(`tg_link_code:${text}`);
      await kv.del(`tg_pending:${userId}`);

      await tgCall("sendMessage", {
        chat_id: chatId,
        text: `Аккаунт успешно привязан! ${firstName ? firstName + ", " : ""}теперь я буду отправлять уведомления сюда.\n\nТоми следит за твоей продуктивностью и предупредит о рисках.`,
      });

      console.log(`Telegram linked: userId=${userId}, chatId=${chatId}`);
      return c.json({ ok: true });
    }

    await tgCall("sendMessage", { chat_id: chatId, text: "Отправь 6-значный код для привязки или используй /help." });
    return c.json({ ok: true });
  } catch (err: any) {
    console.log(`Telegram webhook error: ${err}`);
    return c.json({ ok: true });
  }
});

// ── Send notification ─────────────────────────────────────────────────────────
telegram.post("/telegram/send", async (c) => {
  try {
    const user = await requireUser(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { message, type } = await c.req.json();
    const raw = await kv.get(`tg_user:${user.id}`);
    if (!raw) return c.json({ error: "Telegram not linked" }, 400);

    const { chatId } = JSON.parse(raw);
    const typeEmoji: Record<string, string> = {
      risk_critical: "🚨", risk_high: "⚠️", risk_medium: "💡",
      streak: "🔥", achievement: "🏆", reminder: "⏰", test: "🔔",
    };
    const emoji = typeEmoji[type] || "📩";
    await tgCall("sendMessage", { chat_id: chatId, text: `${emoji} <b>Томи</b>\n\n${message}`, parse_mode: "HTML" });

    console.log(`Telegram notification sent to user ${user.id}, type=${type}`);
    return c.json({ ok: true });
  } catch (err: any) {
    console.log(`Telegram send error: ${err}`);
    const code = err?.code;
    if (code === "telegram_not_configured") return c.json({ error: err.message, code }, 503);
    return c.json({ error: `${err.message || err}` }, 500);
  }
});

// ── Risk notification ─────────────────────────────────────────────────────────
telegram.post("/telegram/risk-notify", async (c) => {
  try {
    const user = await requireUser(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { riskLevel, reasons, streak } = await c.req.json();
    const raw = await kv.get(`tg_user:${user.id}`);
    if (!raw) return c.json({ sent: false, reason: "not_linked" });

    const { chatId, firstName } = JSON.parse(raw);
    const lastKey = `tg_last_notif:${user.id}`;
    const lastNotif = await kv.get(lastKey);
    if (lastNotif && Date.now() - Number(lastNotif) < 4 * 60 * 60 * 1000) {
      return c.json({ sent: false, reason: "rate_limited" });
    }

    const name = firstName || "друг";
    let msgText = "";

    if (riskLevel === "critical") {
      msgText = `🚨 <b>Внимание, ${name}!</b>\n\nТоми заметил тревожные сигналы:\n${reasons.map((r: string) => `• ${r}`).join("\n")}\n\nЗайди в Vecto — я помогу упростить план.`;
    } else if (riskLevel === "high") {
      msgText = `⚠️ <b>Мини-чекин от Томи</b>\n\n${name}, несколько сигналов указывают на спад:\n${reasons.map((r: string) => `• ${r}`).join("\n")}\n\nДавай посмотрим, что можно облегчить.`;
    } else if (streak && streak > 3) {
      msgText = `🔥 <b>Стрик в опасности!</b>\n\n${name}, у тебя серия ${streak} дней, но сегодня ещё нет завершённых задач.`;
    } else {
      msgText = `💡 <b>Напоминание от Томи</b>\n\nМаленький шаг лучше, чем стоять на месте. Попробуй завершить хотя бы одну задачу.`;
    }

    await tgCall("sendMessage", { chat_id: chatId, text: msgText, parse_mode: "HTML" });
    await kv.set(lastKey, String(Date.now()));

    console.log(`Telegram risk notification: user=${user.id}, level=${riskLevel}`);
    return c.json({ sent: true });
  } catch (err: any) {
    console.log(`Telegram risk-notify error: ${err}`);
    return c.json({ sent: false, reason: `error: ${err.message || err}` });
  }
});

export { telegram };
