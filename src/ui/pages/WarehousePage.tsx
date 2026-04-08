import { WarehouseQueue } from "../WarehouseQueue";
import type { WarehouseAuthStatus } from "../warehouse/types";
import type { Settings } from "../types";

export function WarehousePage(props: {
  active: boolean;
  online: boolean;
  forcedUpdate: boolean;
  auth: WarehouseAuthStatus | null;
  settings: Settings | null;
}) {
  return <WarehouseQueue active={props.active} online={props.online} forcedUpdate={props.forcedUpdate} auth={props.auth} settings={props.settings} />;
}
