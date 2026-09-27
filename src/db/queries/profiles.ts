import { select, execute } from "../client";
import { newId, nowIso } from "@/lib/id";
import { hashPassword, verifyPassword } from "@/lib/passwordHash";
import type { Profile } from "../types";

export async function listProfiles(): Promise<Profile[]> {
  return select<Profile>("SELECT * FROM profiles ORDER BY created_at ASC");
}

export async function createProfile(name: string, password: string): Promise<Profile> {
  const { hash, salt } = await hashPassword(password);
  const profile: Profile = { id: newId(), name, password_hash: hash, password_salt: salt, created_at: nowIso() };
  await execute("INSERT INTO profiles (id, name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)", [
    profile.id,
    profile.name,
    profile.password_hash,
    profile.password_salt,
    profile.created_at,
  ]);
  return profile;
}

export async function verifyProfilePassword(profile: Profile, password: string): Promise<boolean> {
  return verifyPassword(password, profile.password_hash, profile.password_salt);
}

/** Overwrites a profile's password with no old-password check — a deliberate, low-friction "reset"
 *  for a purely local, single-machine account (there's no email/server to verify identity through
 *  anyway). This is a convenience feature, not a security boundary; the threat model for local
 *  profiles has always been "keep a housemate from casually opening someone else's trades," not a
 *  real access-control system. */
export async function resetProfilePassword(profileId: string, newPassword: string): Promise<void> {
  const { hash, salt } = await hashPassword(newPassword);
  await execute("UPDATE profiles SET password_hash = ?, password_salt = ? WHERE id = ?", [hash, salt, profileId]);
}
