import React from 'react';
import {
  LayoutDashboard,
  Users,
  DownloadCloud,
  AlertTriangle,
  Activity,
  Settings,
  ShieldCheck,
  FileText,
  Database,
  LogOut,
  X,
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';

export type AdminTab =
  | 'overview'
  | 'users'
  | 'downloads'
  | 'errors'
  | 'health'
  | 'settings'
  | 'account'
  | 'activity'
  | 'database';

interface SidebarProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  onClose,
}) => {
  const { logout, admin } = useAdminAuth();

  const navItems = [
    { id: 'overview', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'users', label: 'إدارة المستخدمين', icon: Users },
    { id: 'downloads', label: 'سجل التحميلات', icon: DownloadCloud },
    { id: 'errors', label: 'مركز الأخطاء', icon: AlertTriangle },
    { id: 'health', label: 'صحة وموارد النظام', icon: Activity },
    { id: 'settings', label: 'إعدادات الموقع والصيانة', icon: Settings },
    { id: 'account', label: 'حساب المشرف والأمان', icon: ShieldCheck },
    { id: 'activity', label: 'سجل الرقابة والعمليات', icon: FileText },
    { id: 'database', label: 'قاعدة البيانات (Supabase)', icon: Database },
  ] as const;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 right-0 h-full w-72 bg-white/95 dark:bg-[#0E131F]/95 border-l border-slate-200 dark:border-white/10 z-50 flex flex-col justify-between transition-all duration-300 ease-in-out lg:translate-x-0 shadow-xl lg:shadow-none ${
          isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Header */}
          <div className="p-6 flex items-center justify-between border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
                <span className="font-extrabold text-lg">رهـ</span>
              </div>
              <div>
                <h1 className="font-extrabold text-lg text-slate-900 dark:text-white tracking-wide">رهامي — Admin</h1>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">لوحة الإدارة الشاملة</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-210px)]">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-600/15 dark:text-blue-400 dark:border-blue-500/30 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info & Logout */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                {admin?.username || 'admin'}
              </span>
            </div>
            <span className="text-[10px] bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold">
              SUPERADMIN
            </span>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 dark:text-rose-400 dark:hover:bg-rose-500/10 dark:border-rose-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>
    </>
  );
};
