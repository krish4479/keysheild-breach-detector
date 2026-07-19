import type { AuditTag } from "@/lib/audit";

export function AuditRow({
  ts,
  title,
  detail,
  tag,
}: {
  ts: string | Date;
  title: string;
  detail?: string;
  tag: AuditTag;
}) {
  const time = new Date(ts).toLocaleTimeString("en-GB", { hour12: false });
  const tagClass = tag === "alert" ? "crit" : tag === "info" || tag === "system" ? "info" : "";
  return (
    <div className="row">
      <span className="ts">{time}</span>
      <span className="act">
        <b>{title}</b>
        {detail ? (
          <>
            {" · "}
            <span>{detail}</span>
          </>
        ) : null}
      </span>
      <span className={`tag-pill ${tagClass}`}>{tag}</span>
    </div>
  );
}
