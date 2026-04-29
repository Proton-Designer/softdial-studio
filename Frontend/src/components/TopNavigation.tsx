import { useState, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Search, Bell, ChevronDown, Settings, LogOut, User, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  ensureWeekSummary,
  type AppNotification,
} from '@/lib/api';
import type { TabType } from './MainApp';

const TAB_LABELS: Record<TabType, string> = {
  dashboard: 'Dashboard',
  dialer: 'Dialer',
  contacts: 'Contacts',
  campaigns: 'Campaigns',
  analytics: 'Analytics',
  settings: 'Settings',
};

interface TopNavigationProps {
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
}

function getDisplayName(user: { user_metadata?: Record<string, unknown>; email?: string }): string {
  const meta = user?.user_metadata;
  const first = (meta?.first_name as string)?.trim?.() || '';
  const last = (meta?.last_name as string)?.trim?.() || '';
  if (first || last) return `${first} ${last}`.trim();
  return user?.email ?? 'User';
}

function getInitials(user: { user_metadata?: Record<string, unknown>; email?: string }): string {
  const meta = user?.user_metadata;
  const first = (meta?.first_name as string)?.trim?.() || '';
  const last = (meta?.last_name as string)?.trim?.() || '';
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  const email = (user?.email ?? '').trim();
  if (email) return email.slice(0, 2).toUpperCase();
  return 'U';
}

function formatNotificationDate(created_at: string): string {
  const d = new Date(created_at);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString();
}

export function TopNavigation({ activeTab = 'dashboard', onTabChange }: TopNavigationProps) {
  const { user, signOut } = useAuth();
  const [searchFocused, setSearchFocused] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    ensureWeekSummary().catch(() => {});
  }, []);

  useEffect(() => {
    getUnreadNotificationCount()
      .then(setUnreadCount)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!showNotifications) return;
    listNotifications()
      .then(setNotifications)
      .catch(() => setNotifications([]));
    getUnreadNotificationCount()
      .then(setUnreadCount)
      .catch(() => {});
  }, [showNotifications]);

  const displayName = user ? getDisplayName(user) : 'User';
  const email = user?.email ?? '';
  const initials = user ? getInitials(user) : 'U';

  const handleOpenNotification = async (n: AppNotification) => {
    if (!n.read_at) {
      await markNotificationRead(n.id).catch(() => {});
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead().catch(() => {});
    setUnreadCount(0);
    setNotifications((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
  };

  const handleSignOutConfirm = () => {
    setShowUserMenu(false);
    setShowSignOutConfirm(false);
    localStorage.clear();
    sessionStorage.clear();
    signOut();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-[72px] bg-[#1A2332]/60 backdrop-blur-xl border-b border-white/5 flex items-center px-6 z-50">
      {/* Left Section */}
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00D9FF] to-[#0066FF] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white rounded-full" />
          </div>
          <span className="text-xl font-bold text-white">Softdial</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-[#B0BEC5]">
          <span className="hover:text-white cursor-pointer transition-colors">Home</span>
          <span>/</span>
          <span className="text-white">{TAB_LABELS[activeTab]}</span>
        </div>
      </div>

      {/* Center Section - Search */}
      <div className="flex-1 flex justify-center px-8">
        <motion.div 
          className="relative"
          animate={{ width: searchFocused ? 580 : 520 }}
          transition={{ duration: 0.2 }}
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B0BEC5]" />
          <input
            type="text"
            placeholder="Search contacts, campaigns, calls..."
            className="w-full bg-[#1E2A3A]/60 backdrop-blur-sm border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-[#B0BEC5]/50 focus:outline-none focus:border-[#00D9FF] transition-colors"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </motion.div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Live call indicator */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#00E676]/10 border border-[#00E676]/20">
          <div className="relative">
            <div className="w-2 h-2 bg-[#00E676] rounded-full" />
            <div className="absolute inset-0 w-2 h-2 bg-[#00E676] rounded-full animate-ping" />
          </div>
          <span className="text-sm text-[#00E676] font-medium">Ready</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 hover:bg-white/5 rounded-lg transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-[#B0BEC5]" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#FF3D00] rounded-full flex items-center justify-center text-xs text-white font-semibold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <AnimatePresence>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} aria-hidden="true" />
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 top-full mt-2 w-[360px] max-h-[420px] flex flex-col bg-[#1A2332]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden"
                >
                  <div className="p-3 border-b border-white/10 flex items-center justify-between">
                    <span className="font-semibold text-white">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs text-[#00D9FF] hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1 custom-scrollbar">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-sm text-[#B0BEC5] text-center">No notifications</p>
                    ) : (
                      <ul className="p-2 space-y-1">
                        {notifications.map((n) => {
                          let bodyContent: ReactNode = n.body;
                          if (n.type === 'week_summary' && n.body) {
                            try {
                              const data = JSON.parse(n.body) as {
                                week_start?: string;
                                week_end?: string;
                                calls?: number;
                                connect_rate?: number;
                                talk_time_formatted?: string;
                              };
                              bodyContent = (
                                <span className="text-xs text-[#B0BEC5] block mt-1">
                                  Calls: {data.calls ?? 0} · Connect rate: {data.connect_rate ?? 0}% · Talk time: {data.talk_time_formatted ?? '0m'}
                                </span>
                              );
                            } catch {
                              bodyContent = n.body;
                            }
                          }
                          return (
                            <li key={n.id}>
                              <button
                                type="button"
                                onClick={() => handleOpenNotification(n)}
                                className={`w-full text-left p-3 rounded-lg transition-colors ${n.read_at ? 'bg-transparent hover:bg-white/5' : 'bg-[#0066FF]/10'}`}
                              >
                                <div className="font-medium text-white text-sm">{n.title}</div>
                                {bodyContent && <div className="mt-0.5">{bodyContent}</div>}
                                <div className="text-xs text-[#B0BEC5] mt-1">{formatNotificationDate(n.created_at)}</div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-xl transition-colors"
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00D9FF] to-[#0066FF] flex items-center justify-center text-white font-semibold text-sm">
                {initials}
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#00E676] rounded-full border-2 border-[#1A2332]" />
            </div>
            <ChevronDown className="w-4 h-4 text-[#B0BEC5]" />
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 top-full mt-2 w-64 bg-[#1A2332]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden z-50"
                >
                  <div className="p-4 border-b border-white/10">
                    <div className="font-semibold text-white">{displayName}</div>
                    <div className="text-sm text-[#B0BEC5] truncate">{email || 'No email'}</div>
                  </div>

                  <div className="p-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onTabChange?.('settings');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg transition-colors text-white"
                    >
                      <User className="w-4 h-4 text-[#B0BEC5]" />
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onTabChange?.('settings');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg transition-colors text-white"
                    >
                      <Settings className="w-4 h-4 text-[#B0BEC5]" />
                      Settings
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onTabChange?.('settings');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg transition-colors text-white"
                    >
                      <CreditCard className="w-4 h-4 text-[#B0BEC5]" />
                      Billing
                    </button>
                  </div>

                  <div className="p-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setShowSignOutConfirm(true)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-lg transition-colors text-[#FF3D00]"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {showSignOutConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-title"
          >
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowSignOutConfirm(false)}
              aria-hidden="true"
            />
            <div
              className="relative z-[101] flex h-72 w-72 flex-col rounded-xl border border-white/10 bg-[#1A2332] p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="signout-title" className="text-base font-semibold text-white">
                Sign out?
              </h2>
              <p className="mt-2 flex-1 text-xs leading-snug text-[#B0BEC5]">
                Are you sure you want to sign out? You will need to sign in again to access your account.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSignOutConfirm(false)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/20"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSignOutConfirm}
                  className="flex-1 rounded-lg bg-[#FF3D00] px-3 py-2 text-xs font-medium text-white hover:bg-[#FF3D00]/90"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </nav>
  );
}