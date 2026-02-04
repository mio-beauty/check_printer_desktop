# check_printer_desktop

Windows‑клиент для печати: Electron (main) + React (renderer).

## Требования
- Node.js 20+

## Запуск в dev
```bash
npm install
npm run dev
```

## Тест без реального принтера (fake printer)
1) В отдельном терминале:
```bash
npm run fake-printer
```
2) Запусти приложение (`npm run dev`) и нажми “Тестовая печать”.
Файлы байтов печати сохраняются в `fake-printer-out/` (как `.bin`).

## Сборка
```bash
npm run dist:win
```

## Переменные окружения
- `BACKEND_URL` — URL backend для Socket.IO (по умолчанию `https://printer.backend.miobeauty.uz`)
- `PRINTER_IP` / `PRINTER_PORT` — LAN‑печать на принтер (по умолчанию в dev: `127.0.0.1:9100`)
- `PRINTER_ENCODING` — кодировка (по умолчанию `cp866`)
