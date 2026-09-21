/// <reference path="../deno.d.ts" />
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { createConference, dialOutboundCall, hangupCall, joinCallToConference } from './telnyx.ts';
import {
  claimHumanAnswer,
  delCallState,
  getCallState,
  getAgentSessionState,
  getSessionBatchState,
  redisKeys,
  setCallState,
  setSessionBatchState,
} from './redis.ts';
import { normalizeAmdResult, shouldTreatAsHuman } from './amd.ts';
import { publishDialerEvent } from './dialer-events.ts';

function dialerLog(step: string, meta: Record<string, unknown> = {}): void {
  console.log('[dialer-engine]', step, meta);
}

export interface BatchContact {
  id: string;
  business_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
}

export interface DecodedClientState {
  userId: string;
  sessionId: string;
  contactId: string;
  campaignId: string;
  batchIndex: number;
}

export function encodeClientState(state: DecodedClientState): string {
  return btoa(JSON.stringify(state));
}

export function decodeClientState(value: string | null | undefined): DecodedClientState | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(atob(value)) as Record<string, unknown>;
    if (decoded?.t === 'agent') return null;
    return decoded as unknown as DecodedClientState;
  } catch {
    return null;
  }
}

export interface AgentCallbackState {
  t: 'agent';
  userId: string;
  sessionId: string;
}

export function encodeAgentCallbackState(state: { userId: string; sessionId: string }): string {
  return btoa(
    JSON.stringify({ t: 'agent' as const, userId: state.userId, sessionId: state.sessionId })
  );
}

export function decodeAgentCallbackState(
  value: string | null | undefined
): AgentCallbackState | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(atob(value)) as Record<string, unknown>;
    if (
      decoded?.t === 'agent' &&
      typeof decoded?.userId === 'string' &&
      typeof decoded?.sessionId === 'string'
    ) {
      return { t: 'agent', userId: decoded.userId, sessionId: decoded.sessionId };
    }
    return null;
  } catch {
    return null;
  }
}

export function getContactDisplayName(
  contact: Pick<BatchContact, 'business_name' | 'first_name' | 'last_name'>
): string {
  return (
    contact.business_name ||
    `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() ||
    'Unknown contact'
  );
}

export async function fetchDialableContacts(
  supabase: SupabaseClient,
  args: { campaignId: string; userId: string; offset: number; limit: number }
): Promise<BatchContact[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('campaign_leads')
    .select(
      'contact:contacts!inner(id,business_name,first_name,last_name,phone_number,user_id,call_status,created_at)'
    )
    .eq('campaign_id', args.campaignId)
    .eq('contact.user_id', args.userId)
    .not('contact.call_status', 'in', '("contacted","do_not_call")')
    .order('created_at', { ascending: true, referencedTable: 'contacts' })
    .range(args.offset, args.offset + args.limit - 1) as Promise<{
    data: unknown;
    error: { message: string } | null;
  }>);

  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contacts = ((data as any[]) ?? [])
    .map((row: unknown) => (row as { contact: BatchContact | null }).contact)
    .filter((c: BatchContact | null | undefined): c is BatchContact => !!c && !!c.phone_number);
  return contacts;
}

export async function fireBatch(
  supabase: SupabaseClient,
  args: {
    userId: string;
    sessionId: string;
    campaignId: string;
    conferenceName: string;
    linesCount: number;
    fromNumber: string;
    webhookUrl: string;
    batchIndex: number;
    contacts: BatchContact[];
  }
): Promise<string[]> {
  if (args.contacts.length === 0) return [];
  dialerLog('fire_batch_start', {
    sessionId: args.sessionId,
    batchIndex: args.batchIndex,
    contactsCount: args.contacts.length,
    linesCount: args.linesCount,
    fromNumber: args.fromNumber,
  });
  const activeCallIds: string[] = [];

  await publishDialerEvent(args.userId, 'BATCH_FIRING', {
    batchIndex: args.batchIndex,
    contacts: args.contacts.map((c) => ({
      id: c.id,
      name: getContactDisplayName(c),
      phone: c.phone_number,
    })),
  });

  for (const contact of args.contacts) {
    const clientState = encodeClientState({
      userId: args.userId,
      sessionId: args.sessionId,
      contactId: contact.id,
      campaignId: args.campaignId,
      batchIndex: args.batchIndex,
    });

    dialerLog('dial_contact_start', {
      sessionId: args.sessionId,
      contactId: contact.id,
      to: contact.phone_number,
      batchIndex: args.batchIndex,
    });

    const { callControlId } = await dialOutboundCall({
      to: contact.phone_number!,
      from: args.fromNumber,
      webhookUrl: args.webhookUrl,
      clientState,
    });
    dialerLog('dial_contact_success', {
      sessionId: args.sessionId,
      contactId: contact.id,
      callControlId,
      batchIndex: args.batchIndex,
    });

    activeCallIds.push(callControlId);

    await setCallState({
      userId: args.userId,
      sessionId: args.sessionId,
      campaignId: args.campaignId,
      contactId: contact.id,
      status: 'initiated',
      callControlId,
      batchIndex: args.batchIndex,
      startedAt: Date.now(),
    });

    await supabase.from('call_logs').upsert(
      {
        session_id: args.sessionId,
        user_id: args.userId,
        campaign_id: args.campaignId,
        contact_id: contact.id,
        call_control_id: callControlId,
        status: 'initiated',
        direction: 'outbound',
      },
      { onConflict: 'call_control_id' }
    );

    await supabase
      .from('contacts')
      .update({
        call_status: 'dialing',
        last_called_at: new Date().toISOString(),
      })
      .eq('id', contact.id);

    await publishDialerEvent(args.userId, 'CALL_INITIATED', {
      contactId: contact.id,
      callControlId,
    });
  }

  await setSessionBatchState(args.sessionId, {
    activeCallIds,
    humanAnsweredCallId: null,
    batchIndex: args.batchIndex,
    firedAt: Date.now(),
    contacts: args.contacts.map((c) => ({
      id: c.id,
      name: getContactDisplayName(c),
      phone: c.phone_number ?? '',
    })),
  });

  await supabase
    .from('dialer_sessions')
    .update({
      calls_made: args.batchIndex * args.linesCount + activeCallIds.length,
    })
    .eq('id', args.sessionId);

  dialerLog('fire_batch_complete', {
    sessionId: args.sessionId,
    batchIndex: args.batchIndex,
    activeCallIds,
  });
  return activeCallIds;
}

export async function handleAmdResult(
  supabase: SupabaseClient,
  args: {
    callControlId: string;
    amdRawResult: string | null | undefined;
  }
): Promise<void> {
  dialerLog('amd_handle_start', {
    callControlId: args.callControlId,
    amdRawResult: args.amdRawResult ?? null,
  });
  const callState = await getCallState(args.callControlId);
  if (!callState) {
    dialerLog('amd_missing_call_state', { callControlId: args.callControlId });
    return;
  }

  const batchState = await getSessionBatchState(callState.sessionId);
  if (!batchState) {
    dialerLog('amd_missing_batch_state', {
      sessionId: callState.sessionId,
      callControlId: args.callControlId,
    });
    return;
  }

  const amdResult = normalizeAmdResult(args.amdRawResult);
  dialerLog('amd_normalized', {
    sessionId: callState.sessionId,
    callControlId: args.callControlId,
    amdRawResult: args.amdRawResult ?? null,
    amdResult,
  });

  /** If AMD says machine but the call was answered very recently, treat as human to avoid false positives. */
  const AMD_MACHINE_GRACE_MS = 5000;
  const answeredAt = callState.answeredAt ?? callState.startedAt;
  const secondsSinceAnswer = (Date.now() - answeredAt) / 1000;
  const withinGracePeriod = Date.now() - answeredAt < AMD_MACHINE_GRACE_MS;

  if (!shouldTreatAsHuman(amdResult)) {
    if (withinGracePeriod) {
      dialerLog('amd_machine_overridden_by_grace_period', {
        sessionId: callState.sessionId,
        contactId: callState.contactId,
        callControlId: args.callControlId,
        amdResult,
        secondsSinceAnswer: Math.round(secondsSinceAnswer * 10) / 10,
        graceMs: AMD_MACHINE_GRACE_MS,
      });
      // Fall through to human flow; do not hang up.
    } else {
      dialerLog('amd_machine_branch_hangup', {
        sessionId: callState.sessionId,
        contactId: callState.contactId,
        callControlId: args.callControlId,
        amdResult,
        secondsSinceAnswer: Math.round(secondsSinceAnswer * 10) / 10,
      });
      await hangupCall(args.callControlId);
      await supabase
        .from('contacts')
        .update({
          call_status: 'voicemail',
          last_called_at: new Date().toISOString(),
          call_count: (await getContactCallCount(supabase, callState.contactId)) + 1,
        })
        .eq('id', callState.contactId);
      await supabase
        .from('call_logs')
        .update({
          status: 'machine',
          amd_result: 'machine',
        })
        .eq('call_control_id', args.callControlId);
      await publishDialerEvent(callState.userId, 'CONTACT_VOICEMAIL', {
        contactId: callState.contactId,
      });
      return;
    }
  }

  const claimed = await claimHumanAnswer(callState.sessionId, args.callControlId);
  if (!claimed) {
    dialerLog('amd_human_claim_failed_hangup', {
      sessionId: callState.sessionId,
      callControlId: args.callControlId,
      reason: 'already_claimed_by_another_leg',
    });
    await hangupCall(args.callControlId);
    return;
  }
  dialerLog('amd_human_claimed', {
    sessionId: callState.sessionId,
    callControlId: args.callControlId,
  });

  const { data: session } = await supabase
    .from('dialer_sessions')
    .select('conference_name,conference_id,from_number')
    .eq('id', callState.sessionId)
    .maybeSingle();
  const conferenceName = session?.conference_name;
  const existingConferenceId = session?.conference_id ?? null;
  const sessionFromNumber = (session as { from_number?: string } | null)?.from_number?.trim() ?? '';
  if (!conferenceName) {
    dialerLog('amd_missing_conference_name', {
      sessionId: callState.sessionId,
      callControlId: args.callControlId,
    });
    // Critical failure: cannot bridge without conference name.
    await hangupCall(args.callControlId);
    return;
  }

  // If no conference was created at session start (no agent leg), create one now with the
  // answered call as the first participant. Otherwise join the winner to the existing conference.
  if (!existingConferenceId) {
    try {
      dialerLog('amd_create_conference_start', {
        sessionId: callState.sessionId,
        callControlId: args.callControlId,
        conferenceName,
      });
      const conference = await createConference({
        userId: callState.userId,
        sessionId: callState.sessionId,
        agentCallControlId: args.callControlId,
      });
      dialerLog('amd_create_conference_success', {
        sessionId: callState.sessionId,
        callControlId: args.callControlId,
        conferenceId: conference.id,
        conferenceName: conference.name,
      });
      await supabase
        .from('dialer_sessions')
        .update({ conference_id: conference.id })
        .eq('id', callState.sessionId);
      // Winner is already in the conference; no join_conference call needed.
    } catch (err) {
      dialerLog('amd_create_conference_failed', {
        sessionId: callState.sessionId,
        callControlId: args.callControlId,
        error: String(err),
      });
      await publishDialerEvent(callState.userId, 'DIALER_ERROR', {
        sessionId: callState.sessionId,
        error: `Failed to create conference for answered call: ${String(err)}`,
      });
      // If we can't create conference, we can't bridge agent. Hang up.
      await hangupCall(args.callControlId);
      // Also hang up others to clean up batch? Actually, maybe we should just fail this leg and let others continue?
      // But we claimed the human answer, so the batch is effectively "won". We must clean up.
      for (const otherCallId of batchState.activeCallIds) {
        if (otherCallId === args.callControlId) continue;
        await hangupCall(otherCallId);
      }
      return;
    }
  } else {
    try {
      dialerLog('amd_join_existing_conference_start', {
        sessionId: callState.sessionId,
        callControlId: args.callControlId,
        conferenceName,
        conferenceId: existingConferenceId,
      });
      await joinCallToConference(args.callControlId, conferenceName);
      dialerLog('amd_join_existing_conference_success', {
        sessionId: callState.sessionId,
        callControlId: args.callControlId,
        conferenceName,
      });
    } catch (err) {
      dialerLog('amd_join_existing_conference_failed', {
        sessionId: callState.sessionId,
        callControlId: args.callControlId,
        conferenceName,
        error: String(err),
      });
      await publishDialerEvent(callState.userId, 'DIALER_ERROR', {
        sessionId: callState.sessionId,
        error: `Failed to join answered call to conference: ${String(err)}`,
      });
      await hangupCall(args.callControlId);
      for (const otherCallId of batchState.activeCallIds) {
        if (otherCallId === args.callControlId) continue;
        await hangupCall(otherCallId);
      }
      return;
    }
  }

  // Hangup losing legs
  for (const otherCallId of batchState.activeCallIds) {
    if (otherCallId === args.callControlId) continue;
    dialerLog('amd_hangup_losing_leg', {
      sessionId: callState.sessionId,
      winnerCallControlId: args.callControlId,
      losingCallControlId: otherCallId,
    });
    await hangupCall(otherCallId);
  }

  await supabase
    .from('contacts')
    .update({
      call_status: 'contacted',
      last_called_at: new Date().toISOString(),
      call_count: (await getContactCallCount(supabase, callState.contactId)) + 1,
    })
    .eq('id', callState.contactId);

  await supabase
    .from('call_logs')
    .update({
      status: 'connected',
      amd_result: amdResult,
      answered_at: new Date().toISOString(),
    })
    .eq('call_control_id', args.callControlId);

  await setSessionBatchState(callState.sessionId, {
    ...batchState,
    humanAnsweredCallId: args.callControlId,
  });

  await publishDialerEvent(callState.userId, 'HUMAN_CONNECTED', {
    contactId: callState.contactId,
    callControlId: args.callControlId,
  });

  // If session was started with agent callback number and we created the conference with the contact only,
  // dial the agent so they can join the conference for two-way audio.
  if (!existingConferenceId) {
    const agentState = await getAgentSessionState(callState.userId);
    const callbackNumber = agentState?.agentCallbackNumber?.trim();
    if (callbackNumber && sessionFromNumber) {
      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telnyx-webhook`;
      try {
        dialerLog('amd_agent_callback_dial_start', {
          sessionId: callState.sessionId,
          callbackNumber,
          fromNumber: sessionFromNumber,
          winnerCallControlId: args.callControlId,
        });
        const { callControlId: agentLegCallControlId } = await dialOutboundCall({
          to: callbackNumber,
          from: sessionFromNumber,
          webhookUrl,
          clientState: encodeAgentCallbackState({
            userId: callState.userId,
            sessionId: callState.sessionId,
          }),
        });
        dialerLog('amd_agent_callback_dial_success', {
          sessionId: callState.sessionId,
          agentLegCallControlId,
          callbackNumber,
        });
      } catch (err) {
        dialerLog('amd_agent_callback_dial_failed', {
          sessionId: callState.sessionId,
          callbackNumber,
          error: String(err),
        });
        // Non-fatal? If agent callback fails, the user is stuck with a connected contact but no agent.
        // We should arguably warn the user or hang up the contact.
        await publishDialerEvent(callState.userId, 'DIALER_ERROR', {
          sessionId: callState.sessionId,
          error: `Failed to dial agent callback: ${String(err)}`,
        });
      }
    } else {
      dialerLog('amd_agent_callback_skipped', {
        sessionId: callState.sessionId,
        hasCallbackNumber: Boolean(callbackNumber),
        hasSessionFromNumber: Boolean(sessionFromNumber),
        reason: !callbackNumber ? 'no_callback_number' : 'no_from_number',
      });
      // If we skipped callback AND there was no existing conference, the agent is NOT connected.
      // This is a misconfiguration dead-end.
      if (!callbackNumber) {
        await publishDialerEvent(callState.userId, 'DIALER_ERROR', {
          sessionId: callState.sessionId,
          error:
            'Human answered but Agent is not connected. (No callback number and no active agent leg).',
        });
      }
    }
  }
}

export async function handleCallHangup(
  supabase: SupabaseClient,
  callControlId: string
): Promise<{ shouldAdvance: boolean; sessionId: string | null; userId: string | null }> {
  dialerLog('hangup_handler_start', { callControlId });
  const callState = await getCallState(callControlId);
  if (!callState) {
    dialerLog('hangup_handler_missing_call_state', { callControlId });
    return { shouldAdvance: false, sessionId: null, userId: null };
  }

  const batchState = await getSessionBatchState(callState.sessionId);
  await delCallState(callControlId);

  await supabase
    .from('call_logs')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
    })
    .eq('call_control_id', callControlId);

  if (!batchState) {
    dialerLog('hangup_handler_missing_batch_state', {
      sessionId: callState.sessionId,
      callControlId,
    });
    return { shouldAdvance: false, sessionId: callState.sessionId, userId: callState.userId };
  }

  const remaining = batchState.activeCallIds.filter((id) => id !== callControlId);
  const nextBatchState = { ...batchState, activeCallIds: remaining };
  await setSessionBatchState(callState.sessionId, nextBatchState);

  const wasLiveHumanLeg = batchState.humanAnsweredCallId === callControlId;
  const shouldAdvance = wasLiveHumanLeg || remaining.length === 0;
  dialerLog('hangup_handler_decision', {
    sessionId: callState.sessionId,
    callControlId,
    wasLiveHumanLeg,
    remainingCount: remaining.length,
    shouldAdvance,
  });

  if (wasLiveHumanLeg) {
    await publishDialerEvent(callState.userId, 'CALL_ENDED', {
      contactId: callState.contactId,
      callControlId,
    });
  } else if (remaining.length === 0) {
    await publishDialerEvent(callState.userId, 'BATCH_COMPLETE', {
      batchIndex: batchState.batchIndex,
      nextBatchIndex: batchState.batchIndex + 1,
    });
  }

  return { shouldAdvance, sessionId: callState.sessionId, userId: callState.userId };
}

export async function completeBatchAndAdvanceIfNeeded(
  supabase: SupabaseClient,
  args: { sessionId: string; userId: string; webhookUrl: string; fromNumber: string }
): Promise<void> {
  dialerLog('complete_batch_start', {
    sessionId: args.sessionId,
    userId: args.userId,
  });
  const { data: session, error } = await supabase
    .from('dialer_sessions')
    .select(
      'id,user_id,campaign_id,status,lines_count,current_index,total_contacts,conference_name,from_number'
    )
    .eq('id', args.sessionId)
    .maybeSingle();
  if (error || !session || session.status !== 'active') {
    dialerLog('complete_batch_skip_session_inactive_or_missing', {
      sessionId: args.sessionId,
      hasSession: Boolean(session),
      status: session?.status ?? null,
      error: error?.message ?? null,
    });
    return;
  }
  const fromNumber = (session as { from_number?: string }).from_number?.trim() || args.fromNumber;
  if (!fromNumber) {
    dialerLog('complete_batch_skip_missing_from_number', { sessionId: args.sessionId });
    return;
  }

  const nextIndex = session.current_index + session.lines_count;
  const contacts = await fetchDialableContacts(supabase, {
    campaignId: session.campaign_id,
    userId: session.user_id,
    offset: nextIndex,
    limit: session.lines_count,
  });

  if (contacts.length === 0) {
    dialerLog('complete_batch_campaign_complete', {
      sessionId: args.sessionId,
      nextIndex,
      totalContacts: session.total_contacts,
    });
    await supabase
      .from('dialer_sessions')
      .update({
        status: 'completed',
        current_index: nextIndex,
        ended_at: new Date().toISOString(),
      })
      .eq('id', args.sessionId);

    await publishDialerEvent(args.userId, 'CAMPAIGN_COMPLETE', {
      sessionId: args.sessionId,
      summary: {
        totalContacts: session.total_contacts,
      },
    });
    return;
  }

  await supabase
    .from('dialer_sessions')
    .update({
      current_index: nextIndex,
    })
    .eq('id', args.sessionId);

  await fireBatch(supabase, {
    userId: args.userId,
    sessionId: args.sessionId,
    campaignId: session.campaign_id,
    conferenceName: session.conference_name,
    linesCount: session.lines_count,
    fromNumber,
    webhookUrl: args.webhookUrl,
    batchIndex: Math.floor(nextIndex / session.lines_count),
    contacts,
  });
  dialerLog('complete_batch_next_batch_fired', {
    sessionId: args.sessionId,
    nextIndex,
    linesCount: session.lines_count,
    contactsCount: contacts.length,
  });
}

async function getContactCallCount(supabase: SupabaseClient, contactId: string): Promise<number> {
  const { data } = await supabase
    .from('contacts')
    .select('call_count')
    .eq('id', contactId)
    .maybeSingle();
  return (data?.call_count as number | null) ?? 0;
}

export async function getActiveCallIdsForSession(sessionId: string): Promise<string[]> {
  const batchState = await getSessionBatchState(sessionId);
  return batchState?.activeCallIds ?? [];
}

export async function markNoAnswerAndCleanup(
  supabase: SupabaseClient,
  callControlId: string
): Promise<void> {
  const callState = await getCallState(callControlId);
  if (!callState) {
    dialerLog('no_answer_cleanup_missing_call_state', { callControlId });
    return;
  }
  dialerLog('no_answer_cleanup_start', {
    sessionId: callState.sessionId,
    callControlId,
    contactId: callState.contactId,
  });
  await supabase
    .from('contacts')
    .update({
      call_status: 'no_answer',
      last_called_at: new Date().toISOString(),
      call_count: (await getContactCallCount(supabase, callState.contactId)) + 1,
    })
    .eq('id', callState.contactId);
  await supabase
    .from('call_logs')
    .update({
      status: 'no_answer',
      ended_at: new Date().toISOString(),
    })
    .eq('call_control_id', callControlId);
  await publishDialerEvent(callState.userId, 'CONTACT_NO_ANSWER', {
    contactId: callState.contactId,
  });
  await delCallState(callControlId);
  dialerLog('no_answer_cleanup_done', {
    sessionId: callState.sessionId,
    callControlId,
    contactId: callState.contactId,
  });
}

export async function resolveStaleBatchIfTimedOut(
  supabase: SupabaseClient,
  args: {
    sessionId: string;
    timeoutMs?: number;
    userId: string;
    fromNumber: string;
    webhookUrl: string;
    triggerEventType?: string;
    triggerCallControlId?: string;
  }
): Promise<void> {
  const timeoutMs = args.timeoutMs ?? 45000;
  const batchState = await getSessionBatchState(args.sessionId);
  if (!batchState) {
    dialerLog('stale_batch_skip_missing_state', { sessionId: args.sessionId });
    return;
  }
  if (batchState.humanAnsweredCallId) {
    dialerLog('stale_batch_skip_human_already_connected', {
      sessionId: args.sessionId,
      humanAnsweredCallId: batchState.humanAnsweredCallId,
      triggerEventType: args.triggerEventType ?? null,
      triggerCallControlId: args.triggerCallControlId ?? null,
    });
    return;
  }
  const triggerEventType = args.triggerEventType ?? '';
  const triggerCallControlId = args.triggerCallControlId ?? '';
  const isAnswerProgressEvent =
    triggerEventType === 'call.answered' ||
    triggerEventType === 'call.machine.detection.ended' ||
    triggerEventType === 'call.machine.premium.detection.ended' ||
    triggerEventType === 'call.bridged';
  if (
    isAnswerProgressEvent &&
    triggerCallControlId &&
    batchState.activeCallIds.includes(triggerCallControlId)
  ) {
    dialerLog('stale_batch_skip_answer_progress_event', {
      sessionId: args.sessionId,
      triggerEventType,
      triggerCallControlId,
    });
    return;
  }
  const ageMs = Date.now() - batchState.firedAt;
  if (ageMs < timeoutMs) return;

  dialerLog('stale_batch_timeout_reached', {
    sessionId: args.sessionId,
    ageMs,
    timeoutMs,
    activeCallIds: batchState.activeCallIds,
    triggerEventType: args.triggerEventType ?? null,
    triggerCallControlId: args.triggerCallControlId ?? null,
  });

  for (const callId of batchState.activeCallIds) {
    dialerLog('stale_batch_cleanup_call', {
      sessionId: args.sessionId,
      staleCallId: callId,
    });
    await markNoAnswerAndCleanup(supabase, callId);
    await hangupCall(callId);
  }

  await setSessionBatchState(args.sessionId, {
    ...batchState,
    activeCallIds: [],
  });

  await completeBatchAndAdvanceIfNeeded(supabase, {
    sessionId: args.sessionId,
    userId: args.userId,
    webhookUrl: args.webhookUrl,
    fromNumber: args.fromNumber,
  });
  dialerLog('stale_batch_advanced', { sessionId: args.sessionId });
}

export function getDialerChannelForUser(userId: string): string {
  return redisKeys.userDialerChannel(userId);
}
