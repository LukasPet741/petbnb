import Link from "next/link";
import { PawPrint, ArrowLeft } from "lucide-react";

export default function TermsPage() {
  const sections = [
    {
      title: "1. About this project",
      body: "PetBnB is a university project — a demonstration marketplace that connects pet owners with independent pet sitters. It is not a commercial service, and these terms are illustrative.",
    },
    {
      title: "2. Acceptance of Terms",
      body: "By accessing and using PetBnB, you accept and agree to be bound by these Terms and Conditions. If you do not agree, please do not use the service.",
    },
    {
      title: "3. User Accounts",
      body: "You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account.",
    },
    {
      title: "4. Bookings",
      body: "All bookings are subject to sitter availability and acceptance. PetBnB facilitates the connection but is not a party to any agreement made between owners and sitters.",
    },
    {
      title: "5. Payments",
      body: "PetBnB does not process payments and does not charge booking fees. Any financial arrangements are made directly between owners and sitters.",
    },
    {
      title: "6. Sitters",
      body: "PetBnB does not vet, verify or background-check sitters. Profile information is self-reported. Always use your own judgement and exercise due diligence before booking.",
    },
    {
      title: "7. Liability",
      body: "PetBnB is not liable for any loss, injury or damage to pets, people or property that may occur during bookings. Owners and sitters assume all associated risks.",
    },
    {
      title: "8. Privacy",
      body: "Your personal data is used solely to operate the PetBnB demo and is not sold to third parties.",
    },
  ];

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-canvas/80 backdrop-blur-md border-b border-black/5 h-16 flex items-center px-4 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto w-full flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-ink font-semibold">
            <span className="w-8 h-8 bg-brand rounded-xl flex items-center justify-center">
              <PawPrint className="w-5 h-5 text-white" />
            </span>
            <span className="font-display tracking-tight">PetBnB</span>
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="font-display text-4xl font-semibold text-ink mb-2 tracking-tight">Terms &amp; Conditions</h1>
        <p className="text-ink-soft mb-8">Last updated: June 2026</p>

        <div className="space-y-4">
          {sections.map(({ title, body }) => (
            <div key={title} className="bg-surface rounded-2xl border border-black/5 shadow-sm p-6">
              <h2 className="font-semibold text-ink mb-2.5">{title}</h2>
              <p className="text-ink-soft text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-ink-soft text-sm">
            Questions?{" "}
            <a href="mailto:hello@petbnb.lt" className="text-brand hover:underline">Contact us</a>
          </p>
        </div>
      </div>
    </div>
  );
}
