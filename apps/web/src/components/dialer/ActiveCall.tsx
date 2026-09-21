import { useState } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, PhoneOff } from 'lucide-react';

interface ActiveCallProps {
  outboundNumber: string;
  fromNumber: string;
  duration: string;
  onEndCall: () => void;
  onMuteChange: (muted: boolean) => void;
}

export function ActiveCall({
  outboundNumber,
  fromNumber,
  duration,
  onEndCall,
  onMuteChange,
}: ActiveCallProps) {
  const [muted, setMuted] = useState(false);

  const handleMuteToggle = () => {
    const next = !muted;
    setMuted(next);
    onMuteChange(next);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-4xl mx-auto"
    >
      {/* Status Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#00E676]/10 border border-[#00E676]/20 rounded-full mb-3">
          <div className="relative">
            <div className="w-2 h-2 bg-[#00E676] rounded-full" />
            <div className="absolute inset-0 w-2 h-2 bg-[#00E676] rounded-full animate-ping" />
          </div>
          <span className="text-sm text-[#00E676] font-semibold">Call Connected</span>
        </div>
      </div>

      {/* Call Info Card - green glow when connected */}
      <div className="bg-[#1A2332]/60 backdrop-blur-xl rounded-3xl p-8 border border-[#00E676]/30 shadow-[0_0_32px_rgba(0,230,118,0.25)] mb-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#00E676] to-[#00C853] flex items-center justify-center text-white text-3xl font-bold mb-6 shadow-[0_8px_32px_rgba(0,230,118,0.4)]">
            <span>{outboundNumber.slice(-2)}</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Connected to</h2>
          <p className="text-xl text-[#B0BEC5] mb-4">{outboundNumber}</p>
          <p className="text-sm text-[#B0BEC5] mb-4">From {fromNumber}</p>

          <motion.div
            className="text-5xl font-bold text-[#00D9FF] tabular-nums mb-6"
            animate={{ opacity: [1, 0.7, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            {duration}
          </motion.div>
        </div>
      </div>

      {/* Call Controls */}
      <div className="flex items-center justify-center gap-4">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleMuteToggle}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
            muted
              ? 'bg-[#FF3D00] shadow-[0_4px_24px_rgba(255,61,0,0.4)]'
              : 'bg-[#1E2A3A] hover:bg-[#252F3E] border border-white/10'
          }`}
        >
          {muted ? (
            <MicOff className="w-6 h-6 text-white" />
          ) : (
            <Mic className="w-6 h-6 text-white" />
          )}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={onEndCall}
          className="w-24 h-24 rounded-full bg-gradient-to-br from-[#FF3D00] to-[#D32F2F] flex items-center justify-center shadow-[0_8px_32px_rgba(255,61,0,0.5)] hover:shadow-[0_12px_48px_rgba(255,61,0,0.7)] transition-all"
        >
          <PhoneOff className="w-9 h-9 text-white" />
        </motion.button>
      </div>
    </motion.div>
  );
}
