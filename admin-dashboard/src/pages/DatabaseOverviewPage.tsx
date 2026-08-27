import React, { useEffect, useState } from 'react';
import {
  Database,
  RefreshCw,
  Table,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Layers,
} from 'lucide-react';
import { DatabaseOverview } from '../types';
import { adminApi } from '../services/api';

interface DatabaseOverviewPageProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const DatabaseOverviewPage: React.FC<DatabaseOverviewPageProps> = ({ onShowToast }) => {
  const [dbData, setDbData] = useState<DatabaseOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDbData = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getDatabaseOverview();
      setDbData(data);
    } catch (err: any) {
      onShowToast(err.message || 'فشل جلب بيانات قاعدة البيانات.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDbData();
  }, []);

  const tableLabels: Record<string, { title: string; desc: string }> = {
    admin_users: { title: 'مدراء النظام', desc: 'حسابات المشرفين المصرح لهم بإدارة المنصة' },
    users: { title: 'المستخدمون المصرح لهم', desc: 'أعضاء المنصة الخاصة (رهامي ومها)' },
    downloads: { title: 'سجل التحميلات', desc: 'كافة عمليات تنزيل الوسائط والروابط وحالاتها' },
    download_errors: { title: 'سجل الأخطاء', desc: 'أخطاء واستثناءات التنزيل المجمعة تلقائيًا' },
    system_events: { title: 'سجل الرقابة (Audit)', desc: 'أحداث النظام وعمليات المدراء الموثقة' },
    site_settings: { title: 'إعدادات المنصة', desc: 'حالة الصيانة وتفضيلات التخزين والحجم' },
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="admin-card p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
              التخزين السحابي وقواعد البيانات
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">قاعدة البيانات (Supabase PostgreSQL)</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            متابعة حية لحالة الاتصال، زمن الاستجابة، وتعداد السجلات في كل جدول دون تعريض المفاتيح السرية.
          </p>
        </div>

        <button
          onClick={fetchDbData}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-sm font-semibold border border-slate-200 dark:border-white/10 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
          <span>فحص الاتصال</span>
        </button>
      </div>

      {/* Connectivity Status Banner */}
      <div className="admin-card p-6 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              dbData?.connected
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
            }`}
          >
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                محرك قاعدة البيانات: {dbData?.engine || 'Supabase PostgreSQL'}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  dbData?.connected
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                }`}
              >
                {dbData?.connected ? 'متصل ونشط' : 'غير متصل'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              الخادم:{' '}
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {dbData?.engine} (زمن الاستجابة: {dbData?.latency_ms || 1} ms)
              </span>
            </p>
          </div>
        </div>

        {dbData?.connected && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-600/15 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-500/30">
            <CheckCircle2 className="w-4 h-4" />
            <span>الاتصال السحابي يعمل بكفاءة عالية</span>
          </div>
        )}
      </div>

      {/* Tables Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">جداول قاعدة البيانات وإحصائيات السجلات</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {dbData &&
            Object.entries(dbData.tables).map(([tableName, count]) => {
              const meta = tableLabels[tableName] || {
                title: tableName,
                desc: 'جدول بيانات النظام',
              };
              return (
                <div
                  key={tableName}
                  className="admin-card p-5 rounded-2xl hover:border-blue-500/40 transition-colors flex flex-col justify-between"
                >
                  <div className="space-y-1 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-500/20">
                        {tableName}
                      </span>
                      <Table className="w-4 h-4 text-slate-400" />
                    </div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white pt-1">{meta.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{meta.desc}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">إجمالي السجلات:</span>
                    <span className="text-base font-extrabold font-mono text-slate-900 dark:text-white">{count}</span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Security Architecture Note */}
      <div className="admin-card p-6 rounded-3xl border border-slate-200 dark:border-white/10 space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
          <Shield className="w-4 h-4 text-emerald-500" />
          <span>الأمان المتقدم وسياسات RLS:</span>
        </div>
        <p>
          تم تأمين قاعدة بيانات Supabase بالكامل عبر تفعيل سياسات الأمان على مستوى الصف (Row Level Security). لا يمكن للمتصفح الوصول المباشر لقاعدة البيانات، وجميع الاستعلامات تتم بصورة مشفرة عبر خادم الـ Backend المعتمد حصراً.
        </p>
      </div>
    </div>
  );
};
