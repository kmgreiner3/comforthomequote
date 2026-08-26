import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import AddressCombobox from './AddressCombobox';

function Wrapper({ onSelect }: { onSelect: (description: string, placeId: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <AddressCombobox
      id="test-address"
      value={value}
      onValueChange={setValue}
      onSelect={(description, placeId) => {
        setValue(description);
        onSelect(description, placeId);
      }}
      inputClassName="input"
    />
  );
}

const SUGGEST_RESPONSE = {
  suggestions: [
    { description: '123 Palm Ave, Tampa, FL 33602', placeId: 'places/1' },
    { description: '123 Palm Ave, Temple Terrace, FL 33617', placeId: 'places/2' },
  ],
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AddressCombobox: debounce + min chars', () => {
  it('does not fetch below the 4-char minimum', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<Wrapper onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'abc' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches only after the 250ms debounce elapses, not immediately', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => SUGGEST_RESPONSE })
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<Wrapper onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '123 Palm' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cancels the in-flight debounce/fetch when the value changes again before it fires', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve({ ok: true, json: async () => SUGGEST_RESPONSE })
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<Wrapper onSelect={vi.fn()} />);
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: '123 Palm' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100); // before the first debounce fires
    });
    fireEvent.change(input, { target: { value: '123 Palm A' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    // Only the second (final) value ever reaches fetch -- the first
    // debounce window never fired a request.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.input).toBe('123 Palm A');
  });
});

describe('AddressCombobox: suggestions + selection', () => {
  it('renders the suggestion list with proper ARIA combobox wiring', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => SUGGEST_RESPONSE }))
    );

    render(<Wrapper onSelect={vi.fn()} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: '123 Palm Ave' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(input.getAttribute('aria-expanded')).toBe('true');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]!.textContent).toBe('123 Palm Ave, Tampa, FL 33602');
    expect(input.getAttribute('aria-controls')).toBe(screen.getByRole('listbox').id);
  });

  it('clicking a suggestion calls onSelect with {description, placeId} and closes the dropdown', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => SUGGEST_RESPONSE }))
    );
    const onSelect = vi.fn();

    render(<Wrapper onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '123 Palm Ave' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.click(screen.getAllByRole('option')[0]!);

    expect(onSelect).toHaveBeenCalledWith('123 Palm Ave, Tampa, FL 33602', 'places/1');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe(
      '123 Palm Ave, Tampa, FL 33602'
    );
  });

  it('keyboard: ArrowDown/ArrowUp move aria-activedescendant, Enter selects the active option', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => SUGGEST_RESPONSE }))
    );
    const onSelect = vi.fn();

    render(<Wrapper onSelect={onSelect} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: '123 Palm Ave' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]!.id);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(options[1]!.id);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(
      '123 Palm Ave, Temple Terrace, FL 33617',
      'places/2'
    );
  });

  it('Escape closes the dropdown without clearing the typed text', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => SUGGEST_RESPONSE }))
    );

    render(<Wrapper onSelect={vi.fn()} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '123 Palm Ave' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(screen.getByRole('listbox')).toBeTruthy();

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input.value).toBe('123 Palm Ave');
  });

  it('blur closes the dropdown', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => SUGGEST_RESPONSE }))
    );

    render(<Wrapper onSelect={vi.fn()} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: '123 Palm Ave' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(screen.getByRole('listbox')).toBeTruthy();

    fireEvent.blur(input);

    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('AddressCombobox: degrade path', () => {
  it('degrades silently on {available:false} -- no dropdown, no thrown/console error', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ available: false }) }))
    );

    render(<Wrapper onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '123 Palm Ave' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('false');
  });

  it('degrades silently on a non-200 response', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500 })));

    render(<Wrapper onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '123 Palm Ave' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('degrades silently on a network error (rejected fetch), input remains usable', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))));

    render(<Wrapper onSelect={vi.fn()} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '123 Palm Ave' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input.value).toBe('123 Palm Ave');

    // Still perfectly usable as a plain input -- further typing doesn't
    // throw or wedge anything.
    fireEvent.change(input, { target: { value: '123 Palm Ave, Tampa, FL 33602' } });
    expect(input.value).toBe('123 Palm Ave, Tampa, FL 33602');
  });

  it('degrades silently on malformed JSON', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => {
            throw new Error('bad json');
          },
        })
      )
    );

    render(<Wrapper onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '123 Palm Ave' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('AddressCombobox: session token', () => {
  beforeEach(() => {
    let counter = 0;
    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => `token-${++counter}` as unknown as ReturnType<typeof crypto.randomUUID>,
    });
  });

  it('sends the same session token across keystrokes within one focus session', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve({ ok: true, json: async () => SUGGEST_RESPONSE })
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<Wrapper onSelect={vi.fn()} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    fireEvent.change(input, { target: { value: '123 Palm Ave' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    fireEvent.change(input, { target: { value: '123 Palm Ave T' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    const secondBody = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string);
    expect(firstBody.sessionToken).toBe(secondBody.sessionToken);
    expect(firstBody.sessionToken).toBeTruthy();
  });

  it('discards the session token on selection: the next focus generates a new one', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve({ ok: true, json: async () => SUGGEST_RESPONSE })
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<Wrapper onSelect={vi.fn()} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '123 Palm Ave' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    fireEvent.click(screen.getAllByRole('option')[0]!);

    // New focus session (e.g. re-focusing to edit further) + a fresh query.
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '123 Palm Ave, Tampa, FL 33602 apt' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    const secondBody = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string);
    expect(secondBody.sessionToken).not.toBe(firstBody.sessionToken);
  });
});
