"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, Toggle } from "@/components/ui";
import { cn } from "@/lib/utils";

interface DriverCardProps {
  icon: string;
  title: string;
  description: string;
  driverId: string;
  active: boolean;
  onToggle: (id: string) => void;
}

export function DriverCard({
  icon,
  title,
  description,
  driverId,
  active,
  onToggle,
}: DriverCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        active && "ring-2 ring-teal-500 border-teal-200 bg-teal-50/30"
      )}
      onClick={() => onToggle(driverId)}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <span className="text-3xl">{icon}</span>
          <Toggle
            checked={active}
            onChange={() => onToggle(driverId)}
          />
        </div>
        <CardTitle className="mt-2">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-xs font-medium px-2 py-1 rounded-full inline-block",
            active
              ? "bg-teal-100 text-teal-700"
              : "bg-slate-100 text-slate-500"
          )}
        >
          {active ? "Enabled" : "Disabled"}
        </div>
      </CardContent>
    </Card>
  );
}
