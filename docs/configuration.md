# Конфигурация

## Источник истины: settings.json

Клиент хранит настройки в файле `settings.json` в каталоге `app.getPath("userData")`.
Настройки редактируются в UI и сохраняются кнопкой “Сохранить”.

Структура:
```json
{
  "backendUrl": "https://printer.backend.miobeauty.uz",
  "printer": {
    "host": "192.168.0.100",
    "port": 9100,
    "encoding": "cp866"
  }
}
```

## Переменные окружения (дефолты)

Используются только как дефолт при первом запуске или если `settings.json` отсутствует.

- `BACKEND_URL` — URL backend Socket.IO
- `PRINTER_IP` — host/IP принтера (LAN)
- `PRINTER_PORT` — порт принтера (обычно `9100`)
- `PRINTER_ENCODING` — кодировка текста для ESC/POS (`cp866` по умолчанию)

## Best practice

- На складах не правим env: используем UI настройки.
- Для dev без принтера: host=`127.0.0.1`, port=`9100` + `npm run fake-printer`.

