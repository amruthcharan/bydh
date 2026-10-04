import * as THREE from 'three';
import { mat } from '../parts.js';
import * as living from './living.js';
import * as bedroom from './bedroom.js';
import * as kitchen from './kitchen.js';
import * as dining from './dining.js';
import * as bath from './bath.js';
import * as office from './office.js';

const BUILDERS = { ...living, ...bedroom, ...kitchen, ...dining, ...bath, ...office };

/**
 * Build the 3D model for a catalogue item in the given colour.
 * Returns a Group whose origin is the footprint centre at floor level, front facing +z.
 * Wall-mounted items are lifted by their `elev`.
 */
export function buildFurnitureModel(item, color) {
  const g = new THREE.Group();
  const inner = new THREE.Group(); inner.position.y = item.elev || 0; g.add(inner);
  const it = { ...item, _color: color || item.colors[0] };
  const fn = BUILDERS[item.model];
  if (fn) fn(inner, it, mat(it._color));
  return g;
}
