import { useState } from 'react';
import { TopNavigation } from './TopNavigation';
import { Sidebar } from './Sidebar';
import { Dashboard } from './Dashboard';
import { Dialer } from './Dialer';
import { Contacts } from './Contacts';
import { Campaigns } from './Campaigns';
import { Analytics } from './Analytics';
import { Settings } from './Settings';

export type TabType = 'dashboard' | 'dialer' | 'contacts' | 'campaigns' | 'analytics' | 'settings';

export interface ParallelDialLaunchContext {
  sessionId: string;
  campaignId: string;
}

export function MainApp() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [parallelDialContext, setParallelDialContext] = useState<ParallelDialLaunchContext | null>(null);

  const topBarHeight = 72;

  return (
    <div className="h-screen bg-[#0A1628] flex flex-col overflow-hidden">
      <TopNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      {/* Spacer reserves space so content starts below the fixed top bar */}
      <div aria-hidden className="flex-shrink-0" style={{ height: topBarHeight }} />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main
          className="flex-1 min-h-0 overflow-auto transition-[margin-left] duration-250 ease-out"
          style={{ marginLeft: sidebarCollapsed ? 64 : 280 }}
        >
          {activeTab === 'dashboard' && (
            <Dashboard
              onNavigateToDialer={() => setActiveTab('dialer')}
              onNavigateToContacts={() => setActiveTab('contacts')}
              onNavigateToCampaigns={() => setActiveTab('campaigns')}
            />
          )}
          {activeTab === 'dialer' && (
            <Dialer
              parallelSessionId={parallelDialContext?.sessionId ?? null}
              parallelCampaignId={parallelDialContext?.campaignId ?? null}
              onClearParallelContext={() => setParallelDialContext(null)}
            />
          )}
          {activeTab === 'contacts' && <Contacts />}
          {activeTab === 'campaigns' && (
            <Campaigns
              onNavigateToDialer={() => setActiveTab('dialer')}
              onStartParallelDial={(ctx) => {
                setParallelDialContext(ctx);
                setActiveTab('dialer');
              }}
              onOpenDialerWithSession={(ctx) => {
                setParallelDialContext(ctx);
                setActiveTab('dialer');
              }}
            />
          )}
          {activeTab === 'analytics' && <Analytics />}
          {activeTab === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}