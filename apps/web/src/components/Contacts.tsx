import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Search,
  Upload,
  Plus,
  MoreVertical,
  Phone,
  Mail,
  Building2,
  MapPin,
  Loader2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Globe,
} from 'lucide-react';
import { listContacts, deleteContact, deleteContacts, type Contact } from '@/lib/api';
import { AddContactModal } from '@/components/contacts/AddContactModal';
import { ImportContactsModal } from '@/components/contacts/ImportContactsModal';
import { ContactDetailModal } from '@/components/contacts/ContactDetailModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const CATEGORIES = ['All', 'Cold', 'Warm', 'Follow Up', 'Voicemail', 'Booked'] as const;
const CONTACT_STATUSES = ['All', 'No Contact', 'Contacted'] as const;
const CONTACTS_PER_PAGE = 50;

function contactDisplayName(c: Contact): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return name || c.business_name || '—';
}

export function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [contactStatusFilter, setContactStatusFilter] = useState<string>('All');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  const fetchContacts = () => {
    setLoading(true);
    listContacts()
      .then(setContacts)
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, categoryFilter, contactStatusFilter]);

  const filteredContacts = contacts.filter((contact) => {
    const name = contactDisplayName(contact);
    const company = contact.business_name ?? '';
    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.toLowerCase().includes(searchQuery.toLowerCase());
    const cat = contact.category ?? 'Cold';
    const status = contact.contact_status ?? 'No Contact';
    const matchesCategory = categoryFilter === 'All' || cat === categoryFilter;
    const matchesStatus = contactStatusFilter === 'All' || status === contactStatusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / CONTACTS_PER_PAGE));
  const pageStart = currentPage * CONTACTS_PER_PAGE;
  const paginatedContacts = filteredContacts.slice(pageStart, pageStart + CONTACTS_PER_PAGE);

  useEffect(() => {
    setCurrentPage((p) => (p >= totalPages && totalPages > 0 ? totalPages - 1 : p));
  }, [totalPages]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    const pageIds = new Set(paginatedContacts.map((c) => c.id));
    const allOnPageSelected =
      paginatedContacts.length > 0 && paginatedContacts.every((c) => selectedIds.has(c.id));
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleDeleteOne = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this contact?')) return;
    setDeleting(true);
    try {
      await deleteContact(id);
      setDetailContact((prev) => (prev?.id === id ? null : prev));
      fetchContacts();
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    const n = selectedIds.size;
    if (n === 0 || !window.confirm(`Delete ${n} contact${n === 1 ? '' : 's'}?`)) return;
    setDeleting(true);
    try {
      await deleteContacts(Array.from(selectedIds));
      setSelectedIds(new Set());
      setDetailContact(null);
      fetchContacts();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-8 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Contacts</h1>
          <p className="text-[#B0BEC5]">Manage your contact database</p>
        </div>

        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-transparent border-2 border-[#00D9FF] rounded-xl text-[#00D9FF] font-semibold hover:bg-[#00D9FF]/10 transition-all"
          >
            <Upload className="w-5 h-5" />
            Import
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-[#00D9FF] to-[#0066FF] rounded-xl text-white font-semibold shadow-[0_4px_24px_rgba(0,217,255,0.3)] hover:shadow-[0_6px_32px_rgba(0,217,255,0.4)] transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Contact
          </motion.button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#1A2332]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-[0_4px_24px_rgba(0,102,255,0.15)] mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B0BEC5]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts..."
                className="w-full bg-[#1E2A3A] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-[#B0BEC5]/50 focus:outline-none focus:border-[#00D9FF] transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-[#B0BEC5] mr-1">Category:</span>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  categoryFilter === cat
                    ? 'bg-[#0066FF] text-white'
                    : 'bg-[#1E2A3A] text-[#B0BEC5] hover:bg-[#252F3E]'
                }`}
              >
                {cat}
              </button>
            ))}
            <span className="text-sm text-[#B0BEC5] ml-2 mr-1">Status:</span>
            {CONTACT_STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => setContactStatusFilter(status)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  contactStatusFilter === status
                    ? 'bg-[#0066FF] text-white'
                    : 'bg-[#1E2A3A] text-[#B0BEC5] hover:bg-[#252F3E]'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 mb-4 px-2 py-2 rounded-xl bg-[#1E2A3A]/80 border border-white/10">
          <span className="text-[#B0BEC5] text-sm">{selectedIds.size} selected</span>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium text-sm disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete selected
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="px-4 py-2 rounded-lg border border-white/10 text-[#B0BEC5] hover:bg-white/5 text-sm"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Contact List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-[#00D9FF] animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedContacts.length > 0 && (
            <div className="flex items-center gap-3 px-2 pb-1">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-[#B0BEC5]">
                <input
                  type="checkbox"
                  checked={
                    paginatedContacts.length > 0 &&
                    paginatedContacts.every((c) => selectedIds.has(c.id))
                  }
                  onChange={toggleSelectAllOnPage}
                  className="rounded border-white/20 bg-[#1E2A3A] text-[#00D9FF] focus:ring-[#00D9FF]"
                />
                Select all on page
              </label>
            </div>
          )}
          {paginatedContacts.map((contact, index) => {
            const name = contactDisplayName(contact);
            const initials =
              name
                .replace('—', '')
                .split(' ')
                .map((n) => n[0])
                .filter(Boolean)
                .join('')
                .slice(0, 2) || '?';
            const businessType = contact.business_type ?? '—';
            const email = contact.owner_contact?.includes('@') ? contact.owner_contact : null;
            const website = contact.website ?? null;
            const phone = contact.phone_number ?? '—';
            const category = contact.category ?? 'Cold';
            const contactStatus = contact.contact_status ?? 'No Contact';
            const isSelected = selectedIds.has(contact.id);
            return (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setDetailContact(contact)}
                className="bg-[#1A2332]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5 hover:border-[#00D9FF]/30 shadow-[0_4px_24px_rgba(0,102,255,0.15)] hover:shadow-[0_8px_32px_rgba(0,102,255,0.25)] transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(contact.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-white/20 bg-[#1E2A3A] text-[#00D9FF] focus:ring-[#00D9FF] flex-shrink-0"
                  />
                  <div className="relative flex-shrink-0">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00D9FF] to-[#0066FF] flex items-center justify-center text-white text-xl font-bold">
                      {initials}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#1A2332] bg-[#B0BEC5]" />
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 min-w-0 md:min-w-0 md:[grid-template-columns:repeat(4,minmax(0,1fr))]">
                    <div className="min-w-0 overflow-hidden">
                      <div
                        className="font-bold text-white text-lg mb-1 line-clamp-2 min-w-0 break-words"
                        title={name}
                      >
                        {name}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#B0BEC5] min-w-0 overflow-hidden">
                        <Building2 className="w-4 h-4 flex-shrink-0" />
                        <span className="line-clamp-2 min-w-0 break-words" title={businessType}>
                          {businessType}
                        </span>
                      </div>
                      <div className="text-sm text-[#B0BEC5] flex items-center gap-1 mt-0.5 flex-wrap overflow-hidden">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 truncate max-w-full">
                          {category}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 truncate max-w-full">
                          {contactStatus}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 min-w-0 overflow-hidden">
                      {email && (
                        <div className="flex items-center gap-2 text-sm text-[#B0BEC5] min-w-0 overflow-hidden">
                          <Mail className="w-4 h-4 text-[#00D9FF] flex-shrink-0" />
                          <span className="truncate min-w-0 block" title={email}>
                            {email}
                          </span>
                        </div>
                      )}
                      {website && (
                        <div className="flex items-center gap-2 text-sm text-[#B0BEC5] min-w-0 overflow-hidden">
                          <Globe className="w-4 h-4 text-[#00D9FF] flex-shrink-0" />
                          <span className="truncate min-w-0 block" title={website}>
                            {website}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-[#B0BEC5] min-w-0 overflow-hidden">
                        <Phone className="w-4 h-4 text-[#00D9FF] flex-shrink-0" />
                        <span className="truncate min-w-0 block" title={phone}>
                          {phone}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2 text-sm text-[#B0BEC5] mb-2 min-w-0 overflow-hidden">
                        <MapPin className="w-4 h-4 text-[#00D9FF] flex-shrink-0" />
                        <span
                          className="truncate min-w-0 block"
                          title={contact.address ?? undefined}
                        >
                          {contact.address ?? '—'}
                        </span>
                      </div>
                      <div
                        className="text-xs text-[#B0BEC5] truncate min-w-0 block"
                        title={`Added ${new Date(contact.created_at).toLocaleDateString()}`}
                      >
                        Added {new Date(contact.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 min-w-0 overflow-hidden flex-shrink-0">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => e.stopPropagation()}
                        className="px-4 py-2 bg-gradient-to-r from-[#00D9FF] to-[#0066FF] rounded-lg text-white text-sm font-semibold flex items-center gap-2 shadow-[0_2px_12px_rgba(0,217,255,0.3)] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Phone className="w-4 h-4" />
                        Call
                      </motion.button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="w-10 h-10 rounded-lg bg-[#1E2A3A] hover:bg-[#252F3E] flex items-center justify-center text-[#B0BEC5] hover:text-white transition-all"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-[#1E2A3A] border-white/10 text-white"
                        >
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={(e) =>
                              handleDeleteOne(e as unknown as React.MouseEvent, contact.id)
                            }
                            disabled={deleting}
                            className="focus:bg-red-500/20 focus:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {!loading && filteredContacts.length > CONTACTS_PER_PAGE && (
        <div className="flex items-center justify-between gap-4 mt-6 py-4 px-2 border-t border-white/5">
          <span className="text-sm text-[#B0BEC5]">
            Showing {pageStart + 1}–
            {Math.min(pageStart + CONTACTS_PER_PAGE, filteredContacts.length)} of{' '}
            {filteredContacts.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-white/10 text-[#B0BEC5] hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="text-sm text-[#B0BEC5] px-2">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-white/10 text-[#B0BEC5] hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {!loading && filteredContacts.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-white mb-2">No contacts found</h3>
          <p className="text-[#B0BEC5]">Try adjusting your search or import contacts from CSV</p>
        </div>
      )}

      <ImportContactsModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={fetchContacts}
      />
      <AddContactModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={fetchContacts}
      />
      <ContactDetailModal
        contact={detailContact}
        open={detailContact != null}
        onClose={() => setDetailContact(null)}
      />
    </div>
  );
}
