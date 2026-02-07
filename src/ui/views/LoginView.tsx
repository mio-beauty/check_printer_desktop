import React from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import type { Settings } from "../types";

export function LoginView(props: {
  online: boolean;
  forcedUpdate: boolean;
  settings: Settings | null;
  setSettings: React.Dispatch<React.SetStateAction<Settings | null>>;
}) {
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [savingUrl, setSavingUrl] = React.useState(false);
  const [info, setInfo] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const saveBackendUrl = async () => {
    setInfo(null);
    setError(null);
    setSavingUrl(true);
    try {
      const backendUrl = String(props.settings?.backendUrl ?? "").trim();
      if (!backendUrl) throw new Error("Backend URL пустой");
      if (!window.checkPrinter?.setSettings) throw new Error("setSettings недоступен (preload)");
      await window.checkPrinter.setSettings({ backendUrl });
      setInfo("Backend URL сохранён");
    } catch (e) {
      setError(String(e));
    } finally {
      setSavingUrl(false);
    }
  };

  const onLogin = async () => {
    setInfo(null);
    setError(null);
    setBusy(true);
    try {
      if (!window.checkPrinter?.warehouseLogin) {
        throw new Error("warehouseLogin недоступен (нужна пересборка desktop/preload)");
      }
      // Важно: login идёт из main-процесса и читает backendUrl из settings.json.
      // Поэтому сохраняем введённый URL ДО попытки входа.
      if (window.checkPrinter?.setSettings && props.settings?.backendUrl) {
        await window.checkPrinter.setSettings({ backendUrl: String(props.settings.backendUrl).trim() });
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
          {props.forcedUpdate && <Badge variant="destructive">Требуется обновление — вход заблокирован</Badge>}

          <div className="grid gap-2">
            <Label>Backend URL</Label>
            <Input
              value={props.settings?.backendUrl ?? ""}
              onChange={(e) => props.setSettings((p: any) => (p ? { ...p, backendUrl: e.target.value } : { backendUrl: e.target.value }))}
              placeholder="https://printer.backend.miobeauty.uz"
            />
            <div className="text-xs text-muted-foreground">
              Нужен базовый URL backend (без лишних путей). Можно сохранить тут перед входом.
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
            <Button
              variant="outline"
              onClick={saveBackendUrl}
              disabled={savingUrl || busy || !String(props.settings?.backendUrl ?? "").trim()}
            >
              Сохранить URL
            </Button>
            {info && <Badge variant="secondary">{info}</Badge>}
            {error && <Badge variant="destructive">{error}</Badge>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

