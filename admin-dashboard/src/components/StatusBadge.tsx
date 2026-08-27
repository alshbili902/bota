import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'download' | 'health' | 'user' | 'error';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'download' }) => {
  const getBadgeConfig = () => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'healthy':
      case 'active':
      case 'resolved':
      case 'true':
        return {
          bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-400',
          label: status === 'true' || status === 'active' ? 'نشط' : status === 'completed' ? 'مكتمل' : status === 'resolved' ? 'تم الحل' : 'سليم',
        };
      case 'downloading':
      case 'processing':
      case 'analyzing':
        return {
          bg: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
          dot: 'bg-blue-400 animate-pulse',
          label: status === 'downloading' ? 'جارِ التحميل' : status === 'processing' ? 'معالجة' : 'فحص الرابط',
        };
      case 'queued':
        return {
          bg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-400',
          label: 'في الانتظار',
        };
      case 'failed':
      case 'critical':
      case 'false':
        return {
          bg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
          dot: 'bg-rose-400',
          label: status === 'false' ? 'معطل' : status === 'failed' ? 'فشل' : 'حرج',
        };
      case 'cancelled':
      case 'ignored':
        return {
          bg: 'bg-slate-500/15 border-slate-500/30 text-slate-400',
          dot: 'bg-slate-400',
          label: status === 'cancelled' ? 'ملغي' : 'تم التجاهل',
        };
      case 'warning':
        return {
          bg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-400',
          label: 'تحذير',
        };
      default:
        return {
          bg: 'bg-slate-500/15 border-slate-500/30 text-slate-300',
          dot: 'bg-slate-400',
          label: status,
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};
