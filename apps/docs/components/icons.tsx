import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
    </BaseIcon>
  );
}

export function RocketIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 19c1.2-3.4 3.2-5.4 6.6-6.6L19 5c.2 4.2-1.2 7.6-4.2 10.6S8.2 20.2 4 20.4Z" />
      <path d="M9 15 5 19" />
      <path d="m10 9 5 5" />
      <circle cx="14.5" cy="9.5" r="1.5" />
    </BaseIcon>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m12 4 8 4-8 4-8-4 8-4Z" />
      <path d="m4 12 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </BaseIcon>
  );
}

export function SyncIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M20 7h-6V1" />
      <path d="M4 17h6v6" />
      <path d="M20 7a8 8 0 0 0-13.66-3.66L4 5" />
      <path d="M4 17a8 8 0 0 0 13.66 3.66L20 19" />
    </BaseIcon>
  );
}

export function HookIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 7V5a3 3 0 1 1 6 0v6a5 5 0 1 1-10 0V9" />
      <path d="M12 11h.01" />
    </BaseIcon>
  );
}

export function TerminalIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m8 9 3 3-3 3" />
      <path d="M13 15h4" />
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
    </BaseIcon>
  );
}

export function FlaskIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 2h4" />
      <path d="M12 2v6l5.8 9.3A2 2 0 0 1 16.1 20H7.9a2 2 0 0 1-1.7-2.7L12 8" />
      <path d="M8.5 14h7" />
    </BaseIcon>
  );
}

export function ArchitectureIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <path d="M10 6.5h4" />
      <path d="M6.5 10v4" />
      <path d="M17.5 10v4" />
      <path d="M10 17.5h4" />
    </BaseIcon>
  );
}

export function BranchIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M6 4v13" />
      <path d="M6 9h8a4 4 0 0 0 4-4V4" />
      <path d="M6 15h8a4 4 0 0 1 4 4v1" />
      <circle cx="6" cy="4" r="2" />
      <circle cx="18" cy="4" r="2" />
      <circle cx="6" cy="20" r="2" />
      <circle cx="18" cy="20" r="2" />
    </BaseIcon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3 2.8 19a1.2 1.2 0 0 0 1.04 1.8h16.32A1.2 1.2 0 0 0 21.2 19Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </BaseIcon>
  );
}

export function GithubIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 18c-4 1.2-4-2-6-2" />
      <path d="M15 22v-3.1a3.4 3.4 0 0 0-.95-2.63c3.14-.35 6.45-1.54 6.45-7A5.44 5.44 0 0 0 19 5.5 5.07 5.07 0 0 0 18.91 2S17.73 1.65 15 3.48a13 13 0 0 0-6 0C6.27 1.65 5.09 2 5.09 2A5.07 5.07 0 0 0 5 5.5 5.44 5.44 0 0 0 3.5 9.27c0 5.42 3.31 6.61 6.45 7A3.4 3.4 0 0 0 9 18.9V22" />
    </BaseIcon>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M3 21h6" />
      <path d="m14.5 4.5 5 5" />
      <path d="M12 7 5 14v5h5l7-7a1.8 1.8 0 0 0 0-2.5l-2.5-2.5a1.8 1.8 0 0 0-2.5 0Z" />
    </BaseIcon>
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M14 5h5v5" />
      <path d="M10 14 19 5" />
      <path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
    </BaseIcon>
  );
}

export function TocIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M8 6h12" />
      <path d="M8 12h12" />
      <path d="M8 18h12" />
      <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
    </BaseIcon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
    </BaseIcon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m5 12 4.2 4.2L19 6.5" />
    </BaseIcon>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3.5 13.8 8 18.5 9.8 13.8 11.6 12 16.2 10.2 11.6 5.5 9.8 10.2 8Z" />
      <path d="M19 3.8 19.7 5.6 21.5 6.3 19.7 7 19 8.8 18.3 7 16.5 6.3 18.3 5.6Z" />
      <path d="M5 15.8 5.7 17.6 7.5 18.3 5.7 19 5 20.8 4.3 19 2.5 18.3 4.3 17.6Z" />
    </BaseIcon>
  );
}
