#!/bin/bash
#что синкаем
BASEDIR="/Users/seyar/media"
#Бекапный винт
BACKUPDIR="/Volumes/Data/"
#в какой папке мы запустили скрипт, такую же создадим на бекапном и положим файлы
FOLDER=${BACKUPDIR}`basename "${BASEDIR}"`

if [ -d "${BACKUPDIR}" ]; then
  mkdir -p   "${FOLDER}"
  #забекапим на внешний винт. Все вместе с симлинкой
  rsync --update -raz "$BASEDIR/" "${FOLDER}"
  #rm -rf "$BASEDIR/photos"
  #rm -rf "$BASEDIR/video"
  echo "Синхронизировано с ${BACKUPDIR}"
else
  echo "Не синхронизировано."
fi
