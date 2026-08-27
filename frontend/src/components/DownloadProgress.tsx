import React from 'react';
import { XCircle, AlertCircle, Gauge, Clock, HardDrive, FileCheck } from 'lucide-react';
import type { DownloadTask } from '../types';

interface DownloadProgressProps {
  tasks: DownloadTask[];
  onCancel: (taskId: string) => void;
}

export const DownloadProgressList: React.FC<DownloadProgressProps> = ({ tasks, onCancel }) => {
  if (tasks.length === 0) return null;

  return (
    <div className="w-full mt-6 space-y-4 animate-fade-in">
      <h3 className="text-base sm:text-lg font-black text-stone-800 dark:text-stone-200 px-1">
        التحميلات الحالية النشطة ({tasks.length})
      </h3>

      {tasks.map((task) => (
        <DownloadProgressCard key={task.id} task={task} onCancel={onCancel} />
      ))}
    </div>
  );
};

export const DownloadProgressCard: React.FC<{
  task: DownloadTask;
  onCancel: (taskId: string) => void;
}> = ({ task, onCancel }) => {
  const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed';
  const isCancelled = task.status === 'cancelled';
  const isProcessing = task.status === 'processing';
  const isQueued = task.status === 'queued';
  const isDownloading = task.status === 'downloading';

  return (
    <div className="w-full glass-panel p-5 sm:p-6 rounded-3xl shadow-soft border border-brand-200/40 dark:border-brand-900/30 transition-all">
      {/* Top Header info */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                isCompleted
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                  : isFailed
                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                  : isCancelled
                  ? 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-slateDark-800 dark:text-stone-300 dark:border-stone-700'
                  : 'bg-brand-100 text-brand-700 border-brand-200 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800'
              }`}
            >
              {isCompleted
                ? 'اكتمل التحميل'
                : isProcessing
                ? 'جاري المعالجة والدمج...'
                : isQueued
                ? 'في قائمة الانتظار'
                : isFailed
                ? 'فشل التحميل'
                : isCancelled
                ? 'تم الإلغاء'
                : 'جاري التحميل...'}
            </span>
            <span className="text-xs font-semibold text-stone-400 dark:text-stone-500">
              {task.source}
            </span>
          </div>

          <h4 className="text-sm sm:text-base font-black text-stone-900 dark:text-white truncate">
            {task.title || 'وسائط بدون عنوان'}
          </h4>
        </div>

        {/* Status Percentage Badge */}
        {!isCompleted && !isFailed && !isCancelled && (
          <div className="text-right shrink-0">
            <span className="text-xl sm:text-2xl font-black text-brand-600 dark:text-brand-400 font-display">
              {Math.round(task.progress)}%
            </span>
          </div>
        )}
      </div>

      {/* Animated Progress Bar */}
      {!isCompleted && !isFailed && !isCancelled && (
        <div className="w-full h-3 rounded-full bg-stone-200/70 dark:bg-slateDark-900/80 overflow-hidden mb-3.5 relative">
          <div
            className="h-full rounded-full gradient-brand transition-all duration-300 relative overflow-hidden"
            style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
          </div>
        </div>
      )}

      {/* Metrics Row: Speed, ETA, Downloaded Bytes */}
      {isDownloading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2 px-3 rounded-2xl bg-stone-100/70 dark:bg-slateDark-900/60 text-xs font-semibold text-stone-600 dark:text-stone-300 mb-4">
          {task.speed_text && (
            <div className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-brand-500 shrink-0" />
              <span>السرعة: {task.speed_text}</span>
            </div>
          )}
          {task.eta_text && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-brand-500 shrink-0" />
              <span>الوقت المتبقي: {task.eta_text}</span>
            </div>
          )}
          {task.downloaded_bytes > 0 && task.total_bytes > 0 && (
            <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
              <HardDrive className="w-3.5 h-3.5 text-brand-500 shrink-0" />
              <span>
                {Math.round(task.downloaded_bytes / (1024 * 1024))} MB / {Math.round(task.total_bytes / (1024 * 1024))} MB
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error Message if Failed */}
      {isFailed && task.error_message && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 mb-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{task.error_message}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-2">
        {/* Completed: Big Download Button */}
        {isCompleted && task.download_url && (
          <a
            href={task.download_url}
            download={task.filename || 'download'}
            className="flex-1 py-3 px-4 rounded-2xl gradient-brand text-white font-bold text-sm shadow-soft hover:shadow-lg transition-all flex items-center justify-center gap-2 text-center"
          >
            <FileCheck className="w-4 h-4" />
            <span>حفظ الملف في جهازك ({task.filename})</span>
          </a>
        )}

        {/* Cancel Button */}
        {!isCompleted && !isFailed && !isCancelled && (
          <button
            type="button"
            onClick={() => onCancel(task.id)}
            className="py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200/50 dark:border-rose-900/50 transition flex items-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>إلغاء التحميل</span>
          </button>
        )}
      </div>
    </div>
  );
};
