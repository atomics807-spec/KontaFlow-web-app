import type { SVGProps } from "react";

export function LogoMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label="KontaFlow"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="kf-mark" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#16A97E" />
          <stop offset="0.55" stopColor="#0B7A5A" />
          <stop offset="1" stopColor="#083C2D" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#kf-mark)" />
      <path
        d="M12 10v20"
        stroke="#F8F5EE"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M27.5 10.5 16.6 20l11.4 9.5"
        stroke="#F8F5EE"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M22.5 15.2 27.9 10.6"
        stroke="#F2B64B"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="30.5" cy="30" r="2.4" fill="#F2B64B" />
    </svg>
  );
}

export function Logo({
  className,
  wordmarkClassName,
}: {
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark className="h-9 w-9 shrink-0" />
      <span className={`text-[1.15rem] font-extrabold tracking-tight ${wordmarkClassName ?? ""}`}>
        Konta<span className="text-jade-600">Flow</span>
      </span>
    </span>
  );
}
