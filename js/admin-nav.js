(() => {
  const adminLinks = [...document.querySelectorAll('[data-admin-nav]')];
  if (!adminLinks.length || window.location.protocol === 'file:') return;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  fetch('/api/auth/me', {
    credentials: 'same-origin',
    signal: controller.signal,
  })
    .then(async response => {
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error(`The server returned an unreadable response (${response.status}).`);
      }
      if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
      return result;
    })
    .then(result => {
      if (result.authenticated && result.user && result.user.isAdmin === true) {
        adminLinks.forEach(link => { link.hidden = false; });
      }
    })
    .catch(error => {
      console.error('[admin-nav] Unable to check admin access:', error);
    })
    .finally(() => {
      window.clearTimeout(timeout);
    });
})();
