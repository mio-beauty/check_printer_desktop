import * as React from "react";

import IcProfileFilled from "@/assets/icons/ic_profile_filled.svg?react";

import type { IconProps } from "./Icon";

export function ProfileFilledIcon(props: IconProps) {
  const { size = 20, title, ...rest } = props;
  return <IcProfileFilled width={size} height={size} aria-label={title} role="img" focusable="false" {...rest} />;
}

