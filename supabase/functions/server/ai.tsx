import { Hono } from "npm:hono";
import { callOpenAI, OPENAI_ENDPOINT, OPENAI_API_KEY, tryGetUser } from "./ai-shared.tsx";

const ai = new Hono();

// ── Soft auth middleware — log user but allow demo/anon access ─────────────────
ai.use("/*", async (c, next) => {
  const user = await tryGetUser(c.req.header("Authorization"));
  if (user) c.set("userId" as any, user.id);
  await next();
});

// ── Generate Plan ─────────────────────────────────────────────────────────────
ai.post("/generate-plan", async (c) => {
  try {
    const { goal, deadline, hours_per_week } = await c.req.json();
    if (!goal?.trim()) return c.json({ error: "Goal is required" }, 400);
    
    // Calculate time parameters
    const today = new Date();
    const deadlineDate = deadline ? new Date(deadline) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const totalDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    const hoursPerWeek = hours_per_week || 10;
    const hoursPerDay = hoursPerWeek / 7;
    const totalAvailableHours = Math.floor(totalDays * hoursPerDay);
    
    const todayStr = today.toISOString().slice(0, 10);
    const deadlineStr = deadlineDate.toISOString().slice(0, 10);

    const systemPrompt = `Ты — профессиональный планировщик и эксперт по управлению временем.

КРИТИЧЕСКИ ВАЖНО — ПРОЧИТАЙ ЭТО ВНИМАТЕЛЬНО:
ЗАПРЕЩЕНО использовать общие шаблонные фразы типа:
❌ "Подготовка и исследование"
❌ "Планирование"
❌ "Исследование"
❌ "Реализация"
❌ "Оценка и корректировка"
❌ "Сбор информации"
❌ "Определить цель"
❌ "Анализ рисков"

ВСЕ фазы и задачи должны быть КОНКРЕТНЫМИ и СПЕЦИФИЧНЫМИ для цели пользователя!

═══════════════════════════════════════════════════════════════

ПРИМЕР 1 — Цель: "План приема лекарств от диабета"

ПРАВИЛЬНО ✅:
Фаза 1: "Консультация с эндокринологом" (7 дней)
  - Записаться на прием к эндокринологу (0.5ч)
  - Пройти консультацию и получить назначения (1.5ч)
  - Сдать анализ крови на сахар (1ч)
  - Купить назначенные препараты в аптеке (1ч)

Фаза 2: "Настройка режима приема" (14 дней)
  - Купить таблетницу с отделениями на неделю (0.5ч)
  - Настроить ежедневные напоминания в телефоне (0.5ч)
  - Разложить препараты по дням недели (1ч)
  - Завести дневник приема и показателей сахара (1ч)

Фаза 3: "Ежедневный контроль" (60 дней)
  - Измерять сахар утром натощак ежедневно (0.2ч/день)
  - Принимать препараты по расписанию (0.1ч/день)
  - Вести записи в дневнике здоровья (0.2ч/день)
  - Контрольный визит к врачу через месяц (1.5ч)

НЕПРАВИЛЬНО ❌:
Фаза 1: "Подготовка и исследование"
  - Определить и уточнить цель
  - Сбор информации и ресурсов

═══════════════════════════════════════════════════════════════

ПРИМЕР 2 — Цель: "Организовать прием витаминов"

ПРАВИЛЬНО ✅:
Фаза 1: "Выбор витаминов" (3 дня)
  - Записаться к терапевту для назначения витаминов (0.5ч)
  - Сдать анализ крови на витамины D, B12, железо (1ч)
  - Купить назначенные витамины и БАДы (1ч)

Фаза 2: "Создание системы приема" (7 дней)
  - Купить органайзер для витаминов (0.5ч)
  - Разложить витамины по приемам (утро/вечер) (0.5ч)
  - Поставить напоминания на телефон (0.3ч)
  - Создать таблицу учета в Notes/блокноте (0.5ч)

Фаза 3: "Регулярный прием" (80 дней)
  - Принимать утренние витамины после завтрака (0.05ч/день)
  - Принимать вечерние витамины перед сном (0.05ч/день)
  - Отмечать в таблице приемы (0.1ч/день)
  - Повторная сдача анализов через 3 месяца (1ч)

══════════════════════════════════════════════════════════════

ПРИМЕР 3 — Цель: "Контроль давления и прием таблеток"

ПРАВИЛЬНО ✅:
Фаза 1: "Медицинское обследование" (7 дней)
  - Посетить кардиолога для назначения терапии (1.5ч)
  - Купить тонометр для измерения давления (1ч)
  - Приобрести назначенные гипотензивные препараты (0.5ч)
  - Научиться правильно мерить давление (0.5ч)

Фаза 2: "Запуск контроля" (14 дней)
  - Измерять давление утром и вечером ежедневно (0.3ч/день)
  - Принимать таблетки строго в 8:00 и 20:00 (0.1ч/день)
  - Вести дневник давления в Excel/блокноте (0.2ч/день)
  - Отслеживать побочные эффекты препаратов (0.1ч/день)

Фаза 3: "Стабилизация" (60 дней)
  - Продолжать измерения и прием по графику (0.4ч/день)
  - Еженедельно анализировать показатели давления (0.5ч/неделю)
  - Контрольный визит к кардиологу через месяц (1.5ч)
  - Корректировка дозировки при необходимости (1ч)

═══════════════════════════════════════════════════════════════

ТВОЯ ЗАДАЧА:
Создай план для цели: "${goal}"

ВХОДНЫЕ ДАННЫЕ:
- Количество дней: ${totalDays}
- Часов в день: ${hoursPerDay.toFixed(1)}
- Всего доступного времени: ${totalAvailableHours} часов
- Сегодня: ${todayStr}
- Дедлайн: ${deadlineStr}

АЛГОРИТМ:
1. ВНИМАТЕЛЬНО прочитай цель
2. Определи ТЕМАТИКУ (медицина/спорт/бизнес/учеба/хобби и т.д.)
3. Придумай 3-5 КОНКРЕТНЫХ этапов для ЭТОЙ тематики
4. В каждом этапе создай 2-5 КОНКРЕТНЫХ задач
5. НИ ОДНА фаза/задача НЕ должна содержать общие слова из ЗАПРЕЩЕННОГО списка

ПРАВИЛА НАЗВАНИЙ:
✅ Используй существительные (Консультация, Покупка, Измерение, Тренировка)
✅ Используй глаголы (Записаться к врачу, Купить таблетницу, Настроить напоминания)
✅ Будь конкретным (НЕ "Сбор информации", а "Изучить инструкции к препаратам")
✅ Указывай КОНКРЕТНЫЕ действия (НЕ "Работать над проектом", а "Написать 3 статьи для блога")

ФОРМАТ ВЫВОДА (СТРОГО JSON):
{
  "id": "уникальный_id",
  "goal": "${goal}",
  "deadline": "${deadlineStr}",
  "hours_per_week": ${hoursPerWeek},
  "total_days": ${totalDays},
  "created_at": "${new Date().toISOString()}",
  "phases": [
    {
      "id": "phase_1",
      "name": "КОНКРЕТНОЕ название этапа (3-6 слов)",
      "duration_days": число_дней,
      "color": "#1d4ed8",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "tasks": [
        {
          "id": "task_1",
          "phase_id": "phase_1",
          "title": "КОНКРЕТНОЕ действие (5-10 слов)",
          "description": "Детальное описание что именно нужно сделать",
          "duration_hours": число_часов,
          "priority": "high" | "medium" | "low",
          "depends_on": [],
          "status": "todo",
          "start_date": "YYYY-MM-DD",
          "end_date": "YYYY-MM-DD",
          "recurring": false,
          "tracked_seconds": 0,
          "comments": [],
          "tags": [],
          "subtasks": [
            {"id": "sub_1", "title": "Конкретный шаг", "done": false},
            {"id": "sub_2", "title": "Конкретный шаг", "done": false}
          ]
        }
      ]
    }
  ]
}

СТРУКТУРА:
- 3-5 фаз — каждая СПЕЦИФИЧНА для цели
- 2-5 задач в фазе — каждая КОНКРЕТНА
- 2-4 подзадачи в задаче
- Цвета: #1d4ed8, #2563eb, #1e40af, #10b981, #f59e0b, #ef4444
- Приоритеты: high (срочно), medium (обычно), low (можно отложить)

ПРОВЕРЬ СЕБЯ ПЕРЕД ОТВЕТОМ:
- ❓ Есть ли в названиях фаз слова "Подготовка", "Исследование", "Планирование"? → ПЕРЕДЕЛАЙ!
- ❓ Есть ли задачи "Определить цель", "Сбор информации"? → ПЕРЕДЕЛАЙ!
- ❓ Все ли задачи КОНКРЕТНЫ и понятны? → ДА!
- ❓ План релевантен цели пользователя? → ДА!

Отвечай ТОЛЬКО валидным JSON без markdown, без комментарив, без пояснений.`;

    const res = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Создай детальный план для достижения цели: "${goal}"` },
        ],
        temperature: 0.7,
        max_tokens: 6000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const e = await res.text();
      console.log(`OpenAI error ${res.status}: ${e}`);
      return c.json({ error: `AI request failed: ${res.status}` }, 502);
    }

    const completion = await res.json();
    const content = completion.choices?.[0]?.message?.content;
    if (!content) return c.json({ error: "Empty AI response" }, 502);

    // Check if output was truncated
    const finishReason = completion.choices?.[0]?.finish_reason;
    if (finishReason === "length") {
      console.log(`Generate plan: output truncated (finish_reason=length), goal: "${goal}"`);
      return c.json({ error: "AI response truncated — plan too complex" }, 502);
    }

    let plan: any;
    try { plan = JSON.parse(content); } catch (e) {
      console.log(`Parse error: ${e}, content snippet: ${content.slice(0, 200)}`);
      return c.json({ error: "AI returned invalid JSON" }, 502);
    }

    // Validate basic structure
    if (!plan?.phases || !Array.isArray(plan.phases) || plan.phases.length === 0) {
      console.log(`Invalid plan structure: phases missing or empty`);
      return c.json({ error: "AI returned invalid plan structure" }, 502);
    }

    // Ensure required fields
    if (!plan.id) plan.id = crypto.randomUUID();
    if (!plan.created_at) plan.created_at = new Date().toISOString();
    if (!plan.goal) plan.goal = goal;
    if (!plan.deadline) plan.deadline = deadlineStr;
    if (!plan.hours_per_week) plan.hours_per_week = hoursPerWeek;
    if (!plan.total_days) plan.total_days = totalDays;

    console.log(`Plan generated for goal: "${goal}" — ${plan.phases.length} phases, ${totalAvailableHours}h available`);
    return c.json({ plan });
  } catch (err) {
    console.log(`Generate plan error: ${err}`);
    return c.json({ error: `Failed: ${err}` }, 500);
  }
});

// ── Tomi Chat ─────────────────────────────────────────────────────────────────
ai.post("/ai/tomi", async (c) => {
  try {
    const { messages, context, username, personality, planStats } = await c.req.json();
    if (!Array.isArray(messages) || messages.length === 0) return c.json({ error: "messages array is required" }, 400);
    const name = (username || "").trim();
    const nameClause = name ? `Имя пользователя: ${name}. Обращайся по имени тепло и персонально.` : `Пользователь не представился.`;

    // Parse plan stats for proactive coaching
    const stats = planStats ?? {};
    const progress = stats.progress ?? 0;
    const overdueCount = stats.overdueCount ?? 0;
    const daysLeft = stats.daysLeft ?? null;
    const lastActivityDays = stats.lastActivityDays ?? 0; // days since last task completed

    // Build proactive coaching instruction based on real plan state
    let proactiveInstruction = '';
    if (lastActivityDays >= 3 && progress < 80) {
      proactiveInstruction = `ВАЖНО: Пользователь не выполнял задачи уже ${lastActivityDays} дней, а прогресс всего ${progress}%. Мягко, но настойчиво подтолкни его к действию. Спроси, что мешает, предложи упростить ближайшую задачу.`;
    } else if (overdueCount > 2) {
      proactiveInstruction = `ВАЖНО: ${overdueCount} задач просрочено. Не паникуй, но предложи конкретный план: что сделать сегодня, что отложить, что удалить.`;
    } else if (progress >= 75 && daysLeft !== null && daysLeft > 7) {
      proactiveInstruction = `ВАЖНО: Прогресс ${progress}%! Пользователь молодец — обязательно похвали, отметь конкретный результат и предложи ускориться или взять небольшую передышку.`;
    } else if (lastActivityDays === 0 && progress < 30) {
      proactiveInstruction = `Пользователь только начинает или только что заходит. Поддержи, помоги выбрать первую задачу с чего начать прямо сейчас.`;
    }

    const pMap: Record<string, string> = {
      strict: `СТРОГИЙ КОУЧ: Конкретные дедлайны, никаких оправданий. Говоришь кратко и по делу. Если пользователь затягивает — прямо скажи об этом. Ставишь чёткие задачи "сделай это сегодня к 18:00". Не утешаешь, а мотивируешь через ответственность.`,
      soft: `МЯГКИЙ КОУЧ: Тёплый, поддерживающий, сочувствуешь трудностям. Хвалишь маленькие победы. Если человек устал — предлагаешь отдых и говоришь "кажется, тебе нужна пауза, это нормально". Мотивируешь через принятие и постепенный прогресс.`,
      business: `ДЕЛОВОЙ ПЛАНИРОВЩИК: Оперируешь метриками, KPI, ROI. "Выполнено 60% задач, осталось 8 дней — нужно ускориться на 15%". Предлагаешь чеклисты, оптимизацию процессов. Лаконично, структурировано, без лирики.`,
      motivational: `ЭНЕРГИЧНЫЙ МОТИВАТОР: Заряжаешь энергией, используешь эмодзи 🔥💪🚀. Отмечаешь каждую победу громко. "ВОТ ЭТО ДА! Ты только что прошёл 60% плана — ты просто космос!" Если задачи не делаются — разжигаешь азарт "давай, ты можешь, я верю в тебя!".`,
      zen: `ДЗЕН-МАСТЕР: Спокойный, медитативный. Помогаешь найти баланс между действием и отдыхом. "Каждый маленький шаг — это уже движение". Предлагаешь разбить задачи на совсем маленькие части. Никакого давления — только мудрые наблюдения.`,
      spartan: `СПАРТАНЕЦ: Жёстко, кратко, без компромиссов. "Сделал — молодец. Не сделал — причин нет, есть только результаты". Короткие команды. Не жалеешь, но и не обижаешь. Уважаешь силу воли пользователя.`,
      joker: `ВЕСЕЛЬЧАК: Лёгкий юмор, шутки, но реально помогаешь. "Ладно-ладно, я вижу ты опять тянешь с задачами 😄 Но это наша с тобой маленькая тайна. Давай разберёмся!". Смеёшься вместе с пользователем над трудностями, но доводишь до результата.`,
    };
    const pClause = pMap[personality] || pMap.soft;

    const systemPrompt = `Ты — Томи, персональный AI-коуч и менеджер в приложении Vecto. ${nameClause}

ТВОЯ РОЛЬ:
Ты не просто отвечаешь на вопросы — ты АКТИВНО помогаешь пользователю двигаться к цели. Ты знаеь его план детально, видишь прогресс и помогаешь адаптировать план под реальность.

СТИЛЬ ОБЩЕНИЯ: ${pClause}

${proactiveInstruction ? `ТЕКУЩАЯ СИТУАЦИЯ (используй это для ответа): ${proactiveInstruction}` : ''}

ТВОИ КЛЮЧЕВЫЕ ЗАДАЧИ:
1. АНАЛИЗ ПРОГРЕССА: Если пользователь молчит про задачи — сам спроси как дела, что мешает, что уже сделано.
2. АДАПТАЦИЯ ПЛАНА: Помогаешь менять план под реальность. Если задачи накапливаются — предлагашь упростить, перенести или убрать лишнее.
3. ЭМОЦИОНАЛЬНАЯ ПОДДЕРЖКА: Чувствуешь усталость пользователя ("кажется, ты немного устал — это нормально, давай возьмём паузу или упростим ближайшие задачи").
4. МОТИВАЦИЯ: Когда пользователь не делает задачи — мягко или настойчиво (по стилю) подталкиваешь к действию.
5. КОНКРЕТНОСТЬ: Всегда предлагаешь конкретный следующий шг, а не общие советы.

ПРАВИЛА ОТВЕТОВ:
- Говоришь ТОЛЬКО на русском
- Никогда не упоминаешь OpenAI / ChatGPT
- Ответы 2-4 предложения (иногда можно больше, если ситуация требует)
- Обращайся по имени (если есть)
- Будь живым, не роботом — реагируй на эмоции пользователя

УПРАВЛЕНИЕ ЗАДАЧАМИ (возвращай JSON):
Можешь выполнять действия с планом. Верни JSON:
{"reply":"текст ответа","planAction":null}
Или с действием planAction:
- delete_task: {"type":"delete_task","taskId":"id","taskTitle":"название","message":"объяснение"}
- delete_tasks: {"type":"delete_tasks","taskIds":["id1","id2"],"message":"объяснение"}
- change_status: {"type":"change_status","taskId":"id","taskTitle":"название","newStatus":"todo|in_progress|done","message":"объяснение"}
- change_priority: {"type":"change_priority","taskId":"id","taskTitle":"название","newPriority":"high|medium|low","message":"объяснение"}
- rename_task: {"type":"rename_task","taskId":"id","taskTitle":"старое","newTitle":"новое","message":"объяснение"}
- add_task: {"type":"add_task","phaseId":"id","phaseName":"название","newTaskTitle":"задача","newTaskPriority":"high|medium|low","message":"объяснение"}
- mark_done: {"type":"mark_done","taskIds":["id1","id2"],"message":"объяснение"}
- reduce_load: {"type":"reduce_load","message":"объяснение"}
- focus_top3: {"type":"focus_top3","message":"объяснение"}
- reschedule: {"type":"reschedule","message":"объяснение"}

ВАЖНО: Используй taskId и phaseId ТОЛЬКО из контекста плана. Если задача не найдена — скажи об этом.
${context ? `\nКОНТЕКСТ ТЕКУЩЕГО ПЛАНА:\n${context}` : ""}`;

    const res = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "system", content: systemPrompt }, ...messages], temperature: 0.8, max_tokens: 700, response_format: { type: "json_object" } }),
    });
    if (!res.ok) { const e = await res.text(); console.log(`Tomi error ${res.status}: ${e}`); return c.json({ error: `AI failed: ${res.status}` }, 502); }
    const completion = await res.json();
    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) return c.json({ error: "Empty AI response" }, 502);
    let parsed: { reply: string; planAction?: unknown } = { reply: raw };
    try { parsed = JSON.parse(raw); } catch { /* keep raw */ }
    const tokens = completion.usage?.total_tokens ?? 0;
    console.log(`Tomi replied (${tokens} tokens, action: ${JSON.stringify(parsed.planAction ?? null)})`);
    return c.json({ reply: parsed.reply ?? raw, planAction: parsed.planAction ?? null, tokens });
  } catch (err) { console.log(`Tomi error: ${err}`); return c.json({ error: `Tomi failed: ${err}` }, 500); }
});

// ── Check goal realism ────────────────────────────────────────────────────────
ai.post("/ai/check-goal", async (c) => {
  try {
    const { goal } = await c.req.json();
    if (!goal?.trim()) return c.json({ error: "Goal required" }, 400);
    const res = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o", temperature: 0.3, max_tokens: 150, response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `Томи-AI. Оцени реалистичность цели. JSON: {"realistic":bool,"warning":"или null","suggestedTimeline":"или null"}. Агрессивные цели (выучить язык за месяц и т.п.) → realistic:false.` },
          { role: "user", content: `Цель: ${goal}` },
        ],
      }),
    });
    if (!res.ok) return c.json({ realistic: true, warning: null });
    const comp = await res.json();
    try { const d = JSON.parse(comp.choices?.[0]?.message?.content); console.log(`Goal check: "${goal}" → ${d.realistic}`); return c.json(d); }
    catch { return c.json({ realistic: true, warning: null }); }
  } catch (err) { console.log(`Check goal error: ${err}`); return c.json({ realistic: true, warning: null }); }
});

// ── Parse task from natural language ─────────────────────────────────────────
ai.post("/ai/parse-task", async (c) => {
  try {
    const { input, phases, planDeadline } = await c.req.json();
    if (!input?.trim()) return c.json({ error: "Input text required" }, 400);
    const phaseNames = (phases ?? []).map((p: any) => p.name).filter(Boolean).join(', ');
    const today = new Date().toISOString().slice(0, 10);
    const sys = `Томи-AI Vecto. Извлеки задачу из текста пользователя.
Фазы: ${phaseNames || 'не указаны'}. Дедлайн проекта: ${planDeadline || 'не указан'}. Сегодня: ${today}.
JSON: {"title":"название 3-8 слов","priority":"high|medium|low","duration_hours":число,"phase_name":"или null","end_date":"YYYY-MM-DD или null","tags":["до 3"]}
Срочно/важно/критично → high. Не торопится → low. Иначе medium. Вычисли end_date если есть указание даты.`;
    const res = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: sys }, { role: "user", content: `Задача: "${input}"` }], temperature: 0.3, max_tokens: 300, response_format: { type: "json_object" } }),
    });
    if (!res.ok) {
      const e = await res.text();
      if (res.status === 429) return c.json({ error: "AI rate limited", code: "rate_limited" }, 429);
      if (res.status === 402 || e.includes("insufficient_quota")) return c.json({ error: "AI quota exceeded", code: "quota_exceeded" }, 402);
      return c.json({ error: `AI failed: ${res.status}` }, 502);
    }
    const comp = await res.json();
    const raw = comp.choices?.[0]?.message?.content;
    if (!raw) return c.json({ error: "Empty AI response" }, 502);
    let p: any;
    try { p = JSON.parse(raw); } catch { return c.json({ error: "Invalid AI JSON", code: "parse_error" }, 502); }
    const result = { title: p.title || input.trim(), priority: ["high","medium","low"].includes(p.priority) ? p.priority : "medium", duration_hours: typeof p.duration_hours === "number" && p.duration_hours > 0 ? p.duration_hours : 2, phase_name: p.phase_name || null, end_date: p.end_date || null, tags: Array.isArray(p.tags) ? p.tags.slice(0,5) : [] };
    console.log(`Parsed task: "${input}" → "${result.title}"`);
    return c.json(result);
  } catch (err) { console.log(`Parse-task error: ${err}`); return c.json({ error: `Failed: ${err}` }, 500); }
});

// ── Panic Mode ────────────────────────────────────────────────────────────────
ai.post("/ai/panic-mode", async (c) => {
  try {
    const { goal, deadline, daysLeft, progress, phases } = await c.req.json();
    const taskList = (phases ?? []).flatMap((ph: any) => (ph.tasks ?? []).map((t: any) => `[${t.id}] «${t.title}» — ${t.priority}, ${t.status}, ${t.duration_hours}ч (${ph.name})`)).join("\n");
    const data = await callOpenAI({
      system: `Томи, РЕЖИМ ПАНИКИ. Цель: ${goal}. Дедлайн: ${deadline}. Дней: ${daysLeft}. Прогресс: ${progress}%.
Выбери критический минимум задач. JSON: {"criticalTaskIds":[],"cutTaskIds":[],"summary":"2-3 предложения","estimatedHoursNeeded":число,"survivalTip":"совет"}
Critical: todo/in_progress high/medium, суммарно ≤ daysLeft×4ч. Cut: остальное незавершённое. Без done-задач.`,
      user: `Задачи:\n${taskList}`, maxTokens: 500, temperature: 0.3,
    });
    console.log(`Panic mode: ${data.criticalTaskIds?.length ?? 0} critical`);
    return c.json(data);
  } catch (err: any) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Panic mode failed: ${err}` }, 500);
  }
});

// ── Morning Briefing ──────────────────────────────────────────────────────────
ai.post("/ai/morning-briefing", async (c) => {
  try {
    const { goal, todayTasks, overdueTasks, daysUntilDeadline, progress } = await c.req.json();
    const todayList = (todayTasks ?? []).map((t: any) => `[${t.id}] «${t.title}» (${t.priority}, ${t.duration_hours}ч)`).join("\n");
    const overdueList = (overdueTasks ?? []).map((t: any) => `[${t.id}] «${t.title}» (${t.priority})`).join("\n");
    const data = await callOpenAI({
      system: `Томи, УТРЕННИЙ БРИФИНГ. Цель: ${goal}. До дедлайна: ${daysUntilDeadline}д. Прогресс: ${progress}%.
JSON: {"greeting":"1-2 предложения","focusTasks":[{"id":"","reason":""}],"optionalTasks":[{"id":"","reason":""}],"tip":"совет","mood":"energized|focused|steady|recovery","motivationalQuote":"фраза"}
focusTasks: 1-3 задачи. mood: высокий прогресс→energized, просроченные→recovery. По-русски.`,
      user: `Сегодня:\n${todayList || "Нет"}\nПросроченные:\n${overdueList || "Нет"}`, maxTokens: 400, temperature: 0.6,
    });
    console.log(`Morning briefing: mood=${data.mood}`);
    return c.json(data);
  } catch (err: any) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Briefing failed: ${err}` }, 500);
  }
});

// ── Phase Retrospective ───────────────────────────────────────────────────────
ai.post("/ai/phase-retro", async (c) => {
  try {
    const { goal, phaseName, plannedHours, trackedHours, completedCount, totalCount, overdueCount, taskTitles } = await c.req.json();
    const data = await callOpenAI({
      system: `Томи, РЕТРОСПЕКТИВА фазы. Цель: ${goal}. Фаза: ${phaseName}.
JSON: {"headline":"5-10 слов","whatWorked":["2-3"],"whatSlowed":["2-3"],"insight":"1-2 предл","nextPhaseAdvice":"1-2 предл","score":1-10}
9-10:>90% выполнено, 7-8:>70%, 5-6:средне, 3-4:мало, 1-2:почти ничего.`,
      user: `${completedCount}/${totalCount} выполнено, ${overdueCount} просрочено. План: ${plannedHours}ч, факт: ${trackedHours}ч. Задачи: ${(taskTitles ?? []).join(", ")}`,
      maxTokens: 400, temperature: 0.5,
    });
    console.log(`Phase retro: "${phaseName}" → score=${data.score}`);
    return c.json(data);
  } catch (err: any) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Phase retro failed: ${err}` }, 500);
  }
});

// ── Clarify vague goal ────────────────────────────────────────────────────────
ai.post("/ai/clarify-goal", async (c) => {
  try {
    const { goal } = await c.req.json();
    if (!goal?.trim()) return c.json({ error: "Goal required" }, 400);

    const data = await callOpenAI({
      system: `Ты — Томи, AI-планировщик Vecto. Пользователь описал цель. Определи, достаточно ли она конкретна для генерации подробного пошагового плана.

ЦЕЛЬ СЧИТАЕТСЯ РАСПЛЫВЧАТОЙ, если:
- Слишком короткая (менее 5 слов) и не содержит конкретики
- Нет понятного результата (например "стать лучше", "улучшить жизнь")
- Нет указания на предметную область или контекст
- Невозможно определить конкретные шаги

ЦЕЛЬ СЧИТАЕТСЯ ДОСТАТОЧНОЙ, если:
- Понятно ЧТО нужно сделать (даже если кратко: "выучить Python", "похудеть на 10кг")
- Есть конкретный навык, проект или результат

Если цель расплывчатая — задай 2-4 уточняющих вопроса чтобы понять:
1. Конкретный желаемый результат
2. Текущий уровень / отправная точка
3. Ресурсы и ограничения
4. Приоритеты внутри цели

JSON: {"needsClarification":boolean,"questions":["вопрос1","вопрос2"],"tomiComment":"короткий комментарий Томи 1-2 предложения"}
Если цель достаточна — questions пустой массив, needsClarification=false.
Отвечай на русском.`,
      user: `Цель пользователя: "${goal}"`,
      maxTokens: 400,
      temperature: 0.4,
    });

    console.log(`Clarify goal: "${goal}" → needsClarification=${data.needsClarification}, questions=${data.questions?.length ?? 0}`);
    return c.json(data);
  } catch (err: any) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    // On error, just proceed without clarification
    return c.json({ needsClarification: false, questions: [], tomiComment: "" });
  }
});

// ── Validate Deadline Realism ──────────────────────────────────────────────────
ai.post("/ai/validate-deadline", async (c) => {
  try {
    const { goal, deadline, hoursPerWeek } = await c.req.json();
    if (!goal?.trim()) return c.json({ error: "Goal is required" }, 400);

    const today = new Date();
    const deadlineDate = new Date(deadline);
    const totalDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / 86400000);
    const totalHours = Math.floor(totalDays * (hoursPerWeek / 7));

    const data = await callOpenAI({
      system: `Ты — Vecto AI-аналитик реалист��чности планов.
Оцени, реалистична ли цель при заданных ресурсах.
JSON: {"realistic":bool,"confidence":"high"|"medium"|"low","verdict":"1-2 предл","suggestedDeadline":"YYYY-MM-DD или null","suggestedHoursPerWeek":число_или_null,"risks":["1-3 риска"],"tips":["1-3 совета"]}
Если цель реалистична — suggestedDeadline=null. Будь честным но мотивирующим.`,
      user: `Цель: "${goal}"\nДедлайн: ${deadline} (${totalDays} дней)\nЧасов/нед: ${hoursPerWeek} (${totalHours}ч доступно)`,
      maxTokens: 400,
      temperature: 0.4,
    });

    console.log(`Validate deadline: realistic=${data.realistic}, confidence=${data.confidence}`);
    return c.json(data);
  } catch (err: any) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Validate deadline failed: ${err}` }, 500);
  }
});

// ── Regenerate Phase (Tomi iterative improvement) ─────────────────────────────
ai.post("/ai/regenerate-phase", async (c) => {
  try {
    const { goal, deadline, hoursPerWeek, phaseName, phaseIndex, totalPhases, feedback, existingTasks } = await c.req.json();
    if (!goal?.trim() || !phaseName) return c.json({ error: "Goal and phaseName are required" }, 400);

    const today = new Date().toISOString().slice(0, 10);
    const existingList = (existingTasks ?? []).map((t: any) => `«${t.title}» (${t.priority})`).join(", ");

    const data = await callOpenAI({
      system: `Ты — Vecto AI, перегенерируй фазу плана с учётом фидбека.
Цель проекта: ${goal}. Дедлайн: ${deadline}. Ч/нед: ${hoursPerWeek ?? 10}.
Фаза "${phaseName}" (${phaseIndex + 1} из ${totalPhases}).
Текущие задачи: ${existingList || "нет"}.
Сегодня: ${today}.
JSON: {"tasks":[{"title":"3-8 слов","description":"1-2 предл","duration_hours":1-8,"priority":"high|medium|low","subtasks":[{"title":"подзадача"}]}],"tomiComment":"1-2 предл что изменил"}
3-6 задач, каждая с 2-3 подзадачами. Все на русском. Учти фидбек пользователя.`,
      user: `Фидбек: ${feedback || "Перегенерируй с лучшей структурой"}`,
      maxTokens: 800,
      temperature: 0.6,
    });

    console.log(`Regenerate phase: "${phaseName}" → ${data.tasks?.length ?? 0} tasks`);
    return c.json(data);
  } catch (err: any) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Regenerate phase failed: ${err}` }, 500);
  }
});

// ── Generate Milestones ───────────────────────────────────────────────────────
ai.post("/ai/generate-milestones", async (c) => {
  try {
    const { goal, deadline, phases } = await c.req.json();
    if (!goal?.trim()) return c.json({ error: "Goal is required" }, 400);

    const phasesSummary = (phases ?? []).map((ph: any, i: number) =>
      `${i + 1}. "${ph.name}" (${ph.start_date} — ${ph.end_date}, ${ph.tasks?.length ?? 0} задач)`
    ).join("\n");

    const data = await callOpenAI({
      system: `Ты — Vecto AI, создай ключевые вехи (milestones) для проекта.
Цель: ${goal}. Дедлайн: ${deadline}.
Фазы:\n${phasesSummary}
JSON: {"milestones":[{"title":"2-5 слов","description":"1 предл","target_date":"YYYY-MM-DD","phase_id":"привязать к концу фазы или null","criteria":["2-3 критерия достижения"]}]}
3-5 вех, привязанных к ключевым моментам проекта. На русском.`,
      user: `Создай вехи проекта.`,
      maxTokens: 500,
      temperature: 0.5,
    });

    console.log(`Generate milestones: ${data.milestones?.length ?? 0}`);
    return c.json(data);
  } catch (err: any) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Generate milestones failed: ${err}` }, 500);
  }
});

export { ai };