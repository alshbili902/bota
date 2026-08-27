import React, { useState } from 'react';
import {
  Video,
  Music,
  Clock,
  User,
  Download,
  Check,
  Sparkles,
} from 'lucide-react';
import type { MediaMetadata, MediaFormat } from '../types';

interface MediaPreviewProps {
  metadata: MediaMetadata;
  onStartDownload: (format: MediaFormat) => void;
  isStarting: boolean;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({
  metadata,
  onStartDownload,
  isStarting,
}) => {
  const [activeType, setActiveType] = useState<'video' | 'audio'>('video');
  const [selectedFormatId, setSelectedFormatId] = useState<string>(() => {
    const defaultFmt = metadata.formats.find((f) => f.format_type === 'video') || metadata.formats[0];
    return defaultFmt ? defaultFmt.format_id : '';
  });

  const videoFormats = metadata.formats.filter((f) => f.format_type === 'video');
  const audioFormats = metadata.formats.filter((f) => f.format_type === 'audio');

  const currentFormats = activeType === 'video' ? videoFormats : audioFormats;
  const activeSelected = metadata.formats.find((f) => f.format_id === selectedFormatId) || currentFormats[0];

  const handleTypeSwitch = (type: 'video' | 'audio') => {
    setActiveType(type);
    const firstOfGroup = type === 'video' ? videoFormats[0] : audioFormats[0];
    if (firstOfGroup) {
      setSelectedFormatId(firstOfGroup.format_id);
    }
  };

  const handleDownloadClick = () => {
    if (activeSelected) {
      onStartDownload(activeSelected);
    }
  };

  return (
    <div className="w-full bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/20 text-slate-100 transition-all duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Thumbnail & Source Info */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="relative group rounded-2xl overflow-hidden bg-slate-950 border border-slate-800/80 aspect-video shadow-lg">
            {metadata.thumbnail ? (
              <img
                src={metadata.thumbnail}
                alt={metadata.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-950/80 text-slate-600">
                <Video className="w-16 h-16 stroke-1" />
              </div>
            )}

            {/* Source Badge */}
            <div className="absolute top-3 right-3 px-3 py-1 bg-slate-950/80 backdrop-blur-md border border-slate-700/60 rounded-full text-xs font-semibold text-emerald-400 shadow-md">
              {metadata.source}
            </div>

            {/* Duration Badge */}
            {metadata.duration_formatted && (
              <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-slate-950/85 backdrop-blur-md rounded-md text-xs font-mono text-slate-300 flex items-center gap-1.5 border border-slate-800">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{metadata.duration_formatted}</span>
              </div>
            )}
          </div>

          {/* Title & Metadata Details */}
          <div className="flex flex-col gap-2">
            <h3 className="text-lg sm:text-xl font-bold text-slate-100 line-clamp-2 leading-relaxed" title={metadata.title}>
              {metadata.title}
            </h3>

            {metadata.uploader && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <User className="w-4 h-4 text-emerald-400/80" />
                <span className="truncate">{metadata.uploader}</span>
              </div>
            )}
          </div>
        </div>

        {/* Formats Selection & Download CTA */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Format Type Tabs (Video vs Audio) */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl">
            <button
              type="button"
              onClick={() => handleTypeSwitch('video')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeType === 'video'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>فيديو (MP4)</span>
              {videoFormats.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-900/50 text-emerald-300 font-mono">
                  {videoFormats.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTypeSwitch('audio')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeType === 'audio'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Music className="w-4 h-4" />
              <span>صوت فقط (MP3 / M4A)</span>
              {audioFormats.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-900/50 text-emerald-300 font-mono">
                  {audioFormats.length}
                </span>
              )}
            </button>
          </div>

          {/* Formats Grid */}
          <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {currentFormats.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-dashed border-slate-800 text-slate-400 text-sm">
                لا توجد خيارات متاحة لهذا النوع
              </div>
            ) : (
              currentFormats.map((fmt) => {
                const isSelected = fmt.format_id === selectedFormatId;
                return (
                  <button
                    key={fmt.format_id}
                    type="button"
                    onClick={() => setSelectedFormatId(fmt.format_id)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-right duration-200 group ${
                      isSelected
                        ? 'bg-emerald-950/30 border-emerald-500/70 shadow-md shadow-emerald-950/30'
                        : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-950/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                            : 'border-slate-700 group-hover:border-slate-500'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-100">{fmt.label}</span>
                          {fmt.is_best && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                              <Sparkles className="w-2.5 h-2.5" />
                              موصى به
                            </span>
                          )}
                        </div>
                        {fmt.note && <span className="text-xs text-slate-400 mt-0.5">{fmt.note}</span>}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-mono font-semibold uppercase px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-300">
                        {fmt.ext}
                      </span>
                      {fmt.filesize_estimate_mb && (
                        <span className="text-xs font-mono text-slate-400">~{fmt.filesize_estimate_mb} MB</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Download Action Button */}
          <button
            type="button"
            disabled={isStarting || !activeSelected}
            onClick={handleDownloadClick}
            className={`w-full py-4 px-6 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all duration-300 ${
              isStarting
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.01] active:scale-[0.99]'
            }`}
          >
            {isStarting ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                <span>جاري بدء التحميل...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>
                  بدء تحميل {activeType === 'video' ? 'الفيديو' : 'الملف الصوتي'} ({activeSelected?.resolution || activeSelected?.ext?.toUpperCase() || ''})
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
