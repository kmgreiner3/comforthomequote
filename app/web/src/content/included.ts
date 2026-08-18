// The 12 "what's included" tiles. Copy condensed from docs/client/website-copy.md
// to 1-2 concise, benefit-first sentences per the rendering rules (no em
// dashes, trim to the point). Three tiles carry a bit more detail and expand
// in place: Decking, Permits & Inspections, and Wind Mitigation Report.
import type { ComponentType, SVGProps } from 'react';
import {
  CleanupIcon,
  DeckingIcon,
  DripEdgeIcon,
  FlashingIcon,
  GooseneckIcon,
  PermitsIcon,
  PipeBootIcon,
  PropertyProtectionIcon,
  RemovalIcon,
  StarterStripIcon,
  VentilationIcon,
  WindReportIcon,
} from './icons';

export interface IncludedTile {
  id: string;
  title: string;
  summary: string;
  expanded?: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

// Shared with the Review step's decking disclosure line, so the two never drift.
export const DECKING_DISCLOSURE =
  'The first 5 sheets of replacement decking are included. Additional sheets are $78 each.';

export const INCLUDED_TILES: IncludedTile[] = [
  {
    id: 'removal',
    title: 'Roof Removal & Preparation',
    summary: 'We remove your existing roof down to the decking, then inspect and prepare it for your new system.',
    Icon: RemovalIcon,
  },
  {
    id: 'decking',
    title: 'Decking Inspection & Replacement',
    summary: `We inspect your decking and replace what needs it. ${DECKING_DISCLOSURE}`,
    expanded:
      'Hidden damage is not always visible until the old roof comes off, so your final decking need is confirmed once removal begins.',
    Icon: DeckingIcon,
  },
  {
    id: 'ventilation',
    title: 'Ventilation Optimization',
    summary:
      'Ridge, off-ridge, and soffit vents balance intake and exhaust so your attic manages heat and moisture properly.',
    Icon: VentilationIcon,
  },
  {
    id: 'pipe-boots',
    title: 'New Pipe Boots',
    summary: 'Every roof penetration gets a new seal, so old or cracked boots do not turn into future leaks.',
    Icon: PipeBootIcon,
  },
  {
    id: 'gooseneck',
    title: 'Gooseneck Vents',
    summary: 'Fresh flashing and seals on every gooseneck vent for reliable weather protection.',
    Icon: GooseneckIcon,
  },
  {
    id: 'drip-edge',
    title: 'New Drip Edge',
    summary: 'New drip edge directs water away from your decking and fascia. Gutters are detached and reset where needed.',
    Icon: DripEdgeIcon,
  },
  {
    id: 'starter-strip',
    title: 'Starter Strip',
    summary: 'A proper starter strip keeps your first course aligned and adds wind resistance right at the edge.',
    Icon: StarterStripIcon,
  },
  {
    id: 'flashing',
    title: 'Flashing Inspection',
    summary: 'We inspect wall, chimney, counter, and step flashing, and address or replace anything that needs it.',
    Icon: FlashingIcon,
  },
  {
    id: 'property-protection',
    title: 'Property Protection',
    summary: 'Tarps and netting protect your landscaping, siding, windows, driveway, and walkways throughout the project.',
    Icon: PropertyProtectionIcon,
  },
  {
    id: 'permits',
    title: 'Permits & Inspections',
    summary: 'We handle it: your full county permitting and inspection process, start to finish.',
    expanded: 'That includes photographic documentation and closing out the permit with the county, so you do not have to.',
    Icon: PermitsIcon,
  },
  {
    id: 'cleanup',
    title: 'Cleanup & Debris Removal',
    summary: 'A dumpster stays on site, we clean up throughout, run a final magnet sweep, and walk the property with your project manager.',
    Icon: CleanupIcon,
  },
  {
    id: 'wind-mitigation',
    title: 'Complimentary Wind Mitigation Report',
    summary: 'After your final inspection, we provide a wind mitigation report at no charge.',
    expanded:
      'It documents features Florida insurance carriers may consider for wind mitigation discounts on your policy.',
    Icon: WindReportIcon,
  },
];
