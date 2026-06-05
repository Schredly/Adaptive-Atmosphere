import { motion } from "motion/react";
import { User, MapPin, Clock, Sparkles, Edit2, Save } from "lucide-react";
import { useState } from "react";

export function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [userName, setUserName] = useState("Alex Rivera");
  const [location, setLocation] = useState("Living Room");

  const zones = [
    { id: 1, name: "Living Room", active: true, color: "#3b82f6" },
    { id: 2, name: "Kitchen", active: true, color: "#10b981" },
    { id: 3, name: "Bedroom", active: false, color: "#8b5cf6" },
    { id: 4, name: "Office", active: true, color: "#f59e0b" },
  ];

  const preferences = [
    { label: "Preferred Genre", value: "Electronic", category: "Music" },
    { label: "Energy Level", value: "Medium-High", category: "Atmosphere" },
    { label: "Motion Response", value: "Immediate", category: "Behavior" },
    { label: "Time Zone", value: "PST (UTC-8)", category: "System" },
  ];

  const recentActivity = [
    { time: "2 hours ago", action: "Started Focus session", zone: "Office" },
    { time: "5 hours ago", action: "Party mode activated", zone: "Living Room" },
    { time: "Yesterday", action: "Relaxation mode", zone: "Bedroom" },
  ];

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-[#000000] via-[#0a0a12] to-[#000000]">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-semibold bg-gradient-to-r from-white via-[#10b981] to-[#06b6d4] bg-clip-text text-transparent mb-2">
          Profile
        </h1>
        <p className="text-white/40">Manage your preferences and zones</p>
      </motion.div>

      <div className="grid grid-cols-3 gap-6">
        {/* User Profile Card */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="col-span-1 bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-[#3b82f6]/10 rounded-full blur-3xl" />

          <div className="relative z-10">
            {/* Avatar */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] p-1">
                  <div className="w-full h-full rounded-[22px] bg-[#14141c] flex items-center justify-center">
                    <User className="w-16 h-16 text-white/80" />
                  </div>
                </div>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-2 bg-gradient-to-r from-[#3b82f6]/20 via-[#8b5cf6]/20 to-[#3b82f6]/20 rounded-3xl blur-xl -z-10"
                />
              </div>
            </div>

            {/* User Info */}
            <div className="text-center mb-6">
              {isEditing ? (
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="text-2xl text-white bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-center w-full mb-2"
                />
              ) : (
                <h2 className="text-2xl text-white mb-2">{userName}</h2>
              )}
              <p className="text-white/40">Premium Member</p>
            </div>

            {/* Edit Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsEditing(!isEditing)}
              className="w-full bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] rounded-xl py-3 text-white flex items-center justify-center gap-2 shadow-lg shadow-[#3b82f6]/20"
            >
              {isEditing ? (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              ) : (
                <>
                  <Edit2 className="w-4 h-4" />
                  Edit Profile
                </>
              )}
            </motion.button>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                <p className="text-white/40 text-xs mb-1">Sessions</p>
                <p className="text-2xl text-white">247</p>
              </div>
              <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                <p className="text-white/40 text-xs mb-1">Hours</p>
                <p className="text-2xl text-white">1,432</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Preferences and Zones */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="col-span-2 space-y-6"
        >
          {/* Spatial Zones */}
          <div className="bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-[#10b981]/5 rounded-full blur-3xl" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl text-white">Spatial Zones</h2>
                    <p className="text-white/40 text-sm">Configure your spaces</p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/80 text-sm border border-white/10"
                >
                  Add Zone
                </motion.button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {zones.map((zone, index) => (
                  <motion.div
                    key={zone.id}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 * index }}
                    className={`relative p-6 rounded-2xl border ${
                      zone.active
                        ? "bg-gradient-to-br from-white/5 to-white/0 border-white/10"
                        : "bg-black/20 border-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className="w-3 h-3 rounded-full shadow-lg"
                        style={{
                          backgroundColor: zone.color,
                          boxShadow: `0 0 20px ${zone.color}40`,
                        }}
                      />
                      {zone.active && (
                        <span className="text-xs text-[#10b981] bg-[#10b981]/10 px-2 py-1 rounded-lg">
                          Active
                        </span>
                      )}
                    </div>
                    <h3 className="text-white text-lg mb-1">{zone.name}</h3>
                    <p className="text-white/40 text-sm">
                      {zone.active ? "Monitoring" : "Inactive"}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-[#8b5cf6]/5 rounded-full blur-3xl" />

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl text-white">Your Preferences</h2>
                  <p className="text-white/40 text-sm">Personalized settings</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {preferences.map((pref, index) => (
                  <motion.div
                    key={index}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.1 * index }}
                    className="p-4 bg-black/20 rounded-xl border border-white/5"
                  >
                    <p className="text-white/40 text-xs mb-1">{pref.label}</p>
                    <p className="text-white">{pref.value}</p>
                    <span className="text-xs text-white/30 mt-1 inline-block">
                      {pref.category}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="col-span-3 bg-gradient-to-br from-[#14141c]/70 to-[#1f2937]/40 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-[#f59e0b]/5 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#ef4444] flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl text-white">Recent Activity</h2>
                <p className="text-white/40 text-sm">Your atmosphere history</p>
              </div>
            </div>

            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <motion.div
                  key={index}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 * index }}
                  className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-[#3b82f6] shadow-lg shadow-[#3b82f6]/50" />
                    <div>
                      <p className="text-white">{activity.action}</p>
                      <p className="text-white/40 text-sm">{activity.zone}</p>
                    </div>
                  </div>
                  <span className="text-white/40 text-sm">{activity.time}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
