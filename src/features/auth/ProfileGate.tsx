import { useEffect, useRef, useState } from "react";
import { ArrowLeft, LogIn, Plus, UserRound, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/shared/Logo";
import { listProfiles, createProfile, verifyProfilePassword, resetProfilePassword } from "@/db/queries/profiles";
import { claimOrphanWorkspaces } from "@/db/queries/workspaces";
import type { Profile } from "@/db/types";

type Mode = "loading" | "create" | "picker" | "unlock" | "reset";

/** The login screen — a deliberately different, darker, more dramatic palette than the rest of the
 *  app (near-black with violet/wine glows) rather than the friendly everyday theme, since this is a
 *  one-time "arriving" moment, not a working screen. Fully local: profiles are just a name + a
 *  password gating that person's workspaces on THIS machine (see `passwordHash.ts`) — there is no
 *  server and nothing here is ever sent anywhere. The very first profile ever created on an existing
 *  install automatically inherits every pre-existing workspace via `claimOrphanWorkspaces`, so
 *  upgrading never orphans real trade data. Renders no background of its own — it sits on top of the
 *  persistent shared ambience (`bg` + gradient + `AuthBackdrop`) mounted once in `App.tsx`, which is
 *  what's actually showing the drifting icons behind the card. */
export function ProfileGate({ onSuccess }: { onSuccess: (id: string, name: string) => void }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exiting, setExiting] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  /** Pops and vanishes the card before actually handing off — so login resolves as a real "something
   *  big is happening" exit instead of the screen just cutting straight to the next stage. The
   *  `busy` spinner overlay (shown the instant a submit handler starts) is still mounted underneath
   *  this the whole time, so the sequence reads as one continuous beat: hit enter → spinner while it
   *  verifies → pop → vanish, not a spinner that abruptly disappears before the exit starts. */
  function succeed(id: string, name: string) {
    setExiting(true);
    setTimeout(() => onSuccess(id, name), 420);
  }

  useEffect(() => {
    listProfiles()
      .then((list) => {
        setProfiles(list);
        setMode(list.length === 0 ? "create" : "picker");
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    if (mode === "unlock") passwordRef.current?.focus();
  }, [mode]);

  function openCreate() {
    setName("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setMode("create");
  }

  function openUnlock(profile: Profile) {
    setSelected(profile);
    setPassword("");
    setError(null);
    setMode("unlock");
  }

  async function handleCreate() {
    setError(null);
    if (!name.trim()) return setError("Enter a name.");
    if (password.length < 4) return setError("Password must be at least 4 characters.");
    if (password !== confirmPassword) return setError("Passwords don't match.");
    setBusy(true);
    try {
      const isFirstEver = profiles.length === 0;
      const profile = await createProfile(name.trim(), password);
      if (isFirstEver) await claimOrphanWorkspaces(profile.id);
      succeed(profile.id, profile.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  async function handleUnlock() {
    if (!selected) return;
    setError(null);
    setBusy(true);
    try {
      const ok = await verifyProfilePassword(selected, password);
      if (ok) {
        succeed(selected.id, selected.name);
      } else {
        setError("Incorrect password.");
        setPassword("");
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  function openReset() {
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setMode("reset");
  }

  async function handleReset() {
    if (!selected) return;
    setError(null);
    if (password.length < 4) return setError("Password must be at least 4 characters.");
    if (password !== confirmPassword) return setError("Passwords don't match.");
    setBusy(true);
    try {
      await resetProfilePassword(selected.id, password);
      succeed(selected.id, selected.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6">
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <LogoMark size={56} />
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8b5cf6]">MFX Journal</span>
        </div>

        <div
          className={cn(
            "relative w-full overflow-hidden rounded-2xl border border-[#2a1a35] bg-[#0d0d14]/90 p-7 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]",
            exiting ? "animate-card-pop-vanish" : "animate-chat-bubble-in",
          )}
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#7c3aed] to-[#9f1239]" />

          {/* A real "verifying" beat the instant a submit handler starts, instead of just the button's
              own label changing — a bigger, more visible spinner over a dimmed form, fading in fast so
              it never feels like the click did nothing. Stays mounted straight through into `exiting`
              (the pop-vanish plays on the whole card, spinner included) so there's no jarring cut
              between "loading" and "success" — one continuous beat from submit to vanish. */}
          {busy && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0d0d14]/80 backdrop-blur-[1px] animate-chat-bubble-in">
              <div className="relative h-12 w-12">
                <div className="absolute inset-0 rounded-full border-2 border-[#8b5cf6]/20" />
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#8b5cf6] border-r-[#9f1239]" />
              </div>
            </div>
          )}

          {mode === "loading" && (
            <div className="flex items-center justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#8b5cf6]/30 border-t-[#8b5cf6]" />
            </div>
          )}

          {mode === "picker" && (
            <div className="space-y-4">
              <div className="text-center">
                <h1 className="text-lg font-bold text-white">Who's journaling?</h1>
                <p className="text-xs text-[#9891ab]">Pick a profile to unlock your trades.</p>
              </div>
              <div className="space-y-2">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => openUnlock(p)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-[#241a2e] bg-[#14141d] px-4 py-3 text-left transition-all hover:border-[#7c3aed]/60 hover:bg-[#1a1725]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#9f1239] text-sm font-bold text-white">
                      {p.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1 text-sm font-semibold text-white">{p.name}</span>
                    <LogIn className="h-4 w-4 text-[#6b6478] transition-colors group-hover:text-[#a78bfa]" />
                  </button>
                ))}
                <button
                  onClick={openCreate}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#2a1a35] py-3 text-sm font-medium text-[#a78bfa] transition-colors hover:border-[#7c3aed]/60 hover:bg-[#14141d]"
                >
                  <Plus className="h-4 w-4" /> New Profile
                </button>
              </div>
            </div>
          )}

          {mode === "unlock" && selected && (
            <div className="space-y-4">
              <button onClick={() => setMode("picker")} className="flex items-center gap-1 text-xs text-[#9891ab] hover:text-white">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <div className="flex flex-col items-center gap-2 pb-1">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#9f1239] text-xl font-bold text-white">
                  {selected.name.trim().charAt(0).toUpperCase()}
                </span>
                <h1 className="text-base font-bold text-white">Welcome back, {selected.name}</h1>
              </div>
              <input
                ref={passwordRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                placeholder="Password"
                className="w-full rounded-lg border border-[#241a2e] bg-[#14141d] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#5c5568] focus:border-[#7c3aed]"
              />
              {error && <p className="text-xs text-[#f87171]">{error}</p>}
              <button
                onClick={handleUnlock}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#7c3aed] to-[#9f1239] py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Unlocking…" : "Unlock"}
              </button>
              <button onClick={openReset} className="w-full text-center text-xs text-[#8b5cf6] hover:text-[#a78bfa] hover:underline">
                Forgot password?
              </button>
            </div>
          )}

          {mode === "reset" && selected && (
            <div className="space-y-4">
              <button onClick={() => setMode("unlock")} className="flex items-center gap-1 text-xs text-[#9891ab] hover:text-white">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#9f1239] shadow-[0_0_20px_-4px_rgba(139,92,246,0.6)]">
                  <KeyRound className="h-5 w-5 text-white" />
                </span>
                <h1 className="text-base font-bold text-white">Reset password for {selected.name}</h1>
                <p className="text-xs text-[#9891ab]">No email needed — this is all local. Just set a new one.</p>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                className="w-full rounded-lg border border-[#241a2e] bg-[#14141d] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#5c5568] focus:border-[#7c3aed]"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleReset()}
                placeholder="Confirm new password"
                className="w-full rounded-lg border border-[#241a2e] bg-[#14141d] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#5c5568] focus:border-[#7c3aed]"
              />
              {error && <p className="text-xs text-[#f87171]">{error}</p>}
              <button
                onClick={handleReset}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#7c3aed] to-[#9f1239] py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Reset & Log In"}
              </button>
            </div>
          )}

          {mode === "create" && (
            <div className="space-y-4">
              {profiles.length > 0 && (
                <button onClick={() => setMode("picker")} className="flex items-center gap-1 text-xs text-[#9891ab] hover:text-white">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
              )}
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#9f1239] shadow-[0_0_20px_-4px_rgba(139,92,246,0.6)]">
                  <UserRound className="h-5 w-5 text-white" />
                </span>
                <h1 className="text-base font-bold text-white">{profiles.length === 0 ? "Welcome — create your profile" : "New Profile"}</h1>
                <p className="text-xs text-[#9891ab]">Just a name and a password, kept entirely on this computer.</p>
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-[#241a2e] bg-[#14141d] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#5c5568] focus:border-[#7c3aed]"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-lg border border-[#241a2e] bg-[#14141d] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#5c5568] focus:border-[#7c3aed]"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Confirm password"
                className="w-full rounded-lg border border-[#241a2e] bg-[#14141d] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#5c5568] focus:border-[#7c3aed]"
              />
              {error && <p className="text-xs text-[#f87171]">{error}</p>}
              <button
                onClick={handleCreate}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#7c3aed] to-[#9f1239] py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create Profile"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
