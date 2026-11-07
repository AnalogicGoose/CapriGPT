# Capri project preferences

## Branches and commits

The full model is in [docs/BRANCHING.md](docs/BRANCHING.md); the part you must not get wrong:

- Check which branch you are on before writing anything. `main` is **deployment only**:
  never commit to it, never branch from it (except a `hotfix/<slug>`), never merge into it
  outside a deployment. The one exception is `.github/workflows/`, which GitHub reads from
  the default branch.
- `development` is the trunk. Work on `feature/<slug>` or `fix/<slug>` cut from it, and merge
  back to it. The prefix matters: propagation and pruning read a branch's parent off its name.
- Never rebase or force-push `main` or `development`. Merges down are automatic after green
  CI; nothing is ever merged toward `main` automatically.
- Keep `development` checked out between tasks. The desktop shortcut launches whatever branch
  this checkout has checked out, so a work branch left checked out is what the user runs.
- `npm test` must pass before you hand work back; CI repeats it on Windows for every push. Run
  the Electron smoke test that covers your change (`npm run test:memory`, `test:settings`,
  `test:desktop`, ...) locally, because CI does not.
- Tidy local branches whose upstream is gone with the `git branch -d` one-liner in
  `docs/BRANCHING.md`. If `-d` refuses, read why; never use `-D` to silence it.
- **Commit messages** state what changed and why it had to change, in the imperative. No
  co-authorship, attribution, or session trailers.
- Releases follow [docs/RELEASING.md](docs/RELEASING.md), including how release notes read.

- The user wants PC awareness enabled by default for all apps, including newly
  installed apps. Do not require maintaining an app allowlist or repeatedly
  requesting observation permission. Keep observation local and on demand or
  event-triggered; do not add screen recording or keylogging. Do not mistake
  broad observation permission for automatic approval of destructive actions.

- After changing Capri's setup, location, or launch behavior, check the user's
  `CapriGPT.lnk` desktop shortcut and update it if needed so it launches the
  current checkout directly without an npm command or a terminal window.
- Use the Windows Desktop special-folder path rather than assuming its location.
  Point the shortcut at this checkout's Electron executable, pass the absolute
  project folder as its argument, set that folder as the working directory, and
  use Capri's icon. Verify the saved target and arguments.
- The user has authorized these routine shortcut updates; do not ask again.
  Preserve an existing shortcut backup under the ignored `.caprigpt-local/`
  folder before replacing it. Do not restart a running Capri merely to update
  the shortcut; explain if a restart is needed for application changes.
