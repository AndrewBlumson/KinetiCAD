# Security

To report a suspected security issue, contact [support@adevious.co.uk](mailto:support@adevious.co.uk)
with the affected version or commit, the relevant feature and a minimal
reproduction. Avoid including credentials or private CAD files. Please contact
the maintainer before posting sensitive reproduction details publicly.

The [dependency security review](docs/DEPENDENCY-SECURITY-REVIEW.md) records the
current audit scope and unresolved advisories. Passing CAD/physics tests does
not establish security clearance. No formal support-response time or security
certification is promised.

Project files and STEP imports are processed locally, but they remain untrusted
input to complex geometry code. Keep a downloaded backup of important work.
The repository excludes common secret files; this is not a substitute for
reviewing staged changes or the contents of exported projects before sharing.

Use the pinned dependency graph for reproducible development, review security
updates deliberately, and test them independently of feature work. The current
code-generation scaffold reads a checked-in OpenAPI file; do not run it against
untrusted specifications while its recorded advisories remain unresolved.

Do not publish a development server as the production app. Confirm the actual
Replit build/start configuration and external routes using the
[handoff guide](docs/REPLIT-HANDOFF.md) and [release checklist](docs/PUBLIC-RELEASE-CHECKLIST.md).
