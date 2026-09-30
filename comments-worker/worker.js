/*
	Cloudflare Worker receiving comments from the website.

	For each valid comment it creates a branch, adds comments/<post>/<id>.json on it,
	and opens a pull request. Merging the pull request publishes the comment.
	A reply carries the id of the comment it answers. A reply to a reply is attached to the
	top-level comment of the thread, so threads have one level, and records in "replyTo" the
	name of the person it answers.

	Secrets (wrangler secret put ...): GITHUB_TOKEN, TURNSTILE_SECRET.
	Variables (wrangler.toml): GITHUB_REPO, GITHUB_BRANCH, SITE_URL, ALLOWED_ORIGINS.
*/

const SLUG = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/;
const ID = /^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z-[0-9a-f]{8}$/;

export default {
	async fetch(request, env) {
		const origin = request.headers.get('Origin') || '';
		const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
		const cors = {
			'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
			'Vary': 'Origin',
		};
		const reply = (status, body) =>
			new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

		if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
		if (request.method !== 'POST') return reply(405, { error: 'method not allowed' });
		if (!allowed.includes(origin)) return reply(403, { error: 'origin not allowed' });

		let input;
		try {
			input = await request.json();
		} catch {
			return reply(400, { error: 'invalid request' });
		}

		const slug = String(input.slug || '');
		const name = String(input.name || '').trim();
		const body = String(input.body || '').trim();
		let parent = String(input.parent || '');

		// Honeypot: humans never see this field. Pretend success so bots learn nothing.
		if (input.website) return reply(200, { ok: true });

		if (!SLUG.test(slug) || slug.length > 100) return reply(400, { error: 'invalid post' });
		if (!name || name.length > 80) return reply(400, { error: 'name must be 1 to 80 characters' });
		if (!body || body.length > 5000) return reply(400, { error: 'comment must be 1 to 5000 characters' });
		if (parent && !ID.test(parent)) return reply(400, { error: 'invalid parent comment' });

		// Spam check.
		const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			body: new URLSearchParams({
				secret: env.TURNSTILE_SECRET,
				response: String(input.token || ''),
				remoteip: request.headers.get('CF-Connecting-IP') || '',
			}),
		}).then((r) => r.json());
		if (!check.success) return reply(403, { error: 'spam check failed, please try again' });

		// The post must exist on the site, so comments cannot be attached to arbitrary paths.
		const page = await fetch(`${env.SITE_URL}/${slug}.html`, { method: 'HEAD' });
		if (!page.ok) return reply(400, { error: 'unknown post' });

		const date = new Date().toISOString();
		const id = date.replace(/[:.]/g, '-') + '-' + crypto.randomUUID().slice(0, 8);
		const branch = `comment-${id}`;
		const path = `comments/${slug}/${id}.json`;

		try {
			// The parent must be a published comment of the same post.
			let inReplyTo = '', replyTo = '';
			if (parent) {
				const replied = await readComment(env, slug, parent);
				if (!replied) return reply(400, { error: 'unknown parent comment' });
				if (replied.parent) {
					parent = replied.parent;
					replyTo = String(replied.name);
				}
				inReplyTo = `\n\nIn reply to ${String(replied.name).replace(/@/g, '')}.`;
			}

			const file = JSON.stringify({ id, ...(parent && { parent }), ...(replyTo && { replyTo }), name, date, body }, null, 2) + '\n';

			const base = await github(env, 'GET', `/git/ref/heads/${env.GITHUB_BRANCH}`);
			await github(env, 'POST', '/git/refs', { ref: `refs/heads/${branch}`, sha: base.object.sha });
			await github(env, 'PUT', `/contents/${path}`, {
				message: `Comment on ${slug}`,
				content: base64(file),
				branch,
			});
			await github(env, 'POST', '/pulls', {
				// "@" removed so a name cannot mention GitHub users.
				title: `${parent ? 'Reply' : 'Comment'} by ${name.replace(/@/g, '')} on ${slug}`,
				head: branch,
				base: env.GITHUB_BRANCH,
				body: `New comment on ${env.SITE_URL}/${slug}.html${inReplyTo}\n\nMerge to publish, close to reject. The text is in the "Files changed" tab.`,
			});
		} catch (error) {
			console.error(error);
			return reply(502, { error: 'could not save the comment' });
		}

		return reply(200, { ok: true });
	},
};

async function github(env, method, endpoint, body) {
	const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}${endpoint}`, {
		method,
		headers: {
			'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
			'Accept': 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'User-Agent': 'site-comments-worker',
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!response.ok) {
		const error = new Error(`GitHub ${method} ${endpoint}: ${response.status} ${await response.text()}`);
		error.status = response.status;
		throw error;
	}
	return response.json();
}

// A published comment of the post, or null if there is none with this id.
async function readComment(env, slug, id) {
	try {
		const data = await github(env, 'GET', `/contents/comments/${slug}/${id}.json?ref=${env.GITHUB_BRANCH}`);
		const bytes = Uint8Array.from(atob(data.content.replace(/\n/g, '')), (c) => c.charCodeAt(0));
		return JSON.parse(new TextDecoder().decode(bytes));
	} catch (error) {
		if (error.status === 404) return null;
		throw error;
	}
}

function base64(text) {
	let binary = '';
	for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
	return btoa(binary);
}
