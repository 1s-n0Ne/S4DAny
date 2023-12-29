#!/bin/sh

SERVER_PATH='/home/isa/GitRepos/PanalandDev_1.20.1/'

(cd ${SERVER_PATH} && java -Xms2G -Xmx2G -jar paper.jar --nogui)