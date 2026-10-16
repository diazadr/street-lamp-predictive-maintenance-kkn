"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Link, usePathname } from "@/src/i18n/navigation";
import { ThemeToggle } from "@/src/components/layouts/dashboard/ThemeToggle";
import { LocaleToggle } from "@/src/components/layouts/dashboard/navbar/LocaleToggle";
import { BrandMark } from "@/src/components/common/BrandMark";
import { useAuth } from "@/src/components/providers/AuthProvider";

export default function PublicNavbar() {
  const t = useTranslations("PublicNavbar");
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const isHome = pathname === "/";

  const handleScroll = useCallback(() => {
    const y = window.scrollY;
    if (y < 10) {
      setIsScrolled(false);
      setIsVisible(true);
    } else {
      setIsScrolled(true);
      if (y > 100) {
        const last = Number(document.documentElement.dataset.lastScrollY || "0");
        if (y > last + 5) {
          setIsVisible(false);
          setOpen(false);
        } else if (y < last - 5) {
          setIsVisible(true);
        }
      }
    }
    document.documentElement.dataset.lastScrollY = String(y);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Di atas hero gelap (belum di-scroll) teks navbar putih, seperti MANGO
  const onHero = isHome && !isScrolled && !open;
  const linkStyle = onHero
    ? "text-white/80 hover:text-white hover:bg-white/10"
    : "text-muted-foreground hover:text-foreground hover:bg-muted";
  const heroIconStyle = onHero ? "text-white/80 hover:text-white hover:bg-white/10" : "";

  const getHref = (href: string) => (href.startsWith("#") && !isHome ? `/${href}` : href);

  const navLinks = [
    { href: "#about", label: t("about") },
    { href: "#technology", label: t("technology") },
    { href: "#map", label: t("map") },
    { href: "#features", label: t("features") },
    { href: "#faq", label: t("faq") },
  ];

  return (
    <nav
      id="public-navbar"
      className={`fixed top-0 w-full z-50 transition-all duration-500 ease-in-out ${isVisible ? "translate-y-0" : "-translate-y-full"}`}
    >
      <div
        className={`absolute inset-0 w-full h-full transition-all duration-500 ease-in-out z-0 ${
          open
            ? "bg-background shadow-lg"
            : isScrolled || !isHome
              ? "bg-background/80 backdrop-blur-xl border-b border-border shadow-sm"
              : "bg-transparent"
        }`}
      />

      <div className="relative z-10 w-full">
        <div className="container mx-auto px-6 lg:px-12 h-16 lg:h-20 flex items-center justify-between relative z-[60]">
          <Link href="/" className="flex items-center gap-2.5 group z-50">
            <motion.div whileHover={{ rotate: 5 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
              <BrandMark className="w-9 h-9 lg:w-10 lg:h-10" />
            </motion.div>
            <span className="flex flex-col leading-none">
              <span className={`text-base lg:text-lg font-black tracking-tight transition-colors ${onHero ? "text-white" : "text-foreground group-hover:text-primary"}`}>
                Street<span className="text-accent-ink">Lamp</span> PdM
              </span>
              <span className={`hidden sm:block text-[10px] font-medium mt-0.5 ${onHero ? "text-white/60" : "text-muted-foreground"}`}>
                Predictive Maintenance
              </span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={getHref(link.href)}
                className={`nav-link ${linkStyle}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <LocaleToggle className={`border-transparent bg-transparent ${heroIconStyle}`} />
            <ThemeToggle variant="ghost" className={heroIconStyle} />
            {isAuthenticated ? (
              <Link href="/dashboard">
                <motion.span
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex h-10 items-center px-6 rounded-full bg-accent text-accent-foreground text-[13px] font-semibold tracking-wide shadow-md hover:bg-accent/90 transition-colors"
                >
                  {t("dashboard")}
                </motion.span>
              </Link>
            ) : (
              <>
                <Link href="/login" className={`nav-link ${onHero ? "text-white hover:bg-white/10" : "text-foreground hover:text-primary hover:bg-muted"}`}>
                  {t("login")}
                </Link>
                <Link href="/register">
                  <motion.span
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex h-10 items-center px-6 rounded-full bg-accent text-accent-foreground text-[13px] font-semibold tracking-wide shadow-md hover:bg-accent/90 transition-colors"
                  >
                    {t("register")}
                  </motion.span>
                </Link>
              </>
            )}
          </div>

          <div className="flex md:hidden items-center gap-1.5">
            <LocaleToggle className={`border-transparent bg-transparent ${heroIconStyle}`} />
            <ThemeToggle variant="ghost" className={heroIconStyle} />
            <button onClick={() => setOpen(!open)} className={`icon-btn-ghost ${onHero ? "text-white hover:bg-white/10" : "text-foreground"}`} aria-label={t("label_toggle_menu")}>
              <AnimatePresence mode="wait">
                {open ? (
                  <motion.div key="close" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 90 }} transition={{ duration: 0.15 }} className="absolute">
                    <X size={22} />
                  </motion.div>
                ) : (
                  <motion.div key="menu" initial={{ opacity: 0, rotate: 90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: -90 }} transition={{ duration: 0.15 }} className="absolute">
                    <Menu size={22} />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="md:hidden bg-background overflow-hidden absolute w-full z-40 border-t border-border"
            >
              <div className="px-6 py-6 pb-8 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link key={link.href} href={getHref(link.href)} onClick={() => setOpen(false)} className="mobile-nav-link">
                    {link.label}
                  </Link>
                ))}
                <div className="dropdown-divider my-3" />
                {isAuthenticated ? (
                  <Link href="/dashboard" onClick={() => setOpen(false)} className="w-full h-12 rounded-full bg-accent text-accent-foreground text-sm font-semibold flex items-center justify-center">
                    {t("dashboard")}
                  </Link>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setOpen(false)} className="mobile-nav-link">
                      {t("login")}
                    </Link>
                    <Link href="/register" onClick={() => setOpen(false)} className="mt-2 w-full h-12 rounded-full bg-accent text-accent-foreground text-sm font-semibold flex items-center justify-center">
                      {t("register")}
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
