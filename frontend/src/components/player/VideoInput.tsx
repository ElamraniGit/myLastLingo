/**
 * YouTube URL input component with validation and processing.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiLink, HiPlay, HiArrowRight, HiCheck, HiX, HiExclamation } from 'react-icons/hi';
import { useAppStore } from '@/store/appStore';
import api from '@/services/api';

export default function VideoInput() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'validating' | 'processing' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [recentVideos, setRecentVideos] = useState<any[]>([]);
  const { setCurrentVideo, setCurrentPage, addVideo } = useAppStore();

  // Load recent videos
  React.useEffect(() => {
    api.videos.list(1, 5).then((data) => {
      if (data?.videos) setRecentVideos(data.videos);
    }).catch(() => {});
  }, []);

  const validateYouTubeUrl = (url: string): boolean => {
    const patterns = [
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/,
      /^[a-zA-Z0-9_-]{11}$/,
    ];
    return patterns.some((p) => p.test(url.trim()));
  };

  const handleSubmit = useCallback(async () => {
    if (!url.trim()) return;

    if (!validateYouTubeUrl(url)) {
      setStatus('error');
      setError('رابط YouTube غير صالح. الرجاء إدخال رابط صحيح.');
      return;
    }

    setStatus('validating');
    setError('');

    try {
      const video = await api.videos.process(url.trim());
      if (video) {
        setStatus('ready');
        addVideo(video);
        setCurrentVideo(video);
        
        // Navigate to player after brief delay
        setTimeout(() => {
          setCurrentPage('player');
        }, 500);
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'فشل في معالجة الفيديو. تحقق من الاتصال بالخادم المحلي.');
    }
  }, [url, addVideo, setCurrentVideo, setCurrentPage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-4xl font-bold gradient-text mb-3"
        >
          ابدأ رحلة تعلم الإنجليزية
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-surface-400 text-lg"
        >
          الصق رابط فيديو YouTube لبدء التعلم بالترجمة والكلمات التفاعلية
        </motion.p>
      </div>

      {/* URL Input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-2xl p-1"
      >
        <div className="flex items-center gap-2 bg-surface-800/50 rounded-xl">
          <div className="flex items-center gap-2 px-4">
            <HiLink className="w-5 h-5 text-surface-400" />
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (status === 'error') setStatus('idle');
            }}
            onKeyDown={handleKeyDown}
            placeholder="الصق رابط YouTube هنا..."
            className="flex-1 bg-transparent py-4 text-surface-100 placeholder-surface-500 focus:outline-none text-lg"
            dir="ltr"
            disabled={status === 'processing'}
          />
          <div className="px-2">
            <AnimatePresence mode="wait">
              {status === 'idle' && (
                <motion.button
                  key="submit"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={handleSubmit}
                  disabled={!url.trim()}
                  className="btn-primary px-6"
                >
                  <span>بدء</span>
                  <HiArrowRight className="w-4 h-4" />
                </motion.button>
              )}

              {status === 'validating' && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary-500/20 text-primary-400 rounded-xl"
                >
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>جاري المعالجة...</span>
                </motion.div>
              )}

              {status === 'ready' && (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-500/20 text-green-400 rounded-xl"
                >
                  <HiCheck className="w-5 h-5" />
                  <span>تم!</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Error message */}
      <AnimatePresence>
        {status === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3"
          >
            <HiExclamation className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-red-300 text-sm">{error}</span>
            <button onClick={() => setStatus('idle')} className="mr-auto btn-icon btn-ghost text-red-400">
              <HiX className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick tips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {[
          { icon: '🎯', title: 'ترجمة ذكية', desc: 'ترجمة لحظية مع تظليل الكلمات' },
          { icon: '📚', title: 'قاموس مدمج', desc: 'معاني، أمثلة، ومستوى الكلمة' },
          { icon: '🔄', title: 'تكرار ذكي', desc: 'نظام SRS لحفظ الكلمات' },
        ].map((tip, i) => (
          <div
            key={i}
            className="glass rounded-xl p-4 text-center hover:bg-surface-700/40 transition-all duration-300"
          >
            <div className="text-2xl mb-2">{tip.icon}</div>
            <h3 className="font-medium text-surface-200 mb-1">{tip.title}</h3>
            <p className="text-sm text-surface-400">{tip.desc}</p>
          </div>
        ))}
      </motion.div>

      {/* Recent videos */}
      {recentVideos.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8"
        >
          <h2 className="text-lg font-medium text-surface-300 mb-4">آخر الفيديوهات</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentVideos.slice(0, 4).map((video) => (
              <button
                key={video.id}
                onClick={() => {
                  setCurrentVideo(video);
                  setCurrentPage('player');
                }}
                className="glass rounded-xl p-3 flex items-center gap-3 hover:bg-surface-700/40 transition-all duration-200 group"
              >
                <div className="w-16 h-10 rounded-lg bg-surface-700 overflow-hidden flex-shrink-0">
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <HiPlay className="w-5 h-5 text-surface-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-sm font-medium text-surface-200 truncate">{video.title}</p>
                  <p className="text-xs text-surface-400">{video.channel}</p>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}