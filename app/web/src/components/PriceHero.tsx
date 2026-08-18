import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { perMonth, usd } from '../lib/format';
import { selectGuarantee, selectMonthly, selectTotal, useBuild } from '../state/build';

const PULSE_DURATION_SEC = 0.4;

function GuaranteeChip({ level, years }: { level: string; years: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-navy-950">
      {level} {years}-Year Guarantee
    </span>
  );
}

/**
 * Counts a displayed dollar amount up (or down) to `target` over ~400ms and
 * drives a shared scale MotionValue for a subtle "pulse" on change. Renders
 * statically (no tween, no pulse) when the user prefers reduced motion.
 */
function useAnimatedPrice(target: number | null, reduceMotion: boolean) {
  const [display, setDisplay] = useState(target ?? 0);
  const scale = useMotionValue(1);
  const prevRef = useRef<number | null>(null);

  useEffect(() => {
    if (target == null) return;
    const prev = prevRef.current;
    prevRef.current = target;

    if (reduceMotion) {
      setDisplay(target);
      scale.set(1);
      return;
    }

    if (prev == null) {
      // First reveal: no prior value to count up from.
      setDisplay(target);
      return;
    }

    const controls = animate(prev, target, {
      duration: PULSE_DURATION_SEC,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    animate(scale, [1, 1.05, 1], { duration: PULSE_DURATION_SEC });

    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduceMotion]);

  return { display, scale };
}

export default function PriceHero() {
  const state = useBuild();
  const reduceMotion = Boolean(useReducedMotion());

  const total = selectTotal(state);
  const monthly = selectMonthly(state);
  const guaranteeInfo = selectGuarantee(state);

  const { display, scale } = useAnimatedPrice(total, reduceMotion);

  if (total == null) return null;

  const totalLabel = usd(display);
  const monthlyLabel = monthly == null ? null : perMonth(monthly);

  return (
    <>
      {/* Desktop: fixed top-right card */}
      <motion.aside
        style={{ scale }}
        initial={reduceMotion ? false : { opacity: 0, y: -12 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        aria-label="Your roof price"
        className="fixed right-6 top-24 z-40 hidden w-72 rounded-2xl border border-navy-950/10 bg-white p-6 shadow-xl md:block"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Your Roof</p>
        <p className="mt-2 font-display text-4xl font-semibold tabular-nums text-navy-950">
          {totalLabel}
        </p>
        {monthlyLabel && (
          <p className="mt-1 text-sm text-ink/70">or approximately {monthlyLabel}*</p>
        )}
        {guaranteeInfo && (
          <div className="mt-4">
            <GuaranteeChip level={guaranteeInfo.level} years={guaranteeInfo.years} />
          </div>
        )}
      </motion.aside>

      {/* Mobile: fixed bottom bar */}
      <motion.div
        style={{ scale }}
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        aria-label="Your roof price"
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 bg-navy-950 px-4 py-3 md:hidden"
      >
        <div className="tabular-nums text-white">
          <p className="text-lg font-semibold">{totalLabel}</p>
          {monthlyLabel && <p className="text-xs text-white/70">{monthlyLabel}*</p>}
        </div>
        <Link
          to="/build"
          className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Review
        </Link>
      </motion.div>
    </>
  );
}
