# A simple demo you can explain

Open the app and say:

> “After a planning meeting, I usually have messy notes but still need to work out who is doing what, decide missing dates, and write a follow-up. This app turns that into a reviewable handoff using Antseed.”

## Show the workflow

1. **Capture.** Load the sample meeting. It is fictional campus-demo planning data, so the demo shares no private meeting notes.
2. **Extract.** Click Make an action plan. Explain: “The server uses the Antseed gateway and a pinned free provider. One model extracts the draft; I review it.” The saved live run took 13.76 seconds, but later runs can vary.
3. **Check.** Open a source note. Point to a named owner and explicit date, then to the unassigned guest task and “before rehearsal” deadline. Explain: “The app does not fill those gaps by guessing.”
4. **Decide.** In the demo, assign Divyansh to the guest-confirmation task and choose 2026-11-06. Say that these are your demo edits, not dates or commitments the AI found in the notes. Clean up task wording if needed, then include the three dated tasks.
5. **Handoff.** Show the CSV, three all-day calendar entries and follow-up draft. The unresolved rehearsal and backup-model questions stay visible. Nothing is sent or added to a calendar automatically.

If Antseed is unavailable, click View recorded Antseed run and say it is saved output, not a new request. Your review and exports still work locally.

## The important distinctions

- Antseed supplies inference, gateway authentication and routing. We built the meeting workflow, review controls, source checks and exports.
- This is an AI-assisted reference app. It demonstrates a complete small workflow; it is not a claim of a new model or a production meeting platform.
- Source text checks are useful guardrails, not proof that the interpretation is correct.
- The useful output is a reviewed task handoff, not just a summary. Other chat tools can extract tasks too; this app makes review and export a repeatable flow.

## How it supports your contribution offer

> “I built a meeting-to-actions app on Antseed and tested it through the gateway. That gives me a real workflow to test: setup, free-model selection, structured responses, errors, and useful output. I can own developer-experience work by recording where people get stuck and turning those findings into reproducible reports, better examples and specific fixes.”

A small first project could be testing this setup with a few new developers and measuring whether they can reach their first exported task list. Deliver setup notes, reproduction steps and improvements to an example or documentation. Upstream Antseed changes would be separate work.

## If he asks about the spend cap

The earlier field study captured a $0.01 key allowance, $0.00 spent and a temporary hold of $0.30, then $0.60. The gateway refused a request to a free route. A hold reserves possible spending while requests or accounting are unsettled; it is not a bill. Antseed [documents the mechanism](https://antseed.com/docs/gateway/budgets/).

Say: “The feedback was confusing as a first-time free user. I would test clearer explanations of the allowance and hold before calling it a product defect.”

The saved cap evidence is in the [original study](https://github.com/divyanshAgarwal123/antseed-issue-workbench/blob/main/evidence/direct-free-budget-repro.json). It was not newly discovered by this meeting app. The live meeting run recorded $0.00 spend. Raising a key allowance is not the same as depositing or spending money.
