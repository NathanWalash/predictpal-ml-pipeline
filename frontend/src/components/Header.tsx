"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { BarChart3, LogOut, User } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Us" },
  { href: "/create", label: "Build" },
  { href: "/explore", label: "Explore" },
];

export function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-slate-800 bg-[#0b0f1a]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center group-hover:bg-teal-500/30 transition-colors">
            <BarChart3 className="w-4.5 h-4.5 text-teal-400" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">
            Predict<span className="text-teal-400">Pal</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-slate-800 text-teal-400"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Auth */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg">
                <User className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-sm text-slate-300">{user.username}</span>
              </div>
              <button
                onClick={logout}
                className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
