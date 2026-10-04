import { describe, expect, it } from 'vitest';
import { toPlan } from './place.js';

// A 10 × 8 m image (1000 × 800 px at 1 cm/px) centred on (20, 30).
const u = { w: 1000, h: 800, mpp: 0.01, x: 20, y: 30, rot: 0 };
const result = {
  walls: [{ x1: 1, y1: 1, x2: 5, y2: 1 }],
  openings: [{ wall: 0, t: 0.5, w: 0.9, type: 'door' }],
  rooms: [{ x: 1, y: 1, w: 4, h: 3 }],
  wallT: 0.23,
};

describe('toPlan', () => {
  it('moves image metres onto the plan', () => {
    const p = toPlan(result, u, 10, 8);
    expect(p.walls[0]).toEqual({ x1: 16, y1: 27, x2: 20, y2: 27 });
    expect(p.rooms[0]).toEqual({ x: 16, y: 27, w: 4, h: 3 });
    expect(p.openings[0]).toEqual({ wall: 0, t: 0.5, w: 0.9, type: 'door' });
  });

  it('rescales when the working image is a different size', () => {
    const p = toPlan({ ...result, walls: [{ x1: 0, y1: 0, x2: 2.5, y2: 0 }] }, u, 5, 4);
    expect(p.walls[0].x2 - p.walls[0].x1).toBeCloseTo(5);
    expect(p.openings[0].w).toBeCloseTo(1.8);
    expect(p.wallT).toBeCloseTo(0.46);
  });

  it('rotates with the image and keeps rooms at 90°', () => {
    const p = toPlan(result, { ...u, rot: 90 }, 10, 8);
    // Image point (1, 1) is (-4, -3) from the centre; turned 90° clockwise (y down) that is (3, -4).
    expect(p.walls[0].x1).toBeCloseTo(23);
    expect(p.walls[0].y1).toBeCloseTo(26);
    expect(p.rooms).toHaveLength(1);
    expect(p.rooms[0].w).toBeCloseTo(3);
    expect(p.rooms[0].h).toBeCloseTo(4);
  });

  it('drops rooms when the image is at an odd angle', () => {
    const p = toPlan(result, { ...u, rot: 12 }, 10, 8);
    expect(p.rooms).toEqual([]);
    expect(p.skippedRooms).toBe(1);
  });
});
