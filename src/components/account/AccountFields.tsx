import { useState, type ReactNode } from "react";

interface BaseFieldProps {
  id: string;
  label: string;
  required?: boolean;
  touched?: boolean;
  error?: string;
  helperText?: string;
}

interface AccountInputFieldProps extends BaseFieldProps {
  type?: "text" | "email" | "tel" | "password" | "date";
  value: string;
  placeholder?: string;
  autoComplete?: string;
  readOnly?: boolean;
  trailingControl?: ReactNode;
  onBlur: () => void;
  onChange: (value: string) => void;
}

interface AccountSelectFieldProps extends BaseFieldProps {
  value: string;
  options: Array<{ value: string; label: string }>;
  onBlur: () => void;
  onChange: (value: string) => void;
}

interface AccountTextareaFieldProps extends BaseFieldProps {
  value: string;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
  onBlur: () => void;
  onChange: (value: string) => void;
}

export const AccountInputField = ({
  id,
  label,
  type = "text",
  value,
  placeholder,
  autoComplete,
  readOnly = false,
  required = false,
  touched = false,
  error,
  helperText,
  trailingControl,
  onBlur,
  onChange,
}: AccountInputFieldProps) => {
  const [isFocused, setIsFocused] = useState(false);

  const hasValue = value.trim().length > 0;
  const shouldFloatLabel = isFocused || hasValue || type === "date";
  const showSuccess = touched && hasValue && !error && !readOnly;
  const borderClass = error ? "border-[#C0392B]" : showSuccess ? "border-[#C4A882]" : "border-[#d4ccc2]";

  return (
    <div className="pt-[14px]">
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          readOnly={readOnly}
          autoComplete={autoComplete}
          placeholder={placeholder ?? " "}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlur();
          }}
          className={`w-full border-0 border-b ${borderClass} bg-transparent pb-[10px] pt-[16px] pr-8 font-body text-[14px] text-[#1A1A1A] transition-colors duration-200 placeholder:text-transparent focus:border-[#1A1A1A] focus:outline-none ${readOnly ? "cursor-not-allowed text-[#555555]" : ""}`}
        />

        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-0 font-body transition-all duration-200 ${
            shouldFloatLabel
              ? "top-[2px] text-[10px] uppercase tracking-[0.12em] text-[#C4A882]"
              : "top-[20px] text-[14px] text-[#555555]"
          }`}
        >
          {label}
          {required ? <span className="ml-[2px] text-[#C0392B]">*</span> : null}
        </label>

        {trailingControl ? <div className="absolute right-0 top-[17px]">{trailingControl}</div> : null}
      </div>

      {helperText ? <p className="mt-[6px] font-body text-[11px] text-[#666666]">{helperText}</p> : null}
      {error ? <p className="mt-[6px] font-body text-[11px] text-[#C0392B]">{error}</p> : null}
    </div>
  );
};

export const AccountSelectField = ({
  id,
  label,
  value,
  options,
  required = false,
  touched = false,
  error,
  helperText,
  onBlur,
  onChange,
}: AccountSelectFieldProps) => {
  const hasValue = value.trim().length > 0;
  const showSuccess = touched && hasValue && !error;
  const borderClass = error ? "border-[#C0392B]" : showSuccess ? "border-[#C4A882]" : "border-[#d4ccc2]";

  return (
    <div className="pt-[14px]">
      <label htmlFor={id} className="font-body text-[10px] uppercase tracking-[0.12em] text-[#C4A882]">
        {label}
        {required ? <span className="ml-[2px] text-[#C0392B]">*</span> : null}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={`mt-[8px] h-[42px] w-full border-0 border-b ${borderClass} bg-transparent font-body text-[14px] text-[#1A1A1A] outline-none transition-colors focus:border-[#1A1A1A]`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {helperText ? <p className="mt-[6px] font-body text-[11px] text-[#666666]">{helperText}</p> : null}
      {error ? <p className="mt-[6px] font-body text-[11px] text-[#C0392B]">{error}</p> : null}
    </div>
  );
};

export const AccountTextareaField = ({
  id,
  label,
  value,
  rows = 4,
  placeholder,
  maxLength,
  required = false,
  touched = false,
  error,
  helperText,
  onBlur,
  onChange,
}: AccountTextareaFieldProps) => {
  const hasValue = value.trim().length > 0;
  const showSuccess = touched && hasValue && !error;
  const borderClass = error ? "border-[#C0392B]" : showSuccess ? "border-[#C4A882]" : "border-[#d4ccc2]";

  return (
    <div className="pt-[14px]">
      <label htmlFor={id} className="font-body text-[10px] uppercase tracking-[0.12em] text-[#C4A882]">
        {label}
        {required ? <span className="ml-[2px] text-[#C0392B]">*</span> : null}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={`mt-[8px] w-full border-0 border-b ${borderClass} bg-transparent pb-[10px] font-body text-[14px] text-[#1A1A1A] outline-none transition-colors placeholder:text-[#999999] focus:border-[#1A1A1A]`}
      />

      {maxLength ? (
        <p className="mt-[6px] text-right font-body text-[10px] text-[#777777]">
          {value.length}/{maxLength}
        </p>
      ) : null}
      {helperText ? <p className="mt-[6px] font-body text-[11px] text-[#666666]">{helperText}</p> : null}
      {error ? <p className="mt-[6px] font-body text-[11px] text-[#C0392B]">{error}</p> : null}
    </div>
  );
};

