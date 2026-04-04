interface SignOutConfirmModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const SignOutConfirmModal = ({ isOpen, isSubmitting, onConfirm, onCancel }: SignOutConfirmModalProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] bg-black/35 px-4">
      <div className="mx-auto flex min-h-screen max-w-[360px] items-center">
        <div className="w-full rounded-[var(--border-radius)] bg-[var(--color-secondary)] p-10">
          <p className="font-display text-[30px] italic leading-none text-[var(--color-primary)]">Sign out?</p>
          <p className="mt-4 font-body text-[12px] font-light leading-[1.8] text-[var(--color-muted)]">
            You have items in your cart. They will be lost if you sign out.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting}
              className="w-full rounded-[var(--border-radius)] bg-[var(--color-primary)] px-4 py-[14px] font-body text-[11px] uppercase tracking-[0.16em] text-[var(--color-secondary)] transition-colors duration-300 hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] disabled:cursor-not-allowed disabled:opacity-65"
            >
              {isSubmitting ? "Please wait..." : "Sign Out Anyway"}
            </button>

            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="w-full border border-[var(--color-border)] px-4 py-[14px] font-body text-[11px] uppercase tracking-[0.16em] text-[var(--color-primary)] transition-colors hover:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-65"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignOutConfirmModal;



