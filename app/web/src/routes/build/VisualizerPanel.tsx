import { useEffect, useRef, useState } from 'react';
import type { ShingleKey } from '@chq/pricing';
import { useBuild } from '../../state/build';
import Lightbox from '../../components/Lightbox';
import { downscaleToJpeg } from '../../lib/downscale';

// Exact copy per the visualizer brief. Do not reword casually.
export const VIZ_DISCLAIMER = 'AI preview for inspiration only. Actual color and appearance will vary.';
const ERROR_GENERIC = 'We could not generate this preview.';
const ERROR_DAILY_LIMIT = 'Daily preview limit reached. Try again tomorrow.';

// Presigned render URLs live 15 minutes; the ids and inputs fully determine
// the output, so a session-wide module cache means clicking back and forth
// between colors never re-requests a render the session already has.
const renderCache = new Map<string, string>();

function cacheKey(uploadId: string, product: string, color: string, dripEdge: string | null) {
  return `${uploadId}|${product}|${color}|${dripEdge ?? ''}`;
}

type RenderOutcome =
  | { kind: 'ok'; url: string }
  | { kind: 'expired' }
  | { kind: 'daily-limit' }
  | { kind: 'failed' };

// Concurrent identical requests (StrictMode double-mount, rapid re-clicks)
// share one fetch so the backend caps are only ever charged once per
// distinct render. Settled entries are dropped: failures stay retryable,
// successes live in renderCache.
const inflight = new Map<string, Promise<RenderOutcome>>();

function requestRender(
  key: string,
  body: { uploadId: string; product: string; color: string; dripEdge?: string },
): Promise<RenderOutcome> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = (async (): Promise<RenderOutcome> => {
    try {
      const res = await fetch('/api/visualize/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 404) return { kind: 'expired' };
      if (res.status === 429) {
        const parsed = (await res.json().catch(() => null)) as { error?: string } | null;
        return parsed?.error === 'daily-limit' ? { kind: 'daily-limit' } : { kind: 'failed' };
      }
      if (!res.ok) return { kind: 'failed' };
      const parsed = (await res.json()) as { url: string };
      renderCache.set(key, parsed.url);
      return { kind: 'ok', url: parsed.url };
    } catch {
      return { kind: 'failed' };
    }
  })();
  inflight.set(key, p);
  void p.finally(() => inflight.delete(key));
  return p;
}

type Phase = 'idle' | 'uploading' | 'generating' | 'ready';

/**
 * "See it on your home": photo upload plus AI roof recolor previews on the
 * appearance step. Renders swap when the color or drip edge selection
 * changes. Generation is owned entirely by the effect below -- upload only
 * stores the new uploadId. Everything degrades silently when the API is
 * unreachable: the panel shows its error line, the rest of the step is
 * untouched.
 */
export default function VisualizerPanel({ product }: { product: ShingleKey }) {
  const color = useBuild((s) => s.color);
  const dripEdge = useBuild((s) => s.dripEdge);
  const uploadId = useBuild((s) => s.vizUploadId);
  const setVizUploadId = useBuild((s) => s.setVizUploadId);

  const [phase, setPhase] = useState<Phase>('idle');
  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Increments on every render request; a stale response (an earlier color
  // the user already clicked past) must not overwrite the latest one.
  const requestSeq = useRef(0);
  // Read inside the async continuation without joining the effect deps.
  const renderUrlRef = useRef<string | null>(null);
  renderUrlRef.current = renderUrl;

  useEffect(() => {
    if (!uploadId || !color || uploading) return;

    const key = cacheKey(uploadId, product, color, dripEdge);
    const cached = renderCache.get(key);
    if (cached) {
      setRenderUrl(cached);
      setPhase('ready');
      setError(null);
      return;
    }

    const seq = ++requestSeq.current;
    setPhase('generating');
    setError(null);
    void requestRender(key, {
      uploadId,
      product,
      color,
      ...(dripEdge ? { dripEdge } : {}),
    }).then((outcome) => {
      if (seq !== requestSeq.current) return;
      if (outcome.kind === 'ok') {
        setRenderUrl(outcome.url);
        setPhase('ready');
        return;
      }
      if (outcome.kind === 'expired') {
        // Upload expired server-side (30-day lifecycle). Back to square one.
        setVizUploadId(null);
        setRenderUrl(null);
        setPhase('idle');
        return;
      }
      setPhase(renderUrlRef.current ? 'ready' : 'idle');
      setError(outcome.kind === 'daily-limit' ? ERROR_DAILY_LIMIT : ERROR_GENERIC);
    });
  }, [uploadId, color, dripEdge, product, uploading, setVizUploadId]);

  async function onFileChosen(file: File) {
    setUploading(true);
    setPhase('uploading');
    setError(null);
    setRenderUrl(null);
    try {
      const jpeg = await downscaleToJpeg(file);
      const res = await fetch('/api/visualize/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contentType: 'image/jpeg' }),
      });
      if (!res.ok) throw new Error('upload-failed');
      const { uploadId: newId, putUrl } = (await res.json()) as { uploadId: string; putUrl: string };
      const put = await fetch(putUrl, {
        method: 'PUT',
        headers: { 'content-type': 'image/jpeg' },
        body: jpeg,
      });
      if (!put.ok) throw new Error('upload-failed');
      setVizUploadId(newId);
      setPhase('idle'); // the effect takes over and generates when a color is set
    } catch {
      setPhase('idle');
      setError(ERROR_GENERIC);
    } finally {
      setUploading(false);
    }
  }

  const busy = phase === 'uploading' || phase === 'generating';

  return (
    <section data-testid="visualizer-panel" className="rounded-2xl border-2 border-navy-950/10 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">See it on your home</p>

      {!uploadId && !busy && (
        <div className="mt-3">
          <p className="text-sm text-ink/70">
            Upload a photo of the front of your home and we will show your selected shingle color on your roof.
          </p>
          <input
            ref={fileInputRef}
            data-testid="viz-file-input"
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFileChosen(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 min-h-[44px] rounded-xl border-2 border-blue-600 px-5 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-600/5"
          >
            Upload a photo
          </button>
        </div>
      )}

      {busy && (
        <div
          data-testid="viz-busy"
          className="mt-4 flex aspect-video w-full items-center justify-center rounded-xl bg-sky-50"
        >
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600/30 border-t-blue-600" />
          <span className="ml-3 text-sm text-ink/70">
            {phase === 'uploading' ? 'Preparing your photo' : 'Generating your preview'}
          </span>
        </div>
      )}

      {phase === 'ready' && renderUrl && (
        <div className="mt-4">
          <button
            type="button"
            data-testid="viz-render"
            onClick={() => setZoomed(true)}
            className="block w-full overflow-hidden rounded-xl border border-navy-950/10"
          >
            <img src={renderUrl} alt={`Your home with ${color ?? 'the selected'} shingles`} className="w-full" />
          </button>
          <button
            type="button"
            onClick={() => {
              setVizUploadId(null);
              setRenderUrl(null);
              setPhase('idle');
              setError(null);
            }}
            className="mt-2 text-sm font-medium text-blue-600 underline-offset-2 hover:underline"
          >
            Use a different photo
          </button>
        </div>
      )}

      {uploadId && !busy && phase !== 'ready' && !error && (
        <p className="mt-3 text-sm text-ink/70">Pick a color above to see it on your home.</p>
      )}

      {error && (
        <p data-testid="viz-error" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <p className="mt-4 text-xs text-ink/50">{VIZ_DISCLAIMER}</p>

      {zoomed && renderUrl && (
        <Lightbox
          images={[{ src: renderUrl, alt: `Your home with ${color ?? 'the selected'} shingles` }]}
          index={0}
          onClose={() => setZoomed(false)}
        />
      )}
    </section>
  );
}
