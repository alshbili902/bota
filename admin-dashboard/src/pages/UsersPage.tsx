import React, { useEffect, useState } from 'react';
import {
  Users,
  KeyRound,
  Edit2,
  RefreshCw,
  Check,
  X,
  Clock,
  DownloadCloud,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Lock,
  Power,
  CheckCircle2,
  UserPlus,
  Mail,
  Calendar,
} from 'lucide-react';
import { PlatformUser } from '../types';
import { adminApi } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';

interface UsersPageProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const UsersPage: React.FC<UsersPageProps> = ({ onShowToast }) => {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Add User Modal State ---
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [addUserPassword, setAddUserPassword] = useState('');
  const [addUserConfirmPassword, setAddUserConfirmPassword] = useState('');
  const [addUserStatus, setAddUserStatus] = useState(true);
  const [showAddUserPassword, setShowAddUserPassword] = useState(false);
  const [showAddUserConfirmPassword, setShowAddUserConfirmPassword] = useState(false);
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState(false);

  // --- Edit User Modal State ---
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // --- Change Password Modal State ---
  const [changingPasswordUser, setChangingPasswordUser] = useState<PlatformUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [showConfirmationPrompt, setShowConfirmationPrompt] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getUsers();
      setUsers(data);
    } catch (err: any) {
      onShowToast(err.message || 'فشل جلب قائمة المستخدمين.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // --- Add User Password Checks ---
  const addPasswordChecks = {
    length: addUserPassword.length >= 8,
    upper: /[A-Z]/.test(addUserPassword),
    lower: /[a-z]/.test(addUserPassword),
    number: /\d/.test(addUserPassword),
    special: /[!@#$%^&*(),.?":{}|<>\-_=+~`[\]/\\]/.test(addUserPassword),
  };
  const addStrengthScore = Object.values(addPasswordChecks).filter(Boolean).length;
  const isAddPasswordValid = addStrengthScore === 5;
  const isAddPasswordsMatch = addUserPassword.length > 0 && addUserPassword === addUserConfirmPassword;

  // --- Change Password Checks ---
  const changePasswordChecks = {
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /\d/.test(newPassword),
    special: /[!@#$%^&*(),.?":{}|<>\-_=+~`[\]/\\]/.test(newPassword),
  };
  const changeStrengthScore = Object.values(changePasswordChecks).filter(Boolean).length;
  const isChangePasswordValid = changeStrengthScore === 5;
  const isChangePasswordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  // --- Add User Handlers ---
  const openAddUserModal = () => {
    setNewUsername('');
    setNewDisplayName('');
    setNewEmail('');
    setAddUserPassword('');
    setAddUserConfirmPassword('');
    setAddUserStatus(true);
    setShowAddUserPassword(false);
    setShowAddUserConfirmPassword(false);
    setIsAddUserOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedUsername = newUsername.trim().toLowerCase();
    if (!trimmedUsername) {
      onShowToast('يرجى إدخال اسم المستخدم.', 'error');
      return;
    }

    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(trimmedUsername)) {
      onShowToast('اسم المستخدم يجب أن يتكون من 3 إلى 32 حرفًا أو رقمًا إنجليزيًا أو شرطة فقط بدون مسافات.', 'error');
      return;
    }

    const trimmedEmail = newEmail.trim().toLowerCase();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      onShowToast('صيغة البريد الإلكتروني غير صحيحة.', 'error');
      return;
    }

    if (!isAddPasswordValid) {
      onShowToast('كلمة المرور لا تستوفي شروط الأمان.', 'error');
      return;
    }

    if (!isAddPasswordsMatch) {
      onShowToast('كلمتا المرور غير متطابقتين.', 'error');
      return;
    }

    setIsSubmittingNewUser(true);
    try {
      await adminApi.createUser({
        username: trimmedUsername,
        display_name: newDisplayName.trim() || undefined,
        email: trimmedEmail || undefined,
        password: addUserPassword,
        confirm_password: addUserConfirmPassword,
        is_active: addUserStatus,
      });

      onShowToast('تم إنشاء المستخدم بنجاح.', 'success');
      setIsAddUserOpen(false);
      await fetchUsers();
    } catch (err: any) {
      onShowToast(err.message || 'تعذر إنشاء المستخدم، حاول مرة أخرى.', 'error');
    } finally {
      setIsSubmittingNewUser(false);
    }
  };

  // --- Edit User Handlers ---
  const openEditModal = (user: PlatformUser) => {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditDisplayName(user.display_name || user.username);
    setEditEmail(user.email || '');
    setEditIsActive(user.is_active);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSubmittingEdit(true);
    try {
      await adminApi.updateUser(editingUser.id, {
        username: editUsername.trim().toLowerCase(),
        display_name: editDisplayName.trim(),
        email: editEmail.trim() || undefined,
        is_active: editIsActive,
      });
      onShowToast('تم تحديث بيانات المستخدم بنجاح.', 'success');
      setEditingUser(null);
      await fetchUsers();
    } catch (err: any) {
      onShowToast(err.message || 'تعذر تعديل بيانات المستخدم.', 'error');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // --- Quick Toggle Enable / Disable User ---
  const handleToggleUserActive = async (user: PlatformUser) => {
    const actionText = user.is_active ? 'تعطيل' : 'تفعيل';
    if (!window.confirm(`هل أنت متأكد من رغبتك في ${actionText} حساب المستخدم @${user.username}؟`)) {
      return;
    }
    try {
      await adminApi.updateUser(user.id, {
        is_active: !user.is_active,
      });
      onShowToast(`تم ${actionText} حساب @${user.username} بنجاح.`, 'success');
      await fetchUsers();
    } catch (err: any) {
      onShowToast(err.message || `فشل ${actionText} الحساب.`, 'error');
    }
  };

  // --- Change Password Handlers ---
  const openChangePasswordModal = (user: PlatformUser) => {
    setChangingPasswordUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowConfirmationPrompt(false);
  };

  const handleInitiatePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isChangePasswordValid) {
      onShowToast('كلمة المرور لا تستوفي شروط الأمان.', 'error');
      return;
    }
    if (!isChangePasswordsMatch) {
      onShowToast('كلمتا المرور غير متطابقتين.', 'error');
      return;
    }
    setShowConfirmationPrompt(true);
  };

  const handleConfirmPasswordChange = async () => {
    if (!changingPasswordUser) return;
    setIsSubmittingPassword(true);

    try {
      await adminApi.changeUserPassword(
        changingPasswordUser.id,
        newPassword,
        confirmPassword
      );

      onShowToast('تم تغيير كلمة المرور بنجاح.', 'success');
      setChangingPasswordUser(null);
      setShowConfirmationPrompt(false);
      setNewPassword('');
      setConfirmPassword('');
      await fetchUsers();
    } catch (err: any) {
      onShowToast(err.message || 'تعذر تغيير كلمة المرور، حاول مرة أخرى.', 'error');
      setShowConfirmationPrompt(false);
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header with Quick Actions */}
      <div className="admin-card p-6 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
              إدارة الأعضاء والوصول
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">المستخدمون المصرح لهم</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            إدارة الحسابات المصرح لها حصراً بالدخول، وإضافة مستخدمين جدد، وإعادة تعيين كلمات المرور، والتحكم في حالات النشاط.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openAddUserModal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-500/25 transition-all active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة مستخدم</span>
          </button>

          <button
            onClick={fetchUsers}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-sm font-semibold border border-slate-200 dark:border-white/10 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="admin-card rounded-3xl overflow-hidden shadow-xl border border-slate-200 dark:border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-black/30 border-b border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-6">المستخدم</th>
                <th className="py-4 px-6">الاسم</th>
                <th className="py-4 px-6">البريد الإلكتروني</th>
                <th className="py-4 px-6">الحالة</th>
                <th className="py-4 px-6">التحميلات</th>
                <th className="py-4 px-6">آخر نشاط</th>
                <th className="py-4 px-6">تاريخ الإنشاء</th>
                <th className="py-4 px-6 text-center">إدارة الحساب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-sm">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    لا يوجد مستخدمون.
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    {/* Username */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600/15 to-indigo-600/15 dark:from-blue-600/30 dark:to-indigo-600/30 border border-blue-500/20 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                          {user.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                            @{user.username}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Display Name */}
                    <td className="py-4 px-6 font-semibold text-slate-800 dark:text-slate-200">
                      {user.display_name || user.username}
                    </td>

                    {/* Email */}
                    <td className="py-4 px-6">
                      {user.email ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-mono">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{user.email}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      <StatusBadge status={user.is_active ? 'active' : 'false'} type="user" />
                    </td>

                    {/* Downloads */}
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                          <DownloadCloud className="w-4 h-4 text-blue-500" />
                          <span>{user.total_downloads}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                          <span className="text-emerald-600 dark:text-emerald-400">{user.successful_downloads} ناجح</span>
                          <span>•</span>
                          <span className="text-rose-600 dark:text-rose-400">{user.failed_downloads} فاشل</span>
                        </div>
                      </div>
                    </td>

                    {/* Last Activity */}
                    <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-400">
                      {user.last_activity ? (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          {user.last_activity}
                        </span>
                      ) : (
                        <span className="text-slate-400">لا يوجد نشاط حتى الآن</span>
                      )}
                    </td>

                    {/* Created At */}
                    <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-400">
                      {user.created_at ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          {user.created_at.slice(0, 10)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {/* [ Edit User ] */}
                        <button
                          onClick={() => openEditModal(user)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-500/30 transition-colors shadow-sm cursor-pointer"
                          title="تعديل بيانات المستخدم"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>تعديل</span>
                        </button>

                        {/* [ Change Password ] */}
                        <button
                          onClick={() => openChangePasswordModal(user)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-500/30 transition-colors shadow-sm cursor-pointer"
                          title="تغيير كلمة المرور بشكل آمن"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>تغيير كلمة المرور</span>
                        </button>

                        {/* [ Enable / Disable ] */}
                        <button
                          onClick={() => handleToggleUserActive(user)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors shadow-sm cursor-pointer ${
                            user.is_active
                              ? 'bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border-slate-200 dark:bg-white/5 dark:hover:bg-rose-500/15 dark:text-slate-300 dark:hover:text-rose-300 dark:border-white/5'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 dark:text-emerald-300 dark:border-emerald-500/30'
                          }`}
                          title={user.is_active ? 'تعطيل حساب المستخدم' : 'تفعيل حساب المستخدم'}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>{user.is_active ? 'تعطيل' : 'تفعيل'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 👤 ADD USER MODAL */}
      {/* ========================================================================= */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="admin-card max-w-lg w-full p-6 sm:p-8 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#111827] space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">إضافة مستخدم جديد</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    إنشاء حساب مصرح له بالدخول والتحميل من منصة رهامي
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Username */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  اسم المستخدم <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 text-sm font-mono pointer-events-none">
                    @
                  </span>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value.replace(/\s+/g, ''))}
                    placeholder="e.g. ahmed"
                    required
                    className="w-full pr-8 pl-4 py-2.5 bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  أحرف وأرقام إنجليزية وشرطة فقط (من 3 إلى 32 حرفًا).
                </p>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  الاسم المعروض (اختياري)
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={e => setNewDisplayName(e.target.value)}
                  placeholder="e.g. أحمد علي"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  البريد الإلكتروني (اختياري)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute inset-y-0 right-3.5 my-auto text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    كلمة المرور <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddUserPassword(!showAddUserPassword)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {showAddUserPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showAddUserPassword ? 'إخفاء' : 'إظهار كلمة المرور'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showAddUserPassword ? 'text' : 'password'}
                    value={addUserPassword}
                    onChange={e => setAddUserPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                {/* Password Strength Progress Bar */}
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1.5 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        addStrengthScore <= 2
                          ? 'bg-rose-500 w-1/4'
                          : addStrengthScore <= 4
                          ? 'bg-amber-500 w-3/4'
                          : 'bg-emerald-500 w-full'
                      }`}
                    />
                  </div>

                  {/* Criteria Checklist */}
                  <div className="grid grid-cols-2 gap-1.5 pt-2 text-[11px]">
                    <div className={`flex items-center gap-1.5 ${addPasswordChecks.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                      {addPasswordChecks.length ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      <span>8 أحرف على الأقل</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${addPasswordChecks.upper ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                      {addPasswordChecks.upper ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      <span>حرف كبير (A-Z)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${addPasswordChecks.lower ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                      {addPasswordChecks.lower ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      <span>حرف صغير (a-z)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${addPasswordChecks.number ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                      {addPasswordChecks.number ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      <span>رقم واحد على الأقل (0-9)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 col-span-2 ${addPasswordChecks.special ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                      {addPasswordChecks.special ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      <span>رمز خاص (!@#$%^&*...)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    تأكيد كلمة المرور <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddUserConfirmPassword(!showAddUserConfirmPassword)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {showAddUserConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showAddUserConfirmPassword ? 'إخفاء' : 'إظهار'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showAddUserConfirmPassword ? 'text' : 'password'}
                    value={addUserConfirmPassword}
                    onChange={e => setAddUserConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                {addUserConfirmPassword && (
                  <p className={`text-xs mt-1 font-medium ${isAddPasswordsMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                    {isAddPasswordsMatch ? 'كلمتا المرور متطابقتان' : 'كلمتا المرور غير متطابقتين.'}
                  </p>
                )}
              </div>

              {/* Account Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  حالة الحساب
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAddUserStatus(true)}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      addUserStatus
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>نشط (مفعل فورًا)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddUserStatus(false)}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      !addUserStatus
                        ? 'bg-rose-50 dark:bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300'
                        : 'bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Power className="w-4 h-4" />
                    <span>معطل (موقوف مؤقتًا)</span>
                  </button>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  disabled={isSubmittingNewUser}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewUser || !isAddPasswordValid || !isAddPasswordsMatch}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                >
                  {isSubmittingNewUser ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>جارِ إنشاء المستخدم...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>إنشاء المستخدم</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔐 SECURE CHANGE PASSWORD MODAL */}
      {/* ========================================================================= */}
      {changingPasswordUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="admin-card max-w-lg w-full p-6 sm:p-8 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#111827] space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">تغيير كلمة مرور المستخدم</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    تعيين كلمة مرور آمنة ومشفرة للمستخدم @{changingPasswordUser.username}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setChangingPasswordUser(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!showConfirmationPrompt ? (
              <form onSubmit={handleInitiatePasswordChange} className="space-y-4">
                {/* User details badge */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-xs">
                      {changingPasswordUser.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block">المستخدم المستهدف</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {changingPasswordUser.display_name || changingPasswordUser.username} (@{changingPasswordUser.username})
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-400">ID: {changingPasswordUser.id}</span>
                </div>

                {/* New Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      كلمة المرور الجديدة
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showNewPassword ? 'إخفاء' : 'إظهار كلمة المرور'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      placeholder="••••••••••••"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  {/* Password Strength Progress Bar */}
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1 h-1.5 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          changeStrengthScore <= 2
                            ? 'bg-rose-500 w-1/4'
                            : changeStrengthScore <= 4
                            ? 'bg-amber-500 w-3/4'
                            : 'bg-emerald-500 w-full'
                        }`}
                      />
                    </div>

                    {/* Criteria Checklist */}
                    <div className="grid grid-cols-2 gap-1.5 pt-2 text-[11px]">
                      <div className={`flex items-center gap-1.5 ${changePasswordChecks.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                        {changePasswordChecks.length ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        <span>8 أحرف على الأقل</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${changePasswordChecks.upper ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                        {changePasswordChecks.upper ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        <span>حرف كبير (A-Z)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${changePasswordChecks.lower ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                        {changePasswordChecks.lower ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        <span>حرف صغير (a-z)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${changePasswordChecks.number ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                        {changePasswordChecks.number ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        <span>رقم واحد على الأقل (0-9)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 col-span-2 ${changePasswordChecks.special ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                        {changePasswordChecks.special ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        <span>رمز خاص (!@#$%^&*...)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      تأكيد كلمة المرور الجديدة
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showConfirmPassword ? 'إخفاء' : 'إظهار'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••••••"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  {confirmPassword && (
                    <p className={`text-xs mt-1 font-medium ${isChangePasswordsMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                      {isChangePasswordsMatch ? 'كلمتا المرور متطابقتان' : 'كلمتا المرور غير متطابقتين.'}
                    </p>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setChangingPasswordUser(null)}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={!isChangePasswordValid || !isChangePasswordsMatch}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/25 cursor-pointer"
                  >
                    متابعة التغيير
                  </button>
                </div>
              </form>
            ) : (
              /* Confirmation Prompt Screen */
              <div className="space-y-6 text-center py-2">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-500/30">
                  <AlertCircle className="w-7 h-7" />
                </div>

                <div className="space-y-2">
                  <h4 className="text-lg font-black text-slate-900 dark:text-white">
                    تأكيد تغيير كلمة المرور
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                    هل أنت متأكد من رغبتك بتغيير كلمة المرور للمستخدم{' '}
                    <strong className="text-slate-900 dark:text-white">@{changingPasswordUser.username}</strong>؟
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    سيؤدي هذا الإجراء فوراً إلى إنهاء وإبطال كافة الجلسات النشطة للمستخدم وإلزامه بتسجيل الدخول بكلمة المرور الجديدة.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowConfirmationPrompt(false)}
                    disabled={isSubmittingPassword}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    رجوع للتعديل
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPasswordChange}
                    disabled={isSubmittingPassword}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingPassword ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>جارِ التحديث وإنهاء الجلسات...</span>
                      </>
                    ) : (
                      <span>تأكيد التغيير الآن</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ✏️ EDIT USERNAME, EMAIL & DISPLAY NAME MODAL */}
      {/* ========================================================================= */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="admin-card max-w-md w-full p-6 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#111827]">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4 mb-5">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">تعديل بيانات المستخدم</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  اسم المستخدم (تسجيل الدخول)
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={e => setEditUsername(e.target.value.replace(/\s+/g, ''))}
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  الاسم الظاهر
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={e => setEditDisplayName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={e => setEditIsActive(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 dark:border-white/20 text-blue-600 focus:ring-0 bg-white dark:bg-slate-900"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white block">حساب نشط ومفعل</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      عند إلغاء التفعيل، سيتم حظر المستخدم من تسجيل الدخول أو التنزيل فوراً
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingEdit ? 'جارِ الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
