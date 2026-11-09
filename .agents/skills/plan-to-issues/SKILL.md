---
name: plan-to-issues
description: Split this repo's plan.md into GitHub issues with gh, one per unit of work, after a human has reviewed the split. Use when a plan is ready and has no issues yet.
---

# plan-to-issues

Turns `plan.md` into GitHub issues that workers can pick up cold. Easiest with `gh`, authenticated,
in a shell this agent can run.

## Steps

1. Read `plan.md`, `AGENTS.md` and `docs/adr/`.
2. Draft the split as a table: title · plan section · scope · done when · blocked by.
   One issue per unit of work.
3. **Stop and show the table to the human.** Publish nothing until they approve it.
4. Every issue carries the shape in [What every issue carries](#what-every-issue-carries). Ask
   the human only about anything a plan needs beyond it.
5. Create each issue in dependency order, so blocked-by can cite real numbers:

   ```sh
   gh issue create --title "<title>" --body-file <tmp.md>
   ```

6. Record every issue URL from gh's output (not from memory) and reply with the list.

Closing one, with the closing comment from AGENTS.md:

```sh
gh issue close <n> -c "<closing comment>"
```

## What every issue carries

Agreed with the human on 2026-11-08 for plan morning-digest. Use it for every plan here.

- Label: `plan:<plan name from plan.md frontmatter>`. Create the label first if it is missing.
- Body, in this order:

  ```md
  Source: plan.md § <n>

  ## Scope
  <what to build, from the plan section; the rules that apply (ADRs, styleguide)>

  ## Done when
  <the plan's done line, word for word>

  ## Blocked by
  <#n of each issue it waits on, or —; say when only part of it is needed to start>

  ## Suggested model
  <strongest model for logic; a cheaper one for views and tests>
  ```

- The first line is exactly `Source: plan.md § <n>`, with the plan's own section number
  (`§ 2a` for a subsection). The reviewer sorts issues by it.

### Steps that wait on someone else

A step that waits on a person outside the lane (a reviewer, a customer) is done when they
confirm, not when we send. Write its done line that way, and write the wait into Blocked by
(for example `#6, and the reviewer's review being in`). Keep the issue open until they
confirm, and keep every issue that depends on their answer (a clean-up, a marker removal)
blocked by it. Closing on "sent" was refused once on this repo.

### Closing

Commits that say `closes #n` close the issue on push, before anyone can comment. Push them,
then add the closing comment with `gh issue comment <n> -b "..."`, or close by hand first.

## No `gh`

Steps 1–4 hold either way. GitHub reachable another way (a connector, the REST API, the web UI):
the same issues, made that way. GitHub issues out of reach altogether: write them as files in
`docs/issues/`, format in ADR 0004, then commit and push.

## Don'ts

- Don't paste the whole plan into one issue, and don't keep issues only in chat.
- Don't invent sections the plan doesn't have. If the plan is unclear, ask.
