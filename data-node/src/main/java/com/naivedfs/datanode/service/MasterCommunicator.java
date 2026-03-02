package com.naivedfs.datanode.service;

import com.naivedfs.datanode.config.DataNodeConfig;
import com.naivedfs.grpc.*;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;

@Service
public class MasterCommunicator {
  private static final Logger log = LoggerFactory.getLogger(MasterCommunicator.class);

  @Value("${naivedfs.master.host:localhost}")
  private String masterHost;

  @Value("${naivedfs.master.port:9090}")
  private int masterPort;

  private ManagedChannel masterChannel;
  private DataNodeToMasterServiceGrpc.DataNodeToMasterServiceBlockingStub masterStub;

  private final StorageService storageService;
  private final DataNodeConfig config;

  @Autowired
  public MasterCommunicator(StorageService storageService, DataNodeConfig config) {
    this.storageService = storageService;
    this.config = config;
  }

  @PostConstruct
  public void init() {
    log.info("Connecting to Master Node at {}:{}", masterHost, masterPort);
    masterChannel = ManagedChannelBuilder.forAddress(masterHost, masterPort)
        .usePlaintext()
        .build();
    masterStub = DataNodeToMasterServiceGrpc.newBlockingStub(masterChannel);

    registerWithMaster();
    sendBlockReport();
  }

  private void registerWithMaster() {
    try {
      RegisterRequest req = RegisterRequest.newBuilder()
          .setDataNodeId(config.getNodeId())
          .setIpAddress(config.getIpAddress())
          .setPort(config.getPort())
          .build();
      RegisterResponse res = masterStub.registerDataNode(req);
      if (res.getSuccess()) {
        log.info("Successfully registered with Master Node as {}", config.getNodeId());
      } else {
        log.error("Failed to register with master: {}", res.getMessage());
      }
    } catch (Exception e) {
      log.error("Error communicating with master during registration", e);
    }
  }

  @Scheduled(fixedRate = 5000)
  public void sendHeartbeat() {
    try {
      HeartbeatRequest req = HeartbeatRequest.newBuilder()
          .setDataNodeId(config.getNodeId())
          .setFreeSpaceBytes(storageService.getFreeSpace())
          .build();

      HeartbeatResponse res = masterStub.sendHeartbeat(req);
      // Ignore response for now since we haven't implemented block
      // replication/deletion commands
    } catch (Exception e) {
      log.warn("Heartbeat failed: {}", e.getMessage());
    }
  }

  @Scheduled(fixedRate = 60000)
  public void sendBlockReport() {
    try {
      BlockReportRequest req = BlockReportRequest.newBuilder()
          .setDataNodeId(config.getNodeId())
          .addAllBlockIds(storageService.getAllBlockIds())
          .build();

      BlockReportResponse res = masterStub.sendBlockReport(req);
      log.debug("Sent block report containing {} blocks", req.getBlockIdsCount());
    } catch (Exception e) {
      log.warn("Block report failed: {}", e.getMessage());
    }
  }

  @PreDestroy
  public void shutdown() {
    if (masterChannel != null) {
      masterChannel.shutdown();
    }
  }
}
