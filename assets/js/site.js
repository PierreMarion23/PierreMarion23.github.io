/*
	Shared page elements, inserted on every page: header with the site name and navigation, footer,
	"Back to blog" link on posts, and math rendering (KaTeX) on pages that contain formulas.
	Styled by assets/css/custom.css.
	To add a menu entry, edit MENU below (paths are relative to the site root).
*/

(function() {

	var MENU = [
		['index.html', 'Home'],
		['research.html', 'Research'],
		['blog.html', 'Blog'],
		['teaching.html', 'Teaching and Service'],
		['bio.html', 'Bio'],
		['misc.html', 'Miscellaneous']
	];

	// Site root, derived from this script's own URL so that pages in subfolders work.
		var root = document.currentScript.src.replace(/assets\/js\/site\.js(\?.*)?$/, '');

	// Current section: the page itself, or Blog for posts.
		var page = location.href.split(/[?#]/)[0];
		if (page == root) page = root + 'index.html';
		if (page.indexOf(root + 'thoughts/') == 0) page = root + 'blog.html';

	var items = MENU.map(function(entry) {
		var href = root + entry[0];
		return '<li><a href="' + href + '"' + (href == page ? ' aria-current="page"' : '') + '>' + entry[1] + '</a></li>';
	}).join('');

	var html =
		'<header class="site-header"><div class="site-header-inner">' +
			'<a class="site-name" href="' + root + 'index.html">Pierre Marion</a>' +
			'<nav class="site-nav" aria-label="Main"><ul>' + items + '</ul></nav>' +
		'</div></header>';

	var wrapper = document.getElementById('wrapper');
	wrapper.insertAdjacentHTML('afterbegin', html);

	// Blog posts: a link back to the list, before the comments if there are any.
		if (location.href.indexOf(root + 'thoughts/') == 0) {
			var inner = document.querySelector('#main .inner'),
				back = document.createElement('p');

			document.body.classList.add('is-post');
			back.className = 'post-back';
			back.innerHTML = '<a href="' + root + 'blog.html">Back to blog</a>';
			inner.insertBefore(back, document.getElementById('comments'));
		}

	// Footer. The date is the page's last modification, as sent by the server.
		var updated = new Date(document.lastModified).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
		wrapper.insertAdjacentHTML('beforeend',
			'<footer class="site-footer"><div class="site-footer-inner">' +
				'&copy; Pierre Marion &middot; Last updated ' + updated +
				' &middot; Design based on <a href="https://html5up.net">HTML5 UP</a>' +
			'</div></footer>');

	// Math: KaTeX is loaded only on pages containing \( ... \), \[ ... \] or $$ ... $$.
		var main = document.getElementById('main');
		if (/\\\(|\\\[|\$\$/.test(main.textContent)) {
			var KATEX = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/';

			var css = document.createElement('link');
			css.rel = 'stylesheet';
			css.href = KATEX + 'katex.min.css';
			css.integrity = 'sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5+';
			css.crossOrigin = 'anonymous';
			document.head.appendChild(css);

			var load = function(file, integrity, then) {
				var script = document.createElement('script');
				script.src = KATEX + file;
				script.integrity = integrity;
				script.crossOrigin = 'anonymous';
				script.onload = then;
				document.head.appendChild(script);
			};

			load('katex.min.js', 'sha384-7zkQWkzuo3B5mTepMUcHkMB5jZaolc2xDwL6VFqjFALcbeS9Ggm/Yr2r3Dy4lfFg', function() {
				load('contrib/auto-render.min.js', 'sha384-43gviWU0YVjaDtb/GhzOouOXtZMP/7XUzwPTstBeZFe/+rCMvRwr4yROQP43s0Xk', function() {
					window.renderMathInElement(main, {
						delimiters: [
							{ left: '$$', right: '$$', display: true },
							{ left: '\\[', right: '\\]', display: true },
							{ left: '\\(', right: '\\)', display: false }
						],
						throwOnError: false
					});
				});
			});
		}

})();
