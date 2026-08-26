import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AddressChip from './AddressChip';

describe('AddressChip', () => {
  it('shows the current address and calls onChange when "Change" is clicked', () => {
    const onChange = vi.fn();
    render(<AddressChip address="123 Palm Ave, Tampa, FL 33602" onChange={onChange} />);

    expect(screen.getByText('123 Palm Ave, Tampa, FL 33602')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
