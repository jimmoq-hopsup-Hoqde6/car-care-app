type Props = {
  className?: string;
  compact?: boolean;
};

export function BrandLogo({ className, compact = false }: Props) {
  return (
    // Cropped from Marcel's business-card photo (iOS chrome removed).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={compact ? "/brand/lockup-compact.png" : "/brand/lockup.png"}
      alt="Mobile Car Scratch Repair Adelaide"
      className={
        className ??
        "h-8 w-auto max-w-[min(220px,58vw)] object-contain object-left sm:h-10 sm:max-w-[280px]"
      }
    />
  );
}
