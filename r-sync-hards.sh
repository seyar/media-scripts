#!/bin/bash
#что синкаем
BASEDIR="/Volumes/Data/media/"
#Бекапный винт
BACKUPDIR="/Volumes/otherdata/"
#в какой папке мы запустили скрипт, такую же создадим на бекапном и положим файлы
FOLDER=${BACKUPDIR}`basename "${BASEDIR}"`

if ! [ -d "${FOLDER}" ]; then
  mkdir -p   "${FOLDER}"
fi

if [ -d "${BACKUPDIR}" ]; then
  if [ -d "${FOLDER}" ]; then
    #забекапим на внешний винт. Все вместе с симлинкой
    rsync --update -raz "$BASEDIR" "${FOLDER}"
    echo "Синхронизировано с ${BACKUPDIR}"
  fi
else
  echo "Не синхронизировано."
fi
