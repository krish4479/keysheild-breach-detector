import { formatCount } from "@/lib/utils";

export type BreachState = "idle" | "checking" | "safe" | "breached" | "unknown";

export function BreachBadge({ state, count = 0 }: { state: BreachState; count?: number }) {
  switch (state) {
    case "checking":
      return (
        <div className="breach wait">
          <span className="dot" />
          <span>Checking Have I Been Pwned…</span>
        </div>
      );
    case "safe":
      return (
        <div className="breach safe">
          <span className="dot" />
          <span>No breaches found — safe to use</span>
        </div>
      );
    case "breached":
      return (
        <div className="breach bad" role="alert">
          <span className="dot" />
          <span>
            Found in <b style={{ margin: "0 3px" }}>{formatCount(count)}</b> known breaches
          </span>
        </div>
      );
    case "unknown":
      return (
        <div className="breach unknown">
          <span className="dot" />
          <span>Breach service unavailable — proceed with caution</span>
        </div>
      );
    default:
      return (
        <div className="breach wait">
          <span className="dot" />
          <span>Breach check runs on blur — never per keystroke</span>
        </div>
      );
  }
}
