import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useBuild } from '../../state/build';
import StepInfo from './StepInfo';

const PROPERTY_ADDRESS = '123 Palm Ave, Tampa, FL 33602';

beforeEach(() => {
  useBuild.getState().reset();
  useBuild.getState().setAddress(PROPERTY_ADDRESS);
});

function fillRequiredFieldsExceptBilling() {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jamie Homeowner' } });
  fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '8135550100' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jamie@example.com' } });
  fireEvent.change(screen.getByLabelText('Preferred contact method'), { target: { value: 'Phone' } });
}

describe('StepInfo: "Same as the address where work is being done" (feedback round 8, item 16)', () => {
  it('the billing field is editable and empty by default', () => {
    render(<StepInfo onContinue={vi.fn()} onBack={vi.fn()} />);
    const billing = screen.getByLabelText('Billing address') as HTMLInputElement;
    expect(billing.readOnly).toBe(false);
    expect(billing.value).toBe('');
  });

  it('checking it mirrors the property address into billing and makes it read-only', () => {
    render(<StepInfo onContinue={vi.fn()} onBack={vi.fn()} />);

    fireEvent.click(screen.getByText('Same as the address where work is being done'));

    const billing = screen.getByLabelText('Billing address') as HTMLInputElement;
    expect(billing.value).toBe(PROPERTY_ADDRESS);
    expect(billing.readOnly).toBe(true);
  });

  it('unchecking restores the previously typed manual value, not a blank field', () => {
    render(<StepInfo onContinue={vi.fn()} onBack={vi.fn()} />);
    const billing = screen.getByLabelText('Billing address') as HTMLInputElement;

    fireEvent.change(billing, { target: { value: '789 Bay St, Tampa, FL' } });
    expect(billing.value).toBe('789 Bay St, Tampa, FL');

    fireEvent.click(screen.getByText('Same as the address where work is being done'));
    expect(billing.value).toBe(PROPERTY_ADDRESS);

    fireEvent.click(screen.getByText('Same as the address where work is being done'));
    expect(billing.value).toBe('789 Bay St, Tampa, FL');
    expect(billing.readOnly).toBe(false);
  });

  it('submitting while checked stores the property address as the billing address', () => {
    const onContinue = vi.fn();
    render(<StepInfo onContinue={onContinue} onBack={vi.fn()} />);

    fillRequiredFieldsExceptBilling();
    fireEvent.click(screen.getByText('Same as the address where work is being done'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(useBuild.getState().contact?.billing).toBe(PROPERTY_ADDRESS);
  });

  it('submitting while unchecked stores the manually typed billing address', () => {
    const onContinue = vi.fn();
    render(<StepInfo onContinue={onContinue} onBack={vi.fn()} />);

    fillRequiredFieldsExceptBilling();
    fireEvent.change(screen.getByLabelText('Billing address'), { target: { value: '789 Bay St, Tampa, FL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(useBuild.getState().contact?.billing).toBe('789 Bay St, Tampa, FL');
  });
});
