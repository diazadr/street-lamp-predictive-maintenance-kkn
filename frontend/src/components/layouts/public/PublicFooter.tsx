"use client";

import { useTranslations } from "next-intl";
import { Mail, Phone, MapPin } from "lucide-react";
import { FaGithub, FaInstagram, FaLinkedinIn, FaYoutube } from "react-icons/fa";
import { Link } from "@/src/i18n/navigation";
import { BrandMark } from "@/src/components/common/BrandMark";

export const PublicFooter = () => {
  const t = useTranslations("PublicFooter");
  const year = new Date().getFullYear();
  const socials = [FaGithub, FaInstagram, FaLinkedinIn, FaYoutube];

  return (
    <footer className="bg-[#0f2557] text-[#f7f3ea]/80 pt-16 pb-8 border-t border-white/10">
      <div className="container mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <BrandMark inverted className="h-10 w-10" />
              <h3 className="text-xl font-black text-white tracking-tight">Street Lamp PdM</h3>
            </div>
            <p className="text-sm leading-relaxed text-[#f7f3ea]/60">{t("description")}</p>
            <div className="flex gap-3 pt-2">
              {socials.map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#f7f3ea]/60 hover:bg-accent hover:text-white hover:border-accent transition-all duration-300"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6 tracking-wide text-sm">{t("platform_title")}</h4>
            <ul className="space-y-3 text-sm">
              {(["monitoring", "prediction", "tickets", "energy"] as const).map((key) => (
                <li key={key} className="text-[#f7f3ea]/60">{t(`platform.${key}`)}</li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6 tracking-wide text-sm">{t("contact_title")}</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-sm text-[#f7f3ea]/60">
                <MapPin size={18} className="text-sun shrink-0 mt-0.5" />
                <span>{t("contact.address")}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-[#f7f3ea]/60">
                <Phone size={18} className="text-sun shrink-0" />
                <span>{t("contact.phone")}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-[#f7f3ea]/60">
                <Mail size={18} className="text-sun shrink-0" />
                <span>{t("contact.email")}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-[#f7f3ea]/50">
            &copy; {year} {t("copyright")}
          </p>
          <div className="flex gap-6">
            <Link href="/login" className="text-sm text-[#f7f3ea]/50 hover:text-white transition-colors">
              {t("login")}
            </Link>
            <a href="#faq" className="text-sm text-[#f7f3ea]/50 hover:text-white transition-colors">
              FAQ
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
