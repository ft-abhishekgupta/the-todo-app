"use client";

import { FC, useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@nextui-org/react";

export const ThemeSwitch: FC = () => {
  const [isMounted, setIsMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div className="w-8 h-8" />;

  return (
    <Button
      isIconOnly
      variant="light"
      size="sm"
      onPress={() => setTheme(theme === "light" ? "dark" : "light")}
      aria-label="Toggle theme"
    >
      {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
    </Button>
  );
};
