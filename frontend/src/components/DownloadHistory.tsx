import React, { useEffect, useState } from 'react';
import { History, Trash2, Download, HardDrive, Loader2, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import type { HistoryItem } from '../types';

interface DownloadHistoryProps {
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const DownloadHistory: React.FC<DownloadHistoryProps> = ({ onToast }) => {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const data = await api.getHistory();
      setItems(data);
    } catch {
      onToast('error', 'تعذر جلب سجل التحميلات.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.deleteHistoryItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      onToast('success', 'تم حذف السجل بنجاح.');
    } catch {
      onToast('error', 'تعذر حذف هذا السجل.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6 px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center text-white">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-stone-900 dark:text-white font-display">
              سجل تحميلاتي الخاص
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
              محفوظاتك الشخصية معزولة تمامًا ولا يمكن لأحد غيرك رؤيتها
            </p>
          </div>
        </div>

        <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-brand-100 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 border border-brand-200/50 dark:border-brand-800/50">
          {items.length} ملف
        </span>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-stone-400">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-3" />
          <p className="text-sm font-medium">جاري تحميل السجل...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center glass-panel rounded-3xl border border-brand-200/40 dark:border-brand-900/30 p-8">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-brand-50 dark:bg-slateDark-900 flex items-center justify-center text-brand-400 mb-3">
            <Sparkles className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-stone-800 dark:text-stone-200 mb-1">
            لا توجد تحميلات سابقة بعد
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs mx-auto">
            الملفات التي تقومين بتحميلها ستظهر هنا لتتمكني من الرجوع إليها وإدارتها بسهولة.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="glass-panel p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-md transition-all border border-brand-200/30 dark:border-brand-900/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-stone-100 dark:bg-slateDark-800 text-stone-600 dark:text-stone-300">
                    {item.source}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
                    {item.format}
                  </span>
                  <span className="text-[11px] text-stone-400 dark:text-stone-500 font-medium">
                    {item.completed_at.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>

                <h4 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white truncate">
                  {item.title}
                </h4>

                <div className="flex items-center gap-4 mt-1 text-xs text-stone-500 dark:text-stone-400">
                  <span className="flex items-center gap-1 font-medium">
                    <HardDrive className="w-3.5 h-3.5 text-brand-500" />
                    {item.file_size_mb} MB
                  </span>
                  <span className="truncate max-w-xs text-[11px] text-stone-400">
                    {item.filename}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-brand-200/20 dark:border-brand-900/20">
                {item.download_url && (
                  <a
                    href={item.download_url}
                    download={item.filename}
                    className="p-2.5 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-slateDark-800 dark:hover:bg-slateDark-750 text-brand-700 dark:text-brand-300 border border-brand-200/50 dark:border-brand-800/50 transition"
                    title="تحميل الملف مجددًا"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/50 transition disabled:opacity-50"
                  title="حذف من السجل"
                >
                  {deletingId === item.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
