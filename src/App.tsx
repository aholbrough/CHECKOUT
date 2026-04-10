import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Barcode, 
  ArrowLeftRight, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  LogOut, 
  User as UserIcon,
  Scan,
  ShieldCheck
} from "lucide-react";
import { auth, db, loginWithGoogle } from "./firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { collection, addDoc, query, orderBy, limit, onSnapshot, where } from "firebase/firestore";
import axios from "axios";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [barcode, setBarcode] = useState("");
  const [action, setAction] = useState<"check-in" | "check-out">("check-out");
  const [logs, setLogs] = useState<any[]>([]);
  const [status, setStatus] = useState<{ type: "success" | "error" | "loading" | null; message: string }>({ type: null, message: "" });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, "logs"),
        where("userId", "==", user.uid),
        orderBy("timestamp", "desc"),
        limit(10)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const newLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLogs(newLogs);
      }, (error) => {
        console.error("Firestore error:", error);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode || !user) return;

    setStatus({ type: "loading", message: "Processing scan..." });

    try {
      // 1. Send to Backend (Assetbots API)
      const response = await axios.post("/api/scan", {
        barcode,
        action
      });

      // 2. Log to Firestore
      await addDoc(collection(db, "logs"), {
        barcode,
        action,
        timestamp: new Date().toISOString(),
        userId: user.uid,
        status: "Success"
      });

      setStatus({ type: "success", message: `Successfully ${action === "check-in" ? "checked in" : "checked out"} asset ${barcode}` });
      setBarcode("");
      inputRef.current?.focus();
    } catch (error: any) {
      console.error("Scan error:", error);
      setStatus({ type: "error", message: error.response?.data?.error || "Failed to process scan" });
      
      // Log failure to Firestore
      await addDoc(collection(db, "logs"), {
        barcode,
        action,
        timestamp: new Date().toISOString(),
        userId: user.uid,
        status: "Failed"
      });
    }

    // Clear status after 5 seconds
    setTimeout(() => setStatus({ type: null, message: "" }), 5000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-orange-500/10 rounded-3xl flex items-center justify-center border border-orange-500/20">
              <Barcode className="w-10 h-10 text-orange-500" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">AssetTrack Pro</h1>
            <p className="text-zinc-400">Secure asset management with real-time Assetbots integration.</p>
          </div>
          <button
            onClick={loginWithGoogle}
            className="w-full py-4 px-6 bg-white text-black rounded-2xl font-semibold flex items-center justify-center gap-3 hover:bg-zinc-200 transition-colors"
          >
            <UserIcon className="w-5 h-5" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <Barcode className="w-6 h-6 text-black" />
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:block">AssetTrack Pro</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end hidden xs:flex">
              <span className="text-sm font-medium">{user.displayName}</span>
              <span className="text-xs text-zinc-500">{user.email}</span>
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="p-2.5 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        {/* Scanner Section */}
        <section className="grid lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Scan Asset</h2>
              <p className="text-zinc-400">Point your scanner or enter the barcode manually.</p>
            </div>

            <form onSubmit={handleScan} className="space-y-6">
              {/* Toggle */}
              <div className="bg-zinc-900/50 p-1.5 rounded-2xl flex border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setAction("check-out")}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                    action === "check-out" ? "bg-orange-500 text-black shadow-lg shadow-orange-500/20" : "text-zinc-400 hover:text-white"
                  )}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Check-Out
                </button>
                <button
                  type="button"
                  onClick={() => setAction("check-in")}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                    action === "check-in" ? "bg-orange-500 text-black shadow-lg shadow-orange-500/20" : "text-zinc-400 hover:text-white"
                  )}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Check-In
                </button>
              </div>

              {/* Input */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                  <Scan className="w-5 h-5 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Scan or enter barcode..."
                  autoFocus
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-5 pl-14 pr-6 text-lg focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all placeholder:text-zinc-600"
                />
              </div>

              {/* Status Message */}
              <AnimatePresence mode="wait">
                {status.type && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className={cn(
                      "p-4 rounded-xl flex items-center gap-3 text-sm font-medium",
                      status.type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                      status.type === "error" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                      "bg-zinc-800 text-zinc-400"
                    )}
                  >
                    {status.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    {status.type === "error" && <AlertCircle className="w-4 h-4 shrink-0" />}
                    {status.type === "loading" && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full shrink-0" />}
                    {status.message}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={!barcode || status.type === "loading"}
                className="w-full py-4 bg-white text-black rounded-2xl font-bold hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                Process Scan
              </button>
            </form>
          </div>

          {/* Activity Feed */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-orange-500" />
                Recent Activity
              </h3>
              <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Your Scans</span>
            </div>

            <div className="space-y-3">
              {logs.length === 0 ? (
                <div className="bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl p-12 text-center text-zinc-500">
                  No recent activity found.
                </div>
              ) : (
                logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between hover:bg-zinc-900 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        log.action === "check-in" ? "bg-green-500/10 text-green-500" : "bg-blue-500/10 text-blue-500"
                      )}>
                        <ArrowLeftRight className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold">{log.barcode}</div>
                        <div className="text-xs text-zinc-500 flex items-center gap-1.5">
                          <span className="capitalize">{log.action}</span>
                          <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    <div className={cn(
                      "text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md",
                      log.status === "Success" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                    )}>
                      {log.status}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* System Info */}
        <section className="pt-12 border-t border-zinc-800">
          <div className="bg-zinc-900/30 rounded-3xl p-8 border border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-zinc-400" />
              </div>
              <div>
                <h4 className="font-bold">Automated Alerts Active</h4>
                <p className="text-sm text-zinc-500">Daily overdue checks run at 00:00 UTC.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-800/50 px-4 py-2 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Assetbots API Connected
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
