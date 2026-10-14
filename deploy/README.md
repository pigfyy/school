# Deploy the latest study site

Owner-private Site: https://cse-study.familyopenai10916.chatgpt.site
Project: appgprj_6acfcb7a2b648191b06326661ccd9b96

For the future Codex subagent told “deploy the latest site”:

1. Read the Sites skill. Reuse the project above; never create another Site.
2. Call sites_create_source_repository_write_credential for this project.
3. Create that checkout directory if absent. Open/refresh source with the installed site-workflow.mjs helper, running
   from /home/pigfy/.t3/projects/school/deploy/.sites-checkout.
   Use --project-id appgprj_6acfcb7a2b648191b06326661ccd9b96.
   Send {credential: <returned object>} as hidden stdin JSON; retain its result.
4. Build/package the latest static site with:

   node /home/pigfy/.t3/projects/school/deploy/deploy.mjs

   An optional argument selects another static directory. For placeholders:

   node /home/pigfy/.t3/projects/school/deploy/deploy.mjs /home/pigfy/.t3/projects/school/deploy/placeholder

5. Run the same helper again, with hidden stdin JSON containing credential,
   source (the complete opening result), commands: [], and archivePath:
   /home/pigfy/.t3/projects/school/.scratch/cse-study.tar.gz
   It commits/pushes the source and repackages the exact output.
6. Call sites_save_version_and_deploy_private with its project_id, commit_sha,
   and archive. Poll sites_get_deployment_status if not terminal.
   Check live pages, sites_read_database_overview, and Worker error logs.

Helper: /home/pigfy/.codex/plugins/cache/openai-curated-remote/sites/1.0.2-remix-a.1/scripts/site-workflow.mjs
Launch it with a TTY; send credential JSON only after its hidden-input prompt.
Never persist credentials or put them in command arguments.

worker.mjs serves static files and GET/PUT /api/state/<course>/<week>.
GET returns {data, updatedAt}; PUT accepts {data} and returns {updatedAt}.
Course: lowercase letters, digits, hyphens. Week: w plus exactly two digits.
Identity: oai-authenticated-user-id; missing identity returns 401.
Email: oai-authenticated-user-email. State is isolated per user/course/week.
PUT has a 1 MiB body cap. Updates replace the entire JSON value.
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
