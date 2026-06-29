import { useEffect, useRef } from "react";

type MP = {
  init?: (token: string, opts?: Record<string, unknown>) => void;
  track?: (event: string, props?: Record<string, unknown>) => void;
  time_event?: (event: string) => void;
  register?: (props: Record<string, unknown>) => void;
};

function getMP(): MP | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { mixpanel?: MP }).mixpanel;
}

export const mp = {
  track(event: string, props: Record<string, unknown> = {}) {
    try { getMP()?.track?.(event, props); } catch (e) { console.warn("[Mixpanel] track", e); }
  },
  time_event(event: string) {
    try { getMP()?.time_event?.(event); } catch (e) { console.warn("[Mixpanel] time_event", e); }
  },
  register(props: Record<string, unknown>) {
    try { getMP()?.register?.(props); } catch (e) { console.warn("[Mixpanel] register", e); }
  },
};

/** Times a step from mount to unmount and fires `Time Spent - <stepName>` */
export function usePageTimer(stepName: string) {
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    startRef.current = Date.now();
    mp.time_event(`Time Spent - ${stepName}`);
    return () => {
      const seconds = Math.round((Date.now() - (startRef.current ?? Date.now())) / 1000);
      mp.track(`Time Spent - ${stepName}`, { duration_seconds: seconds });
    };
  }, [stepName]);
}

// ── Widget engagement ──────────────────────────────────────────

/** Fire once when the widget is opened (floating button clicked / iframe loaded) */
export function trackWidgetOpened(dealer?: string) {
  mp.track("Widget Opened", { dealer });
}

// ── Page / step views ────────────────────────────────────────────

export const trackHomePageLoad = () => mp.track("Home Page Loaded");

// ── Step 1 ──────────────────────────────────────────────────────

export const trackStep1Continue = () => mp.track("Step 1 - Continue Clicked");

/** Fire when the user toggles "I have a deposit" on Step 1 */
export const trackStep1DepositClicked = (checked: boolean) =>
  mp.track("Step 1 - I Have A Deposit Clicked", { checked });

/** Fire when the user toggles "I currently have finance" on Step 1 */
export const trackStep1CurrentFinanceClicked = (checked: boolean) =>
  mp.track("Step 1 - I Currently Have Finance Clicked", { checked });

// ── Step 2 ──────────────────────────────────────────────────────

export const trackStep2Submit = () => mp.track("Step 2 - Submit Clicked");

// ── Step 3 ──────────────────────────────────────────────────────

/** Fire when Step 3 first mounts (start of full application) */
export const trackStep3Started = () => mp.track("Step 3 - Application Started");

/** Fire when the user clicks Submit Application (before the API call resolves) */
export const trackStep3SubmitApplication = () => mp.track("Step 3 - Submit Application Clicked");

/** Fire when the application submission completes (success or failure) */
export const trackStep3SubmitApplicationResult = (success: boolean, extra: Record<string, unknown> = {}) =>
  mp.track("Step 3 - Submit Application Completed", { success, ...extra });