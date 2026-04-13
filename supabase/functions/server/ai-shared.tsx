/**
 * Shared AI utilities — single source of truth for OpenAI calls and auth.
 * Used by ai.tsx and ai2.tsx to eliminate code duplication.
 */
import { createClient } from "npm:@supabase/supabase-js";

export const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
export const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY_2") || Deno.env.get("OPENAI_API_KEY") || "";

/**
 * Call OpenAI Chat Completions with JSON response format.
 */
export async function callOpenAI(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}): Promise<any> {
  const res = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: opts.model ?? "gpt-4o-mini",
      messages: [{ role: "system", content: opts.system }, { role: "user", content: opts.user }],
      temperature: opts.temperature ?? 0.5,
      max_tokens: opts.maxTokens ?? 600,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.log(`OpenAI error ${res.status}: ${errText}`);
    if (res.status === 429) throw Object.assign(new Error("AI rate limited"), { code: "rate_limited" });
    if (res.status === 402 || errText.includes("insufficient_quota")) throw Object.assign(new Error("AI quota exceeded"), { code: "quota_exceeded" });
    throw new Error(`AI request failed: ${res.status}`);
  }
  const completion = await res.json();
  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Empty AI response");
  try { return JSON.parse(raw); } catch {
    console.log(`Failed to parse AI JSON: ${raw.slice(0, 300)}`);
    throw Object.assign(new Error("AI returned invalid JSON"), { code: "parse_error" });
  }
}

/**
 * Try to extract authenticated user from Authorization header.
 * Returns user object or null (does NOT block — caller decides policy).
 */
export async function tryGetUser(authHeader: string | undefined) {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  // Skip if it looks like the anon key (not a JWT)
  if (!token.includes(".")) return null;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    return user;
  } catch {
    return null;
  }
}