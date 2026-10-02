# Monthly limits check: October 2026

Run on 1 Oct 2026, from main at 3f2c6c8.

**Result: no site text changed, and the "checked" date (29 Sep 2026) was NOT updated.** Two limits could not be confirmed: Outlook.com (Microsoft's own pages disagree) and WhatsApp (the help pages could not be read, and the official text found in search contradicts the site). Both need a decision from Tom.

Delete this file before merging. This branch has no site changes, so there is nothing else to merge.

## Results

| Limit on the site | Where it appears | Status |
|---|---|---|
| Discord free upload limit 20MB (raised from 10MB in August 2026) | video/compress-video-for-discord, video/compress-video-to-8mb, index, about | Confirmed from search result (page behind a bot check) |
| Gmail attachments 25MB | video/compress-video-for-email, video/compress-video-to-25mb, index | Confirmed |
| Outlook.com attachments 20MB | video/compress-video-for-email, video/compress-video-to-25mb, index | Could not be checked (official sources disagree) |
| Exchange work accounts often default to 10MB | video/compress-video-for-email | Confirmed |
| GitHub refuses files over 100MB in a repository | video/compress-video-to-100mb | Confirmed |
| WhatsApp: about 16MB is where it stops re-compressing; up to 2GB from the gallery (re-encoded); documents keep original quality with a smaller cap | video/compress-video-for-whatsapp | Could not be checked (page unreadable; the official text in search contradicts the site) |

## Details

### Discord: 20MB free upload limit
- URL: https://support.discord.com/hc/en-us/articles/25444343291031-File-Attachments-FAQ
- The page itself returns HTTP 403 with a "Just a moment..." bot check, both through WebFetch and curl.
- Text from that same page, as the web search tool returned it: "As of August 2026, the free upload limit is 20MB (up from 10MB), and this limit is checked consistently on desktop and mobile." Also: "Nitro Basic offers 50MB and Nitro offers up to 1GB."
- Note: the search tool returns a summary of the result rather than the raw snippet, so this wording may be slightly paraphrased. The number and the date match the site.
- Status: **confirmed from search result (page behind a bot check)**.

### Gmail: 25MB attachments
- URL: https://support.google.com/mail/answer/6584?hl=en&co=GENIE.Platform%3DDesktop
- Wording: "For personal Gmail accounts, the limit is 25 MB."
- Status: **confirmed**.

### Outlook.com: 20MB attachments
- URL 1: https://support.microsoft.com/en-us/office/reduce-attachment-size-to-send-large-files-with-outlook-8c698842-b462-4a4c-8d53-5c5dd04f77ef
  - Wording: "For internet email accounts such as Outlook.com or Gmail, the email size limit is 20 megabytes (MB)." and "This limit includes both the size of the attachment and the size of the email."
- URL 2: https://support.microsoft.com/en-us/outlook/sending-limits-in-outlook-com
  - Wording: "The attachment size limit for files is 25 MB."
- URL 3: https://support.microsoft.com/en-US/Support/known-issues/unable-to-attach-files-in-outlook-com
  - Wording: "The size limit for an email in Outlook.com is 25 MB."
- Microsoft's pages disagree. The two pages that are specifically about Outlook.com say 25 MB. The page about the Outlook app says 20 MB for internet accounts such as Outlook.com. That page also gives Gmail 20 MB, while Google's own page says 25 MB.
- Status: **could not be checked (contradictory official sources)**. No change made.
- For Tom: the Outlook.com-specific pages point to 25MB. If you agree, these would change: the email page description, intro, limit.big ("20 MB"), the limit caption and the first fact; the 25MB page's first fact; and the index fact "20MB for Outlook". The email page's suggested 15MB target stays safe either way.

### Exchange work accounts: often 10MB by default
- URL: https://support.microsoft.com/en-us/office/reduce-attachment-size-to-send-large-files-with-outlook-8c698842-b462-4a4c-8d53-5c5dd04f77ef
  - Wording: "For Exchange accounts (business email), the default email size limit is 10 MB."
- Supporting source: https://learn.microsoft.com/en-us/exchange/mail-flow/message-size-limits (Exchange Server 2016/2019/SE). Organizational limits table: "Maximum size of a message received | 10 MB" and "Maximum size of a message sent | 10 MB".
- Status: **confirmed**.

### GitHub: refuses files over 100MB
- URL: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
- Wording: "GitHub blocks files larger than 100 MiB."
- Note: 100 MiB is 104.9 MB, so a file at or just under 100MB is accepted, as the site says.
- Status: **confirmed**.

### WhatsApp
- The site says: about 16MB is where WhatsApp stops re-compressing; up to 2GB from the gallery or video button, but re-encoded; documents keep the original quality, with a smaller cap; "Older guides saying a flat 16MB are out of date."
- Pages tried directly, with WebFetch and curl:
  - https://faq.whatsapp.com/453914586839706/?cms_platform=web ("How to send media, contacts, or location")
  - https://faq.whatsapp.com/641217966682199/?locale=en_US ("How to send media")
  - https://faq.whatsapp.com/545917406122452/?locale=en_US ("Why can't I send long videos in WhatsApp?")
  - https://faq.whatsapp.com/239536730601513/?locale=en_US
  - Results: curl gets HTTP 400 "Error" pages. WebFetch gets only the page title, and the body is cut off. The last URL shows "Page not found". This is not the "Just a moment..." bot check, but the pages still could not be read.
- Text the web search tool returned for faq.whatsapp.com pages (summaries, possibly paraphrased):
  - "The maximum file size allowed for all media (photos, videos or voice messages) to be sent or forwarded through WhatsApp is 16 MB on all platforms. On most phones, this will equal from about 90 seconds to 3 minutes of video."
  - "If you choose to send an existing video, it is limited to 16 Megabytes."
  - "The maximum allowed document size is 2 GB."
  - "For users with a faster internet connection, the default video size limit is 100MB and 720p resolution. For users with a slower internet connection, the default video size limit is 64MB and 480p resolution."
- WhatsApp blog (official, but not the Help Center): https://blog.whatsapp.com/reactions-2gb-file-sharing-512-groups. This is about sharing files up to 2GB.
- This text contradicts the site's fact. It gives 16 MB as the cap for media and 2 GB as the cap for documents, which is the opposite of what the site says. It also mentions 100MB/64MB defaults. Some of this text may be old. The pages themselves could not be read, so it is unclear which statements are current.
- Status: **could not be checked (page unreadable; the official text found is contradictory and possibly out of date)**. No change made.
- For Tom: worth checking the WhatsApp Help Center by hand in a browser. If the current pages say media 16MB / documents 2GB, the first fact on the WhatsApp page (including "Older guides saying a flat 16MB are out of date") is wrong and should be rewritten.

## Changes made
- None to the site. `checked` in src/_data/site.json stays at "29 Sep 2026", because two limits could not be confirmed.
- Build: `npm install` and `npx @11ty/eleventy` ran cleanly on this branch ("Copied 17 Wrote 30 files", Eleventy v3.1.6).
