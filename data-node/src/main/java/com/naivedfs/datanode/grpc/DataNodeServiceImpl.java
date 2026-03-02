package com.naivedfs.datanode.grpc;

import com.google.protobuf.ByteString;
import com.naivedfs.datanode.service.StorageService;
import com.naivedfs.grpc.*;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicBoolean;

@GrpcService
public class DataNodeServiceImpl extends DataNodeServiceGrpc.DataNodeServiceImplBase {
  private static final Logger log = LoggerFactory.getLogger(DataNodeServiceImpl.class);

  private final StorageService storageService;

  @Autowired
  public DataNodeServiceImpl(StorageService storageService) {
    this.storageService = storageService;
  }

  @Override
  public StreamObserver<WriteBlockRequest> writeBlock(StreamObserver<WriteBlockResponse> responseObserver) {
    return new StreamObserver<WriteBlockRequest>() {
      private String blockId;
      private List<DataNodeInfo> followerNodes;
      private ByteArrayOutputStream buffer = new ByteArrayOutputStream();

      @Override
      public void onNext(WriteBlockRequest request) {
        if (request.hasMetadata()) {
          this.blockId = request.getMetadata().getBlockId();
          this.followerNodes = request.getMetadata().getFollowerNodesList();
          log.info("Receiving block metadata for blockId: {}, followers: {}", blockId, followerNodes.size());
        } else if (request.hasChunkData()) {
          try {
            buffer.write(request.getChunkData().toByteArray());
          } catch (IOException e) {
            onError(e);
          }
        }
      }

      @Override
      public void onError(Throwable t) {
        log.error("Error receiving block stream", t);
      }

      @Override
      public void onCompleted() {
        log.info("Finished receiving stream for blockId: {}", blockId);
        byte[] data = buffer.toByteArray();

        try {
          // 1. Write locally
          storageService.writeBlock(blockId, data);

          // 2. Replicate to followers if we are the leader
          if (followerNodes != null && !followerNodes.isEmpty()) {
            log.info("Replicating block {} to {} followers...", blockId, followerNodes.size());
            boolean replicationSuccess = replicateToFollowers(blockId, data, followerNodes);
            if (!replicationSuccess) {
              responseObserver.onNext(WriteBlockResponse.newBuilder()
                  .setSuccess(false)
                  .setMessage("Failed to replicate to all followers")
                  .build());
              responseObserver.onCompleted();
              return;
            }
          }

          // 3. Ack success to upstream (either client or leader)
          responseObserver.onNext(WriteBlockResponse.newBuilder()
              .setSuccess(true)
              .setMessage("Block saved successfully")
              .build());
          responseObserver.onCompleted();

        } catch (IOException e) {
          log.error("Failed to process block write for " + blockId, e);
          responseObserver.onNext(WriteBlockResponse.newBuilder()
              .setSuccess(false)
              .setMessage("Internal storage error: " + e.getMessage())
              .build());
          responseObserver.onCompleted();
        }
      }
    };
  }

  private boolean replicateToFollowers(String blockId, byte[] data, List<DataNodeInfo> followers) {
    AtomicBoolean allSuccess = new AtomicBoolean(true);
    CountDownLatch latch = new CountDownLatch(followers.size());

    for (DataNodeInfo follower : followers) {
      ManagedChannel channel = ManagedChannelBuilder.forAddress(follower.getIpAddress(), follower.getPort())
          .usePlaintext()
          .maxInboundMessageSize(150 * 1024 * 1024)
          .build();

      DataNodeServiceGrpc.DataNodeServiceStub stub = DataNodeServiceGrpc.newStub(channel);

      StreamObserver<WriteBlockRequest> requestObserver = stub.writeBlock(new StreamObserver<WriteBlockResponse>() {
        @Override
        public void onNext(WriteBlockResponse value) {
          if (!value.getSuccess()) {
            allSuccess.set(false);
          }
        }

        @Override
        public void onError(Throwable t) {
          log.error("Replication error to follower {}", follower.getDataNodeId(), t);
          allSuccess.set(false);
          latch.countDown();
        }

        @Override
        public void onCompleted() {
          latch.countDown();
        }
      });

      try {
        // Send metadata
        requestObserver.onNext(WriteBlockRequest.newBuilder()
            .setMetadata(BlockMetadata.newBuilder()
                .setBlockId(blockId)
                // Pass empty followers since this is a follower
                .build())
            .build());

        // Send data chunk in 2MB pieces
        int chunkSize = 2 * 1024 * 1024;
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
      } catch (Exception e) {
        log.error("Failed to push stream to follower", e);
        allSuccess.set(false);
        latch.countDown();
      }

      // Channel cleanup would ideally happen asynchronously or be cached,
      // but for naive DFS we do it simply or leave it to GC (not recommended for
      // prod).
    }

    try {
      latch.await();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return false;
    }

    return allSuccess.get();
  }

  @Override
  public void readBlock(ReadBlockRequest request, StreamObserver<ReadBlockResponse> responseObserver) {
    String blockId = request.getBlockId();
    try {
      byte[] data = storageService.readBlock(blockId);
      // Send exactly one chunk for simplicity, in a real system this is streamed in
      // chunks of 4KB/8KB
      responseObserver.onNext(ReadBlockResponse.newBuilder()
          .setChunkData(ByteString.copyFrom(data))
          .build());
      responseObserver.onCompleted();
    } catch (IOException e) {
      log.error("Failed to read block {}", blockId, e);
      responseObserver.onError(e);
    }
  }
}
