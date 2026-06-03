import Link from "next/link";
import { PawPrint } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-stone-900 text-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 bg-[#D95F3B] rounded-lg flex items-center justify-center">
                <PawPrint className="w-5 h-5 text-white" />
              </span>
              <span className="font-semibold text-lg">PetBnB</span>
            </div>
            <p className="text-stone-400 text-sm leading-relaxed">
              Connecting pet owners with trusted local sitters since 2024.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-stone-300">Services</h4>
            <ul className="space-y-2 text-sm text-stone-400">
              <li><Link href="/browse" className="hover:text-white transition-colors">Dog Walking</Link></li>
              <li><Link href="/browse" className="hover:text-white transition-colors">Boarding</Link></li>
              <li><Link href="/browse" className="hover:text-white transition-colors">Daycare</Link></li>
              <li><Link href="/browse" className="hover:text-white transition-colors">Grooming</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-stone-300">Company</h4>
            <ul className="space-y-2 text-sm text-stone-400">
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link></li>
              <li><Link href="/profile" className="hover:text-white transition-colors">Become a Sitter</Link></li>
              <li><Link href="/dashboard" className="hover:text-white transition-colors">My Account</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-stone-800 mt-10 pt-6 text-sm text-stone-500 text-center">
          © {new Date().getFullYear()} PetBnB. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
