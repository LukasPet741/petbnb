"use client";
import { Check, Fingerprint, KeyRound, TriangleAlert, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { SMART_ID_DISPLAY_TEXT } from "@/lib/smart-id-demo-identities";
import { PIN_DIGITS, type PhoneEnding, type PhoneScreen } from "@/lib/smart-id-phone";
import { cn } from "@/lib/utils";

const LOCK_BACKGROUND =
  "radial-gradient(80% 45% at 25% 18%, rgb(96 170 200 / .55), transparent 70%), radial-gradient(70% 55% at 85% 95%, rgb(220 154 53 / .4), transparent 70%), linear-gradient(170deg, #1d3642, #0b161b)";

function AppIcon({ size = 30 }: { size?: number }) {
  return (
    <span className="grid flex-shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-[#1a86a8] to-[#0b4a60] text-white" style={{ width: size, height: size }}>
      <KeyRound className="h-[55%] w-[55%]" aria-hidden="true" />
    </span>
  );
}

const ENDING_STYLE: Record<Exclude<PhoneEnding, "expired">, { icon: typeof Check; tone: string; title: string; text: string; button: string }> = {
  confirmed: { icon: Check, tone: "bg-[#e1f3ea] text-[#177a50]", title: "confirmed", text: "confirmedText", button: "done" },
  cancelled: { icon: X, tone: "bg-[#f8e5e3] text-[#b8443a]", title: "cancelled", text: "cancelledText", button: "close" },
  wrong_code: { icon: TriangleAlert, tone: "bg-[#fcf0da] text-[#8a5c1f]", title: "wrongCode", text: "wrongCodeText", button: "close" },
};

/** "Their phone · simulated": the Smart-ID app screens a person would see, played for the audience. */
export default function SimulatedPhone({ screen, clock, date }: { screen: PhoneScreen; clock: string; date: string }) {
  const { t } = useLanguage();
  const k = (key: string) => t(`appPages.smartIdDemo.phone.${key}`);
  const onLock = screen.kind === "lock" || screen.kind === "notification" || (screen.kind === "ending" && screen.ending === "expired");

  return (
    <figure className="mx-auto w-[300px]">
      <div className="rounded-[46px] bg-[#0f1412] p-2.5 shadow-[0_12px_36px_rgb(0_0_0/0.28)] ring-2 ring-inset ring-[#2c3531]">
        <div
          data-screen={screen.kind}
          className={cn("relative h-[600px] overflow-hidden rounded-[38px]", onLock ? "text-white" : "bg-white text-[#10222b]")}
          style={onLock ? { background: LOCK_BACKGROUND } : undefined}
        >
          <span className="absolute left-1/2 top-2 z-10 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
          <div className="flex h-10 items-center px-7 pt-1 text-[12px] font-semibold">{clock}</div>

          {onLock ? (
            <div>
              <p className="mt-6 text-center text-[64px] font-semibold leading-none tracking-tight">{clock}</p>
              <p className="mt-2 text-center text-[15px] font-medium opacity-85">{date}</p>
              {(screen.kind === "notification" || screen.kind === "ending") && (
                <div className={cn("mx-2.5 mt-7 flex gap-2.5 rounded-[20px] bg-white/25 px-3 py-2.5", screen.kind === "ending" && "opacity-55")}>
                  <AppIcon size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-[12px] opacity-90">
                      <b>Smart-ID</b>
                      <span>{k("now")}</span>
                    </div>
                    {screen.kind === "ending" ? (
                      <>
                        <p className="text-[13.5px] font-semibold">{k("expired")}</p>
                        <p className="truncate text-[12.5px] opacity-85">{SMART_ID_DISPLAY_TEXT}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[13.5px] font-semibold">{SMART_ID_DISPLAY_TEXT}</p>
                        <p className="text-[12.5px] opacity-85">{k("tapToConfirm")}</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex h-11 items-center gap-2.5 px-5">
                <AppIcon />
                <b className="text-[16px] font-bold tracking-tight">Smart-ID</b>
              </div>

              {screen.kind === "pin" || screen.kind === "confirming" ? (
                <>
                  <div className="px-6 pt-2 text-center">
                    <p className="text-[12.5px] text-[#5a6b73]">{k("requestFrom")}</p>
                    <p className="text-[19px] font-bold">PetBnB (demo)</p>
                    <p className="mt-2.5 rounded-xl bg-[#f1f5f7] px-3 py-2 text-[12.5px] text-[#2b3d45]">{SMART_ID_DISPLAY_TEXT}</p>
                    <p className="mt-4 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#5a6b73]">{k("verificationCode")}</p>
                    <p className="font-mono text-[40px] font-bold leading-tight tracking-[0.1em]">{screen.code}</p>
                    <p className="mt-2 text-[13.5px] font-semibold">{screen.kind === "pin" ? k("enterPin") : k("confirming")}</p>
                    <div className="mt-2 flex justify-center gap-3.5" aria-hidden="true">
                      {Array.from({ length: PIN_DIGITS }, (_, i) => {
                        const filled = screen.kind === "confirming" || i < screen.filled;
                        return (
                          <span key={i} data-pin-dot={filled ? "filled" : "empty"}
                            className={cn("h-3 w-3 rounded-full border-2 border-[#0b4a60]", filled && "bg-[#0b4a60]")} />
                        );
                      })}
                    </div>
                  </div>
                  {screen.kind === "pin" && (
                    <div className="absolute inset-x-0 bottom-5 grid grid-cols-3 gap-y-1.5 px-9" aria-hidden="true">
                      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "OK"].map((key, i) => (
                        <span key={i} className={cn("grid h-[46px] w-[46px] place-items-center justify-self-center rounded-full text-[20px] font-medium", key === "" ? "" : key === "OK" ? "text-[13px] font-semibold text-[#0b4a60]" : "bg-[#eef2f4]")}>
                          {key}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : screen.kind === "ending" && screen.ending !== "expired" ? (
                (() => {
                  const style = ENDING_STYLE[screen.ending];
                  const Icon = style.icon;
                  return (
                    <>
                      <div className="absolute inset-x-0 top-36 px-7 text-center">
                        <span className={cn("mx-auto grid h-20 w-20 place-items-center rounded-full", style.tone)}>
                          <Icon className="h-10 w-10" strokeWidth={2.4} aria-hidden="true" />
                        </span>
                        <p className="mt-4 text-[22px] font-bold tracking-tight">{k(style.title)}</p>
                        <p className="mt-1.5 text-[13.5px] leading-snug text-[#5a6b73]">{k(style.text)}</p>
                      </div>
                      <span className="absolute inset-x-6 bottom-8 grid h-12 place-items-center rounded-2xl bg-[#0b4a60] text-[15px] font-semibold text-white">
                        {k(style.button)}
                      </span>
                    </>
                  );
                })()
              ) : null}
            </div>
          )}
        </div>
      </div>
      <figcaption className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-ink-soft">
        <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" />
        {t("appPages.smartIdDemo.phoneCaption")}
      </figcaption>
    </figure>
  );
}
