// ============================================================
// DAMAGE CALCULATIONS
// ============================================================

const CRITICAL_DAMAGE_MULTIPLIER = 1.2;

function calculateWeaponDamage(weaponId) {
  const weapon = database.weapons.find(w => w.id === weaponId);
  if (!weapon) return { m1: 0, total: 0 };

  const m1 = weapon.m1 && typeof weapon.m1 === 'object'
    ? weapon.m1
    : { damage: 0, hits: 1 };
  const hits = Number.isFinite(Number(m1.hits)) ? Number(m1.hits) : 1;
  const m1Damage = Number.isFinite(Number(m1.damage))
    ? Number(m1.damage) * Math.max(0, hits)
    : 0;

  return {
    m1: m1Damage,
    total: m1Damage
  };
}

function getWeaponDamageMultiplier(weapon, stats) {
  let specificDamage = 0;

  switch (weapon.masteryId) {
    case 'melee':
      specificDamage = stats.damage || 0;
      break;
    case 'magic':
      specificDamage = stats.castDamage || 0;
      break;
    case 'summon':
      return 0;
  }

  return 1 + (
    specificDamage
    + (stats.universalDamage || 0)
    + (stats.pveDamage || 0)
  ) / 100;
}

function getWeaponStats(stats, weaponIndex, weaponEnchants) {
  const weaponStats = { ...stats };
  const enchantStats = getWeaponEnchantStats(weaponEnchants, weaponIndex);

  Object.entries(enchantStats).forEach(([key, value]) => {
    if (weaponStats[key] !== undefined) weaponStats[key] += value;
  });

  return weaponStats;
}

function calculateWeaponM1Damage(weaponId, stats, weaponIndex, weaponEnchants) {
  const currentStats = stats || calculateStats({ weapons: [weaponId] });
  const damage = calculateWeaponDamage(weaponId);
  const weapon = database.weapons.find(w => w.id === weaponId);
  if (!weapon) return 0;
  const weaponStats = getWeaponStats(currentStats, weaponIndex, weaponEnchants);

  return damage.m1 * getWeaponDamageMultiplier(
    weapon,
    weaponStats
  );
}

function getWeaponDamageDetails(weaponId, stats, weaponIndex, weaponEnchants) {
  const currentStats = stats || calculateStats({ weapons: [weaponId] });
  const weapon = database.weapons.find(w => w.id === weaponId);
  if (!weapon) return null;
  const weaponStats = getWeaponStats(currentStats, weaponIndex, weaponEnchants);

  const damage = calculateWeaponDamage(weaponId);
  const multiplier = getWeaponDamageMultiplier(weapon, weaponStats);
  const hits = Number.isFinite(Number(weapon.m1?.hits))
    ? Number(weapon.m1.hits)
    : 1;
  const baseHit = Number(weapon.m1?.damage) * multiplier;
  const cooldown = weapon.masteryId === 'magic'
    ? Number(weapon.castCooldown) * Math.max(0.01, 1 + ((weaponStats.castCooldown || 0) / 100))
    : getWeaponM1Interval(weapon, weaponStats);

  return {
    hits,
    baseHit,
    m1: baseHit * hits,
    criticalHit: baseHit * CRITICAL_DAMAGE_MULTIPLIER,
    critical: baseHit * CRITICAL_DAMAGE_MULTIPLIER * hits,
    cooldown
  };
}

function getWeaponM1Interval(weapon, stats) {
  if (weapon.masteryId !== 'melee') return 0;

  const attackDuration = Number(weapon.attackSpeed);
  if (!Number.isFinite(attackDuration)) return 0;

  const attackSpeedModifier = Math.max(
    0.01,
    1 - ((Number(stats.attackSpeed) || 0) / 100)
  );
  return attackDuration * attackSpeedModifier;
}

function calculateTotalDamage(build, stats, weaponEnchants) {
  const currentStats = stats || calculateStats(build);

  return (build.weapons || []).reduce((total, weaponId, index) => {
    if (!weaponId) return total;

    const weapon = database.weapons.find(w => w.id === weaponId);
    if (!weapon) return total;
    if (weapon.masteryId === 'summon') return total;

    const damage = calculateWeaponDamage(weaponId);
    const weaponStats = getWeaponStats(
      currentStats,
      index,
      weaponEnchants || {}
    );
    const multiplier = getWeaponDamageMultiplier(
      weapon,
      weaponStats
    );
    return total + (damage.m1 * multiplier);
  }, 0);
}

function calculateDPS(build, stats, weaponEnchants) {
  const damageStats = stats || calculateStats(build);

  const dps = (build.weapons || []).reduce((total, weaponId, index) => {
    if (!weaponId) return total;

    const weapon = database.weapons.find(w => w.id === weaponId);
    if (!weapon) return total;
    if (weapon.masteryId === 'summon') return total;

    const weaponDamage = calculateWeaponDamage(weaponId);
    const weaponStats = getWeaponStats(
      damageStats,
      index,
      weaponEnchants || {}
    );
    const damage = weaponDamage.m1 * getWeaponDamageMultiplier(
      weapon,
      weaponStats
    );
    const criticalDamage = damage * CRITICAL_DAMAGE_MULTIPLIER;

    if (weapon.masteryId === 'magic') {
      const cooldownModifier = Math.max(
        0.01,
        1 + ((weaponStats.castCooldown || 0) / 100)
      );
      const baseCooldown = Number(weapon.castCooldown);
      if (!Number.isFinite(baseCooldown) || baseCooldown <= 0) return total;

      const cooldown = baseCooldown * cooldownModifier;
      return total + (criticalDamage / cooldown);
    }

    const m1Interval = getWeaponM1Interval(weapon, weaponStats);
    return total + (m1Interval > 0 ? criticalDamage / m1Interval : 0);
  }, 0);

  return Math.round((dps + Number.EPSILON) * 100) / 100;
}
