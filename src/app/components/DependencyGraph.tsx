import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, GitBranch, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Plan, Task } from '../lib/types';

interface Props {
  plan: Plan;
  onTaskClick?: (task: Task) => void;
  onClose: () => void;
}

interface NodePos {
  id: string;
  x: number;
  y: number;
  task: Task;
  phaseColor: string;
  phaseName: string;
}

const STATUS_COLORS: Record<string, string> = { todo: '#94a3b8', in_progress: '#1d4ed8', done: '#10b981' };
const PRIORITY_RING: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };

export function DependencyGraph({ plan, onTaskClick, onClose }: Props) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // Build node positions
  const { nodes, edges } = useMemo(() => {
    const allNodes: NodePos[] = [];
    const allEdges: { from: string; to: string }[] = [];
    const nodeW = 180;
    const nodeH = 60;
    const phaseGap = 40;
    const taskGap = 20;

    let yOffset = 40;
    plan.phases.forEach(phase => {
      let xOffset = 40;
      phase.tasks.forEach(task => {
        allNodes.push({
          id: task.id,
          x: xOffset,
          y: yOffset,
          task,
          phaseColor: phase.color,
          phaseName: phase.name,
        });
        task.depends_on.forEach(depId => {
          allEdges.push({ from: depId, to: task.id });
        });
        xOffset += nodeW + taskGap;
      });
      yOffset += nodeH + phaseGap;
    });

    return { nodes: allNodes, edges: allEdges };
  }, [plan]);

  // Only show graph if there are dependencies
  const hasDeps = edges.length > 0;

  const nodeMap = useMemo(() => {
    const map = new Map<string, NodePos>();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Get highlighted edges (connected to hovered node)
  const highlightedEdges = useMemo(() => {
    if (!hoveredId) return new Set<number>();
    const set = new Set<number>();
    edges.forEach((e, i) => {
      if (e.from === hoveredId || e.to === hoveredId) set.add(i);
    });
    return set;
  }, [hoveredId, edges]);

  // Pan handlers (mouse & touch)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      dragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPan(p => ({ x: p.x + e.clientX - lastMouse.current.x, y: p.y + e.clientY - lastMouse.current.y }));
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseUp = () => { dragging.current = false; };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragging.current = true;
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || e.touches.length !== 1) return;
    e.preventDefault();
    setPan(p => ({ x: p.x + e.touches[0].clientX - lastMouse.current.x, y: p.y + e.touches[0].clientY - lastMouse.current.y }));
    lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = () => { dragging.current = false; };

  const totalW = Math.max(...nodes.map(n => n.x + 220), 600);
  const totalH = Math.max(...nodes.map(n => n.y + 100), 400);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl bg-white dark:bg-[#13132b] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ height: 'min(80vh, 600px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1d4ed8]/10 flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-[#1d4ed8]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Граф зависимостей</h2>
              <p className="text-xs text-slate-400 dark:text-white/40">
                {nodes.length} задач · {edges.length} зависимостей
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.max(0.4, z - 0.15))}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.15))}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
              <Maximize2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Graph area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {!hasDeps ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <GitBranch className="w-12 h-12 text-slate-300 dark:text-white/15 mb-4" />
              <p className="text-sm text-slate-500 dark:text-white/50 font-medium mb-1">Нет зависимостей между задачами</p>
              <p className="text-xs text-slate-400 dark:text-white/30 max-w-xs">
                Откройте задачу и добавьте зависимость через поле «Зависит от». Граф покажет связи между задачами.
              </p>
            </div>
          ) : (
            <div
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transformOrigin: '0 0',
                width: totalW,
                height: totalH,
                position: 'relative',
              }}
            >
              {/* SVG edges */}
              <svg className="absolute inset-0" style={{ width: totalW, height: totalH, pointerEvents: 'none' }}>
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#1d4ed8" opacity="0.5" />
                  </marker>
                  <marker id="arrowhead-hl" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#1d4ed8" />
                  </marker>
                </defs>
                {edges.map((edge, i) => {
                  const from = nodeMap.get(edge.from);
                  const to = nodeMap.get(edge.to);
                  if (!from || !to) return null;
                  const hl = highlightedEdges.has(i);
                  const x1 = from.x + 90;
                  const y1 = from.y + 25;
                  const x2 = to.x + 90;
                  const y2 = to.y + 25;
                  const midX = (x1 + x2) / 2;
                  const midY = (y1 + y2) / 2;
                  const cx = midX + (y2 - y1) * 0.15;
                  const cy = midY - (x2 - x1) * 0.15;
                  return (
                    <path
                      key={i}
                      d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                      fill="none"
                      stroke="#1d4ed8"
                      strokeWidth={hl ? 2.5 : 1.5}
                      strokeOpacity={hl ? 0.8 : 0.2}
                      markerEnd={hl ? 'url(#arrowhead-hl)' : 'url(#arrowhead)'}
                      strokeDasharray={hl ? undefined : '4 2'}
                      style={{ transition: 'stroke-opacity 0.2s, stroke-width 0.2s' }}
                    />
                  );
                })}
              </svg>

              {/* Task nodes */}
              {nodes.map(node => {
                const isHovered = hoveredId === node.id;
                const isConnected = edges.some(e => (e.from === hoveredId && e.to === node.id) || (e.to === hoveredId && e.from === node.id));
                const dimmed = hoveredId && !isHovered && !isConnected;
                return (
                  <div
                    key={node.id}
                    className="absolute transition-all duration-200"
                    style={{
                      left: node.x,
                      top: node.y,
                      width: 180,
                      opacity: dimmed ? 0.3 : 1,
                      transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                    }}
                    onMouseEnter={() => setHoveredId(node.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => onTaskClick?.(node.task)}
                  >
                    <div
                      className="p-2.5 rounded-xl border cursor-pointer hover:shadow-md transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.95)',
                        borderColor: isHovered ? node.phaseColor : 'rgba(0,0,0,0.08)',
                        boxShadow: isHovered ? `0 0 0 2px ${node.phaseColor}30` : undefined,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[node.task.status] }} />
                        <span className="text-[10px] text-slate-400 truncate">{node.phaseName}</span>
                      </div>
                      <p className={`text-xs font-medium leading-snug truncate ${
                        node.task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'
                      }`}>
                        {node.task.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: PRIORITY_RING[node.task.priority] }} />
                        <span className="text-[10px] text-slate-400">{node.task.duration_hours}ч</span>
                        {node.task.depends_on.length > 0 && (
                          <span className="text-[10px] text-[#1d4ed8]">← {node.task.depends_on.length}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-t border-slate-100 dark:border-white/8 text-[10px] text-slate-400 dark:text-white/30 shrink-0">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-400" /> К выполнению</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#1d4ed8]" /> В процессе</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#10b981]" /> Готово</div>
          <div className="flex-1" />
          <span>Перетаскивайте для навигации · Scroll для зума</span>
        </div>
      </motion.div>
    </div>
  );
}
