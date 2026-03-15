import { useState, type ReactNode } from "react";

interface AuthInputFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  type?: "text" | "email" | "tel" | "password";
  required?: boolean;
  autoComplete?: string;
  error?: string;
  touched?: boolean;
  helperText?: string;
  trailingControl?: ReactNode;
}

const AuthInputField = ({
  id,
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  required = false,
  autoComplete,
  error,
  touched = false,
  helperText,
  trailingControl,
}: AuthInputFieldProps) => {
  const [isFocused, setIsFocused] = useState(false);

  const hasValue = value.trim().length > 0;
  const shouldFloatLabel = isFocused || hasValue;
  const showSuccess = touched && hasValue && !error;
  const borderClass = error ? "border-[#C0392B]" : showSuccess ? "border-[#C4A882]" : "border-[#d4ccc2]";

  return (
    <div className="pt-[14px]">
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          placeholder=" "
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlur();
          }}
          className={`w-full border-0 border-b ${borderClass} bg-transparent pb-[10px] pt-[16px] pr-8 font-body text-[14px] text-[#1A1A1A] transition-colors duration-200 placeholder:text-transparent focus:border-[#1A1A1A] focus:outline-none`}
        />

        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-0 font-body transition-all duration-200 ${
            shouldFloatLabel
              ? "top-[2px] text-[10px] uppercase tracking-[0.12em] text-[#C4A882]"
              : "top-[20px] text-[14px] text-[#888888]"
          }`}
        >
          {label}
          {required ? <span className="ml-[2px] text-[#C0392B]">*</span> : null}
        </label>

        {trailingControl ? <div className="absolute right-0 top-[17px]">{trailingControl}</div> : null}
      </div>

      {helperText ? <p className="mt-[6px] font-body text-[11px] text-[#aaaaaa]">{helperText}</p> : null}
      {error ? <p className="mt-[6px] font-body text-[11px] text-[#C0392B]">{error}</p> : null}
    </div>
  );
};

export default AuthInputField;
