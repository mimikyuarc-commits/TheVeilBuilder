(() => {
  const builderCollections = [
    ['races', 'Races'], ['masteries', 'Masteries'], ['classes', 'Classes'],
    ['abilities', 'Abilities'], ['auras', 'Auras'], ['dashes', 'Dashes'],
    ['racePassives', 'Race passives'], ['accessories', 'Accessories'], ['outfits', 'Outfits'],
    ['weapons', 'Weapons'], ['gems', 'Gems'], ['accessoryOutfitEnchants', 'Accessory / outfit tomes'],
    ['weaponEnchants', 'Weapon tomes'],
  ];
  const gate = document.getElementById('adminGate');
  const gateMessage = document.getElementById('adminGateMessage');
  const loginLink = document.getElementById('adminLogin');
  const app = document.getElementById('adminApp');
  const typeSelect = document.getElementById('adminType');
  const collectionLabel = document.getElementById('adminCollectionLabel');
  const collectionSelect = document.getElementById('adminCollection');
  const searchInput = document.getElementById('adminSearch');
  const entryList = document.getElementById('adminEntries');
  const entryCount = document.getElementById('adminEntryCount');
  const status = document.getElementById('adminStatus');
  const form = document.getElementById('adminForm');
  const buildForm = document.getElementById('adminBuildForm');
  const buildNameInput = document.getElementById('adminBuildName');
  const buildPublicInput = document.getElementById('adminBuildPublic');
  const buildDataEditor = document.getElementById('adminBuildDataEditor');
  const empty = document.getElementById('adminEmpty');
  const fieldsElement = document.getElementById('adminFields');
  const imagePreview = document.getElementById('adminImagePreview');
  const imageUpload = document.getElementById('adminImageUpload');
  const addFieldName = document.getElementById('adminNewFieldName');
  const addFieldValue = document.getElementById('adminNewFieldValue');
  let entries = [];
  let selectedId = '';
  let accessCheckPending = false;
  let newEntry = false;
  let selectedBuild = null;
  let buildEditorData = null;
  let nextBuildCursor = null;

  const buildPickers = {
    raceId: ['races', 'Race'],
    masteryId: ['masteries', 'Mastery'],
    classId: ['classes', 'Class'],
    abilityId: ['abilities', 'Ability'],
    auraId: ['auras', 'Aura'],
    dashId: ['dashes', 'Dash'],
    outfitId: ['outfits', 'Outfit'],
    gemId: ['gems', 'Gem'],
  };
  const buildStatOptions = [
    ['health', 'Health'], ['sanity', 'Sanity'], ['stamina', 'Stamina'],
    ['universalDamage', 'Universal damage'], ['damage', 'Damage'], ['pveDamage', 'PvE damage'],
    ['castDamage', 'Cast damage'], ['castCooldown', 'Cast cooldown'],
    ['summonDamage', 'Summon damage'], ['summonLife', 'Summon life'],
    ['extraSummons', 'Extra summons'], ['resistance', 'Resistance'],
    ['stunResistance', 'Stun resistance'], ['blindResistance', 'Blind resistance'],
    ['fireResistance', 'Fire resistance'], ['attackSpeed', 'Attack speed'],
    ['critical', 'Critical boost'], ['speed', 'Speed'], ['jump', 'Jump'],
    ['knockback', 'Knockback'], ['regeneration', 'Regeneration'],
    ['staminaRegen', 'Stamina regen'], ['staminaCostReduction', 'Stamina cost reduction'],
    ['insanity', 'Insanity'], ['luck', 'Luck'], ['slowness', 'Slowness'], ['healing', 'Healing'],
  ];

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  async function apiRequest(path, options = {}) {
    const { timeoutMs = 12000, ...requestOptions } = options;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(path, {
        credentials: 'same-origin',
        ...requestOptions,
        signal: controller.signal,
        headers: {
          ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}),
          ...(requestOptions.headers || {}),
        },
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('The server did not respond in time. Please try again.');
      }
      throw new Error(`Unable to contact the server: ${error.message}`);
    } finally {
      window.clearTimeout(timeout);
    }
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(`The server returned an unreadable response (${response.status}).`);
    }
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    return result;
  }

  function activeCollections() {
    return builderCollections;
  }

  function populateCollections() {
    const isBuilds = typeSelect.value === 'builds';
    collectionLabel.hidden = isBuilds;
    document.getElementById('adminAdd').hidden = isBuilds;
    document.getElementById('adminRefreshBuilds').hidden = !isBuilds;
    document.getElementById('adminLoadMoreBuilds').hidden = true;
    collectionSelect.replaceChildren(...activeCollections().map(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      return option;
    }));
    if (isBuilds) collectionSelect.replaceChildren();
    loadEntries();
  }

  function loadEntries() {
    if (typeSelect.value === 'builds') {
      selectedBuild = null;
      form.hidden = true;
      buildForm.hidden = true;
      empty.hidden = false;
      loadAdminBuilds();
      return;
    }
    const collection = collectionSelect.value;
    selectedBuild = null;
    buildForm.hidden = true;
    entries = database[collection].map(record => structuredClone(record));
    entries.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    if (selectedId && !entries.some(record => record.id === selectedId)) {
      selectedId = '';
      form.hidden = true;
      empty.hidden = false;
    }
    renderEntries();
  }

  function renderEntries() {
    const query = searchInput.value.trim().toLowerCase();
    const matches = entries.filter(record => !query
      || `${record.name || ''} ${record.description || record.descriptionTemplate || ''} ${record.ownerName || ''} ${record.ownerId || ''}`.toLowerCase().includes(query));
    entryCount.textContent = `(${matches.length})`;
    entryList.replaceChildren();
    matches.forEach(record => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `admin-entry-button${record.id === selectedId ? ' is-active' : ''}`;
      button.textContent = typeSelect.value === 'builds'
        ? `${record.name || 'Untitled build'} — ${record.ownerName || record.ownerId}`
        : record.name || 'Unnamed entry';
      button.addEventListener('click', () => selectEntry(record.id));
      entryList.appendChild(button);
    });
    if (!matches.length) {
      const message = document.createElement('p');
      message.className = 'admin-empty';
      message.textContent = 'No matching entries.';
      entryList.appendChild(message);
    }

  }

  async function loadAdminBuilds(append = false) {
    setStatus(append ? 'Loading more cloud builds...' : 'Loading cloud builds...');
    try {
      const cursor = append && nextBuildCursor
        ? `?cursor=${encodeURIComponent(nextBuildCursor)}`
        : '';
      const result = await apiRequest(`/api/admin/builds${cursor}`);
      entries = append ? entries.concat(result.builds) : result.builds;
      nextBuildCursor = result.nextCursor;
      document.getElementById('adminLoadMoreBuilds').hidden = !nextBuildCursor;
      entries.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
      if (selectedId) {
        selectedBuild = entries.find(build => build.id === selectedId) || null;
        if (!selectedBuild) {
          selectedId = '';
          buildForm.hidden = true;
          empty.hidden = false;
        }
      }
      renderEntries();
      setStatus(`${entries.length} cloud build${entries.length === 1 ? '' : 's'} loaded.`);
      return true;
    } catch (error) {
      if (!append) entries = [];
      renderEntries();
      setStatus(error.message, true);
      return false;
    }
  }

  function addField(record, name, initialValue = '') {
    const wide = name === 'description' || Array.isArray(initialValue) || (initialValue && typeof initialValue === 'object');
    const field = document.createElement('div');
    field.className = `admin-field${wide ? ' admin-field-wide' : ''}`;
    const label = document.createElement('label');
    label.textContent = name;

    if (typeof initialValue === 'boolean') {
      field.classList.add('admin-field-checkbox');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = initialValue;
      checkbox.dataset.field = name;
      checkbox.dataset.kind = 'boolean';
      checkbox.id = getFieldControlId(name);
      label.htmlFor = checkbox.id;
      field.append(label, checkbox);
      return field;
    }

    const enumOptions = getEnumOptions(name, initialValue);
    if (enumOptions) {
      const select = document.createElement('select');
      select.dataset.field = name;
      select.dataset.kind = initialValue === null ? 'enum-nullable' : 'enum';
      select.id = getFieldControlId(name);
      label.htmlFor = select.id;
      enumOptions.forEach(([value, text]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        select.appendChild(option);
      });
      select.value = initialValue === null ? '' : String(initialValue);
      field.append(label, select);
      return field;
    }

    if (name === 'passiveIds' && Array.isArray(initialValue)) {
      const picker = document.createElement('div');
      picker.className = 'admin-reference-picker';
      picker.dataset.field = name;
      picker.dataset.kind = 'reference-list';
      database.racePassives.forEach(passive => {
        picker.appendChild(createReferenceCheckbox(passive.id, passive.name, initialValue.includes(passive.id)));
      });
      initialValue.filter(id => !database.racePassives.some(passive => passive.id === id)).forEach(id => {
        picker.appendChild(createReferenceCheckbox(id, `Unavailable: ${id}`, true));
      });
      const help = document.createElement('span');
      help.className = 'admin-field-hint';
      help.textContent = 'Choose all passives that belong to this race.';
      field.classList.add('admin-field-wide');
      field.append(label, help, picker);
      return field;
    }

    if (['stats', 'hybridStats', 'classStats'].includes(name) && Array.isArray(initialValue)) {
      field.classList.add('admin-field-wide');
      field.append(label, createStatsEditor(name, initialValue));
      return field;
    }

    if (['stats', 'bonusStats'].includes(name) && initialValue
        && typeof initialValue === 'object' && !Array.isArray(initialValue)) {
      field.classList.add('admin-field-wide');
      field.append(label, createStatMapEditor(name, initialValue));
      return field;
    }

    if (name === 'm1' && initialValue && typeof initialValue === 'object' && !Array.isArray(initialValue)) {
      field.classList.add('admin-field-wide');
      field.append(label, createNumberMapEditor(name, initialValue));
      return field;
    }

    if (name === 'conditionalStats' && initialValue
        && typeof initialValue === 'object' && !Array.isArray(initialValue)) {
      field.classList.add('admin-field-wide');
      field.append(label, createConditionalStatsEditor(name, initialValue));
      return field;
    }

    const isJson = Array.isArray(initialValue) || (initialValue && typeof initialValue === 'object') || initialValue === null;
    const control = name === 'description' || isJson
      ? document.createElement('textarea')
      : document.createElement('input');
    const kind = isJson ? 'json' : typeof initialValue === 'number' ? 'number' : 'string';
    if (control instanceof HTMLInputElement) {
      control.type = kind === 'number' ? 'number' : 'text';
      if (kind === 'number') control.step = 'any';
      control.value = initialValue === null ? '' : String(initialValue);
    } else {
      control.value = isJson ? JSON.stringify(initialValue, null, 2) : String(initialValue ?? '');
      if (name === 'description') control.rows = 6;
    }
    control.dataset.field = name;
    control.dataset.kind = kind;
    control.id = getFieldControlId(name);
    label.htmlFor = control.id;
    if (name === 'id') {
      control.maxLength = 120;
      control.pattern = '[A-Za-z0-9_\\-]{1,120}';
      control.title = 'Use 1–120 letters, numbers, underscores, or hyphens.';
    }
    field.append(label, control);
    return field;
  }

  function getFieldControlId(name) {
    const fieldIndex = fieldsElement.children.length;
    const safeName = name.replace(/[^A-Za-z0-9_-]/g, '-');
    return `admin-field-${fieldIndex}-${safeName}`;
  }

  function getStatOptions(currentKey) {
    const found = new Set();
    Object.values(database).forEach(collection => {
      if (!Array.isArray(collection)) return;
      collection.forEach(record => {
        if (Array.isArray(record.stats)) {
          record.stats.forEach(stat => {
            if (stat && typeof stat.stat === 'string') found.add(stat.stat);
          });
        } else if (record.stats && typeof record.stats === 'object') {
          Object.keys(record.stats).forEach(key => found.add(key));
        }
        if (record.bonusStats && typeof record.bonusStats === 'object') {
          Object.keys(record.bonusStats).forEach(key => found.add(key));
        }
      });
    });
    if (currentKey) found.add(currentKey);
    return [...found].sort((a, b) => a.localeCompare(b));
  }

  function createStatPicker(value, ariaLabel) {
    const select = document.createElement('select');
    select.setAttribute('aria-label', ariaLabel);
    const keys = getStatOptions(value);
    keys.forEach(key => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = key.replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, character => character.toUpperCase());
      select.appendChild(option);
    });
    select.value = value || keys[0] || '';
    return select;
  }

  function createStatsEditor(field, values) {
    const editor = document.createElement('div');
    editor.className = 'admin-structured-editor';
    if (field) {
      editor.dataset.field = field;
      editor.dataset.kind = 'stats-list';
    }
    const rows = document.createElement('div');
    rows.className = 'admin-structured-rows';
    (Array.isArray(values) ? values : []).forEach(stat => {
      rows.appendChild(createStatRow(stat));
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn';
    add.textContent = 'Add stat';
    add.addEventListener('click', () => {
      rows.appendChild(createStatRow({ stat: getStatOptions()[0] || 'damage', value: 0, type: 'percent' }));
    });
    editor.append(rows, add);
    return editor;
  }

  function createStatRow(stat) {
    const row = document.createElement('div');
    row.className = 'admin-stat-row';
    const statPicker = createStatPicker(stat.stat, 'Stat');
    const value = document.createElement('input');
    value.type = 'number';
    value.step = 'any';
    value.value = Number.isFinite(Number(stat.value)) ? String(stat.value) : '0';
    value.setAttribute('aria-label', 'Stat value');
    const type = document.createElement('select');
    type.setAttribute('aria-label', 'Stat type');
    [['percent', 'Percent'], ['flat', 'Flat']].forEach(([id, text]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = text;
      type.appendChild(option);
    });
    type.value = stat.type === 'flat' ? 'flat' : 'percent';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn danger';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => row.remove());
    row.append(statPicker, value, type, remove);
    return row;
  }

  function createStatMapEditor(field, values) {
    const editor = document.createElement('div');
    editor.className = 'admin-structured-editor';
    editor.dataset.field = field;
    editor.dataset.kind = 'stat-map';
    const rows = document.createElement('div');
    rows.className = 'admin-structured-rows';
    Object.entries(values).forEach(([stat, amount]) => {
      rows.appendChild(createNumberMapRow(stat, amount, 'stat'));
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn';
    add.textContent = 'Add stat';
    add.addEventListener('click', () => rows.appendChild(createNumberMapRow(getStatOptions()[0] || 'damage', 0, 'stat')));
    editor.append(rows, add);
    return editor;
  }

  function createNumberMapEditor(field, values) {
    const editor = document.createElement('div');
    editor.className = 'admin-structured-editor';
    editor.dataset.field = field;
    editor.dataset.kind = 'number-map';
    const rows = document.createElement('div');
    rows.className = 'admin-structured-rows';
    Object.entries(values).forEach(([key, amount]) => {
      rows.appendChild(createNumberMapRow(key, amount, field === 'm1' ? 'm1' : 'text'));
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn';
    add.textContent = 'Add value';
    add.addEventListener('click', () => rows.appendChild(createNumberMapRow('', 0, field === 'm1' ? 'm1' : 'text')));
    editor.append(rows, add);
    return editor;
  }

  function createNumberMapRow(key, amount, keyMode = 'text') {
    const row = document.createElement('div');
    row.className = 'admin-number-map-row';
    let keyInput;
    if (keyMode === 'stat') {
      keyInput = createStatPicker(key, 'Stat');
    } else if (keyMode === 'm1') {
      keyInput = document.createElement('select');
      keyInput.setAttribute('aria-label', 'Attack property');
      const options = getNumberMapOptions('m1');
      if (key && !options.includes(key)) options.push(key);
      options.forEach(optionValue => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue.replace(/\b\w/g, character => character.toUpperCase());
        keyInput.appendChild(option);
      });
      keyInput.value = key;
    } else {
      keyInput = document.createElement('input');
      keyInput.type = 'text';
      keyInput.value = key;
      keyInput.placeholder = 'Property name';
      keyInput.setAttribute('aria-label', 'Property name');
    }
    const value = document.createElement('input');
    value.type = 'number';
    value.step = 'any';
    value.value = Number.isFinite(Number(amount)) ? String(amount) : '0';
    value.setAttribute('aria-label', 'Value');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn danger';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => row.remove());
    row.append(keyInput, value, remove);
    return row;
  }

  function getNumberMapOptions(field) {
    const keys = new Set();
    Object.values(database).forEach(collection => {
      if (!Array.isArray(collection)) return;
      collection.forEach(record => {
        if (record[field] && typeof record[field] === 'object' && !Array.isArray(record[field])) {
          Object.keys(record[field]).forEach(key => keys.add(key));
        }
      });
    });
    return [...keys].sort((a, b) => a.localeCompare(b));
  }

  function createConditionalStatsEditor(field, values) {
    const editor = document.createElement('div');
    editor.className = 'admin-structured-editor';
    editor.dataset.field = field;
    editor.dataset.kind = 'conditional-stats';
    Object.entries(values).forEach(([condition, stats]) => {
      const section = document.createElement('div');
      section.className = 'admin-condition-section';
      const heading = document.createElement('h4');
      heading.textContent = condition.replace(/\b\w/g, character => character.toUpperCase());
      section.dataset.condition = condition;
      section.append(heading, createStatsEditor('', stats));
      editor.appendChild(section);
    });
    return editor;
  }

  function getEnumOptions(name, currentValue) {
    const rarityOptions = [...new Map([
      ...rarities.map(rarity => [rarity.id, rarity.name]),
      ['class', 'Class / special'],
      ...(currentValue && !rarities.some(rarity => rarity.id === currentValue) && currentValue !== 'class'
        ? [[String(currentValue), String(currentValue)]]
        : []),
    ]).entries()];
    const references = {
      masteryId: database.masteries,
      classId: database.classes,
      abilityId: database.abilities,
      auraId: database.auras,
      dashId: database.dashes,
    };
    if (name === 'source') {
      const sources = [...database.races, ...database.classes.filter(item => !item.isHybrid)];
      return [
        ['', '— None —'],
        ...sources.map(item => [item.id, item.name]),
        ...(currentValue && !sources.some(item => item.id === currentValue)
          ? [[String(currentValue), `Unavailable: ${currentValue}`]]
          : []),
      ];
    }
    if (name === 'rarity') return [['', '— Select rarity —'], ...rarityOptions];
    if (name === 'category') {
      const values = ['accessory', 'outfit', 'weapon', 'gem', 'tome'];
      if (currentValue && !values.includes(String(currentValue))) values.push(String(currentValue));
      return [['', '— Select category —'], ...values.map(value => [value, value])];
    }
    if (references[name]) {
      const records = references[name];
      return [
        ['', '— None —'],
        ...records.map(record => [record.id, record.name]),
        ...(currentValue && !records.some(record => record.id === currentValue)
          ? [[String(currentValue), String(currentValue)]]
          : []),
      ];
    }
    return null;
  }

  function createReferenceCheckbox(value, text, checked) {
    const label = document.createElement('label');
    label.className = 'admin-reference-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = value;
    checkbox.checked = checked;
    checkbox.dataset.referenceValue = value;
    label.append(checkbox, document.createTextNode(text));
    return label;
  }

  function renderForm(record) {
    fieldsElement.replaceChildren();
    Object.entries(record).forEach(([name, value]) => {
      fieldsElement.appendChild(addField(record, name, value));
    });
    const image = record.image || record.imageUrl || '';
    imagePreview.src = image;
    imagePreview.hidden = !image;
    imagePreview.onerror = () => { imagePreview.hidden = true; };
    document.getElementById('adminEditorCategory').textContent =
      `Builder data · ${collectionSelect.options[collectionSelect.selectedIndex]?.textContent || ''}`;
    document.getElementById('adminEditorName').textContent = record.name || 'New entry';
    form.hidden = false;
    empty.hidden = true;
  }

  function appendBuildSection(title, description = '') {
    const section = document.createElement('section');
    section.className = 'admin-build-section';
    const heading = document.createElement('h3');
    heading.textContent = title;
    section.appendChild(heading);
    if (description) {
      const hint = document.createElement('p');
      hint.className = 'admin-build-hint';
      hint.textContent = description;
      section.appendChild(hint);
    }
    const grid = document.createElement('div');
    grid.className = 'admin-build-grid';
    section.appendChild(grid);
    buildDataEditor.appendChild(section);
    return grid;
  }

  function appendBuildPicker(container, labelText, records, selectedValue, onChange) {
    const label = document.createElement('label');
    label.className = 'admin-build-picker';
    label.append(document.createTextNode(labelText));
    const select = document.createElement('select');
    select.className = 'admin-build-select';
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '— None —';
    select.appendChild(emptyOption);
    records.forEach(record => {
      const option = document.createElement('option');
      option.value = record.id;
      option.textContent = record.name || record.id;
      select.appendChild(option);
    });
    if (selectedValue && !records.some(record => record.id === selectedValue)) {
      const missingOption = document.createElement('option');
      missingOption.value = selectedValue;
      missingOption.textContent = `Unavailable: ${selectedValue}`;
      select.appendChild(missingOption);
    }
    select.value = selectedValue || '';
    select.addEventListener('change', () => onChange(select.value || null));
    label.appendChild(select);
    container.appendChild(label);
    return select;
  }

  function buildTomesForItem(item, kind) {
    if (!item) return [];
    const tomes = kind === 'weapon' ? database.weaponEnchants : database.accessoryOutfitEnchants;
    return tomes.filter(tome => {
      const description = String(tome.description || '').toLowerCase();
      if (kind === 'accessory') return description.includes('accessor') && !description.includes('outfits only');
      if (kind === 'outfit') return description.includes('outfit') && !description.includes('accessories only');
      if (item.masteryId === 'melee') return description.includes('melee');
      if (item.masteryId === 'magic') return description.includes('cast');
      if (item.masteryId === 'summon') return description.includes('summon');
      return false;
    });
  }

  function renderBuildEnchantPickers(container, title, item, kind, index, currentValues, onChange) {
    if (!item) return;
    const section = document.createElement('section');
    section.className = 'admin-build-enchant-group';
    const heading = document.createElement('h4');
    heading.textContent = title;
    section.appendChild(heading);
    const tomes = buildTomesForItem(item, kind);
    const selectedTomes = Array.from({ length: 5 }, (_, slot) => currentValues[slot] || null);
    for (let slot = 0; slot < 5; slot += 1) {
      const grid = document.createElement('div');
      grid.className = 'admin-build-grid admin-build-enchant-grid';
      const available = tomes.filter(tome => tome.id === selectedTomes[slot]
        || !selectedTomes.some((selected, selectedSlot) => (
          selectedSlot !== slot && selected
          && selected.replace(/_(?:i|ii|iii|iv|v)$/i, '') === tome.id.replace(/_(?:i|ii|iii|iv|v)$/i, '')
        )));
      appendBuildPicker(grid, `Tome ${slot + 1}`, available, selectedTomes[slot], value => {
        selectedTomes[slot] = value;
        if (value) {
          const family = value.replace(/_(?:i|ii|iii|iv|v)$/i, '');
          selectedTomes.forEach((selected, selectedSlot) => {
            if (selectedSlot !== slot && selected
                && selected.replace(/_(?:i|ii|iii|iv|v)$/i, '') === family) {
              selectedTomes[selectedSlot] = null;
            }
          });
        }
        onChange(selectedTomes.filter(Boolean), index);
        renderBuildDataEditor();
      });
      section.appendChild(grid);
    }
    container.appendChild(section);
  }

  function renderBuildDataEditor() {
    if (!buildEditorData) return;
    buildDataEditor.replaceChildren();
    const character = appendBuildSection('Character & class', 'Pick options from the current builder data.');
    Object.entries(buildPickers).forEach(([key, [collection, label]]) => {
      appendBuildPicker(character, label, database[collection], buildEditorData[key], value => {
        buildEditorData[key] = value;
        renderBuildDataEditor();
      });
    });
    const prestigeLabel = document.createElement('label');
    prestigeLabel.className = 'admin-build-picker';
    prestigeLabel.append(document.createTextNode('Prestige'));
    const prestigeSelect = document.createElement('select');
    prestigeSelect.className = 'admin-build-select';
    for (let prestige = 1; prestige <= 100; prestige += 1) {
      const option = document.createElement('option');
      option.value = String(prestige);
      option.textContent = String(prestige);
      prestigeSelect.appendChild(option);
    }
    const prestige = Number(buildEditorData.prestige);
    prestigeSelect.value = String(Number.isFinite(prestige) ? Math.min(100, Math.max(1, Math.floor(prestige))) : 1);
    prestigeSelect.addEventListener('change', () => {
      buildEditorData.prestige = Number(prestigeSelect.value);
    });
    prestigeLabel.appendChild(prestigeSelect);
    character.appendChild(prestigeLabel);

    const gear = appendBuildSection('Gear', 'Clear a slot or choose an item. Empty slots stay empty.');
    const accessories = Array.isArray(buildEditorData.accessories) ? buildEditorData.accessories : [];
    buildEditorData.accessories = Array.from({ length: 6 }, (_, index) => accessories[index] || null);
    buildEditorData.accessories.forEach((itemId, index) => {
      appendBuildPicker(gear, `Accessory slot ${index + 1}`, database.accessories, itemId, value => {
        buildEditorData.accessories[index] = value;
        renderBuildDataEditor();
      });
    });
    appendBuildPicker(gear, 'Outfit', database.outfits, buildEditorData.outfitId, value => {
      buildEditorData.outfitId = value;
      renderBuildDataEditor();
    });
    appendBuildPicker(gear, 'Gem', database.gems, buildEditorData.gemId, value => {
      buildEditorData.gemId = value;
      renderBuildDataEditor();
    });

    const weaponsSection = appendBuildSection('Weapons', 'Select up to 10 weapons.');
    let weapons = Array.isArray(buildEditorData.weapons) ? buildEditorData.weapons.slice(0, 10) : [null];
    if (!weapons.length) weapons = [null];
    buildEditorData.weapons = weapons;
    weapons.forEach((itemId, index) => {
      appendBuildPicker(weaponsSection, `Weapon slot ${index + 1}`, database.weapons, itemId, value => {
        buildEditorData.weapons[index] = value;
        renderBuildDataEditor();
      });
    });
    const weaponActions = document.createElement('div');
    weaponActions.className = 'admin-build-slot-actions';
    const addWeapon = document.createElement('button');
    addWeapon.type = 'button';
    addWeapon.className = 'btn';
    addWeapon.textContent = 'Add weapon slot';
    addWeapon.disabled = weapons.length >= 10;
    addWeapon.addEventListener('click', () => {
      if (buildEditorData.weapons.length < 10) buildEditorData.weapons.push(null);
      renderBuildDataEditor();
    });
    const removeWeapon = document.createElement('button');
    removeWeapon.type = 'button';
    removeWeapon.className = 'btn';
    removeWeapon.textContent = 'Remove last slot';
    removeWeapon.disabled = weapons.length <= 1;
    removeWeapon.addEventListener('click', () => {
      if (buildEditorData.weapons.length > 1) buildEditorData.weapons.pop();
      renderBuildDataEditor();
    });
    weaponActions.append(addWeapon, removeWeapon);
    weaponsSection.appendChild(weaponActions);

    const tomesSection = appendBuildSection('Tomes & enchants', 'Choose up to five tomes for each equipped item.');
    buildEditorData.outfitEnchants = Array.isArray(buildEditorData.outfitEnchants)
      ? buildEditorData.outfitEnchants
      : [];
    if (!buildEditorData.accessoryEnchants || typeof buildEditorData.accessoryEnchants !== 'object'
        || Array.isArray(buildEditorData.accessoryEnchants)) buildEditorData.accessoryEnchants = {};
    if (!buildEditorData.weaponEnchants || typeof buildEditorData.weaponEnchants !== 'object'
        || Array.isArray(buildEditorData.weaponEnchants)) buildEditorData.weaponEnchants = {};
    buildEditorData.accessories.forEach((itemId, index) => {
      const item = database.accessories.find(record => record.id === itemId);
      renderBuildEnchantPickers(tomesSection, `Accessory ${index + 1}${item ? ` · ${item.name}` : ''}`,
        item, 'accessory', index, buildEditorData.accessoryEnchants[index] || [],
        (values, slot) => { buildEditorData.accessoryEnchants[slot] = values; });
    });
    const outfit = database.outfits.find(record => record.id === buildEditorData.outfitId);
    renderBuildEnchantPickers(tomesSection, `Outfit${outfit ? ` · ${outfit.name}` : ''}`,
      outfit, 'outfit', 0, buildEditorData.outfitEnchants,
      values => { buildEditorData.outfitEnchants = values; });
    buildEditorData.weapons.forEach((itemId, index) => {
      const item = database.weapons.find(record => record.id === itemId);
      renderBuildEnchantPickers(tomesSection, `Weapon ${index + 1}${item ? ` · ${item.name}` : ''}`,
        item, 'weapon', index, buildEditorData.weaponEnchants[index] || [],
        (values, slot) => { buildEditorData.weaponEnchants[slot] = values; });
    });
    if (!tomesSection.childElementCount) {
      const hint = document.createElement('p');
      hint.className = 'admin-build-hint';
      hint.textContent = 'Equip accessories, an outfit, or weapons to choose their tomes.';
      tomesSection.appendChild(hint);
    }

    const modifiersSection = appendBuildSection('Custom modifiers', 'Adjust optional stat changes using familiar stat names.');
    const modifiers = Array.isArray(buildEditorData.customModifiers) ? buildEditorData.customModifiers : [];
    buildEditorData.customModifiers = modifiers;
    modifiers.forEach((modifier, index) => {
      const row = document.createElement('div');
      row.className = 'admin-modifier-row';
      const name = document.createElement('input');
      name.type = 'text';
      name.maxLength = 60;
      name.value = modifier.name || '';
      name.placeholder = 'Modifier name';
      name.setAttribute('aria-label', `Modifier ${index + 1} name`);
      name.addEventListener('input', () => { modifier.name = name.value; });
      const stat = document.createElement('select');
      stat.setAttribute('aria-label', `Modifier ${index + 1} stat`);
      buildStatOptions.forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        stat.appendChild(option);
      });
      if (modifier.stat && !buildStatOptions.some(([value]) => value === modifier.stat)) {
        const option = document.createElement('option');
        option.value = modifier.stat;
        option.textContent = `Other: ${modifier.stat}`;
        stat.appendChild(option);
      }
      stat.value = modifier.stat || 'damage';
      stat.addEventListener('change', () => { modifier.stat = stat.value; });
      const value = document.createElement('input');
      value.type = 'number';
      value.step = 'any';
      value.value = Number.isFinite(Number(modifier.value)) ? String(modifier.value) : '0';
      value.setAttribute('aria-label', `Modifier ${index + 1} value`);
      value.addEventListener('input', () => { modifier.value = value.value; });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn danger';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        buildEditorData.customModifiers.splice(index, 1);
        renderBuildDataEditor();
      });
      row.append(name, stat, value, remove);
      modifiersSection.appendChild(row);
    });
    const addModifier = document.createElement('button');
    addModifier.type = 'button';
    addModifier.className = 'btn';
    addModifier.textContent = 'Add modifier';
    addModifier.addEventListener('click', () => {
      buildEditorData.customModifiers.push({
        id: `admin_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        name: '',
        stat: 'damage',
        value: 0,
      });
      renderBuildDataEditor();
    });
    modifiersSection.appendChild(addModifier);
  }

  function selectEntry(id) {
    selectedId = id;
    newEntry = false;
    const record = entries.find(item => item.id === id);
    if (record && typeSelect.value === 'builds') {
      selectedBuild = record;
      document.getElementById('adminBuildCreator').textContent =
        `${record.ownerName || record.ownerId} (${record.ownerId})`;
      document.getElementById('adminBuildNameHeading').textContent = record.name || 'Untitled build';
      buildNameInput.value = record.name || '';
      buildPublicInput.checked = Boolean(record.is_public);
      buildEditorData = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
        ? structuredClone(record.data)
        : {};
      renderBuildDataEditor();
      form.hidden = true;
      buildForm.hidden = false;
      empty.hidden = true;
    } else if (record) {
      selectedBuild = null;
      buildEditorData = null;
      buildForm.hidden = true;
      renderForm(structuredClone(record));
    }
    renderEntries();
    setStatus('');
  }

  function makeId(name) {
    const slug = String(name || 'entry').normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || 'entry';
    return `new_${slug}_${Date.now().toString(36)}`;
  }

  function newRecord(id, collection) {
    const defaults = {
      races: { baseHp: 200, hpPerPrestige: 10, rarity: 'common', passiveIds: [], abilityId: null, auraId: null, dashId: null },
      masteries: { icon: '' },
      classes: { bonus: '', icon: '', color: '', glow: '', abilityId: null, auraId: null, dashId: null, bonusStats: {}, isHybrid: false },
      abilities: { classId: null, source: '', rarity: 'common' },
      auras: { classId: null, source: '', stats: [], duration: 0, damage: 0, sanityDrain: 0, requiresNight: false, rarity: 'common' },
      dashes: { classId: null, rarity: 'common' },
      racePassives: { descriptionTemplate: '', stats: [], rarity: 'common' },
      accessories: { rarity: 'common', icon: '', image: '', category: 'accessory', stats: {} },
      outfits: { rarity: 'common', icon: '', image: '', category: 'outfit', stats: {} },
      weapons: { rarity: 'common', icon: '', image: '', category: 'weapon', stats: {}, masteryId: 'melee', requiresMastery: false, m1: { damage: 0, hits: 1 }, attackSpeed: 1, delay: 0 },
      gems: { rarity: 'common', icon: '', image: '', category: 'gem', stats: {}, stat: '', value: 0 },
      accessoryOutfitEnchants: { rarity: 'common', icon: '', image: null, category: 'tome', stats: {}, stat: null, value: 0 },
      weaponEnchants: { rarity: 'common', icon: '', image: null, category: 'tome', stats: {}, stat: null, value: 0 },
    };
    return { id, name: 'New entry', description: '', image: '', ...defaults[collection] };
  }

  function readForm() {
    const record = {};
    fieldsElement.querySelectorAll('[data-field]').forEach(control => {
      const { field, kind } = control.dataset;
      if (kind === 'reference-list') {
        record[field] = [...control.querySelectorAll('[data-reference-value]:checked')]
          .map(option => option.dataset.referenceValue);
      } else if (kind === 'stats-list') {
        record[field] = [...control.querySelectorAll('.admin-stat-row')].map(row => ({
          stat: row.children[0].value,
          value: readFiniteNumber(row.children[1], field),
          type: row.children[2].value,
        }));
      } else if (kind === 'stat-map' || kind === 'number-map') {
        const values = {};
        control.querySelectorAll('.admin-number-map-row').forEach(row => {
          const key = row.children[0].value.trim();
          if (!key) throw new Error(`${field} entries need a name.`);
          if (Object.prototype.hasOwnProperty.call(values, key)) throw new Error(`${field} has a duplicate entry: ${key}.`);
          values[key] = readFiniteNumber(row.children[1], field);
        });
        record[field] = values;
      } else if (kind === 'conditional-stats') {
        const values = {};
        control.querySelectorAll('.admin-condition-section').forEach(section => {
          const condition = section.dataset.condition;
          values[condition] = [...section.querySelectorAll('.admin-stat-row')].map(row => ({
            stat: row.children[0].value,
            value: readFiniteNumber(row.children[1], field),
            type: row.children[2].value,
          }));
        });
        record[field] = values;
      } else if (kind === 'boolean') {
        record[field] = control.checked;
      } else if (kind === 'enum-nullable') {
        record[field] = control.value || null;
      } else if (kind === 'enum') {
        record[field] = control.value;
      } else if (kind === 'number') {
        const value = control.value.trim();
        const numberValue = value === '' ? 0 : Number(value);
        if (!Number.isFinite(numberValue)) throw new Error(`${field} must be a finite number.`);
        record[field] = numberValue;
      } else if (kind === 'json') {
        try {
          record[field] = JSON.parse(control.value);
        } catch {
          throw new Error(`${field} must contain valid JSON.`);
        }
      } else {
        record[field] = control.value;
      }
    });
    if (!String(record.name || '').trim()) throw new Error('Entry name cannot be empty.');
    if (typeof record.id !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(record.id)) {
      throw new Error('Entry IDs must be 1–120 letters, numbers, underscores, or hyphens.');
    }
    return record;
  }

  function readFiniteNumber(input, field) {
    const value = input.value.trim();
    const number = value === '' ? 0 : Number(value);
    if (!Number.isFinite(number)) throw new Error(`${field} values must be finite numbers.`);
    return number;
  }

  async function saveRecord(record) {
    const collection = collectionSelect.value;
    const previousId = selectedId;
    if (record.id !== previousId && entries.some(item => item.id === record.id)) {
      throw new Error(`An entry with ID "${record.id}" already exists in this section.`);
    }
    await apiRequest('/api/admin/content', {
      method: 'POST',
      body: JSON.stringify({
        type: 'builder',
        collection,
        id: record.id,
        ...(newEntry ? {} : { previousId }),
        record,
      }),
    });
    const currentIndex = entries.findIndex(item => item.id === previousId);
    if (currentIndex < 0) entries.push(record);
    else entries[currentIndex] = record;
    entries.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    selectedId = record.id;
    newEntry = false;
    renderEntries();
    renderForm(record);
    setStatus('Saved. The updated content is now live.');
  }

  async function checkAccess() {
    if (accessCheckPending) return;
    accessCheckPending = true;
    gateMessage.textContent = '';
    loginLink.hidden = true;
    try {
      const result = await apiRequest('/api/auth/me', { timeoutMs: 8000 });
      if (!result.authenticated) {
        gateMessage.textContent = 'Sign in with an approved Discord admin account to use the admin panel.';
        loginLink.hidden = false;
        return;
      }
      if (!result.user || result.user.isAdmin !== true) {
        gateMessage.textContent = 'This Discord account is not on the site admin allowlist.';
        return;
      }
      gate.hidden = true;
      app.hidden = false;
      app.inert = true;
      setStatus('Loading saved content…');
      try {
        await window.siteContentReady;
        populateCollections();
      } finally {
        app.inert = false;
        setStatus('');
      }
    } catch (error) {
      gateMessage.textContent = error.message;
    } finally {
      accessCheckPending = false;
    }
  }

  typeSelect.addEventListener('change', () => {
    selectedId = '';
    form.hidden = true;
    buildForm.hidden = true;
    empty.hidden = false;
    populateCollections();
  });
  collectionSelect.addEventListener('change', () => {
    selectedId = '';
    form.hidden = true;
    empty.hidden = false;
    loadEntries();
  });
  searchInput.addEventListener('input', renderEntries);
  document.getElementById('adminAdd').addEventListener('click', () => {
    const id = makeId(collectionSelect.value);
    selectedId = id;
    newEntry = true;
    const record = newRecord(id, collectionSelect.value);
    entries.push(record);
    renderEntries();
    renderForm(record);
    document.getElementById('adminEditorName').textContent = 'New entry';
    setStatus('Add the entry details and save when ready.');
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const record = readForm();
      await saveRecord(record);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  buildForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!selectedBuild) return;
    const name = buildNameInput.value.trim();
    if (!name) {
      setStatus('Build name cannot be empty.', true);
      return;
    }
    const data = structuredClone(buildEditorData);
    data.name = name;
    data.customModifiers = data.customModifiers.map(modifier => ({
      ...modifier,
      name: String(modifier.name || '').trim(),
      value: Number(modifier.value),
    }));
    if (data.customModifiers.some(modifier => !modifier.name || !Number.isFinite(modifier.value))) {
      setStatus('Each custom modifier needs a name and a finite number.', true);
      return;
    }
    try {
      const updatedBuildId = selectedBuild.id;
      const creator = selectedBuild.ownerName || selectedBuild.ownerId;
      const result = await apiRequest(`/api/admin/builds/${encodeURIComponent(selectedBuild.id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          ownerId: selectedBuild.ownerId,
          name,
          isPublic: buildPublicInput.checked,
          data,
        }),
      });
      entries = entries.map(entry => entry.id === updatedBuildId ? result.build : entry);
      entries.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
      selectedBuild = result.build;
      renderEntries();
      selectEntry(updatedBuildId);
      setStatus(`Build updated. Original creator (${creator}) preserved.`);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  document.getElementById('adminBuildDelete').addEventListener('click', async () => {
    if (!selectedBuild || !window.confirm(`Permanently delete "${selectedBuild.name}" by ${selectedBuild.ownerName || selectedBuild.ownerId}?`)) return;
    const build = selectedBuild;
    try {
      await apiRequest(`/api/admin/builds/${encodeURIComponent(build.id)}`, {
        method: 'DELETE',
        body: JSON.stringify({ ownerId: build.ownerId }),
      });
      selectedId = '';
      selectedBuild = null;
      buildForm.hidden = true;
      empty.hidden = false;
      if (await loadAdminBuilds()) setStatus('Cloud build deleted.');
      else setStatus('Cloud build deleted, but the build list could not be refreshed.', true);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  document.getElementById('adminDelete').addEventListener('click', async () => {
    const record = entries.find(item => item.id === selectedId);
    if (!record || !window.confirm(`Remove "${record.name}" from the live site?`)) return;
    try {
      await apiRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({
          type: typeSelect.value,
          collection: collectionSelect.value,
          id: record.id,
          deleted: true,
        }),
      });
      entries = entries.filter(item => item.id !== record.id);
      selectedId = '';
      form.hidden = true;
      empty.hidden = false;
      renderEntries();
      setStatus('Entry removed from the live site.');
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  document.getElementById('adminRefreshBuilds').addEventListener('click', () => loadAdminBuilds());
  document.getElementById('adminLoadMoreBuilds').addEventListener('click', () => loadAdminBuilds(true));

  document.getElementById('adminAddField').addEventListener('click', () => {
    const fieldName = addFieldName.value.trim();
    if (!fieldName) {
      setStatus('Enter a field name first.', true);
      return;
    }
    if ([...fieldsElement.querySelectorAll('[data-field]')].some(field => field.dataset.field === fieldName)) {
      setStatus('That field already exists.', true);
      return;
    }
    let value;
    try {
      value = JSON.parse(addFieldValue.value);
    } catch {
      setStatus('The new field value must be valid JSON.', true);
      return;
    }
    fieldsElement.appendChild(addField({}, fieldName, value));
    addFieldName.value = '';
    setStatus('');
  });

  imageUpload.addEventListener('change', async () => {
    const file = imageUpload.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setStatus('Images must be 3 MB or smaller.', true);
      imageUpload.value = '';
      return;
    }
    try {
      setStatus('Uploading image…');
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Unable to read the selected image.'));
        reader.readAsDataURL(file);
      });
      const { imageUrl } = await apiRequest('/api/admin/image', {
        method: 'POST',
        body: JSON.stringify({ data, mimeType: file.type }),
        timeoutMs: 60000,
      });
      let imageField = fieldsElement.querySelector('[data-field="image"]');
      if (!imageField) {
        fieldsElement.appendChild(addField({}, 'image', imageUrl));
        imageField = fieldsElement.querySelector('[data-field="image"]');
      }
      imageField.value = imageUrl;
      imagePreview.src = imageUrl;
      imagePreview.hidden = false;
      setStatus('Image uploaded. Save the entry to publish it.');
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      imageUpload.value = '';
    }
  });

  document.getElementById('adminRetry').addEventListener('click', checkAccess);
  checkAccess();
})();
