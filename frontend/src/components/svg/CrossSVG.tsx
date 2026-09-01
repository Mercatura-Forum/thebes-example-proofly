import { cn } from "@/lib/utils";
import React, { CSSProperties } from "react";

const CrossSVG = ({
  fill,
  className,
  ...rest
}: {
  className?: string;
  style?: CSSProperties;
  fill?: string;
  stroke?: string;
}) => {
  return (
    <svg
      className={cn("rounded-full size-6 stroke-muted-foreground bg-[#F4F4F4]", className)}
      xmlnsXlink="http://www.w3.org/1999/xlink"
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 28 28"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d="M7 14h14" />
      <path d="M14 7v14" />
    </svg>
  );
};

export default CrossSVG;
