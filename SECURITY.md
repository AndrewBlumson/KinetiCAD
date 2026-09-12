# Security

To report a suspected security issue, contact [support@adevious.co.uk](mailto:support@adevious.co.uk)
with the affected version or commit, the relevant feature and a minimal
reproduction. Avoid including credentials or private CAD files. Please contact
the maintainer before posting sensitive reproduction details publicly.

The [12 September security maintenance](docs/SECURITY-MAINTENANCE-2026-09-12.md)
records the dependency updates and latest online audit: zero advisories, with
none muted. The release Node 24 regression run passed 402/402 cases in 80.936
seconds; workspace and final landing builds, a fresh local frozen installation
and typechecking passed. The recorded local HTTP and scoped Chrome checks also
passed; they do not establish that every feature was retested. GitHub is the
source handoff: verify the remote commit before pulling into Replit. Replit
installation and publication remain separate, pending deployment checks. The earlier
[dependency security review](docs/DEPENDENCY-SECURITY-REVIEW.md) is the preserved
58-finding baseline. Neither passing CAD/physics tests nor a zero-result registry
audit establishes security clearance. No formal support-response time or security
certification is promised.

Project files and STEP imports are processed locally, but they remain untrusted
input to complex geometry code. Keep a downloaded backup of important work.
The repository excludes common secret files; this is not a substitute for
reviewing staged changes or the contents of exported projects before sharing.

Use the pinned dependency graph for reproducible development, review security
updates deliberately, and test them independently of feature work. The current
code-generation scaffold reads a checked-in OpenAPI file. Orval's patched
generator keeps external-reference restrictions enabled; continue reviewing
specifications and generated code before executing them.

Do not publish a development server as the production app. Confirm the actual
Replit build/start configuration and external routes using the
[handoff guide](docs/REPLIT-HANDOFF.md) and [release checklist](docs/PUBLIC-RELEASE-CHECKLIST.md).
