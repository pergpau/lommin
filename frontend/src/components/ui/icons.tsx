import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function icon(paths: (props: IconProps) => React.ReactNode, defaultStrokeWidth = 2) {
  return function Icon({ size, strokeWidth = defaultStrokeWidth, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        {...props}
      >
        {paths({ size, strokeWidth, ...props })}
      </svg>
    )
  }
}

export const AlertCircleIcon = icon(() => (
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </>
))

export const ArrowRightIcon = icon(() => (
  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
), 1.5)

export const ArrowLeftIcon = icon(() => (
  <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
), 1.5)

export const ChevronLeftIcon = icon(() => (
  <polyline points="15 18 9 12 15 6" strokeLinecap="round" strokeLinejoin="round" />
))

export const CheckIcon = icon(() => (
  <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
))

export const DownloadIcon = icon(() => (
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" />
    <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
  </>
))

export const UploadIcon = icon(() => (
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" />
    <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
  </>
))

export const RefreshCwIcon = icon(() => (
  <>
    <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round" />
  </>
))

export const FileUpIcon = icon(() => (
  <>
    <path d="M12 16v-8m0 0L9 11m3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="3" y="3" width="18" height="18" rx="3" strokeOpacity="0.4" />
  </>
), 1.5)

export const ShieldIcon = icon(() => (
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
), 1.5)

export const AlertTriangleIcon = icon(() => (
  <path
    d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
), 1.5)

export const SunIcon = icon(() => (
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" strokeLinecap="round" />
  </>
), 1.5)

export const MoonIcon = icon(() => (
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round" />
), 1.5)
