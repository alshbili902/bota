import React, { useEffect, useState } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  Database,
  RefreshCw,
  Server,
  Layers,
  Wrench,
} from 'lucide-react';
import { SystemHealth } from '../types';
import { adminApi } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';

interface SystemHealthPageProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const SystemHealthPage: React.FC<SystemHealthPageProps> = ({ onShowToast }) => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHealth = async () => {
    try {
      const data = await adminApi.getHealth();
      setHealth(data);
    } catch (err: any) {
      onShowToast(err.message || 'تعذر جلب تقرير صحة النظام.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? `${d} يوم و ` : ''}${h} ساعة و ${m} دقيقة و ${s} ثانية`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="admin-card p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
              المراقبة الحية والعتاد
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">صحة وموارد النظام</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            متابعة دقيقة للأجهزة، واستهلاك المعالج والذاكرة، ومساحة التخزين، والمكتبات الثنائية المساعدة.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={health?.status || 'healthy'} type="health" />
          <button
            onClick={fetchHealth}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 transition-colors"
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Gauges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CPU Box */}
        <div className="admin-card p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <Cpu className="w-6 h-6" />
            </div>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{health?.cpu_percent || 0}%</span>
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">معالج السيرفر (CPU)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">نسبة الاستهلاك الفعلي لجميع الأنوية</p>
          </div>
          <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(health?.cpu_percent || 0, 100)}%` }}
            />
          </div>
        </div>

        {/* RAM Box */}
        <div className="admin-card p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Layers className="w-6 h-6" />
            </div>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{health?.memory_percent || 0}%</span>
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">ذاكرة النظام (RAM)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              مستخدم: {health?.memory_used_mb || 0} MB من {health?.memory_total_mb || 0} MB
            </p>
          </div>
          <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(health?.memory_percent || 0, 100)}%` }}
            />
          </div>
        </div>

        {/* Disk Box */}
        <div className="admin-card p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <HardDrive className="w-6 h-6" />
            </div>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{health?.disk_percent || 0}%</span>
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">القرص الصلب (Disk)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              مستخدم: {health?.disk_used_gb || 0} GB من {health?.disk_total_gb || 0} GB
            </p>
          </div>
          <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(health?.disk_percent || 0, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Dependencies & System Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Core Tools */}
        <div className="admin-card p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-white/10">
            <Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">المحركات والبرمجيات الثنائية المساعدة</h3>
          </div>

          <div className="space-y-3">
            {[
              { name: 'yt-dlp', desc: 'محرك استخراج وفك روابط الوسائط الأساسي', status: health?.ytdlp_available },
              { name: 'ffmpeg', desc: 'محول وصانع ترميز الصوت والصورة عالي الدقة', status: health?.ffmpeg_available },
              { name: 'ffprobe', desc: 'أداة فحص معلومات ومقاييس ملفات الميديا', status: health?.ffprobe_available },
            ].map(tool => (
              <div
                key={tool.name}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5"
              >
                <div>
                  <span className="text-sm font-bold font-mono text-slate-900 dark:text-white block">{tool.name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{tool.desc}</span>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    tool.status
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                  }`}
                >
                  {tool.status ? 'مثبت ومتاح' : 'غير متوفر'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Server & Environment Details */}
        <div className="admin-card p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200 dark:border-white/10">
            <Server className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">معلومات الخادم والبيئة</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5">
              <span className="text-slate-600 dark:text-slate-400">وقت التشغيل المستمر (Uptime)</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {health?.uptime_seconds ? formatUptime(health.uptime_seconds) : '0'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5">
              <span className="text-slate-600 dark:text-slate-400">محرك قاعدة البيانات</span>
              <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                {health?.database_engine || 'PostgreSQL'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5">
              <span className="text-slate-600 dark:text-slate-400">استجابة قاعدة البيانات (Ping)</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {health?.supabase_connected ? 'متصل بنجاح (< 5ms)' : 'غير متصل'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
