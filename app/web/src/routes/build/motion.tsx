import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';

const DESKTOP_QUERY = '(min-width: 768px)';

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const handler = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}

// Staggered reveal for the cards/tiles within a step (~60ms between items).
export const revealGroup: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const revealItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeOut' } },
};

/**
 * Wraps a group of children (cards/tiles) with a staggered reveal. Renders
 * inert (no motion props at all) under prefers-reduced-motion.
 */
export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = Boolean(useReducedMotion());
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={revealGroup} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = Boolean(useReducedMotion());
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={revealItem}>
      {children}
    </motion.div>
  );
}

/**
 * Per-step transition: slide (mobile) / fade-lift (desktop), disabled under
 * prefers-reduced-motion. `stepKey` should be the step id so AnimatePresence
 * treats each step as a distinct element.
 */
export function StepTransition({ stepKey, children }: { stepKey: string; children: ReactNode }) {
  const reduce = Boolean(useReducedMotion());
  const isDesktop = useIsDesktop();

  if (reduce) return <div>{children}</div>;

  const variants: Variants = isDesktop
    ? {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
      }
    : {
        initial: { opacity: 0, x: 28 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -28 },
      };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stepKey}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
