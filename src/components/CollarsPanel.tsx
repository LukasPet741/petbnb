"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Copy, X, Radar, Check, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import EmptyState from "@/components/EmptyState";

const CollarMap = dynamic(() => import("@/components/CollarMap"), { ssr: false });

interface CollarDevice {
  id: string;
  label: string | null;
  created_at: string;
}

interface CollarFix {
  lat: number;
  lng: number;
  speed_kmh: number | null;
  battery_pct: number | null;
  recorded_at: string;
}

const POLL_INTERVAL_MS = 30_000;

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function CollarsPanel() {
  const [devices, setDevices] = useState<CollarDevice[]>([]);
  const [fixes, setFixes] = useState<Record<string, CollarFix | null>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [provisioned, setProvisioned] = useState<{ id: string; secret: string; label: string } | null>(null);

  const loadDevices = useCallback(async () => {
    const { data } = await supabase
      .from("collar_devices")
      .select("id, label, created_at")
      .order("created_at", { ascending: false });
    setDevices((data ?? []) as CollarDevice[]);
    setLoading(false);
  }, []);

  const loadFixes = useCallback(async (deviceIds: string[]) => {
    const entries = await Promise.all(
      deviceIds.map(async (id) => {
        const { data } = await supabase
          .from("collar_locations")
          .select("lat, lng, speed_kmh, battery_pct, recorded_at")
          .eq("device_id", id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return [id, (data as CollarFix | null) ?? null] as const;
      })
    );
    setFixes(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    if (devices.length === 0) return;
    const ids = devices.map((d) => d.id);
    loadFixes(ids);
    const interval = setInterval(() => loadFixes(ids), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [devices, loadFixes]);

  const handleCreate = async (label: string) => {
    const secret = crypto.randomUUID().replace(/-/g, "");
    const { data, error } = await supabase.rpc("register_collar_device", { p_secret: secret, p_label: label || null });
    if (error || !data) return;
    setProvisioned({ id: data as string, secret, label });
    setShowAdd(false);
    await loadDevices();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("collar_devices").delete().eq("id", id);
    setDevices((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="bg-surface rounded-2xl border border-black/5 shadow-sm p-6 sm:p-7">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink tracking-tight">My collars</h3>
          <p className="text-sm text-ink-soft mt-0.5">GPS collars paired to your account, tracked live on the map.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" />Add a collar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-ink-soft">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : devices.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="No collars yet"
          description="Pair a GPS collar to see its live location here."
        />
      ) : (
        <div className="space-y-4">
          {devices.map((device) => {
            const fix = fixes[device.id];
            return (
              <div key={device.id} className="rounded-xl border border-black/10 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-surface-2">
                  <div className="min-w-0">
                    <div className="font-medium text-ink text-sm truncate">{device.label || "Unnamed collar"}</div>
                    <div className="text-xs text-ink-soft mt-0.5">
                      {fix ? (
                        <>
                          Last seen {timeAgo(fix.recorded_at)}
                          {fix.speed_kmh != null && ` · ${fix.speed_kmh.toFixed(1)} km/h`}
                          {fix.battery_pct != null && ` · ${fix.battery_pct}% battery`}
                        </>
                      ) : (
                        "Waiting for first fix…"
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(device.id)}
                    className="p-2 text-ink-soft hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    aria-label="Remove collar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="h-56">
                  {fix ? (
                    <CollarMap lat={fix.lat} lng={fix.lng} label={device.label ?? undefined} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-ink-soft bg-surface-2">
                      No location data yet
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showAdd && <AddCollarModal onClose={() => setShowAdd(false)} onCreate={handleCreate} />}
        {provisioned && <ProvisionedModal {...provisioned} onClose={() => setProvisioned(null)} />}
      </AnimatePresence>
    </div>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-2xl border border-black/5 shadow-lg w-full max-w-sm p-6"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function AddCollarModal({ onClose, onCreate }: { onClose: () => void; onCreate: (label: string) => Promise<void> }) {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-display text-lg font-semibold text-ink">Add a collar</h4>
        <button onClick={onClose} className="p-1 text-ink-soft hover:text-ink rounded-lg">
          <X className="w-4 h-4" />
        </button>
      </div>
      <label className="block text-sm font-medium text-ink mb-1.5">Label</label>
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Rex's collar"
        className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition mb-5"
      />
      <button
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          await onCreate(label);
          setSaving(false);
        }}
        className="w-full h-11 flex items-center justify-center gap-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create collar"}
      </button>
    </ModalShell>
  );
}

function ProvisionedModal({ id, secret, label, onClose }: { id: string; secret: string; label: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const envSnippet = `DEVICE_ID=${id}\nDEVICE_SECRET=${secret}`;

  const copy = () => {
    navigator.clipboard.writeText(envSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalShell onClose={onClose}>
      <h4 className="font-display text-lg font-semibold text-ink mb-1.5">{label || "Collar"} paired</h4>
      <p className="text-sm text-ink-soft mb-4">
        Copy these into the collar's <code className="text-xs bg-surface-2 px-1 py-0.5 rounded">.env</code> file — the
        secret is shown only once and can't be recovered later.
      </p>
      <pre className="bg-surface-2 rounded-xl p-3.5 text-xs text-ink font-mono overflow-x-auto mb-4 whitespace-pre-wrap break-all">
        {envSnippet}
      </pre>
      <div className="flex gap-2">
        <button
          onClick={copy}
          className="flex-1 h-11 flex items-center justify-center gap-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={onClose}
          className="flex-1 h-11 flex items-center justify-center bg-surface-2 text-ink rounded-xl text-sm font-medium hover:bg-black/5 transition-colors"
        >
          Done
        </button>
      </div>
    </ModalShell>
  );
}
