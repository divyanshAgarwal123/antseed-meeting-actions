# Evidence and boundaries

All meeting data in this repository is fictional and labelled as sample data. A live run on 2 November 2026 (IST) used the Antseed CLI 0.1.222, an isolated unfunded identity, a local gateway on port 18379 and buyer on 18377. The app was configured with a temporary local gateway key; no key or identity is included here.

| Artifact | What it demonstrates |
| --- | --- |
| [demo-run.json](evidence/demo-run.json) | Actual live output exported through the UI: five tasks, two decisions/constraints and two open questions; source notes, zero-price quote, pinned model, actual response peer and 13.76-second timing. All extracted source quotes matched the sample notes. |
| [gateway-usage.json](evidence/gateway-usage.json) | Sanitized key-usage snapshot after the run and downloads: three gateway requests and $0.00 recorded spend. Request count includes discovery. Exporting files did not require model calls. |
| [task-review.png](evidence/task-review.png) | The live task-review screen with a source quote, an unassigned task and unresolved dates. |
| [reviewed-demo-run.json](evidence/reviewed-demo-run.json) | Original model output plus the separate reviewed state. Task wording was shortened; the missing guest-task owner and 2026-11-06 date were human demo choices. Three tasks were included. |
| [reviewed-plan.png](evidence/reviewed-plan.png) | The reviewed handoff screen with three included tasks and the resulting draft. |
| [confirmed-tasks.csv](evidence/confirmed-tasks.csv) | Three confirmed tasks, with owners, dates and original source quotes. |
| [confirmed-tasks.ics](evidence/confirmed-tasks.ics) | Three dated, all-day calendar events generated locally from included tasks. |
| [follow-up.txt](evidence/follow-up.txt) | A locally generated follow-up draft containing the included tasks, decisions and unresolved questions. It was not sent. |

Browser checks also covered text import, copying the follow-up, recorded replay, human-edit labels and a 390-pixel layout without horizontal overflow.

Ten offline Python tests exercise extraction validation and routing recovery. Seven Node tests exercise reviewed-only exports, CSV formula/quote handling, valid calendar dates, escaped/folded calendar text follow-up content and stale title annotations. These are software checks, not evidence of model accuracy on other meetings.

The one live example matched its expected five actions. That is a small functional check, not a benchmark. Exact source matching does not prove entailment, agreement, correct ownership or completeness. The user must review the output. Calendar formatting was checked by the export tests; no external calendar was modified.

Before publication, the evidence set was checked for API-key strings, bearer tokens, private-key blocks, local home paths and email addresses. Public provider IDs remain so the quoted offer and response peer can be compared. Local runtime and identity data stay outside the repo.

The older [issue-workbench study](https://github.com/divyanshAgarwal123/antseed-issue-workbench) is the source for the earlier spend-cap and model-selection observations. They are not represented as new discoveries from this run.
