import type { KeyboardEvent } from "react";

/** Intercept only the access-code field; never submit onboarding's outer form. */
export function extractOnAccessEnter(
  event: Pick<KeyboardEvent<HTMLInputElement>, "key" | "repeat" | "nativeEvent" | "preventDefault" | "stopPropagation">,
  busy: boolean,
  extract: () => Promise<void>,
) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  event.stopPropagation();
  if (!busy && !event.repeat && !event.nativeEvent.isComposing) void extract();
}
