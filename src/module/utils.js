import { moduleID } from './const.js';

export function getDelay() {
  return game.settings.get(moduleID, 'delay');
}

export function center(rect) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

export function distance(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

/**
 * Get all the light objects which could collide with the provided rectangle.
 * Lights are filtered only if they:
 * - emit light
 * - light source collides with token
 * @param {Token} tokenObj The token
 * @returns {Set} The objects in the Quadtree which represent potential collisions
 */
export function getCollidingLights(tokenObj) {
  return canvas.lighting.objects.children.filter((o) => lightCollisionTest(o, tokenObj.bounds));
  // return canvas.lighting.quadtree.getObjects(tokenObj.bounds, { collisionTest: lightCollisionTest });
}

/**
 * Get all the token objects which collide with the rectangle and emit light
 * @param {Token} tokenObj The token
 * @returns {Set} The objects in the Quadtree which represent potential collisions
 */
export function getCollidingEmittingTokens(tokenObj) {
  return canvas.tokens.objects.children.filter((o) => lightCollisionTest(o, tokenObj.bounds));
  // return canvas.tokens.quadtree.getObjects(tokenObj.bounds, { collisionTest: lightCollisionTest });
}

/**
 * Function to filter lights emit light and their light intersects with the rect
 * @param {PlaceableObject} o
 * @param rect
 * @return {Boolean}
 */
function lightCollisionTest(o, rect) {
  // Check if light emits
  // const light = o.t;
  const light = o;
  if (!light.emitsLight) return false;

  // Check if light is in line of sight
  const los = light.source?.los ?? light.los;
  const { x, y } = center(rect);
  if (los && !los.contains(x, y)) return false;

  const { x: lightX, y: lightY } = center(light.bounds);
  // Check if light is distant enough from the rect center
  const dist = distance(x, y, lightX, lightY);
  const radius = Math.max(light.dimRadius, light.brightRadius);
  return dist <= radius;
}
