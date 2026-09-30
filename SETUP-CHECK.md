# Setup check (30 Sep 2026)

- (a) Repository clone and fetch: OK. TomsCoolTools/figade is cloned; `git fetch origin main` succeeded (main at 3d110bc).
- (b) Push a branch: see the commit that added this file; the branch setup-check-result was pushed with `git push -u origin setup-check-result`.
- (c) Pull request tool: available (GitHub MCP tool `create_pull_request`). Not used for this check.
- (d1) Web search: OK. A search for the Gmail attachment limit returned official support.google.com results.
- (d2) Web fetch, Gmail Help (https://support.google.com/mail/answer/6584): FAILED. WebFetch error: `EGRESS_BLOCKED: Access to support.google.com is blocked by the network egress proxy.` curl: `curl: (56) CONNECT tunnel failed, response 403`.
- (d3) Web fetch, Discord support (https://support.discord.com/hc/en-us/articles/25444343291031-File-Attachments-FAQ): FAILED. WebFetch error: `EGRESS_BLOCKED: Access to support.discord.com is blocked by the network egress proxy.` curl: `curl: (56) CONNECT tunnel failed, response 403`.
- (d4) Other official hosts, curl: faq.whatsapp.com, support.microsoft.com and docs.github.com all FAILED with `curl: (56) CONNECT tunnel failed, response 403`.

To fix (d2)-(d4): in the cloud environment's settings, change Network access to a broader level, or add these hosts to the allowed domains: support.google.com, support.discord.com, faq.whatsapp.com, support.microsoft.com, docs.github.com.
