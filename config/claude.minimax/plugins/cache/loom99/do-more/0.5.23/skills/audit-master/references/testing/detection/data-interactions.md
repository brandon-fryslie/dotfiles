# Detecting Data Interactions

How to identify all data storage, retrieval, and manipulation patterns in a codebase for testing audit.

## Categories of Data Interaction

| Category | Examples | Testing Concern |
|----------|----------|-----------------|
| Databases | PostgreSQL, MySQL, MongoDB | Transactions, constraints, queries |
| Caches | Redis, Memcached | Invalidation, consistency |
| File storage | Local files, S3, GCS | Permissions, encoding, large files |
| User configuration | Config files, preferences | Defaults, migration, corruption |
| Secrets | Env vars, vaults | Not leaked, properly loaded |
| Session/state | Cookies, JWT, Redis | Expiration, security |

## Database Detection

### ORM/Driver Imports

```bash
# Python
grep -rn "sqlalchemy\|django\.db\|psycopg\|pymongo\|motor\|peewee" --include="*.py"

# JavaScript/TypeScript
grep -rn "sequelize\|typeorm\|prisma\|mongoose\|pg\|mysql2" --include="*.{ts,js}"

# Go
grep -rn "database/sql\|gorm\|sqlx\|mongo-driver" --include="*.go"

# Java
grep -rn "JpaRepository\|JdbcTemplate\|MongoRepository" --include="*.java"
```

### Connection Strings

```bash
# Environment variables
grep -E "DATABASE_URL|DB_HOST|MONGO_URI|REDIS_URL" .env* config/*

# Code patterns
grep -rn "postgresql://\|mysql://\|mongodb://\|redis://" --include="*.{py,ts,js,go}"
```

### Schema/Migration Files

```bash
# Detect migration frameworks
ls -la migrations/ alembic/ db/migrate/ prisma/migrations/ 2>/dev/null
find . -name "*.sql" -path "*/migrations/*"
```

## Cache Detection

### Cache Libraries

```bash
# Redis
grep -rn "redis\|ioredis\|redis-py" --include="*.{py,ts,js}"

# Memcached
grep -rn "memcached\|pylibmc\|memjs" --include="*.{py,ts,js}"

# In-memory
grep -rn "lru_cache\|@cache\|node-cache\|caffeine" --include="*.{py,ts,js,java}"
```

### Cache Patterns

```bash
# Cache decorators/annotations
grep -rn "@cache\|@cached\|@Cacheable" --include="*.{py,java}"

# Manual cache operations
grep -rn "\.get\(.*cache\|\.set\(.*cache\|cache\.get\|cache\.set" --include="*.{py,ts,js}"
```

## File System Detection

### File Operations

```bash
# Python
grep -rn "open(\|Path\|os\.path\|shutil\|pathlib" --include="*.py" | grep -v test

# JavaScript/TypeScript
grep -rn "fs\.\|fs/promises\|readFile\|writeFile" --include="*.{ts,js}"

# Go
grep -rn "os\.Open\|ioutil\|os\.Create\|os\.Write" --include="*.go"
```

### Cloud Storage

```bash
# AWS S3
grep -rn "boto3\|s3\.\|S3Client\|aws-sdk.*s3" --include="*.{py,ts,js}"

# Google Cloud Storage
grep -rn "google\.cloud\.storage\|@google-cloud/storage" --include="*.{py,ts,js}"

# Azure Blob
grep -rn "azure\.storage\.blob\|@azure/storage-blob" --include="*.{py,ts,js}"
```

## Configuration Detection

### Config File Patterns

```bash
# Common config locations
ls -la config/ .config/ settings/ 2>/dev/null
find . -name "*.yaml" -o -name "*.yml" -o -name "*.toml" -o -name "*.ini" | head -20

# Config libraries
grep -rn "pydantic\|configparser\|dotenv\|convict\|config" --include="*.{py,ts,js}"
```

### User Settings Patterns

```bash
# Desktop apps
grep -rn "electron-store\|localStorage\|UserDefaults\|SharedPreferences" --include="*.{ts,js,swift,kt}"

# XDG config
grep -rn "XDG_CONFIG\|~/.config\|AppData" --include="*.{py,ts,js,go}"
```

## Secret Detection

### Environment Variables

```bash
# Secret-like env vars
grep -E "SECRET|API_KEY|TOKEN|PASSWORD|PRIVATE_KEY" .env* --include-dir=config

# Code accessing secrets
grep -rn "os\.environ\|process\.env\|os\.Getenv" --include="*.{py,ts,js,go}" | grep -iE "secret|key|token|password"
```

### Secret Managers

```bash
# Vault
grep -rn "hvac\|vault" --include="*.{py,ts,js}"

# AWS Secrets Manager
grep -rn "secretsmanager\|SecretsManager" --include="*.{py,ts,js}"

# Azure Key Vault
grep -rn "keyvault\|KeyVaultClient" --include="*.{py,ts,js}"
```

## Session/State Detection

### Session Storage

```bash
# Web frameworks
grep -rn "session\[.*\]\|request\.session\|req\.session" --include="*.{py,ts,js}"

# JWT
grep -rn "jwt\|jsonwebtoken\|PyJWT" --include="*.{py,ts,js}"

# Cookies
grep -rn "cookie\|setCookie\|getCookie" --include="*.{py,ts,js}"
```

## Testing Requirements by Data Type

### Databases

| Requirement | Test Approach |
|-------------|---------------|
| Query correctness | Integration tests with test DB |
| Transaction isolation | Concurrent operation tests |
| Migration safety | Run migrations in CI |
| Constraint enforcement | Try invalid data, expect errors |

### Caches

| Requirement | Test Approach |
|-------------|---------------|
| Cache invalidation | Mutate data, verify cache updates |
| Cache miss handling | Test with empty cache |
| TTL behavior | Time-based tests or mocked time |
| Consistency | Compare cached vs fresh data |

### Files

| Requirement | Test Approach |
|-------------|---------------|
| Read/write correctness | Round-trip tests |
| Permission errors | Test with restricted paths |
| Large file handling | Test with size limits |
| Encoding | Test unicode, binary |

### Configuration

| Requirement | Test Approach |
|-------------|---------------|
| Defaults | Test without config file |
| Validation | Test invalid values |
| Migration | Test old config formats |
| Override precedence | Test env > file > defaults |

### Secrets

| Requirement | Test Approach |
|-------------|---------------|
| Not hardcoded | Static analysis, grep |
| Loaded correctly | Integration test with vault |
| Not logged | Audit log output |
| Rotation | Test key rotation scenario |

## Audit Output Format

```markdown
## Data Interaction Analysis

### Databases
| Database | ORM/Driver | Tables/Collections | Tested? |
|----------|------------|-------------------|---------|
| PostgreSQL | SQLAlchemy | users, orders | ✅/❌ |
| MongoDB | motor | events | ✅/❌ |

### Caches
| Cache | Library | Keys/Patterns | Invalidation Tested? |
|-------|---------|---------------|---------------------|
| Redis | ioredis | user:*, session:* | ✅/❌ |

### File Operations
| Type | Library | Paths | Tested? |
|------|---------|-------|---------|
| Local | pathlib | ./uploads/ | ✅/❌ |
| S3 | boto3 | s3://bucket/data/ | ✅/❌ |

### Configuration
| Config | Format | Location | Defaults Tested? |
|--------|--------|----------|-----------------|
| App config | YAML | ./config/app.yaml | ✅/❌ |
| User prefs | JSON | ~/.myapp/config.json | ✅/❌ |

### Secrets
| Secret | Source | Used For | Rotation Tested? |
|--------|--------|----------|-----------------|
| DATABASE_URL | env | DB connection | N/A |
| API_KEY | Vault | External API | ✅/❌ |

### Testing Gaps
- [ ] No test for cache invalidation on user update
- [ ] S3 upload only tested with mocks
- [ ] Config migration from v1 format untested
- [ ] No test for database connection failure handling
```

## Risk Assessment

| Data Type | Failure Impact | Test Priority |
|-----------|---------------|---------------|
| User data DB | Data loss | P0 - Critical |
| Session storage | Auth issues | P0 - Critical |
| Cache | Performance | P1 - High |
| Config files | App won't start | P1 - High |
| Temp files | Cleanup issues | P2 - Medium |
| Logs | Debug difficulty | P3 - Low |
