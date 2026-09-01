"use client";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useState } from "react";
import GridKeyFeaturesBorder from "../layout/GridKeyFeaturesBorder";
import HoverCard from "./GridItem";
import { Clock, FileSearch, Lock, LucideIcon, ShieldCheck, Users, Zap } from "lucide-react";

interface dataSchema {
  title: string;
  description: string;
  icon: LucideIcon;
}
export default function RevealKeyFeaturesOnHover() {
  const [data] = useState([
    {
      icon: ShieldCheck,
      title: "Decentralized Verification",
      description:
        "Verification powered by the Thebes Protocol for unmatched transparency and trust.",
    },
    {
      icon: Clock,
      title: "Time-Limited Proof Codes",
      description:
        "Automatically expiring codes ensure time-sensitive verification and enhanced security.",
    },
    {
      icon: Users,
      title: "Role-Based Access Control",
      description:
        "Admins, companies, and employees each get access tailored to their roles and permissions.",
    },
    {
      icon: Zap,
      title: "Real-Time Verification",
      description:
        "Instant results with live blockchain updates for immediate confirmation.",
    },
    {
      icon: Lock,
      title: "Secure Authentication",
      description:
        "Authenticate safely with a Memphis passkey — no wallet, no seed phrase, no password.",
    },
    {
      icon: FileSearch,
      title: "Complete Audit Trail",
      description:
        "Every verification is logged on-chain, ensuring a transparent and tamper-proof history.",
    },
  ]);
  const mediaQuery = useMediaQuery<"base" | "sm">(["base", "sm"]);
  const breakPointsMappedToRows = {
    base: 6,
    sm: 2,
  };

  if (typeof mediaQuery != "string") {
    return null;
  }
  const formattedData: dataSchema[][] = Array.from(
    { length: breakPointsMappedToRows[mediaQuery] },
    (_, i) =>
      data.slice(
        i * (data.length / breakPointsMappedToRows[mediaQuery]),
        i * (data.length / breakPointsMappedToRows[mediaQuery]) +
        data.length / breakPointsMappedToRows[mediaQuery]
      )
  );

  return (
    <div className="grid grid-rows-2 border-y border-y-gray divide-y divide-[#c0c2c4] font-matter">
      {formattedData.map((chunk: dataSchema[], i: number) => (
        <div
          key={"chunk-" + i}
          className="flex justify-around max-sm:gap-4 sm:justify-center"
        >
          {chunk.map((itemData: dataSchema) => (
            <GridKeyFeaturesBorder key={itemData.title}>
              <HoverCard {...itemData} />
            </GridKeyFeaturesBorder>
          ))}
        </div>
      ))}
    </div>
  );
}
