#!/bin/bash

# Источник.
SOURCE_DIR="$1/"
# Приемник. Бекапный винт. Папка должна существовать.
DESTINATION_DIR="$2/"

function sync() {
    if [ -d ${DESTINATION_DIR} ]; then
      mkdir -p $FOLDER
      rsync -abviuzP --remove-source-files $SOURCE_DIR $DESTINATION_DIR

      echo $(date -u) "Синхронизировано с ${DESTINATION_DIR}"
    else
      echo $(date -u) "Не синхронизировано."
    fi
}

sync $arg1 $arg2 || exit 0
