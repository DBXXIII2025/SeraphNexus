"use client";

export default function LogoutButton() {
  const logout = async () => {
    const response = await fetch("/api/admin/logout", { method: "POST" });
    if (!response.ok) {
      console.error("Logout failed; session remains active.");
      return;
    }
    window.location.replace("/");
  };

  return (
    <button
      onClick={logout}
      className="btn-secondary w-full px-4 py-3 text-sm font-medium"
    >
      Log Out
    </button>
  );
}
