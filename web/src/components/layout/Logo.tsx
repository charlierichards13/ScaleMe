import Image from "next/image";
import { cx } from "@/components/ui/primitives";

/** Checked-in Concept 2 artwork. Choose by surface, never by OS theme. */
export function Logo({
  compact = false,
  compactMobile = false,
  surface = "light",
}: {
  compact?: boolean;
  compactMobile?: boolean;
  surface?: "light" | "dark";
}) {
  const suffix = surface === "dark" ? "-dark" : "";
  return (
    <span className="inline-flex shrink-0 items-center align-middle">
      {(compact || compactMobile) && (
        <Image
          src={`/brand/icon${suffix}.svg`}
          alt="ScaleMe"
          width={36}
          height={36}
          className={cx("h-9 w-9", !compact && "sm:hidden")}
        />
      )}
      {!compact && (
        <Image
          src={`/brand/logo${suffix}.svg`}
          alt="ScaleMe"
          width={560}
          height={159}
          className={cx("h-auto w-36", compactMobile && "hidden sm:block")}
        />
      )}
    </span>
  );
}
