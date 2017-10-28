#!/bin/bash

#SOURCE="/Volumes/otherdata/media/"
#DESTINATION="seyar@192.168.0.151:/media/D/media/"

# Источник.
SOURCE_DIR="$1/"
# Приемник. Бекапный винт. Папка должна существовать.
DESTINATION_DIR="$2/"

function sync() {
    if [ -d ${DESTINATION_DIR} ]; then
      mkdir -p $FOLDER
      #забекапим на внешний винт. Все вместе с симлинкой
      rsync --ignore-existing -abviuzP $SOURCE_DIR $DESTINATION_DIR

      echo $(date -u) "Синхронизировано с ${DESTINATION_DIR}"
    else
      echo $(date -u) "Не синхронизировано."
    fi
}

sync $arg1 $arg2 || exit 0
