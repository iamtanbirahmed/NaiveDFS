# NaiveDFS (Distributed File System)

<p align="center">
  <img src="https://iamtanbirahmed.github.io/images/naivedfs-logo.png" alt="NaiveDFS Logo" width="150" />
</p>

<p align="center">
  <a href="https://github.com/iamtanbirahmed/NaiveDFS/actions/workflows/backend-ci.yml"><img src="https://github.com/iamtanbirahmed/NaiveDFS/actions/workflows/backend-ci.yml/badge.svg" alt="Java CI" /></a>
  <a href="https://github.com/iamtanbirahmed/NaiveDFS/actions/workflows/frontend-ci.yml"><img src="https://github.com/iamtanbirahmed/NaiveDFS/actions/workflows/frontend-ci.yml/badge.svg" alt="Next.js CI" /></a>
  <img src="https://img.shields.io/badge/Java-17-orange.svg" alt="Java 17" />
  <img src="https://img.shields.io/badge/Spring%20Boot-3.0-brightgreen.svg" alt="Spring Boot 3" />
  <img src="https://img.shields.io/badge/Next.js-14-black.svg" alt="Next.js" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License" />
</p>

> **Read the blog post:** [Building NaiveDFS: A High-Availability Distributed File System from Scratch](https://iamtanbirahmed.github.io/posts/2026/03/naivedfs-distributed-file-system/)

![NaiveDFS Dashboard](https://iamtanbirahmed.github.io/images/naivedfs-screenshot.png)

NaiveDFS is a high-availability, distributed file system written in Java (Spring Boot) inspired by architectures like Hadoop HDFS. It stores large files by breaking them down into chunks and replicating them across multiple storage nodes for fault tolerance.

The project features a Master node for managing metadata, Data nodes for storing chunks with replication, a Control Plane for the client API, and a beautiful React/Next.js frontend for interacting with the cluster.

---

## 🏗️ Architecture

NaiveDFS consists of four main components, entirely containerized via Docker and orchestrated with `docker-compose`.

1. **Master Node (Port 9090)**
   - Acts as the central brain of the file system.
   - Maintains an in-memory index of all files, their logical blocks, and which Data Nodes hold the physical replicas.
   - Manages Heartbeats and Block Reports from Data Nodes to monitor fleet health.
   - Implements a Write-Ahead Log (WAL) for durability so the metadata index can be rebuilt on startup.

2. **Data Nodes (Ports 9091, 9092, 9093)**
   - The storage workers where the physical file chunks (128MB by default) are saved on disk.
   - Registers with the Master Node on startup.
   - **Single Leader Replication:** When writing a chunk, the Control Plane streams it to a "Leader" Data Node. This leader streams it to "Follower" nodes for replication.

3. **Control Plane**
   - The REST API Gateway and Client Coordinator.
   - Exposes `/api/files/upload` and `/api/files/download` endpoints.
   - Splits incoming files into chunks, requests storage allocation from the Master Node, and streams the chunks directly to the Data Nodes via gRPC.

4. **Web Frontend (Port 3000)**
   - A modern, glassmorphism-themed React & Next.js application.
   - Provides an intuitive drag-and-drop web console to easily upload and retrieve files from the NaiveDFS cluster without using the command line.

- **gRPC** is used for all internal high-performance communication (e.g., Master ↔ Data Node, Control Plane ↔ Master, Control Plane ↔ Data Node, Data Node ↔ Data Node).

---

## 🚀 Getting Started

### Prerequisites

You need the following installed on your machine to build and run the cluster:

- Java 17 (JDK)
- Maven
- Docker and Docker Compose
- Node.js & npm (for the Web Frontend)

### 1. Build the Java Backend

Compile and package the gRPC stubs, Master, Data Node, and Control Plane modules using Maven. There is a parent `pom.xml`, so building from the root will build all submodules.

```bash
mvn clean package -DskipTests
```

### 2. Start the Cluster

Use Docker Compose to build the container images and spin up the Master Node, three Data Nodes, and the Control Plane API.

```bash
docker compose build
docker compose up -d
```

_Note: The containers are configured to use `-Xmx1500m` to comfortably buffer large 128MB chunks in memory._

### 3. Start the Web Frontend

In a separate terminal, navigate to the `frontend` folder to install dependencies and run the Next.js development server.

```bash
cd frontend
npm install
npm run dev
```

You can now open your browser and navigate to **[http://localhost:3000](http://localhost:3000)** to access the NaiveDFS Web Console.

---

## 🧪 Testing

There is an automated integration script included (`test-cluster.sh`) which generates a 300MB file and tests both uploading to and downloading from the cluster using raw `curl` commands.

```bash
./test-cluster.sh
```

---

## ⚙️ How Writing a File Works

1. User uploads a file using the Web UI (or calls the Control Plane REST API).
2. The **Control Plane** asks the **Master Node** for a `FileLocationResponse` (a map of Block IDs to Data Node IP addresses).
3. The **Master** allocates space for 128MB chunks logically, selects a Leader Data Node and Follower Data Nodes for each block, and returns this metadata.
4. The **Control Plane** slices the file and streams a WriteRequest directly to the Leader Data Node.
5. The **Leader Data Node** writes the block to disk and synchronously streams the chunk to its followers over gRPC before acknowledging success.
6. The Master receives asynchronous Heartbeats confirming the blocks exist.

## 🛠️ Built With

- **Java 17 & Spring Boot 3** - Primary Backend Framework
- **gRPC / Protocol Buffers** - Inter-service communication
- **Next.js & React Core** - Web Frontend Framework
- **Tailwind CSS** - UI Styling
- **Docker** - Containerization
