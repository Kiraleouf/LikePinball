# AGENTS.md

## Source of truth

- Read `README.md` before making implementation decisions.
- The GitHub Project associated with this repository is the work queue.
- GitHub Issues define the scope and acceptance criteria of each task.
- Do not implement future issues early unless strictly required by the current issue.

## Work queue workflow

Use the GitHub CLI (`gh`) to interact with the GitHub Project and Issues.

When asked to work through the backlog:

1. Find the GitHub Project associated with this repository.
2. If an item is already `In Progress`, resume that issue first.
3. Otherwise take the first issue in `Backlog`, respecting the current Project order.
4. Read the complete issue before modifying code.
5. Move the Project item to `In Progress` before starting implementation.
6. Implement only the scope of that issue.
7. Run the relevant tests/checks for the change.
8. Verify the issue acceptance criteria explicitly.
9. Commit the completed work with a clear commit message referencing the issue.
10. Add a concise comment to the GitHub Issue containing:
   - what was implemented;
   - tests/checks executed;
   - any relevant technical note.
11. If all acceptance criteria are satisfied, close the GitHub Issue and move the Project item to `Done`.
12. Then take the next `Backlog` issue and repeat.

## Blocking rule

If the issue cannot be completed safely because of an ambiguity, missing information, external dependency, permission problem, or significant unexpected architectural decision:

1. Do not guess or silently expand the scope.
2. Keep the item `In Progress`.
3. Add a comment to the Issue explaining precisely what is blocking progress and what decision/information is needed.
4. Stop processing the backlog and report the blocker to the user.

Do not skip a blocked issue to start later backlog items unless explicitly instructed.

## Development rules

- Prefer the smallest coherent change that satisfies the current issue.
- Do not refactor unrelated code.
- Do not introduce abstractions for hypothetical future needs.
- Reuse existing architecture and conventions when they are appropriate.
- Do not weaken, remove, or bypass tests to make an implementation pass.
- Keep TypeScript strongly typed; avoid `any` unless there is a concrete documented reason.
- Keep gameplay constants that require tuning (physics, score values, forces, thresholds) centralized and easy to adjust.
- Keep table definition, physics/gameplay logic, rendering, and progression reasonably separated as described in the README.

## Game-specific priority

For LikePinball, gameplay feel is more important than feature count.

In particular:

- physics must remain stable;
- flipper response must remain predictable enough to aim;
- visual effects must not reduce gameplay readability;
- do not add post-V0 roguelike/meta-progression features while working on the V0 backlog;
- preserve the minimal black + neon visual direction from the README.

## Validation

At minimum, run the checks relevant to the current issue. When the project provides them, this normally includes:

- TypeScript/typecheck;
- automated tests relevant to the modified behavior;
- production build.

For gameplay/physics issues that cannot be fully validated with automated tests, also run the game and perform the relevant playable verification when the environment permits it.

Never claim a test, build, visual check, gameplay check, deployment, or GitHub Project transition succeeded unless it was actually performed.

## Definition of Done

An issue is `Done` only when:

- its requested behavior is implemented;
- its acceptance criteria are satisfied;
- relevant checks pass;
- no known blocking regression remains;
- the implementation is committed;
- the GitHub Issue has received the completion comment;
- the Issue is closed;
- its Project item is moved to `Done`.
