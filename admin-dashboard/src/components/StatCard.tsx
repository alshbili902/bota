import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
}) => {
  const colorMap = {
    blue: {
      border: 'hover:border-blue-500/50',
      iconBg: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
    },
    emerald: {
      border: 'hover:border-emerald-500/50',
      iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    },
    amber: {
      border: 'hover:border-amber-500/50',
      iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    },
    rose: {
      border: 'hover:border-rose-500/50',
      iconBg: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
    },
    indigo: {
      border: 'hover:border-indigo-500/50',
      iconBg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
    },
  }[color];

  return (
    <div
      className={`admin-card p-6 rounded-3xl transition-all duration-300 ${colorMap.border} shadow-lg`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-3xl font-extrabold mt-2 tracking-tight text-slate-900 dark:text-white">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3.5 rounded-2xl ${colorMap.iconBg} shadow-inner`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};
