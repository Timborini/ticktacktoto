# Security Policy

## Reporting a Vulnerability

Please do not open a public GitHub issue for security vulnerabilities.
Instead, report them privately via GitHub's private vulnerability reporting
(Security tab → "Report a vulnerability") or by contacting the repository
maintainer directly.

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce
- Affected versions/commits, if known

You can expect an acknowledgement within 7 days.

## Scope Notes

- Firebase API keys in client-side code are **not secret** by design; access
  control is enforced by `firestore.rules`, Firebase Auth, and API-key
  restrictions configured in Google Cloud Console. Report a key only if it
  lacks restrictions or if the rules allow unintended access.
- Time entries are client-reported; Firestore rules bound their shape and
  size but cannot verify elapsed time server-side. This is a known,
  accepted trust limitation of the design.
