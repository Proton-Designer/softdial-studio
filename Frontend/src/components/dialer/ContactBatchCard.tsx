import { Phone, Loader2, CheckCircle2 } from 'lucide-react';

type ContactState = 'dialing' | 'connecting' | 'connected' | 'voicemail' | 'no_answer';

interface ContactBatchCardProps {
  name: string;
  phone: string;
  state: ContactState;
}

export function ContactBatchCard({ name, phone, state }: ContactBatchCardProps) {
  const stateLabel =
    state === 'connected' ? 'Connected'
      : state === 'connecting' ? 'Answered, connecting…'
        : state === 'voicemail' ? 'Voicemail'
          : state === 'no_answer' ? 'No answer'
            : 'Dialing';

  const stateColor =
    state === 'connected' ? 'text-[#00E676]'
      : state === 'connecting' ? 'text-[#FFB300]'
        : state === 'voicemail' ? 'text-[#FFB300]'
          : state === 'no_answer' ? 'text-[#FF3D00]'
            : 'text-[#00D9FF]';

  return (
    <div className="rounded-xl border border-white/10 bg-[#1A2332]/70 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-white font-semibold">{name}</h4>
          <p className="text-[#B0BEC5] text-sm">{phone}</p>
        </div>
        {state === 'dialing' ? (
          <Loader2 className="w-5 h-5 text-[#00D9FF] animate-spin" />
        ) : state === 'connecting' ? (
          <Loader2 className="w-5 h-5 text-[#FFB300] animate-spin" />
        ) : state === 'connected' ? (
          <CheckCircle2 className="w-5 h-5 text-[#00E676]" />
        ) : (
          <Phone className="w-5 h-5 text-[#B0BEC5]" />
        )}
      </div>
      <p className={`mt-3 text-sm font-medium ${stateColor}`}>{stateLabel}</p>
    </div>
  );
}
