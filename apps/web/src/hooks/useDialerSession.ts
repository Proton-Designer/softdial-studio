import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  getDialerSession,
  hangupLiveCall,
  pauseDialerSession,
  startDialerSession,
  stopDialerSession,
  type DialerSessionRecord,
  type DialerSessionSummary,
} from '@/lib/api';

export type DialerEventType =
  | 'DIALER_SESSION_STARTED'
  | 'BATCH_FIRING'
  | 'CALL_INITIATED'
  | 'CALL_ANSWERED'
  | 'HUMAN_CONNECTED'
  | 'CALL_ENDED'
  | 'CONTACT_VOICEMAIL'
  | 'CONTACT_NO_ANSWER'
  | 'BATCH_COMPLETE'
  | 'CAMPAIGN_COMPLETE'
  | 'DIALER_ERROR';

export interface BatchContactPreview {
  id: string;
  name: string;
  phone: string;
}

interface DialerHookState {
  session: DialerSessionRecord | null;
  sessionId: string | null;
  totalContacts: number;
  currentBatchContacts: BatchContactPreview[];
  /** Contact that answered (ringing stopped); set on CALL_ANSWERED, cleared on HUMAN_CONNECTED or BATCH_FIRING */
  answeredContactId: string | null;
  connectedContactId: string | null;
  callsMade: number;
  connected: number;
  voicemail: number;
  noAnswer: number;
  loading: boolean;
  error: string | null;
}

export function useDialerSession(initialSessionId: string | null = null) {
  const [state, setState] = useState<DialerHookState>({
    session: null,
    sessionId: initialSessionId,
    totalContacts: 0,
    currentBatchContacts: [],
    answeredContactId: null,
    connectedContactId: null,
    callsMade: 0,
    connected: 0,
    voicemail: 0,
    noAnswer: 0,
    loading: false,
    error: null,
  });

  const applySummary = useCallback((summary?: DialerSessionSummary) => {
    setState((prev: DialerHookState) => ({
      ...prev,
      callsMade: summary?.calls_made ?? prev.callsMade,
      connected: summary?.calls_connected ?? prev.connected,
      voicemail: summary?.calls_voicemail ?? prev.voicemail,
      noAnswer: summary?.calls_no_answer ?? prev.noAnswer,
      totalContacts: summary?.total_contacts ?? prev.totalContacts,
    }));
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    setState((prev: DialerHookState) => ({ ...prev, loading: true, error: null }));
    try {
      const { session, batch } = await getDialerSession(sessionId);
      const batchContacts: BatchContactPreview[] = (batch?.contacts ?? []).map(
        (c: { id: string; name: string; phone: string }) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
        })
      );
      setState((prev: DialerHookState) => ({
        ...prev,
        session,
        sessionId,
        totalContacts: session.total_contacts,
        callsMade: session.calls_made,
        connected: session.calls_connected,
        voicemail: session.calls_voicemail,
        noAnswer: session.calls_no_answer,
        currentBatchContacts: batchContacts,
        answeredContactId: null,
      }));
    } catch (e) {
      setState((prev: DialerHookState) => ({
        ...prev,
        error: e instanceof Error ? e.message : 'Failed to load dialer session',
      }));
    } finally {
      setState((prev: DialerHookState) => ({ ...prev, loading: false }));
    }
  }, []);

  const start = useCallback(
    async (args: {
      campaignId: string;
      linesCount: 1 | 2 | 3 | 4 | 5;
      fromNumber: string;
      agentCallControlId?: string;
      agentCallbackNumber?: string;
    }) => {
      setState((prev: DialerHookState) => ({ ...prev, loading: true, error: null }));
      try {
        const result = await startDialerSession(args);
        setState((prev: DialerHookState) => ({
          ...prev,
          sessionId: result.sessionId,
          totalContacts: result.totalContacts,
        }));
        await loadSession(result.sessionId);
        return result;
      } finally {
        setState((prev: DialerHookState) => ({ ...prev, loading: false }));
      }
    },
    [loadSession]
  );

  const stop = useCallback(async () => {
    if (!state.sessionId) return null;
    const res = await stopDialerSession(state.sessionId);
    applySummary(res.summary);
    setState((prev: DialerHookState) => ({
      ...prev,
      session: prev.session ? { ...prev.session, status: 'stopped' } : prev.session,
    }));
    return res;
  }, [applySummary, state.sessionId, state.session]);

  const pause = useCallback(async () => {
    if (!state.sessionId) return null;
    await pauseDialerSession(state.sessionId);
    setState((prev: DialerHookState) => ({
      ...prev,
      session: prev.session ? { ...prev.session, status: 'paused' } : prev.session,
    }));
    return { status: 'paused' as const };
  }, [state.sessionId, state.session]);

  useEffect(() => {
    if (initialSessionId) {
      setState((prev: DialerHookState) => ({ ...prev, sessionId: initialSessionId }));
      loadSession(initialSessionId);
    }
  }, [initialSessionId, loadSession]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let unsubscribed = false;

    const setup = async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId || unsubscribed) return;

      channel = supabase.channel(`dialer:user:${userId}`);
      channel.on(
        'broadcast',
        { event: '*' },
        ({ event, payload }: { event: string; payload: Record<string, unknown> }) => {
          const eventType = event as DialerEventType;
          try {
            console.log('[useDialerSession] checkpoint:broadcast_event_received', {
              eventType,
              payload,
              receivedAt: new Date().toISOString(),
            });
          } catch {
            // no-op
          }
          setState((prev: DialerHookState) => {
            if (eventType === 'BATCH_FIRING') {
              const contacts = (payload?.contacts as BatchContactPreview[] | undefined) ?? [];
              console.log('[useDialerSession] checkpoint:state_transition_batch_firing', {
                contactsCount: contacts.length,
              });
              return {
                ...prev,
                currentBatchContacts: contacts,
                connectedContactId: null,
                answeredContactId: null,
              };
            }
            if (eventType === 'CALL_ANSWERED') {
              console.log('[useDialerSession] checkpoint:state_transition_call_answered', {
                contactId: (payload?.contactId as string) ?? null,
              });
              return {
                ...prev,
                answeredContactId: (payload?.contactId as string) ?? null,
              };
            }
            if (eventType === 'HUMAN_CONNECTED') {
              console.log('[useDialerSession] checkpoint:state_transition_human_connected', {
                contactId: (payload?.contactId as string) ?? null,
                callControlId: (payload?.callControlId as string) ?? null,
              });
              return {
                ...prev,
                connectedContactId: (payload?.contactId as string) ?? null,
                answeredContactId: null,
                connected: prev.connected + 1,
              };
            }
            if (eventType === 'CONTACT_VOICEMAIL') {
              console.log('[useDialerSession] checkpoint:state_transition_contact_voicemail', {
                contactId: (payload?.contactId as string) ?? null,
              });
              return { ...prev, voicemail: prev.voicemail + 1 };
            }
            if (eventType === 'CONTACT_NO_ANSWER') {
              console.log('[useDialerSession] checkpoint:state_transition_contact_no_answer', {
                contactId: (payload?.contactId as string) ?? null,
              });
              return { ...prev, noAnswer: prev.noAnswer + 1 };
            }
            if (eventType === 'CALL_INITIATED') {
              console.log('[useDialerSession] checkpoint:state_transition_call_initiated', {
                contactId: (payload?.contactId as string) ?? null,
                callControlId: (payload?.callControlId as string) ?? null,
              });
              return { ...prev, callsMade: prev.callsMade + 1 };
            }
            if (eventType === 'DIALER_SESSION_STARTED') {
              console.log('[useDialerSession] checkpoint:state_transition_session_started', {
                sessionId: (payload?.sessionId as string) ?? null,
                totalContacts: (payload?.totalContacts as number) ?? null,
              });
              return {
                ...prev,
                sessionId: (payload?.sessionId as string) ?? prev.sessionId,
                totalContacts: (payload?.totalContacts as number) ?? prev.totalContacts,
              };
            }
            if (eventType === 'CAMPAIGN_COMPLETE') {
              console.log('[useDialerSession] checkpoint:state_transition_campaign_complete', {
                sessionId: (payload?.sessionId as string) ?? null,
              });
              return {
                ...prev,
                session: prev.session ? { ...prev.session, status: 'completed' } : prev.session,
              };
            }
            if (eventType === 'DIALER_ERROR') {
              console.error('[useDialerSession] checkpoint:state_transition_dialer_error', {
                error: (payload?.error as string) ?? 'Dialer error',
                payload,
              });
              return {
                ...prev,
                error: (payload?.error as string) ?? 'Dialer error',
              };
            }
            return prev;
          });
        }
      );
      await channel.subscribe();
    };

    setup().catch((e) => {
      setState((prev: DialerHookState) => ({
        ...prev,
        error: e instanceof Error ? e.message : 'Failed to subscribe to dialer events',
      }));
    });

    return () => {
      unsubscribed = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const progress = useMemo(() => {
    if (!state.totalContacts) return 0;
    return Math.min(
      100,
      Math.round(((state.connected + state.voicemail + state.noAnswer) / state.totalContacts) * 100)
    );
  }, [state.connected, state.noAnswer, state.totalContacts, state.voicemail]);

  const endLiveCall = useCallback(async () => {
    if (!state.sessionId) return;
    await hangupLiveCall(state.sessionId);
    setState((prev) => ({
      ...prev,
      connectedContactId: null,
      answeredContactId: null,
    }));
  }, [state.sessionId]);

  return {
    ...state,
    progress,
    start,
    stop,
    pause,
    endLiveCall,
    loadSession,
  };
}
