import React from 'react';

const Sk: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white/5 rounded-xl animate-pulse ${className}`} />
);

const SkeletonDashboard: React.FC = () => (
  <div className="space-y-4">
    {/* Hero skeleton */}
    <div className="bg-[#16191f] border border-white/5 rounded-2xl overflow-hidden">
      <Sk className="h-40 rounded-none" />
      <div className="p-6 flex items-center gap-4">
        <Sk className="w-20 h-20 flex-shrink-0 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Sk className="h-6 w-48" />
          <Sk className="h-4 w-32" />
        </div>
      </div>
    </div>

    {/* Completion skeleton */}
    <Sk className="h-16 w-full" />

    {/* Stats grid skeleton */}
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Sk key={i} className="h-24" />
      ))}
    </div>

    {/* Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Sk key={i} className="h-52" />
      ))}
    </div>
  </div>
);

export default SkeletonDashboard;
