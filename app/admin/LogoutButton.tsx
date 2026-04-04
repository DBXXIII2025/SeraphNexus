"use client";

export default function LogoutButton() {
  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/explore";
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
