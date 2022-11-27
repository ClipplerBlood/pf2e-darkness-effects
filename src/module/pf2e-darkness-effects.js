import { registerSettings } from './settings.js';
import { distance, getCollidingEmittingTokens, getCollidingLights, center, getDelay } from './utils.js';
import { DARKNESS_LEVELS } from './const.js';
import { setActorDarknessEffect, deleteActorDarknessEffect, shouldUpdateActorDarknessLevel } from './effects.js';

// Initialize module
Hooks.once('init', async () => {
  console.log('pf2e-darkness-effects | Initializing pf2e-darkness-effects');
  registerSettings();
});

let timeout; // Variable storing the current delayed function

/* -------------------------------------------- */
// HOOK on LIGHT CUD, updating all tokens
Hooks.on('createAmbientLight', () => darknessTokenHook());
Hooks.on('deleteAmbientLight', () => darknessTokenHook());
Hooks.on('updateAmbientLight', () => darknessTokenHook());

// HOOK on TOKEN CUD, updating the token if doesn't emit, otherwise all tokens
Hooks.on('createToken', (tokenDoc, _options, _userId) => darknessTokenHook(tokenDoc));
Hooks.on('deleteToken', (tokenDoc, _options, _userId) => darknessTokenHook(tokenDoc));
Hooks.on('updateToken', (tokenDoc, diff, _options, _userID) => {
  if (!('x' in diff || 'y' in diff || diff.light != null)) return;
  return darknessTokenHook(tokenDoc);
});

// HOOK on SCENE U: when a scene gets ACTIVATED and is CURRENTLY VIEWED, force the token update
Hooks.on('updateScene', async (scene, diff, _options, _userID) => {
  if (!game.user.isGM || !diff.active || canvas.scene !== scene) return;
  clearTimeout(timeout);
  setTimeout(async () => handleAllTokens(canvas.scene), getDelay());
});

// HOOK on CANVAS READY
Hooks.on('canvasReady', (canvas) => {
  if (!game.user.isGM || !canvas.scene.active) return;
  clearTimeout(timeout);
  setTimeout(async () => handleAllTokens(canvas.scene), getDelay());
});

// HOOK on ITEM U, checking if the item is owned and if it adds a TokenLight rule
Hooks.on('updateItem', (item, diff, _options, _userId) => {
  if (!game.user.isGM) return;
  if (!item.parent && !diff.system?.rules?.some((rule) => rule.key === 'TokenLight')) return;
  darknessTokenHook();
});

/* -------------------------------------------- */

/**
 * Function that handles all the hooks, choosing between updating all tokens or only one
 * @param {TokenDocument} tokenDoc if null, update all tokens
 */
function darknessTokenHook(tokenDoc = undefined) {
  if (!game.user.isGM) return;
  clearTimeout(timeout);
  if (tokenDoc == null || tokenDoc.object.emitsLight) timeout = setTimeout(async () => handleAllTokens(), getDelay());
  else timeout = setTimeout(async () => handleDarkness(tokenDoc), getDelay());
}

/**
 * Handles the darkness effect for ALL tokens in the scene
 * @param {Scene} scene if null, uses the currently viewed scene
 * @return {Promise<void>}
 */
async function handleAllTokens(scene = undefined) {
  scene ??= game.scenes.viewed;
  for (const tokenDoc of scene.tokens) {
    await handleDarkness(tokenDoc);
  }
}

/**
 * Handles the darkness effect for a SINGLE token
 * @param {TokenDocument} tokenDoc
 * @return {Promise<Actor|*>}
 */
async function handleDarkness(tokenDoc) {
  if (!game.user.isGM) return;
  const actor = tokenDoc.actor;

  if (!shouldCheckDarkness()) {
    return deleteActorDarknessEffect(actor);
  }

  const darknessLevel = getDarknessLevel(tokenDoc);
  if (!shouldUpdateActorDarknessLevel(actor, darknessLevel)) return;
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
    const { x: px, y: py } = center(p.bounds);
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
