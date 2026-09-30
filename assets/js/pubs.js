/*
	Publications on research.html: "By topic / By year" switch, and foldable groups.
	The page lists publications by topic in <div id="pubs">, each <li> with data-date="YYYY-MM".
	The by-year view is built from the same entries, so a new paper is added once, in its topic.
	Each topic or year becomes a foldable group, folded by default; "Expand all" opens them all.
	The sort choice is kept in the address (research.html#by-year), so it can be linked to.
	Without JavaScript, the page shows the plain by-topic list.
*/

(function() {

	var pubs = document.getElementById('pubs');
	if (!pubs) return;

	// By-year view: copies of the entries, newest first, under one heading per year.
		var items = [].slice.call(pubs.querySelectorAll('li[data-date]'));
		var sorted = items.slice().sort(function(a, b) {
			var x = a.getAttribute('data-date'), y = b.getAttribute('data-date');
			return x < y ? 1 : x > y ? -1 : items.indexOf(a) - items.indexOf(b);
		});

		var byYear = document.createElement('div'),
			list = null,
			year = null;

		sorted.forEach(function(item) {
			var y = item.getAttribute('data-date').slice(0, 4);
			if (y != year) {
				var heading = document.createElement('h3');
				heading.textContent = year = y;
				list = document.createElement('ul');
				list.className = 'pubs';
				byYear.appendChild(heading);
				byYear.appendChild(list);
			}
			list.appendChild(item.cloneNode(true));
		});

	// Views: the original by-topic content, and the by-year one.
		var byTopic = document.createElement('div');
		while (pubs.firstChild) byTopic.appendChild(pubs.firstChild);
		pubs.appendChild(byTopic);
		pubs.appendChild(byYear);

	// Foldable groups: each heading and its list go into a <details>, folded by default.
		function makeGroups(view) {
			[].slice.call(view.querySelectorAll('h3')).forEach(function(heading) {
				var entries = heading.nextElementSibling,
					group = document.createElement('details'),
					summary = document.createElement('summary'),
					count = document.createElement('span'),
					n = entries.children.length;

				group.className = 'pub-group';
				count.className = 'pub-group-count';
				count.textContent = n + (n == 1 ? ' paper' : ' papers');

				view.insertBefore(group, heading);
				summary.appendChild(heading);
				summary.appendChild(count);
				group.appendChild(summary);
				group.appendChild(entries);
				group.addEventListener('toggle', updateToggleAll);
			});
		}

		makeGroups(byTopic);
		makeGroups(byYear);

	// Controls: sort switch, and "Expand all / Collapse all" for the visible view.
		var nav = document.createElement('p');
		nav.className = 'pubs-switch';
		nav.innerHTML =
			'Sort: <button type="button" data-view="topic">By topic</button> <button type="button" data-view="year">By year</button>' +
			'<span class="pubs-switch-sep" aria-hidden="true">&middot;</span><button type="button" class="pubs-toggle-all">Expand all</button>';
		pubs.insertBefore(nav, byTopic);

		var buttons = [].slice.call(nav.querySelectorAll('button[data-view]')),
			toggleAll = nav.querySelector('.pubs-toggle-all'),
			current = null;

		function groups() {
			return [].slice.call((current == 'year' ? byYear : byTopic).querySelectorAll('details.pub-group'));
		}

		function updateToggleAll() {
			if (!toggleAll) return;
			var allOpen = groups().every(function(g) { return g.open; });
			toggleAll.textContent = allOpen ? 'Collapse all' : 'Expand all';
		}

		toggleAll.addEventListener('click', function() {
			var open = toggleAll.textContent == 'Expand all';
			groups().forEach(function(g) { g.open = open; });
			updateToggleAll();
		});

		function show(view) {
			current = view;
			byTopic.style.display = view == 'topic' ? '' : 'none';
			byYear.style.display = view == 'year' ? '' : 'none';
			buttons.forEach(function(button) {
				button.setAttribute('aria-pressed', button.getAttribute('data-view') == view ? 'true' : 'false');
			});
			updateToggleAll();
		}

		buttons.forEach(function(button) {
			button.addEventListener('click', function() {
				var view = button.getAttribute('data-view');
				show(view);
				try {
					history.replaceState(null, '', view == 'year' ? '#by-year' : location.pathname + location.search);
				} catch (error) {
					// Some browsers refuse this for pages opened from disk; the switch still works.
				}
			});
		});

		show(location.hash == '#by-year' ? 'year' : 'topic');

})();
