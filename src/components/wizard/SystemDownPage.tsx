import experianLogo from "@/assets/experian_idfKXIhI6C_0.png";

export function SystemDownPage({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-500">
        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>

      <h2 className="text-xl font-bold">Systems temporarily unavailable</h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Our credit check service is currently unavailable. Please try again in a few minutes.
      </p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Your information has been saved — you won't need to start over.
      </p>

      <button
        onClick={onRetry}
        className="mt-6 rounded-xl px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)]"
        style={{ backgroundImage: "var(--gradient-primary)" }}
      >
        Try again
      </button>

      <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Credit bureau partner</span>
        <img src={experianLogo} alt="Experian" className="h-8" />
      </div>
    </div>
  );
}
