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
} from "@nextui-org/react";
import NextLink from "next/link";
import clsx from "clsx";
import { useAuth } from "@/providers/auth-provider";
import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "./theme-switch";
import { LogOut, User, Settings } from "lucide-react";

export function Navbar() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!user) return null;

  return (
    <NextUINavbar
      maxWidth="xl"
      position="sticky"
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      className="border-b border-divider"
    >
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-2" href="/dashboard">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <p className="font-bold text-inherit hidden sm:block">Productivo</p>
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

      <NavbarContent className="hidden sm:flex basis-1/5 sm:basis-full" justify="end">
        <NavbarItem className="hidden sm:flex gap-2">
          <ThemeSwitch />
        </NavbarItem>
        <NavbarItem>
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
      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <ThemeSwitch />
        <Avatar
          size="sm"
          src={user.photoURL || undefined}
          name={user.displayName?.charAt(0) || "U"}
          className="cursor-pointer"
          onClick={() => router.push("/settings")}
        />
        <NavbarMenuToggle />
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
