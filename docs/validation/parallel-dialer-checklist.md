# Parallel Dialer Validation Checklist

## Feature Flag

- Backend flag: set `PARALLEL_DIALER_ENABLED=true` to enable dialer session start endpoint.
- Frontend flag: set `VITE_PARALLEL_DIALER_ENABLED=true` to show parallel dial UI/actions.

## Required Environment Variables

- `TELNYX_API_KEY`
- `TELNYX_CONNECTION_ID`
- `TELNYX_PHONE_NUMBER`
- `TELNYX_WEBHOOK_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Manual E2E Checklist

- Start a session from campaign modal with lines = 3.
- Confirm `DIALER_SESSION_STARTED` and `BATCH_FIRING` events appear in UI.
- Confirm each leg emits `CALL_INITIATED`; contact status becomes `dialing`.
- Confirm machine AMD result marks contact as `voicemail`.
- Confirm first human AMD result bridges and emits `HUMAN_CONNECTED`.
- Confirm all other active legs in same batch are hung up immediately.
- End the live call and confirm `CALL_ENDED` followed by next batch fire.
- Pause session and confirm no additional batches fire.
- Stop session and confirm active legs are hung up and session status is `stopped`.
- Complete campaign and confirm `CAMPAIGN_COMPLETE` event and summary counters.

## Reliability Scenarios

- Simulate duplicate webhook retries; verify `call_logs` upsert idempotency.
- Simulate second human race in same batch; verify second leg hangs up.
- Simulate late webhook after stop; verify leg is dropped and ignored.
- Simulate stale batch >45s; verify unresolved legs become `no_answer` and batch advances.
