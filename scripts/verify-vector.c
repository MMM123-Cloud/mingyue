#include "sqlite3.h"
#include <stdio.h>
static int show(void *unused, int count, char **values, char **names) {
  for (int i = 0; i < count; i++) printf("%s=%s%s", names[i], values[i] ? values[i] : "NULL", i + 1 == count ? "\n" : ", ");
  return 0;
}
int main(int argc, char **argv) {
  sqlite3 *database = NULL;
  char *error = NULL;
  if (argc != 2 || exsqlite3_open(":memory:", &database) != SQLITE_OK) return 1;
  exsqlite3_enable_load_extension(database, 1);
  if (exsqlite3_load_extension(database, argv[1], "sqlite3_vec_init", &error) != SQLITE_OK) {
    fprintf(stderr, "extension: %s\n", error); return 2;
  }
  const char *query = "SELECT vec_version() AS version, vec_distance_l2('[1,2]', '[1,2]') AS zero_distance;"
    "CREATE VIRTUAL TABLE vectors USING vec0(embedding FLOAT[2]);"
    "INSERT INTO vectors(rowid, embedding) VALUES (1, '[1,2]'), (2, '[8,9]');"
    "SELECT rowid, distance FROM vectors WHERE embedding MATCH '[1,2]' AND k = 1 ORDER BY distance;";
  if (exsqlite3_exec(database, query, show, NULL, &error) != SQLITE_OK) {
    fprintf(stderr, "query: %s\n", error); return 3;
  }
  return exsqlite3_close(database) == SQLITE_OK ? 0 : 4;
}