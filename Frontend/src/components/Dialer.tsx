import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useTelnyxCall } from '../lib/useTelnyxCall';
import { usePhoneNumbers } from '@/contexts/PhoneNumbersContext';
import { PhoneOff } from 'lucide-react';
import { DialerIdle } from './dialer/DialerIdle';
import { ActiveCall } from './dialer/ActiveCall';
import { CampaignStats } from './dialer/CampaignStats';
import { useDialerSession } from '@/hooks/useDialerSession';
import { ParallelDialerUI } from './dialer/ParallelDialerUI';
import { getActiveDialerSession } from '@/lib/api';

const REMOTE_AUDIO_ID = 'telnyx-remote-audio';

export type DialerStatus = 'idle' | 'dialing' | 'ringing' | 'connected';

export type UserPhoneNumber = import('@/contexts/PhoneNumbersContext').UserPhoneNumber;

interface DialerProps {
  parallelSessionId?: string | null;
  parallelCampaignId?: string | null;
  onClearParallelContext?: () => void;
}

export function Dialer({
  parallelSessionId = null,
  parallelCampaignId = null,
  onClearParallelContext,
}: DialerProps) {
  const { numbers: userNumbers } = usePhoneNumbers();
  const [selectedFromNumber, setSelectedFromNumber] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [outboundNumber, setOutboundNumber] = useState('');

  const { callState, error, dial, hangup, setMuted } = useTelnyxCall({
    remoteElementId: REMOTE_AUDIO_ID,
  });

  /** When opening Dialer without launch context, restore active session so parallel UI can show. */
  const [restoredParallelContext, setRestoredParallelContext] = useState<{
    sessionId: string;
    campaignId: string;
  } | null>(null);

  const effectiveSessionId = parallelSessionId ?? restoredParallelContext?.sessionId ?? null;
  const effectiveCampaignId = parallelCampaignId ?? restoredParallelContext?.campaignId ?? null;
  const parallelSession = useDialerSession(effectiveSessionId);

  useEffect(() => {
    if (parallelSessionId != null) return;
    let cancelled = false;
    getActiveDialerSession()
      .then((session) => {
        if (!cancelled && session) setRestoredParallelContext(session);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [parallelSessionId]);

  // When cached numbers load, select first if none selected
  useEffect(() => {
    if (userNumbers.length > 0 && !selectedFromNumber) {
      setSelectedFromNumber(userNumbers[0].phone_number);
    }
  }, [userNumbers, selectedFromNumber]);

  // Create remote audio element outside React so Telnyx SDK never sees React fiber (avoids "Converting circular structure to JSON")
  const remoteAudioCreated = useRef(false);
  useEffect(() => {
    if (remoteAudioCreated.current) return;
    if (typeof document === 'undefined') return;
    let el = document.getElementById(REMOTE_AUDIO_ID) as HTMLAudioElement | null;
    if (!el) {
      el = document.createElement('audio');
      el.id = REMOTE_AUDIO_ID;
      el.setAttribute('autoplay', '');
      el.setAttribute('playsinline', '');
      el.className = 'hidden';
      document.body.appendChild(el);
    }
    remoteAudioCreated.current = true;
    return () => {
      el?.remove();
      remoteAudioCreated.current = false;
    };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (callState === 'connected') {
      timer = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDial = async (phoneNumber: string) => {
    if (!selectedFromNumber) return;
    setOutboundNumber(phoneNumber);
    try {
      await dial(phoneNumber, selectedFromNumber);
    } catch (err) {
      console.error('Dial error:', err);
    }
  };

  const handleEndCall = () => {
    hangup();
    setOutboundNumber('');
  };

  /** In parallel mode, end the live contact call via backend; otherwise end the browser call. */
  const handleEndLiveCallParallel = useCallback(async () => {
    if (!effectiveSessionId || !parallelSession.connectedContactId) return;
    try {
      await parallelSession.endLiveCall();
      toast.success('Call ended');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to end call');
    }
  }, [effectiveSessionId, parallelSession.connectedContactId, parallelSession.endLiveCall]);

  const dialerStatus: DialerStatus =
    callState === 'idle' || callState === 'ended'
      ? 'idle'
      : callState === 'dialing' || callState === 'ringing'
      ? 'dialing'
      : 'connected';

  const isParallelMode = Boolean(effectiveCampaignId && (parallelSession.sessionId ?? effectiveSessionId));
  const resolvedCount = parallelSession.connected + parallelSession.voicemail + parallelSession.noAnswer;
  const isParallelLoading = isParallelMode && parallelSession.loading;

  const handleParallelPause = useCallback(async () => {
    if (!parallelSession.sessionId) {
      toast.error('Session not loaded yet');
      return;
    }
    try {
      await parallelSession.pause();
      toast.success('Dialing paused');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to pause');
    }
  }, [parallelSession.sessionId, parallelSession.pause]);

  const handleParallelStop = useCallback(async () => {
    if (!parallelSession.sessionId) {
      toast.error('Session not loaded yet');
      return;
    }
    try {
      await parallelSession.stop();
      setRestoredParallelContext(null);
      onClearParallelContext?.();
      toast.success('Session stopped');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to stop session');
    }
  }, [parallelSession.sessionId, parallelSession.stop, onClearParallelContext]);

  return (
    <div className="flex h-[calc(100vh-72px)]">
      {/* Remote audio is created in useEffect (outside React tree) to avoid circular ref in Telnyx SDK */}

      {/* Center Panel - Dialing Interface */}
      <div className="flex-1 bg-[#0A1628] p-8 overflow-y-auto">
        {isParallelMode && parallelSession.error && (
          <div className="max-w-2xl mx-auto rounded-2xl border border-[#FF3D00]/30 bg-[#1A2332]/80 p-6 mb-6">
            <p className="text-[#FF3D00] font-medium mb-2">Could not load parallel session</p>
            <p className="text-[#B0BEC5] text-sm mb-4">{parallelSession.error}</p>
            <p className="text-[#B0BEC5] text-sm">Use manual dial below to place single calls.</p>
          </div>
        )}
        {isParallelLoading && (
          <div className="max-w-3xl mx-auto flex flex-col items-center justify-center py-20 text-[#B0BEC5]">
            <div className="w-10 h-10 border-2 border-[#00D9FF] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-white font-medium">Loading parallel dialing session…</p>
          </div>
        )}
        {isParallelMode && !isParallelLoading && !parallelSession.error && (
          <ParallelDialerUI
            callsMade={parallelSession.callsMade}
            connected={parallelSession.connected}
            voicemail={parallelSession.voicemail}
            noAnswer={parallelSession.noAnswer}
            resolvedCount={resolvedCount}
            totalContacts={parallelSession.totalContacts}
            progress={parallelSession.progress}
            batchContacts={parallelSession.currentBatchContacts}
            answeredContactId={parallelSession.answeredContactId}
            connectedContactId={parallelSession.connectedContactId}
            onPause={handleParallelPause}
            onStop={() => void handleParallelStop()}
            onMuteChange={setMuted}
            onEndLiveCall={handleEndLiveCallParallel}
          />
        )}

        {(!isParallelMode || parallelSession.error) && (
        <AnimatePresence mode="wait">
          {dialerStatus === 'idle' && (
            <DialerIdle
              key="idle"
              userNumbers={userNumbers}
              selectedFromNumber={selectedFromNumber}
              onSelectNumber={setSelectedFromNumber}
              onDial={handleDial}
              isDialing={callState === 'dialing'}
              error={error}
            />
          )}

          {dialerStatus === 'dialing' && (
            <motion.div
              key="dialing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-3xl mx-auto"
            >
              <div className="text-center mb-8 p-8 rounded-3xl bg-[#1A2332]/60 border border-[#0066FF]/30 shadow-[0_0_32px_rgba(0,102,255,0.25)]">
                <h2 className="text-2xl font-bold text-white mb-2">
                  Connecting to {outboundNumber}
                  <span className="animate-pulse">...</span>
                </h2>
                <p className="text-[#B0BEC5] mb-6">Ringing</p>
                <button
                  type="button"
                  onClick={handleEndCall}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 font-medium transition-colors"
                >
                  <PhoneOff className="w-5 h-5" />
                  End call
                </button>
              </div>
            </motion.div>
          )}

          {dialerStatus === 'connected' && (
            <ActiveCall
              key="connected"
              outboundNumber={outboundNumber}
              fromNumber={selectedFromNumber || ''}
              duration={formatDuration(callDuration)}
              onEndCall={handleEndCall}
              onMuteChange={setMuted}
            />
          )}
        </AnimatePresence>
        )}
      </div>

      {/* Right Panel - Campaign Stats */}
      <CampaignStats userNumbers={userNumbers} />
    </div>
  );
}
