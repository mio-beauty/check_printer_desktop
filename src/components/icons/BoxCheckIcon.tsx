import * as React from "react";

import IcBoxCheck from "@/assets/icons/ic_box_check.svg?react";

import type { IconProps } from "./Icon";

export function BoxCheckIcon(props: IconProps) {
  const { size = 20, title, ...rest } = props;
  return <IcBoxCheck width={size} height={size} aria-label={title} role="img" focusable="false" {...rest} />;
}

