import { useState } from 'react';
import { motion } from 'motion/react';
import { Search, ChevronDown, User, Building2, Phone, Clock } from 'lucide-react';
// import { Contact } from '@/lib/api';

interface Contact {
  id: string;
  name: string;
  company: string;
  title: string;
  phone: string;
  areaCode: string;
  lastContact?: string;
  status: 'queued' | 'calling' | 'connected' | 'completed' | 'deferred';
}

interface ContactQueueProps {
  contacts: Contact[];
  campaignActive: boolean;
  onToggleCampaign: () => void;
}

export function ContactQueue({ contacts, campaignActive, onToggleCampaign }: ContactQueueProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const queuedCount = contacts.filter(c => c.status === 'queued').length;
  const completedCount = contacts.filter(c => c.status === 'completed').length;

  return (
    <div className="w-[380px] bg-[#1A2332]/60 backdrop-blur-xl border-r border-white/5 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold">Active Campaign:</span>
            <button className="flex items-center gap-1 text-[#00D9FF] hover:text-[#0066FF] transition-colors">
              Q1 Outreach
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="flex-1 bg-[#0066FF]/10 border border-[#0066FF]/20 rounded-lg px-3 py-2">
            <div className="text-2xl font-bold text-white">{queuedCount}</div>
            <div className="text-xs text-[#B0BEC5]">Queued</div>
          </div>
          <div className="flex-1 bg-[#FFB300]/10 border border-[#FFB300]/20 rounded-lg px-3 py-2">
            <div className="text-2xl font-bold text-white">12</div>
            <div className="text-xs text-[#B0BEC5]">Deferred</div>
          </div>
          <div className="flex-1 bg-[#00E676]/10 border border-[#00E676]/20 rounded-lg px-3 py-2">
            <div className="text-2xl font-bold text-white">{completedCount}</div>
            <div className="text-xs text-[#B0BEC5]">Completed</div>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={onToggleCampaign}
          className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${campaignActive
            ? 'bg-[#00E676]/10 border border-[#00E676]/20'
            : 'bg-[#FF3D00]/10 border border-[#FF3D00]/20'
            }`}
        >
          <span className={`font-semibold ${campaignActive ? 'text-[#00E676]' : 'text-[#FF3D00]'}`}>
            {campaignActive ? 'Campaign Active' : 'Campaign Paused'}
          </span>
          <div className={`relative w-12 h-6 rounded-full transition-colors ${campaignActive ? 'bg-[#00E676]' : 'bg-[#FF3D00]'
            }`}>
            <motion.div
              className="absolute top-1 w-4 h-4 bg-white rounded-full"
              animate={{ left: campaignActive ? 28 : 4 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-white/5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B0BEC5]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts..."
            className="w-full bg-[#1E2A3A] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-[#B0BEC5]/50 text-sm focus:outline-none focus:border-[#00D9FF] transition-colors"
          />
        </div>
      </div>

      {/* Contact List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {contacts.map((contact, index) => (
          <motion.div
            key={contact.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group bg-[#1E2A3A]/60 hover:bg-[#1E2A3A] rounded-xl p-4 border border-white/5 hover:border-[#00D9FF]/30 transition-all cursor-pointer relative overflow-hidden"
          >
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#00D9FF]/0 to-[#0066FF]/0 group-hover:from-[#00D9FF]/5 group-hover:to-[#0066FF]/5 transition-all" />

            <div className="relative flex gap-3">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00D9FF] to-[#0066FF] flex items-center justify-center text-white font-semibold">
                  {contact.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#1E2A3A] ${contact.status === 'queued' ? 'bg-[#B0BEC5]' :
                  contact.status === 'calling' ? 'bg-[#FFB300]' :
                    contact.status === 'connected' ? 'bg-[#00E676]' :
                      'bg-[#FF3D00]'
                  }`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white mb-0.5 truncate">{contact.name}</div>
                <div className="flex items-center gap-1.5 text-xs text-[#B0BEC5] mb-1">
                  <Building2 className="w-3 h-3" />
                  <span className="truncate">{contact.company}</span>
                </div>
                <div className="text-xs text-[#B0BEC5] truncate">{contact.title}</div>
                <div className="flex items-center gap-1.5 text-xs text-[#00D9FF] mt-2">
                  <Phone className="w-3 h-3" />
                  <span>{contact.phone}</span>
                  <span className="ml-auto px-2 py-0.5 bg-[#0066FF]/10 border border-[#0066FF]/20 rounded text-[#00D9FF]">
                    {contact.areaCode}
                  </span>
                </div>
                {contact.lastContact && (
                  <div className="flex items-center gap-1.5 text-xs text-[#B0BEC5] mt-1">
                    <Clock className="w-3 h-3" />
                    <span>Last: {contact.lastContact}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Call Now button on hover */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              whileHover={{ scale: 1.05 }}
              className="absolute bottom-2 right-2 px-3 py-1.5 bg-gradient-to-r from-[#00D9FF] to-[#0066FF] rounded-lg text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5"
            >
              <Phone className="w-3 h-3" />
              Call Now
            </motion.button>
          </motion.div>
        ))}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #00D9FF;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #0066FF;
        }
      `}</style>
    </div>
  );
}
