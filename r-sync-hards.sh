#!/bin/bash
SOURCE="/Volumes/otherdata/media/"
DESTINATION="seyar@192.168.0.151:/media/D/media/"

if [ -d "${SOURCE}" ]; then
  #забекапим на внешний винт. Все вместе с симлинкой
  rsync --ignore-existing --delete -raz $SOURCE ${DESTINATION}
  echo $(date -u) "Синхронизировано с ${DESTINATION}"
else
  echo $(date -u) "Не синхронизировано."
fi
