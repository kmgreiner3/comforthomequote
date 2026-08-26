import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import type { LatLngCorner, MapMeta } from '../../lib/mapMeta';
import { latLngToImagePx } from '../../lib/mercator';

// Matches CSS object-fit keywords to the SVG preserveAspectRatio value that
// makes the overlay's viewBox scale the SAME way the <img> does, so the
// polygon stays registered to the photo at every viewport width -- this is
// the actual fix for the reported bug (feedback round 6): the confirm
// card's <img> uses object-cover (crops to fill, via "slice"), while the
// editor's <img> is unconstrained/full-bleed (no cropping, via "none").
// Getting this wrong is exactly how the old baked-in-pixel overlay's
// client-side would-be replacement could still drift off the photo.
const PRESERVE_ASPECT_RATIO = {
  cover: 'xMidYMid slice',
  none: 'none',
} as const;

export type OverlayObjectFit = keyof typeof PRESERVE_ASPECT_RATIO;

// Always applied to the container, regardless of what `className` adds.
// `relative` is load-bearing: the svg overlay below is `absolute
// inset-0`-positioned against this box, so a caller-supplied className
// that happens to omit it must not be able to silently break the quad's
// registration to the photo. `overflow-hidden` matches every current
// caller and is harmless to always include.
const BASE_CONTAINER_CLASSNAME = 'relative overflow-hidden';

export interface RoofOutlineOverlayProps {
  imageUrl: string;
  alt: string;
  mapMeta: MapMeta;
  corners: LatLngCorner[];
  objectFit?: OverlayObjectFit;
  className?: string;
  style?: CSSProperties;
  imgClassName?: string;
  onImgError?: () => void;
  children?: ReactNode;
  containerTestId?: string;
}

// Shared aerial-photo + roof-outline-quad renderer (feedback round 6): the
// confirm card (read-only) and the adjust-outline editor (draggable handles
// layered on top via `children`) both render through this ONE component so
// they can never draw a different rectangle than what's actually stored.
// The <img> and the <svg> overlay share the same relatively-positioned
// container box, and the svg's viewBox is mapMeta.imgW x imgH with a
// preserveAspectRatio matching the img's own object-fit -- together, that's
// what keeps the quad registered to the photo regardless of how the
// container itself is sized/cropped at any given viewport width.
const RoofOutlineOverlay = forwardRef<HTMLDivElement, RoofOutlineOverlayProps>(function RoofOutlineOverlay(
  { imageUrl, alt, mapMeta, corners, objectFit = 'cover', className, style, imgClassName, onImgError, children, containerTestId },
  ref
) {
  const points = corners
    .map(({ lat, lng }) => latLngToImagePx(lat, lng, mapMeta))
    .map((p) => `${p.x},${p.y}`)
    .join(' ');

  return (
    <div
      ref={ref}
      data-testid={containerTestId}
      className={`${BASE_CONTAINER_CLASSNAME} ${className ?? 'w-full'}`}
      style={style}
    >
      <img
        src={imageUrl}
        alt={alt}
        draggable={false}
        onError={onImgError}
        className={imgClassName ?? 'block h-full w-full object-cover'}
      />
      <svg
        viewBox={`0 0 ${mapMeta.imgW} ${mapMeta.imgH}`}
        preserveAspectRatio={PRESERVE_ASPECT_RATIO[objectFit]}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <polygon
          points={points}
          className="fill-blue-600/20 stroke-blue-600"
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {children}
    </div>
  );
});

export default RoofOutlineOverlay;
