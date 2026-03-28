/** Cross-browser helpers for fullscreen + PWA standalone (Android / iOS). */

export function isStandalonePWA() {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  } catch {
    /* ignore */
  }
  return window.navigator.standalone === true;
}

export function getFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement ||
    null
  );
}

export function isIOS() {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return (
    navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints) > 1
  );
}

/**
 * Tries document + body and standard / webkit / ms prefixes (Chrome, Safari, Samsung Internet).
 */
export async function requestFullscreenBestEffort() {
  const tryCall = async (fn) => {
    if (typeof fn !== "function") return false;
    try {
      const ret = fn();
      if (ret && typeof ret.then === "function") await ret;
      return !!getFullscreenElement();
    } catch {
      return false;
    }
  };

  const el = document.documentElement;
  const body = document.body;

  const attempts = [
    () => el.requestFullscreen?.call(el),
    () => el.webkitRequestFullscreen?.call(el),
    () => el.webkitRequestFullScreen?.call(el),
    () => body?.requestFullscreen?.call(body),
    () => body?.webkitRequestFullscreen?.call(body),
    () => el.msRequestFullscreen?.call(el),
  ];

  for (const a of attempts) {
    if (await tryCall(a)) return true;
  }
  return !!getFullscreenElement();
}
