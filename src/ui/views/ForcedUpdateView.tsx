import React from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { ArrowUpCircle, RefreshCw } from "lucide-react";

type Props = {
  currentVersion: string;
  minSupportedVersion: string | null;
  message: string;
  notes?: string | null;
  downloading: boolean;
  progress: number | null;
  error: string | null;
  onUpdate: () => Promise<void> | void;
};

export function ForcedUpdateView(props: Props) {
  const pct = props.downloading ? Math.max(0, Math.min(100, Number(props.progress ?? 0))) : null;

  return (
    <div className="min-h-[calc(100vh-40px)] px-4 py-8">
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-muted p-2">
                <ArrowUpCircle className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <CardTitle>Нужно обновить приложение</CardTitle>
                <CardDescription>
                  Текущая версия: <span className="font-mono">{props.currentVersion}</span>
                  {props.minSupportedVersion ? (
                    <>
                      {" "}
                      • требуется: <span className="font-mono">&gt;= {props.minSupportedVersion}</span>
                    </>
                  ) : null}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="whitespace-pre-wrap text-sm text-muted-foreground">{props.message || "Обновление обязательно."}</div>
            {props.notes ? <div className="whitespace-pre-wrap text-sm">{props.notes}</div> : null}

            {props.error ? <div className="whitespace-pre-wrap text-sm text-destructive">Ошибка обновления: {props.error}</div> : null}

            {pct !== null ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Скачивание обновления: {Math.round(pct)}%</div>
                <Progress value={pct} />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void props.onUpdate()} disabled={props.downloading} className="min-w-[160px]">
                <RefreshCw className="mr-2 h-4 w-4" />
                Обновить
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
