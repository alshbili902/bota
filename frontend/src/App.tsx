import React, { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { LoginForm } from './components/LoginForm';
import { DownloaderCard } from './components/DownloaderCard';
import { MediaPreview } from './components/MediaPreview';
import { DownloadProgressList } from './components/DownloadProgress';
import { DownloadHistory } from './components/DownloadHistory';
import { SettingsModal } from './components/SettingsModal';
import { ToastContainer } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { api } from './services/api';
import { wsService } from './services/websocket';
import type { MediaMetadata, MediaFormat, DownloadTask } from './types';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'downloader' | 'history'>('downloader');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Downloader state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
  const [activeTasks, setActiveTasks] = useState<DownloadTask[]>([]);
  const [isStartingDownload, setIsStartingDownload] = useState(false);

  // Toast notifications state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Subscribe to real-time WebSocket events
  useEffect(() => {
    if (!user) return;

    const unsubscribe = wsService.subscribe((event) => {
      if (event.task_id) {
        setActiveTasks((prevTasks) => {
          const index = prevTasks.findIndex((t) => t.id === event.task_id);
          if (index === -1) return prevTasks;

          const updatedTask = {
            ...prevTasks[index],
            status: event.status || prevTasks[index].status,
            progress: event.progress !== undefined ? event.progress : prevTasks[index].progress,
            speed_text: event.speed_text !== undefined ? event.speed_text : prevTasks[index].speed_text,
            eta_text: event.eta_text !== undefined ? event.eta_text : prevTasks[index].eta_text,
            filename: event.filename || prevTasks[index].filename,
            download_url: event.download_url || prevTasks[index].download_url,
            error_message: event.error_message || prevTasks[index].error_message,
          };

          const newTasks = [...prevTasks];
          newTasks[index] = updatedTask;
          return newTasks;
        });

        if (event.status === 'completed') {
          addToast('success', `اكتمل تحميل الملف: ${event.filename || ''}`);
        } else if (event.status === 'failed') {
          addToast('error', event.error_message || 'تعذر استكمال التحميل.');
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  const handleAnalyze = async (url: string) => {
    setIsAnalyzing(true);
    setMetadata(null);
    try {
      const data = await api.analyzeUrl(url);
      setMetadata(data);
      addToast('success', 'تم فحص الرابط بنجاح وجلب الصيغ المتاحة.');
    } catch (err: any) {
      addToast('error', err.message || 'تعذر فحص هذا الرابط.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartDownload = async (format: MediaFormat) => {
    if (!metadata) return;

    setIsStartingDownload(true);
    try {
      const task = await api.startDownload({
        url: metadata.url,
        format_id: format.format_id,
        format_type: format.format_type,
        title: metadata.title,
        thumbnail: metadata.thumbnail,
        source: metadata.source,
      });

      setActiveTasks((prev) => [task, ...prev]);
      addToast('info', 'تمت إضافة المهمة إلى قائمة التحميل.');
      // Scroll to progress
      window.scrollTo({ top: 400, behavior: 'smooth' });
    } catch (err: any) {
      addToast('error', err.message || 'تعذر بدء التحميل.');
    } finally {
      setIsStartingDownload(false);
    }
  };

  const handleCancelDownload = async (taskId: string) => {
    try {
      await api.cancelDownload(taskId);
      setActiveTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'cancelled' } : t))
      );
      addToast('info', 'تم إلغاء عملية التحميل.');
    } catch (err: any) {
      addToast('error', err.message || 'تعذر إلغاء التحميل.');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-slateDark-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-brand flex items-center justify-center text-white shadow-soft animate-pulse">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <span className="text-sm font-bold text-stone-500 dark:text-stone-400">
            جاري فتح مساحتك الخاصة...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginForm />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-slateDark-950 text-stone-900 dark:text-stone-100 transition-colors">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 sm:py-12">
        {activeTab === 'downloader' ? (
          <div className="space-y-6">
            <DownloaderCard
              onAnalyze={handleAnalyze}
              isLoading={isAnalyzing}
              onToast={addToast}
            />

            {metadata && (
              <MediaPreview
                metadata={metadata}
                onStartDownload={handleStartDownload}
                isStarting={isStartingDownload}
              />
            )}

            <DownloadProgressList
              tasks={activeTasks}
              onCancel={handleCancelDownload}
            />
          </div>
        ) : (
          <DownloadHistory onToast={addToast} />
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-brand-200/20 dark:border-brand-900/20 text-center text-xs font-medium text-stone-400 dark:text-stone-600">
        <p>رهامي — Rahami &bull; مساحتك الخاصة للتحميل الشخصي الآمن</p>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};
