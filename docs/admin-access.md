# Administrator access

Visitors open the published map and original category grid. The public header has no editor button. The subtle padlock beside the footer credit opens the password dialog; `#admin` and Ctrl/Cmd+Shift+E also open it. The administrator receives the generated password separately. No password is committed to this repository.

A correct password unlocks Layout studio for the current tab. The editor module loads on demand. All app mutation, import, export, undo and redo actions check the unlocked session. Refresh and Lock editor discard the in-memory key and return to the published map. Cancelling an unlock cannot leave a background request authorized.

Drafts are stored as authenticated AES-256-GCM ciphertext, using a password-derived nonextractable key (PBKDF2-SHA-256, 600,000 iterations, random 128-bit salt, new 96-bit IV for each draft). Passwords and keys are never stored. The password is checked locally against an authenticated marker, without sending the password to a server. Draft encryption and the access marker use separate authenticated contexts. Existing valid v3 drafts migrate only after administrator sign-in and a successful encrypted save.

GitHub Pages serves static files. Public map data and application source code remain public. The password gate protects the supplied editing interface and private drafts; GitHub repository permissions authorize publication. An arbitrary client-side implementation cannot act as server authorization. Export `campus.json` and commit it to `data/campus.json` through an authorized GitHub account to update everyone’s map.

## Change or recover the password

1. Unlock and export private drafts before changing the password.
2. In a local checkout, run `node tools/configure-admin.mjs`.
3. Enter a new password of at least 16 characters twice. The terminal does not echo it.
4. Commit the resulting `data/admin-lock.json`. Keep the password in a private password manager.

The repository owner can generate a replacement lock using the tool above if the password is lost. Previously encrypted drafts require the previous password and lock configuration. The published campus data remains available independently of any draft.

`--generate --note /absolute/path/outside/the/repository.txt` can generate a random password and save its access instructions. The script refuses to place the note inside the public checkout. The private note is written before the public configuration changes. Never commit access notes.

Administrator unlocking requires HTTPS/Web Crypto. The editor is cached after its first successful online load, so reconnect once if an initial offline unlock cannot fetch it. Visitors’ published maps remain available offline after the shell cache has completed.
