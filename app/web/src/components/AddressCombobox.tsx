import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

// Shared by Landing's hero input and StepAddress (feedback round 5, Task B
// item 1). Debounced (250ms), min 4 chars, proxies through the server-side
// /api/address-suggest so the Google key never reaches the client. Any
// degrade signal -- {available:false}, a non-200, a network error, or a
// malformed body -- is treated identically: no dropdown, no error text,
// the input just keeps behaving like a plain text field. This component
// owns the fetch/debounce/ARIA-combobox mechanics only; it is the caller's
// job to decide what a selection or free-typed submit means (validation,
// storing the address, navigating).

export interface AddressSuggestion {
  description: string;
  placeId: string;
}

const MIN_CHARS = 4;
const DEBOUNCE_MS = 250;

interface AddressComboboxProps {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (description: string, placeId: string) => void;
  placeholder?: string;
  inputClassName: string;
  wrapperClassName?: string;
}

function newSessionToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older browsers) --
  // never actually reached in supported targets, just avoids a hard crash.
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AddressCombobox({
  id,
  value,
  onValueChange,
  onSelect,
  placeholder,
  inputClassName,
  wrapperClassName = 'relative',
}: AddressComboboxProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // One token per focus-to-selection "session" (Places Autocomplete billing
  // semantics): created on focus if none is active, discarded on
  // selection so the next focus starts a fresh session.
  const sessionTokenRef = useRef<string | null>(null);
  // Selecting a suggestion updates `value` via onSelect -> the parent
  // re-renders with the new value -> this component's fetch effect would
  // otherwise immediately re-fire for that description text. Skip exactly
  // that one resulting fetch.
  const skipNextFetchRef = useRef(false);
  const listboxId = `${id}-listbox`;

  function ensureSessionToken(): string {
    if (!sessionTokenRef.current) sessionTokenRef.current = newSessionToken();
    return sessionTokenRef.current;
  }

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    const trimmed = value.trim();
    if (trimmed.length < MIN_CHARS) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch('/api/address-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: trimmed, sessionToken: ensureSessionToken() }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) return null;
          try {
            return (await res.json()) as { suggestions?: unknown; available?: boolean };
          } catch {
            return null;
          }
        })
        .then((data) => {
          const list =
            data && data.available !== false && Array.isArray(data.suggestions) ? data.suggestions : [];
          const valid: AddressSuggestion[] = list.filter(
            (s): s is AddressSuggestion =>
              !!s && typeof s === 'object' && typeof s.description === 'string' && typeof s.placeId === 'string'
          );
          setSuggestions(valid);
          setOpen(valid.length > 0);
          setActiveIndex(-1);
        })
        .catch(() => {
          // Network error, abort, or anything else fetch/json can throw --
          // degrade silently, same as a non-200 or {available:false}.
          setSuggestions([]);
          setOpen(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function closeDropdown() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleSelect(s: AddressSuggestion) {
    sessionTokenRef.current = null; // discarded on selection
    skipNextFetchRef.current = true;
    setSuggestions([]);
    closeDropdown();
    onSelect(s.description, s.placeId);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      if (open) closeDropdown();
      return;
    }
    if (!open || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]!);
    }
  }

  return (
    <div className={wrapperClassName}>
      <input
        id={id}
        name="address"
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onFocus={ensureSessionToken}
        onKeyDown={handleKeyDown}
        onBlur={closeDropdown}
        className={inputClassName}
      />
      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Address suggestions"
          className="absolute left-0 top-full z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-navy-950/10 bg-white py-1 text-left shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              id={`${id}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              // Prevents the input's blur (which would close the dropdown
              // before the click's onClick ever runs) from firing on
              // mousedown -- the standard combobox-option click pattern.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(s)}
              className={`cursor-pointer px-4 py-2.5 text-sm text-ink ${
                i === activeIndex ? 'bg-blue-600/10 text-blue-600' : 'hover:bg-navy-950/5'
              }`}
            >
              {s.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
