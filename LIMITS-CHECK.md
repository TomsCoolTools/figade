# Monthly limits check: November 2026

Run on 1 Nov 2026, from main at 872cc49.

**Result: no site text changed, and the "checked" date (29 Sep 2026) was NOT updated.** As in October, two limits could not be confirmed. Microsoft's own pages give different numbers for Outlook.com. The WhatsApp help pages could not be read, and the official text found in search contradicts the site. Both still need a decision from Tom.

Note: main already has the October LIMITS-CHECK.md and SETUP-CHECK.md, because PR #11 was merged with them. This branch replaces LIMITS-CHECK.md. Please delete both files before merging. This branch has no site changes, so there is nothing else to merge.

## Results

| Limit on the site | Where it appears | Status |
|---|---|---|
| Discord free upload limit 20MB (raised from 10MB in August 2026) | video/compress-video-for-discord, video/compress-video-to-8mb, index, about | Confirmed from search result (page behind a bot check) |
| Gmail attachments 25MB | video/compress-video-for-email, video/compress-video-to-25mb, index | Confirmed |
| Outlook.com attachments 20MB | video/compress-video-for-email, video/compress-video-to-25mb, index | Could not be checked (official sources disagree) |
| Exchange work accounts often default to 10MB | video/compress-video-for-email | Confirmed |
| GitHub refuses files over 100MB in a repository | video/compress-video-to-100mb | Confirmed |
| WhatsApp: about 16MB is where it stops re-compressing; up to 2GB from the gallery (re-encoded); documents keep original quality with a smaller cap | video/compress-video-for-whatsapp | Could not be checked (page unreadable; the official text found contradicts the site) |

## Details

### Discord: 20MB free upload limit
- URL: https://support.discord.com/hc/en-us/articles/25444343291031-File-Attachments-FAQ
- The page itself returns HTTP 403 (a "Just a moment..." bot check).
- Text from that same page, as the web search tool returned it: "For non-Nitro subscribers, the maximum file upload is 20MB." It also says the limit was raised from 10MB as of August 2026, and that "Discord is currently experimenting with various file upload size limits, and select users may have the ability to upload larger file sizes."
- Note: the search tool returns a summary rather than the raw snippet, so this wording may be slightly paraphrased. The number and the date match the site.
- Side note, not a figure the site uses: an older Discord article, "Discord Account Caps, Server Caps, and More" (https://support.discord.com/hc/en-us/articles/33694251638295), still lists the free tier at 10MB. It appears to predate the August 2026 change.
- Status: **confirmed from search result (page behind a bot check)**.

### Gmail: 25MB attachments
- URL: https://support.google.com/mail/answer/6584?hl=en&co=GENIE.Platform%3DDesktop
- Wording: "For personal Gmail accounts, the limit is 25 MB."
- Status: **confirmed**.

### Outlook.com: 20MB attachments
- URL 1: https://support.microsoft.com/en-us/office/reduce-attachment-size-to-send-large-files-with-outlook-8c698842-b462-4a4c-8d53-5c5dd04f77ef
  - Wording: "For internet email accounts such as Outlook.com or Gmail, the email size limit is 20 megabytes (MB)."
- URL 2: https://support.microsoft.com/en-us/outlook/sending-limits-in-outlook-com
  - Wording, under "What's the file attachment size limit in Outlook.com?": "The attachment size limit for files is 25 MB."
- URL 3: https://support.microsoft.com/en-US/Support/known-issues/unable-to-attach-files-in-outlook-com
  - Wording: "The size limit for an email in Outlook.com is 25 MB."
- Unchanged since October. The two pages that are specifically about Outlook.com say 25 MB. The page about the Outlook app says 20 MB, and it also gives Gmail 20 MB, while Google's own page says 25 MB.
- Status: **could not be checked (contradictory official sources)**. No change made.
- For Tom: the pages that are specifically about Outlook.com point to 25MB. If you agree, these would change: on the email page, the description, intro, limit.big ("20 MB"), the limit caption and the first fact; on the 25MB page, the first fact; and on the index page, the fact "20MB for Outlook". The suggested 15MB target on the email page stays safe either way.

### Exchange work accounts: often 10MB by default
- URL: https://support.microsoft.com/en-us/office/reduce-attachment-size-to-send-large-files-with-outlook-8c698842-b462-4a4c-8d53-5c5dd04f77ef
- Wording: "For Exchange accounts (business email), the default email size limit is 10 MB."
- Status: **confirmed**.

### GitHub: refuses files over 100MB
- URL: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
- Wording: "GitHub blocks files larger than 100 MiB."
- Note: 100 MiB is 104.9 MB, so a file just under 100MB is accepted, as the site says.
- Status: **confirmed**.

### WhatsApp
- The site says WhatsApp stops re-compressing at about 16MB. It says the gallery or video button allows up to 2GB but re-encodes, and documents keep the original quality with a smaller cap. It also says "Older guides saying a flat 16MB are out of date."
- Pages tried directly with WebFetch:
  - https://faq.whatsapp.com/453914586839706/?cms_platform=web ("How to send media, contacts, or location")
  - https://faq.whatsapp.com/164676891531296/?locale=en_US ("How to send media")
  - Both return only the page title, and the body is cut off. This is not the "Just a moment..." bot check, but the pages still could not be read.
- Text the web search tool returned for faq.whatsapp.com pages (summaries, which may be paraphrased):
  - From the web/desktop send-media guide: "the maximum allowed document size is 2 GB".
  - From the Windows desktop send-media page: "default video size limit of 100MB and 720p resolution for faster connections, and 64MB and 480p resolution for slower connections".
  - From an older troubleshooting page: "The maximum file size allowed for all media (photos, videos or voice messages) to be sent or forwarded through WhatsApp is 16 MB on all platforms."
  - One page still gives 100 MB for documents.
- This contradicts the site. The official text gives documents the biggest cap (2 GB), not a smaller one. It also gives videos sent as media 100MB/64MB or 16MB, not 2GB. The pages disagree with each other, and none could be read in full.
- Status: **could not be checked (page unreadable; the official text found contradicts the site and is inconsistent)**. No change made.
- For Tom: please check the WhatsApp Help Center by hand in a browser. If documents really go up to 2 GB and media videos are capped at 100MB/64MB (or 16MB), the first fact on the WhatsApp page needs rewriting. The 16MB target itself is still a safe size.

## Changes made
- None to the site. `checked` in src/_data/site.json stays at "29 Sep 2026", because two limits could not be confirmed.
- Build: `npm install` and `npx @11ty/eleventy` ran cleanly on this branch ("Copied 19 Wrote 32 files", Eleventy v3.1.6).
