import { SVGProps } from "react";

export function TennisBall(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <circle cx="32" cy="32" r="30" />
      <path
        d="M2 32c0-8 3.5-15 10-20 6 5 10 12 10 20s-4 15-10 20C5.5 47 2 40 2 32Z"
        fill="#ffffff"
        fillOpacity="0.9"
      />
      <path
        d="M62 32c0 8-3.5 15-10 20-6-5-10-12-10-20s4-15 10-20c6.5 5 10 12 10 20Z"
        fill="#ffffff"
        fillOpacity="0.9"
      />
      <path
        d="M12 12c6 5 10 12 10 20s-4 15-10 20"
        stroke="#0F1B14"
        strokeOpacity="0.35"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M52 12c-6 5-10 12-10 20s4 15 10 20"
        stroke="#0F1B14"
        strokeOpacity="0.35"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}
