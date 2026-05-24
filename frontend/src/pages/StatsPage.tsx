/**
 * Statistics and progress tracking page.
 */

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  HiChartBar,
  HiPlay,
  HiBookOpen,
  HiStar,
  HiLightningBolt,
  HiCalendar,
  HiTrendingUp,
} from 'react-icons/hi';
import { useDictionary } from '@/hooks/useDictionary';
import { useAppStore } from '@/store/appStore';

export default function StatsPage() {
  const { progress, loadStats } = useDictionary();
  const { videos } = useAppStore();

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const statCards = [
    {
      icon: <HiPlay className="w-6 h-6" />,
      label: 'الفيديوهات',
      value: videos.length,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: <HiBookOpen className="w-6 h-6" />,
      label: 'الكلمات المحفوظة',
      value: progress?.total_saved_words || 0,
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: <HiStar className="w-6 h-6" />,
      label: 'الكلمات المتعلمة',
      value: progress?.learned_words || 0,
      color: 'from-yellow-500 to-orange-500',
    },
    {
      icon: <HiLightningBolt className="w-6 h-6" />,
      label: 'للمراجعة اليوم',
      value: progress?.due_reviews || 0,
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: <HiCalendar className="w-6 h-6" />,
      label: 'أيام النشاط (30)',
      value: progress?.active_days_30 || 0,
      color: 'from-red-500 to-rose-500',
    },
    {
      icon: <HiTrendingUp className="w-6 h-6" />,
      label: 'المستوى الحالي',
      value: progress?.vocabulary_level || 'A1',
      color: 'from-violet-500 to-indigo-500',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-100">الإحصائيات</h1>
        <p className="text-surface-400 text-sm mt-1">تتبع تقدمك في تعلم اللغة الإنجليزية</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-5 hover:bg-surface-700/40 transition-all duration-300"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3 shadow-lg`}>
              <span className="text-white">{stat.icon}</span>
            </div>
            <p className="text-2xl font-bold text-surface-100">{stat.value}</p>
            <p className="text-sm text-surface-400 mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Level distribution section */}
      {progress?.level_distribution && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-lg font-semibold text-surface-100 mb-4">توزيع مستويات الكلمات</h2>
          <div className="space-y-3">
            {Object.entries(progress.level_distribution).map(([level, count]) => {
              const total = Object.values(progress.level_distribution!).reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={level}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-surface-300 font-medium">{level}</span>
                    <span className="text-surface-400">{count} كلمة ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2.5 bg-surface-700 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        level === 'A1' ? 'bg-green-500' :
                        level === 'A2' ? 'bg-emerald-500' :
                        level === 'B1' ? 'bg-blue-500' :
                        level === 'B2' ? 'bg-violet-500' :
                        level === 'C1' ? 'bg-orange-500' : 'bg-red-500'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Recent activity */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass rounded-2xl p-6"
      >
        <h2 className="text-lg font-semibold text-surface-100 mb-4">النشاط الحديث</h2>
        <div className="flex items-center gap-3 text-surface-400">
          <HiCalendar className="w-5 h-5" />
          <span>
            تمت مراجعة {progress?.reviewed_today || 0} كلمة اليوم
            {progress?.active_days_30 && ` • ${progress.active_days_30} يوم نشاط في آخر 30 يوم`}
          </span>
        </div>
      </motion.div>

      {/* Streak */}
      {progress?.streak_days ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-2xl p-6 text-center border border-yellow-500/20"
        >
          <div className="text-4xl mb-2">🔥</div>
          <p className="text-2xl font-bold text-yellow-400">{progress.streak_days}</p>
          <p className="text-sm text-surface-400 mt-1">أيام متتالية من التعلم</p>
        </motion.div>
      ) : null}
    </div>
  );
}