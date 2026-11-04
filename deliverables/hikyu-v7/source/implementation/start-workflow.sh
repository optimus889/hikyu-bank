#!/bin/bash
set -euo pipefail
cd "/workspace/hikyu-v7/work/implementation/workflow"
exec "/workspace/hikyu-setup/jdk/bin/java" -cp "target/classes:$(cat classpath.txt)" demo.WorkflowServer
