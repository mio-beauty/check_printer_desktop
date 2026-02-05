import React from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

type Settings = {
  backendUrl: string;
};

export function LoginView(props: {
  online: boolean;
  forcedUpdate: boolean;
  settings: Settings | null;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}) {
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onLogin = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!window.checkPrinter?.warehouseLogin) {
        throw new Error("warehouseLogin недоступен (нужна пересборка desktop/preload)");
      }
      await window.checkPrinter.warehouseLogin(phone.trim().replace(/\s+/g, ""), password);
      setPassword("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Вход</CardTitle>
          <CardDescription>Без access token приложение недоступно.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!props.online && <Badge variant="destructive">Оффлайн: проверь Backend URL и интернет</Badge>}
          {props.forcedUpdate && <Badge variant="destructive">Требуется обновление — вход заблокирован</Badge>}

          <div className="grid gap-2">
            <Label>Backend URL</Label>
            <Input
              value={props.settings?.backendUrl ?? ""}
              onChange={(e) => props.setSettings((p: any) => (p ? { ...p, backendUrl: e.target.value } : { backendUrl: e.target.value }))}
              placeholder="https://printer.backend.miobeauty.uz"
            />
            <div className="text-xs text-muted-foreground">
              Нужен базовый URL backend (без лишних путей). После смены сохрани в настройках (кнопка появится после входа).
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Телефон</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998901234567" />
          </div>
          <div className="grid gap-2">
            <Label>Пароль</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" type="password" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={onLogin} disabled={busy || !phone || !password || props.forcedUpdate}>
              Войти
            </Button>
            {error && <Badge variant="destructive">{error}</Badge>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

