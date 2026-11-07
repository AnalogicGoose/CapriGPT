# Releasing

A release is a deployment, described in [BRANCHING.md](BRANCHING.md): `development` is merged
into `main`, and the merge commit is tagged with the version.

## Making one

1. On `development`, set `version` in `package.json` and write `docs/RELEASE_<version>.md`.
2. Merge `development` into `main`.
3. Tag that merge commit `v<version>`, matching `package.json` exactly, and push the tag.

The release workflow checks that the tag and `package.json` agree, runs `npm test` on the
tagged tree, builds the NSIS installer with `npm run dist`, writes `SHA256SUMS.txt`, and
attaches both to a **draft** GitHub release whose text is `docs/RELEASE_<version>.md`.

Install the draft's download on a real Windows desktop and compare its hash before
publishing. The installer is not signed with a paid certificate, so the first run shows
SmartScreen's "Windows protected your PC" box (More info → Run anyway). Say so in the release
text, because an unexplained warning reads as a broken app rather than an unsigned one.

## Release notes

`docs/RELEASE_<version>.md` opens with the version as a headline and a one-line tagline. Each
change gets its own section: a short headline, a one-line tagline that says what it means for
the person using Capri, then a short paragraph on what changed and why. Lead with the outcome
and leave internals out of the taglines. Every claim must be true and checkable; never promise
more than the release does, and say plainly what still needs a live check.

```
## Review memories, mid-conversation

The memory panel opens even while you are chatting.

Choosing Review in the control room now swaps an open chat for the local memory commands,
instead of being silently ignored until the chat closed.
```
