import React, { useEffect, useState } from 'react';
import {
  Users,
  DownloadCloud,
  CheckCircle2,
  XCircle,
  HardDrive,
  AlertTriangle,
  RefreshCw,
  Power,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import { DashboardStats, SystemHealth } from '../types';
import { adminApi } from '../services/api';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { AdminTab } from '../components/Sidebar';

interface OverviewPageProps {
  onNavigate: (tab: AdminTab) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate, onShowToast }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [s, h] = await Promise.all([adminApi.getStats(), adminApi.getHealth()]);
      setStats(s);
      setHealth(h);
    } catch (err: any) {
      onShowToast(err.message || 'فشل جلب إحصائيات النظام.', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // 10s live poll
    return () => clearInterval(interval);
  }, []);

  const handleToggleMaintenance = async () => {
    if (!stats) return;
    try {
      const current = await adminApi.getSettings();
      const updated = await adminApi.updateSettings({
        maintenance_mode: !current.maintenance_mode,
      });
      setStats(prev => (prev ? { ...prev, maintenance_mode: updated.maintenance_mode } : null));
      onShowToast(
        updated.maintenance_mode ? 'تم تفعيل وضع الصيانة بنجاح.' : 'تم إيقاف وضع الصيانة.',
        'success'
      );
    } catch (err: any) {
      onShowToast(err.message, 'error');
    }
  };

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-blue-500 font-medium">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span>جارِ تحميل لوحة التحكم...</span>
        </div>
      </div>
    );
  }

  const hasDownloads = Boolean(stats && stats.total_downloads > 0);
  const successRate = hasDownloads
    ? Math.round((stats!.successful_downloads / stats!.total_downloads) * 100)
    : null;

  return (
    <div className="space-y-8">
      {/* Top Banner with Quick Actions */}
      <div className="admin-card p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
              نظرة عامة وتنفيذية
            </span>
            {stats?.maintenance_mode && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                وضع الصيانة قيد التشغيل
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">منصة رهامي الرقمية الفاخرة</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            إدارة مركزية شاملة للمستخدمين، وسرعة التحميل، واستهلاك الموارد، وقاعدة البيانات.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <button
            onClick={() => {
              setIsRefreshing(true);
              fetchData();
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-sm font-semibold border border-slate-200 dark:border-white/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
            <span>تحديث فوري</span>
          </button>

          <button
            onClick={handleToggleMaintenance}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
              stats?.maintenance_mode
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{stats?.maintenance_mode ? 'إيقاف الصيانة' : 'تفعيل الصيانة'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="المستخدمين المعتمدين"
          value={stats?.total_users ?? 0}
          subtitle={stats ? `${stats.active_users} نشط حاليًا` : 'لا يوجد مستخدمون'}
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="إجمالي التحميلات"
          value={stats?.total_downloads ?? 0}
          subtitle={hasDownloads ? `نسبة النجاح ${successRate}%` : 'لا توجد عمليات تحميل حتى الآن'}
          icon={DownloadCloud}
          color="blue"
        />
        <StatCard
          title="التحميلات الناجحة"
          value={stats?.successful_downloads ?? 0}
          subtitle={hasDownloads ? `${stats!.failed_downloads} عملية فاشلة` : 'لا توجد عمليات مسجلة'}
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="المساحة المستخدمة"
          value={`${stats?.storage_used_mb ?? 0} MB`}
          subtitle={stats && stats.active_downloads > 0 ? `التحميلات الجارية: ${stats.active_downloads}` : 'لا توجد تحميلات جارية'}
          icon={HardDrive}
          color="amber"
        />
      </div>

      {/* Main Content Grid: System Telemetry & Quick Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Telemetry Gauge Card */}
        <div className="admin-card p-6 rounded-3xl lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">صحة النظام والموارد المباشرة</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">بيانات الأجهزة والمعالجة الحية</p>
              </div>
            </div>
            <StatusBadge status={health?.status || 'healthy'} type="health" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* CPU */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-medium">
                <span>المعالج (CPU)</span>
                <span className="font-bold text-slate-900 dark:text-white">{health?.cpu_percent || 0}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(health?.cpu_percent || 0, 100)}%` }}
                />
              </div>
            </div>

            {/* RAM */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-medium">
                <span>الذاكرة (RAM)</span>
                <span className="font-bold text-slate-900 dark:text-white">{health?.memory_percent || 0}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(health?.memory_percent || 0, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500">
                {health?.memory_used_mb || 0} MB من أصل {health?.memory_total_mb || 0} MB
              </p>
            </div>

            {/* Disk */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-medium">
                <span>القرص التخزيني</span>
                <span className="font-bold text-slate-900 dark:text-white">{health?.disk_percent || 0}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(health?.disk_percent || 0, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500">
                {health?.disk_used_gb || 0} GB من أصل {health?.disk_total_gb || 0} GB
              </p>
            </div>
          </div>

          {/* Engine & Tools Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">محرك yt-dlp</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">جاهز ويعمل</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">محول FFmpeg</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">جاهز ومتاح</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">قاعدة البيانات</span>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {health?.database_engine.includes('Supabase') ? 'Supabase Cloud' : 'SQLite (محلي)'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">وقت التشغيل</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {health?.uptime_seconds ? `${Math.round(health.uptime_seconds / 60)} دقيقة` : '0'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Shortcuts Card */}
        <div className="admin-card p-6 rounded-3xl space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">إجراءات سريعة</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">اختصارات للانتقال المباشر لأهم الأقسام</p>

            <div className="space-y-2">
              <button
                onClick={() => onNavigate('users')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-white/5"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>إدارة المستخدمين وحساباتهم</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => onNavigate('downloads')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-white/5"
              >
                <div className="flex items-center gap-2.5">
                  <DownloadCloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>مراقبة سجل التحميلات</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => onNavigate('errors')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-white/5"
              >
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>فحص مركز الأخطاء</span>
                </div>
                <span className="text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 px-2 py-0.5 rounded-full">
                  {stats?.total_errors || 0}
                </span>
              </button>

              <button
                onClick={() => onNavigate('settings')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-white/5"
              >
                <div className="flex items-center gap-2.5">
                  <Power className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>إعدادات الموقع وتحديد الأحجام</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/20 text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            المنصة تعمل بنظام الأمان الصارم، وتتيح التحكم الفوري في عمليات التنزيل دون الحاجة لإعادة تشغيل الخادم.
          </div>
        </div>
      </div>
    </div>
  );
};
