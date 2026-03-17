const AuthDivider = () => {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-[var(--color-border)]" />
      <span className="font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">or</span>
      <span className="h-px flex-1 bg-[var(--color-border)]" />
    </div>
  );
};

export default AuthDivider;



