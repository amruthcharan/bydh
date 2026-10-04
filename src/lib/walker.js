// Shared, non-reactive state for the walk-through camera. The 3D view writes it
// every frame; the plan reads it to draw the "you are here" marker. Keeping it out
// of Vue's reactivity avoids 60 fps watcher churn.
export const walker = {
  x: 6, z: -2, yaw: 0, pitch: 0,
  active: false, // true while the 3D view is in walk / cardboard / VR mode
  dirty: true,   // plan should redraw the marker
  ready: false,  // a starting position has been chosen
};
