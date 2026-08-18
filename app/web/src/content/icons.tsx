// Inline line-icon set for the "What's Included" grid. Deliberately small and
// hand-drawn rather than pulling in an icon library: 12 icons, consistent
// 1.5px stroke, no fill, 24x24 viewBox.
import type { SVGProps } from 'react';

function IconBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function RemovalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 19h16" />
      <path d="M6 19V9.5L12 5l6 4.5V19" />
      <path d="M12 3v3" />
      <path d="M9.5 5.5 12 3l2.5 2.5" />
    </IconBase>
  );
}

export function DeckingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="4" y="6" width="16" height="3.2" rx="0.6" />
      <rect x="4" y="10.4" width="16" height="3.2" rx="0.6" />
      <rect x="4" y="14.8" width="16" height="3.2" rx="0.6" />
    </IconBase>
  );
}

export function VentilationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
      <path d="M3 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
    </IconBase>
  );
}

export function PipeBootIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 16 12 10l8 6" />
      <circle cx="12" cy="14.5" r="3.2" />
      <path d="M12 11.3V6" />
    </IconBase>
  );
}

export function GooseneckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M7 20V11a5 5 0 0 1 10 0v2" />
      <circle cx="17" cy="15" r="1.6" />
    </IconBase>
  );
}

export function DripEdgeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 6h11a3 3 0 0 1 3 3v1" />
      <path d="M15 14v4" />
      <path d="M13 16l2 2 2-2" />
    </IconBase>
  );
}

export function StarterStripIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M3 17h18" />
      <path d="M6 17v-3M10 17v-3M14 17v-3M18 17v-3" />
    </IconBase>
  );
}

export function FlashingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M6 20V9l6-5 6 5v11" />
      <path d="M9 20v-6h6v6" />
    </IconBase>
  );
}

export function PropertyProtectionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 10-4-2.5-7-5.5-7-10V6l7-3z" />
    </IconBase>
  );
}

export function PermitsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="5" y="4" width="14" height="17" rx="1.5" />
      <path d="M9 4V3h6v1" />
      <path d="M8.5 12.5l2.2 2.2L15.5 10" />
    </IconBase>
  );
}

export function CleanupIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M15 4l-9 9v3h3l9-9-3-3z" />
      <path d="M13 6l3 3" />
      <path d="M4 20h16" />
    </IconBase>
  );
}

export function WindReportIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M8 10c1.5-1.2 3-1.2 4 0" />
      <path d="M8 14c2-1.6 4.5-1.6 6.5 0" />
    </IconBase>
  );
}
