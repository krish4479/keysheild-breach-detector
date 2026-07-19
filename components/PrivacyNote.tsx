export function PrivacyNote() {
  return (
    <div className="privacy">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <div>
        <div className="h">Plaintext never leaves your device unhashed</div>
        <div className="b">
          Passwords are never logged or stored. Only the first <code>5</code> characters of a local{" "}
          <code>SHA-1</code> hash are sent to the breach API — the suffix is compared locally.
        </div>
      </div>
    </div>
  );
}
