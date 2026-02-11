# Тестирование без принтера (fake printer)

## Зачем

Чтобы проверить цепочку: UI → IPC → ESC/POS → TCP.

## Как запускать

1) В одном терминале:
```bash
npm run fake-printer
```

2) В другом терминале:
```bash
npm run dev
```

3) В UI нажать «Тестовая печать».

## Результат

Fake printer сохраняет каждый «job» в:
- `fake-printer-out/job-<timestamp>.bin`

В терминале fake-printer видно:
- `connection from ...`
- `received N bytes`

## USB (Windows) — тестирование и мониторинг

Работает только на Windows и требует установленный драйвер принтера.

1) Установи драйвер (например, **Xprinter XP‑80T**).
2) Desktop → «Настройки» → «Режим печати»:
   - рекомендуем: `LAN → USB (fallback)` (`lan_then_usb`)
   - либо `Только USB` (`usb`) если LAN не используется
3) Выбери «USB‑принтер (Windows)» — имя должно совпасть с тем, что показывает Windows/`Get-Printer`.
4) Нажми «Проверить USB сейчас»:
   - `ok` — spooler видит принтер, не offline
   - `offline` — принтер помечен как offline в Windows
   - `not_found` — выбранного имени нет в системе
5) Нажми «Тестовая печать (USB)».

Типовые причины ошибок:
- `usb_printer_not_found` — выбрано неверное имя принтера
- `usb_printer_offline` — принтер offline/не готов (Windows/кабель/питание)
- `powershell_failed` — блокировки политики/антивирус/ошибка PowerShell (смотри логи)

## QA: статус-бар (observability)

Проверки делаются в desktop-приложении: сверху всегда виден статус-бар (backend/socket/join/printer/update).

1) **Backend offline (HTTP)**
   - Выключи интернет или поставь неверный `Backend URL`.
   - Ожидаемо: `backend: нет`, действия заблокированы и видна причина.

2) **Socket/join**
   - Неправильный токен/активация.
   - Ожидаемо: `socket: ok`, `join: ...` с причиной.

3) **Printer reachable (LAN)**
   - Запусти `npm run fake-printer` и поставь `printer.host=127.0.0.1`, `printer.port=9100`.
   - Ожидаемо: `printer: ok`, «Тестовая печать» доступна.

4) **Force update**
   - На backend выставь `min_supported_version` выше текущей версии приложения.
   - Ожидаемо: экран «нужно обновить», действия заблокированы.

