(() => {
  const overrideMap = new Map();

  function contentKey(type, collection, id) {
    return `${type}:${collection}:${id}`;
  }

  function reportLoadError(error) {
    console.error('[site-content] Unable to load shared site content:', error);
    const notice = document.createElement('div');
    notice.className = 'site-content-error';
    notice.setAttribute('role', 'status');
    notice.textContent = 'Shared content could not be loaded. Showing the bundled data instead.';
    document.body.prepend(notice);
  }

  window.siteContentReady = (async () => {
    if (window.location.protocol === 'file:') return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/api/content?type=builder', {
        credentials: 'same-origin',
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
      if (!result || !Array.isArray(result.overrides)) {
        throw new Error('The shared-content response is invalid.');
      }
      result.overrides.forEach(item => {
        overrideMap.set(contentKey(item.type, item.collection, item.id), item);
      });
    } catch (error) {
      reportLoadError(error.name === 'AbortError'
        ? new Error('Loading shared content timed out.')
        : error);
    } finally {
      window.clearTimeout(timeout);
    }
  })();

  function applyOverrides(type, collection, records) {
    const result = new Map(records.map(record => [String(record.id), record]));
    overrideMap.forEach((override, key) => {
      if (!key.startsWith(`${type}:${collection}:`)) return;
      const id = String(override.id);
      if (override.deleted) result.delete(id);
      else result.set(id, override.record);
    });
    return [...result.values()];
  }

  window.siteContentApplyBuilder = database => {
    Object.keys(database).forEach(collection => {
      database[collection] = applyOverrides('builder', collection, database[collection]);
    });
  };

})();
