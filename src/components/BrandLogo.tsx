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
        "h-10 w-auto max-w-[min(240px,64vw)] object-contain object-left sm:h-12 sm:max-w-[320px]"
      }
    />
  );
}
