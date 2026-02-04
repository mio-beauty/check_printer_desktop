# Печать

## Формат чека

Backend отправляет в `print_text.text` текст с управляющими “тегами” строк:
- `!BIG` — увеличенный шрифт (ESC/POS `ESC !`)
- `!NORMAL` — сброс стиля
- `!CENTER` / `!LEFT` / `!RIGHT` — выравнивание

Преобразование выполняется в `electron/main/escpos.ts`.

## Печать по LAN (TCP 9100)

Это основной путь: принтер слушает порт `9100` (Raw/JetDirect).

Модули:
- `electron/main/lan_printer.ts` — TCP отправка байтов
- `electron/main/escpos.ts` — сборка ESC/POS job

Параметры:
- host: `settings.printer.host`
- port: `settings.printer.port` (по умолчанию `9100`)
- timeout: 5 секунд

## Ack в backend

После печати обязательно отправляем:
- `printed_true` при успехе
- `printed_false` при ошибке

И всегда прокидываем:
- `print_job_id`
- `request_id`

## TODO (best practice для прод)

- USB печать через Windows spooler RAW (fallback если LAN недоступен).

