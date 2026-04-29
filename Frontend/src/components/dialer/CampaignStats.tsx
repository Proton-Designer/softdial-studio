import { motion } from 'motion/react';
import { Phone } from 'lucide-react';
import type { UserPhoneNumber } from '../Dialer';

interface CampaignStatsProps {
  userNumbers: UserPhoneNumber[];
}

export function CampaignStats({ userNumbers }: CampaignStatsProps) {
  return (
    <div className="w-[340px] bg-[#1A2332]/60 backdrop-blur-xl border-l border-white/5 overflow-y-auto p-6 space-y-6 custom-scrollbar">
      {/* Your Numbers */}
      <div className="bg-[#1E2A3A]/60 rounded-xl p-5 border border-white/5">
        <h3 className="text-white font-semibold mb-4">Your Numbers</h3>
        {userNumbers.length === 0 ? (
          <p className="text-sm text-[#B0BEC5]">No phone numbers yet. Purchase one in Settings.</p>
        ) : (
          <div className="space-y-2">
            {userNumbers.map((num) => (
              <div key={num.id} className="flex items-center justify-between p-2 bg-[#0A1628] rounded-lg">
                <span className="text-sm text-white truncate">{num.phone_number}</span>
                <span className="px-2 py-0.5 bg-[#00E676]/10 border border-[#00E676]/20 rounded text-xs text-[#00E676] shrink-0">
                  Active
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session Info - simplified for single call */}
      <div className="bg-[#1E2A3A]/60 rounded-xl p-5 border border-white/5">
        <h3 className="text-white font-semibold mb-4">Single Call Dialer</h3>
        <p className="text-sm text-[#B0BEC5]">
          Select a number above, enter the destination, and click the green call button to dial.
        </p>
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
      `}</style>
    </div>
  );
}
