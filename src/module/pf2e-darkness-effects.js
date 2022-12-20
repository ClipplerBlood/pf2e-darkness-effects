import { registerSettings } from './settings.js';
import { distance, getCollidingEmittingTokens, getCollidingLights, center, getDelay } from './utils.js';
import { ACTOR_TYPE_BLACKLIST, DARKNESS_LEVELS, moduleID } from './const.js';
import { setActorDarknessEffect, deleteActorDarknessEffect, shouldUpdateActorDarknessLevel } from './effects.js';

// Initialize module
Hooks.once('init', async () => {
  console.log('pf2e-darkness-effects | Initializing pf2e-darkness-effects');
  registerSettings();
});

let timeout; // Variable storing the current delayed function

/* -------------------------------------------- */
// HOOK on LIGHT CUD, updating all tokens
Hooks.on('createAmbientLight', () => darknessTokenHook({}));
Hooks.on('deleteAmbientLight', () => darknessTokenHook({}));
Hooks.on('updateAmbientLight', () => darknessTokenHook({}));

// HOOK on TOKEN CUD, updating the token if it doesn't emit, otherwise all tokens
Hooks.on('createToken', (tokenDoc, _options, _userId) => darknessTokenHook(tokenDoc));
Hooks.on('deleteToken', (tokenDoc, _options, _userId) => darknessTokenHook(tokenDoc));
Hooks.on('updateToken', (tokenDoc, diff, _options, _userID) => {
  if (!('x' in diff || 'y' in diff || (diff.light && Object.keys(diff.light).length))) return;
  return darknessTokenHook({ tokenDoc });
});

// HOOK on SCENE U: when a scene gets ACTIVATED and is CURRENTLY VIEWED, force the token update
Hooks.on('updateScene', async (scene, diff, _options, _userID) => {
  if (!game.user.isGM || !diff.active || canvas.scene !== scene) return;
  darknessTokenHook({ scene });
});

// HOOK on CANVAS READY
Hooks.on('canvasReady', (canvas) => {
  if (!game.user.isGM || !canvas.scene.active) return;
  darknessTokenHook({ scene: canvas.scene });
});

// HOOK on ITEM U, checking if the item is owned and if it adds a TokenLight rule
Hooks.on('updateItem', (item, diff, _options, _userId) => {
  if (!game.user.isGM) return;
  if (!item.parent && !diff.system?.rules?.some((rule) => rule.key === 'TokenLight')) return;
  darknessTokenHook({});
});

/* -------------------------------------------- */

/**
 * Function that handles all the hooks, choosing between updating all tokens or only one
 * @param {TokenDocument} tokenDoc if null, update all tokens
 * @param scene
 */
function darknessTokenHook({ tokenDoc = undefined, scene = undefined }) {
  if (!game.user.isGM) return;
  scene ??= game.scenes.active;
  clearTimeout(timeout);
  if (tokenDoc == null || tokenDoc.object.emitsLight)
    timeout = setTimeout(async () => handleAllTokens(scene), getDelay());
  else timeout = setTimeout(async () => handleDarkness(tokenDoc, scene), getDelay());
}

/**
 * Handles the darkness effect for ALL tokens in the scene
 * @param {Scene} scene if null, uses the currently viewed scene
 * @return {Promise<void>}
 */
export async function handleAllTokens(scene = undefined) {
  scene ??= game.scenes.active;
  for (const tokenDoc of scene.tokens) {
    await handleDarkness(tokenDoc, scene);
  }
}

/**
 * Handles the darkness effect for a SINGLE token
 * @param {TokenDocument} tokenDoc
 * @param scene
 * @return {Promise<Actor|*>}
 */
async function handleDarkness(tokenDoc, scene) {
  if (!game.user.isGM) return;
  const actor = tokenDoc.actor;

  if (!shouldCheckDarkness({ scene, tokenDoc })) {
    return deleteActorDarknessEffect(actor);
  }

  const darknessLevel = getDarknessLevel(tokenDoc, scene);
  if (!shouldUpdateActorDarknessLevel(actor, darknessLevel)) return;
  return setActorDarknessEffect(actor, darknessLevel);
}

/**
 * Returns the darkness level of the token, based on if:
 * - The token emits light
 * - The token intersect a light source (light or another token)
 * Additionally the level is determined if the light source emits dark light, and based on the scene dim light threshold
 * @param tokenDoc
 * @param scene
 * @return {number}
 */
function getDarknessLevel(tokenDoc, scene) {
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
    return {
      isInBrightRadius: dist <= p.brightRadius,
      isInDimRadius: dist <= p.dimRadius,
      placeable: p,
      isDarkness: p.isDarkness,
    };
  });

  // Separate lights and darkLights
  const lights = collidingPlaceables.filter((p) => !p.isDarkness);
  const darkLights = collidingPlaceables.filter((p) => p.isDarkness);

  // If bright or dim lights collide with the token, set BRIGHT or DIM. Otherwise, get the scene base light
  let level;
  if (lights.some((p) => p.isInBrightRadius)) level = DARKNESS_LEVELS['brightlyLit'];
  else if (isEmittingDimLight) level = DARKNESS_LEVELS['dimlyLit'];
  else if (lights.some((p) => p.isInDimRadius)) level = DARKNESS_LEVELS['dimlyLit'];
  else level = getSceneDarkness(scene);

  // If darkLights collide with bright radius, step down the darkness two levels, if dim radius, step down 1
  if (darkLights.some((p) => p.isInBrightRadius)) level -= 2;
  else if (darkLights.some((p) => p.isInDimRadius)) level -= 1;
  return Math.max(level, 0);
}

/**
 * Returns true if the darkness level should be checked
 * @param scene
 * @param tokenDoc
 * @return {boolean}
 */
function shouldCheckDarkness({ scene, tokenDoc }) {
  // Filter out actor types
  if (ACTOR_TYPE_BLACKLIST.includes(tokenDoc?.actor?.type)) return false;

  // Grab data
  scene ??= game.scenes.viewed;
  const { tokenVision, globalLight, darkness, globalLightThreshold, hasGlobalThreshold } = scene;
  const dimLightThreshold = game.settings.get(moduleID, 'dimLightThreshold');

  // If the scene contains darkLights, then it must be considered
  if (game.scenes.active.lights.some((l) => l.object.isDarkness)) return true;

  // Check if lighting conditions should be considered
  if (hasGlobalThreshold || dimLightThreshold) return darkness > globalLightThreshold || darkness >= dimLightThreshold;
  return !globalLight || tokenVision;
}

/**
 * Returns the scene BASE darkness, determined by the global light threshold and the custom dim light threshold setting
 * @param scene
 * @return {number}
 */
function getSceneDarkness(scene) {
  const darkness = scene.darkness;
  const globalLightThreshold = scene.globalLightThreshold;
  const dimLightThreshold = game.settings.get(moduleID, 'dimLightThreshold');

  if (darkness > globalLightThreshold) return DARKNESS_LEVELS['inDarkness'];
  if (darkness >= dimLightThreshold) return DARKNESS_LEVELS['dimlyLit'];
  return DARKNESS_LEVELS['brightlyLit'];
}
