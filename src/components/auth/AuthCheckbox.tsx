import { Check } from "lucide-react";

interface AuthCheckboxProps {
  id: string;
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}

const AuthCheckbox = ({ id, checked, label, onChange }: AuthCheckboxProps) => {
  return (
    <label htmlFor={id} className="mt-4 inline-flex cursor-pointer items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        className={`mt-[2px] flex h-4 w-4 items-center justify-center border ${
          checked ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-[var(--color-border)] bg-transparent"
        }`}
      >
        {checked ? <Check className="h-3 w-3 text-white" /> : null}
      </span>
      <span className="font-body text-[12px] text-[var(--color-muted)]">{label}</span>
    </label>
  );
};

export default AuthCheckbox;



