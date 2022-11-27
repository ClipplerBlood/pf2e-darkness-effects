import { DARKNESS_LEVELS, effectCompendiumIDmap, moduleID } from './const.js';

/**
 * Adds/updates the actor effect and flag
 * @param {Actor} actor
 * @param {Number} darknessLevel
 * @return {Promise<*>}
 */
export async function setActorDarknessEffect(actor, darknessLevel) {
  // Delete the old effects and set the flag
  await deleteActorDarknessEffect(actor, { skipFlag: true });
  await actor.setFlag(moduleID, 'darknessLevel', darknessLevel);

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
 * @param {boolean} skipFlag if to skip the deletion of flag
 * @return {Promise<Actor>}
 */
export async function deleteActorDarknessEffect(actor, { skipFlag = false }) {
  const darknessEffectsID = actor.itemTypes.effect.filter((e) => e.flags[moduleID] != null).map((e) => e.id);
  if (darknessEffectsID) await actor.deleteEmbeddedDocuments('Item', darknessEffectsID);
  if (!skipFlag) await actor.unsetFlag(moduleID, 'darknessLevel');
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

export function shouldUpdateActorDarknessLevel(actor, newDarknessLevel) {
  const isFlagSame = getActorDarknessLevel(actor) === newDarknessLevel;
  const darknessEffects = actor.itemTypes.effect.filter((e) => e.flags[moduleID] != null);
  const isEffectPresent = darknessEffects.some((e) => e.flags[moduleID]?.darknessLevel === newDarknessLevel);
  const areOtherEffectAbsent = darknessEffects.every((e) => e.flags[moduleID]?.darknessLevel === newDarknessLevel);
  return !(isFlagSame && isEffectPresent && areOtherEffectAbsent);
}
