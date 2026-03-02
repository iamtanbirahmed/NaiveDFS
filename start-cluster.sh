#!/bin/bash

# Build everything first
echo "Building NaiveDFS..."
mvn clean package -DskipTests

# Function to kill child processes on exit
cleanup() {
    echo "Shutting down cluster..."
    pkill -P $$
    exit 0
}
trap cleanup SIGINT SIGTERM

echo "Starting Master Node..."
java -jar master/target/master-1.0.0-SNAPSHOT.jar &
sleep 5 # Wait for master to start

echo "Starting Data Node 1..."
GRPC_PORT=9091 java -jar data-node/target/data-node-1.0.0-SNAPSHOT.jar &

echo "Starting Data Node 2..."
GRPC_PORT=9092 java -jar data-node/target/data-node-1.0.0-SNAPSHOT.jar &

echo "Starting Data Node 3..."
GRPC_PORT=9093 java -jar data-node/target/data-node-1.0.0-SNAPSHOT.jar &

sleep 5 # Wait for data nodes to register

echo "Starting Control Plane..."
java -jar control-plane/target/control-plane-1.0.0-SNAPSHOT.jar &

echo "Cluster is running."
echo "Master: 9090"
echo "DataNodes: 9091, 9092, 9093"
echo "ControlPlane: 8080"
echo "Press Ctrl+C to stop the cluster."

wait
