package com.naivedfs.master.grpc;

import com.naivedfs.grpc.*;
import com.naivedfs.master.service.DataNodeRegistry;
import com.naivedfs.master.service.MetadataStore;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@GrpcService
public class ClientToMasterServiceImpl extends ClientToMasterServiceGrpc.ClientToMasterServiceImplBase {

  private static final Logger log = LoggerFactory.getLogger(ClientToMasterServiceImpl.class);
  private static final long BLOCK_SIZE = 1024L; // 1KB
  private static final int REPLICATION_FACTOR = 3;

  private final DataNodeRegistry dataNodeRegistry;
  private final MetadataStore metadataStore;

  @Autowired
  public ClientToMasterServiceImpl(DataNodeRegistry dataNodeRegistry, MetadataStore metadataStore) {
    this.dataNodeRegistry = dataNodeRegistry;
    this.metadataStore = metadataStore;
  }

  @Override
  public void createFile(CreateFileRequest request, StreamObserver<FileLocationResponse> responseObserver) {
    String filename = request.getFilename();
    long fileSize = request.getFileSizeBytes();

    if (metadataStore.fileExists(filename)) {
      responseObserver.onNext(FileLocationResponse.newBuilder()
          .setSuccess(false)
          .setMessage("File already exists")
          .build());
      responseObserver.onCompleted();
      return;
    }

    List<DataNodeInfo> activeNodes = dataNodeRegistry.getActiveDataNodes();
    if (activeNodes.isEmpty()) {
      responseObserver.onNext(FileLocationResponse.newBuilder()
          .setSuccess(false)
          .setMessage("No active DataNodes available")
          .build());
      responseObserver.onCompleted();
      return;
    }

    int numBlocks = (int) Math.ceil((double) fileSize / BLOCK_SIZE);
    if (numBlocks == 0)
      numBlocks = 1; // Even empty files get 1 block

    List<String> blockIds = new ArrayList<>();
    List<BlockLocation> blockLocations = new ArrayList<>();

    for (int i = 0; i < numBlocks; i++) {
      String blockId = UUID.randomUUID().toString();
      blockIds.add(blockId);

      // Select nodes for this block (naive random selection)
      List<DataNodeInfo> selectedNodes = new ArrayList<>(activeNodes);
      Collections.shuffle(selectedNodes);
      selectedNodes = selectedNodes.subList(0, Math.min(REPLICATION_FACTOR, selectedNodes.size()));

      DataNodeInfo leader = selectedNodes.get(0);
      List<DataNodeInfo> followers = selectedNodes.subList(1, selectedNodes.size());

      long currentBlockSize = (i == numBlocks - 1 && fileSize % BLOCK_SIZE != 0) ? (fileSize % BLOCK_SIZE) : BLOCK_SIZE;

      BlockLocation loc = BlockLocation.newBuilder()
          .setBlockId(blockId)
          .setBlockSize(currentBlockSize)
          .setLeaderNode(leader)
          .addAllFollowerNodes(followers)
          .build();

      blockLocations.add(loc);

      // Store ephemeral block locations in the Master memory
      for (DataNodeInfo node : selectedNodes) {
        metadataStore.updateBlockLocation(blockId, node.getDataNodeId());
      }
    }

    // Persist to WAL and memory map
    metadataStore.createFile(filename, blockIds);

    log.info("Allocated {} blocks for file {}", numBlocks, filename);

    FileLocationResponse response = FileLocationResponse.newBuilder()
        .setSuccess(true)
        .setMessage("Blocks allocated successfully")
        .addAllBlocks(blockLocations)
        .build();

    responseObserver.onNext(response);
    responseObserver.onCompleted();
  }

  @Override
  public void getFileLocation(GetFileRequest request, StreamObserver<FileLocationResponse> responseObserver) {
    String filename = request.getFilename();

    if (!metadataStore.fileExists(filename)) {
      responseObserver.onNext(FileLocationResponse.newBuilder()
          .setSuccess(false)
          .setMessage("File not found")
          .build());
      responseObserver.onCompleted();
      return;
    }

    List<String> blockIds = metadataStore.getFileBlocks(filename);
    List<BlockLocation> blockLocations = new ArrayList<>();

    for (String blockId : blockIds) {
      List<String> nodeIds = metadataStore.getBlockLocations(blockId);

      // Map nodeIds to DataNodeInfo
      List<DataNodeInfo> nodes = new ArrayList<>();
      for (String nodeId : nodeIds) {
        dataNodeRegistry.getActiveDataNodes().stream()
            .filter(n -> n.getDataNodeId().equals(nodeId))
            .findFirst()
            .ifPresent(nodes::add);
      }

      if (!nodes.isEmpty()) {
        BlockLocation loc = BlockLocation.newBuilder()
            .setBlockId(blockId)
            .setLeaderNode(nodes.get(0))
            .addAllFollowerNodes(nodes.subList(1, nodes.size()))
            .build();
        blockLocations.add(loc);
      }
    }

    FileLocationResponse response = FileLocationResponse.newBuilder()
        .setSuccess(true)
        .addAllBlocks(blockLocations)
        .build();

    responseObserver.onNext(response);
    responseObserver.onCompleted();
  }

  @Override
  public void listFiles(Empty request, StreamObserver<FileListResponse> responseObserver) {
    java.util.Set<String> files = metadataStore.getAllFiles();

    FileListResponse response = FileListResponse.newBuilder()
        .setSuccess(true)
        .addAllFilenames(files)
        .build();

    responseObserver.onNext(response);
    responseObserver.onCompleted();
  }

  @Override
  public void getNodeDetails(NodeDetailsRequest request, StreamObserver<NodeDetailsResponse> responseObserver) {
    String nodeId = request.getDataNodeId();
    DataNodeInfo nodeInfo = dataNodeRegistry.getNodeInfo(nodeId);

    if (nodeInfo == null) {
      responseObserver.onNext(NodeDetailsResponse.newBuilder()
          .setSuccess(false)
          .setMessage("Node not found")
          .build());
      responseObserver.onCompleted();
      return;
    }

    long freeSpace = dataNodeRegistry.getFreeSpace(nodeId);
    List<String> blockIds = metadataStore.getBlocksForNode(nodeId);
    List<NodeBlockInfo> blockInfos = new ArrayList<>();

    for (String blockId : blockIds) {
      String filename = metadataStore.getFileForBlock(blockId);
      List<String> locations = metadataStore.getBlockLocations(blockId);
      boolean isLeader = !locations.isEmpty() && locations.get(0).equals(nodeId);

      NodeBlockInfo info = NodeBlockInfo.newBuilder()
          .setBlockId(blockId)
          .setBlockSize(BLOCK_SIZE)
          .setFilename(filename != null ? filename : "Unknown")
          .setIsLeader(isLeader)
          .build();
      blockInfos.add(info);
    }

    NodeDetailsResponse response = NodeDetailsResponse.newBuilder()
        .setSuccess(true)
        .setMessage("Node details retrieved")
        .setNodeInfo(nodeInfo)
        .setFreeSpaceBytes(freeSpace)
        .addAllBlocks(blockInfos)
        .build();

    responseObserver.onNext(response);
    responseObserver.onCompleted();
  }
}
