import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useBuild } from '../../state/build';
import VisualizerPanel, { VIZ_DISCLAIMER } from './VisualizerPanel';

// jsdom has no canvas/image decoder: the downscale step is mocked to pass
// the chosen file straight through as the "jpeg".
vi.mock('../../lib/downscale', () => ({
  downscaleToJpeg: vi.fn(async (f: File) => f),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  useBuild.getState().reset();
  localStorage.clear();
  useBuild.getState().setShingle('tamko-titan-xt');
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function chooseFile() {
  const input = screen.getByTestId('viz-file-input');
  fireEvent.change(input, { target: { files: [new File(['x'], 'home.jpg', { type: 'image/jpeg' })] } });
}

describe('VisualizerPanel', () => {
  it('shows the upload card and the exact disclaimer before any photo exists', () => {
    render(<VisualizerPanel product="tamko-titan-xt" />);
    expect(screen.getByRole('button', { name: 'Upload a photo' })).toBeTruthy();
    expect(screen.getByText(VIZ_DISCLAIMER)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('upload flow: POST upload, presigned PUT, then generate for the current color and show the render', async () => {
    useBuild.getState().setColor('Rustic Black');
    useBuild.getState().setDripEdge('Black');
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { uploadId: 'u-1', putUrl: 'https://s3/put' }))
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce(jsonResponse(200, { url: 'https://s3/render-1' }));

    render(<VisualizerPanel product="tamko-titan-xt" />);
    chooseFile();

    await waitFor(() => expect(screen.getByTestId('viz-render')).toBeTruthy());
    expect(useBuild.getState().vizUploadId).toBe('u-1');

    expect(fetchMock.mock.calls[0]![0]).toBe('/api/visualize/upload');
    expect(fetchMock.mock.calls[1]![0]).toBe('https://s3/put');
    expect((fetchMock.mock.calls[1]![1] as RequestInit).method).toBe('PUT');
    expect(fetchMock.mock.calls[2]![0]).toBe('/api/visualize/generate');
    const genBody = JSON.parse((fetchMock.mock.calls[2]![1] as RequestInit).body as string);
    expect(genBody).toEqual({ uploadId: 'u-1', product: 'tamko-titan-xt', color: 'Rustic Black', dripEdge: 'Black' });
  });

  it('switching to an already-rendered color swaps from the in-memory cache with no new request', async () => {
    useBuild.getState().setColor('Rustic Black');
    useBuild.getState().setVizUploadId('u-cache');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { url: 'https://s3/render-rb' }));

    render(<VisualizerPanel product="tamko-titan-xt" />);
    await waitFor(() => expect(screen.getByTestId('viz-render')).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { url: 'https://s3/render-ow' }));
    act(() => useBuild.getState().setColor('Olde English Pewter'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole('img', { name: /Olde English Pewter/ })).toBeTruthy(),
    );

    // Back to the first color: cache hit, still 2 requests total.
    act(() => useBuild.getState().setColor('Rustic Black'));
    await waitFor(() => expect(screen.getByRole('img', { name: /Rustic Black/ })).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('daily-limit 429 shows the exact limit copy', async () => {
    useBuild.getState().setColor('Rustic Black');
    useBuild.getState().setVizUploadId('u-limit');
    fetchMock.mockResolvedValueOnce(jsonResponse(429, { error: 'daily-limit' }));

    render(<VisualizerPanel product="tamko-titan-xt" />);
    await waitFor(() =>
      expect(screen.getByTestId('viz-error').textContent).toBe('Daily preview limit reached. Try again tomorrow.'),
    );
  });

  it('a failed generation shows the generic copy', async () => {
    useBuild.getState().setColor('Rustic Black');
    useBuild.getState().setVizUploadId('u-fail');
    fetchMock.mockResolvedValueOnce(jsonResponse(502, { error: 'generation-failed' }));

    render(<VisualizerPanel product="tamko-titan-xt" />);
    await waitFor(() =>
      expect(screen.getByTestId('viz-error').textContent).toBe('We could not generate this preview.'),
    );
  });

  it('a 404 (expired upload) clears the persisted uploadId and returns to the upload card', async () => {
    useBuild.getState().setColor('Rustic Black');
    useBuild.getState().setVizUploadId('u-expired');
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: 'unknown upload' }));

    render(<VisualizerPanel product="tamko-titan-xt" />);
    await waitFor(() => expect(useBuild.getState().vizUploadId).toBeNull());
    expect(screen.getByRole('button', { name: 'Upload a photo' })).toBeTruthy();
  });

  it('with an upload but no color yet, prompts instead of requesting', () => {
    useBuild.getState().setVizUploadId('u-nocolor');
    render(<VisualizerPanel product="tamko-titan-xt" />);
    expect(screen.getByText('Pick a color above to see it on your home.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
