import type gsap from "gsap";

export interface SceneHandle {
  /**
   * Register this scene's animations onto the master timeline. Implementations
   * read directly from their own DOM via refs and add tweens at offsets
   * relative to `start` (in seconds).
   */
  register: (master: gsap.core.Timeline, start: number) => void;
}
