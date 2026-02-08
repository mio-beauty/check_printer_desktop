import { WarehouseQueue } from "../WarehouseQueue";
import type { WarehouseAuthStatus } from "../warehouse/types";

export function WarehousePage(props: {
  active: boolean;
  online: boolean;
  forcedUpdate: boolean;
  auth: WarehouseAuthStatus | null;
}) {
  return <WarehouseQueue active={props.active} online={props.online} forcedUpdate={props.forcedUpdate} auth={props.auth} />;
}

