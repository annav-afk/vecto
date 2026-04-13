export type Priority = 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type RecurrenceInterval = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface TaskComment {
  id: string;
  text: string;
  created_at: string; // ISO
  author?: string;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  phase_id: string;
  title: string;
  description?: string;
  duration_hours: number;
  priority: Priority;
  depends_on: string[];
  status: TaskStatus;
  start_date: string;
  end_date: string;
  // Recurrence
  recurring?: boolean;
  recurrence_interval?: RecurrenceInterval;
  // Time tracking
  tracked_seconds?: number;
  timer_start?: string; // ISO timestamp when timer started
  // Comments / notes
  comments?: TaskComment[];
  // Custom fields
  tags?: string[];
  link_url?: string;
  difficulty?: 1 | 2 | 3 | 4 | 5;
  // Subtasks (checklist)
  subtasks?: Subtask[];
  // Streak (for recurring tasks)
  streak?: number;
  last_completed_date?: string; // YYYY-MM-DD
}

export interface Phase {
  id: string;
  name: string;
  duration_days: number;
  color: string;
  tasks: Task[];
  start_date: string;
  end_date: string;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  target_date: string;
  phase_id?: string;        // linked to end of this phase
  criteria: string[];       // what "done" means
  reached: boolean;
  reached_date?: string;
}

export interface Plan {
  id: string;
  goal: string;
  deadline: string;
  hours_per_week: number;
  total_days: number;
  phases: Phase[];
  milestones?: Milestone[];
  created_at: string;
}