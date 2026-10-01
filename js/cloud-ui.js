(() => {
  const accountModal = document.getElementById('accountModal');
  const cloudModal = document.getElementById('cloudModal');
  const saveOptionsModal = document.getElementById('saveOptionsModal');
  const accountStatus = document.getElementById('accountStatus');
  const cloudStatus = document.getElementById('cloudStatus');
  const cloudBuildList = document.getElementById('cloudBuildList');
  const publishToggle = document.getElementById('cloudPublishToggle');
  const logoutButton = document.getElementById('btnDiscordLogout');
  const profileAvatar = document.getElementById('discordProfileAvatar');
  const profileIcon = document.getElementById('discordProfileIcon');
  let signedInUser = null;
  let accountLoadError = '';
  let cloudBuildId = null;

  async function apiRequest(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(`The server returned an unreadable response (${response.status}).`);
    }
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    return result;
  }

  function setStatus(element, message) {
    element.textContent = message || '';
  }

  function showModal(modal) {
    modal.hidden = false;
  }

  function hideModal(modal) {
    modal.hidden = true;
  }

  async function refreshAccount() {
    try {
      const result = await apiRequest('/api/auth/me');
      accountLoadError = '';
      signedInUser = result.authenticated ? result.user : null;
      if (signedInUser) {
        const name = signedInUser.displayName || signedInUser.username;
        setStatus(accountStatus, `Connected as ${name}. Your private cloud builds are linked to this Discord account.`);
        document.getElementById('btnDiscordLogin').hidden = true;
        logoutButton.hidden = false;
        document.getElementById('btnAccount').setAttribute('aria-label', `Discord account: ${name}`);
        if (signedInUser.avatarUrl) {
          profileAvatar.src = signedInUser.avatarUrl;
          profileAvatar.hidden = false;
          profileIcon.setAttribute('hidden', '');
          profileAvatar.onerror = () => {
            profileAvatar.hidden = true;
            profileIcon.removeAttribute('hidden');
          };
        } else {
          profileAvatar.hidden = true;
          profileIcon.removeAttribute('hidden');
        }
      } else {
        setStatus(accountStatus, 'Not connected. Sign in with Discord to save builds between devices.');
        document.getElementById('btnDiscordLogin').hidden = false;
        logoutButton.hidden = true;
        document.getElementById('btnAccount').setAttribute('aria-label', 'Connect Discord account');
        profileAvatar.hidden = true;
        profileIcon.removeAttribute('hidden');
      }
      return signedInUser;
    } catch (error) {
      accountLoadError = error.message;
      signedInUser = null;
      setStatus(accountStatus, error.message);
      document.getElementById('btnDiscordLogin').hidden = false;
      logoutButton.hidden = true;
      document.getElementById('btnAccount').setAttribute('aria-label', 'Connect Discord account');
      profileAvatar.hidden = true;
      profileIcon.removeAttribute('hidden');
      return null;
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
  }

  function makeButton(label, action, danger = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = danger ? 'btn danger' : 'btn';
    button.textContent = label;
    button.addEventListener('click', action);
    return button;
  }

  function appendBuildCard(container, build, options) {
    const card = document.createElement('article');
    card.className = 'cloud-build-card';
    const person = document.createElement('div');
    person.className = 'cloud-build-person';
    if (options.avatarUrl) {
      const avatar = document.createElement('img');
      avatar.className = 'cloud-build-avatar';
      avatar.src = options.avatarUrl;
      avatar.alt = '';
      avatar.loading = 'lazy';
      avatar.onerror = () => {
        const fallback = document.createElement('div');
        fallback.className = 'cloud-build-avatar-fallback';
        fallback.textContent = String(options.author || '?').slice(0, 1).toUpperCase();
        avatar.replaceWith(fallback);
      };
      person.appendChild(avatar);
    } else {
      const fallback = document.createElement('div');
      fallback.className = 'cloud-build-avatar-fallback';
      fallback.textContent = String(options.author || '?').slice(0, 1).toUpperCase();
      person.appendChild(fallback);
    }
    const info = document.createElement('div');
    info.className = 'cloud-build-info';
    const name = document.createElement('div');
    name.className = 'cloud-build-name';
    name.textContent = build.name || 'Untitled build';
    const meta = document.createElement('div');
    meta.className = 'cloud-build-meta';
    const details = [];
    if (options.author) details.push(options.author);
    if (options.isPublic) details.push('Public');
    const updated = formatDate(build.updated_at);
    if (updated) details.push(`Updated ${updated}`);
    meta.textContent = details.join(' · ');
    info.append(name, meta);
    person.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'cloud-build-actions';
    actions.appendChild(makeButton('Load', () => {
      try {
        window.veilBuilder.applyBuildData(build.data);
        cloudBuildId = build.id;
        publishToggle.checked = Boolean(build.is_public);
        setStatus(cloudStatus, `${build.name || 'Build'} loaded.`);
        hideModal(cloudModal);
      } catch (error) {
        setStatus(cloudStatus, `Could not load this build: ${error.message}`);
      }
    }));

    if (options.deletable) {
      actions.appendChild(makeButton('Delete', async () => {
        if (!window.confirm(`Delete "${build.name}" from your cloud saves?`)) return;
        try {
          await apiRequest(`/api/builds/${encodeURIComponent(build.id)}`, { method: 'DELETE' });
          if (cloudBuildId === build.id) cloudBuildId = null;
          await refreshCloudBuilds();
        } catch (error) {
          setStatus(cloudStatus, error.message);
        }
      }, true));
    }
    card.append(person, actions);
    container.appendChild(card);
  }

  async function refreshCloudBuilds() {
    cloudBuildList.replaceChildren();
    if (!(await refreshAccount())) {
      setStatus(cloudStatus, accountLoadError || 'Connect Discord to save and manage your cloud builds.');
      return;
    }
    setStatus(cloudStatus, 'Loading your builds...');
    try {
      const result = await apiRequest('/api/builds');
      if (result.builds.length === 0) {
        setStatus(cloudStatus, 'No cloud builds yet. Save your current build to get started.');
        return;
      }
      setStatus(cloudStatus, `${result.builds.length} saved build${result.builds.length === 1 ? '' : 's'}.`);
      result.builds.forEach(build => appendBuildCard(cloudBuildList, build, {
        isPublic: build.is_public,
        author: build.author,
        avatarUrl: build.avatar_url,
        deletable: true,
      }));
    } catch (error) {
      setStatus(cloudStatus, error.message);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnAccount').addEventListener('click', async () => {
      showModal(accountModal);
      await refreshAccount();
    });

    document.getElementById('btnDiscordLogin').addEventListener('click', () => {
      window.location.assign('/api/auth/discord/start');
    });

    logoutButton.addEventListener('click', async () => {
      try {
        await apiRequest('/api/auth/logout', { method: 'POST' });
        signedInUser = null;
        cloudBuildId = null;
        await refreshAccount();
        setStatus(accountStatus, 'You have signed out.');
      } catch (error) {
        setStatus(accountStatus, error.message);
      }
    });

    document.getElementById('btnAccountCloudBuilds').addEventListener('click', async () => {
      hideModal(accountModal);
      showModal(cloudModal);
      await refreshCloudBuilds();
    });

    document.getElementById('btnCloudBuilds').addEventListener('click', async () => {
      showModal(cloudModal);
      await refreshCloudBuilds();
    });

    window.addEventListener('veil-save-requested', () => {
      showModal(saveOptionsModal);
    });

    document.getElementById('btnSaveLocal').addEventListener('click', () => {
      window.veilBuilder.exportBuild();
      hideModal(saveOptionsModal);
    });

    document.getElementById('btnSaveToCloud').addEventListener('click', async () => {
      hideModal(saveOptionsModal);
      if (!(await refreshAccount())) {
        showModal(accountModal);
        setStatus(accountStatus, accountLoadError || 'Connect Discord before saving a cloud build.');
        return;
      }
      showModal(cloudModal);
      await refreshCloudBuilds();
    });

    document.getElementById('btnSaveCloudBuild').addEventListener('click', async () => {
      if (!(await refreshAccount())) {
        setStatus(cloudStatus, accountLoadError || 'Connect Discord before saving a cloud build.');
        return;
      }
      const data = window.veilBuilder.getBuildData();
      const name = String(data.name || '').trim();
      if (!name) {
        setStatus(cloudStatus, 'Give this build a name before saving it to the cloud.');
        document.getElementById('buildNameInput').focus();
        return;
      }
      const payload = JSON.stringify({
        name,
        isPublic: publishToggle.checked,
        data,
      });
      try {
        const path = cloudBuildId
          ? `/api/builds/${encodeURIComponent(cloudBuildId)}`
          : '/api/builds';
        const result = await apiRequest(path, {
          method: cloudBuildId ? 'PUT' : 'POST',
          body: payload,
        });
        cloudBuildId = result.build.id;
        await refreshCloudBuilds();
        setStatus(cloudStatus, publishToggle.checked
          ? 'Build saved and published in the public gallery.'
          : 'Build saved privately to your cloud.');
      } catch (error) {
        setStatus(cloudStatus, error.message);
      }
    });

    document.querySelectorAll('[data-close-modal]').forEach(button => {
      button.addEventListener('click', () => hideModal(document.getElementById(button.dataset.closeModal)));
    });
    [accountModal, cloudModal, saveOptionsModal].forEach(modal => {
      modal.addEventListener('click', event => {
        if (event.target === modal) hideModal(modal);
      });
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        [accountModal, cloudModal, saveOptionsModal].forEach(modal => {
          if (!modal.hidden) hideModal(modal);
        });
      }
    });

    const authError = new URL(window.location.href).searchParams.get('authError');
    if (authError) {
      const messages = {
        state_mismatch: 'Discord sign-in could not be verified. Please try again.',
        discord_denied: 'Discord sign-in was cancelled.',
        auth_not_configured: 'Discord sign-in is not configured for this deployment.',
        auth_failed: 'Discord sign-in failed. Please try again.',
      };
      showModal(accountModal);
      setStatus(accountStatus, messages[authError] || 'Discord sign-in failed. Please try again.');
      const url = new URL(window.location.href);
      url.searchParams.delete('authError');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    refreshAccount();
  });
})();
