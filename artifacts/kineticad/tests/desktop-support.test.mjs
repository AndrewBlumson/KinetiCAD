import test from 'node:test';
import assert from 'node:assert/strict';
import { isDesktopSupported } from '../../shared/desktopSupport.ts';

const desktop = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36',
  platform: 'Win32', maxTouchPoints: 0, hasCoarsePointer: false, hasFinePointer: true,
};

test('known phone UAs are blocked independently of their pointer reports', () => {
  for (const userAgent of [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile Safari/604.1',
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/149.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)',
    'Mozilla/5.0 (Windows Phone 10.0; Android 6.0; Microsoft; Lumia 950)',
    'Mozilla/5.0 (BB10; Touch) AppleWebKit/537.35',
  ]) {
    assert.equal(isDesktopSupported({ ...desktop, userAgent }), false, userAgent);
  }
});

test('tablet UAs without the word Mobile remain blocked', () => {
  for (const userAgent of [
    'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Safari/604.1',
    'Mozilla/5.0 (Linux; Android 15; SM-X920) Chrome/149.0 Safari/537.36',
    'Mozilla/5.0 (Linux; U; en-US) Silk/3.2 Safari/535.19',
    'Mozilla/5.0 (Kindle Fire) AppleWebKit/533.1',
    'Mozilla/5.0 (Tablet; rv:130.0) Gecko/130.0 Firefox/130.0',
  ]) {
    assert.equal(isDesktopSupported({ ...desktop, userAgent }), false, userAgent);
  }
});

test('desktop-mode iPadOS is blocked via Macintosh or MacIntel identity plus touch', () => {
  const safari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
  assert.equal(isDesktopSupported({ ...desktop, userAgent: safari, platform: 'MacIntel', maxTouchPoints: 5 }), false);
  assert.equal(isDesktopSupported({ ...desktop, userAgent: safari, platform: '', maxTouchPoints: 5 }), false);
  assert.equal(isDesktopSupported({ ...desktop, userAgent: 'Mozilla/5.0 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 }), false);
});

test('attaching a mouse does not allow a known phone or tablet to enter CAD', () => {
  for (const userAgent of ['iPhone', 'Android', 'iPad', 'Kindle']) {
    assert.equal(isDesktopSupported({ ...desktop, userAgent, maxTouchPoints: 10, hasCoarsePointer: true, hasFinePointer: true }), false);
  }
});

test('coarse-only touch devices are blocked even with a desktop-like or unknown UA', () => {
  assert.equal(isDesktopSupported({ ...desktop, hasCoarsePointer: true, hasFinePointer: false, maxTouchPoints: 10 }), false);
  assert.equal(isDesktopSupported({ ...desktop, userAgent: '', hasCoarsePointer: true, hasFinePointer: false }), false);
});

test('touch-capable Windows laptops with a fine pointer remain supported', () => {
  const laptop = { ...desktop, maxTouchPoints: 10, hasCoarsePointer: true, hasFinePointer: true };
  assert.equal(isDesktopSupported(laptop), true);
  assert.equal(isDesktopSupported({ ...laptop, hasCoarsePointer: false }), true);
});

test('ordinary macOS, Windows and Linux desktop pointers remain supported', () => {
  assert.equal(isDesktopSupported(desktop), true);
  assert.equal(isDesktopSupported({ ...desktop, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/149.0 Safari/537.36', platform: 'MacIntel' }), true);
  assert.equal(isDesktopSupported({ ...desktop, userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0', platform: 'Linux x86_64' }), true);
});

test('narrow desktop windows and browser zoom are not mobile-device signals', () => {
  for (const viewportWidth of [280, 390, 600, 1920]) {
    assert.equal(isDesktopSupported({ ...desktop, viewportWidth }), true);
  }
});

test('detection is pure and optional platform/touch values do not reject a desktop', () => {
  const signals = Object.freeze({ userAgent: desktop.userAgent, hasCoarsePointer: false, hasFinePointer: true });
  assert.equal(isDesktopSupported(signals), true);
  assert.deepEqual(signals, { userAgent: desktop.userAgent, hasCoarsePointer: false, hasFinePointer: true });
});
