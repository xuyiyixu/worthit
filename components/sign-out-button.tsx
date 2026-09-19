"use client";

export function SignOutButton() {
  const signOut = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.assign("/login");
  };

  return <button className="header-link" type="button" onClick={signOut}>Log out</button>;
}
