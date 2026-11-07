# Branching model

CapriGPT is one Windows desktop app in one repository. The branching model exists so that
what you run every day, what is being worked on, and what has shipped are three separate
things, and so that moving a change between them is either a deliberate decision or a
mechanical chore done by a robot, never something half-remembered by hand.

It is adapted from GoosicReborn's model. That one also keeps three `platform/*` branches,
because Goosic is one product on three operating systems; CapriGPT has a single platform, so
those branches and everything that follows from them are left out.

## The two long-lived branches

| Branch | Role | Receives from | Never receives from |
| --- | --- | --- | --- |
| `main` | Deployment. What has shipped. | `development`, at a deployment; a `hotfix/<slug>` | Anything else |
| `development` | Integration. The working trunk. | Work branches, and `main` after a hotfix | — |

`main` is not the trunk. Nothing is branched from it except a hotfix, and nothing is merged
into it except a deployment, so its history is a list of releases rather than a list of
changes. Day to day, `development` is the branch that matters: it must always pass
`npm test`, because every work branch is cut from it and re-synced against it.

One exception exists, and it is narrow: files under `.github/workflows/`. GitHub runs a
scheduled or `workflow_run` workflow from the default branch's copy only, and the default
branch is `main`, so workflow infrastructure may land on `main` directly. Code and
documentation still arrive only through a deployment. Such a commit leaves `main` briefly
ahead of `development`; the cascade below merges it down after the next green run.

```
main            ───────────────────●───────────────────●   deployments only
                                  ╱                   ╱
development     ──●────●─────────●─────────●─────────●     the trunk
                   ╲    ╲       ╱          ╲       ╱
                    ╲    ●─────●  fix/…     ●─────●  feature/…
```

## Work-branch names

Everything other than `main` and `development` is short-lived, named for what it does, and
deleted after it lands.

| Cut from | Name | Example |
| --- | --- | --- |
| `development` | `feature/<slug>` | `feature/spoken-replies` |
| `development` | `fix/<slug>` | `fix/memory-panel-while-chatting` |
| `main` | `hotfix/<slug>` | `hotfix/installer-shortcut` |

The prefix is not decoration. The propagation and pruning workflows read the parent of a
branch off its name, so a branch called anything else is never synced and never tidied.

## Local workspace

`C:\DEV\CapriGPT` is the canonical checkout, and the user's `CapriGPT.lnk` desktop shortcut
launches whatever branch it currently has checked out. Keep `development` checked out
between tasks, so the app you use every day is the trunk and not a half-finished work
branch. Do not create sibling worktree folders to isolate a small task; create one only when
the user asks, or when a concurrent task cannot share this working tree, and remove it once
its work is merged or deliberately discarded.

## Merge direction

**Down, automatically.** `main` → `development` → every `feature/*` and `fix/*`. The
propagation workflow does this after each green CI run, so a work branch always builds against
the current trunk and a hotfix reaches every branch through one push.

**Up, deliberately.** A work branch merges into `development` when it is finished and
`npm test` passes on it. `development` merges into `main` only at a deployment. Nothing is
ever merged toward `main` automatically, because deciding that something is ready to ship is
a judgement, not a chore.

Never rebase or force-push `main` or `development`. They are shared, and rewriting their
history breaks every other copy.

## What CI checks

`.github/workflows/ci.yml` runs `npm test` on Windows for every push and pull request. A
change that only touches documentation or the README runs nothing. A second push to the same
branch cancels the first run, because its answer no longer matters.

CI runs the unit tests only. The Electron smoke tests (`npm run test:desktop` and friends)
drive real windows and the user's desktop, so they stay a local check: run the ones that
cover what you changed before handing work back.

## Automatic propagation

| A green CI run on | Is merged into |
| --- | --- |
| `main` | `development` |
| `development` | every `feature/<slug>` and `fix/<slug>` |

`main` is in that table because of hotfixes. A hotfix is cut from `main` and merged back to
`main`, and at that moment the trunk does not have it. Forgetting to merge `main` back into
`development` breaks nothing visibly; the fix simply disappears at the next deployment, when
`development` overwrites `main` with a history that never learned about it. After an ordinary
deployment the same merge is a no-op, so it costs nothing.

Three rules keep the cascade from becoming noise or damage. **A conflict opens a pull
request; it never forces anything.** **A work branch already contained in its parent is
skipped**, because merging into a finished branch makes a commit nobody reads. **A work
branch untouched for a month is skipped**, because it is not waiting for updates. Neither
skip applies to `development`: after a deployment it is contained in `main` without being
finished, so it is fast-forwarded instead. That is not a force push; the server refuses it if
it is not a fast-forward.

Pushes made with the built-in `GITHUB_TOKEN` do not start other workflows, so a child synced
with it is merged but never checked by CI. The workflows therefore use a `PROPAGATE_TOKEN`
repository secret (a fine-grained token with Contents and Pull requests write access to this
repository) and fall back to `GITHUB_TOKEN` until one exists.

## Pruning finished branches

A weekly workflow deletes `feature/*` and `fix/*` branches from the remote on one condition:
every commit on the branch is already an ancestor of `development`. Deleting such a branch
removes a label, not work. Age is never the reason; it is only a grace period on top, so a
branch merged less than a week ago is kept, and so is one with an open pull request. `main`
and `development` are never candidates. Each deletion is logged with the branch's SHA so it
can be restored. A manual run from the Actions tab defaults to a dry run.

Local clones accumulate branches whose upstream is gone. Clear them at the start of a session:

```sh
git fetch --prune
git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads \
  | awk '$2 == "[gone]" { print $1 }' \
  | xargs -r git branch -d
```

`-d` refuses to delete a branch whose commits are not merged. If it refuses, read why; never
reach for `-D` to make the error go away.

## Deployment

A deployment is `development` → `main`. Before it, `npm test` passes, the relevant smoke
tests pass locally, and the README describes what actually ships. Bump `version` in
`package.json` on `development` first, then merge, tag the merge commit on `main` as
`v<version>`, and push the tag. [RELEASING.md](RELEASING.md) covers what the tag builds.

A hotfix is the one exception to "nothing is cut from `main`": cut `hotfix/<slug>` from
`main`, fix the one thing, and merge it to `main`. The cascade then carries it into
`development`.
