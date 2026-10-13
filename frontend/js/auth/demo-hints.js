export function describeDemoProfile(profiles, username) {
  const profile = profiles.find(item => item.username === username);
  if (!profile) return {
    pin: "Unavailable. Enter your current card PIN to sign in.",
    password: "Use your current password.",
  };
  return {
    pin: profile.pinChanged
      ? "PIN changed. Enter your current card PIN to sign in."
      : profile.defaultPin,
    password: profile.passwordChanged ? "Password changed. Use your current password." : profile.defaultPassword,
  };
}
