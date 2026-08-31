import { useState, type FormEvent } from 'react';
import { useBuild, type Contact } from '../../state/build';
import { BackChevron, PrimaryButton, StepHeading } from '../build/ui';
import { RevealGroup, RevealItem } from '../build/motion';
import { DemoNotice, Field, inputClass } from './ui';

const CONTACT_METHODS = ['Phone', 'Text', 'Email'] as const;

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
  billing?: string;
  method?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function digitsOnly(v: string): string {
  return v.replace(/\D/g, '');
}

export default function StepInfo({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const address = useBuild((s) => s.address);
  const saved = useBuild((s) => s.contact);
  const setContact = useBuild((s) => s.setContact);

  const [name, setName] = useState(saved?.name ?? '');
  const [phone, setPhone] = useState(saved?.phone ?? '');
  const [email, setEmail] = useState(saved?.email ?? '');
  // Feedback round 8, item 16: "Same as the address where work is being
  // done" mirrors the property address into billing (read-only) while
  // checked. `billingDraft` keeps whatever was manually typed BEFORE
  // checking, so unchecking restores it exactly rather than clearing it.
  const [sameAsProperty, setSameAsProperty] = useState(false);
  const [billingDraft, setBillingDraft] = useState(saved?.billing ?? '');
  const billing = sameAsProperty ? address ?? '' : billingDraft;
  const [method, setMethod] = useState(saved?.method ?? '');
  const [errors, setErrors] = useState<FormErrors>({});

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!name.trim()) next.name = 'Enter your full name.';
    if (digitsOnly(phone).length < 10) next.phone = 'Enter a valid 10-digit phone number.';
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!billing.trim()) next.billing = 'Enter your billing address.';
    if (!method) next.method = 'Choose a preferred contact method.';
    return next;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const contact: Contact = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      billing: billing.trim(),
      method,
    };
    setContact(contact);
    onContinue();
  }

  return (
    <RevealGroup>
      <RevealItem>
        <BackChevron onClick={onBack} />
        <StepHeading
          eyebrow="Your information"
          title="Let's get your project started"
          subtitle="We need this information to begin scheduling, permitting, and preparing your project for installation."
        />
      </RevealItem>

      <RevealItem>
        <DemoNotice />
      </RevealItem>

      <RevealItem>
        <form onSubmit={handleSubmit} noValidate className="mt-6 max-w-xl space-y-5">
          <Field label="Full name" htmlFor="info-name" error={errors.name}>
            <input
              id="info-name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Phone" htmlFor="info-phone" error={errors.phone}>
            <input
              id="info-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="(813) 555-0100"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Email" htmlFor="info-email" error={errors.email}>
            <input
              id="info-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Property address" htmlFor="info-address" hint="This is the address you built your roof for.">
            <input
              id="info-address"
              name="property-address"
              type="text"
              readOnly
              value={address ?? ''}
              className={`${inputClass} cursor-not-allowed bg-sky-50 text-ink/60`}
            />
          </Field>

          <label className="flex min-h-[44px] items-center gap-2 text-sm text-ink/80">
            <input
              id="info-billing-same-as-property"
              type="checkbox"
              checked={sameAsProperty}
              onChange={(e) => setSameAsProperty(e.target.checked)}
              className="h-4 w-4 rounded border-2 border-navy-950/30 text-blue-600 focus:ring-blue-600"
            />
            Same as the address where work is being done
          </label>

          <Field label="Billing address" htmlFor="info-billing" error={errors.billing}>
            <input
              id="info-billing"
              name="billing-address"
              type="text"
              autoComplete="billing street-address"
              readOnly={sameAsProperty}
              value={billing}
              onChange={(e) => setBillingDraft(e.target.value)}
              className={`${inputClass} ${sameAsProperty ? 'cursor-not-allowed bg-sky-50 text-ink/60' : ''}`}
            />
          </Field>

          <Field label="Preferred contact method" htmlFor="info-method" error={errors.method}>
            <select
              id="info-method"
              name="contact-method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                Choose one
              </option>
              {CONTACT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>

          <PrimaryButton type="submit" className="w-full sm:w-auto">
            Continue
          </PrimaryButton>
        </form>
      </RevealItem>
    </RevealGroup>
  );
}
