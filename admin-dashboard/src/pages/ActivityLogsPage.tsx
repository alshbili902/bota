import React, { useEffect, useState } from 'react';
import { FileText, RefreshCw, Clock, Globe, Shield, User } from 'lucide-react';
import { AuditLog } from '../types';
import { adminApi } from '../services/api';

interface ActivityLogsPageProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const ActivityLogsPage: React.FC<ActivityLogsPageProps> = ({ onShowToast }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getActivityLogs(1, 100);
      setLogs(data.items || []);
    } catch (err: any) {
      onShowToast(err.message || 'فشل جلب سجل العمليات الرقابية.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionBadgeColor = (action: string) => {
    if (action.includes('LOGIN')) return 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border-blue-200 dark:border-blue-500/30';
    if (action.includes('PASSWORD') || action.includes('LOCKOUT')) return 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-amber-200 dark:border-amber-500/30';
    if (action.includes('DELETE') || action.includes('CANCEL')) return 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 border-rose-200 dark:border-rose-500/30';
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="admin-card p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
              التدقيق والأمان
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">سجل العمليات والرقابة (Audit Trail)</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            سجل تدقيق أمني غير قابل للتعديل يوثق كافة الإجراءات الإدارية، وتغيير الإعدادات، وتسجيل الدخول.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-sm font-semibold border border-slate-200 dark:border-white/10 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
          <span>تحديث السجل</span>
        </button>
      </div>

      {/* Logs Timeline List */}
      <div className="admin-card rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-white/10">
        {logs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            لا يوجد نشاط حتى الآن.
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map(log => (
              <div
                key={log.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-100/60 dark:hover:bg-black/40 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-200/80 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-400 flex-shrink-0 mt-0.5">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border ${getActionBadgeColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                      {log.admin_username && (
                        <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          {log.admin_username}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-800 dark:text-slate-200">
                      {log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)) : log.target || log.action}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0 self-end sm:self-center">
                  {log.ip_address && (
                    <span className="flex items-center gap-1 font-mono">
                      <Globe className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      {log.ip_address}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    {new Date(log.created_at).toLocaleDateString('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
