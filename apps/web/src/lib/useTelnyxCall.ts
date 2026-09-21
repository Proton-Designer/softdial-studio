import { useState, useCallback, useEffect, useRef } from 'react';
import { TelnyxRTC } from '@telnyx/webrtc';
import { getWebrtcCredentials } from './api';

export type CallState = 'idle' | 'dialing' | 'ringing' | 'connected' | 'ended';

interface UseTelnyxCallOptions {
  remoteElementId?: string;
}

const ACTIVE_AGENT_CALL_CONTROL_ID_KEY = 'softdial_active_agent_call_control_id';

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && !phone.startsWith('+')) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  return digits;
}

export function useTelnyxCall(options: UseTelnyxCallOptions = {}) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const clientRef = useRef<TelnyxRTC | null>(null);
  const activeCallRef = useRef<{ hangup: () => void } | null>(null);

  const persistAgentCallControlId = useCallback((maybeCall: unknown) => {
    if (typeof window === 'undefined') return;
    const call = (maybeCall ?? {}) as Record<string, unknown>;
    const candidate =
      (typeof call.call_control_id === 'string' && call.call_control_id) ||
      (typeof call.callControlId === 'string' && call.callControlId) ||
      (typeof call.id === 'string' && call.id) ||
      '';
    if (!candidate) return;
    window.localStorage.setItem(ACTIVE_AGENT_CALL_CONTROL_ID_KEY, candidate);
  }, []);

  const connect = useCallback((): Promise<void> => {
    if (clientRef.current) return Promise.resolve();
    setIsConnecting(true);
    setError(null);

    return (async () => {
      const { token } = await getWebrtcCredentials();
      if (!token) throw new Error('No token received');

      const client = new TelnyxRTC({ login_token: token });
      if (options.remoteElementId) {
        client.remoteElement = options.remoteElementId;
      }

      return new Promise<void>((resolve, reject) => {
        client
          .on('telnyx.ready', () => {
            setIsReady(true);
            setIsConnecting(false);
            resolve();
          })
          .on('telnyx.error', reject)
          .on(
            'telnyx.notification',
            (notification: { type?: string; call?: { state?: string; hangup: () => void } }) => {
              if (notification.type !== 'callUpdate' || !notification.call) return;
              const call = notification.call;
              activeCallRef.current = call;
              persistAgentCallControlId(call);
              const state = (call.state || '').toLowerCase();
              if (state === 'trying' || state === 'requesting') {
                setCallState('ringing');
              } else if (state === 'ringing') {
                setCallState('ringing');
              } else if (state === 'active' || state === 'answering' || state === 'early') {
                setCallState('connected');
              } else if (state === 'hangup' || state === 'destroy' || state === 'purge') {
                setCallState('ended');
                activeCallRef.current = null;
                if (typeof window !== 'undefined') {
                  window.localStorage.removeItem(ACTIVE_AGENT_CALL_CONTROL_ID_KEY);
                }
                setTimeout(() => setCallState('idle'), 500);
              }
            }
          );

        client.connect();
        clientRef.current = client;
      });
    })().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
      setIsConnecting(false);
      throw err;
    });
  }, [options.remoteElementId, persistAgentCallControlId]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
      setIsReady(false);
    }
  }, []);

  const dial = useCallback(
    async (toNumber: string, callerId: string) => {
      setError(null);
      if (!clientRef.current || !isReady) {
        await connect();
      }
      const client = clientRef.current;
      if (!client) {
        const msg = 'WebRTC client not ready. Please try again.';
        setError(msg);
        throw new Error(msg);
      }

      setCallState('dialing');

      const destinationNumber = toE164(toNumber);
      const callerNumber = toE164(callerId);

      try {
        const call = client.newCall({
          destinationNumber,
          callerNumber,
        });
        // Store immediately so hangup() works during dialing/ringing (before callUpdate)
        if (call && typeof (call as { hangup?: () => void }).hangup === 'function') {
          activeCallRef.current = call as { hangup: () => void };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setCallState('idle');
        throw err;
      }
    },
    [isReady, connect]
  );

  const hangup = useCallback(() => {
    if (activeCallRef.current) {
      activeCallRef.current.hangup();
      activeCallRef.current = null;
    }
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ACTIVE_AGENT_CALL_CONTROL_ID_KEY);
    }
    setCallState('idle');
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    const call = activeCallRef.current as {
      muteAudio?: () => void;
      unmuteAudio?: () => void;
    } | null;
    if (!call) return;
    if (muted) call.muteAudio?.();
    else call.unmuteAudio?.();
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    callState,
    error,
    isConnecting,
    isReady,
    connect,
    disconnect,
    dial,
    hangup,
    setMuted,
  };
}
