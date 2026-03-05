package com.naivedfs.controlplane.controller;

import com.google.protobuf.ByteString;
import com.naivedfs.grpc.*;
import com.naivedfs.grpc.Empty;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.stub.StreamObserver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.concurrent.CountDownLatch;

@RestController
@RequestMapping("/api/files")
@CrossOrigin(origins = "*")
public class FileController {
  private static final Logger log = LoggerFactory.getLogger(FileController.class);
  private static final int BLOCK_SIZE = 1024; // 1KB

  @Value("${naivedfs.master.host:localhost}")
  private String masterHost;

  @Value("${naivedfs.master.port:9090}")
  private int masterPort;

  private ManagedChannel masterChannel;
  private ClientToMasterServiceGrpc.ClientToMasterServiceBlockingStub masterStub;

  @PostConstruct
  public void init() {
    masterChannel = ManagedChannelBuilder.forAddress(masterHost, masterPort)
        .usePlaintext()
        .build();
    masterStub = ClientToMasterServiceGrpc.newBlockingStub(masterChannel);
  }

  @PostMapping("/upload")
  public ResponseEntity<String> uploadFile(@RequestParam("file") MultipartFile file) throws IOException {
    String filename = file.getOriginalFilename();
    long fileSize = file.getSize();

    log.info("Starting upload for file: {} ({} bytes)", filename, fileSize);

    // 1. Get Block Allocations from Master
    CreateFileRequest createReq = CreateFileRequest.newBuilder()
        .setFilename(filename)
        .setFileSizeBytes(fileSize)
        .build();

    FileLocationResponse createRes = masterStub.createFile(createReq);
    if (!createRes.getSuccess()) {
      return ResponseEntity.badRequest().body("Failed to allocate blocks: " + createRes.getMessage());
    }

    List<BlockLocation> blocks = createRes.getBlocksList();

    // 2. Stream chunks to Data Nodes
    try (InputStream in = file.getInputStream()) {
      for (BlockLocation blockLoc : blocks) {
        long currentBlockSize = blockLoc.getBlockSize();
        byte[] buffer = new byte[(int) currentBlockSize];

        int read = 0;
        int totalRead = 0;
        while (totalRead < currentBlockSize
            && (read = in.read(buffer, totalRead, (int) currentBlockSize - totalRead)) != -1) {
          totalRead += read;
        }

        if (totalRead != currentBlockSize) {
          throw new IOException("Unexpected EOF while reading block");
        }

        writeBlockToDataNode(blockLoc, buffer);
      }
    }

    return ResponseEntity.ok("File uploaded successfully.");
  }

  private void writeBlockToDataNode(BlockLocation blockLoc, byte[] data) throws IOException {
    DataNodeInfo leader = blockLoc.getLeaderNode();
    ManagedChannel dnChannel = ManagedChannelBuilder.forAddress(leader.getIpAddress(), leader.getPort())
        .usePlaintext()
        .maxInboundMessageSize(150 * 1024 * 1024)
        .build();

    DataNodeServiceGrpc.DataNodeServiceStub dnStub = DataNodeServiceGrpc.newStub(dnChannel);
    CountDownLatch latch = new CountDownLatch(1);
    final boolean[] success = { true };

    StreamObserver<WriteBlockRequest> requestObserver = dnStub.writeBlock(new StreamObserver<WriteBlockResponse>() {
      @Override
      public void onNext(WriteBlockResponse value) {
        if (!value.getSuccess()) {
          log.error("DataNode failed to write block {}: {}", blockLoc.getBlockId(), value.getMessage());
          success[0] = false;
        }
      }

      @Override
      public void onError(Throwable t) {
        log.error("Error communicating with DataNode for block {}", blockLoc.getBlockId(), t);
        success[0] = false;
        latch.countDown();
      }

      @Override
      public void onCompleted() {
        latch.countDown();
      }
    });

    // Send Metadata
    requestObserver.onNext(WriteBlockRequest.newBuilder()
        .setMetadata(BlockMetadata.newBuilder()
            .setBlockId(blockLoc.getBlockId())
            .addAllFollowerNodes(blockLoc.getFollowerNodesList())
            .build())
        .build());

    // Send Chunks
    int chunkSize = 2 * 1024 * 1024; // 2MB pieces
    int offset = 0;
    while (offset < data.length) {
      int length = Math.min(chunkSize, data.length - offset);
      ByteString chunkData = ByteString.copyFrom(data, offset, length);
      requestObserver.onNext(WriteBlockRequest.newBuilder()
          .setChunkData(chunkData)
          .build());
      offset += length;
    }

    requestObserver.onCompleted();

    try {
      latch.await();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IOException("Upload interrupted", e);
    } finally {
      dnChannel.shutdown();
    }

    if (!success[0]) {
      throw new IOException("Failed to write block " + blockLoc.getBlockId() + " to DataNode");
    }
    log.info("Successfully wrote block {} to DataNode {}", blockLoc.getBlockId(), leader.getDataNodeId());
  }

  @GetMapping("/metadata")
  public ResponseEntity<?> getFileMetadata(@RequestParam("filename") String filename) {
    GetFileRequest req = GetFileRequest.newBuilder()
        .setFilename(filename)
        .build();

    FileLocationResponse res = masterStub.getFileLocation(req);
    if (!res.getSuccess()) {
      return ResponseEntity.notFound().build();
    }

    List<java.util.Map<String, Object>> blockMetadata = res.getBlocksList().stream().map(blockLoc -> {
      java.util.Map<String, Object> map = new java.util.HashMap<>();
      map.put("blockId", blockLoc.getBlockId());
      map.put("blockSize", blockLoc.getBlockSize());

      java.util.Map<String, Object> leader = new java.util.HashMap<>();
      leader.put("id", blockLoc.getLeaderNode().getDataNodeId());
      leader.put("ip", blockLoc.getLeaderNode().getIpAddress());
      leader.put("port", blockLoc.getLeaderNode().getPort());
      map.put("leaderNode", leader);

      List<java.util.Map<String, Object>> followers = blockLoc.getFollowerNodesList().stream().map(fn -> {
        java.util.Map<String, Object> fmap = new java.util.HashMap<>();
        fmap.put("id", fn.getDataNodeId());
        fmap.put("ip", fn.getIpAddress());
        fmap.put("port", fn.getPort());
        return fmap;
      }).toList();

      map.put("followerNodes", followers);
      return map;
    }).toList();

    java.util.Map<String, Object> response = new java.util.HashMap<>();
    response.put("filename", filename);
    response.put("success", true);
    response.put("blocks", blockMetadata);

    return ResponseEntity.ok(response);
  }

  @GetMapping("/download")
  public ResponseEntity<InputStreamResource> downloadFile(@RequestParam("filename") String filename)
      throws IOException {
    // 1. Get Block Locations from Master
    GetFileRequest req = GetFileRequest.newBuilder()
        .setFilename(filename)
        .build();

    FileLocationResponse res = masterStub.getFileLocation(req);
    if (!res.getSuccess()) {
      return ResponseEntity.notFound().build();
    }

    List<BlockLocation> blocks = res.getBlocksList();
    ByteArrayOutputStream finalOutput = new ByteArrayOutputStream();

    // 2. Read blocks sequentially
    for (BlockLocation blockLoc : blocks) {
      DataNodeInfo target = blockLoc.getLeaderNode(); // Read from leader for simplicity

      ManagedChannel dnChannel = ManagedChannelBuilder.forAddress(target.getIpAddress(), target.getPort())
          .usePlaintext()
          .maxInboundMessageSize(150 * 1024 * 1024)
          .build();
      DataNodeServiceGrpc.DataNodeServiceBlockingStub dnStub = DataNodeServiceGrpc.newBlockingStub(dnChannel);

      ReadBlockRequest readReq = ReadBlockRequest.newBuilder()
          .setBlockId(blockLoc.getBlockId())
          .build();

      // Assuming data fits in memory stream (naive implementation)
      try {
        dnStub.readBlock(readReq).forEachRemaining(response -> {
          try {
            finalOutput.write(response.getChunkData().toByteArray());
          } catch (IOException e) {
            throw new RuntimeException("Failed to write block to output buffer", e);
          }
        });
      } finally {
        dnChannel.shutdown();
      }
    }

    InputStreamResource resource = new InputStreamResource(new ByteArrayInputStream(finalOutput.toByteArray()));

    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
        .contentType(MediaType.APPLICATION_OCTET_STREAM)
        .body(resource);
  }

  @GetMapping("/list")
  public ResponseEntity<java.util.Map<String, Object>> listFiles() {
    log.info("Fetching list of all files from Master");

    FileListResponse listRes = masterStub.listFiles(Empty.newBuilder().build());

    if (!listRes.getSuccess()) {
      return ResponseEntity.internalServerError().body(java.util.Map.of(
          "success", false,
          "message", "Failed to retrieve file list"));
    }

    return ResponseEntity.ok(java.util.Map.of(
        "success", true,
        "files", listRes.getFilenamesList()));
  }

  @GetMapping("/nodes/{nodeId}")
  public ResponseEntity<java.util.Map<String, Object>> getNodeDetails(@PathVariable String nodeId) {
    log.info("Fetching details for node: {}", nodeId);

    try {
      NodeDetailsRequest req = NodeDetailsRequest.newBuilder().setDataNodeId(nodeId).build();
      NodeDetailsResponse res = masterStub.getNodeDetails(req);

      if (!res.getSuccess()) {
        return ResponseEntity.status(404).body(java.util.Map.of(
            "success", false,
            "message", res.getMessage()));
      }

      List<java.util.Map<String, Object>> blocksList = new java.util.ArrayList<>();
      for (NodeBlockInfo block : res.getBlocksList()) {
        blocksList.add(java.util.Map.of(
            "blockId", block.getBlockId(),
            "blockSize", block.getBlockSize(),
            "filename", block.getFilename(),
            "isLeader", block.getIsLeader()));
      }

      DataNodeInfo nodeInfo = res.getNodeInfo();
      return ResponseEntity.ok(java.util.Map.of(
          "success", true,
          "nodeId", nodeInfo.getDataNodeId(),
          "ipAddress", nodeInfo.getIpAddress(),
          "port", nodeInfo.getPort(),
          "freeSpaceBytes", res.getFreeSpaceBytes(),
          "blocks", blocksList));

    } catch (Exception e) {
      log.error("Failed to fetch node details", e);
      return ResponseEntity.status(500).body(java.util.Map.of(
          "success", false,
          "message", "Failed to fetch node details: " + e.getMessage()));
    }
  }

  @GetMapping("/nodes")
  public ResponseEntity<java.util.Map<String, Object>> getClusterNodes() {
    log.info("Fetching cluster node status");

    try {
      ClusterStatusResponse res = masterStub.getClusterStatus(Empty.newBuilder().build());

      if (!res.getSuccess()) {
        return ResponseEntity.status(500).body(java.util.Map.of(
            "success", false,
            "message", res.getMessage()));
      }

      List<java.util.Map<String, Object>> nodesList = new java.util.ArrayList<>();
      for (DataNodeInfo node : res.getActiveNodesList()) {
        nodesList.add(java.util.Map.of(
            "nodeId", node.getDataNodeId(),
            "ipAddress", node.getIpAddress(),
            "port", node.getPort(),
            "status", "OK"));
      }

      return ResponseEntity.ok(java.util.Map.of(
          "success", true,
          "nodes", nodesList));

    } catch (Exception e) {
      log.error("Failed to fetch cluster status", e);
      return ResponseEntity.status(500).body(java.util.Map.of(
          "success", false,
          "message", "Failed to fetch cluster status: " + e.getMessage()));
    }
  }

  @PreDestroy
  public void shutdown() {
    if (masterChannel != null) {
      masterChannel.shutdown();
    }
  }
}
