import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

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
    );
  };
}

export const AlertCircleIcon = icon(() => (
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </>
));

export const ArrowRightIcon = icon(
  () => <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />,
  1.5,
);

export const ArrowLeftIcon = icon(
  () => <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />,
  1.5,
);

export const ChevronLeftIcon = icon(() => (
  <polyline points="15 18 9 12 15 6" strokeLinecap="round" strokeLinejoin="round" />
));

export const CheckIcon = icon(() => (
  <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
));

export const DownloadIcon = icon(() => (
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" />
    <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
  </>
));

export const UploadIcon = icon(() => (
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" />
    <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
  </>
));

export const RefreshCwIcon = icon(() => (
  <>
    <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
    <path
      d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </>
));

export const FileUpIcon = icon(
  () => (
    <>
      <path d="M12 16v-8m0 0L9 11m3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="3" width="18" height="18" rx="3" strokeOpacity="0.4" />
    </>
  ),
  1.5,
);

export const ShieldIcon = icon(() => <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />, 1.5);

export const AlertTriangleIcon = icon(
  () => (
    <path
      d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  1.5,
);

export const SunIcon = icon(
  () => (
    <>
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
        strokeLinecap="round"
      />
    </>
  ),
  1.5,
);

export const MoonIcon = icon(
  () => (
    <path
      d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  1.5,
);

export const ExternalLinkIcon = icon(
  () => (
    <>
      <path
        d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline points="15 3 21 3 21 9" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round" />
    </>
  ),
  1.5,
);

export const CopyIcon = icon(
  () => (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  1.5,
);

export const ChevronDownIcon = icon(() => (
  <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
));

export const MenuIcon = icon(() => (
  <>
    <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
    <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
    <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
  </>
));

export const XIcon = icon(() => (
  <>
    <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
    <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
  </>
));

export const PlusIcon = icon(() => (
  <>
    <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
    <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
  </>
));

export const TrashIcon = icon(() => (
  <>
    <polyline points="3 6 5 6 21 6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 11v6M14 11v6" strokeLinecap="round" />
    <path d="M9 6V4h6v2" strokeLinecap="round" strokeLinejoin="round" />
  </>
));

export const PencilIcon = icon(
  () => (
    <path
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  1.5,
);

export const HardDriveIcon = icon(() => (
  <>
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
    <circle cx="6" cy="16" r="0.5" fill="currentColor" />
    <circle cx="10" cy="16" r="0.5" fill="currentColor" />
  </>
));

export const GoogleDriveIcon = icon(
  () => (
    <path
      d="M21.4231,13.88785,15.33356,3.33792H8.66663l6.09,10.54993ZM8.08917,4.33835,2,14.88736l3.33356,5.77472,6.08911-10.54926Zm1.73273,10.549L6.48877,20.66208H18.66663L22,14.88736Z"
      stroke="none"
      fill="currentColor"
    />
  ),
  1.5,
);
