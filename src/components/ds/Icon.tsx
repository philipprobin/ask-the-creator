"use client";
import { icons, type LucideProps } from "lucide-react";

function toPascal(name: string): string {
  return name
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

export interface IconProps extends Omit<LucideProps, "ref" | "size"> {
  name: string;
  size?: number;
}

/** Thin wrapper over lucide-react, addressed by kebab-case name (replaces the DS `Ic` helper). */
export function Icon({ name, size = 18, ...rest }: IconProps) {
  const Cmp = (icons as Record<string, React.ComponentType<LucideProps>>)[toPascal(name)];
  if (!Cmp) return null;
  return <Cmp size={size} strokeWidth={2} {...rest} />;
}
