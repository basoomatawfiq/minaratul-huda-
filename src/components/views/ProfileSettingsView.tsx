import React, { useState } from 'react';
import { Bell, Globe, LogOut, Moon, RefreshCw, Server, Sun, Trash2, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { APP_LOGO_PATH, apiRequest, getApiBaseUrl } from '../../services/api';
import { formatBytes } from '../../services/offlineManager';
import type { AppLanguage, ThemeMode } from '../../types/content';

export const ProfileView: React.FC = () => {
  const {
    language,
    user,
    login,
    register,
    logout,
    deleteAccount,
    favoriteItems,
    listeningHistory,
    offlineRecords,
    setSection,
    showToast,
  } = useApp();

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        showToast('Signed in successfully.');
      } else if (mode === 'register') {
        await register(name, email, password);
        showToast('Account created and signed in.');
      } else {
        const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        showToast(res.message);
        setMode('login');
      }
    } catch (err: any) {
      showToast(err?.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          {t(language, 'profile')}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Manage your account, synchronize favorites and listening progress across devices, and access your library stats.
        </p>
      </div>

      {/* Personal Stats Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => setSection('favorites')}
          className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 text-start dark:border-slate-800 dark:bg-[#131C1A] cursor-pointer min-w-0"
        >
          <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{favoriteItems.length}</p>
          <p className="text-xs text-slate-500 truncate">{t(language, 'favorites')}</p>
        </button>
        <button
          type="button"
          onClick={() => setSection('history')}
          className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 text-start dark:border-slate-800 dark:bg-[#131C1A] cursor-pointer min-w-0"
        >
          <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{listeningHistory.length}</p>
          <p className="text-xs text-slate-500 truncate">{t(language, 'history')}</p>
        </button>
        <button
          type="button"
          onClick={() => setSection('downloads')}
          className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 text-start dark:border-slate-800 dark:bg-[#131C1A] cursor-pointer min-w-0"
        >
          <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{offlineRecords.length}</p>
          <p className="text-xs text-slate-500 truncate">{t(language, 'downloads')}</p>
        </button>
      </div>

      {user ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-[#131C1A]">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F4C3A] text-white">
              <User className="w-7 h-7" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">{user.name}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
              <p className="mt-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Role: {user.role.replace('_', ' ')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 min-h-[42px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t(language, 'signOut')}</span>
            </button>

            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-2 min-h-[42px] rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 ms-auto cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Account</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 ms-auto">
                <button
                  type="button"
                  onClick={deleteAccount}
                  className="min-h-[40px] rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-medium text-white cursor-pointer"
                >
                  Confirm Permanent Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="min-h-[40px] rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#131C1A]">
          <div className="mb-5 flex gap-2">
            {(['login', 'register', 'reset'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer ${
                  mode === m
                    ? 'bg-[#0F4C3A] text-white dark:bg-emerald-600'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {m === 'login' ? t(language, 'signIn') : m === 'register' ? t(language, 'register') : 'Reset Password'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            {mode !== 'reset' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[44px] rounded-xl bg-[#0F4C3A] text-sm font-semibold text-white hover:bg-[#0B3B2D] disabled:opacity-50 dark:bg-emerald-600 cursor-pointer"
            >
              {busy
                ? 'Please wait...'
                : mode === 'login'
                  ? t(language, 'signIn')
                  : mode === 'register'
                    ? t(language, 'register')
                    : 'Send Reset Instructions'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export const SettingsView: React.FC = () => {
  const {
    language,
    setLanguage,
    theme,
    setTheme,
    wifiOnlyDownloads,
    setWifiOnlyDownloads,
    offlineRecords,
    clearDownloads,
    user,
    updateProfile,
    apiBaseUrl,
    updateApiBaseUrl,
    lastSyncedAt,
    refreshCatalogMeta,
    isOnline,
    showToast,
  } = useApp();
  const [syncing, setSyncing] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(apiBaseUrl);

  const totalBytes = offlineRecords.reduce((acc, r) => acc + (r.sizeBytes || 0), 0);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(
    user?.notificationPrefs || {
      tafseer: true,
      hadith: true,
      speeches: true,
      qa: true,
      lectures: true,
      announcements: true,
    }
  );

  const toggleNotif = (key: string) => {
    const next = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(next);
    if (user) {
      updateProfile({ notificationPrefs: next }).catch(() => {});
    }
    showToast('Notification preference updated.');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          {t(language, 'settings')}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Customize language (including Arabic RTL &amp; Luganda), appearance, mobile data usage, and notifications.
        </p>
      </div>

      {/* Language Selector */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 dark:border-slate-800 dark:bg-[#131C1A]">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Globe className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          <h2>{t(language, 'language')}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(
            [
              { id: 'en', label: 'English (LTR)' },
              { id: 'ar', label: 'العربية (RTL)' },
              { id: 'lg', label: 'Luganda (LTR)' },
            ] as { id: AppLanguage; label: string }[]
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setLanguage(opt.id)}
              className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs sm:text-sm font-medium transition-colors truncate cursor-pointer ${
                language === opt.id
                  ? 'border-[#0F4C3A] bg-[#0F4C3A] text-white dark:border-emerald-500 dark:bg-emerald-600'
                  : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Theme Selector */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 dark:border-slate-800 dark:bg-[#131C1A]">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {theme === 'dark' ? <Moon className="w-4 h-4 text-emerald-400" /> : <Sun className="w-4 h-4 text-amber-600" />}
          <h2>{t(language, 'theme')}</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTheme(mode)}
              className={`min-h-[44px] rounded-xl border px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-colors truncate cursor-pointer ${
                theme === mode
                  ? 'border-[#0F4C3A] bg-[#0F4C3A] text-white dark:border-emerald-500 dark:bg-emerald-600'
                  : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
              }`}
            >
              {t(language, mode)}
            </button>
          ))}
        </div>
      </section>

      {/* Download & Mobile Data */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-[#131C1A]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t(language, 'wifiOnly')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Protect mobile data by preventing large audio/PDF downloads over cellular connections.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={wifiOnlyDownloads}
            onClick={() => setWifiOnlyDownloads(!wifiOnlyDownloads)}
            className={`h-7 w-12 rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
              wifiOnlyDownloads ? 'bg-[#0F4C3A] dark:bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white transition-transform ${
                wifiOnlyDownloads ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Offline Storage Used</p>
            <p className="text-xs text-slate-500 tabular-nums">
              {offlineRecords.length} files · {formatBytes(totalBytes)}
            </p>
          </div>
          <button
            type="button"
            onClick={clearDownloads}
            disabled={offlineRecords.length === 0}
            className="min-h-[40px] rounded-xl border border-rose-200 px-3.5 py-2 text-xs font-medium text-rose-700 disabled:opacity-40 dark:border-rose-900/50 dark:text-rose-400 cursor-pointer"
          >
            {t(language, 'clearCache')}
          </button>
        </div>
      </section>

      {/* Notification Preferences */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 dark:border-slate-800 dark:bg-[#131C1A]">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Bell className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          <h2>Notification Preferences</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(notifPrefs).map(([key, enabled]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleNotif(key)}
              className={`flex items-center justify-between min-h-[42px] rounded-xl border px-3 py-2 text-xs font-medium cursor-pointer ${
                enabled
                  ? 'border-emerald-700 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <span className="capitalize">{key}</span>
              <span>{enabled ? 'On' : 'Off'}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Content Server Connection & Sync */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 dark:border-slate-800 dark:bg-[#131C1A]">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Server className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          <h2>Content Server Connection</h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Enter the URL of your Minaratul Huda content backend application to fetch teachings, audio lectures, PDFs, and Q&amp;A.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={serverUrlInput}
            onChange={(e) => setServerUrlInput(e.target.value)}
            placeholder="https://studio.ugandakickboxingfederation.org"
            className="flex-1 min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="button"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true);
              await updateApiBaseUrl(serverUrlInput);
              setServerUrlInput(getApiBaseUrl());
              setSyncing(false);
              showToast(serverUrlInput.trim() ? 'Content server connected and synchronized.' : 'Restored default content server URL and synchronized.');
            }}
            className="inline-flex items-center justify-center gap-2 min-h-[42px] rounded-xl bg-[#0F4C3A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B3B2D] disabled:opacity-50 dark:bg-emerald-600 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>Save &amp; Sync</span>
          </button>
        </div>
        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
          <p>
            Active Endpoint:{' '}
            <span className="font-mono text-slate-900 dark:text-slate-100 break-all">
              {apiBaseUrl || 'Not configured yet'}
            </span>
          </p>
          <p>
            Status:{' '}
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {!apiBaseUrl ? 'Awaiting Server URL' : isOnline ? 'Online' : 'Offline Mode'}
            </span>
            {lastSyncedAt ? ` · Last synced ${lastSyncedAt.slice(11, 19)} UTC` : ''}
          </p>
        </div>
        {apiBaseUrl && (
          <div className="pt-1">
            <button
              type="button"
              disabled={syncing}
              onClick={async () => {
                setSyncing(true);
                await refreshCatalogMeta(true);
                setSyncing(false);
                showToast('Synchronized library with content server.');
              }}
              className="inline-flex items-center gap-2 min-h-[38px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>Sync Library Now</span>
            </button>
          </div>
        )}
      </section>

      {/* About, Privacy & Terms */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-xs leading-relaxed text-slate-600 space-y-3 dark:border-slate-800 dark:bg-[#131C1A] dark:text-slate-400">
        <div className="flex items-center gap-3">
          <img
            src={APP_LOGO_PATH}
            alt="Minaratul Huda Logo"
            className="h-10 w-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
          />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">About Minaratul Huda</p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400">Guidance for a Better Life</p>
          </div>
        </div>
        <p>
          Minaratul Huda provides verified Quran Tafseer, Hadith, Friday Speeches, Q&amp;A, and educational documents with zero advertisements and offline accessibility for elders and students alike.
        </p>
        <p>
          Privacy &amp; Terms: Guest listening positions and downloaded files stay strictly on your device. Registered accounts synchronize favorites and playback positions securely. Contact: contact@minaratulhuda.org
        </p>
      </section>
    </div>
  );
};
