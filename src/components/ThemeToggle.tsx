import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme, type Theme } from "@/hooks/use-theme";

type Props = {
  className?: string;
  /** Controlled mode: pass theme + onToggle so a page can share one theme instance. */
  theme?: Theme;
  onToggle?: () => void;
};

export function ThemeToggle({ className, theme: themeProp, onToggle }: Props) {
  const internal = useTheme();
  const theme = themeProp ?? internal.theme;
  const toggle = onToggle ?? internal.toggleTheme;
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`size-8 shrink-0 p-0 text-muted-foreground ${className ?? ""}`}
      onClick={toggle}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle color theme"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
