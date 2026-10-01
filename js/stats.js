// ============================================================
// STAT CALCULATION — combines all build components
// ============================================================

function getClass(build) {
  return database.classes.find(c => c.id === (build.classId || 'hybrid'))
    || database.classes.find(c => c.id === 'hybrid');
}

function isHybrid(build) {
  return (build.classId || 'hybrid') === 'hybrid';
}

function getEffectiveClass(build) {
  return getClass(build);
}

function getActiveAura(aura, build) {
  if (!aura || !aura.classId) return aura;

  const ownClass = build && build.classId === aura.classId;
  const stats = ownClass ? (aura.classStats || aura.stats) : (aura.hybridStats || aura.stats);
  const description = ownClass
    ? (aura.classDescription || aura.description)
    : (aura.hybridDescription || aura.description);

  return { ...aura, stats: stats || [], description };
}

function applyEnchantStats(stats, enchant) {
  if (!enchant) return;

  const enchantStats = enchant.stats && typeof enchant.stats === 'object'
    ? Object.entries(enchant.stats).filter(([, value]) => Number.isFinite(Number(value)))
    : [];
  if (enchantStats.length) {
    enchantStats.forEach(([key, value]) => {
      if (stats[key] !== undefined) stats[key] += Number(value);
    });
    return;
  }

  if (typeof enchant.stat === 'string' && Number.isFinite(Number(enchant.value)) && stats[enchant.stat] !== undefined) {
    stats[enchant.stat] += Number(enchant.value);
  }
}

function getWeaponEnchantStats(weaponEnchants, index) {
  const enchantStats = {};
  const enchantIds = weaponEnchants && weaponEnchants[index] || [];

  enchantIds.forEach(enchantId => {
    const enchant = database.weaponEnchants.find(item => item.id === enchantId);
    if (!enchant || !enchant.stats) return;

    Object.entries(enchant.stats).forEach(([key, value]) => {
      if (Number.isFinite(Number(value))) {
        enchantStats[key] = (enchantStats[key] || 0) + Number(value);
      }
    });
  });

  return enchantStats;
}

function formatStatValue(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function calculateStats(build, accessoryEnchants, weaponEnchants, options) {
  // Defensive: if these weren't passed, use globals
  accessoryEnchants = accessoryEnchants || (typeof accessoryEnchantsGlobal !== 'undefined' ? accessoryEnchantsGlobal : {});
  weaponEnchants = weaponEnchants || (typeof weaponEnchantsGlobal !== 'undefined' ? weaponEnchantsGlobal : {});
  const includeAura = !options || options.includeAura !== false;

  const stats = {
    health: 200,
    sanity: 100,
    stamina: 150,
    universalDamage: 0,
    damage: 0,
    pveDamage: 0,
    castDamage: 0,
    castCooldown: 0,
    summonDamage: 0,
    summonLife: 0,
    extraSummons: 0,
    resistance: 0,
    attackSpeed: 0,
    speed: 0,
    jump: 0,
    heal: 0,
    regeneration: 0,
    staminaRegen: 0,
    staminaCostReduction: 0,
    knockback: 0,
    insanity: 0,
    luck: 0,
    fireResistance: 0,
    slowness: 0,
    stunResistance: 0,
    blindResistance: 0,
    healingReceived: 0,
    airJumps: 0,
    universalDamagePerStack: 0,
    speedPerStack: 0,
  };

  // ---------- Race ----------
  if (build.raceId) {
    const race = database.races.find(r => r.id === build.raceId);
    if (race) {
      const baseHp = race.baseHp || 200;
      const hpPerPrestige = race.hpPerPrestige || 10;
      stats.health = baseHp + (build.prestige - 1) * hpPerPrestige;

      // Race passives
      if (race.passiveIds) {
        race.passiveIds.forEach(pid => {
          const passive = database.racePassives.find(p => p.id === pid);
          if (passive && passive.stats) {
            passive.stats.forEach(s => {
              if (stats[s.stat] !== undefined) stats[s.stat] += s.value;
            });
          }
        });
      }
    }
  } else {
    stats.health = 200 + (build.prestige - 1) * 10;
  }

  // ---------- Prestige PvE damage ----------
  stats.pveDamage += (build.prestige - 1) * 2;

  // ---------- Mastery ----------
  if (build.masteryId) {
    const mastery = database.masteries.find(m => m.id === build.masteryId);
    if (mastery && mastery.statModifiers) {
      for (const [key, val] of Object.entries(mastery.statModifiers)) {
        if (stats[key] !== undefined) stats[key] += val;
      }
    }
  }

  // ---------- Class bonus (hybrid has none) ----------
  const cls = getClass(build);
  if (cls && cls.bonusStats) {
    for (const [key, val] of Object.entries(cls.bonusStats)) {
      if (stats[key] !== undefined) stats[key] += val;
    }
  }

  // ---------- Ability stats (if any) ----------
  if (build.abilityId) {
    const ab = database.abilities.find(a => a.id === build.abilityId);
    if (ab && ab.stats) {
      ab.stats.forEach(s => {
        if (stats[s.stat] !== undefined) stats[s.stat] += s.value;
      });
    }
  }

  // ---------- Aura stats ----------
  if (includeAura && build.auraId) {
    const au = getActiveAura(
      database.auras.find(a => a.id === build.auraId),
      build
    );
    if (au && au.stats) {
      au.stats.forEach(s => {
        if (stats[s.stat] !== undefined) stats[s.stat] += s.value;
      });
    }
  }

  // ---------- Dash stats ----------
  if (build.dashId) {
    const da = database.dashes.find(d => d.id === build.dashId);
    if (da && da.stats) {
      da.stats.forEach(s => {
        if (stats[s.stat] !== undefined) stats[s.stat] += s.value;
      });
    }
  }

  // ---------- Accessories ----------
  (build.accessories || []).forEach((accId, idx) => {
    if (!accId) return;
    const acc = database.accessories.find(a => a.id === accId);
    if (acc && acc.stats) {
      const prestigeMultiplier = acc.prestigeScaling
        ? Math.max(0, (Number(build.prestige) || 1) - 1)
        : 1;
      for (const [key, val] of Object.entries(acc.stats)) {
        const statKey = key === 'cast_damage' ? 'castDamage' : key;
        if (stats[statKey] !== undefined) stats[statKey] += val * prestigeMultiplier;
      }
    }
    const enchList = accessoryEnchants[idx] || [];
    enchList.forEach(enchId => {
      const ench = database.accessoryOutfitEnchants.find(e => e.id === enchId);
      applyEnchantStats(stats, ench);
    });
  });

  // ---------- Outfit ----------
  if (build.outfitId) {
    const outfit = database.outfits.find(o => o.id === build.outfitId);
    if (outfit) {
      if (outfit.stats) {
        for (const [key, val] of Object.entries(outfit.stats)) {
          if (stats[key] !== undefined) stats[key] += val;
        }
      }
      (build.outfitEnchants || []).forEach(enchId => {
        const ench = database.accessoryOutfitEnchants.find(e => e.id === enchId);
        applyEnchantStats(stats, ench);
      });
    }
  }

  // ---------- Gem ----------
  if (build.gemId) {
    const gem = database.gems.find(g => g.id === build.gemId);
    if (gem && stats[gem.stat] !== undefined) stats[gem.stat] += gem.value;
  }

  // ---------- Custom modifiers ----------
  (build.customModifiers || []).forEach(modifier => {
    const value = Number(modifier.value);
    if (modifier && stats[modifier.stat] !== undefined && Number.isFinite(value)) {
      stats[modifier.stat] += value;
    }
  });

  return stats;
}