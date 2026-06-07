'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible label for the switch. */
  label?: string;
  disabled?: boolean;
}

/**
 * iOS-style on/off switch - the control everyone already understands. Green when
 * on, knob slides. Use anywhere a boolean preference is toggled.
 */
export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[26px] w-[44px] shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50 ${
        checked ? 'bg-[#43d18b]' : 'bg-[#39434f]'
      }`}
    >
      <span
        className={`inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.35)] transition-transform duration-200 ${
          checked ? 'translate-x-[20px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}
