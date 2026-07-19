import Link from "next/link";
import { PageShell } from "@/components/Shell";
import { openApiDocument } from "@/lib/openapi";

interface Operation {
  tags?: readonly string[];
  summary?: string;
}

const METHOD_COLOR: Record<string, string> = {
  GET: "var(--cyan)",
  POST: "var(--iris)",
  PUT: "var(--fair)",
  DELETE: "var(--weak)",
};

function collectByTag() {
  const paths = openApiDocument.paths as Record<string, Record<string, Operation>>;
  const groups: Record<string, { method: string; path: string; summary: string }[]> = {};
  for (const [path, ops] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(ops)) {
      const tag = op.tags?.[0] ?? "Other";
      (groups[tag] ??= []).push({ method: method.toUpperCase(), path, summary: op.summary ?? "" });
    }
  }
  return groups;
}

export default function ApiDocsPage() {
  const groups = collectByTag();
  return (
    <PageShell>
      <header style={{ padding: "40px 0 8px" }}>
        <div className="eyebrow">REST API · OpenAPI 3.1</div>
        <h1 className="mast" style={{ fontSize: "clamp(28px, 5vw, 46px)" }}>
          {openApiDocument.info.title}
        </h1>
        <p className="lead">{openApiDocument.info.description}</p>
        <div className="btns" style={{ marginTop: 20 }}>
          <Link href="/api/openapi" className="btn btn-secondary" prefetch={false}>
            Download OpenAPI JSON
          </Link>
        </div>
      </header>

      {openApiDocument.tags.map((t) => {
        const endpoints = groups[t.name];
        if (!endpoints) return null;
        return (
          <section key={t.name} className="block">
            <div className="sec-head">
              <div>
                <span className="idx">{t.name}</span>
                <h2 className="sec">{t.description}</h2>
              </div>
            </div>
            <div className="card" style={{ padding: 0 }}>
              {endpoints.map((e) => (
                <div
                  key={`${e.method} ${e.path}`}
                  style={{ display: "flex", gap: 14, alignItems: "baseline", padding: "13px 18px", borderBottom: "1px solid var(--border)" }}
                >
                  <span
                    className="mono"
                    style={{ color: METHOD_COLOR[e.method] ?? "var(--text)", fontWeight: 700, fontSize: 12, minWidth: 54 }}
                  >
                    {e.method}
                  </span>
                  <span className="mono" style={{ fontSize: 13, minWidth: 260 }}>
                    {e.path}
                  </span>
                  <span style={{ fontSize: 13.5, color: "var(--text-mut)" }}>{e.summary}</span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </PageShell>
  );
}
