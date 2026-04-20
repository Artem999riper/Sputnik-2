# Ruflo — Руководство по использованию

Ruflo — платформа оркестрации агентов на базе Claude для развёртывания многоагентных AI-систем.

---

## Установка

### Вариант 1: Автоматический скрипт
```bash
curl -fsSL https://cdn.jsdelivr.net/gh/ruvnet/ruflo@main/scripts/install.sh | bash
```

### Вариант 2: Через npx (без установки)
```bash
npx ruflo@latest init
```

### Вариант 3: Глобальная установка через npm
```bash
npm install -g ruflo@latest
ruflo init
```

### Вариант 4: Через bun (быстрее)
```bash
bunx ruflo@latest init
```

### Клонирование репозитория
```bash
git clone https://github.com/ruvnet/ruflo.git
cd ruflo
npm install
```

### Предварительные требования
- Node.js 20+
- npm 9+, pnpm или bun
- Claude Code: `npm install -g @anthropic-ai/claude-code`

---

## Настройка

### Переменные окружения
```bash
export ANTHROPIC_API_KEY=your_key_here   # Обязательно для работы с Claude
export OPENAI_API_KEY=your_key_here      # Опционально, для GPT-моделей
export GOOGLE_API_KEY=your_key_here      # Опционально, для Gemini
```

### Группы инструментов (опционально, снижает задержку)
```bash
export CLAUDE_FLOW_TOOL_GROUPS=implement,test,fix,memory
export CLAUDE_FLOW_TOOL_MODE=develop     # develop | pr-review | devops | triage
```

---

## Основные команды

### Инициализация проекта
```bash
ruflo init                # Интерактивная настройка
ruflo init upgrade        # Обновить существующую установку
```

### Управление агентами
```bash
# Создать агента типа "coder" с именем my-coder
ruflo agent spawn -t coder --name my-coder

# Просмотр всех агентов
ruflo agent list

# Статус агентов
ruflo agent status
```

Доступные типы агентов:
- `coder` — разработчик кода
- `tester` — тестировщик
- `reviewer` — ревьюер кода
- `devops` — DevOps-инженер
- `architect` — системный архитектор

### Рой агентов (Swarm)
```bash
ruflo swarm init          # Инициализировать рой
ruflo swarm start         # Запустить рой
ruflo swarm status        # Статус роя
ruflo swarm stop          # Остановить рой
```

### Коллективный разум (Hive-Mind) — многоагентные команды
```bash
# Запустить команду агентов для задачи
ruflo hive-mind spawn "Implement user authentication"

# Статус и метрики
ruflo hive-mind status
ruflo hive-mind metrics
```

### Память агентов
```bash
# Сохранить паттерн/данные
ruflo memory store --key pattern-name --value "data"

# Найти в памяти
ruflo memory search -q "authentication"

# Статистика памяти
ruflo memory stats
```

---

## MCP-интеграция (Model Context Protocol)

### Запуск MCP-сервера
```bash
ruflo mcp start
```

### Подключение к Claude Code
```bash
claude mcp add ruflo -- npx -y ruflo@latest mcp start
```

### Подключение к Claude Desktop
Добавьте в конфиг `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "ruflo": {
      "command": "npx",
      "args": ["-y", "ruflo@latest", "mcp", "start"]
    }
  }
}
```

---

## Безопасность и производительность

```bash
# Аудит безопасности кода
ruflo security scan ./src

# Проверка CVE-уязвимостей
ruflo security cve --database latest

# Бенчмарк производительности
ruflo performance benchmark
```

---

## Семантический поиск и нейронные паттерны

```bash
# Просмотр изученных паттернов
ruflo neural patterns

# Семантический поиск по кодовой базе
ruflo embeddings search -q "error handling"

# Список доступных провайдеров
ruflo providers list
```

---

## RAG (Retrieval-Augmented Generation)

Ruflo поддерживает RAG для обогащения контекста агентов знаниями из документов:

```bash
# Индексирование документов
ruflo rag index ./docs

# Поиск по индексу
ruflo rag search -q "deployment configuration"
```

---

## Типичный сценарий использования

```bash
# 1. Установить
npm install -g ruflo@latest

# 2. Задать ключ API
export ANTHROPIC_API_KEY=sk-ant-...

# 3. Инициализировать проект
ruflo init

# 4. Запустить команду агентов для реализации фичи
ruflo hive-mind spawn "Add JWT authentication to Express.js app"

# 5. Проследить прогресс
ruflo hive-mind status
```

---

## Полезные ссылки

- Репозиторий: https://github.com/ruvnet/ruflo
- Документация: https://github.com/ruvnet/ruflo/blob/main/README.md
