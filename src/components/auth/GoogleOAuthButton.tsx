interface GoogleOAuthButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M12 10.2v3.9h5.4c-.2 1.2-.9 2.3-1.9 3.1l3 2.3c1.8-1.6 2.8-4.1 2.8-7 0-.7-.1-1.5-.2-2.2H12z"
    />
    <path
      fill="#34A853"
      d="M12 21c2.5 0 4.6-.8 6.2-2.2l-3-2.3c-.8.5-1.9.9-3.2.9-2.5 0-4.6-1.7-5.3-3.9l-3.1 2.4C5.2 19 8.3 21 12 21z"
    />
    <path
      fill="#FBBC05"
      d="M6.7 13.5c-.2-.5-.3-1-.3-1.5s.1-1.1.3-1.5L3.6 8.1C3 9.2 2.7 10.5 2.7 12s.3 2.8.9 3.9l3.1-2.4z"
    />
    <path
      fill="#4285F4"
      d="M12 6.6c1.3 0 2.5.5 3.4 1.4l2.5-2.5C16.6 4.2 14.5 3.3 12 3.3 8.3 3.3 5.2 5.3 3.6 8.1l3.1 2.4c.7-2.2 2.8-3.9 5.3-3.9z"
    />
  </svg>
);

const GoogleOAuthButton = ({ onClick, disabled = false }: GoogleOAuthButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-transparent px-4 py-[14px] font-body text-[12px] text-[var(--color-primary)] transition-colors hover:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-65"
    >
      <span className="inline-flex w-4 items-center justify-center">
        <GoogleIcon />
      </span>
      <span className="flex-1 text-center">Continue with Google</span>
      <span className="w-4" aria-hidden="true" />
    </button>
  );
};

export default GoogleOAuthButton;


