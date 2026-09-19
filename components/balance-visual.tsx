type Verdict = "undecided" | "going" | "skip";

export function BalanceVisual({
  cost = "time · effort · money",
  upside = "people · learning · joy",
  verdict = "undecided",
  label = "WORTH"
}: {
  cost?: string;
  upside?: string;
  verdict?: Verdict;
  label?: string;
}) {
  const mark = verdict === "going" ? "✓" : verdict === "skip" ? "×" : "?";
  return (
    <div className={`balance-visual verdict-${verdict}`} aria-label={`${label}: ${verdict}. Your cost: ${cost}. Your upside: ${upside}.`}>
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="balance-center"><span>{label}</span><strong>{mark}</strong></div>
      <div className="balance-label cost-label">Your cost<small>{cost}</small></div>
      <div className="balance-label gain-label">Your upside<small>{upside}</small></div>
    </div>
  );
}
