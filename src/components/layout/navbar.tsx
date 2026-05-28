"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Navbar as NextUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarBrand,
  NavbarItem,
  NavbarMenuItem,
  Button,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tooltip,
} from "@nextui-org/react";
import NextLink from "next/link";
import clsx from "clsx";
import { useAuth } from "@/providers/auth-provider";
import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "./theme-switch";
import { QuickAddToList } from "@/components/dashboard/quick-add-to-list";
import { useUIStore } from "@/stores/ui-store";
import { LogOut, User, Settings, Maximize2, Minimize2 } from "lucide-react";

export function Navbar() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const fullscreen = useUIStore((s) => s.fullscreen);
  const toggleFullscreen = useUIStore((s) => s.toggleFullscreen);

  // On mobile, also request/exit the browser's Fullscreen API so the address bar
  // and OS chrome get hidden too. Desktop keeps the lightweight header-hide only.
  const handleToggleFullscreen = () => {
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 640px)").matches;
    const willEnterFullscreen = !fullscreen;
    toggleFullscreen();
    if (typeof document === "undefined") return;
    try {
      if (isMobile) {
        if (willEnterFullscreen && !document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        } else if (!willEnterFullscreen && document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        }
      }
    } catch {
      /* noop — fullscreen unsupported or denied */
    }
  };

  // Keep store in sync if the user exits browser fullscreen via the OS gesture
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && fullscreen) {
        // Only auto-exit our soft fullscreen if it was triggered on mobile
        const isMobile = window.matchMedia("(max-width: 640px)").matches;
        if (isMobile) useUIStore.getState().setFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [fullscreen]);

  if (!user) return null;

  // Fullscreen mode: show a small floating exit button + quick-add in the top-right.
  if (fullscreen) {
    return (
      <div className="fixed top-2 right-2 z-50 flex flex-col gap-1.5 items-end">
        <Tooltip content="Exit fullscreen" placement="bottom-end">
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            onPress={handleToggleFullscreen}
            aria-label="Exit fullscreen"
          >
            <Minimize2 size={16} />
          </Button>
        </Tooltip>
        <QuickAddToList iconOnly />
      </div>
    );
  }

  return (
    <NextUINavbar
      maxWidth="full"
      position="sticky"
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      className="border-b border-divider"
      classNames={{ wrapper: "px-4 lg:px-[7%]" }}
    >
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-2" href="/dashboard">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <p className="font-bold text-inherit hidden sm:block">TheTodoApp</p>
          </NextLink>
        </NavbarBrand>
        <div className="hidden lg:flex gap-4 justify-start ml-2">
          {siteConfig.navItems.map((item) => (
            <NavbarItem key={item.href} isActive={pathname === item.href}>
              <NextLink
                className={clsx(
                  "text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "text-primary"
                    : "text-foreground/60 hover:text-foreground"
                )}
                href={item.href}
              >
                {item.label}
              </NextLink>
            </NavbarItem>
          ))}
        </div>
      </NavbarContent>

      <NavbarContent className="basis-1/5 sm:basis-full" justify="end">
        <NavbarItem className="flex gap-1 items-center">
          <QuickAddToList iconOnly />
          <Tooltip content="Hide header (fullscreen)" placement="bottom">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={handleToggleFullscreen}
              aria-label="Toggle fullscreen"
            >
              <Maximize2 size={16} />
            </Button>
          </Tooltip>
          <ThemeSwitch />
        </NavbarItem>
        <NavbarItem className="hidden sm:flex">
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Avatar
                isBordered
                as="button"
                className="transition-transform"
                size="sm"
                src={user.photoURL || undefined}
                name={user.displayName?.charAt(0) || "U"}
              />
            </DropdownTrigger>
            <DropdownMenu aria-label="Profile Actions" variant="flat">
              <DropdownItem key="profile" className="h-14 gap-2">
                <p className="font-semibold">{user.displayName}</p>
                <p className="text-xs text-default-500">{user.email}</p>
              </DropdownItem>
              <DropdownItem
                key="settings"
                startContent={<Settings size={16} />}
                onPress={() => router.push("/settings")}
              >
                Settings
              </DropdownItem>
              <DropdownItem
                key="logout"
                color="danger"
                startContent={<LogOut size={16} />}
                onPress={signOut}
              >
                Sign Out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarItem>
        <NavbarMenuToggle className="lg:hidden" />
      </NavbarContent>

      <NavbarMenu>
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {siteConfig.navItems.map((item, index) => (
            <NavbarMenuItem key={`${item.href}-${index}`}>
              <NextLink
                className={clsx(
                  "text-lg w-full block py-1",
                  pathname === item.href ? "text-primary font-semibold" : "text-foreground"
                )}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </NextLink>
            </NavbarMenuItem>
          ))}
          <NavbarMenuItem>
            <NextLink
              className="text-lg w-full block py-1"
              href="/settings"
              onClick={() => setIsMenuOpen(false)}
            >
              Settings
            </NextLink>
          </NavbarMenuItem>
          <NavbarMenuItem>
            <button className="text-lg text-danger w-full text-left py-1" onClick={signOut}>
              Sign Out
            </button>
          </NavbarMenuItem>
        </div>
      </NavbarMenu>
    </NextUINavbar>
  );
}
