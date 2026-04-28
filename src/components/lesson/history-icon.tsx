"use client";

import {
  BookOpen,
  Building2,
  Crown,
  Droplets,
  Factory,
  FileText,
  Flag,
  Landmark,
  Map,
  Megaphone,
  Route,
  RotateCcw,
  ScrollText,
  Shield,
  Ship,
  Swords,
} from "lucide-react";

const historyIcons = {
  book: BookOpen,
  building: Building2,
  crown: Crown,
  document: FileText,
  factory: Factory,
  flag: Flag,
  map: Map,
  oil: Droplets,
  protest: Megaphone,
  revolution: RotateCcw,
  road: Route,
  shield: Shield,
  ship: Ship,
  sword: Swords,
  treaty: ScrollText,
};

export function HistoryIcon({
  name,
  size = 20,
}: {
  name?: string;
  size?: number;
}) {
  const Icon = historyIcons[name as keyof typeof historyIcons] ?? Landmark;

  return <Icon size={size} />;
}
