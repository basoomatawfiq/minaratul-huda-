import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Download,
  FileText,
  Heart,
  HelpCircle,
  History,
  Home,
  Library,
  Menu,
  Mic,
  Search,
  Settings,
  Sparkles,
  User,
  WifiOff,
  X,
} from 'lucide-react';
import { ContentDetailsModal } from './components/content/ContentDetailsModal';
import { AudioPlayerOverlay } from './components/player/AudioPlayerOverlay';
import { PWAInstallButton } from './components/pwa/PWAInstallButton';
import { UniversalReader } from './components/reader/UniversalReader';
import { CategoryBrowseView } from './components/views/CategoryBrowseView';
import { HomeView } from './components/views/HomeView';
import { DownloadsView, FavoritesView, HistoryView } from './components/views/LibraryCollectionsView';
import { ProfileView, SettingsView } from './components/views/ProfileSettingsView';
import { QAView } from './components/views/QAView';
import { SearchView } from './components/views/SearchView';
import { AppProvider, useApp } from './context/AppContext';
import { AudioProvider } from './context/AudioContext';
import { t } from './i18n/translations';
import { apiRequest } from './services/api';
import type { AppSection, ContentItem } from './types/content';

const MainShell: React.FC = () => {
  const {
    section,
    setSection,
    language,
    isOnline,
    user,
    toast,
    openContentDetails,
  } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Handle shared ?item= deep links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('item');
    if (itemId) {
      apiRequest<{ item: ContentItem }>(`/api/content/${encodeURIComponent(itemId)}`)
        .then((res) => {
          if (res.item) openContentDetails(res.item);
        })
        .catch(() => {});
    }
  }, [openContentDetails]);

  const navItems: { id: AppSection; label: string; icon: React.ReactNode; group: 'discover' | 'library' | 'account' }[] = [
    { id: 'home', label: t(language, 'home'), icon: <Home className="w-4 h-4" />, group: 'discover' },
    { id: 'tafseer', label: t(language, 'tafseer'), icon: <BookOpen className="w-4 h-4" />, group: 'discover' },
    { id: 'hadith', label: t(language, 'hadith'), icon: <Sparkles className="w-4 h-4" />, group: 'discover' },
    { id: 'speeches', label: t(language, 'speeches'), icon: <Mic className="w-4 h-4" />, group: 'discover' },
    { id: 'qa', label: t(language, 'qa'), icon: <HelpCircle className="w-4 h-4" />, group: 'discover' },
    { id: 'lectures', label: t(language, 'lectures'), icon: <Library className="w-4 h-4" />, group: 'discover' },
    { id: 'documents', label: t(language, 'documents'), icon: <FileText className="w-4 h-4" />, group: 'discover' },
    { id: 'search', label: t(language, 'search'), icon: <Search className="w-4 h-4" />, group: 'library' },
    { id: 'downloads', label: t(language, 'downloads'), icon: <Download className="w-4 h-4" />, group: 'library' },
    { id: 'favorites', label: t(language, 'favorites'), icon: <Heart className="w-4 h-4" />, group: 'library' },
    { id: 'history', label: t(language, 'history'), icon: <History className="w-4 h-4" />, group: 'library' },
    { id: 'profile', label: t(language, 'profile'), icon: <User className="w-4 h-4" />, group: 'account' },
    { id: 'settings', label: t(language, 'settings'), icon: <Settings className="w-4 h-4" />, group: 'account' },
  ];

  const navigate = (target: AppSection) => {
    setSection(target);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-[100dvh] w-full flex bg-[#F8F8F6] text-slate-900 dark:bg-[#0B1110] dark:text-slate-100">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-e border-slate-200 bg-white dark:border-slate-800 dark:bg-[#101816]">
        <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-100 dark:border-slate-800">
          <img
            src="/assets/aistudio/WhatsApp_Image_2026-11-25_at_03.55.32_835749e8.jpeg"
            alt="Minaratul Huda Logo"
            className="h-9 w-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
          />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap truncate">
            {t(language, 'brand')}
          </span>
        </div>

        <nav aria-label="Primary sidebar navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {(['discover', 'library', 'account'] as const).map((grp) => (
            <div key={grp} className="space-y-1">
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500">
                {grp === 'discover' ? 'Teachings' : grp === 'library' ? 'My Library' : 'Account'}
              </p>
              {navItems
                .filter((i) => i.group === grp)
                .map((item) => {
                  const active = section === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(item.id)}
                      className={`w-full flex items-center gap-3 min-h-[40px] rounded-xl px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? 'bg-[#0F4C3A] text-white dark:bg-emerald-600'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
                      }`}
                    >
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <PWAInstallButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:ps-64 min-w-0 w-full">
        {/* Top Bar Contract: 3-Zone Header */}
        <header className="sticky top-0 z-30 h-12 sm:h-14 lg:h-16 pt-[env(safe-area-inset-top)] border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-[#101816]/90">
          <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-2 sm:gap-4 lg:gap-8 px-3 sm:px-6">
            {/* Zone 1: Brand Wordmark */}
            <button
              type="button"
              onClick={() => navigate('home')}
              className="flex items-center gap-2 lg:hidden font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white min-w-0 cursor-pointer"
            >
              <img
                src="/assets/aistudio/WhatsApp_Image_2026-11-25_at_03.55.32_835749e8.jpeg"
                alt="Minaratul Huda Logo"
                className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
              <span className="truncate">{t(language, 'brand')}</span>
            </button>

            <span className="hidden lg:block font-display text-base font-semibold text-slate-900 dark:text-white whitespace-nowrap shrink-0">
              {t(language, 'brandFull')}
            </span>

            {/* Zone 2: 4 Concise Single-Line Nav Links */}
            <nav className="hidden md:flex items-center gap-5 lg:gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
              {(['tafseer', 'hadith', 'speeches', 'qa'] as AppSection[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigate(id)}
                  className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    section === id ? 'text-[#0F4C3A] dark:text-emerald-400 font-semibold' : ''
                  }`}
                >
                  {t(language, id)}
                </button>
              ))}
            </nav>

            {/* Zone 3: 1 Primary Action */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigate('search')}
                className="inline-flex items-center gap-1.5 min-h-[36px] sm:min-h-[40px] rounded-xl bg-[#0F4C3A] px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-white hover:bg-[#0B3B2D] dark:bg-emerald-600 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span>{t(language, 'search')}</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
                className="lg:hidden min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Offline Connectivity Indicator */}
        {!isOnline && (
          <div className="bg-amber-600 px-4 py-2 text-center text-xs font-medium text-white flex items-center justify-center gap-2">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span>{t(language, 'offlineBanner')}</span>
          </div>
        )}

        {/* Active Page Viewport */}
        <main className="mx-auto w-full max-w-6xl flex-1 min-w-0 px-3 sm:px-6 py-4 sm:py-6 lg:py-8 pb-[calc(8.5rem+env(safe-area-inset-bottom))] lg:pb-24">
          {section === 'home' && <HomeView />}
          {section === 'tafseer' && (
            <CategoryBrowseView
              categorySlug="tafseer"
              titleKey="tafseer"
              subtitle="Browse Quranic exegesis by Surah, series, and individual lectures."
            />
          )}
          {section === 'hadith' && (
            <CategoryBrowseView
              categorySlug="hadith"
              titleKey="hadith"
              subtitle="Authentic Prophetic traditions organized by collection, topic, and series."
            />
          )}
          {section === 'speeches' && (
            <CategoryBrowseView
              categorySlug="speeches"
              titleKey="speeches"
              subtitle="Friday Khutbahs, Eid addresses, community gatherings, and conference talks."
            />
          )}
          {section === 'qa' && <QAView />}
          {section === 'lectures' && (
            <CategoryBrowseView
              categorySlug="lectures"
              titleKey="lectures"
              subtitle="Structured lessons across Aqeedah, Islamic Ethics, Tajweed, and expandable categories."
            />
          )}
          {section === 'documents' && (
            <CategoryBrowseView
              categorySlug="documents"
              titleKey="documents"
              subtitle="Written scholarly treatises, study companions, and downloadable PDFs."
            />
          )}
          {section === 'search' && <SearchView />}
          {section === 'downloads' && <DownloadsView />}
          {section === 'favorites' && <FavoritesView />}
          {section === 'history' && <HistoryView />}
          {section === 'profile' && <ProfileView />}
          {section === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Mobile Fixed Bottom Tab Bar (Thumb Zone) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-[calc(3.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-[#101816]/95 grid grid-cols-5 items-center"
      >
        {[
          { id: 'home' as AppSection, label: t(language, 'home'), icon: <Home className="w-5 h-5" /> },
          { id: 'tafseer' as AppSection, label: 'Tafseer', icon: <BookOpen className="w-5 h-5" /> },
          { id: 'search' as AppSection, label: t(language, 'search'), icon: <Search className="w-5 h-5" /> },
          { id: 'downloads' as AppSection, label: 'Offline', icon: <Download className="w-5 h-5" /> },
          { id: 'profile' as AppSection, label: user ? 'Account' : 'Menu', icon: <User className="w-5 h-5" /> },
        ].map((tab) => {
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(tab.id)}
              className={`flex flex-col items-center justify-center h-full gap-0.5 min-w-0 px-1 cursor-pointer ${
                active ? 'text-[#0F4C3A] dark:text-emerald-400 font-semibold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {tab.icon}
              <span className="text-[10px] tracking-tight truncate max-w-full">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Mobile Full Drawer Menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs lg:hidden flex justify-end"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-80 max-w-[85vw] h-[100dvh] bg-white dark:bg-[#101816] p-5 overflow-y-auto flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src="/assets/aistudio/WhatsApp_Image_2026-11-25_at_03.55.32_835749e8.jpeg"
                    alt="Minaratul Huda Logo"
                    className="h-8 w-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                  <span className="font-display text-lg font-bold text-slate-900 dark:text-white truncate">
                    {t(language, 'brandFull')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-slate-500 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-4 space-y-1">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    className={`w-full flex items-center gap-3 min-h-[44px] rounded-xl px-3.5 text-sm font-medium cursor-pointer ${
                      section === item.id
                        ? 'bg-[#0F4C3A] text-white dark:bg-emerald-600'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <PWAInstallButton />
            </div>
          </div>
        </div>
      )}

      {/* Persistent Global Media & Reader Overlays */}
      <ContentDetailsModal />
      <UniversalReader />
      <AudioPlayerOverlay />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-18 end-4 z-50 rounded-xl border border-slate-200 bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg dark:border-slate-700 dark:bg-emerald-900">
          {toast}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AudioProvider>
        <MainShell />
      </AudioProvider>
    </AppProvider>
  );
}
