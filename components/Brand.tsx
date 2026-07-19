import Link from "next/link";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brandrow" style={{ textDecoration: "none", color: "inherit" }}>
      <span className="mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z" />
          <path d="M9.5 12l1.8 1.8L15 10" />
        </svg>
      </span>
      <span className="brandname">
        Key<b>Shield</b>
      </span>
    </Link>
  );
}
