#!/bin/bash
#что синкаем
BASEDIR="/Users/seyar/media"
#Бекапный винт
BACKUPDIR="/Volumes/otherdata/"
#в какой папке мы запустили скрипт, такую же создадим на бекапном и положим файлы
FOLDER=${BACKUPDIR}`basename "${BASEDIR}"`

if [ -d "${BACKUPDIR}" ]; then
  mkdir -p   "${FOLDER}"
  #забекапим на внешний винт. Все вместе с симлинкой
  rsync -uraz --remove-source-files "$BASEDIR/" "${FOLDER}"
  find "${BASEDIR}" -type d -empty -delete
  echo $(date -u) "Синхронизировано с ${BACKUPDIR}"
else
  echo $(date -u) "Не синхронизировано."
fi
