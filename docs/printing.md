# Печать

Desktop-клиент печатает чеки, которые приходят от backend по Socket.IO событию `print_text`.

## Формат чека

Backend отправляет в `print_text.text` текст с управляющими «тегами» строк:
- `!BIG` — увеличенный шрифт (ESC/POS)
- `!NORMAL` — сброс стиля
- `!CENTER` / `!LEFT` / `!RIGHT` — выравнивание

Преобразование текста в ESC/POS выполняется в `electron/main/escpos.ts`.

## Печать по LAN (TCP 9100)

Основной путь: принтер слушает `host:port` (обычно `9100`, Raw/JetDirect).

Модули:
- `electron/main/lan_printer.ts` — TCP отправка байтов
- `electron/main/escpos.ts` — сборка ESC/POS job

Настройки:
- host: `settings.printer.host`
- port: `settings.printer.port` (по умолчанию `9100`)

## USB-печать (Windows spooler, RAW)

Поддерживается печать через Windows очередь печати (spooler) отправкой ESC/POS байтов как RAW-документа.

Важно:
- Работает **только на Windows**.
- Должен быть установлен драйвер принтера (например, Xprinter XP‑80T / XP‑80).

Реализация:
- `electron/main/windows_usb_printer.ts` — список принтеров, probe статуса, RAW печать (PowerShell + встроенный C# helper).

Настройки:
- `settings.printer.usbPrinterName` — точное имя принтера в Windows (как в списке устройств/`Get-Printer`).

## Режимы печати

Поле: `settings.printer.mode`
- `lan` — печать только по LAN.
- `usb` — печать только по USB (Windows spooler).
- `lan_then_usb` — **по умолчанию**: сначала LAN, если не получилось — пробуем USB (fallback как в старом `check_printer_client`).

## Ack в backend

После попытки печати клиент отправляет ack-событие:
- `printed_true` при успехе
- `printed_false` при ошибке

И всегда прокидывает:
- `print_job_id`
- `request_id`

