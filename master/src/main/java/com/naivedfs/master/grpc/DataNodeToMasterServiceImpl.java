package com.naivedfs.master.grpc;

import com.naivedfs.grpc.*;
import com.naivedfs.master.service.DataNodeRegistry;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import org.springframework.beans.factory.annotation.Autowired;

@GrpcService
public class DataNodeToMasterServiceImpl extends DataNodeToMasterServiceGrpc.DataNodeToMasterServiceImplBase {

    private final DataNodeRegistry dataNodeRegistry;

    @Autowired
    public DataNodeToMasterServiceImpl(DataNodeRegistry dataNodeRegistry) {
        this.dataNodeRegistry = dataNodeRegistry;
    }

    @Override
    public void registerDataNode(RegisterRequest request, StreamObserver<RegisterResponse> responseObserver) {
        dataNodeRegistry.registerNode(request.getDataNodeId(), request.getIpAddress(), request.getPort());
        
        RegisterResponse response = RegisterResponse.newBuilder()
                .setSuccess(true)
                .setMessage("Registered successfully")
                .build();
        
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void sendHeartbeat(HeartbeatRequest request, StreamObserver<HeartbeatResponse> responseObserver) {
        dataNodeRegistry.updateHeartbeat(request.getDataNodeId(), request.getFreeSpaceBytes());
        
        // For now, return an empty response (no commands like replicate/delete yet)
        HeartbeatResponse response = HeartbeatResponse.newBuilder().build();
        
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void sendBlockReport(BlockReportRequest request, StreamObserver<BlockReportResponse> responseObserver) {
        // TODO: Handle block reports to map blocks to DataNodes
        
        BlockReportResponse response = BlockReportResponse.newBuilder()
                .setSuccess(true)
                .build();
        
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }
}
