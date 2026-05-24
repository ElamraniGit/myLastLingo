/**
 * Main player page combining video player, transcript, and dictionary.
 */

import React from 'react';
import { motion } from 'framer-motion';
import VideoInput from '@/components/player/VideoInput';
import VideoPlayer from '@/components/player/VideoPlayer';
import TranscriptViewer from '@/components/transcript/TranscriptViewer';
import DictionaryModal from '@/components/dictionary/DictionaryModal';
import { useAppStore } from '@/store/appStore';

export default function PlayerPage() {
  const { currentVideo } = useAppStore();

  if (!currentVideo) {
    return <VideoInput />;
  }

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 p-4">
      {/* Video player */}
      <div className="w-full lg:w-[55%] xl:w-[60%] flex-shrink-0">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-4"
        >
          <VideoPlayer />
          
          {/* Video info */}
          <div className="mt-4 space-y-2">
            <h2 className="text-xl font-semibold text-surface-100 line-clamp-2">
              {currentVideo.title}
            </h2>
            <div className="flex items-center gap-3 text-sm text-surface-400">
              <span>{currentVideo.channel}</span>
              <span>•</span>
              <span>{formatDuration(currentVideo.duration)}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Transcript panel */}
      <div className="flex-1 min-w-0 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <TranscriptViewer />
        </motion.div>
      </div>

      {/* Dictionary modal */}
      <DictionaryModal />
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}s ${m}d`;
  return `${m} دقيقة`;
}