# Comments Worker

A Cloudflare Worker that receives comments from the blog posts and turns each one into a pull request
on this repository. Merging the pull request publishes the comment; closing it rejects it.

How the pieces fit:

- `assets/js/comments.js` (on the site) lists `comments/<post>/*.json` through the GitHub API, renders them,
  and shows the form. It posts new comments to this Worker.
- `worker.js` (on Cloudflare) checks the Turnstile spam challenge, checks that the post exists, then creates
  a branch, adds `comments/<post>/<id>.json` and opens a pull request.
- Approved comments are plain files in the repository. They stay readable even if the Worker is deleted.

## One-time setup

### 1. Turnstile (spam protection)

In the Cloudflare dashboard, open **Turnstile**, then **Add widget**.

- Hostnames: `pierremarion23.github.io` (add `localhost` too if you want to test locally).
- Widget mode: Managed.

Keep the **site key** (public) and the **secret key** (private).

### 2. GitHub token

On GitHub: **Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token**.

- Repository access: only `PierreMarion23/PierreMarion23.github.io`.
- Permissions: **Contents** read and write, **Pull requests** read and write. Nothing else.
- Expiration: when the token expires, posting fails with "could not save the comment" until you create a new
  token and replace the `GITHUB_TOKEN` secret (step 3). Put a reminder in your calendar.

### 3. Deploy the Worker

From the dashboard, no installation needed:

1. **Workers & Pages, Create, Create Worker**. Name it `site-comments` and deploy the placeholder.
2. **Edit code**: replace the content with `worker.js` and deploy.
3. **Settings, Variables and Secrets**. Add the plain-text variables from `wrangler.toml`
   (`GITHUB_REPO`, `GITHUB_BRANCH`, `SITE_URL`, `ALLOWED_ORIGINS`), then two variables of type **Secret**:
   `GITHUB_TOKEN` (step 2) and `TURNSTILE_SECRET` (step 1).

Or with the command line, if Node.js is installed: in this folder, run `npx wrangler deploy`, then
`npx wrangler secret put GITHUB_TOKEN` and `npx wrangler secret put TURNSTILE_SECRET`.

The Worker's URL looks like `https://site-comments.<your-subdomain>.workers.dev`.

### 4. Connect the site

In `assets/js/comments.js`, set `workerUrl` to the Worker's URL and `turnstileSiteKey` to the site key.
The comment form appears once `workerUrl` is set.

### 5. Recommended repository setting

On GitHub, **Settings, General, Pull Requests**: tick **Automatically delete head branches**, so that each
merged comment's branch is cleaned up.

## Day to day

- **New post**: copy `thoughts/_template.html` and add a line to `POSTS` in `assets/js/posts.js`,
  which feeds the Blog page and the latest posts on the home page.
  Comments work automatically on any page containing `<div id="comments"></div>`.
- **Moderating**: each comment arrives as a pull request (GitHub notifies you). The text is in "Files changed".
  Merge to publish, close to reject. The comment shows up immediately after merging, since the page reads the
  repository directly.
- **Removing a published comment**: delete its file in `comments/`. It remains in the git history.
- **Adding a menu entry**: edit `MENU` in `assets/js/site.js`.

## Limits

- Comments are plain text: no formatting, no math rendering, no notifications to commenters.
- Threading has one level. A reply stores the `id` of the top-level comment in a `parent` field. A reply to a
  reply is attached to the same top-level comment, and stores the name of the person it answers in `replyTo`,
  shown as "in reply to ...". If you delete a comment that has replies, the replies are shown as top-level
  comments.
- You can only reply to approved comments, since pending ones are not shown.
- Each visitor's browser makes one unauthenticated GitHub API call per post view. GitHub allows 60 per hour per
  IP address, far above normal reading.
- Cloudflare's free plan allows 100,000 Worker requests per day.
