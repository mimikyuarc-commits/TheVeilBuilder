// ============================================================
// UI — Deepwoken-style compact tabbed builder
// Includes build state (formerly in builder.js)
// ============================================================

// ============================================================
// BUILD STATE
// ============================================================
const MAX_PRESTIGE = 100;

let build = {
  name: '',
  notes: '',
  raceId: null,
  masteryId: null,
  prestige: 1,

  // Class defaults to hybrid
  classId: 'hybrid',

  abilityId: null,
  auraId: null,
  dashId: null,

  accessories: [null, null, null, null, null, null],
  outfitId: null,
  outfitEnchants: [],
  weapons: [null],
  gemId: null,
  customModifiers: [],
};

let includeAuraStats = true;
let customModifiersOpen = false;

function persistNotes(value) {
  const notes = typeof value === 'string' ? value : '';
  build.notes = notes;

  try {
    if (notes) {
      localStorage.setItem('veilBuilderInfo', notes);
    } else {
      localStorage.removeItem('veilBuilderInfo');
    }
  } catch (e) {
    console.warn('[persistNotes] Unable to persist notes:', e);
  }
}

function persistBuildName(value) {
  const name = typeof value === 'string' ? value : '';
  build.name = name;

  try {
    if (name) {
      localStorage.setItem('veilBuilderName', name);
    } else {
      localStorage.removeItem('veilBuilderName');
    }
  } catch (e) {
    console.warn('[persistBuildName] Unable to persist build name:', e);
  }
}

let accessoryEnchants = {};
let weaponEnchants = {};

// ============================================================
// HELPERS
// ============================================================
function applyRarity(el, rarityId) {
  const r = getRarity(rarityId);
  el.style.setProperty('--rarity-color', r.color);
  el.style.setProperty('--rarity-glow', r.glow);
  return r;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

const statDisplayNames = {
  health: 'Health',
  sanity: 'Sanity',
  stamina: 'Stamina',
  universalDamage: 'Universal Damage',
  damage: 'Damage',
  pveDamage: 'PvE Damage',
  castDamage: 'Cast Damage',
  castCooldown: 'Cast Cooldown',
  summonDamage: 'Summon Damage',
  summonLife: 'Summon Life',
  extraSummons: 'Extra Summons',
  resistance: 'Resistance',
  stunResistance: 'Stun Resistance',
  blindResistance: 'Blind Resistance',
  fireResistance: 'Fire Resistance',
  attackSpeed: 'Attack Speed',
  speed: 'Speed',
  jump: 'Jump',
  knockback: 'Knockback',
  regeneration: 'Regeneration',
  staminaRegen: 'Stamina Regen',
  staminaCostReduction: 'Stamina Cost Reduction',
  insanity: 'Insanity',
  luck: 'Luck',
  slowness: 'Slowness',
  healing: 'Healing',
};

function getStatLabel(key) {
  if (!key) return 'Unknown';
  if (statDisplayNames[key]) return statDisplayNames[key];
  return String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, ch => ch.toUpperCase());
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)] || null;
}

function pickRandomItems(items, count) {
  const pool = items.slice();
  const selected = [];
  while (selected.length < count && pool.length) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    selected.push(pool.splice(randomIndex, 1)[0]);
  }
  return selected;
}

function pickRandomTomes(tomes, item, kind) {
  const available = getTomesForItem(tomes, item, kind);
  const families = [...new Map(available.map(tome => [getTomeFamily(tome.id), tome])).values()];
  const count = Math.floor(Math.random() * (Math.min(5, families.length) + 1));
  return pickRandomItems(families, count).map(tome => tome.id);
}

function generateRandomBuild() {
  const race = pickRandom(database.races);
  const cls = pickRandom(database.classes);
  const mastery = pickRandom(database.masteries);
  const allowedSources = new Set([null, race.id]);

  if (cls.isHybrid) {
    database.classes.filter(item => !item.isHybrid).forEach(item => allowedSources.add(item.id));
  } else {
    allowedSources.add(cls.id);
  }

  const pickComponent = (items, classComponentId) => {
    const available = items.filter(item => {
      const source = item.source !== undefined ? item.source : (item.classId || null);
      return source === null || allowedSources.has(source);
    });
    return pickRandom(available)?.id || classComponentId || null;
  };

  const accessoryCount = 1 + Math.floor(Math.random() * Math.min(6, database.accessories.length));
  const accessories = pickRandomItems(database.accessories, accessoryCount).map(item => item.id);
  while (accessories.length < 6) accessories.push(null);

  const weaponPool = database.weapons.filter(weapon => weapon.masteryId === mastery.id);
  const weaponCount = 1 + Math.floor(Math.random() * Math.min(3, weaponPool.length));
  const weapons = pickRandomItems(weaponPool, weaponCount).map(weapon => weapon.id);
  const outfit = pickRandom(database.outfits);
  const randomizedAccessoryEnchants = {};
  accessories.forEach((accessoryId, index) => {
    if (!accessoryId) return;
    const accessory = database.accessories.find(item => item.id === accessoryId);
    randomizedAccessoryEnchants[index] = pickRandomTomes(database.accessoryOutfitEnchants, accessory, 'accessory');
  });
  const randomizedWeaponEnchants = {};
  weapons.forEach((weaponId, index) => {
    const weapon = database.weapons.find(item => item.id === weaponId);
    randomizedWeaponEnchants[index] = pickRandomTomes(database.weaponEnchants, weapon, 'weapon');
  });

  build = {
    ...build,
    raceId: race.id,
    masteryId: mastery.id,
    prestige: 1 + Math.floor(Math.random() * MAX_PRESTIGE),
    classId: cls.id,
    abilityId: pickComponent(database.abilities, cls.abilityId),
    auraId: pickComponent(database.auras, cls.auraId),
    dashId: pickComponent(database.dashes, cls.dashId),
    accessories,
    outfitId: outfit?.id || null,
    outfitEnchants: outfit ? pickRandomTomes(database.accessoryOutfitEnchants, outfit, 'outfit') : [],
    weapons,
    gemId: pickRandom(database.gems)?.id || null,
    customModifiers: [],
  };
  accessoryEnchants = randomizedAccessoryEnchants;
  weaponEnchants = randomizedWeaponEnchants;
  renderAll();
  showPreviewEmpty();
}

// ============================================================
// PREVIEW PANEL — shows full detail on hover / click
// ============================================================
const previewPanel = () => document.getElementById('previewBody');

function showPreviewEmpty() {
  previewPanel().innerHTML = `<div class="preview-placeholder">Hover an item to see details</div>`;
}

function showPreview(item, kind) {
  const el = previewPanel();
  if (!item) return showPreviewEmpty();

  const displayItem = item.classId && item.id && item.id.startsWith('class_aura_')
    ? getActiveAura(item, build)
    : item;

  const rarity = getRarity(displayItem.rarity);
  el.style.setProperty('--rarity-color', rarity.color);
  el.style.setProperty('--rarity-glow', rarity.glow);

  // image / glyph
  let imgHtml = '';
  if (displayItem.image) {
    imgHtml = `<img class="preview-image" src="${displayItem.image}" alt="${escapeHtml(displayItem.name)}"
      onerror="this.outerHTML='<div class=&quot;preview-image-placeholder&quot;>${(displayItem.icon || '◇')}</div>'">`;
  } else {
    imgHtml = `<div class="preview-image-placeholder">${displayItem.icon || '◇'}</div>`;
  }

  // description
  const desc = displayItem.description ? escapeHtml(displayItem.description) : '';

  // stats
  let statsHtml = '';
  if (displayItem.stats && Object.keys(displayItem.stats).length) {
    const statEntries = Array.isArray(displayItem.stats)
      ? displayItem.stats
        .filter(stat => stat && typeof stat.stat === 'string' && Number.isFinite(Number(stat.value)))
        .map(stat => [stat.stat, Number(stat.value)])
      : Object.entries(displayItem.stats).filter(([, value]) => Number.isFinite(Number(value)));
    const rows = statEntries.map(([k, rawValue]) => {
      const v = Number(rawValue);
      const cls = v > 0 ? 'positive' : (v < 0 ? 'negative' : '');
      const sign = v > 0 ? '+' : '';
      const suffix = k === 'extraSummons' ? '' : '%';
      return `<div class="preview-stat-row"><span>${escapeHtml(getStatLabel(k))}</span><span class="val ${cls}">${sign}${v}${suffix}</span></div>`;
    }).join('');
    statsHtml = `<div class="preview-section-title">Stats</div><div class="preview-stat-list">${rows}</div>`;
  }

  // tags
  const tags = [];
  if (item.requiresMastery && item.masteryId) tags.push(`Mastery: ${item.masteryId}`);
  if (item.classId) tags.push(`Class: ${item.classId}`);
  if (item.source) tags.push(`Source: ${item.source}`);
  if (kind) tags.push(kind);
  const tagsHtml = tags.length
    ? `<div style="margin-top:0.5rem">${tags.map(t => `<span class="preview-tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';

  // warnings
  let warnHtml = '';
  if (item.requiresMastery && item.masteryId && build.masteryId !== item.masteryId) {
    warnHtml = `<div class="preview-warning">⚠ Requires <strong>${escapeHtml(item.masteryId)}</strong> mastery</div>`;
  }

  el.innerHTML = `
    <div class="preview-item" style="--rarity-color:${rarity.color};--rarity-glow:${rarity.glow};">
      <div class="preview-name">${escapeHtml(displayItem.name)}</div>
      <div class="preview-rarity">${rarity.name}</div>
      <div class="preview-image-wrap">${imgHtml}</div>
      ${desc ? `<div class="preview-description">${desc}</div>` : ''}
      ${statsHtml}
      ${tagsHtml}
      ${warnHtml}
    </div>
  `;
}

// ============================================================
// TAB SWITCHING
// ============================================================
function initTabs() {
  const tabs = document.querySelectorAll('#tabs .tab');
  const activate = (selectedTab, moveFocus = false) => {
    const key = selectedTab.dataset.tab;
    tabs.forEach(tab => {
      const selected = tab === selectedTab;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.panel === key);
    });
    if (moveFocus) selectedTab.focus();
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', event => {
      const tabList = [...tabs];
      const current = tabList.indexOf(tab);
      let next = current;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % tabList.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + tabList.length) % tabList.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabList.length - 1;
      else return;
      event.preventDefault();
      activate(tabList[next], true);
    });
  });
}

// ============================================================
// RACE + MASTERY SELECTS
// ============================================================
function renderRaceSelect() {
  const sel = document.getElementById('raceSelect');
  sel.innerHTML = '<option value="">— Select Race —</option>';
  database.races.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `${r.name}  ·  ${getRarity(r.rarity).name}`;
    if (build.raceId === r.id) opt.selected = true;
    opt.style.color = getRarity(r.rarity).color;
    sel.appendChild(opt);
  });

  function updateRaceThumb() {
    const thumb = document.getElementById('raceIconThumb');
    if (!thumb) return;
    const selected = build.raceId ? database.races.find(x => x.id === build.raceId) : null;
    if (selected) {
      const r = getRarity(selected.rarity);
      thumb.style.setProperty('--rarity-color', r.color);
      thumb.style.setProperty('--rarity-glow', r.glow);
      if (selected.image) {
        thumb.innerHTML = `<img src="${selected.image}" alt="${escapeHtml(selected.name)}"
          onerror="this.outerHTML='<span class=&quot;race-thumb-glyph&quot;>${selected.icon || '◇'}</span>'">`;
      } else {
        thumb.innerHTML = `<span class="race-thumb-glyph">${selected.icon || '◇'}</span>`;
      }
    } else {
      thumb.innerHTML = '';
      thumb.style.removeProperty('--rarity-color');
      thumb.style.removeProperty('--rarity-glow');
    }
  }

  sel.onchange = () => {
    build.raceId = sel.value || null;
    updateRaceThumb();

    // If hybrid, only current-race components are allowed.
    // Drop any component that comes from a race we no longer have.
    if (isHybrid(build)) {
      const srcOf = (item) => item.source !== undefined ? item.source : (item.classId || null);
      const newRaceId = build.raceId;

      const check = (itemList, currentId) => {
        if (!currentId) return null;
        const it = itemList.find(x => x.id === currentId);
        if (!it) return null;
        const src = srcOf(it);
        if (src === null) return currentId;
        const ownerRace = database.races.find(r => r.id === src);
        if (ownerRace) {
          return src === newRaceId ? currentId : null;
        }
        return currentId;
      };

      build.abilityId = check(database.abilities, build.abilityId);
      build.auraId = check(database.auras, build.auraId);
      build.dashId = check(database.dashes, build.dashId);
    }

    renderAll();
  };

  sel.onmouseover = () => {
    const r = database.races.find(x => x.id === sel.value);
    if (r) showPreview(r, 'Race');
  };

  updateRaceThumb();
}

function renderMasterySelect() {
  const sel = document.getElementById('masterySelect');
  sel.innerHTML = '<option value="">— Select Mastery —</option>';
  database.masteries.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    if (build.masteryId === m.id) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.onchange = () => {
    build.masteryId = sel.value || null;
    renderAll();
  };
  sel.onmouseover = () => {
    const m = database.masteries.find(x => x.id === sel.value);
    if (m) showPreview(m, 'Mastery');
  };
}

// ============================================================
// CLASS SELECTS
// ============================================================
function renderClassSelect() {
  const sel = document.getElementById('classSelect');
  sel.innerHTML = '';
  database.classes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    if ((build.classId || 'hybrid') === c.id) opt.selected = true;
    if (c.color) opt.style.color = c.color;
    sel.appendChild(opt);
  });

  function updateClassThumb() {
    const thumb = document.getElementById('classIconThumb');
    if (!thumb) return;
    const cls = database.classes.find(c => c.id === (build.classId || 'hybrid'));
    if (!cls) {
      thumb.innerHTML = '';
      return;
    }
    const color = cls.color || '#b06cff';
    const glow = cls.glow || 'rgba(176,108,255,0.35)';
    thumb.style.setProperty('--rarity-color', color);
    thumb.style.setProperty('--rarity-glow', glow);

    const imgPath = `img/classes/${cls.id}.png`;
    thumb.innerHTML = `<img src="${imgPath}" alt="${escapeHtml(cls.name)}"
      onerror="this.outerHTML='<span class=&quot;race-thumb-glyph&quot;>${cls.icon || '◇'}</span>'">`;
  }

  sel.onchange = () => {
    const cls = database.classes.find(c => c.id === sel.value);
    build.classId = cls.id;
    if (cls.id === 'hybrid') {
      build.abilityId = null;
      build.auraId = null;
      build.dashId = null;
    } else {
      build.abilityId = cls.abilityId;
      build.auraId = cls.auraId;
      build.dashId = cls.dashId;
    }
    renderAll();
  };

  sel.onmouseover = () => {
    const c = database.classes.find(x => x.id === sel.value);
    if (c) {
      showPreview({
        name: c.name,
        description: c.description + '\n\n' + (c.bonus || ''),
        rarity: 'common',
        icon: c.icon,
        color: c.color,
        image: `img/classes/${c.id}.png`,
      }, 'Class');
      const el = previewPanel();
      el.style.setProperty('--rarity-color', c.color);
      el.style.setProperty('--rarity-glow', c.glow || 'transparent');
    }
  };

  updateClassThumb();
}

function renderClassComponentSelects() {
  const abilitySel = document.getElementById('abilitySelect');
  const auraSel = document.getElementById('auraSelect');
  const dashSel = document.getElementById('dashSelect');

  const cls = database.classes.find(c => c.id === (build.classId || 'hybrid'));
  const race = build.raceId ? database.races.find(r => r.id === build.raceId) : null;
  const hybrid = cls.id === 'hybrid';

  const allowedSources = new Set();
  if (hybrid) {
    // Hybrid sees every class source + general + ONLY the current race.
    database.classes.forEach(c => { if (!c.isHybrid) allowedSources.add(c.id); });
    if (race) allowedSources.add(race.id);
    allowedSources.add(null);
  } else {
    // Normal class sees only its own class sources + its own race + general
    allowedSources.add(cls.id);
    if (race) allowedSources.add(race.id);
    allowedSources.add(null);
  }

  function srcOf(item) {
    return item.source !== undefined ? item.source : (item.classId || null);
  }

  function buildSelect(el, items, currentId, setter) {
    // If a normal (non-hybrid) class is selected, "None" is not allowed.
    const noneAllowed = hybrid;
    if (noneAllowed) {
      el.innerHTML = '<option value="">— None —</option>';
    } else {
      el.innerHTML = '<option value="" disabled>— None (not allowed) —</option>';
    }

    const filtered = items.filter(it => {
      const s = srcOf(it);
      return s === null || allowedSources.has(s);
    });

    const groups = {};
    filtered.forEach(it => {
      const s = srcOf(it);
      const key = s === null ? 'general' : s;
      if (!groups[key]) groups[key] = [];
      groups[key].push(it);
    });

    const orderedKeys = Object.keys(groups).sort((a, b) => {
      const rank = k => {
        if (!hybrid && k === cls.id) return 0;
        if (race && k === race.id) return 1;
        if (k === 'general') return 3;
        return 2;
      };
      return rank(a) - rank(b);
    });

    orderedKeys.forEach(src => {
      const og = document.createElement('optgroup');
      let label;
      if (src === 'general') label = 'General';
      else if (src === cls.id) label = `◆ ${cls.name}`;
      else if (race && src === race.id) label = `◆ ${race.name}`;
      else {
        const c = database.classes.find(x => x.id === src);
        const r = database.races.find(x => x.id === src);
        label = c ? c.name : (r ? r.name : src);
      }
      og.label = label;

      groups[src].forEach(it => {
        const opt = document.createElement('option');
        opt.value = it.id;
        opt.textContent = it.name;
        if (currentId === it.id) opt.selected = true;
        const ownerCls = database.classes.find(c => c.id === src);
        if (ownerCls && ownerCls.color) opt.style.color = ownerCls.color;
        og.appendChild(opt);
      });
      el.appendChild(og);
    });

    // For non-hybrid: if current value is null, auto-select the first available option
    if (!hybrid && !currentId) {
      const firstOpt = el.querySelector('option:not([value=""])');
      if (firstOpt) {
        el.value = firstOpt.value;
        setTimeout(() => { setter(firstOpt.value); renderAll(); }, 0);
      }
    }

    el.onchange = () => {
      let newId = el.value || null;

      // Non-hybrid: refuse empty selection. Snap back to previous value.
      if (!hybrid && !newId) {
        el.value = currentId || '';
        if (!el.value) {
          const firstOpt = el.querySelector('option:not([value=""])');
          if (firstOpt) {
            el.value = firstOpt.value;
            newId = firstOpt.value;
          }
        } else {
          return;
        }
      }

      setter(newId);

      // Auto-hybrid on off-source pick
      if (!hybrid && newId) {
        const it = items.find(i => i.id === newId);
        if (it) {
          const s = srcOf(it);
          if (!(s === null || s === cls.id || (race && s === race.id))) {
            build.classId = 'hybrid';
          }
        }
      }
      renderAll();
    };

    el.onmouseover = () => {
      if (el.value) {
        const it = items.find(i => i.id === el.value);
        if (it) showPreview(it, 'Component');
      }
    };
  }

  buildSelect(abilitySel, database.abilities, build.abilityId, v => build.abilityId = v);
  buildSelect(auraSel, database.auras, build.auraId, v => build.auraId = v);
  buildSelect(dashSel, database.dashes, build.dashId, v => build.dashId = v);

  const detail = document.getElementById('classDetail');
  if (hybrid) {
    detail.textContent = 'Hybrid — pick any ability, aura, or dash from any class or your race. No class bonus.';
  } else {
    detail.textContent = `${cls.name} — ${cls.bonus}`;
  }
}

// ============================================================
// SLOTS (accessories, weapons, outfit, gem)
// ============================================================
function makeSlot(item, opts) {
  const { rarity, glyph, onClick, filled, onHover, onLeave } = opts;
  const slot = document.createElement('div');
  slot.className = `slot ${filled ? 'filled' : ''}`;
  if (rarity) applyRarity(slot, rarity);

  let inner = '';
  if (item && item.image) {
    inner = `<img src="${item.image}" alt="${escapeHtml(item.name)}"
      onerror="this.outerHTML='<span class=&quot;slot-glyph&quot;>${glyph}</span>'">`;
  } else if (item) {
    inner = `<span class="slot-glyph">${glyph}</span>`;
  } else {
    inner = `<span class="slot-glyph">+</span>`;
  }

  const strip = rarity ? `<div class="slot-rarity-strip"></div>` : '';
  const x = filled ? `<span class="slot-x">✕</span>` : '';

  slot.innerHTML = inner + strip + x;
  if (onClick) slot.onclick = onClick;
  if (onHover) slot.onmouseenter = onHover;
  if (onLeave) slot.onmouseleave = onLeave;
  return slot;
}

function renderAccessorySlots() {
  const container = document.getElementById('accessorySlots');
  container.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const accId = build.accessories[i];
    const acc = accId ? database.accessories.find(a => a.id === accId) : null;
    const slot = makeSlot(acc, {
      rarity: acc ? acc.rarity : null,
      glyph: acc ? (acc.icon || '◆') : '+',
      filled: !!acc,
      onClick: () => {
        if (acc) {
          build.accessories[i] = null;
          delete accessoryEnchants[i];
          renderAll();
        } else {
          document.getElementById('accessorySearchInput').focus();
        }
      },
      onHover: acc ? () => showPreview(acc, 'Accessory') : null,
    });
    container.appendChild(slot);
  }
  document.getElementById('accessoryCount').textContent = `${build.accessories.filter(a => a).length}/6`;
}

function renderOutfitSlot() {
  const container = document.getElementById('outfitSlots');
  container.innerHTML = '';
  const outfit = build.outfitId ? database.outfits.find(o => o.id === build.outfitId) : null;
  const slot = makeSlot(outfit, {
    rarity: outfit ? outfit.rarity : null,
    glyph: outfit ? (outfit.icon || '◇') : '+',
    filled: !!outfit,
    onClick: () => {
      if (outfit) {
        build.outfitId = null;
        build.outfitEnchants = [];
        renderAll();
      } else {
        document.getElementById('outfitSearchInput').focus();
      }
    },
    onHover: outfit ? () => showPreview(outfit, 'Outfit') : null,
  });
  container.appendChild(slot);
  const badge = document.getElementById('outfitBadge');
  badge.textContent = outfit ? outfit.name : 'None';
}

function renderWeaponSlots() {
  const container = document.getElementById('weaponSlots');
  container.innerHTML = '';
  build.weapons.forEach((wid, idx) => {
    const w = wid ? database.weapons.find(x => x.id === wid) : null;
    const slot = makeSlot(w, {
      rarity: w ? w.rarity : null,
      glyph: w ? (w.icon || '†') : '+',
      filled: !!w,
      onClick: () => {
        if (w) {
          build.weapons[idx] = null;
          delete weaponEnchants[idx];
          renderAll();
        } else {
          document.getElementById('weaponSearchInput').focus();
        }
      },
      onHover: w ? () => showPreview(w, 'Weapon') : null,
    });
    container.appendChild(slot);
  });

  if (build.weapons.length < 10) {
    const add = document.createElement('div');
    add.className = 'slot-add';
    add.textContent = '+';
    add.onclick = () => {
      if (build.weapons.length < 10) {
        build.weapons.push(null);
        renderAll();
      }
    };
    container.appendChild(add);
  }

  document.getElementById('weaponCount').textContent = `${build.weapons.filter(w => w).length}/10`;
}

function renderGemSlot() {
  const container = document.getElementById('gemSlots');
  container.innerHTML = '';
  const gem = build.gemId ? database.gems.find(g => g.id === build.gemId) : null;
  const slot = makeSlot(gem, {
    rarity: gem ? gem.rarity : null,
    glyph: gem ? (gem.icon || '◆') : '+',
    filled: !!gem,
    onClick: () => {
      if (gem) {
        build.gemId = null;
        renderAll();
      } else {
        document.getElementById('gemSearchInput').focus();
      }
    },
    onHover: gem ? () => showPreview(gem, 'Gem') : null,
  });
  container.appendChild(slot);
  const badge = document.getElementById('gemBadge');
  badge.textContent = gem ? gem.name : 'None';
}

// ============================================================
// SEARCH RESULTS — small tile grid
// ============================================================
let activeRarityFilter = {};

function getFilterState(filterKey) {
  if (!activeRarityFilter[filterKey]) {
    activeRarityFilter[filterKey] = { rarities: new Set(), stats: new Set(), open: false };
  }
  return activeRarityFilter[filterKey];
}

function getStatFilterOptions(items) {
  const found = new Set();
  items.forEach(item => {
    if (!item.stats || typeof item.stats !== 'object') return;
    Object.keys(item.stats).forEach(key => found.add(key));
  });
  return [...found].sort((a, b) => getStatLabel(a).localeCompare(getStatLabel(b)));
}

function getResultContainerId(filterKey) {
  if (filterKey.startsWith('weapon-')) return `${filterKey}SearchResults`;
  return filterKey === 'outfit' ? 'outfitSearchResults' : 'accessorySearchResults';
}

function getSearchInputId(filterKey) {
  if (filterKey.startsWith('weapon-')) return `${filterKey}SearchInput`;
  return filterKey === 'outfit' ? 'outfitSearchInput' : 'accessorySearchInput';
}

function renderResults(containerId, inputId, items, onPick, filterKey) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);

  if (!input || !container) return;

  function refresh() {
    const q = (input.value || '').toLowerCase();
    const filters = getFilterState(filterKey);
    const selectedRarities = filters.rarities;
    const selectedStats = filters.stats;

    const filtered = items.filter(it => {
      const nameOk = it.name.toLowerCase().includes(q);
      const rarOk = !selectedRarities.size || selectedRarities.has(it.rarity);
      const statKeyList = it.stats ? Object.keys(it.stats) : [];
      const statOk = !selectedStats.size || statKeyList.some(key => selectedStats.has(key));
      const duplicateAccessory = filterKey === 'accessory' && build.accessories.includes(it.id);
      return nameOk && rarOk && statOk && !duplicateAccessory;
    });

    container.innerHTML = '';
    if (!filtered.length) {
      container.innerHTML = `<div class="result-empty">No matches</div>`;
      return;
    }

    filtered.forEach(it => {
      const r = getRarity(it.rarity);
      const tile = document.createElement('div');
      tile.className = 'result-tile';
      tile.style.setProperty('--rarity-color', r.color);
      tile.style.setProperty('--rarity-glow', r.glow);

      let inner = '';
      if (it.image) {
        inner = `<img src="${it.image}" alt="${escapeHtml(it.name)}"
          onerror="this.outerHTML='<span class=&quot;tile-glyph&quot;>${it.icon || '◇'}</span>'">`;
      } else {
        inner = `<span class="tile-glyph">${it.icon || '◇'}</span>`;
      }
      tile.innerHTML = inner + `<div class="tile-rarity-strip"></div>`;

      tile.title = it.name;
      tile.onmouseenter = () => showPreview(it, 'Item');
      tile.onclick = () => onPick(it);
      container.appendChild(tile);
    });
  }

  input.oninput = refresh;
  refresh();
}

function buildFilterChip(label, type, value, color, isActive, onClick) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'filter-chip';
  chip.textContent = label;
  chip.title = label;
  if (isActive) chip.classList.add('active');
  if (color) {
    chip.style.setProperty('--chip-color', color);
    chip.style.setProperty('--chip-glow', color);
  }
  chip.dataset.filterType = type;
  chip.dataset.filterValue = value;
  chip.onclick = onClick;
  return chip;
}

function renderFilterBar(filterKey, items, containerId, onPick) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const resultId = getResultContainerId(filterKey);
  const inputId = getSearchInputId(filterKey);
  const refresh = () => {
    renderFilterBar(filterKey, items, containerId, onPick);
    renderResults(resultId, inputId, items, onPick, filterKey);
  };

  const state = getFilterState(filterKey);
  const statOptions = getStatFilterOptions(items);
  const rarityOptions = rarities.filter(r => items.some(it => it.rarity === r.id));

  container.innerHTML = '';
  container.classList.toggle('is-collapsed', !state.open);

  const header = document.createElement('div');
  header.className = 'filter-header';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'filter-toggle';
  toggle.setAttribute('aria-expanded', String(state.open));
  toggle.setAttribute('aria-controls', `${containerId}-body`);
  toggle.innerHTML = '<span class="filter-arrow" aria-hidden="true">></span><span>Filters</span>';
  toggle.onclick = () => {
    state.open = !state.open;
    renderFilterBar(filterKey, items, containerId, onPick);
  };
  header.appendChild(toggle);

  const activeCount = state.rarities.size + state.stats.size;
  if (activeCount) {
    const count = document.createElement('span');
    count.className = 'filter-active-count';
    count.textContent = `${activeCount} active`;
    header.appendChild(count);
  }
  container.appendChild(header);

  const body = document.createElement('div');
  body.className = 'filter-body';
  body.id = `${containerId}-body`;
  body.hidden = !state.open;

  const rarityWrap = document.createElement('div');
  rarityWrap.className = 'filter-group';
  const rarityLabel = document.createElement('span');
  rarityLabel.className = 'filter-group-label';
  rarityLabel.textContent = 'Rarity';
  rarityWrap.appendChild(rarityLabel);

  const rarityAll = buildFilterChip('All', 'rarity', 'all', '#7a7a70', state.rarities.size === 0, () => {
    state.rarities.clear();
    refresh();
  });
  rarityWrap.appendChild(rarityAll);

  rarityOptions.forEach(r => {
    const chip = buildFilterChip(r.name, 'rarity', r.id, r.color, state.rarities.has(r.id), () => {
      if (state.rarities.has(r.id)) state.rarities.delete(r.id);
      else state.rarities.add(r.id);
      refresh();
    });
    rarityWrap.appendChild(chip);
  });

  const statWrap = document.createElement('div');
  statWrap.className = 'filter-group';
  const statLabel = document.createElement('span');
  statLabel.className = 'filter-group-label';
  statLabel.textContent = 'Changes';
  statWrap.appendChild(statLabel);

  const statAll = buildFilterChip('All', 'stat', 'all', '#7a7a70', state.stats.size === 0, () => {
    state.stats.clear();
    refresh();
  });
  statWrap.appendChild(statAll);

  statOptions.forEach(key => {
    const chip = buildFilterChip(getStatLabel(key), 'stat', key, '#8a9a7a', state.stats.has(key), () => {
      if (state.stats.has(key)) state.stats.delete(key);
      else state.stats.add(key);
      refresh();
    });
    statWrap.appendChild(chip);
  });

  body.appendChild(rarityWrap);
  body.appendChild(statWrap);
  container.appendChild(body);
}

function initAccessorySearch() {
  const items = database.accessories.slice().sort((a, b) => getRarity(a.rarity).order - getRarity(b.rarity).order);

  function pick(acc) {
    if (build.accessories.includes(acc.id)) return;
    const emptyIdx = build.accessories.findIndex(a => !a);
    const idx = emptyIdx === -1 ? 0 : emptyIdx;
    build.accessories[idx] = acc.id;
    accessoryEnchants[idx] = accessoryEnchants[idx] || [];
    renderAll();
  }

  renderResults('accessorySearchResults', 'accessorySearchInput', items, pick, 'accessory');
  renderFilterBar('accessory', items, 'accessoryRarityFilter', pick);
}

function initOutfitSearch() {
  const items = database.outfits.slice().sort((a, b) => getRarity(a.rarity).order - getRarity(b.rarity).order);
  const pick = (o) => {
    build.outfitId = o.id;
    build.outfitEnchants = [];
    renderAll();
  };

  renderFilterBar('outfit', items, 'outfitFilterBar', pick);
  renderResults('outfitSearchResults', 'outfitSearchInput', items, pick, 'outfit');
}

function initWeaponSearch() {
  const root = document.getElementById('weaponSearchSections');
  if (!root) return;

  const categories = [
    { id: 'melee', label: 'Melee', masteryId: 'melee' },
    { id: 'mage', label: 'Mage', masteryId: 'magic' },
    { id: 'summon', label: 'Summon', masteryId: 'summon' },
  ];

  const pick = (w) => {
    const emptyIdx = build.weapons.findIndex(x => !x);
    const idx = emptyIdx === -1 ? 0 : emptyIdx;
    build.weapons[idx] = w.id;
    weaponEnchants[idx] = weaponEnchants[idx] || [];
    renderAll();
  };

  root.innerHTML = '';
  categories.forEach(category => {
    const items = database.weapons
      .filter(weapon => weapon.masteryId === category.masteryId)
      .sort((a, b) => getRarity(a.rarity).order - getRarity(b.rarity).order);
    const filterKey = `weapon-${category.id}`;
    const section = document.createElement('section');
    section.className = 'weapon-selector-section';

    const title = document.createElement('div');
    title.className = 'subsection-title weapon-selector-title';
    title.innerHTML = `${category.label} <span class="badge">${items.length}</span>`;

    const searchRow = document.createElement('div');
    searchRow.className = 'search-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'search-input';
    input.placeholder = `Search ${category.label.toLowerCase()} weapons...`;
    input.id = `${filterKey}SearchInput`;
    searchRow.appendChild(input);

    const filterBar = document.createElement('div');
    filterBar.className = 'filter-bar';
    filterBar.id = `${filterKey}FilterBar`;

    const results = document.createElement('div');
    results.className = 'results-list';
    results.id = `${filterKey}SearchResults`;

    section.appendChild(title);
    section.appendChild(searchRow);
    section.appendChild(filterBar);
    section.appendChild(results);
    root.appendChild(section);

    renderFilterBar(filterKey, items, filterBar.id, pick);
    renderResults(results.id, input.id, items, pick, filterKey);
  });
}

function initGemSearch() {
  const items = database.gems.slice().sort((a, b) => getRarity(a.rarity).order - getRarity(b.rarity).order);
  renderResults('gemSearchResults', 'gemSearchInput', items, (g) => {
    build.gemId = g.id;
    renderAll();
  }, 'gem');
}

function getTomesForItem(tomes, item, kind) {
  if (!item) return [];

  return tomes.filter(tome => {
    const description = String(tome.description || '').toLowerCase();
    if (kind === 'accessory') {
      return description.includes('accessor') && !description.includes('outfits only');
    }
    if (kind === 'outfit') {
      return description.includes('outfit') && !description.includes('accessories only');
    }

    const mastery = item.masteryId;
    if (mastery === 'melee') return description.includes('melee');
    if (mastery === 'magic') return description.includes('cast');
    if (mastery === 'summon') return description.includes('summon');
    return false;
  });
}

function getTomeScopeLabel(item, kind) {
  if (kind === 'accessory') return 'Accessory';
  if (kind === 'outfit') return 'Outfit';
  if (item.masteryId === 'melee') return 'Melee';
  if (item.masteryId === 'magic') return 'Cast';
  if (item.masteryId === 'summon') return 'Summon';
  return 'Weapon';
}

function getTomeFamily(tomeId) {
  return String(tomeId || '').replace(/_(?:i|ii|iii|iv|v)$/i, '');
}

function renderTomeItem(container, item, kind, index, enchantIds, tomes, setEnchants) {
  const section = document.createElement('section');
  section.className = 'tome-item';
  const availableTomes = getTomesForItem(tomes, item, kind);
  const header = document.createElement('div');
  header.className = 'tome-item-header';
  const titleWrap = document.createElement('div');
  titleWrap.className = 'tome-item-title-wrap';
  const scope = document.createElement('span');
  scope.className = 'tome-scope';
  scope.textContent = getTomeScopeLabel(item, kind);
  const title = document.createElement('div');
  title.className = 'tome-item-title';
  title.textContent = item.name;
  titleWrap.append(scope, title);
  const count = document.createElement('span');
  count.className = 'tome-available-count';
  count.textContent = `${enchantIds.length}/5 selected / ${availableTomes.length} available`;
  header.append(titleWrap, count);
  section.appendChild(header);

  for (let slot = 0; slot < 5; slot++) {
    const selectedFamilies = new Set(
      enchantIds
        .filter((enchantId, selectedSlot) => selectedSlot !== slot && enchantId)
        .map(getTomeFamily)
    );
    const slotTomes = availableTomes.filter(tome => (
      tome.id === enchantIds[slot]
      || !selectedFamilies.has(getTomeFamily(tome.id))
    ));
    const row = document.createElement('div');
    row.className = 'tome-select-row';
    const label = document.createElement('span');
    label.className = 'tome-slot-label';
    label.textContent = `Tome ${slot + 1}`;
    const select = document.createElement('select');
    select.className = 'field-select';
    select.innerHTML = '<option value="">— Empty —</option>';
    slotTomes.forEach(tome => {
      const option = document.createElement('option');
      option.value = tome.id;
      option.textContent = tome.name;
      option.title = tome.description || tome.name;
      option.style.color = getRarity(tome.rarity).color;
      if (enchantIds[slot] === tome.id) option.selected = true;
      select.appendChild(option);
    });
    select.onchange = () => {
      const next = [...enchantIds];
      next[slot] = select.value || null;
      const selectedFamily = getTomeFamily(select.value);
      if (select.value) {
        for (let selectedSlot = 0; selectedSlot < next.length; selectedSlot++) {
          if (selectedSlot !== slot && getTomeFamily(next[selectedSlot]) === selectedFamily) {
            next[selectedSlot] = null;
          }
        }
      }
      const selectedTome = slotTomes.find(tome => tome.id === select.value);
      if (selectedTome) showPreview(selectedTome, 'Tome');
      setEnchants(next.filter(Boolean));
      renderAll();
    };
    select.onfocus = () => {
      const selectedTome = availableTomes.find(tome => tome.id === select.value);
      if (selectedTome) showPreview(selectedTome, 'Tome');
    };
    row.append(label, select);
    section.appendChild(row);
  }
  container.appendChild(section);
}

function renderTomesPanel() {
  const container = document.getElementById('tomesContent');
  if (!container) return;
  container.innerHTML = '';
  let equippedCount = 0;

  build.accessories.forEach((accessoryId, index) => {
    if (!accessoryId) return;
    const item = database.accessories.find(accessory => accessory.id === accessoryId);
    if (!item) return;
    equippedCount++;
    renderTomeItem(
      container,
      item,
      'accessory',
      index,
      accessoryEnchants[index] || [],
      database.accessoryOutfitEnchants,
      enchantIds => { accessoryEnchants[index] = enchantIds; }
    );
  });

  if (build.outfitId) {
    const outfit = database.outfits.find(item => item.id === build.outfitId);
    if (outfit) {
      equippedCount++;
      renderTomeItem(
        container,
        outfit,
        'outfit',
        0,
        build.outfitEnchants,
        database.accessoryOutfitEnchants,
        enchantIds => { build.outfitEnchants = enchantIds; }
      );
    }
  }

  build.weapons.forEach((weaponId, index) => {
    if (!weaponId) return;
    const weapon = database.weapons.find(item => item.id === weaponId);
    if (!weapon) return;
    equippedCount++;
    renderTomeItem(
      container,
      weapon,
      'weapon',
      index,
      weaponEnchants[index] || [],
      database.weaponEnchants,
      enchantIds => { weaponEnchants[index] = enchantIds; }
    );
  });

  if (!equippedCount) {
    container.innerHTML = '<div class="tome-empty">Equip an accessory, outfit, or weapon to add tomes.</div>';
  }
}

// ============================================================
// STATS PANEL
// ============================================================
function renderStatsPanel() {
  if (!build.classId) build.classId = 'hybrid';
  if (!Array.isArray(build.customModifiers)) build.customModifiers = [];
  const stats = calculateStats(build, accessoryEnchants, weaponEnchants, { includeAura: includeAuraStats });
  const totalDamage = calculateTotalDamage(build, stats, weaponEnchants);
  const hybrid = isHybrid(build);

  const container = document.getElementById('statsContent');
  if (!container) return;

  container.innerHTML = `
    <div class="custom-modifiers">
      <button class="custom-modifiers-toggle" id="toggleCustomModifiers" type="button" aria-expanded="${customModifiersOpen}" aria-controls="customModifiersBody">
        <span class="custom-modifier-arrow" aria-hidden="true">›</span>
        <span>Custom Modifiers</span>
      </button>
      <div class="custom-modifier-body" id="customModifiersBody" ${customModifiersOpen ? '' : 'hidden'}>
        <form class="custom-modifier-form" id="customModifierForm">
          <input class="modifier-input modifier-name" id="modifierName" type="text" maxlength="60" placeholder="Name" aria-label="Modifier name" required>
          <select class="modifier-input" id="modifierStat" aria-label="Modifier stat">
            ${Object.keys(stats).filter(stat => !stat.endsWith('PerStack')).map(stat => `<option value="${escapeHtml(stat)}" ${stat === 'damage' ? 'selected' : ''}>${escapeHtml(getStatLabel(stat))}</option>`).join('')}
          </select>
          <input class="modifier-input modifier-value" id="modifierValue" type="number" step="any" placeholder="Value" aria-label="Modifier value" required>
          <button class="btn" type="submit">Add</button>
        </form>
        ${build.customModifiers.length ? `<div class="custom-modifier-list">
        ${build.customModifiers.map(modifier => {
          const value = Number(modifier.value);
          const flatStat = ['health', 'sanity', 'stamina', 'extraSummons', 'airJumps'].includes(modifier.stat);
          const suffix = flatStat ? '' : '%';
          return `<div class="custom-modifier-item">
            <span class="custom-modifier-description"><strong>${escapeHtml(modifier.name)}</strong><span>${formatStatValue(value)}${suffix} ${escapeHtml(getStatLabel(modifier.stat))}</span></span>
            <button class="modifier-remove" type="button" data-modifier-id="${escapeHtml(modifier.id)}" aria-label="Remove ${escapeHtml(modifier.name)}" title="Remove modifier">&times;</button>
          </div>`;
        }).join('')}
        </div>` : ''}
      </div>
    </div>
    <div class="stat-divider"></div>
    <div class="stats-view-controls">
      <label class="stats-aura-toggle">
        <input type="checkbox" id="includeAuraStats" ${includeAuraStats ? 'checked' : ''}>
        <span>Include Aura Stats</span>
      </label>
      <span class="stats-view-state">${includeAuraStats ? 'With Aura' : 'Without Aura'}</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-group">
      <div class="stat-row"><span class="stat-label">Health</span><span class="stat-value big">${stats.health}</span></div>
      <div class="stat-row"><span class="stat-label">Sanity</span><span class="stat-value big">${stats.sanity}</span></div>
      <div class="stat-row"><span class="stat-label">Stamina</span><span class="stat-value big">${stats.stamina}</span></div>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-group">
      <div class="stat-row"><span class="stat-label">Universal Dmg</span><span class="stat-value">${formatStatValue(stats.universalDamage)}%</span></div>
      <div class="stat-row"><span class="stat-label">Damage</span><span class="stat-value">${formatStatValue(stats.damage)}%</span></div>
      <div class="stat-row"><span class="stat-label">PvE Damage</span><span class="stat-value">${formatStatValue(stats.pveDamage)}%</span></div>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-group">
      <div class="stat-row"><span class="stat-label">Cast Damage</span><span class="stat-value">${formatStatValue(stats.castDamage)}%</span></div>
      <div class="stat-row"><span class="stat-label">Cast Cooldown</span><span class="stat-value">${formatStatValue(stats.castCooldown)}%</span></div>
      <div class="stat-row"><span class="stat-label">Summon Damage</span><span class="stat-value">${formatStatValue(stats.summonDamage)}%</span></div>
      <div class="stat-row"><span class="stat-label">Summon Life</span><span class="stat-value">${formatStatValue(stats.summonLife)}%</span></div>
      <div class="stat-row"><span class="stat-label">Extra Summons</span><span class="stat-value">${stats.extraSummons}</span></div>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-group">
      <div class="stat-row"><span class="stat-label">Resistance</span><span class="stat-value">${formatStatValue(stats.resistance)}%</span></div>
      <div class="stat-row"><span class="stat-label">Stun Resist</span><span class="stat-value">${formatStatValue(stats.stunResistance)}%</span></div>
      <div class="stat-row"><span class="stat-label">Blind Resist</span><span class="stat-value">${formatStatValue(stats.blindResistance)}%</span></div>
      <div class="stat-row"><span class="stat-label">Fire Resist</span><span class="stat-value">${formatStatValue(stats.fireResistance)}%</span></div>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-group">
      <div class="stat-row"><span class="stat-label">Attack Speed</span><span class="stat-value">${formatStatValue(stats.attackSpeed)}%</span></div>
      <div class="stat-row"><span class="stat-label">Speed</span><span class="stat-value">${formatStatValue(stats.speed)}%</span></div>
      <div class="stat-row"><span class="stat-label">Jump</span><span class="stat-value">${formatStatValue(stats.jump)}%</span></div>
      <div class="stat-row"><span class="stat-label">Knockback</span><span class="stat-value">${formatStatValue(stats.knockback)}%</span></div>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-group">
      <div class="stat-row"><span class="stat-label">Regeneration</span><span class="stat-value">${formatStatValue(stats.regeneration)}%</span></div>
      <div class="stat-row"><span class="stat-label">Stamina Regen</span><span class="stat-value">${formatStatValue(stats.staminaRegen)}%</span></div>
      <div class="stat-row"><span class="stat-label">Stamina Cost Red.</span><span class="stat-value">${formatStatValue(stats.staminaCostReduction)}%</span></div>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-group">
      <div class="stat-row"><span class="stat-label">Insanity</span><span class="stat-value">${formatStatValue(stats.insanity)}%</span></div>
      <div class="stat-row"><span class="stat-label">Luck</span><span class="stat-value">${formatStatValue(stats.luck)}%</span></div>
      <div class="stat-row"><span class="stat-label">Slowness</span><span class="stat-value">${formatStatValue(stats.slowness)}%</span></div>
    </div>
    <div class="stat-divider"></div>
    <div class="damage-section">
      <div style="font-family:'Cinzel',serif;font-weight:700;letter-spacing:1.5px;font-size:0.62rem;color:#8a8a80;margin-bottom:0.3rem;text-transform:uppercase;">Weapon Damage</div>
      ${build.weapons.map((wid, weaponIndex) => {
        if (!wid) return '';
        const w = database.weapons.find(x => x.id === wid);
        if (!w) return '';
        const damageDetails = getWeaponDamageDetails(wid, stats, weaponIndex, weaponEnchants);
        if (!damageDetails) return '';
        const r = getRarity(w.rarity);
        const hitBreakdown = damageDetails.hits > 1
          ? ` (${damageDetails.baseHit.toLocaleString()} x ${damageDetails.hits})`
          : '';
        const criticalHitBreakdown = damageDetails.hits > 1
          ? ` (${damageDetails.criticalHit.toLocaleString()} x ${damageDetails.hits})`
          : '';
        return `
          <div class="damage-line"><span style="color:${r.color}">${escapeHtml(w.name)} M1</span><span>${damageDetails.m1.toLocaleString()}${hitBreakdown}</span></div>
          <div class="damage-line"><span style="color:${r.color}">${escapeHtml(w.name)} Crit</span><span>${damageDetails.critical.toLocaleString()}${criticalHitBreakdown}</span></div>
          <div class="damage-line"><span style="color:${r.color}">${escapeHtml(w.name)} DPS</span><span>${damageDetails.cooldown > 0 ? (damageDetails.critical / damageDetails.cooldown).toLocaleString() : '0'} (${damageDetails.cooldown.toLocaleString()}s cooldown)</span></div>
        `;
      }).join('')}
      <div class="damage-line damage-total"><span>Total Damage</span><span>${totalDamage.toLocaleString()}</span></div>
    </div>
    ${hybrid ? `<div class="warning-badge hybrid">Hybrid — no class bonus</div>` : ''}
  `;

  const auraToggle = document.getElementById('includeAuraStats');
  if (auraToggle) {
    auraToggle.addEventListener('change', event => {
      includeAuraStats = event.target.checked;
      renderStatsPanel();
    });
  }

  const modifierToggle = document.getElementById('toggleCustomModifiers');
  if (modifierToggle) {
    modifierToggle.addEventListener('click', () => {
      customModifiersOpen = !customModifiersOpen;
      renderStatsPanel();
    });
  }

  const modifierForm = document.getElementById('customModifierForm');
  if (modifierForm) {
    modifierForm.addEventListener('submit', event => {
      event.preventDefault();
      const name = document.getElementById('modifierName').value.trim();
      const stat = document.getElementById('modifierStat').value;
      const value = Number(document.getElementById('modifierValue').value);
      if (!name || !Object.hasOwn(stats, stat) || !Number.isFinite(value)) return;

      build.customModifiers.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name,
        stat,
        value,
      });
      renderAll();
    });
  }

  container.querySelectorAll('.modifier-remove').forEach(button => {
    button.addEventListener('click', () => {
      build.customModifiers = build.customModifiers.filter(modifier => modifier.id !== button.dataset.modifierId);
      renderAll();
    });
  });
}

// ============================================================
// RENDER ALL
// ============================================================
function renderAll() {
  if (!build.classId) build.classId = 'hybrid';

  // Normalize: non-hybrid must have all three slots filled
  const cls = database.classes.find(c => c.id === build.classId);
  if (cls && !cls.isHybrid) {
    if (!build.abilityId && cls.abilityId) build.abilityId = cls.abilityId;
    if (!build.auraId && cls.auraId) build.auraId = cls.auraId;
    if (!build.dashId && cls.dashId) build.dashId = cls.dashId;
  }

  const safe = (name, fn) => {
    try { fn(); } catch (e) { console.error(`[renderAll] ${name} failed:`, e); }
  };

  safe('raceSelect', renderRaceSelect);
  safe('masterySelect', renderMasterySelect);
  safe('classSelect', renderClassSelect);
  safe('classComps', renderClassComponentSelects);
  safe('accessorySlots', renderAccessorySlots);
  safe('outfitSlot', renderOutfitSlot);
  safe('weaponSlots', renderWeaponSlots);
  safe('gemSlot', renderGemSlot);
  safe('tomesPanel', renderTomesPanel);
  safe('statsPanel', renderStatsPanel);

  const pv = document.getElementById('prestigeValue');
  if (pv) pv.textContent = build.prestige;

  const characterDetail = document.getElementById('characterDetail');
  if (characterDetail) {
    const race = database.races.find(item => item.id === build.raceId);
    const mastery = database.masteries.find(item => item.id === build.masteryId);
    if (race && mastery) {
      characterDetail.textContent = `${race.name} · ${mastery.name}. Continue through Class, Gear, Weapons, Gem, and Tomes to finish your build.`;
    } else if (race) {
      characterDetail.textContent = 'Race selected. Choose a mastery to complete your character.';
    } else if (mastery) {
      characterDetail.textContent = 'Mastery selected. Choose a race to complete your character.';
    } else {
      characterDetail.textContent = 'Start here: choose your race and mastery. Your stats update as you build.';
    }
  }
}

function applyBuildData(loaded) {
  if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) {
    throw new Error('Build data must be a JSON object.');
  }

  const savedNotes = typeof loaded.notes === 'string'
    ? loaded.notes
    : (build.notes || localStorage.getItem('veilBuilderInfo') || '');
  build = { ...build, ...loaded, notes: savedNotes };
  const loadedPrestige = Number(build.prestige);
  build.prestige = Number.isFinite(loadedPrestige)
    ? Math.min(MAX_PRESTIGE, Math.max(1, Math.floor(loadedPrestige)))
    : 1;
  accessoryEnchants = loaded.accessoryEnchants && typeof loaded.accessoryEnchants === 'object'
    && !Array.isArray(loaded.accessoryEnchants)
    ? loaded.accessoryEnchants
    : {};
  weaponEnchants = loaded.weaponEnchants && typeof loaded.weaponEnchants === 'object'
    && !Array.isArray(loaded.weaponEnchants)
    ? loaded.weaponEnchants
    : {};
  if (typeof build.name !== 'string') build.name = localStorage.getItem('veilBuilderName') || '';
  if (!build.classId) build.classId = 'hybrid';
  if (!Array.isArray(build.accessories)) build.accessories = [null, null, null, null, null, null];
  if (!Array.isArray(build.weapons)) build.weapons = [null];
  if (!Array.isArray(build.customModifiers)) build.customModifiers = [];
  build.customModifiers = build.customModifiers.filter(modifier =>
    modifier && typeof modifier.name === 'string' && typeof modifier.stat === 'string'
    && Number.isFinite(Number(modifier.value))
  ).map(modifier => ({
    id: typeof modifier.id === 'string' ? modifier.id : `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: modifier.name.slice(0, 60),
    stat: modifier.stat,
    value: Number(modifier.value),
  }));
  build.accessories = build.accessories.slice(0, 6);
  while (build.accessories.length < 6) build.accessories.push(null);
  build.weapons = build.weapons.slice(0, 10);
  if (build.weapons.length === 0) build.weapons = [null];
  persistBuildName(build.name);
  persistNotes(build.notes);
  const buildNameInput = document.getElementById('buildNameInput');
  if (buildNameInput) buildNameInput.value = build.name;
  renderAll();
}

window.veilBuilder = {
  getBuildData() {
    const data = JSON.parse(JSON.stringify({
      ...build,
      customModifiers: Array.isArray(build.customModifiers) ? build.customModifiers : [],
      accessoryEnchants,
      weaponEnchants,
    }));
    delete data.notes;
    return data;
  },
  exportBuild() {
    const json = JSON.stringify({
      ...build,
      customModifiers: Array.isArray(build.customModifiers) ? build.customModifiers : [],
      accessoryEnchants,
      weaponEnchants,
    }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = (build.name || 'veil_build').trim();
    const safeName = baseName.replace(/[<>:"/\\|?*]+/g, '').trim() || 'veil_build';
    a.download = `${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
  applyBuildData,
  setBuildName(name) {
    persistBuildName(name);
    const input = document.getElementById('buildNameInput');
    if (input) input.value = build.name;
  },
};

// ============================================================
// BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  build.name = localStorage.getItem('veilBuilderName') || '';
  build.notes = localStorage.getItem('veilBuilderInfo') || '';
  showPreviewEmpty();

  const buildNameInput = document.getElementById('buildNameInput');
  if (buildNameInput) buildNameInput.value = build.name;

  const notesModal = document.getElementById('notesModal');
  const notesText = document.getElementById('notesText');
  const infoModal = document.getElementById('infoModal');

  const openNotes = () => {
    const savedNotes = build.notes || localStorage.getItem('veilBuilderInfo') || '';
    build.notes = savedNotes;
    notesText.value = savedNotes;
    notesModal.hidden = false;
    notesText.focus();
  };
  const closeNotes = () => {
    notesModal.hidden = true;
  };
  const openInfo = () => {
    infoModal.hidden = false;
  };
  const closeInfo = () => {
    infoModal.hidden = true;
  };

  document.getElementById('btnNotes').onclick = openNotes;
  document.getElementById('btnCloseNotes').onclick = closeNotes;
  document.getElementById('btnClearNotes').onclick = () => {
    notesText.value = '';
    persistNotes('');
    notesText.focus();
  };
  notesText.addEventListener('input', () => {
    persistNotes(notesText.value);
  });
  notesModal.addEventListener('click', event => {
    if (event.target === notesModal) closeNotes();
  });

  document.getElementById('btnInfo').onclick = openInfo;
  document.getElementById('btnCloseInfo').onclick = closeInfo;
  infoModal.addEventListener('click', event => {
    if (event.target === infoModal) closeInfo();
  });

  buildNameInput.addEventListener('input', () => {
    persistBuildName(buildNameInput.value);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!notesModal.hidden) closeNotes();
      else if (!infoModal.hidden) closeInfo();
    }
  });

  document.getElementById('btnPrestigeUp').onclick = () => {
    if (build.prestige < MAX_PRESTIGE) build.prestige++;
    renderAll();
  };
  document.getElementById('btnPrestigeDown').onclick = () => { if (build.prestige > 1) build.prestige--; renderAll(); };

  document.getElementById('btnResetBuild').onclick = () => {
    const savedNotes = build.notes || localStorage.getItem('veilBuilderInfo') || '';
    const savedName = build.name || localStorage.getItem('veilBuilderName') || '';
    build = {
      name: savedName,
      notes: savedNotes,
      raceId: null, masteryId: null, prestige: 1,
      classId: 'hybrid',
      abilityId: null, auraId: null, dashId: null,
      accessories: [null, null, null, null, null, null],
      outfitId: null, outfitEnchants: [],
      weapons: [null], gemId: null,
      customModifiers: [],
    };
    if (savedName) persistBuildName(savedName);
    if (savedNotes) persistNotes(savedNotes);
    if (buildNameInput) buildNameInput.value = build.name;
    accessoryEnchants = {};
    weaponEnchants = {};
    activeRarityFilter = {};
    renderAll();
    showPreviewEmpty();
  };

  document.getElementById('btnRandomBuild').onclick = generateRandomBuild;

  document.getElementById('btnSaveBuild').onclick = () => {
    window.dispatchEvent(new CustomEvent('veil-save-requested'));
  };

  const buildFileInput = document.getElementById('buildFileInput');
  document.getElementById('btnLoadBuild').onclick = () => {
    buildFileInput.click();
  };

  buildFileInput.addEventListener('change', async event => {
    const [file] = event.target.files || [];
    if (!file) return;

    try {
      const text = await file.text();
      const loaded = JSON.parse(text);
      applyBuildData(loaded);
      alert(`Build loaded from ${file.name}!`);
    } catch (e) {
      alert('Invalid JSON file: ' + e.message);
    } finally {
      buildFileInput.value = '';
    }
  });

  // search panels
  initAccessorySearch();
  initOutfitSearch();
  initWeaponSearch();
  initGemSearch();

  renderAll();
  if (new URLSearchParams(window.location.search).has('loadPublicBuild')) {
    try {
      const pendingBuild = sessionStorage.getItem('veilBuilderPendingPublicBuild');
      if (pendingBuild) applyBuildData(JSON.parse(pendingBuild));
    } catch (error) {
      alert(`Could not load the selected public build: ${error.message}`);
    } finally {
      sessionStorage.removeItem('veilBuilderPendingPublicBuild');
      const url = new URL(window.location.href);
      url.searchParams.delete('loadPublicBuild');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }
});