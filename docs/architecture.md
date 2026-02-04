# Архитектура

## Компоненты системы

1) **Backend** (`check_printer_backend`)
- Принимает заказы (webhook/ручной запуск).
- Держит очередь/статусы печати.
- Отправляет задания на печать в Socket.IO событии `print_text`.
- Ждёт ack от клиента: `printed_true` / `printed_false`.

2) **Frontend логистов** (`check_printer_frontend`)
- Просмотр очереди/истории, ручная печать.
- Раздел “Скачать приложение” (будет ссылаться на релизы клиента).

3) **Desktop клиент** (`check_printer_desktop`) — этот репозиторий
- Подключается к backend по Socket.IO.
- Печатает локально на принтере с ПК склада (LAN/USB).
- Отправляет ack обратно в backend.

## Поток печати (end‑to‑end)

1) Backend формирует текст чека (форматированный, с командами `!BIG`, `!CENTER`, …).
2) Backend отправляет на клиента событие `print_text`:
   - `{ id, number, text, print_job_id, request_id, attempt, ... }`
3) Клиент печатает локально:
   - LAN: TCP `host:port` (обычно `9100`), отправка ESC/POS байтов
4) Клиент отправляет ack:
   - `printed_true` или `printed_false`
   - обязательно передаёт `print_job_id` и `request_id` из задания
5) Backend фиксирует результат, делает retry/timeout по своим правилам.

## Модули desktop клиента

- `electron/main/index.ts`
  - подключение Socket.IO
  - обработка `print_text`
  - IPC для UI (`getStatus`, `getSettings`, `setSettings`, `testPrint`, `getLogs`)
- `electron/main/settings.ts`
  - `settings.json` в `userData` (настройки backend/printer)
- `electron/main/escpos.ts`
  - преобразование текста чека в ESC/POS байты
- `electron/main/lan_printer.ts`
  - TCP отправка байтов на принтер
- `electron/preload/index.cjs`
  - мост `window.checkPrinter` (IPC API для UI)
- `src/ui/App.tsx`
  - React UI (shadcn компоненты, настройки, логи)

## Важно (TODO для прод‑готовности)

- `join` в Socket.IO уже используется (room=`local_printer`, token/metadata), backend учитывает клиента как “подключённый принтер”.
- Добавить USB fallback (Windows spooler RAW).
- Добавить автообновления (manifest + electron-updater).
