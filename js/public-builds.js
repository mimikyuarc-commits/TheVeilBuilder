(() => {
  const status = document.getElementById('publicBuildsStatus');
  const list = document.getElementById('publicBuildList');

  async function loadPublicBuilds() {
    list.replaceChildren();
    status.textContent = 'Loading public builds...';
    try {
      const response = await fetch('/api/public-builds', { credentials: 'same-origin' });
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error(`The public gallery returned an unreadable response (${response.status}).`);
      }
      if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
      if (!Array.isArray(result.builds) || result.builds.length === 0) {
        status.textContent = 'No public builds have been shared yet.';
        return;
      }

      status.textContent = `${result.builds.length} community build${result.builds.length === 1 ? '' : 's'}.`;
      result.builds.forEach(build => {
        const card = document.createElement('article');
        card.className = 'public-build-card';

        const authorRow = document.createElement('div');
        authorRow.className = 'public-build-author';
        const avatarFallback = document.createElement('div');
        avatarFallback.className = 'cloud-build-avatar-fallback';
        avatarFallback.textContent = String(build.author || '?').slice(0, 1).toUpperCase();
        if (build.avatar_url) {
          const avatar = document.createElement('img');
          avatar.className = 'public-build-avatar';
          avatar.src = build.avatar_url;
          avatar.alt = '';
          avatar.loading = 'lazy';
          avatar.onerror = () => avatar.replaceWith(avatarFallback);
          authorRow.appendChild(avatar);
        } else {
          authorRow.appendChild(avatarFallback);
        }

        const authorName = document.createElement('span');
        authorName.className = 'public-build-author-name';
        authorName.textContent = build.author || 'Discord user';
        authorRow.appendChild(authorName);

        const title = document.createElement('h2');
        title.className = 'cloud-build-name';
        title.textContent = build.name || 'Untitled build';

        const updated = document.createElement('p');
        updated.className = 'cloud-build-meta';
        const date = new Date(build.updated_at);
        updated.textContent = Number.isNaN(date.getTime()) ? '' : `Updated ${date.toLocaleString()}`;

        const loadButton = document.createElement('button');
        loadButton.type = 'button';
        loadButton.className = 'btn cloud-primary public-build-load';
        loadButton.textContent = 'Load in builder';
        loadButton.addEventListener('click', () => {
          try {
            sessionStorage.setItem('veilBuilderPendingPublicBuild', JSON.stringify(build.data));
            window.location.assign('index.html?loadPublicBuild=1');
          } catch (error) {
            status.textContent = `Could not prepare this build: ${error.message}`;
          }
        });

        card.append(authorRow, title, updated, loadButton);
        list.appendChild(card);
      });
    } catch (error) {
      status.textContent = error.message;
    }
  }

  document.getElementById('btnRefreshPublicBuilds').addEventListener('click', loadPublicBuilds);
  loadPublicBuilds();
})();
