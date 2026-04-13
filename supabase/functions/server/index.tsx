import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";
import { telegram } from "./telegram.tsx";
import { ai } from "./ai.tsx";
import { ai2 } from "./ai2.tsx";

const app = new Hono();
app.use('*', logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization", "X-Admin-Token"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

async function requireUser(authHeader: string | undefined) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/make-server-a5927615/health", (c) => c.json({ status: "ok", ts: Date.now() }));

// ── Digest: Email (uses Resend) ───────────────────────────────────────────────
app.post("/make-server-a5927615/digest/email", async (c) => {
  try {
    const { email, planGoal, doneCount, overdueCount, forecastDate, totalHours } = await c.req.json();
    if (!email) return c.json({ error: "Email required" }, 400);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.log("RESEND_API_KEY not set — email digest skipped");
      return c.json({ error: "Email service not configured", code: "not_configured" }, 503);
    }

    const html = `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1d4ed8;margin:0 0 16px">⚡ Vecto — Еженедельный дайджест</h2>
        <p style="color:#334155;font-size:14px"><strong>Цель:</strong> ${planGoal}</p>
        <div style="background:#f8fafc;border-radius:12px;padding:16px;margin:16px 0">
          <p style="margin:4px 0;font-size:14px;color:#334155">✅ Выполнено: <strong>${doneCount}</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#334155">⚠️ Просрочено: <strong>${overdueCount}</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#334155">⏱ Часов: <strong>${totalHours}ч</strong></p>
          ${forecastDate ? `<p style="margin:4px 0;font-size:14px;color:#334155">📅 Прогноз: <strong>${forecastDate}</strong></p>` : ""}
        </div>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">Отправлено из Vecto AI Planner</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "Vecto <onboarding@resend.dev>",
        to: [email],
        subject: `⚡ Vecto Дайджест: ${planGoal?.slice(0, 40)}`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.log(`Resend error ${res.status}: ${errText}`);
      return c.json({ error: "Failed to send email" }, 502);
    }

    console.log(`Digest email sent to ${email}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`Digest email error: ${err}`);
    return c.json({ error: `Email failed: ${err}` }, 500);
  }
});

// ── Auth: Sign Up ────────────────────────────────────────────────────────────
app.post("/make-server-a5927615/auth/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    if (!email || !password) return c.json({ error: "Email and password are required" }, 400);

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name: name || '' },
      // Automatically confirm email since no email server configured
      email_confirm: true,
    });
    if (error) {
      console.log(`Sign up error: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }
    console.log(`User created: ${data.user?.id}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`Sign up exception: ${err}`);
    return c.json({ error: `Sign up failed: ${err}` }, 500);
  }
});

// ── Plans: Get all ────────────────────────────────────────────────────────────
app.get("/make-server-a5927615/plans", async (c) => {
  try {
    const user = await requireUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const prefix = `user:${user.id}:plan:`;
    const rawPlans = await kv.getByPrefix(prefix);
    const plans = rawPlans
      .filter(Boolean)
      .map(raw => { try { return JSON.parse(raw as string); } catch { return null; } })
      .filter(Boolean);

    return c.json({ plans });
  } catch (err) {
    console.log(`Get plans error: ${err}`);
    return c.json({ error: `Failed to get plans: ${err}` }, 500);
  }
});

// ── Plans: Save / Update ──────────────────────────────────────────────────────
app.post("/make-server-a5927615/plans", async (c) => {
  try {
    const user = await requireUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { plan } = await c.req.json();
    if (!plan?.id) return c.json({ error: "Invalid plan data" }, 400);

    await kv.set(`user:${user.id}:plan:${plan.id}`, JSON.stringify(plan));
    console.log(`Plan saved: ${plan.id} for user ${user.id}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`Save plan error: ${err}`);
    return c.json({ error: `Failed to save plan: ${err}` }, 500);
  }
});

// ── Plans: Delete ─────────────────────────────────────────────────────────────
app.delete("/make-server-a5927615/plans/:id", async (c) => {
  try {
    const user = await requireUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const planId = c.req.param("id");
    await kv.del(`user:${user.id}:plan:${planId}`);
    console.log(`Plan deleted: ${planId} for user ${user.id}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`Delete plan error: ${err}`);
    return c.json({ error: `Failed to delete plan: ${err}` }, 500);
  }
});

// ── Usage: Get ────────────────────────────────────────────────────────────────
app.get("/make-server-a5927615/usage", async (c) => {
  try {
    const user = await requireUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const month = new Date().toISOString().slice(0, 7);
    const raw = await kv.get(`user:${user.id}:usage:${month}`);
    return c.json({ count: raw ? Number(raw) : 0 });
  } catch (err) {
    console.log(`Get usage error: ${err}`);
    return c.json({ error: `Failed to get usage: ${err}` }, 500);
  }
});

// ── Usage: Increment ──────────────────────────────────────────────────────────
app.post("/make-server-a5927615/usage/increment", async (c) => {
  try {
    const user = await requireUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const month = new Date().toISOString().slice(0, 7);
    const key = `user:${user.id}:usage:${month}`;
    // Retry loop to mitigate race condition on concurrent increments
    let count = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      const raw = await kv.get(key);
      const prev = raw ? Number(raw) : 0;
      count = prev + 1;
      await kv.set(key, String(count));
      // Verify write succeeded with expected value
      const verify = await kv.get(key);
      if (verify && Number(verify) >= count) break;
      // If another writer incremented concurrently, retry
    }
    return c.json({ count });
  } catch (err) {
    console.log(`Increment usage error: ${err}`);
    return c.json({ error: `Failed to increment usage: ${err}` }, 500);
  }
});

// ── Share plan: create ────────────────────────────────────────────────────────
app.post("/make-server-a5927615/share", async (c) => {
  try {
    const { plan } = await c.req.json();
    if (!plan?.id) return c.json({ error: "Invalid plan data" }, 400);

    const shareId = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map(b => b.toString(36).padStart(2, '0'))
      .join('')
      .slice(0, 8);

    await kv.set(`share:${shareId}`, JSON.stringify({ plan, sharedAt: new Date().toISOString() }));
    console.log(`Share created: ${shareId} for plan ${plan.id}`);
    return c.json({ shareId });
  } catch (err) {
    console.log(`Create share error: ${err}`);
    return c.json({ error: `Failed to create share: ${err}` }, 500);
  }
});

// ── Share plan: read ──────────────────────────────────────────────────────────
app.get("/make-server-a5927615/share/:shareId", async (c) => {
  try {
    const shareId = c.req.param("shareId");
    const raw = await kv.get(`share:${shareId}`);
    if (!raw) return c.json({ error: "Shared plan not found" }, 404);

    const data = JSON.parse(raw as string);
    return c.json({ plan: data.plan, sharedAt: data.sharedAt });
  } catch (err) {
    console.log(`Get share error: ${err}`);
    return c.json({ error: `Failed to fetch share: ${err}` }, 500);
  }
});

// ── Share: Add peer feedback comment ─────────────────────────────────────────
app.post("/make-server-a5927615/share/:shareId/comments", async (c) => {
  try {
    const shareId = c.req.param("shareId");
    const { text, author, targetId, targetType } = await c.req.json();
    if (!text) return c.json({ error: 'Text required' }, 400);

    const key = `share:${shareId}:comments`;
    const existing = await kv.get(key);
    const comments = existing ? JSON.parse(existing as string) : [];
    const comment = {
      id: crypto.randomUUID(),
      text,
      author: author || 'Аноним',
      targetId: targetId || null,
      targetType: targetType || 'plan',
      created_at: new Date().toISOString(),
    };
    comments.push(comment);
    await kv.set(key, JSON.stringify(comments));
    return c.json({ comment });
  } catch (err) {
    console.log(`Add share comment error: ${err}`);
    return c.json({ error: `Failed to add comment: ${err}` }, 500);
  }
});

// ── Share: Get peer feedback comments ────────────────────────────────────────
app.get("/make-server-a5927615/share/:shareId/comments", async (c) => {
  try {
    const shareId = c.req.param("shareId");
    const raw = await kv.get(`share:${shareId}:comments`);
    const comments = raw ? JSON.parse(raw as string) : [];
    return c.json({ comments });
  } catch (err) {
    console.log(`Get share comments error: ${err}`);
    return c.json({ error: `Failed to get comments: ${err}` }, 500);
  }
});

// ── Profile: Get user profile + stats ─────────────────────────────────────────
app.get("/make-server-a5927615/profile", async (c) => {
  try {
    const user = await requireUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const prefix = `user:${user.id}:plan:`;
    const rawPlans = await kv.getByPrefix(prefix);
    const plans = rawPlans
      .filter(Boolean)
      .map((raw) => { try { return JSON.parse(raw as string); } catch { return null; } })
      .filter(Boolean);

    const totalTasks = plans.flatMap((p: any) => p.phases?.flatMap((ph: any) => ph.tasks) ?? []);
    const doneTasks = totalTasks.filter((t: any) => t.status === 'done');
    const activePlans = plans.filter((p: any) => {
      const allT = p.phases?.flatMap((ph: any) => ph.tasks) ?? [];
      const done = allT.filter((t: any) => t.status === 'done').length;
      return done < allT.length;
    });

    const month = new Date().toISOString().slice(0, 7);
    const usageRaw = await kv.get(`user:${user.id}:usage:${month}`);

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || '',
        created_at: user.created_at,
      },
      stats: {
        totalPlans: plans.length,
        activePlans: activePlans.length,
        totalTasks: totalTasks.length,
        doneTasks: doneTasks.length,
        usageThisMonth: usageRaw ? Number(usageRaw) : 0,
      },
    });
  } catch (err) {
    console.log(`Get profile error: ${err}`);
    return c.json({ error: `Failed to get profile: ${err}` }, 500);
  }
});

// ── Profile: Update display name ───────────────────────────────────────────────
app.put("/make-server-a5927615/profile", async (c) => {
  try {
    const user = await requireUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { name } = await c.req.json();
    if (!name?.trim()) return c.json({ error: "Name is required" }, 400);

    const supabase = getSupabase();
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, name: name.trim() },
    });
    if (error) {
      console.log(`Update profile error: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }
    console.log(`Profile updated for user ${user.id}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`Update profile exception: ${err}`);
    return c.json({ error: `Failed to update profile: ${err}` }, 500);
  }
});

// ── Admin: Verify password ─────────────────────────────────────────────────────
const ADMIN_PASSWORD = Deno.env.get("VECTO_ADMIN_PASSWORD") || "admin";
const ADMIN_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

app.post("/make-server-a5927615/admin/verify", async (c) => {
  try {
    const { password } = await c.req.json();
    if (password !== ADMIN_PASSWORD) {
      return c.json({ error: "Неверный пароль" }, 401);
    }
    const expires = Date.now() + ADMIN_TOKEN_TTL_MS;
    const payload = JSON.stringify({ role: "admin", exp: expires });
    const token = btoa(payload);
    return c.json({ token });
  } catch (err) {
    console.log(`Admin verify error: ${err}`);
    return c.json({ error: `Verification failed: ${err}` }, 500);
  }
});

function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const decoded = atob(token);
    const payload = JSON.parse(decoded);
    if (payload.role !== "admin") return false;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

// ── Admin: Get all users ─���─────────────────────────────────────────────────────
app.get("/make-server-a5927615/admin/users", async (c) => {
  try {
    const token = c.req.header('X-Admin-Token');
    if (!verifyAdminToken(token)) return c.json({ error: "Unauthorized" }, 401);

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (error) {
      console.log(`Admin list users error: ${error.message}`);
      return c.json({ error: error.message }, 500);
    }

    const enriched = await Promise.all(data.users.map(async (u) => {
      try {
        const rawPlans = await kv.getByPrefix(`user:${u.id}:plan:`);
        const plans = rawPlans
          .filter(Boolean)
          .map((r) => { try { return JSON.parse(r as string); } catch { return null; } })
          .filter(Boolean);
        const allTasks = plans.flatMap((p: any) => p.phases?.flatMap((ph: any) => ph.tasks) ?? []);
        const month = new Date().toISOString().slice(0, 7);
        const usageRaw = await kv.get(`user:${u.id}:usage:${month}`);
        return {
          id: u.id,
          email: u.email,
          name: u.user_metadata?.name || '',
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          banned_until: u.banned_until || null,
          plans: plans.length,
          tasks: allTasks.length,
          doneTasks: allTasks.filter((t: any) => t.status === 'done').length,
          usageThisMonth: usageRaw ? Number(usageRaw) : 0,
        };
      } catch {
        return {
          id: u.id,
          email: u.email,
          name: u.user_metadata?.name || '',
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          banned_until: u.banned_until || null,
          plans: 0, tasks: 0, doneTasks: 0, usageThisMonth: 0,
        };
      }
    }));

    return c.json({ users: enriched, total: enriched.length });
  } catch (err) {
    console.log(`Admin get users error: ${err}`);
    return c.json({ error: `Failed to get users: ${err}` }, 500);
  }
});

// ── Admin: Get global stats ────────────────────────────────────────────────────
app.get("/make-server-a5927615/admin/stats", async (c) => {
  try {
    const token = c.req.header('X-Admin-Token');
    if (!verifyAdminToken(token)) return c.json({ error: "Unauthorized" }, 401);

    const supabase = getSupabase();
    const { data: usersData, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return c.json({ error: error.message }, 500);

    const totalUsers = usersData.users.length;
    const month = new Date().toISOString().slice(0, 7);

    let activeThisMonth = 0;
    let totalPlansAll = 0;
    let totalTasksAll = 0;
    let doneTasksAll = 0;

    for (const u of usersData.users.slice(0, 50)) {
      try {
        const usageRaw = await kv.get(`user:${u.id}:usage:${month}`);
        if (usageRaw && Number(usageRaw) > 0) activeThisMonth++;
        const rawPlans = await kv.getByPrefix(`user:${u.id}:plan:`);
        const plans = rawPlans
          .filter(Boolean)
          .map((r) => { try { return JSON.parse(r as string); } catch { return null; } })
          .filter(Boolean);
        totalPlansAll += plans.length;
        const allTasks = plans.flatMap((p: any) => p.phases?.flatMap((ph: any) => ph.tasks) ?? []);
        totalTasksAll += allTasks.length;
        doneTasksAll += allTasks.filter((t: any) => t.status === 'done').length;
      } catch { /* skip */ }
    }

    return c.json({
      totalUsers,
      activeThisMonth,
      totalPlans: totalPlansAll,
      totalTasks: totalTasksAll,
      doneTasks: doneTasksAll,
      completionRate: totalTasksAll > 0 ? Math.round((doneTasksAll / totalTasksAll) * 100) : 0,
    });
  } catch (err) {
    console.log(`Admin stats error: ${err}`);
    return c.json({ error: `Failed to get stats: ${err}` }, 500);
  }
});

// ── Admin: Delete user ─────────────────────────────────────────────────────────
app.delete("/make-server-a5927615/admin/users/:userId", async (c) => {
  try {
    const token = c.req.header('X-Admin-Token');
    if (!verifyAdminToken(token)) return c.json({ error: "Unauthorized" }, 401);

    const userId = c.req.param("userId");
    const supabase = getSupabase();
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.log(`Admin delete user error: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }
    // Clean up all user data from KV store
    const keysToDelete: string[] = [];
    // Plans
    const planValues = await kv.getByPrefix(`user:${userId}:plan:`);
    for (const val of planValues) {
      try {
        const plan = JSON.parse(val as string);
        if (plan?.id) keysToDelete.push(`user:${userId}:plan:${plan.id}`);
      } catch {}
    }
    // Data categories
    const dataCategories = ['activity', 'settings', 'chat_history', 'onboarding', 'mood_journal', 'gamification', 'patterns', 'plan_feedbacks'];
    for (const dk of dataCategories) keysToDelete.push(`user:${userId}:data:${dk}`);
    // Usage, telegram, tier
    keysToDelete.push(`user:${userId}:usage:${new Date().toISOString().slice(0, 7)}`);
    keysToDelete.push(`tg_user:${userId}`);
    keysToDelete.push(`plan_tier:${userId}`);
    if (keysToDelete.length > 0) {
      await kv.mdel(keysToDelete);
      console.log(`Cleaned up ${keysToDelete.length} KV keys for user ${userId}`);
    }
    console.log(`Admin deleted user ${userId}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`Admin delete user exception: ${err}`);
    return c.json({ error: `Failed to delete user: ${err}` }, 500);
  }
});

// ── User: Get own plan tier ───────────────────────────────────────────────────
app.get("/make-server-a5927615/user/tier", async (c) => {
  try {
    const user = await requireUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const tier = await kv.get(`plan_tier:${user.id}`);
    console.log(`Get tier for user ${user.id}: ${tier || 'free'}`);
    return c.json({ tier: tier || 'free' });
  } catch (err) {
    console.log(`Get tier error: ${err}`);
    return c.json({ error: `Failed to get tier: ${err}` }, 500);
  }
});

// ── User Data: Generic per-user data store ────────────────────────────────────
const ALLOWED_DATA_KEYS = [
  'activity',       // heatmap data
  'settings',       // sound, TTS, personality, preferences
  'chat_history',   // Tomi conversations
  'onboarding',     // onboarding progress, tour flags
  'mood_journal',   // mood entries
  'gamification',   // XP, level, achievements
  'patterns',       // behaviour patterns (Tomi-клон)
  'plan_feedbacks', // plan feedback aggregates
];

// GET all categories at once (for initial sync on login) — must be before :key route
app.get("/make-server-a5927615/user/data", async (c) => {
  try {
    const user = await requireUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const results: Record<string, any> = {};
    for (const key of ALLOWED_DATA_KEYS) {
      try {
        const raw = await kv.get(`user:${user.id}:data:${key}`);
        results[key] = raw ? JSON.parse(raw as string) : null;
      } catch { results[key] = null; }
    }
    return c.json({ data: results });
  } catch (err) {
    console.log(`Get all user data error: ${err}`);
    return c.json({ error: `Failed to get all user data: ${err}` }, 500);
  }
});

// GET single category
app.get("/make-server-a5927615/user/data/:key", async (c) => {
  try {
    const user = await requireUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const key = c.req.param("key");
    if (!ALLOWED_DATA_KEYS.includes(key)) return c.json({ error: `Invalid data key: ${key}` }, 400);
    const raw = await kv.get(`user:${user.id}:data:${key}`);
    return c.json({ key, value: raw ? JSON.parse(raw as string) : null });
  } catch (err) {
    console.log(`Get user data error: ${err}`);
    return c.json({ error: `Failed to get user data: ${err}` }, 500);
  }
});

// PUT single category
app.put("/make-server-a5927615/user/data/:key", async (c) => {
  try {
    const user = await requireUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const key = c.req.param("key");
    if (!ALLOWED_DATA_KEYS.includes(key)) return c.json({ error: `Invalid data key: ${key}` }, 400);
    const { value } = await c.req.json();
    if (value === undefined) return c.json({ error: "value is required" }, 400);
    await kv.set(`user:${user.id}:data:${key}`, JSON.stringify(value));
    console.log(`User data saved: ${key} for user ${user.id} (${JSON.stringify(value).length} bytes)`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`Save user data error: ${err}`);
    return c.json({ error: `Failed to save user data: ${err}` }, 500);
  }
});

// ── Admin: Set user tier ──────────────────────────────────────────────────────
app.post("/make-server-a5927615/admin/set-tier", async (c) => {
  try {
    const token = c.req.header('X-Admin-Token');
    if (!verifyAdminToken(token)) return c.json({ error: "Unauthorized" }, 401);
    const { userId, tier } = await c.req.json();
    if (!['free', 'medium', 'pro'].includes(tier)) {
      return c.json({ error: "Invalid tier. Must be free | medium | pro" }, 400);
    }
    await kv.set(`plan_tier:${userId}`, tier);
    console.log(`Admin set tier for user ${userId}: ${tier}`);
    return c.json({ success: true, tier });
  } catch (err) {
    console.log(`Admin set tier error: ${err}`);
    return c.json({ error: `Failed to set tier: ${err}` }, 500);
  }
});

// ── Admin: Get single user tier ───────────────────────────────────────────────
app.get("/make-server-a5927615/admin/user-tier/:userId", async (c) => {
  try {
    const token = c.req.header('X-Admin-Token');
    if (!verifyAdminToken(token)) return c.json({ error: "Unauthorized" }, 401);
    const userId = c.req.param("userId");
    const tier = await kv.get(`plan_tier:${userId}`);
    return c.json({ tier: tier || 'free' });
  } catch (err) {
    console.log(`Get user tier error: ${err}`);
    return c.json({ error: `Failed: ${err}` }, 500);
  }
});

// ── Admin: Toggle user ban ─────────────────────────────────────────────────────
app.post("/make-server-a5927615/admin/ban-user", async (c) => {
  try {
    const token = c.req.header('X-Admin-Token');
    if (!verifyAdminToken(token)) return c.json({ error: "Unauthorized" }, 401);
    const { userId, banned } = await c.req.json();
    if (!userId || typeof banned !== 'boolean') {
      return c.json({ error: "userId and banned (bool) are required" }, 400);
    }
    const supabase = getSupabase();
    if (banned) {
      const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
      if (error) return c.json({ error: `Ban failed: ${error.message}` }, 500);
    } else {
      const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: 'none' });
      if (error) return c.json({ error: `Unban failed: ${error.message}` }, 500);
    }
    console.log(`Admin ${banned ? 'banned' : 'unbanned'} user ${userId}`);
    return c.json({ success: true, banned });
  } catch (err) {
    console.log(`Admin ban-user error: ${err}`);
    return c.json({ error: `Failed: ${err}` }, 500);
  }
});

// ── Admin: Update user email or password ──────────────────────────────────────
app.post("/make-server-a5927615/admin/update-user", async (c) => {
  try {
    const token = c.req.header('X-Admin-Token');
    if (!verifyAdminToken(token)) return c.json({ error: "Unauthorized" }, 401);
    const { userId, email, password } = await c.req.json();
    if (!userId) return c.json({ error: "userId is required" }, 400);
    if (!email && !password) return c.json({ error: "email or password is required" }, 400);

    const supabase = getSupabase();
    const updates: Record<string, any> = {};
    if (email) updates.email = email;
    if (password) updates.password = password;
    if (email) updates.email_confirm = true;

    const { data, error } = await supabase.auth.admin.updateUserById(userId, updates);
    if (error) {
      console.log(`Admin update-user error for ${userId}: ${error.message}`);
      return c.json({ error: `Update failed: ${error.message}` }, 500);
    }
    console.log(`Admin updated user ${userId}: ${email ? 'email=' + email : ''} ${password ? 'password=***' : ''}`);
    return c.json({ success: true, user: { id: data.user.id, email: data.user.email } });
  } catch (err) {
    console.log(`Admin update-user exception: ${err}`);
    return c.json({ error: `Failed: ${err}` }, 500);
  }
});

// ── AI Routes (in ./ai.tsx) ────────────────────────────────────────���──────────
app.route("/make-server-a5927615", ai);

// ── AI Routes Part 2 (in ./ai2.tsx) ─────────────────────────────────────────
app.route("/make-server-a5927615", ai2);

// ── Telegram Bot Integration (routes in ./telegram.tsx) ───────────────────────
app.route("/make-server-a5927615", telegram);

Deno.serve(app.fetch);