# Softdial Studio documentation

Human-facing documentation. For AI-agent context, start at
[`../CLAUDE.md`](../CLAUDE.md) and [`../.brain/`](../.brain/).

## Guides — task-oriented walkthroughs

| Guide                                                               | Read it when                                                      |
| ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [deploy-parallel-dialer.md](guides/deploy-parallel-dialer.md)       | Standing the whole backend up: migrations, functions, secrets     |
| [deploy-edge-functions.md](guides/deploy-edge-functions.md)         | Deploying or redeploying Supabase Edge Functions                  |
| [telnyx-call-control-setup.md](guides/telnyx-call-control-setup.md) | Configuring Telnyx — **read this before touching connection IDs** |
| [csv-import.md](guides/csv-import.md)                               | Working on contact import and column mapping                      |

## Reference — lookup material

| Document                                                       | Contains                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------- |
| [environment-variables.md](reference/environment-variables.md) | Every env var, where it's read, and what breaks without it |
| [edge-functions.md](reference/edge-functions.md)               | Function inventory, URLs, and auth model                   |

## Validation

| Document                                                                | Contains                                   |
| ----------------------------------------------------------------------- | ------------------------------------------ |
| [parallel-dialer-checklist.md](validation/parallel-dialer-checklist.md) | Manual E2E checklist for dial-loop changes |

## Other

- [../CONTRIBUTING.md](../CONTRIBUTING.md) — conventions and workflow
