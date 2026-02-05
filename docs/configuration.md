# Конфигурация

## Источник истины: settings.json

Клиент хранит настройки в файле `settings.json` в каталоге `app.getPath("userData")`.
Настройки редактируются в UI и сохраняются кнопкой “Сохранить”.

Структура:
```json
{
  "backendUrl": "https://printer.backend.miobeauty.uz",
  "printerClientToken": "CHANGE-ME-PRINTER-CLIENT-TOKEN",
  "clientId": "uuid",
  "deviceAuth": {
    "printerId": null,
    "accessToken": null,
    "refreshToken": null
  },
  "printer": {
    "name": "Sklad Xprinter XP-80T",
    "host": "192.168.0.100",
    "port": 9100,
    "encoding": "cp866"
  },
  "warehouse": {
    "name": "Sklad",
    "lat": null,
    "lon": null
  }
}
```

## Переменные окружения (дефолты)

Используются только как дефолт при первом запуске или если `settings.json` отсутствует.

- `BACKEND_URL` — URL backend Socket.IO
- `PRINTER_CLIENT_TOKEN` — общий токен для принтер‑клиентов (если включён на backend)
- `PRINTER_IP` — host/IP принтера (LAN)
- `PRINTER_PORT` — порт принтера (обычно `9100`)
- `PRINTER_ENCODING` — кодировка текста для ESC/POS (`cp866` по умолчанию)
- `PRINTER_NAME` — имя принтера (метаданные для backend/UI)
- `WAREHOUSE_NAME` — имя склада (метаданные для backend/UI)

## Активация устройства (device JWT + refresh)

Режим “по бест практис”: desktop устройство активируется одноразовым кодом и получает `deviceAuth.refreshToken`.

Поток:
- На сайте логистов (страница “Принтеры”) админ генерирует одноразовый код (TTL 5–30 минут).
- На ПК с desktop приложением этот код вводят/сканируют в “Статус → Активация устройства”.
- Desktop вызывает `POST /api/device/activate`, получает `{access_token, refresh_token, printer_id}` и сохраняет в `settings.json.deviceAuth`.
- Для `Socket.IO join` desktop отправляет `device_access_token` (короткий JWT). По мере истечения обновляет токен через `POST /api/device/auth/refresh`.

Legacy: `PRINTER_CLIENT_TOKEN` остаётся как fallback, пока не отключён на backend.

## Обновления (политика force/optional)

Клиент читает политику обновлений с backend:
- `GET /api/desktop/update-manifest`

В проде эти значения задаются на backend (env):
- `DESKTOP_LATEST_VERSION`
- `DESKTOP_MIN_SUPPORTED_VERSION` (если версия клиента ниже — **приложение блокируется** экраном-заглушкой и требуется обновление)
- `DESKTOP_DOWNLOAD_URL`
- `DESKTOP_RELEASE_NOTES`

## Поведение клиента

- **Optional update**: показываем предложение обновиться, скачивание/установка только по кнопке.
- **Force update**: показываем экран-заглушку, приложение заблокировано до обновления.

## Best practice

- На складах не правим env: используем UI настройки.
- Для dev без принтера: host=`127.0.0.1`, port=`9100` + `npm run fake-printer`.

## Установка (Windows)

- Desktop ставится **per-user** (без запроса прав администратора / UAC).
