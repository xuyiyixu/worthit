import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

export function SiteHeader({ progress = 0, onHome, signedIn = false }: { progress?: number; onHome?: () => void; signedIn?: boolean }) {
  return (
    <header className="site-header">
      {onHome ? (
        <button className="wordmark" onClick={onHome}>Worth<span>It</span><i>.</i></button>
      ) : (
        <Link className="wordmark" href="/">Worth<span>It</span><i>.</i></Link>
      )}
      <nav className="header-nav" aria-label="Primary navigation">
        <Link href="/history">History</Link>
        <Link href="/decide">Decide</Link>
        {signedIn && <SignOutButton />}
      </nav>
      <div className="journey-wrap">
        <span className="journey-label">Progress {progress}%</span>
        <div className="journey" role="progressbar" aria-label="Decision progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="header-note">Know before you go</div>
    </header>
  );
}
