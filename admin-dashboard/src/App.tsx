import React, { useState } from 'react';
import { useAdminAuth } from './context/AdminAuthContext';
import { LoginPage } from './pages/LoginPage';
import { Sidebar, AdminTab } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { OverviewPage } from './pages/OverviewPage';
import { UsersPage } from './pages/UsersPage';
import { DownloadsPage } from './pages/DownloadsPage';
import { ErrorsPage } from './pages/ErrorsPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminAccountPage } from './pages/AdminAccountPage';
import { ActivityLogsPage } from './pages/ActivityLogsPage';
import { DatabaseOverviewPage } from './pages/DatabaseOverviewPage';
import { Toast, ToastMessage } from './components/Toast';
import { Loader2, Shield } from 'lucide-react';

export const App: React.FC = () => {
  const { admin, isLoading } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070A10] flex flex-col items-center justify-center text-slate-900 dark:text-white transition-colors duration-200">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center mb-4 shadow-xl shadow-blue-500/20 animate-pulse text-white">
          <Shield className="w-8 h-8" />
        </div>
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span>جارِ تهيئة جلسة الإدارة المشفرة...</span>
        </div>
      </div>
    );
  }

  // Not Logged In -> Show Login Portal
  if (!admin) {
    return (
      <>
        <LoginPage />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const pageTitles: Record<AdminTab, string> = {
    overview: 'لوحة التحكم الرئيسية',
    users: 'إدارة المستخدمين المصرح لهم',
    downloads: 'إدارة وسجل التحميلات',
    errors: 'مركز الأخطاء والاستثناءات',
    health: 'صحة وموارد النظام',
    settings: 'إعدادات الموقع والصيانة',
    account: 'حساب المشرف والأمان',
    activity: 'سجل الرقابة والعمليات',
    database: 'قاعدة البيانات (Supabase)',
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0B0F17] dark:text-slate-100 flex flex-row transition-colors duration-200">
      {/* Collapsible Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:mr-72 transition-all duration-300">
        <Navbar
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          title={pageTitles[activeTab]}
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewPage onNavigate={setActiveTab} onShowToast={showToast} />
          )}
          {activeTab === 'users' && <UsersPage onShowToast={showToast} />}
          {activeTab === 'downloads' && <DownloadsPage onShowToast={showToast} />}
          {activeTab === 'errors' && <ErrorsPage onShowToast={showToast} />}
          {activeTab === 'health' && <SystemHealthPage onShowToast={showToast} />}
          {activeTab === 'settings' && <SettingsPage onShowToast={showToast} />}
          {activeTab === 'account' && <AdminAccountPage onShowToast={showToast} />}
          {activeTab === 'activity' && <ActivityLogsPage onShowToast={showToast} />}
          {activeTab === 'database' && <DatabaseOverviewPage onShowToast={showToast} />}
        </main>
      </div>

      {/* Global Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default App;
