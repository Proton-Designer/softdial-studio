import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Phone, Trash2, Upload, UserPlus, Users, Play, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getCampaign,
  updateCampaignStatus,
  listCampaignLeads,
  addLeadsToCampaign,
  removeLeadFromCampaign,
  removeLeadsFromCampaign,
  listContacts,
  startDialerSession,
  stopDialerSession,
  ActiveSessionExistsError,
  type CampaignWithStats,
  type CampaignLead,
  type Contact,
} from '../../lib/api';
import { ImportContactsModal } from '../contacts/ImportContactsModal';
import { AddContactModal } from '../contacts/AddContactModal';
import { usePhoneNumbers } from '../../contexts/PhoneNumbersContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const CATEGORIES = ['All', 'Cold', 'Warm', 'Follow Up', 'Voicemail', 'Booked'] as const;
const CONTACT_STATUSES = ['All', 'No Contact', 'Contacted'] as const;
const LEADS_PER_PAGE = 50;

function contactDisplayName(c: Contact): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return name || c.business_name || '—';
}

function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface CampaignManageModalProps {
  open: boolean;
  campaignId: string | null;
  onClose: () => void;
  onRefreshList: () => void;
  onNavigateToDialer: () => void;
  onStartParallelDial: (ctx: { sessionId: string; campaignId: string }) => void;
  onOpenDialerWithSession?: (ctx: { sessionId: string; campaignId: string }) => void;
}

export function CampaignManageModal({
  open,
  campaignId,
  onClose,
  onRefreshList,
  onNavigateToDialer,
  onStartParallelDial,
  onOpenDialerWithSession,
}: CampaignManageModalProps) {
  const { numbers: userNumbers } = usePhoneNumbers();
  const [campaign, setCampaign] = useState<CampaignWithStats | null>(null);
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [contactStatusFilter, setContactStatusFilter] = useState<string>('All');
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [addNewOpen, setAddNewOpen] = useState(false);
  const [contactsForPicker, setContactsForPicker] = useState<Contact[]>([]);
  const [leadsPage, setLeadsPage] = useState(0);
  const [confirmRemoveContactId, setConfirmRemoveContactId] = useState<string | null>(null);
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);
  const [startDialModalOpen, setStartDialModalOpen] = useState(false);
  const [linesCount, setLinesCount] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [selectedFromNumber, setSelectedFromNumber] = useState<string | null>(null);
  const [callbackNumber, setCallbackNumber] = useState('');
  const [startingDial, setStartingDial] = useState(false);
  /** When start returns 409, we show "Open Dialer" / "Stop & start new" dialog; this is the existing session id. */
  const [activeSessionConflictId, setActiveSessionConflictId] = useState<string | null>(null);

  const fetchCampaign = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const c = await getCampaign(campaignId);
      setCampaign(c);
    } catch {
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  const fetchLeads = useCallback(async () => {
    if (!campaignId) return;
    setLeadsLoading(true);
    try {
      const list = await listCampaignLeads(campaignId);
      setLeads(list);
    } catch {
      setLeads([]);
    } finally {
      setLeadsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (open && campaignId) {
      fetchCampaign();
      fetchLeads();
    }
  }, [open, campaignId, fetchCampaign, fetchLeads]);

  useEffect(() => {
    if (addExistingOpen) {
      listContacts()
        .then(setContactsForPicker)
        .catch(() => setContactsForPicker([]));
    }
  }, [addExistingOpen]);

  const filteredLeads = leads.filter((lead) => {
    const cat = lead.contact?.category ?? '';
    const status = lead.contact?.contact_status ?? '';
    const matchCat = categoryFilter === 'All' || cat === categoryFilter;
    const matchStatus = contactStatusFilter === 'All' || status === contactStatusFilter;
    return matchCat && matchStatus;
  });

  const paginatedLeads = filteredLeads.slice(
    leadsPage * LEADS_PER_PAGE,
    (leadsPage + 1) * LEADS_PER_PAGE
  );
  const totalPages = Math.ceil(filteredLeads.length / LEADS_PER_PAGE) || 1;

  const handleUpdateStatus = async (status: 'active' | 'paused' | 'completed') => {
    if (!campaignId) return;
    try {
      await updateCampaignStatus(campaignId, status);
      await fetchCampaign();
      onRefreshList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    }
  };

  const handleStartParallelDialing = () => {
    console.info('[CampaignManageModal] checkpoint:start_click', {
      campaignId,
      totalContacts: campaign?.total_contacts ?? 0,
      userNumbers: userNumbers.length,
    });
    if (!campaignId) return;
    if ((campaign?.total_contacts ?? 0) === 0) {
      toast.error('Add contacts before starting a session');
      return;
    }
    setSelectedFromNumber(userNumbers[0]?.phone_number ?? null);
    setStartDialModalOpen(true);
  };

  const handleConfirmStartParallelDialing = async () => {
    console.info('[CampaignManageModal] checkpoint:confirm_start', {
      campaignId,
      linesCount,
      selectedFromNumber,
    });
    if (!campaignId) return;
    const fromNumber = selectedFromNumber?.trim();
    if (!fromNumber) {
      toast.error('Choose a phone number to call from');
      return;
    }

    setStartingDial(true);
    try {
      const agentCallControlId =
        typeof window !== 'undefined'
          ? (window.localStorage.getItem('softdial_active_agent_call_control_id') ?? '').trim() ||
            undefined
          : undefined;
      console.info('[CampaignManageModal] checkpoint:api_startDialerSession_call', {
        campaignId,
        linesCount,
        hasAgentCallControlId: Boolean(agentCallControlId),
      });
      const result = await startDialerSession({
        campaignId,
        linesCount,
        fromNumber,
        agentCallControlId,
        agentCallbackNumber: callbackNumber.trim() || undefined,
      });
      console.info('[CampaignManageModal] checkpoint:api_startDialerSession_success', {
        campaignId,
        sessionId: result.sessionId,
      });
      setStartDialModalOpen(false);
      onStartParallelDial({ sessionId: result.sessionId, campaignId });
      onNavigateToDialer();
      toast.success('Parallel dialing session started');
    } catch (e) {
      if (e instanceof ActiveSessionExistsError) {
        console.warn('[CampaignManageModal] checkpoint:existing_session_conflict', {
          campaignId,
          existingSessionId: e.existingSessionId,
        });
        setStartDialModalOpen(false);
        setActiveSessionConflictId(e.existingSessionId);
        return;
      }
      const message = e instanceof Error ? e.message : 'Failed to start session';
      console.warn('[CampaignManageModal] start parallel dial failed', {
        campaignId,
        error: message,
      });
      toast.error(message);
    } finally {
      setStartingDial(false);
    }
  };

  const handleOpenDialerFromConflict = () => {
    const existingId = activeSessionConflictId;
    const cid = campaignId;
    console.info('[CampaignManageModal] checkpoint:open_dialer_from_conflict', {
      campaignId: cid,
      existingSessionId: existingId,
    });
    setActiveSessionConflictId(null);
    setStartDialModalOpen(false);
    if (existingId && cid && onOpenDialerWithSession) {
      onOpenDialerWithSession({ sessionId: existingId, campaignId: cid });
    } else {
      onNavigateToDialer();
    }
  };

  const handleStopAndStartNew = async () => {
    const existingId = activeSessionConflictId;
    console.info('[CampaignManageModal] checkpoint:stop_and_start_new_click', {
      campaignId,
      existingSessionId: existingId,
      linesCount,
      selectedFromNumber,
    });
    if (!existingId || !campaignId) return;
    const fromNumber = selectedFromNumber?.trim();
    if (!fromNumber) {
      toast.error('Choose a phone number to call from');
      return;
    }
    setStartingDial(true);
    try {
      console.info('[CampaignManageModal] checkpoint:stop_existing_session_call', {
        existingSessionId: existingId,
      });
      await stopDialerSession(existingId);
      console.info('[CampaignManageModal] checkpoint:stop_existing_session_success', {
        existingSessionId: existingId,
      });
      setActiveSessionConflictId(null);
      console.info('[CampaignManageModal] checkpoint:start_new_session_after_stop', {
        campaignId,
        linesCount,
      });
      const agentCallControlId =
        typeof window !== 'undefined'
          ? (window.localStorage.getItem('softdial_active_agent_call_control_id') ?? '').trim() ||
            undefined
          : undefined;
      const result = await startDialerSession({
        campaignId,
        linesCount,
        fromNumber,
        agentCallControlId,
        agentCallbackNumber: callbackNumber.trim() || undefined,
      });
      console.info('[CampaignManageModal] checkpoint:start_new_session_success', {
        campaignId,
        sessionId: result.sessionId,
      });
      setStartDialModalOpen(false);
      onStartParallelDial({ sessionId: result.sessionId, campaignId });
      onNavigateToDialer();
      toast.success('Previous session stopped; new parallel dialing session started');
    } catch (e) {
      console.warn('[CampaignManageModal] checkpoint:stop_and_start_new_failed', {
        campaignId,
        existingSessionId: existingId,
        error: e instanceof Error ? e.message : String(e),
      });
      toast.error(e instanceof Error ? e.message : 'Failed to stop or start session');
    } finally {
      setStartingDial(false);
    }
  };

  const handleImportSuccess = () => {
    setImportModalOpen(false);
    fetchLeads();
    fetchCampaign();
    onRefreshList();
  };

  const handleAddExisting = async (selectedIds: string[]) => {
    if (!campaignId || selectedIds.length === 0) return;
    try {
      await addLeadsToCampaign(campaignId, selectedIds);
      setAddExistingOpen(false);
      fetchLeads();
      fetchCampaign();
      onRefreshList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add leads');
    }
  };

  const handleAddNewSuccess = (contact?: Contact) => {
    if (campaignId && contact) {
      addLeadsToCampaign(campaignId, [contact.id]).then(() => {
        fetchLeads();
        fetchCampaign();
        onRefreshList();
      });
    }
    setAddNewOpen(false);
  };

  const doRemoveLead = async (contactId: string) => {
    if (!campaignId) return;
    try {
      await removeLeadFromCampaign(campaignId, contactId);
      fetchLeads();
      fetchCampaign();
      onRefreshList();
      setConfirmRemoveContactId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove lead');
    }
  };

  const doBulkRemove = async () => {
    if (!campaignId || selectedLeadIds.size === 0) return;
    try {
      await removeLeadsFromCampaign(campaignId, Array.from(selectedLeadIds));
      setSelectedLeadIds(new Set());
      fetchLeads();
      fetchCampaign();
      onRefreshList();
      setConfirmBulkRemove(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove leads');
    }
  };

  const handleRemoveLead = (contactId: string) => setConfirmRemoveContactId(contactId);
  const handleBulkRemove = () => selectedLeadIds.size > 0 && setConfirmBulkRemove(true);

  const handleCallLead = (phoneNumber: string | null) => {
    if (phoneNumber) {
      onNavigateToDialer();
      // Optional: could pass number via context/state for Dialer to pre-fill
    } else {
      toast.error('No phone number');
    }
  };

  const toggleSelectLead = (contactId: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const selectAllOnPage = () => {
    const ids = paginatedLeads.map((l) => l.contact_id);
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  if (!open) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, isolation: 'isolate' }}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed inset-8 bg-[#1A2332] rounded-3xl border border-white/10 shadow-xl overflow-hidden flex flex-col"
        style={{ zIndex: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 flex-shrink-0">
          <div>
            {loading ? (
              <div className="flex items-center gap-2 text-white">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading…
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-white">{campaign?.name ?? 'Campaign'}</h2>
                <p className="text-sm text-[#B0BEC5] mt-1">
                  Created {campaign ? formatDate(campaign.created_at) : '—'}
                </p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-[#1E2A3A] hover:bg-[#252F3E] text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar min-h-0">
          {campaign && (
            <>
              {/* Status + Start Parallel Dialing */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#B0BEC5]">Status</span>
                  <Select
                    value={campaign.status}
                    onValueChange={(v) =>
                      handleUpdateStatus(v as 'active' | 'paused' | 'completed')
                    }
                  >
                    <SelectTrigger className="w-[140px] bg-[#1E2A3A] border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      className="bg-[#1E2A3A] border-white/10"
                      style={{ zIndex: 10001 }}
                    >
                      <SelectItem
                        value="active"
                        className="bg-[#1E2A3A] hover:bg-white/10 focus:bg-white/10 text-white focus:text-white"
                      >
                        Active
                      </SelectItem>
                      <SelectItem
                        value="paused"
                        className="bg-[#1E2A3A] hover:bg-white/10 focus:bg-white/10 text-white focus:text-white"
                      >
                        Paused
                      </SelectItem>
                      <SelectItem
                        value="completed"
                        className="bg-[#1E2A3A] hover:bg-white/10 focus:bg-white/10 text-white focus:text-white"
                      >
                        Completed
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <button
                  type="button"
                  onClick={handleStartParallelDialing}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#00D9FF] to-[#0066FF] rounded-xl text-white font-semibold"
                >
                  <Play className="w-4 h-4" />
                  Start Parallel Dialing Session
                </button>
              </div>

              {/* Leads section */}
              <div className="bg-[#1E2A3A]/60 rounded-2xl border border-white/5 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <h3 className="text-lg font-bold text-white">Leads</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setImportModalOpen(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-[#1A2332] hover:bg-[#252F3E] border border-white/10 rounded-lg text-white text-sm"
                    >
                      <Upload className="w-4 h-4" />
                      Import from CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddExistingOpen(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-[#1A2332] hover:bg-[#252F3E] border border-white/10 rounded-lg text-white text-sm"
                    >
                      <Users className="w-4 h-4" />
                      Add existing contacts
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddNewOpen(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-[#1A2332] hover:bg-[#252F3E] border border-white/10 rounded-lg text-white text-sm"
                    >
                      <UserPlus className="w-4 h-4" />
                      Add new contact
                    </button>
                    {selectedLeadIds.size > 0 && (
                      <button
                        type="button"
                        onClick={handleBulkRemove}
                        className="flex items-center gap-2 px-3 py-2 bg-[#FF3D00]/10 hover:bg-[#FF3D00]/20 border border-[#FF3D00]/20 rounded-lg text-[#FF3D00] text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove selected ({selectedLeadIds.size})
                      </button>
                    )}
                  </div>
                </div>

                {/* Sort/filter leads */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="text-sm text-[#B0BEC5]">Filter:</span>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[160px] bg-[#1A2332] border-white/10 text-white">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent
                      className="bg-[#1E2A3A] border-white/10"
                      style={{ zIndex: 10001 }}
                    >
                      {CATEGORIES.map((c) => (
                        <SelectItem
                          key={c}
                          value={c}
                          className="bg-[#1E2A3A] hover:bg-white/10 focus:bg-white/10 text-white focus:text-white"
                        >
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={contactStatusFilter} onValueChange={setContactStatusFilter}>
                    <SelectTrigger className="w-[160px] bg-[#1A2332] border-white/10 text-white">
                      <SelectValue placeholder="Contact status" />
                    </SelectTrigger>
                    <SelectContent
                      className="bg-[#1E2A3A] border-white/10"
                      style={{ zIndex: 10001 }}
                    >
                      {CONTACT_STATUSES.map((s) => (
                        <SelectItem
                          key={s}
                          value={s}
                          className="bg-[#1E2A3A] hover:bg-white/10 focus:bg-white/10 text-white focus:text-white"
                        >
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {leadsLoading ? (
                  <div className="flex items-center justify-center py-12 text-[#B0BEC5]">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[#B0BEC5] border-b border-white/5">
                            <th className="pb-2 pr-2">
                              <input
                                type="checkbox"
                                checked={
                                  paginatedLeads.length > 0 &&
                                  paginatedLeads.every((l) => selectedLeadIds.has(l.contact_id))
                                }
                                onChange={(e) => {
                                  if (e.target.checked) selectAllOnPage();
                                  else setSelectedLeadIds(new Set());
                                }}
                              />
                            </th>
                            <th className="pb-2 pr-2">Name</th>
                            <th className="pb-2 pr-2">Business type</th>
                            <th className="pb-2 pr-2">Phone</th>
                            <th className="pb-2 pr-2">Category</th>
                            <th className="pb-2 pr-2">Contact status</th>
                            <th className="pb-2 pr-2">Lead status</th>
                            <th className="pb-2 pr-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedLeads.map((lead) => (
                            <tr key={lead.id} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-3 pr-2">
                                <input
                                  type="checkbox"
                                  checked={selectedLeadIds.has(lead.contact_id)}
                                  onChange={() => toggleSelectLead(lead.contact_id)}
                                />
                              </td>
                              <td className="py-3 pr-2 text-white">
                                {contactDisplayName(lead.contact)}
                              </td>
                              <td className="py-3 pr-2 text-[#B0BEC5]">
                                {lead.contact?.business_type ?? '—'}
                              </td>
                              <td className="py-3 pr-2 text-[#00D9FF]">
                                {lead.contact?.phone_number ?? '—'}
                              </td>
                              <td className="py-3 pr-2 text-[#B0BEC5]">
                                {lead.contact?.category ?? '—'}
                              </td>
                              <td className="py-3 pr-2 text-[#B0BEC5]">
                                {lead.contact?.contact_status ?? '—'}
                              </td>
                              <td className="py-3 pr-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs ${
                                    lead.status === 'completed'
                                      ? 'bg-[#00E676]/10 text-[#00E676]'
                                      : lead.status === 'passthrough'
                                        ? 'bg-[#00D9FF]/10 text-[#00D9FF]'
                                        : 'bg-[#FFB300]/10 text-[#FFB300]'
                                  }`}
                                >
                                  {lead.status}
                                </span>
                              </td>
                              <td className="py-3 pr-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCallLead(lead.contact?.phone_number ?? null)
                                    }
                                    className="p-2 rounded-lg hover:bg-[#00D9FF]/20 text-[#00D9FF]"
                                    title="Call"
                                  >
                                    <Phone className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveLead(lead.contact_id)}
                                    className="p-2 rounded-lg hover:bg-[#FF3D00]/20 text-[#FF3D00]"
                                    title="Remove from campaign"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {filteredLeads.length === 0 && (
                      <div className="py-12 text-center text-[#B0BEC5]">
                        No leads match the filters. Import or add contacts to this campaign.
                      </div>
                    )}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                        <span className="text-sm text-[#B0BEC5]">
                          Page {leadsPage + 1} of {totalPages}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={leadsPage === 0}
                            onClick={() => setLeadsPage((p) => Math.max(0, p - 1))}
                            className="px-3 py-1 rounded bg-[#1E2A3A] disabled:opacity-50 text-white text-sm"
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            disabled={leadsPage >= totalPages - 1}
                            onClick={() => setLeadsPage((p) => Math.min(totalPages - 1, p + 1))}
                            className="px-3 py-1 rounded bg-[#1E2A3A] disabled:opacity-50 text-white text-sm"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Import modal */}
      <ImportContactsModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={handleImportSuccess}
        campaignId={campaignId ?? undefined}
      />

      {/* Add existing contacts modal */}
      <AnimatePresence>
        {addExistingOpen && (
          <AddExistingContactsModal
            contacts={contactsForPicker}
            existingContactIds={new Set(leads.map((l) => l.contact_id))}
            onClose={() => setAddExistingOpen(false)}
            onConfirm={handleAddExisting}
          />
        )}
      </AnimatePresence>

      {/* Add new contact */}
      <AddContactModal
        open={addNewOpen}
        onClose={() => setAddNewOpen(false)}
        onSuccess={handleAddNewSuccess}
      />

      {/* Start parallel dial modal */}
      <AnimatePresence>
        {startDialModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 10000 }}
          >
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => !startingDial && setStartDialModalOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-[1] w-full max-w-md rounded-2xl border border-white/10 bg-[#1A2332] shadow-xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-2">Start Parallel Dial</h3>
              <p className="text-sm text-[#B0BEC5] mb-4">
                We&apos;ll dial up to <span className="text-white font-semibold">{linesCount}</span>{' '}
                numbers at once and connect you instantly when someone answers.
              </p>
              <p className="text-sm text-[#B0BEC5] mb-4">
                Campaign: <span className="text-white">{campaign?.name ?? 'Campaign'}</span>
              </p>
              {userNumbers.length === 0 ? (
                <p className="text-sm text-[#FFB300] mb-5">
                  Purchase a phone number in Settings to call from.
                </p>
              ) : (
                <div className="mb-5">
                  <label className="text-sm text-[#B0BEC5] block mb-2">Call from</label>
                  <Select
                    value={selectedFromNumber ?? userNumbers[0]?.phone_number ?? ''}
                    onValueChange={setSelectedFromNumber}
                  >
                    <SelectTrigger className="w-full bg-[#1E2A3A] border-white/10 text-white">
                      <SelectValue placeholder="Select number" />
                    </SelectTrigger>
                    <SelectContent
                      className="bg-[#1E2A3A] border-white/10"
                      style={{ zIndex: 10001 }}
                    >
                      {userNumbers.map((num) => (
                        <SelectItem
                          key={num.id}
                          value={num.phone_number}
                          className="bg-[#1E2A3A] hover:bg-white/10 focus:bg-white/10 text-white focus:text-white"
                        >
                          {num.phone_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Select
                value={String(linesCount)}
                onValueChange={(v) => setLinesCount(Number(v) as 1 | 2 | 3 | 4 | 5)}
              >
                <SelectTrigger className="w-[120px] bg-[#1E2A3A] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1E2A3A] border-white/10" style={{ zIndex: 10001 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem
                      key={n}
                      value={String(n)}
                      className="bg-[#1E2A3A] hover:bg-white/10 focus:bg-white/10 text-white focus:text-white"
                    >
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="mb-5">
                <label className="text-sm text-[#B0BEC5] block mb-2">
                  Callback Number <span className="text-[#B0BEC5]/50">(Optional)</span>
                </label>
                <input
                  type="tel"
                  placeholder="e.g. your mobile number"
                  value={callbackNumber}
                  onChange={(e) => setCallbackNumber(e.target.value)}
                  className="w-full bg-[#1E2A3A] border border-white/10 rounded-md px-3 py-2 text-white placeholder:text-white/20 focus:outline-none focus:border-[#00D9FF]"
                />
                <p className="text-xs text-[#B0BEC5]/70 mt-1">
                  We&apos;ll call this number when a human answers. Leave empty if you are already
                  connected via WebRTC/SIP.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStartDialModalOpen(false)}
                  disabled={startingDial}
                  className="px-4 py-2 rounded-lg bg-[#1E2A3A] text-white disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStartParallelDialing}
                  disabled={startingDial || userNumbers.length === 0 || !selectedFromNumber}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#00D9FF] to-[#0066FF] text-white disabled:opacity-60 flex items-center gap-2"
                >
                  {startingDial && <Loader2 className="w-4 h-4 animate-spin" />}
                  Start Session
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active session conflict: offer Open Dialer or Stop & start new */}
      <AnimatePresence>
        {activeSessionConflictId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 10001 }}
          >
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setActiveSessionConflictId(null)}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-[1] w-full max-w-sm rounded-2xl border border-white/10 bg-[#1A2332] shadow-xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-white mb-6">
                An active dialer session already exists for this campaign. Open the Dialer to resume
                it, or stop it and start a new session.
              </p>
              <div className="flex flex-col sm:flex-row justify-end gap-2">
                <button
                  type="button"
                  onClick={handleOpenDialerFromConflict}
                  className="px-4 py-2 rounded-lg bg-[#1E2A3A] text-white hover:bg-[#252F3E]"
                >
                  Open Dialer
                </button>
                <button
                  type="button"
                  onClick={handleStopAndStartNew}
                  disabled={startingDial || !selectedFromNumber}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#00D9FF] to-[#0066FF] text-white disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {startingDial && <Loader2 className="w-4 h-4 animate-spin" />}
                  Stop & start new
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Remove-from-campaign confirmation */}
      <AnimatePresence>
        {(confirmRemoveContactId !== null || confirmBulkRemove) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 10000 }}
          >
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => {
                setConfirmRemoveContactId(null);
                setConfirmBulkRemove(false);
              }}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-[1] w-full max-w-sm rounded-2xl border border-white/10 bg-[#1A2332] shadow-xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-white mb-6">
                {confirmBulkRemove
                  ? `Remove ${selectedLeadIds.size} contact${selectedLeadIds.size === 1 ? '' : 's'} from the campaign? They will remain in your Contacts.`
                  : 'Remove this contact from the campaign? They will remain in your Contacts.'}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmRemoveContactId(null);
                    setConfirmBulkRemove(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#1E2A3A] text-white hover:bg-[#252F3E]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmRemoveContactId !== null) doRemoveLead(confirmRemoveContactId);
                    else if (confirmBulkRemove) doBulkRemove();
                  }}
                  className="px-4 py-2 rounded-lg bg-[#FF3D00]/20 text-[#FF3D00] border border-[#FF3D00]/30 hover:bg-[#FF3D00]/30"
                >
                  Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #00D9FF; border-radius: 4px; }
      `}</style>
    </div>,
    document.body
  );
}

interface AddExistingContactsModalProps {
  contacts: Contact[];
  existingContactIds: Set<string>;
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
}

function AddExistingContactsModal({
  contacts,
  existingContactIds,
  onClose,
  onConfirm,
}: AddExistingContactsModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const available = contacts.filter((c) => !existingContactIds.has(c.id));

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-[1] w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border border-white/10 bg-[#1A2332] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-xl font-bold text-white">Add existing contacts</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#B0BEC5] hover:bg-white/10 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {available.length === 0 ? (
            <p className="text-[#B0BEC5]">
              No contacts available to add (all are already in this campaign).
            </p>
          ) : (
            <ul className="space-y-2">
              {available.map((c) => (
                <li key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                  <span className="text-white">{contactDisplayName(c)}</span>
                  <span className="text-sm text-[#B0BEC5]">{c.phone_number ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#1E2A3A] text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={() => onConfirm(Array.from(selectedIds))}
            className="px-4 py-2 rounded-lg bg-[#0066FF] text-white disabled:opacity-50"
          >
            Add {selectedIds.size} contact(s)
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
