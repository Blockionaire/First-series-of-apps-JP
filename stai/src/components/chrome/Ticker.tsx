import { allSignals } from "@/lib/content";
import TickerTrack from "./TickerTrack";

const KIND_TAG: Record<string, string> = {
  reg: "REG",
  standard: "STD",
  market: "MKT",
  stai: "STAI",
};

export default function Ticker() {
  const signals = allSignals();
  const items = signals.map((s) => ({
    tag: KIND_TAG[s.kind] ?? "SIG",
    label: s.label,
    detail: s.detail,
    date: s.published_at.slice(5).replace("-", "."),
    stai: s.kind === "stai",
  }));
  return <TickerTrack items={items} />;
}
