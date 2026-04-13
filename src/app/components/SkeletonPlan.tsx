import { motion } from 'motion/react';

function SkeletonBox({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-slate-200 dark:bg-white/8 rounded-lg ${className}`}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 dark:via-white/5 to-transparent"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

export function SkeletonPlan() {
  return (
    <div className="min-h-screen bg-[#f0f9ff] dark:bg-[#060d1e]">
      {/* Navbar skeleton */}
      <div className="sticky top-0 z-40 border-b border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#060d1e]/95 h-14 flex items-center px-6 gap-4">
        <SkeletonBox className="w-24 h-5" />
        <div className="w-px h-5 bg-slate-200 dark:bg-white/10" />
        <SkeletonBox className="w-48 h-5" />
        <div className="ml-auto flex items-center gap-2">
          <SkeletonBox className="w-40 h-8 rounded-xl" />
          <SkeletonBox className="w-20 h-8 rounded-xl" />
          <SkeletonBox className="w-20 h-8 rounded-xl" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm flex items-center gap-3">
              <SkeletonBox className="w-9 h-9 rounded-lg shrink-0" />
              <div className="space-y-1.5 flex-1">
                <SkeletonBox className="w-16 h-3" />
                <SkeletonBox className="w-10 h-4" />
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mb-5">
          <div className="flex justify-between mb-1.5">
            <SkeletonBox className="w-24 h-3" />
            <SkeletonBox className="w-8 h-3" />
          </div>
          <SkeletonBox className="w-full h-2 rounded-full" />
        </div>

        {/* Search bar */}
        <div className="flex gap-2 mb-5">
          <SkeletonBox className="flex-1 h-9 rounded-xl" />
          <SkeletonBox className="w-24 h-9 rounded-xl" />
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Sidebar skeleton */}
          <div className="space-y-2">
            <SkeletonBox className="w-20 h-3 mb-3" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm space-y-2">
                <div className="flex items-center gap-2">
                  <SkeletonBox className="w-2.5 h-2.5 rounded-full shrink-0" />
                  <SkeletonBox className="flex-1 h-3.5" />
                </div>
                <SkeletonBox className="w-full h-1.5 rounded-full" />
              </div>
            ))}
          </div>

          {/* Main view skeleton */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <SkeletonBox className="w-40 h-4 shrink-0" />
                <div
                  className="h-6 rounded-full overflow-hidden"
                  style={{ flex: 1, marginLeft: `${i * 5}%`, width: `${40 + i * 10}%` }}
                >
                  <SkeletonBox className="w-full h-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}