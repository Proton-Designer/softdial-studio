import { ContactBatchCard } from './ContactBatchCard';
import { LiveCallPanel } from './LiveCallPanel';
import type { BatchContactPreview } from '@/hooks/useDialerSession';

interface ParallelDialerUIProps {
  callsMade: number;
  connected: number;
  voicemail: number;
  noAnswer: number;
  resolvedCount: number;
  totalContacts: number;
  progress: number;
  batchContacts: BatchContactPreview[];
  answeredContactId: string | null;
  connectedContactId: string | null;
  onPause: () => void;
  onStop: () => void;
  onMuteChange: (muted: boolean) => void;
  onEndLiveCall: () => void;
}

export function ParallelDialerUI({
  callsMade,
  connected,
  voicemail,
  noAnswer,
  resolvedCount,
  totalContacts,
  progress,
  batchContacts,
  answeredContactId,
  connectedContactId,
  onPause,
  onStop,
  onMuteChange,
  onEndLiveCall,
}: ParallelDialerUIProps) {
  const connectedContact = batchContacts.find((c) => c.id === connectedContactId) ?? null;

  const getContactState = (contactId: string): 'dialing' | 'connecting' | 'connected' => {
    if (connectedContactId === contactId) return 'connected';
    if (answeredContactId === contactId) return 'connecting';
    return 'dialing';
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-[#1A2332]/70 p-5">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-white">Calls Made: <b>{callsMade}</b></span>
            <span className="text-white">Connected: <b>{connected}</b></span>
            <span className="text-white">Voicemail: <b>{voicemail}</b></span>
            <span className="text-white">No Answer: <b>{noAnswer}</b></span>
            <span className="text-white">Progress: <b>{resolvedCount}/{totalContacts}</b></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPause}
              className="px-4 py-2 rounded-lg bg-[#FFB300]/20 border border-[#FFB300]/30 text-[#FFB300]"
            >
              Pause
            </button>
            <button
              type="button"
              onClick={onStop}
              className="px-4 py-2 rounded-lg bg-[#FF3D00]/20 border border-[#FF3D00]/30 text-[#FF3D00]"
            >
              Stop Session
            </button>
          </div>
        </div>
        <div className="mt-4 h-2 rounded bg-white/10 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#00D9FF] to-[#0066FF]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#1A2332]/50 p-5">
        <h3 className="text-white text-lg font-bold mb-4">Current Batch</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {batchContacts.map((contact) => (
            <ContactBatchCard
              key={contact.id}
              name={contact.name}
              phone={contact.phone}
              state={getContactState(contact.id)}
            />
          ))}
        </div>
      </div>

      {connectedContact && (
        <LiveCallPanel
          contactName={connectedContact.name}
          phone={connectedContact.phone}
          onToggleMute={onMuteChange}
          onEndCall={onEndLiveCall}
        />
      )}
    </div>
  );
}
