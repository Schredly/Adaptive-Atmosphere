import { Outlet, Link, useLocation } from "react-router";
import { Home, Settings, User, Music, Activity } from "lucide-react";
import { motion } from "motion/react";
import { TopNav } from "./TopNav";
import { useAtmosphereEngine } from "@/hooks/useAtmosphereEngine";
import { useSpotifyOrchestration } from "@/hooks/useSpotifyOrchestration";

export function Layout() {
  const location = useLocation();

  // Boot the realtime engines once, app-wide. This keeps motion, atmosphere,
  // and the AI feed live (useAtmosphereEngine), and drives adaptive music
  // orchestration off the atmosphere state (useSpotifyOrchestration).
  useAtmosphereEngine();
  useSpotifyOrchestration();

  const navItems = [
    { path: "/", icon: Home, label: "Dashboard" },
    { path: "/test", icon: Activity, label: "Test Mode" },
    { path: "/spotify", icon: Music, label: "Spotify" },
    { path: "/profile", icon: User, label: "Profile" },
    { path: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col">
      {/* Top Navigation */}
      <TopNav />

      <div className="flex-1 flex">
      {/* Sidebar Navigation */}
      <motion.aside
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-20 border-r border-white/5 backdrop-blur-xl bg-gradient-to-b from-[#0a0a12]/90 to-[#000000]/90 flex flex-col items-center py-8 gap-8"
      >
        {/* Logo */}
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-[#3b82f6]/20">
          <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm" />
        </div>

        {/* Nav Items */}
        <nav className="flex-1 flex flex-col gap-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link key={item.path} to={item.path} className="relative group">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                    isActive
                      ? "bg-gradient-to-br from-[#3b82f6]/20 to-[#8b5cf6]/20 text-[#3b82f6] shadow-lg shadow-[#3b82f6]/10"
                      : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/80"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </motion.div>

                {/* Tooltip */}
                <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-3 py-2 bg-[#14141c]/95 backdrop-blur-xl rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity border border-white/10">
                  {item.label}
                </div>

                {/* Active Indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-[#3b82f6] to-[#8b5cf6] rounded-full"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      </div>
    </div>
  );
}
