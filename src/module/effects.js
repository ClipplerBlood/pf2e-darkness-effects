import { DARKNESS_LEVELS, effectCompendiumIDmap, moduleID } from './const.js';

/**
 * Adds/updates the actor effect and flag
 * @param {Actor} actor
 * @param {Number} darknessLevel
 * @param {bool} isInDarkLight
 * @return {Promise<*>}
 */
export async function setActorDarknessEffect(actor, darknessLevel, isInDarkLight) {
  // Delete the old effects and set the flag
  await deleteActorDarknessEffect(actor, { skipFlag: true });
  await actor.setFlag(moduleID, 'darknessLevel', darknessLevel);
  await actor.setFlag(moduleID, 'isInDarkLight', isInDarkLight);

  // Grab the appropriate effect from the compendium or overrides
  let settingID, override;
  if (darknessLevel === DARKNESS_LEVELS['dimlyLit']) settingID = 'overrideDimlyLit';
  else if (darknessLevel === DARKNESS_LEVELS['inDarkness']) settingID = 'overrideInDarkness';
  if (settingID) override = game.settings.get(moduleID, settingID);

  let effect;
  if (override?.length > 0) effect = game.items.get(override);
  else {
    const effectID = effectCompendiumIDmap[darknessLevel];
    const compendium = game.packs.get(`${moduleID}.darkness-effects`);
    effect = await compendium.getDocument(effectID);
  }
  if (!effect) return;

  // Create the effect with appropriate flags
  const createData = effect.toObject();
  createData.flags = {
    [moduleID]: {
      darknessLevel: darknessLevel,
    },
    autoanimations: {
      version: 5,
      isEnabled: false,
      macro: {
        enabled: false,
      },
    },
  };
  await Item.create(createData, { parent: actor });
  return actor;
}

/**
 * Removes the actor effect and (optionally) flag
 * @param {Actor} actor
 * @param options
 * @return {Promise<Actor>}
 */
export async function deleteActorDarknessEffect(actor, options = { skipFlag: false }) {
  const darknessEffectsID = actor.itemTypes.effect.filter((e) => e.flags[moduleID] != null).map((e) => e.id);
  if (darknessEffectsID.length) await actor.deleteEmbeddedDocuments('Item', darknessEffectsID);
  if (!options.skipFlag && actor.getFlag(moduleID, 'darknessLevel') != null)
    await actor.unsetFlag(moduleID, 'darknessLevel');
  if (!options.skipFlag && actor.getFlag(moduleID, 'isInDarkLight') != null)
    await actor.unsetFlag(moduleID, 'isInDarkLight');
  return actor;
}

/**
 * Returns the darkness level flag of the actor
 * @param {Actor} actor
 * @return {number}
 */
export function getActorDarknessLevel(actor) {
  return actor.getFlag(moduleID, 'darknessLevel') ?? -1;
}

export function shouldUpdateActorDarknessLevel(actor, newDarknessLevel, newDarkLightFlag) {
  const isDarknessFlagSame = getActorDarknessLevel(actor) === newDarknessLevel;
  const isDarkLightFlagSame = actor.getFlag(moduleID, 'isInDarkLight') === newDarkLightFlag;
  const darknessEffects = actor.itemTypes.effect.filter((e) => e.flags[moduleID] != null);
  const isEffectPresent = darknessEffects.some((e) => e.flags[moduleID]?.darknessLevel === newDarknessLevel);
  const areOtherEffectAbsent = darknessEffects.every((e) => e.flags[moduleID]?.darknessLevel === newDarknessLevel);
  return !(isDarknessFlagSame && isDarkLightFlagSame && isEffectPresent && areOtherEffectAbsent);
}
