# Deploy the latest study site

Owner-private Site: https://cse-study.familyopenai10916.chatgpt.site
Project: appgprj_6acfcb7a2b648191b06326661ccd9b96

For the future Codex subagent told “deploy the latest site”:

1. Read the installed Sites skill. Call sites_get_site for the project above and
   confirm the selected account is its owner and access remains owner-only.
   Reuse this project; never create another Site or modify other Sites.
2. Call sites_create_source_repository_write_credential for this project.
3. Create that checkout directory if absent. Open/refresh source with the installed site-workflow.mjs helper, running
   from /home/pigfy/.t3/projects/school/deploy/.sites-checkout.
   Use --project-id appgprj_6acfcb7a2b648191b06326661ccd9b96.
   Send {credential: <returned object>} as hidden stdin JSON; retain its result.
4. Build/package the latest static site with:

   bun /home/pigfy/.t3/projects/school/deploy/deploy.mjs

   Omit the argument to deploy the latest site/. An optional argument selects
   another existing static directory; the old placeholder directory was deleted.

5. Run the same helper again, with hidden stdin JSON containing credential,
   source (the complete opening result), commands: [], and archivePath:
   /home/pigfy/.t3/projects/school/.scratch/cse-study.tar.gz
   It commits/pushes the source and repackages the exact output.
6. Call sites_save_version_and_deploy_private with its project_id, commit_sha,
   and archive. Poll sites_get_deployment_status if not terminal.
7. Stop there and report the deployment id and its final status. Pages are
   checked locally (bun check) before every deploy, so a normal deploy does
   no live checks. Run "Live verification" below only when the task says so.

Helper: /home/pigfy/.codex/plugins/cache/openai-curated-remote/sites/1.0.0/scripts/site-workflow.mjs
Run the helper from the checkout for both opening and packaging:

   node /home/pigfy/.codex/plugins/cache/openai-curated-remote/sites/1.0.0/scripts/site-workflow.mjs --project-id appgprj_6acfcb7a2b648191b06326661ccd9b96

Launch it with a TTY; send one newline-terminated credential JSON object only
after “Ready for Site workflow JSON on stdin (input is hidden).” Wait for exit
code 0 and retain the final JSON line (packaging also prints the archive path).
If the installed plugin version changes, locate its scripts/site-workflow.mjs
and matching skills/sites/SKILL.md first; do not assume an old path still exists.
Never persist credentials or put them in command arguments.

worker.mjs serves static files and GET/PUT /api/state/<course>/<week>.
GET returns {data, updatedAt}; PUT accepts {data} and returns {updatedAt}.
Course: lowercase letters, digits, hyphens. Week: w plus exactly two digits.
Identity: oai-authenticated-user-id; missing identity returns 401.
Email: oai-authenticated-user-email. State is isolated per user/course/week.
PUT has a 1 MiB body cap. A PUT of {items: {...}} is merged into the stored
week the way site/core/store.js merges: per item the newer updatedAt wins and
attempts/events are unioned by id, so one client can't erase another's answers.
Any other shape (such as test/w00's {check}) replaces the stored value.
The DB binding and single state table are declared in .openai/hosting.json
and drizzle/0000_state.sql; append migrations rather than editing applied ones.

Static input defaults to /home/pigfy/.t3/projects/school/site.
Paths map directly to files; directory paths use index.html, with or without /.
Reserve /api/ for the Worker. Use relative links or root-relative site paths.
Common web/font/image/PDF MIME types are set; other extensions use octet-stream.
The dependency-free build copies static files and embeds their bytes in the
Worker. Keep this a small study site: large media increases Worker bundle size.
Do not add static.directory: Sites forbids static-only builds with D1.
Output/source checkout and archive are disposable; scripts/config are in deploy/.

Verified 2026-10-14: private deployment succeeded; root/nested placeholder
pages served (no-slash path redirects); DB.state exists; no Worker exceptions;
real signed-in PUT/GET test/w00 matched data and timestamp (200/200).
Bypass tokens are identity-less: they can check pages, but API requests get 401.
Local Worker checks also passed auth, JSON validation, body cap, and routing.

Live verification, only when the task asks for it (for example after a
change to deploy/worker.mjs or site/core/store.js). Use the
authenticated-browser skill and the owner's saved ChatGPT account,
familyopenai10916@gmail.com:

- Open the landing page and confirm CSE 331 and CSE 332 are listed.
- Open /cse331/w01/, /cse331/w02/, /cse332/w01/, /cse332/w02/.
  Wait for network idle; inspect console and page errors for each page,
  confirm KaTeX elements render without .katex-error on the 332 pages,
  and check document.fonts for loaded page and KaTeX fonts.
- Never type into, click answers, hints or solutions on, or clear anything in
  the live study pages. Everything done there is saved to the owner's real
  study record, which Dot reads. Test saving only through the test key below.
- In the signed-in browser, run fetch() to PUT /api/state/test/w00 with body
  {"data":{"check":"<unique marker>"}}, then GET /api/state/test/w00. Confirm
  both return HTTP 200 and the GET returns the marker. If it doesn't, GET
  again after 30 seconds and after 2 minutes, and report each result and the
  GET's response headers.
- Call sites_read_database_overview, then sites_read_database_table_rows
  using its exact DB binding and state table names. Follow next_offset if
  needed; report row count and columns, and only confirm the marker is in
  the test/w00 row.
- Call sites_get_site_worker_logs with errors_only=true for this project.
  Report any errors; never change site/ as part of deployment verification.

Verified latest site/ on 2026-10-14: deployment
appgdep_6acfdeafdd348191a5add57e6a5962f9 succeeded. Landing and all four
week URLs loaded without console/page errors; 332 math and used fonts loaded.
Owner-signed-in save (then via a Your work field; now test/w00 only) was present in API/DB.
Worker error query returned two /favicon.ico 404s, with no Worker exceptions.
