import Link from "next/link";
import { PawPrint, ArrowLeft } from "lucide-react";

export default function TermsPage() {
  const sections = [
    {
      title: "1. Acceptance of Terms",
      body: "By accessing and using PetBnB, you accept and agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our service.",
    },
    {
      title: "2. Service Description",
      body: "PetBnB is an online marketplace connecting pet owners with independent pet sitters. We facilitate connections but are not party to any agreements made between owners and sitters.",
    },
    {
      title: "3. User Accounts",
      body: "You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account.",
    },
    {
      title: "4. Bookings & Payments",
      body: "All bookings are subject to sitter availability and acceptance. PetBnB does not process payments directly. Any financial arrangements are made between owners and sitters.",
    },
    {
      title: "5. Sitter Vetting",
      body: "While we encourage sitters to undergo background checks and provide accurate profile information, PetBnB does not guarantee the conduct or qualifications of any sitter. Always exercise due diligence.",
    },
    {
      title: "6. Liability",
      body: "PetBnB is not liable for any loss, injury or damage to pets, people or property that may occur during bookings. Pet owners and sitters assume all risks associated with their arrangements.",
    },
    {
      title: "7. Privacy",
      body: "Your personal data is handled in accordance with our Privacy Policy. We do not sell your data to third parties. Data is used solely for operating and improving the PetBnB service.",
    },
    {
      title: "8. Modifications",
      body: "We reserve the right to update these terms at any time. Continued use of PetBnB after changes constitutes acceptance of the updated terms.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8F6F3]">
      {/* Simple nav */}
      <header className="bg-white border-b border-stone-200 h-16 flex items-center px-4">
        <div className="max-w-3xl mx-auto w-full flex items-center gap-3">
          <Link href="/login" className="flex items-center gap-2 text-stone-900 font-semibold">
            <span className="w-8 h-8 bg-[#D95F3B] rounded-lg flex items-center justify-center">
              <PawPrint className="w-5 h-5 text-white" />
            </span>
            PetBnB
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="text-3xl font-bold text-stone-900 mb-2">Terms & Conditions</h1>
        <p className="text-stone-500 mb-8">Last updated: June 2026</p>

        <div className="space-y-6">
          {sections.map(({ title, body }) => (
            <div key={title} className="bg-white rounded-xl border border-stone-100 shadow-sm p-6">
              <h2 className="font-semibold text-stone-900 mb-3">{title}</h2>
              <p className="text-stone-600 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-stone-500 text-sm">
            Questions?{" "}
            <a href="mailto:hello@petbnb.com" className="text-[#D95F3B] hover:underline">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
