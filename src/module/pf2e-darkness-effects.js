import { registerSettings } from './settings.js';
import { distance, getCollidingEmittingTokens, getCollidingLights, center, getDelay } from './utils.js';
import { DARKNESS_LEVELS } from './const.js';
import { setActorDarknessEffect, deleteActorDarknessEffect, getActorDarknessLevel } from './effects.js';

// Initialize module
Hooks.once('init', async () => {
  console.log('pf2e-darkness-effects | Initializing pf2e-darkness-effects');
  registerSettings();
});

let timeout;

Hooks.on('updateToken', (tokenDoc, diff, _options, _userID) => {
  if (!game.user.isGM) return;
  if (!('x' in diff || 'y' in diff || diff.light != null)) return;

  clearTimeout(timeout);
  if (tokenDoc.object.emitsLight) timeout = setTimeout(() => handleAllTokens(), getDelay());
  else timeout = setTimeout(() => handleDarkness(tokenDoc), getDelay());
});

async function handleAllTokens(scene = undefined) {
  scene ??= game.scenes.viewed;
  for (const tokenDoc of scene.tokens) {
    await handleDarkness(tokenDoc);
  }
}

async function handleDarkness(tokenDoc) {
  if (!game.user.isGM) return;
  const actor = tokenDoc.actor;

  if (!shouldCheckDarkness()) {
    return deleteActorDarknessEffect(actor);
  }

  const darknessLevel = getDarknessLevel(tokenDoc);
  if (getActorDarknessLevel(actor) === darknessLevel) return;
  return setActorDarknessEffect(actor, darknessLevel);
}

/**
 * Returns the darkness level of the token, based on if:
 * - The token emits light
 * - The token intersect a light source (light or another token)
 * Additionally the level is determined if the light source is
 * @param tokenDoc
 * @return {number}
 */
function getDarknessLevel(tokenDoc) {
  // If the token emits bright light return BRIGHT
  const tokenObj = tokenDoc.object;
  if (tokenObj.emitsLight && tokenObj.brightRadius > 0) return DARKNESS_LEVELS['brightlyLit'];
  let isEmittingDimLight = tokenObj.emitsLight && tokenObj.dimRadius > 0;

  // Otherwise, check collisions
  const { x: cx, y: cy } = center(tokenObj.bounds);
  let collidingPlaceables = new Set([...getCollidingLights(tokenObj), ...getCollidingEmittingTokens(tokenObj)]);
  collidingPlaceables = collidingPlaceables.map((p) => {
    const { x: px, y: py } = center(p);
    const dist = distance(cx, cy, px, py);
    return { isInBrightRadius: dist <= p.brightRadius, isInDimRadius: dist <= p.dimRadius, placeable: p };
  });

  // If bright or dim lights collide with the token, return BRIGHT or DIM. Otherwise, DARK
  if (collidingPlaceables.some((p) => p.isInBrightRadius)) return DARKNESS_LEVELS['brightlyLit'];
  if (isEmittingDimLight) return DARKNESS_LEVELS['dimlyLit'];
  if (collidingPlaceables.some((p) => p.isInDimRadius)) return DARKNESS_LEVELS['dimlyLit'];
  return DARKNESS_LEVELS['inDarkness'];
}

/**
 * Returns true if the darkness level should be checked
 * @param scene
 * @return {boolean}
 */
function shouldCheckDarkness(scene) {
  scene ??= game.scenes.viewed;
  const { tokenVision, globalLight, darkness, globalLightThreshold, hasGlobalThreshold } = scene;
  if (hasGlobalThreshold) return darkness > globalLightThreshold;
  return !globalLight || tokenVision;
}
