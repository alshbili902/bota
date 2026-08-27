import React, { useState } from 'react';
import { Link2, ClipboardPaste, ArrowRight, Loader2, Sparkles } from 'lucide-react';

interface DownloaderCardProps {
  onAnalyze: (url: string) => Promise<void>;
  isLoading: boolean;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const DownloaderCard: React.FC<DownloaderCardProps> = ({
  onAnalyze,
  isLoading,
  onToast,
}) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      onToast('error', 'يرجى إدخال رابط صالح للتحليل.');
      return;
    }
    onAnalyze(url.trim());
  };

  const handlePaste = async () => {
    try {
      if (!navigator.clipboard) {
        onToast('info', 'خاصية اللصق التلقائي غير مدعومة في متصفحك. يرجى اللصق يدويًا.');
        return;
      }
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setUrl(text.trim());
        onToast('success', 'تم لصق الرابط من الحافظة.');
      } else {
        onToast('info', 'الحافظة فارغة حاليًا.');
      }
    } catch {
      onToast('info', 'يرجى منح إذن الوصول للحافظة أو لصق الرابط يدويًا.');
    }
  };

  return (
    <div className="w-full glass-panel p-6 sm:p-10 rounded-3xl shadow-soft border border-brand-200/40 dark:border-brand-900/30 relative overflow-hidden transition-all">
      {/* Soft Decorative Ambient Glow */}
      <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-brand-300/15 dark:bg-brand-500/10 blur-2xl pointer-events-none"></div>

      {/* Hero Header */}
      <div className="text-center max-w-xl mx-auto mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-100/80 dark:bg-brand-950/60 border border-brand-200/60 dark:border-brand-800/60 text-brand-700 dark:text-brand-300 text-xs font-bold mb-3 shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>تحميل فوري بجودة أصلية</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-white tracking-tight font-display mb-2.5">
          وش تبين تحملين اليوم؟
        </h2>
        <p className="text-sm sm:text-base text-stone-500 dark:text-stone-400 font-medium">
          الصقي رابط الفيديو من يوتيوب، تيك توك، انستقرام، تويتر أو بنترست للتحميل بأعلى دقة.
        </p>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
          {/* URL Input Box */}
          <div className="relative flex-1">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="الصقي الرابط هنا..."
              disabled={isLoading}
              className="w-full h-14 px-4 pr-12 pl-24 rounded-2xl glass-input text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-500 text-sm sm:text-base font-medium outline-none"
            />
            <Link2 className="w-5 h-5 text-stone-400 dark:text-stone-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />

            {/* Paste Button Inside Input on larger screens */}
            <button
              type="button"
              onClick={handlePaste}
              disabled={isLoading}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-brand-50 dark:bg-slateDark-800 dark:hover:bg-brand-950/60 text-stone-700 dark:text-stone-300 text-xs font-bold border border-brand-200/40 dark:border-brand-800/40 transition flex items-center gap-1.5"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span>لصق</span>
            </button>
          </div>

          {/* Analyze Button */}
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="h-14 px-8 rounded-2xl gradient-brand text-white font-bold text-sm sm:text-base shadow-soft hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2.5 shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري الفحص...</span>
              </>
            ) : (
              <>
                <span>تحليل الرابط</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
