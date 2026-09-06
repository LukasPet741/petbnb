"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { type Profile } from "@/lib/types";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import Hero from "@/components/home/Hero";
import ServiceRail from "@/components/home/ServiceRail";
import CityGrid from "@/components/home/CityGrid";
import SitterVoices from "@/components/home/SitterVoices";
import HowItWorks from "@/components/home/HowItWorks";
import Faq from "@/components/home/Faq";
import FoundingPanel from "@/components/home/FoundingPanel";
import { type HomeStatus } from "@/components/home/status";

/**
 * One query for the whole page. The hero, the city grid and the voices wall all
 * describe the same set of sitters, and the previous version fetched that set
 * twice (once here, once inside the hero) for two round trips and two chances
 * to disagree with itself. The sections are presentational now: they receive
 * the rows and the status, and derive what they need in src/lib/home.ts.
 */
const SITTER_LIMIT = 60;

export default function LandingPage() {
  const [sitters, setSitters] = useState<Profile[]>([]);
  const [status, setStatus] = useState<HomeStatus>("loading");

  useEffect(() => {
    let active = true;

    supabase
      .from("profiles")
      .select("*")
      .eq("is_sitter", true)
      .order("experience_years", { ascending: false })
      .limit(SITTER_LIMIT)
      .then(
        ({ data, error }) => {
          if (!active) return;
          if (error) {
            setStatus("error");
            return;
          }
          setSitters((data as Profile[]) ?? []);
          setStatus("ready");
        },
        () => {
          if (active) setStatus("error");
        }
      );

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <PublicHeader />
      <main>
        <Hero sitters={sitters} status={status} />
        <ServiceRail />
        <CityGrid sitters={sitters} status={status} />
        <SitterVoices sitters={sitters} status={status} />
        <HowItWorks />
        <Faq />
        <FoundingPanel />
      </main>
      <PublicFooter />
    </div>
  );
}
