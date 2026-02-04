# Разработка

## Требования

- Node.js 20+
- Windows сборка делается в CI на `windows-latest` (GitHub Actions)

## Установка

```bash
npm install
```

## Запуск в dev

```bash
npm run dev
```

Dev запуск:
- поднимает Vite (renderer)
- компилирует Electron main (`npm run build:electron`)
- запускает Electron и грузит `http://127.0.0.1:5173`

## Сборка

```bash
npm run build
```

## Сборка Windows установщика

```bash
npm run dist:win
```

## Структура проекта

- `electron/` — main/preload
- `src/` — React UI
- `src/components/ui/` — shadcn/ui компоненты
- `scripts/` — утилиты (fake printer, copy_preload)

