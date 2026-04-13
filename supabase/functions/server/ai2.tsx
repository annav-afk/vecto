import { Hono } from "npm:hono";
import { callOpenAI, tryGetUser } from "./ai-shared.tsx";

const ai2 = new Hono();

// ── Soft auth middleware — log user but allow demo/anon access ─────────────────
ai2.use("/*", async (c, next) => {
  const user = await tryGetUser(c.req.header("Authorization"));
  if (user) c.set("userId" as any, user.id);
  await next();
});

// ── Expand Phase ──────────────────────────────────────────────────────────────
ai2.post("/ai/expand-phase", async (c) => {
  try {
    const { goal, phaseName, existingTasks, deadline, hoursPerWeek } = await c.req.json();
    const data = await callOpenAI({
      system: `Томи, сгенерируй ДОПОЛНИТЕЛЬНЫЕ задачи для фазы. Цель: ${goal}. Фаза: ${phaseName}. Дедлайн: ${deadline}. Ч/нед: ${hoursPerWeek}.
JSON: {"tasks":[{"title":"3-8 слов","duration_hours":1-8,"priority":"high|medium|low"}]}
3-5 задач, не дублируй существующие, конкретные и действенные.`,
      user: `Уже есть: ${(existingTasks ?? []).join(", ")}`, maxTokens: 500, temperature: 0.7,
    });
    console.log(`Expand phase: "${phaseName}" → ${data.tasks?.length ?? 0} tasks`);
    return c.json(data);
  } catch (err: any) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Expand phase failed: ${err}` }, 500);
  }
});

// ── What-If Lab ───────────────────────────────────────────────────────────────
ai2.post("/ai/what-if", async (c) => {
  try {
    const { goal, deadline, currentProgress, scenario, phases } = await c.req.json();
    const phasesSummary = (phases ?? []).map((ph: any) => { const t = ph.tasks ?? []; const done = t.filter((x: any) => x.status === "done").length; return `${ph.name}: ${done}/${t.length}`; }).join("; ");
    const data = await callOpenAI({
      system: `Томи-стратег, «Что если…?». Цель: ${goal}. Дедлайн: ${deadline}. Прогресс: ${currentProgress}%. Фазы: ${phasesSummary}.
JSON: {"impact":"positive|negative|neutral","impactLevel":1-10,"analysis":"3-5 предл","recommendations":["3 рек"],"newDeadlineEstimate":"YYYY-MM-DD или null","riskFactors":["риски"]}`,
      user: `Сценарий: ${scenario}`, maxTokens: 500, temperature: 0.6,
    });
    console.log(`What-if: impact=${data.impact}`);
    return c.json(data);
  } catch (err: any) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `What-if failed: ${err}` }, 500);
  }
});

// ── Suggest Habits ────────────────────────────────────────────────────────────
ai2.post("/ai/suggest-habits", async (c) => {
  try {
    const { goal, currentHabits, completionRate, workPattern } = await c.req.json();
    const data = await callOpenAI({
      system: `Томи-коуч, предложи привычки для цели: ${goal}. Completion rate: ${completionRate ?? 0}%. Паттерн: ${workPattern || "стандартный"}.
JSON: {"habits":[{"title":"2-5 слов","description":"1 предл","frequency":"daily|weekly|workdays","estimatedMinutes":число,"category":"productivity|health|learning|social","difficulty":"easy|medium|hard"}]}
3-5 привычек. Не дублируй: ${(currentHabits ?? []).join(", ") || "нет"}.`,
      user: `Предложи привычки.`, maxTokens: 500, temperature: 0.7,
    });
    console.log(`Suggest habits: ${data.habits?.length ?? 0}`);
    return c.json(data);
  } catch (err: any) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Suggest habits failed: ${err}` }, 500);
  }
});

// ── Smart Replan ──────────────────────────────────────────────────────────────
ai2.post("/ai/smart-replan", async (c) => {
  try {
    const { goal, deadline, daysLeft, progress, phases, hoursPerWeek } = await c.req.json();
    const taskList = (phases ?? []).flatMap((ph: any) => (ph.tasks ?? []).filter((t: any) => t.status !== "done").map((t: any) => `[${t.id}] «${t.title}» — ${t.priority}, ${t.duration_hours}ч, ${ph.name}`)).join("\n");
    const data = await callOpenAI({
      system: `Томи, ПЕРЕПЛАНИРОВАНИЕ. Цель: ${goal}. Дедлайн: ${deadline}. Дней: ${daysLeft}. Прогресс: ${progress}%. Макс ${hoursPerWeek ?? 20}ч/нед.
JSON: {"strategy":"2-3 предл","reorderedTasks":[{"id":"","newPriority":"","reason":""}],"tasksToDefer":[{"id":"","reason":""}],"dailyPlan":[{"day":1,"taskIds":[],"hoursPlanned":0}],"canMeetDeadline":bool,"suggestedNewDeadline":"YYYY-MM-DD или null"}
dailyPlan макс 7 дней. Сначала high→medium→low.`,
      user: `Задачи:\n${taskList || "Нет"}`, maxTokens: 700, temperature: 0.4,
    });
    console.log(`Smart replan: canMeet=${data.canMeetDeadline}`);
    return c.json(data);
  } catch (err: any) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Smart replan failed: ${err}` }, 500);
  }
});

// ── Weekly Digest ─────────────────────────────────────────────────────────────
ai2.post("/ai/digest", async (c) => {
  try {
    const { goal, weekSummary, doneCount, overdueCount, totalHours, progress } = await c.req.json();
    const data = await callOpenAI({
      system: `Томи, ЕЖЕНЕДЕЛЬНЫЙ ДАЙДЖЕСТ. Цель: ${goal}. Прогресс: ${progress}%.
JSON: {"title":"5-8 слов","summary":"2-3 предл","wins":["победы"],"concerns":["проблемы"],"weeklyGrade":"A|B|C|D|F","nextWeekFocus":"1-2 предл","tomiComment":"1-2 предл тепло"}
A:>90%, B:>70%, C:>50%, D:>30%, F:<30%.`,
      user: `Выполнено: ${doneCount}, просрочено: ${overdueCount}, часов: ${totalHours}. ${weekSummary || ""}`,
      maxTokens: 400, temperature: 0.6,
    });
    console.log(`Digest: grade=${data.weeklyGrade}`);
    return c.json(data);
  } catch (err: any) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Digest failed: ${err}` }, 500);
  }
});

// ── Smart Reminder Times ──────────────────────────────────────────────────────
ai2.post("/ai/smart-reminder-times", async (c) => {
  try {
    const { tasks, userTimezone, workPattern, previousReminders } = await c.req.json();
    const taskList = (tasks ?? []).map((t: any) => `[${t.id}] «${t.title}» — ${t.priority}, дедлайн: ${t.end_date}`).join("\n");
    const data = await callOpenAI({
      system: `Томи, ОПТИМАЛЬНОЕ ВРЕМЯ напоминаний. ТЗ: ${userTimezone || "UTC+3"}. Паттерн: ${workPattern || "9-18"}.
JSON: {"reminders":[{"taskId":"","suggestedTime":"HH:MM","daysBefore":число,"reason":"","type":"start|deadline|progress_check"}]}
8:00-21:00. high→9-10ч. medium→12-14ч. low→17-18ч. Горящий дедлайн→за 1-2 дня.`,
      user: `Задачи:\n${taskList || "Нет"}\nПредыдущих: ${(previousReminders ?? []).length}`,
      maxTokens: 500, temperature: 0.3,
    });
    console.log(`Smart reminders: ${data.reminders?.length ?? 0}`);
    return c.json(data);
  } catch (err: any) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Smart reminders failed: ${err}` }, 500);
  }
});

// ── Forecast ──────────────────────────────────────────────────────────────────
ai2.post("/ai/forecast", async (c) => {
  try {
    const { goal, deadline, progress, velocity, phases } = await c.req.json();
    const phasesSummary = (phases ?? []).map((ph: any) => { const t = ph.tasks ?? []; const done = t.filter((x: any) => x.status === "done").length; return `${ph.name}: ${done}/${t.length}`; }).join("; ");
    const data = await callOpenAI({
      system: `Томи-аналитик, ПРОГНОЗ завершения. Цель: ${goal}. Дедлайн: ${deadline}. Прогресс: ${progress}%. Скорость: ${velocity ?? "?"} задач/нед. Фазы: ${phasesSummary}.
JSON: {"estimatedCompletionDate":"YYYY-MM-DD","confidence":"high|medium|low","onTrack":bool,"daysAheadOrBehind":число,"bottlenecks":[""],"advice":"1-2 предл","weeklyVelocityNeeded":число}`,
      user: `Спрогнозируй завершение.`, maxTokens: 400, temperature: 0.4,
    });
    console.log(`Forecast: onTrack=${data.onTrack}`);
    return c.json(data);
  } catch (err: any) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Forecast failed: ${err}` }, 500);
  }
});

// ── Tomi Insights ─────────────────────────────────────────────────────────────
ai2.post("/ai/tomi-insights", async (c) => {
  try {
    const { patternSummary, question } = await c.req.json();
    if (!patternSummary) return c.json({ error: "patternSummary is required" }, 400);
    const isWhatIf = !!question;
    const system = isWhatIf
      ? `Томи-стратег. Данные поведения:\n${patternSummary}\nОтветь на вопрос «Что если?». JSON: {"answer":"3-5 предл","confidence":1-100,"impact":"positive|negative|neutral","recommendation":"1-2 предл"}`
      : `Томи-стратег. Данные поведения:\n${patternSummary}\nДай персонализированные инсайты. JSON: {"greeting":"1 предл","insights":[{"emoji":"","title":"","body":"2-3 предл с цифрами","type":"strength|risk|pattern|tip"}],"personalityProfile":"2-3 предл","topRecommendation":"1-2 предл","predictedDropoffDay":число_или_null,"productivityScore":1-100}. 4-6 инсайтов разных типов.`;
    const data = await callOpenAI({
      system, user: isWhatIf ? `Вопрос: ${question}` : `Дай инсайты.`, maxTokens: 800, temperature: 0.65,
    });
    console.log(`Tomi insights (what-if: ${isWhatIf})`);
    return c.json(data);
  } catch (err: any) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Tomi insights failed: ${err}` }, 500);
  }
});

// ── Tomi Preventive Coach ─────────────────────────────────────────────────────
ai2.post("/ai/tomi-preventive", async (c) => {
  try {
    const { patternSummary, riskSignals, pendingTasks, planGoal } = await c.req.json();
    if (!patternSummary || !pendingTasks) return c.json({ error: "patternSummary and pendingTasks are required" }, 400);
    const taskList = (pendingTasks ?? []).map((t: any) => `[${t.id}] «${t.title}» (${t.priority}, ${t.status}, ${t.phase}, ${t.durationHours}ч)`).join("\n");
    const data = await callOpenAI({
      system: `Томи превентивный коуч. Цель: ${planGoal}. Риск: ${riskSignals?.level}, балл: ${riskSignals?.score}/100.
Причины: ${(riskSignals?.reasons ?? []).join("; ")}.
Данные: ${patternSummary}
JSON: {"greeting":"1-2 предл тепло","simplifications":[{"taskId":"","taskTitle":"","action":"simplify|deprioritize|postpone|remove","reason":"1 предл","newTitle":"только для simplify","newPriority":"low|medium только для deprioritize"}],"encouragement":"2-3 предл","alternativePlan":"2-3 предл"}
2-4 упрощения. Не удаляй high-приоритетные. Заботливый тон.`,
      user: `Задачи:\n${taskList}`, maxTokens: 700, temperature: 0.6,
    });
    console.log(`Preventive: ${riskSignals?.level} risk, ${(data.simplifications ?? []).length} suggestions`);
    return c.json(data);
  } catch (err: any) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Tomi preventive failed: ${err}` }, 500);
  }
});

export { ai2 };