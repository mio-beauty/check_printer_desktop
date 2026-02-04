# Инструкции для агентa (check_printer_desktop)

Этот репозиторий — Windows‑клиент печати: **Electron (main/preload) + React (renderer) + ESC/POS печать**.

## Быстрый контекст

- Electron main: `electron/main/` (логика подключения к backend, печать, настройки, логи)
- Preload: `electron/preload/index.cjs` (**CommonJS обязателен**, иначе preload может не загрузиться)
- UI (React): `src/ui/App.tsx` (все элементы — через **shadcn/ui** компоненты)
- shadcn компоненты: `src/components/ui/*`
- Tailwind: `src/index.css`, `tailwind.config.cjs`, `postcss.config.cjs`
- Настройки пользователя: `settings.json` в `app.getPath("userData")` (см. `electron/main/settings.ts`)
- Тест без принтера: `npm run fake-printer` (см. `scripts/fake_printer_server.mjs`)

## Команды разработки

- Dev: `npm run dev`
- Fake printer (TCP 9100): `npm run fake-printer`
- Build: `npm run build`
- Windows installer: `npm run dist:win`

## Соглашения и best practices

### UI
- Использовать компоненты shadcn (`src/components/ui/*`), без inline‑стилей.
- Для классов использовать `cn()` из `src/lib/utils.ts`.
- Не добавлять сторонние UI‑библиотеки без необходимости.

### Electron preload
- Preload **только CommonJS** (`.cjs`), потому что Electron загружает preload как CJS; ESM ломает запуск.
- Preload копируется в `dist-electron/preload/` скриптом `scripts/copy_preload.mjs` (см. `npm run build:electron`).

### Печать
- Печать по LAN: TCP на `host:port` (обычно `9100`) + ESC/POS байты (см. `electron/main/escpos.ts`, `electron/main/lan_printer.ts`).
- Важно для backend: ack события должны сохранять `print_job_id` и `request_id` из `print_text`.
- USB‑печать (Windows spooler RAW) — планируется как следующий этап (пока отсутствует).

### Конфигурация
- Дефолты берём из env (`BACKEND_URL`, `PRINTER_*`), но источник истины — `settings.json` (в UI можно менять и сохранять).

## Что делать при изменениях

- Если меняешь IPC контракт — синхронизируй `electron/preload/index.cjs` и `src/ui/App.tsx`.
- Если меняешь печать — обнови `docs/printing.md` и `docs/testing.md`.
- Если меняешь релиз/обновления — обнови `docs/releases.md` и workflow.

