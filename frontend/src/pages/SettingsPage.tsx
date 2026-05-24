
/**
 * Settings page for app configuration.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  HiCog, HiDatabase, HiTrash, HiRefresh, HiVolumeUp,
  HiTranslate, HiInformationCircle, HiServer,
} from 'react-icons/hi';
import { useAppStore } from '@/store/appStore';

interface SettingItem {
  label: string;
  type: 'toggle' | 'select' | 'info';
  value: string | boolean;
  options?: string[];
}

interface SettingGroup {
  title: string;
  icon: React.ReactNode;
  items: SettingItem[];
}

export default function SettingsPage() {
  const { theme, toggleTheme, clearError } = useAppStore();

  const settingsGroups: SettingGroup[] = [
    {
      title: 'التشغيل',
      icon: <HiVolumeUp className="w-5 h-5" />,
      items: [
        { label: 'السرعة الافتراضية', type: 'select', value: '1x', options: ['0.5x', '0.75x', '1x', '1.25x', '1.5x', '2x'] },
        { label: 'التكرار التلقائي', type: 'toggle', value: false },
      ],
    },
    {
      title: 'النصوص والترجمة',
      icon: <HiTranslate className="w-5 h-5" />,
      items: [
        { label: 'لغة الترجمة الافتراضية', type: 'select', value: 'العربية', options: ['العربية', 'الإنجليزية'] },
        { label: 'النسخ التلقائي (Whisper)', type: 'toggle', value: true },
      ],
    },
    {
      title: 'البيانات والتخزين',
      icon: <HiDatabase className="w-5 h-5" />,
      items: [
        { label: 'حجم الذاكرة المؤقتة', type: 'info', value: '~45 MB' },
        { label: 'عدد الكلمات المحفوظة', type: 'info', value: '0' },
      ],
    },
    {
      title: 'حول',
      icon: <HiInformationCircle className="w-5 h-5" />,
      items: [
        { label: 'الإصدار', type: 'info', value: '1.0.0' },
        { label: 'الوضع', type: 'info', value: 'محلي بالكامل' },
      ],
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-100">الإعدادات</h1>
        <p className="text-surface-400 text-sm mt-1">تخصيص تجربة التعلم</p>
      </div>

      {/* Server status */}
      <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
          <HiServer className="w-5 h-5 text-green-400" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-surface-200">الخادم المحلي</p>
          <p className="text-xs text-surface-400">127.0.0.1:8080 • قيد التشغيل</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-soft" />
          نشط
        </span>
      </div>

      {/* Settings groups */}
      {settingsGroups.map((group, gi) => (
        <motion.div
          key={gi}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: gi * 0.05 }}
          className="glass rounded-2xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-6 py-4 border-b border-surface-700/30">
            <span className="text-primary-400">{group.icon}</span>
            <h3 className="font-medium text-surface-200">{group.title}</h3>
          </div>

          <div className="divide-y divide-surface-700/20">
            {group.items.map((item, ii) => (
              <div
                key={ii}
                className="flex items-center justify-between px-6 py-4 hover:bg-surface-700/20 transition-colors"
              >
                <span className="text-sm text-surface-300">{item.label}</span>
                <div className="flex items-center gap-2">
                  {item.type === 'toggle' && (
                    <button
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        item.value ? 'bg-primary-500' : 'bg-surface-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          item.value ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  )}
                  {item.type === 'select' && item.options && (
                    <select className="bg-surface-700 text-surface-200 text-sm rounded-lg px-3 py-1.5 border border-surface-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50">
                      {item.options.map((opt) => (
                        <option key={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                  {item.type === 'info' && (
                    <span className="text-sm text-surface-400">{item.value as string}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      {/* Danger zone */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass rounded-2xl p-6 border border-red-500/20"
      >
        <h3 className="font-medium text-red-400 mb-4">منطقة الخطر</h3>
        <div className="flex gap-3">
          <button className="btn bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20">
            <HiTrash className="w-4 h-4" />
            مسح جميع البيانات
          </button>
          <button className="btn bg-surface-700 text-surface-300 hover:bg-surface-600">
            <HiRefresh className="w-4 h-4" />
            إعادة تعيين
          </button>
        </div>
      </motion.div>
    </div>
  );
}