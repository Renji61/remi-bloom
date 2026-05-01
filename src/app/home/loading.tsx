export default function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--theme-primary)] border-t-transparent" />
        <p className="text-xs text-on-surface-variant/60">Loading...</p>
      </div>
    </div>
  );
}
