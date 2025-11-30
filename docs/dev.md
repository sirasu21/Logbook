# 開発中のメモです

```bash
docker compose up -d db

for f in *.sql; do
  echo "apply: $f"
  docker exec -i logbook-db psql -U logbook -d logbook -v ON_ERROR_STOP=1 -f - < "$f"
done

# データベースを削除して作り直す
docker exec -it logbook-db psql -U logbook -d postgres -c "DROP DATABASE logbook;"
docker exec -it logbook-db psql -U logbook -d postgres -c "CREATE DATABASE logbook;"

# 再度 schema/*.sql を流す
for f in *.sql; do
  echo "apply: $f"
  docker exec -i logbook-db psql -U logbook -d logbook -v ON_ERROR_STOP=1 -f - < "$f"
done

mkdir -p docs/db
docker run --rm \
  --network="$(docker network ls --format '{{.Name}}' | grep _default)" \
  -v "$PWD/docs/db:/output" \
  schemaspy/schemaspy:latest \
  -t pgsql \
  -host logbook-db \
  -port 5432 \
  -db logbook \
  -u logbook \
  -p logbook \
  -s public \
  -o /output


mkdir -p docs/db
docker run --rm \
  -v "$PWD/docs/db:/output" \
  schemaspy/schemaspy:latest \
  -t pgsql \
  -host host.docker.internal \
  -port 5432 \
  -db logbook \
  -u logbook \
  -p logbook \
  -s public
```
