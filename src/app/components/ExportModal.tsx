import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Calendar, FileText, Check, Share2, Copy, BookOpen, Loader2, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { copyToClipboard } from '../lib/clipboard';
import { toast } from 'sonner';

interface Props {
  plan: Plan;
  onClose: () => void;
}

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-a5927615`;

export function ExportModal({ plan, onClose }: Props) {
  const [exported, setExported] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── CSV ────────────────────────────────────────────────────────────────
  const handleCSVExport = () => {
    const rows = [['Фаза', 'Задача', 'Описание', 'Приоритет', 'Статус', 'Часов', 'Начало', 'Конец', 'Повтор']];
    plan.phases.forEach(phase => {
      phase.tasks.forEach(task => {
        rows.push([
          phase.name, task.title, task.description || '',
          task.priority, task.status, String(task.duration_hours),
          task.start_date, task.end_date,
          task.recurring ? (task.recurrence_interval || 'weekly') : '',
        ]);
      });
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `stride-${plan.id}.csv`; a.click();
    URL.revokeObjectURL(url);
    setExported('csv');
  };

  // ── iCal ──────────────────────────────────────────────────────────────
  const handleGoogleCalendarExport = () => {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vecto//Vecto//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    plan.phases.forEach(phase => {
      phase.tasks.forEach(task => {
        const created = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");
        lines.push(
          'BEGIN:VEVENT',
          `UID:${task.id}@stride.app`,
          `DTSTAMP:${created}`,
          `DTSTART;VALUE=DATE:${task.start_date.replace(/-/g, '')}`,
          `DTEND;VALUE=DATE:${task.end_date.replace(/-/g, '')}`,
          `SUMMARY:[${phase.name}] ${task.title}`,
          `DESCRIPTION:Приоритет: ${task.priority}\\nЧасов: ${task.duration_hours}\\nЦель: ${plan.goal}${task.description ? '\\n' + task.description : ''}`,
          `CATEGORIES:${phase.name}`,
          'END:VEVENT',
        );
      });
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `stride-${plan.id}.ics`; a.click();
    URL.revokeObjectURL(url);
    setExported('google');
  };

  // ── Notion Markdown ───────────────────────────────────────────────────
  const handleNotionExport = () => {
    const lines: string[] = [
      `# ${plan.goal}`,
      '',
      `> 📅 Дедлайн: ${plan.deadline} · ⏱ ${plan.hours_per_week}ч/нед · 📊 ${plan.total_days} дней`,
      '',
      '---',
      '',
    ];
    plan.phases.forEach(phase => {
      const doneTasks = phase.tasks.filter(t => t.status === 'done').length;
      lines.push(`## ${phase.name}`, '');
      lines.push(`*${phase.duration_days} дней · ${doneTasks}/${phase.tasks.length} задач выполнено*`, '');
      phase.tasks.forEach(task => {
        const check = task.status === 'done' ? 'x' : ' ';
        const priority = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
        const recurring = task.recurring ? ' 🔄' : '';
        lines.push(`- [${check}] ${priority} **${task.title}**${recurring} *(${task.duration_hours}ч, ${task.start_date} → ${task.end_date})*`);
        if (task.description) lines.push(`  > ${task.description}`);
      });
      lines.push('');
    });
    const md = lines.join('\n');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `stride-${plan.id}.md`; a.click();
    URL.revokeObjectURL(url);
    setExported('notion');
  };

  // ── Share ─────────────────────────────────────────────────────────────
  const handleShare = async () => {
    setShareLoading(true);
    try {
      const res = await fetch(`${SERVER}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.shareId) {
        const url = `${window.location.origin}/share/${data.shareId}`;
        setShareUrl(url);
      } else {
        console.error('Share error:', data);
      }
    } catch (err) {
      console.error('Share request failed:', err);
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await copyToClipboard(shareUrl);
    setCopied(true);
    toast.success('Ссылка скопирована! 🔗');
    setTimeout(() => setCopied(false), 2000);
  };

  const OPTIONS = [
    { id: 'csv',    icon: FileText,  title: 'Экспорт в CSV',          desc: 'Excel, Google Sheets, любой табличный редактор',              color: '#10b981', action: handleCSVExport },
    { id: 'google', icon: Calendar,  title: 'Google Calendar (.ics)',  desc: 'Импорт в Google Calendar, Apple Calendar, Outlook',           color: '#4285f4', action: handleGoogleCalendarExport },
    { id: 'notion', icon: BookOpen,  title: 'Экспорт для Notion (.md)',desc: 'Markdown с чекбоксами — импортируйте через «Import → Markdown»', color: '#000000', action: handleNotionExport },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-white dark:bg-[#13132b] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-slate-200/60 dark:shadow-black/40"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/8 bg-slate-50 dark:bg-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-slate-900 dark:text-white" style={{ fontWeight: 600 }}>Экспорт и публикация</h3>
            <p className="text-slate-400 dark:text-white/40 text-xs mt-0.5">{plan.phases.reduce((acc, p) => acc + p.tasks.length, 0)} задач</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {/* Export options */}
          {OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={opt.action}
              className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/8 hover:border-slate-300 dark:hover:border-white/20 hover:shadow-sm transition-all flex items-center gap-4 group"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${opt.color}12`, border: `1px solid ${opt.color}25` }}
              >
                {exported === opt.id
                  ? <Check className="w-5 h-5" style={{ color: opt.color }} />
                  : <opt.icon className="w-5 h-5" style={{ color: opt.color }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-slate-900 dark:text-white text-sm mb-0.5" style={{ fontWeight: 500 }}>
                  {exported === opt.id ? '✓ Скачано!' : opt.title}
                </div>
                <div className="text-slate-400 dark:text-white/40 text-xs">{opt.desc}</div>
              </div>
              <Download className="w-4 h-4 text-slate-300 dark:text-white/20 group-hover:text-slate-500 dark:group-hover:text-white/50 transition-colors shrink-0" />
            </button>
          ))}

          {/* Divider */}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-slate-200 dark:bg-white/8" />
            <span className="text-xs text-slate-400 dark:text-white/30">или</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-white/8" />
          </div>

          {/* Share link section */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-[#1d4ed8]/8 to-[#2563eb]/5 border-b border-slate-200 dark:border-white/8 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[#1d4ed8]" />
              <span className="text-sm text-slate-900 dark:text-white" style={{ fontWeight: 600 }}>Поделиться ссылкой</span>
            </div>
            <div className="p-4">
              {!shareUrl ? (
                <>
                  <p className="text-xs text-slate-500 dark:text-white/50 mb-3">
                    Создайте публичную ссылку — другие смогут просмотреть план в режиме чтения.
                  </p>
                  <button
                    onClick={handleShare}
                    disabled={shareLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-[#1d4ed8] to-[#2563eb] text-white text-sm hover:opacity-90 transition-all disabled:opacity-50 shadow-sm shadow-[#1d4ed8]/20"
                    style={{ fontWeight: 500 }}
                  >
                    {shareLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Создаём ссылку...</>
                      : <><Share2 className="w-4 h-4" /> Создать ссылку</>
                    }
                  </button>
                </>
              ) : (
                <AnimatePresence>
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <p className="text-xs text-[#10b981] mb-2 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Ссылка создана — действует бессрочно
                    </p>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-slate-50 dark:bg-white/8 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-600 dark:text-white/60 truncate">
                        {shareUrl}
                      </div>
                      <button
                        onClick={handleCopy}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-all ${
                          copied
                            ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]'
                            : 'bg-white dark:bg-white/8 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 hover:border-slate-300 dark:hover:border-white/20'
                        }`}
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Скопировано' : 'Копировать'}
                      </button>
                    </div>
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center gap-1 text-xs text-[#1d4ed8] hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Открыть в новой вкладке
                    </a>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}