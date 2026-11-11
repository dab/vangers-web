# Link settings for the browser build of the `vangers` target.

SET(VANGERS_WEB_PRELOAD_DATA "" CACHE PATH
	"Dev only: game data directory baked into vangers.data and mounted at /data")

SET_TARGET_PROPERTIES(vangers PROPERTIES SUFFIX ".mjs")

TARGET_LINK_OPTIONS(vangers PRIVATE
	-sASYNCIFY
	-sASYNCIFY_STACK_SIZE=262144
	-sSTACK_SIZE=8MB
	-sINITIAL_MEMORY=128MB
	-sALLOW_MEMORY_GROWTH
	-sMODULARIZE
	-sEXPORT_ES6
	-sEXPORT_NAME=createVangers
	-sINVOKE_RUN=0
	-sEXIT_RUNTIME=0
	-sENVIRONMENT=web
	-sFORCE_FILESYSTEM
	-sEXPORTED_RUNTIME_METHODS=FS,callMain,IDBFS
	-lidbfs.js
)

IF(VANGERS_WEB_PRELOAD_DATA)
	TARGET_LINK_OPTIONS(vangers PRIVATE
		"SHELL:--preload-file \"${VANGERS_WEB_PRELOAD_DATA}@/data\""
		"SHELL:--exclude-file *.pdb"
	)
ENDIF()
