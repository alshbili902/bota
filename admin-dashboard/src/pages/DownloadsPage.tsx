import React, { useEffect, useState } from 'react';
import {
  Search,
  RefreshCw,
  Trash2,
  Ban,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
} from 'lucide-react';
import { DownloadItem, DownloadsResponse } from '../types';
import { adminApi } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';

interface DownloadsPageProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const DownloadsPage: React.FC<DownloadsPageProps> = ({ onShowToast }) => {
  const [data, setData] = useState<DownloadsResponse>({
    items: [],
    total: 0,
    page: 1,
    page_size: 15,
    total_pages: 1,
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDownloads = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getDownloads({
        page,
        page_size: 15,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search.trim() ? search.trim() : undefined,
      });
      setData(res);
    } catch (err: any) {
      onShowToast(err.message || 'فشل جلب سجل التحميلات.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDownloads();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDownloads();
  };

  const handleCancelDownload = async (taskId: string) => {
    try {
      await adminApi.cancelDownload(taskId);
      onShowToast('تم إلغاء التحميل بنجاح.', 'success');
      fetchDownloads();
    } catch (err: any) {
      onShowToast(err.message, 'error');
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك بحذف سجل التحميل هذا نهائيًا؟')) return;
    try {
      await adminApi.deleteDownload(id);
      onShowToast('تم حذف السجل بنجاح.', 'info');
      fetchDownloads();
    } catch (err: any) {
      onShowToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="admin-card p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
              العمليات الجارية والمكتملة
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">سجل وإدارة التحميلات</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            متابعة فورية لكافة ملفات الوسائط، وحالات التحميل، والتحكم الفوري بالإلغاء والحذف.
          </p>
        </div>

        <button
          onClick={fetchDownloads}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-sm font-semibold border border-slate-200 dark:border-white/10 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
          <span>تحديث السجل</span>
        </button>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="admin-card p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-100 dark:bg-black/40 rounded-xl border border-slate-200 dark:border-white/10">
          {[
            { id: 'all', label: 'كافة الحالات' },
            { id: 'completed', label: 'مكتملة' },
            { id: 'downloading', label: 'جارية' },
            { id: 'queued', label: 'بالانتظار' },
            { id: 'failed', label: 'فاشلة' },
            { id: 'cancelled', label: 'ملغاة' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالعنوان، الرابط، أو المستخدم..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
          />
          <button type="submit" className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <Search className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Downloads Table */}
      <div className="admin-card rounded-3xl overflow-hidden shadow-xl border border-slate-200 dark:border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-black/30 border-b border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-6">الملف / الفيديو</th>
                <th className="py-4 px-6">المستخدم</th>
                <th className="py-4 px-6">الحالة</th>
                <th className="py-4 px-6">الصيغة</th>
                <th className="py-4 px-6">الحجم</th>
                <th className="py-4 px-6">التاريخ</th>
                <th className="py-4 px-6 text-center">التحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-sm">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    {search ? 'لا توجد سجلات تحميل مطابقة للبحث.' : 'لا توجد عمليات تحميل حتى الآن.'}
                  </td>
                </tr>
              ) : (
                data.items.map((item: DownloadItem) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-6 max-w-xs">
                      <div className="space-y-1">
                        <p className="font-bold text-slate-900 dark:text-white truncate" title={item.title || item.url}>
                          {item.title || 'فيديو بدون عنوان'}
                        </p>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 truncate font-mono"
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{item.url}</span>
                        </a>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                        @{item.user_id}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <StatusBadge status={item.status} type="download" />
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs font-mono font-semibold uppercase px-2 py-1 rounded bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                        {item.format || 'MP4'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-600 dark:text-slate-400 font-mono">
                      {item.file_size_mb ? `${item.file_size_mb.toFixed(1)} MB` : 'غير محدد'}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-400">
                      {item.started_at
                        ? new Date(item.started_at).toLocaleDateString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'حديثًا'}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {['downloading', 'queued', 'processing'].includes(item.status) && (
                          <button
                            onClick={() => handleCancelDownload(item.id)}
                            className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-400 transition-colors"
                            title="إلغاء التحميل فورًا"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteRecord(item.id)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-white/5 dark:hover:bg-rose-500/20 dark:hover:text-rose-400 text-slate-600 dark:text-slate-400 transition-colors"
                          title="حذف السجل"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-slate-100/60 dark:bg-black/20 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <div>
            إجمالي السجلات: <strong className="text-slate-900 dark:text-white">{data.total}</strong> | صفحة{' '}
            <strong className="text-slate-900 dark:text-white">{data.page}</strong> من{' '}
            <strong className="text-slate-900 dark:text-white">{data.total_pages}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(p + 1, data.total_pages))}
              disabled={page >= data.total_pages}
              className="p-1.5 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
