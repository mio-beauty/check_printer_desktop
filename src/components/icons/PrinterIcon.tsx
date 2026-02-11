import * as React from "react";

import IcPrinter from "@/assets/icons/ic_printer.svg?react";

import type { IconProps } from "./Icon";

export function PrinterIcon(props: IconProps) {
    const { size = 20, title, ...rest } = props;
    return <IcPrinter width={size} height={size} aria-label={title} role="img" focusable="false" {...rest} />;
}