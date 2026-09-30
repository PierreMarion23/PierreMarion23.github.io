/*
	Comments for blog posts. Put <div id="comments"></div> where comments should appear,
	and load this script before main.js.

	Approved comments are files comments/<post>/<id>.json in the repository, listed through
	the GitHub API. New comments go to a Cloudflare Worker (see comments-worker/), which
	opens a pull request; merging it publishes the comment.

	Threading has one level: a comment with a "parent" field is shown under that comment.
	A reply to a reply joins the same thread, and its "replyTo" field names the person answered.
*/

(function() {

	var CONFIG = {
		repo: 'PierreMarion23/PierreMarion23.github.io',
		branch: 'master',
		workerUrl: 'https://site-comments.pierremarion314.workers.dev',        // e.g. 'https://site-comments.<your-subdomain>.workers.dev'; empty hides the form
		turnstileSiteKey: ''  // site key from the Cloudflare Turnstile dashboard
	};

	var container = document.getElementById('comments');
	if (!container) return;

	// Post identifier, e.g. "thoughts/2026-02-12", derived from the page path relative to the site root.
		var root = document.currentScript.src.replace(/assets\/js\/comments\.js(\?.*)?$/, '');
		var slug = container.getAttribute('data-slug') ||
			location.href.split(/[?#]/)[0].slice(root.length).replace(/\.html$/, '').replace(/\/$/, '');

	// Styles.
		var style = document.createElement('style');
		style.textContent =
			'#comments { margin-top: 4em; }' +
			'#comments .comment { border-left: solid 4px #c9c9c9; padding: 0.25em 0 0.25em 1.5em; margin-bottom: 2em; }' +
			'#comments .comment-replies { margin-top: 1.5em; }' +
			'#comments .comment-replies .comment { border-left-color: #e5e5e5; margin-bottom: 1.5em; }' +
			'#comments .comment-meta { margin-bottom: 0.5em; }' +
			'#comments .comment-reply { margin-left: 0.75em; font-size: 0.9em; }' +
			'#comments .comment-body { white-space: pre-line; }' +
			'#comments textarea { min-height: 8em; }' +
			'#comments .comment-hp { position: absolute; left: -9999px; }' +
			'#comments .cf-turnstile { margin-bottom: 1.5em; }';
		document.head.appendChild(style);

	// Skeleton.
		container.innerHTML = '<h2>Comments</h2><div class="comments-list"><p>Loading comments...</p></div>';
		var list = container.querySelector('.comments-list');

	// Form state, set below when the form is enabled.
		var form = null,
			startReply = null;

	// List of approved comments.
		function renderComment(c) {
			var article = document.createElement('article'),
				meta = document.createElement('p'),
				name = document.createElement('strong'),
				body = document.createElement('div');

			article.className = 'comment';
			meta.className = 'comment-meta';
			body.className = 'comment-body';

			// textContent only: comment text is never interpreted as HTML.
				name.textContent = c.name;
				meta.appendChild(name);
				meta.appendChild(document.createTextNode(', ' + String(c.date || '').slice(0, 10).replace(/-/g, '/')));
				if (c.replyTo)
					meta.appendChild(document.createTextNode(', in reply to ' + c.replyTo));
				body.textContent = c.body;

			// The Worker attaches a reply to a reply to the top-level comment of the thread.
				if (form && c.id) {
					var reply = document.createElement('a');
					reply.className = 'comment-reply';
					reply.href = '#';
					reply.textContent = 'Reply';
					reply.addEventListener('click', function(event) {
						event.preventDefault();
						startReply(c.id, c.name);
					});
					meta.appendChild(reply);
				}

			article.appendChild(meta);
			article.appendChild(body);
			return article;
		}

		function render(comments) {
			comments = comments.filter(function(c) { return c && c.name && c.body; });
			list.innerHTML = '';

			if (comments.length == 0) {
				list.innerHTML = '<p>No comments yet.</p>';
				return;
			}

			var byId = {};
			comments.forEach(function(c) { if (c.id) byId[c.id] = c; });

			// Top-level comment of a thread. A reply whose parent is missing (e.g. deleted) becomes top-level.
				function threadOf(c) {
					for (var depth = 0; c.parent && byId[c.parent] && depth < 50; depth++)
						c = byId[c.parent];
					return c;
				}

			var threads = [], replies = {};
			comments.forEach(function(c) {
				var t = threadOf(c);
				if (t === c) threads.push(c);
				else (replies[t.id] = replies[t.id] || []).push(c);
			});

			threads.forEach(function(t) {
				var article = renderComment(t);

				if (replies[t.id]) {
					var box = document.createElement('div');
					box.className = 'comment-replies';
					replies[t.id].forEach(function(r) { box.appendChild(renderComment(r)); });
					article.appendChild(box);
				}

				list.appendChild(article);
			});
		}

		function load() {
			fetch('https://api.github.com/repos/' + CONFIG.repo + '/contents/comments/' + slug + '?ref=' + CONFIG.branch)
				.then(function(response) {
					if (response.status == 404) return [];
					if (!response.ok) throw new Error(response.status);
					return response.json();
				})
				.then(function(files) {
					files = files
						.filter(function(f) { return f.type == 'file' && /\.json$/.test(f.name); })
						.sort(function(a, b) { return a.name < b.name ? -1 : 1; });

					return Promise.all(files.map(function(f) {
						return fetch(f.download_url)
							.then(function(response) { return response.json(); })
							.catch(function() { return null; });
					}));
				})
				.then(render)
				.catch(function() {
					list.innerHTML = '<p>Comments could not be loaded right now.</p>';
				});
		}

	// Form for new comments. The list is loaded after it exists, so that comments get a Reply link.
		if (!CONFIG.workerUrl) return load();

		form = document.createElement('form');
		form.innerHTML =
			'<h3>Leave a comment</h3>' +
			'<p class="comment-replying" style="display: none;">Replying to <strong></strong>. <a href="#">Cancel</a></p>' +
			'<div class="fields">' +
				'<div class="field half"><input type="text" name="name" placeholder="Name" maxlength="80" required /></div>' +
				'<div class="field"><textarea name="body" placeholder="Comment (plain text)" maxlength="5000" required></textarea></div>' +
			'</div>' +
			'<div class="comment-hp" aria-hidden="true"><input type="text" name="website" tabindex="-1" autocomplete="off" /></div>' +
			'<div class="cf-turnstile" data-sitekey="' + CONFIG.turnstileSiteKey + '"></div>' +
			'<ul class="actions"><li><input type="submit" value="Send" class="primary" /></li></ul>' +
			'<p class="comment-status">Comments are moderated and appear once approved. They are stored publicly in the website\'s GitHub repository.</p>';
		container.appendChild(form);

		var script = document.createElement('script');
		script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
		script.async = true;
		document.head.appendChild(script);

		var title = form.querySelector('h3'),
			replying = form.querySelector('.comment-replying'),
			status = form.querySelector('.comment-status'),
			button = form.querySelector('input[type="submit"]'),
			parent = '';

		// The form stays at the bottom: moving it would reload the Turnstile iframe.
			startReply = function(id, name) {
				parent = id;
				title.textContent = 'Reply';
				replying.querySelector('strong').textContent = name;
				replying.style.display = '';
				form.scrollIntoView({ behavior: 'smooth', block: 'start' });
				form.querySelector('textarea').focus({ preventScroll: true });
			};

			function cancelReply() {
				parent = '';
				title.textContent = 'Leave a comment';
				replying.style.display = 'none';
			}

			replying.querySelector('a').addEventListener('click', function(event) {
				event.preventDefault();
				cancelReply();
			});

		form.addEventListener('submit', function(event) {
			event.preventDefault();

			var data = new FormData(form);
			var payload = {
				slug: slug,
				parent: parent,
				name: String(data.get('name') || '').trim(),
				body: String(data.get('body') || '').trim(),
				website: data.get('website') || '',
				token: data.get('cf-turnstile-response') || ''
			};

			button.disabled = true;
			status.textContent = 'Sending...';

			fetch(CONFIG.workerUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			})
				.then(function(response) {
					return response.json().catch(function() { return {}; }).then(function(result) {
						if (!response.ok) throw new Error(result.error || 'error ' + response.status);
					});
				})
				.then(function() {
					form.reset();
					cancelReply();
					status.textContent = 'Thank you! Your comment will appear once it has been approved.';
				})
				.catch(function(error) {
					status.textContent = 'Sorry, the comment could not be sent (' + error.message + ').';
				})
				.then(function() {
					button.disabled = false;
					if (window.turnstile) window.turnstile.reset();
				});
		});

		load();

})();
