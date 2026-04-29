import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Users, Target, Loader2 } from 'lucide-react';
import {
  listCampaigns,
  createCampaign,
  type CampaignWithStats,
} from '../lib/api';
import { CampaignManageModal } from './campaigns/CampaignManageModal';

function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface CampaignsProps {
  onNavigateToDialer?: () => void;
  onStartParallelDial?: (ctx: { sessionId: string; campaignId: string }) => void;
  onOpenDialerWithSession?: (ctx: { sessionId: string; campaignId: string }) => void;
}

export function Campaigns({ onNavigateToDialer, onStartParallelDial, onOpenDialerWithSession }: CampaignsProps) {
  const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused' | 'completed'>('all');
  const [manageCampaignId, setManageCampaignId] = useState<string | null>(null);
  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(() => {
    setLoading(true);
    listCampaigns()
      .then(setCampaigns)
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || c.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleCreateCampaign = async () => {
    const name = newCampaignName.trim();
    if (!name) {
      setCreateError('Campaign name is required');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const campaign = await createCampaign(name);
      setNewCampaignOpen(false);
      setNewCampaignName('');
      fetchCampaigns();
      setManageCampaignId(campaign.id);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="h-[calc(100vh-72px)] bg-[#0A1628]">
      <div className="p-8 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Campaigns</h1>
            <p className="text-[#B0BEC5]">Manage your outreach campaigns</p>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setNewCampaignOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#00D9FF] to-[#0066FF] rounded-xl text-white font-semibold shadow-[0_4px_24px_rgba(0,217,255,0.3)] hover:shadow-[0_6px_32px_rgba(0,217,255,0.4)] transition-all"
          >
            <Plus className="w-5 h-5" />
            New Campaign
          </motion.button>
        </div>

        <div className="bg-[#1A2332]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-[0_4px_24px_rgba(0,102,255,0.15)] mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B0BEC5]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search campaigns..."
                  className="w-full bg-[#1E2A3A] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-[#B0BEC5]/50 focus:outline-none focus:border-[#00D9FF] transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {(['all', 'active', 'paused', 'completed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-3 rounded-xl font-medium transition-all ${
                    filterStatus === status
                      ? status === 'all'
                        ? 'bg-[#0066FF] text-white'
                        : status === 'active'
                          ? 'bg-[#00E676] text-white'
                          : status === 'paused'
                            ? 'bg-[#FFB300] text-white'
                            : 'bg-[#B0BEC5] text-white'
                      : 'bg-[#1E2A3A] text-[#B0BEC5] hover:bg-[#252F3E]'
                  }`}
                >
                  {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#B0BEC5]">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCampaigns.map((campaign, index) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setManageCampaignId(campaign.id)}
                className="group bg-[#1A2332]/60 backdrop-blur-xl hover:bg-[#1A2332] rounded-2xl p-6 border border-white/5 hover:border-[#00D9FF]/30 shadow-[0_4px_24px_rgba(0,102,255,0.15)] hover:shadow-[0_8px_32px_rgba(0,102,255,0.25)] transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-lg mb-2 line-clamp-2">{campaign.name}</h3>
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                        campaign.status === 'active'
                          ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20'
                          : campaign.status === 'paused'
                            ? 'bg-[#FFB300]/10 text-[#FFB300] border border-[#FFB300]/20'
                            : 'bg-[#B0BEC5]/10 text-[#B0BEC5] border border-[#B0BEC5]/20'
                      }`}
                    >
                      {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                    </span>
                  </div>
                </div>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#B0BEC5]">Total Contacts</span>
                    <span className="text-lg font-bold text-white">{campaign.total_contacts ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#B0BEC5]">Passthrough</span>
                    <span className="text-lg font-bold text-[#00D9FF]">{campaign.passthrough ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#B0BEC5]">Queued</span>
                    <span className="text-lg font-bold text-[#00D9FF]">{campaign.queued ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#B0BEC5]">Completed</span>
                    <span className="text-lg font-bold text-[#00E676]">{campaign.completed ?? 0}</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <div className="flex items-center gap-1.5 text-[#B0BEC5]">
                      <Target className="w-4 h-4" />
                      <span>Connect Rate</span>
                    </div>
                    <span className="font-semibold text-[#00E676]">
                      {Number(campaign.connect_rate ?? 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#B0BEC5]">Total Calls Made</span>
                    <span className="font-semibold text-white">{campaign.total_calls_made ?? 0}</span>
                  </div>
                </div>
                <div className="mt-4 text-xs text-[#B0BEC5] space-y-1">
                  <div>Created {formatDate(campaign.created_at)}</div>
                  <div>Last called {formatDate(campaign.last_called_at)}</div>
                </div>
                {(campaign.total_contacts ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setManageCampaignId(campaign.id);
                    }}
                    className="mt-4 w-full px-3 py-2 rounded-lg bg-gradient-to-r from-[#00D9FF] to-[#0066FF] text-white text-sm font-semibold"
                  >
                    Start Parallel Dial
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {!loading && filteredCampaigns.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold text-white mb-2">No campaigns found</h3>
            <p className="text-[#B0BEC5]">Create a campaign or try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* New campaign name modal - rendered inline so motion/context work */}
      <AnimatePresence>
        {newCampaignOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !creating && setNewCampaignOpen(false)}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm"
            aria-hidden
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[88vw] max-w-[280px] sm:w-[80vw] sm:max-w-[300px] rounded-2xl border border-white/10 bg-[#1A2332] p-4 sm:p-5 shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-campaign-title"
            >
              <h3 id="new-campaign-title" className="text-xl font-bold text-white mb-4">
                New Campaign
              </h3>
              <input
                type="text"
                value={newCampaignName}
                onChange={(e) => {
                  setNewCampaignName(e.target.value);
                  setCreateError(null);
                }}
                placeholder="Campaign name"
                className="w-full bg-[#1E2A3A] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#B0BEC5]/50 focus:outline-none focus:border-[#00D9FF] mb-4"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCampaign()}
              />
              {createError && (
                <p className="text-sm text-[#FF3D00] mb-4">{createError}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setNewCampaignOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#1E2A3A] text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={creating || !newCampaignName.trim()}
                  onClick={handleCreateCampaign}
                  className="px-4 py-2 rounded-xl bg-[#0066FF] text-white disabled:opacity-50 flex items-center gap-2"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CampaignManageModal
        open={manageCampaignId !== null}
        campaignId={manageCampaignId}
        onClose={() => setManageCampaignId(null)}
        onRefreshList={fetchCampaigns}
        onNavigateToDialer={onNavigateToDialer ?? (() => {})}
        onStartParallelDial={onStartParallelDial ?? (() => {})}
        onOpenDialerWithSession={onOpenDialerWithSession ?? (() => {})}
      />
    </div>
  );
}
