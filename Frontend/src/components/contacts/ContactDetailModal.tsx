import { createPortal } from 'react-dom';
import { X, Phone, Mail, Building2, MapPin, Globe, FileText, User } from 'lucide-react';
import { motion } from 'motion/react';
import type { Contact } from '@/lib/api';

function contactDisplayName(c: Contact): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return name || c.business_name || '—';
}

function truncateUrl(url: string, maxLen: number): string {
  if (!url || url.length <= maxLen) return url || '—';
  return url.slice(0, maxLen) + '...';
}

interface ContactDetailModalProps {
  contact: Contact | null;
  open: boolean;
  onClose: () => void;
}

export function ContactDetailModal({ contact, open, onClose }: ContactDetailModalProps) {
  if (!open) return null;

  const c = contact;
  if (!c) return null;

  const name = contactDisplayName(c);
  const category = c.category ?? 'Cold';
  const contactStatus = c.contact_status ?? 'No Contact';

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 10000 }} role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-[101] w-full max-w-lg rounded-2xl border border-white/10 bg-[#1A2332] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-xl font-bold text-white">Contact details</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#B0BEC5] hover:bg-white/10 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00D9FF] to-[#0066FF] flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
              {name.replace('—', '').split(' ').map(n => n[0]).filter(Boolean).join('').slice(0, 2) || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-white text-lg line-clamp-2">{name}</div>
              <div className="flex gap-2 mt-1 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-[#B0BEC5]">
                  {category}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-[#B0BEC5]">
                  {contactStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 text-sm">
            {c.business_type && (
              <div className="flex gap-2">
                <Building2 className="w-4 h-4 text-[#00D9FF] flex-shrink-0 mt-0.5" />
                <div className="min-w-0 text-[#B0BEC5]">{c.business_type}</div>
              </div>
            )}
            {c.phone_number && (
              <div className="flex gap-2 items-center">
                <Phone className="w-4 h-4 text-[#00D9FF] flex-shrink-0" />
                <a href={`tel:${c.phone_number}`} className="text-[#00D9FF] hover:underline truncate block">
                  {c.phone_number}
                </a>
              </div>
            )}
            {c.owner_contact?.includes('@') && (
              <div className="flex gap-2 items-center">
                <Mail className="w-4 h-4 text-[#00D9FF] flex-shrink-0 mt-0.5" />
                <a href={`mailto:${c.owner_contact}`} className="text-[#00D9FF] hover:underline truncate block" title={c.owner_contact}>
                  {truncateUrl(c.owner_contact, 50)}
                </a>
              </div>
            )}
            {c.website && (
              <div className="flex gap-2 items-center">
                <Globe className="w-4 h-4 text-[#00D9FF] flex-shrink-0 mt-0.5" />
                <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" className="text-[#00D9FF] hover:underline truncate block" title={c.website}>
                  {truncateUrl(c.website, 50)}
                </a>
              </div>
            )}
            {c.address && (
              <div className="flex gap-2">
                <MapPin className="w-4 h-4 text-[#00D9FF] flex-shrink-0 mt-0.5" />
                <div className="text-[#B0BEC5] line-clamp-2">{c.address}</div>
              </div>
            )}
            {c.business_link && (
              <div className="flex gap-2">
                <Globe className="w-4 h-4 text-[#00D9FF] flex-shrink-0 mt-0.5" />
                <a href={c.business_link.startsWith('http') ? c.business_link : `https://${c.business_link}`} target="_blank" rel="noopener noreferrer" className="text-[#00D9FF] hover:underline truncate block" title={c.business_link}>
                  {truncateUrl(c.business_link, 50)}
                </a>
              </div>
            )}
            {(c.first_name || c.last_name) && (c.first_name || c.last_name) !== (c.business_name ?? '') && (
              <div className="flex gap-2">
                <User className="w-4 h-4 text-[#00D9FF] flex-shrink-0 mt-0.5" />
                <div className="text-[#B0BEC5]">
                  {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                </div>
              </div>
            )}
            {(c.rating != null || c.review_count != null) && (
              <div className="flex gap-2 text-[#B0BEC5]">
                <FileText className="w-4 h-4 text-[#00D9FF] flex-shrink-0 mt-0.5" />
                <span>
                  {c.rating != null && `Rating: ${c.rating}`}
                  {c.rating != null && c.review_count != null && ' · '}
                  {c.review_count != null && `Reviews: ${c.review_count}`}
                </span>
              </div>
            )}
            {c.open_hours && (
              <div className="flex gap-2">
                <FileText className="w-4 h-4 text-[#00D9FF] flex-shrink-0 mt-0.5" />
                <div className="text-[#B0BEC5] line-clamp-2">{c.open_hours}</div>
              </div>
            )}
            {c.notes && (
              <div className="flex gap-2">
                <FileText className="w-4 h-4 text-[#00D9FF] flex-shrink-0 mt-0.5" />
                <div className="text-[#B0BEC5] line-clamp-3">{c.notes}</div>
              </div>
            )}
          </div>

          <div className="text-xs text-[#B0BEC5] pt-2 border-t border-white/5">
            Added {new Date(c.created_at).toLocaleDateString()}
            {c.updated_at !== c.created_at && ` · Updated ${new Date(c.updated_at).toLocaleDateString()}`}
          </div>
        </div>
        <div className="p-4 border-t border-white/10 flex justify-end gap-2">
          {c.phone_number && (
            <a
              href={`tel:${c.phone_number}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#00D9FF] to-[#0066FF] text-white font-semibold text-sm"
            >
              <Phone className="w-4 h-4" />
              Call
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-white/10 text-[#B0BEC5] hover:bg-white/5"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
