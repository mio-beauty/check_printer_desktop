import * as React from "react";

import { cn } from "../../lib/utils";

export type IconProps = Omit<React.SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number;
  title?: string;
};

export function Icon(props: IconProps) {
  const { size = 20, title, className, children, ...rest } = props;
  const titleId = React.useId();

  return (
    <svg
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden={title ? undefined : true}
      aria-labelledby={title ? titleId : undefined}
      role="img"
      {...rest}
    >
      {title ? <title id={titleId}>{title}</title> : null}
      {children}
    </svg>
  );
}

