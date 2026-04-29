import { motion } from 'motion/react';
import { LayoutGrid, Phone, Users, Target, BarChart3, Settings, Menu } from 'lucide-react';
import { TabType } from './MainApp';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const tabs = [
  { id: 'dashboard' as TabType, icon: LayoutGrid, label: 'Dashboard' },
  { id: 'dialer' as TabType, icon: Phone, label: 'Dialer' },
  { id: 'contacts' as TabType, icon: Users, label: 'Contacts' },
  { id: 'campaigns' as TabType, icon: Target, label: 'Campaigns' },
  { id: 'analytics' as TabType, icon: BarChart3, label: 'Analytics' },
];

const TOP_NAV_HEIGHT = 72;

export function Sidebar({ activeTab, onTabChange, collapsed, onToggleCollapse }: SidebarProps) {
  return (
    <motion.aside
      className="fixed left-0 bottom-0 z-40 bg-[#1A2332]/60 backdrop-blur-xl border-r border-white/5 flex flex-col overflow-hidden"
      style={{ top: TOP_NAV_HEIGHT }}
      animate={{ width: collapsed ? 64 : 280 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Navigation Items */}
      <nav className="flex-1 p-3 space-y-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all relative group
                ${isActive 
                  ? 'bg-[#0066FF]/10 text-white' 
                  : 'text-[#B0BEC5] hover:bg-white/5 hover:text-white'
                }
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute left-0 top-0 bottom-0 w-1 bg-[#00D9FF] rounded-r-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#00D9FF]' : ''}`} />
              
              {!collapsed && (
                <span className="font-medium">{tab.label}</span>
              )}

              {collapsed && (
                <div className="absolute left-full ml-2 px-3 py-2 bg-[#1A2332] rounded-lg shadow-lg border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  <span className="text-sm text-white">{tab.label}</span>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Settings at bottom */}
      <div className="p-3 border-t border-white/5">
        <button
          onClick={() => onTabChange('settings')}
          className={`
            w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all relative group
            ${activeTab === 'settings'
              ? 'bg-[#0066FF]/10 text-white' 
              : 'text-[#B0BEC5] hover:bg-white/5 hover:text-white'
            }
          `}
        >
          {activeTab === 'settings' && (
            <motion.div
              layoutId="activeTab"
              className="absolute left-0 top-0 bottom-0 w-1 bg-[#00D9FF] rounded-r-full"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          
          <Settings className={`w-5 h-5 flex-shrink-0 ${activeTab === 'settings' ? 'text-[#00D9FF]' : ''}`} />
          
          {!collapsed && (
            <span className="font-medium">Settings</span>
          )}

          {collapsed && (
            <div className="absolute left-full ml-2 px-3 py-2 bg-[#1A2332] rounded-lg shadow-lg border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              <span className="text-sm text-white">Settings</span>
            </div>
          )}
        </button>

        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl transition-all text-[#B0BEC5] hover:bg-white/5 hover:text-white mt-2"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </motion.aside>
  );
}
