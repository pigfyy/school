#!/bin/sh
# javac is not on PATH here (JRE-only install), but the jdk.compiler module is present.
exec java -m jdk.compiler/com.sun.tools.javac.Main "$@"
