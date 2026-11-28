import * as React from "react";
import { Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import type { CourierApiError, CourierApiResult, CourierCreatePayload, CourierOption, CourierUpdatePayload, CourierUser } from "./types";
import { courierErrorMessage, formatUzPhoneInput, normalizeUzPhone, validateCourierEmail } from "./validation";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  courier?: CourierUser | null;
  options: CourierOption[];
  optionsLoading: boolean;
  optionsError: CourierApiError | null;
  onOpenChange: (open: boolean) => void;
  onLoadOptions: (force?: boolean) => Promise<unknown>;
  onCreate: (payload: CourierCreatePayload) => Promise<CourierApiResult<CourierUser>>;
  onUpdate: (id: number, payload: CourierUpdatePayload) => Promise<CourierApiResult<{ success: boolean }>>;
  onSuccess: (message: string) => void;
};

export function CourierForm(props: Props) {
  const isEdit = props.mode === "edit";
  const [msCourierId, setMsCourierId] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!props.open) return;
    setMsCourierId("");
    setPhone(formatUzPhoneInput(props.courier?.phone ?? ""));
    setPassword("");
    setEmail(props.courier?.email ?? "");
    setDisplayName(props.courier?.display_name ?? "");
    setPasswordVisible(false);
    setFormError(null);
    setFieldErrors({});
    if (!isEdit) void props.onLoadOptions();
  }, [isEdit, props.courier, props.onLoadOptions, props.open]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);
    const nextErrors: Record<string, string> = {};
    const normalizedPhone = normalizeUzPhone(phone);
    const originalPhone = props.courier?.phone ?? null;
    const phoneChanged = normalizedPhone !== originalPhone || (Boolean(phone) && !normalizedPhone);
    if (!isEdit || phoneChanged) {
      if (!normalizedPhone) nextErrors.phone = "Введите номер в формате +998 XX XXX XX XX.";
    }
    if (!isEdit && !msCourierId) nextErrors.courier = "Выберите курьера из каталога.";
    const emailError = validateCourierEmail(email);
    if (emailError) nextErrors.email = emailError;
    if ((!isEdit && password.length < 8) || (isEdit && password.length > 0 && password.length < 8)) {
      nextErrors.password = "Пароль должен содержать не менее 8 символов.";
    }
    if (isEdit && !props.courier) nextErrors.form = "Не удалось загрузить аккаунт курьера.";
    if (isEdit && Object.keys(nextErrors).length === 0) {
      const user = props.courier!;
      const payload: CourierUpdatePayload = {};
      if (normalizedPhone && normalizedPhone !== (user.phone ?? "")) payload.phone = normalizedPhone;
      if (email !== (user.email ?? "")) payload.email = email || null;
      if (displayName !== (user.display_name ?? "")) payload.display_name = displayName || null;
      if (password) payload.password = password;
      if (Object.keys(payload).length === 0) nextErrors.form = "Нет изменений для сохранения.";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const result = isEdit
        ? await props.onUpdate(props.courier!.id, {
            ...(normalizedPhone && normalizedPhone !== (props.courier!.phone ?? "") ? { phone: normalizedPhone } : {}),
            ...(email !== (props.courier!.email ?? "") ? { email: email || null } : {}),
            ...(displayName !== (props.courier!.display_name ?? "") ? { display_name: displayName || null } : {}),
            ...(password ? { password } : {}),
          })
        : await props.onCreate({
            ms_courier_id: msCourierId,
            phone: normalizedPhone!,
            password,
            ...(email ? { email } : {}),
          });

      if (!result.ok) {
        setFormError(courierErrorMessage(result.error));
        return;
      }

      setPhone("");
      setPassword("");
      setEmail("");
      setDisplayName("");
      setMsCourierId("");
      setPasswordVisible(false);
      setFormError(null);
      setFieldErrors({});
      props.onSuccess(isEdit ? "Данные курьера обновлены." : "Аккаунт курьера создан.");
      props.onOpenChange(false);
    } catch (cause) {
      setFormError(courierErrorMessage({ status: 0, message: String((cause as Error)?.message || cause) }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={props.open} onOpenChange={(open) => (!submitting ? props.onOpenChange(open) : undefined)}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="mb-6 pr-8 text-left">
          <SheetTitle>{isEdit ? "Редактировать курьера" : "Добавить курьера"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Измените данные аккаунта Courier Mobile App." : "Создайте аккаунт для существующего курьера МойСклад."}
          </SheetDescription>
        </SheetHeader>

        <form className="flex min-h-0 flex-1 flex-col gap-5" onSubmit={(event) => void onSubmit(event)} noValidate>
          {!isEdit ? (
            <div className="grid gap-2">
              <Label htmlFor="courier-ms-id">Курьер</Label>
              {props.optionsLoading ? (
                <div className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground" role="status">
                  <Loader2 className="size-4 animate-spin" /> Загружаем курьеров…
                </div>
              ) : props.optionsError ? (
                <div className="grid gap-2">
                  <div className="text-sm text-destructive" role="alert">{courierErrorMessage(props.optionsError)}</div>
                  <Button type="button" variant="outline" onClick={() => void props.onLoadOptions(true)}>
                    <RefreshCw className="size-4" /> Повторить загрузку
                  </Button>
                </div>
              ) : props.options.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Нет доступных курьеров для создания аккаунта
                </div>
              ) : (
                <Select
                  id="courier-ms-id"
                  value={msCourierId}
                  onChange={(event) => setMsCourierId(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.courier)}
                  disabled={submitting}
                >
                  <option value="">Выберите курьера…</option>
                  {props.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </Select>
              )}
              {fieldErrors.courier ? <p className="text-sm text-destructive">{fieldErrors.courier}</p> : null}
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="courier-display-name">Имя курьера</Label>
              <Input id="courier-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={255} disabled={submitting} />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="courier-phone">Номер телефона</Label>
            <Input
              id="courier-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(formatUzPhoneInput(event.target.value))}
              placeholder="+998 90 000 00 00"
              aria-invalid={Boolean(fieldErrors.phone)}
              disabled={submitting}
            />
            {fieldErrors.phone ? <p className="text-sm text-destructive">{fieldErrors.phone}</p> : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="courier-email">Email <span className="font-normal text-muted-foreground">(необязательно)</span></Label>
            <Input
              id="courier-email"
              type="email"
              autoComplete="email"
              maxLength={255}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="courier@example.com"
              aria-invalid={Boolean(fieldErrors.email)}
              disabled={submitting}
            />
            {fieldErrors.email ? <p className="text-sm text-destructive">{fieldErrors.email}</p> : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="courier-password">
              Пароль {isEdit ? <span className="font-normal text-muted-foreground">(оставьте пустым, чтобы не менять)</span> : null}
            </Label>
            <div className="relative">
              <Input
                id="courier-password"
                type={passwordVisible ? "text" : "password"}
                autoComplete={isEdit ? "new-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isEdit ? "Новый пароль" : "Не менее 8 символов"}
                aria-invalid={Boolean(fieldErrors.password)}
                className="pr-12"
                disabled={submitting}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
                aria-label={passwordVisible ? "Скрыть пароль" : "Показать пароль"}
                aria-pressed={passwordVisible}
                onClick={() => setPasswordVisible((visible) => !visible)}
                disabled={submitting}
              >
                {passwordVisible ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            {fieldErrors.password ? <p className="text-sm text-destructive">{fieldErrors.password}</p> : null}
          </div>

          {formError ? <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{formError}</div> : null}
          {fieldErrors.form ? <Badge variant="destructive" className="w-fit">{fieldErrors.form}</Badge> : null}

          <div className="mt-auto flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)} disabled={submitting}>Отмена</Button>
            <Button type="submit" disabled={submitting || (!isEdit && (props.optionsLoading || props.optionsError !== null || props.options.length === 0))}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isEdit ? "Сохранить" : "Создать аккаунт"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
